import fs from 'fs';

async function readDatabase(file) {
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
        await fs.promises.writeFile(`./data/${name}.json`, JSON.stringify(db, null, 2));
        if (name !== 'config') return;

        const fileStats = await fs.promises.stat('./data/config.json');
        if (fileStats.size < 50) return;

        for (let index = 2; index >= 0; index--) {
            try {
                if (index === 2) {
                    await fs.promises.rm(`./data/config-${index}.bak`);
                } else {
                    await fs.promises.rename(`./data/config-${index}.bak`, `./data/config-${index + 1}.bak`);
                }
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }
        }

        await fs.promises.copyFile('./data/config.json', './data/config-0.bak');
    } catch (err) {
        console.error(err);
        throw err;
    }
};