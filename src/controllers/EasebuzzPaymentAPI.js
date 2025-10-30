const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../sql/connectToDatabase');
const { checkKeysAndRequireValues, setSQLStringValue, getCommonKeys, errorMessage } = require('../common/main');
const { paymentDecryptData } = require('./crpto');
const { CRPTO_SECRET_FOR_EASEBUZZ, CRPTO_SECRET_FOR_EASEBUZZ_VERIFICATION, FRONTED_ORGANIZER_URL, FRONTED_USER_URL } = require('../common/variable');

let EASEBUZZ_CONFIG = {};
// Generate hash for Easebuzz initiation
function generateInitiationHash(data) {
    const hashString = `${EASEBUZZ_CONFIG.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${EASEBUZZ_CONFIG.salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
}

// Generate hash for callback verification
function generateCallbackHash(data) {
    const hashString = `${EASEBUZZ_CONFIG.salt}|${data.status}|||||||||||${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${EASEBUZZ_CONFIG.key}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
}

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Generates hash for status verification.
 * @param {string} txnid - Transaction Id.
 * @returns {string} - Hash String.
 */
/*******  a3a9e4a4-28d6-4158-b5c3-bcb539cd23e2  *******/function generateStatusHash(txnid) {
    const hashString = `${EASEBUZZ_CONFIG.key}|${txnid}|${EASEBUZZ_CONFIG.salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
}

const  initiatePaymentAPI =async (req, res) => {
    try {
        if (!req.body.data) {
            return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
        }

        let decodedPayload;
        try {
            decodedPayload = paymentDecryptData(req.body.data, CRPTO_SECRET_FOR_EASEBUZZ);
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

        const {
            txnid,
            amount,
            productinfo,
            phone,
            surl,
            furl,
            OrganizerUkeyId
        } = decodedPayload;

        if(!decodedPayload.firstname){
            decodedPayload.firstname = 'user';
        }

        if(!decodedPayload.email){
            decodedPayload.email = 'user@gmail.com';
        }

        const { email, firstname } = decodedPayload;

        const missingKeys = checkKeysAndRequireValues(['txnid', 'amount', 'productinfo', 'firstname', 'email', 'phone', 'surl', 'furl', 'OrganizerUkeyId'], decodedPayload);
        if(missingKeys.length > 0){
            return res.status(400).json({success: false, message: `${missingKeys.join(', ')} is Required`});
        }

        const orgQuery = `select * from PaymentGatewayMaster where OrganizerUkeyId = '${OrganizerUkeyId}' and IsActive = 1 and ShortName='EAZ'`;
        const orgResult = await pool.query(orgQuery);

        if(!orgResult || orgResult.recordset.length === 0){
            return res.status(400).json({
                success: false,
                message: 'Organizer not found'
            });
        }
        const orgData = orgResult.recordset[0];
        // Set Easebuzz configuration from organizer data
        const { GatewayName, ShortName, KeyId, payMode, salt, MID } = orgData;

        EASEBUZZ_CONFIG = {
            key: KeyId,
            salt,
            payMode,
            MID: MID || '', // Optional, include only if required by your setup
            url: payMode == 'test' ?  'https://testpay.easebuzz.in/payment/initiateLink' : 'https://pay.easebuzz.in/payment/initiateLink', // Default to test URL if not provided
            statusUrl: payMode == 'test' ? 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve' : 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve' // Default to test URL if not provided
        };

        // Prepare payment data
        const paymentData = new URLSearchParams();
        paymentData.append('key', EASEBUZZ_CONFIG.key);
        if (EASEBUZZ_CONFIG.MID) {
            paymentData.append('sub_merchant_id', EASEBUZZ_CONFIG.MID); // Add this line
        }
        paymentData.append('txnid', txnid);
        paymentData.append('amount', amount.toString());
        paymentData.append('productinfo', productinfo);
        paymentData.append('firstname', firstname);
        paymentData.append('email', email);
        paymentData.append('phone', phone || '');
        paymentData.append('surl', surl || `${req.protocol}://${req.get('host')}/success`);
        paymentData.append('furl', furl || `${req.protocol}://${req.get('host')}/failure`);
        paymentData.append('hash', generateInitiationHash({
            txnid, amount, productinfo, firstname, email
        }));

        // Make request to Easebuzz
        const response = await axios.post(EASEBUZZ_CONFIG.url, paymentData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Handle different response formats from Easebuzz
        let redirectUrl = null;
        let responseData = response.data;

        // Check if response is a string (could be HTML or JSON string)
        if (typeof responseData === 'string') {
            try {
                // Try to parse as JSON
                responseData = JSON.parse(responseData);
            } catch (e) {
                // If it's HTML, look for redirect URL in meta refresh or form action
                const metaRefreshMatch = responseData.match(/<meta[^>]*http-equiv="refresh"[^>]*url=([^"'>]+)/i);
                if (metaRefreshMatch && metaRefreshMatch[1]) {
                    redirectUrl = metaRefreshMatch[1];
                } else {
                    // Look for form action
                    const formActionMatch = responseData.match(/<form[^>]*action="([^"]*)"/i);
                    if (formActionMatch && formActionMatch[1]) {
                        redirectUrl = formActionMatch[1];
                    }
                }
            }
        }

        // If response is object, check for common redirect fields
        if (typeof responseData === 'object') {
            if (responseData.redirect_url) {
                redirectUrl = responseData.redirect_url;
            } else if (responseData.url) {
                redirectUrl = responseData.url;
            } else if (responseData.data && responseData.data.redirect_url) {
                redirectUrl = responseData.data.redirect_url;
            } else if (responseData.status === 1 && responseData.data) {
                // Easebuzz often returns status 1 with data containing redirect
                redirectUrl = responseData.data;
            }
        }

        if (redirectUrl) {
            res.json({
                success: true,
                redirectUrl: redirectUrl,
                transactionId: txnid,
                message: 'Payment initiated successfully',
                // redirectUrl: req.body.surl || `${req.protocol}://${req.get('host')}/success` // For reference
                // redirectUrl: `https://pay.easebuzz.in/pay/${response.data.data}` // For reference
                redirectUrl: payMode == 'test' ? `https://testpay.easebuzz.in/pay/${response.data.data}` : `https://pay.easebuzz.in/pay/${response.data.data}` // For reference
            });
        } else {
            // If no redirect URL found, return the raw response for debugging
            res.json({
                success: false,
                message: 'No redirect URL received from payment gateway',
                rawResponse: responseData,
                transactionId: txnid,
                redirectUrl: req.body.furl || `${req.protocol}://${req.get('host')}/failure` // Fallback to failure URL
            });
        }

    } catch (error) {
        console.error('Initiate payment error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.response?.data || error.message,
            transactionId: req.body.txnid || '',
            redirectUrl: req.body.furl || `${req.protocol}://${req.get('host')}/failure`
        });
    }
}


const paymentStatusVerificationAPI = async (req, res) => {
    let transaction;
    try {
        if (!req.body.data) {
            return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
        }

        let decodedPayload;
        try {
            decodedPayload = paymentDecryptData(req.body.data, CRPTO_SECRET_FOR_EASEBUZZ_VERIFICATION);
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

        const { txnid, OrganizerUkeyId } = decodedPayload;

        const missingKeys = checkKeysAndRequireValues(['txnid', 'OrganizerUkeyId'], decodedPayload);
        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const verifyStatus = `select PaymentStatus from Bookingmast where RazorpayOrderId='${txnid}'`;
        const verifyStatusResult = await pool.query(verifyStatus);
        if(verifyStatusResult?.recordset?.length > 0 && verifyStatusResult.recordset[0].PaymentStatus === 'Success'){
            return res.status(200).json({
                success: true,
                transactionId: txnid,
                status: 'success',
                message: 'Payment already verified successfully'
            });
        }               

        const orgQuery = `select * from PaymentGatewayMaster where OrganizerUkeyId = '${OrganizerUkeyId}' and IsActive = 1 and ShortName='EAZ'`;
        const orgResult = await pool.query(orgQuery);

        if(!orgResult || orgResult.recordset.length === 0){
            return res.status(400).json({
                success: false,
                message: 'Organizer not found'
            });
        }
        const orgData = orgResult.recordset[0];
        // Set Easebuzz configuration from organizer data
        const { GatewayName, ShortName, KeyId, payMode, salt, MID } = orgData;

        EASEBUZZ_CONFIG = {
            key: KeyId,
            salt,
            payMode,
            MID: MID || '', // Optional, include only if required by your setup
            url: payMode == 'test' ?  'https://testpay.easebuzz.in/payment/initiateLink' : 'https://pay.easebuzz.in/payment/initiateLink', // Default to test URL if not provided
            statusUrl: payMode == 'test' ? 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve' : 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve' // Default to test URL if not provided
        };

        // Prepare data for Easebuzz status API
        const statusData = new URLSearchParams();
        statusData.append('key', EASEBUZZ_CONFIG.key);
        statusData.append('txnid', txnid);
        statusData.append('hash', generateStatusHash(txnid));

        // Make request to Easebuzz status API with timeout
        const response = await axios.post(EASEBUZZ_CONFIG.statusUrl, statusData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            timeout: 10000, // 10 seconds timeout
        });

        // Parse the response safely
        const statusResponse = response.data;

        // Verify response structure
        if (!statusResponse || typeof statusResponse !== 'object') {
            return res.status(500).json({
                success: false,
                message: 'Invalid response from payment gateway',
                transactionId: txnid,
            });
        }

        // Check if status is successful based on the actual response structure
        if (statusResponse.status === true && statusResponse.msg && Array.isArray(statusResponse.msg) && statusResponse.msg.length > 0) {
            const transactionData = statusResponse.msg[0];

            if (transactionData.status) {
                // Begin transaction
                transaction = await pool.transaction();
                await transaction.begin();

                try {
                    const checkBookingmastQuery = await transaction.request().query(`select * from Bookingmast where OrganizerUkeyId='${OrganizerUkeyId}' and RazorpayOrderId='${txnid}'`);

                    if (checkBookingmastQuery?.recordset?.length > 0) {
                        const { BookingUkeyID, UserUkeyID, RazorpayOrderId, TotalNetAmount, AdditionalCharges, CouponUkeyId } = checkBookingmastQuery.recordset[0];

                        // const userFindDetailsQuery = `select Mobile1 from UserMaster where UserUkeyID='${UserUkeyID}'`;
                        // const userFindDetails = await transaction.request().query(userFindDetailsQuery);
                        // const { Mobile1 } = userFindDetails.recordset[0];

                        if (RazorpayOrderId == txnid && transactionData.status == 'success') {
                            const totalGrossAmt = Number(transactionData.amount);
                            if (Math.floor(Number(transactionData.net_amount_debit)) < Math.floor(Number(TotalNetAmount))) {
                                return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
                            }
                            if(Number(transactionData.net_amount_debit) > Number(TotalNetAmount)){
                                const additionalCharges = Number(transactionData.net_amount_debit) - Number(TotalNetAmount) + Number(AdditionalCharges);
                                const totalNetAmount = Number(transactionData.net_amount_debit);
                                await transaction.request().query(`update bookingmast set AdditionalCharges='${additionalCharges}', TotalNetAmount='${totalNetAmount}' where RazorpayOrderId='${txnid}'`);
                            }

                            // Update bookingmast
                            await transaction.request().query(`update bookingmast set PaymentStatus='Success', totalGrossAmt='${totalGrossAmt}', EntryDate=getdate() where RazorpayOrderId='${txnid}'`);
                            
                            // Update bookingdetails
                            const childBookingQuery = `update Bookingdetails set EntryDate=getdate() where BookingUkeyID = '${BookingUkeyID}'`;
                            await transaction.request().query(childBookingQuery);

                            const bookingmastQuery = `SELECT o.OrganizerName, e.EventName, e.StartEventDate, bm.EventUkeyId FROM Bookingmast bm
                            left join OrganizerMaster as o on o.OrganizerUkeyId = bm.OrganizerUkeyId
                            left join EventMaster as e on e.EventUkeyId = bm.EventUkeyId
                            WHERE BookingUkeyID = '${BookingUkeyID}'`;
                            const bookingmastResult = await transaction.request().query(bookingmastQuery);

                            const { EventName, StartEventDate, EventUkeyId } = bookingmastResult.recordset[0];

                            const allChildBookingDataQuery = `SELECT * FROM Bookingdetails WHERE BookingUkeyID = '${BookingUkeyID}'`;
                            const allChildBookingData = await transaction.request().query(allChildBookingDataQuery);

                            let allMobiles = [];
                            if (allChildBookingData?.recordset?.length > 0) {
                                allMobiles = allChildBookingData.recordset.map((child) => child.Mobile.length == 10 ? `91${child.Mobile}` : child.Mobile);
                            }

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

                                 // Generate short code
                                const shortCode = crypto.randomBytes(4).toString("base64url");
                                const ticketBookingURL = `${FRONTED_ORGANIZER_URL}/ticket-booking/download/${BookingUkeyID}`;

                                const insertTicketURLQuery = `INSERT INTO ShortUrls (short_code, long_url) VALUES (@shortCode, @longUrl)`;
                                await transaction.request()
                                    .input('shortCode', shortCode)
                                    .input('longUrl', ticketBookingURL)
                                    .query(insertTicketURLQuery);

                                // Format the date dynamically
                                const formattedDate = `${day} ${monthNames[month]} ${year}, ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

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

//                             if (CouponUkeyId === '12CC9-AA2025-6fcb5ba1-50ce-4776-a85a-111e548a62e7-W') {
//                                 let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)} and Trnmode = 'PACODE'`);
//                                 let TrnNo = (num.recordset[0].TrnNo).toString();

//                                 const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);


//                                 const addWPACodeWalletQuery = `insert into WalletMaster (
//                                     TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
//                                 ) values (
//                                     NEWID(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, 'PACODE', ${setSQLStringValue(TrnNo)}, GETDATE(), '', ${setSQLStringValue(UserUkeyID)}, 100, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 1, 0, 0
//                                 )`;

//                                 await transaction.request().query(addWPACodeWalletQuery);

//                                 const message = `✅ Your Ticket is Confirmed!\n
// Thank you for booking *Rang Taali* with *MyEventZ*.\n
// You’ve applied coupon code *PACODE* and received *₹100* in your wallet. 🎉\n
// 📅 Event Date: 20/09/2025\n
// 🎫 View Your Ticket: https://organizer.myeventz.in/ticket-booking/download/${BookingUkeyID}\n
// We look forward to seeing you there! ✨`;
//                                 const insertQuery = `INSERT INTO WhatsAppMessages (OrganizerUkeyId, EventUkeyId, BookingUkeyID, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) 
//                                                     VALUES (@OrganizerUkeyId, @EventUkeyId, @BookingUkeyID, @message, @mobile, 0, 'Booking', 1, GETDATE())`;

//                                 await transaction.request()
//                                     .input('OrganizerUkeyId', OrganizerUkeyId)
//                                     .input('EventUkeyId', EventUkeyId)
//                                     .input('BookingUkeyID', BookingUkeyID)
//                                     .input('message', message)
//                                     .input('mobile', Mobile1)
//                                     .query(insertQuery);
//                             }

                            
                            // Commit transaction if both updates succeed
                            await transaction.commit();
                        } else {
                            // Delete records if transaction ID doesn't match
                            // await transaction.request().query(`delete from bookingmast where RazorpayOrderId='${txnid}'`);
                            // await transaction.request().query(`delete from bookingdetails where BookingUkeyID='${checkBookingmastQuery.recordset[0].BookingUkeyID}'`);
                            await transaction.request().query(`update bookingmast set flag = 'D' where RazorpayOrderId='${txnid}'`);
                            await transaction.request().query(`update bookingdetails set flag = 'D' where BookingUkeyID='${checkBookingmastQuery.recordset[0].BookingUkeyID}'`);
                            
                            // Commit the deletion transaction
                            await transaction.commit();
                        }
                    } else {
                        // No records found, commit empty transaction
                        await transaction.commit();
                    }
                } catch (dbError) {
                    // Rollback transaction if any database operation fails
                    if (transaction) {
                        await transaction.rollback();
                    }
                    console.error('Database transaction error:', dbError);
                    throw dbError;
                }
            }

            return res.json({
                success: true,
                transactionId: txnid,
                status: transactionData.status || 'unknown',
                amount: transactionData.amount || '0.00',
                productInfo: transactionData.productinfo || '',
                customerName: transactionData.firstname || '',
                customerEmail: transactionData.email || '',
                customerPhone: transactionData.phone || '',
                transactionDate: transactionData.addedon || '',
                paymentMode: transactionData.mode || '',
                bankReference: transactionData.bank_ref_num || '',
                cardType: transactionData.card_type || '',
                cardNumber: transactionData.cardnum || '',
                authCode: transactionData.auth_code || '',
                errorMessage: transactionData.error_Message || '',
                easebuzzData: transactionData, // Include full transaction data
            });
        } else if (statusResponse.status === false) {
            // Handle error or non-success response
            return res.status(400).json({
                success: false,
                message: statusResponse.message || 'Failed to retrieve payment status',
                transactionId: txnid,
                easebuzzError: statusResponse,
            });
        } else {
            // Handle unexpected response format
            return res.status(500).json({
                success: false,
                message: 'Unexpected response format from payment gateway',
                transactionId: txnid,
                rawResponse: statusResponse,
            });
        }
    } catch (error) {
        // Rollback transaction if it exists and hasn't been committed/rolled back
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Transaction rollback error:', rollbackError);
            }
        }

        // Handle axios or network errors
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        console.error('Payment status check error:', {
            txnid: req.body.txnid || '',
            error: errorMessage,
            statusCode: error.response?.status,
        });

        return res.status(500).json({
            success: false,
            message: 'Error fetching payment status from payment gateway',
            error: errorMessage,
            transactionId: req.body.txnid || '',
        });
    }
}


