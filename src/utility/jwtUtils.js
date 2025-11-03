const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid token');
    }
};

// const simpleHash = (password) => {
//     return crypto.createHash('md5').update(password).digest('hex');
// };

// Compare password with hash
const comparePassword = (password, hashedPassword) => {
    const hashedInput = simpleHash(password);
    return hashedInput === hashedPassword;
};

module.exports = {
    generateToken,
    verifyToken,
    comparePassword,
    JWT_SECRET
};