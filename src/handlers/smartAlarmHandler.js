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
const Timer = require('../util/timer.js');

function isNotFoundResponse(response) {
    if (response === 'not_found') return true;
    if (response && typeof response === 'object' && response.error === 'not_found') return true;
    return false;
}

function isTransientFailureResponse(response) {
    if (response === undefined || response === null) return true;

    const text = (response && response.toString) ? response.toString() : `${response}`;
    return text === 'Error: Timeout reached while waiting for response' ||
        /socket hang up|ECONNRESET|EPIPE|ETIMEDOUT|network/i.test(text);
}

module.exports = {
    handler: async function (rustplus, client) {
        if (rustplus.instanceLabel === 'secondary') return;

        const guildId = rustplus.guildId;
        const primaryRustplus = client.rustplusInstances[guildId];

        // Only evaluate reachability via the primary (hoster1). Secondary may never have TC access.
        if (!primaryRustplus || !primaryRustplus.isOperational) return;

        let instance = client.getInstance(guildId);
        const serverId = primaryRustplus.serverId;

        if (!instance.serverList.hasOwnProperty(serverId)) return;

        // Suppress "not found" alerts during grace period after server reboot (5 minutes)
        const isReconnecting = client.rustplusReconnecting[guildId] || 
            client.rustplusSecondaryReconnecting[guildId];
        const suppressNotFound = isReconnecting || (primaryRustplus.uptimeServer &&
            (Date.now() - primaryRustplus.uptimeServer.getTime()) < 5 * 60 * 1000);

        if (primaryRustplus.smartAlarmIntervalCounter === 29) {
            primaryRustplus.smartAlarmIntervalCounter = 0;
        }
        else {
            primaryRustplus.smartAlarmIntervalCounter += 1;
        }

        if (primaryRustplus.smartAlarmIntervalCounter === 0) {
            for (const entityId in instance.serverList[serverId].alarms) {
                instance = client.getInstance(guildId);

                const info = await primaryRustplus.getEntityInfoAsync(entityId);
                if (!(await primaryRustplus.isResponseValid(info))) {
                    // Avoid false "device not found" alerts on transient RPC/network failures.
                    if (isTransientFailureResponse(info)) {
                        continue;
                    }

                    if (suppressNotFound) {
                        // Skip sending alert during grace period after server connect/reboot
                        continue;
                    }

                    // Only mark as missing on explicit not_found from Rust+.
                    if (isNotFoundResponse(info) && instance.serverList[serverId].alarms[entityId].reachable) {
                        await DiscordMessages.sendSmartAlarmNotFoundMessage(guildId, serverId, entityId);

                        instance.serverList[serverId].alarms[entityId].reachable = false;
                        client.setInstance(guildId, instance);

                        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                    }
                }
                else {
                    if (!instance.serverList[serverId].alarms[entityId].reachable) {
                        instance.serverList[serverId].alarms[entityId].reachable = true;
                        client.setInstance(guildId, instance);

                        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId);
                    }
                }
            }
        }
    },

    smartAlarmCommandHandler: function (rustplus, client, command) {
        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;
        const instance = client.getInstance(guildId);
        const alarms = instance.serverList[serverId].alarms;
        const prefix = rustplus.generalSettings.prefix;

        const entityId = Object.keys(alarms).find(e => command === `${prefix}${alarms[e].command}`);
        if (!entityId) return false;

        if (alarms[entityId].lastTrigger === null) {
            rustplus.sendInGameMessage(client.intlGet(guildId, 'alarmHaveNotBeenTriggeredYet', {
                alarm: alarms[entityId].name
            }));
            return true;
        }

        const lastTriggerDate = new Date(alarms[entityId].lastTrigger * 1000);
        const timeSinceTriggerSeconds = Math.floor((new Date() - lastTriggerDate) / 1000);
        const time = Timer.secondsToFullScale(timeSinceTriggerSeconds);

        rustplus.sendInGameMessage(client.intlGet(guildId, 'timeSinceAlarmWasTriggered', {
            alarm: alarms[entityId].name,
            time: time
        }));
        return true;
    },
}