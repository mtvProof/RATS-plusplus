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

const Client = require('../../index.ts');
const DiscordMessages = require('../discordTools/discordMessages.js');
const InstanceUtils = require('../util/instanceUtils.js');

module.exports = {
    handler: async function (rustplus) {
        if (rustplus.isInformationHandlerRunning) return;
        rustplus.isInformationHandlerRunning = true;

        try {
        // Only primary (hoster1) updates the information channel.
        if (rustplus.instanceLabel === 'secondary') return;

        const guildId = rustplus.guildId;
        const instance = Client.client.getInstance(guildId);

        // Ensure the secondary (hoster2) instance is running on the active server when paired.
        const credentials = InstanceUtils.readCredentialsFile(guildId);
        const hoster2 = credentials.hoster2;
        const activeServerId = rustplus.serverId;
        const liteForHoster2 = hoster2 && instance.serverListLite[activeServerId] ?
            instance.serverListLite[activeServerId][hoster2] : null;
        const secondary = Client.client.rustplusSecondaryInstances[guildId];
        const secondaryOnThisServer = secondary && !secondary.isDeleted &&
            secondary.serverId === activeServerId;

        if (liteForHoster2 && !secondaryOnThisServer) {
            if (secondary) {
                secondary.isDeleted = true;
                secondary.disconnect();
                delete Client.client.rustplusSecondaryInstances[guildId];
            }

            Client.client.createRustplusInstance(
                guildId,
                liteForHoster2.serverIp,
                liteForHoster2.appPort,
                liteForHoster2.steamId,
                liteForHoster2.playerToken,
                'secondary'
            );
        }

        if (rustplus.informationIntervalCounter === 0) {
            try {
                await DiscordMessages.sendUpdateServerInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateServerInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateEventInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateEventInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateTeamInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateTeamInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateToolCupboardUpkeepInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateToolCupboardUpkeepInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateMarketWatchlistInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateMarketWatchlistInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateLootInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateLootInformationMessage failed: ${e}`, 'error');
            }
        }

        if (rustplus.informationIntervalCounter === 5) {
            rustplus.informationIntervalCounter = 0;
        }
        else {
            rustplus.informationIntervalCounter += 1;
        }
        } finally {
            rustplus.isInformationHandlerRunning = false;
        }
    },
}