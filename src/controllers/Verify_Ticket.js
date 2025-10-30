const { checkKeysAndRequireValues, errorMessage, successMessage, getCommonKeys, generateUUID, setSQLStringValue, setSQLBooleanValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const verifyTicket = async (req, res) => {
    try {
        const { UserCode, IsScan, VolunteerUkeyId, IsAdmin } = req.body;
        const fieldCheck = checkKeysAndRequireValues(['UserCode', 'VolunteerUkeyId', "IsAdmin"], req.body);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const jsonData = JSON.parse(UserCode);
        let rowsAffected = 0;
        const alreadyVerifiedUsers = [];
        const ticketVerifedSuccessfullyUsers = [];

        // Use for...of instead of forEach
        for (const element of jsonData) {
            try {
                const checkVerifyQuery = `SELECT Verify, Name, Mobile FROM TicketMaster WHERE UserCode = '${element}'`;
                const resultVerify = await pool.query(checkVerifyQuery);

                if (resultVerify?.recordset[0]?.Verify == 1) {
                    alreadyVerifiedUsers.push({
                        Name: resultVerify?.recordset[0]?.Name,
                        Mobile: resultVerify?.recordset[0]?.Mobile,
                    });
                    continue; // Skip this iteration
                }

                const updateQuery = `UPDATE TicketMaster SET Verify = 1, IsScan = ${setSQLBooleanValue(IsScan)}, VolunteerUkeyId = ${setSQLStringValue(VolunteerUkeyId)}, IsAdmin = ${setSQLBooleanValue(IsAdmin)} WHERE UserCode = '${element}'`;
                const result = await pool.query(updateQuery);
                if (result?.rowsAffected[0] === 0) {
                    continue; // Skip if update fails
                }

                ticketVerifedSuccessfullyUsers.push({
                    Name: resultVerify?.recordset[0]?.Name,
                    Mobile: resultVerify?.recordset[0]?.Mobile,
                });

                const { IPAddress, ServerName, EntryTime } = getCommonKeys();
                await pool.query(`
                    INSERT INTO logtable (
                        UkeyId, UserCode, VerifyStatus, IpAddress, HostName, EntryDate, flag, VolunteerUkeyId, IsAdmin
                    ) VALUES (
                        '${generateUUID()}', ${setSQLStringValue(element)}, 1, 
                        ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, 
                        ${setSQLStringValue(EntryTime)}, 'A', ${setSQLStringValue(VolunteerUkeyId)}, ${setSQLBooleanValue(IsAdmin)}
                    )
                `);

                rowsAffected++;
            } catch (err) {
                console.error('Error verifying ticket:', err);
                continue; // Skip to the next iteration on error
            }
        }

        return res.status(200).send({
            ...successMessage('Ticket verification completed!'),
            alreadyVerifiedUsers,
            ticketVerifedSuccessfullyUsers,
        });
    } catch (error) {
        console.error('verifyTicket error:', error);
        return res.status(400).send(errorMessage(error?.message));
    }
};

module.exports = { verifyTicket }