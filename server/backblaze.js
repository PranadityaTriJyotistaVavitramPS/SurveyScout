const BackblazeB2 = require('backblaze-b2');

// Konfigurasi Backblaze B2
const b2 = new BackblazeB2({
  applicationKeyId: process.env.B2_KEY_ID, // Key ID dari Backblaze
  applicationKey: process.env.B2_APPLICATION_KEY, // Application Key dari Backblaze
});

// Fungsi untuk otorisasi akun
const authorizeB2 = async () => {
  try {
    const response = await b2.authorize(); // Langkah pertama otorisasi
    console.log('Backblaze B2 authorized successfully');
    console.log(response.data);
    return response;
  } catch (error) {
    console.error('Authorization failed:', error.response?.data || error.message);
    throw error;
  }
};

// Fungsi untuk mendapatkan URL upload
const getUploadUrl = async (bucketId) => {
  try {
    const response = await b2.getUploadUrl({ bucketId });
    console.log('Upload URL retrieved successfully');
    return response.data; // Mengembalikan uploadUrl dan authorizationToken
  } catch (error) {
    console.error('Error getting upload URL:', error.message);
    throw error;
  }
};

module.exports = { b2, authorizeB2, getUploadUrl };
