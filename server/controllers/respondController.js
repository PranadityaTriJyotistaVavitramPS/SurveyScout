const {query} = require('../db/index');
const midtransClient = require('midtrans-client');

//membuat draft respond
exports.createRespondDraft = async(req,res) =>{
    const{id_client,nama_proyek,deskripsi_proyek, tenggat_pengerjaan, 
        demografis_responden, kompensasi, metode_survey, 
        kualifikasi, jumlah_responden
    } = req.body

    try {
        //membuat order_id untuk respond
        const order_id = `RESPOND-${Date.now()}`;

        const kualifikasiArray = Array.isArray(kualifikasi) ? kualifikasi : JSON.parse(kualifikasi);

        //memasukkan ke draft respond
        const draft = await query(`INSERT INTO respond_draft_table 
            (id_client,nama_proyek,deskripsi_proyek, tenggat_pengerjaan, demografis_responden, kompensasi, metode_survey, status, kualifikasi,
            jumlah_responden,order_id) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8::TEXT[],$9,$10)
        `,[id_client,nama_proyek,deskripsi_proyek,tenggat_pengerjaan,demografis_responden,kompensasi,metode_survey,kualifikasiArray,jumlah_responden,
            order_id
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
    const{id_draft} = req.body

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

        //membuat payment_table
        await query(`INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
            VALUES($1,$2,$3,'pending','pending')`,
        [order_id,total_kompensasi,id_client]);

        //buat transaksi midtrans

        let parameter = {
            "transaction_details": {
                'order_id': order_id,
                'gross_amount': total_kompensasi
            },
            "customer_details": {
                'email': email,
                'phone': phone_number
            }
        };

        const transaction = await snap.createTransaction(parameter);

        res.status(201).json({
            message: "Pembayaran berhasil dibuat",
            order_id: order_id,
            snap_url: transaction.redirect_url,
            token:transaction.token
        });



    } catch (error) {
        console.error("Error saat membuat respond payment:",error);
        res.status(500).json({ message: "Internal Server Error" });
    }

}

//memindahkan draft ke tabel respond
exports.moveDraftToRespond = async(req,res) =>{
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
        draft.kualifikasi = typeof draft.kualifikasi === 'string' ? draft.keahlian.replace(/[{}"]/g, "").split(",") : draft.kualifikasi;

        //Insert data ke `respond_table`
        await query(`
            INSERT INTO respond_table 
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, demografis_responden, metode_survey,kualifikasi, kompensasi)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,[
            draft.id_client, draft.nama_proyek, draft.deskripsi_proyek, 
            draft.tenggat_pengerjaan, draft.demografis_responden, draft.metode_survey, 
            draft.kualifikasi, draft.kompensasi
        ]);

        //Hapus dari `survey_draft_table`
        await query(`DELETE FROM respond_draft_table WHERE order_id = $1`, [order_id]);
        console.log(`✅ Draft respond dengan Order ID: ${order_id} berhasil dipindahkan ke respond_table`);

    } catch (error) {
        console.error("❌ Error saat memindahkan draft ke respond:", error);
        res.status(500).json({message:"Internal Server Error"});
    }
}

//mengambil salah satu task respond
exports.getAResponTask = async(req,res) =>{
    const {id_respond} = req.body
    try {
        const result = await query(`SELECT * FROM respond_table WHERE id_respond =$1`,[id_respond]);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"respond task tidak ditemukan"
            })
        }

        res.status(200).json({
            status:"success",
            data: result.rows[0]
        })
    } catch (error) {
        console.error("error ketika mengambil sebuah respond task :",error);
        res.status(500).json({message:"Internal Server Error"});
        
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

        res.status(200).json({
            status:"success",
            data:result.rows
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