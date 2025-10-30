const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchFeedbackMasterDetails = async (req, res)=>{
    try{
        const { FeedbackUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (FeedbackUkeyId) {
            whereConditions.push(`FeedbackUkeyId = '${FeedbackUkeyId}'`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM FeedbackMaster ${whereString} ORDER BY FeedbackId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM FeedbackMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const FeedbackMaster = async (req, res) => {
    const {  FeedbackUkeyId = generateUUID(), Name = null, Mobile = null, Message = null, flag = null} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const insertQuery = `
            INSERT INTO FeedbackMaster (
                FeedbackUkeyId, Name, Message, Mobile, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                '${FeedbackUkeyId}', ${setSQLStringValue(Name)}, ${setSQLStringValue(Message)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            );
        `
        const deleteQuery = `
            DELETE FROM FeedbackMaster WHERE FeedbackUkeyId = '${FeedbackUkeyId}';
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Feedback Created.'),})
            }

            return res.status(200).json({...successMessage('New Feedback Created Successfully.'), ...req.body, FeedbackUkeyId});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Feedback Updated.')})
            }

            return res.status(200).json({...successMessage('New Feedback Updated Successfully.'), ...req.body, FeedbackUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Feedback Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Feedback Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveFeedbackMaster = async (req, res) => {
    try{
        const {FeedbackUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['FeedbackUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM FeedbackMaster WHERE FeedbackUkeyId = '${FeedbackUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Feedback Deleted.')})
        }

        return res.status(200).json({...successMessage('Feedback Deleted Successfully.'), FeedbackUkeyId});
    }catch(error){
        console.log('Delete Feedback Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
};

module.exports = {
    FetchFeedbackMasterDetails,
    FeedbackMaster,
    RemoveFeedbackMaster,
}