import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { db, sync } from '../src/dbManager';

function createEmbed(interaction) {

    if (!/^#([A-Fa-f0-9]{6})$/i.test(interaction.options.getString('color'))) {
        return false;
    }
    const embed = new EmbedBuilder()
        .setTitle(interaction.options.getString('title'))
        .setDescription(interaction.options.getString('description'))
        .setColor(interaction.options.getString('color'))
        .setImage(interaction.options.getString('image'))
        .setAuthor({ name: interaction.options.getString('author'), iconURL: interaction.options.getString('author_icon') })
        .setFooter({ text: interaction.options.getString('footer'), iconURL: interaction.options.getString('footer_icon') })
        .setThumbnail(interaction.options.getString('thumbnail'));

    interaction.channel.send({ embeds: [embed] });
    return embed;
}

async function editEmbed(interaction) {

    const attrib = ['title', 'description', 'color']
    const attrib_2 = ['image', 'thumbnail'];
    
    attrib.forEach(element => {
        if (interaction.options.getString(element)) {
            db.custom_embed[e_index].embed[element] = interaction.options.getString(element);
        }
    });

    attrib_2.forEach(element => {
        if (interaction.options.getString(element)) {
            db.custom_embed[e_index].embed[element].url = interaction.options.getString(element);
        }
    });
    
    if (interaction.options.getString('author')) {
        db.custom_embed[e_index].embed.author.name = interaction.options.getString('author');
    }
    if (interaction.options.getString('author_icon')) {
        db.custom_embed[e_index].embed.author.icon_url = interaction.options.getString('author_icon');
    }
    if (interaction.options.getString('footer')) {
        db.custom_embed[e_index].embed.footer.text = interaction.options.getString('footer');
    }
    if (interaction.options.getString('footer_icon')) {
        db.custom_embed[e_index].embed.footer.icon_url = interaction.options.getString('footer_icon');
    }
    return db.custom_embed[e_index].embed;
}

async function retrieveIndex(name) {
    if (!db.custom_embed || !db.custom_embed[0]) {
        return false;
    } else {
        const index = await db.custom_embed.findIndex(list => list.name === name);
        if (index === -1) return false;
        else return index;
    }
}

