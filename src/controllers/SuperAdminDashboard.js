const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, setSQLStringValue, setSQLNumberValue, getCommonAPIResponse } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const SuperAdminDashoardList = async (req, res) => {
    try{
        const totalOrganizer = await pool.request().query(`
            select COUNT(*) as TotalOrganizers from OrganizerMaster where flag <> 'D' and IsActive = 1
        `) 
        const totalEvents = await pool.request().query(`
            select COUNT(*) as TotalEvents from EventMaster where flag <> 'D' and EventStatus = 'PUBLISHED' and IsActive = 1
        `)
        const totalEventsExpired = await pool.request().query(`
            select COUNT(*) as TotalEventsExpired from EventMaster where flag <> 'D' and EventStatus = 'PUBLISHED' and IsActive = 0
        `)
        const totalUsers = await pool.request().query(`
            select COUNT(*) as totalUsers from UserMaster where flag <> 'D'
        `)
        
        return res.status(200).json({
            TotalOrganizers : totalOrganizer?.recordset[0]?.TotalOrganizers,
            TotalEvents : totalEvents?.recordset[0]?.TotalEvents,
            TotalEventsExpired : totalEventsExpired?.recordset[0]?.TotalEventsExpired,
            TotalUsers : totalUsers?.recordset[0]?.totalUsers,
        })
    }catch(error){
        console.log('fetch super admin dashboard list error :' ,error);
    }
}

const SuperAdminDashboardChartView = async (req,res) => {
    try{
        const {StartDate = null, EndDate = null, FetchType} = req.query;

        const missingKeys = checkKeysAndRequireValues(['FetchType'], req.query)
        if (missingKeys.length > 0) {
            return res.status(400).send(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const result = await pool.request().query(`
            exec SP_UserChartReport
            @FetchType = ${setSQLStringValue(FetchType)},
            @StartDate = ${setSQLStringValue(StartDate)},
            @EndDate = ${setSQLStringValue(EndDate)}
        `)

        return res.status(200).json({data : result?.recordset})
    }catch(error) {
        console.log(`Fetch Booking List error : `, error);
        return res.status(500).json(errorMessage(error.message));
    }
}

module.exports = {
    SuperAdminDashoardList,
    SuperAdminDashboardChartView
}