const { errorMessage, getCommonAPIResponse, setSQLBooleanValue, setSQLDateTime, setSQLStringValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const fetchLogTable = async (req, res) => {
    try {
        const { UkeyId, UserCode, VerifyStatus, startDateTime, endDateTime, VolunteerUkeyId, IsAdmin } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the conditions
        if (UkeyId) {
            whereConditions.push(`l.UkeyId = '${UkeyId}'`);
        }
        if (UserCode) {
            whereConditions.push(`l.UserCode = '${UserCode}'`);
        }
        if (VerifyStatus) {
            whereConditions.push(`l.VerifyStatus = ${setSQLBooleanValue(VerifyStatus)}`);
        }
        if (IsAdmin) {
            whereConditions.push(`l.IsAdmin = ${setSQLBooleanValue(IsAdmin)}`);
        }
        if (VolunteerUkeyId) {
            whereConditions.push(`l.VolunteerUkeyId = ${setSQLStringValue(VolunteerUkeyId)}`);
        }
        if (startDateTime && endDateTime) {
            whereConditions.push(`l.EntryDate BETWEEN ${setSQLDateTime(startDateTime)} AND ${setSQLDateTime(endDateTime)}`);
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT l.*, t.TicketUkeyId, t.Name, t.Mobile, t.Verify, t.MemberType, t.SubCategory, t.GateNo, t.OrganizerUkeyId, t.UserUkeyId, t.EventUkeyId, t.PaymentUkeyId, t.UsrName, t.UsrID, t.IsScan FROM logtable AS l left join TicketMaster AS t on t.UserCode = l.UserCode ${whereString} ORDER BY LogId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM logtable AS l left join TicketMaster AS t on t.UserCode = l.UserCode ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

module.exports = {
    fetchLogTable
}