const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, setSQLStringValue, setSQLNumberValue, getCommonAPIResponse } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchCityData = async (req, res)=> {
    try{
        const { CityID, CityName, StateID, STDCode, Search } = req.query;
        let whereConditions = [];
        if (CityID) {
            whereConditions.push(`CityID = ${setSQLStringValue(CityID)}`);
        }
        if (CityName) {
            whereConditions.push(`CityName = ${setSQLStringValue(CityName)}`);
        }
        if (StateID) {
            whereConditions.push(`StateID = ${setSQLStringValue(StateID)}`);
        }
        if (STDCode) {
            whereConditions.push(`STDCode = ${setSQLStringValue(STDCode)}`);
        }
        if (Search) {
            whereConditions.push(`CityName LIKE ${setSQLStringValue(`%${Search}%`)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM City ${whereString} ORDER BY CityID DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM City ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        console.log('City list API error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

module.exports = {
    fetchCityData
}