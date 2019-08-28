const express = require("express");
const mysql = require("mysql");
const ejs = require("ejs");
const paypal = require("paypal-rest-sdk");
var url = require('url');

paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id:
    "AR57Uc3tJZwwK8wgQollQosOvxyFPgxuwc_v669GqZ76qlV3nDje75T84tCWZl_aDSn1rfoIpZxo2YLf",
  client_secret:
    "EIhkmGXM66FPQmb3pXJKDf8XnmImTsGbiJ7er3zCPTpdVAHeewrL_Lq0oT4n8q8A3kef7h1fB_39FNuy"
});

const app = express();
app.set("view engine", "ejs");

//create connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "acme"
});

//connect to mysql
db.connect(err => {
  if (err) {
    throw err;
  }
  console.log("MySql connected...");
});

//create database
app.get("/createdb", (req, res) => {
  let sql = "CREATE DATABASE shoppingcart";
  db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.send("Shopping cart created...");
  });
});

app.get("/createproducts", (req, res) => {
  let sql =
    "CREATE TABLE products(id int AUTO_INCREMENT, name VARCHAR(255), quantity INT(3), price INT(3), total INT(3), PRIMARY KEY (id))";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.send("Created products...");
  });
});

app.get("/removeproducts", (req, res) => {
  let sqlclear = "DROP TABLE products";
  db.query(sqlclear, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.send("products cleared...");
  });
});

app.get("/products", (req, res) => {
  let sql = "SELECT * FROM products";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.json({
      data: result
    });
  });
});
app.get("/products/add", (req, res) => {
  const { name, price } = req.query;
  const sql = `INSERT INTO products (name, quantity,  price, total) VALUES('${name}',0, ${price}, 0)`;
  db.query(sql, (err, results) => {
    if (err) {
      return res.send(err);
    } else {
      return res.send(
        `${name} added successfully to product list for ${price} dollars`
      );
    }
  });
});
app.get("/products/:id/update/:quantity", (req, res) => {
  const sql = `UPDATE products SET quantity = ${req.params.quantity} WHERE id = ${req.params.id}`;
  let query = db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.send(
      `Cart updated. Added ${req.params.quantity} to your shopping cart`
    );
  });
});
app.get("/products/:id/remove", (req, res) => {
  const sql = `UPDATE products SET quantity = 0 WHERE id = ${req.params.id}`;
  let query = db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.send(`Removed item from your cart`);
  });
});

app.get("/cart", (req, res) => {
  let sql =
    "SELECT name,quantity, SUM(price * quantity) AS total FROM products WHERE quantity > 0 GROUP BY name";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

app.get("/cart/checkout", (req, res) => {
  let sql = "SELECT SUM(price * quantity) AS total FROM products ";
  db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result[0].total); //450 gets logged in console, it's a number
    res.render("index", { title: "payment" });
  });
});

app.post("/pay", (req, res) => {
  let sql = "SELECT SUM(price * quantity) AS total FROM products ";
  db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result[0].total);
    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal"
      },
      redirect_urls: {
        return_url: "http://localhost:5000/success",
        cancel_url: "http://localhost:5000/cancel"
      },
      transactions: [
        {
          item_list: {
            items: [
              {
                name: "Purchase ",
                price: `${result[0].total}`,
                currency: "USD",
                quantity: 1
              }
            ]
          },
          amount: {
            currency: "USD",
            total: `${result[0].total}`
          },
          description: "Buying eletronics"
        }
      ]
    };
    paypal.payment.create(create_payment_json, function(error, payment) {
      console.log(payment)
      if (error) {
        throw error;
      } else {
        for (let i = 0; i < payment.links.length; i++) {
          if (payment.links[i].rel === "approval_url") {
            res.redirect(payment.links[i].href);
          }
        }
      }
    });
  });
});

app.get("/success", (req, res) => {
  //if the user is able to make a successful transaction
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  let sql = "SELECT SUM(price * quantity) AS total FROM products ";
  db.query(sql, (err, result) => {
    const execute_payment_json = {
      payer_id: payerId,
      transactions: [
        {
          amount: {
            currency: "USD",
            total: `${result[0].total}`
          }
        }
      ]
    };
    paypal.payment.execute(paymentId, execute_payment_json, function(
      error,
      payment
    ) {
      if (error) {
        console.log(error.response);
        throw error;
      } else {
        console.log(JSON.stringify(payment));
        res.send(payment);
      }
    });
  });
});
app.get("/removesubscription", (req, res) => {
  let sqlclear = "DROP TABLE subscription";
  db.query(sqlclear, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.send("subscriptions cleared...");
  });
});
app.get("/createsubscription", (req, res) => {
  let sql =
    "CREATE TABLE subscription(id int AUTO_INCREMENT, name VARCHAR(255), price INT(3), cycle INT(3), shipping INT(3), tax INT(3), PRIMARY KEY (id))";
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.send("Created subscriptions...");
  });
});


app.get('/subscription/add', (req, res) => {
  const {name, price, cycle, shipping, tax} = req.query;
  const sql = `INSERT INTO subscription (name, price, cycle, shipping, tax) VALUES('${name}', '${price}', '${cycle}', '${shipping}', '${tax}')`;
  db.query(sql, (err, results) => {
    if(err) {
      return res.send(err);
    } else {
      return res.send(
        `made a subscription for ${name} at ${price} price for  ${cycle} months with tax and shipping costing $${shipping} and  $${tax}`
      )
    }
  })
})

