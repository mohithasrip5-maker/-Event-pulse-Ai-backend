const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },

    eventId: {
        type: String,
        required: true
    },

    title: {
        type: String,
        required: true
    },

    speaker: {
        type: String,
        required: true
    },

    hall: {
        type: String,
        required: true
    },

    startTime: {
        type: String,
        required: true
    },

    endTime: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Session", sessionSchema);