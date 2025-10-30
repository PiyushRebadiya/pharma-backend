const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, setSQLStringValue, setSQLNumberValue, setSQLDateTime, deleteImage, getCommonAPIResponse, CommonLogFun, setSQLDecimalValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const { sendOrganizerRegisterMail } = require("./sendEmail");
// const fs = require('fs');
const path = require('path');
const fs = require('fs-extra'); // <--- use fs-extra

//#region fetch Orginizer
const fetchOrganizer = async (req, res) => {
    try{
        const { UserUkeyId, EventUkeyId, OrganizerUkeyId } = req.query;
        const whereConditions = [];

        if (UserUkeyId) {
            whereConditions.push(`OM.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if(EventUkeyId){
            whereConditions.push(`OM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if(OrganizerUkeyId){
            whereConditions.push(`OM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`OM.flag = 'D'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM OrgUserMaster AS OM ${whereString} ORDER BY UserId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM OrgUserMaster OM ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        return res.status(500).json({ ...errorMessage(error.message)});
    }
}
//#endregion
//#region verify mobile 
const VerifyOrganizerMobileNumber = async (req, res) => {
    try{
        const {Mobile1} = req.query

        if(!Mobile1){
            return res.status(200).json(errorMessage('Mobile1 is required'))
        }

        const result = await pool.request().query(`select om.*,em.EventName from OrgUserMaster om left join EventMaster em on em.EventUkeyId = om.EventUkeyId
        where om.Mobile1 = ${setSQLStringValue(Mobile1)} and om.IsActive = 1 and om.Role = 'Admin' and om.flag <> 'D'`)

        if(!result.recordset[0]){
            return res.status(200).json({...successMessage("there is no user register found with the given mobile number."), verify : false })
        }
        return res.status(200).json({...successMessage("given mobile number is valid"), verify : true, token : generateJWTT({
            Role: result?.recordset[0]?.Role
            , OrganizerUKeyId : result?.recordset[0]?.OrganizerUkeyId
            , EventUkeyId : result?.recordset[0]?.EventUkeyId
            , UserId : result?.recordset[0]?.UserId
            , FirstName : result?.recordset[0]?.FirstName
        }),
        UserId: result?.recordset[0]?.UserId,
        UserUkeyId: result?.recordset[0]?.UserUkeyId,
        EventUkeyId: result?.recordset[0]?.EventUkeyId,
        OrganizerUkeyId: result?.recordset[0]?.OrganizerUkeyId,
        OrganizerName: result?.recordset[0]?.FirstName,
        Mobile1: result?.recordset[0]?.Mobile1,
        Role: result?.recordset[0]?.Role,
        IsActive: result?.recordset[0]?.IsActive,
        EventName : result?.recordset?.[0]?.EventName
})
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}
//#endregion
//#region Signup API

const AddOrginizer = async (req, res) => {
    try{
        const { OrganizerUkeyId, OrganizerName, Mobile1, Mobile2, Email, AliasName, Description, Add1, City, StateCode, StateName, Password, AppleUserId } = req.body;

        const missingKeys = checkKeysAndRequireValues(['OrganizerName', 'Mobile1', 'Add1', 'Password', 'Email', 'OrganizerUkeyId'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const EventUkeyId = generateUUID()
        const UserUkeyId = generateUUID()
        const AddressUkeyID = generateUUID()
        const PaymentUkeyId = generateUUID()
        const PaymentLogDetailUkeyId = generateUUID()

        const checkplan = await pool.request().query(`select * from PriceMaster where PackageTitle='Demo'`)

        const checkMobile = await pool.request().query(`select 1 from OrguserMaster where Role = 'Admin' AND flag <> 'D' AND (Mobile1 = ${setSQLStringValue(Mobile1)} or Email = ${setSQLStringValue(Email)})`)

        if(checkMobile.recordset.length > 0){
            return res.status(400).json({...errorMessage('An account with this mobile Or Email Id number already registered.'), ErrorCode  : 2627})
        }

        const EventCode = generateCODE(OrganizerName);
        
        const {IPAddress, ServerName, EntryTime} = getCommonKeys(req); 

        const InsertOrgUsrMst = `  
            INSERT INTO OrganizerMaster ( 
                OrganizerUkeyId, OrganizerName, Mobile1, Mobile2, Email, AliasName, Description, Add1, City, StateCode, StateName, IsActive, IpAddress, HostName, EntryDate, flag, UserName, StartDate, EndDate
            ) OUTPUT INSERTED.*  VALUES (
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(OrganizerName)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Mobile2)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(AliasName)}, ${setSQLStringValue(Description)}, ${setSQLStringValue(Add1)}, ${setSQLStringValue(City)}, ${setSQLStringValue(StateCode)}, ${setSQLStringValue(StateName)}, 1, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 'A', ${setSQLStringValue(OrganizerName)}, GETDATE(), DATEADD(DAY, ${checkplan?.recordset?.[0]?.PackageTitle === 'STARTER' ? 15 : 365}, GETDATE()) 
            );    
        `;

        const resultOrgUsrMst = await pool.request().query(InsertOrgUsrMst)

        const InsertOrgUserMst = `
            INSERT INTO OrguserMaster ( 
                UserUkeyId, EventUKeyId, OrganizerUkeyId, Password, IsActive, IpAddress, HostName, EntryDate, FirstName, Mobile1, Mobile2, StateCode, StateName, CityName, Role, flag, Add1, Email, AppleUserId
            ) OUTPUT INSERTED.* VALUES (
                ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Password)}  , 1, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(OrganizerName)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Mobile2)}, ${setSQLNumberValue(StateCode)}, ${setSQLStringValue(StateName)}, ${setSQLStringValue(City)}, 'Admin', 'A', ${setSQLStringValue(Add1)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(AppleUserId)}
            );
        `;

        const resultOrgUserMst = await pool.request().query(InsertOrgUserMst);

        const InsertAddress = `  
            INSERT INTO AddressMaster ( 
                AddressUkeyID, OrganizerUkeyId, EventUkeyId, Alias, Address1, CityName, StateCode, StateName, IsActive, IpAddress, HostName, EntryDate, flag, CountryName, IsPrimaryAddress, UsreID, UsrName
            ) OUTPUT INSERTED.*  VALUES (
                ${setSQLStringValue(AddressUkeyID)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(AliasName)}, ${setSQLStringValue(Add1)}, ${setSQLStringValue(City)}, ${setSQLStringValue(StateCode)}, ${setSQLStringValue(StateName)}, 1, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 'A', 'INDIA', 1, ${setSQLNumberValue(resultOrgUserMst.recordset[0].UserId)}, ${setSQLStringValue(OrganizerName)}
            );    
            INSERT INTO AddressMasterPermission ( 
                AddressUkeyID, OrganizerUkeyId, EventUkeyId, Alias, Address1, CityName, StateCode, StateName, IsActive, IpAddress, HostName, EntryDate, flag, CountryName, IsPrimaryAddress, UsreID, UsrName
            ) OUTPUT INSERTED.*  VALUES (
                ${setSQLStringValue(AddressUkeyID)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(AliasName)}, ${setSQLStringValue(Add1)}, ${setSQLStringValue(City)}, ${setSQLStringValue(StateCode)}, ${setSQLStringValue(StateName)}, 1, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 'A', 'INDIA', 1, ${setSQLNumberValue(resultOrgUserMst.recordset[0].UserId)}, ${setSQLStringValue(OrganizerName)}
            );    
        `;
    
        const resulAddress = await pool.request().query(InsertAddress)
                
        const InsertEvent = `
        INSERT INTO EventMaster ( 
            EventUKeyId, OrganizerUkeyId, EventName, EventCode, IsActive, IpAddress, HostName, EntryDate, StartEventDate, EndEventDate, UserID, AddressUkeyID, flag, TicketLimit, EventCategoryUkeyId, UserName, IsDefault, EventStatus
        ) OUTPUT INSERTED.* VALUES (
            ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(OrganizerName)}, ${setSQLStringValue(EventCode)}, 0, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, GETDATE(), GETDATE(), ${resultOrgUserMst.recordset[0].UserId}, ${setSQLStringValue(AddressUkeyID)}, 'A', 0, 'fwroturhtreugherg', ${setSQLStringValue(OrganizerName)}, 1, 'INPROGRESS'
        );
        INSERT INTO EventMasterPermission ( 
            EventUKeyId, OrganizerUkeyId, EventName, EventCode, IsActive, IpAddress, HostName, EntryDate, StartEventDate, EndEventDate, UserID, AddressUkeyID, flag, TicketLimit, EventCategoryUkeyId, UserName, IsDefault, EventStatus
        ) OUTPUT INSERTED.* VALUES (
            ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(OrganizerName)}, ${setSQLStringValue(EventCode)}, 0, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, GETDATE(), GETDATE(), ${resultOrgUserMst.recordset[0].UserId}, ${setSQLStringValue(AddressUkeyID)}, 'A', 0, 'fwroturhtreugherg', ${setSQLStringValue(OrganizerName)}, 1, 'INPROGRESS'
        );
        `;
    
        const resultEvent = await pool.request().query(InsertEvent);

        const PaymentQuery = `insert into PaymentLog (
            PaymentUkeyId, OrganizerUkeyId, EventUkeyId, MasterUkeyId, Type, TotalNetAmt, RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, IsPayment, flag, IpAddress, HostName, EntryDate, StartDate, EndDate, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, EventLimit
        ) values (
            ${setSQLStringValue(PaymentUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(checkplan?.recordset?.[0]?.PriceUkeyId)}, 'PRGPLAN', 0, '', '', '', 0, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)}, GETDATE(), DATEADD(DAY, ${checkplan?.recordset?.[0]?.PackageTitle === 'Demo' ? 15 : 365}, GETDATE()), ${setSQLNumberValue(checkplan?.recordset?.[0]?.Ticketlimits)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.SubAdminLimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.VolunteerLimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.Speaker)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.Sponsor)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.iMessenger)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.iMessngerlimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.MetaWhatsapp)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.MetaLimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.EventLimit)}
        )
        
        insert into PaymentLogDetails (
            PaymentLogDetailUkeyId, OrganizerUkeyId, EventUkeyId, PaymentUkeyId, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, flag
        ) values (
            ${setSQLStringValue(PaymentLogDetailUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(PaymentUkeyId)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.Ticketlimits)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.SubAdminLimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.VolunteerLimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.Speaker)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.Sponsor)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.iMessenger)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.iMessngerlimit)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.MetaWhatsapp)}, ${setSQLNumberValue(checkplan?.recordset?.[0]?.MetaLimit)}, 'A'
        )
        `

        const PaymentResult = await pool.request().query(PaymentQuery)

        if(resultOrgUsrMst.rowsAffected[0] === 0 && resultEvent.rowsAffected[0] === 0 && resultOrgUserMst.rowsAffected[0] === 0 && resulAddress.rowsAffected[0] === 0 && PaymentResult.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('User Not Registerd Successfully.')})
        }

        CommonLogFun({
            OrganizerUkeyId : OrganizerUkeyId, 
            ReferenceUkeyId : OrganizerUkeyId, 
            MasterName : OrganizerName,  
            TableName : "OrganizerMaster", 
            UserId : resultOrgUserMst.recordset?.[0]?.UserId, 
            UserName :OrganizerName, 
            IsActive : true,
            flag : 'A', 
            IPAddress : IPAddress, 
            ServerName : ServerName, 
            EntryTime : EntryTime
        })
        CommonLogFun({
            OrganizerUkeyId : OrganizerUkeyId, 
            ReferenceUkeyId : OrganizerUkeyId, 
            MasterName : OrganizerName,  
            TableName : "OrguUerMaster", 
            MasterName : OrganizerName,
            UserId : resultOrgUserMst.recordset?.[0]?.UserId, 
            UserName :OrganizerName, 
            IsActive : true,
            flag : 'A', 
            IPAddress : IPAddress, 
            ServerName : ServerName, 
            EntryTime : EntryTime
        })
        CommonLogFun({
            OrganizerUkeyId : OrganizerUkeyId, 
            ReferenceUkeyId : OrganizerUkeyId, 
            MasterName : OrganizerName,  
            TableName : "EventMaster", 
            MasterName : 'Default Event',
            UserId : resultOrgUserMst.recordset?.[0]?.UserId, 
            UserName :OrganizerName, 
            IsActive : true,
            flag : 'A', 
            IPAddress : IPAddress, 
            ServerName : ServerName, 
            EntryTime : EntryTime
        })

        sendOrganizerRegisterMail({query: {
            Email : Email, OrganizerName : OrganizerName
        }}, {})

        return res.status(200).json({
            ...successMessage('User Registerd Successfully.'), 
            token : generateJWTT({
                OrganizerUkeyId
                , EventUkeyId
                , Role : 'Admin'
                , UserId : resultOrgUserMst.recordset[0].UserId
                , FirstName : OrganizerName
            }),
            ...req.body,
            EventUkeyId,
            UserUkeyId,
            Role : 'Admin',
            EventName : OrganizerName
        })
    }catch(error){
        console.log('Add User Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

//#endregion

//#region Organizer Plan List
const OrganizerPlanList = async (req, res)=> {
    try{
        const {OrganizerUkeyId} = req.query;

        const result = await pool.request().query(`EXEC OrganizerPlanList ${OrganizerUkeyId ? ` @OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`: ''}`)

        return res.status(200).json({data : result.recordset})
    }catch(error){
        return res.status(500).json(errorMessage(error.message))
    }
}
//#endregion

//#region login API

const Loginorganizer = async (req, res) => {
    try{
        const {Mobile1, Password, UserUkeyId, Email, AppleUserId, EventUkeyId, Role} = req.body;

        // const missingKeys = checkKeysAndRequireValues(['Mobile1'], req.body);

        // if(missingKeys.length > 0){
        //     return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`))
        // }

        if(!Email && !Mobile1 && !AppleUserId){
            return res.status(400).json(errorMessage(`Email or Mobile numbner or AppleUserId is required`))
        }

        let whereCondition = ''

        // const {IPAddress, ServerName, EntryTime} = getCommonKeys(req); 

        // Build dynamic SQL query
        // let query = `
        // SELECT  em.EventName, pm.PackageTitle, pm.OriginalPrice, pm.DiscountPrice, pm.EventLimit, pm.Ticketlimits, pm.SubAdminLimit, pm.VolunteerLimit, pm.Speaker, pm.Sponsor, pm.iMessenger, pm.iMessngerlimit, pm.MetaWhatsapp, pm.MetaLimit, om.StartDate AS PlanStartDate, om.EndDate AS PlanEndDate, om.PriceUkeyId, oum.UserUkeyId, em.OrganizerUkeyId, oum.FirstName, oum.Mobile1, em.EventUkeyId, oum.Role
        // FROM OrgUserMaster oum
        // LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = oum.OrganizerUkeyId
        // LEFT JOIN PriceMaster pm ON pm.PriceUkeyId = om.PriceUkeyId
		//  LEFT JOIN EventMaster em ON em.OrganizerUkeyId = om.OrganizerUkeyId
        // WHERE oum.IsActive = 1 and om.flag <> 'D'
        // `;
        let query = `
            SELECT 
            em.EventName, 
            pm.PackageTitle, 
            pm.OriginalPrice, 
            pm.DiscountPrice, 
            pm.EventLimit, 
            pm.Ticketlimits, 
            pm.SubAdminLimit, 
            pm.VolunteerLimit, 
            pm.Speaker, 
            pm.Sponsor, 
            pm.iMessenger, 
            pm.iMessngerlimit, 
            pm.MetaWhatsapp, 
            pm.MetaLimit, 
            om.StartDate AS PlanStartDate, 
            om.EndDate AS PlanEndDate, 
            om.PriceUkeyId, 
            oum.UserUkeyId, 
            oum.OrganizerUkeyId, 
            oum.FirstName, 
            oum.Mobile1, 
            oum.Password,
            oum.Email,
            em.EventUkeyId, 
            oum.Role 
        FROM OrgUserMaster oum
        LEFT JOIN EventMaster em 
            ON em.OrganizerUkeyId = oum.OrganizerUkeyId
        LEFT JOIN OrganizerMaster om 
            ON om.OrganizerUkeyId = em.OrganizerUkeyId
        LEFT JOIN PriceMaster pm 
            ON pm.PriceUkeyId = om.PriceUkeyId
        WHERE 
            oum.IsActive = 1 
            AND oum.flag <> 'D' 
            AND (em.flag IS NULL OR em.flag <> 'D') `;

        // Add EventUkeyId condition if provided
        if (UserUkeyId) {
            whereCondition += ` AND oum.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`;
        }
        if (Password) {
            whereCondition += ` AND oum.Password = ${setSQLStringValue(Password)}`;
        }
        if (Mobile1) {
            whereCondition += ` AND oum.Mobile1 = ${setSQLStringValue(Mobile1)}`;
        }
        if (Role) {
            whereCondition += ` AND oum.Role = ${setSQLStringValue(Role)}`;
        }
        if (Email) {
            whereCondition += ` AND oum.Email = ${setSQLStringValue(Email)}`;
        }
        if (AppleUserId) {
            whereCondition += ` AND oum.AppleUserId = ${setSQLStringValue(AppleUserId)}`;
        }
        if (EventUkeyId) {
            whereCondition += ` AND em.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
        }
        query += whereCondition
        // let query2 = `WITH OrgInfo AS (
        //     SELECT
        //         oum.UserUkeyId,
        //         oum.OrganizerUkeyId,
        //         oum.FirstName,
        //         oum.Email,
        //         om.StartDate ,
        //         om.EndDate ,
        //         om.OrganizerName,
        //         pm.PackageTitle,
        //         pm.OriginalPrice,
        //         pm.DiscountPrice,
        //         pm.EventLimit,
        //         pm.Ticketlimits,
        //         pm.SubAdminLimit,
        //         pm.VolunteerLimit,
        //         pm.Speaker,
        //         pm.Sponsor,
        //         pm.iMessenger,
        //         pm.iMessngerlimit,
        //         pm.MetaWhatsapp,
        //         pm.MetaLimit
        //     FROM OrgUserMaster oum
        //     LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = oum.OrganizerUkeyId
        //     LEFT JOIN PriceMaster pm ON pm.PriceUkeyId = om.PriceUkeyId
        //     WHERE oum.IsActive = 1
        //         AND om.flag <> 'D'
        //         ${whereCondition}
        //         )
        //         SELECT
        //             em.EventId,
        //             em.EventUkeyId,
        //             em.EventName,
        //             em.StartEventDate,
        //             em.EndEventDate,
        //             em.EventCode,
        //             em.EventStatus,
        //             em.BookingStartDate,
        //             em.BookingEndDate,
        //             em.IsActive,
        //             em.flag,
        //             em.Location,
        //             oi.*,
        //             am.Address1, am.Address2, am.Pincode, am.StateName,am.StateCode, am.CityName, am.IsPrimaryAddress, am.IsActive AS IsActiveAddress, 
        //         (
        //             SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
        //             FROM DocumentUpload du 
        //             WHERE du.UkeyId = em.EventUkeyId
        //             FOR JSON PATH
        //         ) AS FileNames
        //         FROM EventMaster em
        //         JOIN OrgInfo oi ON em.OrganizerUkeyId = oi.OrganizerUkeyId
        //           LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
        //         WHERE em.flag <> 'D'`
        //             console.log(query2);
        const result = await pool.request().query(query);
        // const eventListResult = await pool.request().query(query2 );

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Invalid credentials'), IsVerified : false});
        }

        // const Organizers = await pool.request().query(`
        //     select om.* from OrganizerMaster om 
        //     left join OrgUserMaster oum on om.OrganizerUkeyId = oum.OrganizerUkeyId
        // `)

        // eventListResult.recordset?.forEach(event => {
        //     if(event.FileNames){
        //         event.FileNames = JSON.parse(event?.FileNames)
        //     } else {
        //         event.FileNames = []
        //     }
        // });

        return res.status(200).json({
            ...successMessage('User Verified Successfully.'), IsVerified : true, token : generateJWTT({
                Role: result?.recordset[0]?.Role
                , OrganizerUKeyId : result?.recordset[0]?.OrganizerUkeyId
                , EventUkeyId : result?.recordset[0]?.EventUkeyId
                , UserId : result?.recordset[0]?.UserId
                , FirstName : result?.recordset[0]?.FirstName
            }),
            UserId: result?.recordset[0]?.UserId,
            UserUkeyId: result?.recordset[0]?.UserUkeyId,
            EventUkeyId: result?.recordset[0]?.EventUkeyId,
            OrganizerUkeyId: result?.recordset[0]?.OrganizerUkeyId,
            OrganizerName: result?.recordset[0]?.FirstName,
            Mobile1: result?.recordset[0]?.Mobile1,
            Email: result?.recordset[0]?.Email,
            Role: result?.recordset[0]?.Role,
            IsActive: result?.recordset[0]?.IsActive,
            Image: result?.recordset[0]?.Image,
            EventName : result?.recordset?.[0]?.EventName,
            PackageTitle : result?.recordset?.[0]?.PackageTitle,
            OriginalPrice : result?.recordset?.[0]?.OriginalPrice,
            DiscountPrice : result?.recordset?.[0]?.DiscountPrice,
            EventLimit : result?.recordset?.[0]?.EventLimit,
            Ticketlimits : result?.recordset?.[0]?.Ticketlimits,
            SubAdminLimit : result?.recordset?.[0]?.SubAdminLimit,
            VolunteerLimit : result?.recordset?.[0]?.VolunteerLimit,
            Speaker : result?.recordset?.[0]?.Speaker,
            Sponsor : result?.recordset?.[0]?.Sponsor,
            iMessenger : result?.recordset?.[0]?.iMessenger,
            iMessngerlimit : result?.recordset?.[0]?.iMessngerlimit,
            MetaWhatsapp : result?.recordset?.[0]?.MetaWhatsapp,
            MetaLimit : result?.recordset?.[0]?.MetaLimit,
            PlanStartDate : result?.recordset?.[0]?.PlanStartDate,
            PlanEndDate : result?.recordset?.[0]?.PlanEndDate,
            PriceUkeyId : result?.recordset?.[0]?.PriceUkeyId,
            Password: result?.recordset?.[0]?.Password 
            ? Buffer.from(result?.recordset?.[0]?.Password, "utf-8").toString("base64") : ""
            // EventList : eventListResult?.recordset
    });
    }catch(error){
        console.log('Login User Error :', error.message);
        return res.status(500).json({...errorMessage(error)})
    }
}

//#endregion

//#region 
const loginWithMobileAndRole = async (req, res) => {
    try{
        const {Mobile1, Role, Email, AppleUserId, Password} = req.body;

        if(!Mobile1 && !Email && !AppleUserId){
            return res.status(400).json(errorMessage(`Mobile1 or !Email or !AppleUserId is required`))
        }

        let whereCondition = ''

        whereCondition += ` WHERE oum.flag <> 'D'`;

        if (Email) {
            whereCondition += ` AND oum.Email = ${setSQLStringValue(Email)}`;
        }
        if (AppleUserId) {
            whereCondition += ` AND oum.AppleUserId = ${setSQLStringValue(AppleUserId)}`;
        }
        if (Mobile1) {
            whereCondition += ` AND oum.Mobile1 = ${setSQLStringValue(Mobile1)}`;
        }
        if (Role) {
            whereCondition += ` AND oum.Role = ${setSQLStringValue(Role)}`;
        }
        if (Password) {
            whereCondition += ` AND oum.Password = ${setSQLStringValue(Password)}`;
        }

        let query = `WITH OrgInfo AS (
            SELECT
                oum.UserUkeyId,
                oum.OrganizerUkeyId,
                oum.EventUkeyId,
                oum.FirstName,
                oum.Email,
                oum.Role,
                oum.isactive as OrgIsactive,
                om.StartDate,
                om.EndDate,
                om.OrganizerName,
                pm.PackageTitle,
                pm.OriginalPrice,
                pm.DiscountPrice,
                pm.EventLimit,
                pm.Ticketlimits,
                pm.SubAdminLimit,
                pm.VolunteerLimit,
                pm.Speaker,
                pm.Sponsor,
                pm.iMessenger,
                pm.iMessngerlimit,
                pm.MetaWhatsapp,
                pm.MetaLimit
            FROM OrgUserMaster oum
            LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = oum.OrganizerUkeyId
            LEFT JOIN PriceMaster pm ON pm.PriceUkeyId = om.PriceUkeyId
            ${whereCondition}
        )
        
        SELECT
            em.EventUkeyId AS RealEventUkeyId,
            em.EventId,
            em.EventName,
            em.StartEventDate,
            em.EndEventDate,
            em.EventCode,
            em.EventStatus,
            em.BookingStartDate,
            em.BookingEndDate,
            em.IsActive,
            em.flag,
            em.Location,
            oi.*,
            am.Address1,
            am.Address2,
            am.Pincode,
            am.StateName,
            am.StateCode,
            am.CityName,
            am.IsPrimaryAddress,
            am.IsActive AS IsActiveAddress,
            (
                SELECT 
                    du.FileName, 
                    du.Label, 
                    du.docukeyid, 
                    du.EventUkeyId, 
                    du.OrganizerUkeyId, 
                    du.Category
                FROM DocumentUpload du 
                WHERE du.UkeyId = em.EventUkeyId
                FOR JSON PATH
            ) AS FileNames
        FROM EventMaster em
        JOIN OrgInfo oi 
            ON (
                (oi.Role = 'Admin' AND em.OrganizerUkeyId = oi.OrganizerUkeyId)
                OR
                (oi.Role <> 'Admin' AND em.EventUkeyId = oi.EventUkeyId)
            )
        LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
        WHERE em.flag <> 'D'`
        // let query = `WITH OrgInfo AS (
        //     SELECT
        //         oum.UserUkeyId,
        //         oum.OrganizerUkeyId,
        //         oum.FirstName,
        //         oum.Email,
        //         om.StartDate ,
        //         om.EndDate ,
        //         om.OrganizerName,
        //         pm.PackageTitle,
        //         pm.OriginalPrice,
        //         pm.DiscountPrice,
        //         pm.EventLimit,
        //         pm.Ticketlimits,
        //         pm.SubAdminLimit,
        //         pm.VolunteerLimit,
        //         pm.Speaker,
        //         pm.Sponsor,
        //         pm.iMessenger,
        //         pm.iMessngerlimit,
        //         pm.MetaWhatsapp,
        //         pm.MetaLimit
        //     FROM OrgUserMaster oum
        //     LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = oum.OrganizerUkeyId
        //     LEFT JOIN PriceMaster pm ON pm.PriceUkeyId = om.PriceUkeyId
        //     WHERE oum.IsActive = 1
        //         AND om.flag <> 'D'
        //         ${whereCondition}
        //         )
        //         SELECT
        //             em.EventId,
        //             em.EventUkeyId,
        //             em.EventName,
        //             em.StartEventDate,
        //             em.EndEventDate,
        //             em.EventCode,
        //             em.EventStatus,
        //             em.BookingStartDate,
        //             em.BookingEndDate,
        //             em.IsActive,
        //             em.flag,
        //             em.Location,
        //             oi.*,
        //             am.Address1, am.Address2, am.Pincode, am.StateName,am.StateCode, am.CityName, am.IsPrimaryAddress, am.IsActive AS IsActiveAddress, 
        //         (
        //             SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
        //             FROM DocumentUpload du 
        //             WHERE du.UkeyId = em.EventUkeyId
        //             FOR JSON PATH
        //         ) AS FileNames
        //         FROM EventMaster em
        //         JOIN OrgInfo oi ON em.OrganizerUkeyId = oi.OrganizerUkeyId
        //           LEFT JOIN AddressMaster am ON am.EventUkeyId = em.EventUkeyId
        //         WHERE em.flag <> 'D'`
    
        const result = await pool.request().query(query);

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Invalid crediantials'), IsVerified : false});
        }

        result.recordset?.forEach(event => {
            if(event.FileNames){
                event.FileNames = JSON.parse(event?.FileNames)
            } else {
                event.FileNames = []
            }
        });

        return res.status(200).json({
            ...successMessage('User Verified Successfully.'), IsVerified : true, token : generateJWTT({
                Role: result?.recordset[0]?.Role
                , OrganizerUKeyId : result?.recordset[0]?.OrganizerUkeyId
                , EventUkeyId : result?.recordset[0]?.EventUkeyId
                , UserId : result?.recordset[0]?.UserId
                , FirstName : result?.recordset[0]?.FirstName
            }),
            Mobile1,
            Role,
            userData : [...result?.recordset]
    });
    }catch(error){
        console.log('Login User Error :', error);
        return res.status(500).json({...errorMessage(error)})
    }
}
//#endregion

//#region Login with Email Id
const Loginorganizerwithemail = async (req, res) => {
    try{
        const {Email, AppleUserId} = req.body;

        // const missingKeys = checkKeysAndRequireValues(['Email'], req.body);

        // if(missingKeys.length > 0){
        //     return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`))
        // }
        let conditionOfAppleUserId = AppleUserId ? `OR om.AppleUserId = ${setSQLStringValue(AppleUserId)}` : ''


        const result = await pool.request().query(`

        select om.*,em.EventName from OrgUserMaster om left join EventMaster em on em.EventUkeyId=om.EventUkeyId
        where (om.Email = ${setSQLStringValue(Email)} ${conditionOfAppleUserId}) AND om.IsActive = 1 and om.flag <> 'D' 
        `);

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Invelit credentials'), IsVerified : false});
        }
        return res.status(200).json({
            ...successMessage('User Verified Successfully.'), IsVerified : true, token : generateJWTT({
                Role: result?.recordset[0]?.Role
                , OrganizerUKeyId : result?.recordset[0]?.OrganizerUkeyId
                , EventUkeyId : result?.recordset[0]?.EventUkeyId
                , UserId : result?.recordset[0]?.UserId
                , FirstName : result?.recordset[0]?.FirstName
            }),
            UserId: result?.recordset[0]?.UserId,
            UserUkeyId: result?.recordset[0]?.UserUkeyId,
            EventUkeyId: result?.recordset[0]?.EventUkeyId,
            OrganizerUkeyId: result?.recordset[0]?.OrganizerUkeyId,
            OrganizerName: result?.recordset[0]?.FirstName,
            Mobile1: result?.recordset[0]?.Mobile1,
            Role: result?.recordset[0]?.Role,
            IsActive: result?.recordset[0]?.IsActive,
            Image: result?.recordset[0]?.Image,
            EventName : result?.recordset?.[0]?.EventName
    });
    }catch(error){
        console.log('Login User Error :', error);
        return res.status(500).json({...errorMessage(error)})
    }
}
//#endregion
//#region update orginizer
const updateOrginizer = async (req, res) => {
    try {
        const { UserUkeyId, EventUkeyId, OrganizerUkeyId, FirstName, Mobile1, Mobile2, Add1, Add2, StateCode, StateName, CityName, Pincode, DOB, Email, Gender, Role, IsActive, Password, PriceUkeyId } = req.body;

        let Image = req?.files?.Image?.length ? req.files.Image[0].filename : '';

        const missingKeys = checkKeysAndRequireValues(
            ['UserUkeyId', 'EventUkeyId', 'OrganizerUkeyId', 'FirstName', 'Image', 'Mobile1', 'Mobile2', 'Add1', 'StateCode', 'StateName', 'CityName', 'Pincode', 'DOB', 'Email', 'Gender', 'Role', 'IsActive'], 
            {...req.body, ...req.files}
        );

        if (missingKeys.length > 0) {
            if (req.files?.Image?.length) {
                deleteImage(req.files.Image[0].path);
            }
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const oldImgResult = await pool.request().query(`
            SELECT Image FROM OrgUserMaster WHERE UserUkeyId = '${UserUkeyId}'
        `);
        const oldImg = oldImgResult.recordset?.[0]?.Image;

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const updateQuery = `
        UPDATE OrgUserMaster 
        SET 
            EventUkeyId = ${setSQLStringValue(EventUkeyId)},
            OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)},
            Password = ${setSQLStringValue(Password)},
            FirstName = ${setSQLStringValue(FirstName)},
            Image = ${setSQLStringValue(Image)},
            Mobile1 = ${setSQLStringValue(Mobile1)},
            Mobile2 = ${setSQLStringValue(Mobile2)},
            Add1 = ${setSQLStringValue(Add1)},
            Add2 = ${setSQLStringValue(Add2)},
            StateCode = ${setSQLStringValue(StateCode)},
            StateName = ${setSQLStringValue(StateName)},
            CityName = ${setSQLStringValue(CityName)},
            Pincode = ${setSQLStringValue(Pincode)},
            DOB = ${setSQLDateTime(DOB)},
            Email = ${setSQLStringValue(Email)},
            Gender = ${setSQLStringValue(Gender)},
            Role = ${setSQLStringValue(Role)},
            IsActive = ${setSQLBooleanValue(IsActive)},
            IpAddress = ${setSQLStringValue(IPAddress)},
            HostName = ${setSQLStringValue(ServerName)},
            EntryDate = ${setSQLStringValue(EntryTime)},
            flag = 'U',
            PriceUkeyId = ${setSQLStringValue(PriceUkeyId)}
        WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)};
        `;

        const result = await pool.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            if (req.files?.Image?.length) {
                deleteImage(req.files.Image[0].path);
            }
            return res.status(400).json({ ...errorMessage('Invalid Mobile Number Or Password'), IsVerified: false });
        }


        if (oldImg && req.files?.Image?.length) {
            deleteImage('./media/Organizer/' + oldImg);
        }

        return res.status(200).json({ ...successMessage('User updated successfully') });
    } catch (error) {
        if (req.files?.Image?.length) {
            deleteImage(req.files.Image[0].path);
        }
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};
//#endregion

//#region forgent password
const ForgetPasswordForOrganizer = async (req, res) => {
    try{
        const {Mobile1, Password} = req.body
        
        const missingKeys = checkKeysAndRequireValues(['Mobile1', 'Password'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`))
        }

        const result = await pool.request().query(`update OrgUserMaster set Password = ${setSQLStringValue(Password)} where Mobile1 = ${setSQLStringValue(Mobile1)}`)

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Account not found for this mobile number')});
        }

        return res.status(200).json({...successMessage(`password updated successfully`)})
    }catch(error){
        console.log('Forget Password for organizer error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}
//#endregion

//#region verify email

const verifyOrganizerEmail = async (req, res) => {
    try{
        const {Email, AppleUserId} = req.query;

        // const missingKeys = checkKeysAndRequireValues(['Email'], req.query);

        // if(missingKeys.length > 0){
        //     return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`))
        // }

        if(!Email && !AppleUserId){
            return res.status(400).json({...errorMessage('Email or AppleUserId is needed.')});
        }

        const result = await pool.request().query(`select * from OrgUserMaster where (Email = ${setSQLStringValue(Email)} or AppleUserId = ${setSQLStringValue(AppleUserId)}) and flag <> 'D'`)

        if(result.recordset?.length > 0){
            return res.status(200).json({...errorMessage('already account exist of given Id')});
        }

        return res.status(200).json({...successMessage(`No account exist of given Email Id`)});
    }catch(error){
        console.log('verify Email of organizer error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

//#endregion transfer organizer

//#region 
const transferOrganizer = async (req, res) => {
  let transaction;
  try {
    const { FromOrganizerUkeyId, ToOrganizerUkeyId, IsDelete, IsEvents, IsSpeaker, IsTicketCategory, IsGallery, IsCoupon, IsSponsor, IsSponsorCatMaster, IsCarousel, IsBooking, IsContactSetting, IsOrgUser, IsReminder, IsTermCondition, IsSubscriber, IsDisclaimer } = req.body;

    const missingKeys = checkKeysAndRequireValues(['FromOrganizerUkeyId', 'ToOrganizerUkeyId', 'IsDelete'], req.body);
    
    if (missingKeys.length > 0) {
      console.error('Missing required fields:', missingKeys);
      return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
    }

    transaction = await pool.transaction();
    await transaction.begin();

    if (IsEvents) {
        const eventMasterQuery = `
            UPDATE EM
            SET EM.OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)}
            FROM EventMaster EM
            LEFT JOIN OrgUserMaster OM ON OM.OrganizerUkeyId = EM.OrganizerUkeyId AND OM.Role = 'Admin'
            WHERE EM.OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}
        `;
        await transaction.request().query(eventMasterQuery);
  
        const addressMasterQuery = `
            UPDATE AM
            SET AM.OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)}
            FROM AddressMaster AM
            LEFT JOIN EventMaster EM ON EM.AddressUkeyID = AM.AddressUkeyID
            LEFT JOIN OrgUserMaster OM ON OM.OrganizerUkeyId = EM.OrganizerUkeyId AND OM.Role = 'Admin'
            WHERE AM.OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}
        `;
      await transaction.request().query(addressMasterQuery);
  
        const eventDocumentsQuery = `
            UPDATE DU
            SET DU.OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)}
            FROM DocumentUpload DU
            LEFT JOIN EventMaster EM ON EM.EventUkeyId = DU.EventUkeyId
            LEFT JOIN OrgUserMaster OM ON OM.OrganizerUkeyId = EM.OrganizerUkeyId AND OM.Role = 'Admin'
            WHERE DU.OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} 
            AND DU.Category = 'Event'
        `;
            await transaction.request().query(eventDocumentsQuery);
    }

    if (IsSpeaker) {
        const speakerMasterQuery = `UPDATE SpeakerMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(speakerMasterQuery);

        const speakerDocumentsQuery = `UPDATE DocumentUpload SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} AND Category = 'Speaker'`;
        await transaction.request().query(speakerDocumentsQuery);
    }

    if (IsTicketCategory) {
        const ticketCategoryQuery = `UPDATE TicketCategoryMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(ticketCategoryQuery);
    }

    if (IsCoupon) {
        const couponMasterQuery = `UPDATE CouponMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(couponMasterQuery);
    }

    if (IsSponsorCatMaster) {
        const sponsorCatMasterQuery = `UPDATE SponsorCatMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(sponsorCatMasterQuery);
    }

    if (IsSponsor) {
        const sponsorMasterQuery = `UPDATE SponsorMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(sponsorMasterQuery);

        const sponsorDocumentsQuery = `UPDATE DocumentUpload SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} AND Category = 'Sponser'`;
        await transaction.request().query(sponsorDocumentsQuery);
    }

    if (IsCarousel) {
        const carouselQuery = `UPDATE Carousel SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(carouselQuery);

        const carouselDocumentsQuery = `UPDATE DocumentUpload SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} AND Category = 'Carousel'`;
        await transaction.request().query(carouselDocumentsQuery);
    }

    if (IsContactSetting) {
        const contactSettingQuery = `UPDATE EventContactSetting SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
        await transaction.request().query(contactSettingQuery);
    }

    if (IsOrgUser) {
        const orgUserQuery = `UPDATE OrgUserMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} AND Role <> 'Admin'`;
      await transaction.request().query(orgUserQuery);
    }

    if (IsReminder) {
      const reminderQuery = `UPDATE ReminderMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(reminderQuery);
    }

    if (IsTermCondition) {
      const termConditionQuery = `UPDATE Org_TermsCondi SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(termConditionQuery);
    }

    if (IsSubscriber) {
      const subscriberQuery = `UPDATE SubscriberMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(subscriberQuery);
    }

    if (IsDisclaimer) {
      const disclaimerQuery = `UPDATE DisclaimerMaster SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(disclaimerQuery);
    }

    if (IsBooking) {
      const bookingQuery = `UPDATE Bookingmast SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(bookingQuery);
    }

    if (IsGallery) {
      const galleryDocumentsQuery = `UPDATE DocumentUpload SET OrganizerUkeyId = ${setSQLStringValue(ToOrganizerUkeyId)} WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)} AND Category = 'Gallery'`;
      await transaction.request().query(galleryDocumentsQuery);

      const baseDir = path.join(__dirname, '../../media/DocumentUpload');
      const oldPath = path.join(baseDir, FromOrganizerUkeyId);
      const newPath = path.join(baseDir, ToOrganizerUkeyId);
  
      await fs.copy(oldPath, newPath);
    }
    
    if (IsDelete) {
      const deleteOrganizerQuery = `DELETE FROM OrganizerMaster WHERE OrganizerUkeyId = ${setSQLStringValue(FromOrganizerUkeyId)}`;
      await transaction.request().query(deleteOrganizerQuery);
    }

    await transaction.commit();

    return res.status(200).json(successMessage('Organizer transferred successfully.'));

  } catch (error) {
    console.error('Error during organizer transfer:', error);
    
    if (transaction) {
        await transaction.rollback();
    }
    
    return res.status(500).json(errorMessage(error.message));
  }
};
  //#endregion

module.exports = {
    AddOrginizer,
    Loginorganizer,
    updateOrginizer,
    fetchOrganizer,
    VerifyOrganizerMobileNumber,
    ForgetPasswordForOrganizer,
    Loginorganizerwithemail,
    verifyOrganizerEmail,
    loginWithMobileAndRole,
    transferOrganizer,
    OrganizerPlanList
}