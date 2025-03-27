const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');


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



const trackRecruitmenStatus = (time) =>{
    const today = new Date();
    let timeDiff = time - today;
    const diffInSeconds = timeDiff / 1000;
    const diffInMinutes = diffInSeconds / 60;
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    
    if(diffInDays*-1 > 7){
        console.log('kadaluwarsa');
        return true
    }else{
        console.log('fresh');
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

exports.getProjectsDetail = async(req,res) =>{
    const{id_project} = req.params
    const isSurvey = id_project.startsWith('ASD');
    const isRespond = id_project.startsWith('RES');
    
    try {
        if(isSurvey){
            result = await query(`SELECT * FROM survey_table WHERE id_survey = $1`,[id_project])
            if(result.rows.length === 0){
                return res.status(404).json({
                    message:"survey task not found"
                })
            }
            const surveyData = result.rows[0];
            const {tenggat_pengerjaan,created_at} = surveyData;
            const fixTenggatPengerjaan = formatDeadline(tenggat_pengerjaan);
            const fixCreatedTime = formatCreatedAt(created_at);
        
            res.status(200).json({
                status:"success",
                data: {
                    ...surveyData, tenggat_pengerjaan:fixTenggatPengerjaan,
                    created_at:fixCreatedTime
                }
            })
        }
        else if(isRespond){
            const result = await query(`SELECT * FROM respond_table WHERE id_respond = $1`,[id_project]);
            if(result.rows.length === 0){
                return res.status(404).json({
                    message:"respond task tidak ditemukan"
                })
            }
    
            const respondData= result.rows[0];
            const {tenggat_pengerjaan,created_at} = respondData;
            const fixTenggatPengerjaan = formatDeadline(tenggat_pengerjaan);
            const fixCreatedTime = formatCreatedAt(created_at);
    
            res.status(200).json({
                status:"success",
                data: {
                    ...respondData, tenggat_pengerjaan:fixTenggatPengerjaan,
                    created_at:fixCreatedTime
                }
            })
        } else {
            const project_tipe = await query(`
                SELECT order_id
                FROM survey_draft_table s
                WHERE s.id_draft = $1

                UNION

                SELECT order_id
                FROM respond_draft_table r
                WHERE r.id_draft = $1;`
            ,[id_project]);
            
            const {order_id} = project_tipe.rows[0];

            if(order_id.startsWith('SURVEY')){
                const result = await query(`SELECT * FROM survey_draft_table WHERE id_draft = $1`,[id_project]);
                if(result.rows.length === 0){
                    return res.status(404).json({
                        message:"survey task not found"
                    })
                }
                const surveyData = result.rows[0];
                const {tenggat_pengerjaan,created_at} = surveyData;
                const fixTenggatPengerjaan = formatDeadline(tenggat_pengerjaan);
                const fixCreatedTime = formatCreatedAt(created_at);
            
                res.status(200).json({
                    status:"success",
                    data: {
                        ...surveyData, tenggat_pengerjaan:fixTenggatPengerjaan,
                        created_at:fixCreatedTime
                    }
                })
            } else{
                const result = await query(`SELECT * FROM respond_draft_table WHERE id_draft = $1`,[id_project]);
                if(result.rows.length === 0){
                    return res.status(404).json({
                        message:"draft task not found"
                    })
                }
                const respondData = result.rows[0];
                const {tenggat_pengerjaan,created_at} = respondData;
                const fixTenggatPengerjaan = formatDeadline(tenggat_pengerjaan);
                const fixCreatedTime = formatCreatedAt(created_at);
            
                res.status(200).json({
                    status:"success",
                    data: {
                        ...respondData, tenggat_pengerjaan:fixTenggatPengerjaan,
                        created_at:fixCreatedTime
                    }
                })

            }
        }
        
    } catch (error) {
        console.error("error ketika mengambil sebuah project task disini goblok:",error);
        res.status(500).json({message:"Internal Server Error"});
    }
}




exports.clientProjects = async (req, res) => {
  const id_client = req.user.id_user;
  console.log(id_client)
  try {
      const result = await query(`
          SELECT 
              id_survey AS id_survey,
              order_id, 
              nama_proyek, 
              deskripsi_proyek, 
              tenggat_pengerjaan, 
              CAST(lokasi AS text) AS lokasi,
              array_to_string(keahlian::text[], ',') AS keahlian, 
              tipe_hasil, 
              kompensasi, 
              id_client, 
              created_at, 
              status_task,
              status_rating,
              NULL AS jumlah_responden,
              NULL AS midtrans_token, 
        NULL AS midtrans_link
          FROM 
              survey_table
          WHERE id_client = $1

          UNION ALL

          SELECT 
              id_draft::text AS id_survey,  -- Mengonversi id_draft menjadi text
              order_id,
              nama_proyek, 
              deskripsi_proyek, 
              tenggat_pengerjaan, 
              CAST(lokasi AS text) AS lokasi, 
              array_to_string(keahlian::text[], ',') AS keahlian, 
              tipe_hasil, 
              kompensasi, 
              id_client, 
              created_at, 
              status_task,
              NULL AS status_rating,
              NULL AS jumlah_responden,
              midtrans_token,
              midtrans_link
          FROM 
              survey_draft_table
          WHERE id_client = $1

          UNION ALL

          SELECT 
              id_respond::text AS id_survey,  -- Mengonversi id_respond menjadi text
              order_id,
              nama_proyek, 
              deskripsi_proyek, 
              tenggat_pengerjaan, 
              CAST(lokasi AS text) AS lokasi,
              keahlian::text AS keahlian, 
              NULL AS tipe_hasil, 
              kompensasi, 
              id_client, 
              created_at, 
              status_task,
              status_rating,
              jumlah_responden::text,
              NULL AS midtrans_token, 
        NULL AS midtrans_link
          FROM 
              respond_table
          WHERE id_client = $1
              
          UNION ALL

          SELECT 
              id_draft::text AS id_survey,  -- Mengonversi id_respond_draft menjadi text
              order_id,
              nama_proyek, 
              deskripsi_proyek, 
              tenggat_pengerjaan, 
              CAST(lokasi AS text) AS lokasi,
              keahlian::text AS keahlian, 
              NULL AS tipe_hasil, 
              kompensasi, 
              id_client, 
              created_at, 
              status_task,
              NULL AS status_rating,
              jumlah_responden::text,
              midtrans_token,
              midtrans_link
          FROM 
              respond_draft_table
          WHERE id_client = $1
      `, [id_client]);

      if (result.rows.length === 0) {
          res.status(404).json({
              message: "Klien belum membuat task"
          });
          return;
      }

      const ClientData = result.rows;
      const formattedData = [];
      for (const project of ClientData) {
          const { created_at, tenggat_pengerjaan, id_survey, order_id, jumlah_responden} = project;
          const jumlah_pekerja = parseInt(jumlah_responden);
          
          if (id_survey && id_survey.startsWith('ASD') || order_id && order_id.startsWith('SURVEY') ) {
              
              if(id_survey.startsWith('ASD')){
                  //untuk cek kadaluwarsa nanti, nyari apakah sudah ada yang daftar
                  const checkApplication = await query(`SELECT * FROM surveyor_application WHERE id_survey=$1`, [id_survey]);
                  //untuk cek dikerjakan nanti, nyari apakah sudah ada yang diterima
                  const checkIfWorkerExist = await query(`SELECT id_surveyor FROM surveyor_application WHERE id_survey =$1 AND status='diterima'`,[id_survey]);
                  const AnswerPlace = await query(`SELECT * FROM survey_table WHERE id_survey=$1`, [id_survey]);
                  const { id_luaran } = AnswerPlace.rows[0];
                  const checkAnswerStatus = await query(`SELECT COUNT(*) FROM luaran_survey WHERE survey_id = $1 AND status ='diajukan'`, [id_luaran]);
                  // Jika hasil query tidak kosong, berarti ada data yang cocok, return true
                  let ada_jawaban =''
                  if (checkAnswerStatus.rows[0].count > 0) {
                      ada_jawaban = true;  // sudah ada jawaban
                  } else {
                      ada_jawaban = false;  // belum ada jawaban
                  }

                  const freshStatus = trackRecruitmenStatus(created_at); 
                  const deadlineStatus = trackDeadlineStatus(tenggat_pengerjaan);

                //   //kadaluwarsa
                //   if (freshStatus && checkApplication.rows.length === 0) {
                //       await query(`UPDATE survey_table SET status_task = 'kadaluwarsa' WHERE id_survey = $1`, [id_survey]);
                //   }
                //   //peringatan
                //   if (deadlineStatus && !ada_jawaban) {
                //       await query(`UPDATE survey_table SET status_task = 'peringatan' WHERE id_survey =$1`, [id_survey]);
                //   }
                //   // //dikerjakan
                //   if(checkIfWorkerExist.rows.length > 0){
                //       await query(`UPDATE survey_table SET status_task ='dikerjakan' WHERE id_survey=$1`,[id_survey]);
                //   }
                //   //ditinjau
                //   if(ada_jawaban){
                //       await query(`UPDATE survey_table SET status_task = 'ditinjau' WHERE id_survey = $1`,[id_survey]);
                //   }
                
              }               
              formattedData.push({
                  ...project
              });

          } else if (id_survey && id_survey.startsWith('RES') || order_id && order_id.startsWith('RESPOND')) {
          
              if(id_survey.startsWith('RES')){
                  console.log('untuk id ini:',id_survey,'statusnya:')
                  //cek apakah ada pendaftar(status kadaluwarsa)
                  const checkApplication = await query(`SELECT * FROM respondent_application WHERE id_respond=$1`, [id_survey]);
                  //cek apakah ada pendaftar yang keterima (status dikerjakan)
                  const checkIfWorkerExist = await query(`SELECT id_responden FROM respondent_application WHERE id_respond =$1 AND status='diterima'`,[id_survey]);
                  //untuk ngecek (status selesai)
                  const AnswerPlace = await query(`SELECT id_luaran FROM respond_table WHERE id_respond = $1`,[id_survey]);
                  const {id_luaran} = AnswerPlace.rows[0];
                  const AnswerStatus = await query(`SELECT status FROM luaran_respond WHERE id_luaran = $1 AND status ='selesai'`,[id_luaran])
                  
                  //untuk ngcek (status ditinjau)
                  const checkAnswerStatus =await query(`SELECT COUNT (*) FROM luaran_respond WHERE respond_id = $1 AND status = 'diajukan'`,[id_luaran])
                  let ada_jawaban= ''
                  if (checkAnswerStatus.rows[0].count > 0) {
                      ada_jawaban = true;  //sudah ada jawaban
                  } else {
                      ada_jawaban = false;  // belum ada jawaban
                  }
          

                //   //kadaluwarsa
                //   if (trackRecruitmenStatus(created_at) && checkApplication.rows.length === 0) {
                //       await query(`UPDATE respond_table SET status_task = 'kadaluwarsa' WHERE id_respond = $1`, [id_survey]);
                //   }
                //   //peringatan
                //   if (trackDeadlineStatus(tenggat_pengerjaan) && !ada_jawaban) {
                  
                //       await query(`UPDATE respond_table SET status_task = 'peringatan' WHERE id_respond =$1`, [id_survey]);
                //   }
                  //dikerjakan
                  if (checkIfWorkerExist.rows.length > 0){
                      await query(`UPDATE respond_table SET status_task= 'dikerjakan' WHERE id_respond =$1`,[id_survey]);
                  }
              
              } 
              formattedData.push({
                  ...project
              });
          }
      }
      res.status(200).json({
          status: "success",
          data: formattedData
      });

  } catch (error) {
      console.error("Error saat mengambil survey task yang dibuat client", error);
      res.status(500).json({
          message: "Internal Server Error",
      });
  }
};