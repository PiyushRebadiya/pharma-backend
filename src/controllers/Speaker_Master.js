const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const FetchSpeakerMasterDetails = async (req, res) => {
    try {
        const { SpeakerUkeyId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpeakerUkeyId) {
            whereConditions.push(`SM.SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`SM.flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT SM.*, EM.EventName, 
                SMP.SpeakerStatus AS PermissionStatus,
                    (SELECT JSON_QUERY(
                        (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                        FROM DocumentUpload 
                        WHERE UkeyId = SM.SpeakerUkeyId 
                        FOR JSON PATH)
                    )) AS FileNames
                FROM SpeakerMaster SM
                LEFT JOIN EventMaster EM ON SM.EventUkeyId = EM.EventUkeyId
                LEFT JOIN SpeakerMasterPermission SMP ON SM.SpeakerUkeyId = SMP.SpeakerUkeyId and SMP.flag <> 'D'
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SpeakerMaster SM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        if(result?.data?.length > 0){
            result?.data?.forEach(event => {
                if(event.FileNames){
                    event.FileNames = JSON.parse(event?.FileNames)
                } else {
                    event.FileNames = []
                }
            });
        }
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const FetchSpeakerMasterPermission = async (req, res) => {
    try {
        const { SpeakerUkeyId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpeakerUkeyId) {
            whereConditions.push(`SM.SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`SM.flag <> 'D'`);
        whereConditions.push(`SM.SpeakerStatus = 'INPROGRESS'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT SM.*, EM.EventName, 
                    (SELECT JSON_QUERY(
                        (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                        FROM DocumentUpload 
                        WHERE UkeyId = SM.SpeakerUkeyId 
                        FOR JSON PATH)
                    )) AS FileNames
                FROM SpeakerMasterPermission SM
                LEFT JOIN EventMaster EM ON SM.EventUkeyId = EM.EventUkeyId
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SpeakerMasterPermission SM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        if(result?.data?.length > 0){
            result?.data?.forEach(event => {
                if(event.FileNames){
                    event.FileNames = JSON.parse(event?.FileNames)
                } else {
                    event.FileNames = []
                }
            });
        }
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const PermissionSpeakerById = async (req, res) => {
    try {
        const { SpeakerUkeyId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SpeakerUkeyId) {
            whereConditions.push(`SM.SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`SM.flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            SELECT SM.*, EM.EventName, 
            (SELECT JSON_QUERY(
                (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                FROM DocumentUpload 
                WHERE UkeyId = SM.SpeakerUkeyId 
                FOR JSON PATH)
            )) AS FileNames
            FROM SpeakerMaster SM
            LEFT JOIN EventMaster EM ON SM.EventUkeyId = EM.EventUkeyId
            ${whereString}
            ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SpeakerMaster SM ${whereString}`,
        };

        const PermissionQuery = {
            getQuery: `
            SELECT SM.*, EM.EventName, 
            (SELECT JSON_QUERY(
                (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                FROM DocumentUpload 
                WHERE UkeyId = SM.SpeakerUkeyId 
                FOR JSON PATH)
            )) AS FileNames
            FROM SpeakerMasterPermission SM
            LEFT JOIN EventMaster EM ON SM.EventUkeyId = EM.EventUkeyId
            ${whereString}
            ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SpeakerMasterPermission SM ${whereString}`,
        };
        
        const result = await getCommonAPIResponse(req, res, getUserList);
        const PermissionResult = await getCommonAPIResponse(req, res, PermissionQuery);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });
        PermissionResult.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });

        return res.json({ newData : PermissionResult.data, oldData : result.data});
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const SpeakerMaster = async (req, res) => {
    const {
        SpeakerUkeyId, OrganizerUkeyId, EventUkeyId, Name, Alias, Description, Email, Mobile, FB, Instagram, Youtube, Other,flag, DiscriptionHindi, DiscriptionGujarati, IsActive, Type, SpeakerStatus
    } = req.body;

    let transaction;

    try {
        if (!['A', 'U'].includes(flag)) {
            return res.status(400).json(errorMessage("Invalid flag. Use 'A' for Add or 'U' for Update."));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const missingKeys = checkKeysAndRequireValues(['SpeakerUkeyId', 'OrganizerUkeyId', 'EventUkeyId', 'Name'], req.body);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        transaction = pool.transaction();
        await transaction.begin();

        if (flag === 'U') {
            let query = `
                UPDATE SpeakerMasterPermission SET flag = 'D' WHERE SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)};
            `;

            // If status is PUBLISHED or not active and still pending, delete old master entries
            if ((SpeakerStatus === 'PUBLISHED') || (!IsActive && SpeakerStatus === 'PENDING')) {
                query += `
                    DELETE FROM SpeakerMaster WHERE SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)};
                `;
            }

            await transaction.request().query(query);
        }

        if (
            flag === 'A' ||
            ((flag === 'U' && SpeakerStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && SpeakerStatus === 'PENDING'))
        ) {
            // Insert into SpeakerMaster
            await transaction.request().query(`
                INSERT INTO SpeakerMaster (
                    SpeakerUkeyId, OrganizerUkeyId, EventUkeyId, Name, Alias, Description, Email, Mobile,
                    FB, Instagram, Youtube, Other, DiscriptionHindi, DiscriptionGujarati,
                    IsActive, Type, flag, IpAddress, HostName, EntryDate, SpeakerStatus, UserName, UserID
                ) VALUES (
                    ${setSQLStringValue(SpeakerUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                    ${setSQLStringValue(Name)}, ${setSQLStringValue(Alias)}, ${setSQLStringValue(Description)},
                    ${setSQLStringValue(Email)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(FB)},
                    ${setSQLStringValue(Instagram)}, ${setSQLStringValue(Youtube)}, ${setSQLStringValue(Other)},
                    ${setSQLStringValue(DiscriptionHindi)}, ${setSQLStringValue(DiscriptionGujarati)},
                    ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(Type)}, ${setSQLStringValue(flag)},
                    ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)},
                    ${setSQLStringValue(SpeakerStatus)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}
                );
            `);
        }

        // Always insert into Permission table
        await transaction.request().query(`
            INSERT INTO SpeakerMasterPermission (
                SpeakerUkeyId, OrganizerUkeyId, EventUkeyId, Name, Alias, Description, Email, Mobile,
                FB, Instagram, Youtube, Other, DiscriptionHindi, DiscriptionGujarati,
                IsActive, Type, flag, IpAddress, HostName, EntryDate, SpeakerStatus, UserName, UserID
            ) VALUES (
                ${setSQLStringValue(SpeakerUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                ${setSQLStringValue(Name)}, ${setSQLStringValue(Alias)}, ${setSQLStringValue(Description)},
                ${setSQLStringValue(Email)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(FB)},
                ${setSQLStringValue(Instagram)}, ${setSQLStringValue(Youtube)}, ${setSQLStringValue(Other)},
                ${setSQLStringValue(DiscriptionHindi)}, ${setSQLStringValue(DiscriptionGujarati)},
                ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(Type)}, ${setSQLStringValue(flag)},
                ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)},
                ${setSQLStringValue(SpeakerStatus)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}
            );
        `);

        await transaction.commit();

        return res.status(200).json(successMessage(flag === 'A' ? 'Speaker added successfully.' : 'Speaker updated successfully.'));
    } catch (error) {
        console.error('Speaker Transaction Error:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).send(errorMessage(error?.message || "Internal Server Error"));
    }
};

const RemoveSpeaker = async (req, res) => {
    try {
        const { SpeakerUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['SpeakerUkeyId', 'OrganizerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            update SpeakerMaster set flag = 'D' WHERE SpeakerUkeyId = ${setSQLStringValue(SpeakerUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Speaker Master Deleted.') });
        }

        return res.status(200).json({ ...successMessage('Speaker Master Deleted Successfully.'), ...req.body });
    } catch (error) {
        console.log('Delete Speaker Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    FetchSpeakerMasterDetails,
    SpeakerMaster,
    RemoveSpeaker,
    PermissionSpeakerById,
    FetchSpeakerMasterPermission
}