import { Collection } from 'discord.js';
import { db, sync }from './dbManager';
import { env } from "custom-env";
env();

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

export async function restartApplication() {
    
    console.log('restarting application..');
	db.lastexit = true;
	try {
        await sync(db);
    } catch (error) {
        const home = await client.guilds.fetch(db.HOME);
        const log = await home.channels.fetch(db.LOG);
        await log.send(`Error while syncing the database:\n${error.message}`);
    }
	await client.destroy();
	process.exit();
}