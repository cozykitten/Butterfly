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
        if (event.is_anonymous || event.bits < 100) return;

        return {
            timestamp: event.timestamp,
            user: event.user_name,
            amount: event.bits
        };
    }
}
