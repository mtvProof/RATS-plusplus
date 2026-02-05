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
        if (rustplus.instanceLabel === 'secondary') return;

        const guildId = rustplus.guildId;
        const primaryRustplus = client.rustplusInstances[guildId];

        // Evaluate storage monitor reachability/state via primary (hoster1) only; secondary may lack TC access.
        if (!primaryRustplus || !primaryRustplus.isOperational) return;

        let instance = client.getInstance(guildId);
        const serverId = primaryRustplus.serverId;

        if (!instance.serverList.hasOwnProperty(serverId)) return;

        if (primaryRustplus.storageMonitorIntervalCounter === 29) {
            primaryRustplus.storageMonitorIntervalCounter = 0;
        }
        else {
            primaryRustplus.storageMonitorIntervalCounter += 1;
        }

        if (primaryRustplus.storageMonitorIntervalCounter === 0) {
            let instance = client.getInstance(guildId);
            for (const entityId in instance.serverList[serverId].storageMonitors) {
                instance = client.getInstance(guildId);

                const info = await primaryRustplus.getEntityInfoAsync(entityId);
                if (!(await primaryRustplus.isResponseValid(info))) {
                    if (instance.serverList[serverId].storageMonitors[entityId].reachable) {
                        await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, serverId, entityId);
                    }
                    instance.serverList[serverId].storageMonitors[entityId].reachable = false;
                }
                else {
                    instance.serverList[serverId].storageMonitors[entityId].reachable = true;
                }
                client.setInstance(guildId, instance);

                if (instance.serverList[serverId].storageMonitors[entityId].reachable) {
                    if (primaryRustplus.storageMonitors.hasOwnProperty(entityId) &&
                        (primaryRustplus.storageMonitors[entityId].capacity !== 0 &&
                            info.entityInfo.payload.capacity === 0)) {
                        await DiscordMessages.sendStorageMonitorDisconnectNotificationMessage(
                            guildId, serverId, entityId);
                    }

                    primaryRustplus.storageMonitors[entityId] = {
                        items: info.entityInfo.payload.items,
                        expiry: info.entityInfo.payload.protectionExpiry,
                        capacity: info.entityInfo.payload.capacity,
                        hasProtection: info.entityInfo.payload.hasProtection
                    }

                    if (info.entityInfo.payload.capacity !== 0) {
                        if (info.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
                            const monitor = instance.serverList[serverId].storageMonitors[entityId];
                            monitor.type = 'toolCupboard';
                            if (typeof monitor.decayPending === 'undefined') monitor.decayPending = false;
                            if (typeof monitor.firstSeenAt === 'undefined') monitor.firstSeenAt = Date.now();

                            const ageMs = Date.now() - monitor.firstSeenAt;
                            const isActuallyDecaying =
                                info.entityInfo.payload.protectionExpiry === 0 &&
                                info.entityInfo.payload.hasProtection === false;

                            if (isActuallyDecaying && monitor.decaying === false && ageMs > 10000) {
                                if (monitor.decayPending) {
                                    monitor.decaying = true;

                                    await DiscordMessages.sendDecayingNotificationMessage(
                                        guildId, serverId, entityId);

                                    if (monitor.inGame) {
                                        rustplus.sendInGameMessage(client.intlGet(rustplus.guildId, 'isDecaying', {
                                            device: monitor.name
                                        }));
                                    }
                                }
                                else {
                                    // Require two consecutive decay reads before alerting to avoid flicker.
                                    monitor.decayPending = true;
                                }
                            }
                            else if (!isActuallyDecaying) {
                                monitor.decayPending = false;
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