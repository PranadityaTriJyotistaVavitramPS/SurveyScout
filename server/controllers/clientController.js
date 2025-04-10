const {query} = require('../db/index');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
const {uploadPictureFile,getFileNameFromURL,deleteFileFromGoogleStorage} = require('./uploadFile.js');


//sign-in client
exports.signInClient = async(req,res) =>{
    const{nama_lengkap,jenis_kelamin,tanggal_lahir,nomor_telepon,nik,nama_bank,nomor_rekening,
        nama_perusahaan,jenis_usaha,pin_akses
    } = req.body
    const id_user = req.user.id_user;

    try {
        const checkNIKClient = await query(`
            SELECT *
            FROM client_table c
            WHERE c.nik = $1
            OR EXISTS (SELECT 1 FROM responden_table r WHERE r.nik = c.nik)
            OR EXISTS (SELECT 1 FROM surveyor_table s WHERE s.nik = c.nik)`,[nik]
        )
        if (checkNIKClient.rows.length > 0 ) {
            return res.status(409).json({ message: "NIK sudah digunakan" });
        }

        //format tanggal lahir
        const formatDate = moment.tz(tanggal_lahir,'DD MMMM YYYY','Asia/Jakarta').format('YYYY-MM-DD');
    


        //ngambil profile picture dan email
        const pictureEmailClient = await query(`SELECT profile_picture,email FROM users_table WHERE id_user = $1`,[id_user])
        const {profile_picture, email} = pictureEmailClient.rows[0];

        const result = await query(`INSERT INTO client_table 
            (id_client, pin_akses,nama_lengkap, jenis_kelamin, nomor_telepon, email, nik, 
            nama_perusahaan, jenis_usaha,nomor_rekening,profile_picture, nama_bank, tanggal_lahir)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [id_user, pin_akses, nama_lengkap, jenis_kelamin, nomor_telepon, email, nik, nama_perusahaan, jenis_usaha,
                nomor_rekening, profile_picture, nama_bank,formatDate
            ]
        );

        res.status(201).json({ 
            message:"client account created",
            data:result.rows[0],
        })
        
    } catch (error) {
        console.error(`Error terjadi ketika melakukan Sign-In:`,error);
        return res.status(500).json({ message: "Internal Server Error"});   
    }
};


const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');  // Simpan sementara di folder uploads
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);  // Menambahkan timestamp di nama file
    }
  });
  
const upload = multer({ storage: multerStorage });

exports.uploadProfileImage = upload.single('profile_picture');

exports.updateClientProfile = async(req,res) =>{
    const {nik,nama_lengkap,jenis_kelamin, nomor_telepon, nama_perusahaan, jenis_usaha, nomor_rekening,nama_bank,
        tanggal_lahir
    }= req.body
    const profile_picture = req.file;
    const {id_user,email} = req.user; 

    try {
        //menentukan field apa saja yang perlu di update
        const updatedFields={};

        if(nik) updatedFields.nik= nik;
        if(nama_lengkap) updatedFields.nama_lengkap = nama_lengkap;
        if(email) updatedFields.email = email;
        if(jenis_kelamin) updatedFields.jenis_kelamin = jenis_kelamin;
        if(nomor_telepon) updatedFields.nomor_telepon = nomor_telepon;
        if(nama_perusahaan) updatedFields.nama_perusahaan = nama_perusahaan;
        if(jenis_usaha) updatedFields.jenis_usaha = jenis_usaha
        if(nomor_rekening) updatedFields.nomor_rekening = nomor_rekening
        if(nama_bank) updatedFields.nama_bank = nama_bank;
        if(tanggal_lahir){
            const formatDate = moment.tz(tanggal_lahir,'DD MMMM YYYY','Asia/Jakarta').format('YYYY-MM-DD');
            updatedFields.tanggal_lahir = formatDate;
        } 
        const currentProfilePicture = await query(`SELECT profile_picture FROM client_table WHERE id_client = $1`, [id_user]);
        const oldFileUrl = currentProfilePicture.rows[0]?.profile_picture;

        if(profile_picture){
            const filePath = await uploadPictureFile(profile_picture); // filePath adalah URL atau path file yang diupload
            updatedFields.profile_picture = filePath;

            if(oldFileUrl){
                const fileName = getFileNameFromURL(oldFileUrl);
                await deleteFileFromGoogleStorage(fileName)
            }
        }
        //kita buat supaya field yang ingin di update aja yang bakal masuk di query (intinya biar dinamis)
        const setFields = Object.keys(updatedFields).map((key,index) => `${key}=$${index+1}`).join(',');
        const values = Object.values(updatedFields);

        //gas update
        const result = await query(`
            UPDATE client_table SET ${setFields} WHERE id_client= $${values.length + 1} RETURNING *
            `,[...values,id_user]
        )
        res.status(201).json({
            message:'client data successfully updated',
            data: result.rows[0]
        })
        
    } catch (error) {
        console.error("Internal Server Error ketike melakukan update client profile", error.message);
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
exports.getClient = async(req,res) => {
    const id_client = req.user.id_user
    try {
        const result = await query(`SELECT * FROM client_table WHERE id_client = $1`,[id_client]);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User Not Found"
            });
        }

        const clientData = result.rows[0];
        const {tanggal_lahir} = clientData;
        const formatedTanggalLahir = formatDate(tanggal_lahir)


        res.status(200).json({
            message:"success",
            data:{
                ...clientData,tanggal_lahir:formatedTanggalLahir
            }
        })
        
    } catch (error) {
        console.error("Error ketika menggambil data client",error);
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

