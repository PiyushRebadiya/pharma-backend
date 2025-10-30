const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue, setSQLDecimalValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const fs = require('fs');

const FetchTicketCategory = async(req, res)=>{
    try{
        const { TicketCateUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, IsUser, TicketCategoryStatus, TicketPrice, IsSplitCat } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TicketCateUkeyId) {
            whereConditions.push(`tcm.TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`tcm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`tcm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (TicketCategoryStatus) {
            whereConditions.push(`tcm.TicketCategoryStatus = ${setSQLStringValue(TicketCategoryStatus)}`);
        }
        if(IsActive){
            whereConditions.push(`tcm.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if(IsUser){
            whereConditions.push(`tcm.IsUser = ${setSQLBooleanValue(IsUser)}`);
        }
        if(IsSplitCat){
            whereConditions.push(`tcm.IsSplitCat = ${setSQLBooleanValue(IsSplitCat)}`);
        }
        if(TicketPrice){
            whereConditions.push(`tcm.TicketPrice = ${setSQLDecimalValue(TicketPrice)}`);
        }
        whereConditions.push(`tcm.flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT tcm.*, tcmp.TicketCategoryStatus AS PermissionStatus FROM TicketCategoryMaster tcm 
            left join TicketCategoryMasterPermission tcmp on tcm.TicketCateUkeyId = tcmp.TicketCateUkeyId and tcmp.flag <> 'D'
            ${whereString} ORDER BY tcm.EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM TicketCategoryMaster tcm 
            left join TicketCategoryMasterPermission tcmp on tcm.TicketCateUkeyId = tcmp.TicketCateUkeyId and tcmp.flag <> 'D'
            ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const FetchTicketCategoryPermissionById = async(req, res)=>{
    try{
        const { TicketCateUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, IsUser, TicketCategoryStatus } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TicketCateUkeyId) {
            whereConditions.push(`TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (TicketCategoryStatus) {
            whereConditions.push(`TicketCategoryStatus = ${setSQLStringValue(TicketCategoryStatus)}`);
        }
        if(IsActive){
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if(IsUser){
            whereConditions.push(`IsUser = ${setSQLBooleanValue(IsUser)}`);
        }
        whereConditions.push(`flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const result = await pool.request().query(`SELECT * FROM TicketCategoryMaster ${whereString} ORDER BY EntryDate DESC`);
        const resultpermission = await pool.request().query(`SELECT * FROM TicketCategoryMasterPermission ${whereString} ORDER BY EntryDate DESC`);

        return res.json({NewEntry : resultpermission.recordset, OldEntry : result.recordset});
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const FetchTicketCategoryPermission = async(req, res)=>{
    try{
        const { TicketCateUkeyId, OrganizerUkeyId, EventUkeyId, IsActive, IsUser, TicketCategoryStatus } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (TicketCateUkeyId) {
            whereConditions.push(`TCMP.TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`TCMP.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`TCMP.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (TicketCategoryStatus) {
            whereConditions.push(`TCMP.TicketCategoryStatus = ${setSQLStringValue(TicketCategoryStatus)}`);
        }
        if(IsActive){
            whereConditions.push(`TCMP.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if(IsUser){
            whereConditions.push(`TCMP.IsUser = ${setSQLBooleanValue(IsUser)}`);
        }
        whereConditions.push(`TCMP.flag <> 'D'`);
        whereConditions.push(`TCMP.TicketCategoryStatus = 'INPROGRESS'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT TCMP.*, EM.EventName, OM.OrganizerName FROM TicketCategoryMasterPermission TCMP 
            left join EventMaster EM on EM.EventUkeyId = TCMP.EventUkeyId
            left join OrganizerMaster OM on OM.OrganizerUkeyId = TCMP.OrganizerUkeyId
            ${whereString} ORDER BY TCMP.EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM TicketCategoryMasterPermission TCMP ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const TicketCategoryMaster = async(req, res)=>{
    const { TicketCateUkeyId, TicketLimits, Category, TicketPrice, IsActive = true, OrganizerUkeyId, EventUkeyId, DiscPer, DiscAmt, flag, ConvenienceFee, IsUser, PaidLimit, UnPaidLimit, TicketCategoryStatus, Colour, IsAmtMyEventCharge, MyEventzCharge, IsSplitCat} = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    let transaction;
    try{
        const missingKeys = checkKeysAndRequireValues(['TicketCateUkeyId', 'TicketLimits', 'Category', 'TicketPrice', 'IsActive', 'OrganizerUkeyId', 'EventUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        
        // Exclude the current category in case of update
        const EventCategoryLimits = await pool.request().query(`
            SELECT SUM(TicketLimits) AS TotalLimits 
            FROM TicketCategoryMaster 
            WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            and flag <> 'D' And IsActive = 1
            ${flag === 'U' ? `AND TicketCateUkeyId != ${setSQLStringValue(TicketCateUkeyId)}` : ''}
        `);

        const EventLimits = await pool.request().query(`
            SELECT TicketLimit FROM EventMaster WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} and flag <> 'D' And IsActive = 1 AND EventStatus = 'PUBLISHED'
        `);
        
        const totalExistingLimits = EventCategoryLimits.recordset?.[0]?.TotalLimits || 0;
        const eventSeatLimit = EventLimits.recordset?.[0]?.TicketLimit || 0;

        if ((Number(totalExistingLimits) + Number(TicketLimits)) > eventSeatLimit) {
            return res.status(400).json(errorMessage(
                `Event limit exceeded! Max: ${eventSeatLimit}, Assigned: ${totalExistingLimits}.`
            ));
        }
        
        transaction = pool.transaction();
        await transaction.begin();
    
        if (flag === 'U') {
            let updateFlagQuery = `
                UPDATE TicketCategoryMasterPermission SET flag = 'D' WHERE TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)};
            `;
            if ((flag === 'U' && TicketCategoryStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && TicketCategoryStatus === 'PENDING')) {
                updateFlagQuery += `
                    DELETE FROM TicketCategoryMaster WHERE TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)};
                `;
            }
            await transaction.request().query(updateFlagQuery);
        }
    
        if (
            flag === 'A' ||
            ((flag === 'U' && TicketCategoryStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && TicketCategoryStatus === 'PENDING'))
        ) {
            const insertQuery = `
                INSERT INTO TicketCategoryMaster (
                    TicketCateUkeyId, TicketLimits, Category, TicketPrice, IsActive, OrganizerUkeyId, EventUkeyId, flag, IpAddress, HostName, EntryDate, DiscPer, DiscAmt, ConvenienceFee, IsUser, PaidLimit, UnPaidLimit, TicketCategoryStatus, Colour, MyEventzCharge, IsAmtMyEventCharge, IsSplitCat
                ) VALUES (
                    ${setSQLStringValue(TicketCateUkeyId)}, ${setSQLStringValue(TicketLimits)}, ${setSQLStringValue(Category)}, ${setSQLStringValue(TicketPrice)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(DiscPer)}, ${setSQLStringValue(DiscAmt)}, ${setSQLDecimalValue(ConvenienceFee)}, ${setSQLBooleanValue(IsUser)}, ${setSQLNumberValue(PaidLimit)}, ${setSQLNumberValue(UnPaidLimit)}, ${setSQLStringValue(TicketCategoryStatus)}, ${setSQLStringValue(Colour)}, ${setSQLDecimalValue(toFloat(MyEventzCharge))}, ${setSQLBooleanValue(IsAmtMyEventCharge)}, ${setSQLBooleanValue(IsSplitCat)}
                );
            `;

            let jsonCanVasFile = true;

            const getEventDetailsQuery = `SELECT * FROM EventMaster WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
            const eventDetails = await pool.request().query(getEventDetailsQuery);
            if (eventDetails.recordset.length > 0 && eventDetails.recordset[0].SeatArrangment == true && jsonCanVasFile) {
                const { OrganizerUkeyId, EventUkeyId } = eventDetails.recordset[0];
                const findJsonFileQuery = `
                        SELECT JsonFile 
                        FROM CanvasSeatingFile 
                        WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
                        AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    `;

                const findJsonFileResult = await pool.query(findJsonFileQuery);
                if (findJsonFileResult.recordset.length === 0) {
                    console.log("Canvas seating file not found");
                    jsonCanVasFile = false;
                }

                if (jsonCanVasFile) {
                    const jsonFile = findJsonFileResult.recordset[0].JsonFile;
                    const jsonFilePath = `./media/CanvasSeating/${jsonFile}`;
                    if (!fs.existsSync(jsonFilePath)) {
                        console.log("JSON file does not exist");
                        jsonCanVasFile = false;
                    }

                    if (jsonCanVasFile) {
                        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

                        const findCategory = jsonData.theater.categories.find((seat) => seat.name === Category);
                        if (!findCategory) {
                            console.log("Category not found in JSON file");
                            jsonData.theater.categories.push({
                                "id": TicketCateUkeyId,
                                "name": Category,
                                "price": Number(TicketPrice),
                                "color": Colour,
                                "description": "Add New Category",
                                "DiscPer": Number(DiscPer)
                            })
                            fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
                            jsonCanVasFile = false;
                        }

                        if (jsonCanVasFile) {
                            jsonData.theater.seats = jsonData.theater.seats.map((item) => {
                                if (item.category == Category && item.status != 'booked') {
                                    return {
                                        ...item,
                                        "category": Category,
                                        "price": Number(TicketPrice),
                                        "Disc": Number(TicketPrice) * (Number(DiscPer) / 100),
                                    }
                                }
                                return item;
                            });
                            jsonData.theater.categories = jsonData.theater.categories.map((seat) => {
                                if (seat.name === Category) {
                                    return {
                                        ...seat,
                                        "name": Category,
                                        "price": Number(TicketPrice),
                                        "color": Colour,
                                        "DiscPer": Number(DiscPer)
                                    }
                                }
                                return seat;
                            });

                            fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
                        }
                    }
                }
            }

            await transaction.request().query(insertQuery);
        }
    
    
        await transaction.request().query(`
            INSERT INTO TicketCategoryMasterPermission (
                TicketCateUkeyId, TicketLimits, Category, TicketPrice, IsActive, OrganizerUkeyId, EventUkeyId, flag, IpAddress, HostName, EntryDate, DiscPer, DiscAmt, ConvenienceFee, IsUser, PaidLimit, UnPaidLimit, TicketCategoryStatus, Colour, MyEventzCharge, IsAmtMyEventCharge, IsSplitCat
            ) VALUES (
                ${setSQLStringValue(TicketCateUkeyId)}, ${setSQLStringValue(TicketLimits)}, ${setSQLStringValue(Category)}, ${setSQLStringValue(TicketPrice)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(DiscPer)}, ${setSQLStringValue(DiscAmt)}, ${setSQLDecimalValue(ConvenienceFee)}, ${setSQLBooleanValue(IsUser)}, ${setSQLNumberValue(PaidLimit)}, ${setSQLNumberValue(UnPaidLimit)}, ${setSQLStringValue(TicketCategoryStatus)}, ${setSQLStringValue(Colour)}, ${setSQLDecimalValue(MyEventzCharge)}, ${setSQLBooleanValue(IsAmtMyEventCharge)}, ${setSQLBooleanValue(IsSplitCat)}
            );
        `);
    
        await transaction.commit();
    
        return res.status(200).json(
          successMessage(flag === 'A' ? 'Ticket category added successfully.' : 'Ticket category updated successfully.')
        );
    }catch(error){
        if (transaction) await transaction.rollback();
        console.error(`${flag === 'A' ? 'Add' : 'Update'} Ticket Category Error:`, error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveTicketCategory = async(req, res)=>{
    try{
        const {TicketCateUkeyId, EventUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['TicketCateUkeyId', 'EventUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        const CountOfBookedTicketOnCategory = await pool.request().query(`select COUNT(*) AS BookedTickets from Bookingdetails where TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)} AND flag <> 'D'`);

        if(CountOfBookedTicketOnCategory?.recordset?.[0]?.BookedTickets > 0){
            return res.status(200).json(errorMessage('Ticket category cannot be deleted as tickets have already been booked under this category.'))
        }

        const query = `
            update TicketCategoryMaster set flag = 'D' WHERE TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)} and EventUkeyId = ${setSQLStringValue(EventUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Ticket Category Deleted.')})
        }

        const getEventDetailsQuery = `SELECT * FROM EventMaster WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
        const eventDetails = await pool.request().query(getEventDetailsQuery);
        if(eventDetails.recordset.length > 0 && eventDetails.recordset[0].SeatArrangment == true){
            const { OrganizerUkeyId, EventUkeyId } = eventDetails.recordset[0];
            const findJsonFileQuery = `
                        SELECT JsonFile 
                        FROM CanvasSeatingFile 
                        WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
                        AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    `;
            
                    const findJsonFileResult = await pool.query(findJsonFileQuery);
                    if (findJsonFileResult.recordset.length === 0) {
                        console.log("Canvas seating file not found");
                    }
            
                    const jsonFile = findJsonFileResult.recordset[0].JsonFile;
                    console.log('JSON File:', jsonFile);
                    const jsonFilePath = `./media/CanvasSeating/${jsonFile}`;
                    if (!fs.existsSync(jsonFilePath)) {
                        console.log("JSON file does not exist");
                    }
            
                    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

                    const getTicketCategoryQuery = `
                        SELECT * FROM TicketCategoryMaster 
                        WHERE TicketCateUkeyId = ${setSQLStringValue(TicketCateUkeyId)}`;
                    console.log('Get Ticket Category Query:', getTicketCategoryQuery);
                    const ticketCategoryResult = await pool.request().query(getTicketCategoryQuery);
                    if (ticketCategoryResult.recordset.length === 0) {
                        console.log("Ticket category not found");
                    }

                    const { Category } = ticketCategoryResult.recordset[0];

                    jsonData.theater.seats = jsonData.theater.seats.filter((seat) => seat.category !== Category);
                    jsonData.theater.categories = jsonData.theater.categories.filter((seat) => seat.name !== Category);
            
                    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
        }

        return res.status(200).json({...successMessage('Ticket Category Deleted Successfully.'), ...req.query});
    }catch(error){
        console.log('Delete Ticket Category Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    FetchTicketCategory,
    TicketCategoryMaster,
    RemoveTicketCategory,
    FetchTicketCategoryPermission,
    FetchTicketCategoryPermissionById
}