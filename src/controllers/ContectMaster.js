const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue, deleteImage } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchContects = async (req, res) => {
    try {
        const { ContactUkeyId, OrganizerUkeyId, EventUkeyId, FormType, QueryType, UserUkeyId, ReferenceUkeyId, Status, TicketNo, LastUpdatedby } = req.query;
        let whereConditions = [];

        if (ContactUkeyId) {
            whereConditions.push(`CM.ContactUkeyId = ${setSQLStringValue(ContactUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`CM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`CM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (FormType) {
            whereConditions.push(`CM.FormType = ${setSQLStringValue(FormType)}`);
        }
        if (QueryType) {
            whereConditions.push(`CM.QueryType = ${setSQLStringValue(QueryType)}`);
        }
        if (UserUkeyId) {
            whereConditions.push(`CM.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if (ReferenceUkeyId) {
            whereConditions.push(`CM.ReferenceUkeyId = ${setSQLStringValue(ReferenceUkeyId)}`);
        }
        if (Status) {
            whereConditions.push(`CM.Status = ${setSQLStringValue(Status)}`);
        }
        if (TicketNo) {
            whereConditions.push(`CM.TicketNo = ${setSQLStringValue(TicketNo)}`);
        }
        if (LastUpdatedby) {
            whereConditions.push(`CM.LastUpdatedby = ${setSQLStringValue(LastUpdatedby)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            SELECT CM.*, UM.ProfiilePic, 
            (SELECT JSON_QUERY(
            (SELECT FileName, Label, docukeyid, EventUkeyId, OrganizerUkeyId, Category
            FROM DocumentUpload 
            WHERE UkeyId = CM.ContactUkeyId 
            FOR JSON PATH)
            )) AS FileNames,
            UM.FullName,
            (select 
                JSON_QUERY(
                    (select * from ContactMaster where ReferenceUkeyId =  cm.ContactUkeyId for json path)
                )
            ) AS Reference
            FROM ContactMaster CM
            left join UserMaster UM on UM.UserUkeyId = CM.UserUkeyId
            ${whereString}
            ORDER BY CM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM ContactMaster CM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        result?.data?.forEach(contact => {
            contact.FileNames = contact.FileNames ? JSON.parse(contact.FileNames) : [];
            contact.Reference =  contact.Reference ? JSON.parse(contact.Reference) : [];
        });

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const AdminHelpCenter = async (req, res) => {
    try {
        const { ContactUkeyId, OrganizerUkeyId, EventUkeyId, FormType, QueryType, UserUkeyId, ReferenceUkeyId, Status, TicketNo } = req.query;
        let whereConditions = [];

        if (ContactUkeyId) whereConditions.push(`ContactUkeyId = ${setSQLStringValue(ContactUkeyId)}`);
        if (EventUkeyId) whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        if (OrganizerUkeyId) whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        if (FormType) whereConditions.push(`FormType = ${setSQLStringValue(FormType)}`);
        if (QueryType) whereConditions.push(`QueryType = ${setSQLStringValue(QueryType)}`);
        if (UserUkeyId) whereConditions.push(`UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        if (ReferenceUkeyId) whereConditions.push(`ReferenceUkeyId = ${setSQLStringValue(ReferenceUkeyId)}`);
        if (Status) whereConditions.push(`Status = ${setSQLStringValue(Status)}`);
        if (TicketNo) whereConditions.push(`TicketNo = ${setSQLStringValue(TicketNo)}`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                WITH LatestTickets AS (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY UserUkeyId ORDER BY EntryDate DESC) AS rn
                    FROM ContactMaster
                    ${whereString}
                )
                SELECT 
                    LT.*, 
                    UM.ProfiilePic,
                    UM.FullName,
                    (
                        SELECT JSON_QUERY(
                            (SELECT FileName, Label, docukeyid, EventUkeyId, OrganizerUkeyId, Category
                             FROM DocumentUpload
                             WHERE UkeyId = LT.ContactUkeyId
                             FOR JSON PATH)
                        )
                    ) AS FileNames,
                    (
                        SELECT JSON_QUERY(
                            (SELECT * 
                             FROM ContactMaster 
                             WHERE ReferenceUkeyId = LT.ContactUkeyId 
                             FOR JSON PATH)
                        )
                    ) AS Reference
                FROM LatestTickets LT
                LEFT JOIN UserMaster UM ON UM.UserUkeyId = LT.UserUkeyId 
                WHERE LT.rn = 1
                ORDER BY LT.EntryDate DESC
            `,
            countQuery: `
            WITH LatestTickets AS (
              SELECT *,
                     ROW_NUMBER() OVER (PARTITION BY UserUkeyId ORDER BY EntryDate DESC) AS rn
              FROM ContactMaster
              ${whereString}
            )
            SELECT COUNT(*) AS totalCount
            FROM LatestTickets
            WHERE rn = 1
          `
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        result?.data?.forEach(contact => {
            contact.FileNames = contact.FileNames ? JSON.parse(contact.FileNames) : [];
            contact.Reference = contact.Reference ? JSON.parse(contact.Reference) : [];
        });

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const fetchContectUserWise = async (req, res) => {
    try{
        const {UserUkeyId} = req.query;
        const missingKeys = checkKeysAndRequireValues(['UserUkeyId'], req.query)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const result = await pool.request().query(`SELECT ContactUkeyId,QueryType,UserUkeyId,TicketNo,Status, Name, Mobile, IsRead, EntryDate, LastUpdatedby
        FROM ContactMaster
        WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)}
          AND (ReferenceUkeyId IS NULL OR ReferenceUkeyId = '')
          ORDER BY CAST(TicketNo AS INT) desc`)

        return res.status(200).json({data : result.recordset});
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const AddOnTicketNNo = async (req, res) => {
    try{
        // const {UserUkeyId} = req.query;
        // const missingKeys = checkKeysAndRequireValues(['UserUkeyId'], req.query)
        // if(missingKeys.length > 0){
        //     return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        // }
        const result = await pool.request().query(`SELECT ISNULL(MAX(CAST(TicketNo AS INT)), 0) + 1 AS TicketNo 
                                                    FROM ContactMaster
                                                    WHERE ISNUMERIC(TicketNo) = 1`)
        // const result = await pool.request().query(`select ISNULL(MAX(TicketNo),0) + 1 TicketNo from ContactMaster where 
        // UserUkeyId = ${setSQLStringValue(UserUkeyId)}`)


        return res.status(200).json({TicketNo : result?.recordset?.[0]?.TicketNo});
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const ContectMaster = async(req, res)=>{
    const { ContactUkeyId, Name, Mobile, Email, Message, flag = 'A', FormType = '', QueryType = '', EventUkeyId = '', OrganizerUkeyId = '', UserUkeyId = '', ReferenceUkeyId, Status, Role, TicketNo, IsRead, LastUpdatedby} = req.body;
    let {Image} = req.body;
    Image = req?.files?.Image?.length ? `${req?.files?.Image[0]?.filename}` : Image;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['ContactUkeyId', 'Name', 'Mobile'], req.body)
        if(missingKeys.length > 0){
            if (Image) deleteImage(req?.files?.Image?.[0]?.path); // Only delete if `Img` exists
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const insertQuery = `
            INSERT INTO ContactMaster (
                ContactUkeyId, Name, Mobile, Email, Message, flag, IpAddress, HostName, EntryDate, FormType, QueryType, Image, EventUkeyId, OrganizerUkeyId, UserUkeyId, ReferenceUkeyId, Status, Role, TicketNo, IsRead, LastUpdatedby
            ) VALUES (
                ${setSQLStringValue(ContactUkeyId)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(Message)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(FormType)}, ${setSQLStringValue(QueryType)}, ${setSQLStringValue(Image)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(ReferenceUkeyId)}, ${setSQLStringValue(Status)}, ${setSQLStringValue(Role)}, ${setSQLStringValue(TicketNo)}, ${setSQLBooleanValue(IsRead)}, ${setSQLStringValue(LastUpdatedby)}
            );
        `
        const deleteQuery = `
            DELETE FROM ContactMaster WHERE ContactUkeyId = ${setSQLStringValue(ContactUkeyId)}
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                if (Image) deleteImage(req?.files?.Image?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).json({...errorMessage('No Contect Created.'),})
            }

            return res.status(200).json({...successMessage('New Contect Created Successfully.'), ...req.bod, Image});

        }else if(flag === 'U'){
            const oldImageResult = await pool.request().query(`SELECT Image FROM ContactMaster WHERE ContactUkeyId = '${ContactUkeyId}'`);
            const oldImage = oldImageResult.recordset?.[0]?.Image; // Safely access the first record

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                if (Image) deleteImage(req?.files?.Image?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).json({...errorMessage('No Contect Updated.')})
            }

            if (oldImage && req?.files?.Image?.length) deleteImage(`./media/Contect/${oldImage}`);

            return res.status(200).json({...successMessage('New Contect Updated Successfully.'), ...req.body, Image});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Contect Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Contect Error :', error);
        }
        if (Image) deleteImage(req?.files?.Image?.[0]?.path); // Only delete if `Img` exists
        return res.status(500).send(errorMessage(error?.message));
    }
}

const inactivatechat = async ( req, res) => {
    try{
        const {ReferenceUkeyId, Status, IsRead, LastUpdatedby} = req.body;

        const missingKeys = checkKeysAndRequireValues(['ReferenceUkeyId', 'Status',], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const result = await pool.request().query(`
            update ContactMaster set Status = ${setSQLStringValue(Status)}, IsRead = ${setSQLStringValue(IsRead)}, LastUpdatedby = ${setSQLStringValue(LastUpdatedby)} where ReferenceUkeyId = ${setSQLStringValue(ReferenceUkeyId)} or ContactUkeyId = ${setSQLStringValue(ReferenceUkeyId)}
        `)

        if(result.rowsAffected[0] === 0 ){
            return res.status(400).json({...errorMessage('no chat updated.')})
        }

        return res.status(200).json({...successMessage('chat status updated successfully.'), ...req.bod});
    }catch(error){
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveContect = async(req, res)=>{
    try{
        const {ContactUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['ContactUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        const oldImageResult = await pool.request().query(`SELECT Image FROM ContactMaster WHERE ContactUkeyId = '${ContactUkeyId}'`);
        const oldImage = oldImageResult.recordset?.[0]?.Image; // Safely access the first record


        const query = `
            DELETE FROM ContactMaster WHERE ContactUkeyId = ${setSQLStringValue(ContactUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Contect Deleted.')})
        }

        if (oldImage) deleteImage(`./media/Contect/${oldImage}`);

        return res.status(200).json({...successMessage('Contect Deleted Successfully.'), ...req.query});
    }catch(error){
        console.log('Delete Contect Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchContects,
    ContectMaster,
    RemoveContect,
    fetchContectUserWise,
    inactivatechat,
    AdminHelpCenter,
    AddOnTicketNNo
}