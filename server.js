const express = require("express");
const Activity = require("./models/Activity");
const Alert = require("./models/Alert");
const http = require("http");
const { Server } = require("socket.io");
const Notification = require("./models/Notification");
const PDFDocument = require("pdfkit");
const Feedback = require("./models/Feedback");
const Session = require("./models/Session");
const Attendance = require("./models/Attendance");
const Participant = require("./models/Participant");
const QRCode = require("qrcode");
require("dns").setServers(["8.8.8.8"]);
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const Event = require("./models/Event");
const app = express();
const PORT = 5000;
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000
})
.then(() => {
    console.log("✅ MongoDB Connected");
})
.catch((error) => {
    console.log("❌ MongoDB Connection Failed");
    console.log(error.message);
});
// Middleware
app.use(cors());
app.use(express.json());


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
    res.json({
        project: "EventPulse AI",
        tagline: "Real-Time Event Intelligence & Response System",
        status: "ONLINE"
    });
});
app.get("/api/events", async (req, res) => {
    try {
        const events = await Event.find();

        res.json({
            success: true,
            events
        });

    } catch (error) {
        console.log("Event Fetch Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch events"
        });
    }
});
app.post("/api/events/:eventId/announce", async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findOne({ eventId });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const announcement = {
            eventId: event.eventId,
            eventName: event.name,
            location: event.location,
            date: event.date,
            startTime: event.startTime,
            message: `🚨 ${event.name} is happening at ${event.location}!`
        };

        io.emit("event-announcement", announcement);

        res.json({
            success: true,
            message: "Event announcement broadcasted",
            announcement
        });

    } catch (error) {
        console.log("Announcement Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to announce event"
        });
    }
});
app.post("/api/events", async (req, res) => {
    try {
        const event = new Event(req.body);

        const savedEvent = await event.save();

        res.status(201).json({
            success: true,
            message: "Event created successfully",
            event: savedEvent
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to create event",
            error: error.message
        });
    }
});

