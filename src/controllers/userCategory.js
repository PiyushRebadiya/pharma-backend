const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchUserCategory = async (req, res) => {
    try{
        const { UserCatUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (UserCatUkeyId) {
            whereConditions.push(`UserCatUkeyId = '${UserCatUkeyId}'`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM UserCategoryMaster ${whereString} ORDER BY UserCatId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM UserCategoryMaster ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        return res.json(
            result
        );
    }catch(error){
        console.log('fetch user category master error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

const createUserCategory = async (req, res) => {
    const {UserCatUkeyId, CategoryName, IsActive, flag
        } = req.body
    try{
        const UKeyId = generateUUID();
        const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
        
        const insertQuery = `
            INSERT INTO UserCategoryMaster (UserCatUkeyId, CategoryName, IsActive, flag, IpAddress, HostName, EntryDate, OrganizerId) VALUES (
                ${setSQLStringValue(UKeyId)}
                , ${setSQLStringValue(CategoryName)}
                , ${setSQLBooleanValue(IsActive)}
                , ${setSQLStringValue(flag)}
                , ${setSQLStringValue(IPAddress)}
                , ${setSQLStringValue(ServerName)}
                , ${setSQLStringValue(EntryTime)}
                , ${setSQLNumberValue(req?.user?.OrganizerId)}
            );
        `

        const updateQuery = `
            UPDATE UserCategoryMaster SET
            CategoryName = ${setSQLStringValue(CategoryName)}
            , IsActive = ${setSQLBooleanValue(IsActive)}
            , flag = ${setSQLStringValue(flag)}
            , IpAddress = ${setSQLStringValue(IPAddress)}
            , HostName = ${setSQLStringValue(ServerName)}
            , EntryDate = ${setSQLStringValue(EntryTime)}
            WHERE UserCatUkeyId = ${setSQLStringValue(UserCatUkeyId)};
        `

        if(flag == 'A'){
            const missingKeys = checkKeysAndRequireValues(['CategoryName', 'IsActive'], req.body);

            if(missingKeys.length > 0){
                return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required in insert0`))
            }    

            const result = await pool.request().query(insertQuery);
                
            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No User Category Created.'),})
            }
    
            return res.status(200).json({...successMessage('New User Category Created Successfully.'), ...req.body, UserCatUkeyId : UKeyId});

        }else if(flag === 'U'){
            const missingKeys = checkKeysAndRequireValues(['CategoryName', 'IsActive', 'UserCatUkeyId'], req.body);

            if(missingKeys.length > 0){
                return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required in update`))
            }
            const updateResult = await pool.request().query(updateQuery);

            if(updateResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Event Updated.')})
            }
    
            return res.status(200).json({...successMessage('New user category Updated Successfully.'), ...req.body, UserCatUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }        
    }catch(error){
        console.log('user category error :', error);
        return res.status(500).json(errorMessage(error.message));
    }
}

const removeUserCategory = async (req, res) => {
    try{
        const {UserCatUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['UserCatUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM UserCategoryMaster WHERE UserCatUkeyId = '${UserCatUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Orginizer Deleted.')})
        }

        return res.status(200).json({...successMessage('Orginizer Deleted Successfully.'), UserCatUkeyId});
    }catch(error){
        console.log('delete user category error :', error);
        return res.status(500).json(errorMessage(error.message));
    }
}

module.exports = {
    fetchUserCategory,
    createUserCategory,
    removeUserCategory,
}