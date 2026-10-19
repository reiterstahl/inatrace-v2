# INATrace v2

Frontend nuevo para INATrace sobre el backend existente (Java/Spring, sin cambios). Iniciativa
propia de Rolando Quirós, separada de los contratos GIZ. Plan completo en
[docs/PLAN.md](docs/PLAN.md); estado y pendientes en [docs/AVANCE.md](docs/AVANCE.md).

La v2 vive bajo `/v2/` y **convive** con la interfaz actual: un proxy reparte las rutas en un
mismo dominio, así que la sesión es la misma en las dos. Los módulos se migran de a uno.

| Módulo | Estado |
|---|---|
| Cimientos (sesión compartida, cliente de API, diseño, idiomas, CI) | ✅ |
| Vitrina pública del producto (QR) | ✅ |
| Productores y parcelas · Stock · Empresa · Productos | En la versión actual |

## Desarrollo

```bash
pnpm install
pnpm dev:simulado    # sin backend: MSW responde con un producto de ejemplo
pnpm dev             # contra un backend real (INATRACE_API, ver .env.ejemplo)
```

- Modo simulado: vitrina en `http://localhost:5173/v2/p-cd/demo/QR-DEMO-2026`;
  ingreso con `demo@inatrace.local` / `demo1234`.
- `pnpm api:actualizar` baja la especificación OpenAPI del backend y regenera el cliente tipado.
- `pnpm i18n:importar` reutiliza las traducciones de la interfaz actual (alemán y kinyarwanda).

## Pruebas

```bash
pnpm lint && pnpm test && pnpm e2e        # tipos, unitarias y de punta a punta (modo simulado)
pnpm exec playwright test -c playwright.real.config.ts   # contra una instalación real (ver e2e-real/)
```

## Despliegue

- **Imagen:** `ghcr.io/reiterstahl/inatrace-v2` (CI la publica desde `main` si pasan las pruebas).
  nginx sin privilegios en el puerto 8080, con CSP estricta.
- **Convivencia:** `deploy/convivencia/` (proxy nginx + compose). `/v2/` → v2, `/api/` →
  backend, el resto → interfaz actual. La redirección de los QR ya impresos (`/p-cd/…` →
  `/v2/p-cd/…`) está lista pero comentada: se activa cuando se decida.
- **Datos de demostración:** `scripts/sembrar-demo.mjs` crea por la API una acción "generar QR",
  un lote con su QR y una etiqueta publicada. Solo para instancias de prueba.

## Decisiones técnicas a saber

- TypeScript **6** (no 7): el generador del cliente usa la API JavaScript del compilador.
- MapLibre 6 necesita la URL de su worker explícita (`setWorkerUrl`); sin eso el mapa queda en blanco.
- Las URLs de la vitrina son las mismas que en la versión actual, bajo `/v2`.
- Cada petición manda la cabecera `language`, como la interfaz actual: el backend traduce con eso.
