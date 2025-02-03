const {query} = require('../db/index');
const midtransClient = require("midtrans-client");


//memasukkan task yang telah dibuat ke draft (belum dilakukan pembayaran)
exports.createSurveyDraft = async(req,res) =>{
    const{id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, alamat, keahlian, 
        kompensasi,tipe_hasil
    } = req.body

    try {
        //ngebuat order_id
        const order_id = `SURVEY-${Date.now()}`;

        const keahlianArray = Array.isArray(keahlian) ? keahlian : JSON.parse(keahlian);
        const tipeHasilArray = Array.isArray(tipe_hasil) ? tipe_hasil : JSON.parse(tipe_hasil);


        //menyimpan data survey di draft
        const draft = await query(`
            INSERT INTO survey_draft_table 
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, alamat, keahlian, kompensasi, status, order_id, tipe_hasil)
            VALUES ($1,$2,$3,$4,$5,$6,$7::TEXT[],$8,'pending',$9,$10::TEXT[]) RETURNING *`,
            [id_client,nama_proyek,deskripsi_proyek,tenggat_pengerjaan,lokasi,alamat,keahlianArray,kompensasi,order_id,tipeHasilArray]
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
    const { id_draft } = req.body;

    try {
        //mengambil data dari draft
        const draftData = await query(`SELECT id_client, kompensasi, order_id FROM survey_draft_table WHERE id_draft = $1`,[id_draft]);
        if(draftData.rows.length === 0){
            return res.status(404).json({
                message:"draft not found"
            })
        }
        const survey = draftData.rows[0];
        const{id_client,kompensasi,order_id} = survey;
        const total_kompensasi = parseFloat(kompensasi) + 5000;

        //mengambil data dari client
        const clientData = await query(`SELECT email,nomor_telepon FROM client_table WHERE id_client = $1`,[id_client])
        if(clientData.rows.length === 0){
            return res.status(404).json({
                message:"client not found"
            })
        }

        const client = clientData.rows[0];
        const {email,nomor_telepon} = client
        const phone_number = nomor_telepon || "0000000000";

        //buat payment info di payment_table
        await query(`
            INSERT INTO payment_table (order_id, jumlah_harga, id_client, status_payment, status_release)
            VALUES ($1, $2, $3, 'pending', 'pending')
        `, [order_id, total_kompensasi, id_client]);
        

        //Buat transaksi di Midtrans
        let snap = new midtransClient.Snap({
            isProduction: false,
            serverKey: process.env.MIDTRANS_SERVER_KEY
        });

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

        //Kirim URL pembayaran ke frontend
        res.status(201).json({
            message: "Pembayaran berhasil dibuat",
            order_id: order_id,
            snap_url: transaction.redirect_url,
            token:transaction.token
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
            (id_client, nama_proyek, deskripsi_proyek, tenggat_pengerjaan, lokasi, alamat, keahlian, kompensasi, tipe_hasil)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,[
            draft.id_client, draft.nama_proyek, draft.deskripsi_proyek, 
            draft.tenggat_pengerjaan, draft.lokasi, draft.alamat, 
            draft.keahlian, draft.kompensasi,draft.tipe_hasil
        ]);

        //Hapus dari `survey_draft_table`
        await query(`DELETE FROM survey_draft_table WHERE order_id = $1`, [order_id]);
        console.log(`✅ Draft survey dengan Order ID: ${order_id} berhasil dipindahkan ke survey_table`);

    } catch (error) {
        console.error("❌ Error saat memindahkan draft ke survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

//mengambil sebuah task (ScoutingSurvey)
exports.getASurveyTask = async(req,res) =>{
    const {id_survey} = req.body;
    try {
        result = await query(`SELECT * FROM survey_table WHERE id_survey = $1`,[id_survey])
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"survey task not found"
            })
        }

        res.status(200).json({
            status:"success",
            data: result.rows[0]
        })
    } catch (error) {
        console.error("❌ Error saat mengambil sebuah data survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//menampilkan seluruh task(Scouting Survey)
exports.getAllSurveyTask = async(req,res) =>{
    try {
        const result = await query(`SELECT * FROM survey_table`);
        if(result.rows.length === 0){
            return res.status(404).json({
                message:"no survey task found"
            })
        }

        res.status(200).json({
            status:"success",
            data:result.rows
        })
        
    } catch (error) {
        console.error("❌ Error saat mengambil sebuah data survey:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

//mengedit sebuah task (Scouting Survey)

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