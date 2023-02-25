//TODO: When clearall is clicked, clear the payload text
/* $('#atob').on('change', function() {
  console.log('Encoded String ' , $(this).val());
  
  var encodedString = $('#atob').val();
  var decodedString = atob(encodedString);
  var decodedJson = JSON.parse(decodedString);
  console.log(decodedJson);

  $('#decodedJson').html(JSON.stringify(decodedJson, null, 4));
}); */

document.getElementById('BtnRefresh').addEventListener('click', init);
document.getElementById('BtnClear').addEventListener('click', clearAll);

var txtAreaField = document.getElementById('atob');
txtAreaField.addEventListener('input', function() {
  
  //console.log('Encoded Text' + txtAreaField.value);
  var encodedString = txtAreaField.value;
  try { 
    var decodedString = atob(encodedString);
    var decodedJson = JSON.parse(decodedString);
    //console.log(decodedJson);


    //var decodedJsonDiv = document.getElementById('decodedJson');
    //decodedJsonDiv.innerHTML = "";
    //decodedJsonDiv.appendChild(document.createTextNode(JSON.stringify(decodedJson, null, 4)));


    generateJsonViewer(decodedJson);
    //$('#decodedJson').html(JSON.stringify(decodedJson, null, 4));
  }catch(e) {
    var errorDiv = 
    $('#json').empty().html('<font color="red">Error: Invalid Base64 text</font>')
    //var decodedJsonDiv = document.getElementById('json');
    //decodedJsonDiv.innerHTML = "";
    //decodedJsonDiv.appendChild(document.createTextNode('Error: Invalid Base64 text'));
  }
});



// Filling Accordian 

/*function sortObject(o) {
  console.log('Sort Object has ', o)
  var sorted = {},
  key, a = [];

  for (key in o) {
      if (o.hasOwnProperty(key)) {
          a.push(key);
      }
  }

  a = a.reverse();
  console.log('Reverse sorted ' , a)

  for (key = 0; key < a.length; key++) {
      sorted[a[key]] = o[a[key]];
  }
  return sorted;
}*/


async function getData() {
  return new Promise( (resolve, reject) => {
    chrome.storage.local.get(null, function(items){
      //console.log('items in getData ', items);
      /* for(k in Object.keys(items)) {
        var keysArray = [];
        for(i in o) {
            keysArray.push(Object.keys(o[i])[0])
        }
        keysArray.reverse();
      }

      sortedItems = {}
      for(k in Object.keys(items)) {
        sortedItems[Object.keys(items)[k]] = sortObject(items[Object.keys(items)[k]])
      }
      console.log('Sorted Items ' , sortedItems) */
      resolve(items);
    });
  });
}

