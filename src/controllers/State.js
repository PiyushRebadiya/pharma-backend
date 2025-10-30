const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, setSQLStringValue, setSQLNumberValue, getCommonAPIResponse } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchStateData = async (req, res)=> {
    try{
        const { StateName, ShortCode, StateCode } = req.query;
        let whereConditions = [];
        if (StateName) {
            whereConditions.push(`StateName = ${setSQLStringValue(StateName)}`);
        }
        if (ShortCode) {
            whereConditions.push(`ShortCode = ${setSQLStringValue(ShortCode)}`);
        }
        if (StateCode) {
            whereConditions.push(`StateCode = ${setSQLStringValue(StateCode)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM State ${whereString} ORDER BY StateID DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM State ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        console.log('state list API error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

module.exports = {
    fetchStateData
}