const { getAPIALLDataResponse, errorMessage, checkKeysAndRequireValues, getCommonKeys, successMessage, setSQLNumberValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const fetchRazorpayCredentials = async (req, res) => {
    const result = await getAPIALLDataResponse(req, res, 'RazorpayCredentials', 'Id');
    res.json(result);
};

const updateRazorpayCredentials = async (req, res) => {
    try {
        const { KeyId, SecretKey, RazorpayId, ConvenienceFee = 0 } = req.body
        const fieldCheck = checkKeysAndRequireValues(['KeyId', 'SecretKey', 'RazorpayId'], req.body)
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();
        const updateQuery = `UPDATE RazorpayCredentials SET  KeyId = '${KeyId}', SecretKey = '${SecretKey}', ConvenienceFee = ${setSQLNumberValue(ConvenienceFee)}, IPAddress = '${IPAddress}', ServerName = '${ServerName}', EntryTime = '${EntryTime}' WHERE Id = ${RazorpayId}`
        const result = await pool.query(updateQuery);
        if (result?.rowsAffected[0] === 0) {
            return res.status(400).send(errorMessage('No rows updated of Razorpay!'))
        }
        return res.status(200).send(successMessage('Razorpay credentials updated Successfully!'))
    } catch (error) {
        console.log('Update Razorpay Error :', error);
        return res.status(500).send(errorMessage(error?.message))
    }
}

module.exports = {
    fetchRazorpayCredentials,
    updateRazorpayCredentials
}