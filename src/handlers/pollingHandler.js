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

const RPC_TIMEOUT_MS = 20000;
const HANDLER_TIMEOUT_MS = 30000;

async function withTimeout(fn, timeoutMs, label) {
    return await Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs))
    ]);
}

module.exports = {
    pollingHandler: async function (rustplus, client) {
        if (rustplus.isPollingHandlerRunning) return;
        rustplus.isPollingHandlerRunning = true;

        try {
            let info = await withTimeout(
                () => rustplus.getInfoAsync(),
                RPC_TIMEOUT_MS,
                'getInfoAsync'
            );
            if (!(await rustplus.isResponseValid(info))) return;
            let mapMarkers = await withTimeout(
                () => rustplus.getMapMarkersAsync(),
                RPC_TIMEOUT_MS,
                'getMapMarkersAsync'
            );
            if (!(await rustplus.isResponseValid(mapMarkers))) return;
            let teamInfo = await withTimeout(
                () => rustplus.getTeamInfoAsync(),
                RPC_TIMEOUT_MS,
                'getTeamInfoAsync'
            );
            if (!(await rustplus.isResponseValid(teamInfo))) return;
            let time = await withTimeout(
                () => rustplus.getTimeAsync(),
                RPC_TIMEOUT_MS,
                'getTimeAsync'
            );
            if (!(await rustplus.isResponseValid(time))) return;

            if (rustplus.isFirstPoll) {
                rustplus.info = new Info(info.info);
                rustplus.time = new Time(time.time, rustplus, client);
                rustplus.team = new Team(teamInfo.teamInfo, rustplus);
                rustplus.mapMarkers = new MapMarkers(mapMarkers.mapMarkers, rustplus, client);
            }

            await withTimeout(
                () => module.exports.handlers(rustplus, client, info, mapMarkers, teamInfo, time),
                HANDLER_TIMEOUT_MS,
                'polling handlers'
            );
            rustplus.isFirstPoll = false;
        } catch (error) {
            console.error('CRITICAL: Polling handler error:', error);
            rustplus.log(null, `POLLING ERROR: ${error.message}`);
        } finally {
            rustplus.isPollingHandlerRunning = false;
        }
    },

    handlers: async function (rustplus, client, info, mapMarkers, teamInfo, time) {
        try {
            await withTimeout(
                () => TeamHandler.handler(rustplus, client, teamInfo.teamInfo),
                HANDLER_TIMEOUT_MS,
                'TeamHandler.handler'
            );
            rustplus.team.updateTeam(teamInfo.teamInfo);

            await withTimeout(
                () => SmartSwitchHandler.handler(rustplus, client, time.time),
                HANDLER_TIMEOUT_MS,
                'SmartSwitchHandler.handler'
            );
            TimeHandler.handler(rustplus, client, time.time);
            await withTimeout(
                () => VendingMachines.handler(rustplus, client, mapMarkers.mapMarkers),
                HANDLER_TIMEOUT_MS,
                'VendingMachines.handler'
            );

            rustplus.time.updateTime(time.time);
            rustplus.info.updateInfo(info.info);
            rustplus.mapMarkers.updateMapMarkers(mapMarkers.mapMarkers);

            await withTimeout(
                () => SamSiteWarningHandler.handler(rustplus, client),
                HANDLER_TIMEOUT_MS,
                'SamSiteWarningHandler.handler'
            );

            StorageMonitorHandler.handler(rustplus, client).catch((error) => {
                console.error('STORAGE MONITOR HANDLER ERROR:', error);
                rustplus.log(null, `STORAGE MONITOR HANDLER ERROR: ${error.message}`);
            });
            await withTimeout(
                () => SmartAlarmHandler.handler(rustplus, client),
                HANDLER_TIMEOUT_MS,
                'SmartAlarmHandler.handler'
            );

            if (rustplus.isFirstPoll) {
                await withTimeout(
                    () => InformationHandler.handler(rustplus),
                    HANDLER_TIMEOUT_MS,
                    'InformationHandler.handler'
                );
            }
            else {
                InformationHandler.handler(rustplus).catch((error) => {
                    console.error('INFORMATION HANDLER ERROR:', error);
                    rustplus.log(null, `INFORMATION HANDLER ERROR: ${error.message}`);
                });
            }
        } catch (error) {
            console.error('CRITICAL: Polling handlers error:', error);
            rustplus.log(null, `HANDLERS ERROR: ${error.message}`);
        }
    },
};