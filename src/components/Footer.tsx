export function Footer() {
  return (
    <footer className="py-8">
      <div className="container mx-auto px-4">
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>
            Datos orientativos con fines educativos. Consulta la sección de metodología para más
            información sobre fuentes y cálculos.
          </p>
          <p>
            Hecho por{" "}
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
              Código fuente
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
