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
const VendingMachines = require('../handlers/vendingMachineHandler.js');

module.exports = {
    pollingHandler: async function (rustplus, client) {
        if (rustplus.isPollingHandlerRunning) return;
        rustplus.isPollingHandlerRunning = true;

        try {
            /* Poll information such as info, mapMarkers, teamInfo and time */
            let info = await rustplus.getInfoAsync();
            if (!(await rustplus.isResponseValid(info))) return;
            let mapMarkers = await rustplus.getMapMarkersAsync();
            if (!(await rustplus.isResponseValid(mapMarkers))) return;
            let teamInfo = await rustplus.getTeamInfoAsync();
            if (!(await rustplus.isResponseValid(teamInfo))) return;
            let time = await rustplus.getTimeAsync();
            if (!(await rustplus.isResponseValid(time))) return;

            if (rustplus.isFirstPoll) {
                rustplus.info = new Info(info.info);
                rustplus.time = new Time(time.time, rustplus, client);
                rustplus.team = new Team(teamInfo.teamInfo, rustplus);
                rustplus.mapMarkers = new MapMarkers(mapMarkers.mapMarkers, rustplus, client);
            }

            await module.exports.handlers(rustplus, client, info, mapMarkers, teamInfo, time);
            rustplus.isFirstPoll = false;

            // Clear reconnecting flags AFTER first poll to ensure grace period suppression works
            const guildId = rustplus.guildId;
            const isSecondary = rustplus.instanceLabel === 'secondary';
            if (isSecondary) {
                if (client.rustplusSecondaryReconnecting[guildId]) {
                    client.rustplusSecondaryReconnecting[guildId] = false;
                }
            } else {
                if (client.rustplusReconnecting[guildId]) {
                    client.rustplusReconnecting[guildId] = false;
                }
            }
        } catch (error) {
            console.error('CRITICAL: Polling handler error:', error);
            rustplus.log(null, `POLLING ERROR: ${error.message}`);
        } finally {
            rustplus.isPollingHandlerRunning = false;
        }
    },

    handlers: async function (rustplus, client, info, mapMarkers, teamInfo, time) {
        try {
            // Check for map wipe and clear playtimes if needed
            rustplus.checkForMapWipeAndClearPlaytimes();

            await TeamHandler.handler(rustplus, client, teamInfo.teamInfo);
            rustplus.team.updateTeam(teamInfo.teamInfo);

            // Secondary (hoster2) should only maintain team info/chat; skip other duties.
            if (rustplus.instanceLabel === 'secondary') return;

            await SmartSwitchHandler.handler(rustplus, client, time.time);
            TimeHandler.handler(rustplus, client, time.time);
            await VendingMachines.handler(rustplus, client, mapMarkers.mapMarkers);

            rustplus.time.updateTime(time.time);
            rustplus.info.updateInfo(info.info);
            rustplus.mapMarkers.updateMapMarkers(mapMarkers.mapMarkers);

            await SamSiteWarningHandler.handler(rustplus, client);

            await StorageMonitorHandler.handler(rustplus, client);
            await SmartAlarmHandler.handler(rustplus, client);

            // Non-critical and potentially slow (Discord/web requests): do not block polling loop.
            InformationHandler.handler(rustplus).catch((error) => {
                console.error('INFORMATION HANDLER ERROR:', error);
                rustplus.log(null, `INFORMATION HANDLER ERROR: ${error.message}`);
            });
        } catch (error) {
            console.error('CRITICAL: Polling handlers error:', error);
            rustplus.log(null, `HANDLERS ERROR: ${error.message}`);
        }
    },
};