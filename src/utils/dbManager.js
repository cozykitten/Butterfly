import { error } from 'console';
import fs from 'fs';

async function readDatabase(file) {
    console.log(`reading ${file}`)

    const fileStats = await fs.promises.stat(`./data/${file}`);
    if (fileStats.size > 100) await fs.promises.copyFile(`./data/${file}`, `./data/${file}.bak`);
    
    const data = await fs.promises.readFile(`./data/${file}`);
    return JSON.parse(data);
}
export const db = await readDatabase('config.json');
export const eventList = await readDatabase('events.json');

/**
 * Saves the provided database to file.
 * 
 * @param {Object} db The database object to write to file.
 * @param {string} name The filename where the database should be written to. Defaults to 'config' if not specified.
 * @returns {Promise<void>}
 */
export async function sync(db, name = 'config') {
    try {
        await fs.promises.writeFile(`./data/${name}.json.tmp`, JSON.stringify(db, null, 2));

        const fileStats = await fs.promises.stat(`./data/${name}.json.tmp`);
        if (fileStats.size < 100) throw new Error(`Error writing ${name}. Syncing aborted.`);

        await fs.promises.rename(`./data/${name}.json.tmp`, `./data/${name}.json`);
    } catch (err) {
        console.error(err);
        throw err;
    }
};