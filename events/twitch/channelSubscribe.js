export default {
    data: {
        type: 'channel.subscribe',
        version: '1',
        condition: {
            broadcaster_user_id: ""
        }
    },
    async execute(event, db) {

        return {
            eventName: this.data.type,
            user: event.user_login,
            timestamp: event.timestamp
        };
    }
}
