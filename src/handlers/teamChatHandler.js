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
const DiscordVoice = require('../discordTools/discordVoice.js');

module.exports = async function (rustplus, client, message) {
    // Don't relay bot-generated messages to Discord (messages starting with the trademark)
    // These are system messages from the bot itself
    const trademark = rustplus.generalSettings.trademark;
    const isBotMessage = message.steamId.toString() === rustplus.playerId || 
                         (trademark !== 'NOT SHOWING' && message.message.startsWith(trademark));
    
    if (!isBotMessage) {
        // Send message to Discord (only player messages, not bot messages)
        await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);
    }

    // Auto TTS if enabled
    const instance = client.getInstance(rustplus.guildId);
    if (instance.generalSettings.autoTtsEnabled) {
        // Don't TTS bot messages
        if (message.steamId.toString() !== rustplus.playerId) {
            const ttsMessage = `${message.name} said: ${message.message}`;
            await DiscordVoice.sendDiscordVoiceMessage(rustplus.guildId, ttsMessage);
        }
    }

    // Track message in statistics database
    if (client.statisticsTracker) {
        try {
            client.statisticsTracker.trackChatMessage(
                rustplus.guildId,
                rustplus.serverId,
                message.steamId.toString(),
                message.name,
                message.message
            );
        } catch (error) {
            rustplus.log('ERROR', `Failed to track chat message: ${error.message}`);
        }
    }

    // Broadcast to WebUI in real-time
    if (client.webServer) {
        client.webServer.broadcastChatMessage(rustplus.guildId, {
            server_id: rustplus.serverId,
            steam_id: message.steamId.toString(),
            player_name: message.name,
            message: message.message,
            timestamp: Math.floor(Date.now() / 1000)
        });
    }
}