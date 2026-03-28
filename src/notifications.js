// ─── Push Notifications ───────────────────────────────────────
// Client-side scheduler using setTimeout/setInterval.
// Notifications fire while the app is open.
// Background push would require a VAPID server (future feature).

// ─── Permission ───────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ─── DND check ────────────────────────────────────────────────
// Returns true if current time is within Do Not Disturb hours.
// Handles overnight ranges (e.g. 21:00 → 07:00).
function isDndActive(reminders) {
  if (!reminders?.dndEnabled) return false;
  const start = reminders.dndStart || "21:00";
  const end   = reminders.dndEnd   || "07:00";
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  // Overnight range wraps midnight
  if (s > e) return cur >= s || cur < e;
  return cur >= s && cur < e;
}

// Store reminders config so sendNotification can check DND
let _reminders = {};
export function setRemindersRef(r) { _reminders = r || {}; }

// ─── Send a notification ──────────────────────────────────────
export function sendNotification(title, body, icon) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (isDndActive(_reminders)) return; // silenced by DND
  if (!icon) icon = (window.__wbBase || "/") + "icon-192.png";
  try {
    new Notification(title, { body, icon, badge: icon, vibrate: [200, 100, 200] });
  } catch {
    console.warn("Notification blocked");
  }
}

// ─── Generic repeating reminder ──────────────────────────────
const activeTimers = new Map();

export function scheduleReminder(id, title, body, intervalMs) {
  cancelReminder(id);
  const timer = setInterval(() => sendNotification(title, body), intervalMs);
  activeTimers.set(id, timer);
}

export function cancelReminder(id) {
  if (activeTimers.has(id)) {
    clearInterval(activeTimers.get(id));
    activeTimers.delete(id);
  }
}

export function cancelAllReminders() {
  activeTimers.forEach(t => clearInterval(t));
  activeTimers.clear();
}

// ─── Time-based daily scheduler (nap + medicine) ─────────────
// Schedules a one-time alert for the next occurrence of HH:MM,
// then repeats every 24 hours.
const dailyTimers = new Map();

export function cancelDailyTimers(prefix) {
  [...dailyTimers.keys()]
    .filter(k => k.startsWith(prefix))
    .forEach(k => {
      const t = dailyTimers.get(k);
      clearTimeout(t.timeout);
      if (t.interval) clearInterval(t.interval);
      dailyTimers.delete(k);
    });
}

function scheduleDailyAlert(id, timeStr, title, body) {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const msUntil = target - now;

  const timeout = setTimeout(() => {
    sendNotification(title, body);
    const interval = setInterval(() => sendNotification(title, body), 24 * 60 * 60 * 1000);
    dailyTimers.set(id, { timeout: null, interval });
  }, msUntil);

  dailyTimers.set(id, { timeout, interval: null });
}

// ─── Nap reminders ───────────────────────────────────────────
export function cancelNapReminders() { cancelDailyTimers("nap_"); }

export function scheduleNapReminders(napTimes = [], babyName = "baby") {
  cancelNapReminders();
  napTimes.forEach((timeStr, i) => {
    scheduleDailyAlert(
      `nap_${i}`,
      timeStr,
      "😴 Nap time!",
      `It's ${timeStr} — time for ${babyName}'s nap!`
    );
  });
}

// ─── Medicine reminders ───────────────────────────────────────
export function cancelMedicineReminders() { cancelDailyTimers("med_"); }

export function scheduleMedicineReminders(medicineTimes = [], babyName = "baby") {
  cancelMedicineReminders();
  medicineTimes.forEach((timeStr, i) => {
    scheduleDailyAlert(
      `med_${i}`,
      timeStr,
      "💊 Medicine time!",
      `Time to give ${babyName} their medicine.`
    );
  });
}

// ─── Main sync ────────────────────────────────────────────────
export function syncReminders(data, reminders) {
  const { feedingEnabled, feedingMins = 180 } = reminders;
  const babyName = data?.baby?.name || "baby";

  // Store ref for DND checks
  setRemindersRef(reminders);

  // Feeding interval
  if (feedingEnabled) {
    scheduleReminder(
      "feeding",
      "🍼 Feeding reminder",
      `It's been ${Math.round(feedingMins / 60)} hour${feedingMins >= 120 ? "s" : ""}. Time to feed ${babyName}!`,
      feedingMins * 60 * 1000
    );
  } else {
    cancelReminder("feeding");
  }

  // Medicine — custom times
  if (reminders.medicineEnabled && (reminders.medicineTimes || []).length > 0) {
    scheduleMedicineReminders(reminders.medicineTimes, babyName);
  } else {
    cancelMedicineReminders();
  }

  // Nap — custom times (also handled via scheduleNapReminders from App.jsx)
  if (reminders.napEnabled && (reminders.napTimes || []).length > 0) {
    scheduleNapReminders(reminders.napTimes, babyName);
  } else {
    cancelNapReminders();
  }
}
