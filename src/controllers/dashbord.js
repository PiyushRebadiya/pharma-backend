const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLDateTime } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const DashbordList = async (req, res)=>{
    try{
        const { OrganizerUkeyId =  '7a2d29de-45e1-48dc-a757-009c041d924e', EventUkeyId = 'e4da1574-2c8a-4d6b-88ef-ad29d24a4829', fromDate = '', toDate = '', Verify = true} = req.query;

        const TicketQuery = `
            select count(UserUkeyId) AS Totaluser from TicketMaster where OrganizerUkeyId = '${OrganizerUkeyId}' and EventUkeyId = '${EventUkeyId}'
        `
        const TicketLimitQuery = `
            select Limits As TotalseatingLimits,Category,IsActive from TicketLimitMaster 
        `
        
        const CategorywiseMebersQuery = `
            SELECT COUNT(CASE WHEN IsActive = 1 THEN 1 END) AS ActiveData,
            COUNT(CASE WHEN MemberCategory = 'PA' THEN 1 END) AS PAMembers,
            COUNT(CASE WHEN MemberCategory = 'WPA' THEN 1 END) AS WPAMembers,
            COUNT(CASE WHEN IsActive = 0 THEN 1 END) AS InactiveData,
            COUNT(*) AS TotalData FROM UserMaster 
        `

        const DateWiseTicketQuery = `
            SELECT MemberType ,CAST(EntryDate AS DATE) AS EntryDate, COUNT(*) AS record_count
            FROM TicketMaster
            WHERE CAST(EntryDate AS DATE) BETWEEN ${setSQLDateTime(fromDate)} AND ${setSQLDateTime(toDate)} and EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY MemberType, CAST(EntryDate AS DATE)
            ORDER BY EntryDate;        
        `

        const categoruwiseTickwetbookingQuery = `
            SELECT MemberType, COUNT(*) AS DataCount
            FROM TicketMaster where EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY MemberType;
        `

        const ScaningDoneDataQuery = `
            SELECT MemberType,Verify, COUNT(*) AS DataCount
            FROM TicketMaster where Verify=${setSQLBooleanValue(Verify)} and EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY MemberType,Verify
        `

        const ScaneDataOnGateNoQuery = `
            SELECT Verify, GateNo, COUNT(*) AS DataCount
            FROM TicketMaster where Verify=${setSQLBooleanValue(Verify)} and EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY Verify,GateNo
        `

        const ticketBookedOnGateNoCountQuery = `
            SELECT  GateNo, COUNT(*) AS DataCount
            FROM TicketMaster where  EventUkeyId='${EventUkeyId}' and OrganizerUkeyId='${OrganizerUkeyId}'
            GROUP BY GateNo
        `
        
        const TicketScanedByAdminQuery = `
            select  COUNT(*) AS TicketScanedByAdmin from TicketMaster
            where IsAdmin = 1 and Verify = 1        
        `

        const TotalVolunteerAdminQuery = `
            select count(*) AS TotalVolunteerAdmin from VolunteerMaster WHERE Role = 'Volunteer-Admin'
        `

        const TotalSubAdminQuery = `
            select COUNT(*) AS TotalSubAdmin from OrganizerMaster where Role = 'Sub Admin'
        `

        const TicketLimitResult = await pool.request().query(TicketLimitQuery);
        const TicketResult = await pool.request().query(TicketQuery);
        const CategorywiseMebersResult = await pool.request().query(CategorywiseMebersQuery);
        const TicketMasterResult = await pool.request().query(DateWiseTicketQuery);
        const categoruwiseTickwetbookingResult = await pool.request().query(categoruwiseTickwetbookingQuery);
        const ScaningDoneDataResult = await pool.request().query(ScaningDoneDataQuery);
        const ScaneDataOnGateNoResult = await pool.request().query(ScaneDataOnGateNoQuery);
        const ticketBookedOnGateNoCountResult = await pool.request().query(ticketBookedOnGateNoCountQuery);
        const TicketScanedByAdminResult = await pool.request().query(TicketScanedByAdminQuery);
        const TotalVolunteerAdminResult = await pool.request().query(TotalVolunteerAdminQuery);
        const TotalSubAdminResult = await pool.request().query(TotalSubAdminQuery);

        return res.status(200).json({
            Totaluser : TicketResult?.recordset?.[0].Totaluser,
            TotalseatingLimits : TicketLimitResult.recordset,
            CategorywiseMebers : CategorywiseMebersResult.recordset,
            TicketMaster : TicketMasterResult.recordset,
            CategoryWiseTicketBooking : categoruwiseTickwetbookingResult.recordset,
            ScaningDoneData : ScaningDoneDataResult.recordset,
            ScaneDataOnGateNo : ScaneDataOnGateNoResult.recordset,
            ticketBookedOnGateNoCount : ticketBookedOnGateNoCountResult.recordset,
            TicketScanedByAdmin : TicketScanedByAdminResult?.recordset?.[0]?.TicketScanedByAdmin,
            TotalVolunteerAdmin : TotalVolunteerAdminResult?.recordset[0]?.TotalVolunteerAdmin,
            TotalSubAdmin : TotalSubAdminResult?.recordset?.[0]?.TotalSubAdmin
        })
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

module.exports = {
    DashbordList
}