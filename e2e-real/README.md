# Pruebas contra una instalación real

Requieren la convivencia levantada (proxy en un solo origen) y datos sembrados con
`scripts/sembrar-demo.mjs`. Variables:

| Variable | Qué es |
|---|---|
| `INATRACE_URL` | Origen del proxy (por defecto `http://127.0.0.1:8390`) |
| `INATRACE_USUARIO`, `INATRACE_CLAVE` | Usuario de la instancia |
| `DEMO_ETIQUETA`, `DEMO_QR` | uuid de la etiqueta publicada y código QR (los imprime la siembra) |
| `MAILHOG_URL` | API de MailHog donde el backend deja los correos (para `cuenta.spec.ts`); el backend necesita `INATRACE_MAIL_SENDINGENABLED=true`. Sin ella, esa prueba se omite |

`pnpm exec playwright test -c playwright.real.config.ts`

`productores.spec.ts` y `entregas.spec.ts` solo necesitan usuario y clave, y funcionan también
contra el servidor de desarrollo (`INATRACE_URL=http://localhost:5181` con `pnpm dev --port 5181` e
`INATRACE_API` apuntando al backend). Crean datos de prueba y los borran al terminar; las entregas
necesitan al menos dos productores en la empresa y una instalación de acopio.

`pagos.spec.ts` carga temporalmente una cuenta bancaria de prueba a la productora 1 (por la API) para
el pago masivo y la deja como estaba al terminar. El backend no permite borrar pagos masivos: cada
corrida deja un registro "E2E-MASIVO" sin pagos.

`ordenes.spec.ts` necesita `scripts/sembrar-ordenes.mjs` (segunda empresa, cliente y plantillas de
pedido), `beyco.spec.ts` necesita `scripts/sembrar-beyco.mjs` (Beyco habilitado en la empresa demo)
y `productos.spec.ts` y `productos-partes.spec.ts` necesitan `scripts/sembrar-productos.mjs` (cadena de
valor en la empresa demo; la segunda usa la cuenta de administración del sistema), igual que
`etiquetas.spec.ts` y `etiqueta-partes.spec.ts` (esta última necesita el backend con H24).
`empresa.spec.ts` necesita el backend con H26, monedas habilitadas (`scripts/sembrar-monedas.sql` en una copia aislada) y
semiproductos en la cadena (`scripts/sembrar-productos.mjs`); deja la ficha de la empresa demo como estaba y borra la
instalación que crea. La prueba de base de conocimiento necesita el backend con H25 (borrar entradas y productos que las
tengan).
Los tres scripts son solo para copias aisladas. `beyco.spec.ts` no usa Beyco de verdad: intercepta la
salida hacia Beyco y simula su vuelta.
