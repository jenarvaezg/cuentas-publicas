# `ROADMAP.md` es la fuente única de verdad del estado del proyecto

El repo tenía cuatro documentos compitiendo: `ROADMAP.md` (técnico, detallado), `RoadmapSection.tsx` (componente con su propia copia, hoy huérfano), `ROADMAP-TERRITORIAL.md` (duplicado parcial con paths inexistentes) y `REFACTOR_UX_PLAN.md` (plan ya aplicado). El drift entre ellos era inevitable y CLAUDE.md prometía "roadmap visible en la web" sin que el componente estuviera importado.

Decidido: `ROADMAP.md` es el único documento canónico del estado del proyecto (qué hay, qué falta, prioridades). `RoadmapSection.tsx` se reintegra en `App.tsx` como vista pública derivada y debe sincronizarse en el mismo PR que cualquier cambio del MD. `ROADMAP-TERRITORIAL.md` y `REFACTOR_UX_PLAN.md` se archivan o eliminan: el contenido vivo ya está en `ROADMAP.md`.

Consecuencia: regla nueva en `CLAUDE.md` — al cerrar/abrir items del roadmap, actualizar `ROADMAP.md` **y** las dos versiones (es/en) de `RoadmapSection.tsx` en el mismo commit.
