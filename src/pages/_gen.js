const fs=require("fs");
const p="C:/Users/Usuario/Desktop/San Javier Academy Manager/src/pages";
const b64File=p+"/"+process.argv[2]+".b64";
const outFile=p+"/"+process.argv[2];
const content=fs.readFileSync(b64File,"utf8");
fs.writeFileSync(outFile,Buffer.from(content,"base64").toString("utf8"));
fs.unlinkSync(b64File);
console.log("Written:",outFile);
