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

## Fase 3c.2 (QR del lote y pulido) — ✅ cerrada el 26.10.2026 (rama `fase-3`)

- **QR de un lote** que pasó por "generar código QR", en su trazabilidad (y con un acceso directo
  desde "Todo el stock"): el **mismo QR que imprime la versión actual**
  (`{raíz}/{idioma de la etiqueta}/{ruta de QR}/{uuid de la etiqueta}/{código del lote}`), así que al
  escanearlo se registra la visita igual que hoy. Si el producto final tiene varias etiquetas
  publicadas, se elige cuál. Copiar la URL, **descargar SVG**, imprimir solo el QR y **ver la vitrina**
  sin contar una visita.
- La raíz y la ruta de los QR son configuración de la instalación, con **las mismas variables que el
  frontend actual** (`APP_BASE_URL`, `QR_CODE_BASE_PATH`, por defecto `q-cd`), en
  `deploy/convivencia/docker-compose.yml`.
- Si el producto final no tiene etiquetas publicadas, se avisa y se enlaza a donde se asocian en la
  versión actual.
- Línea de tiempo: cada paso de procesamiento con un ícono según su tipo cuando la acción no define uno.
- `scripts/sembrar-procesamiento.mjs` suma "Generar QR (demo)" y asocia la etiqueta de la vitrina al
  producto final en la copia aislada.
- **Prueba intermitente de la 3c.1:** encontrada una causa probable. Las pruebas reales buscaban
  filas por un número contenido en cualquier texto ("421" también coincide con "1421" o con un lote
  con esos dígitos); ahora comparan la celda de cantidad exacta. Desde el cambio: 3 de 3 corridas
  verdes (más las 10 anteriores sin el cambio), sin poder confirmar que fuera esa la causa.

**Comprobado contra el backend real:** un lote con QR generado desde la v2 abre la vitrina v2 de ese
lote.

**Pruebas:** 64 unitarias, 60 de punta a punta simuladas (2 nuevas de QR, escritorio y celular) y 9
contra el backend real (1 nueva: entrega → generar QR → panel con la URL de la versión actual → vitrina).

## Fase 3d (pagos) — ✅ cerrada el 26.10.2026 (rama `fase-3`)

La pestaña **Pagos** pasa a la v2. Solo quedaba en la versión actual "Órdenes" (3e).

- **Lista de pagos:** filtros por productor, forma de pago, estado y fechas de entrega (en la URL),
  estado sin confirmar / confirmado, **confirmar varios a la vez**, ver, borrar y exportar a Excel.
  Vista de **pagos masivos** con su exportación.
- **Pagar una entrega** (desde la lista de entregas, su ficha o la lista de pagos): fecha, propósito,
  tipo de pago, monto (por defecto, el saldo), moneda, recibo, tipo de comprobante y documento de
  respaldo, con las reglas de la versión actual y del backend: el pago base exige el documento;
  "efectivo vía acopiador" solo si hay acopiador; pagar más que el saldo se avisa pero se permite;
  las entregas con precio a definir no se pagan.
- **Ver un pago:** un pago registrado no se edita (el backend no lo permite): se confirma (sin
  vuelta atrás) o se borra, y el saldo de la entrega se recalcula.
- **Pago masivo** (transferencia por lotes): se eligen entregas en la lista (escritorio y celular),
  cada una con su saldo editable, al productor o al acopiador si se paga vía acopiador. Muestra la
  cuenta bancaria de cada destinatario y **no deja registrar si falta alguna** (con enlace a la
  ficha para cargarla), igual que la versión actual. Descripción y recibo obligatorios, costo
  adicional con su descripción, documentos adicionales con tipo y fecha, total a transferir.
- **Ficha de la entrega:** sus pagos y "Registrar pago". **Ficha del productor:** "Sus pagos" ya
  abre la v2.
- Reglas tomadas del backend que la versión actual no explicita: el backend ignora el "monto pagado
  al acopiador" (lo guarda en 0), así que la v2 pide un solo monto; el pago masivo necesita la lista
  de documentos aunque esté vacía (si no, falla); un pago masivo lleva una sola moneda.

**Arreglado en el camino (de fases anteriores):**
- **Buscador de personas (3a):** Enter elegía un resultado de la búsqueda anterior si se apretaba
  antes de que llegara la nueva (fácil de provocar cargando rápido); y solo buscaba por nombre, no
  por apellido. Ahora Enter solo elige de la lista que corresponde a lo escrito, y se busca por
  nombre y apellido a la vez.
- **Pantallas con tablas anchas en el celular (desde la 3b):** el navegador alejaba la página
  entera. Los textos ocultos para lectores de pantalla (posición absoluta) se salían del contenedor
  con scroll horizontal. Todo contenedor con scroll horizontal es ahora `relative`, y una prueba
  nueva recorre las pantallas y falla si alguna es más ancha que la ventana (comprobado: con el código
  anterior falla en "Todo el stock"). Las mediciones de las fases anteriores no lo vieron porque
  usaban una ventana angosta de escritorio, no la emulación de un celular.

**Pruebas:** 73 unitarias (9 nuevas de pagos), 68 de punta a punta simuladas (escritorio y celular;
4 de pagos y la del ancho de pantalla, nuevas) y 11 contra el backend real (2 nuevas: pagar una
entrega con documento → saldo → confirmar → borrar; y pago masivo, que primero comprueba el bloqueo
por falta de cuenta y luego carga una cuenta de prueba por la API y la restaura al terminar).

**Nota sobre la copia aislada:** el backend no tiene forma de borrar un pago masivo; cada corrida de
la prueba de pago masivo deja un registro "E2E-MASIVO" sin pagos.

## Fase 3e.1 (órdenes entre empresas) — ✅ cerrada el 29.10.2026 (rama `fase-3`)

La pestaña **Órdenes** pasa a la v2 para los pedidos entre empresas de la cadena. Los pagos a
empresas y los pedidos de clientes llegaron en 3e.2; Beyco queda para 3e.3.

