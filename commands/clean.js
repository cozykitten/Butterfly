import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { env } from "custom-env";
env();


/**
 * Deletes a message by the id given as interaction option.
 * 
 * @param {ChatInputCommandInteraction} interaction The interaction triggering the command.
 * @returns {Promise <(Message|InteractionResponse)>} 
 */
async function deleteMessageId(interaction) {
    try {
        const m = await interaction.channel.messages.fetch(interaction.options.getString('id'));
        if (m.deletable) {
            const msg = await m.delete();
            return interaction.reply({ content: `Deleted message from ${msg.author.username} <:AriliaSALUT:1150822630283292702>`, ephemeral: true });
        }
        else {
            return interaction.reply({ content: "Sorry, I can't delete this message <:AriliaSAD:1211497594493341836>", ephemeral: true })
        }
    } catch (error) {
        return interaction.reply({ content: "Invalid message id.", ephemeral: true })
    }
}

/**
 * Deletes multiple messages.
 * Depending on the age of the messages this function may use bulkDelete to immediately delete all messages
 * or delete every message iteratively.
 * 
 * @param {ChatInputCommandInteraction} interaction The interaction triggering the command.
 * @returns {Promise<void>}
 */
async function deleteMessageAmount(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let messages;
    if (interaction.options.getUser('user')) {

        messages = await interaction.channel.messages.fetch({ limit: 100, cache: false });
        const id = interaction.options.getUser('user').id;

        messages = messages.filter(function (m) {
            if (this.count < interaction.options.getInteger('amount') && m.author.id === id) {
                this.count++;
                return true;
            }
            return false;
        }, { count: 0 });
    }
    else {
        messages = await interaction.channel.messages.fetch({ limit: interaction.options.getInteger('amount'), cache: false });
    }

    if (messages.size && messages.at(-1).createdTimestamp + 1209000000 > Date.now()) {
        await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply({ content: `Deleted messages.`, ephemeral: true });
        return;
    }

    await interaction.editReply({ content: `Deleting...`, ephemeral: true });
    const deletePromises = messages.map(async (msg) => {
        if (msg.deletable) {
            await msg.delete();
        }
    });
    await Promise.all(deletePromises);
    interaction.editReply({ content: `Deleted messages.`, ephemeral: true });
}

/**
 * Deletes multiple messages from a DM channel.
 * Messages in DM channels cannot be bulk deleted.
 * 
 * @param {ChatInputCommandInteraction} interaction The interaction triggering the command.
 * @returns {Promise<void>}
 */
async function deleteMessageAmountDM(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let messages = await interaction.channel.messages.fetch({ limit: 100, cache: false });
    const id = process.env.CLIENT_ID;
    
    messages = messages.filter(function (m) {
        if (this.count < interaction.options.getInteger('amount') && m.author.id === id) {
            this.count++;
            return true;
        }
        return false;
    }, { count: 0 });
    
    await interaction.editReply({ content: `Deleting...`, ephemeral: true });
    const deletePromises = messages.map(async (msg) => {
        await msg.delete();
    });
    await Promise.all(deletePromises);
    interaction.editReply({ content: `Deleted messages.`, ephemeral: true });
}

export default {
    data: new SlashCommandBuilder()
        .setName('clean')
        .setDescription('clean messages from text channels')
        .addIntegerOption(option => option.setName('amount').setDescription('amount of messages to delete').setMaxValue(100).setMinValue(1))
        .addStringOption(option => option.setName('id').setDescription('message id').setMaxLength(20))
        .addUserOption(option => option.setName('user').setDescription('user mentionable'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(true),

    async execute(interaction) {

        if (interaction.options.getString('id')) {
            await deleteMessageId(interaction);
        }
        else if (interaction.options.getInteger('amount')) {
            if (interaction.inGuild()) {
                await deleteMessageAmount(interaction);     
            }
            else {
                await deleteMessageAmountDM(interaction);
            }
        }
        else return interaction.reply({ content: 'Specify message ID or amount <:AriliaERROR:963144742718291978>', ephemeral: true });
    }
}