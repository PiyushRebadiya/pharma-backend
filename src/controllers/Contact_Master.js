const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateUUID, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchContactMasterDetails = async (req, res)=>{
    try{
        const { ContactUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (ContactUkeyId) {
            whereConditions.push(`ContactUkeyId = '${ContactUkeyId}'`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM ContactMaster ${whereString} ORDER BY ContactId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM ContactMaster ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const AddContactMasterMaster = async (req, res)=>{
    const { Name = null, Mobile = null, Email = null, Message = null } = req.body;
    
    try{
        const ContactUkeyId = generateUUID()

        const {IPAddress, ServerName, EntryTime} = getCommonKeys();

        const insertQuery = `
            INSERT INTO ContactMaster (
                ContactUkeyId, Name, Mobile, Email, Message, IpAddress, HostName, EntryDate
            ) VALUES (
                '${ContactUkeyId}', ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(Message)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}
            );
        `

        const result = await pool.request().query(insertQuery);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Event Created.'),})
        }

        return res.status(200).json({...successMessage('New Event Created Successfully.'), ...req.body, ContactUkeyId});

    }catch(error){
        console.log('Add Event Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}


module.exports = {
    FetchContactMasterDetails,
    AddContactMasterMaster,
}