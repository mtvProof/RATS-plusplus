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
	name: 'code',

	getData(client, guildId) {
		return new Builder.SlashCommandBuilder()
			.setName('code')
			.setDescription(client.intlGet(guildId, 'commandsCodeDesc'))
			.addSubcommand(subcommand => subcommand
				.setName('add')
				.setDescription(client.intlGet(guildId, 'commandsCodeAddDesc'))
				.addStringOption(option => option
					.setName('code')
					.setDescription(client.intlGet(guildId, 'commandsCodeAddCodeDesc'))
					.setRequired(true)))
			.addSubcommand(subcommand => subcommand
				.setName('remove')
				.setDescription(client.intlGet(guildId, 'commandsCodeRemoveDesc'))
				.addStringOption(option => option
					.setName('code')
					.setDescription(client.intlGet(guildId, 'commandsCodeRemoveCodeDesc'))
					.setRequired(true)))
			.addSubcommand(subcommand => subcommand
				.setName('show')
				.setDescription(client.intlGet(guildId, 'commandsCodeShowDesc')))
	},

	async execute(client, interaction) {
		const verifyId = Math.floor(100000 + Math.random() * 900000);
		client.logInteraction(interaction, verifyId, 'slashCommand');

		if (!await client.validatePermissions(interaction)) return;
		await interaction.deferReply({ ephemeral: true });

		switch (interaction.options.getSubcommand()) {
			case 'add': {
				await addCode(client, interaction);
			} break;

			case 'remove': {
				await removeCode(client, interaction);
			} break;

			case 'show': {
				await showCode(client, interaction);
			} break;

			default: {
			} break;
		}

		client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
			id: `${verifyId}`,
			value: `${interaction.options.getSubcommand()} ${interaction.options.getString('code')}`
		}));
	},
};

async function addCode(client, interaction) {
	const guildId = interaction.guildId;
	const instance = client.getInstance(guildId);

	if (!instance.baseCodes) {
		instance.baseCodes = { main: null, secondary: null };
	}

	const codeParameter = interaction.options.getString('code');

	if (!instance.baseCodes.main) {
		instance.baseCodes.main = codeParameter;
		client.setInstance(guildId, instance);

		const str = client.intlGet(guildId, 'codeMainWasAdded', { code: codeParameter });
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
		client.log(client.intlGet(guildId, 'infoCap'), str);

		// Update information channel
		await require('../discordTools/discordMessages.js').sendUpdateServerInformationMessage(
			client.rustplusInstances[guildId]
		);
		return;
	}
	else if (!instance.baseCodes.secondary) {
		instance.baseCodes.secondary = codeParameter;
		client.setInstance(guildId, instance);

		const str = client.intlGet(guildId, 'codeSecondaryWasAdded', { code: codeParameter });
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
		client.log(client.intlGet(guildId, 'infoCap'), str);

		// Update information channel
		await require('../discordTools/discordMessages.js').sendUpdateServerInformationMessage(
			client.rustplusInstances[guildId]
		);
		return;
	}
	else {
		const str = client.intlGet(guildId, 'codeBothAlreadyExist');
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
		client.log(client.intlGet(guildId, 'warningCap'), str);
		return;
	}
}

async function removeCode(client, interaction) {
	const guildId = interaction.guildId;
	const instance = client.getInstance(guildId);

	if (!instance.baseCodes) {
		instance.baseCodes = { main: null, secondary: null };
	}

	const codeParameter = interaction.options.getString('code');

	if (instance.baseCodes.main === codeParameter) {
		instance.baseCodes.main = null;
		client.setInstance(guildId, instance);

		const str = client.intlGet(guildId, 'codeMainWasRemoved');
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
		client.log(client.intlGet(guildId, 'infoCap'), str);

		// Update information channel
		await require('../discordTools/discordMessages.js').sendUpdateServerInformationMessage(
			client.rustplusInstances[guildId]
		);
		return;
	}
	else if (instance.baseCodes.secondary === codeParameter) {
		instance.baseCodes.secondary = null;
		client.setInstance(guildId, instance);

		const str = client.intlGet(guildId, 'codeSecondaryWasRemoved');
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
		client.log(client.intlGet(guildId, 'infoCap'), str);

		// Update information channel
		await require('../discordTools/discordMessages.js').sendUpdateServerInformationMessage(
			client.rustplusInstances[guildId]
		);
		return;
	}
	else {
		const str = client.intlGet(guildId, 'codeCouldNotBeFound');
		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
		client.log(client.intlGet(guildId, 'warningCap'), str);
		return;
	}
}

async function showCode(client, interaction) {
	const guildId = interaction.guildId;
	const instance = client.getInstance(guildId);

	if (!instance.baseCodes) {
		instance.baseCodes = { main: null, secondary: null };
	}

	const title = client.intlGet(guildId, 'baseCodes');
	const mainFieldName = client.intlGet(guildId, 'main');
	const secondaryFieldName = client.intlGet(guildId, 'secondary');

	const mainValue = instance.baseCodes.main || client.intlGet(guildId, 'notSet');
	const secondaryValue = instance.baseCodes.secondary || client.intlGet(guildId, 'notSet');

	const embed = DiscordEmbeds.getEmbed({
		color: Constants.COLOR_DEFAULT,
		title: title,
		description: `**${mainFieldName}:** \`${mainValue}\`\n**${secondaryFieldName}:** \`${secondaryValue}\``
	});

	await client.interactionEditReply(interaction, { embeds: [embed] });
}
