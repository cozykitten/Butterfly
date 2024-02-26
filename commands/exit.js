import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { env } from "custom-env";
env();
import { restartApplication } from '../src/reloadManager';
import pm2 from 'pm2';


export default {
    data: new SlashCommandBuilder()
		.setName('exit')
		.setDescription('Ariri goes to sleep')
		.addIntegerOption(option => option.setName('option').setDescription('restart application').addChoices(
			{ name: 'restart', value: 2 }
		))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {

		if (!JSON.parse(process.env.TRUSTED).includes(interaction.user.id)) return interaction.reply('This command is not available for public usage.');

		if (interaction.options.getInteger('option') === 2) {
			await interaction.reply({ content: `I'll brb! <:AriliaSALUTE:1021920065802739752>`, ephemeral: true});
			restartApplication(interaction.client);
			return;
		}

		await interaction.reply({ content: 'Good night! <:AriliaSLEEP:1038896867305603122>', ephemeral: true});

		pm2.connect(function (err) {
			if (err) {
				console.error(err);
				process.exit(2);
			}
			pm2.stop('ecosystem.config.js');
		});
	}
}