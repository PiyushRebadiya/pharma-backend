const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const FetchDocumentUploadDetails = async (req, res)=>{
    try{
        const { DocUkeyId, OrganizerUkeyId, EventUkeyId, Category, UkeyId } = req.query;
        let whereConditions = [];

        if (DocUkeyId) {
            whereConditions.push(`DocUkeyId = ${setSQLStringValue(DocUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (Category) {
            whereConditions.push(`Category = ${setSQLStringValue(Category)}`);
        }
        if (UkeyId) {
            whereConditions.push(`UkeyId = ${setSQLStringValue(UkeyId)}`);
        }
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `SELECT * FROM DocumentUpload ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM DocumentUpload ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const DocumentUpload = async (req, res) => {
    const { Category, EventUkeyId, OrganizerUkeyId, UkeyId, flag, FileType, IsActive = true, Label = '' } = req.body;
    let FileNames = req?.files?.FileName?.length 
        ? req.files.FileName.map(file => file.filename) 
        : req.body.FileNames ? JSON.parse(req.body.FileNames) : [];

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const missingKeys = checkKeysAndRequireValues(
            [ 'Category', 'OrganizerUkeyId', 'UkeyId'], 
            { ...req.body }
        );

        if (missingKeys.length > 0 || FileNames.length === 0) {
            if (FileNames.length > 0) {
                FileNames.forEach(file => deleteImage(`./media/DocumentUpload/${file}`));
            }
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} and at least one FileName are required.`));
        }

        let insertQuery = `
            INSERT INTO DocumentUpload (
                DocUkeyId, FileName, Category, EventUkeyId, OrganizerUkeyId, UkeyId, UserId, UserName, IpAddress, HostName, EntryDate, flag, FileType, IsActive, Label
            ) VALUES `;

        const values = FileNames.map(file => `(
            ${setSQLStringValue(generateUUID())}, ${setSQLStringValue(file)}, ${setSQLStringValue(Category)}, 
            ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(UkeyId)}, 
            ${setSQLStringValue(req.user.UserId)}, ${setSQLStringValue(req.user.FirstName)}, 
            ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, 
            'A', ${setSQLStringValue(FileType)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(Label)}
        )`).join(',');

        insertQuery += values;

        const result = await pool.request().query(insertQuery);

        if (result?.rowsAffected?.[0] === 0) {
            FileNames.forEach(file => deleteImage(`./media/DocumentUpload/${file}`));
            return res.status(400).json(errorMessage('No Document uploaded.'));
        }

        return res.status(200).json(successMessage('Documents uploaded successfully.', { FileNames }));

    } catch (error) {
        FileNames.forEach(file => deleteImage(`./media/DocumentUpload/${file}`));
        console.error('Document Upload Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const updateIsActiveStatusOfDocument = async (req, res)=> {
    try{
        const { IsActive = true, OrganizerUkeyId, DocUkeyId } = req.body;
        
        const missingKeys = checkKeysAndRequireValues(
            [ 'IsActive', 'OrganizerUkeyId', 'DocUkeyId'], 
            { ...req.body }
        );

        if (missingKeys.length > 0 ) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required.`));
        }

        const result = await pool.request().query(`update DocumentUpload set IsActive = ${setSQLBooleanValue(IsActive)} where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} and DocUkeyId = ${setSQLStringValue(DocUkeyId)}`);

        if (result?.rowsAffected?.[0] === 0) {
            return res.status(400).json(errorMessage('No Document updated.'));
        }

        return res.status(200).json(successMessage('Documents updated successfully.'));
    }catch(error){
        console.error('Document Upload Error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveDocumnet = async (req, res) => {
    try {
        const { DocUkeyId, OrganizerUkeyId, EventUkeyId, Category } = req.query;

        const missingKeys = checkKeysAndRequireValues(['DocUkeyId', 'OrganizerUkeyId', 'EventUkeyId', 'Category'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        const oldImgResult = await pool.request().query(`
            SELECT FileName FROM DocumentUpload WHERE DocUkeyId = ${setSQLStringValue(DocUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `);

        const oldImg = oldImgResult.recordset?.[0]?.FileName;

        const deleteQuery = `
            DELETE FROM DocumentUpload WHERE DocUkeyId = ${setSQLStringValue(DocUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Document upload Master Deleted.') });
        }

        if (oldImg) deleteImage(`./media/DocumentUpload/${OrganizerUkeyId}/${EventUkeyId}/${Category}/` + oldImg);; // Delete image only after successful DB deletion

        return res.status(200).json({ ...successMessage('Document upload Master Deleted Successfully.'), ...req.query });
    } catch (error) {
        console.log('Delete Document upload Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

const RemoveDocumnetV2 = async (req, res) => {
    try {
        const { DocUkeyId, OrganizerUkeyId, EventUkeyId, Category } = req.query;

        const missingKeys = checkKeysAndRequireValues(['DocUkeyId', 'OrganizerUkeyId', 'EventUkeyId', 'Category'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }
        const oldImgResult = await pool.request().query(`
            SELECT FileName FROM DocumentUpload WHERE DocUkeyId = ${setSQLStringValue(DocUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `);

        const oldImg = oldImgResult.recordset?.[0]?.FileName;

        const deleteQuery = `
            DELETE FROM DocumentUpload WHERE DocUkeyId = ${setSQLStringValue(DocUkeyId)} AND OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json({ ...errorMessage('No Document upload Master Deleted.') });
        }

        if (oldImg) deleteImage(`./media/DocumentUpload/${OrganizerUkeyId}/${EventUkeyId}/${Category}/` + oldImg);; // Delete image only after successful DB deletion

        return res.status(200).json({ ...successMessage('Document upload Master Deleted Successfully.'), ...req.query });
    } catch (error) {
        console.log('Delete Document upload Master Error :', error);
        return res.status(500).json({ ...errorMessage(error.message) });
    }
};

module.exports = {
    FetchDocumentUploadDetails,
    DocumentUpload,
    RemoveDocumnet,
    updateIsActiveStatusOfDocument,
    RemoveDocumnetV2
}