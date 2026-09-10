const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true
    },

    participantId: {
        type: String,
        default: null
    },

    title: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    type: {
        type: String,
        default: "INFO"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Notification", notificationSchema);