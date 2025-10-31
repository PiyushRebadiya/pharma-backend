const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchProductsReview = async (req, res) => {
    try {
        const { Status, UserId, ProductId } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        if (UserId) {
            whereConditions.push(`UserId = ${setSQLStringValue(UserId)}`);
        }

        if (ProductId) {
            whereConditions.push(`ProductId = ${setSQLStringValue(ProductId)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getProductsReviewList = {
            getQuery: `SELECT * FROM tbl_products_review ${whereString} ORDER BY ProductReviewId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_products_review ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getProductsReviewList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createProductsReview = async (req, res) => {
    const { Description, Rating, UserId, ProductId, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['Description', 'Rating', 'UserId', 'ProductId'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_products_review (
                Description, Rating, UserId, ProductId, Status
            ) VALUES (
                ${setSQLStringValue(Description)}, ${setSQLStringValue(Rating)}, ${setSQLStringValue(UserId)}, ${setSQLStringValue(ProductId)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Review Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Products Review.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Products Review Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateProductsReview = async (req, res) => {
    const { ProductReviewId, Description, Rating, UserId, ProductId, Status = true } = req.body;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductReviewId', 'Description', 'Rating', 'UserId', 'ProductId'], req.body)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const updateQuery = `
            UPDATE tbl_products_review SET
                Description = ${setSQLStringValue(Description)},
                Rating = ${setSQLStringValue(Rating)},
                UserId = ${setSQLStringValue(UserId)},
                ProductId = ${setSQLStringValue(ProductId)},
                Status = ${setSQLBooleanValue(Status)}
            WHERE ProductReviewId = ${setSQLStringValue(ProductReviewId)}
        `;
        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Review Updated.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully updated Products Review.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Update Products Review Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteProductsReview = async (req, res) => {
    const { ProductReviewId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductReviewId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const deleteQuery = `
            DELETE FROM tbl_products_review WHERE ProductReviewId = ${setSQLStringValue(ProductReviewId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Products Review Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully deleted Products Review.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Products Review Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchProductsReview,
    createProductsReview,
    updateProductsReview,
    deleteProductsReview
}