app.get("/subscription", (req, res) => {
  let sql = "SELECT * FROM subscription";
  db.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result[0].price); 
    res.render("subscription");
  });
});
app.post("/subscriptionpayment", (req, res) => {
  let sql = "SELECT * FROM subscription";
  db.query(sql, (err, result) => {
    var d = new Date(Date.now() + 1*60*1000);
  d.setSeconds(d.getSeconds() + 4);
  var isDate = d.toISOString();
  var isoDate = isDate.slice(0, 19) + 'Z';

  var billingPlanAttributes = {
      "description": "Clearly Next Subscription.",
      "merchant_preferences": {
          "auto_bill_amount": "yes",
          "cancel_url": "http://localhost:5000/cancel",
          "initial_fail_amount_action": "continue",
          "max_fail_attempts": "2",
          "return_url": "http://localhost:5000/subscriptioncomplete",
          "setup_fee": {
              "currency": "USD",
              "value": "25"
          }
      },
      "name": `${result[0].name}`,
      "payment_definitions": [
          {
              "amount": {
                  "currency": "USD",
                  "value": `${result[0].price}`
              },
              "charge_models": [
                  {
                      "amount": {
                          "currency": "USD",
                          "value": `${result[0].shipping}`
                      },
                      "type": "SHIPPING"
                  },
                  {
                      "amount": {
                          "currency": "USD",
                          "value": `${result[0].tax}`
                      },
                      "type": "TAX"
                  }
              ],
              "cycles": `${12}`,
              "frequency": "MONTH",
              "frequency_interval": "1",
              "name": "1 year, once a month",
              "type": "REGULAR"
          },
          // {
          //     "amount": {
          //         "currency": "USD",
          //         "value": "20"
          //     },
          //     "charge_models": [
          //         {
          //             "amount": {
          //                 "currency": "USD",
          //                 "value": "10.60"
          //             },
          //             "type": "SHIPPING"
          //         },
          //         {
          //             "amount": {
          //                 "currency": "USD",
          //                 "value": "20"
          //             },
          //             "type": "TAX"
          //         }
          //     ],
          //     "cycles": "4",
          //     "frequency": "MONTH",
          //     "frequency_interval": "1",
          //     "name": "Trial 1",
          //     "type": "TRIAL"
          // }
      ],
      "type": "FIXED"
  };

  var billingPlanUpdateAttributes = [
      {
          "op": "replace",
          "path": "/",
          "value": {
              "state": "ACTIVE"
          }
      }
  ];

  var billingAgreementAttributes = {
      "name": "Fast Speed Agreement",
      "description": "Agreement for Fast Speed Plan",
      "start_date": isoDate,
      "plan": {
          "id": "P-0NJ10521L3680291SOAQIVTQ"
      },
      "payer": {
          "payment_method": "paypal"
      },
      "shipping_address": {
          "line1": "StayBr111idge Suites",
          "line2": "Cro12ok Street",
          "city": "San Jose",
          "state": "CA",
          "postal_code": "95112",
          "country_code": "US"
      }
  };

// Create the billing plan
  paypal.billingPlan.create(billingPlanAttributes, function (error, billingPlan) {
      if (error) {
          console.log(error);
          throw error;
      } else {
          console.log("Create Billing Plan Response");
          console.log(billingPlan);

          // Activate the plan by changing status to Active
          paypal.billingPlan.update(billingPlan.id, billingPlanUpdateAttributes, function (error, response) {
              if (error) {
                  console.log(error);
                  throw error;
              } else {
                  console.log("Billing Plan state changed to " + billingPlan.state);
                  billingAgreementAttributes.plan.id = billingPlan.id;

                  // Use activated billing plan to create agreement
                  paypal.billingAgreement.create(billingAgreementAttributes, function (error, billingAgreement) {
                      if (error) {
                          console.log(error);
                          throw error;
                      } else {
                          console.log("Create Billing Agreement Response");
                          //console.log(billingAgreement);
                          for (var index = 0; index < billingAgreement.links.length; index++) {
                              if (billingAgreement.links[index].rel === 'approval_url') {
                                  var approval_url = billingAgreement.links[index].href;
                                  console.log("For approving subscription via Paypal, first redirect user to");
                                  console.log(approval_url);
                                  res.redirect(approval_url);

                                  console.log("Payment token is");
                                  console.log(url.parse(approval_url, true).query.token);
                                  // See billing_agreements/execute.js to see example for executing agreement
                                  // after you have payment token
                              }
                          }
                      }
                  });
              }
          });
      }
  });
  })
  
  
});

app.get("/subscriptioncomplete", (req, res) => {
  //if the user is able to make a successful transaction from subscriptions
  var token = req.query.token;
    console.log(token,'tokentoken');
    paypal.billingAgreement.execute(token, {}, function (error, billingAgreement) {
        if (error) {
            console.error(error);
            throw error;
        } else {
            console.log(JSON.stringify(billingAgreement));
            res.send(billingAgreement);
        }
    });
});

app.get("/cancel", (req, res) => {
  //if the user cancels
  res.send("Cancelled");
});
app.listen(5000, () => console.log("Server started"));
