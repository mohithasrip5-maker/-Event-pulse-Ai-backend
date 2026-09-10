const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    participantId: {
        type: String,
        required: true
    },

    eventId: {
        type: String,
        required: true
    },

    checkInTime: {
        type: Date,
        default: Date.now
    },

    status: {
        type: String,
        default: "PRESENT"
    }
});

module.exports = mongoose.model("Attendance", attendanceSchema);