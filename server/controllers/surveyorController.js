const {query} = require('../db/index');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
const {uploadPictureFile,getFileNameFromURL,deleteFileFromGoogleStorage,uploadCVFiles} = require('./uploadFile.js');
const {generateOTP,getStoredOTP, verifyOTP} = require('./otpController.js')


// Konfigurasi multer storage
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Fungsi fileFilter untuk menentukan jenis file yang diterima
const fileFilter = (req, file, cb) => {
    console.log("MIME Type File: ", file.mimetype);
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);  
    } else {
        cb(new Error('Hanya file gambar dan PDF yang diperbolehkan!'), false);  
    }
};

// Instance multer untuk meng-upload satu file (foto atau CV)
const upload = multer({ 
    storage: multerStorage, 
    fileFilter: fileFilter 
});

exports.uploadSurveyorFiles = upload.fields([
    { name: 'file', maxCount: 1 },                // untuk CV
    { name: 'profile_picture', maxCount: 1 }      // untuk foto
  ]);

//sign-in Surveyor
exports.signInSurveyor = async(req,res) =>{
    console.log('Received body:', req.body);  // Log fields selain file
    console.log('Received file:', req.file);
    const file = req.files['file']?.[0];
    const id_user = req.user.id_user;
    const{nama_lengkap,jenis_kelamin,tanggal_lahir,nomor_telepon,nik,nama_bank,nomor_rekening,
        domisili,pin_akses,keahlian
    } = req.body
    try {
        const checkNIKSurveyor = await query(`
            SELECT *
            FROM surveyor_table s
            WHERE s.nik = $1
            OR EXISTS (SELECT 1 FROM responden_table r WHERE r.nik = s.nik)
            OR EXISTS (SELECT 1 FROM client_table c WHERE c.nik = s.nik)`,[nik]
        )
        if (checkNIKSurveyor.rows.length > 0 ) {
            return res.status(409).json({ message: "NIK sudah digunakan" });
        }
        //format tanggal lahir
        const formatDate = moment.tz(tanggal_lahir,'DD MMMM YYYY','Asia/Jakarta').format('YYYY-MM-DD');
        const keahlianArray = Array.isArray(keahlian) ? keahlian : keahlian.split(',');
        //ngambil profile picture dan email
        const pictureEmailClient = await query(`SELECT profile_picture,email FROM users_table WHERE id_user = $1`,[id_user])
        const {profile_picture, email} = pictureEmailClient.rows[0];
        const cv_ats = await uploadCVFiles(file);

        const result = await query(`INSERT INTO surveyor_table 
            (id_surveyor, nama_lengkap, jenis_kelamin, tanggal_lahir, nomor_telepon, nik, nama_bank,nomor_rekening,pin_akses,keahlian,domisili
            ,cv_ats,profile_picture, email)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::TEXT[],$11,$12,$13,$14) RETURNING *`,
            [
                id_user,nama_lengkap,jenis_kelamin,formatDate,nomor_telepon,nik,nama_bank,nomor_rekening,pin_akses,keahlianArray,domisili,cv_ats,
                profile_picture,email
            ]
        );

        res.status(201).json({ 
            message:"surveyor account created",
            data:result.rows[0],
        })
        
    } catch (error) {
        console.error(`Error terjadi ketika melakukan Sign-In:`,error);
        return res.status(500).json({ message: "Internal Server Error"});   
    }
};



exports.updateSurveyorProfile = async(req,res) =>{
    const {nomor_telepon,domisili,nomor_rekening,pin_akses,nama_bank, keahlian}= req.body
    const profile_picture = req.files['profile_picture']?.[0];
    const cv_ats = req.files['file']?.[0]
    const {id_user,email} = req.user; 

    try {
        const updatedFields={};

        if(domisili) updatedFields.domisili = domisili;
        if(nomor_telepon) updatedFields.nomor_telepon = nomor_telepon;
        if(nomor_rekening) updatedFields.nomor_rekening = nomor_rekening
        if(pin_akses){
            //masukkan ke generateOTP
            generateOTP(email,req,res);
            //kita ambil otpnya menggunakan getOTP
            const otp= await getStoredOTP(email);
            //validasi langsung 
            const verifiedOTP = await verifyOTP(email,otp)
            if(verifiedOTP == true){
                updatedFields.pin_akses = pin_akses
            } else {
                return res.status(403).json({
                    message:"kode otp salah"
                })
            }
        }
        if(nama_bank) updatedFields.nama_bank = nama_bank;
        if(keahlian) updatedFields.keahlian = keahlian;
        if(profile_picture){    
            const currentProfilePicture = await query(`SELECT profile_picture FROM surveyor_table WHERE id_surveyor = $1`, [id_user]);
            const oldFileUrl = currentProfilePicture.rows[0]?.profile_picture;
            const filePath = await uploadPictureFile(profile_picture); // filePath adalah URL atau path file yang diupload
            updatedFields.profile_picture = filePath;

            if(!oldFileUrl.startsWith('https://lh3.googleusercontent.com')){
                const fileName = getFileNameFromURL(oldFileUrl);
                await deleteFileFromGoogleStorage(fileName)
            }
        }

        if(cv_ats){
            //cari file url yang lama
            const currentCV = await query(`SELECT `)
            const filePath = await uploadCVFiles(cv_ats);
            updatedFields.cv_ats = filePath



        }
        //kita buat supaya field yang ingin di update aja yang bakal masuk di query (intinya biar dinamis)
        const setFields = Object.keys(updatedFields).map((key,index) => `${key}=$${index+1}`).join(',');
        const values = Object.values(updatedFields);

        //gas update
        const result = await query(`
            UPDATE surveyor_table SET ${setFields} WHERE id_surveyor= $${values.length + 1} RETURNING *
            `,[...values,id_user]
        )

        res.status(201).json({
            message:'surveyor data successfully updated',
            data: result.rows[0]
        })
        
    } catch (error) {
        console.error("Internal Server Error ketike melakukan update surveyor profile", error.message);
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}

const formatDate = (dateString) => {
    
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('id-ID', options);
  };

//mendapatkan data client
exports.getSurveyor = async(req,res) => {
    const id_surveyor = req.user.id_user
    try {
        const result = await query(`SELECT * FROM surveyor_table WHERE id_surveyor = $1`,[id_surveyor]);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User Not Found"
            });
        }

        const surveyorData = result.rows[0];
        const {tanggal_lahir} = surveyorData;
        const formatedTanggalLahir = formatDate(tanggal_lahir)


        res.status(200).json({
            message:"success",
            data:{
                ...surveyorData,tanggal_lahir:formatedTanggalLahir
            }
        })
        
    } catch (error) {
        console.error("Error ketika menggambil data surveyor",error);
        return res.status(500).json({
            message:"Internal Server Error"
        })
    }
    
}

//menghapus client
exports.deleteAccount = async(req,res) => {
    const id_client = req.user.id_user
    try {
        await query(`DELETE FROM client_table WHERE id_client = $1`,[id_client]);
        res.status(200).json({
            message:"succes",
        })
    } catch (error) {
        console.error("Error ketika menggambil data client",error);
        return res.status(500).json({
            message:"Internal Server Error"
        })
    }
}