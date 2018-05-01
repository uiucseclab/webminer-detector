var net = require('net');
var JsonSocket = require('json-socket');
var redis = require('redis');
var validUrl = require('valid-url');
var url = require("url");
var Fs = require('fs');
var tls = require("tls");

// Dependencies & Configurations for Profiler/Scanner
const {runChromeProfiler} = require('../scanner/profiler');
const {analyze} = require('../scanner/analyzer');
const ANALYSIS_DURATION = 5000; // 5 seconds
const WORKER_LIMIT = 5;

//for redis
var RDS_PORT = 6379;
var RDS_HOST = '127.0.0.1';
var RDS_PWD = 'cs460_project';
var RDS_OPTS = {auth_pass: RDS_PWD};
var rdsClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);

rdsClient.on('ready', function() {
    console.log('connect redis success!');
});
rdsClient.on('error', function(err) {
    console.log("redis error: " + err);
});

//parsing argument
var useSSL = false;
if (process.argv.indexOf("-s") > -1) {
    useSSL = true;
}

//for json tcp/ssl server
var port = 8333;
var server;
if (useSSL) {
    var tls_options = {
        key: Fs.readFileSync('./ssl/server.key'),
        cert: Fs.readFileSync('./ssl/server.crt'),
    };
    server = tls.createServer(tls_options);
    server.listen(port, function() {
        console.log('TLS cache server listening on %j', server.address());
    });
    server.on('secureConnection', handleConnection);
} else {
    server = net.createServer();
    server.listen(port, function() {
        console.log('TCP cache server listening on %j', server.address());
    });
    server.on('connection', handleConnection);
}

function handleConnection(socket) {
    //decorate net.Socket
    socket = new JsonSocket(socket);
    socket.on('message', function(message) {
        console.log('received: ' + message.url);
        //check url validation and do url cleaning here
        if (!validUrl.isUri(message.url)){
            console.log('Not a valid URL');
            socket.sendEndMessage({result: 'fail', reason: 'invalid url'});
            return;
        }

        var urlCheck = url.parse(message.url);
        // TODO: Decide on whether it's safe to only test the hostname.
        urlCheck = urlCheck.hostname;

        rdsClient.get(urlCheck, async function(err, data) {
            if(err) {
                socket.sendEndMessage({result: 'fail', reason: 'server error'});
                return;
            }
            if(data !== null) {
                console.log('[cache info] ' + data);
                socket.sendEndMessage({result: 'success', malicious: data});
                return;
            }

            //check number of scanner workers before profiling
            server.getConnections(async function(error, count) {
                console.log('check #sessions=' + count);
                if(count > WORKER_LIMIT) {
                    socket.sendEndMessage({result: 'fail', reason: 'worker limit'});
                    return;
                }
                //call profiling func.
                let maliciousLevel = null;
                try {
                    const profile = await runChromeProfiler(message.url, ANALYSIS_DURATION, [
                        '--headless'
                    ]);
                    if (profile)
                        maliciousLevel = analyze(...profile);
                } catch (err) {
                    console.log(err);
                    maliciousLevel = null;
                }

                if (maliciousLevel === null) {
                    socket.sendEndMessage({result: 'fail', reason: 'unknown level'});
                } else {
                    rdsClient.set(urlCheck, maliciousLevel, redis.print);
                    socket.sendEndMessage({result: 'success', malicious: maliciousLevel});
                }
            });
        })
    });
}

function connectRedis(rdsClient) {
    rdsClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);

    rdsClient.on('ready', function() {
        console.log('connect redis success!');
        return true;
    });
    rdsClient.on('error', function(err) {
        console.log("redis error: " + err);
        return false;
    });
    return true;
}
