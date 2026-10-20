self.addEventListener("push", event => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: "New message" };
    }

    const title = payload.title || "New message";
    const options = {
        body: payload.body || "Open Messenger to view your message.",
        icon: "/logo192.png",
        badge: "/favicon.ico",
        tag: payload.tag || "messenger-message",
        data: { url: payload.url || "/messenger" },
        renotify: false
    };

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then(windows => {
                if (windows.some(client => client.visibilityState === "visible")) {
                    return undefined;
                }
                return self.registration.showNotification(title, options);
            })
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const target = new URL(
        event.notification.data?.url || "/messenger",
        self.location.origin
    ).href;

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then(windows => {
                const existing = windows.find(client => client.url.startsWith(self.location.origin));
                if (existing) {
                    return existing.navigate(target).then(() => existing.focus());
                }
                return self.clients.openWindow(target);
            })
    );
});
