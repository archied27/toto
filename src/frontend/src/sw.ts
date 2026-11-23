/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event: PushEvent) => {
    let data: { title?: string; body?: string; url?: string; tag?: string } = {};
    try {
        data = event.data ? event.data.json() as typeof data : {};
    } catch {
        data = {};
    }

    const title = data.title ?? "Toto";
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body ?? "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        data: { url: data.url ?? "/" },
    }));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close();
    const url = typeof event.notification.data?.url === "string"
        ? event.notification.data.url
        : "/";

    event.waitUntil((async () => {
        const matching = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of matching) {
            if ("navigate" in client) {
                await client.navigate(url);
                await client.focus();
                return;
            }
        }
        await self.clients.openWindow(url);
    })());
});