app.post("/api/participants", async (req, res) => {
    try {
        const { name, email, phone, eventId } = req.body;

        if (!name || !email || !phone || !eventId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const lastParticipant = await Participant
            .findOne()
            .sort({ registeredAt: -1 });

        let nextNumber = 1;

        if (lastParticipant && lastParticipant.participantId) {
            const number = parseInt(
                lastParticipant.participantId.replace("P", "")
            );

            if (!isNaN(number)) {
                nextNumber = number + 1;
            }
        }

        const participantId =
            "P" + String(nextNumber).padStart(3, "0");

        const participant = new Participant({
            participantId,
            name,
            email,
            phone,
            eventId
        });

        await participant.save();
await Activity.create({
    eventId: participant.eventId,
    participantId: participant.participantId,
    type: "REGISTRATION",
    message: `${participant.name} registered for the event`
});
        res.json({
            success: true,
            message: "Participant registered successfully",
            participant
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});
// ==========================================
// MODULE 1 — EVENT HEALTH SCORE
// ==========================================

app.post("/api/event-health", (req, res) => {

    const {
        attendance,
        capacity,
        queue,
        sessionDelay,
        volunteers,
        safety
    } = req.body;


    // Attendance score
    const attendanceScore =
        Math.min((attendance / capacity) * 100, 100);


    // Capacity score
    let capacityScore;

    const capacityUsage = (attendance / capacity) * 100;

    if (capacityUsage <= 70) {
        capacityScore = 100;
    } else if (capacityUsage <= 85) {
        capacityScore = 85;
    } else if (capacityUsage <= 95) {
        capacityScore = 65;
    } else {
        capacityScore = 30;
    }


    // Queue score
    let queueScore;

    if (queue <= 10) {
        queueScore = 100;
    } else if (queue <= 25) {
        queueScore = 80;
    } else if (queue <= 40) {
        queueScore = 60;
    } else {
        queueScore = 30;
    }


    // Session delay score
    let delayScore;

    if (sessionDelay <= 5) {
        delayScore = 100;
    } else if (sessionDelay <= 10) {
        delayScore = 80;
    } else if (sessionDelay <= 20) {
        delayScore = 60;
    } else {
        delayScore = 30;
    }


    // Volunteer availability score
    const volunteerScore = Math.min(volunteers, 100);


    // Safety score
    const safetyScore = Math.min(safety, 100);


    // Weighted Event Health Score
    const healthScore = Math.round(
        attendanceScore * 0.20 +
        capacityScore * 0.20 +
        queueScore * 0.15 +
        delayScore * 0.15 +
        volunteerScore * 0.10 +
        safetyScore * 0.20
    );


    // Determine status
    let status;

    if (healthScore >= 90) {
        status = "EXCELLENT";
    } else if (healthScore >= 70) {
        status = "STABLE";
    } else if (healthScore >= 50) {
        status = "RISK";
    } else {
        status = "CRITICAL";
    }


    // Send result
    res.json({
        module: "Event Health Score",
        eventHealth: healthScore,
        status: status,

        breakdown: {
            attendance: Math.round(attendanceScore),
            capacity: capacityScore,
            queue: queueScore,
            sessionDelay: delayScore,
            volunteers: volunteerScore,
            safety: safetyScore
        }
    });
});
// ==========================================
// MODULE 2 — CROWD PREDICTION
// ==========================================

app.post("/api/crowd-prediction", (req, res) => {

    const {
        capacity,
        current,
        incoming
    } = req.body;

    // Calculate projected crowd
    const projected = current + incoming;

    // Calculate capacity usage
    const usagePercentage = (projected / capacity) * 100;

    let risk;
    let message;
    let recommendation;

    // Determine risk
    if (usagePercentage > 100) {

        risk = "HIGH";
        message = "Hall is predicted to exceed capacity.";
        recommendation = "Redirect incoming participants and open an alternate hall.";

    } else if (usagePercentage >= 90) {

        risk = "MEDIUM";
        message = "Hall is approaching maximum capacity.";
        recommendation = "Monitor crowd closely and prepare an alternate hall.";

    } else if (usagePercentage >= 75) {

        risk = "LOW";
        message = "Crowd level is increasing.";
        recommendation = "Continue monitoring crowd movement.";

    } else {

        risk = "SAFE";
        message = "Crowd level is within safe limits.";
        recommendation = "No immediate action required.";
    }


    res.json({

        module: "Crowd Prediction",

        capacity: capacity,

        currentCrowd: current,

        incomingCrowd: incoming,

        projectedCrowd: projected,

        capacityUsage: `${usagePercentage.toFixed(1)}%`,

        risk: risk,

        message: message,

        recommendation: recommendation

    });

});
// ==========================================
// QR CODE CHECK-IN
// ==========================================

app.post("/api/checkin/qr", async (req, res) => {
    try {
        const { participantId, eventId } = req.body;

        if (!participantId || !eventId) {
            return res.status(400).json({
                success: false,
                message: "Participant ID and Event ID are required"
            });
        }

        const participant = await Participant.findOne({
            participantId,
            eventId
        });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Invalid QR code or participant"
            });
        }

        const existingAttendance = await Attendance.findOne({
            participantId,
            eventId
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: "Participant already checked in"
            });
        }

        const attendance = new Attendance({
            participantId,
            eventId,
            status: "PRESENT"
        });

        await attendance.save();

        res.json({
            success: true,
            message: "QR Check-in successful!",
            participant: {
                participantId: participant.participantId,
                name: participant.name
            }
        });

    } catch (error) {
        console.error("QR Check-in Error:", error);

        res.status(500).json({
            success: false,
            message: "QR Check-in failed",
            error: error.message
        });
    }
});
app.post("/api/checkin", async (req, res) => {
    try {
        const { participantId, eventId } = req.body;

        if (!participantId || !eventId) {
            return res.status(400).json({
                success: false,
                message: "participantId and eventId are required"
            });
        }

        // Check participant exists
        const participant = await Participant.findOne({
            participantId: participantId,
            eventId: eventId
        });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Invalid participant or event"
            });
        }

        // Prevent duplicate check-in
        const existingAttendance = await Attendance.findOne({
            participantId: participantId,
            eventId: eventId
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: "Participant already checked in",
                attendance: existingAttendance
            });
        }

        // Create attendance
        const attendance = new Attendance({
            participantId,
            eventId
        });

        const savedAttendance = await attendance.save();
// Get event details
const event = await Event.findOne({
    eventId
});