- **Emitidas / Recibidas:** emitidas son los pedidos que esta empresa hizo; recibidas, los que otras
  empresas le hicieron (esta es el proveedor). Filtros por instalación, semiproducto, cliente y
  "solo abiertas" (en la URL), cumplido sobre pedido, abierta / cumplida, trazabilidad, QR y mapa.
- **Nuevo pedido:** se elige la instalación que recibe y la plantilla de pedido (acción de envío
  de la empresa); el proveedor sale de las instalaciones públicas de otras empresas que venden ese
  semiproducto (si hay una sola, queda elegida). Cantidad pedida, fecha de entrega y número de orden.
  El comprador no ve el stock del proveedor.
- **Completar (proveedor):** abre la orden con lo pedido, lo enviado y lo que falta; el proveedor
  elige lotes de su stock y la v2 toma solo lo que falta. Lo pedido no se puede cambiar. Lo enviado
  queda **pendiente** hasta que el comprador lo resuelva.
- **Aprobar o rechazar (comprador):** cada envío pendiente se aprueba o se rechaza; **rechazar exige
  el motivo**. Lo aprobado suma a lo cumplido; lo rechazado queda anulado con su motivo a la vista.
- **Borrar:** solo el comprador y solo si nada de lo cumplido ya se usó.
- Reglas tomadas del backend: el pedido es una orden general de la instalación del comprador con la
  instalación del proveedor como "a quién se pide"; las transacciones del proveedor nacen pendientes.

**Pruebas:** 77 unitarias (4 nuevas de pedidos), 78 de punta a punta simuladas (escritorio y celular;
4 nuevas de órdenes: rechazar pide motivo, aprobar suma, el proveedor completa, nuevo pedido) y
contra el backend real 12 de 13 (la de convivencia necesita sus propias variables; ver
`e2e-real/README.md`). La nueva real recorre el ciclo entre dos empresas: la productora registra
café, la exportadora le pide 500, la productora completa con su stock (se toma solo lo que falta),
la exportadora aprueba (orden cumplida) y se borra todo. Necesita `scripts/sembrar-ordenes.mjs`
(segunda empresa, su bodega y una plantilla de pedido; solo en copias aisladas).

## Fase 3e.2 (pagos a empresas y pedidos de clientes) — ✅ cerrada el 29.10.2026 (rama `fase-3`)

- **Pagar una orden emitida** a la empresa proveedora (desde Órdenes → Emitidas): como la versión
  actual, siempre por transferencia y con recibo; fecha, propósito, monto, moneda, número de recibo
  y documento (obligatorio si es pago base). El pago aparece en **Pagos** con la empresa como
  destinatario y enlaza a la orden; se confirma o se borra igual que los pagos a productores.
- **Pedido de cliente** (orden de producto): número de orden, cliente, instalación propia que
  recibe, fecha límite, "solo café de mujeres" / "solo orgánico" y uno o más productos finales
  (solo los que maneja la instalación), cada uno con a quién se le pide (si hay uno solo, queda
  elegido), cantidad, precio por unidad al cliente y moneda; el nombre del lote se arma solo, como
  en la versión actual. Cada producto queda como una orden emitida "Para <cliente>" que el
  proveedor completa desde Recibidas, igual que cualquier pedido.
- Si la empresa no tiene clientes o plantillas de pedido de producto final, la pantalla lo dice y
  enlaza a la versión actual, donde se crean.

**Arreglado en el camino (3e.1):** al completar un pedido de producto final, la v2 exigía un
semiproducto en la salida (solo lo eximía en los traslados). Una prueba unitaria nueva lo cubre
(comprobado: falla con la regla anterior).

**Pruebas:** 85 unitarias (8 nuevas), 82 de punta a punta simuladas (pagar una orden y pedido de
cliente, en escritorio y celular; y 5 pantallas más en la prueba de ancho) y contra el backend real
13 de 14 (la de convivencia necesita sus propias variables). La real de órdenes ahora también paga
la orden a la productora, verifica el pago en Pagos y lo borra; y una nueva crea un pedido de
cliente como exportadora, comprueba que la productora lo ve en Recibidas y lo puede abrir para
completarlo, y lo borra. `scripts/sembrar-ordenes.mjs` suma un cliente, el producto final en las dos
instalaciones y la plantilla de pedido de producto final.

**Sin probar contra el backend real:** completar un pedido de producto final con stock, porque la
copia aislada no tiene stock de producto final (haría falta una acción de procesamiento final para
la productora). En modo simulado, sí. **Nota:** al borrar un pedido de cliente se borra su orden; la
cabecera del pedido queda en la base, porque el backend no tiene forma de borrarla (igual que en la
versión actual).

## Fase 3e.3 (Beyco) — ✅ cerrada el 31.10.2026 (rama `fase-3`) · probada sin Beyco real

Exportar lotes a **Beyco** (marketplace de café verde) como oferta, igual que la versión actual.
**No hay cuenta de Beyco de pruebas:** el envío real a Beyco queda sin probar hasta tener acceso.

- **Todo el stock:** si la empresa tiene Beyco habilitado y la instalación lo configuró
  (`BEYCO_AUTH_URL` y `BEYCO_CLIENT_ID`, las mismas variables que la versión actual), la lista por
  orden muestra casillas y **«Exportar a Beyco (N)»**.
- **Autorización (OAuth2):** se sale a Beyco con los mismos parámetros que la versión actual y un
  `state` aleatorio guardado en la pestaña; al volver, el `state` tiene que coincidir (si no, se
  rechaza) y el backend cambia el código por el token. El token vive solo en memoria (se pierde al
  recargar o al salir) y **se renueva antes de enviar si venció**. En la versión actual esa
  renovación nunca funciona (pasa el método sin enlazar y no se suscribe al resultado).
- **Oferta:** el backend la precarga desde los lotes (cosecha, puerto según la instalación,
  zaranda, taza, grado y sellos de la empresa). Las mismas validaciones de la versión actual:
  título hasta 70 caracteres, zaranda 8–20 con mínima ≤ máxima, taza 60–100 (desde 80 se marca
  especialidad), textos libres cuando se elige «Otro». Selección múltiple accesible para
  variedades, segmento, grados y sellos.
