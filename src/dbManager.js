import fs from 'fs';

async function readDatabase(file) {
    const data = await fs.promises.readFile(`./data/${file}`);
    return JSON.parse(data);
}
export const db = await readDatabase('config.json');

export async function sync (db) {
    try {
        await fs.promises.writeFile("./data/config.json", JSON.stringify(db, null, 2));

        const fileStats = await fs.promises.stat('./data/config.json');
        if (fileStats.size > 50) {
            
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
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};