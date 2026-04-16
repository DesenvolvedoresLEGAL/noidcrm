import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  isPushSupported,
  isInIframeOrPreview,
  getPushPermissionState,
  registerPushSubscription,
  unregisterPushSubscription,
  checkExistingSubscription,
} from "@/lib/pushNotifications";

export type PushState = "loading" | "unsupported" | "preview" | "prompt" | "subscribed" | "denied";

export function usePushNotifications() {
  const { user, organization } = useCurrentUser();
  const [state, setState] = useState<PushState>("loading");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setState("loading");
      return;
    }

    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }

    if (isInIframeOrPreview()) {
      setState("preview");
      return;
    }

    const check = async () => {
      const permission = await getPushPermissionState();
      if (permission === "denied") {
        setState("denied");
        return;
      }

      if (permission === "granted") {
        const exists = await checkExistingSubscription(user.id);
        setState(exists ? "subscribed" : "prompt");
      } else {
        setState("prompt");
      }
    };

    check();
  }, [user?.id]);

  const subscribe = useCallback(async () => {
    if (!user?.id) return;
    setIsRegistering(true);
    try {
      const result = await registerPushSubscription(user.id, organization?.id);
      if (result.success) {
        setState("subscribed");
      } else {
        if (result.error === "Permission denied") {
          setState("denied");
        }
      }
    } finally {
      setIsRegistering(false);
    }
  }, [user?.id, organization?.id]);

  const unsubscribe = useCallback(async () => {
    if (!user?.id) return;
    await unregisterPushSubscription(user.id);
    setState("prompt");
  }, [user?.id]);

  return { state, subscribe, unsubscribe, isRegistering };
}
