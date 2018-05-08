Description
=======
cacheServer together with scanner provide a service to allow user clients to scan any website to see whether it is a malicious webminer, a safe non-mining webpage, or a suspicious webpage using too much CPU. cacheServer basically can do two things that we describe below.
### 1. Serve user request
Any client (chrome plugin, mobile app, etc) who wants to use our service can request HTTP/HTTPS POST to 8080 port on our server with formats like

```
POST / HTTP/1.1
Content-Type: application/json
Content-Length: 34
Host: mark1.sytes.net:8080
Connection: close

{"url":"https://www.facebook.com"}
```
If success, the response message is like

```
{"result":"success","malicious":"3"}
```
meaning of the number in "malicious" field:

* webpage is Safe = 3
* webpage is Suspicious = 2
* webpage is Malicious = 1

If fail, the response message is like

```
{"result":"fail", "reason":"worker limit"}
```
meaning of the "reason" field:

* **invalid request:** the request format is wrong
* **invalid url:** the url format is wrong, it should be strictly in the form of http:// or https://
* **server error:** something wrong on server
* **worker limit:** we currently limit the number of user sessions to 5 since the analysis results of our scanner suffers from degradation when cpu usage become intense
* **unknown level:** scanner cannot decide on the malicious level

### 2. Cache
cacheServer utilize Redis to cache the historical analysis results. We also create a whitelist and a blacklist before online.


Usage
--------
1. Go to cacheServer directory and run `npm install`
2. run `node testClient.js [url]` to test

Deploy
--------
We currently deploy our service on mark1.sytes.net.
You can also deploy your own by the following step:

1. Download and install Redis: <https://redis.io/download>, then execute it in daemon mode
2. Go to both `scanner` and `cacheServer` directory and run `npm install`3
3. In `cacheServer` directory, run `nohup node cacheServer.js -s &` with HTTPS or `nohup node cacheServer.js &` for HTTP only

