import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { env } from "custom-env";
env();

//TODO: add modChannel to .envs

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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),

    async execute(interaction) {

        const channelIds = ['1210715769697206329', '1210715769697206330', '1210715769697206331', '1210715769965383760'];

        const urlRegex = /(https:\/\/(?:clips.|www.)?twitch.tv\/[^\s]+)/;
        const firstUrl = interaction.options.getString('url').match(urlRegex)[0];
        console.log(firstUrl)

        if (!firstUrl) interaction.reply({ content: "It clearly says **twitch clip** yk?.", ephemeral: true });

        try {
            const channel = await interaction.guild.channels.cache.get(channelIds[interaction.options.getInteger('category')]);
            await channel.send({ content: firstUrl });
            return interaction.reply({ content: "Thamks <:AriliaFLOWER:1211088057260974181>", ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "I can't access this channel, please bug Crup about it.", ephemeral: true });
        }
    }
}