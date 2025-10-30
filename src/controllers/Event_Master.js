const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, deleteImage, setSQLDateTime, setSQLNumberValue, setSQLDecimalValue, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const { sendEmailOrganizerEventTemplatesArray } = require("./sendEmail");
const moment = require("moment");

const EventList = async (req, res) => {
    try {
        const { EventUkeyId, IsActive, OrganizerUkeyId, EventCategoryUkeyId, Search, StartEventDate, EndEventDate, CityName } = req.query;
        let whereConditions = [];

        if (EventUkeyId) {
            whereConditions.push(`em.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`em.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (CityName) {
            whereConditions.push(`am.CityName = ${setSQLStringValue(CityName)}`);
        }
        if (EventCategoryUkeyId) {
            const multipleEventCategory = EventCategoryUkeyId.split(',').map((i) => `'${i}'`).join(',');
            whereConditions.push(`em.EventCategoryUkeyId IN (${multipleEventCategory})`); 
        }
        if (IsActive) {
            whereConditions.push(`em.IsActive = ${setSQLBooleanValue(IsActive)}`); 
        }
        if (Search) {
            whereConditions.push(`em.EventName LIKE '%${Search}%'`);
        }
        if (StartEventDate) {
            whereConditions.push(`em.StartEventDate >= ${setSQLDateTime(StartEventDate)}`);
        }
        if (EndEventDate) {
            whereConditions.push(`em.EndEventDate <= ${setSQLDateTime(EndEventDate)}`);
        }
        whereConditions.push(`em.flag <> 'D'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            WITH RankedEvents AS (
                SELECT
                    em.*,
                    am.Address1,
                    am.Address2,
                    am.Pincode,
                    am.StateName,
                    am.StateCode,
                    am.CityName,
                    am.IsPrimaryAddress,
                    am.IsActive AS IsActiveAddress,
                    om.OrganizerName,
                    ecm.CategoryName AS EventCategoryName,
                    pgm.GatewayName,
                    -- Latest EventMasterPermission status
                    emp.EventStatus AS PermissionStatus,
                    (
                        SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
                        FROM DocumentUpload du
                        WHERE du.UkeyId = em.EventUkeyId
                        FOR JSON PATH
                    ) AS FileNames,
                    (
                        SELECT pgm.ShortName, pgm.GatewayName, pgm.ConvenienceFee, pgm.GST, pgm.DonationAmt, pgm.AdditionalCharges, pgm.IsActive, pgm.KeyId, pgm.SecretKey
                        FROM PaymentGatewayMaster pgm
                        WHERE em.PaymentGateway = pgm.GatewayUkeyId
                        FOR JSON PATH
                    ) AS PaymentGatewayDetails,
                    ROW_NUMBER() OVER (PARTITION BY em.EventUkeyId ORDER BY em.EntryDate DESC) AS rn
                FROM EventMaster em
                LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
                LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
                LEFT JOIN EventCategoryMaster ecm ON em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
                LEFT JOIN PaymentGatewayMaster pgm ON em.PaymentGateway = pgm.GatewayUkeyId
                OUTER APPLY (
                    SELECT TOP 1 emp.EventStatus
                    FROM EventMasterPermission emp
                    WHERE emp.EventUkeyId = em.EventUkeyId
                    ORDER BY emp.EntryDate DESC
                ) emp ${whereString}
            )
            SELECT *
            FROM RankedEvents
            WHERE rn = 1
            ORDER BY EntryDate desc            `,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM EventMaster em 
                LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
            if(event.PaymentGatewayDetails){
                event.PaymentGatewayDetails = JSON.parse(event?.PaymentGatewayDetails)
            } else {
                event.PaymentGatewayDetails = []
            }
        });
    
        return res.json(result);
    } catch (error) {
        return res.status(500).send(errorMessage(error?.message));
    }
};

const fetchEventById = async (req, res)=> {
    try{
        const {EventUkeyId, OrganizerUkeyId} = req.query

        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (EventUkeyId) {
            whereConditions.push(`em.EventUkeyId = '${EventUkeyId}'`); 
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`em.OrganizerUkeyId = '${OrganizerUkeyId}'`); 
        }
        whereConditions.push(`em.flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            WITH RankedEvents AS (
                SELECT
                    em.*,
                    am.Address1,
                    am.Address2,
                    am.Pincode,
                    am.StateName,
                    am.StateCode,
                    am.CityName,
                    am.IsPrimaryAddress,
                    am.IsActive AS IsActiveAddress,
                    om.OrganizerName,
                    ecm.CategoryName AS EventCategoryName,
                    pgm.GatewayName,
                    -- Latest EventMasterPermission status
                    emp.EventStatus AS PermissionStatus,
                    (
                        SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
                        FROM DocumentUpload du
                        WHERE du.UkeyId = em.EventUkeyId
                        FOR JSON PATH
                    ) AS FileNames,
                    (
                        SELECT pgm.ShortName, pgm.GatewayName, pgm.ConvenienceFee, pgm.GST, pgm.DonationAmt, pgm.AdditionalCharges, pgm.IsActive, pgm.KeyId, pgm.SecretKey
                        FROM PaymentGatewayMaster pgm
                        WHERE em.PaymentGateway = pgm.GatewayUkeyId
                        FOR JSON PATH
                    ) AS PaymentGatewayDetails,
                    ROW_NUMBER() OVER (PARTITION BY em.EventUkeyId ORDER BY em.EntryDate DESC) AS rn
                FROM EventMaster em
                LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
                LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
                LEFT JOIN EventCategoryMaster ecm ON em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
                LEFT JOIN PaymentGatewayMaster pgm ON em.PaymentGateway = pgm.GatewayUkeyId
                OUTER APPLY (
                    SELECT TOP 1 emp.EventStatus
                    FROM EventMasterPermission emp
                    WHERE emp.EventUkeyId = em.EventUkeyId
                    ORDER BY emp.EntryDate DESC
                ) emp ${whereString}
            )
            SELECT *
            FROM RankedEvents
            WHERE rn = 1
            ORDER BY EntryDate desc            `,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM EventMaster em 
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
            if(event.PaymentGatewayDetails){
                event.PaymentGatewayDetails = JSON.parse(event?.PaymentGatewayDetails)
            } else {
                event.PaymentGatewayDetails = []
            }
        });

        return res.json(result);

    }catch(error){
        return res.status(500).json(errorMessage(error.message))
    }
}

