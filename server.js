var express = require('express')
var app = express()
var request = require('superagent')
var gApiToken = process.env.gApiToken
var async = require('async')
var appId = process.env.appId

var pubnub = require("pubnub")({
	ssl: true,
	publish_key   : process.env.publish_key,
	subscribe_key : process.env.subscribe_key
});

var message = {
	"server": "received on the server"
};

function fetch (message) {
	var uuid = message.uuid;
	var place = message.place;	
	var coordinates = message.coordinates;
	async.parallel([
		function(callback) {
			request
			.get('https://maps.googleapis.com/maps/api/timezone/json')
			.query('location='+coordinates[1]+','+coordinates[0])
			.query({timestamp: Math.floor(new Date().getTime()/1000)})
			.query({key: gApiToken})
			.end(function(err, res){			
				if(err) { console.log(err); callback(true); return; }
				obj = res.body;
				callback(false, obj);				
			});
		},
		function(callback){
			request
			.get('http://api.sunrise-sunset.org/json')
			.query({lat:coordinates[1]})
			.query({lng: coordinates[0]})
			.query({formatted: 0})
			.end(function(err, res){
				if(err) { console.log(err); callback(true); return; }
				obj = res.body.results;
				callback(false, obj);				
			})
		},		
		function(callback){
			request
			.get('http://api.openweathermap.org/data/2.5/weather')
			.query({lat:coordinates[1]})
			.query({lon: coordinates[0]})
			.query({APPID: appId})
			.end(function(err, res){
				if(err) { console.log(err); callback(true); return; }
				obj = res.body;
				callback(false, obj);				
			})
		}		
		],
  /*
   * Collate results
   */
   function(err, results) {
   	console.log("Error OR Results", JSON.stringify(err || results));
   	var data = {
   		'uuid': uuid,
   		'place': place,
   		'coordinates': coordinates.reverse(),
   		'timeZoneId': results[0].timeZoneId,
   		'sunrise': results[1].sunrise,
   		'sunset': results[1].sunset,
   		'temperature': results[2].main.temp,
   		'wind': results[2].wind.speed,
   		'humidity': results[2].main.humidity,
   		'icon': results[2].weather[0].icon,
   		'description': results[2].weather[0].description
   	};
   	pub(err, data);
   }
   );
}

var pubnubOptions = {
	channel: 'wnGetTime',
	message: message,
	callback: function(e) {
		console.log("SUCCESS!", e);
	},
	error: function(e) {
		console.log("FAILED! RETRY PUBLISH!", e);
	}
};

pubnub.subscribe({
	channel: "wnPutTime",
	callback: function(message) {
		console.log("lat", message.coordinates[0], "long", message.coordinates[1]);		
		fetch(message);
	}
});

function pub(err, data) {		
	pubnub.publish({
		channel: data.uuid,
		message: err || data,
		callback: function(m) {
			console.log(m)
		}
	})
};

app.use(express.static('public'))
app.listen(process.env.PORT || 3000, function() {
	console.log('Weather Now listening on *:', process.env.PORT || 3000)
})