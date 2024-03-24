import { Routes, REST } from 'discord.js';
import { env } from "custom-env";
env();

const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN);

for (const iterator of JSON.parse(process.env.GUILD_ID)) {
	rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, iterator), { body: [] })
		.then(() => console.log('Successfully deleted application commands for ' + iterator))
		.catch(() => console.error('\x1b[31mMissing access for ' + iterator + '\x1b[0m'));
}