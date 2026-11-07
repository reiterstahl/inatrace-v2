# Before and after

[Español](ANTES-Y-DESPUES.md) · **English**

A comparison between the current INATrace interface (Angular) and INATrace v2. Both screens in each pair show
**the same data**: the demo installation's, served by the same backend and the same proxy, with the same
session. Desktop at 1280 × 800 and phone at 390 px wide. The screenshots show the Spanish interface.

The screenshots and measurements are regenerated with [`scripts/comparacion.mjs`](../scripts/comparacion.mjs).

## In numbers: the public product page on a phone

What a phone downloads to open a product's public page (the page a printed QR code opens):

| | Current interface | INATrace v2 | Difference |
|---|---:|---:|---:|
| Total transferred | 5,975 KB | 1,089 KB | **−82%** |
| JavaScript | 5,114 KB | 686 KB | **−87%** |
| Requests | 20 | 14 | −30% |

How it was measured: Chromium at 390 px, first visit (no cache), through the same proxy, with both interfaces
served **uncompressed** (neither has compression enabled in the demo). In the current interface the cookie
notice was declined (no Google Analytics or Facebook), like v2, which does not use them. Load times are not
reported: measured on the same machine, they say nothing about a real network.

## Technology

| | Current interface | INATrace v2 |
|---|---|---|
| Base | Angular 10 + Node 14, out of support with no security updates | React 19, Vite 8 and TypeScript 6, all currently supported |
| API client | Generated, but out of date with the backend | Regenerated from the running backend's OpenAPI spec |
| Maps | Mapbox (needs a token) | MapLibre, no token |

## Screen by screen

### Sign-in

| Current interface | INATrace v2 |
|---|---|
| ![Sign-in, before](comparacion/ingreso-antes.png) | ![Sign-in, after](comparacion/ingreso-despues.png) |

- In the current interface, the side text stays in English even when the site is in Spanish.
- v2 adds "Create an account" and "Forgot your password?" in the same interface, the language selector and
  dark mode.

### Home

| Current interface | INATrace v2 |
|---|---|
| ![Home, before](comparacion/inicio-antes.png) | ![Home, after](comparacion/inicio-despues.png) |

- The current interface shows illustrated shortcuts and the product list.
- v2 shows the modules with a description and keeps the main navigation always at the top, with the active
  company in view.

### Farmers

| Current interface | INATrace v2 |
|---|---|
| ![Farmers, before](comparacion/productores-antes.png) | ![Farmers, after](comparacion/productores-despues.png) |

- The current interface puts the table and the plot map one below the other.
- v2 separates **list** and **map** with a toggle, searches by name, sorts by column and has collectors in a
  tab next to it.

### Farmer profile

| Current interface | INATrace v2 |
|---|---|
| ![Farmer, before](comparacion/productor-antes.png) | ![Farmer, after](comparacion/productor-despues.png) |

- In the current interface it is a long form with the QR card on the side.
- v2 groups the profile into sections with an index on the left, and keeps the printable card and shortcuts
  to the farmer's deliveries, a new delivery and payments at hand.

### Deliveries

| Current interface | INATrace v2 |
|---|---|
| ![Deliveries, before](comparacion/entregas-antes.png) | ![Deliveries, after](comparacion/entregas-despues.png) |

- The current interface shows an area selector next to the buttons that add deliveries.
- v2 shows deliveries from every facility, with filters (women's coffee, outstanding balance only), the
  payment status of each delivery, bulk delivery and Excel export.

### Product labels

| Current interface | INATrace v2 |
|---|---|
| ![Label, before](comparacion/etiqueta-antes.png) | ![Label, after](comparacion/etiqueta-despues.png) |

- In the current interface labels are cards with their QR code.
- In v2 each label has its content, batches, feedback and statistics in tabs, with a preview of the public
  page before saving.

### Administration: value chains

| Current interface | INATrace v2 |
|---|---|
| ![Value chains, before](comparacion/cadenas-antes.png) | ![Value chains, after](comparacion/cadenas-despues.png) |

- The current interface is a table with the system menu on the left.
- v2 brings companies, users, value chains, catalogs, currencies and settings together in tabs, with search,
  status and actions on each row.

### On a phone

| Public page, before | Public page, after | Farmers, before | Farmers, after |
|---|---|---|---|
| ![Public page on a phone, before](comparacion/vitrina-celular-antes.png) | ![Public page on a phone, after](comparacion/vitrina-celular-despues.png) | ![Farmers on a phone, before](comparacion/productores-celular-antes.png) | ![Farmers on a phone, after](comparacion/productores-celular-despues.png) |

- The public page looks similar, but v2 opens with shortcuts to the journey, fair prices, farmers and
  quality, and weighs less than a fifth.
- In the current interface the farmers table turns into a list of fields and the buttons overflow the screen
  width. v2 uses cards, and an automated test checks that no screen is wider than the phone.
