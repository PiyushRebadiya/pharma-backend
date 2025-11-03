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
            getQuery: `SELECT * FROM tbl_product_category ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_product_category ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getProductCategoryList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const fetchProductCategoryWithSubcategories = async (req, res) => {
    try {
        let whereConditions = [];

        whereConditions.push(`c.Status = 1`);
        whereConditions.push(`s.Status = 1`);
        whereConditions.push(`c.DashboardView = 1`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Modified query to get categories with their subcategories
        const getProductCategoryList = {
            getQuery: `SELECT 
                c.Title AS Category,
                s.Title AS Subcategory
            FROM [MyEventZTest].[dbo].[tbl_product_category] c
            INNER JOIN [MyEventZTest].[dbo].[tbl_product_sub_category] s 
                ON c.ProductCatId = s.ProductCatId
            ${whereString}
            ORDER BY c.Title, s.Title`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM (
                SELECT DISTINCT c.ProductCatId 
                FROM [MyEventZTest].[dbo].[tbl_product_category] c
                INNER JOIN [MyEventZTest].[dbo].[tbl_product_sub_category] s 
                    ON c.ProductCatId = s.ProductCatId
                ${whereString}
            ) AS distinct_categories`
        };

        const result = await getCommonAPIResponse(req, res, getProductCategoryList);

        // Transform the flat data into nested category-subcategory structure
        if (result && result.data) {
            const transformedData = transformCategoryData(result.data);
            return res.json({
                ...result,
                data: transformedData
            });
        }

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

// Helper function to transform flat data into nested structure
const transformCategoryData = (flatData) => {
    const categoryMap = {};

    flatData.forEach(item => {
        const { Category, Subcategory } = item;
        
        if (!categoryMap[Category]) {
            categoryMap[Category] = {
                category: Category,
                subcategories: []
            };
        }
        
        if (Subcategory && !categoryMap[Category].subcategories.includes(Subcategory)) {
            categoryMap[Category].subcategories.push(Subcategory);
        }
    });

    // Convert the map to array and sort subcategories alphabetically
    return Object.values(categoryMap).map(cat => ({
        ...cat,
        subcategories: cat.subcategories.sort()
    }));
}
const createProductCategory = async (req, res) => {
    const { Title, OrderId, Status = true, DashboardView = false } = req.body;
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
                Title, OrderId, Status, DashboardView
            ) VALUES (
                ${setSQLStringValue(Title)}, ${setSQLStringValue(OrderId)}, ${setSQLBooleanValue(Status)}, ${setSQLBooleanValue(DashboardView)}
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
    const { ProductCatId, Title, OrderId, Status = true, DashboardView = false } = req.body;
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
                Status = ${setSQLBooleanValue(Status)},
                DashboardView = ${setSQLBooleanValue(DashboardView)}
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
    deleteProductCategory,
    fetchProductCategoryWithSubcategories
}