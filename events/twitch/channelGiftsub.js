export default {
    data: {
        type: 'channel.subscription.gift',
        name: 'giftsub',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event) {
        if (event.is_anonymous) return;
        
        return {
            timestamp: event.timestamp,
            user: event.user_name,
            amount: event.total,
            tier: Number(event.tier)
        };
    }
}