- **Mejora sobre la versión actual:** el backend nombra cada café con el número interno del lote,
  que las entregas no tienen, así que llegaba vacío. La v2 lo completa con el identificador del lote.

**Pruebas:** 92 unitarias (7 nuevas de Beyco), 86 de punta a punta simuladas (2 nuevas en escritorio
y celular: el ciclo completo con autorización simulada, y el rechazo de una vuelta con otro `state`)
y una nueva contra el backend real (`scripts/sembrar-beyco.mjs` habilita Beyco en la empresa demo de
la copia aislada). Esa prueba intercepta la salida hacia Beyco y simula su vuelta. Verifica: los
parámetros de la salida y el `state`, que sin Beyco configurado el backend no entrega token y la v2
lo muestra limpio, y la precarga real desde un lote recién creado.

## Fase 5a.1 (ficha de producto) — ✅ cerrada el 31.10.2026 (rama `fase-5`)

Primera parte de «Productos y etiquetas». Rutas `/productos` (lista con búsqueda; el administrador
puede ver todos), `/productos/nuevo` y `/productos/$id`.

- **Ficha por secciones**, como el modo producto de la versión actual: datos (nombre, descripción,
  foto), origen (texto y lugares en el mapa), proceso, responsabilidad social, sostenibilidad
  ambiental y ajustes (idioma de la vitrina, textos de GDPR, privacidad y términos). Índice lateral
  que marca las secciones con errores. Mismos obligatorios que la versión actual.
- **Lugares de origen en el mapa:** tocar el mapa agrega un lugar; los pines van numerados igual
  que la lista y se arrastran. Cada lugar lleva nombre, coordenadas y número de productores.
- **Solo la empresa dueña edita y borra**, como en la versión actual; las empresas asociadas lo ven
  en solo lectura. (El backend sí deja actualizar a las asociadas, a propósito según sus pruebas;
  la v2 sigue el criterio de la interfaz actual.)
- **Lección de H16 aplicada:** el backend reescribe el producto completo con lo que recibe. La v2
  parte del producto tal como vino (empresas asociadas, etiquetas, vitrina, recorrido…) y cambia
  solo los campos de la ficha. La prueba real lo verifica.
- **Idioma obligatorio:** la base no acepta un producto sin idioma (el backend respondía 500); la v2
  lo exige y, al crear, propone el idioma de la interfaz.
- **Alta:** se elige la cadena de valor de la empresa; si la empresa no tiene ninguna, se avisa y se
  enlaza a la versión actual para configurarla.
- **Corrección arrastrada de la sincronización:** desde upstream 1db6e5f los documentos privados ya
  no se sirven por `/api/public/document`. Recibos, fotos y adjuntos de la v2 pasan a
  `/api/common/document` y `/api/common/image/{key}/{tamaño}`; la vitrina sigue con la ruta pública.

**Pruebas:** 98 unitarias (6 nuevas de producto), 92 de punta a punta simuladas (6 nuevas en
escritorio y celular: lista y edición, solo lectura de un producto ajeno, alta con obligatorios, foto
y lugar en el mapa) y una nueva contra el backend real (`scripts/sembrar-productos.mjs` asigna la
cadena de valor 1 a la empresa demo de la copia aislada): alta con foto y origen, edición que
conserva lo demás, solo lectura desde la exportadora asociada y borrado.

Sigue 5a.2: vitrina del producto (ajustes B2C), recorrido, empresas asociadas y productos finales.
Después 5b (etiquetas), 5c (lotes, opiniones y estadísticas) y 5d (base de conocimiento).

## Fase 5a.2 (vitrina, recorrido, empresas y productos finales) — ✅ cerrada el 31.10.2026 (rama `fase-5`)

La ficha del producto pasa a tener pestañas: **Ficha · Vitrina y recorrido · Empresas · Productos
finales**. Etiquetas y base de conocimiento siguen abriendo la versión actual (5b y 5d). La cabecera
(nombre, empresa dueña, cadena, borrar) y el aviso de solo lectura son comunes a todas las pestañas.

