const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLNumberValue, setSQLStringValue, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchSponsorCategoryMasterDetails = async (req, res)=>{
    try{
        const { SpCatUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, SpCatStatus } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpCatUkeyId) {
            whereConditions.push(`SpCatUkeyId = ${setSQLStringValue(SpCatUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (SpCatStatus) {
            whereConditions.push(`SpCatStatus = ${setSQLStringValue(SpCatStatus)}`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        whereConditions.push(`flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM SponsorCatMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorCatMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const FetchSponsorCategoryMasterPermission = async (req, res)=>{
    try{
        const { SpCatUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, SpCatStatus } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpCatUkeyId) {
            whereConditions.push(`SpCatUkeyId = ${setSQLStringValue(SpCatUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (SpCatStatus) {
            whereConditions.push(`SpCatStatus = ${setSQLStringValue(SpCatStatus)}`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        whereConditions.push(`flag <> 'D'`);
        whereConditions.push(`SpCatStatus = 'INPROGRESS'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM SponsorCatMasterPermission ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorCatMasterPermission ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const SponsorCategoryMasterPermissionById = async (req, res) => {
    try{
        const { SpCatUkeyId, OrganizerUkeyId, EventUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpCatUkeyId) {
            whereConditions.push(`SpCatUkeyId = ${setSQLStringValue(SpCatUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }

        whereConditions.push(`flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM SponsorCatMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorCatMaster ${whereString}`,
        };
        const permsiionList = {
            getQuery: `SELECT * FROM SponsorCatMasterPermission ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorCatMasterPermission ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        const permissionResult = await getCommonAPIResponse(req, res, permsiionList);
        return res.json({ newData : permissionResult.data, oldData : result.data});
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const SponsorCategoryMaster = async (req, res) => {
    const { SpCatUkeyId, OrganizerUkeyId, EventUkeyId, Name, IsActive = false, flag, SpCatStatus = '' } = req.body;

    let transaction;
    try {
        if (!['A', 'U'].includes(flag)) {
            return res.status(400).json(errorMessage("Invalid flag. Use 'A' for Add or 'U' for Update."));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        transaction = pool.transaction();
        await transaction.begin();

        if (flag === 'U') {
            let deleteQuery = `UPDATE SponsorCatMasterPermission SET flag = 'D' WHERE SpCatUkeyId = '${SpCatUkeyId}';`;

            if ((SpCatStatus === 'PUBLISHED') || (!IsActive && SpCatStatus === 'PENDING')) {
                deleteQuery += `
                    DELETE FROM SponsorCatMaster WHERE SpCatUkeyId = '${SpCatUkeyId}';
                `;
            }

            await transaction.request().query(deleteQuery);
        }

        if (
            flag === 'A' || ((flag === 'U' && SpCatStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && SpCatStatus === 'PENDING'))
        ) {
            const insertQuery = `
                INSERT INTO SponsorCatMaster (
                    SpCatUkeyId, OrganizerUkeyId, EventUkeyId, Name, IsActive, flag, 
                    IpAddress, HostName, EntryDate, SpCatStatus
                ) VALUES (
                    ${setSQLStringValue(SpCatUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(Name)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, '${EntryTime}', ${setSQLStringValue(SpCatStatus)}
                );
            `;
            await transaction.request().query(insertQuery);
        }

        const permissionQuery = `
            INSERT INTO SponsorCatMasterPermission (
                SpCatUkeyId, OrganizerUkeyId, EventUkeyId, Name, IsActive, flag, 
                IpAddress, HostName, EntryDate, SpCatStatus
            ) VALUES (
                ${setSQLStringValue(SpCatUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, 
                ${setSQLStringValue(Name)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(flag)}, 
                ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, '${EntryTime}', ${setSQLStringValue(SpCatStatus)}
            );
        `;
        await transaction.request().query(permissionQuery);

        await transaction.commit();
        return res.status(200).json(successMessage(flag === 'A' ? "Sponsor Category Created." : "Sponsor Category Updated."));

    } catch (error) {
        console.error("SpeakerCategory Error:", error);
        if (transaction) await transaction.rollback();
        return res.status(500).json(errorMessage(error.message || "Internal server error"));
    }
};

const RemoveSponsorCategory = async (req, res) => {
    try{
        const {SpCatUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['SpCatUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            update SponsorCatMaster set flag = 'D' WHERE SpCatUkeyId = ${setSQLStringValue(SpCatUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Sponsor Category Deleted.')})
        }

        return res.status(200).json({...successMessage('Sponsor Category Deleted Successfully.')});
    }catch(error){
        console.log('Delete Sponsor Category Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
};

module.exports = {
    FetchSponsorCategoryMasterDetails,
    SponsorCategoryMaster,
    RemoveSponsorCategory,
    FetchSponsorCategoryMasterPermission,
    SponsorCategoryMasterPermissionById
}