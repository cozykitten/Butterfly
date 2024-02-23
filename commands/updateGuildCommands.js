import { SlashCommandBuilder, Routes, PermissionFlagsBits } from 'discord.js';
import { REST } from '@discordjs/rest';
import fs from 'fs';
import { env } from "custom-env";
env();

/**
 * Builds a list of commands to register based on the command names given.
 * 
 * @param {string[]} commandFiles List of command names.
 * @param {string[]} modifiedSet Sublist of command names to register.
 * @param {string} setName Name of the sublist of command names.
 * @returns {any[]} Array of commands to register.
 */
async function commandList(commandFiles, modifiedSet, setName) {
    const commands = [];
    for (const file of commandFiles) {
        const command = await import (`../commands/${file}`);
        if (command.default.data && command.default.data.name) {
            if (modifiedSet) {
                if (modifiedSet.includes(command.default.data.name)) {
                    commands.push(command.default.data.toJSON());
                    console.log('reading ' + file);
                } else console.warn('\x1b[33mskipped ' + setName + ' ' + file + '\x1b[0m');
            } else {
                commands.push(command.default.data.toJSON());
                console.log('reading ' + file);
            }
        } else {
            console.error('\x1b[31mError reading ' + file + '\x1b[0m');
        }
    }
    return commands;
}

/**
 * Register application commands for the given guild. 
 * 
 * @param {REST} rest 
 * @param {string} guildID Id of the guild to register.
 * @param {any[]} commands Commands to register, empty array to unregister.
 * @returns {Promise<boolean>} True if successful.
 */
async function register(rest, guildID, commands) {
    let success = false;
   // for (const iterator of JSON.parse(process.env.GUILD_ID)) {
    const iterator = guildID;
        try {
            await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, iterator), { body: commands })

            if (commands.length) console.log('Successfully registered application commands for ' + iterator);
            else console.log('Successfully deleted application commands for ' + iterator);
            success = true;

        } catch (e) {
            console.error('\x1b[31mMissing access for ' + iterator + '\x1b[0m');
        }
 //   }
    return success;
}

/**
 * Register application commands for all guilds added to process.env.GUILD_ID.
 * 
 * @param {REST} rest 
 * @param {any} message Interaction triggering this command to send messages on error.
 * @param {any[]} commands Commands to register, empty array to unregister.
 * @returns {Promise<number>} Count of successfully registered guilds.
 */
async function registerAll(rest, message, commands) {
    let count = 0;
    for (const iterator of JSON.parse(process.env.GUILD_ID)) {
        try {
            await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, iterator), { body: commands })

            if (commands.length) console.log('Successfully registered application commands for ' + iterator);
            else console.log('Successfully deleted application commands for ' + iterator);
            count++;

        } catch (e) {
            console.error('\x1b[31mMissing access for ' + iterator + '\x1b[0m');
            message.channel.send(`Failed registering application commands for ${iterator}`)
        }
    }
    return count;
}

/**
 * Register application commands globally.
 * 
 * @param {REST} rest 
 * @param {any[]} commands Commands to register globally, empty array to unregister.
 * @returns {Promise<boolean>} True if successful.
 */
async function registerGlobal(rest, commands) {
    let success = false;
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })

        if (commands.length) console.log('Successfully registered GLOBAL application commands.');
        else console.log('Successfully deleted GLOBAL application commands.');
        success = true;

    } catch (e) {
        console.error('\x1b[31mError registering GLOBAL application commands.\x1b[0m');
    }
    return success;
}

export default {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('updates application commands')
            .addSubcommand(subcommand => subcommand.setName('guild').setDescription('updates guild level application commands')
            .addBooleanOption(option => option.setName('all').setDescription('update for all saved guilds'))
            .addStringOption(option => option.setName('id').setDescription('target server id').setMaxLength(20)))
        .addSubcommand(subcommand => subcommand.setName('global').setDescription('updates global application commands'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

	async execute(interaction){

        //command may only be used by trusted people
        if (!JSON.parse(process.env.TRUSTED) === interaction.user.id) return interaction.reply('This command is not available for public usage.');
        
        const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN);


        /**
         * @global {string[]} commands registered globally with global setting
         * @commandFiles {string[]} all commands found in ./commands
         */
        const global = ['clean', 'ping'];
        const allCommandFiles = await fs.promises.readdir('./commands/');
        const commandFiles = allCommandFiles.filter(file => file.endsWith('.js'));

        if (interaction.options.getSubcommand() === 'global') {
            const success = await registerGlobal(rest, await commandList(commandFiles, global, 'GLOBAL'));

            if (success) return interaction.reply({ content: `Successfully registered GLOBAL application commands <:AriliaHYPE:1090763681136119818>`, ephemeral: false });
            else return interaction.reply({ content: `Failed registering application commands <:AriliaFINE:963144852432896081>`, ephemeral: false });
        }


        /**
         * @fullCommands Array of commands built from either all commands.
         * @commands Array of commands. Commands present in global are removed.
         */
        const fullCommands = await commandList(commandFiles);
        const commands = fullCommands.filter(e => !new Set(global).has(e.name));

        if (interaction.options.getBoolean('all')) {
            await interaction.reply({ content: 'updating application commands now...', ephemeral: false });

            const count = await registerAll(rest, interaction, commands)

            if (count) interaction.editReply({ content: `Successfully registered application commands for ${count} guilds <:AriliaHYPE:1090763681136119818>`, ephemeral: false });
            else interaction.editReply({ content: `Failed registering application commands <:AriliaFINE:963144852432896081>`, ephemeral: false });

        } else {
            let guildID;
            if (interaction.options.getString('id')) {
                guildID = interaction.options.getString('id');
            } else {
                guildID = interaction.guild.id;
            }
            
            const success = await register(rest, guildID, commands);

            if (success) interaction.reply({ content: `Successfully registered application commands for ${interaction.options.getString('id') ? guildID : 'this guild'} <:AriliaHYPE:1090763681136119818>`, ephemeral: false });
            else interaction.reply({ content: `Failed registering application commands <:AriliaFINE:963144852432896081>`, ephemeral: false });
        }
	}
}