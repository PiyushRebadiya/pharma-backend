const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue, safeUnlink } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');

const fetchCarousel = async (req, res) => {
    try {
        const { Status } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`Status = ${setSQLBooleanValue(Status)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getCarouselList = {
            getQuery: `SELECT * FROM tbl_carousel ${whereString} ORDER BY CarouselId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_carousel ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getCarouselList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createCarousel = async (req, res) => {
    const { URL, Status = true } = req.body;
    let transaction;
    try {
        const Image = req.files?.Image ? req.files.Image[0]?.path.replace(/\\/g, '/') : null;
        const missingKeys = checkKeysAndRequireValues(['Image'], { ...req.body, Image })
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const insertQuery = `
            INSERT INTO tbl_carousel (
                Image, URL, Status
            ) VALUES (
                ${setSQLStringValue(Image)}, ${setSQLStringValue(URL)}, ${setSQLBooleanValue(Status)}
            )
        `;
        const result = await transaction.request().query(insertQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            safeUnlink(req.files.Image[0]?.path);
            return res.status(400).json({ ...errorMessage('No Carousel Created.'), })
        }

        // Commit transaction
        await transaction.commit();
        return res.status(200).json({ ...successMessage('Successfully created Carousel.'), ...req.body });
    } catch (error) {
        // Rollback transaction in case of error

        if (req?.files?.Image) {
            safeUnlink(req.files.Image[0]?.path);
        }
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Carousel Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateCarousel = async (req, res) => {
    const { CarouselId, URL, Status = true } = req.body;
    let transaction;

    try {
        // Get uploaded file path
        const Image = req.files?.Image?.[0]?.path.replace(/\\/g, '/') || null;

        console.log("req.body", req.body);
        console.log('Image:', Image);

        // Validate required fields
        const missingKeys = checkKeysAndRequireValues(['CarouselId'], { ...req.body, Image });
        if (missingKeys.length > 0) {
            safeUnlink(req.files?.Image?.[0]?.path);
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Get current image path if updating image
        let oldImagePath = null;
        if (Image) {
            const carouselData = await transaction.request().query(
                `SELECT Image FROM tbl_carousel WHERE CarouselId = ${setSQLStringValue(CarouselId)}`
            );

            if (!carouselData.recordset.length) {
                await transaction.rollback();
                safeUnlink(req.files.Image[0]?.path);
                return res.status(400).json(errorMessage('Carousel not found.'));
            }

            oldImagePath = carouselData.recordset[0]?.Image;
        }

        // Build update query
        const updateFields = [
            Image && `Image = ${setSQLStringValue(Image)}`,
            `URL = ${setSQLStringValue(URL)}`,
            `Status = ${setSQLBooleanValue(Status)}`
        ].filter(Boolean).join(', ');

        const updateQuery = `
            UPDATE tbl_carousel SET ${updateFields}
            WHERE CarouselId = ${setSQLStringValue(CarouselId)}
        `;

        const result = await transaction.request().query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            safeUnlink(req.files?.Image?.[0]?.path);
            return res.status(400).json(errorMessage('No Carousel Updated.'));
        }

        await transaction.commit();

        // Delete old image after successful update
        if (Image && oldImagePath) {
            safeUnlink(oldImagePath);
        }

        return res.status(200).json({
            ...successMessage('Successfully updated Carousel.'),
            ...req.body
        });

    } catch (error) {
        safeUnlink(req.files?.Image?.[0]?.path);
        if (transaction) await transaction.rollback();

        console.log('Update Carousel Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteCarousel = async (req, res) => {
    const { CarouselId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['CarouselId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // First, get the image path before deleting the record
        const selectQuery = `
            SELECT Image FROM tbl_carousel 
            WHERE CarouselId = ${setSQLStringValue(CarouselId)}
        `;
        const carouselData = await transaction.request().query(selectQuery);

        if (carouselData.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('Carousel not found.'), })
        }

        const imagePath = carouselData.recordset[0]?.Image;

        const deleteQuery = `
            DELETE FROM tbl_carousel WHERE CarouselId = ${setSQLStringValue(CarouselId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json({ ...errorMessage('No Carousel Deleted.'), })
        }

        // Commit transaction
        await transaction.commit();

        // Delete the image file after successful database deletion
        if (imagePath) {
            safeUnlink(imagePath);
        }

        return res.status(200).json({ ...successMessage('Successfully deleted Carousel.'), CarouselId });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Carousel Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchCarousel,
    createCarousel,
    updateCarousel,
    deleteCarousel
}