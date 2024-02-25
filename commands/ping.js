import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ping Kokomi'),
	async execute(interaction){
		
		const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });
		const botLatency = (sent.createdTimestamp - interaction.createdTimestamp) + 'ms';
		let apiLatency = interaction.client.ws.ping;
		if (apiLatency < 0) {
			apiLatency = 'unavailable';
		}
		else{
			apiLatency += 'ms';
		}

		const embed = new EmbedBuilder()
			.setTitle('Ping')
			.setColor(0xFE676E)
			.addFields({ 
				name: 'Latency',
				value: botLatency,
				inline: true
			},
			{
				name: 'API Latency',
				value: apiLatency,
				inline: true
			});
			interaction.editReply({ content: '', embeds: [embed] });
	}
}