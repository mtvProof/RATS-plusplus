const DiscordMessages = require('../discordTools/discordMessages.js');

const Config = require('../../config');

function getFailureKey(rustplus) {
    return `${rustplus.guildId}:${rustplus.instanceLabel || 'primary'}`;
}

function computeReconnectDelayMs(failures) {
    const baseDelay = Number(Config.general.reconnectIntervalMs) || 15000;
    const safeFailures = Math.max(0, Number(failures || 0));

    const maxDelay = 5 * 60 * 1000;
    const multiplier = Math.pow(2, Math.min(safeFailures, 6));
    return Math.min(baseDelay * multiplier, maxDelay);
}

function isConnectFailureError(err) {
    const errMsg = err ? err.toString() : '';

    return Boolean(err && (
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        errMsg.includes('socket hang up') ||
        errMsg.includes('WebSocket was closed before the connection was established')
    ));
}

function isTransientResponseFailure(response) {
    if (response === undefined) return true;

    const responseText = response && typeof response.toString === 'function'
        ? response.toString()
        : '';

    if (responseText === 'Error: Timeout reached while waiting for response') {
        return true;
    }

    if (response && typeof response === 'object' && response.error) {
        return /timeout|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|WebSocket was closed/i
            .test(String(response.error));
    }

    return response && typeof response === 'object' && Object.keys(response).length === 0;
}

function shouldAttemptReconnect(rustplus, client) {
    const guildId = rustplus.guildId;
    const instance = typeof client.getInstance === 'function'
        ? client.getInstance(guildId)
        : null;

    const hasActiveFlag = Boolean(client.activeRustplusInstances && client.activeRustplusInstances[guildId]);
    const hasMatchingActiveServer = Boolean(
        instance &&
        instance.activeServer !== null &&
        instance.activeServer === rustplus.serverId
    );

    return !rustplus.isDeleted && (hasActiveFlag || hasMatchingActiveServer);
}

async function scheduleReconnect(rustplus, client, options = {}) {
    const guildId = rustplus.guildId;
    const serverId = rustplus.serverId;

    if (!shouldAttemptReconnect(rustplus, client)) {
        rustplus.log(
            client.intlGet(null, 'infoCap'),
            `Reconnect skipped (activeFlag=${Boolean(client.activeRustplusInstances && client.activeRustplusInstances[guildId])}, ` +
            `activeServerMatches=${Boolean(client.getInstance && client.getInstance(guildId) && client.getInstance(guildId).activeServer === rustplus.serverId)}).`
        );
        return false;
    }

    const failures = client.rustplusConnectFailures && client.rustplusConnectFailures[getFailureKey(rustplus)]
        ? client.rustplusConnectFailures[getFailureKey(rustplus)]
        : 0;
    const reconnectDelayMs = computeReconnectDelayMs(failures);

    if (options.sendMessages !== false && !client.rustplusReconnecting[guildId]) {
        await DiscordMessages.sendServerChangeStateMessage(guildId, serverId, 1);
        await DiscordMessages.sendServerMessage(guildId, serverId, 2);
    }

    client.rustplusReconnecting[guildId] = true;

    rustplus.log(client.intlGet(null, 'reconnectingCap'), client.intlGet(null, 'reconnectingToServer'));

    if (client.rustplusInstances[guildId] === rustplus) {
        delete client.rustplusInstances[guildId];
    }

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

    return true;
}

module.exports = {
    computeReconnectDelayMs,
    getFailureKey,
    isConnectFailureError,
    isTransientResponseFailure,
    shouldAttemptReconnect,
    scheduleReconnect,
};