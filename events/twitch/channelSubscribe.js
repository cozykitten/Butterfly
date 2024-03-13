export default {
    data: {
        type: 'channel.subscribe',
        name: 'subscribe',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        if (event.is_gift) return;

        return [{
            timestamp: event.timestamp,
            user: event.user_login,
            tier: event.tier
        },
        {
            title: 'New Sub',
            description: `**User:** ${event.user_login}
            **tier:** ${event.tier}`,
            color: 16672622
        }];
    }
}
