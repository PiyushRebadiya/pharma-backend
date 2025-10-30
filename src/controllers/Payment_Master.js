const { errorMessage, getCommonAPIResponse, setSQLBooleanValue, checkKeysAndRequireValues, successMessage, getCommonKeys, generateUUID, getServerIpAddress, setSQLNumberValue, generateSixDigitCode, deleteImage, toFloat, setSQLStringValue } = require("../common/main");
const members = require("../common/member_category");
const { pool } = require("../sql/connectToDatabase");

const fetchPaymentMaster = async (req, res) => {
    try {
        const { PaymentId, PaymentUkeyId, OrganizerUkeyId, UserUkeyId, EventUkeyId, Person } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (PaymentId) {
            whereConditions.push(`pm.PaymentId = '${PaymentId}'`);
        }
        if(PaymentUkeyId){
            whereConditions.push(`pm.PaymentUkeyId = '${PaymentUkeyId}'`);
        }
        if(OrganizerUkeyId){
            whereConditions.push(`pm.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if(UserUkeyId){
            whereConditions.push(`pm.UserUkeyId = '${UserUkeyId}'`);
        }
        if(EventUkeyId){
            whereConditions.push(`pm.EventUkeyId = '${EventUkeyId}'`);
        }
        if(Person){
            whereConditions.push(`pm.Person = '${Person}'`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        // const getUserList = {
        //     getQuery: `SELECT * FROM PaymentMaster ${whereString} ORDER BY PaymentId DESC`,
        //     countQuery: `SELECT COUNT(*) AS totalCount FROM PaymentMaster ${whereString}`,
        // };
        const getUserList = {
            getQuery: `select pm.*,om.OrganizerName,FirstName AS FullName,EventName,um.Mobile1 from paymentmaster pm left join
            OrganizerMaster om on om.OrganizerUkeyId=pm.OrganizerUkeyId left join UserMaster um on um.UserUkeyId=pm.UserUkeyId
            left join EventMaster em on em.EventUkeyId=pm.EventUkeyId ${whereString} ORDER BY pm.PaymentId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM PaymentMaster pm ${whereString}`,
        }
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const fetchPaymentAndTickets = async (req, res) => {
    try {
    const { 
            PaymentId,
            PaymentUkeyId,
            OrganizerUkeyId,
            UserUkeyId,
            EventUkeyId,
            Person,
            RazorPayId
        } = req.query;

        let whereConditions = [];

        // Build the WHERE clause for PaymentMaster
        if (PaymentId) whereConditions.push(`pm.PaymentId = '${PaymentId}'`);
        if (PaymentUkeyId) whereConditions.push(`pm.PaymentUkeyId = '${PaymentUkeyId}'`);
        if (OrganizerUkeyId) whereConditions.push(`pm.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        if (UserUkeyId) whereConditions.push(`pm.UserUkeyId = '${UserUkeyId}'`);
        if (EventUkeyId) whereConditions.push(`pm.EventUkeyId = '${EventUkeyId}'`);
        if (Person) whereConditions.push(`pm.Person = '${Person}'`);
        if (RazorPayId) whereConditions.push(`pm.RazorPayId = '${RazorPayId}'`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query to fetch PaymentMaster with related TicketMaster data
        const getUserList = {
            getQuery: `
                SELECT 
                    pm.PaymentId,
                    pm.PaymentUkeyId,
                    pm.OrganizerUkeyId,
                    pm.UserUkeyId,
                    pm.EventUkeyId,
                    pm.PassCategory,
                    pm.Amount,
                    pm.PerTicketPrice,
                    pm.Person,
                    pm.UsrName,
                    pm.UsrID,
                    pm.IpAddress,
                    pm.HostName,
                    pm.EntryDate AS PaymentEntryDate,
                    pm.flag AS PaymentFlag,
                    pm.RazorPayId,
                    pm.OrderId,
                    pm.Signature,
                    om.OrganizerName, 
                    um.FirstName AS FullName, 
                    em.EventName,
                    tm.TicketId,
                    tm.TicketUkeyId,
                    tm.UserCode,
                    tm.Name AS TicketHolderName,
                    tm.Mobile AS TicketHolderMobile,
                    tm.Verify AS TicketVerifyStatus,
                    tm.SubCategory,
                    tm.MemberType,
                    tm.GateNo,
                    tm.PCUkeyId,
                    tm.EntryDate AS TicketEntryDate,
                    tm.Remark,
                    pc.Name AS ProfessionName
                FROM PaymentMaster pm
                LEFT JOIN TicketMaster tm ON pm.PaymentUkeyId = tm.PaymentUkeyId
                LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = pm.OrganizerUkeyId
                LEFT JOIN UserMaster um ON um.UserUkeyId = pm.UserUkeyId
                LEFT JOIN EventMaster em ON em.EventUkeyId = pm.EventUkeyId
                LEFT JOIN professionCategory pc ON tm.PCUkeyId = pc.PCUkeyId
                ${whereString}
                ORDER BY pm.PaymentId DESC, tm.TicketId
            `,
            countQuery: `
                SELECT COUNT(DISTINCT pm.PaymentUkeyId) AS totalCount 
                FROM PaymentMaster pm
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        // Transform the result: group tickets under each payment
        const groupedData = result.data && result.data.reduce((acc, row) => {
            const paymentKey = row.PaymentUkeyId;

            // Extract ticket data
            const ticketData = {
                TicketId: row.TicketId,
                TicketUkeyId: row.TicketUkeyId,
                UserCode: row.UserCode,
                TicketHolderName: row.TicketHolderName,
                TicketHolderMobile: row.TicketHolderMobile,
                TicketVerifyStatus: row.TicketVerifyStatus,
                TicketEntryDate: row.TicketEntryDate,
                SubCategory: row.SubCategory,
                MemberType: row.MemberType,
                PCUkeyId: row.PCUkeyId,
                GateNo: row.GateNo,
                TicketRemark: row.Remark,
                ProfessionName: row.ProfessionName
            };

            // If the payment record does not exist, create it
            if (!acc[paymentKey]) {
                acc[paymentKey] = {
                    PaymentId: row.PaymentId,
                    PaymentUkeyId: row.PaymentUkeyId,
                    OrganizerUkeyId: row.OrganizerUkeyId,
                    UserUkeyId: row.UserUkeyId,
                    EventUkeyId: row.EventUkeyId,
                    Amount: row.Amount,
                    PerTicketPrice: row.PerTicketPrice,
                    PassCategory: row.PassCategory,
                    Person: row.Person,
                    UsrName: row.UsrName,
                    UsrID: row.UsrID,
                    IpAddress: row.IpAddress,
                    HostName: row.HostName,
                    PaymentEntryDate: row.PaymentEntryDate,
                    PaymentFlag: row.PaymentFlag,
                    RazorPayId: row.RazorPayId,
                    OrderId: row.OrderId,
                    Signature: row.Signature,
                    OrganizerName: row.OrganizerName,
                    FullName: row.FullName,
                    EventName: row.EventName,
                    Tickets: [],
                };
            }

            // Add the ticket data to the Tickets array
            if (ticketData.TicketId) {
                acc[paymentKey].Tickets.push(ticketData);
            }

            return acc;
        }, {});

        // Convert grouped data into an array
        const response = Object.values(groupedData);

        return res.json({
            data: response,
            totalLength: result.totalLength,
        });
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const setPaymentFlag = async (req, res) => {
    try {
        const { Person, Category = 'GENERAL' } = req.query;
        const result = await pool.request().query(`
            SELECT GateNo, Limits FROM TicketLimitMaster 
            WHERE IsActive = 1 AND Category = '${Category}'
        `);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(400).send({ message: 'No rows of TicketLimitMaster' });
        }

        const Limits = result.recordset[0]?.Limits;
        const response = await pool.query(`
            SELECT GateNo, COUNT(*) AS count
            FROM TicketMaster
            GROUP BY GateNo
            ORDER BY count DESC
        `);

        const TotalUserOfGate = response.recordset || [];
        const gateCounts = new Map(TotalUserOfGate.map(item => [item.GateNo, item.count || 0]));

        const gatesObject = result.recordset
            .flatMap(row => row.GateNo?.split(',') || [])
            .reduce((acc, gate) => {
                acc[gate] = gateCounts.get(gate) || 0;
                return acc;
            }, {});

        const minEntry = Object.entries(gatesObject).reduce((min, [key, value]) => {
            return value < min.value ? { key, value } : min;
        }, { key: null, value: Infinity });

        const totalGates = result.recordset.flatMap(row => row.GateNo?.split(',') || []).length;
        const gateLimits = totalGates > 0 ? Limits / totalGates : 0;

        const totalOfCountInGate = (Number(minEntry.value) + Number(Person));
        if (totalOfCountInGate > (Limits / totalGates)) {
            const remainingCapacity = Object.fromEntries(
                Object.entries(gatesObject).map(([gate, count]) => [gate, Math.max(0, gateLimits - count)])
            );

            return res.status(400).send({
                message: `Gate ${minEntry.key} is full!`,
                availableSpace: remainingCapacity,
                bookedseetInGate: gatesObject,
                gateLimits,
                totalLimits: Limits,
                totalGates
            });
        }

        return res.status(200).send(minEntry.key);
    } catch (error) {
        console.error('Error:', error);
        return res.status(400).send({ error: error?.message || 'An error occurred' });
    }
};

const setGateNoDynamically = async (req, res, Person, Category) => {
    try {
        const ticketLimitQuery = `
            SELECT GateNo, Limits 
            FROM TicketLimitMaster 
            WHERE IsActive = 1 AND Category = '${Category}'
        `;
        const result = await pool.request().query(ticketLimitQuery);

        if (!result.recordset || result.recordset.length === 0) {
            return { status: 400, error: 'No rows of TicketLimitMaster' };
        }

        const Limits = result.recordset[0]?.Limits;
        const ticketMasterQuery = `
            SELECT GateNo, COUNT(*) AS count
            FROM TicketMaster
            GROUP BY GateNo
            ORDER BY count DESC
        `;
        const response = await pool.query(ticketMasterQuery);

        const TotalUserOfGate = response.recordset || [];
        const gateCounts = new Map(TotalUserOfGate.map(item => [item.GateNo, item.count || 0]));

        const gatesObject = result.recordset
            .flatMap(row => row.GateNo?.split(',') || [])
            .reduce((acc, gate) => {
                acc[gate] = gateCounts.get(gate) || 0;
                return acc;
            }, {});

        const minEntry = Object.entries(gatesObject).reduce((min, [key, value]) => {
            return value < min.value ? { key, value } : min;
        }, { key: null, value: Infinity });

        const totalGates = result.recordset.flatMap(row => row.GateNo?.split(',') || []).length;
        const gateLimits = totalGates > 0 ? Limits / totalGates : 0;

        const totalOfCountInGate = (Number(minEntry.value) + Number(Person));
        if (totalOfCountInGate > gateLimits) {
            const remainingCapacity = Object.fromEntries(
                Object.entries(gatesObject).map(([gate, count]) => [gate, Math.max(0, gateLimits - count)])
            );

            return {
                status: 400,
                error: `Gate ${minEntry.key} is full!`,
                data: {
                    availableSpace: remainingCapacity,
                    bookedSeatsInGate: gatesObject,
                    gateLimits,
                    totalLimits: Limits,
                    totalGates
                }
            };
        }

        return { status: 200, gateNo: minEntry.key };
    } catch (error) {
        console.error('Error in setGateNoDynamically:', error);
        return { status: 500, error: error.message };
    }
};

const addPaymentMaster = async (req, res) => {
    const {
        OrganizerUkeyId,
        UserUkeyId,
        EventUkeyId,
        Amount,
        Person,
        Members = [],
        RazorPayId = '',
        OrderId = '',
        Signature = '',
        TransactionUkeyId = '',
        Status = 'Pending',
        PassCategory = '',
        PerTicketPrice = 0,
        IsPayment = false
    } = req.body;

    const PaymentImg = req?.files?.PaymentImg?.length ? `${req.files.PaymentImg[0]?.filename}` : '';
    try {
        const MembersJson = Members ? JSON.parse(Members) : [];

        if (MembersJson.length < 1) {
            return res.status(400).send({ error: 'Please select at least one member' });
        }

        const userData = await pool.request().query(`
            SELECT MemberType, MemberCategory 
            FROM UserMaster 
            WHERE UserUkeyId = '${UserUkeyId}'
        `);

        if (!userData.recordset || userData.recordset.length === 0) {
            return res.status(400).send({ error: 'User not found' });
        }

        const MemberTypeUserData = userData.recordset[0]?.MemberCategory;
        const gateResponse = await setGateNoDynamically(req, res, Person, MemberTypeUserData);

        if (gateResponse.status !== 200) {
            return res.status(gateResponse.status).send({ error: gateResponse.error, data: gateResponse.data });
        }

        const gateNo = gateResponse.gateNo;
        const fieldCheck = checkKeysAndRequireValues(
            ['Person', 'OrganizerUkeyId', 'UserUkeyId', 'EventUkeyId', 'Amount'],
            req.body
        );

        if (fieldCheck.length !== 0) {
            if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path);
            return res.status(400).send({ error: `${fieldCheck.join(', ')} is required` });
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const PaymentUkeyId = generateUUID();
        const UserId = req?.user?.UserId;

        const insertQuery = `
            INSERT INTO PaymentMaster 
            (PaymentUkeyId, OrganizerUkeyId, UserUkeyId, EventUkeyId, Amount, Person, RazorPayId, OrderId, Signature, UsrID, IpAddress, HostName, EntryDate, flag, TransactionUkeyId, Status, PaymentImg, PassCategory, PerTicketPrice, IsPayment) 
            VALUES 
            (${setSQLStringValue(PaymentUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLNumberValue(Amount)}, ${setSQLNumberValue(Person)}, ${setSQLStringValue(RazorPayId)}, ${setSQLStringValue(OrderId)}, ${setSQLStringValue(Signature)}, ${setSQLStringValue(UserId)}, '${IPAddress}', '${ServerName}', '${EntryTime}', N'A', ${setSQLStringValue(TransactionUkeyId)}, ${setSQLStringValue(Status)}, ${setSQLStringValue(PaymentImg)}, ${setSQLStringValue(PassCategory)}, ${toFloat(PerTicketPrice)}, ${setSQLBooleanValue(IsPayment)});
        `;
        const result = await pool.query(insertQuery);

        for (const member of MembersJson) {
            const PaymentDetailUkeyId = generateUUID();
            const randomCode = generateSixDigitCode();
            const { Name, Mobile, MemberType = '', SubCategory = '', PCUkeyId = '', Remark = '' } = member;

            const ticketInsertQuery = `
                INSERT INTO TicketMaster 
                (TicketUkeyId, Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId, UsrID, IpAddress, HostName, EntryDate, flag, UserCode, Verify, GateNo, MemberType, SubCategory, IsPayment, PCUkeyId, Remark) 
                VALUES 
                (${setSQLStringValue(PaymentDetailUkeyId)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(PaymentUkeyId)}, ${setSQLStringValue(UserId)}, '${IPAddress}', '${ServerName}', '${EntryTime}', N'A', ${setSQLStringValue(randomCode)}, 0, ${setSQLStringValue(gateNo)}, ${setSQLStringValue(MemberType)}, ${setSQLStringValue(SubCategory)}, ${setSQLBooleanValue(IsPayment)}, ${setSQLStringValue(PCUkeyId)}, ${setSQLStringValue(Remark)});
            `;
            await pool.query(ticketInsertQuery);
        }

        if (result?.rowsAffected[0] === 0) {
            if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path);
            return res.status(400).send({ error: 'No rows inserted into Payment Master' });
        }

        return res.status(200).send({
            message: 'Data inserted successfully!',
            success: true,
            ...req.body,
            PaymentImg,
            PaymentUkeyId
        });
    } catch (error) {
        if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path);
        console.error('AddPaymentMaster Error:', error);
        return res.status(400).send({ error: error.message });
    }
};


const updatePaymentMaster = async (req, res) => {
    const { OrganizerUkeyId, UserUkeyId, EventUkeyId, Amount, Person, PaymentUkeyId, Members, RazorPayId = '', OrderId = '', Signature = '', TransactionUkeyId = '', Status = 'Pending', PassCategory = '', PerTicketPrice, MemberType = '', SubCategory = '', IsPayment = false } = req.body;
    let { PaymentImg = '' } = req.body;
    PaymentImg = req?.files?.PaymentImg?.length ? `${req?.files?.PaymentImg[0]?.filename}` : PaymentImg;
    const MembersJson = JSON.parse(Members);
    try {
        // const bookedseetInGate = await pool.request().query(`
        //     SELECT GateNo, COUNT(*) AS count
        //     FROM TicketMaster
        //     GROUP BY GateNo
        //     ORDER BY count DESC;
        // `);
        // const userData = await pool.request().query(`SELECT MemberType FROM UserMaster WHERE UserUkeyId = '${UserUkeyId}'`);

        // const MemberTypeUserData = userData.recordset[0]?.MemberType;

        // let gateNo = ''; // Initialize the gate number variable
        // let currentCounts = { 'C': 0, 'D': 0, 'B-2': 0, 'C-2': 0, 'B-1': 0, 'C-1': 0 }; // Track current seat counts for each gate

        // // Populate currentCounts based on query results
        // bookedseetInGate.recordset.forEach((row) => {
        //     currentCounts[row.GateNo] = row.count;
        // });

        // const resultOfLimit = await pool.request().query(`SELECT Category, Limits FROM TicketLimitMaster`);

        // const arrayOfLimit = resultOfLimit.recordset;
        // if(arrayOfLimit.length < 1) {
        //     return res.status(400).send(errorMessage('Ticket limit not found'));
        // }

        // const PA_CAPACITY = Number(arrayOfLimit.find((item) => item.Category === 'PA')?.Limits || 0) || 0; // Set limit for C-2 gate And B-2 gate 
        // const WPA_CAPACITY = (Number(arrayOfLimit.find((item) => item.Category === 'WPA')?.Limits || 0)) + Number((arrayOfLimit.find((item) => item.Category === 'BK')?.Limits || 0)) || 0; // WPA + BK Set limit for C-1 gate
        // const GENERAL_CAPACITY = Number(arrayOfLimit.find((item) => item.Category === 'GENERAL')?.Limits) || 0; // Set limit for C gate And D gate
        // const VVIP_CAPACITY = Number(arrayOfLimit.find((item) => item.Category === 'VVIP')?.Limits) || 0;

        // const membersToAdd = MembersJson?.length || 0; // Number of members to add

        // const sendGateFullError = (gateName, availableSpace) => {
        //     return res.status(400).send({
        //         ...errorMessage(`${gateName} gate is full!`),
        //         data: {
        //             [gateName]: availableSpace < 0 ? 0 : availableSpace // If available space is negative, set it to 0
        //         }
        //     });
        // };

        // // Check if gate is full before trying to assign it
        // if (members["PA"].includes(MemberTypeUserData)) {
        //     // B-2 vs C-2 with limits
        //     if (currentCounts['B-2'] + membersToAdd <= PA_CAPACITY && currentCounts['B-2'] <= currentCounts['C-2']) {
        //         gateNo = 'B-2';
        //     } else if (currentCounts['C-2'] + membersToAdd <= PA_CAPACITY && currentCounts['C-2'] < currentCounts['B-2']) {
        //         gateNo = 'C-2';
        //     } else if (currentCounts['B-2'] + membersToAdd > PA_CAPACITY && currentCounts['C-2'] + membersToAdd > PA_CAPACITY) {
        //          // Calculate the available space left for each gate
        //          const availableB2 = PA_CAPACITY - currentCounts['B-2'];
        //          const availableC2 = PA_CAPACITY - currentCounts['C-2'];
        //          return sendGateFullError('B-2 And C-2', { "B-2": availableB2, "C-2": availableC2 });
        //     } else {
        //         gateNo = 'B-2'; // Default to B-2 if none of the conditions are met
        //     }
        // } else if (members["WPA"].includes(MemberTypeUserData) || members["BK"].includes(MemberTypeUserData)) {
        //     // Check for C-1 with new limit of 5
        //     if (currentCounts['C-1'] + membersToAdd <= WPA_CAPACITY) {
        //         gateNo = 'C-1';
        //     } else {

        //         return sendGateFullError('C-1', WPA_CAPACITY - currentCounts['C-1']);
        //     }
        // } else if (members["VVIP"].includes(MemberTypeUserData)) {
        //     // Check for BK with new limit of 5
        //     if (currentCounts['B-1'] + membersToAdd <= VVIP_CAPACITY) {
        //         gateNo = 'B-1';
        //     } else {
        //         return sendGateFullError('B-1', VVIP_CAPACITY - currentCounts['B-1']);
        //     }
        // } else {
        //     // Assign to the gate with fewer members
        //     if (currentCounts['C'] + membersToAdd <= GENERAL_CAPACITY && currentCounts['C'] < currentCounts['D']) {
        //         gateNo = 'C';
        //     } else if (currentCounts['D'] + membersToAdd <= GENERAL_CAPACITY) {
        //         gateNo = 'D';
        //     } else if (currentCounts['C'] + membersToAdd > GENERAL_CAPACITY && currentCounts['D'] + membersToAdd > GENERAL_CAPACITY) {
        //         return sendGateFullError('Both C and D', { "C": GENERAL_CAPACITY - currentCounts['C'], "D": GENERAL_CAPACITY - currentCounts['D'] });
        //     } else {
        //         gateNo = 'C';
        //     }
        // }

        // if (gateNo) {
        //     // If gateNo is assigned successfully, proceed to insert member data or other actions
        //     console.log(`Assigned to gate: ${gateNo}`);
        //     // Add your logic here to handle inserting member into the database
        // }


        const fieldCheck = checkKeysAndRequireValues(['Person', 'OrganizerUkeyId', 'UserUkeyId', 'EventUkeyId', 'Amount', 'PaymentUkeyId'], req.body);
        if (fieldCheck.length !== 0) {
            if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path); // Only delete if `Img` exists
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        if (!Array.isArray(MembersJson)) {
            if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path); // Only delete if `Img` exists
            return res.status(400).send(errorMessage('Members is required'));
        }
        const oldPaymentImgResult = await pool.request().query(`
            SELECT PaymentImg FROM PaymentMaster WHERE PaymentUkeyId = '${PaymentUkeyId}';
        `)
        const oldPaymentImg = oldPaymentImgResult.recordset?.[0]?.PaymentImg;
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const UserId = req?.user?.UserId;
        const updateQuery = `UPDATE PaymentMaster SET OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}, UserUkeyId = ${setSQLStringValue(UserUkeyId)}, EventUkeyId = ${setSQLStringValue(EventUkeyId)}, Amount = ${setSQLNumberValue(Amount)}, Person = ${setSQLNumberValue(Person)}, UsrID = ${setSQLStringValue(UserId)}, IPAddress = ${setSQLStringValue(IPAddress)}, HostName = ${setSQLStringValue(ServerName)}, EntryDate = '${EntryTime}', flag = 'U', RazorPayId = ${setSQLStringValue(RazorPayId)}, OrderId = ${setSQLStringValue(OrderId)}, Signature = ${setSQLStringValue(Signature)}, TransactionUkeyId = ${setSQLStringValue(TransactionUkeyId)}, Status = ${setSQLBooleanValue(Status)}, PaymentImg = ${setSQLStringValue(PaymentImg)}, PassCategory = ${setSQLStringValue(PassCategory)}, PerTicketPrice = ${toFloat(PerTicketPrice)}, IsPayment = ${setSQLBooleanValue(IsPayment)} WHERE PaymentUkeyId = '${PaymentUkeyId}'`;
        const result = await pool.query(updateQuery);
        MembersJson.forEach(async (member) => {
            const PaymentDetailUkeyId = generateUUID();
            const randomCode = generateSixDigitCode();
            const { Name, Mobile, MemberType, SubCategory, GateNo, PCUkeyId = '', Remark = '' } = member;
            try {
                await pool.query(`DELETE FROM TicketMaster WHERE PaymentUkeyId = '${PaymentUkeyId}'`);
                const insertQuery = `
                INSERT INTO TicketMaster 
                (TicketUkeyId, Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId, UsrID, IpAddress, HostName, EntryDate, flag, UserCode, Verify, GateNo, MemberType, SubCategory, IsPayment, PCUkeyId, Remark) 
                VALUES 
                (${setSQLStringValue(PaymentDetailUkeyId)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(PaymentUkeyId)}, ${setSQLStringValue(UserId)}, '${IPAddress}', '${ServerName}', '${EntryTime}', N'U', ${setSQLStringValue(randomCode)}, 0, ${setSQLStringValue(GateNo)}, ${setSQLStringValue(MemberType)}, ${setSQLStringValue(SubCategory)}, ${setSQLBooleanValue(IsPayment)}, ${setSQLStringValue(PCUkeyId)}, ${setSQLStringValue(Remark)});
            `;
                await pool.query(insertQuery);
            } catch (error) {
                console.log("Error :>> ", error);
            }
        })
        if (result?.rowsAffected[0] === 0) {
            if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path); // Only delete if `Img` exists
            return res.status(400).send(errorMessage('No rows updated of City'));
        }
        if (oldPaymentImg && req.files && req.files.PaymentImg && req.files.PaymentImg.length > 0) deleteImage('./media/Payment/' + oldPaymentImg); // Only delete old image if it exists
        return res.status(200).send(successMessage('Data updated Successfully!'));
    } catch (error) {
        if (PaymentImg) deleteImage(req?.files?.PaymentImg?.[0]?.path); // Only delete if `Img` exists
        console.log('Update payment master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const updatePaymentStatus = async (req, res) =>{
    try{
        const {PaymentUkeyId = '', Status = 'Pending'} = req.body;

        const fieldCheck = checkKeysAndRequireValues(['PaymentUkeyId', 'Status'], req.body);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }

        const result = await pool.request().query(`
            UPDATE PaymentMaster SET  Status = '${Status}' WHERE PaymentUkeyId = '${PaymentUkeyId}'
        `);

        if (result?.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No rows updated of Payment'));
        }

        return res.status(200).send(successMessage('Data updated Successfully!'));
        
    }catch(error){
        console.log('Update payment master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const deletePaymentMaster = async (req, res) => {
    try {
        const { PaymentUkeyId } = req.query;
        const fieldCheck = checkKeysAndRequireValues(['PaymentUkeyId'], req.query);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const oldPaymentImgResult = await pool.request().query(`
            SELECT PaymentImg FROM PaymentMaster WHERE PaymentUkeyId = '${PaymentUkeyId}';
        `)
        const oldPaymentImg = oldPaymentImgResult.recordset?.[0]?.PaymentImg;

        const deletePaymentQuery = `DELETE FROM PaymentMaster WHERE PaymentUkeyId = '${PaymentUkeyId}'`;
        const deleteTicketsQuery = `DELETE FROM TicketMaster WHERE PaymentUkeyId = '${PaymentUkeyId}'`;
        const deletePaymentResult = await pool.query(deletePaymentQuery);
        const deleteTicketsResult = await pool.query(deleteTicketsQuery);
        if (deletePaymentResult?.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No rows deleted of Payment Master'));
        }
        if (oldPaymentImg && oldPaymentImg !== '') deleteImage('./media/Payment/' + oldPaymentImg); // Only delete old image if it exists
        return res.status(200).send(successMessage('Data deleted Successfully!'));
    } catch (error) {
        console.log('Delete payment master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

module.exports = { fetchPaymentMaster, addPaymentMaster, updatePaymentMaster, deletePaymentMaster, fetchPaymentAndTickets, updatePaymentStatus, setPaymentFlag }