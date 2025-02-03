const {query} = require('../db/index');
const midtransClient = require("midtrans-client");
const {moveDraftToSurvey} = require("./surveyController");
const {moveRespondDraftToRespond} = require("./respondController");

exports.midtransNotification = async (req, res) => {
    const { order_id, transaction_status, fraud_status, status_code } = req.body;
    console.log("📌 Midtrans Notification Received:", req.body);

    try {
        // Cek prefix pada order_id untuk membedakan survey dan respond
        if (order_id.startsWith('SURVEY')) {

            // Cek apakah pembayaran valid berdasarkan order_id untuk survey
            const paymentCheck = await query(`SELECT * FROM payment_table WHERE order_id = $1`, [order_id]);
            if (paymentCheck.rows.length === 0) {
                return res.status(404).json({ message: "Order ID tidak ditemukan" });
            }

            // Update status pembayaran berdasarkan notifikasi Midtrans
            if (transaction_status === "settlement" && fraud_status === "accept") {
                await query(`UPDATE payment_table SET status_payment = 'paid' WHERE order_id = $1`, [order_id]);
                await query(`UPDATE survey_draft_table SET status = 'paid' WHERE order_id = $1`, [order_id]);

                // Pindahkan Draft Survey ke Survey Table
                await moveDraftToSurvey(order_id);

            } else if (transaction_status === "pending") {
                console.log(`⌛ Pembayaran pending untuk Order ID Survey: ${order_id}`);
                await query(`UPDATE payment_table SET status_payment = 'pending' WHERE order_id = $1`, [order_id]);

            } else if (["expire", "cancel", "deny"].includes(transaction_status)) {
                console.log(`❌ Pembayaran gagal (${transaction_status}) untuk Order ID Survey: ${order_id}`);
                await query(`UPDATE payment_table SET status_payment = 'failed' WHERE order_id = $1`, [order_id]);
                await query(`UPDATE survey_draft_table SET status = 'failed' WHERE order_id = $1`, [order_id]);
            }

        } else if (order_id.startsWith('RESPOND')) {
            // Handle respond order
            console.log(`🔍 Menemukan Order ID Respond: ${order_id}`);

            // Cek apakah pembayaran valid berdasarkan order_id untuk respond
            const paymentCheck = await query(`SELECT * FROM payment_table WHERE order_id = $1`, [order_id]);
            if (paymentCheck.rows.length === 0) {
                console.error(`🚨 Order ID Respond ${order_id} tidak ditemukan di database!`);
                return res.status(404).json({ message: "Order ID tidak ditemukan" });
            }

            // Update status pembayaran berdasarkan notifikasi Midtrans
            if (transaction_status === "settlement" && fraud_status === "accept") {
                console.log(`✅ Pembayaran sukses untuk Order ID Respond: ${order_id}`);
                await query(`UPDATE payment_table SET status_payment = 'paid' WHERE order_id = $1`, [order_id]);
                await query(`UPDATE respond_draft_table SET status = 'paid' WHERE order_id = $1`, [order_id]);

                // Pindahkan Draft Respond ke Respond Table
                await moveRespondDraftToRespond(order_id); // Pastikan fungsi ini ada di respondController

            } else if (transaction_status === "pending") {
                console.log(`⌛ Pembayaran pending untuk Order ID Respond: ${order_id}`);
                await query(`UPDATE payment_table SET status_payment = 'pending' WHERE order_id = $1`, [order_id]);

            } else if (["expire", "cancel", "deny"].includes(transaction_status)) {
                console.log(`❌ Pembayaran gagal (${transaction_status}) untuk Order ID Respond: ${order_id}`);
                await query(`UPDATE payment_table SET status_payment = 'failed' WHERE order_id = $1`, [order_id]);
                await query(`UPDATE respond_draft_table SET status = 'failed' WHERE order_id = $1`, [order_id]);
            }

        } else {
            console.error(`❗ Order ID tidak valid untuk: ${order_id}`);
            return res.status(400).json({ message: "Invalid Order ID" });
        }

        // 3️⃣ Kirim response sukses ke Midtrans
        res.status(200).json({ message: "Notification received" });

    } catch (error) {
        console.error("🚨 Error during payment notification:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

//melakukan reimbursement