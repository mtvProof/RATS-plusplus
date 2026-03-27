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

const Config = require('../../config');

function computeReconnectDelayMs(failures) {
    const baseDelay = Number(Config.general.reconnectIntervalMs) || 15000;
    const safeFailures = Math.max(0, Number(failures || 0));

    // Exponential backoff with cap so it retries forever, but avoids hammering.
    const maxDelay = 5 * 60 * 1000; // 5 minutes
    const multiplier = Math.pow(2, Math.min(safeFailures, 6));
    return Math.min(baseDelay * multiplier, maxDelay);
}

module.exports = {
    name: 'disconnected',
    async execute(rustplus, client) {
        rustplus.isOperational = false;

        if (!rustplus.isServerAvailable() && !rustplus.isDeleted) {
            rustplus.deleteThisRustplusInstance();
        }

        rustplus.log(client.intlGet(null, 'disconnectedCap'), client.intlGet(null, 'disconnectedFromServer'));

        const isSecondary = rustplus.instanceLabel === 'secondary';

        const guildId = rustplus.guildId;
        const serverId = rustplus.serverId;

        if (rustplus.leaderRustPlusInstance !== null) {
            if (client.rustplusLiteReconnectTimers[guildId]) {
                clearTimeout(client.rustplusLiteReconnectTimers[guildId]);
                client.rustplusLiteReconnectTimers[guildId] = null;
            }
            rustplus.leaderRustPlusInstance.isActive = false;
            rustplus.leaderRustPlusInstance.disconnect();
            rustplus.leaderRustPlusInstance = null;
        }

        /* Stop current tasks */
        clearInterval(rustplus.pollingTaskId);
        clearInterval(rustplus.tokensReplenishTaskId);
        clearTimeout(rustplus.inGameChatTimeout);

        /* Reset map markers, timers & arrays */
        if (rustplus.mapMarkers) rustplus.mapMarkers.reset();

        /* Stop all custom timers */
        for (const [id, timer] of Object.entries(rustplus.timers)) timer.timer.stop();

        if (rustplus.isDeleted) return;

        /* Check if this was an active connection that should reconnect */
        const instance = client.getInstance(guildId);
        const shouldReconnect = isSecondary ? 
            client.activeRustplusSecondaryInstances[guildId] : 
            (client.activeRustplusInstances[guildId] || (instance && instance.activeServer === serverId));

        rustplus.log(client.intlGet(null, 'infoCap'), 
            `Disconnect check: activeFlag=${isSecondary ? client.activeRustplusSecondaryInstances[guildId] : client.activeRustplusInstances[guildId]}, ` +
            `activeServer=${instance?.activeServer}, serverId=${serverId}, shouldReconnect=${shouldReconnect}`);

        /* Was the disconnection unexpected? */
        if (shouldReconnect) {
            const failureKey = `${guildId}:${rustplus.instanceLabel}`;
            const failures = client.rustplusConnectFailures && client.rustplusConnectFailures[failureKey]
                ? client.rustplusConnectFailures[failureKey]
                : 0;
            const lastError = client.rustplusLastConnectError && client.rustplusLastConnectError[failureKey]
                ? client.rustplusLastConnectError[failureKey]
                : 'UNKNOWN';
            const reconnectDelayMs = computeReconnectDelayMs(failures);

            rustplus.log(client.intlGet(null, 'infoCap'),
                `Reconnect delay: ${reconnectDelayMs}ms (failures=${failures}, lastError=${lastError})`);

            if (isSecondary) {
                client.rustplusSecondaryReconnecting[guildId] = true;

                rustplus.log(client.intlGet(null, 'reconnectingCap'), client.intlGet(null, 'reconnectingToServer'));

                delete client.rustplusSecondaryInstances[guildId];

                if (client.rustplusSecondaryReconnectTimers[guildId]) {
                    clearTimeout(client.rustplusSecondaryReconnectTimers[guildId]);
                    client.rustplusSecondaryReconnectTimers[guildId] = null;
                }

                client.rustplusSecondaryReconnectTimers[guildId] = setTimeout(
                    client.createRustplusInstance.bind(client),
                    reconnectDelayMs,
                    guildId,
                    rustplus.server,
                    rustplus.port,
                    rustplus.playerId,
                    rustplus.playerToken,
                    'secondary'
                );
            }
            else {
                if (!client.rustplusReconnecting[guildId]) {
                    await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 1);
                    await DiscordMessages.sendServerMessage(guildId, serverId, 2);
                }

                client.rustplusReconnecting[guildId] = true;

                rustplus.log(client.intlGet(null, 'reconnectingCap'), client.intlGet(null, 'reconnectingToServer'));

                delete client.rustplusInstances[guildId];

                if (client.rustplusReconnectTimers[guildId]) {
                    clearTimeout(client.rustplusReconnectTimers[guildId]);
                    client.rustplusReconnectTimers[guildId] = null;
                }

                client.rustplusReconnectTimers[guildId] = setTimeout(
                    client.createRustplusInstance.bind(client),
                    reconnectDelayMs,
                    guildId,
                    rustplus.server,
                    rustplus.port,
                    rustplus.playerId,
                    rustplus.playerToken
                );
            }
        }
    },
};