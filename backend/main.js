import t from"express";import e from"cors";var o=t(),s=3e3;o.use(e());o.use("/models",t.static("./models"));o.listen(s,()=>{console.log(`Server is running at http://localhost:${s}`)});
