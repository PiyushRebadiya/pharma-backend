const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, CommonLogFun, setSQLDecimalValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchPricing = async (req, res) => {
    try {
        const { PriceUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (PriceUkeyId) {
            whereConditions.push(`pm.PriceUkeyId = ${setSQLStringValue(PriceUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`pm.IsActive = ${setSQLStringValue(IsActive)}`);
        }
        whereConditions.push(`pm.flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `SELECT pm.*, cm.CouponCode FROM PriceMaster pm
            left join CouponMaster cm on pm.CouponukeyId = cm.CouponUkeyId
            ${whereString} ORDER BY pm.EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM PriceMaster pm
            left join CouponMaster cm on pm.CouponukeyId = cm.CouponUkeyId
            ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const PricingMaster = async (req, res) => {
    const { PriceUkeyId, PackageTitle, CouponukeyId, OriginalPrice, DiscountPrice, EventLimit, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, IsActive = true, flag} = req.body;
    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        
        const insertQuery = `
            INSERT INTO PriceMaster (
                PriceUkeyId, PackageTitle, CouponukeyId, OriginalPrice, DiscountPrice, EventLimit, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, IsActive, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                ${setSQLStringValue(PriceUkeyId)}, ${setSQLStringValue(PackageTitle)}, ${setSQLStringValue(CouponukeyId)}, ${setSQLDecimalValue(OriginalPrice)}, ${setSQLDecimalValue(DiscountPrice)}, ${setSQLNumberValue(EventLimit)}, ${setSQLNumberValue(Ticketlimits)}, ${setSQLNumberValue(SubAdminLimit)}, ${setSQLNumberValue(VolunteerLimit)}, ${setSQLNumberValue(Speaker)}, ${setSQLNumberValue(Sponsor)}, ${setSQLNumberValue(iMessenger)}, ${setSQLNumberValue(iMessngerlimit)}, ${setSQLBooleanValue(MetaWhatsapp)}, ${setSQLNumberValue(MetaLimit)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            );
        `;

        const deleteQuery = `
            DELETE FROM PriceMaster WHERE PriceUkeyId = ${setSQLStringValue(PriceUkeyId)};
        `;

        const missingKeys = checkKeysAndRequireValues(['PriceUkeyId'], req.body);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        if (flag === 'A') {

            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                return res.status(400).json({ ...errorMessage('no speaker created.') });
            }

            CommonLogFun({
                ReferenceUkeyId : PriceUkeyId, 
                MasterName : PackageTitle,  
                TableName : "PriceMaster", 
                UserId : req?.user?.UserId, 
                UserName : req?.user?.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })

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

            CommonLogFun({
                ReferenceUkeyId : PriceUkeyId, 
                MasterName : PackageTitle,  
                TableName : "PriceMaster", 
                UserId : req?.user?.UserId, 
                UserName : req?.user?.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })

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

const RemovePricing = async (req, res) => {
    try {
        const { PriceUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['PriceUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            update PriceMaster set flag = 'D' WHERE PriceUkeyId = ${setSQLStringValue(PriceUkeyId)};
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
    FetchPricing,
    PricingMaster,
    RemovePricing,
}