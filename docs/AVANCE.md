# Avance

## Fase 0 (cimientos) — ✅ cerrada el 17.10.2026

Criterio de salida del plan: *ingresar en la v2, ver el perfil y volver a la versión actual sin
perder la sesión*. **Verificado contra el backend real** en convivencia (`e2e-real/`): la sesión
iniciada en la v2 vale en la interfaz actual y al revés.

- Vite 8 + React 19 + TypeScript 6, pnpm, base `/v2/`.
- Cliente de API generado desde la especificación del backend (215 operaciones tipadas).
- Sesión compartida por cookies, con renovación automática ante un 401.
- Cabecera `language` en cada petición, como la interfaz actual.
- Sistema de diseño (tokens, tema claro/oscuro, Inter + Fraunces incluidas) y componentes base.
- Portal: ingreso, inicio con el estado de migración de cada módulo, perfil editable.
- Idiomas: es y en escritos; de y rw importados de la interfaz actual.
- Imagen Docker (nginx sin privilegios, CSP estricta), proxy de convivencia y CI a GHCR.

## Fase 1 (vitrina pública) — ✅ cerrada el 17.10.2026

Criterio de salida: *un QR real abre la página nueva, en celular, en los 4 idiomas*.
Verificado con un QR generado por el backend en la copia aislada, en celular y escritorio.
Idiomas: español e inglés probados; alemán y kinyarwanda usan los textos importados de la
versión actual (48 y 49 de 50) y lo que allá no estaba traducido cae al inglés. Falta que
alguien que hable alemán y kinyarwanda los revise.

- Portada, recorrido (mapa MapLibre + línea de tiempo), precios justos (cálculo portado tal cual,
  con pruebas), productores (video sin cookies, galerías), calidad y certificados, opinión
  (guardada en el backend), términos y privacidad (HTML saneado).
- Colores y fuentes de cada producto, con control de contraste AA.
- Enlaces de la empresa filtrados (solo http/https).
- **Entrada desde QR impresos** (`/q-cd/…` y `/q/…`): registra la visita en el backend
  (`VISIT_QR`, de ahí salen las estadísticas de escaneos de cada etiqueta) y abre la vitrina,
  igual que la versión actual. El token de registro es configuración del contenedor
  (`TOKEN_REGISTRO_PUBLICO`), no del build.
- Redirección de los QR ya impresos lista en el proxy (`/{idioma}/q-cd/…` → `/v2/q-cd/…`),
  **comentada** hasta que se decida activarla. Probada con un proxy temporal.

**Pruebas:** 16 unitarias, 24 de punta a punta en modo simulado (escritorio y celular, también
en el CI de GitHub) y 6 contra el backend real (incluido el registro de la visita del QR, que
quedó en la tabla `RequestLog`).

**Problemas encontrados y resueltos en el camino:** el worker de MapLibre 6 no carga al
empaquetar (mapa en blanco); enlaces y botones sin nombre accesible en el celular; encabezado
del portal desbordado en pantallas chicas; pasos del recorrido sin traducir por falta de la
cabecera `language`; los QR impresos apuntan a `/{idioma}/q-cd/…` (no a `/p-cd/…`) y además
registran la visita, cosa que el plan no contemplaba; rutas públicas duplicadas (`/v2/v2/…`) en
el `index.html`; redirecciones de nginx con el puerto interno del contenedor.

## Entorno de demostración

Copia aislada en `/home/work-claude/projects/inatrace-v2-demo/` (fuera del repo, con permisos
restringidos: contiene contraseñas). Base copiada de la instancia de referencia el 17.10.2026,
red propia, solo accesible desde esta máquina.

```bash
cd /home/work-claude/projects/inatrace-v2-demo && docker compose up -d
# proxy de convivencia: http://127.0.0.1:8390  ·  backend directo: http://127.0.0.1:8381
```

Datos sembrados con `scripts/sembrar-demo.mjs`:
vitrina en `/v2/p-cd/ec8eed8f396d48e4b513b02d4a163782/a636d617-99c8-427d-a466-c9509a96a287`
(la misma ruta sin `/v2` abre la versión actual, para comparar).

La instancia de referencia (`inatrace-*`) sigue detenida como estaba desde el 26.09.

## Fase 1b (activar la vitrina en una instalación) — pendiente, acordada el 19.10.2026

Pasos, en orden:

1. Publicar la imagen (pasar a `main` o etiquetar una versión; el CI la sube a GHCR).
2. En la instalación: definir `TOKEN_REGISTRO_PUBLICO` igual al `REQUEST_LOG_TOKEN` del backend.
3. Levantar `deploy/convivencia/` delante del frontend actual y apuntar el dominio al proxy.
4. Probar con la v2 en `/v2/` sin tocar los QR (la versión actual sigue igual).
5. Descomentar la redirección de QR del proxy y escanear un QR impreso real: debe abrir la v2 y
   sumar la visita en las estadísticas de la etiqueta.
6. Vuelta atrás: volver a comentar la redirección (los QR vuelven a la versión actual al instante).

## Medios de demostración

`scripts/sembrar-medios.mjs` cargó en la copia aislada 6 fotos con licencia libre de Wikimedia
Commons (créditos en `docs/CREDITOS-DEMO.md`, visibles en cada leyenda) y un video del canal de
Anacafé. Se reemplazan por fotos propias cuando aparezcan. **Antes de mostrar la demo a terceros,
confirmar el uso del video de Anacafé o cambiarlo.**

## Pendiente / próximos pasos

1. Fase 1b (arriba), cuando se decida. `fase-0` **no** se pasa a `main` por ahora.
2. Revisión de alemán y kinyarwanda por alguien que los hable.
3. Demo pública: más adelante.
4. Fase 2: productores y parcelas.
