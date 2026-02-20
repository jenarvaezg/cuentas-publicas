import { useI18n } from "@/i18n/I18nProvider";

export function Footer() {
  const { msg } = useI18n();

  return (
    <footer className="py-8">
      <div className="container mx-auto px-4">
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>{msg.footer.educational}</p>
          <p>
            {msg.footer.madeBy}{" "}
            <a
              href="https://github.com/jenarvaezg"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-primary transition-colors"
            >
              jenarvaezg
            </a>
            {" · "}
            <a
              href="https://github.com/jenarvaezg/cuentas-publicas"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-primary transition-colors"
            >
              {msg.footer.sourceCode}
            </a>
            {" · "}
            <a
              href="/api/v1/index.json"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-primary transition-colors"
            >
              API v1
            </a>
            {" · "}
            <a
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-primary transition-colors"
            >
              {msg.footer.rssUpdates}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
