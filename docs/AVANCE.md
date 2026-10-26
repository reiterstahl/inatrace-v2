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

## Fase 2 (productores y parcelas) — ✅ cerrada el 20.10.2026 (rama `fase-2`)

Criterio de salida del plan: *paridad con la versión actual + mapa sin token*.

- **Empresa activa:** selector en el portal (de las empresas del perfil; la administración del
  sistema ve todas). Todo el módulo trabaja sobre la empresa elegida.
- **Lista:** búsqueda por nombre o apellido, orden, paginación del servidor (todo en la URL),
  tabla en escritorio y tarjetas en celular, exportación a ZIP, borrado, y **vista de mapa** de
  todas las parcelas de la empresa (con puntos para verlas de lejos).
- **Ficha** (alta y edición en el mismo formulario): datos personales, ubicación con el formato
  de dirección de cada país (Ruanda, Honduras, resto) y pin en el mapa, finca y cultivos,
  organizaciones, datos bancarios, certificaciones con documento adjunto y **parcelas con editor
  de polígonos** (Terra Draw): dibujar, mover vértices, superficie calculada, aviso si la
  superficie declarada difiere más de un 20 % de la dibujada, subir y exportar GeoJSON. Capas del
  catálogo de la instalación en todos los mapas. Aviso al salir con cambios sin guardar.
- **Tarjeta del productor** con su QR (el lector independiente devuelve el ID exacto) e
  impresión. Entregas y pagos del productor enlazan a la versión actual hasta la fase 3.
- **Importación desde Excel** con las plantillas de la versión actual, errores por celda y
  revisión de posibles duplicados.
- Lo que solo existe en el backend mejorado (capas, catálogo de certificaciones) se usa si está
  y se omite si no.

**Pruebas:** 31 unitarias (incluye ida y vuelta del formulario sin perder datos), 10 de punta a
punta simuladas (34 en total con las anteriores) y 3 contra el backend real: editar y guardar, crear y borrar, y **dibujar una
parcela con el mouse, guardarla, verificarla y quitarla**.

**Encontrado en el camino:** un selector numérico convertía `null` en `0` y marcaba la ficha
como modificada al abrirla; el código del país escrito por programa hacía lo mismo; el editor
encuadraba todas las parcelas en vez de la editada; con zoom de país un dibujo medía 1,8 millones
de ha (ahora pide acercarse); los cultivos salen de las cadenas de valor de la empresa y en la
copia están vacíos (ahora se ofrecen también los que el productor ya tiene).

**Hallazgo del backend (no de la v2):** `PUT /api/company/userCustomers/edit` responde
NullPointerException si recibe el productor tal como lo devuelve el `GET`. La v2 y la versión
actual arman el objeto antes de enviarlo y no lo sufren. Anotar en los hallazgos de
`inatrace-enhanced` si se confirma allá.

**Bundle:** las pantallas del portal se cargan bajo demanda. *(Corregido el 20.10: el "~99 KB" que
figuraba acá era solo el archivo principal; todo el JS que baja la vitrina al abrir son ~163 KB
comprimidos.)*

## Fase 3a (entregas) — ✅ cerrada el 20.10.2026 (rama `fase-3`)

Primera parte de la fase 3 (stock). Las demás pestañas del módulo (stock, procesamiento, pagos,
órdenes) siguen abriendo la versión actual, con la misma sesión.

- **Lista de entregas:** por instalación de acopio o de toda la empresa, búsqueda por productor,
  café de mujeres, semiproducto, solo con saldo pendiente, orden por fecha, paginación (todo en la
  URL), estado de pago (pagada / debe X / sin precio), exportación a Excel, borrado. Tabla en
  escritorio y tarjetas en celular.
