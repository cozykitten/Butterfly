import { Collection } from 'discord.js';
import { db, sync }from './dbManager.js';
import eventSub from './twitchAPI.js';
import { env } from "custom-env";
env();

export async function startup(eventFiles, commandFiles, client) {
    
    //event handler
    for (const file of eventFiles) {
        const event = await import(`../../events/discord/${file}`);
        const eventName = file.split('.')[0];
        client.on(eventName, (...args) => event.default(...args, client));
    }

    //command handler
    client.commands = new Collection();

    for (const file of commandFiles) {
        const command = await import(`../../commands/${file}`);
        if (command.default.data && command.default.data.name) {
            client.commands.set(command.default.data.name, command.default);
            console.log('loading ' + file);
        }
        else {
            console.error('\x1b[31mError reading ' + file + '\x1b[0m');
        }
    }
}

export async function restartApplication(client) {
    
    console.log('\nrestarting application..');
	db.lastexit = true;
	try {
        await sync(db);
    } catch (error) {
        console.error(`Error syncing database on restart`, error);
        const home = await client.guilds.fetch(db.HOME);
        const log = await home.channels.fetch(db.LOG);
        await log.send(`Error while syncing the database:\n${error.message}`);
    }
	const wspromise = eventSub.terminate();
    const clientpromise = client.destroy();
    await Promise.all([wspromise, clientpromise]);
	process.exit();
}

export async function twitchReconnect(client, restart = true) {
    await eventSub.terminate();
    if (restart) await eventSub.initialize(client);
    return true;
}