const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue, setSQLDecimalValue, setSQLDateTime, setSQLNumberValue, generateGiftCardCode } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const { sendGiftCardMailToUser } = require("./sendEmail");

const fetchGiftCardName = async(req, res)=>{
    try{
        const { EventUkeyId, OrganizerUkeyId, GiftCardUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (GiftCardUkeyId) {
            whereConditions.push(`GiftCardUkeyId = ${setSQLStringValue(GiftCardUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT GiftCardUkeyId, UserUkeyId, SenderName, ReciverName, EmailId, Mobile1, Message, ScheduleDate AS ExpireDate, Amount, Quentity, UserID, UserName, IpAddress, HostName, EntryDate, flag, RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, GiftCardCode, ReciverUkeyId, IsRedeemed FROM GiftCardName ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM GiftCardName ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const walletbalance = async (req, res) => {
    try{
        const {UserUkeyId} = req.query
        
        const missingKeys = checkKeysAndRequireValues(['UserUkeyId'], req.query)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const result = await pool.request().query(`
        select sum(Credit)-sum(Debit) as WalletBalance from walletmaster where UserUkeyId = ${setSQLStringValue(UserUkeyId)}
        `)

        const result2 = await pool.request().query(`
        select wm.EventUkeyId,RefUkeyId,Trnmode,TrnDate,wm.UserUkeyId,TotalQty,Credit,Debit,
        TotalTaxAmt,TotalNetAmt,OrganizerName,em.EventName,um.FullName from walletmaster wm left join OrganizerMaster om
        on wm.OrganizerUkeyId=om.OrganizerUkeyId left join EventMaster em on em.EventUkeyId=
        wm.EventUkeyId left join UserMaster um on um.UserUkeyId=wm.UserUkeyId where
        wm.UserUkeyId=${setSQLStringValue(UserUkeyId)} 
        order by TrnDate asc
        `)
        
        return res.status(200).json({WalletBalance : result?.recordset?.[0]?.WalletBalance, userTransactionList : result2.recordset});
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const GiftCardName = async(req, res)=>{
    const { GiftCardUkeyId, SenderName, ReciverName, EmailId, Mobile1, Message, ScheduleDate, Amount, Quentity, flag = '', UserUkeyId, OrganizerUkeyId, EventUkeyId, RazorpayPaymentId,RazorpayOrderId, RazorpaySignatureId, ReciverUkeyId, IsRedeemed = false, RefUkeyId } = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    let {TrnUkeyId, DetailUkeyid, TrnNo} = req.body
    try{
        const missingKeys = checkKeysAndRequireValues(['GiftCardUkeyId'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // const giftCard = await pool.request().query(`select * from GiftCardMaster where GiftMastUkeyId = ${setSQLStringValue(RefUkeyId)}`)

        let num = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(UserUkeyId)}`)

        TrnNo = flag == 'A' ? num.recordset?.[0].TrnNo : TrnNo 
        TrnUkeyId =  flag == 'A' ? generateUUID() : TrnUkeyId
        DetailUkeyid =  flag == 'A' ? generateUUID() : DetailUkeyid

        const GiftCardCode = generateGiftCardCode()

        const insertQuery = `
            INSERT INTO GiftCardName (
                GiftCardUkeyId, UserUkeyId, SenderName, ReciverName, EmailId, Mobile1, Message, ScheduleDate, Amount, Quentity, UserID, UserName, IpAddress, HostName, EntryDate, flag, RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId, GiftCardCode, ReciverUkeyId, IsRedeemed
            ) VALUES (
                ${setSQLStringValue(GiftCardUkeyId)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(SenderName)}, ${setSQLStringValue(ReciverName)}, ${setSQLStringValue(EmailId)}, ${setSQLStringValue(Mobile1)}, ${setSQLStringValue(Message)}, DATEADD(DAY, 365, GETDATE()), ${setSQLDecimalValue(Amount)}, ${setSQLNumberValue(Quentity)}, ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(RazorpayPaymentId)}, ${setSQLStringValue(RazorpayOrderId)}, ${setSQLStringValue(RazorpaySignatureId)}, ${setSQLStringValue(GiftCardCode)}, ${setSQLStringValue(ReciverUkeyId)}, ${setSQLBooleanValue(IsRedeemed)}
            );
        `

        // `insert into WalletDetails (
        //     DetailUkeyid, TrnUkeyId, OrganizerUkeyId, EventUkeyId, TrnNo, Trnmode, TrnDate, Remarks, UserUkeyId, RefUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty
        // )values(
        //     ${setSQLStringValue(DetailUkeyid)}, ${setSQLStringValue(TrnUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(TrnNo)}, 'GIFTCARD', GETDATE(), '', ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(GiftCardUkeyId)}, ${setSQLStringValue(Amount)}, 0, 1.00, 'INR', 1, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLNumberValue(Quentity)}
        // )`

        const deleteQuery = `
            DELETE FROM GiftCardName WHERE GiftCardUkeyId = ${setSQLStringValue(GiftCardUkeyId)} and flag <> 'D'
            DELETE FROM WalletDetails WHERE DetailUkeyid = ${setSQLStringValue(DetailUkeyid)} and flag <> 'D'
        `
        if(flag == 'A'){
            const result = await pool.request().query(insertQuery);

            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not created Organizer terms and condtion'),})
            }

            // Run background processing using setImmediate
            setImmediate(async () => {
                try {
                    let giftCardName = '';
                    const giftCardTitleQuery = `SELECT GiftCardTitle FROM GiftCardMaster WHERE GiftMastUkeyId = ${setSQLStringValue(RefUkeyId)}`;

            const giftCardTitleResult = await pool.request().query(giftCardTitleQuery);
            if (giftCardTitleResult.rowsAffected[0] > 0) {
                giftCardName = giftCardTitleResult.recordset[0].GiftCardTitle;
            }

            const sentGiftCardWhatsAppQuery = `INSERT INTO WhatsAppMessages (UserUkeyId, Message, Mobile, WhatsApp, TransMode, Status, EntryTime) VALUES (${setSQLStringValue(UserUkeyId)}, N'Hi *${ReciverName}*,

*${SenderName}* has sent you a *${giftCardName}* Gift Card to put towards your next adventure on MYEVENTZ.

Your Gift Card Code is: *${GiftCardCode}*

How to use it:
✨ Redeem this code during checkout when booking your tickets to instantly apply the balance.
✨ Use it for your favorite Eventz!
✨ Enjoy a seamless booking experience on MYEVENTZ.

⏰ Don''t wait too long! This gift card is valid until ${ScheduleDate.split('-').reverse().join('-')}.

Happy Celebrations! 🥳

MYEVENTZ Team', ${setSQLStringValue(Mobile1)}, 0, 'GIFTCARD', 1, GETDATE())`;

            await pool.request().query(sentGiftCardWhatsAppQuery);

                    const emailAllDetails = {
                        EmailId,
                        ReciverName,
                        SenderName,
                        GiftCardName: giftCardName,
                        GiftCardCode,
                        ExpiryDate: ScheduleDate.split('-').reverse().join('-'),
                    }

                    const responseGiftCardSentStatus = await sendGiftCardMailToUser(emailAllDetails);

                    try {
                        const insertQueryEN = `INSERT INTO [EmailLogs] ([OrganizerUkeyId],[EventUkeyId],[UkeyId],[Category],[Language],[Email],[IsSent],[UserUkeyId],[IpAddress],[HostName],[EntryTime],[flag]) VALUES (${setSQLStringValue(OrganizerUkeyId)},${setSQLStringValue(EventUkeyId)},${setSQLStringValue(generateUUID())},'GIFTCARD','ENGLISH',${setSQLStringValue(emailAllDetails.EmailId)},${setSQLBooleanValue(responseGiftCardSentStatus)},${setSQLStringValue(UserUkeyId)},${setSQLStringValue(IPAddress)},${setSQLStringValue(ServerName)},GETDATE(),'A')`;
                        await pool.request().query(insertQueryEN);
                        console.log('English email log inserted');
                    } catch (error) {
                        console.error('Error inserting English email log:', error);
                    }
                } catch (backgroundError) {
                    console.error('Background processing error:', backgroundError);
                }
            });

            return res.status(200).json({...successMessage('Successfully created Gift Card.'), ...req.body, TrnNo, TrnUkeyId, DetailUkeyid});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('Not updated Disclaimer successfully.')})
            }

            return res.status(200).json({...successMessage('Successfully updated Disclaimer..'), ...req.body, TrnNo, TrnUkeyId, DetailUkeyid});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Event Contect Setting Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Event Contect Setting Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveGiftCard = async(req, res)=>{
    try{
        const {GiftCardUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['GiftCardUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            update GiftCardName set flag = 'D' WHERE GiftCardUkeyId = ${setSQLStringValue(GiftCardUkeyId)}
        `

        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not deleted Disclaimer successfully.')})
        }

        return res.status(200).json({...successMessage('Successfully deleted Disclaimer.'), ...req.query});
    }catch(error){
        console.log('Delete Event Contect Setting Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

const redeemGiftCard = async (req, res) => {
    try{
        const {ReciverUkeyId, GiftCardCode} = req.body;

        const missingKeys = checkKeysAndRequireValues(['ReciverUkeyId', 'GiftCardCode'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const giftcardInfo = await pool.request().query(`select * from GiftCardName where GiftCardCode = ${setSQLStringValue(GiftCardCode)}`)

        if(!giftcardInfo.recordset.length) {
            return res.status(400).json(errorMessage('invelid gift card.'))
        }
        if(giftcardInfo?.recordset?.[0]?.IsRedeemed){
            return res.status(400).json(errorMessage('gift card already redeemed.'))
        }

        const TrnUkeyId = generateUUID()
        let TrnNo = await pool.request().query(`select ISNULL(MAX(Convert(bigint,TrnNo)),0) + 1 TrnNo from WalletMaster where UserUkeyId = ${setSQLStringValue(ReciverUkeyId)} and Trnmode = 'GIFTCARD'`)
        const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);

        const query = `
        update GiftCardName set IsRedeemed = 1, ReciverUkeyId = ${setSQLStringValue(ReciverUkeyId)} where GiftCardUkeyId = ${setSQLStringValue(giftcardInfo?.recordset?.[0].GiftCardUkeyId)}

        insert into WalletMaster (
            TrnUkeyId, OrganizerUkeyId, EventUkeyId, TrnNo, Trnmode, TrnDate, Remarks, UserUkeyId, RefUkeyId, Credit, Debit, CurrencyRate, CurrencyName, IsActive, flag, IpAddress, HostName, EntryDate, TotalQty
        )values(
            ${setSQLStringValue(TrnUkeyId)}, '', '', ${setSQLStringValue(TrnNo?.recordset?.[0]?.TrnNo)}, 'GIFTCARD', GETDATE(), '', ${setSQLStringValue(ReciverUkeyId)}, ${setSQLStringValue(giftcardInfo?.recordset?.[0]?.GiftCardUkeyId)}, ${setSQLStringValue(giftcardInfo?.recordset?.[0]?.Amount)}, 0, 1.00, 'INR', 1, 'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLNumberValue(giftcardInfo?.recordset?.[0]?.Quentity)}
        )
        `

        const result = await pool.request().query(query)

        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not deleted Disclaimer successfully.')})
        }

        return res.status(200).json({...successMessage('gift card redeemed successfully.'), ...req.body});
    }catch(error){
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchGiftCardName,
    GiftCardName,
    RemoveGiftCard,
    redeemGiftCard,
    walletbalance
}