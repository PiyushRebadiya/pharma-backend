const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, toFloat, setSQLStringValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const GetUserTokenDeviceList = async(req, res)=>{
    try{
        const { DeviceName, DeviceType, Token, VerifyToken, UserUkeyId, Log_In, Log_Out, OrganizerUkeyId } = req.query;
        let whereConditions = [];

        // Check for each query parameter and add to the WHERE conditions
        if (DeviceName) {
            whereConditions.push(`DeviceName = ${setSQLStringValue(DeviceName)}`);
        }
        if (DeviceType) {
            whereConditions.push(`DeviceType = ${setSQLStringValue(DeviceType)}`);
        }
        if (Token) {
            whereConditions.push(`Token = ${setSQLStringValue(Token)}`);
        }
        if (UserUkeyId) {
            whereConditions.push(`UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (Log_In) {
            whereConditions.push(`Log_In = ${setSQLBooleanValue(Log_In)}`);
        }
        if (Log_Out) {
            whereConditions.push(`Log_Out = ${setSQLBooleanValue(Log_Out)}`);
        }
     const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
     const getUserList = {
            getQuery: `SELECT *, CASE WHEN [Token] = '${VerifyToken}' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS CurrentDevice FROM user_devices ${whereString} ORDER BY Id DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM user_devices ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);

    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const AddUserDevicesLogin = async(req, res)=>{
    const { DeviceName = '' , DeviceType = '' , DeviceOS = '', DeviceModel = '', BrowserName = '', Token, UserUkeyId = '', OrganizerUkeyId = '', NotificationToken = '' } = req.body;
    const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
    try{
        const missingKeys = checkKeysAndRequireValues(['Token', 'DeviceType'], req.body)
        if(missingKeys.length > 0){
            return res.status(200).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        if(!UserUkeyId && !OrganizerUkeyId){
            return res.status(400).json(errorMessage('UserUkeyId or OrganizerUkeyId is required'));
        }
        let queryOfDeviceType =  '';
        if(DeviceType === 'Android' || DeviceType === 'IOS'){
            queryOfDeviceType = ` AND DeviceType = ${setSQLStringValue(DeviceType)}`;
        }
        if (DeviceType !== 'web') {
            const getMobileDeviceQuery = `SELECT * FROM user_devices WHERE DeviceModel = ${setSQLStringValue(DeviceModel)} AND Log_In = 1 ${queryOfDeviceType}`;

            const existingDevice = await pool.request().query(getMobileDeviceQuery);

            if (existingDevice.recordset.length > 0) {
                existingDevice.recordset.forEach(async (device) => {
                    const updateQuery = `
            UPDATE user_devices SET Log_Out = 1, Log_In = 0, Log_Out_Time = GETDATE(), Remark = 'Again Login On Same Device', IpAddress = ${setSQLStringValue(IPAddress)}, HostName = ${setSQLStringValue(ServerName)}, EntryDate = ${setSQLStringValue(EntryTime)} WHERE DeviceUkeyId = ${setSQLStringValue(device.DeviceUkeyId)} AND Log_In = 1`
                    try {
                        await pool.request().query(updateQuery);
                    } catch (error) {
                        console.log('Update User Devices Login Error :', error);
                    }
                })
            }
        }
        const insertQuery = `
            INSERT INTO user_devices (DeviceName, DeviceType, DeviceOS, DeviceModel, BrowserName, Token, NotificationToken, UserUkeyId, OrganizerUkeyId,  Log_In, Log_In_Time, Log_Out, IpAddress, HostName, EntryDate) VALUES (${setSQLStringValue(DeviceName)}, ${setSQLStringValue(DeviceType)}, ${setSQLStringValue(DeviceOS)}, ${setSQLStringValue(DeviceModel)}, ${setSQLStringValue(BrowserName)}, ${setSQLStringValue(Token)}, ${setSQLStringValue(NotificationToken)}, ${setSQLStringValue(UserUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, 1, GETDATE(), 0, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)});
        `
        const result = await pool.request().query(insertQuery);
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not added user devices login successfully.')})
        }
        return res.status(200).json({...successMessage('Successfully added user devices login.'), ...req.body});
    }catch(error){
        console.log('Add User Devices Login Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const LogOutUserDevicesLogin = async(req, res)=>{
    try{
        const { Token } = req.body;
        const {IPAddress, ServerName, EntryTime} = getCommonKeys(req);
        const missingKeys = checkKeysAndRequireValues(['Token'], req.body);
        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is required`));
        }
        const updateQuery = `
            UPDATE user_devices SET Log_Out = 1, Log_In = 0, Log_Out_Time = GETDATE(), Remark = 'User Logout', IpAddress = ${setSQLStringValue(IPAddress)}, HostName = ${setSQLStringValue(ServerName)}, EntryDate = ${setSQLStringValue(EntryTime)} WHERE Token = ${setSQLStringValue(Token)}
        `
        const result = await pool.request().query(updateQuery);
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('Not logged out user devices login successfully.')})
        }
        return res.status(200).json({...successMessage('Successfully logged out user devices login.'), ...req.body});
    }catch(error){
        console.log('Log Out User Devices Login Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

module.exports = {
    LogOutUserDevicesLogin,
    AddUserDevicesLogin,
    GetUserTokenDeviceList
}