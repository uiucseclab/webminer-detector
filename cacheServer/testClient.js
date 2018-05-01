const net = require('net');
const JsonSocket = require('json-socket');
const process = require('process');
var tls = require("tls");
var Fs = require('fs');

const port = 8333;
const host = 'mark1.sytes.net';
var socket;

const urlToTest = process.argv[2] || 'https://www.google.com';

//parsing argument
var useSSL = false;
if (process.argv.indexOf("-s") > -1) {
    useSSL = true;
}

if(useSSL) {
    const ssl_options = {
        // Necessary only if using the client certificate authentication
        //key: Fs.readFileSync('client-key.pem'),
        //cert: Fs.readFileSync('client-cert.pem')
        // Necessary only if the server uses the self-signed certificate
        //ca: [ Fs.readFileSync('./ssl/server.crt') ]
        rejectUnauthorized: false //just for test
    };
    socket = tls.connect(port, host, ssl_options);
    socket = new JsonSocket(socket);
    socket.on('secureConnect', function() {
        socket.sendMessage({url: urlToTest});
        socket.on('message', function(message) {
            if(message.result == 'success') {
                console.log(message.result + ': ' + message.malicious);
            } else {
                console.log(message.result + ': ' + message.reason);
            }
        });
    });

} else {
    socket = new JsonSocket(new net.Socket());
    socket.connect(port, host);
    //Don't send until we're connected
    socket.on('connect', function() {
        socket.sendMessage({url: urlToTest});
        socket.on('message', function(message) {
            if(message.result == 'success') {
                console.log(message.result + ': ' + message.malicious);
            } else {
                console.log(message.result + ': ' + message.reason);
            }
        });
    });
}
