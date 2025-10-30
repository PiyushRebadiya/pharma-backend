const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchGalleryMasterDetails = async (req, res)=>{
    try{
        const { UkeyId, IsActive, IsVideo, IsImg } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (UkeyId) {
            whereConditions.push(`GM.UkeyId = '${UkeyId}'`);
        }
        if(IsActive){
            whereConditions.push(`GM.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if(IsVideo){
            whereConditions.push(`GM.IsVideo = ${setSQLBooleanValue(IsVideo)}`);
        }
        if(IsImg){
            whereConditions.push(`GM.IsImg = ${setSQLBooleanValue(IsImg)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT GM.*, OM.OrganizerName, EM.EventName FROM GalleryMaster As GM
                    LEFT JOIN OrganizerMaster As OM ON OM.OrganizerUkeyId = GM.OrganizerUkeyId
                    LEFT JOIN EventMaster As EM ON EM.EventUkeyId = GM.EventUkeyId
                    ${whereString} ORDER BY GM.GalleryId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM GalleryMaster As GM ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const GalleryMaster = async (req, res) => {
    const { 
        OrganizerUkeyId , 
        UserUkeyId = '', 
        EventUkeyId = '', 
        IsImg = null,
        IsVideo = null, 
        IsActive = true 
    } = req.body;

    
    if (!req.files?.Img?.length) {
        if (req.files?.Img?.length) {
            req.files.Img.forEach((file) => deleteImage(file.path));
        }

        if (req.files?.Thumbnail?.length) {
            req.files.Thumbnail.forEach((file) => deleteImage(file.path));
        }
        return res.status(400).send(errorMessage('No files uploaded'));
    }
    
    if(req?.files?.Img[0]?.mimetype?.startsWith('video')){
        if (req.files?.Img?.length > 1 || req.files?.Thumbnail?.length > 1) {
            if (req.files?.Img?.length) {
                req.files.Img.forEach((file) => deleteImage(file.path));
            }
    
            if (req.files?.Thumbnail?.length) {
                req.files.Thumbnail.forEach((file) => deleteImage(file.path));
            }
            return res.status(400).send(errorMessage('No more than one file can be uploaded at a time for a video'));
        }
        if (!req.files?.Thumbnail?.length) {
            if (req.files?.Img?.length) {
                req.files.Img.forEach((file) => deleteImage(file.path));
            }
    
            if (req.files?.Thumbnail?.length) {
                req.files.Thumbnail.forEach((file) => deleteImage(file.path));
            }
            return res.status(400).send(errorMessage('No Thumbnail uploaded'));
        }
    }
    
    const thumb = req?.files?.Thumbnail?.length == 1 && req?.files?.Thumbnail[0]?.mimetype && req?.files?.Thumbnail[0]?.mimetype?.startsWith('image') && (req?.files?.Img?.length == 1 && req?.files?.Img[0]?.mimetype?.startsWith('video')) ? `${req?.files?.Thumbnail[0]?.filename}` : '';

    if (req?.files?.Img?.length > 1 || !req?.files?.Img[0]?.mimetype?.startsWith('video')) {
        req?.files?.Thumbnail?.forEach((file) => deleteImage(file.path));
    }

    const { IPAddress, ServerName, EntryTime } = getCommonKeys();
    let successResult = 0
    try {
        for (const file of req.files.Img) {
            const UkeyId = generateUUID();
            // const isVideo = file.mimetype.startsWith('video');
            const fileName = file.filename;

            const insertQuery = `
                INSERT INTO GalleryMaster (
                    UkeyId, OrganizerUkeyId, UserUkeyId, EventUkeyId, IsImg, Img, IsVideo, Video, Thumbnail, IsActive, IpAddress, HostName, EntryDate, flag
                ) VALUES (
                    '${UkeyId}', 
                    '${OrganizerUkeyId}', 
                    ${UserUkeyId && UserUkeyId !== '' ? UserUkeyId : null }, 
                    '${EventUkeyId}', 
                    ${setSQLBooleanValue(IsImg)}, 
                    ${IsImg === 'true' ? `'${fileName}'` : null}, 
                    ${setSQLBooleanValue(IsVideo)}, 
                    ${IsVideo === 'true' ? `'${fileName}'` : null}, 
                    ${IsVideo === 'true' ? `'${thumb}'` : null}, 
                    ${setSQLBooleanValue(IsActive)}, 
                    '${IPAddress}', 
                    '${ServerName}', 
                    '${EntryTime}', 
                    'A'
                );
            `;

            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                if (req.files?.Img?.length) {
                    req.files.Img.forEach((file) => deleteImage(file.path));
                }
        
                if (req.files?.Thumbnail?.length) {
                    req.files.Thumbnail.forEach((file) => deleteImage(file.path));
                }
                console.error(`Failed to insert record for file: ${fileName}`);
                // deleteImage(file.path); // Delete file if insertion fails
            }
            successResult++
        }

        if (successResult === 0) {
            return res.status(400).json({ ...errorMessage('No Speaker Master Deleted.') });
        }

        return res.status(200).json(successMessage('Gallery data inserted successfully.'));
    } catch (error) {
        console.error('GalleryMaster Error:', error);

        // Delete all uploaded files if any error occurs
        if (req.files?.Img?.length) {
            req.files.Img.forEach((file) => deleteImage(file.path));
        }

        if (req.files?.Thumbnail?.length) {
            req.files.Thumbnail.forEach((file) => deleteImage(file.path));
        }

        return res.status(500).send(errorMessage(error.message));
    }
};

const RemoveGalleryMaster = async (req, res) => {
    try {
        const { UkeyId } = req.query;

        // Validate input keys
        const missingKeys = checkKeysAndRequireValues(['UkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        // Fetch the record before deletion to get file information
        const oldRecordQuery = `
            SELECT * 
            FROM GalleryMaster 
            WHERE UkeyId = '${UkeyId}';
        `;
        const oldRecordResult = await pool.request().query(oldRecordQuery);

        // Check if the record exists
        if (oldRecordResult.recordset.length === 0) {
            return res.status(404).json(errorMessage('Record not found.'));
        }

        const oldRecord = oldRecordResult.recordset[0];
        const fileToDelete = oldRecord.IsVideo 
            ? `./media/Gallery/Video/${oldRecord.Video}` 
            : `./media/Gallery/${oldRecord.Img}`;

        const fileToThumbnail = oldRecord.IsVideo ? `./media/Gallery/Thumbnail/${oldRecord.Thumbnail}` : '';

        // Execute the DELETE query
        const deleteQuery = `
            DELETE FROM GalleryMaster WHERE UkeyId = '${UkeyId}';
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        // Ensure deletion was successful
        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No Gallery Master Deleted.'));
        }

        // Delete the associated file from storage
        if (oldRecord.Img || oldRecord.Video) {
            deleteImage(fileToDelete);
           if(oldRecord.Thumbnail) deleteImage(fileToThumbnail);
        }

        // Return success response
        return res.status(200).json(successMessage('Gallery Master Deleted Successfully.'));
    } catch (error) {
        console.error('Delete Gallery Master Error:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    FetchGalleryMasterDetails,
    GalleryMaster,
    RemoveGalleryMaster,
}