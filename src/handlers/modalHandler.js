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

const Discord = require('discord.js');

const Battlemetrics = require('../structures/Battlemetrics');
const Constants = require('../util/constants.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools = require('../discordTools/discordTools.js');
const Keywords = require('../util/keywords.js');
const Scrape = require('../util/scrape.js');

module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    client.logInteraction(interaction, verifyId, 'userModal');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];
        const cargoShipEgressTime = parseInt(interaction.fields.getTextInputValue('CargoShipEgressTime'));
        const oilRigCrateUnlockTime = parseInt(interaction.fields.getTextInputValue('OilRigCrateUnlockTime'));
        const deepSeaWipeCooldown = parseInt(interaction.fields.getTextInputValue('DeepSeaWipeCooldownTime'));
        const deepSeaWipeDuration = parseInt(interaction.fields.getTextInputValue('DeepSeaWipeDurationTime'));

        if (!server) {
            interaction.deferUpdate();
            return;
        }

        if (cargoShipEgressTime && ((cargoShipEgressTime * 1000) !== server.cargoShipEgressTimeMs)) {
            server.cargoShipEgressTimeMs = cargoShipEgressTime * 1000;
        }
        if (oilRigCrateUnlockTime && ((oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs)) {
            server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
        }
        if (deepSeaWipeCooldown && ((deepSeaWipeCooldown * 1000) !== server.deepSeaWipeCooldownMs)) {
            server.deepSeaWipeCooldownMs = deepSeaWipeCooldown * 1000;
        }
        if (deepSeaWipeDuration && ((deepSeaWipeDuration * 1000) !== server.deepSeaWipeDurationMs)) {
            server.deepSeaWipeDurationMs = deepSeaWipeDuration * 1000;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.cargoShipEgressTimeMs}, ${server.oilRigLockedCrateUnlockTimeMs}, ${server.deepSeaWipeCooldownMs}, ${server.deepSeaWipeDurationMs}`
        }));
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];
        const battlemetricsId = interaction.fields.getTextInputValue('ServerBattlemetricsId');
        const oilRigCrateUnlockTimeRaw = interaction.fields.getTextInputValue('ServerOilRigCrateUnlockTime');
        const oilRigCrateUnlockTime = parseInt(oilRigCrateUnlockTimeRaw);

        if (battlemetricsId !== server.battlemetricsId) {
            if (battlemetricsId === '') {
                server.battlemetricsId = null;
            }
            else if (client.battlemetricsInstances.hasOwnProperty(battlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[battlemetricsId];
                server.battlemetricsId = battlemetricsId;
                server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
            }
            else {
                const bmInstance = new Battlemetrics(battlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[battlemetricsId] = bmInstance;
                    server.battlemetricsId = battlemetricsId;
                    server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
                }
            }
        }

        if (!Number.isNaN(oilRigCrateUnlockTime) && oilRigCrateUnlockTime >= 0 &&
            (oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs) {
            server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.battlemetricsId}, ${server.oilRigLockedCrateUnlockTimeMs}`
        }));

        await DiscordMessages.sendServerMessage(interaction.guildId, ids.serverId);

        /* To force search of player name via scrape */
        client.battlemetricsIntervalCounter = 0;
    }
    else if (interaction.customId.startsWith('PrepareModal')) {
        const parts = interaction.customId.split(':');
        if (parts.length < 2) {
            interaction.deferUpdate();
            return;
        }

        const settingKey = parts[1];
        const messageId = parts[2] || null;
        const channelId = parts[3] || null;

        const setting = instance.notificationSettings[settingKey];

        if (!setting) {
            interaction.deferUpdate();
            return;
        }

        const prepareRaw = interaction.fields.getTextInputValue('PrepareMinutes');
        const prepareMinutes = parseInt(prepareRaw);

        if (!Number.isNaN(prepareMinutes) && prepareMinutes >= 0) {
            setting.prepareMinutes = prepareMinutes;

            if (client.rustplusInstances[guildId] &&
                client.rustplusInstances[guildId].notificationSettings[settingKey]) {
                client.rustplusInstances[guildId].notificationSettings[settingKey].prepareMinutes = prepareMinutes;
            }

            for (const [serverId, server] of Object.entries(instance.serverList)) {
                server.deepSeaPrepareMinutes = prepareMinutes;
            }

            if (client.rustplusInstances[guildId] && client.rustplusInstances[guildId].mapMarkers) {
                client.rustplusInstances[guildId].mapMarkers.scheduleDeepSeaPrepare();
            }

            client.setInstance(guildId, instance);

            client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
                id: `${verifyId}`,
                value: `${prepareMinutes}`
            }));

            if (channelId && messageId) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    const message = await channel.messages.fetch(messageId);
                    const hasPrepare = setting.hasOwnProperty('prepare');

                    const components = [DiscordButtons.getNotificationButtons(
                        guildId,
                        settingKey,
                        setting.discord,
                        setting.inGame,
                        setting.voice,
                        hasPrepare ? setting.prepare : null,
                        hasPrepare ? setting.prepareMinutes : null)];

                    if (hasPrepare) {
                        components.push(DiscordButtons.getNotificationPrepareEditButton(
                            guildId, settingKey, setting.prepareMinutes));
                    }

                    await message.edit({ components: components });
                }
                catch (e) {
                    client.log(client.intlGet(null, 'errorCap'), `Failed to refresh prepare buttons: ${e}`);
                }
            }
        }

        interaction.deferUpdate();
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartSwitchName = interaction.fields.getTextInputValue('SmartSwitchName');
        const smartSwitchCommand = interaction.fields.getTextInputValue('SmartSwitchCommand');
        let smartSwitchProximity = null;
        try {
            smartSwitchProximity = parseInt(interaction.fields.getTextInputValue('SmartSwitchProximity'));
        }
        catch (e) {
            smartSwitchProximity = null;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            try { await interaction.deferUpdate(); } catch (e) { /* silently ignore */ }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.switches[ids.entityId].name = smartSwitchName;

        if (smartSwitchCommand !== server.switches[ids.entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, ids.serverId).includes(smartSwitchCommand)) {
            server.switches[ids.entityId].command = smartSwitchCommand;
        }

        if (smartSwitchProximity !== null && smartSwitchProximity >= 0) {
            server.switches[ids.entityId].proximity = smartSwitchProximity;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartSwitchName}, ${server.switches[ids.entityId].command}`
        }));

        await DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];
        const groupName = interaction.fields.getTextInputValue('GroupName');
        const groupCommand = interaction.fields.getTextInputValue('GroupCommand');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            try { await interaction.deferUpdate(); } catch (e) { /* silently ignore */ }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.switchGroups[ids.groupId].name = groupName;

        if (groupCommand !== server.switchGroups[ids.groupId].command &&
            !Keywords.getListOfUsedKeywords(client, interaction.guildId, ids.serverId).includes(groupCommand)) {
            server.switchGroups[ids.groupId].command = groupCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${groupName}, ${server.switchGroups[ids.groupId].command}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupAddSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            try { await interaction.deferUpdate(); } catch (e) { /* silently ignore */ }
            return;
        }

        if (!Object.keys(server.switches).includes(switchId) ||
            server.switchGroups[ids.groupId].switches.includes(switchId)) {
            try { await interaction.deferUpdate(); } catch (e) { /* silently ignore */ }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.switchGroups[ids.groupId].switches.push(switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupRemoveSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            try { await interaction.deferUpdate(); } catch (e) { /* silently ignore */ }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.switchGroups[ids.groupId].switches =
            server.switchGroups[ids.groupId].switches.filter(e => e !== switchId);
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(interaction.guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('SAEdit|')) {
        const [serverId, entityId] = interaction.customId.replace('SAEdit|', '').split('|');
        const server = instance.serverList[serverId];
        const smartAlarmName = interaction.fields.getTextInputValue('SmartAlarmName');
        const smartAlarmMessage = interaction.fields.getTextInputValue('SmartAlarmMessage');
        const smartAlarmCommand = interaction.fields.getTextInputValue('SmartAlarmCommand');

        if (!server || (server && !server.alarms.hasOwnProperty(entityId))) {
            try {
                await interaction.deferUpdate();
            } catch (e) {
                // Interaction likely expired; silently ignore
            }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.alarms[entityId].name = smartAlarmName;
        server.alarms[entityId].message = smartAlarmMessage;

        if (smartAlarmCommand !== server.alarms[entityId].command &&
            !Keywords.getListOfUsedKeywords(client, guildId, serverId).includes(smartAlarmCommand)) {
            server.alarms[entityId].command = smartAlarmCommand;
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartAlarmName}, ${smartAlarmMessage}, ${server.alarms[entityId].command}`
        }));

        await DiscordMessages.sendSmartAlarmMessage(interaction.guildId, serverId, entityId);
    }
    else if (interaction.customId.startsWith('SMEdit|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];
        const storageMonitorName = interaction.fields.getTextInputValue('StorageMonitorName');

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            try {
                await interaction.deferUpdate();
            } catch (e) {
                // Interaction likely expired; silently ignore
            }
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (e) {
            client.log(client.intlGet(null, 'errorCap'), `Modal deferUpdate failed: ${e}`);
        }

        server.storageMonitors[entityId].name = storageMonitorName;
        client.setInstance(interaction.guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${storageMonitorName}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(interaction.guildId, serverId, entityId);
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
        await interaction.deferUpdate();

        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];
        let trackerName = '';
        try {
            trackerName = interaction.fields.getTextInputValue('TrackerName');
        }
        catch (e) {
            // Backward compatibility with older modal field id
            trackerName = interaction.fields.getTextInputValue('TrackerCoordinates');
        }

        if (!tracker) {
            return;
        }

        let trackerBattlemetricsId = tracker.battlemetricsId;
        try {
            trackerBattlemetricsId = interaction.fields.getTextInputValue('TrackerBattlemetricsId');
        }
        catch (e) {
            // Hidden in current edit modal. Keep existing value.
        }

        let trackerCoordinates = '';
        try {
            trackerCoordinates = interaction.fields.getTextInputValue('TrackerCoordinates');
        }
        catch (e) {
            // Backward compatibility with older modal field id
            trackerCoordinates = interaction.fields.getTextInputValue('TrackerClanTag');
        }

        tracker.name = trackerName;
        tracker.clanTag = trackerCoordinates;

        if (trackerBattlemetricsId !== tracker.battlemetricsId) {
            if (client.battlemetricsInstances.hasOwnProperty(trackerBattlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[trackerBattlemetricsId];
                const matchedServerId = Object.keys(instance.serverList).find(serverKey => {
                    const server = instance.serverList[serverKey];
                    return `${server.battlemetricsId || ''}` === `${trackerBattlemetricsId}`;
                });
                tracker.battlemetricsId = trackerBattlemetricsId;
                tracker.serverId = matchedServerId || `${bmInstance.server_ip}-${bmInstance.server_port}`;
                tracker.img = Constants.DEFAULT_SERVER_IMG;
                tracker.title = bmInstance.server_name;
            }
            else {
                const bmInstance = new Battlemetrics(trackerBattlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    const matchedServerId = Object.keys(instance.serverList).find(serverKey => {
                        const server = instance.serverList[serverKey];
                        return `${server.battlemetricsId || ''}` === `${trackerBattlemetricsId}`;
                    });
                    client.battlemetricsInstances[trackerBattlemetricsId] = bmInstance;
                    tracker.battlemetricsId = trackerBattlemetricsId;
                    tracker.serverId = matchedServerId || `${bmInstance.server_ip}-${bmInstance.server_port}`;
                    tracker.img = Constants.DEFAULT_SERVER_IMG;
                    tracker.title = bmInstance.server_name;
                }
            }
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${trackerName} (${trackerCoordinates}), ${tracker.battlemetricsId}`
        }));

        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        await interaction.deferUpdate();

        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const input = interaction.fields.getTextInputValue('TrackerAddPlayerInput');

        if (!tracker) {
            return;
        }

        const isSteamId64 = input.length === Constants.STEAMID64_LENGTH ? true : false;
        const isBattlemetricsId = !isNaN(input) && input.length > 0 && !isSteamId64 ? true : false;
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

        // If user entered a Steam ID or Battlemetrics ID
        if (isSteamId64 || isBattlemetricsId) {
            if ((isSteamId64 && tracker.players.some(e => e.steamId === input)) ||
                (!isSteamId64 && tracker.players.some(e => e.playerId === input && e.steamId === null))) {
                return;
            }

            let name = null;
            let steamId = null;
            let playerId = null;

            if (isSteamId64) {
                steamId = input;
                name = await Scrape.scrapeSteamProfileName(client, input);

                if (name && bmInstance) {
                    playerId = getUniqueBattlemetricsPlayerIdByName(bmInstance, name);
                    if (!playerId) playerId = null;
                }
            }
            else {
                playerId = input;
                if (bmInstance.players.hasOwnProperty(input)) {
                    name = bmInstance.players[input]['name'];
                }
                else {
                    name = '-';
                }
            }

            if ((steamId !== null && tracker.players.some(e => e.steamId === steamId)) ||
                (playerId !== null && tracker.players.some(e => e.playerId === playerId))) {
                return;
            }

            tracker.players.push({
                name: name,
                steamId: steamId,
                playerId: playerId
            });
            client.setInstance(interaction.guildId, instance);

            client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
                id: `${verifyId}`,
                value: `${input}`
            }));

            await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
        }
        // User entered a player name - search for matching players
        else {
            if (!bmInstance || !bmInstance.lastUpdateSuccessful) {
                await interaction.deferUpdate();
                return;
            }
            // Search for players with matching name
            const foundPlayerIds = [];
            for (const playerId of Object.keys(bmInstance.players)) {
                if (bmInstance.players[playerId]['name'].toLowerCase().includes(input.toLowerCase())) {
                    // Don't add if player already in tracker
                    if (!tracker.players.some(e => e.playerId === playerId)) {
                        foundPlayerIds.push(playerId);
                    }
                }
            }

            // If no players found
            if (foundPlayerIds.length === 0) {
                await interaction.deferUpdate();
                return;
            }

            // If only one player found, add them directly
            if (foundPlayerIds.length === 1) {
                const playerId = foundPlayerIds[0];
                const name = bmInstance.players[playerId]['name'];

                if (tracker.players.some(e => e.playerId === playerId)) {
                    return;
                }

                tracker.players.push({
                    name: name,
                    steamId: null,
                    playerId: playerId
                });
                client.setInstance(interaction.guildId, instance);

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
                    id: `${verifyId}`,
                    value: `${name}`
                }));

                await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
            }
            // If multiple players found, show selection menu
            else {
                await DiscordMessages.sendTrackerPlayerSelectionMessage(
                    interaction, client, ids.trackerId, foundPlayerIds.slice(0, 25) // Discord button limit is 5 per row, max 25 total
                );
                return;
            }
        }
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const input = interaction.fields.getTextInputValue('TrackerRemovePlayerInput');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        const isSteamId64 = input.length === Constants.STEAMID64_LENGTH ? true : false;
        const isBattlemetricsId = !isNaN(input) && input.length > 0 && !isSteamId64 ? true : false;

        // If user entered a Steam ID or Battlemetrics ID
        if (isSteamId64 || isBattlemetricsId) {
            if (isSteamId64) {
                tracker.players = tracker.players.filter(e => e.steamId !== input);
            }
            else {
                tracker.players = tracker.players.filter(e => e.playerId !== input || e.steamId !== null);
            }
            client.setInstance(interaction.guildId, instance);

            client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
                id: `${verifyId}`,
                value: `${input}`
            }));

            await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
        }
        // User entered a player name - search for matching players in tracker
        else {
            // Find players in tracker matching the name
            const matchingPlayers = [];
            for (const player of tracker.players) {
                if (player.name.toLowerCase().includes(input.toLowerCase())) {
                    matchingPlayers.push(player);
                }
            }

            // If no players found
            if (matchingPlayers.length === 0) {
                interaction.deferUpdate();
                return;
            }

            // If only one player found, remove them directly
            if (matchingPlayers.length === 1) {
                const playerToRemove = matchingPlayers[0];
                tracker.players = tracker.players.filter(p => p !== playerToRemove);
                client.setInstance(interaction.guildId, instance);

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
                    id: `${verifyId}`,
                    value: `${playerToRemove.name}`
                }));

                await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
            }
            // If multiple players found, show selection menu
            else {
                await DiscordMessages.sendTrackerPlayerRemovalSelectionMessage(
                    interaction, client, ids.trackerId, matchingPlayers
                );
                return;
            }
        }
    }

    else if (interaction.customId === 'BaseCodesEdit') {
        if (!instance.baseCodes) {
            instance.baseCodes = { main: null, secondary: null };
        }

        const mainCode = interaction.fields.getTextInputValue('BaseCodeMain').trim();
        const secondaryCode = interaction.fields.getTextInputValue('BaseCodeSecondary').trim();

        instance.baseCodes.main = mainCode || null;
        instance.baseCodes.secondary = secondaryCode || null;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `main: ${mainCode || 'null'}, secondary: ${secondaryCode || 'null'}`
        }));

        const message = interaction.message;
        if (message) {
            const DiscordTools = require('../discordTools/discordTools.js');
            const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

            await client.messageEdit(message, {
                embeds: [DiscordEmbeds.getEmbed({
                    color: Constants.COLOR_SETTINGS,
                    title: client.intlGet(guildId, 'baseCodesSetting'),
                    description: client.intlGet(guildId, 'baseCodesSettingDesc'),
                    thumbnail: `attachment://settings_logo.png`,
                    fields: [
                        {
                            name: client.intlGet(guildId, 'baseCodes'),
                            value: DiscordTools.getBaseCodesDisplayValue(guildId),
                            inline: false
                        }
                    ]
                })],
                components: DiscordButtons.getBaseCodesButtons(guildId)
            });
        }

        const rustplus = client.rustplusInstances[guildId];
        if (rustplus && rustplus.isOperational) {
            await DiscordMessages.sendUpdateServerInformationMessage(rustplus);
        }
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userModalInteractionSuccess', {
        id: `${verifyId}`
    }));

    if (!interaction.replied && !interaction.deferred) {
        interaction.deferUpdate();
    }
}

function getUniqueBattlemetricsPlayerIdByName(bmInstance, name) {
    if (!bmInstance || !bmInstance.players || !name) return null;

    const matchingPlayerIds = Object.keys(bmInstance.players)
        .filter(playerId => bmInstance.players[playerId]['name'] === name);

    return matchingPlayerIds.length === 1 ? matchingPlayerIds[0] : null;
}
