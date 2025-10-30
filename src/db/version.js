const { pool } = require("../sql/connectToDatabase");

const addColumnInTable = async (tableName, columnName, columnType) => {
    try {
        await pool.request()
            .query(`ALTER TABLE ${tableName} ADD ${columnName} ${columnType}`);
        console.log(`Table ${tableName} Into Column ${columnName} added successfully!`);
    } catch (error) {
        console.error('Error:', error);
        throw error; // Rethrow the error to handle it in the calling code
    }
}

const dropColumnInTable = async (tableName, columnName) => {
    try {
        await pool.request()
            .query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
        console.log(`Table ${tableName} Into Column ${columnName} dropped successfully!`);
    } catch (error) {
        console.error('Error:', error);
        throw error; // Rethrow the error to handle it in the calling code
    }
}

const createTableInDatabase = async (tableName, addColumn) => {
    try {
        await pool.request()
            .query(`CREATE TABLE ${tableName} ${addColumn}`);
        console.log(`Table ${tableName} created successfully!`);
    } catch (error) {
        if (error?.message?.includes('already an object named')) {
            console.log(`Table ${tableName} already created`);
            return
        }
        throw error; // Rethrow the error to handle it in the calling code
    }
}

const createAllTableInDB = async () => {
    // await createTableInDatabase('UserFamilyInfo', createUserFamilyInfoTable);
}

module.exports = {
    createAllTableInDB
}