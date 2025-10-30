const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: "smtp.taxcrm.in",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: "info@taxcrm.in",
        pass: "SZHQBWm3",
    },
    tls: {
        rejectUnauthorized: false
    }
});
const sendMail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: 'info@taxcrm.in', // sender address
            to, // list of receivers
            subject, // Subject line
            html // HTML body
        });
        console.log(`Message sent: ${info.messageId} To: ${to}`);
        return true
    } catch (error) {
        console.log('error Send Mail :>> ', error);
    }
}

module.exports = {
    sendMail
}