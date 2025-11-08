const { errorMessage, successMessage, checkKeysAndRequireValues, setSQLBooleanValue, getCommonAPIResponse, setSQLStringValue, safeUnlink } = require("../common/main");
const { pool } = require('../sql/connectToDatabase');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const fetchProduct = async (req, res) => {
    try {
        const { Status, ProductId } = req.query;
        let whereConditions = [];

        if (Status && setSQLBooleanValue(Status)) {
            whereConditions.push(`p.Status = ${setSQLBooleanValue(Status)}`);
        }

        if (ProductId) {
            whereConditions.push(`p.ProductId = ${setSQLStringValue(ProductId)}`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getProductList = {
            getQuery: `
                SELECT 
                    p.*
                FROM tbl_products p 
                ${whereString} 
                ORDER BY p.ProductId DESC
            `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM tbl_products p ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getProductList);

        // If single product fetch, also get images details
        if (result.data && result.data.length > 0) {
            for (let i = 0; i < result.data.length; i++) {
                const imagesQuery = `
                SELECT ProductImageId, Image, Thumbnail FROM tbl_products_image 
                WHERE Status = 1 AND ProductId = ${setSQLStringValue(result.data[i].ProductId)}
                ORDER BY ProductImageId ASC
            `;
                const imagesResult = await pool.request().query(imagesQuery);
                result.data[i].ImagesData = imagesResult.recordset;
            }
        }

        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

const createProduct = async (req, res) => {
    const {
        Title,
        OriginalPrice,
        HighPrice,
        ShortDecription,
        MainDecription1,
        MainDecription2,
        Quantity,
        ProductTag,
        ProductTagTitle,
        ProductCatId,
        ProductCatTitle,
        ProductSubCatId,
        ProductSubCatTitle,
        BrandId,
        BrandTitle,
        Combo = false,
        Tranding = false,
        OrderId,
        CommonBulkId,
        Status = true
    } = req.body;

    let transaction;
    try {
        const Images = req.files?.Images || [];
        const MainImageFile = req.files?.MainImage ? req.files.MainImage[0] : null;

        const missingKeys = checkKeysAndRequireValues(['Title'], req.body);
        if (missingKeys.length > 0) {
            // Clean up uploaded files if validation fails
            if (Images.length > 0) {
                Images.forEach(file => safeUnlink(file.path));
            }
            if (MainImageFile) {
                safeUnlink(MainImageFile.path);
            }
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Handle Main Image
        let mainImagePath = null;
        let mainImageThumbnailPath = null;

        if (MainImageFile) {
            mainImagePath = MainImageFile.path.replace(/\\/g, '/');
            
            // Generate main image thumbnail
            const thumbnailDir = './media/Products/Thumbnail';
            const thumbnailFilename = 'main_thumbnail_' + MainImageFile.filename;
            const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

            await sharp(MainImageFile.path)
                .resize(250, 250)
                .toFile(thumbnailPath);

            mainImageThumbnailPath = `media/Products/Thumbnail/main_thumbnail_${MainImageFile.filename}`;
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Insert main product with MainImage fields
        const insertProductQuery = `
            INSERT INTO tbl_products (
                Title, OriginalPrice, HighPrice, ShortDecription, MainDecription1, 
                MainDecription2, Quantity, ProductTag, ProductTagTitle, ProductCatId, ProductCatTitle, 
                ProductSubCatId, ProductSubCatTitle, BrandId, BrandTitle, Combo, 
                Tranding, OrderId, CommonBulkId, Status, MainImage, MainImageThumbnail
            ) VALUES (
                ${setSQLStringValue(Title)},
                ${setSQLStringValue(OriginalPrice)},
                ${setSQLStringValue(HighPrice)},
                ${setSQLStringValue(ShortDecription)},
                ${setSQLStringValue(MainDecription1)},
                ${setSQLStringValue(MainDecription2)},
                ${setSQLStringValue(Quantity)},
                ${setSQLStringValue(ProductTag)},
                ${setSQLStringValue(ProductTagTitle)},
                ${setSQLStringValue(ProductCatId)},
                ${setSQLStringValue(ProductCatTitle)},
                ${setSQLStringValue(ProductSubCatId)},
                ${setSQLStringValue(ProductSubCatTitle)},
                ${setSQLStringValue(BrandId)},
                ${setSQLStringValue(BrandTitle)},
                ${setSQLBooleanValue(Combo)},
                ${setSQLBooleanValue(Tranding)},
                ${setSQLStringValue(OrderId)},
                ${setSQLStringValue(CommonBulkId)},
                ${setSQLBooleanValue(Status)},
                ${setSQLStringValue(mainImagePath)},
                ${setSQLStringValue(mainImageThumbnailPath)}
            );
            SELECT SCOPE_IDENTITY() AS ProductId;
        `;

        const productResult = await transaction.request().query(insertProductQuery);
        const productId = productResult.recordset[0]?.ProductId;

        if (!productId) {
            await transaction.rollback();
            if (Images.length > 0) {
                Images.forEach(file => safeUnlink(file.path));
            }
            if (MainImageFile) {
                safeUnlink(MainImageFile.path);
                if (mainImageThumbnailPath) {
                    safeUnlink(mainImageThumbnailPath);
                }
            }
            return res.status(400).json(errorMessage('No Product Created.'));
        }

        // Handle product images
        const imageIds = [];
        if (Images.length > 0) {
            for (const file of Images) {
                const imagePath = file.path.replace(/\\/g, '/');

                // Generate thumbnail
                const thumbnailDir = './media/Products/Thumbnail';
                const thumbnailFilename = 'thumbnail_' + file.filename;
                const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

                await sharp(file.path)
                    .resize(250, 250)
                    .toFile(thumbnailPath);

                const imageURLThumbnail = `media/Products/Thumbnail/thumbnail_${file.filename}`;

                // Insert image record
                const insertImageQuery = `
                    INSERT INTO tbl_products_image (Image, Thumbnail, ProductId, Status)
                    VALUES (
                        ${setSQLStringValue(imagePath)},
                        ${setSQLStringValue(imageURLThumbnail)},
                        ${setSQLStringValue(productId)},
                        ${setSQLBooleanValue(true)}
                    );
                    SELECT SCOPE_IDENTITY() AS ProductImageId;
                `;

                const imageResult = await transaction.request().query(insertImageQuery);
                const imageId = imageResult.recordset[0]?.ProductImageId;

                if (imageId) {
                    imageIds.push(imageId);
                }
            }
        }

        // Update product with image IDs
        if (imageIds.length > 0) {
            const updateImagesQuery = `
                UPDATE tbl_products 
                SET Images = ${setSQLStringValue(imageIds.join(','))}
                WHERE ProductId = ${setSQLStringValue(productId)}
            `;
            await transaction.request().query(updateImagesQuery);
        }

        // Commit transaction
        await transaction.commit();

        return res.status(200).json({
            ...successMessage('Successfully created Product.'),
            ProductId: productId,
            ...req.body
        });

    } catch (error) {
        // Rollback transaction and clean up files in case of error
        if (req.files?.Images) {
            req.files.Images.forEach(file => safeUnlink(file.path));
        }
        if (req.files?.MainImage) {
            req.files.MainImage.forEach(file => safeUnlink(file.path));
        }
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Create Product Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const createProductWithGenerateImage = async (req, res) => {
    const {
        Title,
        OriginalPrice,
        HighPrice,
        ShortDecription,
        MainDecription1,
        MainDecription2,
        Quantity,
        ProductTag,
        ProductTagTitle,
        ProductCatId,
        ProductCatTitle,
        ProductSubCatId,
        ProductSubCatTitle,
        BrandId,
        BrandTitle,
        Combo = false,
        Tranding = false,
        OrderId,
        CommonBulkId,
        Status = true,
        Images // 👈 comma-separated URLs
    } = req.body;
    console.log("req.body", req.body);

    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['Title'], req.body);
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Ensure local directories exist
        const productDir = './media/Products';
        const thumbnailDir = './media/Products/Thumbnail';
        if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });
        if (!fs.existsSync(thumbnailDir)) fs.mkdirSync(thumbnailDir, { recursive: true });

        // Split image URLs
        const imageList = Images ? Images.split(',').map(i => i.trim()).filter(Boolean) : [];

        // Helper: download image from URL
        async function downloadImage(url, savePath) {
            const response = await axios({
                url,
                responseType: 'arraybuffer',
                timeout: 20000
            });
            fs.writeFileSync(savePath, response.data);
        }

        // ---- Generate main image (from first URL) ----
        // let mainImagePath = null;
        // let mainImageThumbnailPath = null;

        // if (imageList.length > 0) {
        //     const firstUrl = imageList[0];
        //     const fileExt = path.extname(firstUrl).split('?')[0] || '.png';
        //     const mainName = `main_${Date.now()}${fileExt}`;
        //     const mainPath = path.join(productDir, mainName);

        //     await downloadImage(firstUrl, mainPath);

        //     const thumbName = `main_thumb_${Date.now()}${fileExt}`;
        //     const thumbPath = path.join(thumbnailDir, thumbName);

        //     await sharp(mainPath).resize(250, 250).toFile(thumbPath);

        //     mainImagePath = mainPath.replace(/\\/g, '/');
        //     mainImageThumbnailPath = `media/Products/Thumbnail/${thumbName}`;
        // }

        // ---- Start transaction ----
        transaction = await pool.transaction();
        await transaction.begin();

        // Insert product
        const insertProductQuery = `
            INSERT INTO tbl_products (
                Title, OriginalPrice, HighPrice, ShortDecription, MainDecription1, 
                MainDecription2, Quantity, ProductTag, ProductTagTitle, ProductCatId, ProductCatTitle, 
                ProductSubCatId, ProductSubCatTitle, BrandId, BrandTitle, Combo, 
                Tranding, OrderId, CommonBulkId, Status
            ) VALUES (
                ${setSQLStringValue(Title)},
                ${setSQLStringValue(OriginalPrice)},
                ${setSQLStringValue(HighPrice)},
                ${setSQLStringValue(ShortDecription)},
                ${setSQLStringValue(MainDecription1)},
                ${setSQLStringValue(MainDecription2)},
                ${setSQLStringValue(Quantity)},
                ${setSQLStringValue(ProductTag)},
                ${setSQLStringValue(ProductTagTitle)},
                ${setSQLStringValue(ProductCatId)},
                ${setSQLStringValue(ProductCatTitle)},
                ${setSQLStringValue(ProductSubCatId)},
                ${setSQLStringValue(ProductSubCatTitle)},
                ${setSQLStringValue(BrandId)},
                ${setSQLStringValue(BrandTitle)},
                ${setSQLBooleanValue(Combo)},
                ${setSQLBooleanValue(Tranding)},
                ${setSQLStringValue(OrderId)},
                ${setSQLStringValue(CommonBulkId)},
                ${setSQLBooleanValue(Status)}
            );
            SELECT SCOPE_IDENTITY() AS ProductId;
        `;
        const productResult = await transaction.request().query(insertProductQuery);
        const productId = productResult.recordset[0]?.ProductId;

        if (!productId) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('No Product Created.'));
        }

        // ---- Download & store each image ----
        const imageIds = [];
        for (const imgUrl of imageList) {
            const ext = path.extname(imgUrl).split('?')[0] || '.png';
            const baseName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
            const savePath = path.join(productDir, baseName);
            const thumbName = `thumb_${baseName}`;
            const thumbPath = path.join(thumbnailDir, thumbName);

            await downloadImage(imgUrl, savePath);
            await sharp(savePath).resize(250, 250).toFile(thumbPath);

            const dbImagePath = savePath.replace(/\\/g, '/');
            const dbThumbPath = `media/Products/Thumbnail/${thumbName}`;

            const insertImageQuery = `
                INSERT INTO tbl_products_image (Image, Thumbnail, ProductId, Status)
                VALUES (
                    ${setSQLStringValue(dbImagePath)},
                    ${setSQLStringValue(dbThumbPath)},
                    ${setSQLStringValue(productId)},
                    ${setSQLBooleanValue(true)}
                );
                SELECT SCOPE_IDENTITY() AS ProductImageId;
            `;
            const imageResult = await transaction.request().query(insertImageQuery);
            const imageId = imageResult.recordset[0]?.ProductImageId;
            if (imageId) imageIds.push(imageId);
        }

        // Update product's Images field
        if (imageIds.length > 0) {
            const updateImagesQuery = `
                UPDATE tbl_products 
                SET Images = ${setSQLStringValue(imageIds.join(','))}
                WHERE ProductId = ${setSQLStringValue(productId)}
            `;
            await transaction.request().query(updateImagesQuery);
        }

        // Commit transaction
        await transaction.commit();

        return res.status(200).json({
            ...successMessage('Successfully created Product.'),
            ProductId: productId,
            ImageCount: imageIds.length
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.log('Create Product Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};


const updateProduct = async (req, res) => {
    const {
        ProductId,
        Title,
        OriginalPrice,
        HighPrice,
        ShortDecription,
        MainDecription1,
        MainDecription2,
        Quantity,
        ProductTag,
        ProductTagTitle,
        ProductCatId,
        ProductCatTitle,
        ProductSubCatId,
        ProductSubCatTitle,
        BrandId,
        BrandTitle,
        Combo = false,
        Tranding = false,
        OrderId,
        CommonBulkId,
        Status = true,
        DeleteImageIds = '', // Comma separated image IDs to delete
        RemoveMainImage = false // Flag to remove main image
    } = req.body;

    let transaction;
    try {
        const newImages = req.files?.Images || [];
        const newMainImageFile = req.files?.MainImage ? req.files.MainImage[0] : null;

        // Validate required fields
        const missingKeys = checkKeysAndRequireValues(['ProductId', 'Title'], req.body);
        if (missingKeys.length > 0) {
            if (newImages.length > 0) {
                newImages.forEach(file => safeUnlink(file.path));
            }
            if (newMainImageFile) {
                safeUnlink(newMainImageFile.path);
            }
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Verify product exists and get current main image paths
        const productCheck = await transaction.request().query(`
            SELECT ProductId, MainImage, MainImageThumbnail 
            FROM tbl_products 
            WHERE ProductId = ${setSQLStringValue(ProductId)}
        `);

        if (!productCheck.recordset.length) {
            await transaction.rollback();
            if (newImages.length > 0) {
                newImages.forEach(file => safeUnlink(file.path));
            }
            if (newMainImageFile) {
                safeUnlink(newMainImageFile.path);
            }
            return res.status(400).json(errorMessage('Product not found.'));
        }

        const currentProduct = productCheck.recordset[0];
        
        // Handle main image update/removal
        let mainImagePath = currentProduct.MainImage;
        let mainImageThumbnailPath = currentProduct.MainImageThumbnail;

        if (RemoveMainImage) {
            // Remove existing main image files
            if (currentProduct.MainImage) safeUnlink(currentProduct.MainImage);
            if (currentProduct.MainImageThumbnail) safeUnlink(currentProduct.MainImageThumbnail);
            mainImagePath = null;
            mainImageThumbnailPath = null;
        }

        if (newMainImageFile) {
            // Remove old main image files if they exist
            if (currentProduct.MainImage) safeUnlink(currentProduct.MainImage);
            if (currentProduct.MainImageThumbnail) safeUnlink(currentProduct.MainImageThumbnail);

            // Process new main image
            mainImagePath = newMainImageFile.path.replace(/\\/g, '/');
            
            // Generate new main image thumbnail
            const thumbnailDir = './media/Products/Thumbnail';
            const thumbnailFilename = 'main_thumbnail_' + newMainImageFile.filename;
            const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

            await sharp(newMainImageFile.path)
                .resize(250, 250)
                .toFile(thumbnailPath);

            mainImageThumbnailPath = `media/Products/Thumbnail/main_thumbnail_${newMainImageFile.filename}`;
        }

        // Handle image deletions (existing code remains same)
        if (DeleteImageIds) {
            const deleteIds = DeleteImageIds.split(',').filter(id => id.trim() !== '');
            if (deleteIds.length > 0) {
                // Get image paths before deletion
                const imagesToDelete = await transaction.request().query(`
                    SELECT Image, Thumbnail FROM tbl_products_image 
                    WHERE ProductImageId IN (${deleteIds.map(id => setSQLStringValue(id)).join(',')})
                    AND ProductId = ${setSQLStringValue(ProductId)}
                `);

                // Delete image records
                await transaction.request().query(`
                    DELETE FROM tbl_products_image 
                    WHERE ProductImageId IN (${deleteIds.map(id => setSQLStringValue(id)).join(',')})
                    AND ProductId = ${setSQLStringValue(ProductId)}
                `);

                // Delete physical files
                imagesToDelete.recordset.forEach(image => {
                    if (image.Image) safeUnlink(image.Image);
                    if (image.Thumbnail) safeUnlink(image.Thumbnail);
                });
            }
        }

        // Handle new image uploads
        const newImageIds = [];
        if (newImages.length > 0) {
            for (const file of newImages) {
                const imagePath = file.path.replace(/\\/g, '/');

                // Generate thumbnail
                const thumbnailDir = './media/Products/Thumbnail';
                const thumbnailFilename = 'thumbnail_' + file.filename;
                const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

                await sharp(file.path)
                    .resize(250, 250)
                    .toFile(thumbnailPath);

                const imageURLThumbnail = `media/Products/Thumbnail/thumbnail_${file.filename}`;

                // Insert new image record
                const insertImageQuery = `
                    INSERT INTO tbl_products_image (Image, Thumbnail, ProductId, Status)
                    VALUES (
                        ${setSQLStringValue(imagePath)},
                        ${setSQLStringValue(imageURLThumbnail)},
                        ${setSQLStringValue(ProductId)},
                        ${setSQLBooleanValue(true)}
                    );
                    SELECT SCOPE_IDENTITY() AS ProductImageId;
                `;

                const imageResult = await transaction.request().query(insertImageQuery);
                const imageId = imageResult.recordset[0]?.ProductImageId;

                if (imageId) {
                    newImageIds.push(imageId);
                }
            }
        }

        // Get current image IDs and merge with new ones
        const currentImagesQuery = await transaction.request().query(`
            SELECT ProductImageId FROM tbl_products_image 
            WHERE ProductId = ${setSQLStringValue(ProductId)} AND Status = 1
        `);

        const currentImageIds = currentImagesQuery.recordset.map(img => img.ProductImageId.toString());
        const allImageIds = [...currentImageIds, ...newImageIds].filter(id => id);
        const imagesString = allImageIds.join(',');

        // Update product
        const updateProductQuery = `
            UPDATE tbl_products SET 
                Title = ${setSQLStringValue(Title)},
                OriginalPrice = ${setSQLStringValue(OriginalPrice)},
                HighPrice = ${setSQLStringValue(HighPrice)},
                ShortDecription = ${setSQLStringValue(ShortDecription)},
                MainDecription1 = ${setSQLStringValue(MainDecription1)},
                MainDecription2 = ${setSQLStringValue(MainDecription2)},
                Quantity = ${setSQLStringValue(Quantity)},
                ProductTag = ${setSQLStringValue(ProductTag)},
                ProductTagTitle = ${setSQLStringValue(ProductTagTitle)},
                ProductCatId = ${setSQLStringValue(ProductCatId)},
                ProductCatTitle = ${setSQLStringValue(ProductCatTitle)},
                ProductSubCatId = ${setSQLStringValue(ProductSubCatId)},
                ProductSubCatTitle = ${setSQLStringValue(ProductSubCatTitle)},
                BrandId = ${setSQLStringValue(BrandId)},
                BrandTitle = ${setSQLStringValue(BrandTitle)},
                Combo = ${setSQLBooleanValue(Combo)},
                Tranding = ${setSQLBooleanValue(Tranding)},
                OrderId = ${setSQLStringValue(OrderId)},
                CommonBulkId = ${setSQLStringValue(CommonBulkId)},
                Status = ${setSQLBooleanValue(Status)},
                Images = ${setSQLStringValue(imagesString)},
                MainImage = ${setSQLStringValue(mainImagePath)},
                MainImageThumbnail = ${setSQLStringValue(mainImageThumbnailPath)}
            WHERE ProductId = ${setSQLStringValue(ProductId)}
        `;

        const result = await transaction.request().query(updateProductQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            if (newImages.length > 0) {
                newImages.forEach(file => safeUnlink(file.path));
            }
            if (newMainImageFile) {
                safeUnlink(newMainImageFile.path);
            }
            return res.status(400).json(errorMessage('No Product Updated.'));
        }

        await transaction.commit();

        return res.status(200).json({
            ...successMessage('Successfully updated Product.'),
            ...req.body
        });

    } catch (error) {
        // Clean up uploaded files in case of error
        if (req.files?.Images) {
            req.files.Images.forEach(file => safeUnlink(file.path));
        }
        if (req.files?.MainImage) {
            req.files.MainImage.forEach(file => safeUnlink(file.path));
        }
        if (transaction) await transaction.rollback();

        console.log('Update Product Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteProduct = async (req, res) => {
    const { ProductId } = req.query;
    let transaction;
    try {
        const missingKeys = checkKeysAndRequireValues(['ProductId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Get product data including main images
        const productQuery = `
            SELECT MainImage, MainImageThumbnail FROM tbl_products 
            WHERE ProductId = ${setSQLStringValue(ProductId)}
        `;
        const productData = await transaction.request().query(productQuery);

        // Get all product images before deletion
        const imagesQuery = `
            SELECT Image, Thumbnail FROM tbl_products_image 
            WHERE ProductId = ${setSQLStringValue(ProductId)}
        `;
        const imagesData = await transaction.request().query(imagesQuery);

        // Delete product images first
        await transaction.request().query(`
            DELETE FROM tbl_products_image 
            WHERE ProductId = ${setSQLStringValue(ProductId)}
        `);

        // Delete main product
        const deleteQuery = `
            DELETE FROM tbl_products WHERE ProductId = ${setSQLStringValue(ProductId)}
        `;
        const result = await transaction.request().query(deleteQuery);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(400).json(errorMessage('No Product Deleted.'));
        }

        // Commit transaction
        await transaction.commit();

        // Delete physical image files after successful database deletion
        imagesData.recordset.forEach(image => {
            if (image.Image) safeUnlink(image.Image);
            if (image.Thumbnail) safeUnlink(image.Thumbnail);
        });

        // Delete main image files
        if (productData.recordset.length > 0) {
            const product = productData.recordset[0];
            if (product.MainImage) safeUnlink(product.MainImage);
            if (product.MainImageThumbnail) safeUnlink(product.MainImageThumbnail);
        }

        return res.status(200).json({ ...successMessage('Successfully deleted Product.'), ProductId });
    } catch (error) {
        // Rollback transaction in case of error
        if (transaction) {
            await transaction.rollback();
        }
        console.log('Delete Product Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// Additional function to get product images
const getProductImages = async (req, res) => {
    try {
        const { ProductId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['ProductId'], req.query)
        if (missingKeys.length > 0) {
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }

        const query = `
            SELECT * FROM tbl_products_image 
            WHERE ProductId = ${setSQLStringValue(ProductId)} AND Status = 1
            ORDER BY ProductImageId ASC
        `;

        const result = await pool.request().query(query);

        return res.status(200).json({
            success: true,
            message: 'Product images fetched successfully',
            data: result.recordset
        });

    } catch (error) {
        console.log('Get Product Images Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductImages,
    createProductWithGenerateImage
}