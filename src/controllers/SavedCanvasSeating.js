const { errorMessage, getCommonAPIResponse, checkKeysAndRequireValues, setSQLStringValue, getCommonKeys, deleteImage } = require("../common/main");
const fs = require('fs');
const { pool, sql } = require("../sql/connectToDatabase");

const fetchSavedCanvasSeating = async (req, res) => {
    try {
        let whereConditions = [];
        whereConditions.push(`flag <> 'D'`);
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = {
            getQuery: `SELECT * FROM SavedCanvasSeating ${whereString} ORDER BY SavedCanvasSeatingId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SavedCanvasSeating ${whereString}`
        }

        const result = await getCommonAPIResponse(req, res, query);
        return res.json(result);

    } catch (error) {
        console.error('Error fetching saved canvas seating:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const fetchSavedCanvasSeatingWithJsonById = async (req, res) => {
    try {
        const { SavedCanvasSeatingUkId } = req.query;

        if (!SavedCanvasSeatingUkId) {
            return res.status(400).send(errorMessage(`SavedCanvasSeatingUkId is required!`));
        }

        const getSavedCanvasSeatingQuery = `SELECT JsonFile FROM SavedCanvasSeating WHERE SavedCanvasSeatingUkId = ${setSQLStringValue(SavedCanvasSeatingUkId)} ORDER BY SavedCanvasSeatingId DESC`;
        const result = await pool.query(getSavedCanvasSeatingQuery);

        if (result.recordset.length === 0) {
            return res.status(404).send(errorMessage('Saved canvas seating not found'));
        }

        for (let i = 0; i < result.recordset.length; i++) {
            const element = result.recordset[i];
            const mainJs = fs.readFileSync(`./media/SavedCanvasSeating/${element.JsonFile}`, 'utf8');
            result.recordset[i].JSON = JSON.parse(mainJs);
        }

        return res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching saved canvas seating:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}
const handleSavedCanvasSeating = async (req, res) => {
    try {
        const { PlaceTitle, PlaceAddress, flag, SavedCanvasSeatingUkId } = req.body;
        let File = null;

        if (req.files && req.files.JsonFile && req.files.JsonFile.length > 0) {
            File = req.files.JsonFile[0];
        } else if (req.body.JsonFile) {
            File = req.body.JsonFile;
        }

        // Validate required fields based on flag
        if (flag === 'A') {
            const missingKeys = checkKeysAndRequireValues(['PlaceTitle', 'PlaceAddress', 'flag'], req.body);
            if (missingKeys.length > 0) {
                deleteImage(req?.files?.JsonFile?.[0]?.path);
                return res.status(400).send(errorMessage(`Missing required keys: ${missingKeys.join(', ')}`));
            }
        } else if (flag === 'U') {
            if (!SavedCanvasSeatingUkId) {
                deleteImage(req?.files?.JsonFile?.[0]?.path);
                return res.status(400).send(errorMessage('SavedCanvasSeatingUkId is required for update'));
            }
        } else {
            deleteImage(req?.files?.JsonFile?.[0]?.path);
            return res.status(400).send(errorMessage('Invalid flag. Use "A" for add or "U" for update'));
        }

        if (!File) {
            return res.status(400).send(errorMessage('JsonFile data are required'));
        }

        if (File && File?.mimetype !== 'application/json') {
            deleteImage(req?.files?.JsonFile?.[0]?.path);
            return res.status(400).send(errorMessage('Invalid file type. Only JSON files are allowed.'));
        }

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        if (flag === 'A') {
            // Add new record
            const addQuery = `
                INSERT INTO SavedCanvasSeating (
                    SavedCanvasSeatingUkId, 
                    PlaceTitle, 
                    PlaceAddress, 
                    JsonFile, 
                    IpAddress, 
                    HostName, 
                    EntryDate, 
                    flag
                ) VALUES (
                    newid(), 
                    ${setSQLStringValue(PlaceTitle)}, 
                    ${setSQLStringValue(PlaceAddress)}, 
                    ${setSQLStringValue(File.filename)}, 
                    '${IPAddress}', 
                    '${ServerName}', 
                    '${EntryTime}', 
                    'A'
                )`;

            try {
                const result = await pool.query(addQuery);
                console.log('Saved canvas seating added successfully:', result);
                if (result.rowsAffected[0] === 0) {
                    deleteImage(req?.files?.JsonFile?.[0]?.path);
                    return res.status(400).send(errorMessage('Failed to add saved canvas seating'));
                }
                return res.json({
                    message: 'Saved canvas seating added successfully',
                });
            } catch (error) {
                deleteImage(req?.files?.JsonFile?.[0]?.path);
                console.log('Error executing add query:', error);
                return res.status(500).send(errorMessage(error?.message));
            }
        } else if (flag === 'U') {
            // Update existing record
            // Check if record exists
            const checkResult = await pool.query(
                `SELECT * FROM SavedCanvasSeating 
                 WHERE SavedCanvasSeatingUkId = ${setSQLStringValue(SavedCanvasSeatingUkId)}`
            );

            if (checkResult.recordset.length === 0) {
                deleteImage(req?.files?.JsonFile?.[0]?.path);
                return res.status(404).send(errorMessage('Saved canvas seating not found'));
            }

            // Build update query
            const updates = [];
            if (PlaceTitle) updates.push(`PlaceTitle = ${setSQLStringValue(PlaceTitle)}`);
            if (PlaceAddress) updates.push(`PlaceAddress = ${setSQLStringValue(PlaceAddress)}`);
            if (File) {
                updates.push(`JsonFile = ${setSQLStringValue(File.filename)}`);
            }
            updates.push(`flag = 'U'`);
            updates.push(`IpAddress = '${IPAddress}'`);
            updates.push(`HostName = '${ServerName}'`);

            const updateQuery = `
                UPDATE SavedCanvasSeating 
                SET ${updates.join(', ')} 
                WHERE SavedCanvasSeatingUkId = ${setSQLStringValue(SavedCanvasSeatingUkId)}`;

            try {
                const result = await pool.query(updateQuery);
                console.log('Saved canvas seating updated successfully:', result);
                if (result.rowsAffected[0] === 0) {
                    deleteImage(req?.files?.JsonFile?.[0]?.path);
                    return res.status(400).send(errorMessage('Failed to update saved canvas seating'));
                }
                if (File) {
                    if (File.filename) {
                        const existingFile = checkResult.recordset[0].JsonFile;
                        deleteImage(`./media/SavedCanvasSeating/${existingFile}`);
                    }
                }
                return res.json({
                    message: 'Saved canvas seating updated successfully'
                });
            } catch (error) {
                deleteImage(req?.files?.JsonFile?.[0]?.path);
                console.log('Error executing update query:', error);
                return res.status(500).send(errorMessage(error?.message));
            }
        }
    } catch (error) {
        deleteImage(req?.files?.JsonFile?.[0]?.path);
        console.error('Error in handleSavedCanvasSeating:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteSavedCanvasSeating = async (req, res) => {
    try {
        const { SavedCanvasSeatingUkId } = req.query;
        if (!SavedCanvasSeatingUkId) {
            return res.status(400).send(errorMessage('SavedCanvasSeatingUkId is required'));
        }
        const checkResult = await pool.query(
            `SELECT * FROM SavedCanvasSeating 
             WHERE SavedCanvasSeatingUkId = ${setSQLStringValue(SavedCanvasSeatingUkId)}`
        );
        if (checkResult.recordset.length === 0) {
            return res.status(404).send(errorMessage('Saved canvas seating not found'));
        }
        const query = `UPDATE SavedCanvasSeating SET flag = 'D' WHERE SavedCanvasSeatingUkId = ${setSQLStringValue(SavedCanvasSeatingUkId)}`;
        const result = await pool.query(query);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send(errorMessage('Saved canvas seating not found'));
        }
        return res.json({ message: 'Saved canvas seating deleted successfully' });
    } catch (error) {
        console.error('Error in deleteSavedCanvasSeating:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    fetchSavedCanvasSeating,
    handleSavedCanvasSeating,
    fetchSavedCanvasSeatingWithJsonById,
    deleteSavedCanvasSeating
};