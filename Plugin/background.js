var blockedsites = [];
var whitelists = [];
// chrome.storage.sync.get(['White'],function(data){
//   if(data.list != undefined){
//     whitelists = data.key;}
//   });
//   chrome.storage.sync.get(['Black'],function(data){
//     if(data.list != undefined){
//       blockedsites = data.key;}
//     });
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
          if(whitelists.indexOf(currentUrl)>-1){
            console.log("???");
          }
          else if (blockedsites.indexOf(currentUrl)>-1){
            console.log("wtf");
            chrome.tabs.remove(id,function(){});
          }
          else{
            var request = new XMLHttpRequest();
            var data = JSON.stringify({'url':currentUrl});
            request.open("POST","http://mark1.sytes.net:8080",true);
            request.setRequestHeader("Content-Type","application/json");
            // request.setRequestHeader("Content-Length",data.length);
            request.onreadystatechange = function(){
              if (request.readyState == 4){
                var body = request.responseText;
                console.log("if this is the issue");
                if(body.slice(11,18) == "success"){
                  var maliciousLevel = body.split(':')[2][1];
                  if(maliciousLevel == 3){//safe
                    storeWhitelist(currentUrl);
                  }
                  else if(maliciousLevel == 2){//not sure
                    alert("The website you are about to enter is potentially malicious, click to continue");
                  }
                  else if (maliciousLevel == 1){
                    storeBlacklist(currentUrl);
                    alert("The website you are about to enter is malicious and will be closed");
                    chrome.tabs.remove(id,function(){});
                  }
                  else{
                  }
                }
              }
            }
            request.send(data);
          }
        });
      }
    });
    function storeWhitelist(url){
      whitelists.push(url);
      // chrome.storage.sync.set({White:whitelists},function(){});
    }
    function storeBlacklist(url){
      blockedsites.push(url);
      // chrome.storage.sync.set({Black:blockedsites},function(){});
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
    // chrome.webRequest.onBeforeRequest.addListener(
    //   function(details){if(blockedsites.length !=0){return {cancel:true};}},{urls:[retriveBlockedUrl()]},["blocking"]);
