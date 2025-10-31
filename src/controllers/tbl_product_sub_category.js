const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchProductSubCategory = async (req, res) => {
    try {
        const { Status, ProductCatId } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`psc.Status = ${setSQLBooleanValue(Status)}`);
        }

        if (ProductCatId) {
            whereConditions.push(`psc.ProductCatId = ${setSQLStringValue(ProductCatId)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getProductSubCategoryList = {
            getQuery: `SELECT psc.*, pc.Title As ProductCatTitle FROM tbl_product_sub_category psc
                       LEFT JOIN tbl_product_category pc ON pc.ProductCatId = psc.ProductCatId 
                       ${whereString} ORDER BY psc.EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_product_sub_category ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getProductSubCategoryList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createProductSubCategory = async (req, res) => {
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

        const insertQuery = `
            INSERT INTO tbl_product_sub_category (
                ProductCatId, Title, OrderId, Status
            ) VALUES (
                ${setSQLStringValue(ProductCatId)}, ${setSQLStringValue(Title)}, ${setSQLStringValue(OrderId)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Sub Category Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Product Sub Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Product Sub Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateProductSubCategory = async (req, res) => {
    const { ProductSubCatId, ProductCatId, Title, OrderId, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductSubCatId', 'ProductCatId', 'Title'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_product_sub_category SET
                ProductCatId = ${setSQLStringValue(ProductCatId)},
                Title = ${setSQLStringValue(Title)},
                OrderId = ${setSQLStringValue(OrderId)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE ProductSubCatId = ${setSQLStringValue(ProductSubCatId)}
        `;
        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Sub Category Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated Product Sub Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Product Sub Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteProductSubCategory = async (req, res) => {
    const { ProductSubCatId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductSubCatId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_product_sub_category WHERE ProductSubCatId = ${setSQLStringValue(ProductSubCatId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Product Sub Category Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted Product Sub Category.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Product Sub Category Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchProductSubCategory,
    createProductSubCategory,
    updateProductSubCategory,
    deleteProductSubCategory
}