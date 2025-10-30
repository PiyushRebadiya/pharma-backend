const { errorMessage, getCommonAPIResponse, setSQLBooleanValue, checkKeysAndRequireValues, successMessage, getCommonKeys, generateUUID, getServerIpAddress, setSQLNumberValue, generateSixDigitCode, setSQLStringValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const fetchTicketMaster = async (req, res) => {
    try {
        const { TicketId, TicketUkeyId, Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId, UsrID, Verify, IsScan, MemberType, VolunteerUkeyId, IsAdmin, GateNo } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TicketId) {
            whereConditions.push(`tm.TicketId = '${TicketId}'`);
        }
        if (PaymentUkeyId) {
            whereConditions.push(`tm.PaymentUkeyId = '${PaymentUkeyId}'`);
        }
        if (MemberType) {
            whereConditions.push(`tm.MemberType = '${MemberType}'`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`tm.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (UserUkeyId) {
            whereConditions.push(`tm.UserUkeyId = '${UserUkeyId}'`);
        }
        if (EventUkeyId) {
            whereConditions.push(`tm.EventUkeyId = '${EventUkeyId}'`);
        }
        if (TicketUkeyId) {
            whereConditions.push(`tm.TicketUkeyId = '${TicketUkeyId}'`);
        }
        if (Name) {
            whereConditions.push(`tm.Name = '${Name}'`);
        }
        if (Mobile) {
            whereConditions.push(`Mobile = '${Mobile}'`);
        }
        if (UsrID) {
            whereConditions.push(`UsrID = '${UsrID}'`);
        }
        if (GateNo) {
            whereConditions.push(`GateNo = '${GateNo}'`);
        }
        if (VolunteerUkeyId) {
            whereConditions.push(`VolunteerUkeyId = '${VolunteerUkeyId}'`);
        }
        if (Verify) {
            whereConditions.push(`Verify = ${setSQLBooleanValue(Verify)}`);
        }
        if (IsScan) {
            whereConditions.push(`IsScan = ${setSQLBooleanValue(IsScan)}`);
        }
        if (IsAdmin) {
            whereConditions.push(`IsAdmin = ${setSQLBooleanValue(IsAdmin)}`);
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `select tm.*,om.OrganizerName,FirstName AS FullName,EventName, lt.EntryDate AS TicketVerifyTime from ticketmaster tm left join OrganizerMaster om on om.OrganizerUkeyId=tm.VolunteerUkeyId left join UserMaster um on um.UserUkeyId=tm.UserUkeyId left join EventMaster em on em.EventUkeyId=tm.EventUkeyId left join LogTable lt on lt.UserCode = tm.UserCode ${whereString} ORDER BY tm.TicketId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount from ticketmaster tm left join
            OrganizerMaster om on om.OrganizerUkeyId=tm.VolunteerUkeyId left join UserMaster um on um.UserUkeyId=tm.UserUkeyId left join EventMaster em on em.EventUkeyId=tm.EventUkeyId ${whereString}`,
        };
        // const getUserList = {
        //     getQuery: `SELECT * FROM TicketMaster ${whereString} ORDER BY TicketId DESC`,
        //     countQuery: `SELECT COUNT(*) AS totalCount FROM TicketMaster ${whereString}`,
        // };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const fetchTicketListOnUserCode = async (req, res) => {
    try {
        const { UserCode, OrganizerUkeyId, EventUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['UserCode'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).send(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = '${EventUkeyId}'`);
        }
        if (UserCode) {
            whereConditions.push(`UserCode = '${UserCode}'`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Fetch UserUkeyId based on UserCode
        const SigleUserInfoResult = await pool.request().query(`
            select UserUkeyId from TicketMaster ${whereString}
        `);

        if (SigleUserInfoResult?.recordset?.[0]?.UserUkeyId) {
            // Add UserUkeyId condition to the WHERE clause
            whereConditions = whereConditions.filter((condition) => !condition.includes('UserCode')); // Remove UserCode condition
            whereConditions.push(`UserUkeyId = ${setSQLStringValue(SigleUserInfoResult?.recordset?.[0]?.UserUkeyId)}`);
        }

        const whereString2 = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `select * from TicketMaster ${whereString2} ORDER BY TicketId DESC`,
            countQuery: `select COUNT(*) AS totalCount from TicketMaster ${whereString2}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    } catch (error) {
        console.log('fetch ticket list on user code error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
};

const fetchTicketGateNo = async (req, res) => {
    try {
        const response = await pool.query(` SELECT GateNo, COUNT(*) AS count
            FROM TicketMaster
            GROUP BY GateNo
            ORDER BY count DESC`);

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Gate No List",
            data: response.recordset
        });
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const addTicketMaster = async (req, res) => {
    try {
        const { Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId, GateNo, MemberType = '', SubCategory = '', IsPayment = false, PCUkeyId = '', Remark = '' } = req.body;
        const fieldCheck = checkKeysAndRequireValues(['Name', 'Mobile', 'OrganizerUkeyId', 'UserUkeyId', 'EventUkeyId', 'PaymentUkeyId'], req.body);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const TicketUkeyId = generateUUID();
        const UserId = req?.user?.UserId;
        const randomCode = generateSixDigitCode();
        const insertQuery = `INSERT INTO TicketMaster (TicketUkeyId, Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId,UsrID, IpAddress, HostName, EntryDate, flag, UserCode, Verify,GateNo, MemberType, SubCategory, IsScan, IsPayment, PCUkeyId, Remark) VALUES (${setSQLStringValue(TicketUkeyId)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(PaymentUkeyId)}, ${setSQLStringValue(UserId)}, '${IPAddress}', '${ServerName}', '${EntryTime}', N'A', ${setSQLStringValue(randomCode)}, 0,${setSQLStringValue(GateNo)}, ${setSQLStringValue(MemberType)}, ${setSQLStringValue(SubCategory)}, 0, ${setSQLBooleanValue(IsPayment)}, ${setSQLStringValue(PCUkeyId)}, ${setSQLStringValue(Remark)}})`;
        const result = await pool.query(insertQuery);
        if (result?.rowsAffected[0] === 0) {
            return res.status(400).send({ ...errorMessage('No rows inserted of Ticket Master') });
        }
        return res.status(200).send({ ...successMessage('Data inserted Successfully!') });
    } catch (error) {
        console.log('Add ticket master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const updateTicketMaster = async (req, res) => {
    try {
        const { Name, Mobile, OrganizerUkeyId, UserUkeyId, EventUkeyId, PaymentUkeyId, TicketUkeyId, Verify,GateNo, MemberType = '', SubCategory = '', IsScan = false, IsPayment = false, PCUkeyId, Remark = '' } = req.body;
        const fieldCheck = checkKeysAndRequireValues(['Name', 'Mobile', 'OrganizerUkeyId', 'UserUkeyId', 'EventUkeyId', 'PaymentUkeyId', 'TicketUkeyId'], req.body);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        // const TicketUkeyId = generateUUID();
        const UserId = req?.user?.UserId;
        const updateQuery = `UPDATE TicketMaster SET Name = ${setSQLStringValue(Name)}, Mobile = ${setSQLStringValue(Mobile)}, OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}, UserUkeyId = ${setSQLStringValue(UserUkeyId)}, EventUkeyId = ${setSQLStringValue(EventUkeyId)}, PaymentUkeyId = ${setSQLStringValue(PaymentUkeyId)}, UsrID = ${setSQLStringValue(UserId)}, IPAddress = '${IPAddress}', HostName = '${ServerName}', EntryDate = '${EntryTime}', flag = 'U', Verify = ${setSQLBooleanValue(Verify)} ,GateNo = ${setSQLStringValue(GateNo)}, MemberType = '${MemberType}', SubCategory = ${setSQLStringValue(SubCategory)}, IsScan = ${setSQLBooleanValue(IsScan)}, IsPayment = ${setSQLBooleanValue(IsPayment)}, PCUkeyId = ${setSQLStringValue(PCUkeyId)}, Remark = ${setSQLStringValue(Remark)} WHERE TicketUkeyId = '${TicketUkeyId}'`;
        const result = await pool.query(updateQuery);
        if (result?.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No rows updated of Ticket Master'));
        }
        return res.status(200).send(successMessage('Data updated Successfully!'));
    } catch (error) {
        console.log('Update ticket master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const deleteTicketMaster = async (req, res) => {
    try {
        const { TicketUkeyId } = req.query;
        const fieldCheck = checkKeysAndRequireValues(['TicketUkeyId'], req.query);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const deleteQuery = `DELETE FROM TicketMaster WHERE TicketUkeyId = '${TicketUkeyId}'`;
        const result = await pool.query(deleteQuery);
        if (result?.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No rows deleted of Ticket Master'));
        }
        return res.status(200).send(successMessage('Data deleted Successfully!'));
    } catch (error) {
        console.log('Delete ticket master Error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

module.exports = { fetchTicketMaster, fetchTicketListOnUserCode, addTicketMaster, updateTicketMaster, deleteTicketMaster, fetchTicketGateNo }