- **Entrega (alta y edición):** buscador accesible de productores y acopiadores, **parcelas de
  origen** del productor, campos que aparecen y se exigen según las opciones de la instalación (tara,
  descuentos por daño, orgánico, café de mujeres, precio a definir, acopiador), coma decimal, unidad
  y moneda junto a cada número, y **vista previa del pago** con la misma fórmula del backend.
  "Guardar y registrar otra" conserva lo del día (instalación, fecha, semiproducto, moneda, forma de
  pago). Aviso si la entrega ya tiene pagos.
- **Entrega masiva:** datos comunes una vez y una fila por productor, con subtotal por fila y total;
  al agregar una fila el foco va a su buscador y se repite el precio.
- **Desde la ficha del productor:** "Sus entregas" (lista filtrada) y "Nueva entrega" con el
  productor ya elegido. Los pagos siguen en la versión actual hasta la fase 3d.
- Reglas tomadas de la interfaz actual y del `StockOrderService` del backend (no del plan): qué es
  obligatorio según la instalación, formas de pago según haya acopiador, identificador
  `PT-{apellido}-{fecha}`.

**Pruebas:** 47 unitarias (11 nuevas: validación, armado para la API, ida y vuelta del formulario,
masiva), 46 de punta a punta simuladas (12 nuevas, escritorio y celular) y 3 nuevas contra el
backend real: crear → ver el pago que calcula el backend → editar el precio y ver el saldo
recalculado → borrar; validaciones; y masiva con dos productores.

**Encontrado en el camino:** el encabezado del portal se desbordaba 46 px en el celular (ya pasaba
con "Mi perfil"; ahora el perfil se abre desde el avatar); entregas cargadas por otras vías traen
solo `deliveryTime` y no `productionDate` (la lista usa la que haya); una instalación sin
traducción al idioma activo llega sin nombre (se muestra el del punto en el mapa).

## Fase 3b (todo el stock y trazabilidad) — ✅ cerrada el 23.10.2026 (rama `fase-3`)

Segunda parte de la fase 3. Agrega dos pestañas internas al módulo de stock: **Stock** (todo lo que
hay en una instalación) y la **trazabilidad** de una orden. Procesamiento, pagos y órdenes siguen
abriendo la versión actual.

- **Todo el stock:** selector de instalación (todas las de la empresa; como la versión actual, hay
  que elegir una), vista **por orden** o **por lote** (agrupada), filtros por semiproducto, solo
  entregas y solo disponible, todo en la URL. Columnas: fecha, lote/identificador, tipo, semiproducto,
  cantidad y disponible (con chip disponible/agotado). Acciones por fila: ver trazabilidad, exportar
  datos geográficos (GeoJSON), editar (si es entrega) y borrar.
- **Trazabilidad:** ficha de la orden y una línea de tiempo hacia atrás —procesamientos y las
  entregas de productores que la originaron—, con documentos de evidencia y valores de los campos
  requeridos, y enlaces a las órdenes de salida. Botón para exportar los datos geográficos.
- Reutiliza el buscador, los formatos de cantidad/fecha y la capa de API de la 3a.

**Pruebas:** 6 de punta a punta simuladas nuevas (escritorio y celular; 52 en total) y 1 nueva
contra el backend real (crear una entrega → verla en el stock suelto y agrupado → abrir su
trazabilidad → borrarla desde el stock). Las 47 unitarias siguen pasando.

**Encontrado en el camino:**
- 🟠 **Hallazgo de seguridad del backend (no de la v2):** `GroupStockOrderService.getGroupedStockOrderList`
  concatena el parámetro `sortBy` directo al JPQL del `ORDER BY` (el listado de órdenes sueltas, en
  cambio, usa un `switch` con columnas fijas). Es una inyección JPQL en un endpoint autenticado. La v2
  solo manda valores de una lista fija, así que no la dispara, pero conviene corregir el backend.
  Anotado en los hallazgos de `inatrace-enhanced`.
