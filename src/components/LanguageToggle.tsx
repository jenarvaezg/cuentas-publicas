import { useI18n } from "@/i18n/I18nProvider";

export function LanguageToggle() {
  const { lang, setLang, msg } = useI18n();

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="language-toggle" className="text-xs text-muted-foreground whitespace-nowrap">
        {msg.language.label}
      </label>
      <select
        id="language-toggle"
        value={lang}
        onChange={(event) => setLang(event.target.value as "es" | "en")}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="es">{msg.language.es}</option>
        <option value="en">{msg.language.en}</option>
      </select>
    </div>
  );
}
