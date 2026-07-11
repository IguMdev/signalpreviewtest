self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || "Telesignal";
      const options = {
        body: data.body || "",
        icon: data.icon || "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1,
        },
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error("Erro ao fazer parse do push payload", e);
      event.waitUntil(
        self.registration.showNotification("Notificação Telesignal", {
          body: event.data.text(),
          icon: "/favicon.ico",
        })
      );
    }
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
