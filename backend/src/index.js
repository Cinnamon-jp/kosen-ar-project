import express from "express";
const app = express();
const port = 3000;
app.use(express.static("./models"));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
