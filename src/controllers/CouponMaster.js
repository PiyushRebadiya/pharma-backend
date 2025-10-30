const {
    errorMessage,successMessage, checkKeysAndRequireValues, setSQLStringValue, setSQLNumberValue, setSQLBooleanValue, getCommonAPIResponse, getCommonKeys,
    setSQLDecimalValue,
    setSQLDateTime
} = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const FetchCoupons = async (req, res) => {
    try {
        const { CouponUkeyId, Name, IsActive, EventUkeyId, OrganizerUkeyId, CouponStatus } = req.query;
        let whereConditions = [];

        if (CouponUkeyId) {
            whereConditions.push(`CM.CouponUkeyId = ${setSQLStringValue(CouponUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`CM.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`CM.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (CouponStatus) {
            whereConditions.push(`CM.CouponStatus = ${setSQLStringValue(CouponStatus)}`);
        }
        if (IsActive) {
            whereConditions.push(`CM.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        whereConditions.push(`CM.flag <> 'D'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const queries = {
            getQuery: `SELECT CM.*, CMP.CouponStatus AS PermissionStatus FROM CouponMaster CM 
            LEFT JOIN CouponMasterPermission CMP ON CM.CouponUkeyId = CMP.CouponUkeyId and CMP.flag <> 'D'
            ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM CouponMaster CM
            LEFT JOIN CouponMasterPermission CMP ON CM.CouponUkeyId = CMP.CouponUkeyId and CMP.flag <> 'D'
            ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, queries);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const FetchCouponsPermission = async (req, res) => {
    try {
        const { CouponUkeyId, Name, IsActive, EventUkeyId, OrganizerUkeyId, CouponStatus } = req.query;
        let whereConditions = [];

        if (CouponUkeyId) {
            whereConditions.push(`CouponUkeyId = ${setSQLStringValue(CouponUkeyId)}`);
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
        whereConditions.push(`flag <> 'D'`);
        whereConditions.push(`CouponStatus = 'INPROGRESS'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const queries = {
            getQuery: `SELECT * FROM CouponMasterPermission ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM CouponMasterPermission ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, queries);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const FetchCouponsPermissionById = async (req, res) => {
    try {
        const { CouponUkeyId, Name, IsActive, EventUkeyId, OrganizerUkeyId, CouponStatus } = req.query;
        let whereConditions = [];

        if (CouponUkeyId) {
            whereConditions.push(`CouponUkeyId = ${setSQLStringValue(CouponUkeyId)}`);
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
        whereConditions.push(`flag <> 'D'`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const result = await pool.request().query(`SELECT * FROM CouponMaster ${whereString} ORDER BY EntryDate DESC`)
        const resultPermission = await pool.request().query(`SELECT * FROM CouponMasterPermission ${whereString} ORDER BY EntryDate DESC`)

        return res.json({ NewEntry : resultPermission.recordset, OldEntry : result.recordset});
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

// Insert or Update CouponMaster
const CouponMaster = async (req, res) => {
    const {
        CouponUkeyId, EventUkeyId, OrganizerUkeyId, CouponCode, Remarks,
        isAmount, Discount, IsActive, StartDate, EndDate, flag, CouponStatus,
        LimitAmt = 0, LimitTickets = 0, IswalletAdd = false, WalletAmt = 0
    } = req.body;

    let transaction;

    try {
        if (!['A', 'U'].includes(flag)) {
            return res.status(400).json(errorMessage("Use 'A' flag to add and 'U' flag to update."));
        }

        const missingKeys = checkKeysAndRequireValues(
            ['CouponUkeyId', 'EventUkeyId', 'CouponCode', 'isAmount', 'Discount'],
            req.body
        );

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        transaction = pool.transaction();
        await transaction.begin();

        if (flag === 'U') {
            let updateQuery = `
                UPDATE CouponMasterPermission SET flag = 'D'
                WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)};
            `;

            if (CouponStatus === 'PUBLISHED' || (!IsActive && CouponStatus === 'PENDING')) {
                updateQuery += `
                    DELETE FROM CouponMaster WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)};
                `;
            }

            await transaction.request().query(updateQuery);
        }

        if (
            flag === 'A' ||
            (flag === 'U' && CouponStatus === 'PUBLISHED') ||
            (flag === 'U' && !IsActive && CouponStatus === 'PENDING')
        ) {
            await transaction.request().query(`
                INSERT INTO CouponMaster (
                    CouponUkeyId, EventUkeyId, OrganizerUkeyId, CouponCode, Remarks,
                    isAmount, Discount, IsActive, UserId, UserName, flag,
                    IpAddress, HostName, EntryDate, StartDate, EndDate, CouponStatus,
                    LimitAmt, LimitTickets, IswalletAdd, WalletAmt
                ) VALUES (
                    ${setSQLStringValue(CouponUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                    ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(CouponCode)},
                    ${setSQLStringValue(Remarks)}, ${setSQLBooleanValue(isAmount)},
                    ${setSQLDecimalValue(Discount)}, ${setSQLBooleanValue(IsActive)},
                    ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)},
                    ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)},
                    ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)},
                    ${setSQLDateTime(StartDate)}, ${setSQLDateTime(EndDate)},
                    ${setSQLStringValue(CouponStatus)}, ${setSQLNumberValue(LimitAmt)},
                    ${setSQLNumberValue(LimitTickets)}, ${setSQLBooleanValue(IswalletAdd)},
                    ${setSQLNumberValue(WalletAmt)}
                );
            `);
        }

        // Insert into CouponMasterPermission always
        await transaction.request().query(`
            INSERT INTO CouponMasterPermission (
                CouponUkeyId, EventUkeyId, OrganizerUkeyId, CouponCode, Remarks,
                isAmount, Discount, IsActive, UserId, UserName, flag,
                IpAddress, HostName, EntryDate, StartDate, EndDate, CouponStatus,
                LimitAmt, LimitTickets, IswalletAdd, WalletAmt
            ) VALUES (
                ${setSQLStringValue(CouponUkeyId)}, ${setSQLStringValue(EventUkeyId)},
                ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(CouponCode)},
                ${setSQLStringValue(Remarks)}, ${setSQLBooleanValue(isAmount)},
                ${setSQLDecimalValue(Discount)}, ${setSQLBooleanValue(IsActive)},
                ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)},
                ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)},
                ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)},
                ${setSQLDateTime(StartDate)}, ${setSQLDateTime(EndDate)},
                ${setSQLStringValue(CouponStatus)}, ${setSQLNumberValue(LimitAmt)},
                ${setSQLNumberValue(LimitTickets)}, ${setSQLBooleanValue(IswalletAdd)},
                ${setSQLNumberValue(WalletAmt)}
            );
        `);

        await transaction.commit();

        return res.status(200).json(successMessage(flag === 'A' ? 'Coupon Created successfully.' : 'Coupon updated successfully.'));
    } catch (error) {
        console.error('Coupon Transaction Error:', error);
        if (transaction) await transaction.rollback();
        return res.status(500).send(errorMessage(error?.message || 'Internal Server Error'));
    }
};

// Remove Coupon Entry
const RemoveCoupon = async (req, res) => {
    try {
        const { CouponUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['CouponUkeyId', 'OrganizerUkeyId'], req.query);

        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const query = `
            update CouponMaster set flag = 'D' WHERE CouponUkeyId = ${setSQLStringValue(CouponUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;

        const result = await pool.request().query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No template found to delete.'));
        }

        return res.status(200).json(successMessage('Template deleted successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    FetchCoupons,
    CouponMaster,
    RemoveCoupon,
    FetchCouponsPermission,
    FetchCouponsPermissionById
};
