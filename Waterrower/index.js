"use strict";

// Read Waterrower
//
// Initialise
//var com = require("serialport");  
var com = require('serialport');
var response = {device:'unknown', connected:false};
var values = [];
var conn;
var portname = "NULL";
var type = process.env.TYPE || 'wr5';
var debug = process.env.DEBUG?console.log:function(){};
var state = 'closed'
var pingCount=0;
var TOTAL_STROKE_COUNT=0;

// State of the USB Serial connection
var READ_RATE = 800;// frequency at which we query the S4/S5 in ms
var BAUD_RATE = 19200;// baud rate of the S4/S5 com port connection

console.log(process.env.DEBUG)

exports.readTotalSpeed = function(callback) { //TODO: async callback with (err, value) arguments
return values["TOTAL_SPEED"];
}

exports.readAverageSpeed = function(callback) { //TODO: async callback with (err, value) arguments
return values["AVERAGE_SPEED"];
}

exports.readStrokeCount = function(callback) { //TODO: async callback with (err, value) arguments
return values["STROKE_COUNT"];
}

exports.readStrokeAverage = function(callback) { //TODO: async callback with (err, value) arguments
return values["STROKE_AVERAGE"];
}

exports.readStrokePull = function(callback) { //TODO: async callback with (err, value) arguments
return values["STROKE_PULL"];
}

exports.readDistance = function(callback) { //TODO: async callback with (err, value) arguments
return values["DISTANCE"];
}

exports.readTotalDistance = function(callback) { //TODO: async callback with (err, value) arguments
return values["TOTAL_DISTANCE"];
}

exports.readHeartRate = function(callback) { //TODO: async callback with (err, value) arguments
return values["HEARTRATE"];
}

exports.pingsRecd = function(callback) { //TODO: async callback with (err, value) arguments
return pingCount;
}

exports.totalStrokeCount = function(callback) { //TODO: async callback with (err, value) arguments
return TOTAL_STROKE_COUNT;
}

exports.resetTotalStrokeCount = function(callback) { //TODO: async callback with (err, value) arguments
return TOTAL_STROKE_COUNT=0;
}

exports.resetWR = function() {
    return write("RESET");
};

function asHex(aNum){
	return ("0000" + aNum.toString(16)).substr(-4).toUpperCase();
}

exports.startWRInterval = function (aDuration, aUnits) {
	var unitID;
	var convertedDistance;
    switch (aUnits.toUpperCase()){
				case "SECONDS": {
			    	write("WSU"+asHex(aDuration));
						break;
				}
				case "MINUTES": {
			    	write("WSU"+asHex(aDuration*60));
						break;
				}
				case "METERS": {
						unitID="1";
						convertedDistance=aDuration;
						write("WSI"+unitID+asHex(convertedDistance));
						break;
				}
				case "MILES": {
          	unitID="2";
            convertedDistance=aDuration*1608; //convert miles to meters
    				write("WSI"+unitID+asHex(convertedDistance));
            break;
        }
        case "KMS": {
          	unitID="3";
            convertedDistance=aDuration*1000; //convert kms to meters
    				write("WSI"+unitID+asHex(convertedDistance));
            break;
        }
        case "STROKES": {
          	unitID="4";
    				write("WSI"+unitID+asHex(aDuration));
            break;
        }
    }
    //console.log("WSI"+unitID+asHex(convertedDistance));
    //write("WSI"+unitID+asHex(convertedDistance));
}

var getState = function() {
  return (state);
}

exports.state = getState;

var putState =function(value) {
  state = value;
}

var open = function() {
    resetMessage();
    getPort(function(data){

    });
    state = "open";
}

var close = function() {
  debug("waterrower closed");
  conn.close();
  state = "closed";
}

// serialport functions
var getPort = function() {
  var ports;
  var i = 0;
  portname = "NULL";
  com.list(function (err, ports) {
    debug("Number of ports=" + ports.length);
    ports.forEach(function(port) {  
      debug("com name " + port.comName);
      debug("port ID " + port.pnpId);
//      portname = ports[i].comName;
        portname ="/dev/ttyACM0";
      i++;
    });
  });
};

var readWrite = function() {
	state = getState();
	switch (state) {
		case "closed":
			debug("attempting to open port");
			open();
			break;
		case "open":
			debug("in readWrite open call read");
			read(function(data) {
				if (data == "disconnected") {
					putState("closed")
				}
				else if (data == "error") {
					putState("closed")
				}
				else if (data == "ready") {
					;
				}
				else {
					debug("<" + data);
					response = readMessage(data);
				}
			});
			break;
		case "connecting":
		    debug("in readWrite connecting");
		    break;
		case "read":
			write(nextMessage);
			break;
		case "error":
			debug("in readWrite error call close");
			close();
			break;
		default:
			console.log("wtf " + state)
	}
}

setInterval(readWrite, READ_RATE);


