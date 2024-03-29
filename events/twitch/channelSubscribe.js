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

        return {
            timestamp: event.timestamp,
            user: event.user_name,
            tier: Number(event.tier)
        };
    }
}
