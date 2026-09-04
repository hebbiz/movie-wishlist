self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch (error) {
    payload = {
      title: "Movie Wishlist",
      body:
        event.data?.text() ||
        "Нова активність",
    };
  }

  const title =
    payload.title || "Movie Wishlist";

  const options = {
    body:
      payload.body ||
      "У ваших списках є нова активність.",

    icon:
      "/assets/icons/android-chrome-192x192.png",

    data: {
      url:
        payload.url || "/app.html",
    },
  };

  const tasks = [];

  if (
    self.navigator &&
    "setAppBadge" in self.navigator
  ) {
    tasks.push(
      self.navigator.setAppBadge(9)
    );
  }

  tasks.push(
    self.registration.showNotification(
      title,
      options
    )
  );

  event.waitUntil(
    Promise.all(tasks)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    "/app.html";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if (
          "focus" in client &&
          client.url.includes("/app.html")
        ) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});
