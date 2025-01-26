const express = require('express');
const multer = require('multer'); // Untuk menangani file upload
const { b2, authorizeB2, getUploadUrl } = require('../backblaze');
const router = express.Router();

// Konfigurasi multer untuk menyimpan file di memory
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint untuk upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { originalname, buffer } = req.file; // File dari form-data
    console.log(`Uploading file: ${originalname}`);

    // 1. Authorize akun ke Backblaze
    await authorizeB2();

    // 2. Dapatkan URL upload spesifik untuk bucket
    const uploadUrlResponse = await getUploadUrl(process.env.B2_BUCKET_ID);
    const uploadUrl = uploadUrlResponse.uploadUrl;
    const authToken = uploadUrlResponse.authorizationToken;

    // 3. Upload file ke Backblaze
    const uploadResponse = await b2.uploadFile({
      uploadUrl,
      uploadAuthToken: authToken,
      fileName: originalname,
      data: buffer,
    });

    const fileUrl = `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME}/${originalname}`;

    res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl, // URL file untuk diakses
      uploadData: uploadResponse.data,
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({
      message: 'File upload failed',
      error: error.message,
    });
  }
});

module.exports = router;
