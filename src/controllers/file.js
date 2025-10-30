const { errorMessage, getCommonAPIResponse } = require("../common/main");
const fs = require('fs');
const { pool, sql } = require("../sql/connectToDatabase");

const fetchFile = async (req, res) => {
    try {
        const getTempQuery = `select * from temp_files`;


        //   const result = await getCommonAPIResponse(req, res, getTempQuery);
        const result = await pool.query(getTempQuery);
        console.log('result', result)
        if (result.recordset.length === 0) {
            return res.status(404).send(errorMessage('File not found'));
        }

        for (let i = 0; i < result.recordset.length; i++) {
            const element = result.recordset[i];

            const mainJs = fs.readFileSync(`./media/Canvas/${element.json}`, 'utf8');
            // if (!mainJs) {
            //     return res.status(404).send(errorMessage('File not found'));
            // }
            console.log('mainJs', mainJs)
            result.recordset[i].json = JSON.parse(mainJs);
        }
        return res.json(result.recordset);

    } catch (error) {
        console.error('Error fetching file:', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

// const updateFile = async (req, res) => {
//     console.log('1 - Entering updateFile function'); // Basic function entry check

//     try {
//         console.log('2 - Try block started');
//         console.log('3 - Raw request body:', JSON.stringify(req.body, null, 2));
//         console.log('4 - Raw request files:', JSON.stringify(req.files, null, 2));

//         const { id } = req.body;
//         console.log('5 - Extracted ID:', id); // Verify ID extraction

//         // More robust file extraction
//         const File = req.files?.File?.[0] || req.body?.File;
//         console.log('6 - File object:', File ? 'Exists' : 'Undefined');

//         if (!id) {
//             console.error('7 - ID validation failed');
//             return res.status(400).send(errorMessage('ID is required'));
//         }

//         if (!File) {
//             console.error('8 - File validation failed');
//             return res.status(400).send(errorMessage('File data is required'));
//         }

//         console.log('9 - Pre-database check reached');
//         console.log('10 - Checking database for ID:', id);

//         // Verify database connection first
//         try {
//             console.log('11 - Testing database connection');
//             const testQuery = await pool.request()
//                 .input('id', sql.Int, id)
//                 .query('SELECT 1 AS connection_test');
//             console.log('12 - Database connection test result:', testQuery.recordset);
//         } catch (dbError) {
//             console.error('13 - Database connection failed:', {
//                 message: dbError.message,
//                 code: dbError.code,
//                 stack: dbError.stack
//             });
//             return res.status(500).send(errorMessage('Database connection failed'));
//         }

//         // Main query with proper error handling
//         let checkResult;
//         try {
//             console.log('14 - Executing main database query');
//             checkResult = await pool.request()
//                 .input('id', sql.Int, id)
//                 .query('SELECT * FROM temp_files WHERE id = @id');

//             console.log('15 - Query executed successfully');
//             console.log('16 - Result recordset length:', checkResult.recordset.length);
//         } catch (queryError) {
//             console.error('17 - Database query failed:', {
//                 message: queryError.message,
//                 code: queryError.code,
//                 stack: queryError.stack
//             });
//             return res.status(500).send(errorMessage('Database query failed'));
//         }

//         if (!checkResult.recordset || checkResult.recordset.length === 0) {
//             console.error('18 - No records found for ID:', id);
//             return res.status(404).send(errorMessage('File ID not found'));
//         }

//         console.log('19 - Proceeding with file update');
//         // ... rest of your update logic ...

//     } catch (error) {
//         console.error('20 - Global error handler caught:', {
//             message: error.message,
//             stack: error.stack,
//             timestamp: new Date().toISOString()
//         });
//         return res.status(500).send(errorMessage('Unexpected server error'));
//     }
// };

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

module.exports = { fetchFile, updateFile };