const {query} = require('../db/index');
const midtransClient = require('midtrans-client');
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
const {uploadRespondenAnswer,deleteFileFromGoogleStorage,getFileNameFromURL} = require('./uploadFile')
const {formatDeadline} = require('./surveyController');

//membuat draft respond
exports.createRespondDraft = async(req,res) =>{
    const{nama_proyek,deskripsi_proyek, tenggat_pengerjaan, 
        lokasi, kompensasi, metode_survey, 
        keahlian, jumlah_responden, tugas, tenggat_pendaftaran, rentang_usia,hobi,pendidikan, pekerjaan, status_perkawinan, 
        lokasi_responden
    } = req.body

    console.log(req.body)

    const id_client = req.user.id_user

    try {
        //membuat order_id untuk respond
        const order_id = `RESPOND-${Date.now()}`;

        
        const formatPengerjaanDate = moment.tz(tenggat_pengerjaan,'HH:mm, DD MMMM YYYY', 'Asia/Jakarta');
        const formattedPengerjaanDate = formatPengerjaanDate.format('YYYY-MM-DD HH:mm:ss');

        const formatPendaftaranDate = moment.tz(tenggat_pendaftaran,'HH:mm, DD MMMM YYYY', 'Asia/Jakarta');
        const formattedPendaftaranDate = formatPendaftaranDate.format('YYYY-MM-DD HH:mm:ss');
        const usiaArray = Array.isArray(rentang_usia) ? rentang_usia : rentang_usia.split(",");
        const hobiArray = Array.isArray(hobi) ? hobi : hobi.split(",");
        //memasukkan ke draft respond
        const draft = await query(`INSERT INTO respond_draft_table 
            (id_client,
            nama_proyek,
            deskripsi_proyek, 
            tenggat_pengerjaan, 
            lokasi, 
            kompensasi, 
            metode_survey, 
            status, 
            keahlian,
            jumlah_responden,
            order_id,
            status_task,
            tenggat_pendaftaran,
            tugas,
            rentang_usia,
            hobi,
            pendidikan,
            pekerjaan,
            status_perkawinan,
            lokasi_responden) 
            VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,'draft',$11,$12,$13::INTEGER[],$14::VARCHAR[],$15,$16,$17,$18) RETURNING *
        `,[id_client,nama_proyek,deskripsi_proyek,formattedPengerjaanDate,lokasi,kompensasi,metode_survey,keahlian,
            jumlah_responden,order_id,formattedPendaftaranDate,tugas,usiaArray,hobiArray,pendidikan,pekerjaan,status_perkawinan,lokasi_responden
        ])

        res.status(201).json({
            message:"Draft berhasil dibuat",
            data: draft.rows[0]
        })
        
    } catch (error) {
        console.error("error ketika membuat draft respond", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}


//membuat pembayaran
exports.createRespondPayment = async(req,res) =>{
    const{id_draft} = req.params

    try {
        //mengambil data dari draft
        const draftData = await query(`SELECT order_id, kompensasi, id_client FROM respond_draft_table WHERE id_draft =$1`,[id_draft]);
        if(draftData.rows.length === 0){
            return res.status(404).json({
                message:"draft tidak ditemukan atau id_draft salah"
            })
        }

        const respond = draftData.rows[0];
        const {id_client,order_id, kompensasi} = respond;
        const total_kompensasi = parseFloat(kompensasi) + 5000;

        //mengambil data dari client
        const clientData = await query(`SELECT email,nomor_telepon FROM client_table WHERE id_client =$1`,[id_client]);
        if(clientData.rows.length === 0){
            return res.status(404).json({
                message:"client tidak ditemukan atau id_client salah"
            })
        }

        const client = clientData.rows[0];
        const { email, nomor_telepon } = client;
        const phone_number = nomor_telepon || "0000000000";

        // Check if payment with the same order_id and 'failed' status exists
        const checkOrderId = await query(`SELECT * FROM payment_table WHERE order_id = $1 AND status_payment = 'failed'`, [order_id]);
        let end_order_id = '';
        
        if (checkOrderId.rows.length === 1) {
            const new_order_id = `RESPOND-${Date.now()}`;
            end_order_id = new_order_id;
            
            await query(`UPDATE respond_draft_table SET order_id = $1 WHERE order_id = $2`, [new_order_id, order_id]);

            await query(`DELETE FROM payment_table WHERE order_id = $1`, [order_id]);

            await query(`
                INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
                VALUES ($1, $2, $3, 'pending', 'pending')
            `, [new_order_id, total_kompensasi, id_client]);
        } else{
            end_order_id = order_id;
            await query(`
                INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
                VALUES ($1, $2, $3, 'pending', 'pending')
            `, [order_id, total_kompensasi, id_client]);
        }

        //buat transaksi midtrans
        let snap = new midtransClient.Snap({
            isProduction: false,
            serverKey: process.env.MIDTRANS_SERVER_KEY
        });
        console.log("ini order_id nya",end_order_id)
        let parameter = {
            "transaction_details": {
                'order_id': end_order_id,
                'gross_amount': total_kompensasi
            },
            "customer_details": {
                'email': email,
                'phone': phone_number
            }
        };

        const transaction = await snap.createTransaction(parameter);
        await query(`UPDATE respond_draft_table SET midtrans_link =$1,midtrans_token=$2,status_task='pembayaran' WHERE id_draft = $3`
            ,[transaction.redirect_url,transaction.token,id_draft]
        )

        res.status(201).json({
            message: "Pembayaran berhasil dibuat",
            order_id: end_order_id,
            snap_url: transaction.redirect_url,
            token:transaction.token
        });



    } catch (error) {
        console.error("Error saat membuat respond payment:",error);
        res.status(500).json({ message: "Internal Server Error" });
    }

}

//memindahkan draft ke tabel respond
exports.moveDraftToRespond = async(order_id) =>{
    try {
        //Ambil data dari `respond_draft_table`
        const draftData = await query(`
            SELECT * FROM respond_draft_table WHERE order_id = $1
        `, [order_id]);

        if (draftData.rows.length === 0) {
            console.log(`❌ Draft tidak ditemukan untuk Order ID: ${order_id}`);
            return;
        }

        const draft = draftData.rows[0];
        draft.hobi = typeof draft.hobi === 'string' ? draft.hobi.replace(/[{}"]/g, "").split(",") : draft.hobi;

        //Insert data ke `respond_table`
        await query(`
            INSERT INTO respond_table 
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, 
            metode_survey,keahlian, kompensasi,jumlah_responden,order_id,tenggat_pendaftaran,tugas,rentang_usia,hobi,
            pekerjaan,status_perkawinan,pendidikan,lokasi_responden)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *
        `,[
            draft.id_client, draft.nama_proyek, draft.deskripsi_proyek, 
            draft.tenggat_pengerjaan, draft.lokasi, draft.metode_survey, 
            draft.keahlian, draft.kompensasi,draft.jumlah_responden,draft.order_id,
            draft.tenggat_pendaftaran,draft.tugas,draft.rentang_usia,draft.hobi,
            draft.pekerjaan,draft.status_perkawinan,draft.pendidikan,draft.lokasi_responden
        ]);

        //Hapus dari `respond_draft_table`
        await query(`DELETE FROM respond_draft_table WHERE order_id = $1`, [order_id]);
        console.log(`✅ Draft respond dengan Order ID: ${order_id} berhasil dipindahkan ke respond_table`);

    } catch (error) {
        console.error("❌ Error saat memindahkan draft ke respond:", error);
    }
}

//mengambil semua task respond
exports.getAllRespondTask = async(req,res) =>{
    try {
        const result = await query(`SELECT * FROM respond_table`);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"no respond task found"
            })
        }

        const respondData = result.rows;

        res.status(200).json({
            status:"success",
            data:respondData
        })
    } catch (error) {
        console.error(" Error saat mengambil seluruh data respond task:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//menghapus sebuah task respond
exports.deleteARespond = async(req,res)=>{
    const{id_respond} = req.body;
    try {
        await query(`DELETE FROM respond_table WHERE id_respond = $1`,[id_respond]);
        res.status(200).json({
            message:"success deleting respond task"
        })
    } catch (error) {
        console.error("error saat menghapus sebuah respond task",error);
        res.status(500).json({
            message:"Internal Server Error",
        })
    }
}

function formatCreatedAt(timeline) {
    // Mengonversi string tanggal ke objek Date
    const timelineDate = new Date(timeline);
    
    // Format waktu menjadi jam dan menit (contoh: 13:40 WIB)
    const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    const formattedTime = timelineDate.toLocaleTimeString('id-ID', timeOptions);
    
    // Format tanggal menjadi (contoh: 12 Februari 2024)
    const dateOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    const formattedDate = timelineDate.toLocaleDateString('id-ID', dateOptions);
    
    
    return `Diunggah pada ${formattedTime} WIB, ${formattedDate}`;
}

const trackDeadlineStatus = (time) =>{
    const today = new Date();
    let timeDiff = time - today;
  
    if(timeDiff < 0){
        console.log('peringatan')
        return true
    }else{
        console.log('masih aman')
        return false
      }
  }
  
//menampilkan latar_belakang responden (nama_lengkap,jenis_kelamin, tanggal_lahir, kota_tinggal, pekerjaan, status_perkawinan, tingkat_pendidikan, hobi)
exports.respondenBackground = async(req,res) =>{
    const {id_responden} = req.body;
    try {
        const respondenDataQuery = await query(`
            SELECT nama_lengkap, jenis_kelamin, tanggal_lahir, lokasi, pekerjaan, status_perkawinan, tingkat_pendidikan, hobi
            FROM responden_table
            WHERE id_responden = $1
        `,[id_responden])

        const respondenData = respondenDataQuery.rows[0]
        if(!respondenData){
            return res.status(404).json({
                message:"Responden tidak ditemukan"
            })
        }

        res.status(200).json({
            message:"success",
            data: respondenData
        })
        
    } catch (error) {
        console.error("Error ketika mengambil latar belakang responden",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}

//responden ingin melihat projek yang mereka daftar
exports.respondenProjects = async(req,res) =>{
    const id_responden = req.user.id_user;

    try {
        //cari dari respondent_application id_respond apa saja yang didaftar oleh id_responden, ambil juga statusnya
        const checkRespondenProjects = await query(`
            SELECT id_respond, status
            FROM respondent_application
            WHERE id_responden = $1
        `,[id_responden])
        const projects = checkRespondenProjects.rows;
        if(projects.length === 0){
            return res.status(404).json({
                message:"Responden masih belum mendaftar ke suatu project"
            })
        }
        const projectCardDetail = Promise.all(
            projects.map(async(project)=>{
                const{id_respond,status} = project;

                const infoRespond = await query(`SELECT * FROM respond_table WHERE id_respond = $1`,[id_respond]);
                const {tenggat_pengerjaan} = infoRespond.rows[0]
                const deadline_status = trackDeadlineStatus(tenggat_pengerjaan)

                if(deadline_status){
                    await query(`
                      UPDATE respondent_application
                      SET status = 'deadline'
                      WHERE id_respond =$1  
                    `,[id_respond])
                }

                return {
                    id_respond:infoRespond.rows[0].id_respond,
                    nama_proyek:infoRespond.rows[0].nama_proyek,
                    lokasi:infoRespond.rows[0].lokasi,
                    kompensasi:infoRespond.rows[0].kompensasi,
                    status_responden:status
                }
            })
        )
        res.status(200).json({
            message:"success",
            data:{
                projectCardDetail
            }
        })
        
    } catch (error) {
        console.error("Error ketika responden ingin melihat projek mereka daftar",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}



//menampilkan jawaban yang telah dikumpulkan (client-side)
exports.showRespondenAnswers = async(req,res) =>{
    const id_respond = req.params
    try {
        //cari id_luaran dari respond ini terlebih dahulu
        const targetTabel = await query(`SELECT id_luaran FROM respond_table WHERE id_respond = $1`,[id_respond])
        const target = targetTabel.rows[0];

        const {id_luaran} = target;
        //tampilkan jawaban yang statusnya pending/pre-revisi
        const respondQueryAnswer = await query(`
            SELECT * 
            FROM luaran_respond 
            WHERE respond_id = $1
            AND status IN('pending','selesai')`
        ,[id_luaran])

        res.status(200).json({
            message:"success",
            data:respondQueryAnswer.rows
        })
        
    } catch (error) {
        console.error("Error ketika menampilkan jawaban responden",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}


//detail respond untuk umum
exports.getRespondDetail = async(req,res) =>{
    const {id_respond} = req.params;
    try {
        const result = await query(`SELECT * FROM respond_table WHERE id_respond =$1`,[id_respond])
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"respond not found"
            })
        }
        const respondDetail = result.rows[0];
        const {tenggat_pendaftaran, created_at} = respondDetail
        const formattedDeadlinePendaftaran = formatDeadline(tenggat_pendaftaran);
        const formattedDateCreatedAt = formatCreatedAt(created_at)

        res.status(200).json({
            message:"success",
            data: {
                ...respondDetail,
                tenggat_pendaftaran:formattedDeadlinePendaftaran,
                created_at:formattedDateCreatedAt
            }
        })
        
    } catch (error) {
        console.error("Error ketika mengambil detai respond untuk umum",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}


//detail respond untuk pendaftar
exports.getAppliedRespondDetail = async(req,res) =>{
    const {id_respond} = req.params;
    const id_responden = req.user.id_user
    try {
        //dapatkan info detail dari suatu respond
        const result = await query(`SELECT * FROM respond_table WHERE id_respond =$1`,[id_respond]);
        //cari tahu status user pada respond itu
        const status_responden_query = await query(`
            SELECT status 
            FROM respondent_application 
            WHERE id_responden =$1 AND id_respond =$2`
        ,[id_responden,id_respond])

        if(result.rows.length === 0){
            return res.status(404).json({
                message:"Respond tidak ditemukan"
            })
        }
        const respondDetail = result.rows[0];
        
        const formattedDeadline = formatDeadline(respondDetail.tenggat_pengerjaan);
        const formattedCreatedAt = formatCreatedAt(respondDetail.created_at);

        res.status(200).json({
            message:"success",
            data:{
                ...respondDetail,
                tenggat_pengerjaan:formattedDeadline,
                created_at:formattedCreatedAt
            }
        })
    } catch (error) {
        console.error("Error ketika mengambil detail respond untuk responden yang keterima",error);
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}

//responden ingin mengumpulkan bukti mereka telah menjawab (png);
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    console.log("MIME Type File: ", file.mimetype);
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);  
    } else {
        cb(new Error('Hanya file gambar yang diperbolehkan!'), false);  
    }
};

const upload = multer({ 
    storage: multerStorage, 
    fileFilter: fileFilter 
});

exports.uploadBukti = upload.single('bukti');

exports.submitRespondenAnswer = async(req,res) =>{
    const {id_respond} = req.params;
    const id_responden = req.user.id_user;
    const file_bukti = req.file

    try {
        if (!file_bukti) {
            return res.status(400).json({ message: "File bukti tidak ditemukan" });
        }
        const check_status_responden = await query(`
            SELECT status 
            FROM respondent_application 
            WHERE id_respond =$1 AND id_responden =$2`,
        [id_respond,id_responden])
        if (check_status_responden.rows.length === 0) {
            return res.status(404).json({ message: "Responden tidak ditemukan" });
        }
        const{status} = check_status_responden.rows[0]

        if(["ditolak","mendaftar"].includes(status)){
            return res.status(403).json({
                message:"Akses Ditolak"
            })
        }

        const outputTarget = await query(`SELECT id_luaran FROM respond_table WHERE id_respond =$1`,[id_respond])
        if (outputTarget.rows.length === 0) {
            return res.status(404).json({ message: "Data luaran tidak ditemukan" });
        }
        const {id_luaran} = outputTarget.rows[0]

        //isi jawaban dengan memasukkan id_responden
        if(["mengerjakan","ditinjau"].includes(status)){

            const bukti = await uploadRespondenAnswer(file_bukti)

            //Ketika mengumpulkan, status => pending di luaran_respond
            const result = await query(`
                INSERT into luaran_respond (respond_id,file_name,file,file_size,file_type,id_responden) 
                VALUES ($1,$2,$3,$4,$5,$6)`,
            [id_luaran,bukti.name,bukti.url,bukti.size,bukti.type,id_responden])

            //Ketika mengajukan jawaban, status=> ditinjau di respondent_application
            await query(`
                UPDATE respondent_application
                SET status = 'ditinjau'
                WHERE id_respond =$1 AND id_responden =$2
            `,[id_respond,id_responden])

            //Update status_task pada respond_table
            await query(`
                UPDATE respond_table
                SET status_task ='ditinjau'
                WHERE id_respond=$1    
            `,[id_respond])

            res.status(200).json({
                messsage:"berhasil mengumpulkan bukti jawaban responden",
                data:result.rows[0]
            })
        }
        
    } catch (error) {
        console.error("Error saat mengupload bukti:", error);
        res.status(500).json({ message: "Terjadi kesalahan saat upload bukti" });   
    }
}



//menerima jawaban responden (ubah status = 'selesai');
exports.accRespondenAnswer = async(req,res) =>{
    //id_respond & id_responden sebagai input
    const{id_respond} = req.params;
    const {id_responden} = req.body;
    try {
        //cari target luarannya dan jumlah_pendaftar dengan status selain ditolak dan mendaftar di respondent_application
        const targetLuaran = await query(`SELECT id_luaran,jumlah_responden FROM respond_table WHERE id_respond =$1`,[id_respond])
        if(targetLuaran.rows[0]){
            return res.status(404).json({
                message:"target Luaran tidak ditemukan"
            })
        }

        const {id_luaran,jumlah_responden} = targetLuaran.rows[0]
            
        //cari tahu dan ganti status pada luaran_respond di id_responden = x dan respond_id =x
        await query(`
            UPDATE luaran_respond 
            SET status ='selesai'
            WHERE id_responden=$1 AND respond_id=$2      
        `,[id_responden,id_luaran])

        //ganti status pada respondent_application = 'selesai'
        await query(`
            UPDATE respondent_application
            SET status='selesai'
            WHERE id_responden =$1 AND id_respond=$2   
        `,[id_responden,id_respond])

        //cek apabila status pada respondent_application ='selesai' berjumlah sama dengan jumlah_responden, maka status_task pada respond_table ='selesai'
        //cek jumlah responden yang memiliki status selesai 
        const checkRespondenSelesai = await query(`
            SELECT * 
            FROM respondent_application 
            WHERE status = 'selesai' AND id_respond =$1`,
        [id_respond])

        if(jumlah_responden === checkRespondenSelesai.rows.length){
            await query(`
                UPDATE respond_table
                SET status_task = 'selesai'
                WHERE id_respond =$1    
            `,[id_respond])
        }
    } catch (error) {
        console.error("Error ketika acc bukti dari responden ")
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}

//meminta responden revisi;
exports.revisiRespondenAnswer = async(req,res) =>{
    const{id_respond} = req.params;
    const{id_responden,tenggat_revisi,task_revisi} = req.body
    try {
        const outputTarget = await query(`SELECT id_luaran FROM respond_table WHERE id_respond =$1`,[id_respond])
        const status_RevisiQuery = await query(`
            SELECT status_revisi 
            FROM respondent_application 
            WHERE id_responden =$1 AND id_respond =$2
        `,[id_responden,id_respond])
        const {id_luaran} = outputTarget.rows[0];
        const {status_revisi} = status_RevisiQuery.rows[0]

        if(status_revisi == false){
            //ganti status_task pada respond_table kembali ke 'dikerjakan'
            await query(`
                UPDATE respond_table
                SET status_task = 'dikerjakan'
                WHERE id_respond =$1
            `)

            //masukkan tenggat_revisi dan task_revisi pada respondent_application, tujuan ? biar berbeda per responden
            await query(`
                INSERT INTO respondent_application (tenggat_revisi, task_revisi)
                VALUES ($1,$2)
                RETURNING *
            `,[tenggat_revisi,task_revisi])

            //status = 'mengerjakan' pada respondent_application dan status_revisi ='true'
            await query(`
                UPDATE respondent_application
                SET status_revisi = 'true',
                status='mengerjakan'    
            `)
            res.status(200).json({
                status:"1",
                message:"berhasil meminta revisi"
            })

        } else{
            res.status(400).json({
                status:"0",
                message:"Tidak dapat melakukan revisi, kesempatan revisi telah habis"
            })
        }

    } catch (error) {
        console.error("Error ketika meminta responden melakukan revisi",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
    }
}



//hapus jawaban responden
exports.deleteRespondAnswer = async(req,res) =>{
    const {respond_id} = req.body;
    const {id_luaran} = req.params;
    try {
      //hapus dulu dari google cloud console
      const currentFile = await query(`SELECT file FROM luaran_respond WHERE id_luaran = $1 AND respond_id =$2`,[id_luaran,respond_id])
  
      const oldFileUrl = currentFile.rows[0]?.file
      const fileName = getFileNameFromURL(oldFileUrl)
  
      console.log("oldFile Urlnya:",oldFileUrl);
      console.log("Filenamenya yang dihapus:",fileName);
  
      await deleteFileFromGoogleStorage(fileName)
      //dia ngehapus dari luaran_table id_luaran di respond_id ini
      await query(`DELETE FROM luaran_respond WHERE id_luaran =$1 AND respond_id =$2`,[id_luaran,respond_id])
      res.status(204).end();
      
    } catch (error) {
        console.error("Error ketika menghapus jawaban",error);
        res.status(500).json({
          message:"Internal Server Error"
        })
    }
  }


