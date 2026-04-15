// ─────────────────────────────────────────
//  Ethos Booking — Express + MongoDB Server
//  with Resend email automation
// ─────────────────────────────────────────
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const cron     = require('node-cron');
const { Resend } = require('resend');
require('dotenv').config();

const app    = express();
const PORT   = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── MIDDLEWARE ───────────────────────────
app.use(cors());
app.use(express.json());

// ─── CONNECT TO MONGODB ───────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅  Connected to MongoDB'))
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── BOOKING SCHEMA ───────────────────────
const bookingSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  email:            { type: String, required: true, trim: true, lowercase: true },
  date:             { type: String, required: true },   // "YYYY-MM-DD"
  time:             { type: String, required: true },   // "9:00 AM"
  services:         { type: [String], default: [] },
  reminderSent:     { type: Boolean, default: false },  // tracks 24hr reminder
  followUpSent:     { type: Boolean, default: false },  // tracks 24hr follow-up
  created_at:       { type: Date,   default: Date.now },
});

const Booking = mongoose.model('Booking', bookingSchema);

// ─── FIXED TIME SLOTS ─────────────────────
const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM',  '2:00 PM',  '3:00 PM', '4:00 PM',
];

// ─── HELPERS ──────────────────────────────
function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

// Formats "2025-07-15" → "Tuesday, 15 July 2025"
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── EMAIL TEMPLATES ──────────────────────

// 1. Customer confirmation
async function sendCustomerConfirmation({ name, email, date, time, services }) {
  const serviceList = services.length
    ? `<p style="margin:0 0 8px"><strong>Services:</strong> ${services.join(', ')}</p>`
    : '';

  await resend.emails.send({
    from:    'Ethos Bookings <onboarding@resend.dev>',   // ← swap to your domain later
    to:      email,
    subject: `Your booking is confirmed — ${formatDate(date)} at ${time}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin:0 0 16px">Booking confirmed</h2>
        <p style="margin:0 0 16px">Hi ${name}, your appointment has been confirmed. Here are your details:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:0 0 24px">
          <p style="margin:0 0 8px"><strong>Date:</strong> ${formatDate(date)}</p>
          <p style="margin:0 0 8px"><strong>Time:</strong> ${time}</p>
          ${serviceList}
        </div>
        <p style="margin:0 0 16px">If you need to reschedule or have any questions, please get in touch.</p>
        <p style="margin:0;color:#666;font-size:14px">— The Ethos Team</p>
      </div>
    `,
  });
  console.log(`📧  Confirmation sent to ${email}`);
}

// 2. Business new booking alert
async function sendBusinessAlert({ name, email, date, time, services }) {
  const serviceList = services.length ? services.join(', ') : 'Not specified';

  await resend.emails.send({
    from:    'Ethos Bookings <onboarding@resend.dev>',   // ← swap to your domain later
    to:      process.env.BUSINESS_EMAIL,
    subject: `New booking — ${name} on ${formatDate(date)} at ${time}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin:0 0 16px">New booking received</h2>
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:0 0 24px">
          <p style="margin:0 0 8px"><strong>Name:</strong> ${name}</p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${email}</p>
          <p style="margin:0 0 8px"><strong>Date:</strong> ${formatDate(date)}</p>
          <p style="margin:0 0 8px"><strong>Time:</strong> ${time}</p>
          <p style="margin:0"><strong>Services:</strong> ${serviceList}</p>
        </div>
        <p style="margin:0;color:#666;font-size:14px">Ethos Booking System</p>
      </div>
    `,
  });
  console.log(`📧  Business alert sent to ${process.env.BUSINESS_EMAIL}`);
}

