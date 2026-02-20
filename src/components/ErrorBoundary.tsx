import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { type AppLanguage, messages } from "@/i18n/messages";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

function detectBoundaryLanguage(): AppLanguage {
  if (
    typeof document !== "undefined" &&
    document.documentElement.lang.toLowerCase().startsWith("en")
  ) {
    return "en";
  }
  return "es";
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const errorCopy = messages[detectBoundaryLanguage()].errors;
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">{errorCopy.boundaryTitle}</h1>
            <p className="text-muted-foreground">{errorCopy.boundaryDescription}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              {errorCopy.boundaryReload}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
