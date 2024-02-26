import { Client, IntentsBitField } from "discord.js";
import pm2 from 'pm2';
import fs from 'fs';
import { env } from "custom-env";
env();
import { startup } from './reloadManager.js';
import { db, sync } from './dbManager.js';


const myIntents = new IntentsBitField();
myIntents.add(
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
    );
const client = new Client({ intents: myIntents });


//do stuff on ready
client.once('ready', async () => {
    console.log(`\n\x1b[34mClient has logged in as ${client.user.tag}\x1b[0m`);
    console.log(`Environment is ${process.env.APP_ENVIRONMENT}`);
    const onceReady = await import('./onceReady.js');
    onceReady.default(client);
})


//load events and commands
const eventFiles = fs.readdirSync('./events/').filter(file => file.endsWith('.js'));
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
await startup(eventFiles, commandFiles, client);


//login
async function login() {
    try {
        await client.login(process.env.CLIENT_TOKEN);
    } catch (err) {
        console.error('client login error... retrying in 15 minutes.');
        setTimeout(login, 900000);
    }
}
login();


//manual exit
process.on('SIGINT', async () => {
    console.log('exiting -.-');
    pm2.disconnect();
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
});