require("dotenv").config();
const express = require("express");
const app = express();
const db = require("./db");
const multer = require('multer')

app.use(express.json());
app.use(express.urlencoded({extended: true}));

//import Routes
const clientRoutes = require("./routes/clientRoutes");
const surveyRoutes = require("./routes/surveyRoutes");
const surveyorRoutes = require("./routes/surveyorRoutes");
const respondRoutes = require("./routes/respondRoutes");
const respondentRoutes = require("./routes/respondentRoutes");
const respondentApplyRoutes = require("./routes/respondentApplyRoutes");
const surveyorApplyRoutes = require("./routes/surveyorApplyRoutes");
const midtransRoutes = require("./routes/midtransRoutes")
const test = require('./routes/upload');


//base routes
app.use("/api/v1/clients",clientRoutes);
app.use("/api/v1/surveys",surveyRoutes);
app.use("/api/v1/surveyors",surveyorRoutes);
app.use("/api/v1/responds",respondRoutes);
app.use("/api/v1/respondents",respondentRoutes);
app.use("/api/v1/respondentapplies",respondentApplyRoutes);
app.use("/api/v1/surveyorapplies",surveyorApplyRoutes)
app.use("/api/v1/midtransNotif",midtransRoutes)
app.use(test);

//untuk error apabila routes tidak ada
app.use((req,res,next) => {
  res.status(404).json({ error: "API Route Not Found"})
})

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});