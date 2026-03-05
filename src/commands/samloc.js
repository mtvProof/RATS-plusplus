/*
	Copyright (C) 2023 Alexander Emanuelsson (alexemanuelol)

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

const Constants = require('../util/constants.js');
const DiscordEmbeds = require('../discordTools/discordEmbeds.js');

module.exports = {
	name: 'samloc',

	getData(client, guildId) {
		return new Builder.SlashCommandBuilder()
			.setName('samloc')
			.setDescription(client.intlGet(guildId, 'commandsSamLocDesc'))
			.addSubcommand(subcommand => subcommand
				.setName('add')
				.setDescription(client.intlGet(guildId, 'commandsSamLocAddDesc'))
				.addStringOption(option => option
					.setName('grid')
					.setDescription(client.intlGet(guildId, 'commandsSamLocGridDesc'))
					.setRequired(true)))
			.addSubcommand(subcommand => subcommand
				.setName('list')
				.setDescription(client.intlGet(guildId, 'commandsSamLocListDesc')))
			.addSubcommand(subcommand => subcommand
				.setName('remove')
				.setDescription(client.intlGet(guildId, 'commandsSamLocRemoveDesc'))
				.addStringOption(option => option
					.setName('grid')
					.setDescription(client.intlGet(guildId, 'commandsSamLocGridDesc'))
					.setRequired(true)));
	},

	async execute(client, interaction) {
		const verifyId = Math.floor(100000 + Math.random() * 900000);
		client.logInteraction(interaction, verifyId, 'slashCommand');

		if (!await client.validatePermissions(interaction)) return;
		await interaction.deferReply({ ephemeral: true });

		const rustplus = client.rustplusInstances[interaction.guildId];
		if (!rustplus || (rustplus && !rustplus.isOperational)) {
			const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
			client.log(client.intlGet(null, 'warningCap'), str);
			return;
		}

		const instance = client.getInstance(interaction.guildId);
		const subcommand = interaction.options.getSubcommand();

		if (!instance.samSites) {
			instance.samSites = [];
		}

		if (subcommand === 'add') {
			const grid = interaction.options.getString('grid').toUpperCase();

			if (instance.samSites.includes(grid)) {
				const str = client.intlGet(interaction.guildId, 'samLocAlreadyExists', { grid: grid });
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
				client.log(client.intlGet(null, 'infoCap'), str);
				return;
			}

			instance.samSites.push(grid);
			client.setInstance(interaction.guildId, instance);

			const str = client.intlGet(interaction.guildId, 'samLocAdded', { grid: grid });
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
			client.log(client.intlGet(null, 'infoCap'), str);
		}
		else if (subcommand === 'list') {
			if (instance.samSites.length === 0) {
				const str = client.intlGet(interaction.guildId, 'samLocEmpty');
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
				return;
			}

			const str = client.intlGet(interaction.guildId, 'samLocList', {
				grids: instance.samSites.join(', ')
			});
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
		}
		else if (subcommand === 'remove') {
			const grid = interaction.options.getString('grid').toUpperCase();

			const index = instance.samSites.indexOf(grid);
			if (index === -1) {
				const str = client.intlGet(interaction.guildId, 'samLocNotFound', { grid: grid });
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
				client.log(client.intlGet(null, 'warningCap'), str);
				return;
			}

			instance.samSites.splice(index, 1);
			client.setInstance(interaction.guildId, instance);

			const str = client.intlGet(interaction.guildId, 'samLocRemoved', { grid: grid });
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
			client.log(client.intlGet(null, 'infoCap'), str);
		}

		client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandSuccess', {
			id: `${verifyId}`
		}));
	}
};
