const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, setSQLStringValue, setSQLNumberValue, getCommonAPIResponse } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchEmailLogs = async (req, res) => {
    try {
        const { UserUkeyId, OrganizerUkeyId, EventUkeyId, IsSent, Category, Language, Email } = req.query;
        let whereConditions = [];
        if (UserUkeyId) {
            whereConditions.push(`el.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`el.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`el.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (IsSent) {
            whereConditions.push(`el.IsSent = ${setSQLBooleanValue(IsSent)}`);
        }
        if (Category) {
            whereConditions.push(`el.Category = ${setSQLStringValue(Category)}`);
        }
        if (Language) {
            whereConditions.push(`el.Language = ${setSQLStringValue(Language)}`);
        }
        if (Email) {
            whereConditions.push(`el.Email = ${setSQLStringValue(Email)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT um.FullName, om.OrganizerName, em.EventName, el.* FROM EmailLogs as el
            left join UserMaster um on um.UserUkeyId = el.UserUkeyId
            left join OrganizerMaster om on om.OrganizerUkeyId = el.OrganizerUkeyId
            left join EventMaster em on em.EventUkeyId = el.EventUkeyId ${whereString} order by el.Id desc`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM EmailLogs as el 
            left join UserMaster um on um.UserUkeyId = el.UserUkeyId
            left join OrganizerMaster om on om.OrganizerUkeyId = el.OrganizerUkeyId
            left join EventMaster em on em.EventUkeyId = el.EventUkeyId ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    } catch (error) {
        console.log('City list API error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

module.exports = {
    fetchEmailLogs
}