export default {
    data: {
        type: 'channel.hype_train.end',
        name: 'hypetrain',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        const subs = event.top_contributions.find(contribution => contribution.type === 'subscription');
        const bits = event.top_contributions.find(contribution => contribution.type === 'bits');

        let description = `**Level:** ${event.level}`;
        let entry = { timestamp: event.timestamp, level: event.level };
        
        if (subs) {
            description += `\n**Most Subs gifted:** ${subs.user_login}
            **Subs count:** ${subs.total}`;
            entry.subUser = subs.user_login;
            entry.subCount = subs.total;
        }
        if (bits) {
            description += `\n**Most Bits donated:** ${bits.user_login}
            **Bits count:** ${bits.total}`;
            entry.bitUser = bits.user_login;
            entry.bitCount = bits.total;
        }

        return [
            entry,
            {
                title: 'Hypetrain',
                description: description,
                color: 16672622
            }
        ];
    }
}
