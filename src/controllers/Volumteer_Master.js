const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

// const FetchVolunteerMasterDetails = async (req, res)=>{
//     try{
//         const { VolunteerUkeyId, OrganizerUkeyId, IsActive, ParentVolunteerUkeyId } = req.query;
//         let whereConditions = [];

//         // Build the WHERE clause based on the Status
//         if (VolunteerUkeyId) {
//             whereConditions.push(`v.VolunteerUkeyId = '${VolunteerUkeyId}'`);
//         }
//         if (OrganizerUkeyId) {
//             whereConditions.push(`v.OrganizerUkeyId = '${OrganizerUkeyId}'`);
//         }
//         if (ParentVolunteerUkeyId) {
//             whereConditions.push(`v.ParentVolunteerUkeyId = '${ParentVolunteerUkeyId}'`);
//         }
//         if(IsActive){
//             whereConditions.push(`v.IsActive = ${setSQLBooleanValue(IsActive)}`);
//         }
//         // Combine the WHERE conditions into a single string
//         const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
//         const getUserList = {
//             getQuery: `
//             select v.*, o.OrganizerName from VolunteerMaster as v 
//             left join OrganizerMaster as o on o.OrganizerUkeyId = v.OrganizerUkeyId ${whereString} ORDER BY VolunteerId DESC`,
//             countQuery: `SELECT COUNT(*) AS totalCount FROM VolunteerMaster as v 
//             left join OrganizerMaster as o on o.OrganizerUkeyId = v.OrganizerUkeyId ${whereString}`,
//         };
//         const result = await getCommonAPIResponse(req, res, getUserList);
//         return res.json(result);

//     }catch(error){
//         return res.status(400).send(errorMessage(error?.message));
//     }
// }

