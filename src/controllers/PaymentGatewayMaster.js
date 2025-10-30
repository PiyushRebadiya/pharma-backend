const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchPaymentGatewayMasterDetails = async (req, res)=>{
    try{
        const { GatewayUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, payMode, salt, MID } = req.query;
        let whereConditions = [];

        if (GatewayUkeyId) {
            whereConditions.push(`GatewayUkeyId = ${setSQLStringValue(GatewayUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (payMode) {
            whereConditions.push(`payMode = ${setSQLStringValue(payMode)}`);
        }
        if (salt) {
            whereConditions.push(`salt = ${setSQLStringValue(salt)}`);
        }
        if (MID) {
            whereConditions.push(`MID = ${setSQLStringValue(MID)}`);
        }
        if (IsActive) {
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM PaymentGatewayMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM PaymentGatewayMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const PaymentGatewayMaster = async (req, res) => {
    const { 
        GatewayUkeyId, ShortName, GatewayName, KeyId, SecretKey, ConvenienceFee, EventUkeyId, OrganizerUkeyId, flag, IsActive, DonationAmt, AdditionalCharges, GST, payMode, MID, salt} = req.body;
    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO PaymentGatewayMaster (
                GatewayUkeyId, ShortName, GatewayName, KeyId, SecretKey, ConvenienceFee, UserId, UserName, IpAddress, HostName, EntryDate, EventUkeyId, OrganizerUkeyId, flag, IsActive, DonationAmt, AdditionalCharges, GST, payMode, salt, MID
            ) VALUES (
                ${setSQLStringValue(GatewayUkeyId)}, ${setSQLStringValue(ShortName)}, ${setSQLStringValue(GatewayName)}, ${setSQLStringValue(KeyId)}, ${setSQLStringValue(SecretKey)}, ${setSQLStringValue(ConvenienceFee)}, ${setSQLStringValue(req.user.UserId)},${setSQLStringValue(req.user.firstName)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IsActive)}, ${setSQLStringValue(DonationAmt)}, ${setSQLStringValue(AdditionalCharges)}, ${setSQLStringValue(GST)}, ${setSQLStringValue(payMode)}, ${setSQLStringValue(salt)}, ${setSQLStringValue(MID)}
            );
        `;

        const deleteQuery = `
            DELETE FROM PaymentGatewayMaster WHERE GatewayUkeyId = ${setSQLStringValue(GatewayUkeyId)};
        `;

        const missingKeys = checkKeysAndRequireValues(['GatewayUkeyId', 'GatewayName'], req.body);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        if (flag === 'A') {

            const result = await pool.request().query(insertQuery);

            if (result?.rowsAffected?.[0] === 0) {
                return res.status(400).json({ ...errorMessage('No Sponsor Created.') });
            }

            return res.status(200).json({ 
                ...successMessage('New Sponsor Created Successfully.'), 
                ...req.body
            });

        } else if (flag === 'U') {

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                return res.status(400).json({ ...errorMessage('No Sponsor Master Updated.') });
            }

            return res.status(200).json({ 
                ...successMessage('New Sponsor Master Updated Successfully.'), 
                ...req.body 
            });

        } else {
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsory to send flag.")
            });
        }
    } catch (error) {
        if (flag === 'A') {
            console.log('Add Sponsor Master Error :', error);
        }
        if (flag === 'U') {
            console.log('Update Sponsor Master Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemovePaymentGateway = async (req, res) => {
    try {
        const { GatewayUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['GatewayUkeyId', 'OrganizerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            DELETE FROM PaymentGatewayMaster WHERE GatewayUkeyId = ${setSQLStringValue(GatewayUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Sponsor Master Deleted.') });
        }

        return res.status(200).json({ ...successMessage('Sponsor Master Deleted Successfully.'), GatewayUkeyId });
    } catch (error) {
        console.log('Delete Sponsor Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    FetchPaymentGatewayMasterDetails,
    PaymentGatewayMaster,
    RemovePaymentGateway,
}