- En la copia de demostración, las entregas y el lote procesado sembrados viven en una instalación
  (id 5) que el backend no devuelve en el listado de instalaciones; por eso la vista de stock se probó
  creando una entrega en la instalación listada. La trazabilidad por URL del lote sembrado sí funciona.

## Fase 3c.1 (procesamiento) — ✅ cerrada el 26.10.2026 (rama `fase-3`)

La pestaña **Procesamiento** pasa a la v2. Quedan en la versión actual pagos y órdenes (los envíos o
cotizaciones van con órdenes, en la 3e).

- **Inicio:** cada instalación de la empresa con las acciones que puede iniciar, con la misma regla
  que la versión actual (procesan algo que la instalación maneja, respetan las instalaciones
  admitidas por la acción, sin envíos).
- **Orden de procesamiento** para los cuatro tipos: procesamiento, procesamiento final, traslado y
  generación de QR.
  - *Entrada:* instalación, filtros (fechas, lote, orgánico, café de mujeres), lotes disponibles con
    selección y **cantidad parcial editable en la misma tabla** (la versión actual usa una ventana
    aparte). Marca si todo lo elegido es orgánico o de mujeres.
  - *Salidas:* varias en procesamiento, una en los demás; semiproducto o producto final, instalación
    de destino (se elige sola si hay una), cantidad con unidad, lote con el prefijo de la acción,
    **reempaque en sacos** (se reparten solos según el peso máximo y se pueden ajustar) y los campos de
    evidencia que pide la acción, según su tipo.
  - *Datos:* fecha, documentos obligatorios y otros documentos (con subida de archivos), comentarios.
  - *Resumen:* entra, sale, queda sin usar (convirtiendo unidades por su peso) y el **rango esperado**
    según el rendimiento de la acción, con aviso si la salida queda fuera.
  - Validaciones de la versión actual y del backend: al menos una entrada, salida no mayor que la
    entrada, lote e instalación obligatorios, sacos que cubran la cantidad, un único lote de salida al
    generar QR, un lote por cada lote trasladado.
- **Editar** una orden desde su lote (quitar o agregar entradas y salidas; los sacos vuelven a
  agruparse) y **borrarla** desde el lote o desde "Todo el stock".
- Los traslados ya guardados se ven pero no se editan desde la v2: el backend exige que cada lote de
  salida corresponda uno a uno con su entrada y la versión actual tampoco lo resuelve bien.
- `scripts/sembrar-procesamiento.mjs` crea dos acciones de demostración (trillado y traslado) en la
  copia aislada, para las pruebas contra el backend real.

**Pruebas:** 62 unitarias (15 nuevas de la lógica de procesamiento: qué acciones ofrece cada
instalación, conversión de unidades, rango esperado, sacos, validación, armado del pedido para cada
tipo y vuelta desde una orden guardada), 58 de punta a punta simuladas (6 nuevas) y 1 nueva contra el
backend real: entrega → trillado → lote en el stock → trazabilidad → editar → borrar. En 12 corridas
seguidas de esa prueba hubo **una falla que no se pudo reproducir** después (pendiente de entender).

**Encontrado en el camino:**
- 🟠 **H19, del backend de `inatrace-enhanced`:** borrar una orden de procesamiento no devuelve la
  cantidad a los lotes de entrada (quedan en 0 para siempre). Ya está corregido en el original de
  AgStack (`1a8cc83`, 23.09.2026); el repositorio del contrato es anterior y no lo tiene. La v2 no
  promete en sus mensajes que la entrada vuelva a quedar disponible.
- Las acciones de procesamiento exigen traducción al inglés para crearse.

**Sigue (3c.2):** mostrar el QR generado y enlazarlo a la vitrina; pulido según lo que aparezca.

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
4. Fase 3, lo que sigue: 3c.2 QR y pulido → 3d pagos → 3e órdenes y Beyco.
   Criterio de salida de la fase: ciclo entrega → procesamiento → pago completo en la v2.
