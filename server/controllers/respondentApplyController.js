const {query} = require('../db/index');

//mendaftar suatu respond
exports.applyToRespond = async(req,res) =>{
    const {id_respond} = req.params;
    const id_responden = req.user.id_user;
    try {
        const checkStatus = await query(`SELECT status_task FROM respond_table WHERE id_respond =$1 AND status_task ='merekrut'`,[id_respond])
        if (checkStatus.rows.length === 0) {
            return res.status(404).json({ message: "Respond tidak ditemukan" });
        }
        const { status_task } = checkStatus.rows[0];
        if (status_task !== "merekrut") {
            return res.status(400).json({ message: "Respond tidak dalam tahap perekrutan" });
        }
        if(status_task=='merekrut'){
            //mendaftar pada status
            const apply = await query(`INSERT INTO respondent_application (id_respondent, id_respond) VALUES ($1,$2) RETURNING *`,[id_responden,id_respond])
            res.status(201).json({
                message:"sukses mendaftar",
                data:apply.rows[0]
            })
        }
    } catch (error) {
        console.error("Error saat responden mendaftar suatu respond:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


//menampilkan pendaftar projek respond
exports.respondenWorker = async(req,res) => {
    const{id_respond} = req.params
    try {
        //ambil siapa aja yang daftar di respond ini
        const projectCandidate = await query(`
            SELECT id_responden 
            FROM respondent_application 
            WHERE id_respond = $1 
            AND (status='mendaftar' OR status='mengerjakan')`,[id_respond])
        const candidateResult = projectCandidate.rows
        const jumlah_candidate = candidateResult.length
        //dari yang daftar ambil data nama_lengkap, profile_picture dan id_respondennya aja
        const candidateInfo = await Promise.all(
            candidateResult.map(async (candidate) => {
                const {id_responden} = candidate;
                const status = await query(`
                    SELECT status FROM respondent_application WHERE id_responden=$1 AND id_respond=$2
                `,[id_responden,id_respond])
                
                const info = await query(`
                    SELECT id_responden,nama_lengkap, profile_picture
                    FROM responden_table 
                    WHERE id_responden = $1
                `,[id_responden])

                return {
                    id_responden: info.rows[0].id_responden,
                    nama_lengkap: info.rows[0].nama_lengkap,
                    profile_picture: info.rows[0].profile_picture,
                    status_responden:status.rows[0].status
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
        console.error("Error saat mengambil data pendaftar respond:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


//menerima responden
exports.accResponden = async(req,res) =>{
    const{id_responden,id_respond} = req.body
    try {
        //cek terlebih dahulu ada berapa yang daftar
        const checkCandidate = await query(`SELECT * FROM respondent_application WHERE id_responden =$1 AND id_respond=$2`,[id_responden,id_respond])
        const jumlah_candidate = checkCandidate.rows.length;

        //cek berapa yang dibutuhkan
        const checkKuotaWorker = await query(`SELECT jumlah_responden FROM respond_table WHERE id_respond = $1`,[id_respond])
        const {kuotaWorker} = checkKuotaWorker.rows[0]

        //kalau lebih dari x(yang dibutuhkan) maka yang lainnya diubah ke ditolak, kalau nggak yawes terima aja
        if(jumlah_candidate > kuotaWorker){
            const acceptedCandidate = checkCandidate.rows.find(candidate => 
                ['mengerjakan', 'deadline', 'ditinjau', 'selesai'].includes(candidate.status)
            );
            
            if(acceptedCandidate >= kuotaWorker){
                const rejectedCandidates = checkCandidate.rows.filter(candidate => 
                    !['mengerjakan', 'deadline', 'ditinjau', 'selesai'].includes(candidate.status)
                );
                for(const candidate of rejectedCandidate){
                    await query(`
                        UPDATE respondent_application 
                        SET status='ditolak'
                        WHERE id_responden =$1 AND id_respond =$2
                    `,[id_responden,id_respond])
                }
                await query(`
                    UPDATE respond_table
                    SET status_task ='dikerjakan'
                    WHERE id_respond = $1
                `,[id_respond])
            } else {
                await query(`
                    UPDATE respondent_application 
                    SET status='mengerjakan' 
                    WHERE id_responden = $1 AND id_respond = $2
                `, [id_responden, id_respond]);
            }

        } else {
            await query(`
                UPDATE respondent_application 
                SET status='mengerjakan' 
                WHERE id_respond =$1 AND id_responden =$2`,
            [id_respond,id_responden])
        }
        await query(`
            UPDATE respond_table 
            SET status_task='dikerjakan'
            WHERE id_respond =$1
        `,[id_respond])

        res.status(200).json({
            message:"success"
        })
        
    } catch (error) {
        console.error("Error saat menerima pendaftar respond:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}   

//menolak responden
exports.rejResponden = async(req,res) =>{
    const{id_respond, id_responden} = req.body
    try {
        await query(`UPDATE respondent_application 
            SET status='ditolak'
            WHERE id_responden =$1 AND id_respond =$2`,
        [id_responden,id_respond])

        res.status(200).json({
            message:"berhasil menolak"
        })
        
    } catch (error) {
        console.error("gagal saat menolak responden:", error)
        res.status(500).json({
            message:"gagal menolak responden"
        })
        
    }
}
