require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*', // In production, set to your Netlify URL
  methods: ['GET', 'POST', 'DELETE']
}));

// ── VAPID KEYS ──────────────────────────────────────────────────────
// These are set in .env or Render environment variables
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@daygrid.app';

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('❌ Missing VAPID keys! Run: node generate-keys.js');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// ── IN-MEMORY SUBSCRIPTION STORE ────────────────────────────────────
// In production you'd use a DB, but this persists as long as server runs
// Users re-subscribe on page load anyway
let subscriptions = {}; // { userId: { subscription, tasks, intervalMin, reminderOn } }

// ── ROUTES ──────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'DayGrid backend running ✅', subscribers: Object.keys(subscriptions).length });
});

// Get VAPID public key (frontend needs this to subscribe)
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// Subscribe to push notifications
app.post('/subscribe', (req, res) => {
  const { userId, subscription, tasks, intervalMin, reminderOn } = req.body;

  if (!userId || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing userId or subscription' });
  }

  subscriptions[userId] = {
    subscription,
    tasks: tasks || [],
    intervalMin: intervalMin || 60,
    reminderOn: reminderOn !== false,
    lastNotified: null
  };

  console.log(`✅ Subscribed: ${userId} | interval: ${intervalMin}min | tasks: ${tasks?.length}`);
  res.json({ success: true, message: 'Subscribed to push notifications' });
});

// Update tasks (called whenever user adds/completes a task)
app.post('/update-tasks', (req, res) => {
  const { userId, tasks, grid, intervalMin, reminderOn } = req.body;
  if (!userId || !subscriptions[userId]) {
    return res.status(404).json({ error: 'User not subscribed' });
  }
  subscriptions[userId].tasks = tasks || [];
  subscriptions[userId].grid = grid || [];
  subscriptions[userId].intervalMin = intervalMin || 60;
  subscriptions[userId].reminderOn = reminderOn !== false;
  res.json({ success: true });
});

// Unsubscribe
app.delete('/unsubscribe/:userId', (req, res) => {
  delete subscriptions[req.params.userId];
  res.json({ success: true });
});

// Send test notification immediately
app.post('/test-notify/:userId', async (req, res) => {
  const user = subscriptions[req.params.userId];
  if (!user) return res.status(404).json({ error: 'Not subscribed' });
  try {
    await sendPush(user.subscription, {
      title: '🔔 DayGrid Test',
      body: 'Notifications are working! You\'ll get reminders even when the app is closed.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'daygrid-test'
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Test push failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PUSH HELPER ─────────────────────────────────────────────────────
async function sendPush(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

// ── CRON: Check every minute, fire based on each user's interval ────
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const [userId, user] of Object.entries(subscriptions)) {
    if (!user.reminderOn) continue;

    // Fire at exact interval boundaries (e.g. every 60 mins = 0,60,120...)
    if (nowMin % user.intervalMin !== 0) continue;

    // Don't double-fire in same minute
    const lastKey = `${now.toDateString()}-${nowMin}`;
    if (user.lastNotified === lastKey) continue;
    user.lastNotified = lastKey;

    // Get pending tasks
    const tasks = user.tasks || [];
    const grid = user.grid || [];
    const pending = tasks.filter((_, i) => {
      const cell = grid.find(c => c && c.taskIdx === i);
      return !cell || !cell.done;
    });

    if (pending.length === 0) continue;

    const taskList = pending.slice(0, 3).map(t => `• ${t.name}`).join('\n');
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    try {
      await sendPush(user.subscription, {
        title: `⏰ DayGrid — ${timeStr}`,
        body: `${pending.length} task${pending.length > 1 ? 's' : ''} pending:\n${taskList}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'daygrid-reminder',
        renotify: true,
        data: { url: '/' }
      });
      console.log(`📬 Notified ${userId}: ${pending.length} pending tasks`);
    } catch (e) {
      console.error(`Failed to notify ${userId}:`, e.message);
      // If subscription is expired/invalid, remove it
      if (e.statusCode === 410 || e.statusCode === 404) {
        console.log(`Removing expired subscription: ${userId}`);
        delete subscriptions[userId];
      }
    }
  }
});

// ── START ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 DayGrid backend running on port ${PORT}`);
  console.log(`📊 VAPID public key loaded: ${VAPID_PUBLIC?.slice(0, 20)}...`);
});
