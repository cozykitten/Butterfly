import fs from 'fs';
import { env } from "custom-env";
env();
import { startup } from './reloadManager.js';
import { Client, IntentsBitField } from "discord.js";


const myIntents = new IntentsBitField();
myIntents.add(
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
    );
const client = new Client({ intents: myIntents });


//do stuff on ready
client.once('ready', () => {
    console.log(`\n\x1b[34mClient has logged in as ${client.user.tag}\x1b[0m`);
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
    await client.destroy();
    process.exit();
});