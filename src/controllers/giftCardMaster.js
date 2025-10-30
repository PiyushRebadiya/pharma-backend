const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonKeys, getCommonAPIResponse, setSQLStringValue, setSQLDateTime } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchGiftCardMaster = async(req, res)=>{
    try{
        const { EventUkeyId, OrganizerUkeyId, GiftMastUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (GiftMastUkeyId) {
            whereConditions.push(`gcm.GiftMastUkeyId = ${setSQLStringValue(GiftMastUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`gcm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`gcm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`gcm.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT gcm.*, ecm.CategoryName, (SELECT JSON_QUERY(
                (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
                FROM DocumentUpload 
                WHERE UkeyId = gcm.GiftMastUkeyId 
                FOR JSON PATH)
            )) AS FileNames FROM GiftCardMaster gcm 
            left join EventCategoryMaster ecm on ecm.EventCategoryUkeyId = gcm.CategoryUkeyId
            ${whereString} ORDER BY gcm.EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM GiftCardMaster gcm ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        
        if(result?.data?.length > 0){
            result?.data?.forEach(event => {
                if(event.FileNames){
                    event.FileNames = JSON.parse(event?.FileNames)
                } else {
                    event.FileNames = []
                }
            });
        }

        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const GiftCardMaster = async(req, res)=>{
    const { GiftMastUkeyId, OrganizerUkeyId, GiftCardTitle, Alias, Message, StartDate, EndDate, flag = '', CategoryUkeyId, IsActive} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['GiftMastUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const insertQuery = `
            INSERT INTO GiftCardMaster (
                GiftMastUkeyId, OrganizerUkeyId, GiftCardTitle, Alias, Message, StartDate, EndDate, UserID, UserName, IpAddress, HostName, EntryDate, flag, CategoryUkeyId, IsActive
            ) VALUES (
                ${setSQLStringValue(GiftMastUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(GiftCardTitle)}, ${setSQLStringValue(Alias)}, ${setSQLStringValue(Message)}, ${setSQLDateTime(StartDate)}, ${setSQLDateTime(EndDate)}, ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(CategoryUkeyId)}, ${setSQLBooleanValue(IsActive)}
            );
        `
        const deleteQuery = `
            DELETE FROM GiftCardMaster WHERE GiftMastUkeyId = ${setSQLStringValue(GiftMastUkeyId)}
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not created Organizer terms and condtion'),})
            }

            return res.status(200).json({...successMessage('Successfully created Gift Card.'), ...req.body});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not updated Gift Card successfully.')})
            }

            return res.status(200).json({...successMessage('Successfully updated Gift Card..'), ...req.body});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Event Contect Setting Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Event Contect Setting Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveGiftCard = async(req, res)=>{
    try{
        const {GiftMastUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['GiftMastUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM GiftCardMaster WHERE GiftMastUkeyId = ${setSQLStringValue(GiftMastUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not deleted Gift Card successfully.')})
        }

        return res.status(200).json({...successMessage('Successfully deleted Gift Card.'), ...req.query});
    }catch(error){
        console.log('Delete Event Contect Setting Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchGiftCardMaster,
    GiftCardMaster,
    RemoveGiftCard
}