// 3. 24hr reminder to customer
async function sendReminder({ name, email, date, time }) {
  await resend.emails.send({
    from:    'Ethos Bookings <onboarding@resend.dev>',   // ← swap to your domain later
    to:      email,
    subject: `Reminder — your appointment is tomorrow at ${time}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin:0 0 16px">See you tomorrow</h2>
        <p style="margin:0 0 16px">Hi ${name}, just a reminder that you have an appointment tomorrow:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:0 0 24px">
          <p style="margin:0 0 8px"><strong>Date:</strong> ${formatDate(date)}</p>
          <p style="margin:0"><strong>Time:</strong> ${time}</p>
        </div>
        <p style="margin:0 0 16px">If you need to reschedule, please contact us as soon as possible.</p>
        <p style="margin:0;color:#666;font-size:14px">— The Ethos Team</p>
      </div>
    `,
  });
  console.log(`📧  Reminder sent to ${email}`);
}

// 4. 24hr follow-up to customer
async function sendFollowUp({ name, email, date, time }) {
  await resend.emails.send({
    from:    'Ethos Bookings <onboarding@resend.dev>',   // ← swap to your domain later
    to:      email,
    subject: `Thank you for your appointment, ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin:0 0 16px">Thank you for visiting Ethos</h2>
        <p style="margin:0 0 16px">Hi ${name}, thank you for your appointment yesterday. We hope everything went well.</p>
        <p style="margin:0 0 16px">If you have any feedback or questions, we'd love to hear from you. And if you'd like to book another session, you can do so anytime.</p>
        <p style="margin:0;color:#666;font-size:14px">— The Ethos Team</p>
      </div>
    `,
  });
  console.log(`📧  Follow-up sent to ${email}`);
}

// ─── ROUTES ───────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Ethos Booking API is running 🚀' });
});

// ── GET /api/availability?date=YYYY-MM-DD ──
app.get('/api/availability', async (req, res) => {
  const { date } = req.query;

  if (!date || !isValidDate(date)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid date in YYYY-MM-DD format (e.g. ?date=2025-07-15)',
    });
  }

  try {
    const bookedSlots = await Booking.find({ date }).select('time -_id');
    const bookedTimes = bookedSlots.map((b) => b.time);
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
app.post('/api/book', async (req, res) => {
  const { name, email, date, time, services } = req.body;

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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  try {
    const existing = await Booking.findOne({ date, time });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `The ${time} slot on ${date} is already booked. Please choose another time.`,
      });
    }

    const booking = await Booking.create({
      name,
      email,
      date,
      time,
      services: Array.isArray(services) ? services : [],
    });

    // ── Send emails (non-blocking — don't fail the booking if email fails) ──
    Promise.allSettled([
      sendCustomerConfirmation({ name, email, date, time, services: booking.services }),
      sendBusinessAlert({ name, email, date, time, services: booking.services }),
    ]).then((results) => {
      results.forEach((r) => {
        if (r.status === 'rejected') console.error('Email error:', r.reason);
      });
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

// ─── SCHEDULED JOBS (run every hour) ──────
//  Checks for bookings that need a reminder or follow-up
//  and sends the email if it hasn't been sent yet.

cron.schedule('0 * * * *', async () => {
  console.log('⏰  Running email scheduler...');

  const now   = new Date();
  const today = now.toISOString().split('T')[0];  // "YYYY-MM-DD"

  // Tomorrow's date string
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Yesterday's date string
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  try {
    // ── Send reminders for tomorrow's bookings ──
    const reminders = await Booking.find({ date: tomorrowStr, reminderSent: false });
    for (const booking of reminders) {
      try {
        await sendReminder(booking);
        await Booking.findByIdAndUpdate(booking._id, { reminderSent: true });
      } catch (err) {
        console.error(`Reminder failed for ${booking.email}:`, err.message);
      }
    }

    // ── Send follow-ups for yesterday's bookings ──
    const followUps = await Booking.find({ date: yesterdayStr, followUpSent: false });
    for (const booking of followUps) {
      try {
        await sendFollowUp(booking);
        await Booking.findByIdAndUpdate(booking._id, { followUpSent: true });
      } catch (err) {
        console.error(`Follow-up failed for ${booking.email}:`, err.message);
      }
    }

    if (reminders.length === 0 && followUps.length === 0) {
      console.log('⏰  No emails to send right now.');
    }

  } catch (err) {
    console.error('Scheduler error:', err);
  }
});

// ─── START SERVER ─────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀  Server running at http://localhost:${PORT}`);
});
