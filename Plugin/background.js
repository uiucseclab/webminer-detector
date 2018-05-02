var blockedsites = [];
var whitelists = [];
chrome.storage.sync.get({White:[]},function(data){
  if(data.list != undefined){
  whitelists = data.list;}
});
chrome.storage.sync.get({Black:[]},function(data){
  if(data.list != undefined){
  blockedsites = data.list;}
});
// require(['require','net','json-socket','process','tls','fs'], function (require){
//   const net = require('net');
//   const JsonSocket = require('json-socket');
//   const process = require('process');
//   var tls = require("tls");
//   var Fs = require('fs');
// });
// const port = 8333;
// const host = 'mark1.sytes.net';
// var socket;
// var useSSL = false;
//profiler connection setup
function getUpdateTabData(callback) {//helper function
  var queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var title = tab.title;
    var id = tab.id;
    var url = tab.url;
    callback(title, id, url);
  });
}
chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab){//send the url to profiler and check results
  if(changeInfo.url){
    getUpdateTabData(function(title,id,currentUrl){
      // chrome.tabs.remove(id,function(){});
      // alert(url);
      // blockedsites.push(url);
      // alert(blockedsites[0]);
    });
  }
});
function storeWhitelist(url){
  whitelists.push(url);
  chrome.storage.sync.set({White:whitelists},function(){});
}
function storeBlacklist(url){
  blockedsites.push(url);
  chrome.storage.sync.set({Black:blockedsites},function(){});
}
function retriveBlockedUrl(){
  var RetUrl = "";
  for (var i = 0;i<blockedsites.length;i++){
    RetUrl = RetUrl + "\"" + blockedsites[i] + "\"";
    if(i != blockedsites.length - 1){
      RetUrl += ",";
    }
  }
  if(blockedsites.length == 0){
    return "<all_urls>"
  }
  return RetUrl;
}
chrome.webRequest.onBeforeRequest.addListener(
  function(details){if(blockedsites.length !=0){return {cancel:true};}},{urls:[retriveBlockedUrl()]},["blocking"]);
