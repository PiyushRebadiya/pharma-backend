const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../common/variable");

const verifyToken = async (req, res, next) => {
    let token = req.headers['authorization'];
    if (!token) {
        return res.status(401).send({
            status: 401,
            message: "A token is required for authentication",
        });
    }
    try {
        token = token.replace("Bearer ", "");
        token = token.replace("bearer ", "");

        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
    } catch (err) {
        return res.status(401).send(err?.message || "Invalid Token");
    }
    return next();
};

module.exports = verifyToken;
