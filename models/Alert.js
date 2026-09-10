const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true
    },

    level: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    action: {
        type: String,
        required: true
    },

    currentAttendance: {
        type: Number,
        required: true
    },

    capacity: {
        type: Number,
        required: true
    },

    crowdPercentage: {
        type: Number,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Alert", alertSchema);