export default {
    data: {
        type: 'channel.cheer',
        name: 'bits',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        if (event.is_anonymous) return;

        return [{
            timestamp: event.timestamp,
            user: event.user_login,
            amount: event.bits
        },
        {
            title: 'Bits',
            description: `**User:** ${event.user_login}
            **amount:** ${event.bits}`,
            color: 16672622
        }];
    }
}