if (event) {
    // Count current attendance
    const currentAttendance = await Attendance.countDocuments({
        eventId
    });

    // Calculate crowd percentage
    const crowdPercentage =
        (currentAttendance / event.capacity) * 100;

    // AI Alert Logic
    let alert = null;

    if (crowdPercentage >= 90) {
        alert = {
            level: "CRITICAL",
            message: "Crowd capacity is critically high",
            action: "Activate emergency crowd control"
        };
    } else if (crowdPercentage >= 75) {
        alert = {
            level: "HIGH",
            message: "Crowd density is increasing",
            action: "Deploy additional volunteers"
        };
    } else if (crowdPercentage >= 50) {
        alert = {
            level: "MEDIUM",
            message: "Crowd is moderately high",
            action: "Monitor entrances and exits"
        };
    }

    // Send real-time alert
    if (alert) {
        io.to(eventId).emit("ai-alert", {
            eventId,
            currentAttendance,
            capacity: event.capacity,
            crowdPercentage: Math.round(crowdPercentage),
            ...alert,
            timestamp: new Date()
        });
    }
}
        res.status(201).json({
            success: true,
            message: "Check-in successful",
            attendance: savedAttendance
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Check-in failed",
            error: error.message
        });
    }
});
app.get("/api/attendance/:participantId", async (req, res) => {
    try {
        const { participantId } = req.params;

        const attendance = await Attendance.find({
            participantId: participantId
        }).sort({
            checkInTime: -1
        });

        res.json({
            success: true,
            attendance
        });

    } catch (error) {
        console.log("Attendance Fetch Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message
        });
    }
});
app.get("/api/attendance", async (req, res) => {
    try {
        const attendance = await Attendance.find().sort({
            checkInTime: -1
        });

        res.json({
            success: true,
            count: attendance.length,
            attendance: attendance
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message
        });
    }
});
app.post("/api/sessions", async (req, res) => {
    try {
        const session = new Session(req.body);
        const savedSession = await session.save();

        res.status(201).json({
            success: true,
            message: "Session created successfully",
            session: savedSession
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to create session",
            error: error.message
        });
    }
});


app.get("/api/sessions", async (req, res) => {
    try {
        const sessions = await Session.find();

        res.json({
            success: true,
            count: sessions.length,
            sessions: sessions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch sessions",
            error: error.message
        });
    }
});
app.post("/api/feedback", async (req, res) => {
    try {
        const feedback = new Feedback(req.body);
        const savedFeedback = await feedback.save();

        res.status(201).json({
            success: true,
            message: "Feedback submitted successfully",
            feedback: savedFeedback
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to submit feedback",
            error: error.message
        });
    }
});


app.get("/api/feedback", async (req, res) => {
    try {
        const feedback = await Feedback.find();

        res.json({
            success: true,
            count: feedback.length,
            feedback
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch feedback",
            error: error.message
        });
    }
});
// ==========================================
// DIGITAL EVENT PASS
// ==========================================

// ============================================================
// DIGITAL EVENT PASS
// ============================================================
app.get("/api/participants/email/:email", async (req, res) => {
    try {
        const { email } = req.params;

        const participant = await Participant.findOne({ email });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Participant not found"
            });
        }

        res.json({
            success: true,
            participant
        });

    } catch (error) {
        console.log("Participant Login Error:", error);

        res.status(500).json({
            success: false,
            message: "Participant login failed"
        });
    }
});
app.get("/api/participants/:participantId/pass", async (req, res) => {
    try {
        const { participantId } = req.params;

        const participant = await Participant.findOne({
            participantId
        });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Participant not found"
            });
        }

        const event = await Event.findOne({
            eventId: participant.eventId
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // QR DATA
        const qrData = JSON.stringify({
            participantId: participant.participantId,
            name: participant.name,
            eventId: participant.eventId
        });

        const qrCode = await QRCode.toDataURL(qrData);

        res.json({
            success: true,

            digitalPass: {
                participantName: participant.name,
                participantId: participant.participantId,
                email: participant.email,
                eventId: participant.eventId,
                eventName: event.name,
                date: event.date,
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location
            },

            qrCode
        });

    } catch (error) {
        console.error("Digital Pass Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to generate digital pass",
            error: error.message
        });
    }
});


// ============================================================
// PROFESSIONAL CERTIFICATE PDF
// ============================================================

