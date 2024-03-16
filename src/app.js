import { Client, IntentsBitField } from "discord.js";
import pm2 from 'pm2';
import fs from 'fs';
import { env } from "custom-env";
env();
import { startup } from './utils/reloadManager.js';
import { db, sync } from './utils/dbManager.js';
import eventSub from './utils/twitchAPI.js';


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
    const onceReady = await import('./utils/onceReady.js');
    onceReady.default(client);
    eventSub.initialize(client);
});


//load events and commands
const eventFiles = fs.readdirSync('./events/discord/').filter(file => file.endsWith('.js'));
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
await startup(eventFiles, commandFiles, client);


//login
async function login() {
    try {
        await client.login(process.env.CLIENT_TOKEN);
    } catch (err) {
        console.error('client login error... retrying in 15 minutes.', err);
        setTimeout(login, 900000);
    }
}
login();


//manual exit
process.on('SIGINT', async () => {
    console.log('\nexiting -.-');
    pm2.disconnect();
    db.lastexit = true;
    try {
        await sync(db);
    } catch (error) {
        console.error(`Error syncing database on SIGINT`, error);
        const home = await client.guilds.fetch(db.HOME);
        const log = await home.channels.fetch(db.LOG);
        await log.send(`Error while syncing the database:\n${error.message}`);
    }
    const wspromise = eventSub.terminate();
    const clientpromise = client.destroy();
    await Promise.all([wspromise, clientpromise]);
    process.exit();
});