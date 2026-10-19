# INATrace v2 — plan del frontend nuevo

> Iniciativa propia de Rolando Quirós. **No es parte de los contratos GIZ 4500039135 ni 4500042348**:
> no se trabaja con días de esos contratos ni vive en el repo de entrega (`dapdevs/inatrace-enhanced`).
> Es una mejora que se le ofrece al cliente, que puede tomarla o no.
>
> Estado: borrador v0.1 · 17.10.2026

---

## 1. Qué es y qué no es

**Es** una interfaz nueva para INATrace: estética, navegación y experiencia completas desde cero,
sobre **el mismo backend** (Java 17 / Spring Boot 3.3 / MySQL) y la misma base de datos.

**No es** una reescritura de la plataforma. Las reglas de negocio —órdenes de stock, procesamiento,
transacciones, cadenas de trazabilidad, pagos, EUDR— se quedan en el backend, que ya está
probado. La v2 las consume por la API existente.

Por qué así:

| | Backend | Frontend actual |
|---|---|---|
| Tecnología | Java 17 · Spring Boot 3.3 · MySQL 8.4 | Angular 10 · TypeScript 3.9 · Node 14 · Bootstrap 4 |
| Tamaño | ~50.000 líneas · 92 entidades · 218 endpoints | ~139.000 líneas TS · 223 componentes · ~21.000 HTML |
| Estado | Moderno; actualizarlo es poco trabajo | 8 versiones mayores atrás; Node 14 sin parches de seguridad |
| Dónde está el valor | Años de reglas de dominio | — |
| Dónde está la deuda | — | Estética, versiones, mapa atado a token de Mapbox |

Reescribir el backend costaría meses solo para volver al punto actual, con riesgo sobre la
trazabilidad. El frontend es donde está la deuda y donde se nota una v2.

## 2. Principios

1. **El backend no cambia por la v2.** Si alguna pantalla nueva necesita algo que la API no da,
   se agrega al backend como cambio aparte (y queda bajo MPL 2.0, en el repo del backend).
2. **Convivencia, no corte.** La v2 y la interfaz actual corren a la vez sobre el mismo backend y
   la misma sesión. Se migra módulo por módulo; lo no migrado sigue en la versión actual.
3. **Paridad funcional antes que funciones nuevas.** Cada módulo migrado hace al menos todo lo que
   hacía. Las mejoras de UX van dentro de esa paridad; las funciones nuevas, después.
4. **Menos pantallas, no las mismas 96 rutas repintadas.** El rediseño junta flujos (ver §6).
5. **Sin token obligatorio para el mapa.** MapLibre en lugar de Mapbox GL.
6. **Accesible y usable en campo**: celular, conexión lenta, letra legible, contraste AA.

## 3. Arquitectura

```
                      mismo dominio (cookie de sesión compartida)
navegador ──► proxy (nginx) ──┬── /v2/*      → app nueva (estática)
                              ├── /api/*     → backend Spring (sin cambios)
                              └── /*         → app Angular actual (lo no migrado)
```

| Pieza | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto | — |
| UI | React 19 + Vite (SPA estática) | No hace falta servidor propio: el backend ya existe. Se sirve como archivos estáticos detrás del mismo nginx. |
| Cliente de API | Generado desde el OpenAPI del backend (springdoc) | Tipos exactos de las 218 rutas; se regenera cuando cambia el backend. |
| Datos del servidor | TanStack Query | Caché, reintentos, estados de carga uniformes. |
| Formularios | React Hook Form + Zod | Validación tipada; los formularios de stock y procesamiento son grandes. |
| Rutas | TanStack Router | Rutas tipadas, parámetros validados. |
| Estilos | Tailwind + componentes propios sobre Radix (estilo shadcn) | Sistema de diseño propio, accesible por base. |
| Mapa | MapLibre GL | Sin token; consume las mismas capas del catálogo (D1–D4). |
| Idiomas | Las 4 actuales (en, es, de, rw); se reutilizan las ~3.200 claves existentes donde sirvan | — |
| Pruebas | Vitest (unidad) + Playwright (flujos completos contra el backend real) | Cada módulo migrado se valida contra la misma base que la versión actual. |
| Entrega | Imagen propia en GHCR; el proxy decide qué rutas van a cada app | Igual que el resto de los proyectos. |

**Sesión:** el backend autentica con cookie. Servida bajo el mismo dominio, la v2 la comparte sin
cambios en el backend: quien ingresa en una interfaz está adentro en la otra.

**Ir y volver entre versiones:** la v2 enlaza a la interfaz actual para lo no migrado, y la actual
recibe un enlace "Probar la nueva versión" en los módulos ya migrados.

## 4. Sistema de diseño (antes que cualquier pantalla)

- Tokens: color, tipografía, espaciado, radios, sombras; tema claro y oscuro.
- Componentes base: botón, campo, selector, tabla con filtros, tarjeta, modal, panel lateral,
  pestañas, avisos, estados vacíos, carga, error.
- Componentes de dominio: ficha de productor, parcela en mapa, lote con su trazabilidad, línea de
  tiempo de una orden de stock, selector de instalación.
- Reglas: estado activo con relleno, **nunca con bordes laterales de color**; estados (vencido,
  pendiente, aprobado) siempre con el mismo color en todo el sistema.
- Se documenta en un catálogo navegable (Storybook o página propia) para mostrarlo al cliente.

## 5. Inventario actual (rutas del frontend Angular)

