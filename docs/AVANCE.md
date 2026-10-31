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
5. En curso: «Productos y etiquetas» (fase 5, ver arriba). Después, «Empresa y administración».
   Criterio de salida de la fase: ciclo entrega → procesamiento → pago completo en la v2.
