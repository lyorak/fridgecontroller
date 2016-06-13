/*
 * fridgeFirmata.ino generated by FirmataBuilder
 * Sat May 14 2016 10:23:49 GMT-0400 (EDT)
 */

#include <ConfigurableFirmata.h>

#include <DigitalInputFirmata.h>
DigitalInputFirmata digitalInput;

#include <DigitalOutputFirmata.h>
DigitalOutputFirmata digitalOutput;

#include <AnalogInputFirmata.h>
AnalogInputFirmata analogInput;

#include <Wire.h>
#include <I2CFirmata.h>
I2CFirmata i2c;

#include <SerialFirmata.h>
SerialFirmata serial;

#include <FirmataExt.h>
FirmataExt firmataExt;

#include <DhtFirmata.h>
DhtFirmata dht;

#include <FirmataReporting.h>
FirmataReporting reporting;

void systemResetCallback()
{
  for (byte i = 0; i < TOTAL_PINS; i++) {
    if (IS_PIN_ANALOG(i)) {
      Firmata.setPinMode(i, ANALOG);
    } else if (IS_PIN_DIGITAL(i)) {
      Firmata.setPinMode(i, OUTPUT);
    }
  }
  firmataExt.reset();
}

void setup()
{
  Firmata.setFirmwareVersion(FIRMWARE_MAJOR_VERSION, FIRMWARE_MINOR_VERSION);

  firmataExt.addFeature(digitalInput);
  firmataExt.addFeature(digitalOutput);
  firmataExt.addFeature(analogInput);
  firmataExt.addFeature(i2c);
  firmataExt.addFeature(dht);
  firmataExt.addFeature(serial);
  firmataExt.addFeature(reporting);

  Firmata.attach(SYSTEM_RESET, systemResetCallback);
  Serial1.begin(57600);
  Firmata.begin(Serial1);
  
  //Firmata.begin(57600);

  systemResetCallback();
}

void loop()
{
  digitalInput.report();

  while(Firmata.available()) {
    Firmata.processInput();
  }

  if (reporting.elapsed()) {
    analogInput.report();
    i2c.report();
  }

  serial.update();
}