export default {
    data: new SlashCommandBuilder()
		.setName('embed')
		.setDescription('creates, saves and sends embeds')
        .addSubcommand(subcommand => subcommand.setName('create').setDescription('create a new embed')
            .addStringOption(option => option.setName('description').setDescription('embed text').setMaxLength(4096).setRequired(true))
            .addStringOption(option => option.setName('title').setDescription('embed title').setMaxLength(256))
            .addStringOption(option => option.setName('color').setDescription('hex').setMaxLength(7))
            .addStringOption(option => option.setName('image').setDescription('image url'))
            .addStringOption(option => option.setName('author').setDescription('author name').setMaxLength(256))
            .addStringOption(option => option.setName('author_icon').setDescription('icon url'))
            .addStringOption(option => option.setName('footer').setDescription('footer text').setMaxLength(2048))
            .addStringOption(option => option.setName('footer_icon').setDescription('icon url'))
            .addStringOption(option => option.setName('thunbnail').setDescription('image url'))
            .addStringOption(option => option.setName('name').setDescription('save as').setMaxLength(256))
            .addChannelOption(option => option.setName('channel').setDescription('target channel')))
        .addSubcommand(subcommand => subcommand.setName('list').setDescription('display saved embeds'))
        .addSubcommand(subcommand => subcommand.setName('view').setDescription('view a saved embed')
            .addStringOption(option => option.setName('name').setDescription('embed name').setMaxLength(256).setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('send').setDescription('send a saved embed')
            .addStringOption(option => option.setName('name').setDescription('embed name').setMaxLength(256).setRequired(true))
            .addChannelOption(option => option.setName('channel').setDescription('target channel').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('edit').setDescription('edit a saved embed')
            .addStringOption(option => option.setName('name').setDescription('embed name').setMaxLength(256).setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('embed text').setMaxLength(4096))
            .addStringOption(option => option.setName('title').setDescription('embed title').setMaxLength(256))
            .addStringOption(option => option.setName('color').setDescription('hex').setMaxLength(7))
            .addStringOption(option => option.setName('image').setDescription('image url'))
            .addStringOption(option => option.setName('author').setDescription('author name').setMaxLength(256))
            .addStringOption(option => option.setName('author_icon').setDescription('icon url'))
            .addStringOption(option => option.setName('footer').setDescription('footer text').setMaxLength(2048))
            .addStringOption(option => option.setName('footer_icon').setDescription('icon url'))
            .addStringOption(option => option.setName('thunbnail').setDescription('image url')))
        .addSubcommand(subcommand => subcommand.setName('update').setDescription('update a sent embed')
            .addStringOption(option => option.setName('name').setDescription('embed name').setMaxLength(256).setRequired(true))
            .addChannelOption(option => option.setName('channel').setDescription('source channel').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('message id').setMaxLength(20).setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('delete').setDescription('delete a saved embed')
            .addStringOption(option => option.setName('name').setDescription('embed name').setMaxLength(256).setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        if (sub === 'create') {

            const e_embed = createEmbed(interaction);
            if (!e_embed) return interaction.reply({ content: 'Please enter a valid hexadecimal colour code.', ephemeral: true });
            if (interaction.options.getChannel('channel')) {//send to channel

                const sent = await interaction.options.getChannel('channel').send({ embeds: [e_embed] });
                if (sent) interaction.reply({ content: 'embed sent', ephemeral: true });
                else interaction.reply({ content: 'I might not have permissions to send messages in this channel.', ephemeral: true });
            }
            else if (interaction.options.getString('name')) {//save as name
                const index = await db.custom_embed.findIndex(list => list.name === interaction.options.getString('name'));
                if (index === -1) {

                    if (!db.custom_embed || !db.custom_embed[0]) {
                        db.custom_embed = [{
                            name: interaction.options.getString('name'),
                            embed: e_embed,
                        }]
                    } else {
                        db.custom_embed.push({
                            name: interaction.options.getString('name'),
                            embed: e_embed
                        })
                    }
                    sync(db);
                    interaction.reply(`I saved your embed as '${interaction.options.getString('name')}'`);
                }
                else {
                    return interaction.reply(`"${interaction.options.getString('name')}" already exists.\n`);
                }
            }
            else {
                return interaction.reply('You didn\'t select either a channel to send, or a name to save this embed to.');
            }
        }
        else if (sub === 'delete') {

            const i = await retrieveIndex(interaction.options.getString('name'));
            if (i) {
                await db.custom_embed.splice(i, 1);
                sync(db);
                interaction.reply({ content: 'embed deleted', ephemeral: true });
            }
            else return interaction.reply('This embed doesn\'nt exist');
        }
        else if (sub === 'send') {

            const i = await retrieveIndex(interaction.options.getString('name'));
            if (i) {
                const e_embed = await db.custom_embed[i].embed;
                const sent = await interaction.options.getChannel('channel').send({ embeds: [e_embed] });
                if (sent) interaction.reply({ content: 'embed sent', ephemeral: true });
                else interaction.reply('I might not have permissions to send messages in this channel');
            }
            else return interaction.reply('This embed doesn\'nt exist');
        }
        else if (sub === 'view') {

            const i = await retrieveIndex(interaction.options.getString('name'));
            if (i) {
                const e_embed = await db.custom_embed[i].embed;
                interaction.reply({ embeds: [e_embed] });
            }
            else return interaction.reply('This embed doesn\'nt exist');
        }
        else if (sub === 'edit') {

            const i = await retrieveIndex(interaction.options.getString('name'));
            if (i) {
                const e_embed = await editEmbed(interaction)
                sync(db);
                interaction.reply({ content: `I updated ${interaction.options.getString('name')} to`, embeds: [e_embed] });            
            }
            else return interaction.reply("I couldn't find an embed with that name");
        }
        else if (sub === 'update') {

            const i = await retrieveIndex(interaction.options.getString('name'));
            if (i) {
                const e_embed = await db.custom_embed[i].embed;
                const g_channel = interaction.options.getChannel('channel');
                const g_message = await g_channel.messages.fetch(interaction.options.getString('message'));

                g_message.edit({ embeds: [e_embed] });
                interaction.reply({ content: 'embed updated', ephemeral: true });
            }
            else return interaction.reply('This embed doesn\'nt exist');
        }
        else { //must be list
            
            if (!db.custom_embed || !db.custom_embed[0]) {
                return interaction.reply('You didn\'t save any embeds');
            } else {
                const view_embed = new EmbedBuilder()
                    .setTitle('Saved Embeds')
                    .setDescription(`${db.custom_embed.map(embed => embed.name).join('\n')}`)
                    .setColor('#FE676E')
                interaction.reply({ embeds: [view_embed] });
            }
        }
    }
}


