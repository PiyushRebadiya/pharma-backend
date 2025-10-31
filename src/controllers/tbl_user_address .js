const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchUserAddress = async (req, res) => {
    try {
        const { UserId, AddressType } = req.query;
        let whereConditions = [];

        if (UserId) {
            whereConditions.push(`UserId = ${setSQLStringValue(UserId)}`);
        }

        if (AddressType) {
            whereConditions.push(`AddressType = ${setSQLStringValue(AddressType)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserAddressList = {
            getQuery: `SELECT * FROM tbl_user_address ${whereString} ORDER BY UserAddressId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_user_address ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserAddressList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createUserAddress = async (req, res) => {
    const {
        UserId,
        DeliverToName,
        MobileNumber,
        BuildingName,
        Locality,
        AddressType,
        Pincode,
        City,
        State
    } = req.body;

    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues([
            'UserId',
            'DeliverToName',
            'MobileNumber',
            'BuildingName',
            'Locality',
            'AddressType',
            'Pincode',
            'City',
            'State'
        ], req.body)

        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_user_address (
                UserId, DeliverToName, MobileNumber, BuildingName, 
                Locality, AddressType, Pincode, City, State
            ) VALUES (
                ${setSQLStringValue(UserId)}, 
                ${setSQLStringValue(DeliverToName)}, 
                ${setSQLStringValue(MobileNumber)}, 
                ${setSQLStringValue(BuildingName)}, 
                ${setSQLStringValue(Locality)}, 
                ${setSQLStringValue(AddressType)}, 
                ${setSQLStringValue(Pincode)}, 
                ${setSQLStringValue(City)}, 
                ${setSQLStringValue(State)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Address Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created User Address.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create User Address Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateUserAddress = async (req, res) => {
    const {
        UserAddressId,
        UserId,
        DeliverToName,
        MobileNumber,
        BuildingName,
        Locality,
        AddressType,
        Pincode,
        City,
        State
    } = req.body;

    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues([
            'UserAddressId',
            'UserId',
            'DeliverToName',
            'MobileNumber',
            'BuildingName',
            'Locality',
            'AddressType',
            'Pincode',
            'City',
            'State'
        ], req.body)

        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_user_address SET
                UserId = ${setSQLStringValue(UserId)},
                DeliverToName = ${setSQLStringValue(DeliverToName)},
                MobileNumber = ${setSQLStringValue(MobileNumber)},
                BuildingName = ${setSQLStringValue(BuildingName)},
                Locality = ${setSQLStringValue(Locality)},
                AddressType = ${setSQLStringValue(AddressType)},
                Pincode = ${setSQLStringValue(Pincode)},
                City = ${setSQLStringValue(City)},
                State = ${setSQLStringValue(State)}
            WHERE UserAddressId = ${setSQLStringValue(UserAddressId)}
        `;
        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Address Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated User Address.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update User Address Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteUserAddress = async (req, res) => {
    const { UserAddressId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['UserAddressId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_user_address WHERE UserAddressId = ${setSQLStringValue(UserAddressId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No User Address Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted User Address.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete User Address Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const getUserAddressById = async (req, res) => {
    try {
        const { UserAddressId } = req.params;

        if (!UserAddressId) {
            return res.status(200).json(errorMessage('UserAddressId is required'));
        }

        const query = `
            SELECT * FROM tbl_user_address 
            WHERE UserAddressId = ${setSQLStringValue(UserAddressId)}
        `;

        const result = await pool.request().query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json(errorMessage('User Address not found'));
        }

        return res.status(200).json({
            ...successMessage('User Address fetched successfully'),
            data: result.recordset[0]
        });

    } catch (error) {
        console.log('Get User Address By ID Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchUserAddress,
    createUserAddress,
    updateUserAddress,
    deleteUserAddress,
    getUserAddressById
}