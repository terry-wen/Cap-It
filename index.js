'use strict';
let cred = require('./cred.js');
let request = require('superagent');
let schedule = require('node-schedule');
let twilio = require('twilio');
let accounts, withdrawals, purchases, transfers;
let monthlySpending = 0, totalSpending = 0, months = 1;
let totalMonth = 0;
let checking, savings;
let buffer = 200;
let totalSaved = 0;
let baseUrl = `http://api.reimaginebanking.com`;
let now = new Date();
let client = twilio(cred.TWILIO_ACCOUNT_SID, cred.TWILIO_AUTH_TOKEN);

let monthlyTransfer = function(){
  request.get(`${baseUrl}/customers/${cred.id}/accounts?key=${cred.apiKey}`)
    .end(function(error, response) {
    if(!error && response.statusCode == 200) {
      //console.log(response.body);
      accounts = response.body;
      checking = accounts[0];
      savings = accounts[1];

      //load purchases
      request.get(`${baseUrl}/accounts/${checking._id}/purchases?key=${cred.apiKey}`)
        .end(function(error, response) {
        if(!error && response.statusCode == 200) {
          console.log(response.body);
          purchases = response.body;

          purchases.forEach(function(p){
            let pDate = new Date(p.purchase_date);
            let tempMonths = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
            if(tempMonths > months) {
              months = tempMonths;
            }
            totalMonth += p.amount;
          });

          //load withdrawals
          request.get(`${baseUrl}/accounts/${checking._id}/withdrawals?key=${cred.apiKey}`)
            .end(function(error, response) {
            if(!error && response.statusCode == 200) {
              //console.log(response.body);
              withdrawals = response.body;

              withdrawals.forEach(function(w){
                let wDate = new Date(w.transaction_date);
                let tempMonths = (now.getFullYear() - wDate.getFullYear()) * 12 + (now.getMonth() - wDate.getMonth());
                if(tempMonths > months) {
                  months = tempMonths;
                }
                totalMonth += w.amount;
              });

              console.log(months);
              console.log("Total deductions: " + totalMonth);
              console.log("Monthly spending: " + totalMonth/months);

              if(checking.balance > (totalMonth/months + buffer)) {
                client.sendMessage({
                  to: cred.phone_number,
                  from: '(877) 544-7076',
                  body: 'Beginning of a new month! You have saved ' + (checking.balance - (totalMonth/months + buffer)) + ' this month :)'
                });
                request.post({
                  url: `${baseUrl}/accounts/${checking._id}/transfers?key=${cred.apiKey}`,
                  body: {
                    "medium": "balance",
                    "payee_id": savings._id,
                    "amount": (checking.balance - (totalMonth/months + buffer)),
                    "transaction_date": new Date(),
                    "description": "cap-it-transfer"
                  }
                });
              } else {
                client.sendMessage({
                  to: cred.phone_number,
                  from: '(877) 544-7076',
                  body: 'Oh no! You spent too much this month :( Careful with your spending! Your account has $' + Math.round(checking.balance, -2) + ' left in it, and your target for the start of each month is $' + Math.round((totalMonth/months + buffer), -2) + '.'
                });
              }
            }
          });
        }
      });
    }
  });
};

var j = schedule.scheduleJob('* * 1 * *', monthlyTransfer);

//load accounts
let pageLoad = function() {
  request.get(`${baseUrl}/customers/${cred.id}/accounts?key=${cred.apiKey}`)
    .end(function(error, response) {
    if(!error && response.statusCode == 200) {
      console.log(response.body);
      accounts = response.body;
      checking = accounts[0];
      savings = accounts[1];

      //load purchases
      request.get(`${baseUrl}/accounts/${checking._id}/purchases?key=${cred.apiKey}`)
        .end(function(error, response) {
        if(!error && response.statusCode == 200) {
          //console.log(response.body);
          purchases = response.body;

          purchases.forEach(function(p){
            let pDate = new Date(p.purchase_date);
            if (
              (pDate.getFullYear() == now.getFullYear()) &&
              (pDate.getMonth() == now.getMonth())
            ) {
              monthlySpending += p.amount;
            }
            let tempMonths = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth()) + 1;
            if(tempMonths > months)
              months = tempMonths;
            totalSpending += p.amount;
          });

          //load withdrawals
          request.get(`${baseUrl}/accounts/${checking._id}/withdrawals?key=${cred.apiKey}`)
            .end(function(error, response) {
            if(!error && response.statusCode == 200) {
              //console.log(response.body);
              withdrawals = response.body;

              withdrawals.forEach(function(w){
                let wDate = new Date(w.transaction_date);
                if (
                  (wDate.getFullYear() == now.getFullYear()) &&
                  (wDate.getMonth() == now.getMonth())
                ) {
                  monthlySpending += w.amount;
                }
                let tempMonths = (now.getFullYear() - wDate.getFullYear()) * 12 + (now.getMonth() - wDate.getMonth()) + 1;
                if(tempMonths > months)
                  months = tempMonths;
                totalSpending += w.amount;
              });

              console.log("Monthly deductions: " + monthlySpending);
              console.log("Total deductions: " + totalSpending);
            }
          });

          //load transfers
          request.get(`${baseUrl}/accounts/${checking._id}/transfers?type=payer&key=${cred.apiKey}`)
            .end(function(error, response) {
            if(!error && response.statusCode == 200) {
              //console.log(response.body);
              transfers = response.body;

              transfers.forEach(function(t){
                let tDate = new Date(t.transaction_date);
                console.log(tDate);
                if (t.description == 'cap-it-transfer' && tDate.getFullYear() == now.getFullYear() && (tDate.getMonth() == now.getMonth())) {
                  totalSaved += t.amount;
                }
              });

              console.log("This month's savings: " + totalSaved);
            }
          });
        }
      });
    }
  });
};

pageLoad();
monthlyTransfer();
