const firebaseAdmin = require('firebase-admin');
const { query } = require('../db');  // Pastikan Anda sudah menghubungkan ke PostgreSQL
const jwt = require('jsonwebtoken');
const teskey = require('/etc/secrets/surveyscout-9146c-firebase-adminsdk-fbsvc-dbeae7a40f.json')


// Inisialisasi Firebase Admin SDK
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(teskey),
});
console.log('Firebase Admin SDK initialized successfully');

exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;  
  console.log('Received ID Token:', idToken);

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    console.log('Token expires at:', new Date(decodedToken.exp * 1000));
    const email = decodedToken.email;
    const picture = decodedToken.picture;

    const result = await query('SELECT * FROM users_table WHERE email = $1', [email]);
    let user = result.rows[0];
    

    if (!user) {
      const insertUser = await query(`INSERT INTO users_table (email,profile_picture) VALUES ($1,$2) RETURNING *`,[email,picture]);
      user = insertUser.rows[0];
    }
    const token = jwt.sign({id_user:user.id_user, email: user.email, role: user.role || null }, process.env.JWT_SECRET);

    const checkIfUserExist = await query(`
        SELECT *
        FROM responden_table r
        WHERE r.email = $1
          OR EXISTS (SELECT 1 FROM client_table c WHERE c.email = $1)
          OR EXISTS (SELECT 1 FROM surveyor_table s WHERE s.email = $1)`,[email]
    );

    if(checkIfUserExist.rows.length > 0){
        const {role} =user;
        res.status(200).json({
            message: 'sukses melakukan log-in',
            status:'1',
            token,
            role
          });      
    }else{
        res.status(200).json({
            message: 'sukses melakukan sign-in, silahkan lanjut pengisian data',
            status:'0',
            token
          });      
    }

  } catch (error) {
    console.error('Error verifying Google token:', error);
    res.status(401).json({ message: 'Invalid Google ID Token' });
  }
};


exports.selectRole = async (req, res) => {
    const {role} = req.body;  
    const {email} = req.user
    try {
      // Verifikasi token JWT yang diterima
      const result = await query('SELECT * FROM users_table WHERE email = $1', [email]);
      let user = result.rows[0];
  
      if (!user) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }
  
      // Update role pengguna di tabel users
      const updateResult = await query(
        'UPDATE users_table SET role = $1 WHERE email = $2 RETURNING *',
        [role, email]
      );
      user = updateResult.rows[0];
  
      res.status(200).json({
        message: 'Role berhasil diperbarui',
        user,
      });
  
    } catch (error) {
      console.error('Error selecting role:', error);
      res.status(401).json({ message: 'Invalid Token or Role selection failed' });
    }
  };