const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchUsers = async (req, res) => {
    try {
        const { Status, RegisterEmail } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }
        if (RegisterEmail) {
            whereConditions.push(`RegisterEmail = ${setSQLStringValue(RegisterEmail)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUsersList = {
            getQuery: `SELECT * FROM tbl_users ${whereString} ORDER BY UserId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_users ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUsersList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createUser = async (req, res) => {
    const { RegisterEmail, FullName, Password, UserName, Mobile, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['RegisterEmail', 'FullName', 'Password', 'UserName'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Check for unique constraints before insertion
        const checkUniqueQuery = `
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM tbl_users WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}) THEN 1 ELSE 0 END AS emailExists,
                CASE WHEN EXISTS (SELECT 1 FROM tbl_users WHERE UserName = ${setSQLStringValue(UserName)}) THEN 1 ELSE 0 END AS usernameExists
        `;

        const uniqueCheck = await pool.request().query(checkUniqueQuery);
        const { emailExists, usernameExists } = uniqueCheck.recordset[0];

        if (emailExists) {
            return res.status(400).json(errorMessage('Email already exists. Please use a different email.'));
        }
        if (usernameExists) {
            return res.status(400).json(errorMessage('Username already exists. Please choose a different username.'));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_users (
                RegisterEmail, FullName, Password, UserName, Mobile, Status
            ) VALUES (
                ${setSQLStringValue(RegisterEmail)}, 
                ${setSQLStringValue(FullName)}, 
                ${setSQLStringValue(Password)}, 
                ${setSQLStringValue(UserName)}, 
                ${setSQLStringValue(Mobile)}, 
                ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created User.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create User Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateUser = async (req, res) => {
    const { UserId, RegisterEmail, FullName, Password, UserName, Mobile, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['UserId', 'RegisterEmail', 'FullName', 'Password', 'UserName'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Check if user exists
        const userExistsQuery = `SELECT COUNT(*) AS userCount FROM tbl_users WHERE UserId = ${setSQLStringValue(UserId)}`;
        const userExists = await pool.request().query(userExistsQuery);

        if (userExists.recordset[0].userCount === 0) {
            return res.status(404).json(errorMessage('User not found.'));
        }

        // Check for unique constraints (excluding current user)
        const checkUniqueQuery = `
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM tbl_users WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)} AND UserId != ${setSQLStringValue(UserId)}) THEN 1 ELSE 0 END AS emailExists,
                CASE WHEN EXISTS (SELECT 1 FROM tbl_users WHERE UserName = ${setSQLStringValue(UserName)} AND UserId != ${setSQLStringValue(UserId)}) THEN 1 ELSE 0 END AS usernameExists
        `;

        const uniqueCheck = await pool.request().query(checkUniqueQuery);
        const { emailExists, usernameExists } = uniqueCheck.recordset[0];

        if (emailExists) {
            return res.status(400).json(errorMessage('Email already exists. Please use a different email.'));
        }
        if (usernameExists) {
            return res.status(400).json(errorMessage('Username already exists. Please choose a different username.'));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_users SET
                RegisterEmail = ${setSQLStringValue(RegisterEmail)},
                FullName = ${setSQLStringValue(FullName)},
                Password = ${setSQLStringValue(Password)},
                UserName = ${setSQLStringValue(UserName)},
                Mobile = ${setSQLStringValue(Mobile)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE UserId = ${setSQLStringValue(UserId)}
        `;
        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated User.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update User Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteUser = async (req, res) => {
    const { UserId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['UserId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Check if user exists
        const userExistsQuery = `SELECT COUNT(*) AS userCount FROM tbl_users WHERE UserId = ${setSQLStringValue(UserId)}`;
        const userExists = await pool.request().query(userExistsQuery);

        if (userExists.recordset[0].userCount === 0) {
            return res.status(404).json(errorMessage('User not found.'));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_users WHERE UserId = ${setSQLStringValue(UserId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted User.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete User Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const getUserById = async (req, res) => {
    try {
        const { UserId } = req.params;

        if (!UserId) {
            return res.status(400).json(errorMessage('User ID is required'));
        }

        const query = `
            SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status
            FROM tbl_users 
            WHERE UserId = ${setSQLStringValue(UserId)}
        `;

        const result = await pool.request().query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json(errorMessage('User not found.'));
        }

        return res.status(200).json({
            ...successMessage('User fetched successfully.'),
            data: result.recordset[0]
        });

    } catch (error) {
        console.log('Get User By ID Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const checkEmailAvailability = async (req, res) => {
    try {
        const { RegisterEmail, UserId } = req.query;

        if (!RegisterEmail) {
            return res.status(400).json(errorMessage('RegisterEmail is required'));
        }

        let query = `
            SELECT COUNT(*) AS emailCount 
            FROM tbl_users 
            WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}
        `;

        if (UserId) {
            query += ` AND UserId != ${setSQLStringValue(UserId)}`;
        }

        const result = await pool.request().query(query);
        const isAvailable = result.recordset[0].emailCount === 0;

        return res.status(200).json({
            ...successMessage('Email availability checked successfully.'),
            isAvailable,
            email: RegisterEmail
        });

    } catch (error) {
        console.log('Check Email Availability Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const checkUsernameAvailability = async (req, res) => {
    try {
        const { UserName, UserId } = req.query;

        if (!UserName) {
            return res.status(400).json(errorMessage('Username is required'));
        }

        let query = `
            SELECT COUNT(*) AS usernameCount 
            FROM tbl_users 
            WHERE UserName = ${setSQLStringValue(UserName)}
        `;

        if (UserId) {
            query += ` AND UserId != ${setSQLStringValue(UserId)}`;
        }

        const result = await pool.request().query(query);
        const isAvailable = result.recordset[0].usernameCount === 0;

        return res.status(200).json({
            ...successMessage('Username availability checked successfully.'),
            isAvailable,
            username: UserName
        });

    } catch (error) {
        console.log('Check Username Availability Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
    checkEmailAvailability,
    checkUsernameAvailability
}