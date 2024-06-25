import fetch from 'node-fetch';
import cron from 'node-cron';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

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
  private offPeakState: boolean = false;
  private pricePercentage: number = 0;

  constructor(
    private readonly platform: ElectricityPricePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'preciodelaluz.org')
      .setCharacteristic(this.platform.Characteristic.Model, 'Internet Switch');

    // get the Lightbulb service if it exists, otherwise create a new Lightbulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'PVPC');

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onGet(this.getBrightness.bind(this));


    const updateLightPrice = () => {
      fetch('https://api.preciodelaluz.org/v1/prices/all?zone=PCB')
        .then(res => res.json())
        .then((body: Record<string, PriceInfo>) => {
          let maxPrice = 0;
          let minPrice = Infinity;

          // Calculate the weighted average of prices
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

          // Calculate the average of the prices
          let sum2 = 0;
          let count = 0;
          for (const priceInfo of Object.values(body)) {
            sum2 += priceInfo.price;
            count += 1;
          }
          const averagePrice = sum2 / count;

          // Get the current price
          const currentHour = new Date().getHours();
          const currentPriceInfo = body[`${currentHour.toString().padStart(2, '0')}-${(currentHour + 1).toString().padStart(2, '0')}`];
          const currentPrice = currentPriceInfo ? currentPriceInfo.price : 0;
          this.pricePercentage = 100 - (((currentPrice - minPrice) / (maxPrice - minPrice)) * 100);
          this.offPeakState = currentPrice < weightedAveragePrice;

          this.platform.log.debug(`${currentHour.toString().padStart(2, '0')}-${(currentHour + 1).toString().padStart(2, '0')}`);
          this.platform.log.debug(`Average Price ${weightedAveragePrice.toFixed(2)} o ${averagePrice.toFixed(2)}`);
          this.platform.log.debug(`Current Price ${currentPrice} percentage ${this.pricePercentage}`);
          this.platform.log.debug(`Updating light price to ${this.pricePercentage}`);
          this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.pricePercentage);

          // Turns the light bulb on or off based on whether the current price is below the weighted average
          this.platform.log.debug(`Light price is cheap ${this.offPeakState}`);
          this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.offPeakState);
        })
        .catch(error => this.platform.log.debug(`Failed to update light price: ${error}`));
    };

    // Llama a la función de actualización inmediatamente
    updateLightPrice();

    // Luego la llama cada hora
    cron.schedule('0 * * * *', updateLightPrice); // Actualiza cada hora
  }

  async getOn(): Promise<CharacteristicValue> {
    // disables the change by the user and only returns the value obtained by the price of electricity
    return this.offPeakState;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    return this.pricePercentage;
  }
}
