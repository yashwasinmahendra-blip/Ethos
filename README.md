# Ethos Booking Backend

A simple Node.js + MongoDB booking API for the Ethos People Advisory website.

---

## Files

```
booking-backend/
├── server.js               ← Express API server
├── package.json            ← Dependencies
├── .env.example            ← Environment variable template
└── ethos-booking-page.html ← Updated frontend (wired to the API)
```

---

## Setup

### Step 1 — Install Node.js
If you don't have Node.js installed, download it from https://nodejs.org (choose the LTS version).

Verify it's installed:
```bash
node --version   # should show v18 or higher
npm --version
```

---

### Step 2 — Install dependencies
Open a terminal in the `booking-backend` folder and run:
```bash
npm install
```

This installs: `express`, `mongoose`, `cors`, `dotenv`, and `nodemon`.

---

### Step 3 — Set up MongoDB Atlas

1. Go to https://mongodb.com/atlas and create a free account
2. Create a **free cluster** (M0 Sandbox)
3. Under **Database Access**, create a user with a username and password
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from anywhere (or your specific IP)
5. Click **Connect → Drivers**, select Node.js, and copy the connection string

It will look like:
```
mongodb+srv://myuser:mypassword@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
```

---

### Step 4 — Create your .env file
Copy the example file:
```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real connection string:
```
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abc12.mongodb.net/ethos-bookings?retryWrites=true&w=majority
PORT=3000
```

> ⚠️ Never commit the `.env` file to Git. Add it to `.gitignore`.

---

### Step 5 — Run the server

**For development** (auto-restarts on file changes):
```bash
npm run dev
```

**For production:**
```bash
npm start
```

You should see:
```
✅  Connected to MongoDB Atlas
🚀  Server running at http://localhost:3000
```

---

### Step 6 — Open the frontend
Open `ethos-booking-page.html` in your browser. It will talk to `http://localhost:3000` automatically.

> If you deploy the backend to a different URL (e.g. Railway, Render, Heroku), update the `API_BASE` constant at the top of the `<script>` in `ethos-booking-page.html`.

---

## API Reference

### `GET /api/availability?date=YYYY-MM-DD`
Returns all time slots and whether each is available or booked.

**Example request:**
```
GET http://localhost:3000/api/availability?date=2025-07-15
```

**Example response:**
```json
{
  "success": true,
  "date": "2025-07-15",
  "slots": [
    { "time": "9:00 AM",  "available": true },
    { "time": "10:00 AM", "available": false },
    { "time": "11:00 AM", "available": true },
    ...
  ]
}
```

---

### `POST /api/book`
Creates a booking if the slot is free.

**Request body (JSON):**
```json
{
  "name":     "Jane Doe",
  "email":    "jane@example.com",
  "date":     "2025-07-15",
  "time":     "9:00 AM",
  "services": ["Fractional CHRO Advisory", "Culture & Engagement"]
}
```

**Success response (201):**
```json
{
  "success": true,
  "message": "Booking confirmed!",
  "booking": {
    "id":         "665f3a...",
    "name":       "Jane Doe",
    "email":      "jane@example.com",
    "date":       "2025-07-15",
    "time":       "9:00 AM",
    "services":   ["Fractional CHRO Advisory"],
    "created_at": "2025-07-15T09:00:00.000Z"
  }
}
```

**Error response — slot taken (409):**
```json
{
  "success": false,
  "error": "The 9:00 AM slot on 2025-07-15 is already booked. Please choose another time."
}
```

---

## Time Slots (hardcoded)
```
9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM, 2:00 PM, 3:00 PM, 4:00 PM, 5:00 PM, 6:00 PM
```

To change them, edit the `TIME_SLOTS` array in `server.js`.

---

## Deploying (optional)

Free hosting options:
- **Railway** — https://railway.app (easiest, just connect your GitHub repo)
- **Render** — https://render.com
- **Fly.io** — https://fly.io

After deploying, update `API_BASE` in `ethos-booking-page.html`:
```js
const API_BASE = 'https://your-app.railway.app';
```
