# INATrace v2 — plan for the new frontend

**English** · [Español](PLAN.es.md)

> An independent initiative by Rolando QR. **It is not part of the GIZ contracts**: no days from
> those contracts are spent on it, and it does not live in the delivery repository (`dapdevs/inatrace-enhanced`).
> It is an independent initiative, built on my own time and offered openly to anyone using INATrace.
>
> Status: draft v0.1 · 17 October 2026. This is the original plan; the current status is in the [README](../README.md).

---

## 1. What it is and what it is not

**It is** a new interface for INATrace: look, navigation and experience built from scratch, on
**the same backend** (Java 17 / Spring Boot 3.3 / MySQL) and the same database.

**It is not** a rewrite of the platform. The business rules (stock orders, processing,
transactions, traceability chains, payments, EUDR) stay in the backend, which is already
proven. v2 uses them through the existing API.

Why this way:

| | Backend | Current frontend |
|---|---|---|
| Technology | Java 17 · Spring Boot 3.3 · MySQL 8.4 | Angular 10 · TypeScript 3.9 · Node 14 · Bootstrap 4 |
| Size | ~50,000 lines · 92 entities · 218 endpoints | ~139,000 lines of TS · 223 components · ~21,000 of HTML |
| State | Modern; keeping it up to date is little work | 8 major versions behind; Node 14 gets no security patches |
| Where the value is | Years of domain rules | — |
| Where the debt is | — | Look, versions, a map tied to a Mapbox token |

Rewriting the backend would take months just to get back to where it is today, with risk to
traceability. The frontend is where the debt is, and where a v2 shows.

## 2. Principles

1. **The backend does not change for v2.** If a new screen needs something the API does not
   provide, it is added to the backend as a separate change (under MPL 2.0, in the backend repository).
2. **Side by side, not a cutover.** v2 and the current interface run at the same time on the same
   backend and the same session. Migration goes module by module; anything not migrated stays in the
   current version.
3. **Feature parity before new features.** Each migrated module does at least everything it did
   before. UX improvements fit within that parity; new features come later.
4. **Fewer screens, not the same 96 routes repainted.** The redesign merges flows (see §6).
5. **No token required for the map.** MapLibre instead of Mapbox GL.
6. **Accessible and usable in the field**: phones, slow connections, readable text, AA contrast.

## 3. Architecture

```
                      same domain (shared session cookie)
browser ──► proxy (nginx) ──┬── /v2/*      → new app (static)
                            ├── /api/*     → Spring backend (unchanged)
                            └── /*         → current Angular app (whatever is not migrated)
```

| Piece | Choice | Reason |
|---|---|---|
| Language | Strict TypeScript | — |
| UI | React 19 + Vite (static SPA) | No server of its own is needed: the backend already exists. It is served as static files behind the same nginx. |
| API client | Generated from the backend's OpenAPI spec (springdoc) | Exact types for the 218 routes; regenerated when the backend changes. |
| Server data | TanStack Query | Caching, retries, consistent loading states. |
| Forms | React Hook Form + Zod | Typed validation; the stock and processing forms are large. |
| Routing | TanStack Router | Typed routes, validated parameters. |
| Styles | Tailwind + own components on Radix (shadcn style) | Own design system, accessible from the ground up. |
| Map | MapLibre GL | No token; uses the same catalog layers (D1–D4). |
| Languages | The current 4 (en, es, de, rw); the ~3,200 existing keys are reused where they fit | — |
| Tests | Vitest (unit) + Playwright (full flows against the real backend) | Each migrated module is validated against the same database as the current version. |
| Delivery | Own image on GHCR; the proxy decides which routes go to each app | Same as the other projects. |

**Session:** the backend authenticates with a cookie. Served under the same domain, v2 shares it
with no backend changes: whoever signs in to one interface is signed in to the other.

**Moving between versions:** v2 links to the current interface for whatever is not migrated, and the
current one gets a "Try the new version" link in the modules already migrated.

## 4. Design system (before any screen)

- Tokens: color, typography, spacing, radii, shadows; light and dark theme.
- Base components: button, field, select, table with filters, card, modal, side panel, tabs,
  notices, empty, loading and error states.
- Domain components: farmer profile, plot on a map, batch with its traceability, timeline of a
  stock order, facility selector.
- Rules: active state with a fill, **never with colored side borders**; statuses (overdue,
  pending, approved) always in the same color across the whole system.
- Documented in a browsable catalog (Storybook or a page of its own) to show to people using INATrace.

## 5. Current inventory (Angular frontend routes)

