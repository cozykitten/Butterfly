import { Collection } from 'discord.js';

export async function startup(eventFiles, commandFiles, client) {
    
    //event handler
    for (const file of eventFiles) {
        const event = await import(`../events/${file}`);
        const eventName = file.split('.')[0];
        client.on(eventName, (...args) => event.default(...args, client));
    }

    //command handler
    client.commands = new Collection();

    for (const file of commandFiles) {
        const command = await import(`../commands/${file}`);
        if (command.default.data && command.default.data.name) {
            client.commands.set(command.default.data.name, command.default);
            console.log('loading ' + file);
        }
        else {
            console.error('\x1b[31mError reading ' + file + '\x1b[0m');
        }
    }
}