import { apiFetch } from "@/hooks/api";

export interface PushSubscriptionJSON {
    endpoint: string;
    keys?: {
        p256dh: string;
        auth: string;
    };
}

export function pushSupported(): boolean {
    return typeof window !== "undefined"
        && "serviceWorker" in navigator
        && "PushManager" in window
        && "Notification" in window;
}

export function isStandalonePwa(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function getNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
    if (!pushSupported()) return "unsupported";
    return Notification.permission;
}

export async function hasPushSubscription(): Promise<boolean> {
    if (!pushSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
}

export async function enablePushNotifications(): Promise<PushSubscriptionJSON | null> {
    if (!pushSupported()) throw new Error("Push notifications are not supported on this device");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not granted");

    let registration: ServiceWorkerRegistration;
    try {
        registration = await navigator.serviceWorker.ready;
    } catch {
        throw new Error("The Toto service worker is not ready. Reload the installed PWA and try again.");
    }
    const keyResponse = await apiFetch<{ public_key: string }>("/notifications/vapid-public-key");
    if (!keyResponse.public_key) throw new Error("Push notifications are not configured on the server");

    const existing = await registration.pushManager.getSubscription();
    let subscription: PushSubscription;
    try {
        subscription = existing ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(keyResponse.public_key),
        });
    } catch {
        throw new Error("iOS could not create a push subscription. Open Toto from the Home Screen PWA over HTTPS.");
    }

    const json = subscription.toJSON() as PushSubscriptionJSON;
    try {
        await apiFetch("/notifications/subscribe", {
            method: "POST",
            body: JSON.stringify({ subscription: json }),
        });
    } catch {
        throw new Error("The push subscription was created, but Toto could not save it on the server.");
    }
    return json;
}

export async function disablePushNotifications(): Promise<void> {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await apiFetch("/notifications/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
}

export async function sendTestNotification(): Promise<void> {
    await apiFetch("/notifications/test", { method: "POST" });
}

export async function schedulePushNotification(options: {
    title: string;
    body: string;
    runAt: Date;
    url?: string;
    tag: string;
}): Promise<void> {
    await apiFetch("/notifications/schedule", {
        method: "POST",
        body: JSON.stringify({
            title: options.title,
            body: options.body,
            run_at: options.runAt.toISOString(),
            url: options.url ?? "/",
            tag: options.tag,
        }),
    });
}

export async function cancelPushNotification(tag: string): Promise<void> {
    await apiFetch("/notifications/cancel", {
        method: "POST",
        body: JSON.stringify({ tag }),
    });
}

export async function sendPushNotification(options: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}): Promise<void> {
    await apiFetch("/notifications/send", {
        method: "POST",
        body: JSON.stringify({
            title: options.title,
            body: options.body,
            url: options.url ?? "/",
            tag: options.tag,
        }),
    });
}

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return bytes;
}
