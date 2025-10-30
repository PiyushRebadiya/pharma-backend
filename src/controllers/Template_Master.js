const {
    errorMessage,successMessage, checkKeysAndRequireValues, setSQLStringValue, setSQLNumberValue, setSQLBooleanValue, getCommonAPIResponse, getCommonKeys
} = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

// Fetch TemplateMaster Details
const FetchTemplateMasterDetails = async (req, res) => {
    try {
        const { TemplateUkeyId, Name, IsActive, Category, Role} = req.query;
        let whereConditions = [];

        if (TemplateUkeyId) {
            whereConditions.push(`TemplateUkeyId = ${setSQLStringValue(TemplateUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if (Name) {
            whereConditions.push(`Name = ${setSQLStringValue(Name)}`);
        }
        if (Category) {
            whereConditions.push(`Category = ${setSQLStringValue(Category)}`);
        }
        if (Role) {
            whereConditions.push(`Role = ${setSQLStringValue(Role)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const queries = {
            getQuery: `SELECT * FROM TemplateMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM TemplateMaster ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, queries);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

// Insert or Update TemplateMaster
const ManageTemplateMaster = async (req, res) => {
    const {
        TemplateUkeyId, EventUkeyId, OrganizerUkeyId, Description, Name, IsActive, flag, Category, Role
    } = req.body;

    try {
        const missingKeys = checkKeysAndRequireValues(['TemplateUkeyId', 'EventUkeyId', 'OrganizerUkeyId', 'Description', 'Name'], req.body);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO TemplateMaster (
                TemplateUkeyId, EventUkeyId, OrganizerUkeyId, Description, Name, UserId, UserName, IsActive, flag, IpAddress, HostName, EntryDate, Category, Role
            ) VALUES (
                ${setSQLStringValue(TemplateUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Description)}, ${setSQLStringValue(Name)}, ${setSQLNumberValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(Category)}, ${setSQLStringValue(Role)}
            );
        `;
        
        const deleteQuery = `
            DELETE FROM TemplateMaster WHERE TemplateUkeyId = ${setSQLStringValue(TemplateUkeyId)};
        `;

        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                return res.status(400).json(errorMessage('Failed to create template.'));
            }

            return res.status(200).json({...successMessage('Template created successfully.'), ...req.body});
        } else if (flag === 'U') {

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                return res.status(400).json(errorMessage('Failed to update template.'));
            }

            return res.status(200).json({...successMessage('Template updated successfully.'), ...req.body});
        } else {
            return res.status(400).json(errorMessage("Use 'A' flag to add and 'U' flag to update."));
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

// Remove TemplateMaster Entry
const RemoveTemplateMaster = async (req, res) => {
    try {
        const { TemplateUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['TemplateUkeyId', 'OrganizerUkeyId'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const query = `
            DELETE FROM TemplateMaster WHERE TemplateUkeyId = ${setSQLStringValue(TemplateUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;

        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No template found to delete.'));
        }

        return res.status(200).json(successMessage('Template deleted successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    FetchTemplateMasterDetails,
    ManageTemplateMaster,
    RemoveTemplateMaster,
};
