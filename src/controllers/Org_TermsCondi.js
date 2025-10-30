const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchOrgTermCond = async(req, res)=>{
    try{
        const { EventUkeyId, OrganizerUkeyId, TermsUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TermsUkeyId) {
            whereConditions.push(`TermsUkeyId = ${setSQLStringValue(TermsUkeyId)}`);
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
        whereConditions.push(`flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM Org_TermsCondi ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM Org_TermsCondi ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const OrgTermCond = async(req, res)=>{
    const { EventUkeyId, OrganizerUkeyId, TermsUkeyId, Remarks1, Remarks2, Remarks3, Remarks4, Remarks5, Remarks6, IsActive, flag = '', Remarks7, Remarks8, Remarks9, Remarks10, Remarks11, Remarks12, Remarks13, Remarks14, Remarks15, Remarks16, Remarks17} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['TermsUkeyId', 'OrganizerUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const insertQuery = `
            INSERT INTO Org_TermsCondi (
                EventUkeyId, OrganizerUkeyId, TermsUkeyId, Remarks1, Remarks2, Remarks3, Remarks4, Remarks5, Remarks6, IsActive, UserName, UserID, IpAddress, HostName, EntryDate, flag, Remarks7, Remarks8, Remarks9, Remarks10, Remarks11, Remarks12, Remarks13, Remarks14, Remarks15, Remarks16, Remarks17
            ) VALUES (
                ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(TermsUkeyId)}, ${setSQLStringValue(Remarks1)}, ${setSQLStringValue(Remarks2)}, ${setSQLStringValue(Remarks3)}, ${setSQLStringValue(Remarks4)}, ${setSQLStringValue(Remarks5)}, ${setSQLStringValue(Remarks6)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(Remarks7)}, ${setSQLStringValue(Remarks8)}, ${setSQLStringValue(Remarks9)}, ${setSQLStringValue(Remarks10)}, ${setSQLStringValue(Remarks11)}, ${setSQLStringValue(Remarks12)}, ${setSQLStringValue(Remarks13)}, ${setSQLStringValue(Remarks14)}, ${setSQLStringValue(Remarks15)}, ${setSQLStringValue(Remarks16)}, ${setSQLStringValue(Remarks17)}
            );
        `
        const deleteQuery = `
            DELETE FROM Org_TermsCondi WHERE TermsUkeyId = ${setSQLStringValue(TermsUkeyId)}
        `
        const IsActiveQuery = `UPDATE Org_TermsCondi
                    SET IsActive = CASE 
                        WHEN TermsUkeyId = ${setSQLStringValue(TermsUkeyId)} THEN 1
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
                    console.log('Error in setting IsActive for Organizer Terms and Conditions:', error);
                }
            }

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not created Organizer terms and condtion'),})
            }

            return res.status(200).json({...successMessage('Successfully created organizer terms and conditions.'), ...req.body});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not updated organizer terms and conditions successfully.')})
            }

            if(setSQLBooleanValue(IsActive)){
                try {
                    await pool.request().query(IsActiveQuery);
                } catch (error) {
                    console.log('Error in setting IsActive for Organizer Terms and Conditions:', error);
                }
            }

            return res.status(200).json({...successMessage('Successfully updated organizer terms and conditions..'), ...req.body});
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

const RemoveOrgTermCond = async(req, res)=>{
    try{
        const {TermsUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['TermsUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            update Org_TermsCondi set flag = 'D' WHERE TermsUkeyId = ${setSQLStringValue(TermsUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not deleted organizer terms and conditions successfully.')})
        }

        return res.status(200).json({...successMessage('Successfully deleted organizer terms and conditions.'), ...req.query});
    }catch(error){
        console.log('Delete Event Contect Setting Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchOrgTermCond,
    OrgTermCond,
    RemoveOrgTermCond
}