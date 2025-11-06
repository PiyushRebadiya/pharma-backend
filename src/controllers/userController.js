const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');
const { generateToken, simpleHash, comparePassword } = require('../utility/jwtUtils');

// Unified Login/Signup API (Google Auth style)
const loginOrSignup = async (req, res) => {
    const { RegisterEmail, Password, FullName, UserName, Mobile } = req.body;
    let transaction;

    try {
        // Check required fields
        const missingKeys = checkKeysAndRequireValues(['RegisterEmail'], req.body);
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Check if user already exists
        const findUserQuery = `
            SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Password, Status 
            FROM tbl_users 
            WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}
        `;

        const result = await transaction.request().query(findUserQuery);

        // User exists - Login flow
        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            // Check if user is active
            if (!user.Status) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('Your account is deactivated. Please contact support.'));
            }

            // If password is provided, verify it
            if (Password) {
                const isPasswordValid = Password === user.Password; // Plain text comparison
                // OR if using hash: const isPasswordValid = comparePassword(Password, user.Password);

                if (!isPasswordValid) {
                    await transaction.rollback();
                    return res.status(400).json(errorMessage('Invalid password'));
                }
            }
            // If no password provided, it's like social login - allow access

            // Generate JWT token
            const tokenPayload = {
                userId: user.UserId,
                registerEmail: user.RegisterEmail,
                fullName: user.FullName,
                role: 'user'
            };

            const token = generateToken(tokenPayload);

            // Commit transaction
            await transaction.commit();

            return res.status(200).json({
                ...successMessage('Login successful'),
                token,
                user: {
                    userId: user.UserId,
                    registerEmail: user.RegisterEmail,
                    fullName: user.FullName,
                    userName: user.UserName,
                    mobile: user.Mobile,
                    status: user.Status
                },
                isNewUser: false
            });
        }
        // User doesn't exist - Signup flow
        else {
            // For signup, require additional fields
            const signupMissingKeys = checkKeysAndRequireValues(['FullName', 'Password'], req.body);
            if (signupMissingKeys.length > 0) {
                await transaction.rollback();
                return res.status(200).json(errorMessage(`${signupMissingKeys.join(', ')} is required for signup`));
            }

            // Check if mobile already exists (if provided)
            if (Mobile) {
                const checkMobileQuery = `
                    SELECT UserId FROM tbl_users 
                    WHERE Mobile = ${setSQLStringValue(Mobile)}
                `;
                const mobileResult = await transaction.request().query(checkMobileQuery);

                if (mobileResult.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(400).json(errorMessage('Mobile number already registered'));
                }
            }

            // Check if username already exists (if provided)
            if (UserName) {
                const checkUsernameQuery = `
                    SELECT UserId FROM tbl_users 
                    WHERE UserName = ${setSQLStringValue(UserName)}
                `;
                const usernameResult = await transaction.request().query(checkUsernameQuery);

                if (usernameResult.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(400).json(errorMessage('Username already taken'));
                }
            }

            // Create new user
            const insertQuery = `
                INSERT INTO tbl_users (
                    RegisterEmail, Password, FullName, UserName, Mobile, Status
                ) VALUES (
                    ${setSQLStringValue(RegisterEmail)},
                    ${setSQLStringValue(Password)}, -- Store as plain text
                    ${setSQLStringValue(FullName)},
                    ${setSQLStringValue(UserName || '')},
                    ${setSQLStringValue(Mobile || '')},
                    ${setSQLBooleanValue(true)}
                )
            `;

            const insertResult = await transaction.request().query(insertQuery);

            if (insertResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('Failed to create user account'));
            }

            // Get the newly created user
            const getNewUserQuery = `
                SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status 
                FROM tbl_users 
                WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}
            `;
            const newUserResult = await transaction.request().query(getNewUserQuery);
            const newUser = newUserResult.recordset[0];

            // Generate JWT token
            const tokenPayload = {
                userId: newUser.UserId,
                registerEmail: newUser.RegisterEmail,
                fullName: newUser.FullName,
                role: 'user'
            };

            const token = generateToken(tokenPayload);

            // Commit transaction
            await transaction.commit();

            return res.status(200).json({
                ...successMessage('Account created successfully'),
                token,
                user: {
                    userId: newUser.UserId,
                    registerEmail: newUser.RegisterEmail,
                    fullName: newUser.FullName,
                    userName: newUser.UserName,
                    mobile: newUser.Mobile,
                    status: newUser.Status
                },
                isNewUser: true
            });
        }

    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Login/Signup Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// Social Login (Google Auth style - no password required)
