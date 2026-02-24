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

const CommandHandler = require('../handlers/inGameCommandHandler.js');
const Constants = require('../util/constants.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const InGameChatHandler = require('../handlers/inGameChatHandler.js');
const SmartSwitchGroupHandler = require('../handlers/smartSwitchGroupHandler.js');
const TeamChatHandler = require("../handlers/teamChatHandler.js");
const TeamHandler = require('../handlers/teamHandler.js');

module.exports = {
    name: 'message',
    async execute(rustplus, client, message) {
        if (!rustplus.isServerAvailable()) return rustplus.deleteThisRustplusInstance();

        if (!rustplus.isOperational) return;

        if (message.hasOwnProperty('response')) {
            messageResponse(rustplus, client, message);
        }
        else if (message.hasOwnProperty('broadcast')) {
            messageBroadcast(rustplus, client, message);
        }
    },
};

async function messageResponse(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcast(rustplus, client, message) {
    if (message.broadcast.hasOwnProperty('teamChanged')) {
        messageBroadcastTeamChanged(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('teamMessage')) {
        messageBroadcastTeamMessage(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('entityChanged')) {
        messageBroadcastEntityChanged(rustplus, client, message);
    }
    else if (message.broadcast.hasOwnProperty('cameraRays')) {
        messageBroadcastCameraRays(rustplus, client, message);
    }
}

async function messageBroadcastTeamChanged(rustplus, client, message) {
    if (!rustplus.team) {
        rustplus.log(client.intlGet(null, 'errorCap'), 'Team data missing; skipping teamChanged broadcast');
        return;
    }
    TeamHandler.handler(rustplus, client, message.broadcast.teamChanged.teamInfo);
    const changed = rustplus.team.isLeaderSteamIdChanged(message.broadcast.teamChanged.teamInfo);
    rustplus.team.updateTeam(message.broadcast.teamChanged.teamInfo);
    if (changed) rustplus.updateLeaderRustPlusLiteInstance();
}

async function messageBroadcastTeamMessage(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const steamId = message.broadcast.teamMessage.message.steamId.toString();

    if (steamId === rustplus.playerId) {
        /* Delay inGameChatHandler */
        clearTimeout(rustplus.inGameChatTimeout);
        const commandDelayMs = parseInt(rustplus.generalSettings.commandDelay) * 1000;
        rustplus.inGameChatTimeout = setTimeout(
            InGameChatHandler.inGameChatHandler, commandDelayMs, rustplus, client);
    }

    let tempName = message.broadcast.teamMessage.message.name;
    let tempMessage = message.broadcast.teamMessage.message.message;

    tempName = tempName.replace(/^<size=.*?><color=.*?>/, '');  /* Rustafied */
    tempName = tempName.replace(/<\/color><\/size>$/, '');      /* Rustafied */
    message.broadcast.teamMessage.message.name = tempName;

    tempMessage = tempMessage.replace(/^<size=.*?><color=.*?>/, '');  /* Rustafied */
    tempMessage = tempMessage.replace(/<\/color><\/size>$/, '');      /* Rustafied */
    tempMessage = tempMessage.replace(/^<color.+?<\/color>/g, '');      /* Unknown */
    message.broadcast.teamMessage.message.message = tempMessage;

    message.broadcast.teamMessage.message.teamLabel = rustplus.instanceLabel || 'primary';

    if (instance.blacklist['steamIds'].includes(`${steamId}`)) {
        rustplus.log(client.intlGet(null, 'infoCap'), client.intlGet(null, `userPartOfBlacklistInGame`, {
            user: `${message.broadcast.teamMessage.message.name} (${steamId})`,
            message: message.broadcast.teamMessage.message.message
        }));
        TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);
        return;
    }

    if (rustplus.messagesSentByBot.includes(message.broadcast.teamMessage.message.message)) {
        /* Remove message from messagesSendByBot */
        for (let i = rustplus.messagesSentByBot.length - 1; i >= 0; i--) {
            if (rustplus.messagesSentByBot[i] === message.broadcast.teamMessage.message.message) {
                rustplus.messagesSentByBot.splice(i, 1);
            }
        }
        return;
    }

    const isCommand = await CommandHandler.inGameCommandHandler(rustplus, client, message);
    if (isCommand) return;

    rustplus.log(client.intlGet(null, 'infoCap'), client.intlGet(null, `logInGameMessage`, {
        message: message.broadcast.teamMessage.message.message,
        user: `${message.broadcast.teamMessage.message.name} (${steamId})`
    }));

    TeamChatHandler(rustplus, client, message.broadcast.teamMessage.message);

    // Relay team chat across teams so both groups can see it.
    relayTeamChatAcrossTeams(rustplus, client, message.broadcast.teamMessage.message);
}

function relayTeamChatAcrossTeams(sourceRustplus, client, msg) {
    const guildId = sourceRustplus.guildId;
    const targetRustplus = sourceRustplus.instanceLabel === 'primary' ?
        client.rustplusSecondaryInstances[guildId] : client.rustplusInstances[guildId];

    if (!targetRustplus || !targetRustplus.isOperational) return;

    // Do not relay bot-generated messages (e.g., alarms) to the opposite team.
    if (`${msg.steamId || ''}` === `${sourceRustplus.playerId}`) return;

    const normalizedMsg = `${msg.message}`.toUpperCase();
    if (msg.message.startsWith('[Team 1]') || msg.message.startsWith('[Team 2]')) return;
    if (normalizedMsg.includes('RATS++')) return;

    const sourceLabel = sourceRustplus.instanceLabel === 'secondary' ? 'Team 2' : 'Team 1';
    const crossMessage = `[${sourceLabel}] ${msg.name}: ${msg.message}`;

    targetRustplus.updateBotMessages(crossMessage);
    targetRustplus.sendTeamMessageAsync(crossMessage);
}

async function messageBroadcastEntityChanged(rustplus, client, message) {
    const instance = client.getInstance(rustplus.guildId);
    const entityId = message.broadcast.entityChanged.entityId;

    // Secondary (hoster2) should not process smart devices.
    if (rustplus.instanceLabel === 'secondary') return;

    if (instance.serverList[rustplus.serverId].switches.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedSmartSwitch(rustplus, client, message);
    }
    else if (instance.serverList[rustplus.serverId].alarms.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedSmartAlarm(rustplus, client, message);
    }
    else if (instance.serverList[rustplus.serverId].storageMonitors.hasOwnProperty(entityId)) {
        messageBroadcastEntityChangedStorageMonitor(rustplus, client, message);
    }
}

async function messageBroadcastCameraRays(rustplus, client, message) {
    /* Not implemented */
}

async function messageBroadcastEntityChangedSmartSwitch(rustplus, client, message) {
    if (rustplus.instanceLabel === 'secondary') return;

    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.switches[entityId])) return;

    if (rustplus.interactionSwitches.includes(`${entityId}`)) {
        rustplus.interactionSwitches = rustplus.interactionSwitches.filter(e => e !== `${entityId}`);
        return;
    }

    if (rustplus.currentSwitchTimeouts.hasOwnProperty(entityId)) {
        clearTimeout(rustplus.currentSwitchTimeouts[entityId]);
        delete rustplus.currentSwitchTimeouts[entityId];
    }

    const active = message.broadcast.entityChanged.payload.value;
    server.switches[entityId].active = active;
    client.setInstance(rustplus.guildId, instance);

    DiscordMessages.sendSmartSwitchMessage(rustplus.guildId, serverId, entityId);
    SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(
        client, rustplus.guildId, serverId, entityId);
}

async function messageBroadcastEntityChangedSmartAlarm(rustplus, client, message) {
    if (rustplus.instanceLabel === 'secondary') return;

    const instance = client.getInstance(rustplus.guildId);
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.alarms[entityId])) return;

    const active = message.broadcast.entityChanged.payload.value;
    server.alarms[entityId].active = active;
    server.alarms[entityId].reachable = true;
    client.setInstance(rustplus.guildId, instance);

    if (active) {
        server.alarms[entityId].lastTrigger = Math.floor(new Date() / 1000);
        client.setInstance(rustplus.guildId, instance);
        await DiscordMessages.sendSmartAlarmTriggerMessage(rustplus.guildId, serverId, entityId);

        if (instance.generalSettings.smartAlarmNotifyInGame) {
            rustplus.sendInGameMessage(`${server.alarms[entityId].name}: ${server.alarms[entityId].message}`);
        }
    }

    DiscordMessages.sendSmartAlarmMessage(rustplus.guildId, rustplus.serverId, entityId);
}

