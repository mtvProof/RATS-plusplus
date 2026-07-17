/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Info = require('../structures/Info');
const InformationHandler = require('../handlers/informationHandler.js');
const MapMarkers = require('../structures/MapMarkers.js');
const SamSiteWarningHandler = require('../handlers/samSiteWarningHandler.js');
const SmartAlarmHandler = require('../handlers/smartAlarmHandler.js');
const SmartSwitchHandler = require('../handlers/smartSwitchHandler.js');
const StorageMonitorHandler = require('../handlers/storageMonitorHandler.js');
const Team = require('../structures/Team');
const TeamHandler = require('../handlers/teamHandler.js');
const Time = require('../structures/Time');
const TimeHandler = require('../handlers/timeHandler.js');
const Timer = require('../util/timer.js');
const VendingMachines = require('../handlers/vendingMachineHandler.js');

module.exports = {
    pollingHandler: async function (rustplus, client) {
        if (rustplus.isPollingHandlerRunning) return;
        rustplus.isPollingHandlerRunning = true;

        try {
            let info = await rustplus.getInfoAsync();
            let infoValid = await rustplus.isResponseValid(info);
            
            // Add delay between requests to prevent token bucket depletion
            await Timer.sleep(1000);
            
            let mapMarkers = await rustplus.getMapMarkersAsync();
            let mapMarkersValid = await rustplus.isResponseValid(mapMarkers);
            
            await Timer.sleep(1000);
            
            let teamInfo = await rustplus.getTeamInfoAsync();
            let teamInfoValid = await rustplus.isResponseValid(teamInfo);
            
            await Timer.sleep(1000);
            
            let time = await rustplus.getTimeAsync();
            let timeValid = await rustplus.isResponseValid(time);

            // If this is the first poll and any critical data is missing, we need to wait for valid data
            if (rustplus.isFirstPoll) {
                if (!infoValid || !mapMarkersValid || !teamInfoValid || !timeValid) {
                    return;
                }
                rustplus.info = new Info(info.info);
                rustplus.time = new Time(time.time, rustplus, client);
                rustplus.team = new Team(teamInfo.teamInfo, rustplus);
                rustplus.mapMarkers = new MapMarkers(mapMarkers.mapMarkers, rustplus, client);
            }

            // Pass both the data and validity flags to handlers
            await module.exports.handlers(rustplus, client, info, mapMarkers, teamInfo, time, 
                { infoValid, mapMarkersValid, teamInfoValid, timeValid });
            rustplus.isFirstPoll = false;
        } catch (error) {
            rustplus.log(client.intlGet(null, 'errorCap'),
                `POLLING HANDLER ERROR: ${error.message}`, 'error');
        } finally {
            rustplus.isPollingHandlerRunning = false;
        }
    },

    handlers: async function (rustplus, client, info, mapMarkers, teamInfo, time, validityFlags = {}) {
        const { infoValid = true, mapMarkersValid = true, teamInfoValid = true, timeValid = true } = validityFlags;
        
        // Update team info if valid
        if (teamInfoValid) {
            await TeamHandler.handler(rustplus, client, teamInfo.teamInfo);
            rustplus.team.updateTeam(teamInfo.teamInfo);
        }

        // Update smart switches and time if time data is valid
        if (timeValid) {
            await SmartSwitchHandler.handler(rustplus, client, time.time);
            TimeHandler.handler(rustplus, client, time.time);
            rustplus.time.updateTime(time.time);
        }
        
        // Update vending machines if map markers are valid
        if (mapMarkersValid) {
            await VendingMachines.handler(rustplus, client, mapMarkers.mapMarkers);
            rustplus.mapMarkers.updateMapMarkers(mapMarkers.mapMarkers);
        }

        // Update server info if valid
        if (infoValid) {
            rustplus.info.updateInfo(info.info);
        }

        // Store validity flags for information handler to use
        rustplus.lastPollValidityFlags = validityFlags;

        // Always try to update information displays (uses cached data if no new data)
        await InformationHandler.handler(rustplus);
        await SamSiteWarningHandler.handler(rustplus, client);
        await StorageMonitorHandler.handler(rustplus, client);
        await SmartAlarmHandler.handler(rustplus, client);
    },
};