const CryptoJS = require("crypto-js");
const { errorMessage } = require("../common/main");
const { CRPTO_SECRET_FOR_RAZORPAY, CRPTO_SECRET_FOR_EASEBUZZ, CRPTO_SECRET_FOR_EASEBUZZ_VERIFICATION } = require("../common/variable");
// In production, use process.env.SECRET_KEY
const SECRET_KEY = "GLOBALMYEVENTZ";

// Encrypt
const encryptData = (plainText) => {
  return CryptoJS.AES.encrypt(plainText, SECRET_KEY).toString();
};

// Decrypt
const decryptData = (encryptedText) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed", error);
    return null;
  }
};

const paymentDecryptData = (encryptedText, secretKey) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed", error);
    return null;
  }
};

const encryptCrptoAPI = (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json(errorMessage("Missing data for encryption"));

  const encrypted = encryptData(data);
  res.json({ encrypted });
}

const decryptCrptoAPI = (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json(errorMessage("Missing data for decryption"));

  const decrypted = decryptData(data);
  if (!decrypted) {
    return res.status(500).json(errorMessage("Decryption failed, possibly due to incorrect key or corrupted data!"));
  }

  res.json({ decrypted });
}


const paymentEncryptData = (req, res) => {
  try {
    const { data, secretKey } = req.body;

    if (!data || !secretKey) {
      return res.status(400).json({ error: "Missing data or secretKey for encryption" });
    }

    let sK;
    if (secretKey === "CRPTO_SECRET_FOR_RAZORPAY") {
      sK = CRPTO_SECRET_FOR_RAZORPAY;
    } else if (secretKey === "CRPTO_SECRET_FOR_EASEBUZZ") {
      sK = CRPTO_SECRET_FOR_EASEBUZZ;
    } else if (secretKey === "CRPTO_SECRET_FOR_EASEBUZZ_VERIFICATION") {
      sK = CRPTO_SECRET_FOR_EASEBUZZ_VERIFICATION;
    } else {
      return res.status(400).json({ error: "Invalid secretKey identifier" });
    }

    // Always stringify the payload before encrypting
    const ciphertext = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      sK
    ).toString();

    return res.status(200).json({ data: ciphertext });
  } catch (error) {
    console.error("Encryption failed", error);
    return res.status(500).json({ error: "Encryption failed", details: error.message });
  }
};


module.exports = {
  encryptCrptoAPI,
  decryptCrptoAPI,
  paymentDecryptData,
  paymentEncryptData
}
