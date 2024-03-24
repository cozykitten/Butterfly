import { SlashCommandBuilder } from 'discord.js';
import { db } from '../src/utils/dbManager.js';
import { env } from "custom-env";
env();

export default {
    data: new SlashCommandBuilder()
        .setName('clip')
        .setDescription('add a twitch clip')
        .addStringOption(option => option.setName('url').setDescription('clip url').setRequired(true))
        .addIntegerOption(option => option.setName('category').setDescription('choose the main category').setMaxValue(3).setMinValue(0).setRequired(true)
            .addChoices(
                { name: 'Funny', value: 0 },
                { name: 'Sussy', value: 1 },
                { name: 'Cute', value: 2 },
                { name: 'Other', value: 3 }
            ))
        .setDMPermission(false),
    
    async execute(interaction) {

        const channelIds = db[interaction.guild.id].clipChannels;
        const urlRegex = /(https:\/\/(?:clips.|www.)?twitch.tv\/[^\s]+)/;
        const firstUrl = interaction.options.getString('url').match(urlRegex)[0];

        if (!firstUrl) return interaction.reply({ content: "It clearly says **twitch clip** yk?.", ephemeral: true });

        try {
            const channel = interaction.guild.channels.cache.get(channelIds[interaction.options.getInteger('category')]);
            if (!channel) throw new Error(`Channel doesn't exist.`);
            await channel.send({ content: firstUrl });
            return interaction.reply({ content: "Thamks <:AriliaFLOWER:1211088057260974181>", ephemeral: true });
        } catch (err) {
            console.error(`\x1b[31mError sending twitch clip to ${channelIds[interaction.options.getInteger('category')]}:\x1b[0m`, err.message);
            return interaction.reply({ content: `I can't access this channel, please bug Crup about it. <:AriliaLOST:1220776744756187245>`, ephemeral: true });
        }
    }
}