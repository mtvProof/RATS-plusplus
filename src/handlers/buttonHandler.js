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
const Config = require('../../config');
const DiscordMessages = require('../discordTools/discordMessages.js');
const DiscordTools = require('../discordTools/discordTools.js');
const Scrape = require('../util/scrape.js');
const SmartSwitchGroupHandler = require('./smartSwitchGroupHandler.js');
const DiscordButtons = require('../discordTools/discordButtons.js');
const DiscordModals = require('../discordTools/discordModals.js');

function getTrackerPlayerCandidateNames(tracker, player, steamProfileName = null) {
    const candidates = new Set();
    const addCandidate = (value) => {
        if (!value || typeof value !== 'string') return;

        const normalized = value.trim();
        if (normalized !== '') candidates.add(normalized);
    };

    addCandidate(steamProfileName);
    addCandidate(player.name);

    if (tracker.clanTag) {
        if (steamProfileName) addCandidate(`${tracker.clanTag} ${steamProfileName}`);
        if (player.name) {
            addCandidate(`${tracker.clanTag} ${player.name}`);

            const clanTagPrefix = `${tracker.clanTag} `;
            if (player.name.startsWith(clanTagPrefix)) {
                addCandidate(player.name.slice(clanTagPrefix.length));
            }
        }
    }

    return Array.from(candidates);
}

function findBattlemetricsPlayerIdByNames(bmInstance, candidateNames) {
    if (!bmInstance || !bmInstance.players || candidateNames.length === 0) return null;
    const lowerCaseCandidates = candidateNames.map(name => name.toLowerCase());

    for (const [playerId, player] of Object.entries(bmInstance.players)) {
        if (candidateNames.includes(player.name)) return playerId;
    }

    for (const [playerId, player] of Object.entries(bmInstance.players)) {
        if (lowerCaseCandidates.includes(player.name.toLowerCase())) return playerId;
    }

    return null;
}

async function refreshTrackerBattlemetricsState(client, guildId, tracker) {
    if (!tracker || !tracker.battlemetricsId) return null;

    let bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];
    if (bmInstance) {
        await bmInstance.evaluation();
    }
    else {
        bmInstance = new Battlemetrics(tracker.battlemetricsId);
        await bmInstance.setup();
        client.battlemetricsInstances[tracker.battlemetricsId] = bmInstance;
    }

    if (!bmInstance || !bmInstance.lastUpdateSuccessful) return null;

    let trackerChanged = tracker.serverId !== `${bmInstance.server_ip}-${bmInstance.server_port}` ||
        tracker.title !== bmInstance.server_name ||
        tracker.img !== Constants.DEFAULT_SERVER_IMG;

    tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
    tracker.title = bmInstance.server_name;
    tracker.img = Constants.DEFAULT_SERVER_IMG;

    for (const player of tracker.players) {
        const hadPlayerId = !!player.playerId;
        const cachedPlayer = player.playerId ? bmInstance.players[player.playerId] : null;
        let steamProfileName = null;

        if (player.steamId) {
            steamProfileName = await Scrape.scrapeSteamProfileName(client, player.steamId);
        }

        const candidateNames = getTrackerPlayerCandidateNames(tracker, player, steamProfileName);
        const resolvedPlayerId = cachedPlayer ? player.playerId :
            findBattlemetricsPlayerIdByNames(bmInstance, candidateNames);

        if ((!hadPlayerId || !cachedPlayer) && resolvedPlayerId && player.playerId !== resolvedPlayerId) {
            player.playerId = resolvedPlayerId;
            trackerChanged = true;
        }

        const refreshedPlayer = player.playerId ? bmInstance.players[player.playerId] : null;
        let preferredName = player.name;
        if (player.steamId && steamProfileName) {
            preferredName = ((tracker.clanTag ? `${tracker.clanTag} ` : '') + steamProfileName).trim();
        }
        else if (!player.steamId && refreshedPlayer) {
            preferredName = refreshedPlayer.name;
        }

        if (preferredName && player.name !== preferredName) {
            player.name = preferredName;
            trackerChanged = true;
        }
    }

    if (trackerChanged) client.setInstance(guildId, client.getInstance(guildId));
    return bmInstance;
}

