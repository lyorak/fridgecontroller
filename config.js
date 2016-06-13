var program = require('commander');
var fs = require('fs');

program
  .version('0.0.1')
  .option('-i, --deviceId [id]', 'MCS device ID')
  .option('-k, --deviceKey [key]', 'MCS device key')
  .option('-h, --host [host]','MCS host','api.mediatek.com')
  .parse(process.argv);


if((!program.deviceKey) || (!program.deviceId)){
    console.log("device ID:",program.deviceId);
    console.log("device key:",program.deviceKey);
    program.outputHelp();
}else {
    var mcsOptions = {
    deviceId: program.deviceId,
    deviceKey: program.deviceKey,
    host:program.host
};
    var data = JSON.stringify(mcsOptions);
    fs.writeFile('./mcsconfig.json', data, function (err) {
    if (err) {
      console.log('There has been an error saving your configuration data.');
      console.log(err.message);
      return;
    }
    console.log('Configuration saved successfully.')
  });
}




  

  