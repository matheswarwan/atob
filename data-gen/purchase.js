// Generate Order data
// <script type="text/javascript" src="
//
//  thesource
//  cart_browse

// {
//   "id": "572500136022205320230204S-108091422--23020404-FEB-23 05.15.00.000000 PM108091422",
//   "pd": {
//     "$date": "2023-02-04T00:00:00.000Z"
//   },
//   "tv": 0.0,
//   "li": [
//     {
//       "quantity": 1,
//       "item": {
//         "type": "p",
//         "_id": "108091422",
//         "price": 29.99
//       }
//     }
//   ],
//   "nI": 1,
//   "nU": 1
// }

// {
//   "name": "order_confirmation",
//   "action": "order_confirmation",
//   "isMatch": () => /\/orderConfirmation/.test(window.location.pathname),
//   "itemAction": Evergage.ItemAction.Purchase,
//   "catalog": {
//       "Product": {
//           "orderId": () => {
//               const txProds = getTransactionProducts();
//               return txProds.orderId;
//           },
//           "totalValue": () => dataLayer[0].transactionTotal,
//           "lineItems": {
//               "_id": () => {
//                   const txProds = getTransactionProducts();
//                   return [txProds.sku];
//               },
//               "quantity": () => {
//                   const txProds = getTransactionProducts();
//                   return [txProds.quantity];
//               }
//           }
//       }
//   }
// }
// Ecommerce cart functoins 

function getAddToCart() {
  if (window.dataLayer) {
      for (let i = 0; i < window.dataLayer.length; i++) {
          if ((Object.keys(window.dataLayer[i]).includes('cartContents') || Object.keys(window.dataLayer[i]).includes('ecommerce')) && Object.keys(window.dataLayer[i]).includes('event')) {
              // console.log(window.dataLayer[i]['event'])
              // console.log(window.dataLayer[i]['cartContents'])
              // console.log(window.dataLayer[i]['ecommerce'])
              var addToCart = {};
              var t = Object.keys(window.dataLayer[i].ecommerce)[0];
              
              addToCart.category = window.dataLayer[i].ecommerce[t].products[0].category;
              addToCart.deliveryOption = window.dataLayer[i].ecommerce[t].products[0].deliveryOption;
              addToCart.name = window.dataLayer[i].ecommerce[t].products[0].name;
              addToCart.id = window.dataLayer[i].ecommerce[t].products[0].id;
              addToCart.price = window.dataLayer[i].ecommerce[t].products[0].price;
              addToCart.quantity = window.dataLayer[i].ecommerce[t].products[0].quantity;
              addToCart.storeID = window.dataLayer[i].ecommerce[t].products[0].storeID;
              
              return addToCart;
          }
      }
  }
}

Evergage.sendEvent({
  action: "Add to Cart",
  itemAction: Evergage.ItemAction.AddToCart,
  catalog: {
      lineItem: {
          Product: getAddToCart()
      }
  }
});

saraDesc		String	
imageUrlFr		String	
priceDropFlag		String	
service		String	
regularPrice		String	
salePrice		String	
offerBadge		String	
serviceType

{
  "cartContents":{
     "products":[
        {
           "ehfFee":"$0<span>.00</span>",
           "quantity":1,
           "price":"389.99",
           "name":"Bose QuietComfort® 45 Over-Ear Wireless Headphones - Black",
           "id":"108096091",
           "category":"Audio & Headphones/Headphones/Noise-Cancelling Headphones",
           "storeID":"",
           "deliveryOption":"Ship To Home"
        },
        {
           "ehfFee":"$0<span>.00</span>",
           "quantity":1,
           "price":"389.99",
           "name":"Bose QuietComfort® 45 Over-Ear Wireless Headphones - White Smoke",
           "id":"108096092",
           "category":"Audio & Headphones/Headphones/Noise-Cancelling Headphones",
           "storeID":"",
           "deliveryOption":"Ship To Home"
        }
     ]
  },
  "ecommerce":{
     "add":{
        "products":[
           {
              "quantity":1,
              "price":"389.99",
              "name":"Bose QuietComfort® 45 Over-Ear Wireless Headphones - White Smoke",
              "id":"108096092",
              "category":"Audio & Headphones/Headphones/Noise-Cancelling Headphones",
              "storeID":"",
              "deliveryOption":"Ship To Home"
           }
        ]
     }
  },
  "event":"addToCart",
  "gtm.uniqueEventId":220
}

{
  "cartContents":{
     "products":[
        {
           "ehfFee":"$0<span>.00</span>",
           "quantity":1,
           "price":"389.99",
           "name":"Bose QuietComfort® 45 Over-Ear Wireless Headphones - Black",
           "id":"108096091",
           "category":"Audio & Headphones/Headphones/Noise-Cancelling Headphones",
           "storeID":"",
           "deliveryOption":"Ship To Home"
        }
     ]
  },
  "ecommerce":{
     "add":{
        "products":[
           {
              "quantity":1,
              "price":"389.99",
              "name":"Bose QuietComfort® 45 Over-Ear Wireless Headphones - Black",
              "id":"108096091",
              "category":"Audio & Headphones/Headphones/Noise-Cancelling Headphones",
              "storeID":"",
              "deliveryOption":"Ship To Home"
           }
        ]
     }
  },
  "event":"addToCart",
  "gtm.uniqueEventId":213
}

{
  "cartContents":{
     "products":[
        {
           "ehfFee":"$0<span>.00</span>",
           "quantity":2,
           "price":"11.99",
           "name":"Fujifilm Instax Mini Instant Film - Single Pack (10 Exposures)",
           "id":"108033412",
           "category":"Cameras/Point & Shoot Cameras/Point & Shoot Camera Accessories",
           "storeID":"",
           "deliveryOption":"Ship To Home"
        }
     ]
  },
  "ecommerce":{
     "remove":{
        "products":[
           {
              "quantity":4,
              "price":"424.99",
              "name":"Nextbase 622GW 4K Dash Camera - Silver",
              "id":"108103298",
              "storeID":"",
              "deliveryOption":"Ship To Home"
           }
        ]
     }
  },
  "event":"removeFromCart",
  "gtm.uniqueEventId":32
}