//globals
const urlRegex = /(https?:\/\/[^\s]+)/g;


export default async (message) => {
    if (!message.inGuild()) return;
    const allUrls = message.content.match(urlRegex);
    if (!allUrls) return;
}