// Add this webhook handler function to your existing code
const easebuzzWebhookHandler = async (req, res) => {
    let transaction;
    try {
        // Easebuzz sends data as form-urlencoded or JSON, depending on configuration
        const webhookData = req.body;
        
        // Verify the hash to ensure the request is from Easebuzz
        const receivedHash = webhookData.hash;
        const generatedHash = generateCallbackHash(webhookData);
        
        if (receivedHash !== generatedHash) {
            console.error('Hash verification failed for Easebuzz webhook');
            return res.status(400).json({ success: false, message: 'Invalid hash' });
        }

        const {
            txnid
        } = webhookData;
     
        //    const { txnid, OrganizerUkeyId } = decodedPayload;

        const missingKeys = checkKeysAndRequireValues(['txnid'], webhookData);
        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const getOrganizerQuery = `SELECT OrganizerUkeyId FROM Bookingmast WHERE RazorpayOrderId='${txnid}'`;
        const organizerResult = await pool.query(getOrganizerQuery);
        if (!organizerResult || organizerResult.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Organizer not found for the given transaction ID'
            });     
        }
        const OrganizerUkeyId = organizerResult.recordset[0].OrganizerUkeyId;

        const orgQuery = `select * from PaymentGatewayMaster where OrganizerUkeyId = '${OrganizerUkeyId}' and IsActive = 1 and ShortName='EAZ'`;
        const orgResult = await pool.query(orgQuery);

        if(!orgResult || orgResult.recordset.length === 0){
            return res.status(400).json({
                success: false,
                message: 'Organizer not found'
            });
        }
        const orgData = orgResult.recordset[0];
        // Set Easebuzz configuration from organizer data
        const { GatewayName, ShortName, KeyId, payMode, salt, MID } = orgData;

        EASEBUZZ_CONFIG = {
            key: KeyId,
            salt,
            payMode,
            MID: MID || '', // Optional, include only if required by your setup
            url: payMode == 'test' ?  'https://testpay.easebuzz.in/payment/initiateLink' : 'https://pay.easebuzz.in/payment/initiateLink', // Default to test URL if not provided
            statusUrl: payMode == 'test' ? 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve' : 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve' // Default to test URL if not provided
        };

        // Prepare data for Easebuzz status API
        const statusData = new URLSearchParams();
        statusData.append('key', EASEBUZZ_CONFIG.key);
        statusData.append('txnid', txnid);
        statusData.append('hash', generateStatusHash(txnid));

        // Make request to Easebuzz status API with timeout
        const response = await axios.post(EASEBUZZ_CONFIG.statusUrl, statusData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            timeout: 10000, // 10 seconds timeout
        });

        // Parse the response safely
        const statusResponse = response.data;

        // Verify response structure
        if (!statusResponse || typeof statusResponse !== 'object') {
            return res.status(500).json({
                success: false,
                message: 'Invalid response from payment gateway',
                transactionId: txnid,
            });
        }

        // Check if status is successful based on the actual response structure
        if (statusResponse.status === true && statusResponse.msg && Array.isArray(statusResponse.msg) && statusResponse.msg.length > 0) {
            const transactionData = statusResponse.msg[0];

            if (transactionData.status) {
                // Begin transaction
                transaction = await pool.transaction();
                await transaction.begin();

                try {
                    const checkBookingmastQuery = await transaction.request().query(`select * from Bookingmast where OrganizerUkeyId='${OrganizerUkeyId}' and RazorpayOrderId='${txnid}'`);

                    if (checkBookingmastQuery?.recordset?.length > 0) {
                        const { BookingUkeyID, UserUkeyID, RazorpayOrderId, TotalNetAmount, AdditionalCharges, CouponUkeyId } = checkBookingmastQuery.recordset[0];

                        // const userFindDetailsQuery = `select Mobile1 from UserMaster where UserUkeyID='${UserUkeyID}'`;
                        // const userFindDetails = await transaction.request().query(userFindDetailsQuery);
                        // const { Mobile1 } = userFindDetails.recordset[0];

                        if (RazorpayOrderId == txnid && transactionData.status == 'success') {
                            const totalGrossAmt = Number(transactionData.amount);
                            if (Math.floor(Number(transactionData.net_amount_debit)) < Math.floor(Number(TotalNetAmount))) {
                                return res.status(400).json({ success: false, message: "Something went wrong Please try again!" });
                            }
                            if(Number(transactionData.net_amount_debit) > Number(TotalNetAmount)){
                                const additionalCharges = Number(transactionData.net_amount_debit) - Number(TotalNetAmount) + Number(AdditionalCharges);
                                const totalNetAmount = Number(transactionData.net_amount_debit);
                                await transaction.request().query(`update bookingmast set AdditionalCharges='${additionalCharges}', TotalNetAmount='${totalNetAmount}' where RazorpayOrderId='${txnid}'`);
                            }

                            // Update bookingmast
                            await transaction.request().query(`update bookingmast set PaymentStatus='Success', totalGrossAmt='${totalGrossAmt}', EntryDate=getdate() where RazorpayOrderId='${txnid}'`);
                            
                            // Update bookingdetails
                            const childBookingQuery = `update Bookingdetails set EntryDate=getdate() where BookingUkeyID = '${BookingUkeyID}'`;
                            await transaction.request().query(childBookingQuery);

                            const bookingmastQuery = `SELECT o.OrganizerName, e.EventName, e.StartEventDate, bm.EventUkeyId FROM Bookingmast bm
                            left join OrganizerMaster as o on o.OrganizerUkeyId = bm.OrganizerUkeyId
                            left join EventMaster as e on e.EventUkeyId = bm.EventUkeyId
                            WHERE BookingUkeyID = '${BookingUkeyID}'`;
                            const bookingmastResult = await transaction.request().query(bookingmastQuery);

                            const { EventName, StartEventDate, EventUkeyId } = bookingmastResult.recordset[0];

                            const allChildBookingDataQuery = `SELECT * FROM Bookingdetails WHERE BookingUkeyID = '${BookingUkeyID}'`;
                            const allChildBookingData = await transaction.request().query(allChildBookingDataQuery);

                            let allMobiles = [];
                            if (allChildBookingData?.recordset?.length > 0) {
                                allMobiles = allChildBookingData.recordset.map((child) => child.Mobile.length == 10 ? `91${child.Mobile}` : child.Mobile);
                            }

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

                                // Generate short code
                                const shortCode = crypto.randomBytes(4).toString("base64url");
                                const ticketBookingURL = `${FRONTED_ORGANIZER_URL}/ticket-booking/download/${BookingUkeyID}`;

                                const insertTicketURLQuery = `INSERT INTO ShortUrls (short_code, long_url) VALUES (@shortCode, @longUrl)`;
                                await transaction.request()
                                    .input('shortCode', shortCode)
                                    .input('longUrl', ticketBookingURL)
                                    .query(insertTicketURLQuery);

                                // Format the date dynamically
                                const formattedDate = `${day} ${monthNames[month]} ${year}, ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

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

//                             if (CouponUkeyId === '12CC9-AA2025-6fcb5ba1-50ce-4776-a85a-111e548a62e7-W') {
//                                 let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(UserUkeyID)} and Trnmode = 'PACODE'`);
//                                 let TrnNo = (num.recordset[0].TrnNo).toString();

//                                 const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);


//                                 const addWPACodeWalletQuery = `insert into WalletMaster (
//                                     TrnUkeyId, OrganizerUkeyId, EventUkeyId, RefUkeyId, Trnmode, TrnNo, TrnDate, Remarks, UserUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty, TotalTaxAmt, TotalNetAmt
//                                 ) values (
//                                     NEWID(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(BookingUkeyID)}, 'PACODE', ${setSQLStringValue(TrnNo)}, GETDATE(), '', ${setSQLStringValue(UserUkeyID)}, 100, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 1, 0, 0
//                                 )`;

//                                 await transaction.request().query(addWPACodeWalletQuery);

//                                 const message = `✅ Your Ticket is Confirmed!\n
// Thank you for booking *Rang Taali* with *MyEventZ*.\n
// You’ve applied coupon code *PACODE* and received *₹100* in your wallet. 🎉\n
// 📅 Event Date: 20/09/2025\n
// 🎫 View Your Ticket: https://organizer.myeventz.in/ticket-booking/download/${BookingUkeyID}\n
// We look forward to seeing you there! ✨`;
//                                 const insertQuery = `INSERT INTO WhatsAppMessages (OrganizerUkeyId, EventUkeyId, BookingUkeyID, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) 
//                                                     VALUES (@OrganizerUkeyId, @EventUkeyId, @BookingUkeyID, @message, @mobile, 0, 'Booking', 1, GETDATE())`;

//                                 await transaction.request()
//                                     .input('OrganizerUkeyId', OrganizerUkeyId)
//                                     .input('EventUkeyId', EventUkeyId)
//                                     .input('BookingUkeyID', BookingUkeyID)
//                                     .input('message', message)
//                                     .input('mobile', Mobile1)
//                                     .query(insertQuery);
//                             }

                            
                            // Commit transaction if both updates succeed
                            await transaction.commit();
                        } else {
                            // Delete records if transaction ID doesn't match
                            // await transaction.request().query(`delete from bookingmast where RazorpayOrderId='${txnid}'`);
                            // await transaction.request().query(`delete from bookingdetails where BookingUkeyID='${checkBookingmastQuery.recordset[0].BookingUkeyID}'`);
                            await transaction.request().query(`update bookingmast set flag = 'D' where RazorpayOrderId='${txnid}'`);
                            await transaction.request().query(`update bookingdetails set flag = 'D' where BookingUkeyID='${checkBookingmastQuery.recordset[0].BookingUkeyID}'`);
                            
                            // Commit the deletion transaction
                            await transaction.commit();
                        }
                    } else {
                        // No records found, commit empty transaction
                        await transaction.commit();
                    }
                } catch (dbError) {
                    // Rollback transaction if any database operation fails
                    if (transaction) {
                        await transaction.rollback();
                    }
                    console.error('Database transaction error:', dbError);
                    throw dbError;
                }
            }

            return res.json({
                success: true,
                transactionId: txnid,
                status: transactionData.status || 'unknown',
                amount: transactionData.amount || '0.00',
                productInfo: transactionData.productinfo || '',
                customerName: transactionData.firstname || '',
                customerEmail: transactionData.email || '',
                customerPhone: transactionData.phone || '',
                transactionDate: transactionData.addedon || '',
                paymentMode: transactionData.mode || '',
                bankReference: transactionData.bank_ref_num || '',
                cardType: transactionData.card_type || '',
                cardNumber: transactionData.cardnum || '',
                authCode: transactionData.auth_code || '',
                errorMessage: transactionData.error_Message || '',
                easebuzzData: transactionData, // Include full transaction data
            });
        } else if (statusResponse.status === false) {
            // Handle error or non-success response
            return res.status(400).json({
                success: false,
                message: statusResponse.message || 'Failed to retrieve payment status',
                transactionId: txnid,
                easebuzzError: statusResponse,
            });
        } else {
            // Handle unexpected response format
            return res.status(500).json({
                success: false,
                message: 'Unexpected response format from payment gateway',
                transactionId: txnid,
                rawResponse: statusResponse,
            });
        }
    } catch (error) {
        // Rollback transaction if it exists and hasn't been committed/rolled back
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Transaction rollback error:', rollbackError);
            }
        }

        // Handle axios or network errors
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        console.error('Payment status check error:', {
            txnid: req.body.txnid || '',
            error: errorMessage,
            statusCode: error.response?.status,
        });

        return res.status(500).json({
            success: false,
            message: 'Error fetching payment status from payment gateway',
            error: errorMessage,
            transactionId: req.body.txnid || '',
        });
    }
        
}

module.exports = {
    initiatePaymentAPI,
    paymentStatusVerificationAPI,
    easebuzzWebhookHandler
}