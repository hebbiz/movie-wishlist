self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients.claim()
  );
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
    payload.title ||
    "Movie Wishlist";

  /*
   * Формуємо deep-link.
   *
   * Edge Function уже передає:
   * group_id
   * movie_id
   * activity_id
   * to_status
   */
  const targetUrl =
    new URL(
      payload.url || "/app.html",
      self.location.origin
    );

  if (payload.group_id) {
    targetUrl.searchParams.set(
      "group",
      payload.group_id
    );
  }

  if (payload.to_status) {
    targetUrl.searchParams.set(
      "status",
      payload.to_status
    );
  }

  if (payload.activity_id) {
    targetUrl.searchParams.set(
      "activity",
      payload.activity_id
    );
  }

  if (payload.movie_id) {
    targetUrl.searchParams.set(
      "movie",
      payload.movie_id
    );
  }

  targetUrl.searchParams.set(
    "push",
    "1"
  );

  const options = {
    body:
      payload.body ||
      "У ваших списках є нова активність.",

    icon:
      "/assets/icons/android-chrome-192x192.png",

    data: {
      url:
        targetUrl.pathname +
        targetUrl.search,

      group_id:
        payload.group_id || null,

      movie_id:
        payload.movie_id || null,

      activity_id:
        payload.activity_id || null,

      to_status:
        payload.to_status || null,
    },
  };

  const tasks = [];

  const badgeCount =
    Number(payload.badge_count);

  if (
    "setAppBadge" in self.navigator &&
    Number.isFinite(badgeCount) &&
    badgeCount > 0
  ) {
    tasks.push(
      self.navigator.setAppBadge(
        badgeCount
      )
    );
  }

  if (
    "clearAppBadge" in self.navigator &&
    badgeCount === 0
  ) {
    tasks.push(
      self.navigator.clearAppBadge()
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

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetPath =
      event.notification.data?.url ||
      "/app.html";

    const targetUrl =
      new URL(
        targetPath,
        self.location.origin
      ).href;

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(async (clientList) => {
          /*
           * Якщо Movie Wishlist уже відкритий,
           * використовуємо існуюче PWA-вікно.
           */
          for (const client of clientList) {
            if (
              client.url.includes(
                "/app.html"
              )
            ) {
              try {
                /*
                 * Важливо: focus() самого по собі
                 * недостатньо — треба ще перейти
                 * на deep-link URL.
                 */
                if ("navigate" in client) {
                  const navigatedClient =
                    await client.navigate(
                      targetUrl
                    );

                  if (
                    navigatedClient &&
                    "focus" in navigatedClient
                  ) {
                    return navigatedClient.focus();
                  }
                }

                return client.focus();
              } catch (error) {
                console.warn(
                  "Notification navigation error:",
                  error
                );

                return client.focus();
              }
            }
          }

          /*
           * PWA закритий —
           * відкриваємо deep-link напряму.
           */
          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }

          return null;
        })
    );
  }
);
