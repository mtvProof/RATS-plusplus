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
const Client = require('../../index.ts');

module.exports = {
    handler: async function (rustplus) {
        if (rustplus.isInformationHandlerRunning) return;
        rustplus.isInformationHandlerRunning = true;

        try {
            if (rustplus.informationIntervalCounter === 0) {
                const timeoutMs = 15000;
                const runWithTimeout = async (name, fn) => {
                    try {
                        await Promise.race([
                            fn(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
                        ]);
                    } catch (e) {
                        rustplus.log(Client.client.intlGet(null, 'errorCap'), `${name} failed: ${e}`, 'error');
                    }
                };

                await runWithTimeout('sendUpdateServerInformationMessage',
                    () => DiscordMessages.sendUpdateServerInformationMessage(rustplus));
                await runWithTimeout('sendUpdateEventInformationMessage',
                    () => DiscordMessages.sendUpdateEventInformationMessage(rustplus));
                await runWithTimeout('sendUpdateTeamInformationMessage',
                    () => DiscordMessages.sendUpdateTeamInformationMessage(rustplus));
                await runWithTimeout('sendUpdateToolCupboardUpkeepInformationMessage',
                    () => DiscordMessages.sendUpdateToolCupboardUpkeepInformationMessage(rustplus));
                await runWithTimeout('sendUpdateMarketWatchlistInformationMessage',
                    () => DiscordMessages.sendUpdateMarketWatchlistInformationMessage(rustplus));
                await runWithTimeout('sendUpdateLootInformationMessage',
                    () => DiscordMessages.sendUpdateLootInformationMessage(rustplus));
            }

            if (rustplus.informationIntervalCounter === 5) {
                rustplus.informationIntervalCounter = 0;
            }
            else {
                rustplus.informationIntervalCounter += 1;
            }
        } finally {
            rustplus.isInformationHandlerRunning = false;
        }
    },
}