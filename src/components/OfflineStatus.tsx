import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

function getInitialOnlineStatus() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function OfflineStatus() {
  const { msg } = useI18n();
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 border-y border-amber-400/30 bg-amber-100/90 px-4 py-2 text-center text-xs font-medium text-amber-900 backdrop-blur dark:bg-amber-900/40 dark:text-amber-100">
      {msg.common.realtimeOffline}
    </div>
  );
}
