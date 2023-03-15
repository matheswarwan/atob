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

  //Reset UI
  document.getElementById('json').innerHTML = 'Decoded Payload will appear here!';
  document.getElementById('atob').value = '';

  var o = await getData();
  
  //console.log(Object.keys(o))

  var listOfSites = Object.keys(o);

  document.getElementById('accordionExample').innerHTML = ''; //Clear for first time
  if(listOfSites.length > 0) {
    for(l in listOfSites) {
      var accordionHtml = generateAccordianItems(l, listOfSites[l]);
      document.getElementById('accordionExample').appendChild(accordionHtml);
    }
  } else {
    //No sites captured 
    document.getElementById('accordionExample').innerHTML = 
    `
    <div class="alert alert-info" role="alert">
      No sites captured yet.
    </div>
    `;
  }

  function generateAccordianItems(itemNumber, hostName) {
    //console.log(hostName)

    var tableItems = '';
    var savedItems = o[hostName];

    var htmlBulletCounter = 1;
    for(var item = savedItems.length-1; item >= 0 ; item--){
      //console.log(savedItems[item]);
      var key = Object.keys(savedItems[item])[0];
      //console.log(new Date(Number(key)), savedItems[item][key]['url'])
      var tmpDate = new Date(Number(key));
      // var dateSaved = tmpDate.getMonth() + "/" + tmpDate.getDate() + "/" + tmpDate.getFullYear() + " " + tmpDate.getHours() + ":" + tmpDate.getMinutes() + ":" + tmpDate.getMilliseconds();
      var dateSince = moment(tmpDate).fromNow();
      //console.log(dateSince)
      var savedUrl = new URL(decodeURIComponent(savedItems[item][key]['url'] ));
      var encodedString = savedUrl.search.replace('?event=','')

      var isPayloadAction = (savedItems[item][key]['payload']['action'] ? savedItems[item][key]['payload']['action'] : 'Action Not defined') ;

      //var itemToShow = Number(item) + 1; 
      var itemClass = (htmlBulletCounter <= 5 ? 'ck-item-show':'ck-item-hide');
      tableItems += `<div class="${itemClass} ck-itemNumber-${htmlBulletCounter} accordion-body text-start" style="padding-top: 0px !important; padding-bottom: 0px !important" >${htmlBulletCounter}) ${dateSince} (Action: ${isPayloadAction})<button type="button" class="btn btn-link ck-viewEncodedString" encodedString="${encodedString}" accordionId="${'collapse_'+itemNumber}">View</div>`;

      htmlBulletCounter++;
    }

    var showMoreDiv = `<a class="ck-showMore">Show All</a>`;
    showMoreDiv = (savedItems.length > 5 ? showMoreDiv : '');
    var tmpHtml  = `
      <div class="accordion" id="heading_${itemNumber}">
      <div class="accordion-item mb-3">
            <h2 class="accordion-header">
              <button
                type="button"
                class="accordion-button collapsed"
                data-bs-toggle="collapse"
                data-bs-target="#collapse_${itemNumber}"
              >
                ${hostName}
              </button>
            </h2>
            <div
              class="accordion-collapse collapse"
              id="collapse_${itemNumber}"
              data-bs-parent="#accordionSection"
            >
              <div class="accordion-body text-start">
                ${tableItems}
                ${showMoreDiv}
              </div>
            </div>
          </div>
        </div>
    `;

    var accordionHtml = document.createElement('div');
    accordionHtml.className = 'accordion-item';
    accordionHtml.innerHTML= tmpHtml;

    return accordionHtml;
  }

  function generateAccordianItemsWithPagination(itemNumber, hostName, pageNumber) {
    // pageNumber - current page Number * 5 gives the elements to show
    // TODO: Work on pagingation
  }

  //Add click to Copy functionality
  document.querySelectorAll('.ck-showMore').forEach(function(item){
    item.addEventListener('click', function(){
      $('.ck-item-hide').addClass('ck-item-show').removeClass('ck-item-hide');
      $('.ck-showMore').addClass('ck-item-hide');
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

      // hide accordion 
      var accordionId = $(this).attr('accordionId');
      console.log(accordionId);
      $('#'+accordionId).removeClass('show');
      //$('button[data-bs-target="#collapse_0"]').removeClass('collapsed');

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