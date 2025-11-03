const { verifyToken } = require('../utility/jwtUtils');
const { errorMessage } = require('../common/main');

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json(errorMessage('Access token is required'));
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json(errorMessage('Invalid or expired token'));
    }
};

// Optional: Middleware for admin role verification
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json(errorMessage('Admin access required'));
    }
};

module.exports = {
    authenticateToken,
    requireAdmin
};