const FetchVolunteerMasterDetails = async (req, res) => {
    try {
        const { VolunteerUkeyId, OrganizerUkeyId, IsActive, ParentVolunteerUkeyId, GateNo } = req.query;
        let whereConditions = [];

        // Build the WHERE clause dynamically
        if (VolunteerUkeyId) {
            whereConditions.push(`VM.VolunteerUkeyId = '${VolunteerUkeyId}'`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`VM.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (ParentVolunteerUkeyId) {
            whereConditions.push(`VM.ParentVolunteerUkeyId = '${ParentVolunteerUkeyId}'`);
        }
        if (IsActive) {
            whereConditions.push(`VM.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if (GateNo) {
            whereConditions.push(`VM.GateNo = '${GateNo}'`);
        }

        // Combine WHERE conditions
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT 
                    VM.[VolunteerId],
                    VM.[VolunteerUkeyId],
                    VM.[ParentVolunteerUkeyId],
                    VM.[OrganizerUkeyId],
                    VM.[Img],
                    VM.[Code],
                    VM.[Name],
                    VM.[Add1],
                    VM.[Add2],
                    VM.[City],
                    VM.[StateCode],
                    VM.[State],
                    VM.[Pincode],
                    VM.[Mobile1],
                    VM.[Mobile2],
                    VM.[Password],
                    VM.[Role],
                    VM.[GateNo],
                    VM.[Email],
                    VM.[Remarks],
                    VM.[IsActive],
                    VM.[IpAddress],
                    VM.[HostName],
                    VM.[EntryDate],
                    VM.[flag],
                    COUNT(LT.[LogId]) AS LogCount
                FROM [VolunteerMaster] VM
                LEFT JOIN (
                    SELECT 
                        [LogId],
                        [VolunteerUkeyId]
                    FROM [LogTable]
                ) LT ON VM.[VolunteerUkeyId] = LT.[VolunteerUkeyId]
                ${whereString}
                GROUP BY 
                    VM.[VolunteerId],
                    VM.[VolunteerUkeyId],
                    VM.[ParentVolunteerUkeyId],
                    VM.[OrganizerUkeyId],
                    VM.[Img],
                    VM.[Code],
                    VM.[Name],
                    VM.[Add1],
                    VM.[Add2],
                    VM.[City],
                    VM.[StateCode],
                    VM.[State],
                    VM.[Pincode],
                    VM.[Mobile1],
                    VM.[Mobile2],
                    VM.[Password],
                    VM.[Role],
                    VM.[GateNo],
                    VM.[Email],
                    VM.[Remarks],
                    VM.[IsActive],
                    VM.[IpAddress],
                    VM.[HostName],
                    VM.[EntryDate],
                    VM.[flag]
                ORDER BY VM.[VolunteerId] DESC`,
            countQuery: `
                SELECT COUNT(*) AS totalCount
                FROM (
                    SELECT 
                        VM.[VolunteerId]
                    FROM [VolunteerMaster] VM
                    LEFT JOIN (
                        SELECT 
                            [LogId],
                            [VolunteerUkeyId]
                        FROM [LogTable]
                    ) LT ON VM.[VolunteerUkeyId] = LT.[VolunteerUkeyId]
                    ${whereString}
                    GROUP BY 
                        VM.[VolunteerId],
                        VM.[VolunteerUkeyId],
                        VM.[ParentVolunteerUkeyId],
                        VM.[OrganizerUkeyId],
                        VM.[Img],
                        VM.[Code],
                        VM.[Name],
                        VM.[Add1],
                        VM.[Add2],
                        VM.[City],
                        VM.[StateCode],
                        VM.[State],
                        VM.[Pincode],
                        VM.[Mobile1],
                        VM.[Mobile2],
                        VM.[Password],
                        VM.[Role],
                        VM.[GateNo],
                        VM.[Email],
                        VM.[Remarks],
                        VM.[IsActive],
                        VM.[IpAddress],
                        VM.[HostName],
                        VM.[EntryDate],
                        VM.[flag]
                ) AS SubQuery`
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};


const VolunteerDashboardView = async (req, res)=>{
    try{
        const {EventUkeyId, OrganizerUkeyId, VolunteerUkeyId, MemberType, GateNo, ParentVolunteerUkeyId, Verify = true, IsAdmin} = req.query
        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'OrganizerUkeyId', 'GateNo'], req.query);
        const whereConditions = [];
        if(missingKeys.length > 0){
            return res.status(400).send(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        if (VolunteerUkeyId) {
            whereConditions.push(`VM.VolunteerUkeyId = '${VolunteerUkeyId}'`);
        }
        if (MemberType) {
            whereConditions.push(`TM.MemberType = '${MemberType}'`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = '${EventUkeyId}'`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`TM.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (IsAdmin) {
            whereConditions.push(`TM.IsAdmin = ${setSQLBooleanValue(IsAdmin)}`);
        }
        if (ParentVolunteerUkeyId) {
            whereConditions.push(`VM.ParentVolunteerUkeyId = '${ParentVolunteerUkeyId}'`);
        }
        if (GateNo) {
            whereConditions.push(`VM.GateNo LIKE '%${GateNo}%'`);
        }
        whereConditions.push(`Verify= ${setSQLNumberValue(Verify)}`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery:`select VM.Name as VolunteerName, OM.OrganizerName,VM.GateNo,TM.MemberType,tm.name as Username, TM.IsScan, TM.EntryDate, TM.Verify from VolunteerMaster VM LEFT JOIN TicketMaster TM ON TM.VolunteerUkeyId = VM.VolunteerUkeyId left join OrganizerMaster OM on OM.OrganizerUkeyId = TM.VolunteerUkeyId ${whereString} ORDER BY VolunteerId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount from VolunteerMaster VM LEFT JOIN TicketMaster TM ON TM.VolunteerUkeyId = VM.VolunteerUkeyId left join OrganizerMaster OM on OM.OrganizerUkeyId = TM.VolunteerUkeyId ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        const ticketBookedOnGateNoCountResult = await pool.request().query(`
            SELECT  GateNo, COUNT(*) AS DataCount
            FROM TicketMaster where  EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}' and GateNo = '${GateNo}'
            GROUP BY GateNo
        `)
        // const ticketBookedLimitResult = await pool.request().query(`select * from TicketLimitMaster where  EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'`)
        return res.json({...result, ticketBookedOnGateNoCount : ticketBookedOnGateNoCountResult.recordset});
    }catch(error){
        console.log('fetch volunteer dashboad view error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const LoginVolunteer = async (req, res) => {
    try{
        const {MobileNumber, Password} = req.query;

        const missingKeys = checkKeysAndRequireValues(['MobileNumber', 'Password'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`))
        }

        const result = await pool.request().query(`
            SELECT * FROM VolunteerMaster 
            WHERE Mobile1 = '${MobileNumber}' AND Password = '${Password}' AND IsActive = 1
        `);

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Invelit Mobile Number Or Password'), IsVerified : false});
        }
        return res.status(200).json({...successMessage('User Verified Successfully.')
        , ...result?.recordset?.[0]
        , IsVerified : true
        , token : generateJWTT({
            VolunteerUkeyId : result.recordset[0].VolunteerUkeyId,
            Name : result.recordset[0].Name,
            Email : result.recordset[0].Email
        })
    });
    }catch(error){
        console.log('Login User Error :', error);
        return res.status(500).json({...successMessage()})
    }
}

const VolunteerMaster = async (req, res) => {
    const { 
        VolunteerUkeyId = generateUUID(), Name = null, Email = null, flag = null , OrganizerUkeyId = null, Code = null, Add1 = null, Add2 = null, City = null, StateCode = null, State = null, Pincode = null, Mobile1 = null, Mobile2 = null, Remarks = null, IsActive = true, Password = null, Role = null, GateNo = null, ParentVolunteerUkeyId = ''} = req.body;
    let {Img = null} = req.body;

    Img = req?.files?.Img?.length ? `${req?.files?.Img[0]?.filename}` : Img;

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();

        const insertQuery = `
            INSERT INTO VolunteerMaster (
                VolunteerUkeyId, OrganizerUkeyId, Img, Code, Name, Add1, Add2, City, StateCode, State, Pincode, Mobile1, Mobile2, Email, Remarks, IsActive, IpAddress, HostName, EntryDate, flag, Password, Role, GateNo, ParentVolunteerUkeyId
            ) VALUES (
                ${setSQLStringValue(VolunteerUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Img)}, ${setSQLStringValue(Code)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Add1)}, ${setSQLStringValue(Add2)}, ${setSQLStringValue(City)}, ${setSQLNumberValue(StateCode)}, ${setSQLStringValue(State)}, ${setSQLNumberValue(Pincode)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Mobile2)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(Remarks)}, ${setSQLBooleanValue(IsActive)}, '${IPAddress}', '${ServerName}', '${EntryTime}', '${flag}', ${setSQLStringValue(Password)}, ${setSQLStringValue(Role)}, ${setSQLStringValue(GateNo)}, ${setSQLStringValue(ParentVolunteerUkeyId)}
            );
        `;

        const deleteQuery = `
            DELETE FROM VolunteerMaster WHERE VolunteerUkeyId = '${VolunteerUkeyId}';
        `;

        if (flag === 'A') {
            // const missingKeys = checkKeysAndRequireValues(['Img'], { ...req.body, ...req?.files });

            // if (missingKeys.length > 0) {
            //     if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
            //     return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
            // }

            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).json({ ...errorMessage('No Volunteer Created.') });
            }

            return res.status(200).json({ 
                ...successMessage('New Volunteer Created Successfully.'), 
                ...req.body, VolunteerUkeyId, Img 
            });

        } else if (flag === 'U') {
            // const missingKeys = checkKeysAndRequireValues(['Img'], { ...req.body, ...req?.files });

            // if (missingKeys.length > 0) {
            //     if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
            //     return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
            // }

            const oldImgResult = await pool.request().query(`
                SELECT Img FROM VolunteerMaster WHERE VolunteerUkeyId = '${VolunteerUkeyId}';
            `);
            const oldImg = oldImgResult.recordset?.[0]?.Img;

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).json({ ...errorMessage('No Speaker Master Updated.') });
            }

            if (oldImg && req.files && req.files.Img && req.files.Img.length > 0) deleteImage('./media/Volunteer/' + oldImg); // Only delete old image if it exists
            return res.status(200).json({ 
                ...successMessage('Volunteer Master Updated Successfully.'), 
                ...req.body, VolunteerUkeyId, Img 
            });

        } else {
            if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsory to send flag.")
            });
        }
    } catch (error) {
        if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
        if (flag === 'A') {
            console.log('Add Volunteer Master Error :', error);
        }
        if (flag === 'U') {
            console.log('Update Volunteer Master Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveVolunteer = async (req, res) => {
    try {
        const { VolunteerUkeyId } = req.query;

        // Check if required keys are missing
        const missingKeys = checkKeysAndRequireValues(['VolunteerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const resultOfParentVolunteer = await pool.request().query(`
            SELECT * FROM VolunteerMaster WHERE ParentVolunteerUkeyId = '${VolunteerUkeyId}';
        `);

        if (resultOfParentVolunteer.recordset?.length > 0) {
            return res.status(400).json({ ...errorMessage('Volunteer Admin cannot be deleted. First delete its child volunteers.') });
        }

        // Fetch the old image path before deleting the record
        const oldImgResult = await pool.request().query(`
            SELECT Img FROM VolunteerMaster WHERE VolunteerUkeyId = '${VolunteerUkeyId}';
        `);

        const oldImg = oldImgResult.recordset?.[0]?.Img; // Safely access the first record

        // Execute the DELETE query
        const deleteQuery = `
            DELETE FROM VolunteerMaster WHERE VolunteerUkeyId = '${VolunteerUkeyId}';
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Volunteer Master Deleted.') });
        }

        // Delete the old image if it exists
        if (oldImg) {
            deleteImage('./media/Volunteer/' + oldImg);
        }

        // Delete parent volunteers
        // const deleteParentVolunteerQuery = `
        // DELETE FROM VolunteerMaster WHERE ParentVolunteerUkeyId = '${VolunteerUkeyId}';
        // `;
        // await pool.request().query(deleteParentVolunteerQuery);

        // Return success response
        return res.status(200).json({ ...successMessage('Volunteer Master Deleted Successfully.'), VolunteerUkeyId });
    } catch (error) {
        console.log('Delete Volunteer Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    FetchVolunteerMasterDetails,
    VolunteerDashboardView,
    VolunteerMaster,
    RemoveVolunteer,
    LoginVolunteer,
}