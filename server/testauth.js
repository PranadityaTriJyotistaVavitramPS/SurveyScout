const BackblazeB2 = require('backblaze-b2');
require('dotenv').config();

const b2 = new BackblazeB2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

const testAuthorization = async () => {
  try {
    const response = await b2.authorize();
    console.log('Authorization successful!');
    console.log(response.data); // Menampilkan token otorisasi
  } catch (error) {
    console.error('Authorization failed:', error.response?.data || error.message);
  }
};

testAuthorization();
