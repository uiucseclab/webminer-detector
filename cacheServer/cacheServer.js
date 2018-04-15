var net = require('net');
var JsonSocket = require('json-socket');
var redis = require('redis');
var validUrl = require('valid-url');
var url = require("url");

// Dependencies & Configurations for Profiler/Scanner
const {runChromeProfiler} = require('../scanner/profiler');
const {analyze} = require('../scanner/analyzer');
const ANALYSIS_DURATION = 3000; // 3 seconds

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

//for json tcp server
var port = 8333;
var server = net.createServer();
server.listen(port, function() {
    console.log('server listening on %j', server.address());
});
server.on('connection', handleConnection);

function handleConnection(socket) {
    //decorate net.Socket
    socket = new JsonSocket(socket);
    socket.on('message', function(message) {
        console.log('received: ' + message.url);
        //check url validation and do url cleaning here
        if (!validUrl.isUri(message.url)){
            console.log('Not a valid URL');
            socket.sendEndMessage({result: 'fail'});
            return;
        }

        var urlCheck = url.parse(message.url);
        // TODO: Decide on whether it's safe to only test the hostname.
        urlCheck = urlCheck.hostname;

        rdsClient.get(urlCheck, async function(err, data) {
            if(err) {
                socket.sendEndMessage({result: 'fail'});
                return;
            }
            if(data !== null) {
                console.log('[cache info] ' + data);
                socket.sendEndMessage({result: 'success', malicious: data});
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
              socket.sendEndMessage({result: 'fail'});
              return;
            }

            rdsClient.set(urlCheck, maliciousLevel, redis.print);
            socket.sendEndMessage({result: 'success', malicious: maliciousLevel});
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
