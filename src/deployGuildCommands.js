import { Routes, REST } from 'discord.js';
import fs from 'fs';
import { env } from "custom-env";
env();

const commands = [];
const allCommandFiles = await fs.promises.readdir('./commands/');
const commandFiles = allCommandFiles.filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = await import (`../commands/${file}`);
	if (command.default.data && command.default.data.name) {
		commands.push(command.default.data.toJSON());
		console.log('loading ' + file);
    } else {
		console.error('\x1b[31mError reading ' + file + '\x1b[0m');
	}
}

const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN);
register();

async function register() {
	const guildId = JSON.parse(process.env.GUILD_ID)[0];
	try {
		await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands })

		if (commands.length) console.log('Successfully registered application commands for ' + guildId);
		else console.log('Successfully deleted application commands for ' + guildId);

	} catch (e) {
		console.error('\x1b[31mMissing access for ' + guildId + '\x1b[0m');
	}
}