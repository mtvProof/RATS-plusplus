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
const Path = require('path');

const Constants = require('../util/constants.js');
const Client = require('../../index.ts');
const DiscordButtons = require('./discordButtons.js');
const DiscordEmbeds = require('./discordEmbeds.js');
const DiscordSelectMenus = require('./discordSelectMenus.js');
const DiscordTools = require('./discordTools.js');
const Scrape = require('../util/scrape.js');

module.exports = {
    sendMessage: async function (guildId, content, messageId, channelId, interaction = null) {
        if (interaction) {
            await Client.client.interactionUpdate(interaction, content);
            return;
        }

        let message = messageId !== null ?
            await DiscordTools.getMessageById(guildId, channelId, messageId) : undefined;

        if (message !== undefined) {
            return await Client.client.messageEdit(message, content);
        }
        else {
            const channel = DiscordTools.getTextChannelById(guildId, channelId);

            if (!channel) {
                Client.client.log(Client.client.intlGet(null, 'errorCap'),
                    Client.client.intlGet(null, 'couldNotGetChannelWithId', { id: channelId }), 'error');
                return;
            }

            return await Client.client.messageSend(channel, content);
        }
    },

    sendServerMessage: async function (guildId, serverId, state = null, interaction = null) {
        const instance = Client.client.getInstance(guildId);
        const server = instance.serverList[serverId];

        const content = {
            embeds: [await DiscordEmbeds.getServerEmbed(guildId, serverId)],
            components: DiscordButtons.getServerButtons(guildId, serverId, state)
        }

        const message = await module.exports.sendMessage(guildId, content, server.messageId,
            instance.channelId.servers, interaction);

        if (!message) return; // Send failed; avoid touching instance state

        if (!interaction) {
            instance.serverList[serverId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendTrackerMessage: async function (guildId, trackerId, interaction = null) {
        const instance = Client.client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];

        const content = {
            embeds: [DiscordEmbeds.getTrackerEmbed(guildId, trackerId)],
            components: DiscordButtons.getTrackerButtons(guildId, trackerId)
        }

        const message = await module.exports.sendMessage(guildId, content, tracker.messageId,
            instance.channelId.trackers, interaction);

        if (!interaction) {
            instance.trackers[trackerId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendTrackerPlayerSelectionMessage: async function (interaction, client, trackerId, playerIds) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);
        const tracker = instance.trackers[trackerId];
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

        const embed = DiscordEmbeds.getEmbed({
            title: client.intlGet(guildId, 'trackerSelectPlayer'),
            color: Constants.COLOR_DEFAULT,
            description: client.intlGet(guildId, 'trackerSelectPlayerDesc')
        });

        const fields = [];
        let fieldValue = '';
        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            const playerName = bmInstance.players[playerId]['name'];
            const status = bmInstance.players[playerId]['status'] ? Constants.ONLINE_EMOJI : Constants.OFFLINE_EMOJI;
            
            const line = `${i + 1}. ${status} ${playerName}\n`;
            if ((fieldValue + line).length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
                fields.push(fieldValue);
                fieldValue = line;
            } else {
                fieldValue += line;
            }
        }
        if (fieldValue) fields.push(fieldValue);

        embed.fields = [{
            name: client.intlGet(guildId, 'matchingPlayers'),
            value: fields[0] || client.intlGet(guildId, 'empty'),
            inline: false
        }];

        const buttons = [];
        const maxButtons = Math.min(playerIds.length, 25);
        
        for (let i = 0; i < maxButtons; i++) {
            const playerId = playerIds[i];
            const playerName = bmInstance.players[playerId]['name'];
            const buttonLabel = playerName.substring(0, 80); // Discord button label limit
            
            buttons.push(
                new Discord.ButtonBuilder()
                    .setCustomId(`TrackerSelectPlayer${JSON.stringify({ trackerId: trackerId, playerId: playerId })}`)
                    .setLabel(buttonLabel)
                    .setStyle(Discord.ButtonStyle.Primary)
            );
        }

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new Discord.ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        const channel = await client.channels.fetch(instance.channelId.trackers);
        if (!channel) return;

        const message = await channel.send({
            embeds: [embed],
            components: rows
        });

        // Auto-delete message after 5 minutes
        setTimeout(() => {
            if (message && !message.deleted) {
                message.delete().catch(() => {});
            }
        }, 5 * 60 * 1000);
    },

    sendTrackerPlayerRemovalSelectionMessage: async function (interaction, client, trackerId, playersToRemove) {
        const guildId = interaction.guildId;
        const instance = client.getInstance(guildId);

        const embed = DiscordEmbeds.getEmbed({
            title: client.intlGet(guildId, 'trackerSelectPlayerRemove'),
            color: Constants.COLOR_DEFAULT,
            description: client.intlGet(guildId, 'trackerSelectPlayerRemoveDesc')
        });

        const fields = [];
        let fieldValue = '';
        for (let i = 0; i < playersToRemove.length; i++) {
            const player = playersToRemove[i];
            const line = `${i + 1}. ${player.name}\n`;
            if ((fieldValue + line).length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS) {
                fields.push(fieldValue);
                fieldValue = line;
            } else {
                fieldValue += line;
            }
        }
        if (fieldValue) fields.push(fieldValue);

        embed.fields = [{
            name: client.intlGet(guildId, 'matchingPlayers'),
            value: fields[0] || client.intlGet(guildId, 'empty'),
            inline: false
        }];

        const buttons = [];
        const maxButtons = Math.min(playersToRemove.length, 25);
        
        for (let i = 0; i < maxButtons; i++) {
            const player = playersToRemove[i];
            const buttonLabel = player.name.substring(0, 80); // Discord button label limit
            
            buttons.push(
                new Discord.ButtonBuilder()
                    .setCustomId(`TrackerRemoveSelectedPlayer${JSON.stringify({ trackerId: trackerId, playerIndex: i })}`)
                    .setLabel(buttonLabel)
                    .setStyle(Discord.ButtonStyle.Danger)
            );
        }

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new Discord.ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        const channel = await client.channels.fetch(instance.channelId.trackers);
        if (!channel) return;

        const message = await channel.send({
            embeds: [embed],
            components: rows
        });

        // Auto-delete message after 5 minutes
        setTimeout(() => {
            if (message && !message.deleted) {
                message.delete().catch(() => {});
            }
        }, 5 * 60 * 1000);
    },

    sendSmartSwitchMessage: async function (guildId, serverId, entityId, interaction = null) {
        const instance = Client.client.getInstance(guildId);
        const server = instance.serverList[serverId];
        if (!server || !server.switches || !server.switches[entityId]) return;
        const entity = server.switches[entityId];

        const content = {
            embeds: [entity.reachable ?
                DiscordEmbeds.getSmartSwitchEmbed(guildId, serverId, entityId) :
                DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'switches')],
            components: [
                DiscordSelectMenus.getSmartSwitchSelectMenu(guildId, serverId, entityId),
                DiscordButtons.getSmartSwitchButtons(guildId, serverId, entityId)
            ],
            files: [
                new Discord.AttachmentBuilder(Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))
            ]
        }

        const message = await module.exports.sendMessage(guildId, content, entity.messageId,
            instance.channelId.switches, interaction);

        // If Discord rejected the edit/send (deleted message, missing perms, etc.), bail out.
        if (!message) return;

        if (!interaction) {
            instance.serverList[serverId].switches[entityId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendSmartAlarmMessage: async function (guildId, serverId, entityId, interaction = null) {
        const instance = Client.client.getInstance(guildId);
        const server = instance.serverList[serverId];
        if (!server || !server.alarms || !server.alarms[entityId]) return;
        const entity = server.alarms[entityId];

        const content = {
            embeds: [entity.reachable ?
                DiscordEmbeds.getSmartAlarmEmbed(guildId, serverId, entityId) :
                DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'alarms')],
            components: [DiscordButtons.getSmartAlarmButtons(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))]
        }

        const message = await module.exports.sendMessage(guildId, content, entity.messageId,
            instance.channelId.alarms, interaction);

        // If Discord rejected the edit/send, do not dereference message.
        if (!message) return;

        if (!interaction) {
            instance.serverList[serverId].alarms[entityId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendStorageMonitorMessage: async function (guildId, serverId, entityId, interaction = null) {
        let instance = Client.client.getInstance(guildId);
        const server = instance.serverList[serverId];
        if (!server || !server.storageMonitors || !server.storageMonitors[entityId]) return;
        const entity = server.storageMonitors[entityId];

        // Throttle updates to prevent Discord rate limiting (max 5 edits per 5 seconds per message)
        const rustplus = Client.client.rustplusInstances[guildId];
        if (rustplus && !interaction) {
            const now = Date.now();
            const lastUpdate = rustplus.storageMonitorMessageTimestamps[entityId] || 0;
            const minInterval = 2000; // 2 seconds minimum between updates
            
            if (now - lastUpdate < minInterval) {
                return; // Skip this update to avoid rate limiting
            }
            rustplus.storageMonitorMessageTimestamps[entityId] = now;
        }

        const content = {
            embeds: [entity.reachable ?
                DiscordEmbeds.getStorageMonitorEmbed(guildId, serverId, entityId) :
                DiscordEmbeds.getNotFoundSmartDeviceEmbed(guildId, serverId, entityId, 'storageMonitors')],
            components: [entity.type === 'toolCupboard' ?
                DiscordButtons.getStorageMonitorToolCupboardButtons(guildId, serverId, entityId) :
                DiscordButtons.getStorageMonitorContainerButton(guildId, serverId, entityId)],
            files: [
                new Discord.AttachmentBuilder(
                    Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))]
        }

        instance = Client.client.getInstance(guildId);

        const message = await module.exports.sendMessage(guildId, content, entity.messageId,
            instance.channelId.storageMonitors, interaction);

        // If Discord rejected the edit/send, do not dereference message.
        if (!message) return;

        if (!interaction && message) {
            instance.serverList[serverId].storageMonitors[entityId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendSmartSwitchGroupMessage: async function (guildId, serverId, groupId, interaction = null) {
        const instance = Client.client.getInstance(guildId);
        const group = instance.serverList[serverId].switchGroups[groupId];

        const content = {
            embeds: [DiscordEmbeds.getSmartSwitchGroupEmbed(guildId, serverId, groupId)],
            components: DiscordButtons.getSmartSwitchGroupButtons(guildId, serverId, groupId),
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${group.image}`))]
        }

        const message = await module.exports.sendMessage(guildId, content, group.messageId,
            instance.channelId.switchGroups, interaction);

        if (!interaction) {
            instance.serverList[serverId].switchGroups[groupId].messageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendSwitchGroupsCreateButtonMessage: async function (guildId, serverId) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            content: Client.client.intlGet(guildId, 'clickToCreateGroup'),
            components: [DiscordButtons.getSwitchGroupsCreateButton(guildId, serverId)]
        }

        const message = await module.exports.sendMessage(guildId, content, instance.switchGroupsMessageId,
            instance.channelId.switchGroups);

        if (message) {
            instance.switchGroupsMessageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendTrackersCreateButtonMessage: async function (guildId) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            content: Client.client.intlGet(guildId, 'clickToCreateTracker'),
            components: [DiscordButtons.getTrackersCreateButton(guildId)]
        }

        const message = await module.exports.sendMessage(guildId, content, instance.trackersMessageId,
            instance.channelId.trackers);

        if (message) {
            instance.trackersMessageId = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendStorageMonitorRecycleMessage: async function (guildId, serverId, entityId, items) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getStorageMonitorRecycleEmbed(guildId, serverId, entityId, items)],
            components: [DiscordButtons.getRecycleDeleteButton()],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', 'resources/images/electrics/recycler.png'))]
        }

        return await module.exports.sendMessage(guildId, content, null, instance.channelId.storageMonitors);
    },

    sendDecayingNotificationMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];

        const content = {
            embeds: [DiscordEmbeds.getDecayingNotificationEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))],
            content: entity.everyone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.importantAlerts);
    },

    sendStorageMonitorDisconnectNotificationMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];

        const content = {
            embeds: [DiscordEmbeds.getStorageMonitorDisconnectNotificationEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))],
            content: entity.everyone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendStorageMonitorNotFoundMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].storageMonitors[entityId];

        const content = {
            embeds: [await DiscordEmbeds.getStorageMonitorNotFoundEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))],
            content: entity.everyone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendSmartSwitchNotFoundMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].switches[entityId];

        const content = {
            embeds: [await DiscordEmbeds.getSmartSwitchNotFoundEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))]
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendSmartAlarmNotFoundMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].alarms[entityId];

        const content = {
            embeds: [await DiscordEmbeds.getSmartAlarmNotFoundEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))],
            content: entity.everyone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.importantAlerts);
    },

    sendSmartAlarmTriggerMessage: async function (guildId, serverId, entityId) {
        const instance = Client.client.getInstance(guildId);
        const entity = instance.serverList[serverId].alarms[entityId];

        const content = {
            embeds: [await DiscordEmbeds.getAlarmEmbed(guildId, serverId, entityId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/electrics/${entity.image}`))],
            content: entity.everyone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.importantAlerts);
    },

    sendServerChangeStateMessage: async function (guildId, serverId, state) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getServerChangedStateEmbed(guildId, serverId, state)]
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendServerWipeDetectedMessage: async function (guildId, serverId) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getServerWipeDetectedEmbed(guildId, serverId)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', '..', `maps/${guildId}_map_full.png`))],
            content: instance.generalSettings.mapWipeNotifyEveryone ? '@everyone' : ''
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendServerConnectionInvalidMessage: async function (guildId, serverId) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getServerConnectionInvalidEmbed(guildId, serverId)]
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendInformationMapMessage: async function (guildId) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', '..', `maps/${guildId}_map_full.png`))]
        }

        const message = await module.exports.sendMessage(guildId, content, instance.informationMessageId.map,
            instance.channelId.information);

        if (message) {
            instance.informationMessageId.map = message.id;
            Client.client.setInstance(guildId, instance);
        }
    },

    sendDiscordEventMessage: async function (guildId, serverId, text, image, color) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getEventEmbed(guildId, serverId, text, image, color)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', `resources/images/events/${image}`))]
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.events);
    },

    sendActivityNotificationMessage: async function (guildId, serverId, color, text, steamId, title = null, everyone = false) {
        const instance = Client.client.getInstance(guildId);

        let png = null;
        if (steamId !== null) {
            png = await Scrape.scrapeSteamProfilePicture(Client.client, steamId);
        }
        const content = {
            embeds: [DiscordEmbeds.getActivityNotificationEmbed(guildId, serverId, color, text, steamId, png, title)]
        }

        if (everyone) {
            content.content = '@everyone';
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendTeamChatMessage: async function (guildId, message) {
        const instance = Client.client.getInstance(guildId);

        const teamLabel = message.teamLabel === 'secondary' ? 'Team 2' : 'Team 1';

        let color = Constants.COLOR_TEAMCHAT_DEFAULT;
        if (instance.teamChatColors.hasOwnProperty(message.steamId)) {
            color = instance.teamChatColors[message.steamId];
        }
        else if (message.teamLabel === 'secondary') {
            color = Constants.COLOR_TEAMCHAT_SECONDARY;
        }

        const content = {
            embeds: [DiscordEmbeds.getEmbed({
                color: color,
                description: `**[${teamLabel}] ${message.name}**: ${message.message}`
            })]
        }

        if (message.message.includes('@everyone')) {
            content.content = '@everyone';
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.teamchat);
    },

    sendTTSMessage: async function (guildId, name, text) {
        const instance = Client.client.getInstance(guildId);
        const DiscordVoice = require('./discordVoice.js');

        // Send to voice channel
        const message = Client.client.intlGet(guildId, 'userSaid', { user: name, text: text });
        const voiceSuccess = await DiscordVoice.sendDiscordVoiceMessage(guildId, message);

        // Also send as text to team chat channel
        let content;
        if (!voiceSuccess) {
            content = {
                content: `${message} ${Client.client.intlGet(guildId, 'ttsNotInVoice')}`
            };
        } else {
            content = {
                content: message
            };
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.teamchat);
    },

    sendUpdateMapInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', '..', `maps/${rustplus.guildId}_map_full.png`))]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.map, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.map) {
            instance.informationMessageId.map = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateServerInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        let embed = null;
        try {
            embed = await DiscordEmbeds.getUpdateServerInformationEmbed(rustplus);
        }
        catch (e) {
            Client.client.log(Client.client.intlGet(null, 'errorCap'), `sendUpdateServerInformationMessage failed: ${e}`, 'error');
            embed = DiscordEmbeds.getEmbed({
                title: Client.client.intlGet(rustplus.guildId, 'serverInfo'),
                color: Constants.COLOR_DEFAULT,
                description: Client.client.intlGet(rustplus.guildId, 'unavailable'),
                timestamp: true
            });
        }

        const content = {
            embeds: [embed],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', 'resources/images/server_info_logo.png')
            )]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.server, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.server) {
            instance.informationMessageId.server = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateEventInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateEventInformationEmbed(rustplus)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', 'resources/images/event_info_logo.png')
            )]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.event, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.event) {
            instance.informationMessageId.event = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateTeamInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateTeamInformationEmbed(rustplus)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', 'resources/images/team_info_logo.png')
            )]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.team, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.team) {
            instance.informationMessageId.team = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateBattlemetricsOnlinePlayersInformationMessage: async function (rustplus, battlemetricsId) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateBattlemetricsOnlinePlayersInformationEmbed(rustplus, battlemetricsId)]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.battlemetricsPlayers, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.battlemetricsPlayers) {
            instance.informationMessageId.battlemetricsPlayers = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateToolCupboardUpkeepInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateToolCupboardUpkeepInformationEmbed(rustplus)],
            files: [new Discord.AttachmentBuilder(
                Path.join(__dirname, '..', 'resources/images/electrics/tool_cupboard.png')
            )]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.toolCupboardUpkeep, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.toolCupboardUpkeep) {
            instance.informationMessageId.toolCupboardUpkeep = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateMarketWatchlistInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateMarketWatchlistInformationEmbed(rustplus)]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.marketWatchlist, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.marketWatchlist) {
            instance.informationMessageId.marketWatchlist = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendUpdateLootInformationMessage: async function (rustplus) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getUpdateLootInformationEmbed(rustplus)]
        }

        const message = await module.exports.sendMessage(rustplus.guildId, content,
            instance.informationMessageId.loot, instance.channelId.information);

        if (message && message.id !== instance.informationMessageId.loot) {
            instance.informationMessageId.loot = message.id;
            Client.client.setInstance(rustplus.guildId, instance);
        }
    },

    sendDiscordCommandResponseMessage: async function (rustplus, client, message, response) {
        const content = {
            embeds: [DiscordEmbeds.getDiscordCommandResponseEmbed(rustplus, response)]
        }

        await client.messageReply(message, content);
    },

    sendCredentialsShowMessage: async function (interaction) {
        const content = {
            embeds: [await DiscordEmbeds.getCredentialsShowEmbed(interaction.guildId)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendItemAvailableInVendingMachineMessage: async function (rustplus, str) {
        const instance = Client.client.getInstance(rustplus.guildId);

        const content = {
            embeds: [DiscordEmbeds.getItemAvailableVendingMachineEmbed(
                rustplus.guildId, rustplus.serverId, str
            )]
        }

        await module.exports.sendMessage(rustplus.guildId, content, null, instance.channelId.activity);
    },

    sendHelpMessage: async function (interaction) {
        const content = {
            embeds: [DiscordEmbeds.getHelpEmbed(interaction.guildId)],
            components: DiscordButtons.getHelpButtons(),
            ephemeral: true
        }

        await Client.client.interactionReply(interaction, content);
    },

    sendCctvMessage: async function (interaction, monument, cctvCodes, dynamic) {
        const content = {
            embeds: [DiscordEmbeds.getCctvEmbed(interaction.guildId, monument, cctvCodes, dynamic)],
            ephemeral: true
        }

        await Client.client.interactionReply(interaction, content);
    },

    sendUptimeMessage: async function (interaction, uptime) {
        const content = {
            embeds: [DiscordEmbeds.getUptimeEmbed(interaction.guildId, uptime)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendVoiceMessage: async function (interaction, state) {
        const content = {
            embeds: [DiscordEmbeds.getVoiceEmbed(interaction.guildId, state)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendCraftMessage: async function (interaction, craftDetails, quantity) {
        const content = {
            embeds: [DiscordEmbeds.getCraftEmbed(interaction.guildId, craftDetails, quantity)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendResearchMessage: async function (interaction, researchDetails) {
        const content = {
            embeds: [DiscordEmbeds.getResearchEmbed(interaction.guildId, researchDetails)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendRecycleMessage: async function (interaction, recycleDetails, quantity, recyclerType) {
        const content = {
            embeds: [DiscordEmbeds.getRecycleEmbed(interaction.guildId, recycleDetails, quantity, recyclerType)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },

    sendBattlemetricsEventMessage: async function (guildId, battlemetricsId, title, description, fields = null, everyone = false) {
        const instance = Client.client.getInstance(guildId);

        const content = {
            embeds: [DiscordEmbeds.getBattlemetricsEventEmbed(guildId, battlemetricsId, title, description, fields)]
        }

        if (everyone) {
            content.content = '@everyone';
        }

        await module.exports.sendMessage(guildId, content, null, instance.channelId.activity);
    },

    sendItemMessage: async function (interaction, itemName, itemId, type) {
        const content = {
            embeds: [DiscordEmbeds.getItemEmbed(interaction.guildId, itemName, itemId, type)],
            ephemeral: true
        }

        await Client.client.interactionEditReply(interaction, content);
    },
}