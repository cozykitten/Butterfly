export default {
    data: {
        type: 'channel.cheer',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        if (event.is_anonymous) return;

        return [{
            eventName: this.data.type,
            timestamp: event.timestamp,
            user: event.user_login,
            amount: event.bits
        },
        {
            title: 'Bits',
            description: `**User:** ${event.user_login}\n
            **amount:** ${event.bits}`,
            color: 16672622
        }];
    }
}
