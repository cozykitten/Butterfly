export default async (guild) => {

    const defaultChannel = guild.systemChannel || guild.channels.cache.find(channel => channel.type === 0 && channel.permissionsFor(guild.members.me).has('SEND_MESSAGES'));
    await defaultChannel.send({
        embeds: [
            {
                "title": "BakaBot has joined!",
                "description": "Nice to meet you, this is me:",
                "color": 16672622,
                "author": {
                    "name": "BakaBot",
                    "icon_url": "https://cdn.discordapp.com/avatars/658834271917572129/634285bd084db6323f4bcdcbbf48d6eb.webp"
                },
                "image": {
                    "url": "https://media1.tenor.com/m/YZzqQRajnMYAAAAC/moth2-moth3.gif"
                }
            }
        ]
    });
}