- **Vitrina y recorrido** (sección "B2C settings" y "Product journey" de la versión actual): colores
  con selector, tipografías del título y del texto, imágenes de portada y encabezado, pestañas de la
  vitrina con su posición, gráficos de precios y precios de referencia, texto de transparencia y el
  recorrido como paradas en el mapa unidas por una línea, con flechas para cambiar el orden.
  Validación de colores (#rrggbb), posiciones (enteros desde 1) y precios (≥ 0).
- **Detalle encontrado:** el backend guarda por defecto el color del título sin «#» (`25265E`); la v2
  lo normaliza para no perderlo al editar.
- **Cada etiqueta guarda su propia copia** de la apariencia al crearse (`ProductLabelContent.fromProduct`)
  y la vitrina pública usa la de la etiqueta cuando tiene valores: la pestaña lo explica.
- **Empresas:** las de la cadena agrupadas por rol. Asociar y quitar lo hace solo la administración
  del sistema o regional, igual que en la versión actual y en el backend (que ignora el cambio de
  cualquier otra persona); siempre queda al menos una dueña. Los **acuerdos de uso de datos**
  (descripción y documento) los carga la empresa dueña.
- **Productos finales:** lista, alta, edición y borrado con nombre, descripción, unidad y las
  etiquetas que lo acompañan. Edita la empresa dueña. El backend exige la lista de etiquetas aunque
  esté vacía: la v2 siempre la manda.
- Todo se guarda sobre el producto completo tal como vino (lección de H16): la prueba real comprueba
  que guardar la vitrina no toca el origen ni el proceso.

**Pruebas:** 102 unitarias (4 nuevas), 102 de punta a punta simuladas (10 nuevas en escritorio y
celular: vitrina y recorrido, acuerdos, asociar y quitar empresas como administración, productos
finales y solo lectura de un producto ajeno; el modo simulado acepta `sessionStorage["simulado.rol"]`
para probar como administración) y una nueva contra el backend real (`e2e-real/productos-partes.spec.ts`,
crea su producto por la API y lo borra al terminar).

## Fase 5b (etiquetas) — ✅ cerrada el 31.10.2026 (rama `fase-5`)

Nueva pestaña **Etiquetas** del producto: `/productos/$id/etiquetas` (lista y alta) y
`/productos/$id/etiquetas/$etiqueta` (editor).

- **Alta:** nombre e idioma. La etiqueta copia el contenido y la apariencia del producto y, como en
  la versión actual, al principio muestra solo los datos del producto (nombre, foto, descripción,
  origen) y el recorrido.
- **Editor:** el mismo formulario de la ficha (componente compartido) con un interruptor «Se
  muestra / Oculto» en cada campo; los datos de la empresa dueña (solo lectura, se editan en su
  ficha) con su visibilidad; la apariencia, pestañas, precios y recorrido propios de la etiqueta
  (el mismo editor de la pestaña Vitrina); y los **videos y fotos** de las empresas de la cadena
  (un solo video, como muestra la vitrina). Se guarda en tres llamadas como la versión actual
  (título y campos, contenido, medios), respetando el orden de campos que ya tenía la etiqueta y
  los campos que la v2 no conoce.
- **Publicar / retirar** (deshabilitado con cambios sin guardar), **ver en la vitrina** cuando está
  publicada y **borrar**. Lotes, opiniones y estadísticas siguen enlazando a la versión actual (5c).
- **Vista previa con la vitrina de la v2:** abre en otra pestaña la vitrina tal como quedaría con
  lo que hay en el editor, aunque no esté guardado ni publicada. Se arma igual que el backend arma
  la pública (campos visibles, apariencia del producto con la de la etiqueta encima, medios
  elegidos) y se guarda en este navegador por 24 horas con un identificador propio (`previa-<id>`),
  así que nunca reemplaza a una etiqueta real. En la vista previa los documentos se piden por la
  ruta autenticada, una franja avisa que es vista previa y no se envían opiniones.
- **Mejora sobre la versión actual:** la etiqueta puede mostrar el texto de transparencia de
  precios (`settings.incomeIncreaseDescription`), que la vitrina ya sabía leer pero la versión
  actual no dejaba hacer visible.

### H23 🟠 — la copia del producto en una etiqueta perdía datos (backend; corregido)

Encontrado con la prueba real; también está en el original (AgStack `main` 19d0ea3):

1. `Responsibility.copy()` devolvía un objeto vacío: la etiqueta nueva perdía las políticas laborales.
2. `ProductLabelContent.fromProduct` copiaba los lugares de origen sin vincularlos a la etiqueta:
   quedaban huérfanos en la base.
3. `updateProductLabelContent` reemplazaba los lugares en una copia de la lista: los lugares de una
   etiqueta nunca se guardaban.

**Corregido en el backend del contrato** (dapdevs/inatrace-enhanced `46c2b89`, prueba
`ProductLabelContentCopyTest`, 377 pruebas en verde) y **propuesto al original como
[PR #116](https://github.com/agstack/inatrace-backend/pull/116)** (31.10.2026, CI en verde). La copia
aislada corre `inatrace-backend:dev-h23`. La v2 no necesita compensarlo; la prueba real verifica que
la etiqueta trae las políticas y los lugares del producto y que los lugares de la etiqueta se guardan.
Las etiquetas creadas antes del arreglo se completan editándolas.

**Pruebas:** 110 unitarias (8 nuevas de etiquetas), 108 de punta a punta simuladas (6 nuevas en
escritorio y celular: alta, visibilidad, medios, publicación; vista previa con cambios sin guardar;
retirar y borrar) y una nueva contra el backend real (`e2e-real/etiquetas.spec.ts`: crea su producto
con foto por la API, crea la etiqueta, comprueba campos y contenido en el backend, la vista previa
sin publicar, la vitrina pública de la v2 al publicar, retirar y borrar).

## Fase 5c (lotes, opiniones y estadísticas) — ✅ cerrada el 31.10.2026 (rama `fase-5`)

Cada etiqueta tiene ahora subpestañas: **Contenido · Lotes · Opiniones · Estadísticas**
(`/productos/$id/etiquetas/$etiqueta/…`).

- **Lotes:** lista con búsqueda por número y páginas; alta, edición y borrado. Número obligatorio y
  solo letras ASCII y números (el backend valida con `\p{Alnum}` de Java: guiones, tildes y ñ dan
  «Invalid field(s)»). Verificación de autenticidad con al menos una fecha (el vencimiento no puede
  ser anterior a la producción); rastreo de origen con al menos un lugar en el mapa y un botón para
  usar los lugares del producto; foto del lote. La prueba real comprueba que el consumidor puede
  verificar el lote sin sesión.
- **Opiniones:** filtro por tipo, correo con su consentimiento, edad, género y sabor; borrar y
  exportar quedan para la empresa dueña. **La exportación incluye solo los correos de quienes dieron
  su consentimiento** (la versión actual exportaba todos).
- **Estadísticas:** visitas desde los QR con su reparto por país y un mapa de puntos proporcionales,
  y las verificaciones de autenticidad y de origen (el backend las agrega cada minuto).

### H24 🟠 — la lista pública de opiniones exponía datos de los consumidores (backend; corregido)

Al migrar la página de opiniones: `GET /api/public/product/label/feedback/list/{labelUid}` no pide
sesión y entregaba correo, edad, género y consentimientos de cada opinión. El identificador de la
etiqueta va impreso en cada QR, así que cualquiera con el producto podía listarlos. La versión actual
usaba esa ruta pública para su página de opiniones. Está igual en el original (AgStack 19d0ea3).

**Corregido en el backend del contrato** (dapdevs/inatrace-enhanced `5f9fd0b`, privado): la lista
pública conserva tipo y texto; la nueva ruta con sesión `GET /api/product/label/{id}/feedback/list`
entrega todo a las empresas del producto, y la interfaz actual pasa a usarla. Prueba
`ProductLabelFeedbackPrivacyTest`; 380 pruebas del backend y compilación de Angular en verde. La
v2 usa la ruta nueva (SDK regenerado). **Al original va por correo privado, como consulta**: que la ruta sea pública es intencional (su
issue #37); lo dudoso es que entregue los datos personales. Parches y texto en `upstream/seguridad/`
del repo del contrato; lo envía Rolo. La copia aislada
corre `inatrace-backend:dev-h24` y `inatrace-frontend:dev-h24`.

**Pruebas:** 115 unitarias (5 nuevas), 114 de punta a punta simuladas (6 nuevas en escritorio y
celular) y una nueva contra el backend real (`e2e-real/etiqueta-partes.spec.ts`: lote con
verificación pública, opinión cuyo correo no sale por la ruta pública y sí en la de la empresa,
estadísticas y limpieza).

## Fase 5d (base de conocimiento) — ✅ cerrada el 01.11.2026 (rama `fase-5`)

Con esto **la fase 5 («Productos y etiquetas») queda completa**: el producto ya no tiene pestañas que
abran la versión actual.

- **Base de conocimiento** (`/productos/$id/conocimiento`): lista con filtro por tema (equidad,
  calidad, origen) y páginas, las más nuevas primero (el backend solo ordena por id o tema; la
  versión actual ofrecía ordenar por título y fecha, pero el backend lo ignoraba). Alta y edición en
  línea: tema, título, fecha, resumen, contenido, video y documentos (PDF o imagen, varios a la vez).
  **El tema no se puede cambiar** después de crear la entrada (el backend no lo actualiza); la v2 lo
  muestra fijo en vez de dejar que parezca editable.
- Resumen y contenido llegan como HTML (la versión actual usaba un editor enriquecido); se editan como
  texto, con contador de caracteres hasta los límites del backend (3000 y 5000), y la **vista previa**
  los muestra saneados con `HtmlSeguro`. El video se guarda con `https://` si se escribió sin
  protocolo y solo se enlazan direcciones http(s).
- Título obligatorio (la versión actual dejaba guardar entradas sin título, que se veían vacías en la
  lista).
- La administra la empresa dueña o la administración del sistema (`checkProductPermissionAssoc` mira
  la empresa del producto); las demás ven un aviso.
- **Borrar** una entrada usa la ruta nueva del backend del contrato (H25, abajo).
- **Lo que no tiene arreglo en la v2:** la vitrina pública no muestra estas entradas (la versión
  actual tampoco: su página `/blog/…` usa la ruta con sesión y nada enlaza a ella).

### H25 🟡 — un producto con entradas en la base de conocimiento no se podía borrar (backend; corregido)

`DELETE /api/product/{id}` borra las etiquetas y sus lotes, pero no las entradas de
`KnowledgeBlog`: la clave foránea hace fallar el borrado con 500 («Cannot delete or update a parent
row»). Y no existe una ruta para borrar entradas, así que **un producto con una sola entrada ya no se
puede borrar** desde ninguna interfaz. Encontrado al limpiar la prueba real. Está igual en el original.
**Corregido en el backend del contrato** (`9baaa5b`): el producto se borra con sus entradas y la
nueva ruta `DELETE /api/product/knowledgeBlog/{id}` borra una entrada; prueba
`KnowledgeBlogDeletionTest`, 382 pruebas en verde. Al original como PR
[#117](https://github.com/agstack/inatrace-backend/pull/117) (01.11.2026). La copia aislada corre
`inatrace-backend:dev-h25` (respaldo previo `v2demo-antes-h25.sql`). La v2 regeneró el SDK, agrega
el botón de borrar y ya no necesita avisar antes de borrar un producto (lo hizo mientras tanto).
La prueba real borra una entrada desde la pantalla y después el producto con otra entrada.

**Pruebas:** 118 unitarias (3 nuevas), 116 de punta a punta simuladas (2 nuevas en escritorio y
celular, más la página en la prueba de ancho) y una nueva contra el backend real
(`e2e-real/productos-partes.spec.ts`: alta con documento y video, lectura por la API, edición que
conserva tema y documentos, filtro). Suite real: 24 de 25 (la de QR de convivencia falla en el
servidor de desarrollo, como siempre).

## Fase 4a.1 (ficha y usuarios de la empresa) — ✅ cerrada el 02.11.2026 (rama `fase-5`)

Arranca la fase 4 («Empresa y administración»), dividida en 4a (empresa propia: ficha, usuarios,
instalaciones y acciones de procesamiento), 4b (recolectores, clientes y tablero), 4c (administración
del sistema), 4d (catálogos y ajustes) y 4e (cuenta). Nueva entrada **Empresa** en la barra
(`/empresa`, la empresa elegida arriba) con pestañas **Ficha · Usuarios**; instalaciones y acciones
siguen abriendo la versión actual (4a.2 y 4a.3).

- **Ficha:** datos básicos y logo, sede, descripción y contacto, cadenas de valor (al quitar una avisa
  que el procesamiento en esa cadena deja de funcionar), moneda base, Beyco, certificaciones, videos,
  registros de producción, «Conoce a los productores» y redes sociales. Mismas reglas que la versión
  actual (nombre, logo, dirección, descripción, correo, teléfono, moneda y una cadena obligatorios;
  abreviatura de 3 a 6). La edita la administración de la empresa o del sistema, como el backend.
- **El backend reemplaza todos los campos** de la ficha con lo que recibe: la v2 guarda siempre sobre
  la empresa tal como llegó y no manda los usuarios (se administran aparte). Los documentos conservan
  su id, así se actualizan en vez de recrearse.
- **Detalles encontrados:** el backend valida la moneda completa (código y nombre), no solo el id
  («Invalid field(s) in request»); la frase de «Conoce a los productores» queda opcional porque hay
  fichas cargadas sin ella y el backend no la exige (la versión actual solo la pedía al editar ese
  elemento).
- **Usuarios:** lista con rol y estado. Cambiar de rol, sumar (buscando entre las cuentas de la
  instancia) y quitar lo hace la administración del sistema o regional, como en la versión actual.
  **La v2 no deja a la empresa sin nadie con rol de administración** (el backend no lo impide).
- **Monedas en la copia aislada:** el backend las trae de exchangeratesapi.io con una llave que la
  demo no tiene, así que la tabla estaba vacía y ninguna empresa podía elegir moneda (tampoco en la
  versión actual). `scripts/sembrar-monedas.sql` carga seis, solo para copias aisladas.

### H26 🟡 — la «gerencia» de la empresa nunca se guardaba (backend; corregido)

`Company.manager` se devuelve al leer la ficha, pero ninguna actualización lo escribe
(`setManager` no se llama en ningún lado). La versión actual lo muestra editable y lo pierde sin
avisar. Está igual en el original (19d0ea3). **Corregido en el backend del contrato** (`cd831d5`) y
propuesto al original como PR [#118](https://github.com/agstack/inatrace-backend/pull/118)
(02.11.2026). La copia aislada corre `inatrace-backend:dev-h26` (respaldo previo
`v2demo-antes-h26.sql`) y la v2 deja editar el campo; la prueba real comprueba que se guarda.

**Pruebas:** 121 unitarias (3 nuevas), 122 de punta a punta simuladas (3 nuevas en escritorio y
celular, más las dos páginas en la prueba de ancho) y una nueva contra el backend real
(`e2e-real/empresa.spec.ts`: guarda la ficha completando logo, teléfono y moneda, comprueba que lo
demás no cambió, que la única administración no pierde el rol y deja la ficha como estaba). Suite
real: 25 de 26 (la de QR de convivencia, como siempre). En escritorio, el texto «Versión actual» de la
barra se muestra desde 2xl para que la entrada nueva quepa.

## Fase 4a.2 (instalaciones) — ✅ cerrada el 02.11.2026 (rama `fase-5`)

Nueva pestaña **Instalaciones** de la empresa (`/empresa/instalaciones`), con alta y edición en su
propia página.

- **Lista:** todas, también las desactivadas, con tipo, lugar y si son de acopio o venden; mapa con
  las que se muestran en el mapa público. Activar, desactivar (con confirmación) y **borrar**, que la
  versión actual no ofrecía: el backend solo lo permite si la instalación no tiene movimientos
  (entregas, transacciones, pedidos o acciones) y la v2 muestra su motivo si no.
- **Formulario:** tipo, nombre por idioma, ubicación (país; en Ruanda aldea, celda y sector, en el
  resto dirección; si se muestra en el mapa, el punto en el mapa o las coordenadas), si es de acopio,
  si vende, los campos que se muestran al registrar entregas, cadenas de valor, semiproductos y
  productos finales. Una instalación nueva arranca con la cadena si la empresa tiene una sola.
- **Nombres por idioma:** el backend no tiene respaldo (en un idioma sin nombre la instalación aparece
  vacía). La versión actual exigía el inglés; la v2 exige al menos uno y completa los vacíos con el
  primero escrito.
- **El backend reemplaza todo** (incluido si está desactivada y las traducciones que no lleguen): se
  guarda sobre la instalación tal como llegó, con el tipo y el país completos de los catálogos.
- **Semiproductos:** no dicen de qué cadena son, así que al quitar una cadena se vacían, como en la
  versión actual.
- **Copia aislada:** los semiproductos no estaban asociados a ninguna cadena, así que una instalación
  nueva no podía elegir ninguno (tampoco en la versión actual). `scripts/sembrar-productos.mjs` ahora
  los asocia a la cadena de café por la API (respaldo previo `v2demo-antes-semis.sql`).

**Pruebas:** 126 unitarias (5 nuevas), 126 de punta a punta simuladas (4 nuevas en escritorio y
celular, más tres páginas en la prueba de ancho) y una nueva contra el backend real (crear desde la
pantalla, comprobar por la API nombres, ubicación, opciones, cadenas y semiproductos, desactivar,
activar y borrar). Suite real: 26 de 27 (la de QR de convivencia, como siempre).

## Fase 4a.3 (acciones de procesamiento) — ✅ cerrada el 02.11.2026 (rama `fase-5`)

Nueva pestaña **Acciones de procesamiento** de la empresa (`/empresa/acciones`), con alta y edición en su
propia página. Con esto **la empresa propia (4a) queda completa**: ninguna pestaña de la empresa abre la
versión actual, y los avisos de stock y productos que mandaban a la versión actual para crear acciones o
asignar cadenas ahora llevan a la v2.

- **Lista:** nombre, tipo, prefijo y recorrido (lo que entra → lo que sale), con búsqueda.
- **Formulario según el tipo** (mismas reglas que la versión actual y el backend): procesamiento
  (entrada y al menos una salida, cada una reempacable con su máximo, y rendimiento estimado),
  procesamiento final (entrada y producto final, reempaque opcional), pedido y traslado (de
  semiproductos o de productos finales), generar QR (entrada y producto final del QR). Prefijo de los
  lotes, orden, instalaciones donde empieza, nombre y descripción por idioma, etiqueta en la
  trazabilidad pública, y campos y documentos que se piden al registrarla (obligatorio, obligatorio en
  el pedido o uno de un grupo, que se excluyen como en la versión actual).
- **El backend exige la traducción al inglés** con nombre y descripción: la v2 pide el nombre en al
  menos un idioma y completa los vacíos con el primero escrito. Al guardar se mandan solo los productos
  del tipo elegido. Al quitar una cadena se vacía lo que depende de ella, como en la versión actual.
- Después de un intento de guardar, los errores se recalculan a medida que se corrigen.
- `SiNo` y `Fichas` pasan a `paginas/empresa/piezas.tsx` (los usan instalaciones y acciones).

### H27 🟡 — borrar una acción con procesos respondía 500 (backend; corregido)

`DELETE /api/chain/processing-action/{id}` borra sin revisar si hay procesos hechos con la acción; la
clave foránea de `ProcessingOrder` hace fallar el borrado con 500 («Cannot delete or update a parent
row») y se revierte, así que no se pierde nada, pero no se explica por qué. Está igual en el original.
Las instalaciones sí tienen esa revisión (`assertFacilityHasNoBusinessHistory`). La v2 muestra que si
ya se registraron procesos con la acción, el backend no permite borrarla. **Corregido en el backend del
contrato** (respuesta 400 con un mensaje claro) y propuesto al original como PR
[#122](https://github.com/agstack/inatrace-backend/pull/122) (02.11.2026).

**Pruebas:** 130 unitarias (4 nuevas), 130 de punta a punta simuladas (4 nuevas en escritorio y
celular, más tres páginas en la prueba de ancho) y una nueva contra el backend real (crear un
procesamiento con salida reempacada, comprobar por la API tipo, productos, rendimiento y la traducción
al inglés completada, cambiarlo a traslado y borrarlo). Suite real: 27 de 28 (la de QR de convivencia).

## Fase 4b.1 (recolectores y clientes) — ✅ cerrada el 02.11.2026 (rama `fase-5`)

- **Recolectores** (`/productores/recolectores`, pestaña junto a Productores): son el mismo modelo que
  un productor, de tipo `COLLECTOR`, así que usan la misma ficha sin finca, certificaciones ni
  parcelas (como la versión actual); esas partes se mandan tal como estaban. Lista con búsqueda y
  páginas; la casilla de la empresa dice «Recolecta para…». La versión actual muestra además sus
  compras y pagos; la ficha del productor de la v2 tampoco los muestra, queda para cuando se sume a
  ambos.
- **Clientes** (pestaña de la empresa, `/empresa/clientes`): alta y edición en línea, con nombre,
  razón social, identificación fiscal, contacto, correo, teléfono y la dirección según el país (como
  la de un productor). Se guarda sobre lo que llegó. La sección «SKU prices» de la versión actual no
  se porta: no se carga ni se guarda. El aviso de los pedidos de clientes sin clientes lleva a esta
  pestaña: **ya ningún aviso de stock manda a la versión actual**.
- En el modo simulado, productores y recolectores están en la misma lista (como en el backend) y se
  separan por tipo.

### H28 🟡 — borrar un cliente con pedidos (o inexistente) respondía 500 (backend; corregido)

`DELETE /api/company/companyCustomers/{id}` hace `em.remove` sin revisar los pedidos del cliente
(`ProductOrder.customer`, `StockOrder.consumerCompanyCustomer`): con pedidos falla la clave foránea con
500 y se revierte. Si el id no existe, `em.find` devuelve `null` y responde 500 por un
NullPointerException. Comprobado en la copia aislada (cliente con 13 pedidos; id inexistente). Está
igual en el original. La v2 explica la causa probable. **Corregido en el backend del contrato** (400
claros) y propuesto al original como PR [#123](https://github.com/agstack/inatrace-backend/pull/123)
(02.11.2026).

**Pruebas:** 133 unitarias (3 nuevas), 134 de punta a punta simuladas (2 nuevas en escritorio y
celular, más tres páginas en la prueba de ancho) y una nueva contra el backend real (recolector
guardado como `COLLECTOR` y fuera de la lista de productores; cliente con su dirección; ambos se
borran). Suite real: 28 de 29 (la de QR de convivencia).

## Fase 4b.2 (tablero) — ✅ cerrada el 02.11.2026 (rama `fase-5`)

Nueva pestaña **Tablero** en Stock (`/stock/tablero`), portada de company-dashboard:

- **Entregas por período (kg):** fechas, centro de acopio, semiproducto (arranca con el primero, como
  la versión actual), productor, recolector y solo orgánico, solo café de mujeres o solo con precio
  a definir después; total del rango y exportación a Excel, CSV o PDF.
- **Rendimiento del procesamiento:** proceso (de procesamiento o procesamiento final), instalación,
  fechas y los campos de evidencia del proceso como filtros; entrada y salida en un gráfico y el
  rendimiento (%) en otro (**nunca dos ejes**, como pide la guía de gráficos); exportación.
- La agrupación (día, semana, mes, año) sale del largo del rango, con los mismos umbrales que la
  versión actual; el gráfico muestra hasta 24 períodos y la tabla, todos.
- **Gráficos propios en SVG** (`componentes/graficos/Barras.tsx`, sin librería nueva): barras finas
  con el extremo redondeado, cuadrícula discreta, tooltip con todas las series al pasar o con el
  teclado, leyenda desde dos series, vista de tabla y dibujo al ancho real del contenedor
  (desplazamiento horizontal si no entra). Colores `--serie-1/--serie-2` (azul y naranja) **validados**
  con el script de la guía en claro y oscuro (separación para daltonismo ΔE ≥ 24, contraste ≥ 3:1);
  el par marca/acento no pasaba. Revisado en capturas de escritorio y celular, claro y oscuro.

**Pruebas:** 136 unitarias (3 nuevas), 138 de punta a punta simuladas (2 nuevas en escritorio y
celular, más la página en la prueba de ancho) y una nueva contra el backend real (filtros de entregas
con agrupación por día, rendimiento sin errores con o sin datos, exportaciones). Suite real: 29 de 30
(la de QR de convivencia).

## Revisión de los PR en AgStack (03.11.2026)

- **Mergeados:** #113 (H22, borrar entrega), #116 (H23), #118 (H26), #122 (H27) y #123 (H28).
- **Cambios pedidos y respondidos:** #117 (H25: el borrado del producto quita también opiniones,
  vínculos y el contenido de sus etiquetas, y rechaza con 400 si hay productos finales, clientes o
  productores), #119 y frontend #33 (H24: lista pública con campos permitidos; cliente generado,
  exportación completa y manejo de errores en la página de opiniones). #112 (H22, recibos) espera la
  nueva revisión.
- Para la guía de contribución propuesta en #85: los PR abiertos tienen ahora firma DCO, un issue cada
  uno (#125, #126, #127 y frontend #34) y asuntos en formato Conventional Commits.
- **En la v2:** la exportación de correos de opiniones recorre todas las páginas (se cortaba en 1000)
  y el rechazo del backend al borrar un producto con productos finales, clientes o productores se
  explica en el idioma de la interfaz. La copia aislada corre `inatrace-backend:dev-rev117-119`
  (contrato `07fb83b`; respaldo previo `v2demo-antes-rev.sql`). Pruebas: 136 unitarias, 140 simuladas,
  reales 29 de 30 (la de QR de convivencia).

## Fase 4c.1 (administración: empresas) — ✅ cerrada el 03.11.2026 (rama `fase-5`)

Nueva sección **Administración** (`/administracion/empresas`), solo para la administración del
sistema y la regional (entrada en la barra y tarjeta en el inicio únicamente para esos roles):

- **Lista de empresas** con búsqueda (por comienzo del nombre, como el backend), filtro de estado
  (activa, registrada, desactivada) y páginas. La del sistema usa la lista completa; la regional, las
  empresas en las que está inscrita (no puede usar la otra).
- **Acciones según estado y rol, como el backend:** la del sistema activa, desactiva y **fusiona**
  (pasa las personas a otra empresa activa y desactiva la de origen; solo ofrece destinos activos y
  nunca la misma); la regional solo activa. Confirmación antes de cada una; el texto de la fusión
  aclara que productores, stock y demás datos no se mueven.
- **Crear empresa** con solo el nombre: quien la crea queda como su administración (lo hace el
  backend) y se abre la ficha para completarla.
- **Abrir:** la administración del sistema puede trabajar con cualquier empresa aunque no esté
  inscrita; la elegida se suma al selector de arriba y se recuerda al recargar.
- Con la entrada extra la barra no entraba (36 px en celular, ~150 px a 1280): para la administración
  los textos de la barra aparecen desde 2xl (antes, íconos con `title`) y en celular el enlace a la
  versión actual queda en las tarjetas del inicio. La prueba de ancho cubre ahora ese rol.

**Pruebas:** 140 unitarias (4 nuevas), 152 de punta a punta simuladas (5 nuevas en escritorio y
celular y la de ancho con la administración) y una nueva contra el backend real (crear, abrir,
buscar, activar, fusionar hacia la demo y desactivar; deja una empresa desactivada por corrida, ya
que el backend no borra empresas). Suite real: 30 de 31 (la de QR de convivencia).

## Fase 4c.2 (administración: usuarios) — ✅ cerrada el 03.11.2026 (rama `fase-5`)

Nueva pestaña **Usuarios** en Administración (`/administracion/usuarios`):

- **Lista** con búsqueda en nombre, apellido y correo, filtros de estado y rol, total y páginas. La
  administración del sistema ve todas las cuentas; la regional, las de sus empresas y las que todavía
  no tienen empresa, sin las desactivadas (lo decide el backend).
- **Acciones con las reglas de estado del backend:** confirmar el correo, activar (manda el correo de
  aviso), desactivar y dar o quitar los roles de administración regional y del sistema. Nunca sobre la
  propia cuenta, y a la administración del sistema no se la desactiva sin quitarle antes el rol.
  **La regional solo confirma y activa** (ver H29 abajo).
- **Ficha de cada persona** (`/administracion/usuarios/$id`): nombre, apellido e idioma editables
  (el correo no se puede cambiar), las mismas acciones y sus empresas (con «Administra» donde
  corresponde), que se abren para trabajar con ellas.

### H29 🔴 — la administración regional puede dar el rol de administración del sistema (backend; corregido, PR enviado)

`changeUserStatus` solo le niega a la regional `DEACTIVATE_USER`; los cambios de rol pasan, y el
control de empresa compartida se salta con cuentas sin empresa (cualquiera puede registrarse). En la
copia aislada, una regional convirtió una segunda cuenta suya en `SYSTEM_ADMIN` (después se limpió).
Está igual en el original. Arreglo con prueba (`RegionalAdminUserActionTest`, falla sin el arreglo):
a pedido de Rolando, enviado por PR al original ([#129](https://github.com/agstack/inatrace-backend/pull/129),
issue #128, 393 pruebas en verde) y aplicado en el contrato (`9835552`, 396 pruebas). La copia aislada
corre `inatrace-backend:dev-h29` (respaldo previo `v2demo-antes-h29.sql`): la misma escalada ahora
responde `UNAUTHORIZED`; suite real 32 de 33 (la de QR de convivencia). La v2 tampoco ofrece esas
acciones a la regional.

**Pruebas:** 144 unitarias (4 nuevas), 158 de punta a punta simuladas (3 nuevas en escritorio y
celular; la de ancho suma lista y ficha) y dos nuevas contra el backend real (una cuenta desechable
recorre todos los estados y roles y se edita; la ficha muestra las empresas, que el tipo generado no
declara). Suite real: 32 de 33 (la de QR de convivencia). Cada corrida real deja una cuenta
desactivada (el backend no borra cuentas).

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
4. **Fase 3 cerrada** (3a–3e.3). Queda probar Beyco de verdad cuando haya una cuenta de pruebas.
5. **Fase 5 cerrada** (5a.1–5d). En curso: fase 4 («Empresa y administración»): **4a cerrada**
   (ficha, usuarios, instalaciones y acciones) y **4b cerrada** (recolectores, clientes y tablero);
   siguen 4c (administración del sistema: **4c.1 empresas y 4c.2 usuarios cerradas**; falta
   4c.3 cadenas de valor), 4d (catálogos y ajustes) y 4e (cuenta).
6. H23: PR #116 **mergeado** en AgStack (02.11.2026); #113 también. Sigue abierto #112 (con los
   cambios pedidos ya respondidos).
7. H24: AgStack pidió enviarlo por PR (ver punto 9).
8. H25: esperar la revisión del PR #117 en AgStack.
9. H26: esperar la revisión del PR #118. H24 va por PR a pedido de AgStack: backend #119 y
   frontend agstack/inatrace-frontend#33.
10. H27: esperar la revisión del PR #122.
11. H28: esperar la revisión del PR #123.
   Criterio de salida de la fase: ciclo entrega → procesamiento → pago completo en la v2.
