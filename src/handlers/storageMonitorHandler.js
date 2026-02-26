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

const Constants = require('../util/constants.js');
const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = {
    handler: async function (rustplus, client) {
        const guildId = rustplus.guildId;
        const primaryRustplus = client.rustplusInstances[guildId];
        const secondaryRustplus = client.rustplusSecondaryInstances[guildId];

        // Prefer primary, but fall back to an operational secondary if it has access (two-team split support).
        const candidates = [primaryRustplus, secondaryRustplus]
            .filter(rp => rp && rp.isOperational);

        if (candidates.length === 0) return;

        // Use the primary when available, otherwise the first operational candidate.
        const poller = candidates.find(rp => rp.instanceLabel === 'primary') || candidates[0];

        let instance = client.getInstance(guildId);
        const serverId = poller.serverId;
        const suppressNotFound = poller.uptimeServer &&
            (Date.now() - poller.uptimeServer.getTime()) < 5 * 60 * 1000;

        if (!instance.serverList.hasOwnProperty(serverId)) return;

        if (poller.storageMonitorIntervalCounter === 29) {
            poller.storageMonitorIntervalCounter = 0;
        }
        else {
            poller.storageMonitorIntervalCounter += 1;
        }

        if (poller.storageMonitorIntervalCounter === 0) {
            let instance = client.getInstance(guildId);
            for (const entityId in instance.serverList[serverId].storageMonitors) {
                instance = client.getInstance(guildId);

                // Try each operational instance until we get a valid response (handles TC auth being on hoster2).
                let info = null;
                let infoSource = null;
                for (const candidate of candidates) {
                    const candidateInfo = await candidate.getEntityInfoAsync(entityId);
                    if (await candidate.isResponseValid(candidateInfo)) {
                        info = candidateInfo;
                        infoSource = candidate;
                        break;
                    }
                }

                if (!info) {
                    if (suppressNotFound) {
                        continue;
                    }
                    if (instance.serverList[serverId].storageMonitors[entityId].reachable) {
                        await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, serverId, entityId);
                        instance.serverList[serverId].storageMonitors[entityId].reachable = false;
                        client.setInstance(guildId, instance);

                        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
                    }
                    continue;
                }

                if (!instance.serverList[serverId].storageMonitors[entityId].reachable) {
                    instance.serverList[serverId].storageMonitors[entityId].reachable = true;
                    client.setInstance(guildId, instance);

                    await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
                }

                if (instance.serverList[serverId].storageMonitors[entityId].reachable) {
                    if (infoSource.storageMonitors.hasOwnProperty(entityId) &&
                        (infoSource.storageMonitors[entityId].capacity !== 0 &&
                            info.entityInfo.payload.capacity === 0)) {
                        await DiscordMessages.sendStorageMonitorDisconnectNotificationMessage(
                            guildId, serverId, entityId);
                    }

                    infoSource.storageMonitors[entityId] = {
                        items: info.entityInfo.payload.items,
                        expiry: info.entityInfo.payload.protectionExpiry,
                        capacity: info.entityInfo.payload.capacity,
                        hasProtection: info.entityInfo.payload.hasProtection
                    }

                    if (info.entityInfo.payload.capacity !== 0) {
                        if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
                            const monitor = instance.serverList[serverId].storageMonitors[entityId];
                            monitor.type = 'toolCupboard';
                            if (typeof monitor.decaying === 'undefined') monitor.decaying = false;

                            if (info.entityInfo.payload.protectionExpiry === 0 &&
                                monitor.decaying === false) {
                                monitor.decaying = true;

                                await DiscordMessages.sendDecayingNotificationMessage(
                                    guildId, serverId, entityId);

                                if (monitor.inGame) {
                                    rustplus.sendInGameMessage(client.intlGet(rustplus.guildId, 'isDecaying', {
                                        device: monitor.name
                                    }));
                                }
                            }
                            else if (info.entityInfo.payload.protectionExpiry !== 0) {
                                monitor.decaying = false;
                            }
                        }
                        else if (info.entityInfo.payload.capacity ===
                            Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                            instance.serverList[serverId].storageMonitors[entityId].type = 'vendingMachine';
                        }
                        else if (info.entityInfo.payload.capacity ===
                            Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                            instance.serverList[serverId].storageMonitors[entityId].type = 'largeWoodBox';
                        }
                        client.setInstance(guildId, instance);
                    }
                }

                await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
            }
        }
    },
}