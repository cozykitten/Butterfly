import { db, sync } from '../../src/dbManager.js';

export default async (interaction) => {

	if (!interaction.isChatInputCommand()) return;

	//log command to lb for crashreport on next start
	db.lastcall = {
		userid: interaction.user.id,
		command: interaction.commandName
	}

	if (interaction.options._subcommand) {
		db.lastcall.subcommand = interaction.options._subcommand
	}

	if (interaction.options._hoistedOptions.length) {

		db.lastcall.options = [];
		for (const iterator of interaction.options._hoistedOptions) {
			const option = {
				name: iterator.name,
				value: iterator.value
			}
			db.lastcall.options.push(option);
		}
	}
	sync(db);

	//execute command
	const command = interaction.client.commands.get(interaction.commandName);
	if (command) command.execute(interaction);

	console.log(`\nCommand: ${interaction.commandName} ${interaction.options._subcommand}`);
	for (const iterator of interaction.options._hoistedOptions) {
		console.log(iterator.name);
	}
}