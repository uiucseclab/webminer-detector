var http = require('http');
var https = require('https');
const process = require('process');
var tls = require("tls");
var Fs = require('fs');

const urlToTest = process.argv[2] || 'https://www.google.com';

//parsing argument
var useSSL = false;
if (process.argv.indexOf("-s") > -1) {
    useSSL = true;
}

const postData = JSON.stringify({'url': urlToTest});
const options = {
    hostname: 'mark1.sytes.net',
    port: 8080,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
};

if(useSSL) {
    // const ssl_options = {
    //     // Necessary only if using the client certificate authentication
    //     //key: Fs.readFileSync('client-key.pem'),
    //     //cert: Fs.readFileSync('client-cert.pem')
    //     // Necessary only if the server uses the self-signed certificate
    //     //ca: [ Fs.readFileSync('./ssl/server.crt') ]
    //     rejectUnauthorized: false //just for test
    // };
    options.rejectUnauthorized = false; //for test
    const req = https.request(options, handleResponse);
    // write data to request body
    req.write(postData);
    req.end();
} else {
    const req = http.request(options, handleResponse);
    // write data to request body
    req.write(postData);
    req.end();
}

function handleResponse(response) {
    if (response.statusCode == 200) {
        var body = "";
        response.on('data', function(data) {
            body += data;
        });
        response.on('end', function() {
            var message = JSON.parse(body);
            if(message.result == 'success') {
                console.log(message.result + ': ' + message.malicious);
            } else {
                console.log(message.result + ': ' + message.reason);
            }
        });
    } else {
        console.log('http request fail');
    }
}
