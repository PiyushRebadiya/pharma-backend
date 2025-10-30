const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLOrderId, setSQLStringValue, setSQLNumberValue, setSQLDecimalValue, setSQLDateTime, generateBookingCode } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const { sendEmailUserTickets, sendEmailUserTicketsHindi } = require("./sendEmail");
const moment = require("moment");
const fs = require("fs");
const { FRONTED_ORGANIZER_URL, FRONTED_USER_URL } = require("../common/variable");
const crypto = require('crypto');

const fetchBookings = async (req, res) => {
    try {
        const { 
            SortBy = 'EntryDate', 
            SortOrder = 'DESC', 
            BookingUkeyID,
            EventUkeyId,
            OrganizerUkeyId,
            UserUkeyID,
            IsVerify,
            IsPayment, 
            BookingMode
        } = req.query;

        let whereConditions = [];

        // Build the WHERE clause based on the query parameters
        if (BookingUkeyID) {
            whereConditions.push(`BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}`);
        }
        if (BookingMode) {
            whereConditions.push(`BookingMode = ${setSQLStringValue(BookingMode)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (UserUkeyID) {
            whereConditions.push(`UserUkeyID = ${setSQLStringValue(UserUkeyID)}`);
        }
        if (IsVerify) {
            whereConditions.push(`IsVerify = ${setSQLBooleanValue(IsVerify)}`);
        }
        if (IsPayment) {
            whereConditions.push(`IsPayment = ${setSQLBooleanValue(IsPayment)}`);
        }
        whereConditions.push(`flag <> 'D'`);
        whereConditions.push(`PaymentStatus = 'Success'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query definitions
        const getAutoSentNotificationList = {
            getQuery: `
            select * from bookinglistview 
                ${whereString}
                ORDER BY ${SortBy} ${SortOrder}
            `,
            countQuery: `
            select COUNT(*) AS totalCount from bookinglistview
                ${whereString}
            `,
        };

        // Execute the query and return results
        const result = await getCommonAPIResponse(req, res, getAutoSentNotificationList);

        result.data?.forEach(contact => {
            contact.FileNames = contact.FileNames ? JSON.parse(contact.FileNames) : [];
        });

        return res.json(result);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const fetchBookingInfoById = async( req, res)=> {
    try{
        const { 
            BookingUkeyID, BookingCode, EventUkeyId
        } = req.query;


        let whereConditions = [];
        let whereConditions2 = [];

        if (BookingUkeyID) {
            whereConditions.push(`BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}`);
            whereConditions2.push(`BM.BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}`);
        }

        if (BookingCode) {
            whereConditions.push(`BookingCode = ${setSQLStringValue(BookingCode)}`);
            whereConditions2.push(`BM.BookingCode = ${setSQLStringValue(BookingCode)}`);
        }

        if (EventUkeyId) {
            whereConditions2.push(`BM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const whereString2 = whereConditions2.length > 0 ? `WHERE ${whereConditions2.join(' AND ')}` : '';
        const getAutoSentNotificationList = {
            getQuery: `
            select * from bookinglistview ${whereString}
            `,
            countQuery: `
            select COUNT(*) AS totalCount from bookinglistview ${whereString}
            `,
        };
        const childQuery = `select BD.*, TCM.Category from Bookingdetails BD  left join TicketCategoryMaster TCM on BD.TicketCateUkeyId = TCM.TicketCateUkeyId left join Bookingmast BM on BD.BookingUkeyID =  BM.BookingUkeyID ${whereString2}`
        const bookingDetails = await pool.request().query(childQuery)

        // Execute the query and return results
        const result = await getCommonAPIResponse(req, res, getAutoSentNotificationList);
        if(result?.data?.length > 0){
            result.data[0].Bookingdetails = bookingDetails.recordset
        }
        result?.data?.forEach(contact => {
            contact.FileNames = contact.FileNames ? JSON.parse(contact.FileNames) : [];
        });
        return res.json({ BookingMaster : result?.data[0] });
    }catch(error){
        console.error('Error fetching bookings:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const selftCheckList = async (req, res)=>{
    try{
        const {EventUkeyId, UserUkeyID} = req.query
        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'UserUkeyID'], { ...req.query });
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const selftCheckListQuery = `
        select bd.BookingdetailUkeyID, bd.BookingUkeyID, bd.Name, bd.Mobile, bm.EventUkeyId, bm.OrganizerUkeyId, bm.UserUkeyID, bm.BookingCode , bd.IsVerify, bd.TicketCateUkeyId, tcm.Category AS TicketCateogryName, em.EventName, em.StartEventDate, em.EndEventDate, em.ScanStartDate, em.ScanEndDate
        from Bookingdetails bd
        left join Bookingmast bm on bm.BookingUkeyID = bd.BookingUkeyID
        left join TicketCategoryMaster tcm on tcm.TicketCateUkeyId = bd.TicketCateUkeyId
        left join EventMaster em on em.EventUkeyId = bm.EventUkeyId
        where bm.EventUkeyId = ${setSQLStringValue(EventUkeyId)} and bm.UserUkeyID = ${setSQLStringValue(UserUkeyID)} and bd.flag <> 'D'
        `
        const result = await pool.request().query(selftCheckListQuery);

        return res.status(200).json({data : result.recordset})
    }catch(error){
        console.error('self check list:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const BookingMaster = async (req, res) => {
    const {
        flag, BookingMast, bookingdetails
    } = req.body;
    const {
        BookingUkeyID, UserUkeyID, BookingDate, BookingAmt, TotalGST, TotalConviencefee, DiscountPer, DiscountAmt, EventUkeyId, OrganizerUkeyId, TotalNetAmount, CouponUkeyId, RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, IsWhatsapp, IsVerify, IsPayment, BookingCode = generateBookingCode(), IsDonationAmt, IsWalletUsed, UsedWalletAmt,DonationAmt,AdditionalCharges, PaymentStatus, TotalGrossAmt, MyEventzCharge, IsAmtMyEventCharge, RefCode, BookingMode
    } = BookingMast
    let transaction
    try {
        let {TrnUkeyId, DetailUkeyid, TrnNo} = BookingMast
        if(flag !== 'A' && flag !== 'U'){
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to Update. It is compulsory to send the flag.")
            });
        }
        const missingKeys = checkKeysAndRequireValues(['flag', 'BookingMast', 'bookingdetails'], { ...req.body });
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        let sqlQuery = '';

        const result = await pool.request().query(`
            select sum(Credit)-sum(Debit) as WalletBalance from walletmaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)}
        `)

        if (IsWalletUsed && UsedWalletAmt > Number(result.recordset[0].WalletBalance)) {
            return res.status(400).json({ 
                ...errorMessage('Insufficient wallet balance.') 
            });
        }

        // Fetch ticket category limits and already booked tickets
        const ticketCategoryData = await pool.request().query(`
            SELECT 
                COUNT(bd.BookingdetailID) AS TotalBookedTickets,
                tm.TicketCateUkeyId,
                tm.TicketLimits,
                tm.Category
            FROM TicketCategoryMaster tm WITH (NOLOCK)
            LEFT JOIN Bookingdetails bd WITH (NOLOCK) 
                ON tm.TicketCateUkeyId = bd.TicketCateUkeyId 
                AND bd.flag <> 'D'
            LEFT JOIN Bookingmast bm WITH (NOLOCK) 
                ON bd.BookingUkeyID = bm.BookingUkeyID
                AND bm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                AND bm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                AND bm.PaymentStatus = 'Success'
                AND bm.flag <> 'D'
            WHERE tm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            GROUP BY tm.TicketCateUkeyId, tm.TicketLimits, tm.Category
        `);

        const categoryLimitExceeded = [];
        const categoryTicketCount = {};

        let allMobiles = [];
        // Count new ticket requests per category
        bookingdetails?.forEach(ticket => {
            allMobiles.push(ticket.Mobile)
            const categoryId = ticket.TicketCateUkeyId;
            categoryTicketCount[categoryId] = (categoryTicketCount[categoryId] || 0) + 1;
        });

        //  Check if any category exceeds its limit
        for (const category of ticketCategoryData.recordset) {
            const requestedCount = categoryTicketCount[category.TicketCateUkeyId] || 0;
            let availableTickets = category.TicketLimits - category.TotalBookedTickets;
            if (flag === 'U') {
                //  If updating, add back the user's current booking count before checking
                const userPreviousBooking = await pool.request().query(`
                    SELECT COUNT(*) AS PreviousBookedTickets
                    FROM Bookingdetails  WITH (NOLOCK) 
                    WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}
                    AND TicketCateUkeyId = ${setSQLStringValue(category.TicketCateUkeyId)}
                    AND flag <> 'D'
                `);
                const previousBookingCount = userPreviousBooking.recordset?.[0]?.PreviousBookedTickets || 0;
        
                availableTickets += previousBookingCount;
            }
        
            if (requestedCount > availableTickets) {
                categoryLimitExceeded.push({
                    CategoryName: category.Category,
                    AvailableTickets: availableTickets
                });
            }
        };
        
        if (categoryLimitExceeded.length > 0) {
            const errorMsg = `Ticket limit exceeded for: ${categoryLimitExceeded.map(c => `${c.CategoryName} ${c.AvailableTickets} left`).join(', ')}`;
            return res.status(400).json({ ...errorMessage(errorMsg), categoryLimitExceeded });
        }

        transaction = pool.transaction();
        await transaction.begin();

                        
        //  Handle Update Scenario (flag === 'U')
        if (flag === 'U') {
            sqlQuery += `
                DELETE FROM Bookingmast WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} and flag <> 'D';
                DELETE FROM bookingdetails WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} and flag <> 'D';
                DELETE FROM WalletMaster WHERE TrnUkeyId = ${setSQLStringValue(TrnUkeyId)} and flag <> 'D';
            `;
        }
        let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)} and Trnmode = 'BOOKING'`)
        TrnUkeyId =  flag == 'A' ? generateUUID() : TrnUkeyId
        DetailUkeyid =  flag == 'A' ? generateUUID() : DetailUkeyid
        TrnNo = flag == 'A' ? num?.recordset?.[0]?.TrnNo : TrnNo

        sqlQuery += `
        INSERT INTO Bookingmast (
            BookingUkeyID, UserUkeyID, BookingDate, BookingAmt, TotalGST, TotalConviencefee, DiscountPer, DiscountAmt, flag, IpAddress, HostName, EntryDate, EventUkeyId, OrganizerUkeyId, TotalNetAmount, CouponUkeyId, RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, IsWhatsapp, IsVerify, IsPayment, BookingCode, IsDonationAmt, IsWalletUsed, UsedWalletAmt,DonationAmt,AdditionalCharges, PaymentStatus, TotalGrossAmt, MyEventzCharge, IsAmtMyEventCharge, RefCode, BookingMode
        ) VALUES ( 
            ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(UserUkeyID)}, ${setSQLDateTime(BookingDate)}, ${setSQLDecimalValue(BookingAmt)}, ${setSQLDecimalValue(TotalGST)}, ${setSQLDecimalValue(TotalConviencefee)}, ${setSQLDecimalValue(DiscountPer)}, ${setSQLDecimalValue(DiscountAmt)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLDecimalValue(TotalNetAmount)}, ${setSQLStringValue(CouponUkeyId)}, ${setSQLStringValue(RazorpayPaymentId)}, ${setSQLStringValue(RazorpayOrderId)}, ${setSQLStringValue(RazorpaySignatureId)}, ${setSQLBooleanValue(IsWhatsapp)}, ${setSQLBooleanValue(IsVerify)}, ${setSQLBooleanValue(IsPayment)}, ${setSQLStringValue(BookingCode)}, ${setSQLBooleanValue(IsDonationAmt)}, ${setSQLBooleanValue(IsWalletUsed)}, ${setSQLDecimalValue(UsedWalletAmt)}, ${setSQLDecimalValue(DonationAmt)}, ${setSQLDecimalValue(AdditionalCharges)}, ${setSQLStringValue(PaymentStatus)}, ${setSQLDecimalValue(TotalGrossAmt)}, ${setSQLDecimalValue(MyEventzCharge)}, ${setSQLBooleanValue(IsAmtMyEventCharge)}, ${setSQLStringValue(RefCode)}, ${setSQLStringValue(BookingMode)}
        );
        `;
        if(typeof bookingdetails === 'object' && bookingdetails.length > 0){
            for (const Detail of bookingdetails) {
                const {BookingdetailUkeyID, BookingUkeyID, Name, Mobile, GST, Conviencefee, TicketCateUkeyId, Amount, DiscAmt, IsVerify, BookingMode, VerifyMode, SeatNumber, MyEventzCharge, IsAmtMyEventCharge, TicketVerifyTime, RefCode, DiscountPer} = Detail
                sqlQuery +=`insert into bookingdetails (
                    BookingdetailUkeyID, BookingUkeyID, Name, Mobile, GST, Conviencefee, TicketCateUkeyId, flag, IpAddress, HostName, EntryDate, Amount, DiscAmt, IsVerify, BookingMode, VerifyMode, SeatNumber, MyEventzCharge, IsAmtMyEventCharge, TicketVerifyTime, RefCode, DiscountPer
                ) values (
                    ${setSQLStringValue(BookingdetailUkeyID)}, ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, ${setSQLDecimalValue(GST)}, ${setSQLDecimalValue(Conviencefee)}, ${setSQLStringValue(TicketCateUkeyId)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLDecimalValue(Amount)}, ${setSQLDecimalValue(DiscAmt)}, ${setSQLStringValue(IsVerify)}, ${setSQLStringValue(BookingMode)}, ${setSQLStringValue(VerifyMode)}, ${setSQLStringValue(SeatNumber)}, ${setSQLDecimalValue(MyEventzCharge)}, ${setSQLBooleanValue(IsAmtMyEventCharge)}, ${setSQLDateTime(TicketVerifyTime)}, ${setSQLStringValue(RefCode)}, ${setSQLDecimalValue(DiscountPer)}
                );`
            }
        }

        // const coupon = await pool.request().query(`SELECT Discount, CouponCode, IswalletAdd, WalletAmt FROM CouponMaster WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)} AND flag <> 'D' AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND IsActive = 1`)
        
        // // when user uses wallet Ammount.
        // if (setSQLBooleanValue(IsWalletUsed)) {
        //     sqlQuery += `
        //         insert into WalletMaster (
        //             TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
        //         ) values (
        //             ${setSQLStringValue(TrnUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, 'BOOKING', ${setSQLStringValue(TrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, 0, ${setSQLDecimalValue(UsedWalletAmt)}, ${coupon.recordset?.[0]?.Discount || 0}, 'INR', 1, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLNumberValue(bookingdetails.length)}, ${setSQLDecimalValue(TotalGST)}, ${setSQLDecimalValue(TotalNetAmount)}
        //         )
        //     `
        // }
        await transaction.request().query(sqlQuery);

        // const fetchCouponQuery = `SELECT IswalletAdd, WalletAmt, CouponCode FROM CouponMaster WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)}`;

        // const couponData = await pool.request().query(fetchCouponQuery);

        // if (coupon?.recordset?.length > 0) {
        //     const { IswalletAdd, WalletAmt, CouponCode } = coupon.recordset[0];
        //     if (IswalletAdd == true) {
        //         let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster with (nolock) where Trnmode = ${setSQLStringValue(CouponUkeyId)}`)
        //         let TrnNo = (num.recordset[0].TrnNo).toString();
        //         const addWPACodeWalletQuery = `insert into WalletMaster (
        //                             TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
        //                         ) values (
        //                             NEWID(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(CouponCode)}, ${setSQLStringValue(TrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, ${setSQLNumberValue(WalletAmt)}, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 1, 0, 0
        //                         )`;
        //         // console.log(addWPACodeWalletQuery);
                
        //         await transaction.request().query(addWPACodeWalletQuery);
        //     }
        // }

        if (PaymentStatus == 'Success' && setSQLBooleanValue(IsWhatsapp)) {

            const bookingmastQuery = `SELECT o.OrganizerName, e.EventName, e.StartEventDate, bm.EventUkeyId FROM Bookingmast bm
                            left join OrganizerMaster as o on o.OrganizerUkeyId = bm.OrganizerUkeyId
                            left join EventMaster as e on e.EventUkeyId = bm.EventUkeyId
                            WHERE BookingUkeyID = '${BookingUkeyID}'`;
            const bookingmastResult = await transaction.request().query(bookingmastQuery);

            const { EventName, StartEventDate, EventUkeyId } = bookingmastResult.recordset[0];


            allMobiles = [...new Set(allMobiles)].map((mobile) => mobile.trim().length === 10 ? `91${mobile.trim()}` : mobile.trim());

            if (allMobiles.length > 0) {
                for (const mobile of allMobiles) {
                    const date = new Date(StartEventDate);
                    // Use UTC methods to get date and time components
                    const day = date.getUTCDate();
                    const month = date.getUTCMonth();
                    const year = date.getUTCFullYear();
                    const hours = date.getUTCHours();
                    const minutes = date.getUTCMinutes();

                    // Array of month names
                    const monthNames = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ];

                    // Format the date dynamically
                    const formattedDate = `${day} ${monthNames[month]} ${year}, ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

                    // Generate short code (7 characters)
                    const shortCode = crypto.randomBytes(4).toString("base64url");
                    const ticketBookingURL = `${FRONTED_ORGANIZER_URL}/ticket-booking/download/${BookingUkeyID}`;

                    const insertTicketURLQuery = `INSERT INTO ShortUrls (short_code, long_url) VALUES (@shortCode, @longUrl)`;
                    await transaction.request()
                        .input('shortCode', shortCode)
                        .input('longUrl', ticketBookingURL)
                        .query(insertTicketURLQuery);

                    const message = `🎉 Your Ticket is Confirmed!\n\nThank you for booking *${EventName}* with My Eventz 🌟\n\n📅 Event Date: ${formattedDate}\n🎟️ View Your Ticket: ${FRONTED_USER_URL}/download/${shortCode}\n\nWe look forward to seeing you there! 🎊`;
                    const insertQuery = `INSERT INTO WhatsAppMessages (OrganizerUkeyId, EventUkeyId, BookingUkeyID, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) 
                                                    VALUES (@OrganizerUkeyId, @EventUkeyId, @BookingUkeyID, @message, @mobile, 0, 'Booking', 1, GETDATE())`;

                    await transaction.request()
                        .input('OrganizerUkeyId', OrganizerUkeyId)
                        .input('EventUkeyId', EventUkeyId)
                        .input('BookingUkeyID', BookingUkeyID)
                        .input('message', message)
                        .input('mobile', mobile)
                        .query(insertQuery);
                }
            }

        }
        
        await transaction.commit();


        // if (result?.rowsAffected?.[0] === 0) {
        //     return res.status(400).json(errorMessage('No booking entry created.'));
        // }
        // if(PaymentStatus == 'Success'){
        //     setImmediate(async () => {
        //         try {
        //             const userDetailsQuery = `SELECT * FROM UserMaster WHERE UserUkeyID = ${setSQLStringValue(UserUkeyID)}`;
        //             const userDetails = await pool.request().query(userDetailsQuery);
        //             if (userDetails?.recordset?.length > 0) {
        //                 const { Email, Mobile1, FullName = 'User' } = userDetails.recordset[0];
        //                 if (Email) {
        //                     const EventDetailsQuery = `SELECT am.Address1, am.Address2, am.StateName, am.CityName, am.Pincode, em.EventName, em.StartEventDate, em.OrganizerUkeyId, om.OrganizerName, om.Mobile1, om.Mobile2 
        //                 FROM EventMaster em WITH (NOLOCK) 
        //                 LEFT JOIN AddressMaster am WITH (NOLOCK) ON am.AddressUkeyID = em.AddressUkeyID
        //                 LEFT JOIN OrganizerMaster om WITH (NOLOCK) ON om.OrganizerUkeyId = em.OrganizerUkeyId
        //                 WHERE em.EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND am.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
    
        //                     const EventDetails = await pool.request().query(EventDetailsQuery);
        //                     if (EventDetails?.recordset?.length > 0) {
        //                         const { EventName, StartEventDate, Address1, Address2, StateName, CityName, Pincode, OrganizerName, Mobile1, Mobile2 } = EventDetails.recordset[0];
        //                         const address = [Address1, Address2, CityName, StateName, Pincode].filter(Boolean).join(', ');
        //                         const ticketReport = `https://report.taxfile.co.in/report/TicketPrint?BookingUkeyID=${BookingUkeyID}&ExportMode=PDF`;
    
        //                         const responseTicketBookingEnglish = await sendEmailUserTickets(
        //                             Email, FullName, EventName,
        //                             moment.utc(StartEventDate).format("dddd, MMMM Do YYYY"),
        //                             address, ticketReport, Mobile1, Mobile2, OrganizerName
        //                         );
    
        //                         try {
        //                             const insertQueryEN = `INSERT INTO [EmailLogs] ([OrganizerUkeyId],[EventUkeyId],[UkeyId],[Category],[Language],[Email],[IsSent],[UserUkeyId],[IpAddress],[HostName],[EntryTime],[flag]) VALUES (${setSQLStringValue(OrganizerUkeyId)},${setSQLStringValue(EventUkeyId)},${setSQLStringValue(generateUUID())},'TICKET_BOOKING','ENGLISH',${setSQLStringValue(Email)},${setSQLBooleanValue(responseTicketBookingEnglish)},${setSQLStringValue(UserUkeyID)},${setSQLStringValue(IPAddress)},${setSQLStringValue(ServerName)},GETDATE(),'A')`;
        //                             await pool.request().query(insertQueryEN);
        //                             console.log('English email log inserted');
        //                         } catch (error) {
        //                             console.error('Error inserting English email log:', error);
        //                         }
    
        //                         const responseTicketBookingHindi = await sendEmailUserTicketsHindi(
        //                             Email, FullName, EventName,
        //                             moment.utc(StartEventDate).format("dddd, MMMM Do YYYY"),
        //                             address, ticketReport, Mobile1, Mobile2, OrganizerName
        //                         );
    
        //                         try {
        //                             const insertQueryHI = `INSERT INTO [EmailLogs] ([OrganizerUkeyId],[EventUkeyId],[UkeyId],[Category],[Language],[Email],[IsSent],[UserUkeyId],[IpAddress],[HostName],[EntryTime],[flag]) VALUES (${setSQLStringValue(OrganizerUkeyId)},${setSQLStringValue(EventUkeyId)},${setSQLStringValue(generateUUID())},'TICKET_BOOKING','HINDI',${setSQLStringValue(Email)},${setSQLBooleanValue(responseTicketBookingHindi)},${setSQLStringValue(UserUkeyID)},${setSQLStringValue(IPAddress)},${setSQLStringValue(ServerName)},GETDATE(),'A')`;
        //                             await pool.request().query(insertQueryHI);
        //                             console.log('Hindi email log inserted');
        //                         } catch (error) {
        //                             console.error('Error inserting Hindi email log:', error);
        //                         }
        //                     }
        //                 }
        //             }
        //         } catch (error) {
        //             console.error('Error in background email job:', error);
        //         }
        //     });
    
        //     setImmediate(async () => {
        //         try {
        //             const userMobileDeviceQuery = `select UserUkeyID, DeviceUkeyId, Log_In, NotificationToken from user_devices where UserUkeyId = ${setSQLStringValue(UserUkeyID)} AND Log_In = 1 AND DeviceType != 'web'`;
    
        //             const resultOfUserMobileDevice = await pool.request().query(userMobileDeviceQuery);
    
        //             if (resultOfUserMobileDevice?.recordset?.length > 0) {
        //                 resultOfUserMobileDevice.recordset.forEach(async (device) => {
        //                     const { UserUkeyID, DeviceUkeyId, NotificationToken } = device;
        //                     try {
        //                         await sentNotificationOnSetTime({
        //                             body: {
        //                                 Title: "Your Ticket Booked Successfully!",
        //                                 Description: "You can view your tickets here.",
        //                                 NotificationToken: NotificationToken,
        //                                 Image: "",
        //                                 Link: `/MyBookingScreen?BookingUkeyID=${BookingUkeyID}&UserUkeyID=${UserUkeyID}`
        //                             }
        //                         });
        //                     } catch (error) {
        //                         console.log("Error in background notification job:", error);
        //                     }
        //                 })
        //             }
        //         } catch (error) {
        //             console.log("Error in background notification job:", error);
        //         }
        //     })
        // }
        
        return res.status(200).json({ 
            ...successMessage('New Booking Entry Created Successfully.'), 
            ...req.body ,
            TrnUkeyId,
            DetailUkeyid,
            TrnNo
        });
    } catch (error) {
        console.error(flag === 'A' ? 'Add AutoSentNotification Error:' : 'Update AutoSentNotification Error:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).send(errorMessage(error?.message));
    }
};

const BookingMasterForCanvas = async (req, res) => {
    let transaction;
    try {
        // Destructure request body with validation
        const { flag, BookingMast, bookingdetails } = req.body || {};
        if (!req.body) {
            return res.status(400).json(errorMessage('Request body is missing'));
        }

        // Destructure BookingMast with default values
        const {
            BookingUkeyID = generateUUID(),
            UserUkeyID,
            BookingDate,
            BookingAmt,
            TotalGST,
            TotalConviencefee,
            DiscountPer,
            DiscountAmt,
            EventUkeyId,
            OrganizerUkeyId,
            TotalNetAmount,
            CouponUkeyId,
            RazorpayPaymentId,
            RazorpayOrderId,
            RazorpaySignatureId,
            IsWhatsapp = false,
            IsVerify = false,
            IsPayment = false,
            BookingCode = generateBookingCode(),
            IsDonationAmt = false,
            IsWalletUsed = false,
            UsedWalletAmt,
            DonationAmt,
            AdditionalCharges,
            PaymentStatus,
            TotalGrossAmt,
            MyEventzCharge,
            IsAmtMyEventCharge,
            RefCode,
            BookingMode
        } = BookingMast || {};

        // Validate flag
        if (flag !== 'A' && flag !== 'U') {
            return res.status(400).json(errorMessage("Use 'A' flag to Add and 'U' flag to Update"));
        }

        // Check for missing required keys
        const missingKeys = checkKeysAndRequireValues(['flag', 'BookingMast', 'bookingdetails'], req.body);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        // Initialize transaction
        transaction = pool.transaction();
        await transaction.begin();

        let sqlQuery = '';

        const checkWalletBalance = await transaction.request().query(`
            select sum(Credit)-sum(Debit) as WalletBalance from walletmaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)}
        `)

        if (UsedWalletAmt > Number(checkWalletBalance.recordset[0].WalletBalance)) {
            return res.status(400).json({ 
                ...errorMessage('Insufficient wallet balance.') 
            });
        }

        // Fetch ticket category limits and booked tickets
        const ticketCategoryQuery = `
            SELECT 
                COUNT(bd.BookingdetailID) AS TotalBookedTickets,
                tm.TicketCateUkeyId,
                tm.TicketLimits,
                tm.Category
            FROM TicketCategoryMaster tm WITH (NOLOCK)
            LEFT JOIN Bookingdetails bd WITH (NOLOCK) 
                ON tm.TicketCateUkeyId = bd.TicketCateUkeyId 
                AND bd.flag <> 'D'
            LEFT JOIN Bookingmast bm WITH (NOLOCK) 
                ON bd.BookingUkeyID = bm.BookingUkeyID
                AND bm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                AND bm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                AND bm.PaymentStatus = 'Success'
            WHERE tm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            GROUP BY tm.TicketCateUkeyId, tm.TicketLimits, tm.Category
        `;

        const ticketCategoryData = await transaction.request().query(ticketCategoryQuery);

        const categoryLimitExceeded = [];
        const categoryTicketCount = {};
        let allMobiles = []; // Add this line

        // Count new ticket requests per category
        bookingdetails?.forEach(ticket => {
            const categoryId = ticket.TicketCateUkeyId;
            categoryTicketCount[categoryId] = (categoryTicketCount[categoryId] || 0) + 1;
            allMobiles.push(ticket.Mobile); // Collect mobiles
        });

        // Check if any category exceeds its limit
        for (const category of ticketCategoryData.recordset) {
            const requestedCount = categoryTicketCount[category.TicketCateUkeyId] || 0;
            let availableTickets = category.TicketLimits - category.TotalBookedTickets;
            if (flag === 'U') {
                const userPreviousBooking = await transaction.request().query(`
                    SELECT COUNT(*) AS PreviousBookedTickets
                    FROM Bookingdetails WITH (NOLOCK)
                    WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}
                    AND TicketCateUkeyId = ${setSQLStringValue(category.TicketCateUkeyId)}
                    AND flag <> 'D'
                `);
                availableTickets += userPreviousBooking.recordset?.[0]?.PreviousBookedTickets || 0;
            }

            if (requestedCount > availableTickets) {
                categoryLimitExceeded.push({
                    CategoryName: category.Category,
                    AvailableTickets: availableTickets
                });
            }
        }

        if (categoryLimitExceeded.length > 0) {
            await transaction.rollback();
            const errorMsg = `Ticket limit exceeded for: ${categoryLimitExceeded.map(c => `${c.CategoryName} ${c.AvailableTickets} left`).join(', ')}`;
            return res.status(400).json({ ...errorMessage(errorMsg), categoryLimitExceeded });
        }

        let { TrnUkeyId, DetailUkeyid, TrnNo } = BookingMast || {};

        // Handle Update Scenario
        if (flag === 'U') {
            sqlQuery += `
                DELETE FROM Bookingmast WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND flag <> 'D';
                DELETE FROM bookingdetails WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} AND flag <> 'D';
                DELETE FROM WalletMaster WHERE TrnUkeyId = ${setSQLStringValue(TrnUkeyId)} AND flag <> 'D';
            `;
        }

        // Generate transaction IDs and numbers
        const numResult = await transaction.request().query(`
            SELECT ISNULL(MAX(CONVERT(BIGINT, TrnNo)), 0) + 1 AS TrnNo 
            FROM WalletMaster 
            WHERE UserUkeyId = ${setSQLStringValue(UserUkeyID)} AND TrnMode = 'BOOKING'
        `);
        TrnUkeyId = flag === 'A' ? generateUUID() : TrnUkeyId;
        DetailUkeyid = flag === 'A' ? generateUUID() : DetailUkeyid;
        TrnNo = flag === 'A' ? numResult?.recordset?.[0]?.TrnNo : TrnNo;

        // Insert into Bookingmast
        sqlQuery += `
            INSERT INTO Bookingmast (
                BookingUkeyID, UserUkeyID, BookingDate, BookingAmt, TotalGST, TotalConviencefee, 
                DiscountPer, DiscountAmt, flag, IpAddress, HostName, EntryDate, EventUkeyId, 
                OrganizerUkeyId, TotalNetAmount, CouponUkeyId, RazorpayPaymentId, RazorpayOrderId, 
                RazorpaySignatureId, IsWhatsapp, IsVerify, IsPayment, BookingCode, IsDonationAmt, 
                IsWalletUsed, UsedWalletAmt, DonationAmt, AdditionalCharges, PaymentStatus, TotalGrossAmt, MyEventzCharge, IsAmtMyEventCharge, RefCode, BookingMode
            ) VALUES (
                ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(UserUkeyID)}, 
                ${setSQLDateTime(BookingDate)}, ${setSQLDecimalValue(BookingAmt)}, 
                ${setSQLDecimalValue(TotalGST)}, ${setSQLDecimalValue(TotalConviencefee)}, 
                ${setSQLDecimalValue(DiscountPer)}, ${setSQLDecimalValue(DiscountAmt)}, 
                ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, 
                ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 
                ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, 
                ${setSQLDecimalValue(TotalNetAmount)}, ${setSQLStringValue(CouponUkeyId)}, 
                ${setSQLStringValue(RazorpayPaymentId)}, ${setSQLStringValue(RazorpayOrderId)}, 
                ${setSQLStringValue(RazorpaySignatureId)}, ${setSQLBooleanValue(IsWhatsapp)}, 
                ${setSQLBooleanValue(IsVerify)}, ${setSQLBooleanValue(IsPayment)}, 
                ${setSQLStringValue(BookingCode)}, ${setSQLBooleanValue(IsDonationAmt)}, 
                ${setSQLBooleanValue(IsWalletUsed)}, ${setSQLDecimalValue(UsedWalletAmt)}, 
                ${setSQLDecimalValue(DonationAmt)}, ${setSQLDecimalValue(AdditionalCharges)}, 
                ${setSQLStringValue(PaymentStatus)}, ${setSQLDecimalValue(TotalGrossAmt)}, 
                ${setSQLDecimalValue(MyEventzCharge)}, ${setSQLBooleanValue(IsAmtMyEventCharge)}, 
                ${setSQLStringValue(RefCode)}, ${setSQLStringValue(BookingMode)}
            );
        `;

        // Insert booking details
        if (Array.isArray(bookingdetails) && bookingdetails.length > 0) {
            for (const Detail of bookingdetails) {
                const {
                    BookingdetailUkeyID = generateUUID(),
                    Name,
                    Mobile,
                    GST,
                    Conviencefee,
                    TicketCateUkeyId,
                    Amount,
                    DiscAmt,
                    IsVerify,
                    BookingMode,
                    VerifyMode,
                    SeatNumber,
                    MyEventzCharge,
                    IsAmtMyEventCharge,
                    TicketVerifyTime,
                    RefCode,
                    DiscountPer
                } = Detail || {};

                sqlQuery += `
                    INSERT INTO bookingdetails (
                        BookingdetailUkeyID, BookingUkeyID, Name, Mobile, GST, Conviencefee, 
                        TicketCateUkeyId, flag, IpAddress, HostName, EntryDate, Amount, DiscAmt, 
                        IsVerify, BookingMode, VerifyMode, SeatNumber, MyEventzCharge, IsAmtMyEventCharge, TicketVerifyTime, RefCode, DiscountPer
                    ) VALUES (
                        ${setSQLStringValue(BookingdetailUkeyID)}, ${setSQLStringValue(BookingUkeyID)}, 
                        ${setSQLStringValue(Name)}, ${setSQLStringValue(Mobile)}, 
                        ${setSQLDecimalValue(GST)}, ${setSQLDecimalValue(Conviencefee)}, 
                        ${setSQLStringValue(TicketCateUkeyId)}, ${setSQLStringValue(flag)}, 
                        ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, 
                        ${setSQLStringValue(EntryTime)}, ${setSQLDecimalValue(Amount)}, 
                        ${setSQLDecimalValue(DiscAmt)}, ${setSQLStringValue(IsVerify)}, 
                        ${setSQLStringValue(BookingMode)}, ${setSQLStringValue(VerifyMode)}, 
                        ${setSQLStringValue(SeatNumber)}, ${setSQLDecimalValue(MyEventzCharge)}, 
                        ${setSQLBooleanValue(IsAmtMyEventCharge)}, ${setSQLDateTime(TicketVerifyTime)}, 
                        ${setSQLStringValue(RefCode)}, ${setSQLDecimalValue(DiscountPer)}
                    );
                `;
            }
        }

        const coupon = await transaction.request().query(`SELECT Discount, CouponCode, IswalletAdd, WalletAmt FROM CouponMaster WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)} AND flag <> 'D' AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND IsActive = 1`);
        
        // When user uses wallet Amount
        if (IsWalletUsed) {
            sqlQuery += `
                INSERT INTO WalletMaster (
                    TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
                ) VALUES (
                    ${setSQLStringValue(TrnUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, 'BOOKING', ${setSQLStringValue(TrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, 0, ${setSQLDecimalValue(UsedWalletAmt)}, ${coupon.recordset?.[0]?.Discount || 0}, 'INR', 1, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLNumberValue(bookingdetails.length)}, ${setSQLDecimalValue(TotalGST)}, ${setSQLDecimalValue(TotalNetAmount)}
                )
            `;
        }

        // Handle coupon wallet addition
        if (coupon?.recordset?.length > 0) {
            const { IswalletAdd, WalletAmt, CouponCode } = coupon.recordset[0];
            if (IswalletAdd == true) {
                const numResult = await transaction.request().query(`SELECT ISNULL(MAX(CONVERT(BIGINT, TrnNo)), 0) + 1 AS TrnNo FROM WalletMaster WITH (NOLOCK) WHERE Trnmode = ${setSQLStringValue(CouponCode)}`);
                let couponTrnNo = (numResult.recordset[0].TrnNo).toString();
                
                sqlQuery += `
                    INSERT INTO WalletMaster (
                        TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
                    ) VALUES (
                        NEWID(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(CouponCode)}, ${setSQLStringValue(couponTrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, ${setSQLNumberValue(WalletAmt)}, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 1, 0, 0
                    )
                `;
            }
        }

        // Handle seat booking logic BEFORE executing the main query
        const eventQuery = `SELECT SeatArrangment FROM EventMaster WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
        const eventResult = await transaction.request().query(eventQuery);
        
        if (eventResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json(errorMessage('Event not found'));
        }

        const { SeatArrangment } = eventResult.recordset[0];
        if (SeatArrangment === true) {
            const findJsonFileQuery = `
                SELECT JsonFile 
                FROM CanvasSeatingFile 
                WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
                AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            `;

            const findJsonFileResult = await transaction.request().query(findJsonFileQuery);
            if (findJsonFileResult.recordset.length > 0) {
                
                const jsonFile = findJsonFileResult.recordset[0].JsonFile;
                const jsonFilePath = `./media/CanvasSeating/${jsonFile}`;
                
                try {
                    if (!fs.existsSync(jsonFilePath)) {
                        await transaction.rollback();
                        return res.status(404).json(errorMessage('JSON file does not exist'));
                    }

                    const jsonData = JSON.parse(await fs.promises.readFile(jsonFilePath, 'utf8'));
                    const splitOfSeats = bookingdetails
                        .map(ticket => ticket.SeatNumber)
                        .filter(seat => seat);

                    const alreadySeatBookedStatus = [];
                    jsonData.theater.seats = jsonData.theater.seats.map(seat => {
                        if (splitOfSeats.includes(seat.id) && seat.status === 'booked') {
                            alreadySeatBookedStatus.push(seat.id);
                        }
                        if (splitOfSeats.includes(seat.id)) {
                            return { ...seat, status: 'booked' };
                        }
                        return seat;
                    });

                    if (alreadySeatBookedStatus.length > 0) {
                        await transaction.rollback();
                        return res.status(400).json(errorMessage(`Seats ${alreadySeatBookedStatus.join(', ')} already booked`));
                    }

                    await fs.promises.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
                } catch (fileError) {
                    await transaction.rollback();
                    return res.status(500).json(errorMessage(`File operation error: ${fileError.message}`));
                }
            }
        }

        // Execute the main SQL query ONLY ONCE
        const result = await transaction.request().query(sqlQuery);
        
        if (result?.rowsAffected?.reduce((sum, val) => sum + val, 0) === 0) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('No booking entry created'));
        }

        // WhatsApp messages for successful payment
        if (PaymentStatus === 'Success' && setSQLBooleanValue(IsWhatsapp)) {
            allMobiles = [...new Set(allMobiles)]; // Remove duplicates

            if (allMobiles.length > 0) {
                const bookingmastQuery = `
                    SELECT o.OrganizerName, e.EventName, e.StartEventDate 
                    FROM Bookingmast bm
                    LEFT JOIN OrganizerMaster o ON o.OrganizerUkeyId = bm.OrganizerUkeyId
                    LEFT JOIN EventMaster e ON e.EventUkeyId = bm.EventUkeyId
                    WHERE bm.BookingUkeyID = '${BookingUkeyID}'
                `;
                const bookingmastResult = await transaction.request().query(bookingmastQuery);

                if (bookingmastResult.recordset.length > 0) {
                    console.log(bookingmastResult);
                    
                    const { EventName, StartEventDate } = bookingmastResult.recordset[0];
                    
                    for (const mobile of allMobiles) {
                        const date = new Date(StartEventDate);
                        const day = date.getUTCDate();
                        const month = date.getUTCMonth();
                        const year = date.getUTCFullYear();
                        const hours = date.getUTCHours();
                        const minutes = date.getUTCMinutes();

                        const monthNames = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ];

                        const formattedDate = `${day} ${monthNames[month]} ${year}, ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

                        const message = `🎉 Your Ticket is Confirmed!\n\nThank you for booking *${EventName}* with My Eventz 🌟\n\n📅 Event Date: ${formattedDate}\n🎟️ View Your Ticket: ${FRONTED_ORGANIZER_URL}/ticket-booking/download/${BookingUkeyID}\n\nWe look forward to seeing you there! 🎊`;
                        
                        await transaction.request()
                            .input('OrganizerUkeyId', OrganizerUkeyId)
                            .input('EventUkeyId', EventUkeyId)
                            .input('BookingUkeyID', BookingUkeyID)
                            .input('message', message)
                            .input('mobile', mobile)
                            .query(`
                                INSERT INTO WhatsAppMessages (OrganizerUkeyId, EventUkeyId, BookingUkeyID, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) 
                                VALUES (@OrganizerUkeyId, @EventUkeyId, @BookingUkeyID, @message, @mobile, 0, 'Booking', 1, GETDATE())
                            `);
                    }
                }
            }
        }

        await transaction.commit();

        // Background processes (emails and notifications) - same as your original code
       if(PaymentStatus == 'Success'){
            // Background email processing
            // setImmediate(async () => {
            //     try {
            //         const userDetailsQuery = `SELECT * FROM UserMaster WHERE UserUkeyID = ${setSQLStringValue(UserUkeyID)}`;
            //         const userDetails = await pool.request().query(userDetailsQuery);
                    
            //         if (userDetails?.recordset?.length > 0) {
            //             const { Email, Mobile1, FullName = 'User' } = userDetails.recordset[0];
            //             if (Email) {
            //                 const EventDetailsQuery = `
            //                     SELECT am.Address1, am.Address2, am.StateName, am.CityName, am.Pincode, 
            //                            em.EventName, em.StartEventDate, em.OrganizerUkeyId, om.OrganizerName, 
            //                            om.Mobile1, om.Mobile2 
            //                     FROM EventMaster em
            //                     LEFT JOIN AddressMaster am ON am.AddressUkeyID = em.AddressUkeyID
            //                     LEFT JOIN OrganizerMaster om ON om.OrganizerUkeyId = em.OrganizerUkeyId
            //                     WHERE em.EventUkeyId = ${setSQLStringValue(EventUkeyId)} 
            //                     AND am.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            //                 `;
    
            //                 const EventDetails = await pool.request().query(EventDetailsQuery);
            //                 if (EventDetails?.recordset?.length > 0) {
            //                     const { EventName, StartEventDate, Address1, Address2, StateName, CityName, Pincode, OrganizerName, Mobile1, Mobile2 } = EventDetails.recordset[0];
            //                     const address = [Address1, Address2, CityName, StateName, Pincode].filter(Boolean).join(', ');
            //                     const ticketReport = `https://report.taxfile.co.in/report/TicketPrint?BookingUkeyID=${BookingUkeyID}&ExportMode=PDF`;
    
            //                     try {
            //                         const responseTicketBookingEnglish = await sendEmailUserTickets(
            //                             Email, FullName, EventName,
            //                             moment.utc(StartEventDate).format("dddd, MMMM Do YYYY"),
            //                             address, ticketReport, Mobile1, Mobile2, OrganizerName
            //                         );
    
            //                         await pool.request().query(`
            //                             INSERT INTO EmailLogs (
            //                                 OrganizerUkeyId, EventUkeyId, UkeyId, Category, Language, Email, 
            //                                 IsSent, UserUkeyId, IpAddress, HostName, EntryTime, flag
            //                             ) VALUES (
            //                                 ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
            //                                 ${setSQLStringValue(generateUUID())}, 'TICKET_BOOKING', 'ENGLISH',
            //                                 ${setSQLStringValue(Email)}, ${setSQLBooleanValue(responseTicketBookingEnglish)},
            //                                 ${setSQLStringValue(UserUkeyID)}, ${setSQLStringValue(IPAddress)},
            //                                 ${setSQLStringValue(ServerName)}, GETDATE(), 'A'
            //                             )
            //                         `);
            //                     } catch (emailError) {
            //                         console.error('Error sending English email:', emailError);
            //                     }
    
            //                     try {
            //                         const responseTicketBookingHindi = await sendEmailUserTicketsHindi(
            //                             Email, FullName, EventName,
            //                             moment.utc(StartEventDate).format("dddd, MMMM Do YYYY"),
            //                             address, ticketReport, Mobile1, Mobile2, OrganizerName
            //                         );
    
            //                         await pool.request().query(`
            //                             INSERT INTO EmailLogs (
            //                                 OrganizerUkeyId, EventUkeyId, UkeyId, Category, Language, Email, 
            //                                 IsSent, UserUkeyId, IpAddress, HostName, EntryTime, flag
            //                             ) VALUES (
            //                                 ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
            //                                 ${setSQLStringValue(generateUUID())}, 'TICKET_BOOKING', 'HINDI',
            //                                 ${setSQLStringValue(Email)}, ${setSQLBooleanValue(responseTicketBookingHindi)},
            //                                 ${setSQLStringValue(UserUkeyID)}, ${setSQLStringValue(IPAddress)},
            //                                 ${setSQLStringValue(ServerName)}, GETDATE(), 'A'
            //                             )
            //                         `);
            //                     } catch (emailError) {
            //                         console.error('Error sending Hindi email:', emailError);
            //                     }
            //                 }
            //             }
            //         }
            //     } catch (error) {
            //         console.error('Error in background email job:', error);
            //     }
            // });
    
            // Background notification processing
            setImmediate(async () => {
                try {
                    const userMobileDeviceQuery = `
                        SELECT UserUkeyID, DeviceUkeyId, Log_In, NotificationToken 
                        FROM user_devices 
                        WHERE UserUkeyId = ${setSQLStringValue(UserUkeyID)} 
                        AND Log_In = 1 AND DeviceType != 'web'
                    `;
    
                    const resultOfUserMobileDevice = await pool.request().query(userMobileDeviceQuery);
    
                    if (resultOfUserMobileDevice?.recordset?.length > 0) {
                        await Promise.all(resultOfUserMobileDevice.recordset.map(async (device) => {
                            const { NotificationToken } = device;
                            try {
                                await sentNotificationOnSetTime({
                                    body: {
                                        Title: "Your Ticket Booked Successfully!",
                                        Description: "You can view your tickets here.",
                                        NotificationToken,
                                        Image: "",
                                        Link: `/MyBookingScreen?BookingUkeyID=${BookingUkeyID}&UserUkeyID=${UserUkeyID}`
                                    }
                                });
                            } catch (notificationError) {
                                console.error('Error sending notification:', notificationError);
                            }
                        }));
                    }
                } catch (error) {
                    console.error('Error in background notification job:', error);
                }
            });
        }


        return res.status(200).json({
            ...successMessage('Booking Entry Created Successfully'),
            ...req.body,
            TrnUkeyId,
            DetailUkeyid,
            TrnNo
        });

    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        console.error('Booking Error:', error);
        return res.status(500).json(errorMessage(`Server error: ${error.message}`));
    }
};

