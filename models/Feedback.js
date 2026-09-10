const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
    participantId: {
        type: String,
        required: true
    },

    eventId: {
        type: String,
        required: true
    },

    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    comment: {
        type: String,
        default: ""
    },

    submittedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Feedback", feedbackSchema);