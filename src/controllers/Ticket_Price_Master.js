const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const TicketPriceMasterList = async (req, res) => {
    try {
        const { PriceUkeyId, IsRazorpay } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (PriceUkeyId) {
            whereConditions.push(`PriceUkeyId = '${PriceUkeyId}'`); // Specify alias 'em' for EventMaster
        }
        if (IsRazorpay) {
            whereConditions.push(`IsRazorpay = ${setSQLBooleanValue(IsRazorpay)}`); // Specify alias 'em' for EventMaster
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
                SELECT 
                    *
                FROM 
                    TicketPriceMaster 
                ${whereString} 
                ORDER BY PriceId DESC
            `,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM TicketPriceMaster 
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    } catch (error) {
        return res.status(500).send(errorMessage(error?.message));
    }
};

const addTicketPriceMaster = async (req, res) => {
    const {
        PriceUkeyId = generateUUID(), Category = '', TicketPrice = null, IsRazorpay = false, flag = '', IsIOS = false
    } = req.body;

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();

        // SQL Queries
        const insertQuery = `
            INSERT INTO TicketPriceMaster (
                PriceUkeyId, Category, TicketPrice, IsRazorpay, IpAddress, HostName, EntryDate, flag, IsIOS
            ) VALUES (
                '${PriceUkeyId}', '${Category}', ${toFloat(TicketPrice)}, ${setSQLBooleanValue(IsRazorpay)}, '${IPAddress}', '${ServerName}', '${EntryTime}', '${flag}', ${setSQLBooleanValue(IsIOS)}
            );
        `;

        const deleteQuery = `
            DELETE FROM TicketPriceMaster WHERE PriceUkeyId = '${PriceUkeyId}';
        `;

        // Handle Add or Update
        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                return res.status(400).json({ ...errorMessage('No Row Inserted in Ticket Price Master.') });
            }

            return res.status(200).json({ ...successMessage('Data Inserted Successfully.'), ...req.body, PriceUkeyId });
        } else if (flag === 'U') {
            // Begin Transaction
            const transaction = pool.transaction();
            await transaction.begin();

            try {
                // DELETE existing records
                const deleteResult = await transaction.request().query(deleteQuery);

                // INSERT new records
                const insertResult = await transaction.request().query(insertQuery);

                // Ensure both operations succeed
                if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                    await transaction.rollback();
                    return res.status(400).json({ ...errorMessage('No Row Updated in Ticket Price Master.') });
                }

                // Commit Transaction
                await transaction.commit();
                return res.status(200).json({ ...successMessage('Data Updated Successfully.'), ...req.body, PriceUkeyId });
            } catch (error) {
                await transaction.rollback();
                throw error; // Re-throw for outer catch
            }
        } else {
            return res.status(400).json({ ...errorMessage("Use 'A' flag to Add and 'U' flag to update. It is compulsory to send the flag.") });
        }
    } catch (error) {
        if (flag === 'A') {
            console.log('Add Ticket Price Master Error:', error);
        }
        if (flag === 'U') {
            console.log('Update Ticket Price Master Error:', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveTicketPriceMaster = async (req, res) => {
    try{
        const {PriceUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['PriceUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM TicketPriceMaster WHERE PriceUkeyId = '${PriceUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Ticket Price Master Deleted.')})
        }

        return res.status(200).json({...successMessage('Ticket Price Deleted Successfully.')});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    TicketPriceMasterList,
    addTicketPriceMaster,
    RemoveTicketPriceMaster,
}