const RemoveBookings = async (req, res) => {
    try {
        const { BookingUkeyID, EventUkeyId, OrganizerUkeyId } = req.query;
        // Check if required keys are missing
        const missingKeys = checkKeysAndRequireValues(['BookingUkeyID', 'EventUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        // Execute the DELETE query
        const deleteQuery = `
            update Bookingmast set flag = 'D' WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
            update Bookingdetails set flag = 'D' WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyID)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Booking Entry Deleted.') });
        }

        // Return success response
        return res.status(200).json({ ...successMessage('Booking Entry Deleted Successfully.'), ...req.query });
    } catch (error) {
        console.log('Delete Booking Entry Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

const VerifyTicket = async (req, res)=> {
    try{
        const {BookingUkeyID, EventUkeyId, OrganizerUkeyId, UserUkeyID, IsWhatsapp = null, IsVerify = true, BookingCode = '', VerifiedByUkeyId = '', VerifyMode = ''} = req.query;
        const missingKeys = checkKeysAndRequireValues(['BookingUkeyID', 'EventUkeyId', 'OrganizerUkeyId', 'UserUkeyID'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const IsTicketBooked = await pool.request().query(`select IsVerify from Bookingmast where BookingUkeyID = ${setSQLStringValue(BookingUkeyID)} and EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} and UserUkeyID = ${setSQLStringValue(UserUkeyID)} and BookingCode = ${setSQLStringValue(BookingCode)}`)

        if(IsTicketBooked.recordset[0].IsVerify){
            return res.status(400).json({...errorMessage(`Ticket already verifed`), verify : false})
        }

        const result = await pool.request().query(`
            exec SP_VerifyTicket
            @BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}, @EventUkeyId = ${setSQLStringValue(EventUkeyId)}, @OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}, @UserUkeyID = ${setSQLStringValue(UserUkeyID)}, @IsWhatsapp = ${setSQLBooleanValue(IsWhatsapp )}, @IsVerify = ${setSQLBooleanValue(IsVerify)}, @BookingCode = ${setSQLStringValue(BookingCode)}, @VerifiedByUkeyId = ${setSQLStringValue(VerifiedByUkeyId)}, @VerifyMode = ${setSQLStringValue(VerifyMode)}
        `)
        
        return res.status(200).json({...successMessage('Ticket Verifed successfully.'), verify : true});
    }catch(error){
        console.log('verify user ticket :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}
const UserMultipleVerifyTicket = async (req, res) => {
    try {
        const {
            BookingUkeyID,
            EventUkeyId,
            OrganizerUkeyId,
            UserUkeyID,
            IsWhatsapp = null,
            IsVerify = true,
            VerifiedByUkeyId = '',
            VerifyMode = ''
        } = req.query;

        const missingKeys = checkKeysAndRequireValues(['BookingUkeyID', 'EventUkeyId', 'OrganizerUkeyId', 'UserUkeyID'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const bookingIdsArray = BookingUkeyID.split(',').map(id => `'${id.trim()}'`).join(',');

        const multipleQuery = `
            SELECT BookingUkeyID, IsVerify, BookingCode
            FROM Bookingmast 
            WHERE BookingUkeyID IN (${bookingIdsArray})
              AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
              AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
              AND UserUkeyID = ${setSQLStringValue(UserUkeyID)}
        `

        // Get verification status for all IDs
        const result = await pool.request().query(multipleQuery);

        const unverifiedTickets = result.recordset.filter(row => !row.IsVerify);

        if (unverifiedTickets.length === 0) {
            return res.status(400).json({ ...errorMessage(`All tickets already verified.`), verify: false });
        }

        // Call SP for each unverified BookingUkeyID
        for (const ticket of unverifiedTickets) {
            const bookingId = ticket.BookingUkeyID;

            await pool.request().query(`
                EXEC SP_VerifyTicket
                @BookingUkeyID = ${setSQLStringValue(bookingId)},
                @EventUkeyId = ${setSQLStringValue(EventUkeyId)},
                @OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)},
                @UserUkeyID = ${setSQLStringValue(UserUkeyID)},
                @IsWhatsapp = ${setSQLBooleanValue(IsWhatsapp)},
                @IsVerify = ${setSQLBooleanValue(IsVerify)},
                @BookingCode = ${setSQLStringValue(ticket.BookingCode)},
                @VerifiedByUkeyId = ${setSQLStringValue(VerifiedByUkeyId)},
                @VerifyMode = ${setSQLStringValue(VerifyMode)}
            `);
        }

        return res.status(200).json({
            ...successMessage(`Verified ${unverifiedTickets.length} ticket(s) successfully.`),
            verify: true,
            verifiedBookingIDs: unverifiedTickets.map(t => t.BookingUkeyID)
        });

    } catch (error) {
        console.log('verify user ticket:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};


const verifyTicketOnBookingDetailsUKkeyId = async (req, res) => {
    try{
        const {BookingdetailUkeyIDs, VerifiedByUkeyId, VerifyMode} = req.body;

        const missingKeys = checkKeysAndRequireValues(['BookingdetailUkeyIDs', 'VerifiedByUkeyId'], req.body);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const BookingdetailUkeyIDsArray = BookingdetailUkeyIDs?.split(',')

        for (const BookingdetailUkeyID of BookingdetailUkeyIDsArray) {
            await pool.request().query(`update Bookingdetails set IsVerify = 1, VerifiedByUkeyId = ${setSQLStringValue(VerifiedByUkeyId)}, VerifyMode = ${setSQLStringValue(VerifyMode)}, TicketVerifyTime = GETDATE() where BookingdetailUkeyID = ${setSQLStringValue(BookingdetailUkeyID)}`)
        }

        return res.status(200).json({...successMessage('Ticket Verifed successfully.')});
    }catch(error){
        console.log('verify user ticket by booking detial UkeyId error :', error);
        return res.status(500).json(errorMessage(error.message))
    }
}

const TicketLimit = async( req, res)=> {
    try{
        const {
            EventUkeyid, UserUkeyid, TicketRequest
        } = req.query;
        // Get booking limit for the event
        const EventBookingUserLimit = await pool.request().query(`
            SELECT UserBookingLimit
            FROM EventMaster
            WHERE EventUkeyId = ${setSQLStringValue(EventUkeyid)}
            and flag <> 'D'
        `);

        const BookingUkeyuid = await pool.request().query(`
            SELECT BookingUkeyID
            FROM Bookingmast
            WHERE UserUkeyId = ${setSQLStringValue(UserUkeyid)}
            and EventUkeyId = ${setSQLStringValue(EventUkeyid)}
            and flag <> 'D'
            and PaymentStatus = 'Success'
        `);

        let BookedTicketCount = 0

        for (const BookingUkeyId of BookingUkeyuid.recordset) {
            const result = await pool.request().query( `
                SELECT COUNT(*) AS BookiedTicketCount
                FROM BookingDetails
                WHERE BookingUkeyID = ${setSQLStringValue(BookingUkeyId.BookingUkeyID)}
                and flag <> 'D'
            `);
            const existingCount = Number(result?.recordset?.[0]?.BookiedTicketCount ?? 0);
            BookedTicketCount += existingCount;
        }

        const maxAllowed = EventBookingUserLimit?.recordset?.[0]?.UserBookingLimit || 0;
        // New ticket count in current request
        const totalAfterThisBooking = Number(BookedTicketCount) + Number(TicketRequest);
        console.log(totalAfterThisBooking, BookedTicketCount, TicketRequest);
        if (totalAfterThisBooking > maxAllowed) {
            return res.status(400).json({...errorMessage(
                `On this Mobile Number Booking limit exceeded. You can book only ${maxAllowed} ticket${maxAllowed > 1 ? 's' : ''} for this event on this Mobile Number.`
            ),verify : false});
        }
        return res.json({...successMessage('You can Go for Booking Now'),verify : true});
    }catch(error){
        console.error('Error fetching bookings:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const ticketPrint = async (req, res) => {
    try{
        const {BookingUkeyID} = req.query;

        const result = await pool.request().query(`
            exec TicketPrint @BookingUkeyID = ${setSQLStringValue(BookingUkeyID)}
        `)

        return res.status(200).json({data : result.recordset})
    }catch(error){
        console.error('Error ticket print :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const velidateCouponInBooking = async (req, res)=> {
    try{
        const { 
            EventUkeyId,
            UserUkeyID,
            CouponUkeyId
        } = req.query;

        let whereConditions = [];

        // Build the WHERE clause based on the query parameters
        if (CouponUkeyId) {
            whereConditions.push(`CouponUkeyId = ${setSQLStringValue(CouponUkeyId)}`);
        }
        if (UserUkeyID) {
            whereConditions.push(`UserUkeyID = ${setSQLStringValue(UserUkeyID)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }

        whereConditions.push(`flag <> 'D'`);

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query definitions
        const result = await pool.request().query(`select count(*) as COUNT from Bookingmast ${whereString}`)
        
        const applied = result.recordset[0].COUNT === 0 ? true : false;
        return res.status(200).json({ ...successMessage(), Applied: applied });
    }catch(error){
        console.error('Error validate coupon :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchBookings,
    fetchBookingInfoById,
    BookingMaster,
    BookingMasterForCanvas,
    RemoveBookings,
    VerifyTicket,
    UserMultipleVerifyTicket,
    verifyTicketOnBookingDetailsUKkeyId,
    TicketLimit,
    ticketPrint,
    selftCheckList,
    velidateCouponInBooking
}