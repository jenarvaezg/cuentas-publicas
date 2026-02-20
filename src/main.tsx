import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { detectInitialLanguage, I18nProvider } from "./i18n/I18nProvider";
import { messages } from "./i18n/messages";

if (typeof window !== "undefined") {
  const lang = detectInitialLanguage();
  const pwaCopy = messages[lang].pwa;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const shouldReload = window.confirm(pwaCopy.updateAvailablePrompt);
      if (shouldReload) {
        void updateSW(true);
      }
    },
    onOfflineReady() {
      console.info(pwaCopy.offlineReadyLog);
    },
  });
}

// biome-ignore lint/style/noNonNullAssertion: root element always exists in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);
