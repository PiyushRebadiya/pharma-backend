const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchTicketLimitMasterDetails = async (req, res)=>{
    try{
        const { TicketLimitUkeyId, IsActive, EventUkeyId, OrganizerUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TicketLimitUkeyId) {
            whereConditions.push(`TicketLimitUkeyId = '${TicketLimitUkeyId}'`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = '${EventUkeyId}'`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM TicketLimitMaster ${whereString} ORDER BY Id DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM TicketLimitMaster ${whereString}`,
        };

        const categoruwiseTickwetbookingQuery = `
            SELECT MemberType,GateNo, COUNT(*) AS DataCount
            FROM TicketMaster where EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY MemberType, GateNo;
        `
        const categoruwiseTickwetbookingResult = await pool.request().query(categoruwiseTickwetbookingQuery);

        const result = await getCommonAPIResponse(req, res, getUserList);

        return res.json({
            ...result,
            CategoryWiseTicketBooking : categoruwiseTickwetbookingResult.recordset
        });

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const TicketLimitMaster = async (req, res)=>{
    const { TicketLimitUkeyId = generateUUID(), Limits = null, Category = null, IsActive = true, flag = null, TicketBookingLimit = null, GateNo = '', OrganizerUkeyId = '', EventUkeyId = ''} = req.body;
    
    try{
        const missingKeys = checkKeysAndRequireValues(['Limits', 'Category', 'IsActive'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required`))
        }

        const insertQuery = `
            INSERT INTO TicketLimitMaster (TicketLimitUkeyId, Limits, Category, IsActive, TicketBookingLimit, GateNo, OrganizerUkeyId, EventUkeyId) VALUES (
            ${setSQLStringValue(TicketLimitUkeyId)}, 
            ${setSQLNumberValue(Limits)}, 
            ${setSQLStringValue(Category)}, 
            ${setSQLBooleanValue(IsActive)},
            ${setSQLNumberValue(TicketBookingLimit)},
            ${setSQLStringValue(GateNo)},
            ${setSQLStringValue(OrganizerUkeyId)},
            ${setSQLStringValue(EventUkeyId)}
            );
        `

        const deleteQuery = `
            DELETE FROM TicketLimitMaster WHERE TicketLimitUkeyId = '${TicketLimitUkeyId}';
        `

        if(flag == 'A'){

            const result = await pool.request().query(insertQuery);
                
            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Event Created.'),})
            }
    
            return res.status(200).json({...successMessage('New Event Created Successfully.'), ...req.body, TicketLimitUkeyId});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Event Updated.')})
            }
    
            return res.status(200).json({...successMessage('New Event Updated Successfully.'), ...req.body, TicketLimitUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Event Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Event Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveTicketLimit = async (req, res) => {
    try{
        const {TicketLimitUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['TicketLimitUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM TicketLimitMaster WHERE TicketLimitUkeyId = '${TicketLimitUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Orginizer Deleted.')})
        }

        return res.status(200).json({...successMessage('Orginizer Deleted Successfully.'), TicketLimitUkeyId});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    FetchTicketLimitMasterDetails,
    TicketLimitMaster,
    RemoveTicketLimit,
}