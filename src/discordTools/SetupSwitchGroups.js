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

const DiscordMessages = require('./discordMessages.js');
const DiscordTools = require('./discordTools.js');

module.exports = async (client, rustplus) => {
    const instance = client.getInstance(rustplus.guildId);
    const guildId = rustplus.guildId;

    if (rustplus.isNewConnection) {
        for (const [serverId, server] of Object.entries(instance.serverList)) {
            for (const [groupId, group] of Object.entries(server.switchGroups)) {
                if (group.messageId && group.messageId !== instance.switchGroupsMessageId) {
                    await DiscordTools.deleteMessageById(guildId, instance.channelId.switchGroups, group.messageId);
                }
                instance.serverList[serverId].switchGroups[groupId].messageId = null;
            }
        }
        client.setInstance(guildId, instance);
    }

    await DiscordMessages.sendSwitchGroupsCreateButtonMessage(guildId, rustplus.serverId);

    for (const groupId in instance.serverList[rustplus.serverId].switchGroups) {
        await DiscordMessages.sendSmartSwitchGroupMessage(rustplus.guildId, rustplus.serverId, groupId);
    }
};