var read = function(callback) { // this should be 'setup'

      debug("in read connecting to " + portname);
      state = "connecting";
	  conn = new com(portname, {
	    baudrate: BAUD_RATE, disconnectedCallback:function () { callback("disconnected") },
	    parser: com.parsers.readline("\n")
	  });
	  conn.on("error", function(err) {
	    debug("in read " + err);
	    debug("Cannot connect to " + portname);
	    state = "error";
	    callback(state);
	  });
	  conn.on("open", function () {
	    debug("in read open");
	    state = "read"; // state should be 'open'
	    callback("");
	  });
	  conn.on("closed", function () {
	    debug("in read closed");
	    state = "read"; // state should be 'closed'
	    callback("");
	  });
	  conn.on("data", function(data) {
	    debug('in read>' + data.trim() + "<");
	    state = "read";
	    if (data.substring(0,1) == "P") {
//	      data = "PULSE";
	      data = "PING";
	    }
	    else if (data.substring(0,1) == "S") {
				if (data.substring(0,2) == "SE") ++TOTAL_STROKE_COUNT;
	      data = "STROKE";
	    }
	    else {
	      data = data.trim();
	    }
	    switch (data) {
	      case "PING":
				++pingCount;
		break;
	      case "PULSE":
		break;
	      case "STROKE":
		break;
	      default:
		callback(data);
	    }
	  });
};


var write = function(buffer) {
  debug(">" + buffer)
  conn.write(buffer + "\r\n",  function(err, result) {
    if (err == null)
    {
      return ("");
    }
    else
    {
      console.log("In write " + err);
      state = "error";
      return (state);
    }   
  });
}

// Waterrower messages
var nextMessage = "USB";
var arduino ={
	"USB":{"response":"CONNECTED","next":"IDS14010"},
	"IDS140":{"response":"STROKE_COUNT","next":"IDD14811"},
	"IDD148":{"response":"STROKE_AVERAGE","next":"IDD14A12"},
	"IDD14A":{"response":"STROKE_PULL","next":"IDD05713"},
	"IDD057":{"response":"DISTANCE","next":"IDS1A005"},
	"IDS1A0":{"response":"HEARTRATE","next":"IDS14010"}
	};


var wr5 ={
	"_WR_":{"response":"CONNECTED","next":"IRD140"},
	"IDD140":{"response":"STROKE_COUNT","next":"IRS142"},
	"IDS142":{"response":"STROKE_AVERAGE","next":"IRS143"},
	"IDS143":{"response":"STROKE_PULL","next":"IRD057"},
	"IDD057":{"response":"DISTANCE","next":"IRD081"},
	"IDD081":{"response":"TOTAL_DISTANCE","next":"IRS1A0"},
	"IDS1A0":{"response":"HEARTRATE","next":"IRD148"},
	"IDD148":{"response":"TOTAL_SPEED","next":"IRD14A"},
	"IDD14A":{"response":"AVERAGE_SPEED","next":"IRD140"},
	"AKR":{"response":"RESET","next":"IRD140"}
	};

values["STROKE_COUNT"] = 0;
values["STROKE_AVERAGE"] = 0;
values["STROKE_PULL"] = 0;
values["DISTANCE"] = 0;
values["TOTAL_DISTANCE"] = 0;
values["HEARTRATE"] = 0;
values["TOTAL_SPEED"] = 0;
values["AVERAGE_SPEED"] = 0;

var readMessage = function(message) {
    var response = {device:'unknown', parameters:[], connected:false};
    message = message.trim();
    debug(message);
    if (type == "unknown") {
	if (message == "USB") {
		type = "arduino";
		response.connected = true;
		nextMessage = arduino[message]["next"];
		debug("Connected to " + type);
	}
	else if (message == '_WR_') {
		type = "wr5";
		response.connected = true;
		nextMessage = wr5[message]["next"];
	}
	else {
		nextMessage = "USB";
	}
    }
    else if (type == "arduino") {
	response.device = 'arduino';
	response.connected = true;
	if (message.length >= 6){
		if (arduino.hasOwnProperty(message.substring(0, 6))) {
			var _key = arduino[message.substring(0, 6)]["response"];
			debug(" key=" + _key + " value=" + ACHtoDecimal(message.substring(6)));
			values[_key] = ACHtoDecimal(message.substring(6));
			nextMessage = arduino[message.substring(0, 6)]["next"];
		}
		else {
			console.error("readMessage cannot find " + message);
		}
	}
	else {
		console.error("readMessage unexpected " + message);
	}
    }
    else if (type == "wr5") {
	response.device = 'waterrower';
	response.connected = true;
	if (message.length >= 6){
		if (wr5.hasOwnProperty(message.substring(0, 6))) {
			var _key = wr5[message.substring(0, 6)]["response"];
			if (message.length > 6) {
				values[_key] = ACHtoDecimal(message.substring(6));
			}
			nextMessage = wr5[message.substring(0, 6)]["next"];
		}
		else {
			console.error("readMessage cannot find |" + message.substring(0, 6) + "|");
		}
	}
	else if (message == "AKR") {
		nextMessage = wr5[message]["next"];
	}
	else {
		console.error("readMessage unexpected " + message);
	}
    }
    else {
		console.error("readMessage bad type " + type)
    }
    return (response);
}

var resetMessage = function() {
    type = "unknown";
    nextMessage = "USB";
}

function ACHtoDecimal(input) {
	var value;
	var total = 0;
	for (var i = 0; i < input.length; i++) {
		total = total * 16;
		value = input.charCodeAt(i) - 48;
		if (value > 9) {
			value = value - 7;
		}
		total = total + value;
	}
	return (total);
}

function ACHtoDecimalReverse(input) {
	var value;
	var total = 0;
	for (var i = input.length - 1; i >= 0; i--) {
		total = total * 16;
		value = input.charCodeAt(i) - 48;
		if (value > 9) {
			value = value - 7;
		}
		total = total + value;
	}
	return (total);
}

