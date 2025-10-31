const moment = require('moment');
const os = require('os');
const fs = require('fs');
const { LIVE_URL } = require('./variable');
const { pool } = require('../sql/connectToDatabase');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const generateUUID = () => {
    const uniqueID = uuidv4().toLocaleUpperCase();
    return uniqueID
}

const getServerIpAddress = (req) => {
    const IPAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'Not Found';
    return IPAddress;
};
// const getServerIpAddress = () => {
//     const ifaces = os.networkInterfaces();
//     let IPAddress = '';

//     Object.keys(ifaces).forEach(ifname => {
//         ifaces[ifname].forEach(iface => {
//             if (iface.family === 'IPv4' && !iface.internal) {
//                 IPAddress = iface.address;
//             }
//         });
//     });

//     return IPAddress;
// };

const getServerName = () => {
    const hostname = os.hostname();
    return hostname;
};

const getEntryTime = () => {
    return moment().format('YYYY-MM-DD HH:mm:ss');
}

const errorMessageHandler = (message) => {
    if (message?.match('REFERENCE constraint')) {
        message = "This Data Is Already Exists!"
    }
    if (message?.match('FOREIGN KEY constraint')) {
        message = "This Data Foreign Key Is Not Found!"
    }
    return message
}

const errorMessage = (message = "Something went wrong!", status = 400) => {
    message = errorMessageHandler(message);
    return {
        success: false,
        status,
        message
    }
}

const successMessage = (message = "successfully!") => {
    return {
        success: true,
        status: 200,
        message
    }
}

const getCommonKeys = (req) => {
    const IPAddress = getServerIpAddress(req);
    const ServerName = getServerName();
    const EntryTime = getEntryTime();
    return {
        IPAddress,
        ServerName,
        EntryTime
    }
}

const setSQLBooleanValue = (condition) => {
    if (condition === true || condition === 'true') {
        return 1
    }
    return 0
}

const setSQLNumberValue = (value) => {
    if (!value || isNaN(value)) {
        return 0
    }
    return Number(value)
}

const setSQLDecimalValue = (value, decimalPlaces = 2) => {
    if (!value || isNaN(value)) {
        return 0.0;
    }
    return parseFloat(parseFloat(value).toFixed(decimalPlaces));
};

const setSQLNumberNullValue = (value) => {
    if (!value || isNaN(value)) {
        return null
    }
    return Number(value)
}

const setSQLOrderId = (value) => {
    if (Number(value) < 0 || Number(value) > 10000 || !value) {
        return null
    }
    return value
}

const setSQLStringValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return `''`;  // Return an empty string if value is falsy
    }
    return `N'${String(value).trim().replaceAll("'", "''")}'`;  // Ensure value is a string before trimming
}

const setSQLDateTime = (date) => {
    if (!date || date === null || date === undefined || date === '' || !moment(date).isValid()) {
        return null;
    }
    return `'${moment.utc(date).format('YYYY-MM-DD HH:mm:ss')}'`;
};

const checkKeysAndRequireValues = (allKeys, matchKeys) => {
    const errorKeys = [];
    allKeys.map((item) => {
        if (!Object.keys(matchKeys).includes(item) || matchKeys[item] === undefined || matchKeys[item] === null || matchKeys[item] === '') {
            errorKeys.push(item);
        }
    });
    return errorKeys;
};

const generateReferralCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let referralCode = '';

    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        referralCode += characters[randomIndex];
    }

    return referralCode;
}

const generateSixDigitCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    // Generate 3 random letters
    let alphabeticPart = '';
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        alphabeticPart += letters[randomIndex];
    }

    // Generate 3 random numbers
    let numericPart = '';
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * numbers.length);
        numericPart += numbers[randomIndex];
    }

    return alphabeticPart + numericPart;
}

