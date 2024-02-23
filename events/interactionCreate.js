export default async (interaction) => {

	if (!interaction.isChatInputCommand()) return;

	//execute command
	const command = interaction.client.commands.get(interaction.commandName);
	if (command) command.execute(interaction);

	console.log(`\nCommand: ${interaction.commandName} ${interaction.options._subcommand}`);
	for (const iterator of interaction.options._hoistedOptions) {
		console.log(iterator.name);
	}
}