async function init() {
  var o = await getData();
  
  //console.log(Object.keys(o))

  var listOfSites = Object.keys(o);

  document.getElementById('accordionExample').innerHTML = ''; //Clear for first time
  for(l in listOfSites) {
    var accordionHtml = generateAccordianItems(l, listOfSites[l]);
    document.getElementById('accordionExample').appendChild(accordionHtml);

  }


  function generateAccordianItems(itemNumber, hostName) {
    //console.log(hostName)

    var tableItems = '';
    var savedItems = o[hostName];

    var htmlBulletCounter = 1;
    for(var item = savedItems.length-1; item >= 0 ; item--){
      //console.log(savedItems[item]);
      var key = Object.keys(savedItems[item])[0];
      //consoßle.log(new Date(Number(key)), savedItems[item][key]['url'])
      var tmpDate = new Date(Number(key));
      // var dateSaved = tmpDate.getMonth() + "/" + tmpDate.getDate() + "/" + tmpDate.getFullYear() + " " + tmpDate.getHours() + ":" + tmpDate.getMinutes() + ":" + tmpDate.getMilliseconds();
      var dateSince = moment(tmpDate).fromNow();
      //console.log(dateSince)
      var savedUrl = new URL(decodeURIComponent(savedItems[item][key]['url'] ));
      var encodedString = savedUrl.search.replace('?event=','')

      var isPayloadAction = (savedItems[item][key]['payload']['action'] ? savedItems[item][key]['payload']['action'] : 'Action Not defined') ;

      //var itemToShow = Number(item) + 1; 
      var itemClass = (htmlBulletCounter <= 5 ? 'ck-item-show':'ck-item-hide');
      tableItems += `<div class="${itemClass} ck-itemNumber-${htmlBulletCounter}">${htmlBulletCounter}) ${dateSince} (Action: ${isPayloadAction})<button type="button" class="btn btn-link ck-viewEncodedString" encodedString="${encodedString}">View</div>`;

      htmlBulletCounter++;
    }

    var showMoreDiv = `<div class="ck-showMore">Show more</div>`;
    showMoreDiv = (savedItems.length > 5 ? showMoreDiv : '');
    var tmpHtml  = `
      <h2 class="accordion-header" id="heading_${itemNumber}">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse_${itemNumber}" aria-expanded="false" aria-controls="collapse_${itemNumber}">
          ${hostName}
        </button>
      </h2>
      <div id="collapse_${itemNumber}" class="accordion-collapse collapse" aria-labelledby="heading_${itemNumber}" data-bs-parent="#accordionExample">
        <div class="accordion-body">
          ${tableItems}
          ${showMoreDiv}
          </div>
      </div>
    `;

    var accordionHtml = document.createElement('div');
    accordionHtml.className = 'accordion-item';
    accordionHtml.innerHTML= tmpHtml;

    return accordionHtml;
  }

  //Add click to Copy functionality
  document.querySelectorAll('.ck-showMore').forEach(function(item){
    item.addEventListener('click', function(){
      $('.ck-item-hide').addClass('ck-item-show').removeClass('ck-item-hide');
    });
  });

  document.querySelectorAll('.ck-encodedString').forEach(function(item) {
    // console.log(item)
    item.addEventListener('click', function () {
      navigator.clipboard.writeText(item.innerHTML);
      document.getElementById('atob').innerHTML = item.innerHTML;
      var event = new Event('input');
      document.getElementById('atob').dispatchEvent(event);
      //alert('copied to clipboard')
    });
  });

  document.querySelectorAll('.ck-viewEncodedString').forEach(function(item) {
    // console.log(item)
    item.addEventListener('click', function () {
      //document.getElementsByClassName('ck-viewEncodedString')[0].getAttribute('encodedstring')
      //navigator.clipboard.writeText(item.getAttribute('encodedstring'));
      //document.getElementById('atob').innerHTML = "";
      //document.getElementById('atob').innerHTML = item.getAttribute('encodedstring');
      $('#atob').val(item.getAttribute('encodedstring'));
      console.log(item.getAttribute('encodedstring'))
      var event = new Event('input');
      document.getElementById('atob').dispatchEvent(event);
      //alert('copied to clipboard')
    });
  });


}

async function clearAll() {
  return new Promise( (resolve, reject) => {
    chrome.storage.local.clear(function(){
      init();
      resolve(true);
    });
  });  
}
init();



//Json viewer 
function generateJsonViewer(jsonObj) { 
  //var jsonObj = {};
  var jsonViewer = new JSONViewer();
  document.querySelector("#json").innerHTML = '';
  document.querySelector("#json").appendChild(jsonViewer.getContainer());

  var textarea = document.querySelector("atob");
  // textarea value to JSON object
  var setJSON = function() {
    try {
      // var value = textarea.value;
      // // console.log('value in generate json viewer ', value)
      // jsonObj = JSON.parse(value);
      // console.log('jsonObj in generate json viewer ', jsonObj)
    }
    catch (err) {
      alert(err);
    }
  };

  // load default value
  setJSON();

  jsonViewer.showJSON(jsonObj); //Show all 
  // jsonViewer.showJSON(jsonObj, null, 1); //Collapse to level 1  
  //jsonViewer.showJSON(jsonObj, 1); // Show only level 1
}