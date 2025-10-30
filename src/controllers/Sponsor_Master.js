const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchSponsorMasterDetails = async (req, res) => {
    try {
        const { SponsorUkeyId, OrganizerUkeyId, EventUkeyId, SponsorCatUkeyId, SponsoreStatus } = req.query;
        let whereConditions = [];

        if (SponsorUkeyId) {
            whereConditions.push(`SM.SponsorUkeyId = ${setSQLStringValue(SponsorUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (SponsorCatUkeyId) {
            whereConditions.push(`SM.SponsorCatUkeyId = ${setSQLStringValue(SponsorCatUkeyId)}`);
        }
        if (SponsoreStatus) {
            whereConditions.push(`SM.SponsoreStatus = ${setSQLStringValue(SponsoreStatus)}`);
        }
        whereConditions.push(`SM.flag <> 'D' `);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT SM.*, SCM.Name AS SponsorCategoryName,
                smp.SponsoreStatus as PermissionStatus,
                (SELECT JSON_QUERY(
                    (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                    FROM DocumentUpload 
                    WHERE UkeyId = SM.SponsorUkeyId 
                    FOR JSON PATH)
                )) AS FileNames
                FROM SponsorMaster SM
                left join SponsorCatMaster SCM on SM.SponsorCatUkeyId = SCM.SpCatUkeyId
                left join SponsorMasterPermission smp on smp.SponsorUkeyId = SM.SponsorUkeyId and smp.flag <> 'D'
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorMaster SM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const FetchSponsorMasterPermissionDetails = async (req, res) => {
    try {
        const { SponsorUkeyId, OrganizerUkeyId, EventUkeyId, SponsorCatUkeyId, SponsoreStatus } = req.query;
        let whereConditions = [];

        if (SponsorUkeyId) {
            whereConditions.push(`SM.SponsorUkeyId = ${setSQLStringValue(SponsorUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (SponsorCatUkeyId) {
            whereConditions.push(`SM.SponsorCatUkeyId = ${setSQLStringValue(SponsorCatUkeyId)}`);
        }
        if (SponsoreStatus) {
            whereConditions.push(`SM.SponsoreStatus = ${setSQLStringValue(SponsoreStatus)}`);
        }
        whereConditions.push(`SM.flag <> 'D' `);
        whereConditions.push(`SM.SponsoreStatus = 'INPROGRESS'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT SM.*, SCM.Name AS SponsorCategoryName, OM.OrganizerName,
                (SELECT JSON_QUERY(
                    (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                    FROM DocumentUpload 
                    WHERE UkeyId = SM.SponsorUkeyId 
                    FOR JSON PATH)
                )) AS FileNames
                FROM SponsorMasterPermission SM
                left join SponsorCatMaster SCM on SM.SponsorCatUkeyId = SCM.SpCatUkeyId
                left join OrganizerMaster OM on OM.OrganizerUkeyId = SM.OrganizerUkeyId
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorMasterPermission SM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const FetchSponsorMasterPermissionLIstDetails = async (req, res) => {
    try {
        const { SponsorUkeyId, OrganizerUkeyId, EventUkeyId, SponsorCatUkeyId, SponsoreStatus } = req.query;
        let whereConditions = [];

        if (SponsorUkeyId) {
            whereConditions.push(`SM.SponsorUkeyId = ${setSQLStringValue(SponsorUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`SM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`SM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (SponsorCatUkeyId) {
            whereConditions.push(`SM.SponsorCatUkeyId = ${setSQLStringValue(SponsorCatUkeyId)}`);
        }
        if (SponsoreStatus) {
            whereConditions.push(`SM.SponsoreStatus = ${setSQLStringValue(SponsoreStatus)}`);
        }
        whereConditions.push(`SM.flag <> 'D' `);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT SM.*, SCM.Name AS SponsorCategoryName,
                (SELECT JSON_QUERY(
                    (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                    FROM DocumentUpload 
                    WHERE UkeyId = SM.SponsorUkeyId 
                    FOR JSON PATH)
                )) AS FileNames
                FROM SponsorMaster SM
                left join SponsorCatMaster SCM on SM.SponsorCatUkeyId = SCM.SpCatUkeyId
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorMaster SM ${whereString}`,
        };
        const PermissionLIst = {
            getQuery: `
                SELECT SM.*, SCM.Name AS SponsorCategoryName,
                (SELECT JSON_QUERY(
                    (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                    FROM DocumentUpload 
                    WHERE UkeyId = SM.SponsorUkeyId 
                    FOR JSON PATH)
                )) AS FileNames
                FROM SponsorMasterPermission SM
                left join SponsorCatMaster SCM on SM.SponsorCatUkeyId = SCM.SpCatUkeyId
                ${whereString}
                ORDER BY SM.EntryDate DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SponsorMaster SM ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        const permissionResult = await getCommonAPIResponse(req, res, PermissionLIst);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });
        permissionResult.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });

        return res.json({newData :  permissionResult.data, oldData: result.data});

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const SponsorMaster = async (req, res) => {
    const {
        SponsorUkeyId = '', SponsorCatUkeyId = '', Name = '', Mobile = '', CompanyName = '',
        flag = '', OrganizerUkeyId = '', EventUkeyId = '',
        Description1 = '', Description2 = '', Description3 = '', Description4 = '',
        Link = '', LinkType = '', IsActive = false, SponsoreStatus = ''
    } = req.body;

    let transaction;

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const userId = req.user?.UserId;
        const userName = req.user?.FirstName;

        const missingKeys = checkKeysAndRequireValues(
            ['SponsorUkeyId', 'SponsorCatUkeyId', 'Name', 'OrganizerUkeyId', 'EventUkeyId'],
            req.body
        );
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required.`));
        }

        if (!['A', 'U'].includes(flag)) {
            return res.status(400).json(errorMessage("Use 'A' flag to Add and 'U' flag to update. Flag is required."));
        }

        transaction = pool.transaction();
        await transaction.begin();

        if (flag === 'U') {
            // Mark existing permission rows as deleted
            let deletePermissionQuery = `UPDATE SponsorMasterPermission SET flag = 'D' WHERE SponsorUkeyId = '${SponsorUkeyId}';`;

            // Also delete from main table if needed
            if ((SponsoreStatus === 'PUBLISHED') || (!IsActive && SponsoreStatus === 'PENDING')) {
                deletePermissionQuery += `
                    DELETE FROM SponsorMaster WHERE SponsorUkeyId = '${SponsorUkeyId}';
                `;
            }

            await transaction.request().query(deletePermissionQuery);
        }

        if (
            flag === 'A' ||
            ((flag === 'U') && (SponsoreStatus === 'PUBLISHED' || (!IsActive && SponsoreStatus === 'PENDING')))
        ) {
            const insertSponsorQuery = `
                INSERT INTO SponsorMaster (
                    SponsorUkeyId, SponsorCatUkeyId, Name, Mobile, CompanyName,
                    UserName, UserID, IpAddress, HostName, EntryDate, flag,
                    OrganizerUkeyId, EventUkeyId, Description1, Description2,
                    Description3, Description4, Link, LinkType, IsActive, SponsoreStatus
                ) VALUES (
                    ${setSQLStringValue(SponsorUkeyId)}, ${setSQLStringValue(SponsorCatUkeyId)}, ${setSQLStringValue(Name)},
                    ${setSQLStringValue(Mobile)}, ${setSQLStringValue(CompanyName)}, ${setSQLStringValue(userName)},
                    ${setSQLNumberValue(userId)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)},
                    ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(OrganizerUkeyId)},
                    ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(Description1)}, ${setSQLStringValue(Description2)},
                    ${setSQLStringValue(Description3)}, ${setSQLStringValue(Description4)}, ${setSQLStringValue(Link)},
                    ${setSQLStringValue(LinkType)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(SponsoreStatus)}
                );
            `;

            const result = await transaction.request().query(insertSponsorQuery);

            if (result?.rowsAffected?.[0] === 0) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('No Sponsor Created.'));
            }
        }

        // Always insert into permission table
        const insertPermissionQuery = `
            INSERT INTO SponsorMasterPermission (
                SponsorUkeyId, SponsorCatUkeyId, Name, Mobile, CompanyName,
                UserName, UserID, IpAddress, HostName, EntryDate, flag,
                OrganizerUkeyId, EventUkeyId, Description1, Description2,
                Description3, Description4, Link, LinkType, IsActive, SponsoreStatus
            ) VALUES (
                ${setSQLStringValue(SponsorUkeyId)}, ${setSQLStringValue(SponsorCatUkeyId)}, ${setSQLStringValue(Name)},
                ${setSQLStringValue(Mobile)}, ${setSQLStringValue(CompanyName)}, ${setSQLStringValue(userName)},
                ${setSQLNumberValue(userId)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)},
                ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(OrganizerUkeyId)},
                ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(Description1)}, ${setSQLStringValue(Description2)},
                ${setSQLStringValue(Description3)}, ${setSQLStringValue(Description4)}, ${setSQLStringValue(Link)},
                ${setSQLStringValue(LinkType)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(SponsoreStatus)}
            );
        `;

        await transaction.request().query(insertPermissionQuery);

        await transaction.commit();

        // Log the event
        CommonLogFun({
            EventUkeyId: EventUkeyId,
            OrganizerUkeyId: OrganizerUkeyId,
            ReferenceUkeyId: SponsorUkeyId,
            MasterName: Name,
            TableName: "SponsorMaster",
            UserId: userId,
            UserName: userName,
            IsActive: IsActive,
            flag: flag,
            IPAddress: IPAddress,
            ServerName: ServerName,
            EntryTime: EntryTime
        });

        return res.status(200).json({
            ...successMessage(flag === 'A' ? 'New Sponsor Created.' : 'Sponsor Updated.'),
            ...req.body
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.log(`${flag === 'A' ? 'Add' : 'Update'} Sponsor Master Error:`, error);
        return res.status(500).send(errorMessage(error?.message || 'Internal Server Error'));
    }
};

const RemoveSponsor = async (req, res) => {
    try {
        const { SponsorUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['SponsorUkeyId', 'OrganizerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            update SponsorMaster set flag = 'D' WHERE SponsorUkeyId = ${setSQLStringValue(SponsorUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Sponsor Master Deleted.') });
        }

        return res.status(200).json({ ...successMessage('Sponsor Master Deleted Successfully.'), SponsorUkeyId });
    } catch (error) {
        console.log('Delete Sponsor Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    FetchSponsorMasterDetails,
    SponsorMaster,
    RemoveSponsor,
    FetchSponsorMasterPermissionLIstDetails,
    FetchSponsorMasterPermissionDetails
}