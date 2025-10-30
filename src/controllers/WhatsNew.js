const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, CommonLogFun, setSQLDecimalValue, setSQLDateTime } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const Fetchwhatsnew = async (req, res) => {
    try {
        const { UkeyId, PanelType } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (UkeyId) {
            whereConditions.push(`UkeyId = ${setSQLStringValue(UkeyId)}`);
        }
        if (PanelType) {
            whereConditions.push(`PanelType = ${setSQLStringValue(PanelType)}`);
        }
        whereConditions.push(`Flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `SELECT * FROM WhatsNew ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM WhatsNew ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const whatsnew = async (req, res) => {
    const { UkeyId, EntryDate, Release, dbVersion, Description, Module, WType, Notes, flag, PanelType } = req.body;
    try {
        const { EntryTime } = getCommonKeys(req);
        
        const insertQuery = `
            INSERT INTO WhatsNew (
                UkeyId, EntryDate, Release, dbVersion, Description, Module, WType, Notes, EntryTime, flag, PanelType
            ) VALUES (
                ${setSQLStringValue(UkeyId)}, ${setSQLDateTime(EntryDate)}, ${setSQLStringValue(Release)}, ${setSQLDecimalValue(dbVersion)}, ${setSQLStringValue(Description)}, ${setSQLStringValue(Module)}, ${setSQLStringValue(WType)}, ${setSQLStringValue(Notes)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(PanelType)}
            );
        `;

        const deleteQuery = `
            DELETE FROM WhatsNew WHERE UkeyId = ${setSQLStringValue(UkeyId)};
        `;

        const missingKeys = checkKeysAndRequireValues(['UkeyId'], req.body);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        if (flag === 'A') {

            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                return res.status(400).json({ ...errorMessage('no speaker created.') });
            }

            return res.status(200).json({ 
                ...successMessage('new pricing created successfully.'), 
                ...req.body 
            });

        } else if (flag === 'U') {

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                return res.status(400).json({ ...errorMessage('No pricing record updated.') });
            }

            return res.status(200).json({ 
                ...successMessage('pricing record updated successfully.'), 
                ...req.body 
            });

        } else {
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsory to send flag.")
            });
        }
    } catch (error) {
        console.log('Add pricing record error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const removewhatsnew = async (req, res) => {
    try {
        const { UkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['UkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            update WhatsNew set Flag = 'D' WHERE UkeyId = ${setSQLStringValue(UkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('no pricing record deleted.') });
        }

        return res.status(200).json({ ...successMessage('pricing record deleted successfully.'), ...req.body });
    } catch (error) {
        console.log('Delete pricing record Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    Fetchwhatsnew,
    whatsnew,
    removewhatsnew,
}