const { errorMessage, successMessage, checkKeysAndRequireValues, generateUUID, getCommonKeys, deleteImage, setSQLStringValue, getCommonAPIResponse } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const fetchComplaintList = async (req, res) => {
    try {
        const { ComplaintMasterId, ComplaintMasterUkeyId, UserUkeyId, SortBy = "ComplaintMasterId", SortOrder = "DESC" } = req.query;
        let whereConditions = [];

        if (ComplaintMasterId) {
            whereConditions.push(`cm.ComplaintMasterId = '${ComplaintMasterId}'`);
        }
        if (ComplaintMasterUkeyId) {
            whereConditions.push(`cm.ComplaintMasterUkeyId = '${ComplaintMasterUkeyId}'`);
        }
        if (UserUkeyId) {
            whereConditions.push(`cm.UserUkeyId = '${UserUkeyId}'`);
        }

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getComplaintList = {
            getQuery: `SELECT cm.*, um.FirstName, um.MemberCategory, um.Mobile1 FROM ComplaintMaster AS cm
                       LEFT JOIN UserMaster As um on um.UserUkeyId = cm.UserUkeyId
                       ${whereString} ORDER BY ${SortBy} ${SortOrder}`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM ComplaintMaster AS cm ${whereString}`
        };

        const result = await getCommonAPIResponse(req, res, getComplaintList);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error.message));
    }
};

const manageComplaintMaster = async (req, res) => {
    const { ComplaintMasterUkeyId = generateUUID(), UserUkeyId, Message = '', flag } = req.body;
    let { Img = '' } = req.body;

    try {
        Img = req?.files?.Img?.length ? `${req?.files?.Img[0]?.filename}` : Img;
        const missingKeys = checkKeysAndRequireValues(['UserUkeyId', 'Message'], { ...req.body });
        if (missingKeys.length > 0) {
            if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
            return res.status(400).send(errorMessage(`${missingKeys.join(', ')} parameters are required.`));
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO ComplaintMaster (ComplaintMasterUkeyId, UserUkeyId, Image, Message, IpAddress, HostName, EntryDate) 
            VALUES ('${ComplaintMasterUkeyId}', '${UserUkeyId}', '${Img}', N'${Message}', '${IPAddress}', '${ServerName}', '${EntryTime}')
        `;

        const deleteQuery = `DELETE FROM ComplaintMaster WHERE ComplaintMasterUkeyId = '${ComplaintMasterUkeyId}';`;

        if (flag === 'A') {
            const missingKeys = checkKeysAndRequireValues(['UserUkeyId', 'Message'], req.body);
            if (missingKeys.length > 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).send(`${missingKeys.join(', ')} parameters are required.`);
            }

            const result = await pool.request().query(insertQuery);
            if (result.rowsAffected[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path);
                return res.status(400).send(errorMessage("No Complaint Master Created."));
            }

            return res.status(200).json(successMessage("Complaint Master Created Successfully."));
        } else if (flag === 'U') {
            const oldImageResult = await pool.request().query(`SELECT Image FROM ComplaintMaster WHERE ComplaintMasterUkeyId = '${ComplaintMasterUkeyId}'`);
            const oldImage = oldImageResult.recordset?.[0]?.Image; // Safely access the first record
            // console.log('oldImage :>> ', oldImage);
            // console.log('full path :>> ', `./media/Complaint/${oldImage}`);

            await pool.request().query(deleteQuery);
            const result = await pool.request().query(insertQuery);

            if (result.rowsAffected[0] === 0) {
                if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
                return res.status(400).send(errorMessage("No Complaint Master Updated."));
            }

            if (oldImage && req?.files?.Img?.length) deleteImage(`./media/Complaint/${oldImage}`);
            return res.status(200).json(successMessage("Complaint Master Updated Successfully."));
        } else {
            return res.status(400).send(errorMessage("Invalid flag. Use 'A' to Add and 'U' to Update."));
        }
    } catch (error) {
        if (Img) deleteImage(req?.files?.Img?.[0]?.path); // Only delete if `Img` exists
        return res.status(500).send(errorMessage(error.message));
    }
};

const removeComplaintMaster = async (req, res) => {
    try {
        const { ComplaintMasterUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['ComplaintMasterUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const oldImageResult = await pool.request().query(`SELECT Image FROM ComplaintMaster WHERE ComplaintMasterUkeyId = '${ComplaintMasterUkeyId}'`);
        const oldImage = oldImageResult.recordset?.[0]?.Image;

        const deleteQuery = `DELETE FROM ComplaintMaster WHERE ComplaintMasterUkeyId = '${ComplaintMasterUkeyId}';`;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage("No Complaint Master Deleted."));
        }

        if (oldImage) deleteImage('./media/Complaint/' + oldImage);

        return res.status(200).json(successMessage("Complaint Master Deleted Successfully."));
    } catch (error) {
        return res.status(500).send(errorMessage(error.message));
    }
};

module.exports = {
    fetchComplaintList,
    manageComplaintMaster,
    removeComplaintMaster
};
