const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchEventContectSetting = async(req, res)=>{
    try{
        const { EventContectSetUkeyId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (EventContectSetUkeyId) {
            whereConditions.push(`EventContectSetUkeyId = ${setSQLStringValue(EventContectSetUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM EventContactSetting ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM EventContactSetting ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json({...result.data[0]});

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const EventContectSetting = async(req, res)=>{
    const { EventContectSetUkeyId, EventUkeyId, OrganizerUkeyId, Mobile1, Mobile2, Description, ContactPerson1, ContactPerson2, Email, flag = ''} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['EventContectSetUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const insertQuery = `
            INSERT INTO EventContactSetting (
                EventContectSetUkeyId, EventUkeyId, OrganizerUkeyId, Mobile1, Mobile2, Description, Email, ContactPerson1, ContactPerson2, UserName, UserID, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                ${setSQLStringValue(EventContectSetUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Mobile2)}, ${setSQLStringValue(Description)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(ContactPerson1)}, ${setSQLStringValue(ContactPerson2)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            );
        `
        const deleteQuery = `
            DELETE FROM EventContactSetting WHERE EventContectSetUkeyId = ${setSQLStringValue(EventContectSetUkeyId)}
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Event Contect Setting Created.'),})
            }

            return res.status(200).json({...successMessage('New Event Contect Setting Created Successfully.'), ...req.body});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Event Contect Setting Updated.')})
            }

            return res.status(200).json({...successMessage('New Event Contect Setting Updated Successfully.'), ...req.body});
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

const RemoveEventContectSetting = async(req, res)=>{
    try{
        const {EventContectSetUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['EventContectSetUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
        update EventContactSetting set flag = 'D' WHERE EventContectSetUkeyId = ${setSQLStringValue(EventContectSetUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Event Contect Setting Deleted.')})
        }

        return res.status(200).json({...successMessage('Event Contect Setting Deleted Successfully.'), ...req.query});
    }catch(error){
        console.log('Delete Event Contect Setting Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchEventContectSetting,
    EventContectSetting,
    RemoveEventContectSetting
}