app.get("/api/certificate/:participantId/:eventId/pdf", async (req, res) => {

    try {

        const { participantId, eventId } = req.params;

        // ----------------------------------------------------
        // PARTICIPANT
        // ----------------------------------------------------

        const participant = await Participant.findOne({
            participantId,
            eventId
        });

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: "Participant not found"
            });
        }


        // ----------------------------------------------------
        // ATTENDANCE
        // ----------------------------------------------------

        const attendance = await Attendance.findOne({
            participantId,
            eventId
        });


        // ----------------------------------------------------
        // FEEDBACK
        // ----------------------------------------------------

        const feedback = await Feedback.findOne({
            participantId,
            eventId
        });


        // ----------------------------------------------------
        // CERTIFICATE ELIGIBILITY
        // ----------------------------------------------------

        if (!attendance || !feedback) {

            return res.status(400).json({
                success: false,
                message:
                    "Participant is not eligible for certificate"
            });

        }


        // ----------------------------------------------------
        // EVENT
        // ----------------------------------------------------

        const event = await Event.findOne({
            eventId
        });


        // ----------------------------------------------------
        // PDF DOCUMENT
        // ----------------------------------------------------

        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margin: 0
        });


        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `inline; filename="${participantId}-certificate.pdf"`
        );


        doc.pipe(res);


        // ====================================================
        // DESIGN CONSTANTS
        // ====================================================

        const W = 841.89;
        const H = 595.28;

        const navy = "#071A35";
        const blue = "#2457C5";
        const cyan = "#00C6FF";
        const gold = "#D6A84F";
        const lightGold = "#F3E3B3";
        const cream = "#FCFBF7";
        const text = "#263B59";
        const white = "#FFFFFF";


        // ====================================================
        // BACKGROUND
        // ====================================================

        doc.rect(0, 0, W, H)
            .fill(cream);


        // ====================================================
        // PREMIUM BORDER
        // ====================================================

        doc.lineWidth(14)
            .rect(
                8,
                8,
                W - 16,
                H - 16
            )
            .stroke(navy);

        doc.lineWidth(2)
            .rect(
                25,
                25,
                W - 50,
                H - 50
            )
            .stroke(gold);


        // ====================================================
        // INNER ACCENT BORDER
        // ====================================================

        doc.lineWidth(1)
            .rect(
                32,
                32,
                W - 64,
                H - 64
            )
            .stroke(lightGold);


        // ====================================================
        // CORNER DECORATIONS
        // ====================================================

        function drawCorner(x, y, flipX, flipY) {

            doc.save();

            doc.translate(x, y);

            doc.scale(flipX, flipY);

            doc.lineWidth(2)
                .moveTo(0, 0)
                .lineTo(55, 0)
                .lineTo(0, 55)
                .stroke(gold);

            doc.lineWidth(1)
                .moveTo(0, 12)
                .lineTo(35, 12)
                .stroke(blue);

            doc.restore();
        }


        drawCorner(35, 35, 1, 1);
        drawCorner(W - 35, 35, -1, 1);
        drawCorner(35, H - 35, 1, -1);
        drawCorner(W - 35, H - 35, -1, -1);


        // ====================================================
        // EVENTPULSE AI BRAND
        // ====================================================

        doc.font("Helvetica-Bold")
            .fontSize(26)
            .fillColor(navy)
            .text(
                "EventPulse ",
                0,
                55,
                {
                    width: W,
                    align: "center",
                    continued: true
                }
            );

        doc.fillColor(blue)
            .text("AI");


        doc.font("Helvetica")
            .fontSize(9)
            .fillColor(text)
            .text(
                "REAL-TIME EVENT INTELLIGENCE & RESPONSE SYSTEM",
                0,
                88,
                {
                    width: W,
                    align: "center",
                    characterSpacing: 1.5
                }
            );


        // ====================================================
        // TITLE
        // ====================================================

        doc.font("Helvetica-Bold")
            .fontSize(42)
            .fillColor(navy)
            .text(
                "CERTIFICATE",
                0,
                125,
                {
                    width: W,
                    align: "center"
                }
            );


        // ====================================================
        // DECORATIVE TITLE LINE
        // ====================================================

        doc.lineWidth(2)
            .moveTo(225, 181)
            .lineTo(335, 181)
            .stroke(gold);

        doc.lineWidth(2)
            .moveTo(507, 181)
            .lineTo(617, 181)
            .stroke(gold);


        doc.font("Helvetica")
            .fontSize(18)
            .fillColor(blue)
            .text(
                "OF PARTICIPATION",
                0,
                169,
                {
                    width: W,
                    align: "center"
                }
            );


        // ====================================================
        // PRESENTATION TEXT
        // ====================================================

        doc.font("Helvetica")
            .fontSize(13)
            .fillColor(text)
            .text(
                "This certificate is proudly presented to",
                0,
                222,
                {
                    width: W,
                    align: "center"
                }
            );


        // ====================================================
        // PARTICIPANT NAME
        // ====================================================

        doc.font("Helvetica-Bold")
            .fontSize(32)
            .fillColor(navy)
            .text(
                participant.name,
                90,
                250,
                {
                    width: W - 180,
                    align: "center"
                }
            );


        // Name underline

        doc.lineWidth(2)
            .moveTo(285, 296)
            .lineTo(557, 296)
            .stroke(gold);


        // ====================================================
        // PARTICIPATION TEXT
        // ====================================================

        doc.font("Helvetica")
            .fontSize(13)
            .fillColor(text)
            .text(
                "for successfully participating in",
                0,
                318,
                {
                    width: W,
                    align: "center"
                }
            );


        // ====================================================
        // EVENT NAME
        // ====================================================

        const eventName =
            event?.name ||
            "EventPulse AI Event";


        doc.font("Helvetica-Bold")
            .fontSize(21)
            .fillColor(blue)
            .text(
                eventName,
                80,
                342,
                {
                    width: W - 160,
                    align: "center"
                }
            );


        // ====================================================
        // TAGLINE
        // ====================================================

        doc.font("Helvetica")
            .fontSize(11)
            .fillColor(text)
            .text(
                "Innovate  •  Analyze  •  Build a Smarter Tomorrow",
                0,
                375,
                {
                    width: W,
                    align: "center"
                }
            );


        // ====================================================
        // INFORMATION PANEL
        // ====================================================

        doc.roundedRect(
            225,
            405,
            392,
            55,
            10
        )
            .fill("#F4F7FC");


        doc.lineWidth(1)
            .roundedRect(
                225,
                405,
                392,
                55,
                10
            )
            .stroke(lightGold);


        // Participant ID

        doc.font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(text)
            .text(
                "PARTICIPANT ID",
                245,
                416,
                {
                    width: 145,
                    align: "center"
                }
            );


        doc.font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(navy)
            .text(
                participantId,
                245,
                432,
                {
                    width: 145,
                    align: "center"
                }
            );


        // Divider

        doc.lineWidth(1)
            .moveTo(421, 414)
            .lineTo(421, 451)
            .stroke(lightGold);


        // Event ID

        doc.font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(text)
            .text(
                "EVENT ID",
                447,
                416,
                {
                    width: 145,
                    align: "center"
                }
            );


        doc.font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(navy)
            .text(
                eventId,
                447,
                432,
                {
                    width: 145,
                    align: "center"
                }
            );


        // ====================================================
        // CENTRAL SEAL
        // ====================================================

        const sealX = W / 2;
        const sealY = 486;


        doc.circle(
            sealX,
            sealY,
            31
        )
            .fill(gold);


        doc.circle(
            sealX,
            sealY,
            25
        )
            .fill(navy);


        doc.circle(
            sealX,
            sealY,
            19
        )
            .lineWidth(1)
            .stroke(gold);


        doc.font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(white)
            .text(
                "EP",
                sealX - 18,
                sealY - 7,
                {
                    width: 36,
                    align: "center"
                }
            );


        // ====================================================
        // LEFT SIGNATURE
        // ====================================================

        doc.lineWidth(1)
            .moveTo(105, 500)
            .lineTo(255, 500)
            .stroke(gold);


        doc.font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(navy)
            .text(
                "EVENT COORDINATOR",
                105,
                507,
                {
                    width: 150,
                    align: "center"
                }
            );


        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(text)
            .text(
                "EventPulse AI",
                105,
                522,
                {
                    width: 150,
                    align: "center"
                }
            );


        // ====================================================
        // RIGHT SIGNATURE
        // ====================================================

        doc.lineWidth(1)
            .moveTo(587, 500)
            .lineTo(737, 500)
            .stroke(gold);


        doc.font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(navy)
            .text(
                "HEAD OF OPERATIONS",
                587,
                507,
                {
                    width: 150,
                    align: "center"
                }
            );


        doc.font("Helvetica")
            .fontSize(8)
            .fillColor(text)
            .text(
                "EventPulse AI",
                587,
                522,
                {
                    width: 150,
                    align: "center"
                }
            );


        // ====================================================
        // FOOTER
        // ====================================================

        doc.font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(navy)
            .text(
                "SMARTER EVENTS  •  REAL-TIME INTELLIGENCE  •  SAFER TOMORROWS",
                0,
                554,
                {
                    width: W,
                    align: "center",
                    characterSpacing: 1
                }
            );


        // ====================================================
        // FINISH PDF
        // ====================================================

        doc.end();


    } catch (error) {

        console.error(
            "Certificate Error:",
            error
        );

        if (!res.headersSent) {

            res.status(500).json({
                success: false,
                message:
                    "Certificate generation failed",
                error: error.message
            });

        }
    }
});
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

