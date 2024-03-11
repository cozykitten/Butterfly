export default {
    data: {
        type: 'channel.follow',
        version: '2',
        condition: {
            broadcaster_user_id: "",
            moderator_user_id: ""
        }
    },
    async execute(event, db) {

        //do something with event data

        return {
            eventName: this.data.type,
            user: event.user_login,
            timestamp: event.timestamp
        };
    }
}
