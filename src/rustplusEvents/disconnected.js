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
const InstanceUtils = require('../util/instanceUtils.js');

const Config = require('../../config');

function computeReconnectDelayMs(rustplus) {
    const baseDelay = Number(Config.general.reconnectIntervalMs) || 15000;
    const streak = Math.max(0, Number(rustplus.connectFailureStreak || 0));

    // Exponential backoff capped to 5 minutes to avoid hammering and potential temporary server bans.
    const maxDelay = 5 * 60 * 1000;
    const factor = Math.min(Math.pow(2, Math.min(streak, 6)), 20);
    return Math.min(baseDelay * factor, maxDelay);
}

function resolveReconnectTarget(client, rustplus, instance, isSecondary) {
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;
    const liteByServer = (instance && instance.serverListLite && instance.serverListLite[serverId])
        ? instance.serverListLite[serverId]
        : {};
    const server = instance && instance.serverList ? instance.serverList[serverId] : null;

    let credentials = null;
    try {
        credentials = InstanceUtils.readCredentialsFile(guildId);
    }
    catch (e) {
        credentials = null;
    }

    const base = {
        serverIp: rustplus.server,
        appPort: rustplus.port,
        steamId: rustplus.playerId,
        playerToken: rustplus.playerToken,
        source: 'runtime'
    };

    const applyLite = (steamId, source) => {
        if (!steamId || !liteByServer[steamId]) return false;

        base.serverIp = liteByServer[steamId].serverIp;
        base.appPort = liteByServer[steamId].appPort;
        base.steamId = liteByServer[steamId].steamId;
        base.playerToken = liteByServer[steamId].playerToken;
        base.source = source;
        return true;
    };

    if (isSecondary) {
        const hoster2 = credentials && credentials.hoster2 ? `${credentials.hoster2}` : null;
        if (!applyLite(hoster2, 'serverListLite.hoster2')) {
            applyLite(`${rustplus.hosterSteamId}`, 'serverListLite.runtimeHoster');
        }
    }
    else {
        const hoster = credentials && credentials.hoster ? `${credentials.hoster}` : null;
        if (!applyLite(hoster, 'serverListLite.hoster')) {
            if (!applyLite(`${rustplus.hosterSteamId}`, 'serverListLite.runtimeHoster') && server) {
                base.serverIp = server.serverIp;
                base.appPort = server.appPort;
                base.steamId = server.steamId;
                base.playerToken = server.playerToken;
                base.source = 'serverList.primary';
            }
        }
    }

    return base;
}

module.exports = {
    name: 'disconnected',
    async execute(rustplus, client) {
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
            const reconnectTarget = resolveReconnectTarget(client, rustplus, instance, isSecondary);
            const reconnectDelayMs = computeReconnectDelayMs(rustplus);

            rustplus.log(client.intlGet(null, 'infoCap'),
                `Reconnect target: source=${reconnectTarget.source}, steamId=${reconnectTarget.steamId}, ` +
                `server=${reconnectTarget.serverIp}-${reconnectTarget.appPort}`);
            rustplus.log(client.intlGet(null, 'infoCap'),
                `Reconnect delay: ${reconnectDelayMs}ms (streak=${rustplus.connectFailureStreak || 0}, ` +
                `lastError=${rustplus.lastConnectErrorCode || 'none'})`);

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
                    reconnectTarget.serverIp,
                    reconnectTarget.appPort,
                    reconnectTarget.steamId,
                    reconnectTarget.playerToken,
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
                    reconnectTarget.serverIp,
                    reconnectTarget.appPort,
                    reconnectTarget.steamId,
                    reconnectTarget.playerToken
                );
            }
        }
    },
};