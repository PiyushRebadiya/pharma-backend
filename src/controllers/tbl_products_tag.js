const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchProductsTag = async (req, res) => {
    try {
        const { Status } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getProductsTagList = {
            getQuery: `SELECT * FROM tbl_products_tag ${whereString} ORDER BY ProductTagId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_products_tag ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getProductsTagList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createProductsTag = async (req, res) => {
    const { Title, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['Title'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_products_tag (
                Title, Status
            ) VALUES (
                ${setSQLStringValue(Title)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Tag Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Products Tag.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Products Tag Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateProductsTag = async (req, res) => {
    const { ProductTagId, Title, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductTagId', 'Title'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_products_tag SET
                Title = ${setSQLStringValue(Title)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE ProductTagId = ${setSQLStringValue(ProductTagId)}
        `;
        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Tag Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated Products Tag.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Products Tag Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteProductsTag = async (req, res) => {
    const { ProductTagId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductTagId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_products_tag WHERE ProductTagId = ${setSQLStringValue(ProductTagId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Tag Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted Products Tag.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Products Tag Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchProductsTag,
    createProductsTag,
    updateProductsTag,
    deleteProductsTag
}