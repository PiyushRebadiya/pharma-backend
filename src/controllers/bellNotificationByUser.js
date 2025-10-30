const { checkKeysAndRequireValues, errorMessage, getCommonKeys, generateUUID, successMessage } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const verifyBellNotificationByUser = async (req, res) => {
    try{
        const { BellNotificationUkeyId } = req.body
        const missingKeys = checkKeysAndRequireValues(['BellNotificationUkeyId'], req.body)
        if (missingKeys.length !== 0) {
            return res.status(400).send(errorMessage(`${missingKeys} is required`));
        }
        const { EntryTime, IPAddress, ServerName } = getCommonKeys();

        const alreadyAddedNottification = await pool.request().query(`SELECT * FROM BellNotificationUser WHERE UserUkeyId = '${req.user.UserUkeyId}' AND BellNotificationUkeyId = '${BellNotificationUkeyId}'`);
        if(alreadyAddedNottification.recordset.length > 0){
            return res.status(400).send(successMessage('Notification Already Added'));
        }
        const insertQuery = `INSERT INTO BellNotificationUser (UserUkeyId, BellNotificationUkeyId, IpAddress, HostName, EntryDate) values ('${req.user.UserUkeyId}', '${BellNotificationUkeyId}', '${IPAddress}', '${ServerName}', '${EntryTime}')`;
        const result = pool.request().query(insertQuery);
        if (result.rowsAffected && result.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No row Inserted in Notification User'));
        }
        return res.status(200).send(successMessage('Data Inserted successfully'));
    }catch(error){
        console.log('Add notification user Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = { verifyBellNotificationByUser }