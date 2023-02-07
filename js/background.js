console.log('Background js loaded..')

chrome.webRequest.onBeforeRequest.addListener(
  function(request) {
    // console.log(request.method)
    // console.log(request.url)
    // console.log(request.url.indexOf('evergage.com/api2/event/engage?event='))
    // https://cdn.evgnet.com/beacon/adpinc/prod/scripts/evergage.min.js
    if(request.method == 'GET' 
      && request.url.indexOf('evergage.com/api2/event/') > -1) 
    {
      var url = new URL(decodeURIComponent(request.url));
      var encodedString = url.search.replace('?event=','')
      var decodedString = atob(encodedString);
      var decodedJson = JSON.parse(decodedString);
      console.log("inside onBeforeRequest + all urls", request);
      console.log(decodedJson);

      //Store content in below format 
      // {
      //   'thesource.ca' : {
      //     '1675724720822' : {
      //       'url' : 'https://thesource.us-1.evergage.com/api2/event/engage?event=eyJhY3Rpb24iOiJob21lcGFnZSIsIml0ZW1BY3Rpb24iOm51bGwsInNvdXJjZSI6eyJwYWdlVHlwZSI6ImhvbWVwYWdlIiwibG9jYWxlIjoiZW5fQ0EiLCJjb250ZW50Wm9uZXMiOlsiZ2xvYmFsX3NsaXZlciIsImhvbWVwYWdlX2hlcm8iLCJob21lcGFnZV9mZWF0dXJlIiwiaG9tZXBhZ2VfbW9yZV9mcm9tX3NvdXJjZSIsImhvbWVwYWdlX21vcmVfZnJvbV9zb3VyY2UyIiwiaG9tZXBhZ2VfbW9yZV9mcm9tX3NvdXJjZTMiLCJob21lcGFnZV9zdXJ2ZXkiLCJob21lcGFnZV9pbWFnZV93cmFwIl0sInVybCI6Imh0dHBzOi8vd3d3LnRoZXNvdXJjZS5jYS9lbi1jYSIsInVybFJlZmVycmVyIjoiIiwiY2hhbm5lbCI6IldlYiIsImJlYWNvblZlcnNpb24iOjE2LCJjb25maWdWZXJzaW9uIjoiNzIifSwiZmxhZ3MiOnsicGFnZVZpZXciOnRydWV9LCJ1c2VyIjp7ImF0dHJpYnV0ZXMiOnsiY3VzdG9tZXJUeXBlIjoiQjJDIiwibG9nZ2VkSW5TdGF0dXMiOiJub3RMb2dnZWRJbiJ9LCJhbm9uSWQiOiIxYzNjNzBkZjU1YWY1YmNiIiwiZW5jcnlwdGVkSWQiOiJnQ21UOG53aVFWWFVSdzJJTThiNjB4eUtYSHRvMVdLeDY4eEdLQWZoZHVRMXZtQ3dna21OWVRpNVJPYXJVYmY0ejk4UUVvQXBoTnV6THNvRmZkdDdKVmFoMGRPZ3AwbHBTR25ORldVczg5dVFDek53VDBUbWxoVHRFMmhSZkFGXyJ9LCJwZXJmb3JtYW5jZSI6e30sImRlYnVnIjp7ImV4cGxhbmF0aW9ucyI6dHJ1ZX0sImNhdGFsb2ciOnt9LCJjb25zZW50cyI6W10sImFjY291bnQiOnt9LCJfdG9vbHNFdmVudExpbmtJZCI6IjExNzM4NjcwNjU1NjUzNjgyIn0%3D',
      //       'payload' : decodedJson
      //     }
      //   }
      // }


      var epocheDate = Date.now().toString();
      var payload = decodedJson;
      var hostName = url.hostname; //window.location.hostname.toString();
      //var url = request.url; 

      var isPayload = {} 
      isPayload[epocheDate] = {}
      isPayload[epocheDate]['url'] = request.url;
      isPayload[epocheDate]['payload'] = payload;
      isPayload[epocheDate]['datetime'] = Date.now();

      chrome.storage.local.get(null, function(originalPayload){
        console.log('Previous payload ' , originalPayload);
        if(Object.keys(originalPayload).includes(hostName)) {
          originalPayload[hostName].push(isPayload);
          console.log('Host name exists ')
        } else {
          originalPayload[hostName] = [];
          originalPayload[hostName].push(isPayload);
        }
        chrome.storage.local.set(originalPayload, function(){
          console.log(originalPayload , ' is saved to local storage.')
        });
      });
    }
    
  },
  {urls: [ "<all_urls>"]},
  []
); 
