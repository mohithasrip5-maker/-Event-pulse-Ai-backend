const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true
    },

    participantId: {
        type: String,
        required: true
    },

    type: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Activity", activitySchema);