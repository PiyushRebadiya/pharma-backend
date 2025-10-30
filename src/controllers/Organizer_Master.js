const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, CommonLogFun, deleteImage, setSQLDateTime, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchOrganizerDetails = async (req, res)=>{
    try{
        const { OrganizerUkeyId, IsActive, Role, Deleted } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (OrganizerUkeyId) {
            whereConditions.push(`om.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        if (Role) {
            whereConditions.push(`oum.Role = '${Role}'`);
        }
        if(IsActive){
            whereConditions.push(`om.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if (setSQLBooleanValue(Deleted)) {
            whereConditions.push(`om.flag = 'D'`);
        } else {
            whereConditions.push(`om.flag <> 'D'`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT om.*, oum.Password, oum.UserUkeyId FROM OrganizerMaster om
            left join OrgUserMaster oum on om.OrganizerUkeyId = oum.OrganizerUkeyId
            ${whereString} ORDER BY OrganizerId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM OrganizerMaster om
            left join OrgUserMaster oum on om.OrganizerUkeyId = oum.OrganizerUkeyId
            ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const fetchAllOrganizer = async (req, res) => {
    try{
        const getUserList = {
            getQuery: `SELECT * FROM OrganizerMaster 
            where flag <> 'D'
            ORDER BY OrganizerId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM OrganizerMaster where flag <> 'D' `,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error) {
        console.log('fetch all organizer error :', error);
        return res.status(400).send(errorMessage(error?.message));
    }
}

const OrginazerMaster = async (req, res) => {
    try {
        const { 
            OrganizerUkeyId, OrganizerName, Mobile1, Mobile2 = null, Email = null, AliasName = null, 
            Description = null, Add1 = null, Add2 = null, City = null, StateCode, StateName = null, 
            IsActive = true, UserName = null, flag = null , Password, UserUkeyId, PriceUkeyId = null, StartDate, EndDate, GSTnumber, GSTname
        } = req.body;

        if (!flag) return res.status(400).json(errorMessage("Flag is required. Use 'A' for Add or 'U' for Update."));

        const missingKeys = checkKeysAndRequireValues([
            "OrganizerUkeyId", "OrganizerName", "Mobile1", "StateCode", "IsActive"
        ], req.body);

        if (missingKeys.length) return res.status(400).json(errorMessage(`${missingKeys.join(", ")} is required.`));

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO OrganizerMaster (
                OrganizerUkeyId, OrganizerName, Mobile1, Mobile2, Email, AliasName, Description, Add1, Add2, City, StateCode, StateName, IsActive, UserName, IpAddress, HostName, EntryDate, flag, PriceUkeyId, StartDate, EndDate, GSTnumber, GSTname
            ) VALUES (
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(OrganizerName)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Mobile2)}, ${setSQLStringValue(Email)}, ${setSQLStringValue(AliasName)}, ${setSQLStringValue(Description)}, ${setSQLStringValue(Add1)}, ${setSQLStringValue(Add2)}, ${setSQLStringValue(City)}, ${setSQLStringValue(StateCode)}, ${setSQLStringValue(StateName)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(UserName)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(PriceUkeyId)}, ${setSQLDateTime(StartDate)}, ${setSQLDateTime(EndDate)},
                ${setSQLStringValue(GSTnumber)}, ${setSQLStringValue(GSTname)}
            );
        `;

        const deleteQuery = `DELETE FROM OrganizerMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};`;

        if (flag === "A") {
            const result = await pool.request().query(insertQuery);
            if (!result.rowsAffected[0]) return res.status(400).json(errorMessage("No Organizer Created."));
            CommonLogFun({
                OrganizerUkeyId : OrganizerUkeyId, 
                ReferenceUkeyId : OrganizerUkeyId, 
                MasterName : OrganizerName,  
                TableName : "OrganizerMaster", 
                UserId : req.user?.UserId, 
                UserName : req.user?.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })
            return res.status(200).json({ ...successMessage("New Organizer Created Successfully."), OrganizerUkeyId });
        }

        if (flag === "U") {
            await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);
            const updatePassword = await pool.request().query(`
                update OrgUserMaster set Password = ${setSQLStringValue(Password)}, Mobile1 = ${setSQLStringValue(Mobile1)}, Mobile2 = ${setSQLStringValue(Mobile2)}, Email = ${setSQLStringValue(Email)}, StateCode = ${setSQLStringValue(StateCode)}, StateName = ${setSQLStringValue(StateName)}, CityName = ${setSQLStringValue(City)}, Add1 = ${setSQLStringValue(Add1)}, Add2 = ${setSQLStringValue(Add2)}, FirstName = ${setSQLStringValue(OrganizerName)}, flag = 'U', PriceUkeyId = ${setSQLStringValue(PriceUkeyId)}, IsActive = ${setSQLBooleanValue(IsActive)} where UserUkeyId = ${setSQLStringValue(UserUkeyId)}
            `);
            if (!insertResult.rowsAffected[0]) return res.status(400).json(errorMessage("No Organizer Updated."));

            CommonLogFun({
                OrganizerUkeyId : OrganizerUkeyId, 
                ReferenceUkeyId : OrganizerUkeyId, 
                MasterName : OrganizerName,  
                TableName : "OrganizerMaster", 
                UserId : req.user?.UserId, 
                UserName : req.user?.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })

            if( !IsActive && IsActive == false){
                await pool.request().query(`
                    update OrgUserMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update EventMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update AddressMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update CouponMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update PaymentGatewayMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update DocumentUpload set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update SpeakerMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update SponsorMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update SponsorCatMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update TicketCategoryMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                    update TemplateMaster set IsActive = 0 where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                `)
            }

            return res.status(200).json({ ...successMessage("Organizer Updated Successfully."), OrganizerUkeyId });
        }

        return res.status(400).json(errorMessage("Invalid flag. Use 'A' for Add or 'U' for Update."));
    } catch (error) {
        console.error('orginizer master API error : ', error);
        return res.status(500).json(errorMessage(error?.message));
    }
};

const RemoveOrginazer = async (req, res) => {
    try{
        const {OrganizerUkeyId, IsPermanentDelete = false} = req.query;

        const missingKeys = checkKeysAndRequireValues(['OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const checkOrganizer = await pool.request().query(`SELECT * FROM OrganizerMaster WHERE OrganizerUkeyId = '${OrganizerUkeyId}'`);

        if(checkOrganizer.rowsAffected[0] == 0){
            return res.status(400).json({...errorMessage('No Orginizer Found.')})
        }

        if(checkOrganizer.recordset[0].Role == 'SuperAdmin' || checkOrganizer.recordset[0].Role == 'Admin'){
            return res.status(400).json({...errorMessage('Admin cannot be deleted.')})
        }

        const allDocument = await pool.request().query(`select * from DocumentUpload where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`)
        let query
        if(IsPermanentDelete){
            query = `
                DELETE FROM OrganizerMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM EventMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM AddressMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM OrgUserMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM Carousel WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM SpeakerMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM SponsorCatMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM SponsorMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM DocumentUpload WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM EventMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM AddressMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM SpeakerMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM SponsorMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM TicketCategoryMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM CouponMasterPermission WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM PaymentLog WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                DELETE FROM PaymentLogDetails WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            `
            for (const doc of allDocument.recordset) {
                deleteImage('./media/DocumentUpload/' + doc);
            }
        }else {
            query = `
                update OrganizerMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update EventMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update AddressMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update OrgUserMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update Carousel set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update SpeakerMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update SponsorCatMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update SponsorMaster set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update DocumentUpload set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update EventMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update AddressMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update SpeakerMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update SponsorMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update TicketCategoryMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update CouponMasterPermission set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                update PaymentLogDetails set flag = 'D' WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            `
        }

        const result = await pool.request().query(query);

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Orginizer Deleted.')})
        }

        return res.status(200).json({...successMessage('Orginizer Deleted Successfully.'), OrganizerUkeyId});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

const PlanDetails = async (req, res) =>{
    try{
        const { OrganizerUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (OrganizerUkeyId) {
            whereConditions.push(`om.OrganizerUkeyId = '${OrganizerUkeyId}'`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `select 
            pl.PaymentUkeyId, pl.OrganizerUkeyId, pl.EventUkeyId, pl.MasterUkeyId, pl.Type, pl.TotalNetAmt, pl.EventLimit, pm.PackageTitle, om.OrganizerName, pl.StartDate AS PlanStartDate, pl.EndDate AS PlanEndDate, (
                select pld.PaymentLogDetailUkeyId, pld.EventUkeyId, pld.Ticketlimits, pld.SubAdminLimit, pld.VolunteerLimit, pld.Speaker, pld.Sponsor, pld.iMessenger, pld.iMessngerlimit, pld.MetaWhatsapp, pld.MetaLimit, em.EventName, pl.EventLimit, pld.OrganizerUkeyId, pld.PaymentUkeyId
            from PaymentLogDetails pld 
            left join EventMaster em on em.EventUkeyId = pld.EventUkeyId and em.flag <> 'D'
            where pld.PaymentUkeyId = pl.PaymentUkeyId and pld.flag <> 'D'
            for json path
            ) AS EventWiseLimits 
            from PaymentLog pl
            left join PriceMaster pm on pm.PriceUkeyId = pl.MasterUkeyId
            left join OrganizerMaster om on om.OrganizerUkeyId = pl.OrganizerUkeyId            
            ${whereString} ORDER BY pl.EntryDate DESC`,
            countQuery: `select 
            COUNT(*) AS totalCount from PaymentLog pl
            left join PriceMaster pm on pm.PriceUkeyId = pl.MasterUkeyId
            left join OrganizerMaster om on om.OrganizerUkeyId = pl.OrganizerUkeyId
            ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        result.data?.forEach(obj => {
            if(obj.EventWiseLimits){
                obj.EventWiseLimits = JSON.parse(obj?.EventWiseLimits)
            } else {
                obj.EventWiseLimits = []
            }
        })
        return res.json(result);
    }catch(error){
        return res.status(500).json({...errorMessage(error.message)});
    }
}

const OrganizerPlanUpdate = async (req, res) =>{
    let transaction;
    try{
        const {PaymentUkeyId, PaymentLogDetailUkeyId, EventLimit, Ticketlimits, SubAdminLimit, VolunteerLimit, Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit} = req.body;

        const missingKeys = checkKeysAndRequireValues(['PaymentUkeyId'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        transaction = pool.transaction();
        await transaction.begin();

        if(EventLimit){
            await transaction.request().query(`
                update PaymentLog set 
                EventLimit = ${setSQLNumberValue(EventLimit)}
                where PaymentUkeyId = ${setSQLStringValue(PaymentUkeyId)}
            `)
        }

        await transaction.request().query(`
            update PaymentLogDetails set 
            Ticketlimits = ${setSQLNumberValue(Ticketlimits)},
            SubAdminLimit = ${setSQLNumberValue(SubAdminLimit)},
            VolunteerLimit = ${setSQLNumberValue(VolunteerLimit)},
            Speaker = ${setSQLNumberValue(Speaker)},
            Sponsor = ${setSQLNumberValue(Sponsor)},
            iMessenger = ${setSQLNumberValue(iMessenger)},
            iMessngerlimit = ${setSQLNumberValue(iMessngerlimit)},
            MetaWhatsapp = ${setSQLNumberValue(MetaWhatsapp)},
            MetaLimit = ${setSQLNumberValue(MetaLimit)},
            flag = 'U'
            where PaymentLogDetailUkeyId = ${setSQLStringValue(PaymentLogDetailUkeyId)}
        `)

        await transaction.commit();

        return res.status(200).json({
            ...successMessage('event limit updated successfully.'),
            ...req.body
        });
    }catch(error){
        if (transaction) await transaction.rollback(); // Rollback transaction on failure
        return res.status(500).json({...errorMessage(error.message)});
    }
}

const orgPlanDetailsOnEventId = async (req, res)=>{
    try{
        const {EventUkeyId, OrganizerUkeyId} = req.query

        const missingKeys = checkKeysAndRequireValues([ 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const resObj = {}
        if(EventUkeyId){
        const availableDataResult = await pool.request().query(`
            SELECT 
                pl.PaymentUkeyId, 
                em.EventName,
                pl.Ticketlimits - COUNT(DISTINCT bd.BookingdetailUkeyID) AS AvailableTickets,
                pl.Speaker - COUNT(DISTINCT sm.SpeakerUkeyId) AS AvailableSpeakers,
                pl.Sponsor - COUNT(DISTINCT sp.SponsorUkeyId) AS AvailableSponsors,
                pl.SubAdminLimit - COUNT(DISTINCT CASE WHEN oum.Role = 'Sub-Admin' THEN oum.UserUkeyId END) AS AvailableSubAdmins,
                pl.VolunteerLimit - COUNT(DISTINCT CASE WHEN oum.Role = 'Volunteer' THEN oum.UserUkeyId END) AS AvailableVolunteers
            FROM PaymentLogDetails pl 
            LEFT JOIN EventMaster em ON em.EventUkeyId = pl.EventUkeyId and em.flag <> 'D'
            LEFT JOIN Bookingmast bm ON bm.EventUkeyId = em.EventUkeyId and bm.flag <> 'D'
            LEFT JOIN Bookingdetails bd ON bd.BookingUkeyID = bm.BookingUkeyID and bd.flag <> 'D' 
            LEFT JOIN SpeakerMaster sm ON sm.EventUkeyId = pl.EventUkeyId and sm.flag <> 'D'
            LEFT JOIN SponsorMaster sp ON sp.EventUkeyId = pl.EventUkeyId and sp.flag <> 'D'
            LEFT JOIN OrgUserMaster oum ON oum.EventUkeyId = pl.EventUkeyId and oum.flag <> 'D'
            WHERE pl.EventUkeyId = ${setSQLStringValue(EventUkeyId)} and pl.flag <> 'D'
            GROUP BY pl.PaymentUkeyId,  pl.Ticketlimits, pl.SubAdminLimit, 
                pl.VolunteerLimit, 
                pl.Speaker,
                pl.Sponsor, 
                pl.iMessenger, 
                pl.iMessngerlimit, 
                pl.MetaWhatsapp, 
                pl.MetaLimit,
                em.EventName;
            `)
                resObj.availableDataResult = availableDataResult.recordset
        }

            const limitDataResult = await pool.request().query(`SELECT TOP 1 pl.PaymentUkeyId, pl.EventLimit as PlanEventLimit, pl.Ticketlimits, pl.SubAdminLimit, pl.VolunteerLimit, pl.Speaker,
                pl.Sponsor, pl.iMessenger, pl.iMessngerlimit, pl.MetaWhatsapp, pl.MetaLimit, MIN(pl.StartDate) AS StartDate,
                MIN(pl.EndDate) AS EndDate, COUNT(pld.Id) AS CreatedEvent, pm.PackageTitle,'Here Per EventWise All data Limit Shown' as Remakrs
                    FROM PaymentLog pl
                    LEFT JOIN PaymentLogDetails pld ON pld.PaymentUkeyId = pl.PaymentUkeyId and pld.flag <> 'D'
                    LEFT JOIN PriceMaster pm ON pl.MasterUkeyId = pm.PriceUkeyId
                    WHERE pl.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND pl.EndDate > GETDATE()
                    GROUP BY pl.PaymentUkeyId, pl.EventLimit, pl.Ticketlimits, pl.SubAdminLimit, pl.VolunteerLimit, pl.Speaker, pl.Sponsor, pl.iMessenger, pl.iMessngerlimit, pl.MetaWhatsapp, pl.MetaLimit, pm.PackageTitle
                    ORDER BY MIN(pl.StartDate) desc
            `)
            resObj.limitDataResult = limitDataResult.recordset
        return res.status(200).json(resObj)
    }catch(error){
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    FetchOrganizerDetails,
    OrginazerMaster,
    RemoveOrginazer,
    fetchAllOrganizer,
    PlanDetails,
    OrganizerPlanUpdate,
    orgPlanDetailsOnEventId
}