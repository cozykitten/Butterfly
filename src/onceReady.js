import { EmbedBuilder } from 'discord.js';
import { env } from "custom-env";
env();
import { db, sync } from './dbManager.js';


export default async (client) => {

    //retrieve channels for messages
    const home = await client.guilds.fetch(db.HOME);
    const log = await home.channels.fetch(db.LOG);

    //checking last exit
    if (!db.lastexit) {
        checkLastExit(log);
    }
    else {
        db.lastexit = false;
        sync(db);
    }
}

/**
 * Retrieves the command data of the last invoked command and posts it in the log channel.
 * @param {Discord.GuildChannel} log The channel to send the app's logs to.
 */
async function checkLastExit(log) {

    const embed = new EmbedBuilder()
        .setTitle('crash report')
        .setColor(0xc43838);

    if (!db.lastcall) {
        embed.data.fields = [{
            name: 'error',
            value: 'No last call information available.',
            inline: true
        }];
        return log.send({ content: "last exit: unplanned", embeds: [embed] });
    }

    if (db.lastcall.subcommand) {
        embed.data.fields = [{
            name: 'command',
            value: db.lastcall.command + ' ' + db.lastcall.subcommand,
            inline: true
        }];
    }
    else {
        embed.data.fields = [{
            name: 'command',
            value: db.lastcall.command,
            inline: true
        }];
    }

    embed.data.fields.push({
        name: 'requested by',
        value: '<@' + db.lastcall.userid + '>',
        inline: true
    });

    if (db.lastcall.options) {
        let options = '';
        for (const i of db.lastcall.options) {
            options = options + i.name + ': ' + i.value + '\n';
        }
        embed.data.fields.push({
            name: 'options',
            value: options
        });
    }
    
    log.send({ content: "last exit: unplanned", embeds: [embed] });
}