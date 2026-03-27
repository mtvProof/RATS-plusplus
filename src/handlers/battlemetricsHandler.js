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
const DiscordTools = require('../discordTools/discordTools.js');
const Scrape = require('../util/scrape.js');

module.exports = {
    handler: async function (client, firstTime = false) {
        const searchSteamProfiles = (client.battlemetricsIntervalCounter === 0) ? true : false;
        const calledSteamProfiles = new Object();

        if (!firstTime) await client.updateBattlemetricsInstances();

        for (const guildItem of client.guilds.cache) {
            const guildId = guildItem[0];
            const instance = client.getInstance(guildId);
            const rustplus = client.rustplusInstances[guildId];

            if (!firstTime) await module.exports.handleBattlemetricsChanges(client, guildId);

            /* Update information channel battlemetrics players */
            const bmId = instance.activeServer !== null ?
                instance.serverList[instance.activeServer].battlemetricsId : null;
            let condition = instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;
            condition &= instance.activeServer !== null;
            condition &= bmId !== null;
            condition &= client.battlemetricsInstances.hasOwnProperty(bmId);
            condition &= rustplus && rustplus.isOperational;

            if (condition) {
                await DiscordMessages.sendUpdateBattlemetricsOnlinePlayersInformationMessage(rustplus, bmId);
            }
            else {
                if (instance.informationMessageId.battlemetricsPlayers !== null) {
                    await DiscordTools.deleteMessageById(guildId, instance.channelId.information,
                        instance.informationMessageId.battlemetricsPlayers);

                    instance.informationMessageId.battlemetricsPlayers = null;
                    client.setInstance(guildId, instance);
                }
            }

            for (const [trackerId, content] of Object.entries(instance.trackers)) {
                const battlemetricsId = content.battlemetricsId;
                const bmInstance = client.battlemetricsInstances[battlemetricsId];

                const originalPlayerCount = content.players.length;
                const deduplicatedPlayers = deduplicateTrackerPlayers(content.players);
                if (deduplicatedPlayers.length !== originalPlayerCount) {
                    content.players = deduplicatedPlayers;
                    client.setInstance(guildId, instance);
                    client.log(client.intlGet(null, 'warningCap'),
                        `Deduplicated tracker ${trackerId} (${content.name}) player list: ` +
                    `${originalPlayerCount} -> ${deduplicatedPlayers.length}`);
                }

                const rustplusCandidates = client.getRustplusInstancesAll(guildId)
                    .filter(rp => rp && rp.isOperational);

                const serverIdMatchedCandidates = rustplusCandidates
                    .filter(rp => rp.serverId === content.serverId);
                const battlemetricsMatchedCandidates = rustplusCandidates
                    .filter(rp => {
                        const server = instance.serverList[rp.serverId];
                        return server && `${server.battlemetricsId || ''}` === `${content.battlemetricsId || ''}`;
                    });

                const preferredCandidates = serverIdMatchedCandidates.length !== 0 ?
                    serverIdMatchedCandidates : battlemetricsMatchedCandidates;
                const trackerRustplus = preferredCandidates.find(rp => rp.instanceLabel === 'primary') ||
                    preferredCandidates[0] || null;

                // Self-heal mismatched tracker serverId (e.g. BattleMetrics query/game port vs Rust+ app port).
                if (trackerRustplus && content.serverId !== trackerRustplus.serverId) {
                    content.serverId = trackerRustplus.serverId;
                    client.setInstance(guildId, instance);
                }

                if (!bmInstance || !bmInstance.lastUpdateSuccessful) continue;

                if (firstTime || searchSteamProfiles) {
                    for (const player of content.players) {
                        if (player.steamId === null) continue;

                        let name = null;
                        if (calledSteamProfiles.hasOwnProperty(player.steamId)) {
                            name = calledSteamProfiles[player.steamId];
                        }
                        else {
                            name = await Scrape.scrapeSteamProfileName(client, player.steamId);
                            calledSteamProfiles[player.steamId] = name;
                        }
                        if (name === null) continue;

                        if (player.name !== name) {
                            await module.exports.trackerNewNameDetected(client, guildId, trackerId, battlemetricsId,
                                player.name, name);

                            const newPlayerId = getUniqueBattlemetricsPlayerIdByName(bmInstance, name);
                            player.playerId = newPlayerId ? newPlayerId : null;
                            player.name = name;
                        }
                    }

                    client.setInstance(guildId, instance);

                    if (firstTime) {
                        await DiscordMessages.sendTrackerMessage(guildId, trackerId);
                        continue;
                    }
                }

                const trackerPlayersByPlayerId = new Map(
                    content.players
                        .filter(player => player.playerId !== null)
                        .map(player => [player.playerId, player])
                );
                const trackerPlayerIds = Array.from(trackerPlayersByPlayerId.keys());
                const trackerActivityIds = trackerPlayerIds.filter(e =>
                    bmInstance.newPlayers.includes(e) ||
                    bmInstance.loginPlayers.includes(e) ||
                    bmInstance.logoutPlayers.includes(e));

                if (content.inGame && trackerActivityIds.length !== 0 && !trackerRustplus) {
                    const connectedServers = rustplusCandidates.map(rp => rp.serverId).join(', ');
                    const trackerMsg = `Tracker ${trackerId} skipped in-game activity (${trackerActivityIds.length}) ` +
                        `because no Rust+ instance matched tracker serverId=${content.serverId} ` +
                        `or battlemetricsId=${content.battlemetricsId}. Connected Rust+ servers: ` +
                        `${connectedServers || 'none'}.`;
                    client.log(client.intlGet(null, 'warningCap'), trackerMsg);
                }

                /* Check if Player just changed name */
                for (const player of bmInstance.nameChangedPlayers.filter(e => trackerPlayerIds.includes(e.id))) {
                    if (!trackerPlayersByPlayerId.has(player.id)) continue;

                    await module.exports.trackerNewNameDetected(client, guildId, trackerId, battlemetricsId,
                        player.from, player.to);
                }

                /* Check if Player just came online */
                for (const playerId of trackerPlayerIds.filter(e => bmInstance.newPlayers.includes(e))) {
                    const player = trackerPlayersByPlayerId.get(playerId);
                    if (!player) continue;

                    const str = client.intlGet(guildId, 'playerJustConnectedTracker', {
                        name: player.name,
                        tracker: content.name
                    });
                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId, content.serverId, Constants.COLOR_ACTIVE, str, null, content.title,
                        content.everyone);
                    if (trackerRustplus && content.inGame) {
                        trackerRustplus.sendInGameMessage(str);
                    }
                }

                /* Check if Player just came online */
                for (const playerId of trackerPlayerIds.filter(e => bmInstance.loginPlayers.includes(e))) {
                    const player = trackerPlayersByPlayerId.get(playerId);
                    if (!player) continue;

                    const str = client.intlGet(guildId, 'playerJustConnectedTracker', {
                        name: player.name,
                        tracker: content.name
                    });
                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId, content.serverId, Constants.COLOR_ACTIVE, str, null, content.title,
                        content.everyone);
                    if (trackerRustplus && content.inGame) {
                        trackerRustplus.sendInGameMessage(str);
                    }
                }

                /* Check if Player just went offline */
                for (const playerId of trackerPlayerIds.filter(e => bmInstance.logoutPlayers.includes(e))) {
                    const player = trackerPlayersByPlayerId.get(playerId);
                    if (!player) continue;

                    const str = client.intlGet(guildId, 'playerJustDisconnectedTracker', {
                        name: player.name,
                        tracker: content.name
                    });

                    await DiscordMessages.sendActivityNotificationMessage(
                        guildId, content.serverId, Constants.COLOR_INACTIVE, str, null, content.title,
                        content.everyone);
                    if (trackerRustplus && content.inGame) {
                        trackerRustplus.sendInGameMessage(str);
                    }
                }

                client.setInstance(guildId, instance);

                await DiscordMessages.sendTrackerMessage(guildId, trackerId);
                
                // Add delay between tracker updates to avoid Discord rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (client.battlemetricsIntervalCounter === 29) {
            client.battlemetricsIntervalCounter = 0;
        }
        else {
            client.battlemetricsIntervalCounter += 1;
        }
    },

    handleBattlemetricsChanges: async function (client, guildId) {
        const instance = client.getInstance(guildId);
        const settings = instance.generalSettings;

        const activeServer = instance.activeServer;
        const server = instance.serverList[activeServer];
        const battlemetricsIdActiveServer = server ? server.battlemetricsId : null;

        const battlemetricsIds = [];
        if (battlemetricsIdActiveServer && client.battlemetricsInstances.hasOwnProperty(battlemetricsIdActiveServer) &&
            client.battlemetricsInstances[battlemetricsIdActiveServer].lastUpdateSuccessful) {
            battlemetricsIds.push(battlemetricsIdActiveServer);
        }

        for (const [trackerId, content] of Object.entries(instance.trackers)) {
            const battlemetricsId = content.battlemetricsId;
            const bmInstance = client.battlemetricsInstances[battlemetricsId];

            if (!bmInstance || (bmInstance && !bmInstance.lastUpdateSuccessful)) continue;
            if (battlemetricsIds.includes(battlemetricsId)) continue;

            battlemetricsIds.push(battlemetricsId);
        }

        /* Go through each battlemetrics instance and notify changes */
        for (const battlemetricsId of battlemetricsIds) {
            const bmInstance = client.battlemetricsInstances[battlemetricsId];

            /* Server name changed? */
            if (settings.battlemetricsServerNameChanges && bmInstance.serverEvaluation.hasOwnProperty('server_name')) {
                const oldName = bmInstance.serverEvaluation['server_name'].from;
                const newName = bmInstance.serverEvaluation['server_name'].to;

                const title = client.intlGet(guildId, 'battlemetricsServerNameChanged');
                const description = `__**${client.intlGet(guildId, 'old')}:**__ ${oldName}\n` +
                    `__**${client.intlGet(guildId, 'new')}:**__ ${newName}`;

                await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title, description);
            }

            /* Players whos name have changed */
            if (settings.battlemetricsGlobalNameChanges && bmInstance.nameChangedPlayers.length !== 0) {
                const title = client.intlGet(guildId, 'battlemetricsPlayersNameChanged');

                const oldNameFieldName = client.intlGet(guildId, 'old');
                const playerIdFieldName = client.intlGet(guildId, 'playerId');
                const newNameFieldName = client.intlGet(guildId, 'new');

                let totalCharacters = 50; /* Start of with 50 characters as a base. */

                let oldName = [''], playerId = [''], newName = [''];
                let oldNameCharacters = 0, playerIdCharacters = 0, newNameCharacters = 0;
                let fieldIndex = 0;
                let isEmbedFull = false;
                let playerCounter = 0;
                for (const player of bmInstance.nameChangedPlayers) {
                    playerCounter += 1;
                    const fieldRowMaxLength = Constants.EMBED_FIELD_MAX_WIDTH_LENGTH_3;

                    let oldN = `${player.from}`;
                    oldN = oldN.length <= fieldRowMaxLength ? oldN : oldN.substring(0, fieldRowMaxLength - 2) + '..';
                    oldN += '\n';

                    const id = `[${player.id}](${Constants.BATTLEMETRICS_PROFILE_URL + `${player.id}`})\n`;

                    let newN = `${player.to}`;
                    newN = newN.length <= fieldRowMaxLength ? newN : newN.substring(0, fieldRowMaxLength - 2) + '..';
                    newN += '\n';



                    if (totalCharacters + (oldN.length + id.length + newN.length) >=
                        Constants.EMBED_MAX_TOTAL_CHARACTERS) {
                        isEmbedFull = true;
                        break;
                    }

                    if ((oldNameCharacters + oldN.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
                        (playerIdCharacters + id.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
                        (newNameCharacters + newN.length) > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
                        fieldIndex += 1;

                        oldName.push('');
                        playerId.push('');
                        newName.push('');

                        oldNameCharacters = 0;
                        playerIdCharacters = 0;
                        newNameCharacters = 0;
                    }

                    oldNameCharacters += oldN.length;
                    playerIdCharacters += id.length;
                    newNameCharacters += newN.length;

                    totalCharacters += oldN.length + id.length + newN.length;

                    oldName[fieldIndex] += oldN;
                    playerId[fieldIndex] += id;
                    newName[fieldIndex] += newN;
                }

                let description = '';
                if (isEmbedFull) {
                    description = client.intlGet(interaction.guildId, 'andMorePlayers', {
                        number: bmInstance.nameChangedPlayers.length - playerCounter
                    });
                }

                const fields = [];
                for (let i = 0; i < (fieldIndex + 1); i++) {
                    fields.push({
                        name: i === 0 ? oldNameFieldName : '\u200B',
                        value: oldName[i] !== '' ? oldName[i] : client.intlGet(guildId, 'empty'),
                        inline: true
                    });
                    fields.push({
                        name: i === 0 ? playerIdFieldName : '\u200B',
                        value: playerId[i] !== '' ? playerId[i] : client.intlGet(guildId, 'empty'),
                        inline: true
                    });
                    fields.push({
                        name: i === 0 ? newNameFieldName : '\u200B',
                        value: newName[i] !== '' ? newName[i] : client.intlGet(guildId, 'empty'),
                        inline: true
                    });
                }

                await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title,
                    description, fields);
            }

            /* Players that just logged in */
            if (settings.battlemetricsGlobalLogin &&
                (bmInstance.loginPlayers.length !== 0 || bmInstance.newPlayers.length !== 0)) {
                const playerIds = Array.from(new Set(bmInstance.loginPlayers.concat(bmInstance.newPlayers)));
                const title = client.intlGet(guildId, 'battlemetricsPlayersLogin');

                let totalCharacters = 50; /* Start of with 50 characters as a base. */
                let fieldCharacters = 0;

                const fields = [''];
                let fieldIndex = 0;
                let isEmbedFull = false;
                let playerCounter = 0;
                for (const playerId of playerIds) {
                    playerCounter += 1;
                    const name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
                    const playerStr = `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

                    if (totalCharacters + playerStr.length >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
                        isEmbedFull = true;
                        break;
                    }

                    if (fieldCharacters + playerStr.length >= Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
                        fieldCharacters = 0;
                        fieldIndex += 1;
                        fields.push('');
                    }

                    fields[fieldIndex] += playerStr;
                    totalCharacters += playerStr.length;
                    fieldCharacters += playerStr.length;
                }

                let description = '';
                if (isEmbedFull) {
                    description = client.intlGet(interaction.guildId, 'andMorePlayers', {
                        number: playerIds.length - playerCounter
                    });
                }

                let fieldCounter = 0;
                const outPutFields = [];
                for (const field of fields) {
                    outPutFields.push({
                        name: '\u200B',
                        value: field === '' ? '\u200B' : field,
                        inline: true
                    });
                    fieldCounter += 1;
                }

                await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title,
                    description, outPutFields);
            }

            /* Players that just logged out */
            if (settings.battlemetricsGlobalLogout && bmInstance.logoutPlayers.length !== 0) {
                const title = client.intlGet(guildId, 'battlemetricsPlayersLogout');

                let totalCharacters = 50; /* Start of with 50 characters as a base. */
                let fieldCharacters = 0;

                const fields = [''];
                let fieldIndex = 0;
                let isEmbedFull = false;
                let playerCounter = 0;
                for (const playerId of bmInstance.logoutPlayers) {
                    playerCounter += 1;
                    const name = bmInstance.players[playerId]['name'].replace('[', '(').replace(']', ')');
                    const playerStr = `[${name}](${Constants.BATTLEMETRICS_PROFILE_URL + `${playerId}`})\n`;

                    if (totalCharacters + playerStr.length >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
                        isEmbedFull = true;
                        break;
                    }

                    if (fieldCharacters + playerStr.length >= Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
                        fieldCharacters = 0;
                        fieldIndex += 1;
                        fields.push('');
                    }

                    fields[fieldIndex] += playerStr;
                    totalCharacters += playerStr.length;
                    fieldCharacters += playerStr.length;
                }

                let description = '';
                if (isEmbedFull) {
                    description = client.intlGet(interaction.guildId, 'andMorePlayers', {
                        number: playerIds.length - playerCounter
                    });
                }

                let fieldCounter = 0;
                const outPutFields = [];
                for (const field of fields) {
                    outPutFields.push({
                        name: '\u200B',
                        value: field === '' ? '\u200B' : field,
                        inline: true
                    });
                    fieldCounter += 1;
                }

                await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title,
                    description, outPutFields);
            }
        }
    },

    trackerNewNameDetected: async function (client, guildId, trackerId, battlemetricsId, oldName, newName) {
        const instance = client.getInstance(guildId);
        const trackerName = instance.trackers[trackerId].name;

        const title = client.intlGet(guildId, 'battlemetricsTrackerPlayerNameChanged');
        const description = `__**${client.intlGet(guildId, 'tracker')}:**__ ${trackerName}\n\n` +
            `__**${client.intlGet(guildId, 'old')}:**__ ${oldName}\n` +
            `__**${client.intlGet(guildId, 'new')}:**__ ${newName}`;

        await DiscordMessages.sendBattlemetricsEventMessage(guildId, battlemetricsId, title, description, null,
            instance.trackers[trackerId].everyone);
    },
}

function deduplicateTrackerPlayers(players = []) {
    const deduplicated = [];

    for (const player of players) {
        const existingIndex = findCompatibleTrackerPlayerIndex(deduplicated, player);
        if (existingIndex === -1) {
            deduplicated.push(player);
            continue;
        }

        deduplicated[existingIndex] = choosePreferredTrackerPlayer(deduplicated[existingIndex], player);
    }

    return deduplicated;
}

function findCompatibleTrackerPlayerIndex(players, candidatePlayer) {
    return players.findIndex(existingPlayer => {
        const sameSteamId = existingPlayer.steamId !== null && candidatePlayer.steamId !== null &&
            existingPlayer.steamId === candidatePlayer.steamId;
        if (sameSteamId) return true;

        const samePlayerId = existingPlayer.playerId !== null && candidatePlayer.playerId !== null &&
            existingPlayer.playerId === candidatePlayer.playerId;
        if (!samePlayerId) return false;

        const hasConflictingSteamIds = existingPlayer.steamId !== null && candidatePlayer.steamId !== null &&
            existingPlayer.steamId !== candidatePlayer.steamId;
        return !hasConflictingSteamIds;
    });
}

function choosePreferredTrackerPlayer(existingPlayer, candidatePlayer) {
    const existingScore = scoreTrackerPlayer(existingPlayer);
    const candidateScore = scoreTrackerPlayer(candidatePlayer);
    return candidateScore > existingScore ? candidatePlayer : existingPlayer;
}

function scoreTrackerPlayer(player) {
    let score = 0;
    if (player.playerId !== null) score += 2;
    if (player.steamId !== null) score += 1;
    return score;
}

function getUniqueBattlemetricsPlayerIdByName(bmInstance, name) {
    if (!bmInstance || !bmInstance.players || !name) return null;

    const matchingPlayerIds = Object.keys(bmInstance.players)
        .filter(playerId => bmInstance.players[playerId]['name'] === name);

    return matchingPlayerIds.length === 1 ? matchingPlayerIds[0] : null;
}