const request = require('request');
const WebSocket = require('ws')
const uuid = require('uuid')
var fs = require('fs');

// read ssl certificate
var privateKey = fs.readFileSync('/etc/letsencrypt/live/covid.elogstation.com/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/covid.elogstation.com/fullchain.pem', 'utf8');

var credentials = { key: privateKey, cert: certificate };
var https = require('https');

//pass in your credentials to create an https server
var httpsServer = https.createServer(credentials);
httpsServer.listen(8080);

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
    server: httpsServer
});




var HOST = 'https://covid19-server.chrismichael.now.sh/api/v1/AllReports';
var infoByCountry = {};
var clientAssociatedWithCountry = {};

function compareChanges(country, data) {
    if (infoByCountry[country] == null) {
        infoByCountry[country] = data;
        return;
    }

    // console.log(infoByCountry[country].TotalCases < data.TotalCases);
    // console.log(infoByCountry[country].TotalCases);
    // console.log(data.TotalCases);

    if (infoByCountry[country].TotalCases < data.TotalCases) {
        pushChanges('total', country, data);
    }
    if (infoByCountry[country].TotalDeaths < data.TotalDeaths) {
        pushChanges('death', country, data);
    }
    if (infoByCountry[country].TotalRecovered < data.TotalRecovered) {
        pushChanges('recover', country, data);
    }
    infoByCountry[country] = data;
}

function pushChanges(typeOfChange, country, data) {
    console.log(typeOfChange, country, data);
    //fetch all users with specific country
    for (let key in clientAssociatedWithCountry) {
        if (clientAssociatedWithCountry[key] == country) {
            webSockets[key].send(JSON.stringify({
                typeOfChange: typeOfChange,
                country: country,
                data: data
            }));
        }
    }
}

function myFunc() {
    // console.log('call')
    //total
    request(HOST, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        compareChanges('all', {
            TotalCases: body.reports[0].cases,
            TotalDeaths: body.reports[0].deaths,
            TotalRecovered: body.reports[0].recovered
        });
    });
    //country specific
    request(HOST, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        //   for(var i=0; i<body.reports[0].table.length; i++){
        var listOfCountries = body.reports[0].table[0];
        for (var j = 0; j < listOfCountries.length; j++) {
            compareChanges(listOfCountries[j].Country, listOfCountries[j]);

            // break;
        }
        //   }
    });
}

setInterval(myFunc, 10000);


// const wss = new WebSocket.Server({ port: 8080 })
// var globalws = null;
var webSockets = {};
wss.on('connection', ws => {

    var userID = uuid.v4();
    webSockets[userID] = ws
    console.log('connected: ' + userID)

    ws.on('close', data => {
        console.log('byebye: ' + userID)
        webSockets[userID] = null
        clientAssociatedWithCountry[userID] = null;
    });

    ws.on('message', country => {
        console.log(userID)
        console.log(country)
        
        clientAssociatedWithCountry[userID] = country;
        ws.send(JSON.stringify({
            typeOfChange: 'init',
            country: country,
            parsedData: infoByCountry[country]
        }));
    });

    clientAssociatedWithCountry[userID] = 'all';

    ws.send(JSON.stringify({
        typeOfChange: 'init',
        country: 'all',
        data: infoByCountry['all']
    }));

})
