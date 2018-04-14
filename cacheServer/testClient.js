var net = require('net');
var JsonSocket = require('json-socket');

var port = 8333;
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket());
socket.connect(port, host);
//Don't send until we're connected
socket.on('connect', function() {
    socket.sendMessage({url: 'https://www.google.com'});
    socket.on('message', function(message) {
        console.log(message.result + ': ' + message.malicious);
    });
});