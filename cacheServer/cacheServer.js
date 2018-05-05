var http = require('http');
var https = require('https')
var redis = require('redis');
var validUrl = require('valid-url');
var url = require("url");
var Fs = require('fs');
//var tls = require("tls");

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

//for http server
var port = 8080;
var server;
if (useSSL) {
    var https_options = {
        key: Fs.readFileSync('./ssl/server.key'),
        cert: Fs.readFileSync('./ssl/server.crt'),
    };
    server = https.createServer(https_options);
    server.listen(port, function() {
        console.log('HTTPS cache server listening on %j', server.address());
    });
    server.on('request', handleRequest);
} else {
    server = http.createServer();
    server.listen(port, function() {
        console.log('HTTP cache server listening on %j', server.address());
    });
    server.on('request', handleRequest);
}

function handleRequest(req, res) {
    if(req.method == 'GET') {
        return;
    }
    var messageStr = "";
    req.on('data', function(chunk) {
        messageStr += chunk;
    });

    req.on('end', function() {
        res.setHeader('Content-Type', 'application/json');
        var message;
        try {
            message = JSON.parse(messageStr);
        } catch (err) {
            console.log(err);
            res.end(JSON.stringify({result: 'fail', reason: 'invalid request'}));
            return;
        }
        console.log('received: ' + message.url);
        //check url validation and do url cleaning here
        if (!validUrl.isUri(message.url)){
            console.log('Not a valid URL');
            res.end(JSON.stringify({result: 'fail', reason: 'invalid url'}));
            return;
        }

        var urlCheck = url.parse(message.url);
        // TODO: Decide on whether it's safe to only test the hostname.
        urlCheck = urlCheck.hostname;

        rdsClient.get(urlCheck, async function(err, data) {
            if(err) {
                res.end(JSON.stringify({result: 'fail', reason: 'server error'}));
                return;
            }
            if(data !== null) {
                console.log('[cache info] ' + data);
                res.end(JSON.stringify({result: 'success', malicious: data}));
                return;
            }

            //check number of scanner workers before profiling
            server.getConnections(async function(error, count) {
                console.log('check #sessions=' + count);
                if(count > WORKER_LIMIT) {
                    res.end(JSON.stringify({result: 'fail', reason: 'worker limit'}));
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
                    res.end(JSON.stringify({result: 'fail', reason: 'unknown level'}));
                } else {
                    rdsClient.set(urlCheck, maliciousLevel, redis.print);
                    res.end(JSON.stringify({result: 'success', malicious: maliciousLevel}));
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
