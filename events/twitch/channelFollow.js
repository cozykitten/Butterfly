export default {
    data: {
        type: 'channel.follow',
        version: '2',
        condition: {
            broadcaster_user_id: "",
            moderator_user_id: ""
        }
    },
    async execute(event) {

        return [{
            eventName: this.data.type,
            timestamp: event.timestamp,
            user: event.user_login
        },
        {
            title: 'New Follower',
            description: `**Follower:** ${event.user_login}`,
            color: 16672622
        }];
    }
}
