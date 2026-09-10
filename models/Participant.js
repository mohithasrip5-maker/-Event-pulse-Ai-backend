const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
    participantId: {
        type: String,
        required: true,
        unique: true
    },

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    eventId: {
        type: String,
        required: true
    },

    registeredAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Participant", participantSchema);