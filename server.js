// ─────────────────────────────────────────
//  Ethos Booking — Express + MongoDB Server
// ─────────────────────────────────────────
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────
app.use(cors());               // allow requests from your frontend
app.use(express.json());       // parse JSON request bodies

// ─── CONNECT TO MONGODB ───────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅  Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── BOOKING SCHEMA ───────────────────────
const bookingSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, trim: true, lowercase: true },
  date:       { type: String, required: true },   // stored as "YYYY-MM-DD"
  time:       { type: String, required: true },   // stored as "9:00 AM"
  services:   { type: [String], default: [] },    // optional: track which services
  created_at: { type: Date,   default: Date.now },
});

const Booking = mongoose.model('Booking', bookingSchema);

// ─── FIXED TIME SLOTS ─────────────────────
const TIME_SLOTS = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
];

// ─── HELPERS ──────────────────────────────

// Basic YYYY-MM-DD validation
function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

// ─── ROUTES ───────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Ethos Booking API is running 🚀' });
});

// ── GET /api/availability?date=YYYY-MM-DD ──
//    Returns which slots are free/booked for a given date
app.get('/api/availability', async (req, res) => {
  const { date } = req.query;

  if (!date || !isValidDate(date)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid date in YYYY-MM-DD format (e.g. ?date=2025-07-15)',
    });
  }

  try {
    // Find all bookings for this date
    const bookedSlots = await Booking.find({ date }).select('time -_id');
    const bookedTimes = bookedSlots.map((b) => b.time);

    // Build slot list with availability flag
    const slots = TIME_SLOTS.map((time) => ({
      time,
      available: !bookedTimes.includes(time),
    }));

    res.json({ success: true, date, slots });
  } catch (err) {
    console.error('availability error:', err);
    res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

// ── POST /api/book ──────────────────────────
//    Creates a booking if the slot is still free
app.post('/api/book', async (req, res) => {
  const { name, email, date, time, services } = req.body;

  // ── Validate required fields ──
  if (!name || !email || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, email, date, and time are all required.',
    });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD (e.g. 2025-07-15).',
    });
  }

  if (!TIME_SLOTS.includes(time)) {
    return res.status(400).json({
      success: false,
      error: `Invalid time slot. Choose one of: ${TIME_SLOTS.join(', ')}`,
    });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  try {
    // ── Check if slot is already taken ──
    const existing = await Booking.findOne({ date, time });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `The ${time} slot on ${date} is already booked. Please choose another time.`,
      });
    }

    // ── Save the booking ──
    const booking = await Booking.create({
      name,
      email,
      date,
      time,
      services: Array.isArray(services) ? services : [],
    });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed!',
      booking: {
        id:         booking._id,
        name:       booking.name,
        email:      booking.email,
        date:       booking.date,
        time:       booking.time,
        services:   booking.services,
        created_at: booking.created_at,
      },
    });
  } catch (err) {
    console.error('booking error:', err);
    res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

// ─── START SERVER ─────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀  Server running at http://localhost:${PORT}`);
});
