export default {
    data: {
        type: 'channel.channel_points_custom_reward_redemption.add',
        name: 'redeem',
        version: '1',
        condition: {
            broadcaster_user_id: "",
            reward_id: ""
        }
    },
    async execute(event) {
        if (event.status !== 'fulfilled') return;

        return [{
            timestamp: event.timestamp,
            user: event.user_login,
            title: event.reward.title
        },
        {
            title: 'New Redeem',
            description: `**User:** ${event.user_login}
            **Redeem:** ${event.reward.title}`,
            color: 16672622
        }];
    }
}
