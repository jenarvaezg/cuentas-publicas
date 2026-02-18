import { useData } from "@/hooks/useData";
import { formatDate } from "@/utils/formatters";
import ThemeToggle from "./ThemeToggle";

export function Header() {
  const { meta } = useData();

  return (
    <header className="mb-6 animate-fade-in">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Dashboard Fiscal de España
            </h1>
            <p className="text-lg text-muted-foreground mb-2 text-center">
              Deuda, Pensiones y Gasto Público en Tiempo Real
            </p>
            <p className="text-sm text-muted-foreground/60 text-center">
              Datos del BdE, INE y Seg. Social · Última actualización:{" "}
              {formatDate(meta.lastDownload)}
            </p>
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
