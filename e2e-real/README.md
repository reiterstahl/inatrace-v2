# Tests against a real installation

**English** · [Español](README.es.md)

They need the side-by-side setup running (proxy on a single origin) and data seeded with
`scripts/sembrar-demo.mjs`. Variables:

| Variable | What it is |
|---|---|
| `INATRACE_URL` | Proxy origin (default `http://127.0.0.1:8390`) |
| `INATRACE_USUARIO`, `INATRACE_CLAVE` | User of the instance |
| `DEMO_ETIQUETA`, `DEMO_QR` | UUID of the published label and QR code (printed by the seeding script) |
| `ANGULAR_RETIRADO` | `1` when the proxy runs with `ANGULAR=no` (phase 6): enables `retiro-angular.spec.ts` and skips the tests of the session shared with Angular |
| `MAILHOG_URL` | MailHog API where the backend leaves the e-mails (for `cuenta.spec.ts`); the backend needs `INATRACE_MAIL_SENDINGENABLED=true`. Without it, that test is skipped |

`pnpm exec playwright test -c playwright.real.config.ts`

`productores.spec.ts` and `entregas.spec.ts` only need a user and password, and also work against
the development server (`INATRACE_URL=http://localhost:5181` with `pnpm dev --port 5181` and
`INATRACE_API` pointing at the backend). They create test data and delete it when they finish;
deliveries need at least two farmers in the company and a collection facility.

`pagos.spec.ts` temporarily adds a test bank account to farmer 1 (through the API) for the bulk
payment and restores it when it finishes. The backend does not allow deleting bulk payments: each
run leaves an "E2E-MASIVO" record with no payments.

`ordenes.spec.ts` needs `scripts/sembrar-ordenes.mjs` (a second company, a customer and order
templates), `beyco.spec.ts` needs `scripts/sembrar-beyco.mjs` (Beyco enabled in the demo company)
and `productos.spec.ts` and `productos-partes.spec.ts` need `scripts/sembrar-productos.mjs` (a value
chain in the demo company; the second uses the system administrator account), as do
`etiquetas.spec.ts` and `etiqueta-partes.spec.ts` (the latter needs the backend with H24).
`empresa.spec.ts` needs the backend with H26, currencies enabled (`scripts/sembrar-monedas.sql` on an isolated copy) and
semi-products in the value chain (`scripts/sembrar-productos.mjs`); it leaves the demo company's profile as it was and
deletes the facility it creates. The knowledge base test needs the backend with H25 (deleting entries, and products
that have them).
The three scripts are for isolated copies only. `beyco.spec.ts` does not use the real Beyco: it
intercepts the requests to Beyco and simulates its response.
