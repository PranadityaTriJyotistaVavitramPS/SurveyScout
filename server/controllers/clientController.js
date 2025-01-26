const {query} = require('../db/index');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//sign-in client
exports.signInClient = async(req,res) =>{
    const{nama_lengkap, password, jenis_kelamin, nomor_telepon, email, nik, perusahaan, jenis_usaha} = req.body
    console.log("request body:", req.body);

    try {
        const checkNIKClient = await query(`
            SELECT * 
            FROM client_table c
            INNER JOIN responden_table r ON r.nik = c.nik
            INNER JOIN surveyor_table s ON s.nik = c.nik
            WHERE c.nik=$1`,[nik]);
        const checkEmailClient = await query(`SELECT * FROM client_table WHERE email=$1`,[email]);
        if (checkNIKClient.rows.length > 0 || checkEmailClient.rows.length > 0) {
            return res.status(409).json({ message: "NIK atau email sudah digunakan" });
        }

        //ini buat enkripsi password kak
        const salt = await bcrypt.genSalt(10)
        const encrypted_password = await bcrypt.hash(password,salt)

        const result = await query(`INSERT INTO client_table 
            (nama_lengkap, password, jenis_kelamin, nomor_telepon, email, nik, perusahaan, jenis_usaha)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [nama_lengkap, encrypted_password, jenis_kelamin, nomor_telepon, email, nik, perusahaan, jenis_usaha]
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

//log-in client
exports.loginClient = async(req,res) =>{
    const {email,password} = req.body;
    console.log(req.body);

    try {
        const result = await query(`SELECT id_client,password FROM client_table WHERE email =$1`,[email]);
        const user = result.rows[0];

        if(result.rows.length === 0){
            return res.status(401).json({message:"Invalid Credentials"});
        }
        const isMatch = await bcrypt.compare(password,user.password);

        if(!isMatch){
            return res.status(401).json({message:"Invalid Credentials"});
        }

        const payload = {id_client: user.id_client};
        const secretKey = process.env.JWT_SECRET
        const token = jwt.sign(payload,secretKey,{expiresIn:'2h'});

        res.status(200).json({
            status:"login sukses",
            data:{...payload,token}
        });


    } catch (error) {
        console.error("Error terjadi ketika melakukan login, perhatikan apakah password atau email benar",error);
        return res.status(500).json({message:"Internal Server Error"});
        
    }

}

//mendapatkan data client
exports.getClient = async(req,res) => {
    const{id_client} = req.body
    try {
        const result = await query(`SELECT * FROM client_table WHERE id_client = $1`,[id_client]);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User Not Found"
            });
        }

        res.status(200).json({
            message:"success",
            data:result.rows[0]
        })
        
    } catch (error) {
        console.error("Error ketika menggambil data client",error);
        return res.status(500).json({
            message:"Internal Server Error"
        })
    }
    
}

//user melakukan update profil

//menghapus client
exports.deleteAccount = async(req,res) => {
    const{id_client} = req.body

    try {
        const result = await query(`DELETE FROM client_table WHERE id = $1`,[id_client])
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"User Not Found"
            })
        }

        res.status(200).json({
            message:"succes",
        })
    } catch (error) {
        
    }
}