// Function to safely delete a file
const safeUnlink = (filePath) => {
    return new Promise((resolve, reject) => {
        // Check if filePath is valid
        if (!filePath) {
            return resolve('No file path provided');
        }

        // Proceed only if the file does NOT contain 'static'
        if (filePath.includes('static')) {
            console.log(`Skipping deletion of static file: ${filePath}`);
            return resolve('Skipped static file');
        }

        fs.access(filePath, fs.constants.F_OK, (err) => {
            // If file doesn't exist, just resolve
            if (err) {
                console.log(`File does not exist: ${filePath}`);
                return resolve('File does not exist');
            }

            // Check write access
            fs.access(filePath, fs.constants.W_OK, (accessErr) => {
                if (accessErr) {
                    console.log(`No write access to file: ${filePath}, error: ${accessErr.message}`);
                    return resolve('No write access'); // Resolve instead of reject to avoid crashing
                }

                // Delete the file
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.log(`Error deleting file: ${filePath}, error: ${unlinkErr.message}`);
                        return resolve('Delete failed'); // Resolve instead of reject
                    }
                    console.log(`Successfully deleted file: ${filePath}`);
                    resolve('File deleted successfully');
                });
            });
        });
    });
};

const updateUploadFiles = (updateFile, previousFile, folderName) => {
    if (updateFile && updateFile[0] && updateFile[0]?.filename) {
        if (previousFile) {
            try {
                fs.unlinkSync(`${folderName}/${previousFile}`);
            } catch (error) {
                console.log('Error :>> ', error);
            }
        }
        return `${updateFile[0]?.filename}`;
    } else {
        return previousFile
    }
}

const getCommonAPIResponse = async (req, res, query) => {
    if (req.query.Page && req.query.PageSize) {
        return await getCommonAPIResponseWithPagination(req, res, query);
    }
    try {
        const result = await pool.request().query(query.getQuery);
        const countResult = await pool.request().query(query.countQuery);
        const totalCount = countResult.recordset[0].totalCount;
        return {
            data: result.recordset,
            totalLength: totalCount
        }
    } catch (error) {
        console.error('Error:', error);
        return errorMessage(error?.message);
    }
}