async function messageBroadcastEntityChangedStorageMonitor(rustplus, client, message) {
    const guildId = rustplus.guildId;
    const instance = client.getInstance(guildId);
    const primaryRustplus = client.rustplusInstances[guildId];
    const secondaryRustplus = client.rustplusSecondaryInstances[guildId];
    const serverId = rustplus.serverId;
    const entityId = message.broadcast.entityChanged.entityId;
    const server = instance.serverList[serverId];

    if (!server || (server && !server.storageMonitors[entityId])) return;
    if (!rustplus || !rustplus.isOperational) return;
    if (message.broadcast.entityChanged.payload.value === true) return;

    const candidates = [];
    const candidateIds = new Set();
    // Always try hoster1 (primary) first; only fall back to hoster2 if primary cannot reach the entity.
    for (const rp of [primaryRustplus, rustplus, secondaryRustplus]) {
        if (!rp || !rp.isOperational || rp.serverId !== serverId) continue;
        if (candidateIds.has(rp.instanceLabel)) continue;
        candidateIds.add(rp.instanceLabel);
        candidates.push(rp);
    }
    if (candidates.length === 0) return;

    if (server.storageMonitors[entityId].type === 'toolCupboard' ||
        message.broadcast.entityChanged.payload.capacity === Constants.STORAGE_MONITOR_TOOL_CUPBOARD_CAPACITY) {
        setTimeout(updateToolCupboard.bind(null, candidates, client, message), 2000);
    }
    else {
        const infoResult = await getEntityInfoFromCandidates(candidates, entityId);
        const info = infoResult.info;
        const infoSource = infoResult.source;

        if (!info || !infoSource) return;

        infoSource.storageMonitors[entityId] = {
            items: message.broadcast.entityChanged.payload.items,
            expiry: message.broadcast.entityChanged.payload.protectionExpiry,
            capacity: message.broadcast.entityChanged.payload.capacity,
            hasProtection: message.broadcast.entityChanged.payload.hasProtection
        }

        const infoCheck = await infoSource.getEntityInfoAsync(entityId);
        server.storageMonitors[entityId].reachable = await infoSource.isResponseValid(infoCheck) ? true : false;

        if (server.storageMonitors[entityId].reachable) {
            if (infoCheck.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_VENDING_MACHINE_CAPACITY) {
                server.storageMonitors[entityId].type = 'vendingMachine';
            }
            else if (infoCheck.entityInfo.payload.capacity === Constants.STORAGE_MONITOR_LARGE_WOOD_BOX_CAPACITY) {
                server.storageMonitors[entityId].type = 'largeWoodBox';
            }
        }
        client.setInstance(guildId, instance);

        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
    }
}

