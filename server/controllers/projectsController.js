const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const moment = require('moment-timezone');
require('moment/locale/id');
moment.locale('id');
const {formatDeadline} = require('./surveyController'); 


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
          const { id_survey, order_id} = project;
          if ((id_survey && id_survey.startsWith('ASD')) || (order_id && order_id.startsWith('SURVEY')) ) {
              
              if(id_survey.startsWith('ASD')){
                const { created_at, tenggat_pengerjaan, id_survey,id_luaran} = project;

                const checkStatusApplication = await query(`SELECT * FROM surveyor_application WHERE id_survey =$1`,[id_survey])
                const checkAnswerStatus = await query(`SELECT * FROM luaran_survey WHERE survey_id =$1 AND status ='pending'`,[id_luaran]);

                
                const isSurveyExpired = trackRecruitmenStatus(created_at)
                const isSurveyDeadline = trackDeadlineStatus(tenggat_pengerjaan)
                //kadaluwarsa
                if(isSurveyExpired && checkStatusApplication.rows.length === 0){
                    await query(`
                        UPDATE survey_table
                        SET status_task = 'kadaluwarsa'
                        WHERE id_survey =$1
                    `,[id_survey])
                }

                //peringatan
                if(isSurveyDeadline){
                    await query(`
                        UPDATE survey_table
                        SET status_task = 'peringatan'
                        WHERE id_survey=$1    
                    `,[id_survey])
                }
                //dikerjakan
                if(checkStatusApplication.rows.some(row => row.status === 'mengerjakan')){
                    await query(`
                        UPDATE survey_table
                        SET status_task = 'dikerjakan'
                        WHERE id_survey =$1    
                    `,[id_survey])
                }
                
                //ditinjau
                if(checkAnswerStatus.rows.length >= 1){
                    await query(`
                        UPDATE survey_table
                        SET status_task ='ditinjau'
                        WHERE id_survey=$1
                    `,[id_survey])
                }
              }               
              formattedData.push({
                  ...project
              });

          } else if ((id_survey && id_survey.startsWith('RES')) || (order_id && order_id.startsWith('RESPOND'))) {
          
              if(id_survey.startsWith('RES')){
                
              
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

//surveyor bookmarked suatu project
exports.projectBookmarked = async(req,res) =>{
    const id_user = req.user.id_user;
    const {id_project} = req.params
    try {
        if(id_project.startsWith('ASD')){
            //masukkan ke saved_projects dengan input 'survey' sebagai role
            const savedSurvey = await query(`
                INSERT INTO saved_projects 
                SET (id_users, id_projects, project_type) 
                VALUES ($1,$2,'survey') RETURNING *
            `,[id_user, id_project])    

            res.status(200).json({
                message:"success",
                data:savedSurvey.rows[0]
            })    

        } else {
            const savedRespond = await query(`
                INSERT INTO saved_projects 
                SET (id_users, id_projects, project_type) 
                VALUES ($1,$2,'respond') RETURNING *
            `,[id_user, id_project])  

            res.status(200).json({
                message:"success",
                data:savedRespond.rows[0]
            })    
        }
        //berikan status (200) apabila berhasil
        
        
    } catch (error) {
        console.error("Error ketika melakukan bookmark suatu project");
        res.status(500).json({
            message:"Internal Server Error"
        })
        
    }
}

//menampilkan bookmarked
exports.showBookmarkedProject = async(req,res) =>{
    const {id_user} = req.user
    try {
        const savedProjectsQuery = await query(`SELECT id_product FROM saved_projects WHERE id_user =$1`,[id_user])
        const savedProjects = savedProjectsQuery.rows

        const projectCardDetail = await Promise.all(
            savedProjects.map(async(project) =>{
                const{id_product,role} = project
                if(role =='survey'){
                    const surveyDetailQuery = await query(`
                        SELECT * 
                        FROM survey_table 
                        WHERE id_survey =$1    
                    `,[id_product])

                    return surveyDetailQuery.rows;
                } else {
                    const respondDetailQuery = await query(`
                        SELECT *
                        FROM respond_table
                        WHERE id_respond =$1    
                    `,[id_product])

                    return respondDetailQuery.rows
                }
            })
        )
        res.status(200).json({
            message:"success",
            data:projectCardDetail
        })

    } catch (error) {
        console.error("Error ketika melakukan pengambilan saved product",error)
        res.status(500).json({
            message:"Internal Server Error"
        })
        
    }
}