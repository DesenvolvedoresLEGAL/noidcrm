// NOID CRM Push Notification Service Worker
// This file must be at the root of the public directory

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "NOID CRM", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: data.tag || "noid-notification",
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Dispensar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || "NOID CRM", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const actionUrl = event.notification.data?.action_url || "/app/dashboard";
  const urlToOpen = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(urlToOpen);
    })
  );
});
