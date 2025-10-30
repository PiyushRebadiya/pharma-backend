const { pool } = require('../sql/connectToDatabase');
const {
    errorMessage,
    successMessage,
    checkKeysAndRequireValues,
    setSQLStringValue,
    setSQLNumberValue,
    setSQLBooleanValue,
    getCommonAPIResponse,
    getCommonKeys,
    generateUUID,
    setSQLDateTime,
    generateCODE,
    generateGiftCardCode
} = require("../common/main");
const { FRONTED_USER_URL } = require('../common/variable');
const fs = require("fs");

const fetchSplitTicketMaster = async (req, res) => {
    try {
        const { SplitUkeyId, EventUkeyId, OrganizerUkeyId } = req.query;
        let whereConditions = [];

        if (SplitUkeyId) {
            whereConditions.push(`S.SplitUkeyId = ${setSQLStringValue(SplitUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`S.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`S.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }

        whereConditions.push(`S.flag <> 'D'`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getQuery = `SELECT
                S.*,
                CASE
                    WHEN S.AssignByRole <> 'User' THEN OB.FirstName
                    ELSE UB.FullName
                END AS AssignByName,
                CASE
                    WHEN S.AssignToRole <> 'User' THEN OT.FirstName
                    ELSE UT.FullName
                END AS AssignToName,
				CASE
                    WHEN S.AssignByRole <> 'User' THEN OB.Mobile1
                    ELSE UB.Mobile1
                END AS AssignBymobile,
                CASE
                    WHEN S.AssignToRole <> 'User' THEN OT.Mobile1
                    ELSE UT.Mobile1
                END AS AssignTomobile,
				tm.Category,
				CONCAT('${FRONTED_USER_URL}/home/qr/', S.HeadCode, '/', S.AssignToCode) AS Link
            FROM
                SplitTicketMast S
            LEFT JOIN OrgUserMaster OB ON S.AssignByUserUkeyId = OB.UserUkeyId AND S.AssignByRole <> 'User'
            LEFT JOIN UserMaster UB ON S.AssignByUserUkeyId = UB.UserUkeyId AND S.AssignByRole = 'User'
            LEFT JOIN OrgUserMaster OT ON S.AssignToUserUkeyId = OT.UserUkeyId AND S.AssignToRole <> 'User'
            LEFT JOIN UserMaster UT ON S.AssignToUserUkeyId = UT.UserUkeyId AND S.AssignToRole = 'User'
			left join TicketCategoryMaster tm on tm.TicketCateUkeyId=s.TicketCateUkeyId
            ${whereString}
            order by EntryDate asc
`;
        const countQuery = `SELECT COUNT(*) AS totalCount FROM SplitTicketMast S ${whereString}`;

        const result = await getCommonAPIResponse(req, res, { getQuery, countQuery });

        return res.json(result);

    } catch (error) {
        console.error('Error fetching SplitTicketMast records:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};

const addUpdateSplitTicketMaster = async (req, res) => {
    const {
        SplitUkeyId, EventUkeyId, OrganizerUkeyId, AdminCode, TicketCateUkeyId,
        AssignByUserUkeyId, AssignByRole, AssignToUserUkeyId, AssignToRole,
        AssignTickets, AvlTickets, AssignToCode = generateGiftCardCode(6), flag, HeadCode = generateGiftCardCode(6),
        SeatingTickets = ""
    } = req.body;

    const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
    let transaction;

    try {
        const missingKeys = checkKeysAndRequireValues(
            ['EventUkeyId', 'OrganizerUkeyId', 'TicketCateUkeyId'],
            req.body
        );

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        transaction = pool.transaction();
        await transaction.begin();

        // Insert ticket split record
        await transaction.request().query(`
            INSERT INTO SplitTicketMast (
                SplitUkeyId, EventUkeyId, OrganizerUkeyId, AdminCode, TicketCateUkeyId,
                AssignByUserUkeyId, AssignByRole, AssignToUserUkeyId, AssignToRole,
                AssignTickets, AvlTickets, AssignToCode, UserName, flag,
                IpAddress, HostName, EntryDate, HeadCode, SeatingTickets
            ) VALUES (
                ${setSQLStringValue(SplitUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(AdminCode)},
                ${setSQLStringValue(TicketCateUkeyId)}, ${setSQLStringValue(AssignByUserUkeyId)},
                ${setSQLStringValue(AssignByRole)}, ${setSQLStringValue(AssignToUserUkeyId)},
                ${setSQLStringValue(AssignToRole)}, ${setSQLNumberValue(AssignTickets)},
                ${setSQLNumberValue(AvlTickets)}, ${setSQLStringValue(AssignToCode)},
                ${setSQLStringValue(req?.user?.FirstName)}, ${setSQLStringValue(flag)},
                ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)},
                ${setSQLDateTime(EntryTime)}, ${setSQLStringValue(HeadCode)},
                ${setSQLStringValue(SeatingTickets)}
            )
        `);

        // WhatsApp message insert with EventName + role-based mobile
        await transaction.request().query(`
            DECLARE @Mobile NVARCHAR(20);
            DECLARE @EventName NVARCHAR(255);
            DECLARE @formattedDate NVARCHAR(50);

            -- Get Event Name and Date
            SELECT 
                @EventName = EventName,  
                @formattedDate = FORMAT(StartEventDate, 'dd-MMM-yyyy')
            FROM EventMaster 
            WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)};

            -- Get Mobile based on role
            IF (${setSQLStringValue(AssignToRole)} = 'Sub-Admin')
                SELECT @Mobile = Mobile1 
                FROM OrgUserMaster 
                WHERE UserUkeyId = ${setSQLStringValue(AssignToUserUkeyId)} 
                  AND Role = 'Sub-Admin';
            ELSE
                SELECT @Mobile = Mobile1 
                FROM UserMaster 
                WHERE UserUkeyId = ${setSQLStringValue(AssignToUserUkeyId)};

            -- Insert WhatsApp message
            INSERT INTO WhatsAppMessages (
                OrganizerUkeyId, EventUkeyId, Message, Mobile, WhatsApp,
                TransMode, Status, EntryTime
            )
            VALUES (
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                N'🎉 Your Ticket is Confirmed!\n\nThank you for booking *' 
                + ISNULL(@EventName, 'Your Event') 
                + N'* with My Eventz 🌟\n\n📅 Event Date: ' + ISNULL(@formattedDate, '') 
                + N'\n🎟️ Confirmed With ${AssignTickets} Qty'
                + N'\n🎟️ Please Visit this Link For Share : ${FRONTED_USER_URL}/home/qr/${HeadCode}/${AssignToCode} \n\nWe look forward to seeing you there! 🎊'
                + N'\n\nPlease Download MyEventZ App for your Tickets. Your Mobile Number is your Login ID and Password is your Mobile Number.'
                + N'\nApp Link for Android : https://play.google.com/store/apps/details?id=com.taxFile.bookingApps'
                + N'\nApp Link for iOS : https://apps.apple.com/in/app/myeventz/id6739251546',
                @Mobile, 0, 'Booking', 1, GETDATE()
            );        
        `);


        if (SeatingTickets.length > 0) {
            const splitOfSeats = SeatingTickets.split(',').map(seat => seat.trim());


            // Check ALL seats first before inserting any (case-sensitive comparison)
            const alreadyLockedSeats = [];

            for (const seatNumber of splitOfSeats) {
                const checkQuery = `
                SELECT Id FROM TicketSeatLocked 
                WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} 
                AND BINARY_CHECKSUM(SeatNumber) = BINARY_CHECKSUM(${setSQLStringValue(seatNumber)})
            `;

                const existingRecord = await transaction.request().query(checkQuery);

                if (existingRecord.recordset.length > 0) {
                    alreadyLockedSeats.push(seatNumber);
                }
            }

            // If ANY seats are already locked, rollback and return error
            if (alreadyLockedSeats.length > 0) {
                await transaction.rollback();
                return res.status(400).send({
                    ...errorMessage(`Cannot lock seats. The following seats are already locked: ${alreadyLockedSeats.join(', ')}`),
                    details: {
                        alreadyLockedSeats,
                        requestedSeats: SeatingTickets
                    }
                });
            }

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

        await transaction.commit();


        return res.status(200).json({...successMessage(`Ticket split successfully.`), ...req.body, AssignToCode, HeadCode});
    } catch (error) {
        if (transaction) await transaction.rollback();
        return res.status(500).json(errorMessage(error.message));
    }
};

const deleteSplitTicketMaster = async (req, res) => {
    try {
        const { SplitUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['SplitUkeyId'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const query = `UPDATE SplitTicketMast SET flag = 'D' WHERE SplitUkeyId = ${setSQLStringValue(SplitUkeyId)}`;
        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json(errorMessage('Record not found.'));
        }

        return res.status(200).json(successMessage('Record deleted successfully.', req.query));

    } catch (error) {
        console.error('Error deleting SplitTicketMast record:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};

const createSplitTicket = async (req, res) => {
    const { EventUkeyId, OrganizerUkeyId, AssignTickets, Mobile1, FullName, HeadCode, OwnTickets, SeatingTickets = "", OwnSeatingTickets = "" } = req.body;
    const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
    let transaction;

    try {
        const AssignToCode = generateGiftCardCode(6);

        transaction = pool.transaction();
        await transaction.begin();

         const query = `
            DECLARE @UserUkeyId NVARCHAR(100);
            DECLARE @AdminCode NVARCHAR(10);
            DECLARE @TicketCateUkeyId NVARCHAR(100);
            DECLARE @AssignByUserUkeyId NVARCHAR(100);
            DECLARE @EventName NVARCHAR(255);
            DECLARE @AssignByRole NVARCHAR(50);
            DECLARE @formattedDate NVARCHAR(50);
            DECLARE @TicketCateUkeyIdStr NVARCHAR(100);
            DECLARE @AssignByUserUkeyIdStr NVARCHAR(100);
            DECLARE @AssignByRoleStr NVARCHAR(50);
            DECLARE @UserUkeyIdStr NVARCHAR(100);
            DECLARE @BookingUkeyId NVARCHAR(100) = NEWID();
            DECLARE @BookingUkeyIdForOwnTickets NVARCHAR(100) = NEWID();
            DECLARE @AssignByMobile NVARCHAR(15);
            DECLARE @AssignByFirstName NVARCHAR(50);
            DECLARE @AssignByUserUkeyIdNew NVARCHAR(100);
            DECLARE @AssignToMobile NVARCHAR(15) = ${setSQLStringValue(Mobile1)};

            -- If own tickets are not available, return an error
            -- IF EXISTS (
            --     SELECT 1
            --     FROM SplitTicketMast
            --     WHERE AssignToCode = ${setSQLStringValue(HeadCode)}
            --     AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            --     AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            --     AND flag <> 'D'
            --     AND OwnTickets > AvlTickets
            -- )
            -- BEGIN
            --     RAISERROR('Not enough own tickets available to assign.', 16, 1);
            --     RETURN;
            -- END

            -- validate you cannot assign more tickets than own tickets
            -- IF EXISTS (
            --     SELECT 1
            --     FROM SplitTicketMast
            --     WHERE AssignToCode = ${setSQLStringValue(HeadCode)}
            --     AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            --     AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            --     AND flag <> 'D'
            --     AND ${setSQLNumberValue(AssignTickets)} > ISNULL(OwnTickets, 0)
            -- )
            -- BEGIN
            --     RAISERROR('You cannot assign more tickets than your own tickets.', 16, 1);
            --     RETURN;
            -- END

            -- validate you cannot have own tickets if already have own tickets
            -- IF EXISTS (
            --     SELECT 1
            --     FROM SplitTicketMast
            --     WHERE AssignToCode = ${setSQLStringValue(HeadCode)}
            --     AND EventUkeyId = '${EventUkeyId}'
            --     AND OrganizerUkeyId = '${OrganizerUkeyId}'
            --     AND flag <> 'D'
            --     AND OwnTickets <> 0
            -- )
            -- BEGIN
            --     RAISERROR('you already conformed your own tickets.', 16, 1);
            --     RETURN;
            -- END

            -- Check if AdminCode exists
            SELECT TOP 1 
                @AssignByUserUkeyId = AssignToUserUkeyId,
                @AssignByRole = AssignToRole,
                @TicketCateUkeyId = TicketCateUkeyId,
                @AdminCode = AdminCode
            FROM SplitTicketMast
            WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
            AND AssignToCode = ${setSQLStringValue(HeadCode)}
            AND flag <> 'D';

            -- Try to get the user
            SELECT @UserUkeyId = UserUkeyId 
            FROM UserMaster 
            WHERE Mobile1 = ${setSQLStringValue(Mobile1)} AND flag <> 'D';

            -- If user not found, insert new one
            IF (@UserUkeyId IS NULL)
            BEGIN
                SET @UserUkeyId = NEWID();

                INSERT INTO UserMaster (
                    UserUkeyId, FullName, Mobile1, flag, IpAddress, HostName, EntryDate, Password, IsActive, Role
                ) VALUES (
                    @UserUkeyId,
                    ${setSQLStringValue(FullName)},
                    ${setSQLStringValue(Mobile1)},
                    'A',
                    ${setSQLStringValue(IPAddress)},
                    ${setSQLStringValue(ServerName)},
                    ${setSQLDateTime(EntryTime)},
                    ${setSQLStringValue(Mobile1)},
                    1, 'User'
                );
            END

            -- ✅ Validation: Check if User already exists in SplitTicketMast
            IF EXISTS (
                SELECT 1 FROM SplitTicketMast
                WHERE AssignToUserUkeyId = @UserUkeyId
                AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                AND TicketCateUkeyId = @TicketCateUkeyId
                AND flag <> 'D'
            )
            BEGIN
                RAISERROR('This user already has a ticket assigned for this event.', 16, 1);
                RETURN;
            END

            IF (@AssignByRole = 'User')
            BEGIN
                SELECT 
                    @AssignByMobile = Mobile1,
                    @AssignByFirstName = FullName,
                    @AssignByUserUkeyIdNew = UserUkeyId
                FROM UserMaster 
                where UserUkeyId = @AssignByUserUkeyId and flag <> 'D';
            END 
            ELSE 
            BEGIN 
                SELECT 
                    @AssignByMobile = Mobile1,
                    @AssignByFirstName = FirstName
                FROM OrgUserMaster 
                where UserUkeyId = @AssignByUserUkeyId and flag <> 'D';

                SELECT @AssignByUserUkeyIdNew = UserUkeyId FROM UserMaster WHERE Mobile1 = @AssignByMobile
            END

            -- If user not found, insert new one
            IF ( @AssignByUserUkeyIdNew IS NULL )
            BEGIN
                SET @AssignByUserUkeyIdNew = NEWID();
                
                INSERT INTO UserMaster (
                    UserUkeyId, 
                    FullName, 
                    Mobile1, 
                    flag, 
                    IpAddress, 
                    HostName, 
                    EntryDate, 
                    Password, 
                    IsActive, 
                    Role
                ) 
                VALUES (
                    @AssignByUserUkeyIdNew,
                    @AssignByFirstName,
                    @AssignByMobile,
                    'A',
                    ${setSQLStringValue(IPAddress)},
                    ${setSQLStringValue(ServerName)},
                    ${setSQLDateTime(EntryTime)},
                    @AssignByFirstName, -- password temporarily same as FirstName
                    1, 
                    'User'
                );
            END

            -- Get Event Info
            SELECT 
                @EventName = EventName,  
                @formattedDate = FORMAT(StartEventDate, 'dd-MMM-yyyy')
            FROM EventMaster 
            WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)};

            -- Convert IDs into NVARCHAR for concatenation
            SET @TicketCateUkeyIdStr   = ISNULL(@TicketCateUkeyId, '');
            SET @AssignByUserUkeyIdStr = ISNULL(@AssignByUserUkeyId, '');
            SET @AssignByRoleStr       = ISNULL(@AssignByRole, '');
            SET @UserUkeyIdStr         = ISNULL(@UserUkeyId, '');
            SET @AssignByUserUkeyIdNew = ISNULL(@AssignByUserUkeyIdNew, '');
            DECLARE @AssignToCodeStr NVARCHAR(10) 
            SET @AssignToCodeStr         = ISNULL('${HeadCode}', '');

            IF (@AssignToMobile IS NOT NULL AND @AssignToMobile <> '')
            BEGIN

                -- Insert into SplitTicketMast
                INSERT INTO SplitTicketMast (
                    SplitUkeyId, EventUkeyId, OrganizerUkeyId, AdminCode, TicketCateUkeyId,
                    AssignByUserUkeyId, AssignByRole, AssignToUserUkeyId, AssignToRole,
                    AssignTickets, AvlTickets, SeatingTickets, UserName, flag,
                    IpAddress, HostName, EntryDate, HeadCode, AssignToCode, OwnTickets
                ) VALUES (
                    NEWID(), ${setSQLStringValue(EventUkeyId)},
                    ${setSQLStringValue(OrganizerUkeyId)}, @AdminCode,
                    @TicketCateUkeyId, @AssignByUserUkeyId,
                    @AssignByRole, @UserUkeyId,
                    'User', ${setSQLNumberValue(AssignTickets)}, ${setSQLNumberValue(AssignTickets)},
                    ${setSQLStringValue(SeatingTickets)},
                    ${setSQLStringValue(FullName)}, 'A',
                    ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)},
                    ${setSQLDateTime(EntryTime)}, ${setSQLStringValue(HeadCode)}, ${setSQLStringValue(AssignToCode)}, 0
                );
            END

            DECLARE @AvlTicketsNew INT = ${setSQLNumberValue((OwnTickets + AssignTickets))}

            IF (@AssignToMobile IS NOT NULL AND @AssignToMobile <> '')
            BEGIN
                UPDATE SplitTicketMast SET AvlTickets = AvlTickets - @AvlTicketsNew, SeatingTickets = ${setSQLStringValue(OwnSeatingTickets)} where AssignToCode = @AssignToCodeStr AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
            END
            ELSE
            BEGIN
                UPDATE SplitTicketMast SET AvlTickets = AvlTickets - @AvlTicketsNew where AssignToUserUkeyId = @AssignByUserUkeyId AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND TicketCateUkeyId = @TicketCateUkeyIdStr AND flag <> 'D';
            END

            IF NOT EXISTS (
                SELECT 1 FROM Bookingmast bm
                LEFT JOIN Bookingdetails bd on bm.BookingUkeyId = bd.BookingUkeyId
                WHERE bm.UserUkeyId = @AssignByUserUkeyIdNew
                AND bm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}
                AND bm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                AND bd.TicketCateUkeyId = @TicketCateUkeyIdStr
                AND bm.flag <> 'D'
            )
            BEGIN            
                DECLARE @OwnTickets2 INT = ${setSQLNumberValue(OwnTickets)};

                IF (@AssignToMobile IS NOT NULL AND @AssignToMobile <> '')
                BEGIN
                    DECLARE @OwnTicketsNum INT;
                    SET @OwnTicketsNum = TRY_CAST(${OwnTickets} AS INT);

                    UPDATE SplitTicketMast SET OwnTickets = @OwnTicketsNum where AssignToCode = '${HeadCode}' AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                END
                ELSE
                BEGIN
                    UPDATE SplitTicketMast SET OwnTickets = ${OwnTickets} where AssignToUserUkeyId = @AssignByUserUkeyId AND EventUkeyId = ${setSQLStringValue(EventUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND TicketCateUkeyId = @TicketCateUkeyIdStr AND flag <> 'D';
                END

                if(@OwnTickets2 > 0)
                BEGIN
                INSERT INTO Bookingmast (
                    BookingUkeyID, EventUkeyId, OrganizerUkeyId, UserUkeyID,
                    CouponUkeyId, BookingDate, BookingAmt, BookingCode,
                    TotalGST, TotalConviencefee, DiscountPer, DiscountAmt,
                    TotalNetAmount, DonationAmt, IsDonationAmt, AdditionalCharges,
                    RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId,
                    IsWhatsapp, IsVerify, IsPayment, flag,
                    IpAddress, HostName, EntryDate,
                    IsWalletUsed, UsedWalletAmt, PaymentStatus,
                    TotalGrossAmt, MyEventzCharge, IsAmtMyEventCharge,
                    RefCode, BookingMode
                )
                VALUES (
                    @BookingUkeyIdForOwnTickets, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, @AssignByUserUkeyIdNew,
                    NULL, GETDATE(), 0, ${setSQLStringValue(AssignToCode)}, -- BookingAmt = 0 for split, code = AssignToCode
                    0, 0, 0, 0, -- GST/fees/discount = 0 (adjust later if needed)
                    0, 0, 0, 0,
                    NULL, NULL, NULL,
                    0, 0, 1, 'A',
                    ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)},
                    0, 0, 'Success', 0, 0, 0,
                    NULL, 'SPLIT'
                );
                END
            
            END

                -- ========================================
                -- 📌 Bookingdetails (Child Entries per ticket)
                -- ========================================

                DECLARE @j INT = 1;
                DECLARE @SeatTable TABLE (ID INT IDENTITY(1,1), SeatNumber NVARCHAR(100));
                DECLARE @TotalSeats INT;

                -- First, split the seats into a table if OwnSeatingTickets has values
                IF LEN(${setSQLStringValue(OwnSeatingTickets)}) > 0
                BEGIN
                    INSERT INTO @SeatTable (SeatNumber)
                    SELECT value FROM STRING_SPLIT(${setSQLStringValue(OwnSeatingTickets)}, ',');
                    
                    SET @TotalSeats = @@ROWCOUNT;
                END
                ELSE
                BEGIN
                    SET @TotalSeats = 0;
                END

                WHILE @j <= ${OwnTickets || 0}
                BEGIN
                    INSERT INTO Bookingdetails (
                        BookingdetailUkeyID, BookingUkeyID, Name, Mobile,
                        GST, Conviencefee, Amount, DiscAmt, TicketCateUkeyId,
                        IsVerify, BookingMode, VerifyMode, SeatNumber, VerifiedByUkeyId,
                        flag, IpAddress, HostName, EntryDate,
                        MyEventzCharge, IsAmtMyEventCharge, TicketVerifyTime,
                        RefCode, DiscountPer
                    )
                    VALUES (
                        NEWID(), @BookingUkeyIdForOwnTickets, @AssignByFirstName, @AssignByMobile,
                        0, 0, 0, 0, @TicketCateUkeyId,
                        0, 'SPLIT', NULL, 
                        CASE 
                            WHEN @j <= @TotalSeats 
                            THEN (SELECT SeatNumber FROM @SeatTable WHERE ID = @j)
                            ELSE NULL
                        END, 
                        NULL,
                        'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)},
                        0, 0, NULL,
                        NULL, 0
                    );

                    SET @j = @j + 1;
                END;

            -- INSERT INTO Bookingmast (
            --     BookingUkeyID, EventUkeyId, OrganizerUkeyId, UserUkeyID,
            --     CouponUkeyId, BookingDate, BookingAmt, BookingCode,
            --     TotalGST, TotalConviencefee, DiscountPer, DiscountAmt,
            --     TotalNetAmount, DonationAmt, IsDonationAmt, AdditionalCharges,
            --     RazorpayPaymentId, RazorpayOrderId, RazorpaySignatureId,
            --     IsWhatsapp, IsVerify, IsPayment, flag,
            --     IpAddress, HostName, EntryDate,
            --     IsWalletUsed, UsedWalletAmt, PaymentStatus,
            --     TotalGrossAmt, MyEventzCharge, IsAmtMyEventCharge,
            --     RefCode, BookingMode
            -- )
            -- VALUES (
            --     @BookingUkeyId, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, @UserUkeyId,
            --     NULL, GETDATE(), 0, ${setSQLStringValue(AssignToCode)}, -- BookingAmt = 0 for split, code = AssignToCode
            --     0, 0, 0, 0, -- GST/fees/discount = 0 (adjust later if needed)
            --     0, 0, 0, 0,
            --     NULL, NULL, NULL,
            --     0, 0, 1, 'A',
            --     ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)},
            --     0, 0, 'Success', 0, 0, 0,
            --     NULL, 'SPLIT'
            -- );

            -- -- ========================================
            -- -- 📌 Bookingdetails (Child Entries per ticket)
            -- -- ========================================
            -- DECLARE @i INT = 1;
