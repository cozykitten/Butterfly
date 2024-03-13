export default {
    data: {
        type: 'channel.subscription.message',
        name: 'subscribe',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {

        return [{
            timestamp: event.timestamp,
            user: event.user_login,
            tier: event.tier
        },
        {
            title: 'Resub',
            description: `**User:** ${event.user_login}
            **tier:** ${event.tier}`,
            color: 16672622
        }];
    }
}
