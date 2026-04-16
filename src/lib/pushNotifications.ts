import { supabase } from "@/integrations/supabase/client";

// VAPID public key — same as the one stored in secrets
const VAPID_PUBLIC_KEY = "BJFCt8KzuSj06NMzg0Nu0_8jxNskivfaPmBxCQu2PE0wuu3Wf0DT9BJMTAvQOxwbcHDXTwTCcOhI_NA92tVPalE";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isInIframeOrPreview(): boolean {
  try {
    const isIframe = window.self !== window.top;
    const isPreview =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    return isIframe || isPreview;
  } catch {
    return true;
  }
}

export async function getPushPermissionState(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

export async function registerPushSubscription(
  userId: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" };
  }

  if (isInIframeOrPreview()) {
    return { success: false, error: "Push not available in preview" };
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permission denied" };
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw-push.js", {
      scope: "/",
    });

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh = subJson.keys!.p256dh!;
    const auth = subJson.keys!.auth!;

    // Save to database (upsert by user + endpoint)
    const { error: dbError } = await supabase
      .from("browser_push_subscriptions")
      .upsert(
        {
          user_id: userId,
          organization_id: organizationId || null,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );

    if (dbError) {
      console.error("Failed to save push subscription:", dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Push registration error:", err);
    return { success: false, error: err.message };
  }
}

export async function unregisterPushSubscription(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from DB
        await supabase
          .from("browser_push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
      }
    }
  } catch (err) {
    console.error("Push unregister error:", err);
  }
}

export async function checkExistingSubscription(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;
    
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    // Verify it's in DB
    const { data } = await supabase
      .from("browser_push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint", subscription.endpoint)
      .eq("is_active", true)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}
