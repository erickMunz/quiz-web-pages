/*
 * Quiz Practice service worker.
 *
 * Three jobs, all honest:
 *  1. Offline shell: cache the app shell and last-visited pages so the app
 *     opens without a network (static site; data files are same-origin GETs).
 *  2. Notifications with the app icon, and click-to-app routing — including
 *     the scheduled study reminders the page hands off via postMessage.
 *  3. **Web Push from the user's own PC relay** (`push-relay.py`, VAPID keys
 *     outside the repo): `push` events arrive with the app CLOSED — the
 *     Android system displays them; clicking opens the app. This is the
 *     "recordatorio aunque la app no esté abierta" path.
 *
 * Scope is /quiz-web-pages/ (served from the same path). Bump VERSION when
 * the shell list changes; activate() purges older caches.
 */
const VERSION = "quizweb-pwa-v2";
const BASE = "/quiz-web-pages/";

const SHELL = [
  BASE,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigations: network-first with cache fallback (stale shell beats error).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(VERSION)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match(BASE))
        )
    );
    return;
  }

  // Same-origin assets: cache-first, refresh in the background.
  if (new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches
                .open(VERSION)
                .then((c) => c.put(req, copy))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
  }
  // Cross-origin (CDN wasm, fonts): pass through untouched.
});

/** Page hands off a notification (icon + badge + click routing). */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "notify") {
    const { title, body } = event.data;
    try {
      self.registration.showNotification(title, notificationOptions(body));
    } catch {
      // permission not granted (or revoked mid-session): drop silently
    }
  }
});

function notificationOptions(body) {
  return {
    body,
    icon: `${BASE}icons/icon-192.png`,
    badge: `${BASE}icons/maskable-192.png`,
    tag: "quizweb-study",
    renotify: true,
    data: { url: BASE },
  };
}

/** Server-side (relay) Web Push arrives with the app CLOSED. */
self.addEventListener("push", (event) => {
  let title = "Es hora de estudiar";
  let body = "Abre tu tanda de tarjetas y mantén la racha.";
  try {
    if (event.data) {
      const data = event.data.json();
      title = data.title ?? title;
      body = data.body ?? body;
    }
  } catch {
    // non-JSON payload: keep defaults
  }
  event.waitUntil(self.registration.showNotification(title, notificationOptions(body)));
});

/** Clicking the notification opens (or focuses) the app. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if (client.url.indexOf(self.registration.scope) === 0) {
          return client.focus();
        }
      }
      return self.clients.openWindow(self.registration.scope);
    })()
  );
});
