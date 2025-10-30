const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchAdmin = async (req, res) => {
    try {
        const { Status } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getadminList = {
            getQuery: `SELECT * FROM tbl_admin ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_admin ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getadminList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createAdmin = async (req, res) => {
    const { RegisterMobile, Password, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['RegisterMobile', 'Password'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_admin (
                RegisterMobile, Password, Status
            ) VALUES (
                ${setSQLStringValue(RegisterMobile)}, ${setSQLStringValue(Password)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Admin Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Admin.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Admin Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateAdmin = async (req, res) => {
    const { AdminId, RegisterMobile, Password, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['AdminId', 'RegisterMobile', 'Password'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_admin SET
                RegisterMobile = ${setSQLStringValue(RegisterMobile)},
                Password = ${setSQLStringValue(Password)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE AdminId = ${setSQLStringValue(AdminId)}
        `;
        const result = await transaction.request().query(updateQuery);
        
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Admin Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated Admin.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Admin Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteAdmin = async (req, res) => {
    const { AdminId } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['AdminId'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_admin WHERE AdminId = ${setSQLStringValue(AdminId)}
        `;
        const result = await transaction.request().query(deleteQuery);
        
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Admin Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted Admin.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Admin Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchAdmin,
    createAdmin,
    updateAdmin,
    deleteAdmin
}