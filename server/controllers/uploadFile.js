const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  keyFilename: './secret/surveyscout-450117-c90b322ee8e2.json',
});

const bucket = storage.bucket('surveyscout-bucket1');

exports.getSignedUrlForever = async (fileName) => {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: 'read',  // Akses read (baca)
      expires: Date.now() +250 * 365 * 24 * 60 * 60 * 1000,  // 250 tahun, khusus pp aja, kurang lebih ini public jadinya
    });

    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
};


exports.uploadCVFiles = async(file) => {
  try {   
    const destination = `curriculumvitae/${Date.now()}-${file.originalname}`; 
    await bucket.upload(file.path,{
      destination:destination,
    });

    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('Error deleting local file:', err);
      }
        console.log(`File ${file.path} deleted locally`);
      });

    console.log(`File uploaded to ${destination}`);
    const fileUrl = await exports.getSignedUrlForever(destination);

    return fileUrl
    
  } catch (error) {
      console.error('Error uploading file to google Cloud',error);
      throw new Error('Failed to upload file');
  }


}



exports.uploadPictureFile = async (file) => {
  try {
    const destination = `profilepictures/${Date.now()}-${file.originalname}`;

    await bucket.upload(file.path, {
      destination: destination,
    });

    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('Error deleting local file:', err);
      }
      console.log(`File ${file.path} deleted locally`);
    });

    console.log(`File uploaded to ${destination}`);

    // Dapatkan URL publik file yang telah di-upload
    const fileUrl = await exports.getSignedUrlForever(destination);

    // Kembalikan URL file yang telah di-upload
    return fileUrl;
  } catch (error) {
    console.error('Error uploading file to Google Cloud Storage:', error);
    throw new Error('Failed to upload file');
  }
};


//mendapatkan nama file
exports.getFileNameFromURL = (url) =>{
  const urlParts = new URL(url);
  const filePath = urlParts.pathname; 
  const fileName = filePath.substring(filePath.indexOf('/surveyscout-bucket1/')+'/surveyscout-bucket1/'.length);
  const decodeFileName = decodeURIComponent(fileName);
  return decodeFileName;
}


//menghapus file dari gsc
exports.deleteFileFromGoogleStorage = async(fileName) =>{
  try {
    const file = bucket.file(fileName); // Ambil file berdasarkan nama

    await file.delete(); // Hapus file dari bucket
    console.log(`File ${fileName} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting file from Google Cloud Storage:', error);
    throw new Error('Failed to delete file');
  }
}

