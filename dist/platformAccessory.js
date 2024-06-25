"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElectricityPriceAccessory = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const node_cron_1 = __importDefault(require("node-cron"));
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class ElectricityPriceAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        /**
         * These are just used to create a working example
         * You should implement your own code to track the state of your accessory
         */
        this.offPeakState = false;
        this.pricePercentage = 0;
        this.colorHue = 100;
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'preciodelaluz.org')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, 'k2ihjJH7ENu8')
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
            .onGet(this.getBrightness.bind(this))
            .onSet(this.setBrightness.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Hue)
            .onGet(this.getHue.bind(this))
            .onSet(this.setHue.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.Saturation).updateValue(100.0);
        const updateLightPrice = () => {
            (0, node_fetch_1.default)('https://api.preciodelaluz.org/v1/prices/all?zone=PCB')
                .then(res => res.json())
                .then((body) => {
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
                this.offPeakState = this.pricePercentage > (20 + (this.colorHue * 80) / 120 / 120 * 100);
                this.platform.log.debug(`${currentHour.toString().padStart(2, '0')}-${(currentHour + 1).toString().padStart(2, '0')}`);
                this.platform.log.debug(`Average Price ${weightedAveragePrice.toFixed(2)} o ${averagePrice.toFixed(2)}`);
                this.platform.log.debug(`Current Price ${currentPrice} percentage ${this.pricePercentage}`);
                this.platform.log.debug(`Updating light price to ${this.pricePercentage}`);
                this.service.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.pricePercentage);
                // Turns the light bulb on or off based on whether the current price is below the weighted average
                this.platform.log.debug(`Light price is cheap ${this.offPeakState}`);
                this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.offPeakState);
                // this.service.getCharacteristic(this.platform.Characteristic.Hue).updateValue((this.pricePercentage / 100) * 120);
            })
                .catch(error => this.platform.log.debug(`Failed to update light price: ${error}`));
        };
        // Llama a la función de actualización inmediatamente
        updateLightPrice();
        // Luego la llama cada hora
        node_cron_1.default.schedule('0 * * * *', updateLightPrice); // Actualiza cada hora
    }
    async getOn() {
        return this.offPeakState;
    }
    async getBrightness() {
        return this.pricePercentage;
    }
    async setBrightness(value) {
        this.colorHue = (value / 120) * 100;
        this.offPeakState = this.pricePercentage > (20 + (this.colorHue * 80) / 120 / 120 * 100);
        this.service.getCharacteristic(this.platform.Characteristic.Hue).updateValue(this.colorHue);
        this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.offPeakState);
    }
    async getHue() {
        return this.colorHue;
    }
    async setHue(value) {
        this.colorHue = value;
        this.offPeakState = this.pricePercentage > (20 + (this.colorHue * 80) / 120 / 120 * 100);
        this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.offPeakState);
    }
}
exports.ElectricityPriceAccessory = ElectricityPriceAccessory;
//# sourceMappingURL=platformAccessory.js.map