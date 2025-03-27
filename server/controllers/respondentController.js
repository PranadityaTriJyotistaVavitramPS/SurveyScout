const {query} = require('../db/index');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
const {uploadPictureFile,getFileNameFromURL,deleteFileFromGoogleStorage} = require('./uploadFile.js');


//sign-in responden
exports.signInResponden = async(req,res) =>{
    const{nama_lengkap,jenis_kelamin,tanggal_lahir,nomor_telepon,nik,nama_bank,nomor_rekening,domisili,
        hobi,status_perkawinan,tingkat_pendidikan, pekerjaan, pin_akses
    } = req.body
    const id_user = req.user.id_user;
    console.log(req.body);

    try {
        const checkNIKRespondent = await query(`
            SELECT *
            FROM responden_table r
            WHERE r.nik = $1
            OR EXISTS (SELECT 1 FROM client_table c WHERE c.nik = r.nik)
            OR EXISTS (SELECT 1 FROM surveyor_table s WHERE s.nik = r.nik)`,[nik]
        )
        if (checkNIKRespondent.rows.length > 0 ) {
            return res.status(409).json({ message: "NIK sudah digunakan" });
        }

        //format tanggal lahir
        const formatDate = moment.tz(tanggal_lahir,'DD MMMM YYYY','Asia/Jakarta').format('YYYY-MM-DD');
        const hobiArray = Array.isArray(hobi) ? hobi :hobi.split(',').map(item => item.trim());

        //ngambil profile picture dan email
        const pictureEmailResponden = await query(`SELECT profile_picture,email FROM users_table WHERE id_user = $1`,[id_user])
        const {profile_picture, email} = pictureEmailResponden.rows[0];

        const result = await query(`INSERT INTO responden_table 
            (id_responden,email,nama_lengkap,jenis_kelamin, tanggal_lahir, nomor_telepon, nik, nama_bank,nomor_rekening,domisili,hobi
            ,status_perkawinan,tingkat_pendidikan,pekerjaan,pin_akses,profile_picture)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::TEXT[],$12,$13,$14,$15,$16) RETURNING *`,
            [id_user,email,nama_lengkap,jenis_kelamin,formatDate,nomor_telepon,nik,nama_bank,nomor_rekening,domisili,hobiArray,
                status_perkawinan,tingkat_pendidikan,pekerjaan,pin_akses,profile_picture 
            ]
        );

        res.status(201).json({ 
            message:"respondent account created",
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

exports.updateRespondenProfile = async(req,res) =>{
    const {
    }= req.body
    const profile_picture = req.file;
    const {id_user} = req.user; 

    try {
        //menentukan field apa saja yang perlu di update
        const updatedFields={};

        if(nik) updatedFields.nik= nik;
        if(nama_lengkap) updatedFields.nama_lengkap = nama_lengkap;
        if(email) updatedFields.email = email;
        if(jenis_kelamin) updatedFields.jenis_kelamin = jenis_kelamin;
        if(nomor_telepon) updatedFields.nomor_telepon = nomor_telepon;
        if(nomor_rekening) updatedFields.nomor_rekening = nomor_rekening
        if(pin_akses) updatedFields.password = pin_akses;
        if(nama_bank) updatedFields.nama_bank = nama_bank;
        if(tanggal_lahir) updatedFields.tanggal_lahir = tanggal_lahir;
        if(status_perkawinan) updatedFields.status_perkawinan = status_perkawinan;
        if(domisili) updatedFields.domisili = domisili;
        if(tingkat_pendidikan) updatedFields = tingkat_pendidikan;
        if(pekerjaan) updatedFields.pekerjaan = pekerjaan;
        if(hobi) updatedFields.hobi = hobi
        if(keahlian) updatedFields.keahlian = keahlian

        const currentProfilePicture = await query(`SELECT profile_picture FROM responden_table WHERE id_responden = $1`, [id_user]);
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
            UPDATE responden_table SET ${setFields} WHERE id_responden= $${values.length + 1} RETURNING *
            `,[...values,id_user]
        )

        res.status(201).json({
            message:'responden data successfully updated',
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

//mendapatkan data responden
exports.getResponden = async(req,res) => {
    const id_responden = req.user.id_user
    try {
        const result = await query(`SELECT * FROM responden_table WHERE id_responden = $1`,[id_responden]);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User Not Found"
            });
        }

        const respondenData = result.rows[0];
        const {tanggal_lahir} = respondenData;
        const formatedTanggalLahir = formatDate(tanggal_lahir)


        res.status(200).json({
            message:"success",
            data:{
                ...respondenData,tanggal_lahir:formatedTanggalLahir
            }
        })
        
    } catch (error) {
        console.error("Error ketika menggambil data responden",error);
        return res.status(500).json({
            message:"Internal Server Error"
        })
    }
    
}

//menghapus responden
exports.deleteAccount = async(req,res) => {
    const id_responden = req.user.id_user
    try {
        await query(`DELETE FROM responden_table WHERE id_responden = $1`,[id_responden]);
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


//responden bookmarked suatu project
//menampilkan bookmarked responden



