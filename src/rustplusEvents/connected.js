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

const DiscordMessages = require('../discordTools/discordMessages.js');
const Info = require('../structures/Info');
const Map = require('../structures/Map');
const PollingHandler = require('../handlers/pollingHandler.js');

module.exports = {
    name: 'connected',
    async execute(rustplus, client) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        const isSecondary = rustplus.instanceLabel === 'secondary';

        rustplus.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'connectedToServer'));

        const instance = client.getInstance(rustplus.guildId);
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        rustplus.uptimeServer = new Date();

        /* Start the token replenish task */
        rustplus.tokensReplenishTaskId = setInterval(rustplus.replenishTokens.bind(rustplus), 1000);

        /* Get basic server info first for validation */
        const info = await rustplus.getInfoAsync();
        if (!(await rustplus.isResponseValid(info))) {
            rustplus.log(client.intlGet(null, 'errorCap'),
                client.intlGet(null, 'somethingWrongWithConnection'), 'error');

            if (!isSecondary) {
                instance.activeServer = null;
                client.setInstance(guildId, instance);

                await DiscordMessages.sendServerConnectionInvalidMessage(guildId, serverId);
                await DiscordMessages.sendServerMessage(guildId, serverId, null);
            }

            client.resetRustplusVariables(guildId, rustplus.instanceLabel);

            rustplus.disconnect();
            if (isSecondary) {
                delete client.rustplusSecondaryInstances[guildId];
            }
            else {
                delete client.rustplusInstances[guildId];
            }
            return;
        }
        rustplus.info = new Info(info.info);
        rustplus.log(client.intlGet(null, 'connectedCap'), client.intlGet(null, 'rustplusOperational'));

        /* Set operational early to allow basic commands while map loads */
        rustplus.isOperational = true;

        /* Request the map with reduced timeout for faster startup */
        const map = await rustplus.getMapAsync(60 * 1000); /* 60 sec timeout */
        if (!(await rustplus.isResponseValid(map))) {
            rustplus.log(client.intlGet(null, 'warningCap'),
                client.intlGet(null, 'couldNotGetMap') || 'Could not retrieve map, continuing with limited functionality', 'warn');
            /* Continue operation even without map - some features will be limited */
        }

        /* Process map if successfully retrieved */
        if (map && map.map) {
            if (!isSecondary) {
                if (client.rustplusMaps.hasOwnProperty(guildId)) {
                    if (client.isJpgImageChanged(guildId, map.map)) {
                        rustplus.map = new Map(map.map, rustplus);

                        await rustplus.map.writeMap(false, true);
                        await DiscordMessages.sendServerWipeDetectedMessage(guildId, serverId);
                        await DiscordMessages.sendInformationMapMessage(guildId);
                    }
                    else {
                        rustplus.map = new Map(map.map, rustplus);

                        await rustplus.map.writeMap(false, true);
                        await DiscordMessages.sendInformationMapMessage(guildId);
                    }
                }
                else {
                    rustplus.map = new Map(map.map, rustplus);

                    await rustplus.map.writeMap(false, true);
                    await DiscordMessages.sendInformationMapMessage(guildId);
                }
            }
            else {
                // Secondary retains map data locally but does not post information updates.
                rustplus.map = new Map(map.map, rustplus);
            }
        }

        if (isSecondary) {
            // Note: rustplusSecondaryReconnecting flag cleared in pollingHandler after first poll
            if (client.rustplusSecondaryReconnecting[guildId]) {
                if (client.rustplusSecondaryReconnectTimers[guildId]) {
                    clearTimeout(client.rustplusSecondaryReconnectTimers[guildId]);
                    client.rustplusSecondaryReconnectTimers[guildId] = null;
                }
            }
        }
        else {
            // Note: rustplusReconnecting flag cleared in pollingHandler after first poll
            if (client.rustplusReconnecting[guildId]) {
                if (client.rustplusReconnectTimers[guildId]) {
                    clearTimeout(client.rustplusReconnectTimers[guildId]);
                    client.rustplusReconnectTimers[guildId] = null;
                }

                await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 0);
            }

            await DiscordMessages.sendServerMessage(guildId, serverId, null);
        }

        /* Setup Smart Devices only for primary (hoster1) */
        if (!isSecondary) {
            await require('../discordTools/SetupSwitches')(client, rustplus);
            await require('../discordTools/SetupSwitchGroups')(client, rustplus);
            await require('../discordTools/SetupAlarms')(client, rustplus);
            await require('../discordTools/SetupStorageMonitors')(client, rustplus);
        }
        rustplus.isNewConnection = false;
        rustplus.loadMarkers();

        await PollingHandler.pollingHandler(rustplus, client);
        rustplus.pollingTaskId = setInterval(PollingHandler.pollingHandler, client.pollingIntervalMs, rustplus, client);

        rustplus.updateLeaderRustPlusLiteInstance();
    },
};