const EventPermissionList = async (req, res) => {
    try {
        const { EventUkeyId, IsActive, OrganizerUkeyId, EventCategoryUkeyId, Search, StartEventDate, EndEventDate } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (EventUkeyId) {
            whereConditions.push(`em.EventUkeyId = '${EventUkeyId}'`); 
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`em.OrganizerUkeyId = '${OrganizerUkeyId}'`); 
        }
        if (EventCategoryUkeyId) {
            const multipleEventCategory = EventCategoryUkeyId.split(',').map((i) => `'${i}'`).join(',');
            whereConditions.push(`em.EventCategoryUkeyId IN (${multipleEventCategory})`); 
        }
        if (IsActive) {
            whereConditions.push(`em.IsActive = ${setSQLBooleanValue(IsActive)}`); 
        }
        if (Search) {
            whereConditions.push(`em.EventName LIKE '%${Search}%'`);
        }
        if (StartEventDate) {
            whereConditions.push(`em.StartEventDate >= ${setSQLDateTime(StartEventDate)}`);
        }
        if (EndEventDate) {
            whereConditions.push(`em.EndEventDate <= ${setSQLDateTime(EndEventDate)}`);
        }
        whereConditions.push(`em.EventStatus = 'INPROGRESS'`);
        whereConditions.push(`em.flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            SELECT 
                em.*, 
                am.Address1, 
                am.Address2, 
                am.Pincode, 
                am.StateName,
                am.StateCode, 
                am.CityName, 
                am.IsPrimaryAddress, 
                am.IsActive AS IsActiveAddress, 
                om.OrganizerName, 
                ecm.CategoryName AS EventCategoryName,
                pgm.GatewayName,
                (
                    SELECT du.FileName, du.Label, du.DocUkeyId, du.EventUkeyId, du.OrganizerUkeyId, du.Category
                    FROM DocumentUpload du 
                    WHERE du.UkeyId = em.EventUkeyId
                    FOR JSON PATH
                ) AS FileNames,
                (
                    SELECT pgm.ShortName, pgm.GatewayName, pgm.ConvenienceFee, pgm.GST, pgm.DonationAmt, pgm.AdditionalCharges, pgm.IsActive, pgm.KeyId, pgm.SecretKey
                    FROM PaymentGatewayMaster pgm 
                    WHERE em.PaymentGateway = pgm.GatewayUkeyId
                    FOR JSON PATH
                ) AS PaymentGatewayDetails
            FROM EventMasterPermission em 
            OUTER APPLY (
                SELECT TOP 1 *
                FROM AddressMasterPermission am
                WHERE am.EventUkeyId = em.EventUkeyId
                ORDER BY am.EntryDate DESC
            ) am
            LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
            LEFT JOIN EventCategoryMaster ecm ON em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
            LEFT JOIN PaymentGatewayMaster pgm ON em.PaymentGateway = pgm.GatewayUkeyId
            ${whereString}
            ORDER BY em.EntryDate DESC     
            `,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM EventMasterPermission em 
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
            if(event.PaymentGatewayDetails){
                event.PaymentGatewayDetails = JSON.parse(event?.PaymentGatewayDetails)
            } else {
                event.PaymentGatewayDetails = []
            }
        });
        return res.json(result);

    } catch (error) {
        return res.status(500).send(errorMessage(error?.message));
    }
};

