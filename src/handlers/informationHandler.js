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

module.exports = {
    handler: async function (rustplus) {
        if (rustplus.informationIntervalCounter === 0) {
            try {
                await DiscordMessages.sendUpdateServerInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateServerInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateEventInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateEventInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateTeamInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateTeamInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateToolCupboardUpkeepInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateToolCupboardUpkeepInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateMarketWatchlistInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateMarketWatchlistInformationMessage failed: ${e}`, 'error');
            }

            try {
                await DiscordMessages.sendUpdateLootInformationMessage(rustplus);
            } catch (e) {
                rustplus.log('Error', `sendUpdateLootInformationMessage failed: ${e}`, 'error');
            }
        }

        if (rustplus.informationIntervalCounter === 5) {
            rustplus.informationIntervalCounter = 0;
        }
        else {
            rustplus.informationIntervalCounter += 1;
        }
    },
}