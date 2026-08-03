import http from "node:http";
const port=Number(process.env.PORT??3000);
http.createServer((request,response)=>{response.writeHead(request.url==="/health"?200:404,{"content-type":"application/json"});response.end(JSON.stringify({ok:request.url==="/health"}));}).listen(port);
