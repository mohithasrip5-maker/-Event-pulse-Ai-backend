const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true
    },

    name: {
        type: String,
        required: true
    },

    date: {
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
    },

    location: {
        type: String,
        required: true
    },

    capacity: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model("Event", eventSchema);