const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
multer = require('multer');
const {uploadSurveyorAnswer} = require('./uploadFile')
const {sendNotificationtoAdmin,deleteFileFromGoogleStorage,getFileNameFromURL} = require('./otpController')


//memasukkan task yang telah dibuat ke draft (belum dilakukan pembayaran)
exports.createSurveyDraft = async(req,res) =>{
    const{nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, alamat, keahlian, 
        kompensasi,tipe_hasil
    } = req.body
    const id_client = req.user.id_user;
    console.log("ini kompensasinya",kompensasi)

    try {
        //ngebuat order_id
        const order_id = `SURVEY-${Date.now()}`;

        const keahlianArray = Array.isArray(keahlian) ? keahlian : JSON.parse(keahlian);
        const tipeHasilArray = Array.isArray(tipe_hasil) ? tipe_hasil : tipe_hasil.split(',');

        const formatDate = moment.tz(tenggat_pengerjaan,'HH:mm, DD MMMM YYYY', 'Asia/Jakarta');
        const formattedDate = formatDate.format('YYYY-MM-DD HH:mm:ss');

        //menyimpan data survey di draft
        const draft = await query(`
            INSERT INTO survey_draft_table 
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, keahlian, kompensasi, status_pembayaran, order_id, tipe_hasil)
            VALUES ($1,$2,$3,$4,$5,$6::TEXT[],$7,'pending',$8,$9::TEXT[]) RETURNING *`,
            [id_client,nama_proyek,deskripsi_proyek,formattedDate,lokasi,keahlianArray,kompensasi,order_id,tipeHasilArray]
        )

        res.status(201).json({
            message:"Draft berhasil dibuat",
            data: draft.rows[0]
        })

    } catch (error) {
        console.error("Error membuat draft survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//membuat pembayaran
exports.createSurveyPayment = async (req, res) => {
  const { id_draft } = req.params;
  try {
      // Get data from survey draft table
      const draftData = await query(`SELECT id_client, kompensasi, order_id FROM survey_draft_table WHERE id_draft = $1`, [id_draft]);
      if (draftData.rows.length === 0) {
          return res.status(404).json({
              message: "Draft not found"
          });
      }
      const survey = draftData.rows[0];
      const { id_client, kompensasi, order_id } = survey;
      const total_kompensasi = parseFloat(kompensasi) + 5000;

      // Get data from client table
      const clientData = await query(`SELECT email, nomor_telepon FROM client_table WHERE id_client = $1`, [id_client]);
      if (clientData.rows.length === 0) {
          return res.status(404).json({
              message: "Client not found"
          });
      }

      const client = clientData.rows[0];
      const { email, nomor_telepon } = client;
      const phone_number = nomor_telepon || "0000000000";

      // Check if payment with the same order_id and 'failed' status exists
      const checkOrderId = await query(`SELECT * FROM payment_table WHERE order_id = $1 AND status_payment = 'failed'`, [order_id]);
      let end_order_id = '';
      console.log("ini panjangnyaa",checkOrderId.rows.length)
      if (checkOrderId.rows.length === 1) {
          const new_order_id = `SURVEY-${Date.now()}`;
          end_order_id = new_order_id;
          
          await query(`UPDATE survey_draft_table SET order_id = $1 WHERE order_id = $2`, [new_order_id, order_id]);

          await query(`DELETE FROM payment_table WHERE order_id = $1`, [order_id]);

          await query(`
              INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
              VALUES ($1, $2, $3, 'pending', 'pending')
          `, [new_order_id, total_kompensasi, id_client]);

      } else if (checkOrderId.rows.length === 0) {
          // If no failed payment exists, use the current order_id
          end_order_id = order_id;
          await query(`
              INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
              VALUES ($1, $2, $3, 'pending', 'pending')
          `, [order_id, total_kompensasi, id_client]);
      }

      // Create a new transaction in Midtrans
      let snap = new midtransClient.Snap({
          isProduction: false,
          serverKey: process.env.MIDTRANS_SERVER_KEY
      });

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

      // Update the draft with the new Midtrans token and link
      await query(`
          UPDATE survey_draft_table 
          SET midtrans_link = $1, midtrans_token = $2, status_task = 'pembayaran' 
          WHERE id_draft = $3
      `, [transaction.redirect_url, transaction.token, id_draft]);

      // Send response with new payment URL and token
      res.status(201).json({
          message: "Pembayaran berhasil dibuat",
          order_id: end_order_id,
          snap_url: transaction.redirect_url,
          token: transaction.token
      });

  } catch (error) {
      console.error("Error creating survey payment:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
};


//membuat sebuah task (ScoutingSurvey) & SUDAH melakukan pembayaran, sehingga task telah dibuat
exports.moveDraftToSurvey = async (order_id) => {
    try {
        //Ambil data dari `survey_draft_table`
        const draftData = await query(`
            SELECT * FROM survey_draft_table WHERE order_id = $1
        `, [order_id]);

        if (draftData.rows.length === 0) {
            console.log(`❌ Draft tidak ditemukan untuk Order ID: ${order_id}`);
            return;
        }

        const draft = draftData.rows[0];
        draft.keahlian = typeof draft.keahlian === 'string' ? draft.keahlian.replace(/[{}"]/g, "").split(",") : draft.keahlian;
        draft.tipe_hasil = typeof draft.tipe_hasil === 'string' ? draft.tipe_hasil.replace(/[{}"]/g, "").split(",") : draft.tipe_hasil;

        //Insert data ke `survey_table`
        await query(`
            INSERT INTO survey_table 
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, keahlian, kompensasi, tipe_hasil, order_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,[
            draft.id_client, draft.nama_proyek, draft.deskripsi_proyek, 
            draft.tenggat_pengerjaan, draft.lokasi, draft.keahlian, 
            draft.kompensasi,draft.tipe_hasil, draft.order_id
        ]);

        //Hapus dari `survey_draft_table`
        await query(`DELETE FROM survey_draft_table WHERE order_id = $1`, [order_id]);
        console.log(`✅ Draft survey dengan Order ID: ${order_id} berhasil dipindahkan ke survey_table`);

    } catch (error) {
        console.error("❌ Error saat memindahkan draft ke survey:", error);
    }
};

const formatDeadline = (deadlineDate) => {
    const today = new Date();
    let timeDiff = deadlineDate - today;
    const diffInSeconds = timeDiff / 1000;
    const diffInMinutes = diffInSeconds / 60;
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    const diffInWeeks = diffInDays / 7;
    const diffInMonths = diffInDays / 30;
    const diffInYears = diffInMonths / 12;

    let status = '';

    // Jika deadline sudah lewat
    if (timeDiff < 0) {
        if (diffInYears*-1 >= 1) {
            status = `${Math.floor(diffInYears*-1)} tahun lalu`;
          } else if (diffInMonths*-1 >= 1) {
            status = `${Math.floor(diffInMonths*-1)} bulan lalu`;
          } else if (diffInWeeks*-1 >= 1) {
            status = `${Math.floor(diffInWeeks*-1)} minggu lalu`;
          } else if (diffInDays*-1 >= 1) {
            status = `${Math.floor(diffInDays*-1)} hari lalu`;
          } else if (diffInHours*-1 >= 1) {
            status = `${Math.floor(diffInHours*-1)} jam lalu`;
          } else if (diffInMinutes*-1 >= 1) {
            status = `${Math.floor(diffInMinutes*-1)} menit lalu`;
          } else {
            status = `${Math.floor(diffInSeconds*-1)} detik lalu`;
          }
    }

     else {
      // Jika deadline masih akan datang
      if (diffInYears >= 1) {
        status = `${Math.floor(diffInYears)} tahun lagi`;
      } else if (diffInMonths >= 1) {
        status = `${Math.floor(diffInMonths)} bulan lagi`;
      } else if (diffInWeeks >= 1) {
        status = `${Math.floor(diffInWeeks)} minggu lagi`;
      } else if (diffInDays >= 1) {
        status = `${Math.floor(diffInDays)} hari lagi`;
      } else if (diffInHours >= 1) {
        status = `${Math.floor(diffInHours)} jam lagi`;
      } else if (diffInMinutes >= 1) {
        status = `${Math.floor(diffInMinutes)} menit lagi`;
      } else {
        status = `${Math.floor(diffInSeconds)} detik lagi`;
      }
    }

    // Format waktu menjadi jam dan menit (contoh: 13:40 WIB)
    const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' };
    const formattedTime = deadlineDate.toLocaleTimeString('id-ID', timeOptions);

    // Format tanggal menjadi (contoh: 12 Februari 2024)
    const dateOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    const formattedDate = deadlineDate.toLocaleDateString('id-ID', dateOptions);

    // Gabungkan semuanya
    return `${formattedTime} WIB, ${formattedDate} (${status})`;
};

const formatDeadlineWordOnly = (deadlineDate) => {
    const today = new Date();
    let timeDiff = deadlineDate - today;
    const diffInSeconds = timeDiff / 1000;
    const diffInMinutes = diffInSeconds / 60;
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    const diffInWeeks = diffInDays / 7;
    const diffInMonths = diffInDays / 30;
    const diffInYears = diffInMonths / 12;

    let status = '';

    // Jika deadline sudah lewat
    if (timeDiff < 0) {
        if (diffInYears*-1 >= 1) {
            status = `${Math.floor(diffInYears*-1)} tahun lalu`;
          } else if (diffInMonths*-1 >= 1) {
            status = `${Math.floor(diffInMonths*-1)} bulan lalu`;
          } else if (diffInWeeks*-1 >= 1) {
            status = `${Math.floor(diffInWeeks*-1)} minggu lalu`;
          } else if (diffInDays*-1 >= 1) {
            status = `${Math.floor(diffInDays*-1)} hari lalu`;
          } else if (diffInHours*-1 >= 1) {
            status = `${Math.floor(diffInHours*-1)} jam lalu`;
          } else if (diffInMinutes*-1 >= 1) {
            status = `${Math.floor(diffInMinutes*-1)} menit lalu`;
          } else {
            status = `${Math.floor(diffInSeconds*-1)} detik lalu`;
          }
    }

     else {
      // Jika deadline masih akan datang
      if (diffInYears >= 1) {
        status = `${Math.floor(diffInYears)} tahun lagi`;
      } else if (diffInMonths >= 1) {
        status = `${Math.floor(diffInMonths)} bulan lagi`;
      } else if (diffInWeeks >= 1) {
        status = `${Math.floor(diffInWeeks)} minggu lagi`;
      } else if (diffInDays >= 1) {
        status = `${Math.floor(diffInDays)} hari lagi`;
      } else if (diffInHours >= 1) {
        status = `${Math.floor(diffInHours)} jam lagi`;
      } else if (diffInMinutes >= 1) {
        status = `${Math.floor(diffInMinutes)} menit lagi`;
      } else {
        status = `${Math.floor(diffInSeconds)} detik lagi`;
      }
    }
    // Gabungkan semuanya
    return `(${status})`;
};

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

//menampilkan seluruh task(Scouting Survey)
exports.getAllSurveyTask = async(req,res) =>{
    try {
        const result = await query(`SELECT * FROM survey_table WHERE status_task = 'merekrut'`);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"no survey task found"
            })
        }
        const surveyData = result.rows;
        // const formattedSurveyData = surveyData.map(survey => {
        //     const { tenggat_pengerjaan,created_at } = survey;
        //     const fixTenggatPengerjaan = formatDeadline(new Date(tenggat_pengerjaan));
        //     const fixCreatedTime = formatCreatedAt(new Date(created_at))
        //     return {
        //         ...survey,  // Menyalin data survey
        //         tenggat_pengerjaan: fixTenggatPengerjaan,
        //         created_at: fixCreatedTime,
        //     };
        // });

        res.status(200).json({
            status:"success",
            data:surveyData
        })
        
    } catch (error) {
        console.error("❌ Error saat mengambil sebuah data survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//menghapus sebuah task (ScoutingSurvey)
exports.deleteASurvey = async(req,res) =>{
    const{id_survey} = req.body;
    try {
        await query(`DELETE FROM survey_table WHERE id_survey = $1`,[id_survey]);
        res.status(200).json({
            message:"success deleting survey task"
        })
    } catch (error) {
        console.error("error saat menghapus sebuah survey task",error);
        res.status(500).json({
            message:"Internal Server Error",
        })
    }
}

const trackRecruitmenStatus = (time) =>{
    const today = new Date();
    let timeDiff = time - today;
    const diffInSeconds = timeDiff / 1000;
    const diffInMinutes = diffInSeconds / 60;
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    
    if(diffInDays*-1 > 7){
        return true
    }else{
        return false
    }
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

//surveyor melihat projek yang mereka daftar
exports.surveyorProjects = async(req,res) =>{
  const id_surveyor = req.user.id_user
  try {
    //check dimana aja surveyor daftar
    const checkSurveyorProject = await query(`
      SELECT id_survey, status
      FROM surveyor_application 
      WHERE id_surveyor = $1`
    ,[id_surveyor])
    const projects = checkSurveyorProject.rows
    if(projects.length === 0){
      return res.status(404).json({
        message:"surveyor belum mendaftar project"
      })
    }
    
    const projectCardDetail = await Promise.all(
      projects.map(async(project)=>{
        const{id_survey,status} = project;

        const infoSurvey = await query(`
          SELECT id_survey,nama_proyek,lokasi,
          tipe_hasil,kompensasi,tenggat_pengerjaan
          FROM survey_table 
          WHERE id_survey =$1
        `,[id_survey])
        
        const{tenggat_pengerjaan} = infoSurvey.rows[0]
        const deadline_status = trackDeadlineStatus(tenggat_pengerjaan);
        if(deadline_status){
          await query(`
            UPDATE surveyor_application
            SET status = 'deadline'
            WHERE id_survey =$1  
          `,[id_survey])
        }
        return {
          id_survey:infoSurvey.rows[0].id_survey,
          nama_proyek:infoSurvey.rows[0].nama_proyek,
          lokasi:infoSurvey.rows[0].lokasi,
          status_surveyor:status,
          tipe_hasil:infoSurvey.rows[0].tipe_hasil,
          tenggat_pengerjaan:tenggat_pengerjaan
        };
      })
    )

    res.status(200).json({
      message:"success",
      data:{
        projectCardDetail
      }
    })
  } catch (error) {
      console.error("Error ketika melakukan fetching cardDetail pada Projec Surveyor",error);
      res.status(500).json({
        message:"Internal Server Error"
      })
  }
}


const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/');  
  },
  filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: multerStorage,
});

exports.uploadAnswers = upload.array('file');

//mengumpulkan jawaban (sisi surveyor)
exports.submitSurveyorAnswer = async(req,res) =>{
  const{id_survey} = req.params;
  const id_surveyor = req.user.id_user;
  const files = req.files;
  try {
    //pertama check dulu identitas valid apa ngga ? boleh ngga dia ngisi/ ngelihat jawaban
    const checkCandidateStatus = await query(`SELECT status FROM surveyor_application WHERE id_surveyor = $1 AND id_survey =$2`,[id_surveyor,id_survey])
    const status = checkCandidateStatus.rows[0].status;

    if (["ditolak"].includes(status)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    
    const outputTarget = await query(`SELECT id_luaran,status_revisi FROM survey_table WHERE id_survey =$1`,[id_survey])
    const {id_luaran,status_revisi} = outputTarget.rows[0]
    if(status_revisi == false){
      if (["mengerjakan", "ditinjau"].includes(status)){
        const uploadedFiles = await uploadSurveyorAnswer(files);
        const queryText = `
        INSERT INTO luaran_survey (survey_id, file_name, file, file_size, file_type)  
        VALUES ${uploadedFiles.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(", ")}
        RETURNING *;
        `;
        const values = [id_luaran, ...uploadedFiles.flatMap(file => [file.name, file.url, file.size, file.type])];
        const result = await query(queryText, values);

        res.status(201).json({ message: "Jawaban berhasil diunggah", data: result.rows, jumlah_luaran:result.rows.length});
      }
    } else {
      if (["mengerjakan", "ditinjau"].includes(status)){
        const uploadedFiles = await uploadSurveyorAnswer(files);
        const queryText = `
          INSERT INTO luaran_survey (survey_id, file_name, file, file_size, file_type)  
          VALUES ${uploadedFiles.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(", ")}
          RETURNING *;
        `;
        const values = [id_luaran, ...uploadedFiles.flatMap(file => [file.name, file.url, file.size, file.type])];
        const result = await query(queryText, values);

        res.status(201).json({ message: "Revisi berhasil diunggah", data: result.rows, jumlah_luaran:result.rows.length });
      }
    } 
    await query(`
      UPDATE surveyor_application
      SET status = 'ditinjau'
      WHERE id_survey =$1 AND id_surveyor =$2 
    `,[id_survey,id_surveyor])

  } catch (error) {
      console.error("Error ketika mengupload jawaban Surveyor",error)
      res.status(500).json({message:"Internal Server Error"})
  }
}


//menampilkan jawaban surveyor yang telah dikumpulkan(sisi client)
exports.showSurveyorAnswer = async(req,res)=>{
  const{id_survey} = req.params;
  try {
    //cek seluruh tabel luaran_survey yang memiliki status pending
    const targetTabel = await query(`SELECT id_luaran FROM survey_table WHERE id_survey =$1`,[id_survey])
    const target= targetTabel.rows[0];
    const{id_luaran} = target;

    const surveyQueryAnswer = await query(`
     SELECT * 
        FROM luaran_survey 
        WHERE survey_id = $1 
        AND status IN ('pending', 'selesai')`
    ,[id_luaran]);
    const surveyAnswer = surveyQueryAnswer.rows

    res.status(200).json({
      message:"success",
      data:{
        ...surveyAnswer,
        jumlah_luaran: surveyAnswer.length
      }
    })
  } catch (error) {
     console.error("Error ketika menampilkan jawaban surveyor",error)
     res.status(500).json({
      message:"Internal Server Error"
     }) 
  }
}

//menerima jawaban surveyor
exports.accSurveyorAnswer = async(req,res) =>{
  const{id_survey} = req.body
  try {
    //cari id_luaran
    const infoSurvey = await query(`SELECT id_luaran,kompensasi,id_survey FROM survey_table WHERE id_survey =$1`,[id_survey])
    const {id_luaran} = infoSurvey.rows[0]
    const targetSurveyor = await query(`
      SELECT id_surveyor 
      FROM surveyor_application
      WHERE id_survey =$1`,
    [id_survey])

    const infoSurveyor = targetSurveyor.rows[0]
    const {id_surveyor} = targetSurveyor.rows[0]
    
    //ubah seluruh status jawaban di luaran_survey, menjadi selesai
    await query(`UPDATE luaran_survey SET status = 'selesai' WHERE survey_id = $1`,[id_luaran])

    //ubah status pada surveyor_application dan status_task = selesai
    await query(`
      UPDATE surveyor_application
      SET status = 'selesai'
      WHERE id_survey =$1 AND id_surveyor = $2
      RETURNING *`
    ,[id_survey,id_surveyor])

    await query(`
      UPDATE survey_table 
      SET status_task ='selesai'
      WHERE id_survey =$1  
    `,[id_survey])

    //panggil fungsi yang memberi notifikasi ke admin mengenai jumlah kompensasi, nomor rekening, nama_bank
    sendNotificationtoAdmin(id_survey, infoSurveyor.nama_lengkap, infoSurveyor.kompensasi, infoSurveyor.nama_bank, infoSurveyor.email, infoSurveyor.nomor_rekening)
  } catch (error) {
    console.error("Error ketike menerima jawaban surveyor",error);
    res.status(500).json({
      message:"Internal Server Error"
    }) 
  } 
}

//meminta surveyor revisi
exports.revisiSurveyorAnswer = async(req,res) =>{
  //inputnnya bakalan dapet id_survey, dari id_luaran sekalian
  const {id_survey, tenggat_pengerjaan, task_revisi} = req.body
  try {
    const outputTarget = await query(`SELECT id_luaran,status_revisi FROM survey_table WHERE id_survey =$1`,[id_survey])
    const {id_luaran,status_revisi} = outputTarget.rows[0]

    if(status_revisi == false){
      //update status_revisi = true, tenggat_pengerjaan, status_task = dikerjakan, status = mengerjakan
      await query(`
        UPDATE survey_table 
        SET status_revisi = 'true',
            tenggat_pengerjaan = $1,
            status_task = 'dikerjakan',
        RETURNING *
      `, [tenggat_pengerjaan]);

      await query(`
        UPDATE surveyor_application
        SET status = 'mengerjakan'
        WHERE id_survey = $1
        RETURNING *
      `,[id_survey])
  
      //insert data tugas_baru
      await query(
        `UPDATE survey_table 
        SET task_revisi =$1
        WHERE id_survey =$2`,
      [task_revisi,id_survey]);
  
      //update status jawaban luarn menjadi revisi
      await query(`UPDATE luaran_survey SET status ='revisi' WHERE id_luaran = $1`,[id_luaran])

      res.status(200).json({
        status:"1",
        message:"berhasil mengajukan revisi",
        data_revisi:task_revisi
      })
    }else{
      return res.status(400).json({
        status:"0",
        message:"tidak bisa melakukan revisi"
      })
    }
  } catch (error) {
    console.error("Error ketika mengajukan revisi Surveyor",error);
    return res.status(500).json({
      message:"Internal Server Error"
    })
  }
}

//surveyDetailuntukUmum
exports.getSurveyDetail = async (req, res) => {
  const { id_survey } = req.params;
  try {
      const result = await query(`SELECT * FROM survey_table WHERE id_survey = $1`, [id_survey]);
      // Cek apakah survey ditemukan
      if (result.rows.length === 0) {
          return res.status(404).json({
              message: "Survey tidak ditemukan"
          });
      }

      // Ambil detail survey
      const surveyDetail = result.rows[0];

      // Format tanggal tenggat_pengerjaan
      const formattedDateDeadline = formatDeadline(surveyDetail.tenggat_pengerjaan);
      const formattedDateCreatedAt = formatCreatedAt(surveyDetail.created_at)

      // Kirim response
      res.status(200).json({
          message: "Success",
          data: { ...surveyDetail, tenggat_pengerjaan: formattedDateDeadline, created_at:formattedDateCreatedAt} // Menggunakan spread dengan benar
      });

  } catch (error) {
      console.error("Error saat mengambil survey detail:", error.message);
      res.status(500).json({
          message: "Internal Server Error"
      });
  }
};

//surveyDetailuntukYangMendaftar
exports.getAppliedSurveyDetail = async (req, res) => {
  const { id_survey } = req.params;
  const id_surveyor = req.user.id_user
  try {
      const result = await query(`SELECT * FROM survey_table WHERE id_survey = $1`, [id_survey]);
      const status_surveyor_query = await query(`SELECT status FROM surveyor_application WHERE id_survey =$1 AND id_surveyor =$2`,[id_survey,id_surveyor])

      // Cek apakah survey ditemukan
      if (result.rows.length === 0) {
          return res.status(404).json({
              message: "Survey tidak ditemukan"
          });
      }

      // Ambil detail survey
      const surveyDetail = result.rows[0];

      // Format tanggal tenggat_pengerjaan
      const formattedDateDeadline = formatDeadline(surveyDetail.tenggat_pengerjaan);
      const formattedDateCreatedAt = formatCreatedAt(surveyDetail.created_at)

      // Kirim response
      res.status(200).json({
          message: "Success",
          data: { ...surveyDetail, 
            tenggat_pengerjaan: formattedDateDeadline, 
            created_at:formattedDateCreatedAt,
            status_surveyor:status_surveyor_query.rows[0].status
          } 
      });

  } catch (error) {
      console.error("Error saat mengambil applied survey detail:", error.message);
      res.status(500).json({
          message: "Internal Server Error"
      });
  }
};


//menghapus jawaban surveyor
exports.deleteSurveyAnswer = async(req,res) =>{
  const {survey_id} = req.body;
  const {id_luaran} = req.params;
  try {
    //hapus dulu dari google cloud console
    const currentFile = await query(`SELECT file_url FROM luaran_survey WHERE id_luaran = $1 AND survey_id =$2`,[id_luaran,survey_id])

    const oldFileUrl = currentFile.rows[0]?.file_url
    const fileName = getFileNameFromURL(oldFileUrl)

    await deleteFileFromGoogleStorage(fileName)
    //dia ngehapus dari luaran_table id_luaran di survey_id ini
    await query(`DELETE FROM luaran_survey WHERE id_luaran =$1 AND survey_id =$2`,[id_luaran,survey_id])
    res.status(204).end();

    
  } catch (error) {
      console.error("Error ketika menghapus jawaban",error);
      res.status(500).json({
        message:"Internal Server Error"
      })
  }
}