const {query} = require('../db/index');

//mendaftar suatu survey
exports.applyToSurvey = async(req,res) =>{
    const {id_survey} = req.params;
    const id_surveyor = req.user.id_user;
    try {
        const checkStatus = await query(`SELECT status_task FROM survey_table WHERE id_survey =$1 AND status_task ='merekrut'`,[id_survey])
        if (checkStatus.rows.length === 0) {
            return res.status(404).json({ message: "Survey tidak ditemukan" });
        }
        const { status_task } = checkStatus.rows[0];
        if (status_task !== "merekrut") {
            return res.status(400).json({ message: "Survey tidak dalam tahap perekrutan" });
        }
        if(status_task=='merekrut'){
            //mendaftar pada status
            const apply = await query(`INSERT INTO surveyor_application (id_surveyor, id_survey) VALUES ($1,$2) RETURNING *`,[id_surveyor,id_survey])
            res.status(201).json({
                message:"sukses mendaftar",
                data:apply.rows[0]
            })
        }
    } catch (error) {
        console.error("Error saat surveyor mendaftar suatu survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


//menampilkan pendaftar suatu project survey
exports.surveyorWorker = async(req,res) => {
    const{id_survey} = req.params
    try {
        //ambil siapa aja yang daftar di survey ini
        const projectCandidate = await query(`
            SELECT id_surveyor 
            FROM surveyor_application 
            WHERE id_survey = $1 
            AND (status != 'ditolak')`,[id_survey])
        const candidateResult = projectCandidate.rows
        const jumlah_candidate = candidateResult.length
        //dari yang daftar ambil data id_surveyor,scout_trust, profile_picture,cv_ats
        const candidateInfo = await Promise.all(
            candidateResult.map(async (candidate) => {
                const {id_surveyor} = candidate;
                const status = await query(`
                    SELECT status FROM surveyor_application WHERE id_surveyor=$1 AND id_survey=$2
                `,[id_surveyor,id_survey])
                
                const info = await query(`
                    SELECT id_surveyor,nama_lengkap, scout_trust, profile_picture, cv_ats 
                    FROM surveyor_table 
                    WHERE id_surveyor = $1
                `,[id_surveyor])
                return {
                    id_surveyor: info.rows[0].id_surveyor,
                    nama_lengkap: info.rows[0].nama_lengkap,
                    scout_trust: info.rows[0].scout_trust,
                    profile_picture: info.rows[0].profile_picture,
                    cv_ats: info.rows[0].cv_ats,
                    status_penerimaan:status.rows[0].status
                };
            })
        )

        //tampilkan data 
        res.status(200).json({
            message:"success",
            data: {
                jumlah_pendaftar:jumlah_candidate,
                candidateInfo
            }
        })
        
    } catch (error) {
        console.error("Error saat mengambil data pendaftar survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//menerima surveyor
exports.accSurveyor = async (req, res) => {
    const { id_surveyor } = req.body;
    const { id_survey } = req.params;

    try {
        // Cek daftar semua kandidat untuk survey ini
        const checkCandidates = await query(
            `SELECT * FROM surveyor_application WHERE id_survey = $1`, 
            [id_survey]
        );

        // Pastikan kandidat yang diterima ada dalam daftar
        const targetCandidate = checkCandidates.rows.find(candidate => candidate.id_surveyor === id_surveyor);
        if (!targetCandidate) {
            return res.status(404).json({ message: "Surveyor tidak ditemukan dalam daftar pendaftar" });
        }

        // Update status kandidat yang diterima
        await query(
            `UPDATE surveyor_application SET status = 'mengerjakan' WHERE id_survey = $1 AND id_surveyor = $2`, 
            [id_survey, id_surveyor]
        );

        // Dapatkan kembali daftar kandidat setelah update
        const updatedCandidates = await query(
            `SELECT * FROM surveyor_application WHERE id_survey = $1`, 
            [id_survey]
        );

        // Tolak kandidat lain yang tidak diterima
        const rejectedCandidates = updatedCandidates.rows.filter(candidate => candidate.id_surveyor !== id_surveyor);
        for (const candidate of rejectedCandidates) {
            await query(
                `UPDATE surveyor_application SET status = 'ditolak' WHERE id_survey = $1 AND id_surveyor = $2`,
                [id_survey, candidate.id_surveyor]
            );
        }

        res.status(200).json({ message: "Surveyor berhasil diterima" });

    } catch (error) {
        console.error("Error saat menerima pendaftar survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

//menolak surveyor
exports.rejSurveyor = async(req,res) =>{
    const{id_survey, id_surveyor} = req.body
    try {
        await query(`
            UPDATE surveyor_application 
            SET status = 'ditolak'
            WHERE id_surveyor =$1 AND id_survey =$2`,
        [id_surveyor,id_survey])

        res.status(200).json({
            message:"berhasil menolak"
        })
        
    } catch (error) {
        console.error("gagal saat menolak surveyor:", error)
        res.status(500).json({
            message:"gagal menolak surveyor"
        })
        
    }
}





