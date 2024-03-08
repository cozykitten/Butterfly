import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { env } from "custom-env";
env();

export default {
    data: new SlashCommandBuilder()
		.setName('share')
		.setDescription('share a message through dms')
        .addSubcommand(subcommand => subcommand.setName('members').setDescription('share a message with selected members')
            .addStringOption(option => option.setName('message').setDescription('message you want to send').setMaxLength(2000).setRequired(true))
            .addStringOption(option => option.setName('users').setDescription('uids or mentionables').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),

    async execute(interaction) {

        //command may only be used by trusted people
        if (!JSON.parse(process.env.TRUSTED).includes(interaction.user.id)) return interaction.reply('This command is not available for public usage.');
        const users = interaction.options.getString('users').match(/\d+/g);

        const fail = [];
        await interaction.reply({ content: "sending...", ephemeral: true });

        for (const uid of users) {
            const user = await interaction.client.users.fetch(uid);
            try {
                await user.send(interaction.options.getString('message').replace(/\s?\\n\s?/g, "\n"));
            } catch (e) {
                console.error("Cannot send messages to " + user.username);
                fail.push(user.username);
            }
        }

        if (!fail.length) {
            interaction.editReply({ content: "Shared message with " + users.length + " users.", ephemeral: true });
        }
        else {
            interaction.editReply({ content: "Cannot send messages to " + fail.join(', '), ephemeral: true });
        }
    }
}