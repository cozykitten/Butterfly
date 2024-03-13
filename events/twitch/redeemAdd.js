export default {
    data: {
        type: 'channel.channel_points_custom_reward_redemption.add',
        version: '1',
        condition: {
            broadcaster_user_id: "",
            reward_id: ""
        }
    },
    async execute(event) {
        if (event.status !== 'fulfilled') return;

        return [{
            eventName: 'channel.redeem',
            timestamp: event.timestamp,
            user: event.user_login,
            title: event.reward.title
        },
        {
            title: 'New Redeem',
            description: `**User:** ${event.user_login}\n
            **Redeem:** ${event.reward.title}`,
            color: 16672622
        }];
    }
}
