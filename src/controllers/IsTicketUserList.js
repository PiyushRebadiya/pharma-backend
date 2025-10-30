const { errorMessage, getCommonAPIResponse, setSQLBooleanValue } = require("../common/main")

const Ticket_User_List = async (req, res) => {
    try {
        const { IsTicket = false } = req.query; // `type` determines the type of query (e.g., 'withPayments' or 'withoutPayments')

        if(IsTicket !== 'true' && IsTicket !== 'false') {
            return res.status(400).send(errorMessage("type must be 'true' or 'false'"));    
        }

        // Determine the join and where clause based on the type
        const joinClause = setSQLBooleanValue(IsTicket)
            ? 'INNER JOIN PaymentMaster AS P ON U.UserUkeyId = P.UserUkeyId'
            : 'LEFT JOIN PaymentMaster AS P ON U.UserUkeyId = P.UserUkeyId';
        const whereClause = setSQLBooleanValue(IsTicket)
            ? ''
            : 'WHERE P.UserUkeyId IS NULL'; // Include a WHERE clause only for the 'withoutPayments' type

        const getUserList = {
            getQuery: `
                    SELECT DISTINCT U.* 
                    FROM UserMaster AS U
                    ${joinClause}
                    ${whereClause}
                    ORDER BY U.UserId DESC`,
            countQuery: `
                    SELECT COUNT(DISTINCT U.UserId) AS totalCount 
                    FROM UserMaster AS U
                    ${joinClause}
                    ${whereClause}`
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

module.exports = { Ticket_User_List };
