const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue, safeUnlink } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');
const sharp = require('sharp');
const path = require('path');

const fetchBrand = async (req, res) => {
    try {
        const { Status } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getBrandList = {
            getQuery: `SELECT * FROM tbl_brand ${whereString} ORDER BY BrandId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_brand ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getBrandList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createBrand = async (req, res) => {
    const { Title, URL, Status = true } = req.body;
    let transaction;
    try {
        const Image = req.files?.Image ? req.files.Image[0]?.path.replace(/\\/g, '/') : null;

        const missingKeys = checkKeysAndRequireValues(['Image', 'Title'], { ...req.body, Image })
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Generate thumbnail
        const thumbnailDir = './media/Brand/Thumbnail';
        const thumbnailFilename = 'thumbnail_' + req?.files?.Image[0]?.filename;
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

        await sharp(req?.files?.Image[0]?.path)
            .resize(250, 250) // Adjust width and height as needed
            .toFile(thumbnailPath);

        let imageURLThumbnail = `media/Brand/Thumbnail/thumbnail_${req?.files?.Image[0]?.filename}`;

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_brand (
                Image, Title, Thumbnail, URL, Status
            ) VALUES (
                ${setSQLStringValue(Image)}, 
                ${setSQLStringValue(Title)}, 
                ${setSQLStringValue(imageURLThumbnail)}, 
                ${setSQLStringValue(URL)}, 
                ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            if (req.files?.Image) safeUnlink(req.files.Image[0]?.path);
            return res.status(400).json({ ...errorMessage('No Brand Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Brand.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error
        if (req?.files?.Image) {
            safeUnlink(req.files.Image[0]?.path);
        }
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Brand Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateBrand = async (req, res) => {
    const { BrandId, Title, URL, Status = true } = req.body;
    let transaction;

    try {
        // Get uploaded file path
        const Image = req.files?.Image?.[0]?.path.replace(/\\/g, '/') || null;

        console.log("req.body", req.body);
        console.log('Image:', Image);

        // Validate required fields
        const missingKeys = checkKeysAndRequireValues(['BrandId', 'Title'], { ...req.body });
        if (missingKeys.length > 0) {
            if (req.files?.Image) safeUnlink(req.files.Image[0]?.path);
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Get current image and thumbnail paths if updating image
        let oldImagePath = null;
        let oldThumbnailPath = null;
        let imageURLThumbnail = null;

        if (Image) {
            // Get current brand data
            const brandData = await transaction.request().query(
                `SELECT Image, Thumbnail FROM tbl_brand WHERE BrandId = ${setSQLStringValue(BrandId)}`
            );

            if (!brandData.recordset.length) {
                await transaction.rollback();
                if (req.files?.Image) safeUnlink(req.files.Image[0]?.path);
                return res.status(400).json(errorMessage('Brand not found.'));
            }

            oldImagePath = brandData.recordset[0]?.Image;
            oldThumbnailPath = brandData.recordset[0]?.Thumbnail;

            // Generate new thumbnail from the uploaded image
            const thumbnailDir = './media/Brand/Thumbnail';
            const thumbnailFilename = 'thumbnail_' + req?.files?.Image[0]?.filename;
            const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

            await sharp(req?.files?.Image[0]?.path)
                .resize(250, 250) // Same dimensions as create function
                .toFile(thumbnailPath);

            imageURLThumbnail = `media/Brand/Thumbnail/thumbnail_${req?.files?.Image[0]?.filename}`;
        }

        // Build update query
        const updateFields = [
            Image && `Image = ${setSQLStringValue(Image)}`,
            imageURLThumbnail && `Thumbnail = ${setSQLStringValue(imageURLThumbnail)}`,
            `Title = ${setSQLStringValue(Title)}`,
            `URL = ${setSQLStringValue(URL)}`,
            `Status = ${setSQLBooleanValue(Status)}`
        ].filter(Boolean).join(', ');

        const updateQuery = `
            UPDATE tbl_brand SET ${updateFields}
            WHERE BrandId = ${setSQLStringValue(BrandId)}
        `;

        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            if (req.files?.Image) safeUnlink(req.files.Image[0]?.path);
            if (imageURLThumbnail) safeUnlink(imageURLThumbnail);
            return res.status(400).json(errorMessage('No Brand Updated.'));
        }

        await transaction.commit();

        // Delete old files after successful update
        if (Image && oldImagePath) {
            safeUnlink(oldImagePath);
        }
        if (imageURLThumbnail && oldThumbnailPath) {
            safeUnlink(oldThumbnailPath);
        }

        return res.status(200).json({
            ...successMessage('Successfully updated Brand.'),
            ...req.body
        });

    } catch (error) {
        // Clean up uploaded files in case of error
        if (req.files?.Image) safeUnlink(req.files.Image[0]?.path);
        if (transaction) await transaction.rollback();

        console.log('Update Brand Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteBrand = async (req, res) => {
    const { BrandId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['BrandId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // First, get the image and thumbnail paths before deleting the record
        const selectQuery = `
            SELECT Image, Thumbnail FROM tbl_brand 
            WHERE BrandId = ${setSQLStringValue(BrandId)}
        `;
        const brandData = await transaction.request().query(selectQuery);

        if (brandData.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('Brand not found.'), })
        }

        const imagePath = brandData.recordset[0]?.Image;
        const thumbnailPath = brandData.recordset[0]?.Thumbnail;

        const deleteQuery = `
            DELETE FROM tbl_brand WHERE BrandId = ${setSQLStringValue(BrandId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Brand Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();

        // Delete the image and thumbnail files after successful database deletion
        if (imagePath) {
            safeUnlink(imagePath);
        }
        if (thumbnailPath) {
            safeUnlink(thumbnailPath);
        }

        return res.status(200).json({ ...successMessage('Successfully deleted Brand.'), BrandId });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Brand Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchBrand,
    createBrand,
    updateBrand,
    deleteBrand
}