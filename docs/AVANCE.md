# Avance — Fase 0 (cimientos) + Fase 1 (vitrina pública)

> Pausado el 17.10.2026 a pedido de Rolo. **El proyecto todavía no compila**: `src/rutas.tsx`
> importa páginas de la vitrina que faltan escribir (ver "Pendiente").

## Hecho

**Proyecto y herramientas**
- Vite 8 + React 19 + TypeScript, pnpm. Base `/v2/`. Alias `@/` → `src/`.
- **TypeScript fijado en ~6.0.3**, no en 7: el generador de cliente (`@hey-api/openapi-ts`) usa la
  API JavaScript del compilador, que TypeScript 7 (versión en Go) ya no expone.
- Cliente de API generado: `api/openapi.json` (copia fijada del backend, 192 rutas) →
  `src/api/gen/` (215 operaciones). En `openapi-ts.config.ts` el `input` va como `./api/...`: sin
  el `./`, hey-api lo toma como un proyecto de su registro en la nube.
- `pnpm api:actualizar` baja la especificación del backend en marcha (`INATRACE_API`).

**Sesión compartida** (`src/api/sesion.ts`): el backend usa cookies HttpOnly de acceso y de
renovación. Ante un 401 se renueva una sola vez (`POST /api/user/refresh_authentication`) y se
repite la petición; si falla, se avisa y se va a `/ingreso`. Las respuestas se desenvuelven con
`desenvolver()` (`src/api/respuesta.ts`), que lanza `ErrorApi` si `status !== 'OK'`.

**Idiomas** (`src/i18n/`): es y en escritos a mano; de y rw **importados de la interfaz actual**
con `pnpm i18n:importar` (48 y 49 de 50 textos; lo que falta cae al inglés). Textos con tuteo
neutro (no voseo: es la cara pública del producto).

**Sistema de diseño** (`src/estilos/app.css`): tokens semánticos con tema claro y oscuro;
Inter + Fraunces incluidas (sin Google Fonts); `.tema-claro` fuerza claro en la vitrina.
Componentes en `src/componentes/ui/`: Icono, Boton, Campo/Area/Selector, Cargando, Aviso,
EstadoError, SelectorIdioma, InterruptorTema, Logo.

**Portal**: rutas (`src/rutas.tsx`), entrada (`src/main.tsx`), Ingreso, Marco, Inicio (módulos con
su estado de migración y enlaces a la versión actual), Perfil (ver y editar nombre, apellido e
idioma).

**Vitrina (empezada)**: `datos.ts` (acceso a etiqueta, QR, campos y pestañas en el orden
configurado) y `marca.ts` (colores del producto con control de contraste AA).
Las URLs son **las mismas que la versión actual** (`/p-cd/:etiqueta/:qr/journey`, etc.) bajo
`/v2`: así los QR ya impresos se redirigen con solo un prefijo en el proxy.

## Pendiente (en este orden)

1. `paginas/vitrina/precios.ts`: portar el cálculo de `b2c-fair-prices.component.ts` tal cual
   (POUND_TO_KG = 0.453592; modos PER_CONTAINER / PER_KG / PERCENT_VALUE; alturas normalizadas
   a 220) + pruebas Vitest con casos conocidos.
2. Páginas: `Vitrina.tsx` (marco + `VitrinaError`), `Portada`, `Recorrido` (+ mapa MapLibre
   cargado aparte, teselas OpenFreeMap), `Precios`, `Productores`, `Calidad`, `Opinion`, `Legal`
   y un componente `HtmlSeguro` (DOMPurify) para textos con formato del backend.
   Al montar la vitrina: usar el idioma de la etiqueta si la persona no eligió otro.
3. `src/mocks/` (MSW 3: `msw/vite` sirve el worker; `onUnhandledFrame` reemplazó a
   `onUnhandledRequest`) con datos de ejemplo tipados.
4. `src/pruebas/preparar.ts` (jest-dom), pruebas Vitest y Playwright (`e2e/`) sobre el modo simulado.
5. `deploy/`: Dockerfile (nginx sirviendo `/v2/`), `nginx/convivencia.conf` (`/v2` → v2,
   `/api` → backend, `/` → Angular; redirección opcional `/p-cd/*` → `/v2/p-cd/*`) y CSP.
6. CI en GitHub Actions → imagen en GHCR (`ghcr.io/reiterstahl/inatrace-v2`).
7. Datos de demostración reales (etiqueta publicada + QR) en una **copia aislada** de la base,
   sembrados por API. El QR solo se genera procesando un lote con una acción de tipo
   "generar QR" (`ProcessingOrderService`). Hoy la base de referencia tiene 1 empresa,
   1 producto, 7 productores, 5 órdenes de stock, 0 etiquetas y 0 QR.
8. Verificar la salida de la fase 0 y de la fase 1 contra el backend real; actualizar README.

## Estado del entorno al pausar

- La instancia de referencia de INATrace estaba **detenida a propósito desde el 26.09**. Para
  leer la especificación levanté base, backend, correo y AgStack (no el frontend público). Al
  pausar los volví a detener: estado original. Para retomar:
  `docker start inatrace-db inatrace-mail agstack-mock && sleep 8 && docker start inatrace-be`
- Copia de la especificación usada: `api/openapi.json`.

## Fuentes para portar (repo `giz/inatrace-dap`)

`frontend/src/app/b2c/` — `b2c-page` (carga y campos), `b2c-tabs` (orden de pestañas),
`b2c-journey`, `b2c-fair-prices`, `b2c-producers`, `b2c-quality`, `b2c-feedback`.
Endpoints: `getPublicProductLabelValues`, `getQrTagPublicData` (con `withHistory`),
`addProductLabelFeedback`, documentos en `/api/public/document/{storageKey}`.
