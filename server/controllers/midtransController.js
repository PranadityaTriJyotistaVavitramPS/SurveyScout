const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const {moveDraftToSurvey} = require("./surveyController");
const {moveDraftToRespond} = require("./respondController");

exports.midtransNotification = async (req, res) => {
    const { order_id, transaction_status, fraud_status, transaction_id } = req.body;
    console.log("📌 Midtrans Notification Received:", req.body);

    try {
        if (order_id.startsWith('SURVEY')) {
            // Cek apakah pembayaran valid berdasarkan order_id untuk survey
            const paymentCheck = await query(`SELECT * FROM payment_table WHERE order_id = $1`, [order_id]);
            if (paymentCheck.rows.length === 0) {
                return res.status(404).json({ message: "Order ID tidak ditemukan" });
            }
            if (transaction_status === "settlement" && fraud_status === "accept") {
                await query(`UPDATE survey_draft_table SET status_pembayaran = 'paid' WHERE order_id = $1`, [order_id]);
                await moveDraftToSurvey(order_id);
            } else if (transaction_status === "pending") {
                await query(`UPDATE payment_table SET status_payment ='pending', id_transaksi_midtrans=$1 WHERE order_id = $2`, [transaction_id,order_id]);
            } else if (transaction_status === "expire" || transaction_status ==='cancel' || transaction_status ==='deny' || transaction_status ==='failure') {
                await query(`UPDATE survey_draft_table SET status_pembayaran = 'failed' WHERE order_id = $1`, [order_id]);
            }

        } else if (order_id.startsWith('RESPOND')) {
            
            const paymentCheck = await query(`SELECT * FROM payment_table WHERE order_id = $1`, [order_id]);
            if (paymentCheck.rows.length === 0) {
                return res.status(404).json({ message: "Order ID tidak ditemukan" });
            }

            // Update status pembayaran berdasarkan notifikasi Midtrans
            if (transaction_status === "settlement" && fraud_status === "accept") {
                await query(`UPDATE respond_draft_table SET status = 'paid' WHERE order_id = $1`, [order_id]);

                await moveDraftToRespond(order_id); 

            } else if (transaction_status === "pending") {
                await query(`UPDATE payment_table SET status_payment ='pending', id_transaksi_midtrans=$1 WHERE order_id = $2`, [transaction_id,order_id]);

            } else if (["expire", "cancel", "deny"].includes(transaction_status)) {
                await query(`UPDATE respond_draft_table SET status = 'failed' WHERE order_id = $1`, [order_id]);
            }
        } else {
            console.error(`Order ID tidak valid untuk: ${order_id}`);
            return res.status(400).json({ message: "Invalid Order ID" });
        }
        res.status(200).json({
            message:"notifikasi midtrans masuk"
        })
    } catch (error) {
        console.error("Error during midtrans notification:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


//response untuk notif midtrans
exports.midtransResponse = async(req,res) =>{
    const {order_id} = req.body
    let snap = new midtransClient.Snap({
        isProduction: false,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    try {
        const status = await snap.transaction.status(order_id)
        if(status.transaction_status == 'expire')
        {
            await query(`UPDATE payment_table SET status_payment='failed' WHERE order_id = $1`, [order_id]);
        } else if(status.transaction_status == 'settlement'){
            await query(`UPDATE payment_table SET status_payment = 'paid' WHERE order_id = $1`, [order_id]);
        }
        res.status(200).json({
            message:"menerima notifikasi",
            status:status
        })
        
    } catch (error) {
        console.error("error saat berusaha memberikan response dari callback midtrans",error)
        res.status(500).json({message:"Internal Server Error awikwok"})
    }
}