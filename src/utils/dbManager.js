import fs from 'fs';

/**
 * Reads the contents of a database file and returns the parsed JSON object.
 * If the file size is greater than 100 bytes, it creates a backup copy of the file before reading.
 * 
 * @param {string} file The name of the database file to read.
 * @returns {Promise<Object>} A promise that resolves to the parsed JSON object from the file.
 * @throws {Error} If an error occurs during file reading or parsing.
 */
async function readDatabase(file) {
    const fileStats = await fs.promises.stat(`./data/${file}`);
    if (fileStats.size > 80) await fs.promises.copyFile(`./data/${file}`, `./data/${file}.bak`);

    const data = await fs.promises.readFile(`./data/${file}`);
    return JSON.parse(data);
}
export const db = await readDatabase('config.json');
export const eventList = await readDatabase('events.json');

/**
 * Saves the provided database to file.
 * Writes the database object to a temporary file, checks the file size, and if valid, renames the temporary file to the actual database file.
 * 
 * @param {Object} db The database object to write to file.
 * @param {string} name The filename where the database should be written to. Defaults to 'config' if not specified.
 * @throws {Error} If an error occurs during write process or if the file size is less than 100 bytes, indicating a failed write operation.
 * @returns {Promise<void>}
 */
export async function sync(db, name = 'config') {
    try {
        await fs.promises.writeFile(`./data/${name}.json.tmp`, JSON.stringify(db, null, 2));

        const fileStats = await fs.promises.stat(`./data/${name}.json.tmp`);
        if (fileStats.size < 80) throw new Error(`Error writing ${name}. Syncing aborted.`);

        await fs.promises.rename(`./data/${name}.json.tmp`, `./data/${name}.json`);
    } catch (err) {
        console.error(err);
        throw err;
    }
};