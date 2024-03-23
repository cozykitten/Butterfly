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

    const embed = {
        title: 'crash report',
        description: 'last exit: unplanned',
        color: 0xc43838
    }
    log.send({ embeds: [embed] });
}