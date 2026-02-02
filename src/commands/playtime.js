/*
    Copyright (C) 2026

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

const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds.js');
const Timer = require('../util/timer.js');

module.exports = {
    name: 'playtime',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('playtime')
            .setDescription(client.intlGet(guildId, 'commandsPlaytimeDesc'))
            .addStringOption(option => option
                .setName('query')
                .setDescription(client.intlGet(guildId, 'commandsPlaytimeQueryDesc'))
                .setRequired(true));
    },

    async execute(client, interaction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const rustplus = client.rustplusInstances[interaction.guildId];
        if (!rustplus || !rustplus.isOperational) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        const instance = client.getInstance(interaction.guildId);
        const server = instance.serverList[rustplus.serverId];
        if (!server) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        /* Flush current online players' playtime so it is up-to-date */
        if (rustplus.team && rustplus.team.players) {
            for (const player of rustplus.team.players) {
                player.updateActivePlaytime();
            }
        }

        const query = interaction.options.getString('query').trim();
        const playtimes = server.playerPlaytimes || {};

        if (Object.keys(playtimes).length === 0) {
            const str = client.intlGet(interaction.guildId, 'playtimeNotFound');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        const match = findPlayerMatch(client, rustplus, server, query, playtimes);
        if (!match) {
            const str = client.intlGet(interaction.guildId, 'playtimeNotFound');
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        const formatted = formatPlaytime(match.seconds);
        const message = client.intlGet(interaction.guildId, 'playtimeResult', {
            name: match.name,
            time: formatted
        });

        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, message));
        client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `${query}`
        }));
    }
};

function findPlayerMatch(client, rustplus, server, query, playtimes) {
    const normalizedQuery = query.toLowerCase();

    /* Exact steam ID */
    if (playtimes.hasOwnProperty(query)) {
        return buildMatch(client, rustplus, server, query, playtimes[query]);
    }

    /* Partial steam ID */
    for (const [steamId, seconds] of Object.entries(playtimes)) {
        if (steamId.includes(query)) {
            return buildMatch(client, rustplus, server, steamId, seconds);
        }
    }

    /* Name match from team or battlemetrics cache */
    for (const [steamId, seconds] of Object.entries(playtimes)) {
        const name = getPlayerName(client, rustplus, server, steamId).toLowerCase();
        if (name.includes(normalizedQuery)) {
            return { steamId, name: getPlayerName(client, rustplus, server, steamId), seconds };
        }
    }

    return null;
}

function buildMatch(client, rustplus, server, steamId, seconds) {
    return {
        steamId,
        name: getPlayerName(client, rustplus, server, steamId),
        seconds
    };
}

function getPlayerName(client, rustplus, server, steamId) {
    const teamPlayer = rustplus.team ? rustplus.team.getPlayer(steamId) : null;
    if (teamPlayer && teamPlayer.name) return teamPlayer.name;

    const bmId = server.battlemetricsId;
    if (bmId && client.battlemetricsInstances[bmId] && client.battlemetricsInstances[bmId].players) {
        const bmPlayer = client.battlemetricsInstances[bmId].players[steamId];
        if (bmPlayer && bmPlayer.name) return bmPlayer.name;
    }

    return steamId;
}

function formatPlaytime(seconds) {
    const day = 86400;
    const hour = 3600;
    const minute = 60;

    let remaining = Math.max(0, Math.floor(seconds));

    const days = Math.floor(remaining / day); remaining -= days * day;
    const hours = Math.floor(remaining / hour); remaining -= hours * hour;
    const minutes = Math.floor(remaining / minute); remaining -= minutes * minute;
    const secs = remaining;

    const parts = [];
    if (days) parts.push(`${days}D`);
    if (hours) parts.push(`${hours}Hr`);
    if (minutes) parts.push(`${minutes}Min`);
    if (secs || parts.length === 0) parts.push(`${secs}Sec`);

    return parts.join('');
}
