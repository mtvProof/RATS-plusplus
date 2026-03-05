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

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    for (const trackerId in instance.trackers) {
        const tracker = instance.trackers[trackerId];
        
        // Check if message still exists in the trackers channel
        if (tracker.messageId && instance.channelId.trackers) {
            const message = await DiscordTools.getMessageById(guild.id, instance.channelId.trackers, tracker.messageId);
            
            // If message exists, update it instead of recreating
            if (message) {
                await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
                // Add delay between tracker updates to avoid Discord rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
        }
        
        // Only send new message if messageId doesn't exist or message was deleted
        await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
        // Add delay between tracker updates to avoid Discord rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send the "Create Tracker" button to the trackers channel
    await DiscordMessages.sendTrackersCreateButtonMessage(guild.id);
}