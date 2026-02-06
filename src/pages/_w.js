const fs=require("fs");
const chunks=[];
process.stdin.setEncoding("utf8");
process.stdin.on("data",(c)=>chunks.push(c));
process.stdin.on("end",()=>{
const data=chunks.join("");
const sep="===FILE===";
const parts=data.split(sep);
for(let i=0;i<parts.length-1;i+=2){
const name=parts[i].trim();
const content=parts[i+1];
if(name){fs.writeFileSync("C:/Users/Usuario/Desktop/San Javier Academy Manager/src/pages/"+name,content);console.log("Written:"+name);}
}
});
