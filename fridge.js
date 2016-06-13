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
const fan1Fullpin = 8;
const fan1Halfpin = 9;
const fan2Fullpin = 10;
const fan2Halfpin = 11;

const fan1 = {
    half: fan1Halfpin,
    full: fan1Fullpin
};

const fan2 = {
    half: fan2Halfpin,
    full: fan2Fullpin
};

var tSensors = [t1pin, t2pin];

var firmata = require('firmata');
const dhtAttempts = 3;
var dhtAttCnt = 0;

var setFan = function(fan,level) {
    if(level == 0) {
        board.digitalWrite(fan.half, board.LOW);
        board.digitalWrite(fan.full, board.LOW);
    }else if(level == 50) {
        board.digitalWrite(fan.half, board.HIGH);
        board.digitalWrite(fan.full, board.LOW);
    }if(level == 100) {
        board.digitalWrite(fan.half, board.LOW);
        board.digitalWrite(fan.full, board.HIGH);
    }
}

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
    board.pinMode(fan1Fullpin, board.MODES.OUTPUT);
    board.pinMode(fan1Halfpin, board.MODES.OUTPUT);
    board.pinMode(fan2Fullpin, board.MODES.OUTPUT);
    board.pinMode(fan2Halfpin, board.MODES.OUTPUT);
    board.digitalWrite(ledPin, board.LOW);
    board.digitalWrite(fan1Fullpin, board.LOW);
    board.digitalWrite(fan1Halfpin, board.LOW);
    board.digitalWrite(fan2Fullpin, board.LOW);
    board.digitalWrite(fan2Halfpin, board.LOW);
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
            firmataEmitter.emit('temperature-' + pin, temperature);
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


firmataEmitter.on('temperature-' + t1pin, function(value) {
    console.log('temperature back: ', value);
    myApp.emit('tback', '', value);
    tback = value;
});

firmataEmitter.on('temperature-' + t2pin, function(value) {
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
            myApp.emit('fanswitch_a','',0);
            myApp.emit('fanswitch_b','',0);
            setFan(fan1,0);
            setFan(fan2,0);
            break;
        case 1:
            myApp.emit('fanswitch_a','',1);
            myApp.emit('fanswitch_b','',0);
            setFan(fan1,50);
            setFan(fan2,0);
            break;        
        case 2:
            myApp.emit('fanswitch_a','',1);
            myApp.emit('fanswitch_b','',1);
            setFan(fan1,50);
            setFan(fan2,50);
            break;        
        case 3:
            myApp.emit('fanswitch_a','',2);
            myApp.emit('fanswitch_b','',1);
            setFan(fan1,100);
            setFan(fan2,50);
            break;        
        case 4:
            myApp.emit('fanswitch_a','',2);
            myApp.emit('fanswitch_b','',2);
            setFan(fan1,100);
            setFan(fan2,100);
            break;        
        default:
            myApp.emit('fanswitch_a','',1);
            myApp.emit('fanswitch_b','',1);;
            setFan(fan1,50);
            setFan(fan2,50);
            break;
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
    myApp.emit('fanswitch_a','',0);
    myApp.emit('fanswitch_b','',0);
});

myApp.on('automanual', function(data, time) {
    if (Number(data) === 1) {
        autoMode = true;
    } else {
        autoMode = false;
    }
});

myApp.on('fanswitch_a', function(data, time) {
    if (Number(data) === 0) {
        setFan(fan1,0);
    } else if (Number(data) === 1) {
        setFan(fan1,50);
    } else if (Number(data) === 2) {
        setFan(fan1,100);
    }
});

myApp.on('fanswitch_b', function(data, time) {
    if (Number(data) === 0) {
        setFan(fan2,0);
    } else if (Number(data) === 1) {
        setFan(fan2,50);
    } else if (Number(data) === 2) {
        setFan(fan2,100);
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