const { errorMessage, getCommonAPIResponse, checkKeysAndRequireValues, setSQLStringValue, getCommonKeys } = require("../common/main");
const fs = require('fs');
const { pool, sql } = require("../sql/connectToDatabase");

const fetchCanvasSeatingFile = async (req, res) => {
    try {
        const query = {
            getQuery: `SELECT * FROM CanvasSeatingFile ORDER BY CreateSeatingId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM CanvasSeatingFile`
        }

        const result = await getCommonAPIResponse(req, res, query);
        return res.json(result);

    } catch (error) {
        console.error('Error fetching file:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const fetchCanvasSeatingWithJsonById = async (req, res) => {
    try {
        const { CreateSeatingUkId, OrganizerUkeyId, EventUkeyId } = req.query;
        let whereConditions = [];
        if (CreateSeatingUkId) {
            whereConditions.push(`CreateSeatingUkId = ${setSQLStringValue(CreateSeatingUkId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        const missingKeys = [CreateSeatingUkId, OrganizerUkeyId, EventUkeyId].filter(key => key);
        if (missingKeys.length === 0) {
            return res.status(400).send(errorMessage(`Add atleast one of the following keys: CreateSeatingUkId, OrganizerUkeyId, EventUkeyId!`));
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const getCanvasSeatingFileQuery = `select JsonFile from CanvasSeatingFile ${whereString} ORDER BY CreateSeatingId DESC`;
        const result = await pool.query(getCanvasSeatingFileQuery);
        if (result.recordset.length === 0) {
            return res.status(404).send(errorMessage('File not found'));
        }
        for (let i = 0; i < result.recordset.length; i++) {
            const element = result.recordset[i];
            const mainJs = fs.readFileSync(`./media/CanvasSeating/${element.JsonFile}`, 'utf8');
            result.recordset[i].JSON = JSON.parse(mainJs);
        }

        const lockedSeatQuery = `SELECT SeatNumber FROM TicketSeatLocked WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
        const lockedSeatResult = await pool.query(lockedSeatQuery);
        let lockedSeats = [];
        if (lockedSeatResult.recordset.length > 0) {
            lockedSeats = lockedSeatResult.recordset.map(seat => seat.SeatNumber);
        }

        result.recordset[0].JSON.theater.seats = result.recordset[0].JSON.theater.seats.map(seat => {
            if (lockedSeats.includes(seat.id)) {
                return { ...seat, status: 'booked' }; // Marking locked seats as 'booked'
            }
            return seat;
        });

        return res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching file:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const addCanvasSeatingFile = async (req, res) => {
    try {
        const { OrganizerUkeyId, EventUkeyId, flag } = req.body;
        let File = null;
        if (req.files && req.files.JsonFile && req.files.JsonFile.length > 0) {
            File = req.files.JsonFile[0];
        } else if (req.body.JsonFile) {
            File = req.body.JsonFile; // Fallback if JSON sent as base64 or string
        }

        const missingKeys = checkKeysAndRequireValues(['OrganizerUkeyId', 'EventUkeyId', 'flag'], req.body);
        if (missingKeys.length > 0) {
            return res.status(400).send(errorMessage(`Missing required keys: ${missingKeys.join(', ')}`));
        }

        if (!File) {
            return res.status(400).send(errorMessage('JsonFile data are required'));
        }

        if (File && File?.mimetype !== 'application/json') {
            return res.status(400).send(errorMessage('Invalid file type. Only JSON files are allowed.'));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const checkAlreadyExistsQuery = `SELECT JsonFile FROM CanvasSeatingFile WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}`;
        const checkResult = await pool.query(checkAlreadyExistsQuery);
        if (checkResult.recordset.length > 0) {
            await pool.query(`DELETE FROM CanvasSeatingFile WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
            try {
                fs.rmSync(`./media/CanvasSeating/${checkResult.recordset[0].JsonFile}`, { force: true });
            } catch (error) {
                console.log("Error deleting old file:", error);
            }
            // return res.status(400).send(errorMessage('Canvas seating file already exists for this Organizer and Event.'));
        }

        const addCanvasSeatingFileQuery = `INSERT INTO CanvasSeatingFile (CreateSeatingUkId, OrganizerUkeyId, EventUkeyId, JsonFile, IpAddress, HostName, EntryDate, flag) values ( newid(), ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(File.filename)}, '${IPAddress}', '${ServerName}', '${EntryTime}', '${flag}')`;

        try {
            const result = await pool.query(addCanvasSeatingFileQuery);
            console.log('File added successfully:', result);
            if (result.rowsAffected[0] === 0) {
                return res.status(400).send(errorMessage('Failed to add file'));
            }
        } catch (error) {
            console.log('Error executing query:', error);
            return res.status(500).send(errorMessage(error?.message));
        }

        return res.json({ message: 'File added successfully' });

    } catch (error) {
        console.error('Error updating file:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const updateFile = async (req, res) => {
    try {
        const { id } = req.body;
        const File = req.files?.File[0] || req.body?.File;
        console.log('id', id)
        console.log('File', File)

        if (!id || !File) {
            return res.status(400).send(errorMessage('ID and File data are required'));
        }

        if (File && File?.mimetype !== 'application/json') {
            // return res.status(400).send(errorMessage('Invalid file type. Only JSON files are allowed.'));
        }
        console.log("11111111111")

        // Check if file exists using parameterized query
        const checkResult = await pool.query(`SELECT * FROM temp_files WHERE id = ${id}`);
        console.log('checkResult', checkResult)

        if (checkResult.recordset.length === 0) {
            return res.status(404).send(errorMessage('File ID not found'));
        }
        console.log("2222222")

        // Update using parameterized query
        const updateResult = await pool.query(`UPDATE temp_files SET json = '${File.filename}' WHERE id = ${id}`);
        console.log('updateResult', updateResult);

        console.log("Ending updateFile function")

        return res.json({ message: 'File updated successfully' });

    } catch (error) {
        console.error('Error updating file:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const deleteOnlySeatsWithSeatsData = async (req, res) => {
    const { OrganizerUkeyId, EventUkeyId, Seats } = req.query;

    try {
        const missingKeys = checkKeysAndRequireValues(['OrganizerUkeyId', 'EventUkeyId', 'Seats'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).send(errorMessage(`Missing required keys: ${missingKeys.join(', ')}`));
        }

        const findJsonFileQuery = `
            SELECT JsonFile 
            FROM CanvasSeatingFile 
            WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} 
            AND EventUkeyId = ${setSQLStringValue(EventUkeyId)}
        `;

        const findJsonFileResult = await pool.query(findJsonFileQuery);
        if (findJsonFileResult.recordset.length === 0) {
            return res.status(404).send(errorMessage('Canvas seating file not found'));
        }

        const jsonFile = findJsonFileResult.recordset[0].JsonFile;
        const jsonFilePath = `./media/CanvasSeating/${jsonFile}`;
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(404).send(errorMessage('JSON file does not exist'));
        }

        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

        const splitOfSeats = Seats.split(',').map(seat => seat.trim());
        jsonData.theater.seats = jsonData.theater.seats.map((seat) => {
            if (splitOfSeats.includes(seat.id)) {
                return { ...seat, status: 'available' }; // Resetting the status to 'available'
            }
            return seat;
        });

        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));

        return res.status(200).json({ message: 'File deleted successfully', jsonData });

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message || 'Internal server error'));
    }

}

module.exports = { fetchCanvasSeatingFile, updateFile, addCanvasSeatingFile, fetchCanvasSeatingWithJsonById, deleteOnlySeatsWithSeatsData };