const { setSQLStringValue } = require("../common/main");
const { FRONTED_USER_URL } = require("../common/variable");
const { pool } = require("../sql/connectToDatabase");

const fetchDownloadTicketURL = async (req, res) => {
    const { shortCode } = req.params;
    let redirectUrl = FRONTED_USER_URL;

    const findRedirectUrlQuery = `SELECT long_url FROM ShortUrls WHERE short_code = ${setSQLStringValue(shortCode)}`;
    const result = await pool.query(findRedirectUrlQuery); //await
    if (result.recordset.length > 0) {
        return res.status(200).json({
            success: true,
            url: result.recordset[0].long_url
        });
    }
    return res.status(200).json({
        success: true,
        url: redirectUrl
    });
}

module.exports = { fetchDownloadTicketURL };