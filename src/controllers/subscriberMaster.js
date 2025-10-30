const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchSubscriberlist = async (req, res)=>{
    try{
        const { SubscriberUkeyId, UserUkeyId, IsSubscribe, IsEmail, EventUkeyId, OrganizerUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (SubscriberUkeyId) {
            whereConditions.push(`sm.SubscriberUkeyId = ${setSQLStringValue(SubscriberUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`sm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`sm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (UserUkeyId) {
            whereConditions.push(`sm.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if(IsSubscribe){
            whereConditions.push(`sm.IsSubscribe = ${setSQLBooleanValue(IsSubscribe)}`);
        }
        if(IsEmail){
            whereConditions.push(`sm.IsEmail = ${setSQLBooleanValue(IsEmail)}`);
        }
        whereConditions.push(`em.IsActive = 1`);
        whereConditions.push(`em.EventStatus = 'PUBLISHED'`);
        whereConditions.push(`sm.flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `
            select sm.*, um.FullName AS UserName, em.EventName, ecm.CategoryName AS EventCategoryName, om.OrganizerName ,
            (SELECT JSON_QUERY(
            (SELECT FileName, Label , DocUkeyId, EventUkeyId, OrganizerUkeyId, Category
            FROM DocumentUpload du
            WHERE UkeyId = em.EventUkeyId and du.Label = 'Logo'
            FOR JSON PATH)
            )) AS FileNames
            from SubscriberMaster sm
            left join EventMaster em on sm.EventUkeyId = em.EventUkeyId
            left join OrganizerMaster om on sm.OrganizerUkeyId = om.OrganizerUkeyId
            left join UserMaster um on sm.UserUkeyId = um.UserUkeyId 
            left join EventCategoryMaster ecm on em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
            ${whereString} ORDER BY sm.EntryDate DESC`,
            countQuery: `SELECT COUNT(Id) AS totalCount FROM SubscriberMaster sm
            left join EventMaster em on sm.EventUkeyId = em.EventUkeyId
            left join OrganizerMaster om on sm.OrganizerUkeyId = om.OrganizerUkeyId
            left join UserMaster um on sm.UserUkeyId = um.UserUkeyId 
            left join EventCategoryMaster ecm on em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
            ${whereString}`,
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

        return res.json({
            ...result,
        });
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const subscriberCount = async (req, res)=> {
    try{
        const { EventUkeyId, OrganizerUkeyId } = req.query;

        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`IsSubscribe = 1`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const result = await pool.request().query(`select Count(*) AS SubscriberCount from SubscriberMaster ${whereString}`)

        return res.json({
            ...result?.recordset?.[0],
        });
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const SubscriberMaster = async (req, res)=>{
    const { SubscriberUkeyId, EventUkeyId, OrganizerUkeyId, UserUkeyId, IsSubscribe, IsEmail, flag} = req.body;
    
    try{
        const missingKeys = checkKeysAndRequireValues(['SubscriberUkeyId', 'UserUkeyId'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required`))
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO SubscriberMaster (SubscriberUkeyId, EventUkeyId, OrganizerUkeyId, UserUkeyId, IsSubscribe, IsEmail, IpAddress, HostName, EntryDate, flag) VALUES (
            ${setSQLStringValue(SubscriberUkeyId)}, 
            ${setSQLStringValue(EventUkeyId)},
            ${setSQLStringValue(OrganizerUkeyId)},
            ${setSQLStringValue(UserUkeyId)}, 
            ${setSQLBooleanValue(IsSubscribe)}, 
            ${setSQLBooleanValue(IsEmail)},
            ${setSQLStringValue(IPAddress)},
            ${setSQLStringValue(ServerName)},
            ${setSQLStringValue(EntryTime)},
            ${setSQLStringValue(flag)}
            );
        `

        const deleteQuery = `
            DELETE FROM SubscriberMaster WHERE SubscriberUkeyId = '${SubscriberUkeyId}';
        `

        if(flag == 'A'){

            const result = await pool.request().query(insertQuery);
                
            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Subscriber Created.'),})
            }
    
            return res.status(200).json({...successMessage('New Subscriber Created Successfully.'), ...req.body, SubscriberUkeyId});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Subscriber Updated.')})
            }
    
            return res.status(200).json({...successMessage('Subscriber Updated Successfully.'), ...req.body, SubscriberUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Subscriber Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Subscriber Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveSubscriber = async (req, res) => {
    try{
        const {SubscriberUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['SubscriberUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            update SubscriberMaster set flag = 'D' WHERE SubscriberUkeyId = '${SubscriberUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Orginizer Deleted.')})
        }

        return res.status(200).json({...successMessage('Orginizer Deleted Successfully.'), SubscriberUkeyId});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchSubscriberlist,
    SubscriberMaster,
    RemoveSubscriber,
    subscriberCount,
}