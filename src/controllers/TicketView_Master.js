const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLOrderId, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchTicketViewList = async (req, res) => {
    try {
        const { 
            SortBy = 'TicketViewId', 
            SortOrder = 'DESC', 
            TicketViewId, 
            TicketViewUkeyId, 
            Status, 
            flag 
        } = req.query;

        let whereConditions = [];

        // Build the WHERE clause based on the query parameters
        if (TicketViewId) {
            whereConditions.push(`tv.TicketViewId = '${TicketViewId}'`);
        }
        if (TicketViewUkeyId) {
            whereConditions.push(`tv.TicketViewUkeyId = '${TicketViewUkeyId}'`);
        }
        if (Status !== undefined) {
            whereConditions.push(`tv.Status = ${setSQLBooleanValue(Status)}`);
        }
        if (flag) {
            whereConditions.push(`tv.flag = '${flag}'`);
        }

        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query definitions
        const getTicketViewList = {
            getQuery: `SELECT * FROM TicketView AS tv ${whereString} ORDER BY ${SortBy} ${SortOrder}`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM TicketView AS tv ${whereString}`,
        };

        // Execute the query and return results
        const result = await getCommonAPIResponse(req, res, getTicketViewList);
        return res.json(result);

    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};


const TicketViewMaster = async (req, res) => {
    const { 
        TicketViewUkeyId = generateUUID(), 
        Status = true, 
        Title = '', 
        flag,
        MemberType = ''
    } = req.body;
    let { Img = '' } = req.body;

    // Handle file upload
    Img = req?.files?.Img?.length ? `${req?.files?.Img[0]?.filename}` : Img;

    const missingKeys = checkKeysAndRequireValues(['Img'], { ...req.body, Img });
    if (missingKeys.length > 0) {
        if (req?.files?.Img?.length) {
            try {
                fs.unlinkSync(req?.files?.Img[0]?.path);
            } catch (error) {
                console.log('Error :>> ', error);
            }
        }
        return res.status(400).send(`${missingKeys.join(', ')} parameters are required and must not be null or undefined`);
    }

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();

        const insertQuery = `
            INSERT INTO TicketView 
            (TicketViewUkeyId, Title, Image, Status, IpAddress, HostName, EntryDate, flag, MemberType) 
            VALUES 
            ('${TicketViewUkeyId}', N'${Title}', '${Img}', ${setSQLBooleanValue(Status)}, 
            '${IPAddress}', '${ServerName}', '${EntryTime}', N'${flag}', N'${MemberType || Title}')
        `;

        const deleteQuery = `
            DELETE FROM TicketView WHERE TicketViewUkeyId = '${TicketViewUkeyId}';
        `;

        if (flag === 'A') {
            const result = await pool.request().query(insertQuery);

            if (result?.rowsAffected?.[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Image` exists
                return res.status(400).json(errorMessage('No TicketView Entry Created.'));
            }
            return res.status(200).json({ 
                ...successMessage('New TicketView Entry Created Successfully.'), 
                ...req.body, TicketViewUkeyId, Img 
            });
        } else if (flag === 'U') {
            const oldImageResult = await pool.request().query(`
                SELECT Image FROM TicketView WHERE TicketViewUkeyId = '${TicketViewUkeyId}';
            `);
            const oldImage = oldImageResult.recordset?.[0]?.Image;

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Image` exists
                return res.status(400).json(errorMessage('No TicketView Entry Updated.'));
            }

            if (oldImage && req.files && req.files.Img && req.files.Img.length > 0) 
                deleteImage('./media/TicketView/' + oldImage); // Only delete old image if it exists

            return res.status(200).json({ 
                ...successMessage('TicketView Entry Updated Successfully.'), 
                ...req.body, TicketViewUkeyId, Img 
            });
        } else {
            if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Image` exists
            return res.status(400).json({
                ...errorMessage("Use 'A' flag to Add and 'U' flag to Update. It is compulsory to send the flag.")
            });
        }
    } catch (error) {
        if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Image` exists
        console.error(flag === 'A' ? 'Add TicketView Error:' : 'Update TicketView Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};


const RemoveTicketView = async (req, res) => {
    try {
        const { TicketViewUkeyId } = req.query;

        // Check if required keys are missing
        const missingKeys = checkKeysAndRequireValues(['TicketViewUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        // Fetch the old Image path before deleting the record
        const oldImageResult = await pool.request().query(`
            SELECT Image FROM TicketView WHERE TicketViewUkeyId = '${TicketViewUkeyId}';
        `);

        const oldImage = oldImageResult.recordset?.[0]?.Image; // Safely access the first record

        // Execute the DELETE query
        const deleteQuery = `
            DELETE FROM TicketView WHERE TicketViewUkeyId = '${TicketViewUkeyId}';
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No TicketView Entry Deleted.') });
        }

        // Delete the old Image if it exists
        if (oldImage) {
            deleteImage('./media/TicketView/' + oldImage);
        }

        // Return success response
        return res.status(200).json({ ...successMessage('TicketView Entry Deleted Successfully.'), TicketViewUkeyId });
    } catch (error) {
        console.log('Delete TicketView Entry Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};


module.exports = {
    fetchTicketViewList,
    TicketViewMaster,
    RemoveTicketView
}