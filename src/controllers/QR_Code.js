const QRCode = require('qrcode');
const { errorMessage } = require('../common/main');

const generateQRCode = async (req, res) => {
    const { Link } = req.query;

    if (!Link) {
        return res.status(400).send({ error: 'Link is required!' });
    }

    try {
        // Generate QR code as a Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(Link);

        // Send the full data URL as a JSON response
        res.json({ qrCodeDataUrl });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).send({ error: 'Could not generate QR code.' });
    }
};

const generateQRCodeImageView = async (req, res) => {
    const { Link } = req.query;
    if (!Link) {
        return res.status(400).send(errorMessage('Link is required!'));
    }
    try {
        // Generate QR code as a Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(Link);
        // Send the QR code as an image response
        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).send('Could not generate QR code.');
    }
}



module.exports = { generateQRCode, generateQRCodeImageView };