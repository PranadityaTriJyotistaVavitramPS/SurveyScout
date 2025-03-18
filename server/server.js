require("dotenv").config();
const express = require("express");
const app = express();
const db = require("./db");
const multer = require('multer');
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({extended: true}));


const corsOptions = {
  origin: ["*"], 
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true,
};

app.use(cors(corsOptions));


//import Routes
const clientRoutes = require("./routes/clientRoutes");
const surveyRoutes = require("./routes/surveyRoutes");
const surveyorRoutes = require("./routes/surveyorRoutes");
const respondRoutes = require("./routes/respondRoutes");
const respondentRoutes = require("./routes/respondentRoutes");
const respondentApplyRoutes = require("./routes/respondentApplyRoutes");
const surveyorApplyRoutes = require("./routes/surveyorApplyRoutes");
const midtransRoutes = require("./routes/midtransRoutes");
const usersRoutes = require("./routes/usersRoutes");
const otpRoutes = require("./routes/otpRoutes");
const projects = require("./routes/projectRoutes")



//base routes
app.use("/api/v1/clients",clientRoutes); //akses client api
app.use("/api/v1/surveys",surveyRoutes); //akses project survey api
app.use("/api/v1/surveyors",surveyorRoutes); //akses surveyor api
app.use("/api/v1/responds",respondRoutes); // akses  porject respond api
app.use("/api/v1/respondents",respondentRoutes); // akses responden
app.use("/api/v1/respondentapplies",respondentApplyRoutes); //akses pendaftaran ke suatu project respond
app.use("/api/v1/surveyorapplies",surveyorApplyRoutes) // akses pendaftaran  ke suatu project surveyor
app.use("/api/v1/midtransNotif",midtransRoutes) //akses payment
app.use("/api/v1/users",usersRoutes); //akses tabel user (untuk login aja)
app.use("/api/v1/routes",otpRoutes); // akses kode otp
app.use("/api/v1/projects",projects)


//untuk error apabila routes tidak ada
app.use((req,res,next) => {
  res.status(404).json({ error: "API Route Not Found"})
})

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});