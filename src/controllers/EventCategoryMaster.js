const {
    errorMessage,successMessage, checkKeysAndRequireValues, setSQLStringValue, setSQLNumberValue, setSQLBooleanValue, getCommonAPIResponse, getCommonKeys,
    setSQLDecimalValue,
    setSQLDateTime,
    deleteImage
} = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

// Fetch EventCategoryMaster Details
const fetchEventCategory = async (req, res) => {
    try {
        const { EventCategoryUkeyId, IsActive, CategoryMode } = req.query;
        let whereConditions = [];

        if (EventCategoryUkeyId) {
            whereConditions.push(`EventCategoryUkeyId = ${setSQLStringValue(EventCategoryUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if (CategoryMode) {
            whereConditions.push(`CategoryMode = ${setSQLStringValue(CategoryMode)}`);
        }
        whereConditions.push(`flag <> 'D'`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const queries = {
            getQuery: `SELECT * FROM EventCategoryMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM EventCategoryMaster ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, queries);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

// Insert or Update EventCategoryMaster
const EventCategoryMaster = async (req, res) => {
    const {
        EventCategoryUkeyId, CategoryName, IsActive = true, flag, CategoryMode
    } = req.body;
    let {Image} = req.body;
    Image = req?.files?.Image?.length ? `${req?.files?.Image[0]?.filename}` : Image;
    const imagePath = req?.files?.Image[0]?.path.replace(/\\/g, '/');

    try {
        const missingKeys = checkKeysAndRequireValues(['EventCategoryUkeyId', 'CategoryName', 'IsActive'], req.body);

        if (missingKeys.length > 0) {
            if (imagePath) deleteImage(imagePath); // Only delete if `Img` exists
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO EventCategoryMaster (
                EventCategoryUkeyId, CategoryName, Image, IsActive, UserId, UserName, flag, IpAddress, HostName, EntryDate, CategoryMode
            ) VALUES (
                ${setSQLStringValue(EventCategoryUkeyId)}, ${setSQLStringValue(CategoryName)}, ${setSQLStringValue(Image)}, ${setSQLBooleanValue(IsActive)}, ${setSQLNumberValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(CategoryMode)}
            );
        `;
        
        const deleteQuery = `
            DELETE FROM EventCategoryMaster WHERE EventCategoryUkeyId = ${setSQLStringValue(EventCategoryUkeyId)};
        `;

        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                if (imagePath) deleteImage(imagePath); // Only delete if `Img` exists
                return res.status(400).json(errorMessage('Failed to create template.'));
            }

            return res.status(200).json({...successMessage('Template created successfully.'), ...req.body});
        } else if (flag === 'U') {

            const checkQuery = `SELECT Image FROM EventCategoryMaster WHERE EventCategoryUkeyId = ${setSQLStringValue(EventCategoryUkeyId)};`;
            const checkResult = await pool.request().query(checkQuery);
            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                if (imagePath) deleteImage(imagePath); // Only delete if `Img` exists
                return res.status(400).json(errorMessage('Failed to update template.'));
            }
            
            if (checkResult.rowsAffected[0] > 0) {
                if (checkResult.recordset[0].Image != Image) {
                    if (checkResult.recordset[0].Image) deleteImage(`media/EventCategory/${checkResult.recordset[0].Image}`); // Only delete if `Img` exists
                }
            }

            return res.status(200).json({...successMessage('Template updated successfully.'), ...req.body});
        } else {
            if (imagePath) deleteImage(imagePath); // Only delete if `Img` exists
            return res.status(400).json(errorMessage("Use 'A' flag to add and 'U' flag to update."));
        }
    } catch (error) {
        console.error(error);
        if (imagePath) deleteImage(imagePath); // Only delete if `Img` exists
        return res.status(500).send(errorMessage(error?.message));
    }
};

// Remove Coupon Entry
const RemoveEventCategory = async (req, res) => {
    try {
        const { EventCategoryUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['EventCategoryUkeyId'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const checkQuery = `SELECT Image FROM EventCategoryMaster WHERE EventCategoryUkeyId = ${setSQLStringValue(EventCategoryUkeyId)} AND flag <> 'D'`;
        const checkResult = await pool.request().query(checkQuery);
        if (checkResult.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No template found to delete.'));
        }

        const query = `
        update EventCategoryMaster set flag = 'D' WHERE EventCategoryUkeyId = ${setSQLStringValue(EventCategoryUkeyId)}
        `;

        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No template found to delete.'));
        }

        if (checkResult.rowsAffected[0] > 0) {
            if (checkResult.recordset[0].Image) {
                if (checkResult.recordset[0].Image) deleteImage(`media/EventCategory/${checkResult.recordset[0].Image}`); // Only delete if `Img` exists
            }
        }

        return res.status(200).json(successMessage('Template deleted successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    fetchEventCategory,
    EventCategoryMaster,
    RemoveEventCategory,
};