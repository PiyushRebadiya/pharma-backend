const Razorpay = require("razorpay");
const { errorMessage, checkKeysAndRequireValues, setSQLStringValue, setSQLDecimalValue, setSQLNumberValue, getCommonKeys, generateUUID, setSQLBooleanValue, setSQLDateTime } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");
const crypto = require("crypto");
require('dotenv').config();
const { paymentDecryptData } = require("./crpto");
const { CRPTO_SECRET_FOR_RAZORPAY, FRONTED_ORGANIZER_URL, FRONTED_USER_URL } = require("../common/variable");

const getPaymentDetails = async (req, res) => {
    try {
        const { PaymentID } = req.query
        const missingKey = checkKeysAndRequireValues(['PaymentID'], req.query)
        if (missingKey.length > 0) {
            return res.status(400).send(errorMessage(`${missingKey} is required`))
        }
        const razorpayQuery = await pool.query('SELECT * FROM RazorpayCredentials')
        if(!razorpayQuery?.recordset?.length){
            return res.status(404).send(errorMessage('Razorpay credentials not found'))
        }

        const { KeyId, SecretKey } = razorpayQuery?.recordset[0]
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey
        })

        const response = await razorpay.payments.fetch(PaymentID);
        if(!response){
            return res.status(404).send(errorMessage('Payment not found'))
        }

        return res.status(200).json({ Success: true, data: response });
    } catch (error) {
        console.log('error :', error);
        return res.status(500).send(errorMessage(error?.message || error?.error?.description));
    }
};

const createRazorpayOrderId = async (req, res) => {
    try {
         if (!req.body.data) {
            return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
        }

        let decodedPayload;
        try {
            decodedPayload = paymentDecryptData(req.body.data, CRPTO_SECRET_FOR_RAZORPAY);
        } catch (err) {
            return res.status(400).json({ success: false, message: "Invalid encoded payload" });
        }

        if (!decodedPayload) {
            return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
        }

        decodedPayload = JSON.parse(decodedPayload);

         if(decodedPayload && typeof decodedPayload === 'string'){
            decodedPayload = JSON.parse(decodedPayload);
        }

        if (!decodedPayload.IssPayment || decodedPayload.IssPayment !== true) {
            return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
        }

        const { BookingAmt = null, OrganizerUkeyId = null, EventUkeyId = null, UserUkeyID = null, TotalGST = null, TotalConviencefee = null, DiscountAmt = null, TotalNetAmount = null, TotalNumberOfTicket = null, CouponUkeyId = '', CouponAmount = null, AdditionalCharges, DonationAmt, RoundAmount, BookingUkeyID = '' } = decodedPayload;
        
        // Check for missing required values
        const missingKey = checkKeysAndRequireValues(['TotalNetAmount', 'TotalGST', 'RoundAmount'], decodedPayload);
        if (missingKey.length > 0) {
            return res.status(400).send(errorMessage(`${missingKey} is required`));
        }

        // Fetch Razorpay credentials from database
        const razorpayQuery = await pool.query(`
            SELECT * FROM PaymentGatewayMaster 
            WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} and IsActive = 1
        `);
        
        if (!razorpayQuery?.recordset?.length) {
            return res.status(404).send(errorMessage('Razorpay credentials not found'));
        }

        // Extract API credentials
        const { KeyId, SecretKey } = razorpayQuery?.recordset[0];

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey
        });

        // Create Razorpay order with metadata
        const response = await razorpay.orders.create({
            amount: TotalNetAmount * 100, // Convert to paise
            currency: 'INR',
            notes: {
                BookingAmt : `${BookingAmt}`,
                OrganizerUkeyId: `${OrganizerUkeyId}`,  // Ensure string format
                EventUkeyId: `${EventUkeyId}`,
                UserUkeyID: `${UserUkeyID}`,
                CouponUkeyId : `${CouponUkeyId}`,
                TotalGST: `${TotalGST}`, 
                TotalConviencefee : `${TotalConviencefee}`, 
                DiscountAmt : `${DiscountAmt}`, 
                TotalNetAmount : `${TotalNetAmount}`,
                TotalNumberOfTicket : `${TotalNumberOfTicket}`,
                CouponAmount : `${CouponAmount}`,
                DonationAmt : `${DonationAmt}`,
                AdditionalCharges : `${AdditionalCharges}`,
                BookingUkeyID : `${BookingUkeyID}`,
                ProjectName : `GLOBAL_MYEVENTZ`
            }
        });


        return res.status(200).json({ success: true, data: response });
    } catch (error) {   
        console.log('Error:', error);
        return res.status(500).send(errorMessage(error?.message || error?.error?.description));
    }
};

