const net = require('net');
const JsonSocket = require('json-socket');
const process = require('process');

const port = 8333;
const host = '127.0.0.1';
const socket = new JsonSocket(new net.Socket());

const urlToTest = process.argv[2] || 'https://www.google.com';

socket.connect(port, host);
//Don't send until we're connected
socket.on('connect', function() {
    socket.sendMessage({url: urlToTest});
    socket.on('message', function(message) {
        console.log(message.result + ': ' + message.malicious);
    });
});
