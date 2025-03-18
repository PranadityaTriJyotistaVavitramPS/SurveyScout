const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const moment = require('moment-timezone');


function ScoutTrust(good_project,total_project,avg_rating, sum_rating){
    const scout_trust = ((jumlah_proyek/total_proyek*0.4)+(avg_penilaian/5*0.4)+(0.3))*100
    return scout_trust
}

exports.ratingASurvey = async(req,res) =>{
    const{id_survey} = req.params;
    const rating = req.body
    try {
        const SurveyorIdentity = await query(`SELECT id_surveyor FROM surveyor_application WHERE id_survey = $1`,[id_survey]);
        const {id_surveyor} = SurveyorIdentity.rows[0];

        const SurveyorRateStatus = await query(`SELECT sum_rating,total_project,avg_rating,good_project 
            FROM surveyor_table WHERE id_surveyor = $1`,[id_surveyor])

        const {sum_rating,total_project,avg_rating,good_project} = SurveyorRateStatus.rows[0];
        
        const new_avg_rating = ((avg_rating*sum_rating + rating)/(total_project));
        
        //query untuk mengubah status_rating pada survey_table
        await query(`UPDATE survey_table SET status_rating ='sudah' WHERE id_survey = $1`,[id_survey]);
        const scout_trust= ScoutTrust(good_project, total_project,new_avg_rating, sum_rating);
        await query(`UPDATE surveyor_table SET scout_trust = $1 WHERE id_surveyor = $2`,[scout_trust,id_surveyor])
        
        
    } catch (error) {
        console.error("Error saat membuat rating:",error);
        res.status(500).json({ message: "Internal Server Error" });        
    }

}