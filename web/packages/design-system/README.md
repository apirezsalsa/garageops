# @garageops/design-system

Primitivas de UI reutilizables de GarageOps, extraídas de los patrones visuales ya usados en `src/components` de la app (paleta zinc + acento naranja, bordes `rounded-2xl`/`rounded-3xl`, valores numéricos en `font-mono`, iconos de `lucide-react`).

## Build

```sh
npm install
npm run build
```

Genera `dist/index.js` (ESM), `dist/style.css` (CSS de Tailwind ya compilado) y declaraciones `.d.ts` por componente.

## Componentes

- `Button` — variantes `primary` / `secondary` / `ghost` / `danger`, tamaños `sm` / `md` / `lg`, icono opcional.
- `Card` — contenedor de superficie, con `interactive` (hover) y `highlight` (estado de alerta).
- `Badge` — etiqueta pequeña para estados/contadores, variantes `neutral` / `active` / `success` / `danger`.
- `Input` — campo de texto con `label` y `error` opcionales.
- `NavItem` — ítem de navegación, `layout="sidebar"` (desktop) o `layout="mobile-tab"`.
- `MetricTile` — tile de métrica (título, valor en mono, subtítulo, icono).
- `Modal` — diálogo modal con overlay y botón de cierre.

## Uso

```jsx
import { Button, Card, MetricTile } from '@garageops/design-system';
import '@garageops/design-system/styles.css';
import { Wrench } from 'lucide-react';

function Example() {
  return (
    <Card interactive>
      <MetricTile title="Vehículos" value={12} icon={Wrench} />
      <Button variant="primary">Añadir</Button>
    </Card>
  );
}
```

## Estado

Set inicial de primitivas "core". Los componentes de `src/components` de la app (vistas completas como `DashboardView`, `VehicleDetailView`, etc.) no están migrados aquí todavía — este paquete cubre solo bloques genéricos y reutilizables.

Pensado como fuente para `/design-sync`, que sincroniza este paquete compilado (`dist/`) a claude.ai/design.