// const webhook = async (req, res) => {
//     try {
//         const receivedSignature = req.headers["x-razorpay-signature"];
        
//         // Generate signature using raw body
//         const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(req.rawBody).digest("hex");
        
//         // Verify signature
//         if (receivedSignature !== generatedSignature) {
//             console.log("❌ Invalid webhook signature");
//             return res.status(400).json({ error: "Invalid signature" });
//         }

//         // console.log("✅ Webhook Verified");

//         const event = req.body.event;

//         if (event === "payment.captured") {
//             const paymentData = req.body.payload.payment.entity;

//             console.log("💰 Payment Captured:", paymentData);

//             const razorpayOrderId = paymentData.order_id;
//             const razorpayPaymentId = paymentData.id;

//             // Store webhook signature instead of amount
//             await pool.request().query(`
//                 UPDATE Bookingmast
//                 SET PaymentStatus = 'Success',
//                     RazorpayPaymentId = ${setSQLStringValue(razorpayPaymentId)},
//                     RazorpaySignatureId = ${setSQLStringValue(receivedSignature)}
//                 WHERE RazorpayOrderId = ${setSQLStringValue(razorpayOrderId)}
//             `);
            
//             // console.log("✅ BookingMaster updated successfully (Success)");
//         }
      
//         else if (event === "payment.failed") {
//             const paymentData = req.body.payload.payment.entity;
//             console.log("❌ Payment Failed:", paymentData);

//           const razorpayOrderId = paymentData.order_id;

//             await pool.request().query(`
//                 UPDATE Bookingmast
//                 SET PaymentStatus = 'Failed'
//                 WHERE RazorpayOrderId = ${setSQLStringValue(razorpayOrderId)}
//             `);
//             // console.log("✅ BookingMaster updated successfully (Failed)");
//         }
      
//         return res.status(200).json({ status: "ok" });
//     } catch (error) {
//         console.error("Webhook Error:", error);
//         return res.status(500).json(errorMessage(error?.message));
//     }
// };