module.exports = async (client, interaction) => {
    const instance = client.getInstance(interaction.guildId);
    const guildId = interaction.guildId;
    const rustplus = client.rustplusInstances[guildId];

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    client.logInteraction(interaction, verifyId, 'userButton');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('DiscordNotification')) {
        const ids = JSON.parse(interaction.customId.replace('DiscordNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.discord = !setting.discord;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].discord = setting.discord;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.discord}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice,
                setting.hasOwnProperty('prepare') ? setting.prepare : null,
                setting.hasOwnProperty('prepareMinutes') ? setting.prepareMinutes : null),
            ...(setting.hasOwnProperty('prepare') ? [DiscordButtons.getNotificationPrepareEditButton(
                guildId, ids.setting, setting.prepareMinutes)] : [])]
        });
    }
    else if (interaction.customId.startsWith('InGameNotification')) {
        const ids = JSON.parse(interaction.customId.replace('InGameNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.inGame = !setting.inGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].inGame = setting.inGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.inGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice,
                setting.hasOwnProperty('prepare') ? setting.prepare : null,
                setting.hasOwnProperty('prepareMinutes') ? setting.prepareMinutes : null),
            ...(setting.hasOwnProperty('prepare') ? [DiscordButtons.getNotificationPrepareEditButton(
                guildId, ids.setting, setting.prepareMinutes)] : [])]
        });
    }
    else if (interaction.customId.startsWith('VoiceNotification')) {
        const ids = JSON.parse(interaction.customId.replace('VoiceNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        setting.voice = !setting.voice;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.notificationSettings[ids.setting].voice = setting.voice;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.voice}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice,
                setting.hasOwnProperty('prepare') ? setting.prepare : null,
                setting.hasOwnProperty('prepareMinutes') ? setting.prepareMinutes : null),
            ...(setting.hasOwnProperty('prepare') ? [DiscordButtons.getNotificationPrepareEditButton(
                guildId, ids.setting, setting.prepareMinutes)] : [])]
        });
    }
    else if (interaction.customId.startsWith('PrepareNotification')) {
        const ids = JSON.parse(interaction.customId.replace('PrepareNotification', ''));
        const setting = instance.notificationSettings[ids.setting];

        if (!setting.hasOwnProperty('prepare')) {
            interaction.deferUpdate();
            return;
        }

        setting.prepare = !setting.prepare;
        client.setInstance(guildId, instance);

        if (rustplus && rustplus.notificationSettings[ids.setting]) {
            rustplus.notificationSettings[ids.setting].prepare = setting.prepare;
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${setting.prepare}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getNotificationButtons(
                guildId, ids.setting, setting.discord, setting.inGame, setting.voice,
                setting.prepare, setting.prepareMinutes),
            DiscordButtons.getNotificationPrepareEditButton(guildId, ids.setting, setting.prepareMinutes)]
        });
    }
    else if (interaction.customId.startsWith('PrepareEdit')) {
        const ids = JSON.parse(interaction.customId.replace('PrepareEdit', ''));
        const setting = instance.notificationSettings[ids.setting];

        if (!setting) {
            interaction.deferUpdate();
            return;
        }

        const messageId = interaction.message ? interaction.message.id : null;
        const channelId = interaction.channelId ? interaction.channelId : null;

        await interaction.showModal(DiscordModals.getNotificationPrepareModal(
            guildId, ids.setting, setting.prepareMinutes, messageId, channelId));
    }
    else if (interaction.customId === 'AllowInGameCommands') {
        instance.generalSettings.inGameCommandsEnabled = !instance.generalSettings.inGameCommandsEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.inGameCommandsEnabled = instance.generalSettings.inGameCommandsEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.inGameCommandsEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameCommandsEnabledButton(guildId,
                instance.generalSettings.inGameCommandsEnabled)]
        });
    }
    else if (interaction.customId === 'BotMutedInGame') {
        instance.generalSettings.muteInGameBotMessages = !instance.generalSettings.muteInGameBotMessages;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.muteInGameBotMessages = instance.generalSettings.muteInGameBotMessages;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.muteInGameBotMessages}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getBotMutedInGameButton(guildId,
                instance.generalSettings.muteInGameBotMessages)]
        });
    }
    else if (interaction.customId === 'RecurringDecayAlerts') {
        instance.generalSettings.recurringDecayAlerts = !instance.generalSettings.recurringDecayAlerts;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.recurringDecayAlerts = instance.generalSettings.recurringDecayAlerts;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.recurringDecayAlerts}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getRecurringDecayAlertsButton(guildId,
                instance.generalSettings.recurringDecayAlerts)]
        });
    }
    else if (interaction.customId === 'InGameTeammateConnection') {
        instance.generalSettings.connectionNotify = !instance.generalSettings.connectionNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.connectionNotify = instance.generalSettings.connectionNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.connectionNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'InGameTeammateAfk') {
        instance.generalSettings.afkNotify = !instance.generalSettings.afkNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.afkNotify = instance.generalSettings.afkNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.afkNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'InGameTeammateDeath') {
        instance.generalSettings.deathNotify = !instance.generalSettings.deathNotify;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.deathNotify = instance.generalSettings.deathNotify;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.deathNotify}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getInGameTeammateNotificationsButtons(guildId)]
        });
    }
    else if (interaction.customId === 'FcmAlarmNotification') {
        instance.generalSettings.fcmAlarmNotificationEnabled = !instance.generalSettings.fcmAlarmNotificationEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.fcmAlarmNotificationEnabled =
            instance.generalSettings.fcmAlarmNotificationEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.fcmAlarmNotificationEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getFcmAlarmNotificationButtons(
                guildId,
                instance.generalSettings.fcmAlarmNotificationEnabled,
                instance.generalSettings.fcmAlarmNotificationEveryone)]
        });
    }
    else if (interaction.customId === 'FcmAlarmNotificationEveryone') {
        instance.generalSettings.fcmAlarmNotificationEveryone = !instance.generalSettings.fcmAlarmNotificationEveryone;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.fcmAlarmNotificationEveryone =
            instance.generalSettings.fcmAlarmNotificationEveryone;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.fcmAlarmNotificationEveryone}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getFcmAlarmNotificationButtons(
                guildId,
                instance.generalSettings.fcmAlarmNotificationEnabled,
                instance.generalSettings.fcmAlarmNotificationEveryone)]
        });
    }
    else if (interaction.customId === 'SmartAlarmNotifyInGame') {
        instance.generalSettings.smartAlarmNotifyInGame = !instance.generalSettings.smartAlarmNotifyInGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.smartAlarmNotifyInGame =
            instance.generalSettings.smartAlarmNotifyInGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.smartAlarmNotifyInGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getSmartAlarmNotifyInGameButton(
                guildId,
                instance.generalSettings.smartAlarmNotifyInGame)]
        });
    }
    else if (interaction.customId === 'SmartSwitchNotifyInGameWhenChangedFromDiscord') {
        instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
            !instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord =
            instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getSmartSwitchNotifyInGameWhenChangedFromDiscordButton(
                guildId,
                instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord)]
        });
    }
    else if (interaction.customId === 'LeaderCommandEnabled') {
        instance.generalSettings.leaderCommandEnabled = !instance.generalSettings.leaderCommandEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.leaderCommandEnabled = instance.generalSettings.leaderCommandEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.leaderCommandEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getLeaderCommandEnabledButton(
                guildId,
                instance.generalSettings.leaderCommandEnabled)]
        });
    }
    else if (interaction.customId === 'LeaderCommandOnlyForPaired') {
        instance.generalSettings.leaderCommandOnlyForPaired = !instance.generalSettings.leaderCommandOnlyForPaired;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.leaderCommandOnlyForPaired =
            instance.generalSettings.leaderCommandOnlyForPaired;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.leaderCommandOnlyForPaired}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getLeaderCommandOnlyForPairedButton(
                guildId,
                instance.generalSettings.leaderCommandOnlyForPaired)]
        });
    }
    else if (interaction.customId === 'MapWipeNotifyEveryone') {
        instance.generalSettings.mapWipeNotifyEveryone = !instance.generalSettings.mapWipeNotifyEveryone;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.mapWipeNotifyEveryone =
            instance.generalSettings.mapWipeNotifyEveryone;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.mapWipeNotifyEveryone}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getMapWipeNotifyEveryoneButton(instance.generalSettings.mapWipeNotifyEveryone)]
        });
    }
    else if (interaction.customId === 'ItemAvailableNotifyInGame') {
        instance.generalSettings.itemAvailableInVendingMachineNotifyInGame =
            !instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.itemAvailableInVendingMachineNotifyInGame =
            instance.generalSettings.itemAvailableInVendingMachineNotifyInGame;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.itemAvailableInVendingMachineNotifyInGame}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getItemAvailableNotifyInGameButton(guildId,
                instance.generalSettings.itemAvailableInVendingMachineNotifyInGame)]
        });
    }
    else if (interaction.customId === 'DisplayInformationBattlemetricsAllOnlinePlayers') {
        instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
            !instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.displayInformationBattlemetricsAllOnlinePlayers =
            instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers}`
        }));

        await client.interactionUpdate(interaction, {
            components: [DiscordButtons.getDisplayInformationBattlemetricsAllOnlinePlayersButton(guildId,
                instance.generalSettings.displayInformationBattlemetricsAllOnlinePlayers)]
        });
    }
    else if (interaction.customId === 'BattlemetricsServerNameChanges') {
        instance.generalSettings.battlemetricsServerNameChanges =
            !instance.generalSettings.battlemetricsServerNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsServerNameChanges =
            instance.generalSettings.battlemetricsServerNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsServerNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsTrackerNameChanges') {
        instance.generalSettings.battlemetricsTrackerNameChanges =
            !instance.generalSettings.battlemetricsTrackerNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsTrackerNameChanges =
            instance.generalSettings.battlemetricsTrackerNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsTrackerNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalNameChanges') {
        instance.generalSettings.battlemetricsGlobalNameChanges =
            !instance.generalSettings.battlemetricsGlobalNameChanges;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalNameChanges =
            instance.generalSettings.battlemetricsGlobalNameChanges;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalNameChanges}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalLogin') {
        instance.generalSettings.battlemetricsGlobalLogin =
            !instance.generalSettings.battlemetricsGlobalLogin;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalLogin =
            instance.generalSettings.battlemetricsGlobalLogin;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalLogin}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'BattlemetricsGlobalLogout') {
        instance.generalSettings.battlemetricsGlobalLogout =
            !instance.generalSettings.battlemetricsGlobalLogout;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.battlemetricsGlobalLogout =
            instance.generalSettings.battlemetricsGlobalLogout;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.battlemetricsGlobalLogout}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getSubscribeToChangesBattlemetricsButtons(guildId)
        });
    }
    else if (interaction.customId === 'CodeCommandEnabled') {
        if (!instance.generalSettings.hasOwnProperty('codeCommandEnabled')) {
            instance.generalSettings.codeCommandEnabled = true;
        }

        instance.generalSettings.codeCommandEnabled = !instance.generalSettings.codeCommandEnabled;
        client.setInstance(guildId, instance);

        if (rustplus) rustplus.generalSettings.codeCommandEnabled = instance.generalSettings.codeCommandEnabled;

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${instance.generalSettings.codeCommandEnabled}`
        }));

        await client.interactionUpdate(interaction, {
            components: DiscordButtons.getBaseCodesButtons(guildId)
        });
    }
    else if (interaction.customId === 'BaseCodesEdit') {
        await interaction.showModal(DiscordModals.getBaseCodesEditModal(guildId));
    }
    else if (interaction.customId.startsWith('ServerConnect')) {
        const ids = JSON.parse(interaction.customId.replace('ServerConnect', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        if (rustplus && rustplus.serverId === ids.serverId && rustplus.isOperational) {
            await DiscordMessages.sendServerMessage(guildId, ids.serverId, 1);
            return;
        }

        client.resetRustplusVariables(guildId);

        if (instance.activeServer !== null) {
            await DiscordMessages.sendServerMessage(guildId, instance.activeServer, null);
        }

        instance.activeServer = ids.serverId;
        client.setInstance(guildId, instance);

        /* Disconnect previous instance is any */
        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
        }

        /* Create the rustplus instance */
        const newRustplus = client.createRustplusInstance(
            guildId, server.serverIp, server.appPort, server.steamId, server.playerToken);

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null);

        newRustplus.isNewConnection = true;
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getServerEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('DeleteUnreachableDevices')) {
        const ids = JSON.parse(interaction.customId.replace('DeleteUnreachableDevices', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        const groupsToUpdate = [];
        for (const [entityId, content] of Object.entries(server.switches)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.switches, content.messageId);
                delete server.switches[entityId];

                for (const [groupId, groupContent] of Object.entries(server.switchGroups)) {
                    if (groupContent.switches.includes(`${entityId}`) && !groupsToUpdate.includes(groupId)) {
                        groupsToUpdate.push(groupId);
                    }
                }
            }
        }

        for (const groupId of groupsToUpdate) {
            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
        }

        for (const [entityId, content] of Object.entries(server.alarms)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId)
                delete server.alarms[entityId];
            }
        }

        for (const [entityId, content] of Object.entries(server.storageMonitors)) {
            if (!content.reachable) {
                await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, content.messageId)
                delete server.storageMonitors[entityId];
            }
        }

        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getCustomTimersEditModal(guildId, ids.serverId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('CreateTracker')) {
        if (interaction.customId === 'CreateTrackerTrackers') {
            if (!instance.activeServer) {
                await client.interactionUpdate(interaction, {
                    content: client.intlGet(guildId, 'noActiveServer'),
                    components: []
                });
                return;
            }

            const server = instance.serverList[instance.activeServer];

            if (!server) {
                await client.interactionUpdate(interaction, {
                    content: client.intlGet(guildId, 'serverNotFound'),
                    components: []
                });
                return;
            }

            await interaction.deferUpdate();

            const trackerId = client.findAvailableTrackerId(guildId);

            instance.trackers[trackerId] = {
                name: 'Tracker',
                serverId: instance.activeServer,
                battlemetricsId: server.battlemetricsId,
                title: server.title,
                img: server.img,
                clanTag: '',
                everyone: false,
                inGame: true,
                players: [],
                messageId: null
            }
            client.setInstance(guildId, instance);

            await DiscordMessages.sendTrackerMessage(guildId, trackerId);
            return;
        }

        const ids = JSON.parse(interaction.customId.replace('CreateTracker', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        /* Find an available tracker id */
        const trackerId = client.findAvailableTrackerId(guildId);

        instance.trackers[trackerId] = {
            name: 'Tracker',
            serverId: ids.serverId,
            battlemetricsId: server.battlemetricsId,
            title: server.title,
            img: server.img,
            clanTag: '',
            everyone: false,
            inGame: true,
            players: [],
            messageId: null
        }
        client.setInstance(guildId, instance);

        await DiscordMessages.sendTrackerMessage(guildId, trackerId);
    }
    else if (interaction.customId.startsWith('CreateGroup')) {
        if (interaction.customId === 'CreateGroupSwitchGroups') {
            if (!instance.activeServer) {
                await client.interactionUpdate(interaction, {
                    content: client.intlGet(guildId, 'noActiveServer'),
                    components: []
                });
                return;
            }

            const server = instance.serverList[instance.activeServer];

            if (!server) {
                await client.interactionUpdate(interaction, {
                    content: client.intlGet(guildId, 'serverNotFound'),
                    components: []
                });
                return;
            }

            await interaction.deferUpdate();

            const groupId = client.findAvailableGroupId(guildId, instance.activeServer);

            server.switchGroups[groupId] = {
                name: 'Group',
                command: `${groupId}`,
                switches: [],
                image: 'smart_switch.png',
                messageId: null
            }
            client.setInstance(guildId, instance);

            client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${groupId}`
            }));

            await DiscordMessages.sendSmartSwitchGroupMessage(guildId, instance.activeServer, groupId);
            return;
        }

        const ids = JSON.parse(interaction.customId.replace('CreateGroup', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        const groupId = client.findAvailableGroupId(guildId, ids.serverId);

        server.switchGroups[groupId] = {
            name: 'Group',
            command: `${groupId}`,
            switches: [],
            image: 'smart_switch.png',
            messageId: null
        }
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${groupId}`
        }));

        await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
    }
    else if (interaction.customId.startsWith('ServerDisconnect') ||
        interaction.customId.startsWith('ServerReconnecting')) {
        const ids = JSON.parse(interaction.customId.replace('ServerDisconnect', '')
            .replace('ServerReconnecting', ''));
        const server = instance.serverList[ids.serverId];

        if (!server) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        instance.activeServer = null;
        client.setInstance(guildId, instance);

        client.resetRustplusVariables(guildId);

        if (rustplus) {
            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        await DiscordMessages.sendServerMessage(guildId, ids.serverId, null);
    }
    else if (interaction.customId.startsWith('ServerDelete')) {
        const ids = JSON.parse(interaction.customId.replace('ServerDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server) {
            await interaction.message.delete();
            return;
        }

        if (rustplus && (rustplus.serverId === ids.serverId || rustplus.serverId === instance.activeServer)) {
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switches, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.switchGroups, 100);
            await DiscordTools.clearTextChannel(rustplus.guildId, instance.channelId.storageMonitors, 100);

            instance.activeServer = null;
            client.setInstance(guildId, instance);

            client.resetRustplusVariables(guildId);

            rustplus.isDeleted = true;
            rustplus.disconnect();
            delete client.rustplusInstances[guildId];
        }

        for (const [entityId, content] of Object.entries(server.alarms)) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, content.messageId);
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.servers, server.messageId);

        delete instance.serverList[ids.serverId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SmartSwitchOn') ||
        interaction.customId.startsWith('SmartSwitchOff')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchOn', '').replace('SmartSwitchOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        if (!rustplus || (rustplus && (rustplus.serverId !== ids.serverId))) {
            interaction.deferUpdate();
            return;
        }

        clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
        delete rustplus.currentSwitchTimeouts[ids.entityId];

        const active = (interaction.customId.startsWith('SmartSwitchOn')) ? true : false;
        const prevActive = server.switches[ids.entityId].active;
        server.switches[ids.entityId].active = active;
        client.setInstance(guildId, instance);

        rustplus.interactionSwitches.push(ids.entityId);

        const response = await rustplus.turnSmartSwitchAsync(ids.entityId, active);
        if (!(await rustplus.isResponseValid(response))) {
            if (server.switches[ids.entityId].reachable) {
                await DiscordMessages.sendSmartSwitchNotFoundMessage(guildId, ids.serverId, ids.entityId);
            }
            server.switches[ids.entityId].reachable = false;
            server.switches[ids.entityId].active = prevActive;
            client.setInstance(guildId, instance);

            rustplus.interactionSwitches = rustplus.interactionSwitches.filter(e => e !== ids.entityId);
        }
        else {
            server.switches[ids.entityId].reachable = true;
            client.setInstance(guildId, instance);
        }

        if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
            const user = interaction.user.username;
            const name = server.switches[ids.entityId].name;
            const status = active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
            const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchFromDiscord', {
                user: user,
                name: name,
                status: status
            });

            await rustplus.sendInGameMessage(str);
        }

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${active}`
        }));

        DiscordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId, interaction);
        SmartSwitchGroupHandler.updateSwitchGroupIfContainSwitch(client, guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartSwitchEditModal(guildId, ids.serverId, ids.entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('SmartSwitchDelete')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.switches,
            server.switches[ids.entityId].messageId);

        delete server.switches[ids.entityId];
        client.setInstance(guildId, instance);

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.entityId]);
            delete rustplus.currentSwitchTimeouts[ids.entityId];
        }

        for (const [groupId, content] of Object.entries(server.switchGroups)) {
            if (content.switches.includes(ids.entityId.toString())) {
                server.switchGroups[groupId].switches = content.switches.filter(e => e !== ids.entityId.toString());
                client.setInstance(guildId, instance);
                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, groupId);
            }
        }
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SAEv|')) {
        const [serverId, entityId] = interaction.customId.replace('SAEv|', '').split('|');
        const server = instance.serverList[serverId];

        if (!server || (server && !server.alarms.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        server.alarms[entityId].everyone = !server.alarms[entityId].everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.alarms[entityId].everyone}`
        }));

        await DiscordMessages.sendSmartAlarmMessage(guildId, serverId, entityId, interaction);
    }
    else if (interaction.customId.startsWith('SADel|')) {
        const [serverId, entityId] = interaction.customId.replace('SADel|', '').split('|');
        const server = instance.serverList[serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            await interaction.deferUpdate();
            return;
        }

        await interaction.deferUpdate();

        if (!server || (server && !server.alarms.hasOwnProperty(entityId))) {
            try {
                await interaction.message.delete();
            }
            catch (e) {
                // Message may already be gone
            }
            return;
        }

        const messageId = server.alarms[entityId].messageId;

        try {
            await interaction.message.delete();
        }
        catch (e) {
            // Fall back to deleting the stored message id
        }

        if (messageId && interaction.message.id !== messageId) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.alarms, messageId);
        }

        delete server.alarms[entityId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SAEdit|')) {
        const [serverId, entityId] = interaction.customId.replace('SAEdit|', '').split('|');
        const server = instance.serverList[serverId];

        if (!server || (server && !server.alarms.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getSmartAlarmEditModal(guildId, serverId, entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('SMTCEv|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[entityId].everyone = !server.storageMonitors[entityId].everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.storageMonitors[entityId].everyone}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId, interaction);
    }
    else if (interaction.customId.startsWith('SMTCIn|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        server.storageMonitors[entityId].inGame = !server.storageMonitors[entityId].inGame;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${server.storageMonitors[entityId].inGame}`
        }));

        await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId, interaction);
    }
    else if (interaction.customId.startsWith('SMEdit|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getStorageMonitorEditModal(guildId, serverId, entityId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('SMTCDel|')) {
        const parts = interaction.customId.substring(8).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors,
            server.storageMonitors[entityId].messageId);

        delete server.storageMonitors[entityId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('SMRecy|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (!server || (server && !server.storageMonitors.hasOwnProperty(entityId))) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        if (!rustplus || (rustplus && rustplus.serverId !== serverId)) return;

        const entityInfo = await rustplus.getEntityInfoAsync(entityId);
        if (!(await rustplus.isResponseValid(entityInfo))) {
            if (server.storageMonitors[entityId].reachable) {
                await DiscordMessages.sendStorageMonitorNotFoundMessage(guildId, serverId, entityId);
            }
            server.storageMonitors[entityId].reachable = false;
            client.setInstance(guildId, instance);

            await DiscordMessages.sendStorageMonitorMessage(guildId, serverId, entityId);
            return;
        }

        server.storageMonitors[entityId].reachable = true;
        client.setInstance(guildId, instance);

        const items = client.rustlabs.getRecycleDataFromArray(entityInfo.entityInfo.payload.items);

        const message = await DiscordMessages.sendStorageMonitorRecycleMessage(
            guildId, serverId, entityId, items);

        setTimeout(async () => {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors, message.id);
        }, 30000);
    }
    else if (interaction.customId.startsWith('SMCDel|')) {
        const parts = interaction.customId.substring(7).split('|');
        const serverId = parts[0];
        const entityId = parts[1];
        const server = instance.serverList[serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            await interaction.message.delete();
            return;
        }

        await DiscordTools.deleteMessageById(guildId, instance.channelId.storageMonitors,
            server.storageMonitors[ids.entityId].messageId);

        delete server.storageMonitors[ids.entityId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId === 'RecycleDelete') {
        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        await interaction.message.delete();
    }
    else if (interaction.customId.startsWith('GroupToggleSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupToggleSwitch', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        if (!server.switches.hasOwnProperty(ids.switchId)) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        if (rustplus && rustplus.serverId === ids.serverId) {
            const sw = server.switches[ids.switchId];
            const newState = !sw.active;

            if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
                const user = interaction.user.username;
                const name = sw.name;
                const status = newState ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
                const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchFromDiscord', {
                    user: user,
                    name: name,
                    status: status
                });

                await rustplus.sendInGameMessage(str);
            }

            client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
                id: `${verifyId}`,
                value: `${ids.switchId} -> ${newState}`
            }));

            await rustplus.turnSmartSwitchAsync(ids.switchId, newState);

            setTimeout(async () => {
                await DiscordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, ids.groupId);
            }, 500);
        }
    }
    else if (interaction.customId.startsWith('GroupTurnOn') ||
        interaction.customId.startsWith('GroupTurnOff')) {
        const ids = JSON.parse(interaction.customId.replace('GroupTurnOn', '').replace('GroupTurnOff', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        interaction.deferUpdate();

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.group]);
            delete rustplus.currentSwitchTimeouts[ids.group];

            if (rustplus.serverId === ids.serverId) {
                const active = (interaction.customId.startsWith('GroupTurnOn') ? true : false);

                if (instance.generalSettings.smartSwitchNotifyInGameWhenChangedFromDiscord) {
                    const user = interaction.user.username;
                    const name = server.switchGroups[ids.groupId].name;
                    const status = active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
                    const str = client.intlGet(guildId, 'userTurnedOnOffSmartSwitchGroupFromDiscord', {
                        user: user,
                        name: name,
                        status: status
                    });

                    await rustplus.sendInGameMessage(str);
                }

                client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
                    id: `${verifyId}`,
                    value: `${active}`
                }));

                await SmartSwitchGroupHandler.TurnOnOffGroup(
                    client, rustplus, guildId, ids.serverId, ids.groupId, active);
            }
        }
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupEditModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('GroupDelete')) {
        const ids = JSON.parse(interaction.customId.replace('GroupDelete', ''));
        const server = instance.serverList[ids.serverId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        if (rustplus) {
            clearTimeout(rustplus.currentSwitchTimeouts[ids.groupId]);
            delete rustplus.currentSwitchTimeouts[ids.groupId];
        }

        if (server.switchGroups.hasOwnProperty(ids.groupId)) {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.switchGroups,
                server.switchGroups[ids.groupId].messageId);

            delete server.switchGroups[ids.groupId];
            client.setInstance(guildId, instance);
        }
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupAddSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getGroupRemoveSwitchModal(guildId, ids.serverId, ids.groupId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerEveryone')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEveryone', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.everyone = !tracker.everyone;
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${tracker.everyone}`
        }));

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }
    else if (interaction.customId.startsWith('TrackerUpdate')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerUpdate', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        await interaction.deferUpdate();

        await refreshTrackerBattlemetricsState(client, guildId, tracker);

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerEditModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerDelete')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerDelete', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (Config.discord.needAdminPrivileges && !client.isAdministrator(interaction)) {
            interaction.deferUpdate();
            return;
        }

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        if (tracker.channelId) {
            try {
                await DiscordTools.removeTextChannel(guildId, tracker.channelId);
            } catch (e) {
                client.log(client.intlGet(null, 'errorCap'), `Could not delete tracker channel: ${e}`, 'error');
            }
        } else {
            await DiscordTools.deleteMessageById(guildId, instance.channelId.trackers,
                tracker.messageId);
        }

        delete instance.trackers[ids.trackerId];
        client.setInstance(guildId, instance);
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerAddPlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const modal = DiscordModals.getTrackerRemovePlayerModal(guildId, ids.trackerId);
        await interaction.showModal(modal);
    }
    else if (interaction.customId.startsWith('TrackerSelectPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerSelectPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const playerId = ids.playerId;

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];
        if (!bmInstance || !bmInstance.lastUpdateSuccessful) {
            await interaction.deferUpdate();
            await interaction.message.delete();
            return;
        }

        if (tracker.players.some(e => e.playerId === playerId)) {
            await interaction.deferUpdate();
            await interaction.message.delete();
            return;
        }

        const playerName = bmInstance.players[playerId]['name'];
        tracker.players.push({
            name: playerName,
            steamId: null,
            playerId: playerId
        });
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${playerName}`
        }));

        await interaction.deferUpdate();
        await interaction.message.delete();
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerRemoveSelectedPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemoveSelectedPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker || ids.playerIndex >= tracker.players.length) {
            await interaction.message.delete();
            return;
        }

        const playerToRemove = tracker.players[ids.playerIndex];
        tracker.players = tracker.players.filter((_, index) => index !== ids.playerIndex);
        client.setInstance(guildId, instance);

        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${playerToRemove.name}`
        }));

        await interaction.deferUpdate();
        await interaction.message.delete();
        await DiscordMessages.sendTrackerMessage(interaction.guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerInGame')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerInGame', ''));
        const tracker = instance.trackers[ids.trackerId];

        if (!tracker) {
            await interaction.message.delete();
            return;
        }

        tracker.inGame = !tracker.inGame;
        client.setInstance(guildId, instance);


        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'buttonValueChange', {
            id: `${verifyId}`,
            value: `${tracker.inGame}`
        }));

        await DiscordMessages.sendTrackerMessage(guildId, ids.trackerId, interaction);
    }

    client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'userButtonInteractionSuccess', {
        id: `${verifyId}`
    }));
}