async function updateToolCupboard(candidates, client, message) {
    const guildId = candidates[0].guildId;
    const instance = client.getInstance(guildId);
    const serverId = candidates[0].serverId;
    const server = instance.serverList[serverId];
    const entityId = message.broadcast.entityChanged.entityId;

    const infoResult = await getEntityInfoFromCandidates(candidates, entityId);
    const info = infoResult.info;
    const infoSource = infoResult.source;

    if (!info || !infoSource) return;

    const monitor = server.storageMonitors[entityId];

    monitor.reachable = true;
    monitor.type = 'toolCupboard';
    if (typeof monitor.decaying === 'undefined') monitor.decaying = false;

    infoSource.storageMonitors[entityId] = {
        items: info.entityInfo.payload.items,
        expiry: info.entityInfo.payload.protectionExpiry,
        capacity: info.entityInfo.payload.capacity,
        hasProtection: info.entityInfo.payload.hasProtection
    }

    // If capacity reads as 0, treat as an electrical/power blip: reset decay and skip decay evaluation.
    if (info.entityInfo.payload.capacity === 0) {
        monitor.decaying = false;
        client.setInstance(guildId, instance);
        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
        return;
    }

    if (info.entityInfo.payload.protectionExpiry === 0 &&
        monitor.decaying === false) {
        monitor.decaying = true;

        await DiscordMessages.sendDecayingNotificationMessage(guildId, serverId, entityId);

        if (monitor.inGame) {
            infoSource.sendInGameMessage(client.intlGet(guildId, 'isDecaying', {
                device: monitor.name
            }));
        }
    }
    else if (info.entityInfo.payload.protectionExpiry !== 0) {
        monitor.decaying = false;
    }
    client.setInstance(guildId, instance);

    await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
}

async function getEntityInfoFromCandidates(candidates, entityId) {
    for (const candidate of candidates) {
        const info = await candidate.getEntityInfoAsync(entityId);
        if (await candidate.isResponseValid(info)) {
            return { info: info, source: candidate };
        }
    }
    return { info: null, source: null };
}