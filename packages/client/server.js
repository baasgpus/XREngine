const path = require('path');
const fs = require('fs');
const express = require('express');
const expressStaticGzip = require('express-static-gzip');
const packageRoot = require('app-root-path').path;
const https = require('https');
const http = require('http');


const app = express();
const PORT = process.env.HOST_PORT || 3000;
const HTTPS = process.env.VITE_LOCAL_BUILD ?? false

app.use(expressStaticGzip(path.join(packageRoot, 'packages', 'client', 'dist'), {
  enableBrotli: true
}));
app.use('*', (req, res) => res.sendFile(path.join(packageRoot, 'packages', 'client', 'dist', 'index.html')));

app.listen = function () {
  let server
  if(HTTPS) {
    const key = fs.readFileSync(path.join(packageRoot.path, 'certs/key.pem'))
    const cert = fs.readFileSync(path.join(packageRoot.path, 'certs/cert.pem'))
    server = https.createServer({key: key, cert: cert }, this);
  } else {
    server = http.createServer(this)
  }
  return server.listen.apply(server, arguments)
}

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));