const socialLogin = async (req, res) => {
    const { RegisterEmail, FullName, UserName, Mobile } = req.body;
    let transaction;

    try {
        const missingKeys = checkKeysAndRequireValues(['RegisterEmail', 'FullName'], req.body);
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Check if user exists
        const findUserQuery = `
            SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status 
            FROM tbl_users 
            WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}
        `;

        const result = await transaction.request().query(findUserQuery);
        let user;

        // User exists - Update profile if needed
        if (result.recordset.length > 0) {
            user = result.recordset[0];

            // Check if user is active
            if (!user.Status) {
                await transaction.rollback();
                return res.status(401).json(errorMessage('Your account is deactivated. Please contact support.'));
            }

            // Update user information if provided and different
            let updateFields = [];

            if (FullName && FullName !== user.FullName) {
                updateFields.push(`FullName = ${setSQLStringValue(FullName)}`);
            }

            if (Mobile && Mobile !== user.Mobile) {
                // Check if mobile is not taken by another user
                const checkMobileQuery = `
                    SELECT UserId FROM tbl_users 
                    WHERE Mobile = ${setSQLStringValue(Mobile)} AND UserId != ${setSQLStringValue(user.UserId)}
                `;
                const mobileResult = await transaction.request().query(checkMobileQuery);

                if (mobileResult.recordset.length === 0) {
                    updateFields.push(`Mobile = ${setSQLStringValue(Mobile)}`);
                }
            }

            if (updateFields.length > 0) {
                const updateQuery = `
                    UPDATE tbl_users SET
                        ${updateFields.join(', ')}
                    WHERE UserId = ${setSQLStringValue(user.UserId)}
                `;
                await transaction.request().query(updateQuery);
            }

        }
        // User doesn't exist - Create new account
        else {
            // Check if mobile already exists (if provided)
            if (Mobile) {
                const checkMobileQuery = `
                    SELECT UserId FROM tbl_users 
                    WHERE Mobile = ${setSQLStringValue(Mobile)}
                `;
                const mobileResult = await transaction.request().query(checkMobileQuery);

                if (mobileResult.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(400).json(errorMessage('Mobile number already registered'));
                }
            }

            // Create new user without password (social login)
            const insertQuery = `
                INSERT INTO tbl_users (
                    RegisterEmail, FullName, UserName, Mobile, Status
                ) VALUES (
                    ${setSQLStringValue(RegisterEmail)},
                    ${setSQLStringValue(FullName)},
                    ${setSQLStringValue(UserName || '')},
                    ${setSQLStringValue(Mobile || '')},
                    ${setSQLBooleanValue(true)}
                )
            `;

            const insertResult = await transaction.request().query(insertQuery);

            if (insertResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('Failed to create user account'));
            }

            // Get the newly created user
            const getNewUserQuery = `
                SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status 
                FROM tbl_users 
                WHERE RegisterEmail = ${setSQLStringValue(RegisterEmail)}
            `;
            const newUserResult = await transaction.request().query(getNewUserQuery);
            user = newUserResult.recordset[0];
        }

        // Generate JWT token
        const tokenPayload = {
            userId: user.UserId,
            registerEmail: user.RegisterEmail,
            fullName: user.FullName,
            role: 'user',
            isSocialLogin: true
        };

        const token = generateToken(tokenPayload);

        // Commit transaction
        await transaction.commit();

        return res.status(200).json({
            ...successMessage(result.recordset.length > 0 ? 'Login successful' : 'Account created successfully'),
            token,
            user: {
                userId: user.UserId,
                registerEmail: user.RegisterEmail,
                fullName: user.FullName,
                userName: user.UserName,
                mobile: user.Mobile,
                status: user.Status
            },
            isNewUser: result.recordset.length === 0
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Social Login Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// Get user profile
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const query = `
            SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status, EntryDate 
            FROM tbl_users 
            WHERE UserId = ${setSQLStringValue(userId)}
        `;

        const result = await pool.request().query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json(errorMessage('User not found'));
        }

        const user = result.recordset[0];
        return res.status(200).json({
            ...successMessage('Profile fetched successfully'),
            user
        });

    } catch (error) {
        console.log('Get Profile Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// Update user profile
const updateProfile = async (req, res) => {
    const { FullName, UserName, Mobile } = req.body;
    let transaction;

    try {
        const userId = req.user.userId;

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        let updateFields = [];

        if (FullName) updateFields.push(`FullName = ${setSQLStringValue(FullName)}`);

        if (Mobile) {
            // Check if mobile is not taken by another user
            const checkMobileQuery = `
                SELECT UserId FROM tbl_users 
                WHERE Mobile = ${setSQLStringValue(Mobile)} AND UserId != ${setSQLStringValue(userId)}
            `;
            const mobileResult = await transaction.request().query(checkMobileQuery);

            if (mobileResult.recordset.length > 0) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('Mobile number already registered'));
            }
            updateFields.push(`Mobile = ${setSQLStringValue(Mobile)}`);
        }

        if (UserName) {
            // Check if username is not taken by another user
            const checkUsernameQuery = `
                SELECT UserId FROM tbl_users 
                WHERE UserName = ${setSQLStringValue(UserName)} AND UserId != ${setSQLStringValue(userId)}
            `;
            const usernameResult = await transaction.request().query(checkUsernameQuery);

            if (usernameResult.recordset.length > 0) {
                await transaction.rollback();
                return res.status(400).json(errorMessage('Username already taken'));
            }
            updateFields.push(`UserName = ${setSQLStringValue(UserName)}`);
        }

        if (updateFields.length === 0) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('No fields to update'));
        }

        const updateQuery = `
            UPDATE tbl_users SET
                ${updateFields.join(', ')}
            WHERE UserId = ${setSQLStringValue(userId)}
        `;

        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('Failed to update profile'));
        }

        // Get updated user data
        const getUserQuery = `
            SELECT UserId, RegisterEmail, FullName, UserName, Mobile, Status 
            FROM tbl_users 
            WHERE UserId = ${setSQLStringValue(userId)}
        `;
        const userResult = await transaction.request().query(getUserQuery);
        const updatedUser = userResult.recordset[0];

        // Commit transaction
        await transaction.commit();

        return res.status(200).json({
            ...successMessage('Profile updated successfully'),
            user: updatedUser
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Profile Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// Change password (for non-social login users)
const changePassword = async (req, res) => {
    const { CurrentPassword, NewPassword } = req.body;
    let transaction;

    try {
        const missingKeys = checkKeysAndRequireValues(['CurrentPassword', 'NewPassword'], req.body);
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const userId = req.user.userId;

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Get current user data
        const getUserQuery = `
            SELECT Password FROM tbl_users WHERE UserId = ${setSQLStringValue(userId)}
        `;
        const userResult = await transaction.request().query(getUserQuery);

        if (userResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json(errorMessage('User not found'));
        }

        const currentStoredPassword = userResult.recordset[0].Password;

        // Verify current password
        const isCurrentPasswordValid = CurrentPassword === currentStoredPassword;

        if (!isCurrentPasswordValid) {
            await transaction.rollback();
            return res.status(401).json(errorMessage('Current password is incorrect'));
        }

        // Update to new password
        const updateQuery = `
            UPDATE tbl_users SET 
            Password = ${setSQLStringValue(NewPassword)}
            WHERE UserId = ${setSQLStringValue(userId)}
        `;

        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('Failed to update password'));
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json(successMessage('Password updated successfully'));

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Change Password Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    loginOrSignup,
    socialLogin,
    getUserProfile,
    updateProfile,
    changePassword
}