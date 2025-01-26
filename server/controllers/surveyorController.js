const {query} = require('../db/index');
const bcrypt = require('bcryptjs')
const multer = require('multer');
const {b2, authorizeB2, getUploadUrl} = require('backblaze-b2');

//signIn Surveyor
exports.signInSurveyor = async(req,res) => {
    const{nama_lengkap, password, usia, jenis_kelamin, nomor_telepon, email, nik, domisili, nomor_rekening} = req.body
    const cv_ats = req.file

    try {
        const checkNIKSurveyor = await query(`
            SELECT * 
            FROM surveyor_table s
            INNER JOIN client_table c ON c.nik = s.nik
            INNER JOIN responden_table r ON r.nik = s.nik
            WHERE s.nik = $1    
        `,[nik])
        if(checkNIKSurveyor.rows.length > 0){
            return res.status(409).json({
                message:"NIK sudah digunakan"
            })

        }

        //enkripsi password
        const salt = await bcrypt.genSalt(10);
        const encrypted_password = await bcrypt.hash(password,salt);

        
        
    } catch (error) {
        
    }
}

//menampilkan data surveyor
//melakukan update data Surveyor
//menghapus akun Surveyor