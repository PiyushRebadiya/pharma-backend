const { errorMessage, successMessage, checkKeysAndRequireValues, generateUUID, getCommonKeys, getCommonAPIResponse, deleteImage, setSQLStringValue, setSQLNumberValue, setSQLBooleanValue, CommonLogFun, setSQLDateTime } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const FetchOrgUserMasterDetails = async (req, res) => {
    try {
        const { UserUkeyId, IsActive, OrganizerUkeyId, Role, EventUkeyId } = req.query;
        let whereConditions = [];

        if (UserUkeyId) whereConditions.push(`UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        if (OrganizerUkeyId) whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        if (EventUkeyId) whereConditions.push(`EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        if (Role) whereConditions.push(`Role = ${setSQLStringValue(Role)}`);
        if (IsActive) whereConditions.push(`IsActive = ${setSQLBooleanValue(IsActive)}`);
        whereConditions.push(`flag <> 'D'`);

        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

        const getUserList = {
            getQuery: `SELECT * FROM OrgUserMaster ${whereString} ORDER BY EntryDate DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM OrgUserMaster ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
};

const OrgUserMaster = async (req, res) => {
    const {
        UserUkeyId = '', EventUkeyId = '', OrganizerUkeyId = '', Password = '', FirstName = '',
        Mobile1 = '', Mobile2 = '', Add1 = '', Add2 = '', StateCode = '', StateName = '', CityName = '', Pincode = '',
        DOB = '', Email = '', Gender = '', Role = '', IsActive = true, flag = '', AliasName = ''
    } = req.body;

    let { Image = '' } = req.body;
    Image = req?.files?.Image?.length ? `${req?.files?.Image[0]?.filename}` : Image;

    try {
        const { IPAddress, ServerName, EntryTime } = getCommonKeys();

        // const checkUserMobileandEmail = await pool.request().query(`
        //     select COUNT(*) AS checkUserMobileandEmail from OrgUserMaster where Mobile1 = ${setSQLStringValue(Mobile1)} OR Email = ${setSQLStringValue(Email)} and IsActive = 1 
        // `)
        
        // if(checkUserMobileandEmail?.recordset?.[0]?.checkUserMobileandEmail > 0 && flag == 'A'){
        //     return res.status(400).json(errorMessage(`User already exists with the provided mobile number or email address.`));
        // }

        if(flag == 'A'){
            const AdminUserCount = await pool.request().query(`
                select COUNT(*) AS AdminUserCount from OrgUserMaster where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} and EventUkeyId = ${setSQLStringValue(EventUkeyId)} and Role = ${setSQLStringValue(Role)} and Mobile1 = ${setSQLStringValue(Mobile1)} and flag <> 'D'
            `)

            if(AdminUserCount?.recordset?.[0]?.AdminUserCount > 0){
                return res.status(400).json(errorMessage(`User already exists with the provided mobile number as ${Role == 'Sub-Admin' ? 'Sub-Admin' : 'Volunteer'}.`));
            }
            const planLimit = await pool.request().query(`select SubAdminLimit, VolunteerLimit from PaymentLogDetails where OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)} and EventUkeyId = ${setSQLStringValue(EventUkeyId)} and flag <> 'D'`)

            if(AdminUserCount?.recordset?.[0]?.AdminUserCount >= (Role == 'Sub-Admin' ? planLimit?.recordset[0]?.SubAdminLimit : planLimit?.recordset?.[0]?.VolunteerLimit)){
                return res.status(400).json(errorMessage(`Maximum ${Role == 'Sub-Admin' ? planLimit?.recordset[0]?.SubAdminLimit : planLimit?.recordset?.[0]?.VolunteerLimit} users allowed as ${Role == 'Sub-Admin' ? 'Sub-Admin' : 'Volunteer'}.`));
            }
        }

        let insertQuery = `
            INSERT INTO OrgUserMaster (
                UserUkeyId, EventUkeyId, OrganizerUkeyId, Password, FirstName, Image, Mobile1, Mobile2, Add1, Add2,
                StateCode, StateName, CityName, Pincode, DOB, Email, Gender, Role, IsActive, IpAddress, HostName, EntryDate, flag, AliasName
            ) VALUES (
                N'${UserUkeyId}', N'${EventUkeyId}', N'${OrganizerUkeyId}', N'${Password}', N'${FirstName}', N'${Image}', N'${Mobile1}', N'${Mobile2}',
                N'${Add1}', N'${Add2}', N'${StateCode}', N'${StateName}', N'${CityName}', ${setSQLNumberValue(Pincode)}, ${setSQLDateTime(DOB)},
                N'${Email}', N'${Gender}', N'${Role}', ${setSQLBooleanValue(IsActive)}, N'${IPAddress}', N'${ServerName}', N'${EntryTime}', ${setSQLStringValue(flag)}, ${setSQLStringValue(AliasName)}
            );
        `;

        const deleteQuery = `
            DELETE FROM OrgUserMaster WHERE UserUkeyId = '${UserUkeyId}';
        `;

        if (flag === 'A') {
            const missingKeys = checkKeysAndRequireValues(['FirstName', 'Email', 'Role'], req.body);
            if (missingKeys.length > 0) {
                if (Image) deleteImage(req?.files?.Image?.[0]?.path);
                return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
            }

            const result = await pool.request().query(insertQuery);

            if (result?.rowsAffected?.[0] === 0) {
                if (Image) deleteImage(req?.files?.Image?.[0]?.path);
                return res.status(400).json(errorMessage('No User Created.'));
            }
            CommonLogFun({
                EventUkeyId : EventUkeyId, 
                OrganizerUkeyId : OrganizerUkeyId, 
                ReferenceUkeyId : UserUkeyId, 
                MasterName : FirstName,  
                TableName : "OrgUserMaster", 
                UserId : req?.user?.UserId, 
                UserName : req?.user?.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })

            return res.status(200).json({...successMessage('New User Created Successfully.'), Image, ...req.body });
        } 
        else if (flag === 'U') {
            const oldImgResult = await pool.request().query(`
                SELECT Image FROM OrgUserMaster WHERE UserUkeyId = '${UserUkeyId}';
            `);
            const oldImg = oldImgResult.recordset?.[0]?.Image;
            if (Role === 'Admin' || Role === 'SuperAdmin') {
                insertQuery += `
                UPDATE OrganizerMaster SET
                Mobile1 = ${setSQLStringValue(Mobile1)},
                Mobile2 = ${setSQLStringValue(Mobile2)},
                Email = ${setSQLStringValue(Email)},
                Add1 = ${setSQLStringValue(Add1)},
                Add2 = ${setSQLStringValue(Add2)},
                StateCode = ${setSQLNumberValue(StateCode)},
                StateName = ${setSQLStringValue(StateName)},
                IsActive = ${setSQLBooleanValue(IsActive)},
                IpAddress = ${setSQLStringValue(IPAddress)},
                HostName = ${setSQLStringValue(ServerName)},
                EntryDate = ${setSQLStringValue(EntryTime)},
                OrganizerName = ${setSQLStringValue(FirstName)},
                flag = ${setSQLStringValue(flag)}
                WHERE OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
                `;
            }
            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if (deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0) {
                if (Image) deleteImage(req?.files?.Image?.[0]?.path);
                return res.status(400).json(errorMessage('No User Updated.'));
            }

            if (oldImg && req.files && req.files.Image && req.files.Image.length > 0){
                deleteImage('./media/Organizer/' + oldImg);
            }

            CommonLogFun({
                EventUkeyId : EventUkeyId, 
                OrganizerUkeyId : OrganizerUkeyId, 
                ReferenceUkeyId : UserUkeyId, 
                MasterName : FirstName,  
                TableName : "OrgUserMaster", 
                UserId : req?.user?.UserId, 
                UserName : req.user.FirstName, 
                IsActive : IsActive,
                flag : flag, 
                IPAddress : IPAddress, 
                ServerName : ServerName, 
                EntryTime : EntryTime
            })

            return res.status(200).json({...successMessage('User Updated Successfully.'), Image, ...req.body });
        } 
        else {
            if (Image) deleteImage(req?.files?.Image?.[0]?.path);
            return res.status(400).json(errorMessage("Use 'A' flag to Add and 'U' flag to update."));
        }
    } catch (error) {
        if (Image) deleteImage(req?.files?.Image?.[0]?.path);
        console.error('OrgUserMaster API error:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const RemoveOrgUser = async (req, res) => {
    try {
        const { UserUkeyId, OrganizerUkeyId } = req.query;
        const missingKeys = checkKeysAndRequireValues(['UserUkeyId', 'OrganizerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        // Fetch old image path before deletion
        // const oldImgResult = await pool.request().query(
        //     `SELECT Image FROM OrgUserMaster WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};`
        // );
        // const oldImg = oldImgResult.recordset?.[0]?.Image;

        // Delete user from OrgUserMaster
        const deleteQuery = `update OrgUserMaster set flag = 'D' WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)};`;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No User Deleted.'));
        }
        // if (oldImg) deleteImage('./media/Organizer/' + oldImg);; // Delete image only after successful DB deletion

        return res.status(200).json({...successMessage('User Deleted Successfully.'), ...req.query });
    } catch (error) {
        console.error('RemoveOrgUser API error:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};
module.exports = { FetchOrgUserMasterDetails, OrgUserMaster, RemoveOrgUser };