| Módulo | Rutas | Notas |
|---|---|---|
| Cuenta y acceso | 7 | Ingreso, registro, confirmación, activación, restablecer contraseña, perfil |
| Inicio y tableros | 2 | `home`, `company-dashboard` |
| Productores | 4 | Lista, alta, edición (incluye parcelas y mapa), importación |
| Recolectores | 3 | Lista, alta, edición |
| Clientes | 3 | Lista, alta, edición |
| Stock: entregas | 5 | Por instalación, alta individual y masiva, edición |
| Stock: procesamiento | 4 | Acciones de procesamiento sobre instalaciones |
| Stock: pagos | 7 | Individuales, masivos, a entregas y a órdenes de cliente |
| Stock: todo el stock / órdenes | 5 | Vista de órdenes de stock y su trazabilidad |
| Integración Beyco | 2 | Ofertas |
| Órdenes | 4 | Recibidas, emitidas, nueva orden de cliente |
| Empresas | 10 | Ficha, usuarios, instalaciones, acciones de procesamiento |
| Cadenas de valor | 4 | — |
| Catálogos del sistema | 7 | Ajustes, tipos, capas de mapa, certificaciones, factores de conversión, monedas |
| Usuarios del sistema | 2 | — |
| Productos, etiquetas y lotes | ~19 | Producto, interesados, productos finales, etiquetas, lotes, comentarios, estadísticas, blog |
| Públicas (consumidor, QR) | ~15 | Recorrido del producto, precios justos, productores, calidad, comentarios, textos legales |
| **Total** | **~96** | 223 componentes |

Roles a respetar: sistema (`SYSTEM_ADMIN`, `REGIONAL_ADMIN`, `USER`) y empresa
(`COMPANY_ADMIN`, `MANAGER`, `ACCOUNTANT`, `COMPANY_USER`).

## 6. Fases

Cada fase termina con algo usable en producción, conviviendo con la versión actual.
El tamaño es relativo (S / M / L / XL); el calendario se fija al cerrar la fase 0.

| Fase | Contenido | Tamaño | Sale cuando |
|---|---|---|---|
| **0. Cimientos** | Repo, Vite, cliente generado, proxy de convivencia, sesión compartida, sistema de diseño base, i18n, CI a GHCR, Playwright contra un backend de prueba | M | Ingresar en la v2, ver tu perfil y volver a la versión actual sin perder la sesión |
| **1. Vitrina pública** | Páginas del consumidor (QR, recorrido del producto, productores, calidad, comentarios) | M | Un QR real abre la página nueva, en celular, en los 4 idiomas |
| **1b. Activar la vitrina** | Poner la vitrina v2 en una instalación real: imagen publicada, token de registro, proxy de convivencia delante, redirección de los QR impresos y plan de vuelta atrás | S | Un QR impreso de la instalación abre la v2 y su visita suma en las estadísticas |
| **2. Productores y parcelas** | Lista, ficha, alta, importación, parcelas con mapa MapLibre y capas del catálogo | L | Paridad con la versión actual + mapa sin token |
| **3. Stock** | Entregas, procesamiento, pagos, todo el stock, trazabilidad de una orden | XL | Un ciclo completo entrega → procesamiento → pago hecho solo en la v2 |
| **4. Empresa y administración** | Empresas, instalaciones, usuarios, cadenas de valor, catálogos | L | Administrar una instancia sin abrir la versión actual |
| **5. Productos y etiquetas** | Productos, etiquetas, lotes, estadísticas, blog, recolectores, clientes, órdenes, Beyco | L | Paridad completa |
| **6. Retiro de Angular** | Quitar la app actual del proxy; redirecciones de rutas viejas | S | Ninguna ruta llega a Angular |

**Por qué la vitrina va primero:** son pocas pantallas, no tocan datos sensibles, las ve el
consumidor final y es donde el cambio de estética se nota más. Sirve como demostración para el
cliente antes de entrar a lo operativo.

**Por qué stock va antes que administración:** es el día a día de las cooperativas y donde la
interfaz actual más cuesta; la administración se usa poco y puede esperar en la versión vieja.

## 7. Calidad

- Cada flujo migrado tiene su prueba Playwright, corrida contra el mismo backend y los mismos datos
  que la versión actual: si los resultados difieren, la v2 está mal.
- Presupuesto de rendimiento: primera carga < 200 KB de JS comprimido en las páginas públicas.
- Accesibilidad: contraste AA, navegación por teclado, etiquetas en todos los campos.
- Nada de lógica de negocio duplicada en el frontend: cálculos y validaciones de dominio vienen
  del backend.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| La API no expone algo que la UI actual arma "a mano" | Detectarlo por módulo en la fase 0 revisando el uso real del cliente generado; agregar al backend como cambio aparte |
| Divergencia con el INATrace original | El backend no cambia por la v2; la v2 se puede ofrecer también al upstream |
| Dos interfaces a mantener durante la transición | Fases cortas; congelar mejoras en Angular para lo ya migrado |
| Trabajo sin contrato | Fase 0 + 1 como inversión propia y demostración; el resto, solo con acuerdo |
| Confusión de propiedad intelectual con los contratos actuales | Repo propio, horas propias, separado de `inatrace-enhanced` |

## 9. Decisiones

Tomadas el 19.10.2026:

1. **Licencia: MPL 2.0**, la misma de INATrace. Facilita que GIZ o el proyecto original la adopten.
2. **Nombre: INATrace v2.** Claro: es una reinterpretación de INATrace, no otro producto.
3. **Repo:** `reiterstahl/inatrace-v2`, privado hasta decidir otra cosa.

Abiertas:

4. **Instancia de demostración pública:** más adelante. Hoy hay una copia aislada solo local.
5. **Upstream:** si y cuándo se conversa con GIZ y con quienes mantienen INATrace.

## 10. Próximo paso sugerido

Fase 0 acotada como prueba de concepto: ingreso + perfil + una página pública de producto, con la
estética nueva, conviviendo con la versión actual en la instancia de referencia. Con eso hay algo
concreto que mostrar al cliente antes de comprometer más tiempo.
