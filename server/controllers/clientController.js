const {query} = require('../db/index');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {OAuth2Client} = require('google-auth-library');

const cli = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const dummyPayload = {
    email:'dummyuser@example.com',
    name:'dummy user',
}

exports.clientGoogleLogin = async(req,res) =>{
    const {idToken} = req.body
    const nikPlaceholder = '000000000000' + uuidv4().slice(0, 4);

    try {
        //pertama kita melakukan verifikasi Id token google terlebih dahulu kemudian mengambil data email dan nama_lengkap 
        const tiket = await cli.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = tiket.getPayload();
        // const payload = dummyPayload;
        const email = payload.email;
        const nama_lengkap = payload.name;
        const picture = payload.picture;

        //sudah dapet data itu, kita cek ada apa nggak di database
        const result = await query(`SELECT email FROM client_table WHERE email = $1`,[email]);
        let user = result.rows[0];

        //kalau client masih belum ada, gas buatin akunnya masukin datanya selain email sama nama_lengkap dummy dulu aja penting memenuhi constraint
        if(!user){
            const createClientGoogle = await query(`
                INSERT INTO client_table
                (nama_lengkap, password, jenis_kelamin, nomor_telepon, email, nik, perusahaan, jenis_usaha,profile_picture) 
                VALUES($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING *`
            ,[
                nama_lengkap,
                'temp_password',
                'unknown',
                '000000000000000',
                email,
                nikPlaceholder,
                '',
                'unknown',
                picture
            ]);
            user = createClientGoogle.rows[0];
        }

        //json web token untuk sesi login
        const token = jwt.sign({id_client:user.id_client},process.env.JWT_SECRET);

        res.status(200).json({
            message:'login sukses',
            token,
        })


    } catch (error) {
        console.error('Error during Google login:', error);
        res.status(401).json({ message: 'Invalid Google ID Token' });   
    }

}

exports.updateClientProfile = async(req,res) =>{
    const{id_client,nik,nama_lengkap,email,password, jenis_kelamin, nomor_telepon, perusahaan, jenis_usaha, nomor_rekening}= req.body

    try {
        //menentukan field apa saja yang perlu di update
        const updatedFields={};

        if(nik) updatedFields.nik= nik;
        if(nama_lengkap) updatedFields.nama_lengkap = nama_lengkap;
        if(email) updatedFields.email = email;
        if(jenis_kelamin) updatedFields.jenis_kelamin = jenis_kelamin;
        if(nomor_telepon) updatedFields.nomor_telepon = nomor_telepon;
        if(perusahaan) updatedFields.perusahaan = perusahaan;
        if(jenis_usaha) updatedFields.jenis_usaha = jenis_usaha
        if(nomor_rekening) updatedFields.nomor_rekening = nomor_rekening
        if(password) {
            //lakukan hash password ulang apabila ingin melakukan update password
            const salt = await bcrypt.genSalt(10);
            const encrypted_password = await bcrypt.hash(password,salt);
            updatedFields.password = encrypted_password;
        }

        //kita buat supaya field yang ingin di update aja yang bakal masuk di query (intinya biar dinamis)
        const setFields = Object.keys(updatedFields).map((key,index) => `${key}=$${index+1}`).join(',');
        const values = Object.values(updatedFields);

        //gas update
        const result = await query(`
            UPDATE client_table SET ${setFields} WHERE id_client= $${values.length + 1} RETURNING *
            `,[...values,id_client]
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

//sign-in client
exports.signInClient = async(req,res) =>{
    const{nama_lengkap, password, jenis_kelamin, nomor_telepon, email, nik, perusahaan, jenis_usaha, nomor_rekening} = req.body
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

//menghapus client
exports.deleteAccount = async(req,res) => {
    const{id_client} = req.body

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

