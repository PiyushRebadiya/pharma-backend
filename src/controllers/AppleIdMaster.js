const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const addAppleIdMaster = async (req, res) => {
    try{
        const {AppleId, EmailId} = req.body
        const missingKeys = checkKeysAndRequireValues(['AppleId', 'EmailId'], { ...req.body });

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const checkIdExist = await pool.request().query(`select * from AppleAndEmailIds where AppleId = ${setSQLStringValue(AppleId)}`)

        if(checkIdExist.recordset.length > 0){
            return res.status(400).json(errorMessage('Record already exist'))
        }

        const result = await pool.request().query(`insert into AppleAndEmailIds (
            AppleId, EmailId
        ) values (
            ${setSQLStringValue(AppleId)}, ${setSQLStringValue(EmailId)}
        )`)

        if(result.rowsAffected[0] === 0){
            return res.status(400).json(errorMessage('No Record created'))
        }
        return res.status(200).json(successMessage('Record created successfully'))
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const fetchAppleIdMaster = async (req, res) => {
    try{
        const {AppleId, EmailId} = req.query
        let whereConditions = [];

        if (AppleId) {
            whereConditions.push(`AppleId = ${setSQLStringValue(AppleId)}`);
        }
        if (EmailId) {
            whereConditions.push(`EmailId = ${setSQLStringValue(EmailId)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT * from AppleAndEmailIds
                ${whereString}
                ORDER BY id DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM AppleAndEmailIds ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

module.exports = {
    addAppleIdMaster,
    fetchAppleIdMaster
}