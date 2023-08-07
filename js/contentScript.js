// Example content script
console.log('Hello from content script!');

// Insert your script into the website's body
const scriptElement = document.createElement('script');
scriptElement.src = 'https://cdn.evgnet.com/beacon/freshbooks/dev/scripts/evergage.min.js';
document.body.appendChild(scriptElement);

console.log('Script Element inserted!')