io.on("connection", (socket) => {
    console.log("🔵 Client connected:", socket.id);

    socket.on("join-event", (eventId) => {
        socket.join(eventId);
        console.log(`📡 Client joined event: ${eventId}`);
    });

    socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
    });
});
app.get("/api/live-dashboard/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findOne({ eventId });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        const currentAttendance = await Attendance.countDocuments({
            eventId: eventId
        });

        const crowdPercentage =
            (currentAttendance / event.capacity) * 100;

        let riskLevel = "SAFE";

        if (crowdPercentage >= 90) {
            riskLevel = "CRITICAL";
        } else if (crowdPercentage >= 75) {
            riskLevel = "HIGH";
        } else if (crowdPercentage >= 50) {
            riskLevel = "MEDIUM";
        }

        res.json({
            success: true,
            eventId: event.eventId,
            eventName: event.name,
            capacity: event.capacity,
            currentAttendance,
            crowdPercentage: Number(crowdPercentage.toFixed(2)),
            riskLevel
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
server.listen(PORT, () => {

    console.log("-----------------------------------------");
    console.log("🚀 EventPulse AI");
    console.log("🧠 Event Intelligence Engine");
    console.log("⚡ Real-Time Socket.IO Enabled");
    console.log(`📡 Server running at http://localhost:${PORT}`);
    console.log("-----------------------------------------");

});
// ==========================================
// MODULE 3 — QUEUE RISK
// ==========================================

app.post("/api/queue-risk", (req, res) => {

    const { gates } = req.body;

    if (!gates || gates.length < 2) {
        return res.status(400).json({
            error: "At least 2 gates are required."
        });
    }

    // Find gate with highest queue
    const busiestGate = gates.reduce((max, gate) =>
        gate.queue > max.queue ? gate : max
    );

    // Find gate with lowest queue
    const bestGate = gates.reduce((min, gate) =>
        gate.queue < min.queue ? gate : min
    );

    let risk;
    let recommendation;

    if (busiestGate.queue >= 50) {

        risk = "HIGH";

        recommendation =
            `Redirect participants from ${busiestGate.name} to ${bestGate.name}. Open ${bestGate.name} and dispatch a volunteer.`;

    } else if (busiestGate.queue >= 30) {

        risk = "MEDIUM";

        recommendation =
            `Monitor ${busiestGate.name} and encourage participants to use ${bestGate.name}.`;

    } else {

        risk = "LOW";

        recommendation =
            "Queue levels are currently manageable. Continue monitoring.";
    }

    res.json({

        module: "Queue Risk",

        busiestGate: {
            name: busiestGate.name,
            queue: busiestGate.queue
        },

        recommendedGate: {
            name: bestGate.name,
            queue: bestGate.queue
        },

        risk: risk,

        message:
            `${busiestGate.name} congestion detected.`,

        recommendation: recommendation
    });

});
// ==========================================
// MODULE 4 — ACTION PLANNER
// ==========================================

app.post("/api/action-plan", (req, res) => {

    const {
        problem,
        location,
        severity
    } = req.body;

    let actions = [];

    // Overcrowding
    if (problem === "overcrowding") {

        actions = [
            `Redirect participants from ${location} to an alternate hall`,
            "Open an additional gate",
            "Dispatch the nearest available volunteer",
            "Notify the event coordinator"
        ];
    }

    // Queue congestion
    else if (problem === "queue") {

        actions = [
            `Redirect participants from ${location} to the less crowded gate`,
            "Open an additional entry point",
            "Dispatch a volunteer to manage the queue",
            "Monitor queue growth"
        ];
    }

    // Session delay
    else if (problem === "delay") {

        actions = [
            `Notify participants about the delay at ${location}`,
            "Contact the session coordinator",
            "Adjust the session schedule",
            "Display the updated timing on the event dashboard"
        ];
    }

    // Emergency
    else if (problem === "emergency") {

        actions = [
            `Activate emergency response at ${location}`,
            "Identify the nearest safe exit",
            "Dispatch nearby volunteers",
            "Notify the event coordinator and security team"
        ];
    }

    // Unknown problem
    else {

        actions = [
            "Monitor the situation",
            "Notify the event coordinator",
            "Reassess event conditions"
        ];
    }


    res.json({

        module: "Action Planner",

        problem: problem,

        location: location,

        severity: severity,

        priority:
            severity === "CRITICAL"
                ? "IMMEDIATE"
                : severity === "HIGH"
                ? "URGENT"
                : "NORMAL",

        actions: actions

    });

});
// ==========================================
// MODULE 5 — EMERGENCY RESPONSE
// ==========================================

app.post("/api/emergency-response", (req, res) => {

    const {
        location,
        emergencyType,
        exits,
        volunteers
    } = req.body;

    // For our demo, emergency severity is HIGH
    const severity = "HIGH";

    // Select the recommended exit
    const recommendedExit = exits && exits.length > 0
        ? exits[0]
        : "Exit 2";

    // Select nearest volunteers
    const nearestVolunteers = volunteers
        ? volunteers.slice(0, 3)
        : ["V07", "V12", "V19"];

    const actions = [
        `Activate emergency response at ${location}`,
        `Guide participants towards ${recommendedExit}`,
        `Dispatch volunteers: ${nearestVolunteers.join(", ")}`,
        "Notify event coordinator and security team"
    ];

    res.json({

        module: "Emergency Response",

        emergency: {
            location: location,
            type: emergencyType
        },

        severity: severity,

        recommendedExit: recommendedExit,

        nearestVolunteers: nearestVolunteers,

        actions: actions
    });

});
// ==========================================
// MODULE 6 — CROWD SURGE SIMULATION
// ==========================================

// ==========================================
// LIVE AI CROWD SURGE SIMULATION
// ==========================================

app.post("/api/simulate-crowd-surge", async (req, res) => {
    try {
        const { startCrowd = 0 } = req.body;

        const capacity = 500;

        // Increase crowd by 100 on every simulation click
        const currentAttendance = Math.min(
            startCrowd + 100,
            capacity
        );

        const crowdPercentage =
            Math.round((currentAttendance / capacity) * 100);

        let riskLevel;
        let message;
        let action;

        if (crowdPercentage >= 90) {
            riskLevel = "CRITICAL";
            message = "Crowd capacity is critically high";
            action = "Activate emergency crowd control";
        } else if (crowdPercentage >= 75) {
            riskLevel = "HIGH";
            message = "Crowd density is increasing";
            action = "Deploy additional volunteers";
        } else if (crowdPercentage >= 50) {
            riskLevel = "MEDIUM";
            message = "Crowd is moderately high";
            action = "Monitor entrances and exits";
        } else {
            riskLevel = "SAFE";
            message = "Crowd level is under control";
            action = "Continue monitoring";
        }

        res.json({
            success: true,
            currentAttendance,
            capacity,
            crowdPercentage,
            riskLevel,
            aiAlert: {
                level: riskLevel,
                message,
                action
            }
        });

    } catch (error) {
        console.error("Crowd Simulation Error:", error);

        res.status(500).json({
            success: false,
            message: "Crowd simulation failed",
            error: error.message
        });
    }
});

// ==========================================
// UNIFIED EVENT INTELLIGENCE ENGINE
// ==========================================

app.post("/api/event-intelligence", (req, res) => {

    const {
        hall,
        capacity,
        currentCrowd,
        incomingCrowd,
        queue,
        sessionDelay,
        volunteers,
        safety
    } = req.body;
    // ------------------------------------------
    // INPUT VALIDATION
    // ------------------------------------------

    if (!hall) {
        return res.status(400).json({
            error: "Hall name is required."
        });
    }

    if (
        capacity === undefined ||
        currentCrowd === undefined ||
        incomingCrowd === undefined ||
        queue === undefined ||
        sessionDelay === undefined ||
        volunteers === undefined ||
        safety === undefined
    ) {
        return res.status(400).json({
            error: "All event data fields are required."
        });
    }

    if (capacity <= 0) {
        return res.status(400).json({
            error: "Capacity must be greater than 0."
        });
    }

    if (
        currentCrowd < 0 ||
        incomingCrowd < 0 ||
        queue < 0 ||
        sessionDelay < 0
    ) {
        return res.status(400).json({
            error: "Crowd, queue and delay values cannot be negative."
        });
    }

    if (volunteers < 0 || volunteers > 100) {
        return res.status(400).json({
            error: "Volunteer availability must be between 0 and 100."
        });
    }

    if (safety < 0 || safety > 100) {
        return res.status(400).json({
            error: "Safety score must be between 0 and 100."
        });
    }

    // ------------------------------------------
    // 1. EVENT HEALTH
    // ------------------------------------------

    const attendanceScore =
        Math.min((currentCrowd / capacity) * 100, 100);

    const capacityUsage =
        (currentCrowd / capacity) * 100;

    let capacityScore;

    if (capacityUsage <= 70) {
        capacityScore = 100;
    } else if (capacityUsage <= 85) {
        capacityScore = 85;
    } else if (capacityUsage <= 95) {
        capacityScore = 65;
    } else {
        capacityScore = 30;
    }


    let queueScore;

    if (queue <= 10) {
        queueScore = 100;
    } else if (queue <= 25) {
        queueScore = 80;
    } else if (queue <= 40) {
        queueScore = 60;
    } else {
        queueScore = 30;
    }


    let delayScore;

    if (sessionDelay <= 5) {
        delayScore = 100;
    } else if (sessionDelay <= 10) {
        delayScore = 80;
    } else if (sessionDelay <= 20) {
        delayScore = 60;
    } else {
        delayScore = 30;
    }


    const healthScore = Math.round(
        attendanceScore * 0.20 +
        capacityScore * 0.20 +
        queueScore * 0.15 +
        delayScore * 0.15 +
        volunteers * 0.10 +
        safety * 0.20
    );


    let healthStatus;

    if (healthScore >= 90) {
        healthStatus = "EXCELLENT";
    } else if (healthScore >= 70) {
        healthStatus = "STABLE";
    } else if (healthScore >= 50) {
        healthStatus = "RISK";
    } else {
        healthStatus = "CRITICAL";
    }


    // ------------------------------------------
    // 2. CROWD PREDICTION
    // ------------------------------------------

    const projectedCrowd =
        currentCrowd + incomingCrowd;

    const projectedUsage =
        (projectedCrowd / capacity) * 100;


    let crowdRisk;

    if (projectedCrowd > capacity) {
        crowdRisk = "HIGH";
    } else if (projectedUsage >= 90) {
        crowdRisk = "MEDIUM";
    } else {
        crowdRisk = "LOW";
    }


    // ------------------------------------------
    // 3. QUEUE RISK
    // ------------------------------------------

    let queueRisk;

    if (queue >= 50) {
        queueRisk = "HIGH";
    } else if (queue >= 30) {
        queueRisk = "MEDIUM";
    } else {
        queueRisk = "LOW";
    }


    // ------------------------------------------
    // 4. OVERALL RISK
    // ------------------------------------------

    let overallRisk = "LOW";

    if (
        crowdRisk === "HIGH" ||
        queueRisk === "HIGH" ||
        healthStatus === "CRITICAL"
    ) {
        overallRisk = "HIGH";
    } else if (
        crowdRisk === "MEDIUM" ||
        queueRisk === "MEDIUM" ||
        healthStatus === "RISK"
    ) {
        overallRisk = "MEDIUM";
    }


    // ------------------------------------------
    // 5. ACTION PLANNER
    // ------------------------------------------

    const actions = [];


    if (crowdRisk === "HIGH") {

        actions.push(
            `Redirect participants away from ${hall}`
        );

        actions.push(
            "Open an alternate hall"
        );

        actions.push(
            "Open an additional gate"
        );
    }


    if (queueRisk === "HIGH") {

        actions.push(
            "Redirect participants to a less crowded gate"
        );

        actions.push(
            "Dispatch a volunteer to manage the queue"
        );
    }


    if (sessionDelay > 10) {

        actions.push(
            `Notify participants about the delay at ${hall}`
        );
    }


    if (actions.length === 0) {

        actions.push(
            "Continue monitoring event conditions"
        );
    }


    // ------------------------------------------
    // FINAL AI RESPONSE
    // ------------------------------------------

    res.json({

        project: "EventPulse AI",

        module: "Event Intelligence Engine",

        event: {
            hall: hall
        },

        eventHealth: {
            score: healthScore,
            status: healthStatus
        },

        crowdPrediction: {
            current: currentCrowd,
            incoming: incomingCrowd,
            projected: projectedCrowd,
            capacity: capacity,
            risk: crowdRisk
        },

        queueAnalysis: {
            queue: queue,
            risk: queueRisk
        },

        overallRisk: overallRisk,

        recommendation: actions

    });

});
// ==========================================
// START SERVER
// ==========================================
