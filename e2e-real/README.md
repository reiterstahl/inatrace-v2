# Pruebas contra una instalación real

Requieren la convivencia levantada (proxy en un solo origen) y datos sembrados con
`scripts/sembrar-demo.mjs`. Variables:

| Variable | Qué es |
|---|---|
| `INATRACE_URL` | Origen del proxy (por defecto `http://127.0.0.1:8390`) |
| `INATRACE_USUARIO`, `INATRACE_CLAVE` | Usuario de la instancia |
| `DEMO_ETIQUETA`, `DEMO_QR` | uuid de la etiqueta publicada y código QR (los imprime la siembra) |

`pnpm exec playwright test -c playwright.real.config.ts`
