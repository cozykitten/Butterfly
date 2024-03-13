export default {
    data: {
        type: 'channel.hype_train.end',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        const subs = event.top_contributions.find(contribution => contribution.type === 'subscription');
        const bits = event.top_contributions.find(contribution => contribution.type === 'bits');

        const description = `**Level:** ${event.level}\n
        **Most Bits donated:** ${bits.user_login}\n
        **Bits count:** ${bits.total}\n
        **Most Subs gifted:** ${subs.user_login}\n
        **Subs count:** ${subs.total}`;

        return [
            {
                eventName: this.data.type,
                timestamp: event.timestamp,
                level: event.level,
                bitsUser: bits.user_login,
                bitsCount: bits.total,
                subUser: subs.user_login,
                subCount: subs.total
            },
            {
                title: 'Hypetrain',
                description: description,
                color: 16672622
            }
        ];
    }
}
