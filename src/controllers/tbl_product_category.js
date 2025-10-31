const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchProductCategory = async (req, res) => {
    try {
        const { Status } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getProductCategoryList = {
            getQuery: `SELECT * FROM tbl_product_category ${whereString} ORDER BY OrderId ASC, EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_product_category ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getProductCategoryList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createProductCategory = async (req, res) => {
    const { Title, OrderId, Status = true } = req.body;
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
            INSERT INTO tbl_product_category (
                Title, OrderId, Status
            ) VALUES (
                ${setSQLStringValue(Title)}, ${setSQLStringValue(OrderId)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Category Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Product Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Product Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateProductCategory = async (req, res) => {
    const { ProductCatId, Title, OrderId, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductCatId', 'Title'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_product_category SET
                Title = ${setSQLStringValue(Title)},
                OrderId = ${setSQLStringValue(OrderId)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE ProductCatId = ${setSQLStringValue(ProductCatId)}
        `;
        const result = await transaction.request().query(updateQuery);
        
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Category Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated Product Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Product Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteProductCategory = async (req, res) => {
    const { ProductCatId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductCatId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_product_category WHERE ProductCatId = ${setSQLStringValue(ProductCatId)}
        `;
        const result = await transaction.request().query(deleteQuery);
        
        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Category Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted Product Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Product Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchProductCategory,
    createProductCategory,
    updateProductCategory,
    deleteProductCategory
}