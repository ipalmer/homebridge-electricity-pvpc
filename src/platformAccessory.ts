import fetch from 'node-fetch';
import cron from 'node-cron';
import { Service, PlatformAccessory } from 'homebridge';

import { ElectricityPricePlatform } from './platform';

interface PriceInfo {
  date: string;
  hour: string;
  'is-cheap': boolean;
  'is-under-avg': boolean;
  market: string;
  price: number;
  units: string;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ElectricityPriceAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  // private exampleStates = {
  //   On: false,
  //   Brightness: 100,
  // };

  constructor(
    private readonly platform: ElectricityPricePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Precio de la luz');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.On)
    //   .onSet(this.setOn.bind(this));               // GET - bind to the `setOn` method below

    // register handlers for the Brightness Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.Brightness)
    //   .onSet(this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below

    // Define la función de actualización
    // const updateLightPrice = () => {
    //   fetch('https://api.preciodelaluz.org/v1/prices/now?zone=PCB')
    //     .then(res => res.json())
    //     .then(body => {
    //       // this.platform.log.debug(`API: ${body}`);
    //       const newLightPrice = body.price;
    //       this.platform.log.debug(`Random web ${newLightPrice}`);
    //       this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(body['is-under-avg']);
    //       this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(newLightPrice);
    //       // this.lightSensorService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).updateValue(this.lightPrice);
    //     })
    //     .catch((error: any) => this.platform.log.debug(`Failed to update light level: ${error}`));
    // };

    const updateLightPrice = () => {
      fetch('https://api.preciodelaluz.org/v1/prices/all?zone=PCB')
        .then(res => res.json())
        .then((body: Record<string, PriceInfo>) => {
          let maxPrice = 0;
          let minPrice = Infinity;

          // Calcula la media ponderada de los precios
          let sum = 0;
          let weightSum = 0;
          for (const priceInfo of Object.values(body)) {
            const weight = 1 / priceInfo.price;
            sum += priceInfo.price * weight;
            weightSum += weight;

            if (priceInfo.price > maxPrice) {
              maxPrice = priceInfo.price;
            }
            if (priceInfo.price < minPrice) {
              minPrice = priceInfo.price;
            }
          }
          const weightedAveragePrice = sum / weightSum;

          // Calcula la media de los precios
          let sum2 = 0;
          let count = 0;
          for (const priceInfo of Object.values(body)) {
            sum2 += priceInfo.price;
            count += 1;
          }
          const averagePrice = sum2 / count;

          // Obtiene el precio actual
          const currentHour = new Date().getHours();
          const currentPriceInfo = body[`${currentHour.toString().padStart(2, '0')}-${(currentHour + 1).toString().padStart(2, '0')}`];
          const currentPrice = currentPriceInfo ? currentPriceInfo.price : 0;
          const currentPricePercentage = ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100;

          this.platform.log.debug(`${currentHour.toString().padStart(2, '0')}-${(currentHour + 1).toString().padStart(2, '0')}`);
          this.platform.log.debug(`Average Price ${weightedAveragePrice.toFixed(2)} o ${averagePrice.toFixed(2)}`);
          this.platform.log.debug(`Current Price ${currentPrice} percentage ${currentPricePercentage}`);
          this.platform.log.debug(`Updating light price to ${currentPricePercentage}`);
          this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(currentPricePercentage);

          // Enciende o apaga la bombilla en función de si el precio actual está por debajo de la media ponderada
          this.platform.log.debug(`Light price is cheap ${currentPrice < weightedAveragePrice}`);
          this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(currentPrice < weightedAveragePrice);
        })
        .catch(error => this.platform.log.debug(`Failed to update light price: ${error}`));
    };

    // Llama a la función de actualización inmediatamente
    updateLightPrice();

    // Luego la llama cada hora
    cron.schedule('0 * * * *', updateLightPrice); // Actualiza cada hora

    // setInterval(() => {
    //   fetch('https://www.random.org/integers/?num=1&min=1&max=100&col=1&base=10&format=plain')
    //     .then((res: { json: () => any; }) => res.json())
    //     .then((body: { price: any; }) => {
    //       const newLightPrice = body.price;
    //       this.platform.log.debug(`Random web ${newLightPrice}`);
    //       this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(newLightPrice);
    //       // this.lightSensorService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).updateValue(this.lightPrice);
    //     })
    //     .catch((error: any) => this.platform.log.debug(`Failed to update light level: ${error}`));
    //   const newLightLevel = Math.floor(Math.random() * 100) + 1; // Genera un número aleatorio entre 1 y 100
    //   this.platform.log.debug(`Updating light level to ${newLightLevel}`);
    //   this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(newLightLevel);
    // }, 10000); // Actualiza cada minuto

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    // /**
    //  * Updating characteristics values asynchronously.
    //  *
    //  * Example showing how to update the state of a Characteristic asynchronously instead
    //  * of using the `on('get')` handlers.
    //  * Here we change update the motion sensor trigger states on and off every 10 seconds
    //  * the `updateCharacteristic` method.
    //  *
    //  */
    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  // async setOn(value: CharacteristicValue) {
  //   // implement your own code to turn your device on/off
  //   this.exampleStates.On = value as boolean;

  //   this.platform.log.debug('Set Characteristic On ->', value);
  // }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  // async getOn(): Promise<CharacteristicValue> {
  //   // implement your own code to check if the device is on
  //   const isOn = this.exampleStates.On;

  //   this.platform.log.debug('Get Characteristic On ->', isOn);

  //   // if you need to return an error to show the device as "Not Responding" in the Home app:
  //   // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

  //   return isOn;
  // }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  // async setBrightness(value: CharacteristicValue) {
  //   // implement your own code to set the brightness
  //   this.exampleStates.Brightness = value as number;

  //   this.platform.log.debug('Set Characteristic Brightness -> ', value);
  // }

}
