const { sendMail } = require('../common/mail');
const { successMessage, checkKeysAndRequireValues, errorMessage } = require('../common/main');
const { pool } = require('../sql/connectToDatabase');

const sentMobileOTPMsg = async (RegisterMobile, otp) => {
    try {
        const mobile = `${RegisterMobile}`
        const message = `Your%20OTP%20is%20${otp}%20for%20Monarch%20MyEventz%20Application.%20-%20MONARCH`
        const urlData = await pool.query(`SELECT * FROM MobSMSMast WHERE IsActive = 1`);
        let otpURL = '';
        if (urlData?.rowsAffected?.length > 0) {
            otpURL = urlData.recordset[0].BaseUrl;
            otpURL = otpURL.replace('#Mobile#', mobile);
            otpURL = otpURL.replace('#Message#', message);
        } else {
            return false;
        }
        const result = await fetch(otpURL, {
            method: 'GET'
        })
        if (result.status === 200 && result.statusText === 'OK') {
            return true;
        }
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

const otpVerificationHandler = async (req, res) => {
    try {
        const { Email, Mobile } = req.body;

        // Check if we're processing email or mobile
        if (Email) {
            // Email OTP Logic
            const missingKeys = checkKeysAndRequireValues(['Email'], req.body);
            if (missingKeys.length > 0) {
                return res.status(400).json(errorMessage(`Missing or empty keys: ${missingKeys.join(', ')}`));
            }

            const subject = 'MyEventZ - Verify Your OTP';
            const otp = Math.random().toString().substr(2, 6);

            // Enhanced HTML template with professional design
            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>🔐 MyEventZ - Your Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 5px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
                    
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 20px 0; background-color: #ffd3d3;">
                            <img src="https://myeventz.in/static/media/myeventzsecond.bdc23db9122747d166bf.png" alt="MyEventZ Logo" style="display: block; width: 150px">
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td align="center" style="padding: 30px 20px; background-color: #fef3c7;">
                            <h1 style="font-size: 24px; color: #333333; margin: 0 0 15px 0;">
                                🔐 Secure Your Account
                            </h1>
                            <p style="font-size: 16px; color: #555555; margin: 0; line-height: 1.5;">
                                Use this verification code to complete your action on MyEventZ
                            </p>
                        </td>
                    </tr>

                    <!-- OTP Display -->
                    <tr>
                        <td align="center" style="padding: 30px 20px;">
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #dee2e6; margin: 0 auto; max-width: 400px;">
                                <p style="font-size: 16px; color: #6c757d; margin: 0 0 15px 0; text-align: center;">
                                    Your OTP
                                </p>
                                <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #212529; border: 1px solid #e9ecef;">
                                    ${otp}
                                </div>
                                <p style="font-size: 14px; color: #6c757d; margin: 15px 0 0 0; text-align: center;">
                                    This code will expire in 5 minutes
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 30px 20px; background-color: #f4f4f4; border-top: 1px solid #e9ecef;">
                            <p style="font-size: 14px; color: #777777; margin: 0 0 10px 0;">Thank you for choosing <strong>MYEVENTZ</strong>.</p>
                            <p style="font-size: 14px; color: #777777; margin: 0 0 10px 0;">🎊 Celebrate. Connect. Enjoy Events Together.</p>
                            <br>
                            <p style="font-size: 13px; color: #999999; margin: 0;">&copy; 2025 MyEventz, All rights reserved.</p>
                            <p style="font-size: 13px; color: #999999; margin: 0;">Developed by: Taxfile Invosoft Pvt Ltd</p>
                            <p style="font-size: 13px; color: #999999; margin: 0;">Need help? Contact us: +91 95101 56789</p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

            const sentMailResult = await sendMail(Email, subject, html);

            if (sentMailResult) {
                return res.json({ ...successMessage("Message sent successfully!"), verify: Buffer.from(otp).toString('base64') });
            }
            return res.status(400).json({ ...errorMessage("Message not sent successfully!") });
        } else if (Mobile) {
            // Mobile OTP Logic
            const missingKeys = checkKeysAndRequireValues(['Mobile'], { ...req.body });
            if (missingKeys.length > 0) {
                return res.status(200).send(errorMessage(`Missing required fields: ${missingKeys.join(', ')}`));
            }
            
            if (Mobile.length !== 12 || Mobile.slice(0, 2) !== '91') {
                return res.status(200).send(errorMessage("Invalid Mobile Number!"));
            }

            const otp = Math.random().toString().substr(2, 6);
            const sentMessage = await sentMobileOTPMsg(Mobile.slice(2), otp);
            
            if (sentMessage) {
                return res.json({ ...successMessage("Message sent successfully!"), verify: Buffer.from(otp).toString('base64') });
            } else {
                return res.json({ ...errorMessage("Message not sent successfully!") });
            }
        } else {
            return res.status(400).json(errorMessage("Either Email or Mobile is required"));
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json(errorMessage(error?.message || error));
    }
}

module.exports = {
    otpVerificationHandler
}
