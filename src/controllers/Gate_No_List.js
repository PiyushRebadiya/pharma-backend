const { errorMessage } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const list_Of_Gate_No = async (req, res) => {
    try {
        const result = await pool.request().query(`SELECT GateNo FROM TicketMaster GROUP BY GateNo`);
        return res.json({
            success: true,
            status: 200,
            message: "Gate No List",
            data: result.recordset
        });
    } catch (error) {
        return res.status(400).send(errorMessage(error?.message));
    }
}

module.exports = { list_Of_Gate_No };