const fetchEvenPermissiontById = async (req, res)=> {
    try{
        const {EventUkeyId, OrganizerUkeyId} = req.query

        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (EventUkeyId) {
            whereConditions.push(`em.EventUkeyId = '${EventUkeyId}'`); 
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`em.OrganizerUkeyId = '${OrganizerUkeyId}'`); 
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getUserList = {
            getQuery: `
            SELECT TOP 1
                em.*, 
                am.Address1, 
                am.Address2, 
                am.Pincode, 
                am.StateName,
                am.StateCode, 
                am.CityName, 
                am.IsPrimaryAddress, 
                am.IsActive AS IsActiveAddress, 
                om.OrganizerName, 
                ecm.CategoryName AS EventCategoryName,
                pgm.GatewayName,
            
                -- DocumentUpload as JSON array
                (
                    SELECT du.FileName, du.Label, du.DocUkeyId, du.EventUkeyId, du.OrganizerUkeyId, du.Category
                    FROM DocumentUpload du 
                    WHERE du.UkeyId = em.EventUkeyId
                    FOR JSON PATH
                ) AS FileNames,
            
                -- PaymentGateway as JSON array
                (
                    SELECT pgm.ShortName, pgm.GatewayName, pgm.ConvenienceFee, pgm.GST, pgm.DonationAmt, pgm.AdditionalCharges, pgm.IsActive, pgm.KeyId, pgm.SecretKey
                    FROM PaymentGatewayMaster pgm 
                    WHERE em.PaymentGateway = pgm.GatewayUkeyId
                    FOR JSON PATH
                ) AS PaymentGatewayDetails
            
            FROM EventMasterPermission em
            
            -- Get latest address where flag != 'D'
            OUTER APPLY (
                SELECT TOP 1 *
                FROM AddressMasterPermission am
                WHERE am.EventUkeyId = em.EventUkeyId AND am.flag != 'D'
                ORDER BY am.EntryDate DESC
            ) am
            
            LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
            LEFT JOIN EventCategoryMaster ecm ON em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
            LEFT JOIN PaymentGatewayMaster pgm ON em.PaymentGateway = pgm.GatewayUkeyId
            
            ${whereString} 
            ORDER BY em.EntryDate DESC;
            `,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM EventMasterPermission em 
                ${whereString}
            `,
        };

        const masterquer = {
            getQuery: `
            WITH RankedEvents AS (
                SELECT
                    em.*,
                    am.Address1,
                    am.Address2,
                    am.Pincode,
                    am.StateName,
                    am.StateCode,
                    am.CityName,
                    am.IsPrimaryAddress,
                    am.IsActive AS IsActiveAddress,
                    om.OrganizerName,
                    ecm.CategoryName AS EventCategoryName,
                    pgm.GatewayName,
                    -- Latest EventMasterPermission status
                    emp.EventStatus AS PermissionStatus,
                    (
                        SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
                        FROM DocumentUpload du
                        WHERE du.UkeyId = em.EventUkeyId
                        FOR JSON PATH
                    ) AS FileNames,
                    (
                        SELECT pgm.ShortName, pgm.GatewayName, pgm.ConvenienceFee, pgm.GST, pgm.DonationAmt, pgm.AdditionalCharges, pgm.IsActive, pgm.KeyId, pgm.SecretKey
                        FROM PaymentGatewayMaster pgm
                        WHERE em.PaymentGateway = pgm.GatewayUkeyId
                        FOR JSON PATH
                    ) AS PaymentGatewayDetails,
                    ROW_NUMBER() OVER (PARTITION BY em.EventUkeyId ORDER BY em.EntryDate DESC) AS rn
                FROM EventMaster em
                LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
                LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
                LEFT JOIN EventCategoryMaster ecm ON em.EventCategoryUkeyId = ecm.EventCategoryUkeyId
                LEFT JOIN PaymentGatewayMaster pgm ON em.PaymentGateway = pgm.GatewayUkeyId
                OUTER APPLY (
                    SELECT TOP 1 emp.EventStatus
                    FROM EventMasterPermission emp
                    WHERE emp.EventUkeyId = em.EventUkeyId
                    ORDER BY emp.EntryDate DESC
                ) emp ${whereString}
            )
            SELECT *
            FROM RankedEvents
            WHERE rn = 1
            ORDER BY EntryDate desc`,
            countQuery: `
                SELECT COUNT(*) AS totalCount 
                FROM EventMaster em 
                ${whereString}
            `,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        const masterResult = await getCommonAPIResponse(req, res, masterquer);

        result.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
            if(event.PaymentGatewayDetails){
                event.PaymentGatewayDetails = JSON.parse(event?.PaymentGatewayDetails)
            } else {
                event.PaymentGatewayDetails = []
            }
        });

        masterResult.data?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
            if(event.PaymentGatewayDetails){
                event.PaymentGatewayDetails = JSON.parse(event?.PaymentGatewayDetails)
            } else {
                event.PaymentGatewayDetails = []
            }
        });

        return res.json({ NewEntry : result.data, OldEntry : masterResult.data});

    }catch(error){
        return res.status(500).json(errorMessage(error.message))
    }
}

const addEvent = async (req, res) => {
    const { flag, Event, Addresses } = req.body;
    const {
        EventUkeyId, OrganizerUkeyId, EventName, Alias, StartEventDate, EventDetails, IsActive = false, TicketLimit,
        EventCode = generateCODE(EventName), Location, PaymentGateway, Longitude, Latitude, EndEventDate, EventCategoryUkeyId, Tagline1, Tagline2, UserBookingLimit, BookingStartDate, BookingEndDate, EventStatus, SeatArrangment = false, VirtualUserName, VirtualPassword, PriceUkeyId, IFSCcode, RazAccName, AccNumber, RazPhoneNumber,LiveMode, IsWhatsApp, IsSMS, IsMail, VerificationEventCodeStatus, VerificationEventcode, ScanStartDate, ScanEndDate 
    } = Event;

    let transaction;

    try {
        if (!['A', 'U'].includes(flag)) {
            return res.status(400).json(errorMessage("Invalid flag. Use 'A' for Add or 'U' for Update."));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        // Ensure required fields exist
        const missingKeys = checkKeysAndRequireValues(
            ['EventUkeyId', 'OrganizerUkeyId', 'EventName'], { ...Event }
        );
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        const primaryAddress = Addresses.find(i => i.IsPrimaryAddress === true);

        const planInfo = await pool.request().query(`
        SELECT TOP 1 pl.PaymentUkeyId, pl.EventLimit, pl.Ticketlimits, pl.SubAdminLimit, pl.VolunteerLimit, pl.Speaker, pl.Sponsor, pl.iMessenger, pl.iMessngerlimit, pl.MetaWhatsapp, pl.MetaLimit, MIN(pl.StartDate) AS StartDate, MIN(pl.EndDate) AS EndDate, COUNT(pld.Id) AS CreatedEvent, pm.PackageTitle
        FROM PaymentLog pl
        LEFT JOIN PaymentLogDetails pld ON pld.PaymentUkeyId = pl.PaymentUkeyId and pld.flag <> 'D'
        LEFT JOIN PriceMaster pm ON pl.MasterUkeyId = pm.PriceUkeyId
        WHERE pl.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND pl.EndDate > GETDATE()
        GROUP BY pl.PaymentUkeyId, pl.EventLimit, pl.Ticketlimits, pl.SubAdminLimit, pl.VolunteerLimit, pl.Speaker, pl.Sponsor, pl.iMessenger, pl.iMessngerlimit, pl.MetaWhatsapp, pl.MetaLimit, pm.PackageTitle
        HAVING pl.EventLimit <> COUNT(pld.Id)
        ORDER BY MIN(pl.StartDate)
        `)

        if(!planInfo?.recordset.length && flag === 'A'){
            return res.status(400).send(errorMessage('No active plan available.'))
        }

        if(flag === 'A' && new Date(planInfo?.recordset?.[0]?.EndDate) <= new Date()){
            return res.status(400).send(errorMessage('Your plan is expired. Upgrade Now!'))
        }

        if(flag === 'A' && planInfo?.recordset?.[0]?.EventLimit == planInfo?.recordset?.[0]?.CreatedEvent ){
            return res.status(400).send(errorMessage(`Your event limit is finished for '${planInfo?.recordset?.[0]?.PackageTitle}' plan.`))
        }

        const PaymentLogDetailUkeyId = generateUUID();
        
        // Start SQL transaction
        transaction = pool.transaction();
        await transaction.begin();

        if(flag === 'A'){
            await transaction.request().query(`insert into PaymentLogDetails (
                PaymentLogDetailUkeyId, OrganizerUkeyId, EventUkeyId, PaymentUkeyId, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, flag
            ) values (
                ${setSQLStringValue(PaymentLogDetailUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.PaymentUkeyId)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.Ticketlimits)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.SubAdminLimit)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.VolunteerLimit)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.Speaker)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.Sponsor)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.iMessenger)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.iMessngerlimit)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.MetaWhatsapp)}, ${setSQLStringValue(planInfo?.recordset?.[0]?.MetaLimit)}, 'A'
            )`)
        }

        if (flag === 'U') {
            let query = ` update EventMasterPermission set flag = 'D' where EventUkeyId = '${EventUkeyId}';`
            query += ` update AddressMasterPermission set flag = 'D' where EventUkeyId = '${EventUkeyId}';`
            if ((flag === 'U' && EventStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && EventStatus === 'PENDING')) {
                query += `
                    DELETE FROM AddressMaster WHERE EventUkeyId = '${EventUkeyId}';
                    DELETE FROM EventMaster WHERE EventUkeyId = '${EventUkeyId}';
                `
            }
            await transaction.request().query(query);
        }

        if (
            flag === 'A' ||
            ((flag === 'U' && EventStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && EventStatus === 'PENDING'))
        ) {
            // INSERT into EventMaster
            await transaction.request().query(`
                INSERT INTO EventMaster (
                    EventUkeyId, OrganizerUkeyId, EventName, Alias, StartEventDate, EventCode, EventDetails, IsActive, IpAddress, HostName, EntryDate, flag, TicketLimit, Location, PaymentGateway, UserName, UserID, AddressUkeyId, Longitude, Latitude, EndEventDate, EventCategoryUkeyId, Tagline1, Tagline2, UserBookingLimit, BookingStartDate, BookingEndDate, EventStatus, SeatArrangment, VirtualUserName, VirtualPassword, PriceUkeyId, IFSCcode, RazAccName, AccNumber, RazPhoneNumber, IsWhatsApp, IsSMS, IsMail, VerificationEventCodeStatus, VerificationEventcode, ScanStartDate, ScanEndDate
                  ) VALUES (
                    ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventName)}, ${setSQLStringValue(Alias)}, ${setSQLDateTime(StartEventDate)}, ${setSQLStringValue(EventCode)}, ${setSQLStringValue(EventDetails)}, ${setSQLBooleanValue(IsActive)}, '${IPAddress}', '${ServerName}', '${EntryTime}', '${flag}', ${setSQLNumberValue(TicketLimit)}, ${setSQLStringValue(Location)}, ${setSQLStringValue(PaymentGateway)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}, ${setSQLStringValue(primaryAddress.AddressUkeyId)}, ${setSQLStringValue(Longitude)}, ${setSQLStringValue(Latitude)}, ${setSQLDateTime(EndEventDate)}, ${setSQLStringValue(EventCategoryUkeyId)}, ${setSQLStringValue(Tagline1)}, ${setSQLStringValue(Tagline2)}, ${setSQLNumberValue(UserBookingLimit)}, ${setSQLDateTime(BookingStartDate)}, ${setSQLDateTime(BookingEndDate)}, ${setSQLStringValue(EventStatus)}, ${setSQLBooleanValue(SeatArrangment)}, ${setSQLStringValue(VirtualUserName)}, ${setSQLStringValue(VirtualPassword)}, ${setSQLStringValue(PriceUkeyId)}, ${setSQLStringValue(IFSCcode)}, ${setSQLStringValue(RazAccName)}, ${setSQLStringValue(AccNumber)}, ${setSQLStringValue(RazPhoneNumber)}, ${setSQLBooleanValue(IsWhatsApp)}, ${setSQLBooleanValue(IsSMS)}, ${setSQLBooleanValue(IsMail)}, ${setSQLBooleanValue(VerificationEventCodeStatus)}, ${setSQLStringValue(VerificationEventcode)}, ${setSQLDateTime(ScanStartDate)}, ${setSQLDateTime(ScanEndDate)}
                );
            `);
        }
        // let addressValue2 = '';
        // if(flag === 'A' || (flag === 'U' && EventStatus !== 'PUBLISHED')){
            await transaction.request().query(`
                INSERT INTO EventMasterPermission (
                    EventUkeyId, OrganizerUkeyId, EventName, Alias, StartEventDate, EventCode, EventDetails, IsActive, IpAddress, HostName, EntryDate, flag, TicketLimit, Location, PaymentGateway, UserName, UserID, AddressUkeyId, Longitude, Latitude, EndEventDate, EventCategoryUkeyId, Tagline1, Tagline2, UserBookingLimit, BookingStartDate, BookingEndDate, EventStatus, SeatArrangment, VirtualUserName, VirtualPassword, PriceUkeyId, IFSCcode, RazAccName, AccNumber, RazPhoneNumber, IsWhatsApp, IsSMS, IsMail, VerificationEventCodeStatus, VerificationEventcode, ScanStartDate, ScanEndDate
                ) VALUES (
                    ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventName)}, ${setSQLStringValue(Alias)}, ${setSQLDateTime(StartEventDate)}, ${setSQLStringValue(EventCode)}, ${setSQLStringValue(EventDetails)}, ${setSQLBooleanValue(IsActive)}, '${IPAddress}', '${ServerName}', '${EntryTime}', '${flag}', ${setSQLNumberValue(TicketLimit)}, ${setSQLStringValue(Location)}, ${setSQLStringValue(PaymentGateway)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}, ${setSQLStringValue(primaryAddress.AddressUkeyId)}, ${setSQLStringValue(Longitude)}, ${setSQLStringValue(Latitude)}, ${setSQLDateTime(EndEventDate)}, ${setSQLStringValue(EventCategoryUkeyId)}, ${setSQLStringValue(Tagline1)}, ${setSQLStringValue(Tagline2)}, ${setSQLNumberValue(UserBookingLimit)}, ${setSQLDateTime(BookingStartDate)}, ${setSQLDateTime(BookingEndDate)}, ${setSQLStringValue(EventStatus)}, ${setSQLBooleanValue(SeatArrangment)}, ${setSQLStringValue(VirtualUserName)}, ${setSQLStringValue(VirtualPassword)}, ${setSQLStringValue(PriceUkeyId)}, ${setSQLStringValue(IFSCcode)}, ${setSQLStringValue(RazAccName)}, ${setSQLStringValue(AccNumber)}, ${setSQLStringValue(RazPhoneNumber)}, ${setSQLBooleanValue(IsWhatsApp)}, ${setSQLBooleanValue(IsSMS)}, ${setSQLBooleanValue(IsMail)}, ${setSQLBooleanValue(VerificationEventCodeStatus)}, ${setSQLStringValue(VerificationEventcode)}, ${setSQLDateTime(ScanStartDate)}, ${setSQLDateTime(ScanEndDate)}
                )
            `)
            if (Addresses && Addresses.length > 0) {
                for (const address of Addresses) {
                    if (!address || typeof address !== "object") continue; // Skip invalid entries
    
                    const {
                        AddressUkeyId, Alias, Address1, Address2, Pincode, StateCode, StateName, CityName, CountryName, IsPrimaryAddress, IsActive
                    } = address;
    
                    await transaction.request().query(`
                        INSERT INTO AddressMasterPermission (
                            AddressUkeyID, EventUkeyId, OrganizerUkeyId, Alias, Address1, Address2, Pincode, StateCode, 
                            StateName, CityName, CountryName, IsPrimaryAddress, IsActive, flag, 
                            IpAddress, HostName, EntryDate, UsrName, UsreID
                        ) VALUES (
                            ${setSQLStringValue(AddressUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Alias)}, ${setSQLStringValue(Address1)}, ${setSQLStringValue(Address2)}, ${setSQLNumberValue(Pincode)}, ${setSQLNumberValue(StateCode)}, ${setSQLStringValue(StateName)}, 
                            ${setSQLStringValue(CityName)}, ${setSQLStringValue(CountryName)}, ${setSQLBooleanValue(IsPrimaryAddress)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}
                        );
                    `);
                    // addressValue2 = [Address1, Address2, CityName, StateName, Pincode].filter(Boolean).join(', ');
                }
            }
        // }  

        let addressValue = '';
        // INSERT multiple addresses
        if(flag === 'A' || ((flag === 'U' && EventStatus === 'PUBLISHED') || (flag === 'U' && !IsActive && EventStatus === 'PENDING'))){

            if (Addresses && Addresses.length > 0) {
                for (const address of Addresses) {
                    if (!address || typeof address !== "object") continue; // Skip invalid entries
    
                    const {
                        AddressUkeyId, Alias, Address1, Address2, Pincode, StateCode, StateName, CityName, CountryName, IsPrimaryAddress, IsActive
                    } = address;
    
                    await transaction.request().query(`
                        INSERT INTO AddressMaster (
                            AddressUkeyID, EventUkeyId, OrganizerUkeyId, Alias, Address1, Address2, Pincode, StateCode, 
                            StateName, CityName, CountryName, IsPrimaryAddress, IsActive, flag, 
                            IpAddress, HostName, EntryDate, UsrName, UsreID
                        ) VALUES (
                            ${setSQLStringValue(AddressUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Alias)}, ${setSQLStringValue(Address1)}, ${setSQLStringValue(Address2)}, ${setSQLNumberValue(Pincode)}, ${setSQLNumberValue(StateCode)}, ${setSQLStringValue(StateName)}, 
                            ${setSQLStringValue(CityName)}, ${setSQLStringValue(CountryName)}, ${setSQLBooleanValue(IsPrimaryAddress)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLNumberValue(req.user.UserId)}
                        );
                    `);
                    addressValue = [Address1, Address2, CityName, StateName, Pincode].filter(Boolean).join(', ');
                }
            }
        }

        if(LiveMode){
            if(LiveMode === 'YES'){
                await transaction.request().query(`
                    update EventMaster set EventStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update TicketCategoryMaster set TicketCategoryStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SpeakerMaster set SpeakerStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorMaster set SponsoreStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorCatMaster set SpCatStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update CouponMaster set CouponStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update EventMasterPermission set EventStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update TicketCategoryMasterPermission set TicketCategoryStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SpeakerMasterPermission set SpeakerStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorMasterPermission set SponsoreStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorCatMasterPermission set SpCatStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update CouponMasterPermission set CouponStatus = ${setSQLStringValue(EventStatus)}, IsActive = 1 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                `)
            } else if (LiveMode === 'NO'){
                await transaction.request().query(`
                    update EventMaster set EventStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update TicketCategoryMaster set TicketCategoryStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SpeakerMaster set SpeakerStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorMaster set SponsoreStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorCatMaster set SpCatStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update CouponMaster set CouponStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update EventMasterPermission set EventStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update TicketCategoryMasterPermission set TicketCategoryStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SpeakerMasterPermission set SpeakerStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorMasterPermission set SponsoreStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update SponsorCatMasterPermission set SpCatStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                    update CouponMasterPermission set CouponStatus = ${setSQLStringValue(EventStatus)}, IsActive = 0 where EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                `)
            }
        }

        // Commit transaction
        await transaction.commit();
        let usersList = [];
        const organizerDetails = await pool.request().query(`
            SELECT Mobile1, Mobile2, OrganizerName FROM OrganizerMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `);
        if(organizerDetails?.recordset?.length > 0 && setSQLBooleanValue(IsActive) === 1){
            const { Mobile1 = '', Mobile2 = '', OrganizerName = '' } = organizerDetails.recordset[0];

            const userDetails = await pool.request().query(`WITH EmailRanked AS (
                SELECT 
                    [UserId],
                    [UserUkeyId],
                    [FullName],
                    [Mobile1],
                    [Email],
                    [IsActive],
                    ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM([Email])) ORDER BY [UserId]) AS rn
                FROM 
                    [GlobalMyEventZ].[dbo].[UserMaster]
                WHERE 
                    [Email] IS NOT NULL
                    AND LTRIM(RTRIM([Email])) <> '' AND IsActive = 1 AND UserUkeyId = '9CC5-AA2025-121c6a8e-17e1-4207-bc22-dd784cd17132-W'
            )
            SELECT 
                [UserId],
                [UserUkeyId],
                [FullName],
                [Mobile1],
                [Email],
                [IsActive]
            FROM 
                EmailRanked
            WHERE 
                rn = 1;
            `);

            if(userDetails?.recordset?.length > 0){
                usersList = userDetails.recordset;
            }
            setImmediate(async () => {
                const index= Math.floor(Math.random() * 5);
                for (const user of usersList) {
                    const { Email = '', FullName = '', UserUkeyId = '' } = user;
                    try {
                        const checkEmailLog = await pool.request().query(`SELECT * FROM EmailLogs WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND Category = 'EVENT_PUBLISHED'`);
                        if(checkEmailLog?.recordset?.length > 0){
                            console.log('Email already sent to this user', FullName, Email);
                        } else {
                      const responseSentMail = await sendEmailOrganizerEventTemplatesArray[index](
                            Email,
                            FullName || 'User',
                            EventName,
                            moment(StartEventDate).format("dddd, MMMM Do YYYY"),
                            moment(StartEventDate).format("h:mm A"),
                            addressValue,
                            Mobile1,
                            Mobile2,
                            OrganizerName
                        );
                        try {
                            const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
                            
                            // Check already sent email
                            const insertQuery = `INSERT INTO [EmailLogs] ([OrganizerUkeyId],[EventUkeyId],[UkeyId],[Category],[Language],[Email],[IsSent],[UserUkeyId],[IpAddress],[HostName],[EntryTime],[flag]) VALUES (${setSQLStringValue(OrganizerUkeyId)},${setSQLStringValue(EventUkeyId)},${setSQLStringValue(generateUUID())},'EVENT_PUBLISHED','ENGLISH',${setSQLStringValue(Email)},${setSQLBooleanValue(responseSentMail)},${setSQLStringValue(UserUkeyId)},${setSQLStringValue(IPAddress)},${setSQLStringValue(ServerName)},GETDATE(),'A')`
                            await pool.request().query(insertQuery);
                            console.log(`Email sent to ${Email}:`, responseSentMail);
                        } catch (error) {
                            console.error('Error inserting into EmailLogs:', error);
                        }
                    }
                    } catch (err) {
                        console.error(`Failed to send email to ${Email}:`, err);
                    }
                }
            });
        }

        CommonLogFun({
            EventUkeyId : EventUkeyId, 
            OrganizerUkeyId : OrganizerUkeyId, 
            ReferenceUkeyId : EventUkeyId, 
            MasterName : EventName,  
            TableName : "EventMaster", 
            UserId : req.user.UserId, 
            UserName : req.user.FirstName, 
            IsActive : IsActive,
            flag : flag, 
            IPAddress : IPAddress, 
            ServerName : ServerName, 
            EntryTime : EntryTime
        })

        return res.status(200).json({
            ...successMessage(flag === 'A' ? 'New Event Created Successfully.' : 'Event Updated Successfully.'),
            ...req.body,
            EventUkeyId,
            EventCode
        });

    } catch (error) {
        console.error('Event Transaction Error:', error);
        if (transaction) await transaction.rollback(); // Rollback transaction on failure
        return res.status(500).send(errorMessage(error?.message || "Internal Server Error"));
    }
};

const RemoveEvent = async (req, res) => {
    try{
        const {EventUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            update EventMaster set flag = 'D' WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            update AddressMaster set flag = 'D' WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            update PaymentLogDetails set flag = 'D' WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Event Deleted.')})
        }

        return res.status(200).json({...successMessage('New Event Deleted Successfully.'), ...req.query});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    EventList,
    EventPermissionList,
    fetchEvenPermissiontById,
    addEvent,
    RemoveEvent,
    fetchEventById
}