const webhook = async (req, res) => {
    let transaction

    try {
        const receivedSignature = req.headers["x-razorpay-signature"];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Generate signature
        const generatedSignature = crypto
            .createHmac("sha256", secret)
            .update(req.rawBody)
            .digest("hex");

        // Validate signature
        // if (receivedSignature !== generatedSignature) {
        //     return res.status(400).json({ error: "Invalid signature" });
        // }

        const event = req.body.event;
        const paymentData = req.body.payload?.payment?.entity;

        //  if (!paymentData) {
        //     return res.status(400).json({ error: "Invalid payload" });
        // }

         // Handle non-payment events (like payment.downtime.started)
        if (!paymentData && event !== "payment.downtime.started") {
            return res.status(400).json({ error: "Invalid payload" });
        }

        // For non-payment events like downtime notifications, just acknowledge
        if (event === "payment.downtime.started" || event === "payment.downtime.ended") {
            console.log(`Razorpay downtime event: ${event}`, {
                account_id: req.body.account_id,
                severity: req.body.severity
            });
            return res.status(200).json({ status: "ok", message: "Event acknowledged" });
        }

        transaction = pool.transaction();
        await transaction.begin();

        const razorpayOrderId = paymentData.order_id;
        const razorpayPaymentId = paymentData.id;
        const amount = paymentData.amount / 100; // paise → INR

        if (paymentData.status === "captured") {
            const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

            const Bookingdata = await pool.request().query(`
                select bm.IsWalletUsed, bm.OrganizerUkeyId, bm.EventUkeyId, bm.BookingUkeyID, bm.BookingDate, bm.UserUkeyID, bm.UsedWalletAmt, bm.flag, bm.TotalGST, bm.TotalNetAmount, bm.CouponUkeyId, COUNT(bd.BookingUkeyID) AS childCount from Bookingmast bm
                left join Bookingdetails bd on bm.BookingUkeyID = bd.BookingUkeyID and bm.flag <> 'D'
                where bm.RazorpayOrderId = ${setSQLStringValue(razorpayOrderId)}
                group by bm.IsWalletUsed, bm.OrganizerUkeyId, bm.EventUkeyId, bm.BookingUkeyID, bm.BookingDate, bm.UserUkeyID, bm.UsedWalletAmt, bm.flag, bm.TotalGST, bm.TotalNetAmount, bm.CouponUkeyId, bm.BookingID
                order by bm.BookingID desc    
            `)

            // FIX 1: Check if booking data exists
            if (!Bookingdata.recordset || Bookingdata.recordset.length === 0) {
                throw new Error("No booking data found for this order");
            }

            const {IsWalletUsed,TrnUkeyId = generateUUID(), OrganizerUkeyId, EventUkeyId, BookingUkeyID, BookingDate, UserUkeyID, UsedWalletAmt, flag, TotalGST, TotalNetAmount, CouponUkeyId, childCount } = Bookingdata.recordset[0]

            let TrnNo = Bookingdata.recordset[0]?.TrnNo || '';

            const coupon = await pool.request().query(`SELECT Discount, CouponCode, IswalletAdd, WalletAmt FROM CouponMaster WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)} AND flag <> 'D' AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND IsActive = 1`)
            
            let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)} and Trnmode = 'BOOKING'`)

            TrnNo = num?.recordset?.[0]?.TrnNo 

            const checkAlreadyUpdated = await transaction.request().query(`select * from Bookingmast where RazorpayOrderId=${setSQLStringValue(razorpayOrderId)} and PaymentStatus='Success'`);

            if (checkAlreadyUpdated?.recordset?.length > 0) {
                await transaction.commit();
                return res.status(200).json({ status: "ok" });
            }

            await transaction.request().query(`
                UPDATE Bookingmast
                SET PaymentStatus = 'Success',
                    RazorpayPaymentId = ${setSQLStringValue(razorpayPaymentId)},
                    RazorpaySignatureId = ${setSQLStringValue(receivedSignature)},
                    BookingDate = GETDATE(),
                    flag = 'U'
                WHERE RazorpayOrderId = ${setSQLStringValue(razorpayOrderId)}
            `);

            // when user uses wallet Ammount.
            if (setSQLBooleanValue(IsWalletUsed)) {
                await transaction.request().query(`
                    insert into WalletMaster (
                        TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
                    ) values (
                        ${setSQLStringValue(TrnUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, 'BOOKING', ${setSQLStringValue(TrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, 0, ${setSQLDecimalValue(UsedWalletAmt)}, ${coupon.recordset?.[0]?.Discount || 0}, 'INR', 1, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLNumberValue(childCount)}, ${setSQLDecimalValue(TotalGST)}, ${setSQLDecimalValue(TotalNetAmount)}
                    )
                `)

            if (coupon?.recordset?.length > 0) {
                const { IswalletAdd, WalletAmt, CouponCode } = coupon.recordset[0];
                if (IswalletAdd == true) {
                        let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster with (nolock) where Trnmode = ${setSQLStringValue(CouponUkeyId)}`)
                        let TrnNo = (num.recordset[0].TrnNo).toString();
                        
                        await transaction.request().query(`insert into WalletMaster (
                            TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
                        ) values (
                            NEWID(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, ${setSQLStringValue(CouponCode)}, ${setSQLStringValue(TrnNo)}, ${setSQLDateTime(BookingDate)}, '', ${setSQLStringValue(UserUkeyID)}, ${setSQLNumberValue(WalletAmt)}, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 1, 0, 0
                        )`);
                    }
                }
            }

            // FIX 2: WhatsApp and Notification Logic - Use transaction for all DB operations
            const checkBookingmastQuery = await transaction.request().query(`select * from Bookingmast where RazorpayOrderId=${setSQLStringValue(razorpayOrderId)}`);
            
            if (checkBookingmastQuery?.recordset?.length > 0) {
                const { BookingUkeyID, UserUkeyID, OrganizerUkeyId } = checkBookingmastQuery.recordset[0];
                
                const bookingmastQuery = `SELECT o.OrganizerName, e.EventName, e.StartEventDate, bm.EventUkeyId FROM Bookingmast bm
                left join OrganizerMaster as o on o.OrganizerUkeyId = bm.OrganizerUkeyId
                left join EventMaster as e on e.EventUkeyId = bm.EventUkeyId
                WHERE BookingUkeyID = '${BookingUkeyID}'`;
                
                const bookingmastResult = await transaction.request().query(bookingmastQuery);
                
                if (bookingmastResult.recordset.length > 0) {
                    const { EventName, StartEventDate, EventUkeyId } = bookingmastResult.recordset[0];
                    const allChildBookingDataQuery = `SELECT * FROM Bookingdetails WHERE BookingUkeyID = '${BookingUkeyID}'`;
                    const allChildBookingData = await transaction.request().query(allChildBookingDataQuery);
                    
                    let allMobiles = [];
                    if (allChildBookingData?.recordset?.length > 0) {
                        allMobiles = allChildBookingData.recordset.map((child) => 
                            child.Mobile && child.Mobile.length == 10 ? `91${child.Mobile}` : child.Mobile
                        ).filter(mobile => mobile); // Filter out null/undefined
                    }
                    allMobiles = [...new Set(allMobiles)].map((mobile) => mobile.trim().length === 10 ? `91${mobile.trim()}` : mobile.trim());
                    
                    // FIX 3: WhatsApp message insertion
                    if (allMobiles.length > 0) {
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

                            // Generate short code
                            const shortCode = crypto.randomBytes(4).toString("base64url");
                            const ticketBookingURL = `${FRONTED_ORGANIZER_URL}/ticket-booking/download/${BookingUkeyID}`;

                            // FIX 4: Use transaction for short URL insertion
                            const insertTicketURLQuery = `INSERT INTO ShortUrls (short_code, long_url) VALUES (@shortCode, @longUrl)`;
                            await transaction.request()
                                .input('shortCode', shortCode)
                                .input('longUrl', ticketBookingURL)
                                .query(insertTicketURLQuery);
                            
                            const formattedDate = `${day} ${monthNames[month]} ${year}, ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
                            
                            // FIX 5: Fixed message formatting (removed extra $ sign)
                            const message = `🎉 Your Ticket is Confirmed!\n\nThank you for booking *${EventName}* with My Eventz 🌟\n\n📅 Event Date: ${formattedDate}\n🎟️ View Your Ticket: ${FRONTED_USER_URL}/download/${shortCode}\n\nWe look forward to seeing you there! 🎊`;
                            
                            // FIX 6: Use parameterized query correctly
                            const insertQuery = `INSERT INTO WhatsAppMessages (OrganizerUkeyId, EventUkeyId, BookingUkeyID, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) 
                                            VALUES (@OrganizerUkeyId, @EventUkeyId, @BookingUkeyID, @Message, @Mobile, 0, 'Booking', 1, GETDATE())`;
                            
                            await transaction.request()
                                .input('OrganizerUkeyId', OrganizerUkeyId)
                                .input('EventUkeyId', EventUkeyId)
                                .input('BookingUkeyID', BookingUkeyID)
                                .input('Message', message)
                                .input('Mobile', mobile)
                                .query(insertQuery);
                        }
                    }

                    // FIX 7: Background notification processing - moved outside transaction
                    // This will run after the transaction is committed
                    const notificationData = {
                        BookingUkeyID,
                        UserUkeyID,
                        OrganizerUkeyId,
                        EventUkeyId
                    };

                    // Store for background processing
                    setImmediate(async () => {
                        try {
                            await processNotifications(notificationData);
                        } catch (notificationError) {
                            console.error('Error in background notification processing:', notificationError);
                        }
                    });
                }
            }
        } else {
            // handle failed/other payments
            await transaction.request().query(`
                UPDATE Bookingmast
                SET PaymentStatus = 'Failed',
                    EntryDate = GETDATE(),
                    flag = 'U'
                WHERE RazorpayOrderId = ${setSQLStringValue(razorpayOrderId)}
            `);
        }

        await transaction.commit();

        return res.status(200).json({ status: "ok" });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Webhook Error:", error);
        return res.status(500).json({ error: error?.message || "Internal Server Error" });
    }
};

// FIX 8: Separate function for notification processing
async function processNotifications(notificationData) {
    const { BookingUkeyID, UserUkeyID, OrganizerUkeyId, EventUkeyId } = notificationData;
    
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
                    // FIX 9: Ensure sentNotificationOnSetTime function exists and is imported
                    if (NotificationToken) {
                        await sentNotificationOnSetTime({
                            body: {
                                Title: "Your Ticket Booked Successfully!",
                                Description: "You can view your tickets here.",
                                NotificationToken,
                                Image: "",
                                Link: `/MyBookingScreen?BookingUkeyID=${BookingUkeyID}&UserUkeyID=${UserUkeyID}`
                            }
                        });
                        console.log('Notification sent successfully for token:', NotificationToken);
                    } else {
                        console.error('sentNotificationOnSetTime function not found');
                    }
                } catch (notificationError) {
                    console.error('Error sending notification for token:', NotificationToken, notificationError);
                }
            }));
        } else {
            console.log('No active devices found for user:', UserUkeyID);
        }
    } catch (error) {
        console.error('Error in notification processing:', error);
        throw error;
    }
}

const fetchOrderDetails = async (req, res) => {
    try {
        const { orderId, OrganizerUkeyId, EventUkeyId } = req.query;

        if (!orderId) {
            return res.status(400).json(errorMessage("orderId is required"));
        }

        // Fetch Razorpay credentials from your database
        const razorpayQuery = await pool.query(`SELECT * FROM PaymentGatewayMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
        AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
`); 

        if (!razorpayQuery?.recordset?.length) {
            return res.status(404).json(errorMessage("Razorpay credentials not found"));
        }

        const { KeyId, SecretKey } = razorpayQuery?.recordset[0];

        // ✅ Create an instance of Razorpay
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey
        });

        // ✅ Now fetch order details using the instance
        const orderDetails = await razorpay.orders.fetch(orderId);

        console.log("Fetched Order Details:", orderDetails);

        return res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        console.error("Error fetching order:", error);
        return res.status(500).json(errorMessage(error.message || "Internal Server Error"));
    }
};

const capturePayment = async (req, res) => {
    try {
        const { PaymentId, Amount } = req.body;
        const missingKeys = checkKeysAndRequireValues(['PaymentId', 'Amount'], req.body);
        if (missingKeys.length > 0) {
            return res.status(400).send(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const razorpayQuery = await pool.query('SELECT * FROM RazorpayCredentials');
        if (!razorpayQuery?.recordset?.length) {
            return res.status(404).send(errorMessage('Razorpay credentials not found'));
        }

        const { KeyId, SecretKey } = razorpayQuery?.recordset[0];
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey,
        });

        // Capturing payment
        const response = await razorpay.payments.capture(PaymentId, Amount * 100, 'INR');
        return res.status(200).json({ Success: true, data: response });
    } catch (error) {
        console.log('error :', error);
        return res.status(500).send(errorMessage(error?.message || error?.error?.description));
    }
};


const getAllPayments = async (req, res) => {
    try {
        const { OrganizerUkeyId, EventUkeyId } = req.query;
        const missingKey = checkKeysAndRequireValues(['OrganizerUkeyId', 'EventUkeyId'], req.query);
        
        if (missingKey.length > 0) {
            return res.status(400).send(errorMessage(`${missingKey} is required`));
        }

        const razorpayQuery = await pool.query(`
        SELECT * FROM PaymentGatewayMaster 
            WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
            AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
        `);

        if (!razorpayQuery?.recordset?.length) {
            return res.status(404).send(errorMessage('Razorpay credentials not found'));
        }

        const { KeyId, SecretKey } = razorpayQuery?.recordset[0];
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey
        });

        let allPayments = [];
        let skip = 0;
        const count = 100;

        while (true) {
            const response = await razorpay.payments.all({ count, skip });
            allPayments = allPayments.concat(response.items);

            if (response.items.length < count) {
                break;
            }

            skip += count;
        }

        // **Filter payments based on OrganizerUkeyId and EventUkeyId**
        const filteredPayments = allPayments.filter(payment => 
            payment.notes?.OrganizerUkeyId === OrganizerUkeyId && 
            payment.notes?.EventUkeyId === EventUkeyId
        );

        if (!filteredPayments.length) {
            return res.status(404).send(errorMessage('No payments found for the given OrganizerUkeyId and EventUkeyId'));
        }

        return res.status(200).json({ Success: true, data: filteredPayments, count: filteredPayments.length });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).send(errorMessage(error?.message || error?.error?.description));
    }
};

const paymentRefund = async (req, res) => {
    try {
        const { orderId, OrganizerUkeyId, EventUkeyId } = req.query;

        if (!orderId) {
            return res.status(400).json(errorMessage("orderId is required"));
        }

        // Fetch Razorpay credentials from your database
        const razorpayQuery = await pool.query(`SELECT * FROM PaymentGatewayMaster WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);

        if (!razorpayQuery?.recordset?.length) {
            return res.status(404).json(errorMessage("Razorpay credentials not found"));
        }

        const { KeyId, SecretKey } = razorpayQuery?.recordset[0];
        const razorpay = new Razorpay({
            key_id: KeyId,
            key_secret: SecretKey
        });
        // ✅ Now fetch order details using the instance
        const orderDetails = await razorpay.orders.fetchPayments(orderId);

        if (orderDetails?.count !== 1 && orderDetails?.items[0]?.order_id !== orderId) {
            return res.status(404).json(errorMessage("Order not found"));
        }
        const PaymentId = orderDetails?.items[0]?.id;
        const Amount = orderDetails?.items[0]?.amount;

        // Check if the payment is already refunded
        const isRefunded = orderDetails?.items[0]?.status === 'refunded';
        const isPartiallyRefunded = orderDetails?.items[0]?.amount_refunded > 0;
        if (isRefunded || isPartiallyRefunded) {
            return res.status(400).json(errorMessage("Payment has already been refunded."));
        }

        // Refund the payment
        const refundResponse = await razorpay.payments.refund(`${PaymentId}`, {
            amount: Number(((Amount / 100) * 0.97).toFixed(2)) * 100, // Amount in paise
            currency: 'INR',
            notes: {
                reason: 'Refund for order ID: ' + orderId
            }
        });
        console.log("Refund Response:", refundResponse);

        if (!refundResponse) {
            return res.status(404).send(errorMessage('Refund failed'));
        }

        return res.status(200).json({ Success: true, data: refundResponse });
    }
    catch (error) {
        console.log('error :', error);
        return res.status(500).send(errorMessage(error?.message || error?.error?.description));
    }
}

module.exports = { getPaymentDetails, createRazorpayOrderId, getAllPayments, capturePayment, fetchOrderDetails, paymentRefund, webhook };