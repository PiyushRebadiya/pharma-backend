const {
    errorMessage,
    successMessage,
    checkKeysAndRequireValues,
    setSQLStringValue,
    getCommonAPIResponse,
    getCommonKeys,
    generateUUID,
} = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

// Fetch LiveStreamMaster Details
const FetchLiveStreamMasterDetails = async (req, res) => {
    try {
        const { LiveStreamMasterUkeyId, UserUkeyId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];

        if (LiveStreamMasterUkeyId) {
            whereConditions.push(`LiveStreamMasterUkeyId = '${LiveStreamMasterUkeyId}'`);
        }
        if (UserUkeyId) {
            whereConditions.push(`UserUkeyId = '${UserUkeyId}'`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = '${EventUkeyId}'`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const queries = {
            getQuery: `SELECT * FROM LiveStreamMaster ${whereString} ORDER BY LiveStreamMasterId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM LiveStreamMaster ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, queries);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

// Insert or Update LiveStreamMaster
const ManageLiveStreamMaster = async (req, res) => {
    const {
        LiveStreamMasterUkeyId = generateUUID(),
        UserUkeyId = '',
        OrganizerUkeyId = '',
        EventUkeyId = '',
        Link = '',
        flag = null,
        Title = ''
    } = req.body;

    try {
        const missingKeys = checkKeysAndRequireValues(['Link', 'Title'], req.body);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO LiveStreamMaster (LiveStreamMasterUkeyId, UserUkeyId, OrganizerUkeyId, EventUkeyId, Link, Title, flag, IpAddress, HostName, EntryDate)
            VALUES (
                ${setSQLStringValue(LiveStreamMasterUkeyId)},
                ${setSQLStringValue(UserUkeyId)},
                ${setSQLStringValue(OrganizerUkeyId)},
                ${setSQLStringValue(EventUkeyId)},
                ${setSQLStringValue(Link)},
                ${setSQLStringValue(Title)},
                ${setSQLStringValue(flag)},
                ${setSQLStringValue(IPAddress)},
                ${setSQLStringValue(ServerName)},
                ${setSQLStringValue(EntryTime)}
            );
        `;

        const oldQuery = `
            SELECT * FROM LiveStreamMaster WHERE LiveStreamMasterUkeyId = '${LiveStreamMasterUkeyId}';
        `;

        const deleteQuery = `
            DELETE FROM LiveStreamMaster WHERE LiveStreamMasterUkeyId = '${LiveStreamMasterUkeyId}';
        `;

        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                return res.status(400).json(errorMessage('Failed to create live stream.'));
            }

            return res.status(200).json(successMessage('Live stream created successfully.'));
        } else if (flag === 'U') {
            const oldResult = await pool.request().query(oldQuery);

            if (oldResult.rowsAffected[0] === 0 || !LiveStreamMasterUkeyId) {
                return res.status(400).json(errorMessage('No live stream found to update.'));
            }

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                return res.status(400).json(errorMessage('Failed to update live stream.'));
            }

            return res.status(200).json(successMessage('Live stream updated successfully.'));
        } else {
            return res.status(400).json(errorMessage("Use 'A' flag to add and 'U' flag to update."));
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

// Remove LiveStreamMaster Entry
const RemoveLiveStreamMaster = async (req, res) => {
    try {
        const { LiveStreamMasterUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['LiveStreamMasterUkeyId'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const query = `
            DELETE FROM LiveStreamMaster WHERE LiveStreamMasterUkeyId = '${LiveStreamMasterUkeyId}';
        `;

        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No live stream found to delete.'));
        }

        return res.status(200).json(successMessage('Live stream deleted successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    FetchLiveStreamMasterDetails,
    ManageLiveStreamMaster,
    RemoveLiveStreamMaster,
};
