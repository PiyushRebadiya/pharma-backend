const { errorMessage, successMessage, checkKeysAndRequireValues, generateUUID, setSQLBooleanValue, getCommonKeys, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const FetchMobSMSMastDetails = async (req, res) => {
    try {
        const { MsgUkeyId, IsActive } = req.query;
        let whereConditions = [];

        if (MsgUkeyId) {
            whereConditions.push(`MSM.MsgUkeyId = '${MsgUkeyId}'`);
        }
        if (IsActive) {
            whereConditions.push(`MSM.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
        const getQuery = `select MSM.*, OM.OrganizerName, EM.EventName from MobSMSMast MSM
                            LEFT JOIN OrganizerMaster OM ON OM.OrganizerUkeyId = MSM.OrganizerUkeyId 
                            LEFT JOIN EventMaster EM ON EM.EventUkeyId = MSM.EventUkeyId
                            ${whereString} ORDER BY MSM.MsgId DESC`;
        const countQuery = `SELECT COUNT(*) AS totalCount FROM MobSMSMast MSM ${whereString}`;

        const result = await getCommonAPIResponse(req, res, { getQuery, countQuery });
        return res.json(result);
    } catch (error) {
        return res.status(500).send(errorMessage(error?.message));
    }
};

const ManageMobSMSMast = async (req, res) => {
    const { MsgUkeyId = generateUUID(), OrganizerUkeyId = null, EventUkeyId = null, BaseUrl = null, IsActive = false, flag = "" } = req.body;
    const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

    const missingKeys = checkKeysAndRequireValues(["OrganizerUkeyId", "EventUkeyId", "BaseUrl"], req.body);
    if (missingKeys.length > 0) {
        return res.status(200).json(errorMessage(`${missingKeys.join(", ")} is required`));
    }

    const transaction = pool.transaction();
    try {
        await transaction.begin(); // Begin Transaction

        if (flag === 'A') {
            const insertQuery = `
                INSERT INTO MobSMSMast (
                    MsgUkeyId, OrganizerUkeyId, EventUkeyId, BaseUrl, IsActive, IpAddress, HostName, EntryDate, flag
                ) VALUES (
                    '${MsgUkeyId}', ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, 
                    ${setSQLStringValue(BaseUrl)}, ${setSQLBooleanValue(IsActive)}, 
                    ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, 
                    ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
                );
            `;

            const result = await transaction.request().query(insertQuery);
            if (result.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(200).json(errorMessage("No SMS Entry Created."));
            }

            if (IsActive) {
                const updateQuery = `UPDATE MobSMSMast SET IsActive = 0 WHERE MsgUkeyId != '${MsgUkeyId}'`;
                await transaction.request().query(updateQuery);
                console.log('Update Other SMS', updateQuery);
            }

            await transaction.commit(); // Commit Transaction
            return res.status(200).json(successMessage("New SMS Entry Created Successfully.", { MsgUkeyId }));

        } else if (flag === 'U') {
            const verifyMobileSMSMast = `SELECT * FROM MobSMSMast WHERE MsgUkeyId = '${MsgUkeyId}'`;
            const { recordset } = await transaction.request().query(verifyMobileSMSMast);

            if (recordset.length === 0) {
                await transaction.rollback();
                return res.status(200).json(errorMessage("No SMS Entry Found."));
            }

            const deleteQuery = `DELETE FROM MobSMSMast WHERE MsgUkeyId = '${MsgUkeyId}'`;
            await transaction.request().query(deleteQuery);

            const insertQuery = `
                INSERT INTO MobSMSMast (
                    MsgUkeyId, OrganizerUkeyId, EventUkeyId, BaseUrl, IsActive, IpAddress, HostName, EntryDate, flag
                ) VALUES (
                    '${MsgUkeyId}', ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, 
                    ${setSQLStringValue(BaseUrl)}, ${setSQLBooleanValue(IsActive)}, 
                    ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, 
                    ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
                );
            `;

            const result = await transaction.request().query(insertQuery);
            if (result.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(200).json(errorMessage("No SMS Entry Updated."));
            }

            if (IsActive) {
                const updateQuery = `UPDATE MobSMSMast SET IsActive = 0 WHERE MsgUkeyId != '${MsgUkeyId}'`;
                await transaction.request().query(updateQuery);
                console.log('Update Other SMS', updateQuery);
            }

            await transaction.commit(); // Commit Transaction
            return res.status(200).json(successMessage("SMS Entry Updated Successfully.", { MsgUkeyId }));
        } else {
            await transaction.rollback();
            return res.status(200).json(errorMessage("Use 'A' flag to Add and 'U' flag to update."));
        }
    } catch (error) {
        await transaction.rollback();
        console.error(flag === 'A' ? "Add SMS Entry Error:" : "Update SMS Entry Error:", error);
        return res.status(500).send(errorMessage(error?.message));
    }
};


const RemoveMobSMSMast = async (req, res) => {
    try {
        const { MsgUkeyId } = req.query;
        const missingKeys = checkKeysAndRequireValues(["MsgUkeyId"], req.query);

        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(", ")} is required`));
        }

        const query = `DELETE FROM MobSMSMast WHERE MsgUkeyId = '${MsgUkeyId}'`;
        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(200).json(errorMessage("No SMS Entry Deleted."));
        }
        return res.status(200).json(successMessage("SMS Entry Deleted Successfully.", { MsgUkeyId }));
    } catch (error) {
        console.error("Delete SMS Entry Error:", error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    FetchMobSMSMastDetails,
    ManageMobSMSMast,
    RemoveMobSMSMast,
};