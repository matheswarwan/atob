
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
  
  console.log('Encoded Text' + txtAreaField.value);
  var encodedString = txtAreaField.value;
  try { 
    var decodedString = atob(encodedString);
    var decodedJson = JSON.parse(decodedString);
    console.log(decodedJson);


    var decodedJsonDiv = document.getElementById('decodedJson');
    decodedJsonDiv.innerHTML = "";
    decodedJsonDiv.appendChild(document.createTextNode(JSON.stringify(decodedJson, null, 4)));

    //$('#decodedJson').html(JSON.stringify(decodedJson, null, 4));
  }catch(e) {
    var decodedJsonDiv = document.getElementById('decodedJson');
    decodedJsonDiv.innerHTML = "";
    decodedJsonDiv.appendChild(document.createTextNode('Error: Invalid Base64 text'));
  }
});



// Filling Accordian 

async function getData() {
  return new Promise( (resolve, reject) => {
    chrome.storage.local.get(null, function(items){
      console.log('items in getData ', items);
      resolve(items);
    });
  });
}

async function init() {
  var o = await getData();
  
  console.log(Object.keys(o))

  var listOfSites = Object.keys(o);

  document.getElementById('accordionExample').innerHTML = ''; //Clear for first time
  for(l in listOfSites) {
    var accordionHtml = generateAccordianItems(l, listOfSites[l]);
    document.getElementById('accordionExample').appendChild(accordionHtml)
  }


  function generateAccordianItems(itemNumber, hostName) {
    console.log(hostName)

    var tableItems = '';
    var savedItems = o[hostName];
    for(item in savedItems){
      console.log(savedItems[item]);
      var key = Object.keys(savedItems[item])[0];
      console.log(new Date(Number(key)), savedItems[item][key]['url'])
      var dateSaved = new Date(Number(key));
      var savedUrl = new URL(decodeURIComponent(savedItems[item][key]['url'] ));
      var encodedString = savedUrl.search.replace('?event=','')

      var itemToShow = Number(item) + 1; 
      tableItems += `<div><strong>${itemToShow}) ${dateSaved}</strong></div><br><div>${encodedString}</div><br>`
    }

    var tmpHtml  = `
      <h2 class="accordion-header" id="heading_${itemNumber}">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse_${itemNumber}" aria-expanded="false" aria-controls="collapse_${itemNumber}">
          ${hostName}
        </button>
      </h2>
      <div id="collapse_${itemNumber}" class="accordion-collapse collapse" aria-labelledby="heading_${itemNumber}" data-bs-parent="#accordionExample">
        <div class="accordion-body">
          ${tableItems}
        </div>
      </div>
    `

    var accordionHtml = document.createElement('div');
    accordionHtml.className = 'accordion-item';
    accordionHtml.innerHTML= tmpHtml;

    return accordionHtml;
  }
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

