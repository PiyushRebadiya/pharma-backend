const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchDisclaimer = async(req, res)=>{
    try{
        const { EventUkeyId, OrganizerUkeyId, DisclaimerUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (DisclaimerUkeyId) {
            whereConditions.push(`DisclaimerUkeyId = ${setSQLStringValue(DisclaimerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM DisclaimerMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM DisclaimerMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const Disclaimer = async(req, res)=>{
    const { EventUkeyId, OrganizerUkeyId, DisclaimerUkeyId, Remarks1, Remarks2, Remarks3, Remarks4, Remarks5, Remarks6, IsActive, flag = ''} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['DisclaimerUkeyId', 'OrganizerUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const insertQuery = `
            INSERT INTO DisclaimerMaster (
                EventUkeyId, OrganizerUkeyId, DisclaimerUkeyId, Remarks1, Remarks2, Remarks3, Remarks4, Remarks5, Remarks6, IsActive, UserName, UserID, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(DisclaimerUkeyId)}, ${setSQLStringValue(Remarks1)}, ${setSQLStringValue(Remarks2)}, ${setSQLStringValue(Remarks3)}, ${setSQLStringValue(Remarks4)}, ${setSQLStringValue(Remarks5)}, ${setSQLStringValue(Remarks6)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            );
        `
        const deleteQuery = `
            DELETE FROM DisclaimerMaster WHERE DisclaimerUkeyId = ${setSQLStringValue(DisclaimerUkeyId)}
        `
        const IsActiveQuery = `UPDATE DisclaimerMaster
                    SET IsActive = CASE 
                        WHEN DisclaimerUkeyId = ${setSQLStringValue(DisclaimerUkeyId)} THEN 1
                        ELSE 0
                    END
                    WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);
            if(setSQLBooleanValue(IsActive)){
                try {
                    await pool.request().query(IsActiveQuery);
                } catch (error) {
                    console.log('Error updating IsActive status:', error);
                }
            }

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not created Organizer terms and condtion'),})
            }

            return res.status(200).json({...successMessage('Successfully created Disclaimer.'), ...req.body});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not updated Disclaimer successfully.')})
            }

            if(setSQLBooleanValue(IsActive)){
                try {
                    await pool.request().query(IsActiveQuery);
                } catch (error) {
                    console.log('Error updating IsActive status:', error);
                }
            }

            return res.status(200).json({...successMessage('Successfully updated Disclaimer..'), ...req.body});
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

const RemoveDisclaimer = async(req, res)=>{
    try{
        const {DisclaimerUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['DisclaimerUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM DisclaimerMaster WHERE DisclaimerUkeyId = ${setSQLStringValue(DisclaimerUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not deleted Disclaimer successfully.')})
        }

        return res.status(200).json({...successMessage('Successfully deleted Disclaimer.'), ...req.query});
    }catch(error){
        console.log('Delete Event Contect Setting Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchDisclaimer,
    Disclaimer,
    RemoveDisclaimer
}