| Module | Routes | Notes |
|---|---|---|
| Account and access | 7 | Sign-in, sign-up, confirmation, activation, password reset, profile |
| Home and dashboards | 2 | `home`, `company-dashboard` |
| Farmers | 4 | List, create, edit (including plots and map), import |
| Collectors | 3 | List, create, edit |
| Customers | 3 | List, create, edit |
| Stock: deliveries | 5 | By facility, single and bulk creation, edit |
| Stock: processing | 4 | Processing actions on facilities |
| Stock: payments | 7 | Single, bulk, for deliveries and for customer orders |
| Stock: all stock / orders | 5 | Stock order view and its traceability |
| Beyco integration | 2 | Offers |
| Orders | 4 | Received, issued, new customer order |
| Companies | 10 | Profile, users, facilities, processing actions |
| Value chains | 4 | — |
| System codebooks | 7 | Settings, types, map layers, certifications, conversion factors, currencies |
| System users | 2 | — |
| Products, labels and batches | ~19 | Product, stakeholders, final products, labels, batches, comments, statistics, blog |
| Public (consumer, QR) | ~15 | Product journey, fair prices, farmers, quality, comments, legal texts |
| **Total** | **~96** | 223 components |

Roles to respect: system (`SYSTEM_ADMIN`, `REGIONAL_ADMIN`, `USER`) and company
(`COMPANY_ADMIN`, `MANAGER`, `ACCOUNTANT`, `COMPANY_USER`).

## 6. Phases

Each phase ends with something usable in production, running alongside the current version.
Size is relative (S / M / L / XL); the schedule is set when phase 0 closes.

| Phase | Content | Size | Done when |
|---|---|---|---|
| **0. Foundations** | Repo, Vite, generated client, side-by-side proxy, shared session, base design system, i18n, CI to GHCR, Playwright against a test backend | M | You can sign in to v2, see your profile and go back to the current version without losing the session |
| **1. Public product page** | Consumer pages (QR, product journey, farmers, quality, comments) | M | A real QR code opens the new page, on a phone, in all 4 languages |
| **1b. Switch on the public page** | Put the v2 public page on a real installation: published image, logging token, side-by-side proxy in front, redirect for printed QR codes and a rollback plan | S | A printed QR code from the installation opens v2 and its visit counts in the statistics |
| **2. Farmers and plots** | List, profile, create, import, plots with a MapLibre map and catalog layers | L | Parity with the current version + a map with no token |
| **3. Stock** | Deliveries, processing, payments, all stock, traceability of an order | XL | A full delivery → processing → payment cycle done only in v2 |
| **4. Company and administration** | Companies, facilities, users, value chains, codebooks | L | Running an instance without opening the current version |
| **5. Products and labels** | Products, labels, batches, statistics, blog, collectors, customers, orders, Beyco | L | Full parity |
| **6. Retiring Angular** | Remove the current app from the proxy; redirect old routes | S | No route reaches Angular |

**Why the public page goes first:** it is a few screens, touches no sensitive data, is seen by the
end consumer and is where the new look shows the most. It works as a demonstration for people
using INATrace before getting into the operational side.

**Why stock goes before administration:** it is the cooperatives' day-to-day work and where the
current interface is hardest to use; administration is used rarely and can wait in the old version.

## 7. Quality

- Every migrated flow has its Playwright test, run against the same backend and the same data as
  the current version: if the results differ, v2 is wrong.
- Performance budget: first load < 200 KB of compressed JS on the public pages.
- Accessibility: AA contrast, keyboard navigation, labels on every field.
- No business logic duplicated in the frontend: domain calculations and validations come from
  the backend.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The API does not expose something the current UI builds "by hand" | Find it per module in phase 0 by reviewing the real use of the generated client; add it to the backend as a separate change |
| Drifting away from the original INATrace | The backend does not change for v2; v2 can also be offered upstream |
| Two interfaces to maintain during the transition | Short phases; freeze Angular improvements for whatever is already migrated |
| Work without funding | Own investment, in short phases and in the open (MPL 2.0), so anyone can adopt it |
| Intellectual property confusion with the current contracts | Own repo, own hours, separate from `inatrace-enhanced` |

## 9. Decisions

Made on 19 October 2026:

1. **License: MPL 2.0**, the same as INATrace. It makes adoption by GIZ or the original project easier.
2. **Name: INATrace v2.** Clear: it is a reinterpretation of INATrace, not a different product.
3. **Repo:** `reiterstahl/inatrace-v2`, private until decided otherwise.

Open:

4. **Public demo instance:** later. Today there is only an isolated local copy.
5. **Upstream:** whether and when to talk with GIZ and with the INATrace maintainers.

## 10. Suggested next step

A scoped phase 0 as a proof of concept: sign-in + profile + one public product page, with the new
look, running alongside the current version on the reference instance. That gives something
concrete to show to people using INATrace before committing more time.