-- 
            -- WHILE @i <= ${AssignTickets || 0}
            -- BEGIN
            --     INSERT INTO Bookingdetails (
            --         BookingdetailUkeyID, BookingUkeyID, Name, Mobile,
            --         GST, Conviencefee, Amount, DiscAmt, TicketCateUkeyId,
            --         IsVerify, BookingMode, VerifyMode, SeatNumber, VerifiedByUkeyId,
            --         flag, IpAddress, HostName, EntryDate,
            --         MyEventzCharge, IsAmtMyEventCharge, TicketVerifyTime,
            --         RefCode, DiscountPer
            --     )
            --     VALUES (
            --         NEWID(), @BookingUkeyId, ${setSQLStringValue(FullName)}, ${setSQLStringValue(Mobile1)},
            --         0, 0, 0, 0, @TicketCateUkeyId,
            --         0, 'SPLIT', NULL, NULL, NULL,
            --         'A', ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)},
            --         0, 0, NULL,
            --         NULL, 0
            --     );
-- 
            --     SET @i = @i + 1;
            -- END;
            -- ========================================

            -- Insert WhatsApp message
            INSERT INTO WhatsAppMessages (
                OrganizerUkeyId, EventUkeyId, Message, Mobile, WhatsApp,
                TransMode, Status, EntryTime, AssignToCode
            )
            VALUES (
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                N'🎉 Your Ticket is Confirmed!\n\nThank you for booking *' 
                + ISNULL(@EventName, 'Your Event') 
                + N'* with My Eventz 🌟\n\n📅 Event Date: ' + ISNULL(@formattedDate, '') 
                + N'\n🎟️ Confirmed With ${AssignTickets} Qty'
                + N'\n🎟️ Please Visit this Link For Share : ${FRONTED_USER_URL}/home/qr/${HeadCode}/${AssignToCode} \n\nWe look forward to seeing you there! 🎊'
                + N'\n\nPlease Download MyEventZ App for your Tickets. Your Mobile Number is your Login ID and Password is your Mobile Number.'
                + N'\nApp Link for Android : https://play.google.com/store/apps/details?id=com.taxFile.bookingApps'
                + N'\nApp Link for iOS : https://apps.apple.com/in/app/myeventz/id6739251546',
                ${setSQLStringValue(Mobile1)}, 0, 'Booking', 1, GETDATE(), ${setSQLStringValue(AssignToCode)}
            );

            -- EXEC UpdateAvlTickets ${setSQLStringValue(AssignToCode)};
        `
        
        await transaction.request().query(query);

        await transaction.commit();
        
        const WhatsappMessage = await pool.request().query(`select Message from WhatsAppMessages with (NOLOCK) where AssignToCode = ${setSQLStringValue(AssignToCode)} and Mobile = ${setSQLStringValue(Mobile1)} `)

        return res.status(200).json({...successMessage(`Ticket split successfully.`), ...req.body, AssignToCode ,WhatsApp : WhatsappMessage.recordset[0].Message});
    } catch (error) {
        if (transaction) await transaction.rollback();
        return res.status(400).json(errorMessage(error.message));
    }
};


const fetchEventSplitData = async (req, res) => {
    try {
        const { SplitUkeyId, EventUkeyId, OrganizerUkeyId, AssignToCode, HeadCode } = req.query;
        let whereConditions = [];
        if (SplitUkeyId) {
            whereConditions.push(`stm.SplitUkeyId = ${setSQLStringValue(SplitUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`stm.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`stm.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (AssignToCode) {
            whereConditions.push(`stm.AssignToCode = ${setSQLStringValue(AssignToCode)}`);
        }
        if (HeadCode) {
            whereConditions.push(`stm.HeadCode = ${setSQLStringValue(HeadCode)}`);
        }
        whereConditions.push(`stm.flag <> 'D'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getQuery = `SELECT top 1 stm.EventUkeyId, em.SeatArrangment, stm.OrganizerUkeyId, stm.AssignByUserUkeyId,stm.AssignByRole, stm.HeadCode, stm.AvlTickets, stm.SeatingTickets, em.EventName, em.StartEventDate, am.Address1, am.Address2, am.Pincode, am.StateName, am.CityName, em.Location, 
        tm.Category,
        CASE
                    WHEN Stm.AssignByRole <> 'User' THEN OB.FirstName
                    ELSE UB.FullName
                END AS AssignByName,
				CASE
                    WHEN Stm.AssignByRole <> 'User' THEN OB.Mobile1
                    ELSE UB.Mobile1
                END AS AssignBymobile,
				CONCAT('${FRONTED_USER_URL}/home/qr/', Stm.HeadCode, '/', Stm.AssignToCode) AS Link,
        (
        SELECT du.FileName, du.Label, du.docukeyid, du.EventUkeyId, du.OrganizerUkeyId, du.Category
        FROM DocumentUpload du
        WHERE du.UkeyId = em.EventUkeyId and du.Category = 'Event' and du.Category = 'Event' and du.Label = 'Logo'
        FOR JSON PATH
        )
        AS EventImage
        FROM SplitTicketMast stm
        left join EventMaster em on em.EventUkeyId = stm.EventUkeyId
        left join AddressMaster am on em.EventUkeyId = am.EventUkeyId and am.IsPrimaryAddress = 1
		LEFT JOIN OrgUserMaster OB ON Stm.AssignByUserUkeyId = OB.UserUkeyId AND Stm.AssignByRole <> 'User'
            LEFT JOIN UserMaster UB ON Stm.AssignByUserUkeyId = UB.UserUkeyId AND Stm.AssignByRole = 'User'
			left join TicketCategoryMaster tm on tm.TicketCateUkeyId=stm.TicketCateUkeyId ${whereString}`;
        // const countQuery = `SELECT top 1 COUNT(*) AS totalCount FROM SplitTicketMast stm ${whereString}`;
        const result = await pool.request().query(getQuery);

        const result2 = await pool.request().query(`select AvlTickets, OwnTickets from SplitTicketMast where AssignToCode = ${setSQLStringValue(AssignToCode)}`);

        // const result3 = await pool.request().query(`select OwnTickets from SplitTicketMast where AssignToCode = ${setSQLStringValue(HeadCode)}`);
        
        return res.json({...result.recordset[0], AvlTickets: result2.recordset?.[0]?.AvlTickets || 0,HeadOwnTickets: result2.recordset?.[0]?.OwnTickets || 0});
    } catch (error) {
        console.error('Error fetching SplitTicketMast records:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    fetchSplitTicketMaster,
    addUpdateSplitTicketMaster,
    deleteSplitTicketMaster,
    createSplitTicket,
    fetchEventSplitData
};