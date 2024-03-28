/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Fri Mar 15 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */


export default class AIControl {

    #opts = {
        lightIntensityThreshold: 500, // Default: 500 when should the light turn on/off if the sun is bright enough
        lightTimeStart: 8*60*60*1000, // Default: 8am when should the light start (time / clock) in milliseconds
        lightTimeStop: 20*60*60*1000, // Default: 8pm when should the light stop (time / clock) in milliseconds
        lightRelayName: 'relay2', // Default: relay2 is the name of the light used for mqtt
        pumpWaterLevelThreshold: 30, // Default: 30% when should the water pump stop 
        pumpRelayName: 'relay1', // Default: relay1 is the name of the light used for mqtt
    };
    #db = null;
    #mqtt = null;
    #updateInterval = 5;
    #intervalId = null;
    #updateRunning = false; // if request is running, the interval will not trigged

    constructor(opts = {}) {
        this.#opts = Object.assign(this.#opts, opts);
        this.#db = this.#opts.db;
        this.#mqtt = this.#opts.mqtt;
    }

    start() {
        this.#intervalId = setInterval(async () => {
            await this.#loop();
        }, 1000 * this.#updateInterval);
    }

    stop() {
        clearInterval(this.#intervalId);
    }

    async #loop() {
        // do nothing
        if (this.#updateRunning === true) {
            return;
        }

        this.#updateRunning = true;

        console.log('run ai control loop');

        try {
            const config = await this.#db.models.Config.findOne();

            // check light turn on off
            const now = new Date();
            const dateStart= new Date();
            const dateStop= new Date();
            
            // set time in start and end date
            dateStart.setHours(0,0,0,this.#opts.lightTimeStart);
            dateStop.setHours(0,0,0,this.#opts.lightTimeStop);

            // check light can be lighted in time?
            if(dateStart <= now && dateStop >= now)
            {
                const lightConfigName = 'esp32lr20' + this.#opts.lightRelayName.charAt(0).toLocaleUpperCase() + this.#opts.lightRelayName.slice(1);
                if(config.lightIntensity >= this.#opts.lightIntensityThreshold && config[lightConfigName]?.toLowerCase() === 'on')
                {
                    // Publish environment sensor data to mqtt
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/off', '{}');
                }
                else if(config[lightConfigName]?.toLowerCase() === 'off')
                {
                    // Publish environment sensor data to mqtt
                    await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.lightRelayName + '/on', '{}');
                }
            }


            const pumpConfigName = 'esp32lr20' + this.#opts.pumpRelayName.charAt(0).toLocaleUpperCase() + this.#opts.pumpRelayName.slice(1);
            if(config.waterLevel >= this.#opts.pumpWaterLevelThreshold && config[pumpConfigName]?.toLowerCase() === 'off')
            {
                // publish command to turn relay on
                await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/on', '{}');
            }
            else if(config[pumpConfigName]?.toLowerCase() !== 'off')
            {
                // publish command to turn relay off
                await this.#mqtt?.publish('esp32lr20/cmd/' + this.#opts.pumpRelayName + '/off', '{}');
            }

        } catch (error) {
            console.log(error);
        }
        finally {
            this.#updateRunning = false;
        }
    }
}