import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { env } from "custom-env";
env();
import { restartApplication } from '../src/reloadManager.js';
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
			await interaction.reply({ content: `I'll brb! <:AriliaSALUT:1150822630283292702>`, ephemeral: true});
			restartApplication(interaction.client);
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle('Don\'t leave me Onee-chan <:AriliaSAD:1211497594493341836>')
			.setColor(0xFE676E)
			.setImage('https://raw.githubusercontent.com/cozykitten/Butterfly/master/data/exit_lowres.jpg');
		await interaction.reply({ embeds: [embed] });	
			//await interaction.reply({ content: 'Good night! <:AriliaSLEEP:1033353595405488278>', ephemeral: true});

		pm2.connect(function (err) {
			if (err) {
				console.error(err);
				process.exit(2);
			}
			pm2.stop('Butterfly');
		});
	}
}