require('events').EventEmitter.prototype._maxListeners = 100;
var events = require('events');
var firmataEmitter = new events.EventEmitter();

var connectedToFirmata = false;
var connectedToMCS = false;

var fs = require('fs');

var data = fs.readFileSync('./mcsconfig.json'),
      mcsConfig;

try {
    mcsConfig = JSON.parse(data);
}
    catch (err) {
    console.log('No mcsconfig.json found.')
    console.log(err);
    process.exit(1);
}

var mcs = require('mcsjs');

var myApp = mcs.register(mcsConfig);

const ledPin = 13;
const t1pin = 18;
const t2pin = 19;
var tSensors = [t1pin, t2pin];

var firmata = require('firmata');
const dhtAttempts = 3;
var dhtAttCnt = 0;

var getTempHum = function(pin, aboard) {
    //console.log('Asking sensor on pin ',pin);
    aboard.sysexCommand([0x7c, pin]);
};

var getTempHumSwapped = function(aboard) {
    var pin = tSensors.pop();
    tSensors.unshift(pin);
    getTempHum(pin, aboard);
};

var tfront = 0.0;
var tback = 0.0;
var deltaT = 0.0;
var autoMode = true;
const allowedDelta = 2.0;


var board = new firmata.Board("/dev/ttyS0", function(err) {
    if (err) {
        console.log(err);
        board.reset();
        return;
    }
    console.log('connected...');
    connectedToFirmata = true;
    var fw = board.firmware;
    console.log('board.firmware: ', fw);
    board.pinMode(ledPin, board.MODES.OUTPUT);
    board.sysexResponse(0x7c, function(data) {
        var pdata = firmata.Board.decode(data);
        var ecode = pdata[1];
        var pin = pdata[0];
        if (ecode === 0) {
            dhtAttCnt = 0;
            var sign = pdata[3] & 0x80 ? -1 : 1;
            var temperature = ((pdata[3] & 0x7f) << 8 | pdata[2]) / 10.0;
            temperature = temperature * sign;
            var humidity = (pdata[5] << 8 | pdata[4]) / 10.0;
            firmataEmitter.emit('temperaure-' + pin, temperature);
            firmataEmitter.emit('humidity-' + pin, humidity);
        } else {
            dhtAttCnt++;
            if (dhtAttCnt < dhtAttempts) {
                setTimeout(getTempHum, 2000, pin, board);
            } else {
                console.log('3 conscutive read attempts unsuccessful on pin ', pin);
                dhtAttCnt = 0;
            }
        }
    });
    setInterval(getTempHumSwapped, 10000, board);
});


firmataEmitter.on('temperaure-' + t1pin, function(value) {
    console.log('temperature back: ', value);
    myApp.emit('tback', '', value);
    tback = value;
});

firmataEmitter.on('temperaure-' + t2pin, function(value) {
    console.log('temperature front: ', value);
    myApp.emit('tfront', '', value);
    tfront = value;
    tback = 26.0;
    firmataEmitter.emit('deltaT',(tback - tfront));
    
});


firmataEmitter.on('deltaT',function(value){
    console.log("deltaT processing... with value "+value);
    if(autoMode) {
        if((value < 15.0) && (value > 0.0)){ //seems legit value
            if(value < 1.0) {
                firmataEmitter.emit('fans',0);
            }else if (value < 2.0) {
                firmataEmitter.emit('fans',1);
            }else if (value < 3.0) {
                firmataEmitter.emit('fans',2);
            }else if (value < 4.0) {
                firmataEmitter.emit('fans',3);
            }else if (value < 5.0) {
                firmataEmitter.emit('fans',5);
            }   
        }else {
            console.log('deltaT '+value+' is out of range.');
        }
    }
});

firmataEmitter.on('fans', function(value) {
    switch(value) {
        case 0:
            myApp.emit('fan1','',0);
            myApp.emit('fan2','',0);
            break;
        case 1:
            myApp.emit('fan1','',1);
            myApp.emit('fan2','',0);
            break;        
        case 2:
            myApp.emit('fan1','',1);
            myApp.emit('fan2','',1);
            break;        
        case 3:
            myApp.emit('fan1','',2);
            myApp.emit('fan2','',1);
            break;        
        case 4:
            myApp.emit('fan1','',2);
            myApp.emit('fan2','',2);
            break;        
        default:
            myApp.emit('fan1','',1);
            myApp.emit('fan2','',1);;
    }
});

firmataEmitter.on('humidity-' + t1pin, function(value) {
    console.log('humidity back: ', value);
    myApp.emit('hback', '', value);
});

firmataEmitter.on('humidity-' + t2pin, function(value) {
    console.log('humidity front: ', value);
    myApp.emit('hfront', '', value);
});

myApp.on('mcs:connected', function() {
    connectedToMCS = true;
    console.log('connected to MCS');
    myApp.emit('automanual','',1);
});

myApp.on('automanual', function(data, time) {
    if (connectedToFirmata) {
        if (Number(data) === 1) {
           // console.log('blink');
            autoMode = true;
        } else {
            //console.log('off');
            autoMode = false;
        }
    }
});

myApp.emit('ifan', '', 3.45);
myApp.emit('airflow', '', 5.87);

process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
    console.log("Shutting down Firmata...");
    board.reset();
    console.log("done.");
    console.log("Closing MCS connection...");
    myApp.end();
    console.log("done.");
    process.exit();
});