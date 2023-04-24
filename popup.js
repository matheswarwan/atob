document.getElementById('BtnRefresh').addEventListener('click', init);
document.getElementById('BtnClear').addEventListener('click', clearAll);

var txtAreaField = document.getElementById('atob');
txtAreaField.addEventListener('input', function() {
  
  var encodedString = txtAreaField.value;
  try { 
    var decodedString = atob(encodedString);
    var decodedJson = JSON.parse(decodedString);

    generateJsonViewer(decodedJson);
  }catch(e) {
    var errorDiv = 
    $('#json').empty().html('<font color="red">Error: Invalid Base64 text</font>')
  }
});


async function getData() {
  return new Promise( (resolve, reject) => {
    chrome.storage.local.get(null, function(items){
      resolve(items);
    });
  });
}

async function init() {

  //Reset UI
  document.getElementById('json').innerHTML = 'Decoded Payload will appear here!';
  document.getElementById('atob').value = '';

  var o = await getData();
  
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

    var tableItems = '';
    var savedItems = o[hostName];

    var htmlBulletCounter = 1;
    for(var item = savedItems.length-1; item >= 0 ; item--){
      var key = Object.keys(savedItems[item])[0];
      var tmpDate = new Date(Number(key));
      var dateSince = moment(tmpDate).fromNow();
      var savedUrl = new URL(decodeURIComponent(savedItems[item][key]['url'] ));
      // var encodedString = savedUrl.search.replace('?event=','')
      console.log('Payload - ' , savedItems[item][key]['payload'])
      var encodedString = btoa(JSON.stringify(savedItems[item][key]['payload']));

      var isPayloadAction = (savedItems[item][key]['payload']['action'] ? savedItems[item][key]['payload']['action'] : 'Action Not defined') ;

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
    item.addEventListener('click', function () {
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
  //Click to copy function 
  navigator.clipboard.writeText(JSON.stringify(jsonObj));
  //alert('Copied to clipboard')

  // jsonViewer.showJSON(jsonObj, null, 1); //Collapse to level 1  
  //jsonViewer.showJSON(jsonObj, 1); // Show only level 1
}