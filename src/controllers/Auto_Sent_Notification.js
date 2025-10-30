const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLOrderId, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchAutoSentNotificationList = async (req, res) => {
    try {
        const { 
            SortBy = 'asn.SentNotificationId', 
            SortOrder = 'DESC', 
            SentNotificationId, 
            SentNotificationUkeyId, 
            Status, 
            flag 
        } = req.query;

        let whereConditions = [];

        // Build the WHERE clause based on the query parameters
        if (SentNotificationId) {
            whereConditions.push(`asn.SentNotificationId = '${SentNotificationId}'`);
        }
        if (SentNotificationUkeyId) {
            whereConditions.push(`asn.SentNotificationUkeyId = '${SentNotificationUkeyId}'`);
        }
        if (Status !== undefined) {
            whereConditions.push(`asn.Status = ${setSQLBooleanValue(Status)}`);
        }
        if (flag) {
            whereConditions.push(`asn.flag = '${flag}'`);
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query definitions
        const getAutoSentNotificationList = {
            getQuery: `SELECT asn.*, om.OrganizerName FROM AutoSentNotification As asn
                       LEFT JOIN OrganizerMaster As om ON om.OrganizerUkeyId = asn.OrganizerUkeyId ${whereString} ORDER BY ${SortBy} ${SortOrder}`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM AutoSentNotification AS asn ${whereString}`,
        };

        // Execute the query and return results
        const result = await getCommonAPIResponse(req, res, getAutoSentNotificationList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};



const AutoSentNotificationHandler = async (req, res) => {
    const {
        SentNotificationUkeyId = generateUUID(),
        Status = true,
        Title = '',
        Description = '',
        Link = '',
        LinkType = 'Web',
        flag,
        Image,
        SentTime,
        BellNotification = false
    } = req.body;

    const missingKeys = checkKeysAndRequireValues(['Title'], { ...req.body, Image });
    if (missingKeys.length > 0) {
        return res.status(400).send(errorMessage(`${missingKeys.join(', ')} parameters are required and must not be null or undefined`));
    }

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();

        const insertQuery = `
            INSERT INTO AutoSentNotification 
            (SentNotificationUkeyId, Title, Description, Image, Link, LinkType, Status, SentTime, IpAddress, HostName, EntryDate, flag, BellNotification) 
            VALUES 
            ('${SentNotificationUkeyId}', N'${Title}', N'${Description}', '${Image}', N'${Link}', N'${LinkType}', ${setSQLBooleanValue(Status)}, '${SentTime}', 
            '${IPAddress}', '${ServerName}', '${EntryTime}', N'${flag}', ${setSQLBooleanValue(BellNotification)});
        `;

        const deleteQuery = `
            DELETE FROM AutoSentNotification WHERE SentNotificationUkeyId = '${SentNotificationUkeyId}';
        `;

        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result?.rowsAffected?.[0] === 0) {
                return res.status(400).json(errorMessage('No AutoSentNotification Entry Created.'));
            }
            return res.status(200).json({ 
                ...successMessage('New AutoSentNotification Entry Created Successfully.'), 
                ...req.body, SentNotificationUkeyId 
            });
        } else if (flag === 'U') {
            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);
            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                return res.status(400).json(errorMessage('No AutoSentNotification Entry Updated.'));
            }
            return res.status(200).json({ 
                ...successMessage('AutoSentNotification Entry Updated Successfully.'), 
                ...req.body, SentNotificationUkeyId 
            });
        } else {
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to Update. It is compulsory to send the flag.")
            });
        }
    } catch (error) {
        console.error(flag === 'A' ? 'Add AutoSentNotification Error:' : 'Update AutoSentNotification Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const removeAutoSentNotification = async (req, res) => {
    try {
        const { SentNotificationUkeyId } = req.query;

        // Check if required keys are missing
        const missingKeys = checkKeysAndRequireValues(['SentNotificationUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        // Execute the DELETE query
        const deleteQuery = 
            `DELETE FROM AutoSentNotification WHERE SentNotificationUkeyId = '${SentNotificationUkeyId}';`
        ;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No AutoSentNotification Entry Deleted.') });
        }

        // Return success response
        return res.status(200).json({ ...successMessage('AutoSentNotification Entry Deleted Successfully.'), SentNotificationUkeyId });
    } catch (error) {
        console.log('Delete AutoSentNotification Entry Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};



module.exports = {
    fetchAutoSentNotificationList,
    AutoSentNotificationHandler,
    removeAutoSentNotification
}