const getCommonAPIResponseWithPagination = async (req, res, query) => {
    try {
        const page = req.query.Page || 1; // Default page number is 1
        const pageSize = req.query.PageSize || 10; // Default page size is 10
        // Calculate the offset based on the page number and page size
        const offset = (page - 1) * pageSize;
        const paginationQuery = `${query.getQuery} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
        const result = await pool.request().query(paginationQuery);
        // Fetch total length of Carousel table
        const countResult = await pool.request().query(query.countQuery);
        const totalCount = countResult.recordset[0].totalCount;
        // Return data along with total length
        return {
            data: result.recordset,
            totalLength: totalCount
        }
    } catch (error) {
        console.error('Error:', error);
        return errorMessage(error?.message);
    }
}

const getAPIALLDataResponse = async (req, res, TableName, Id, WHERE = ``) => {
    if (req.query.page && req.query.pageSize) {
        return await getAPIALLDataResponseWithPagination(req, res, TableName, Id, WHERE);
    }
    try {
        const query = `SELECT * FROM ${TableName} ${WHERE} ORDER BY ${Id} DESC`;
        const result = await pool.request().query(query);
        const countQuery = `SELECT COUNT(*) AS totalCount FROM ${TableName} ${WHERE}`;
        const countResult = await pool.request().query(countQuery);
        const totalCount = countResult.recordset[0].totalCount;
        return {
            data: result.recordset,
            totalLength: totalCount
        }
    } catch (error) {
        console.error('Error:', error);
        return errorMessage(error?.message);
    }
}

const base64Encode = (plainText) => {
    return Buffer.from(plainText).toString('base64');
};


const base64Decode = (encodedText) => {
    return Buffer.from(encodedText, 'base64').toString('utf-8');
};

const deleteImage = (filePath) => {
    try {
        console.log("Deleting file:", filePath);
        fs.unlinkSync(filePath);
    } catch (error) {
        console.log('Error :>> ', error);
    }
}

function escapeSQLString(str) {
    return str ? str.replace(/'/g, "''") : str;
}

const generateJWTT = (Payload) => {
    // Set 1 month in seconds (30 days x 24 hours x 60 minutes x 60 seconds)
    const oneMonthInSeconds = 30 * 24 * 60 * 60; 
    return jwt.sign(Payload, process.env.SECRET_KEY, { expiresIn: oneMonthInSeconds });
};

const generateCODE = (name) => {
    try {
        // Ensure name is at least 3 characters by appending underscores
        while (!name || name.length < 3) {
            name += '_';
        }

        // Generate three random digits
        const randomThreeDigits = Math.floor(Math.random() * 900) + 100; // Generates a number between 100 and 999

        // Extract the first three characters of name
        const firstThreeChars = name.slice(0, 3).toUpperCase();

        // Combine the values to create a unique key
        return `${firstThreeChars}${randomThreeDigits}`;
    } catch (error) {
        console.log('generate UKeyId Error:', error);
    }
};

function toFloat(value) {
    if (value === null || value === undefined || value === '') {
        return null; // Return NaN for invalid or empty inputs
    }

    const floatValue = parseFloat(value);

    // Check if the result is a valid number
    if (isNaN(floatValue)) {
        console.error(`Error: Cannot convert "${value}" to a float.`);
        return NaN;
    }

    return floatValue;
}

const CommonLogFun = async (body) => {
    try{
        const { EventUkeyId, OrganizerUkeyId, ReferenceUkeyId, MasterName, IsActive, TableName, UserId, UserName, flag, IPAddress, ServerName, EntryTime} = body

        const result = await pool.request().query(`
            insert into CommonLog (
                LogUkeyId, EventUkeyId, OrganizerUkeyId, ReferenceUkeyId, MasterName, IsActive, TableName, UserId, UserName, flag, IpAddress, HostName, EntryDate
            ) values (
                newid(), ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(ReferenceUkeyId)}, ${setSQLStringValue(MasterName)}, ${setSQLBooleanValue(IsActive)}, ${setSQLStringValue(TableName)}, ${setSQLNumberNullValue(UserId)}, ${setSQLStringValue(UserName)}, ${setSQLStringValue(flag)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLDateTime(EntryTime)}
            )
        `)
    }catch(error){
        console.log('common log error : ', error);
    }
}

const generateBookingCode = () => {
    try {
        // Generate three random uppercase letters
        const randomLetters = Array.from({ length: 3 }, () => 
            String.fromCharCode(65 + Math.floor(Math.random() * 26)) // ASCII A-Z (65-90)
        ).join('');

        // Generate three random digits (100-999)
        const randomThreeDigits = Math.floor(Math.random() * 900) + 1000;

        // Combine the values to create a unique key
        return `${randomLetters}${randomThreeDigits}`;
    } catch (error) {
        console.log('generate UKeyId Error:', error);
    }
};

const generateGiftCardCode = (length = 10) => {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            code += chars[randomIndex];
        }

        return code;
    } catch (error) {
        console.error('generateGiftCardCode Error:', error);
    }
};

module.exports = {
    getServerIpAddress,
    getServerName,
    getEntryTime,
    errorMessage,
    successMessage,
    getCommonKeys,
    setSQLBooleanValue,
    checkKeysAndRequireValues,
    updateUploadFiles,
    getAPIALLDataResponse,
    getCommonAPIResponse,
    safeUnlink,
    setSQLOrderId,
    setSQLStringValue,
    setSQLDateTime,
    generateReferralCode,
    setSQLNumberValue,
    setSQLNumberNullValue,
    base64Encode,
    base64Decode,
    generateUUID,
    deleteImage,
    escapeSQLString,
    generateJWTT,
    generateCODE,
    generateSixDigitCode,
    toFloat,
    setSQLDecimalValue,
    CommonLogFun,
    generateBookingCode,
    generateGiftCardCode,
}