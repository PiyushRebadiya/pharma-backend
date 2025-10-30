const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchprofessionCategoryMaster = async (req, res)=>{
    try{
        const { PCUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (PCUkeyId) {
            whereConditions.push(`PCUkeyId = '${PCUkeyId}'`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM professionCategory ${whereString} ORDER BY ProfessionCategoryId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM professionCategory ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const professionCategoryMaster = async (req, res) => {
    const {  PCUkeyId = generateUUID(), Name = '', IsActive = true, flag = ''} = req.body;

    try{
        const insertQuery = `
            INSERT INTO professionCategory (
                PCUkeyId, Name, IsActive
            ) VALUES (
                '${PCUkeyId}', '${Name}', ${setSQLBooleanValue(IsActive)}
            );
        `
        const deleteQuery = `
            DELETE FROM professionCategory WHERE PCUkeyId = '${PCUkeyId}';
        `
        if(flag == 'A'){
            const missingKeys = checkKeysAndRequireValues(['Name'], req.body);

            if(missingKeys.length > 0){
                return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
            }
        
            const result = await pool.request().query(insertQuery);
                
            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Profession Category Created.'),})
            }
    
            return res.status(200).json({...successMessage('New Profession Category Created Successfully.'), ...req.body, PCUkeyId});

        }else if(flag === 'U'){
            const missingKeys = checkKeysAndRequireValues(['Name', 'PCUkeyId'], req.body);

            if(missingKeys.length > 0){
                return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
            }    

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Profession Category Updated.')})
            }
    
            return res.status(200).json({...successMessage('New Profession Category Updated Successfully.'), ...req.body, PCUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Profession Category Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Profession Category Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveprofessionCategory = async (req, res) => {
    try{
        const {PCUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['PCUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM professionCategory WHERE PCUkeyId = '${PCUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Profession Category Deleted.')})
        }

        return res.status(200).json({...successMessage('Profession Category Deleted Successfully.'), PCUkeyId});
    }catch(error){
        console.log('Delete Profession Category Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
};

module.exports = {
    FetchprofessionCategoryMaster,
    professionCategoryMaster,
    RemoveprofessionCategory,
}