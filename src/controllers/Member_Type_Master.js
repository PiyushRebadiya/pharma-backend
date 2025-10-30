const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchMemberTypeMasterDetails = async (req, res)=>{
    try{
        const { UkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (UkeyId) {
            whereConditions.push(`UkeyId = '${UkeyId}'`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM MemberTypeMaster ${whereString} ORDER BY MemberTypeId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM MemberTypeMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const MemberTypeMaster = async (req, res) => {
    const {  UkeyId = generateUUID(), MemberType = null, SubCategory = null, IsActive = true, flag = ''} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const insertQuery = `
            INSERT INTO MemberTypeMaster (
                UkeyId, MemberType, IsActive, SubCategory, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                '${UkeyId}', ${setSQLStringValue(MemberType)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(SubCategory)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            );
        `
        const deleteQuery = `
            DELETE FROM MemberTypeMaster WHERE UkeyId = '${UkeyId}';
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Member Type Created.'),})
            }

            return res.status(200).json({...successMessage('New Member Type Created Successfully.'), ...req.body, UkeyId});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Member Type Updated.')})
            }

            return res.status(200).json({...successMessage('New Member Type Updated Successfully.'), ...req.body, UkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Member Type Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Member Type Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveMemberTypeMaster = async (req, res) => {
    try{
        const {UkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['UkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM MemberTypeMaster WHERE UkeyId = '${UkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Member Type Deleted.')})
        }

        return res.status(200).json({...successMessage('Member Type Deleted Successfully.'), UkeyId});
    }catch(error){
        console.log('Delete Member Type Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
};

module.exports = {
    FetchMemberTypeMasterDetails,
    MemberTypeMaster,
    RemoveMemberTypeMaster,
}