// ─── Push Notifications ───────────────────────────────────────
// Uses the browser Notifications API + a lightweight in-app
// scheduler. No server required — reminders fire client-side
// via setTimeout/setInterval so they work even without a push
// server, as long as the app is open.
//
// For background notifications (when app is closed), a full
// Web Push server + VAPID keys would be needed. That's a future
// enhancement. For now: in-app reminders that fire while the
// app is open, with a "grant permission" prompt.

// ─── Permission ───────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ─── Send a notification ──────────────────────────────────────
export function sendNotification(title, body, icon) {
  if (!icon) icon = (window.__wbBase || "/") + "icon-192.png";
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon, badge: icon, vibrate: [200, 100, 200] });
  } catch {
    // Some browsers block Notification constructor in service worker context
    console.warn("Notification blocked");
  }
}

// ─── Reminder Scheduler ───────────────────────────────────────
// Stores active reminder timers so we can cancel them on cleanup.
const activeTimers = new Map();

/**
 * Schedule a repeating reminder.
 * @param {string} id        — Unique ID (e.g. "feeding_reminder")
 * @param {string} title     — Notification title
 * @param {string} body      — Notification body
 * @param {number} intervalMs — How often to fire (in milliseconds)
 */
export function scheduleReminder(id, title, body, intervalMs) {
  cancelReminder(id); // cancel any existing timer with this id
  const timer = setInterval(() => sendNotification(title, body), intervalMs);
  activeTimers.set(id, timer);
}

/**
 * Cancel a reminder by ID.
 */
export function cancelReminder(id) {
  if (activeTimers.has(id)) {
    clearInterval(activeTimers.get(id));
    activeTimers.delete(id);
  }
}

/**
 * Cancel all active reminders.
 */
export function cancelAllReminders() {
  activeTimers.forEach((timer) => clearInterval(timer));
  activeTimers.clear();
}

// ─── Smart Reminder Logic ─────────────────────────────────────
/**
 * Given the app data and reminder settings, sync all active reminders.
 * Call this whenever settings change.
 *
 * @param {object} data     — Full app data
 * @param {object} reminders — { feedingEnabled, feedingMins, medicineEnabled }
 */
export function syncReminders(data, reminders) {
  const { feedingEnabled, feedingMins = 180, medicineEnabled } = reminders;

  // Feeding reminder
  if (feedingEnabled) {
    scheduleReminder(
      "feeding",
      "🍼 Feeding reminder",
      `It's been ${Math.round(feedingMins / 60)} hour${feedingMins >= 120 ? "s" : ""}. Time to feed ${data?.baby?.name || "baby"}!`,
      feedingMins * 60 * 1000
    );
  } else {
    cancelReminder("feeding");
  }

  // Medicine reminder — fires once per hour if enabled
  if (medicineEnabled) {
    scheduleReminder(
      "medicine",
      "💊 Medicine check",
      `Don't forget to check ${data?.baby?.name || "baby"}'s medication schedule.`,
      60 * 60 * 1000
    );
  } else {
    cancelReminder("medicine");
  }
}

// ─── Nap Reminder Scheduler ───────────────────────────────────
// Schedules daily-style nap reminders at specific times.
// Since we can't persist across app restarts without a push server,
// we check the current time and schedule the next occurrence today.

const napTimers = new Map();

/**
 * Cancel all nap reminders.
 */
export function cancelNapReminders() {
  napTimers.forEach(t => clearTimeout(t));
  napTimers.clear();
}

/**
 * Schedule nap reminders for a list of HH:MM time strings.
 * Each reminder fires once today if it hasn't passed yet,
 * then repeats every 24h from that point.
 */
export function scheduleNapReminders(napTimes = [], babyName = "baby") {
  cancelNapReminders();
  napTimes.forEach((timeStr, idx) => {
    const [h, m] = timeStr.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (target <= now) target.setDate(target.getDate() + 1);
    const msUntil = target - now;
    const timer = setTimeout(() => {
      sendNotification(
        "😴 Nap time!",
        `It's ${timeStr} — time for ${babyName}'s nap!`
      );
      // Reschedule every 24 hours
      const daily = setInterval(() => {
        sendNotification("😴 Nap time!", `It's ${timeStr} — time for ${babyName}'s nap!`);
      }, 24 * 60 * 60 * 1000);
      napTimers.set(`nap_${idx}_daily`, daily);
    }, msUntil);
    napTimers.set(`nap_${idx}`, timer);
  });
}
