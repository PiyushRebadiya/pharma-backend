const { setSQLStringValue, setSQLDateTime, successMessage, errorMessage, checkKeysAndRequireValues, setSQLBooleanValue, setSQLDecimalValue, getCommonKeys, setSQLNumberValue } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const createPaymentLog = async (req, res) => {
  let transaction;

  try {
    const {
      PaymentUkeyId,
      OrganizerUkeyId,
      EventUkeyId,
      MasterUkeyId,
      Type,
      TotalNetAmt,
      RazorpayPaymentId,
      RazorpayOrderId,
      RazorpaySignatureId,
      IsPayment,
      GST,
      DiscountAmount
    } = req.body;

    // Validate required fields
    const missingKeys = checkKeysAndRequireValues(['PaymentUkeyId', 'OrganizerUkeyId'], req.body);
    if (missingKeys.length > 0) {
      return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
    }

    // Begin transaction
    transaction = pool.transaction();
    await transaction.begin();

    // Get plan details
    const checkPlanQuery = await pool.request().query(`
      SELECT * FROM PriceMaster 
      WHERE PriceUkeyId = ${setSQLStringValue(MasterUkeyId)}
    `);

    const packageTitle = checkPlanQuery?.recordset?.[0]?.PackageTitle;
    const durationDays = packageTitle === 'Demo' ? 15 : 365;

    // ✅ Check last payment log for same organizer
    const lastLogQuery = await pool.request().query(`
      SELECT TOP 1 * 
      FROM PaymentLog 
      WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
      ORDER BY EndDate DESC
    `);

    let startDate;
    if (lastLogQuery.recordset.length > 0) {
      // start from last EndDate + 1 day
      startDate = new Date(lastLogQuery.recordset[0].EndDate);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      // first plan → start now
      startDate = new Date();
    }

    // set end date
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);

    const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

    // Insert into PaymentLog
    await transaction.request().query(`
      INSERT INTO PaymentLog (
        PaymentUkeyId, OrganizerUkeyId, EventUkeyId, MasterUkeyId, Type, TotalNetAmt, 
        RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, IsPayment, flag, StartDate, EndDate, 
        IpAddress, HostName, EntryDate, GST, DiscountAmount, EventLimit, Ticketlimits, SubAdminLimit, VolunteerLimit, 
        Speaker, Sponsor, iMessenger, iMessngerlimit, MetaWhatsapp, MetaLimit, IsActive
      ) VALUES (
        ${setSQLStringValue(PaymentUkeyId)},
        ${setSQLStringValue(OrganizerUkeyId)},
        ${setSQLStringValue(EventUkeyId)},
        ${setSQLStringValue(MasterUkeyId)},
        ${setSQLStringValue(Type)},
        ${setSQLDecimalValue(TotalNetAmt)},
        ${setSQLStringValue(RazorpayPaymentId)},
        ${setSQLStringValue(RazorpayOrderId)},
        ${setSQLStringValue(RazorpaySignatureId)},
        ${setSQLBooleanValue(IsPayment)},
        'A',
        ${setSQLStringValue(startDate.toISOString())},
        ${setSQLStringValue(endDate.toISOString())},
        ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)},
        ${setSQLDecimalValue(GST)}, ${setSQLDecimalValue(DiscountAmount)}, 
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.EventLimit)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.Ticketlimits)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.SubAdminLimit)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.VolunteerLimit)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.Speaker)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.Sponsor)},
        ${setSQLBooleanValue(checkPlanQuery?.recordset?.[0]?.iMessenger)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.iMessngerlimit)},
        ${setSQLBooleanValue(checkPlanQuery?.recordset?.[0]?.MetaWhatsapp)},
        ${setSQLNumberValue(checkPlanQuery?.recordset?.[0]?.MetaLimit)},
        ${setSQLBooleanValue(checkPlanQuery?.recordset?.[0]?.IsActive)}
      )
    `);

    // Update OrganizerMaster with latest plan dates
    await transaction.request().query(`
      UPDATE OrganizerMaster 
      SET PriceUkeyId = ${setSQLStringValue(MasterUkeyId)}, 
          StartDate = ${setSQLStringValue(startDate.toISOString())}, 
          EndDate = ${setSQLStringValue(endDate.toISOString())}
      WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND flag <> 'D'
    `);

    // Commit transaction
    await transaction.commit();

    // Fetch plan data for response
    const planDataQuery = await pool.request().query(`
      SELECT * FROM PriceMaster WHERE PriceUkeyId = ${setSQLStringValue(MasterUkeyId)}
    `);

    return res.status(200).json({
      ...successMessage('Plan purchased successfully'),
      planData: planDataQuery?.recordset?.[0],
      startDate,
      endDate
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error in createPaymentLog:', error);
    return res.status(500).send(errorMessage(error?.message));
  }
};

  
module.exports = {
    createPaymentLog,
}