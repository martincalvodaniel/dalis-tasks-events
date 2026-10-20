# Recuperación explícita de conflictos

## 19k5d — Persistencia de primaria recurrente probada

La familia recurring_primary tiene captura y writer propios sobre el núcleo compartido de placements; APIs simple y mixed_group conservan sus schemas/guardias. Una TX9stores relee contexto y prerrequisitos acreditados, valida familia/IDs/capacidad/counter/tail, guarda posiciones/supersesión/0–1reemplazo/recibo atómicos y resuelve sólo tras commit. Replay primero no retrocede trabajo posterior. LocalSyncStore y feature comprueban actor/protocolo6/cuenta/época antes-después y cierran siempre; aviso sólo tras commit aplicado, no replay/fallo. Sin nuevo caller UI.

Once comprobaciones IndexedDB nativas aprobadas con primaria reprogramada y otras once con primaria implícita: readonly/caminos previos protegidos, contexto stale/foreign, remotos desconocidos, otra intención, rollback tardío total, IDs/overflow, backup/recarga/replay/tail, adopción sin ops/tail, capacidad posterior, epoch duranteopen y confirmaciones simultáneas→uncommit/unreplay/unaviso. Dos fallos iniciales de fixture detectaron marcador de inyección antiguo y selector que no llegaba al constructor; corregidos sin cambios de guardias del producto. Todas las particiones/control/pestañas/servidores propios retirados. Capturas /private/tmp/dalis-recurring-placement-native-{moved,implicit}.png. El ajuste final del selector fue sólo tipado explícito.

DoD1184pass/225skip/0fail/13098aserciones, lint1029 sin avisos/tipos/Webpack/worker46/diff aprobados. Tras tsc del selector se repitieron lint/tipos/build sin repetir la suite ya aprobada. Entrada83%5h/83%7d, reservas10%/1%, secuencial; sin Mongo/Next nuevos ni índices/protocolo/dependencias/DBusuario. Siguiente19k5e: prueba Next compilado con productores reales recurrentes, conflicto/CAS/recarga/respuesta perdida/ACK único y convergencia porgrupo en dos orígenes/Mongo propios, antes de UI activa.


## 19k5c — Evidencia portable de primaria recurrente

Backup3 admite recurring_primary y selecciona su validador específico antes de reutilizar las guardias comunes de placements. Conserva originales superseded exactos, outcome congelado, prerrequisitos acreditados por operaciones/outcomes aplicados coincidentes y reemplazo exacto de la misma aparición. IDs globales y propiedad exclusiva de cada intención siguen protegidos. Quitar la marca no convierte la decisión en recuperación simple válida; pending intentado y ediciones posteriores son portables, sin inventar ACK.

Catorce tests nuevos/72 aserciones: moved/implicit × día/atrasadas × adopción/retry, roundtrip y formato2 rechazado, truncaciones/corrupción de historia/reemplazo/familia, intento sinrespuesta, proyección multiefecto por planners productivos puros, ACK previo con evidencia real y exclusividad/IDs. La fixture de prerrequisito se corrigió para usar la clave y el efecto de la aparición, sin relajar schemas. DoD1184pass/225skip/0fail/13098aserciones, lint1027 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada86%5h/84%7d, reservas10%/1%, secuencial. Sin IO ni caller nuevo; la prueba de resultado aplicada es un modelo puro, no un recibo Mongo nuevo. Siguiente19k5d: TX local/captura/feature y prueba IndexedDB nativa de replay/capacidad/rollback/cuenta, antes de Next/UI.


## 19k5b — Decisión de primaria recurrente preparada

Familia explícita recurring_primary en request/record, separada de mixed_group y del camino simple. Permite adoptar posiciones conocidas sin operaciones o reconstruir únicamente el último movimiento exacto con UUID nuevo y CAS actual del slot. Reutiliza el planner remoto y conserva revisiones observadas en optimismo; sólo un recibo remoto podrá avanzarlas. Validación reconstruye toda la decisión y protege identidad, snapshot obsoleto, originales y efectos. Vecinos obsoletos o tombstone de posición mantienen sólo adopción. Sin portable, persistencia ni caller nuevo todavía.

Siete tests nuevos/76 aserciones: moved/implicit × día/atrasadas, familia estricta, CAS independiente, supersesión exacta, adopción sin ACK, tombstone/vecino obsoleto, actor, IDs y evidencia alterada. Fixtures corregidas para incluir request/snapshot y modificar un vecino en el caso stale, manteniendo exacta la comparación primaria. Se ajustó una aserción de UUID nullable tras tsc; sin relajar schemas. DoD1170pass/225skip/0fail/13026aserciones, lint1025 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada93%5h/85%7d, reservas10%/1%, secuencial. Siguiente19k5c: familia portable3 con originales/outcomes/ACK previos/reemplazo exactos; después writer local y pruebas reales antes de UI. Sin IO, índices, protocolo o dependencias nuevos.


## 19k5a — Contrato de primaria recurrente preparado

Revisión/snapshot nuevos y puros para cadena aislada de movimientos de la misma aparición, día civil y categoría. Kernel compartido distingue políticas simple/mixed_simple/recurring_primary sin ampliar las APIs actuales. La clave primaria usa el slot completo; padre, aparición, vista y posiciones mantienen revisiones independientes. Slot implícito se deriva sólo para comparar, sin crear excepción durable. Variantes timed conservan timestamp original aunque se reprograme. Ausencia/cancelación/cambio de regla/asignación incierta, otras fechas/intenciones/slots y catálogos incompletos siguen protegidos. Cadenas, outcome congelado y prerrequisitos exactos preservados; sin ACK ni writes.

Quince tests nuevos/136aserciones más regresión simple: cuatro variantes moved/implicit, overdueas-of/sentinel, timed, actor/grafo/incertidumbre, fuera de fecha, contexto y compactación multiefecto con CAS porposición. DoD1163pass/225skip/0fail/12950aserciones, lint1021sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada100%5h/86%7d, reservas10%/1%; renovación real/reset1792514544 registrados enworkflow. Guía Next instalada leída. Sin protocolo/índice/dependencia/IO/caller nuevo.19k5b siguiente: decisión explícita marcada recurring_primary, adopción o replay del último movimiento con CASactual; portable/TX/Next/UI después antes de activarse. Cross-category queda19k6 por necesitar asignación padre yefectos sobreotrasfechas.


## 19k4b2 — Recuperación de orden mixto disponible en Ajustes

La revisión de orden captura primero el caso simple y, si no es válido, relee el contrato mixto completo en el mismo LocalSyncStore, con cuenta/época antes/después. Cada opción se ofrece sólo tras validar la familia; la UI genera IDs estables y elige explícitamente writer simple o marcado mixed_group. Mantiene isolation por cuenta/época/raíz, mounted y caché propia. Writers simples siguen strict. El diálogo completo incluye todos los vecinos simples y fechas recurrentes, posición implícita, títulos de excepciones y fechas originales/movidas; no cambia contenido ni asignaciones.

Once escenarios Next6 focalizados UI con dos orígenes IndexedDB, BetterAuth persistido y Mongo propios aprobados. Ambas elecciones realizadas desde PersonalIncidentCard real: abrir/cancelar/reabrir/confirmar, selección de alternativa y UUID generado por UI distinto del preliminar. Cancelar preserva todos los stores; adopción no envía operación. Retry conserva último comando con nuevo UUID/CAS; pérdida tras commit→pendingattempt1, recarga/replay→ACKrealattempt2 único, posiciones/shadows/cursor exactos contra Mongo y todos los dominios ajenos intactos. No extrapolar a full35/Google/físicos. Captura /private/tmp/dalis-mixed-placement-ui-proof.png. Primera compilación detectó alias duplicado en host de fixture; corregido antes de segundo run aprobado, ambos recursos propios retirados. Sólo pestaña humana conservada.

DoD1148pass/225skip/0fail/12814aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados. SSR añade candidatura mixta sin decisiones antes de captura. Entrada26%5h/88%7d, reservas10%/1%, secuencial. Rutas feature local-placement-resolution, PlacementIncidentActions, schema/test y templates de fixture mixtos; sin protocolo/índice/dependencias/DBusuario nuevos.

Cierra19k4 para primaria simple en grupo de misma categoría con vecinos recurrentes y posiciones comprometidas conocidas. No cierra primaria recurrente, cambios entre categorías, posiciones locales sin remoto acreditado ni otras intenciones externas. Siguiente19k5: delimitar contrato puro de esos movimientos con asignación de padre/efectos de otras fechas y catálogo completo, antes de permitir decisiones/persistencia/portable/Next/UI. Después ausencia/copia, accesibilidad ypreparación final según dependencias. Preservar historia yguardias; sin migradores ni descarte automático.


## 19k4b1 — Recuperación mixta probada contra Next/Mongo

Nuevo scope explícito mixed-placement mantiene full35 disponible. Once escenarios focalizados Next6 compilado/defaults/sesiones BetterAuth persistidas/dos orígenes IndexedDB/Mongo propios aprobados: adopción y retry con productores reales, tres planes simples y serie con dos fechas visibles en el mismo día (una movida y otra implícita). Antes del conflicto todas las posiciones de vecinos se confirman y sus revisiones independientes quedan conocidas; el slot implícito no se convierte en excepción. Guardias actor/epoch/snapshot obsoleto conservan todos los stores.

Se conserva la cadena original exacta de dos movimientos; elección local no crea historia remota ni cambia contenido/vistas/categorías/apariciones/settings/shadows. Adopción0ops o retry del último comando con UUIDnuevo/CAS2. Pérdida tras commit→pendingattempt1sinlease; recarga conserva UUID ypayload, replay→ACKrealattempt2 con un solo recibo y entrada de journal. Ambos orígenes terminan con catálogo completo de posiciones, shadows ycursor exactamente iguales a Mongo; replay durable no retrocede el estado. Convergencia por grupo revisado, no global de históricos protegidos. No UI interactiva/Google/físicos nuevos. Captura /private/tmp/dalis-mixed-placement-next-proof.png.

El primer build de fixture detectó unión legacy de apariciones: se filtró explícitamente kind=plan antes del catálogo recurrente, sin cambiar producto. Segundo run aprobado; recursos propios de ambos runs retirados, pestaña cerrada. Contrato nuevo valida marcador mixed_group, scope ycomandos estrictos, rechaza destinoextra/familia simple/selectorUI aún no implementado. DoD1147pass/225skip/0fail/12810aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada33%5h/90%7d, reservas10%/1%, secuencial. Sin protocolo/índice/dependencia/DBusuario/caller mixto activo nuevos.

Siguiente19k4b2: lectura adaptativa propia y familia explícita, conexión a Ajustes con UUID estable/caché cuenta/época, ambas elecciones UI reales con cancelar/reabrir/confirmar y repetir pérdida/recarga/replay antes de publicar caller. Los scopes backend permanecen disponibles sin atribuirles interacción. Primaria recurrente, cross-category y posiciones locales no comprometidas conservan protección.


## 19k4a — Representación completa de grupos mixtos preparada

Diálogo de orden añade variante explícita mixed_group sin cambiar el caller simple. Revalida opciones mediante el planner mixto y muestra todos los vecinos visibles con el mismo orden productivo, incluidas fechas implícitas sin posición y excepciones con título propio. Fecha original reprogramada y efectiva diferenciadas; una posición tombstone vuelve al orden automático sin tachar ni eliminar el plan. Explica alcance recurrente, conservación de contenido/estado/historial, envío pendiente y última observación conocida. No hay caller mixto activo todavía.

Siete tests nuevos SSR/88 aserciones y regresión simple aprobados: día/atrasadas, ambas elecciones, orden exacto con miembro implícito, título de excepción, tombstone sin borrado de plan, cuenta/contexto/familia/ocupado e inmutabilidad. Dos fixtures corregidas tras detectar referencia primaria incorrecta y parámetro default ambiguo; producto mantuvo schemas estrictos. SSR no prueba interacción ni Mongo. DoD1146pass/225skip/0fail/12800aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados.

Entrada38%5h/90%7d, reservas10%/1%, secuencial. Rutas placement-incident-resolution-dialog y nuevos mixed-placement-resolution-version/ui.test. Sin índice/protocolo/dependencias/DBusuario nuevos. Siguiente19k4b1: prueba remota focalizada con productores reales y posiciones de vecinos comprometidas antes de activar; después19k4b2 conexión/UI con cancelar/reabrir/confirmar y UUID propios. Separación por presupuesto, sin retirar guardias simples.


## 19k3 — Persistencia y frontera local de orden mixto

Captura y writer mixtos separados reutilizan el ejecutor de placements con política privada y resultados tipados; las APIs simples mantienen schemas/guardias anteriores. Una TX9stores relee catálogo completo y evidencia, valida familia/replay/identidades/contador ycapacidad posterior incluyendo tail faltante más recibo. Guarda posiciones elegidas, supersesión exacta,0/1reemplazo pendiente, tail/counter ydecisión atómicamente. Replay primero no reescribe trabajo posterior ni añade espacio. Posiciones locales sin remoto conocido y otras intenciones continúan protegidas.

LocalSyncStore/feature añaden métodos mixtos con actor/protocolo6/cuenta/época antes-después de abrir/operar y cierre siempre. Aviso local sólo tras commit aplicado, nunca fallo/replay. No promete cancelación atómica a través de la DB de control. Aún no hay caller UI mixto.

Once checks IndexedDB reales aprobados: lectura sin writes/camino simple protegido, actor/staleparent/slot/vista, remoto ausente/posición local desconocida, intención externa, rollback tardío de posiciones derivadas/cola/tail/counter/recibo, IDs/overflow, retry+backup/recarga/replay sin retroceso, adopción sin ops/tail, últimos espacios para recibo ytail, epoch cambiada duranteopen y dos confirmaciones simultáneas→uncommit/unreplay/unaviso. Partición ycontrol propios eliminados; pestaña/servidor retirados. No Mongo/Next/Google nuevos.

DoD1139pass/225opt-in skip/0fail/12712aserciones, lint1017 sin avisos/tipos/Webpack/worker46/diff aprobados. Se ajustó sólo el texto de la fixture después de la ejecución nativa. Entrada50%5h/92%7d, reservas10%/1%, secuencial. Rutas placement-resolution{,-capture}, sync-store, feature local-mixed-placement-resolution, test/browser/mixed-placement-resolution yselector. Sin protocolo/índice/dependencia/DBusuario nuevos.

Siguiente19k4: integración conjunta de revisión/adopción/retry mixtos en Ajustes más representación completa de vecinos simples y slots con títulos/fechas conocidas y orden implícito. Lectura adaptativa validada en la misma cuenta, marcador mixto explícito al escribir; no aceptar mezclas en el writer simple. Probar productores reales con posiciones de vecinos ya comprometidas, conflictoCAS, cancelación UI/reabrir/confirmar, UUID UI, pérdida/replay/recarga/ACK único y proyecciones de ambos orígenes contra Mongo antes de publicar caller. Declarar posiciones locales desconocidas/cross-category/primaria recurrente pendientes. La UI no debe listar sólo posiciones materializadas ni confundir borrar posición con borrar plan.


## 19k2 — Evidencia portable de orden mixto

Backup3 admite la familia marcada reviewKind=mixed_group. El validador distingue esa marca antes de validar la decisión y reutiliza la evidencia común de placements: originales exactos superseded, outcome congelado, prerrequisitos con operaciones/outcomes aplicados coincidentes y reemplazo exacto por usuario/entidad/payload/fecha/secuencia/dependencias. Superseded no es ACK. La propiedad exclusiva de originales y los IDs globales se conservan; quitar la marca no convierte el caso mixto en una decisión simple válida.

Ocho tests nuevos/42 aserciones: roundtrip adopción/retry con contexto recurrente/posiciones derivadas, formato2 rechazado, pending intentado y ediciones posteriores, truncación/corrupción/familia, operaciones originales y correspondencia de reemplazo, ACK previo real en la historia portable frente a DTO sinoutcome, IDs/supersesión y resultado multiefecto producido por planners productivos puros. Tras esa proyección el backup conserva evidencia y posiciones confirmadas exactas, incluidos vecinos nuevos. Esto no acredita nuevos recibos Mongo/Next ni IO. Se corrigieron entityKey y envoltorio de snapshots en la fixture manteniendo schemas estrictos.

DoD1139pass/225opt-in skip/0fail/12712aserciones, lint1015 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada59%5h/94%7d, reservas10%/1%, secuencial. Rutas local-recurring-backup, backup/local-backup/placement-resolution-evidence y fixture/test mixed-placement-resolution. Sin writer/caller/UI/índice/protocolo/dependencia/DBusuario nuevos; el resolver simple vigente conserva sus límites.

Siguiente19k3: captura/writer mixtos separados del camino simple, mismaTX9stores y replay primero, contador/capacidad/IDs globales/tail/historia/rollback y puente de cuenta/época/notificación sólo tras commit. Prueba IndexedDB nativa antes de Next/UI19k4. Conservar posiciones locales desconocidas, cambios de asignación/contenido y primarias recurrentes protegidos; no activar retirando una guardia.


## 19k1b — Decisión preparatoria de orden mixto

Captura y validación mixtas reutilizan las guardias de cadena, outcome congelado, primaria, catálogos canónicos y prerrequisitos del resolver de placements. Una política privada separa ambos caminos: las funciones vigentes siguen rechazando grupos recurrentes; sólo las nuevas funciones preparatorias admiten vecinos visibles recurrentes tras reviewPlacementGroup. La primaria sigue siendo un plan común simple y la categoría no cambia.

La decisión explícita reviewKind=mixed_group conserva la forma existente y clave placement-resolution. Adoptar conserva posiciones remotas conocidas sin operación; retry_latest_move reutiliza el planner existente con nuevo UUID/CAS de primaria, sólo si los vecinos siguen válidos y todos los efectos son posiciones de ese grupo. Cada efecto optimista conserva la revisión observada (0 para una nueva posición derivada), sin ACK local. IDs/bytes/actor/stale y evidencia íntegra protegidos; snapshot/record se reconstruyen al validar. No se registra aún en backup ni se persiste por un writer/caller.

Seis tests nuevos/47 aserciones más regresiones simples y de contexto: día/atrasadas, adopción, último comando exacto/CAS2, varias fechas y vecinos implícitos, guardias/IDs/efectos alterados, tombstone/vecinos obsoletos sólo adopción y protección externa. La fixture stale se corrigió para cambiar un vecino manteniendo la primaria exacta; sin relajar validación. DoD1131pass/225opt-in skip/0fail/12670aserciones, lint1013 sin avisos/tipos/Webpack/worker46/diff aprobados.

Entrada64%5h/94%7d, reservas10%/1%, secuencial. Rutas placement-resolution/placement-decision, schemas/types/mixed-placement-resolution, mixed-placement-decision/fixture/tests y fixture de grupo con actor. Sin IO/protocolo/índice/dependencia/UI/DBusuario nuevos. Catálogos con posiciones locales no observadas, otro contenido/asignación pendiente, primaria recurrente o cross-category siguen bloqueados. Siguiente19k2: evidencia portable3 de la familia marcada, usando historia/outcomes/ACK reales y reemplazo exacto, sin mezclar el validador simple; después TX/cuenta/Next/UI. No activar retirando una guardia aisladamente.


## 19k1a — Contexto puro de orden en grupos mixtos

Contrato preparatorio de revisión para un plan principal simple con vecinos simples/recurrentes en la misma categoría. Valida catálogos acotados propios y comprometidos, igualdad de contenido/apariciones/categorías/vistas entre local y observado, asignaciones conocidas de cada padre visible y pertenencia civil explícita. Materializa sólo para comparar: conserva identidad de slots originales, fecha efectiva, orden local/observado y claves de posiciones cambiadas. Un slot implícito no se convierte en excepción o posición durable.

Cambios de posición sólo dentro del grupo visible revisado, sin retroceder revisiones ni cambiar creación/identidad. Ausencias, catálogos duplicados/ajenos/parciales, padres o asignaciones incorrectos, posiciones de vecinos cancelados/externos y contexto divergente bloquean. Primaria recurrente y cambio de categoría requieren contratos distintos. Los catálogos son estado conocido, no prueba de completitud actual del servidor ni autorización para escribir.

Once tests nuevos/80 aserciones: cuatro variantes, slot movido e implícito del mismo padre, día/atrasadas con día de referencia y sentinel permanente, inmutabilidad, guardia activa intacta, cuentas/contexto/límites/cancelaciones y compactación real por planner remoto puro. La compactación incluye vecino implícito con revisión1 y vecinos existentes desde su revisión independiente, sin efecto de vista. Se corrigieron dirección de vecinos y posiciones densas en la fixture, sin relajar el planner.

DoD1125pass/225opt-in skip/0fail/12623aserciones, lint1008 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada72%5h/96%7d, reservas10%/1%, secuencial. Rutas schemas/types/placement-group-review y lib/sync/placement-group-review{,-fixture,-test}; sin IO/caller/backup/writer/UI/índice/protocolo/dependencia nuevos. El resolver activo todavía rechaza grupos recurrentes. Siguiente19k1b: snapshot y decisión preparatorios para grupos mixtos con evidencia exacta de cadena/prerrequisitos y efectos independientes, conservando el camino simple vigente; después portátil/TX/Next/UI antes de activar. Cross-category requiere además asignación y efectos de serie; no se deduce de este contrato.


## 19j5b — Recuperación multi-slot disponible en Ajustes

La raíz propia de un conflicto con intenciones de varias fechas muestra «Revisar fechas relacionadas». La candidatura sólo abre revisión; no autoriza ni ofrece decisiones desde el DTO. La feature captura comparación completa en IndexedDB y verifica cuenta/época. El componente queda aislado por cuenta, época y raíz; conserva IDs al reintentar, evita estados después de desmontarse e invalida sólo caché de su cuenta/época. La resolución de una sola aparición conserva su comportamiento.

El diálogo publicado permite adoptar todos los remotos conocidos o enviar todos los borradores completos. Cancelar no escribe y reabrir relee la comparación. Las versiones por fecha se pliegan, muestran contenido/horario/estado/checklist y advierten del alcance conjunto, historial conservado, confirmación pendiente y estados intermedios. Guías Next instalada y vercel-react-best-practices aplicadas; sin nuevas rutas de navegación, índices, protocolos o dependencias.

Once escenarios Next6 focalizados con dos sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios aprobados: ambas elecciones por UI real con cancelar/reabrir/confirmar, IDs generados por UI, pérdida tras commit, recarga, replay durable con mismo UUID/ACK único y proyecciones/shadows/cursor exactos por serie. No full34 ni Google interactivo o nuevos físicos. La primera ejecución detectó un error de fixture: el replay debía usar el UUID del registro generado por UI y no el preliminar del controlador. Corregido sin relajar producto; segunda ejecución aprobada y ambos recursos propios limpios.

QA con CSS del build y390px: texto largo/pasos caben, documento390/dialog358/scroll356 sin desbordamiento horizontal, secciones plegables y confirmación/cancelación accesibles. Captura /private/tmp/dalis-multi-date-review-mobile.png. Vista previa sin bases; servidor/pestaña propios cerrados y viewport restablecido. Sólo pestaña humana conservada.

DoD1114pass/225opt-in skip/0fail/12543aserciones, lint1003 sin avisos/tipos/Webpack/worker46/diff aprobados tras limpiar Next temporal. Rutas lib/sync/plan-occurrence-cohort-review, componentes de acciones/SSR, schemas de fixture y templates Next, test/browser/appearance-cohort-review y selector visual. Entrada94%5h/99%7d, reservas10%/1%, secuencial. Sin DBusuario/producción. Recuperación multi-slot queda cerrada para las cadenas aisladas contempladas; otras familias/dependencias/ausencias conservan protección. Siguiente19k1: delimitar contratos de recuperación de orden entre categorías y grupos mixtos con catálogos completos, efectos y revisiones independientes; luego persistencia/portable/Next/UI por dependencias. No ampliar automáticamente supersesión a operaciones externas. Después ausencia/copia y accesibilidad/preparación final según el plan.


## 19j5a — Revisión visual conjunta de varias apariciones

Disponibilidad pura revalida comparación completa y actor antes de presentar opciones. Reintento exige todos los borradores y cadenas válidas, revisiones seguras y capacidad de cola; casos con borrador ausente o remoto cancelado/eliminado/agotado conservan adopción. Esto sólo presenta opciones: el writer sigue releyendo todos los datos en su transacción.

Diálogo preparado reutiliza ConfirmationDialog y PlanOccurrenceIncidentVersion. Cada fecha muestra estado elegido en resumen plegable y ambas versiones completas al expandir; primera fecha abierta, diseño móvil compacto. Indica cantidad de fechas e intenciones, sustitución de toda la cadena, conservación de historial, remoto conocido, envío pendiente y estados intermedios. No promete que cambie una única fecha. Todavía no está conectado a Ajustes.

Nueve pruebas puras/SSR y57 aserciones: cuenta/snapshot alterados sin acciones, fechas/versiones/consecuencias, contenido/horario/checklist/cancelación, adopción protegida y controles ocupados. Se ajustó una expectativa al texto existente «En proceso» y se retiró una fixture sin uso; sin cambiar copias ajenas. DoD1112pass/225opt-in skip/0fail/12529aserciones, lint1000 sin avisos/tipos/Webpack/worker46/diff aprobados. SSR no acredita interacción. Sin IO, índices, protocolo, dependencias ni DB del usuario.

Entrada99%5h/100%7d, reservas10%/1%, secuencial. Rutas lib/sync/plan-occurrence-cohort-resolution.ts y features/sync/components/plan-occurrence-cohort-resolution-{dialog,ui.test}. Guía Next instalada y skill vercel-react-best-practices aplicadas. Siguiente19j5b: conectar revisión a la raíz de conflicto multi-slot con cuenta/época/mounted/IDs estables/cache propios y pruebas UI reales en Next/Mongo/dos orígenes antes de publicar el caller.


## 19j4a — Prueba integrada focalizada de varias apariciones

Next6 compilado con defaults productivos, dos sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios aprueba once escenarios focalizados: diez de frontera autenticada/matriz5↔6/readiness/replay y uno nuevo con adopción y reintento de tres intenciones intercaladas entre dos fechas. Usa productores reales, snapshot capturado y feature de cuenta/época. El scope explícito appearance-cohort conserva full34 disponible; no se ha ejecutado full34 ni Google interactivo o nuevos dispositivos físicos.

La adopción conserva remotos conocidos sin crear recibos remotos. El reintento conserva UUID/payload/dependencias de todas las originales y añade la cadena completa con CAS independiente por slot. Pérdida tras primer commit remoto deja mismo UUID pending/attempt1, cero ACK local; recarga conserva backup/cola/decisión, replay recibe ACK real attempt2 y los demás attempt1. Número de recibos y journal aumenta exactamente una vez por reemplazo; ambos orígenes terminan con padre/excepciones/shadows/cursor exactos respecto al journal por serie. Superseded nunca es ACK; no se afirma convergencia global de históricos bloqueados.

Se corrigieron dos supuestos de la prueba, sin relajar el producto: la cola exportada se ordena por secuencia antes de elegir raíz (su orden físico es UUID); updatedAt/completedAt son autoritativos del ejecutor remoto. Se verifica igualdad de todos los demás campos elegidos, presencia de completado coherente y registro remoto completo exacto contra journal/shadows al terminar. Tercera ejecución aprobada; las dos anteriores limpiaron también sus recursos propios. TypeScript detectó el literal choice ensanchado en la fixture del test de schema y se estrechó desde el registro validado.

DoD1103pass/225opt-in skip/0fail/12472aserciones, lint998 sin avisos/tipos/Webpack/worker46/diff aprobados. Docker28.4.0/imagen Mongo pinned amd64 revalidados; tres contenedores/almacenamientos/proyectos Next propios retirados, particiones/sesiones cerradas, sólo pestaña humana conservada. Sin DBusuario/producción/índice/dependencia nuevos. Rutas schema/testnext-sync-test y templates local/device/controller/appearance-cohort-recovery. Entrada28%5h/6%7d, reservas10%/1%, secuencial; cuota durante cierre16%5h/4%7d. No interfaz nueva activada.

Siguiente19j5a: disponibilidad pura por cuenta y comparación revalidada más diálogo conjunto preparado, reutilizando ConfirmationDialog y PlanOccurrenceIncidentVersion por fecha. Mostrar contenido, fecha, progreso, checklist y cancelación elegidos, cantidad total de intenciones/fechas, consecuencias de sustituir toda la cohorte, remoto conocido, envío pendiente y estado intermedio. No prometer que sólo cambia una fecha. Actor/snapshot inválidos sin elecciones; remoto cancelado/eliminado o borrador ausente sólo adopción. Pruebas SSR/puras antes de caller.

Después19j5b: conectar revisión desde PlanOccurrenceIncidentActions sólo para raíz de conflicto multi-slot; leer comparación completa antes de mostrar elecciones, IDs estables y cuenta/época/mounted/cache protegidos. Scope UI propio con ambas elecciones cancelar/reabrir/confirmar, UUID generados por UI, pérdida/recarga/ACK único y convergencia por serie en Next/Mongo/dos orígenes antes de publicar el caller. No inferir interacción de SSR ni reutilizar la promesa del diálogo de una sola aparición. Sigue recuperación residual de grupos mixtos/ausencia y accesibilidad/preparación final según plan.


## 19j3c — Frontera local de cuenta y notificación

LocalSyncStore y featurecliente exponen comparación/resolución preparatorias multi-slot. Protocolo6, identidad yépoca se verifican antes deabrir, después deabrir ydespués deoperar; la conexión secierrasiempre. No ofrece aún nuevas elecciones UI. La cuenta decontrol está enotraDB: estas guardias son antes/después yno prometen cancelación atómica durante unaTX.

Sólo unresultado aplicado tras oncomplete emite elaviso local deoutbox; replay/error noemiten. Quince checksIndexedDB nativos aprobados (treceanteriores más dosdelafrontera): actor/epochincorrectos yepochcambiada duranteopen noescriben niavisan, lectura readonly, fallo tardío sinaviso, commitdurable observado desdeelsuscriptor yunúnicoeventolocal, replay sinwrites/evento. BroadcastChannelpuedeentregar además elaviso deotrorreceptor: laprueba distingue esa entrega delúnicoeventolocal, sinintroducir deduplicación ajena. Partición ycontrol propios eliminados, pestaña yservidor propios cerrados.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint998 sinavisos/tipos/Webpack/worker46/diff aprobados. Tras ajustar sólo lafixture deavisos serepitieron pruebanativa/lint/tipos; bundleproductivo sin cambiosadicionales. Entrada32%5h/6%7d, reservas10%/1%, secuencial. Rutas sync-store.ts, features/sync/local-plan-occurrence-cohort-resolution.ts, browserproof yplan. Sin nuevotransporte, protocolo, índice, UI odependencia. Siguiente19j4: productoresreales yRPCNext6/Mongo/dosparticiones para conflictos multi-slot, respuesta perdida/recarga/replay/ACKúnico yproyeccionesexactas; después19j5UI revisable.


## 19j3b — Persistencia atómica de recuperación multi-slot

Captura readonly y writer preparatorio en una TX9stores. Relee padre actual, excepciones de la serie, cola completa ordenada porsecuencia, sombras youtcomes; la decisión requiere comparación exacta, prerrequisitos conoutcomes yclausura ya probados. Unslot conIDdelparent pero seriesIdcorrupto no se oculta como borrador ausente. La escritura conserva todas las originales, supersede sólo lacohorte y guarda0/Nreemplazos, todas las excepciones elegidas, contador yrecibo enel mismo commit IndexedDB.

Antes de escribir valida IDs contra cola/metadata, capacidad posterior ycounter seguro/adelantado respecto al historial. Replay consulta primero elrecibo, revalida decisión yno toca ediciones posteriores ni exige espacio nuevo. Sin ACK local, limpieza dehistoria, reparación decontadores ni callerUI. No cambia padre, preferencias, orden, outcomes o sombras. Infraestructura departición propia: guardias de cuenta/época ynotificaciones se conectarán en siguiente corte defeature.

Trece checksIndexedDB nativos aprobados: lectura coherente, actor/staleparent/local/remoto, posterior intentada/dependiente externo, outcome/remotoausente, ACK transitivo sinoutcome, slotcorrupto, rollback tardío enrecibo detodas las escrituras, colisiones, counterausente/atrasado/overflow, reintento+backup+replay tras recarga/edición, adopción sinops/counter, metadata alúltimoespacio ycola9998 quenoadmite4ops perosíadopción. Se usaron sólo partición/origenbrowser-testpropios; partición eliminada, pestaña cerrada yservidor detenido. No DBusuario, Mongo, Next oGoogle nuevos.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint997 sin avisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron nulabilidad delstatus yformato enfixture antes delcierre. Entrada39%5h/8%7d, reservas10%/1%, secuencial. Rutas nuevas lib/local-db/plan-occurrence-cohort-{capture,resolution}, test/browser yselectorprivado, fixtures admitenactorpropio. Sin protocolo/índice/dependencia nuevo. Siguiente19j3c: conexión aLocalSyncStore/feature conguardias cuenta/época ynotificaciones sólo tras commit, pruebas nativas delciclo; después19j4 productoresreales/Next/Mongo/dosparticiones antes de19j5UI.


## 19j3a — Evidencia portable de recuperación conjunta

Backup3 admite la decisión multi-slot y valida contra historia durable: originales superseded exactos, outcomes citados y prerrequisitos aplicados reales, cadena nueva completa con payload/usuario/fecha/secuencias/dependencias exactos. Un snapshot de ACK no sustituye el outcome. Las decisiones no pueden compartir originales ni reutilizar identidades; la guardia de propiedad exclusiva también protege las familias anteriores.

Diez tests nuevos/42 aserciones: adopción/reintento, roundtrip, pending intentado sin ACK, ediciones posteriores permitidas, evidencia truncada/alterada, prerrequisitos y decisiones duplicadas. Cada resultado aplicado producido por los planners remotos/locales existentes conserva un backup válido durante toda la cadena de cuatro comandos, con tres originales superseded. Esto prueba codec y proyección pura; no añade IO ni acredita nuevos recibos Mongo/Next. Se corrigió el estrechamiento de tipo de la fixture de aparición común tras detectar tsc el acceso a content en una unión.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint994 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada50%5h/9%7d, reservas10%/1%, secuencial. Rutas schemas/local-recurring-backup.ts y lib/backup, sin writer/caller/UI/protocolo/índice nuevos. Siguiente19j3b: captura y escritura atómicas en IndexedDB con relectura completa, IDs/capacidad/counter/replay y rollback nativos; después prueba Mongo/Next y UI según dependencias.


## 19j2 — Decisión conjunta de varias apariciones

Planner puro permite adoptar todos los remotos revisados, sin reemplazos, o reconstruir todos los borradores como una sola cadena nueva de comandos existentes. Cada slot calcula su CAS desde su revisión remota, no desde el índice global; la siguiente fecha depende de la última operación de la anterior. Las originales y sus dependencias permanecen exactas en la evidencia; la supersesión sólo se declara, sin escrituras ni ACK.

IDs nuevos y distintos contra toda la cola capturada, comparación/cuenta exactas, post-capacidad de outbox y revisiones seguras protegidos. Si falta un borrador o el remoto está cancelado/eliminado, sólo puede planificarse adopción conjunta. El registro tiene límite de bytes y se revalida reconstruyendo operaciones, proyecciones y dependencias. La capacidad completa de metadata y sus colisiones quedan obligatoriamente para la futura transacción.

Ocho tests nuevos/42 aserciones: adopción íntegra, CAS9/10 y2/3, cadena global, planner remoto puro acepta cada comando y reproduce cada excepción exacta, stale/actor/IDs/cantidad, borradores/remotos protegidos, overflow por slot, registros alterados y cola llena de10000 entradas con historia intacta. DoD1092pass/225opt-in skip/0fail/12424aserciones; lint991 sin avisos/tipos/Webpack/worker46/diff aprobados. No nuevas pruebas Mongo/Next ni inferencia de ACK/convergencia real.

Entrada56%5h/10%7d, reservas10%/1%, secuencial. Rutas nuevas schemas/types/lib/sync de plan-occurrence-cohort-resolution y sus tests; sin caller, writer o codec de backup todavía. Siguiente19j3: evidencia portable3 y contrato de captura transaccional antes de persistir decisiones, conservando originales/outcomes/prerrequisitos y reemplazos exactos; después IndexedDB/Mongo/Next/UI según dependencias y margen.


## 19j1b — Comparación exacta de varias apariciones

Contrato puro y revalidable de la cohorte completa: conserva el catálogo de origen, el orden global, las dependencias entre fechas y el padre actual/congelado. Cada slot retiene su borrador y la versión remota conocida más reciente con revisión independiente. Sombras contradictorias o anteriores a la evidencia durable, cuenta/padre incorrectos, catálogos duplicados y ausencia remota desconocida siguen protegidos. Los prerrequisitos transitivos requieren outcomes aplicados exactos; un DTO de ACK no basta. Cancelación/tombstone remotos se conservan sin revivir nada.

Rutas: schemas/types y lib/sync/plan-occurrence-cohort-comparison, fixture propia plan-occurrence-cohort-fixture y pruebas. Snapshot con límite conservador de 5 MiB y catálogos de 10000 registros; serialización se reconstruye y compara con su fuente. No IO, writer, supersesión, elección visible ni nueva rama de backup. La captura futura debe releer todos los datos en una única transacción: el DTO no autoriza escrituras.

Diez tests nuevos y 40 aserciones: múltiples slots intercalados, revisiones 9/2 independientes, historia inmutable, remoto ausente/local ausente, evidencia posterior y replay antiguo, contradicción/stale, actor/padre/intención, duplicados/corrupción, tombstone/cancelación, ACK transitivos de dos slots y límites estrictos. Se corrigió la fixture para separar comandos locales de CAS remoto, añadir la secuencia del outcome aplicado y asociar cada snapshot al slot correcto; no se relajó validación del producto. DoD:1084 pass/225 opt-in skip/0 fail/12382 aserciones; lint987 sin avisos, tipos, Webpack/worker46 y diff aprobados. Sin Mongo/Next/Google nuevos ni DB del usuario.

Entrada66%5h/12%7d, reservas10%/1%, secuencial, int desdee50fcd3. Siguiente19j2: decisión pura de adoptar los remotos de todos los slots o reconstruir los borradores en una sola cadena nueva, con CAS independiente por aparición, IDs/capacidad/evidencia protegidos. Después TX/evidencia/Next-Mongo/UI según dependencias, sin ofrecer elecciones prematuras.


## 19g1a — Captura de orden preparada

Doce pruebas puras delimitan una cadena aislada de tag.move de la misma categoría primaria. Se conservan catálogo local completo, todas las categorías observadas (incluidas altas y tombstones), raíz/outcome exactos, hijos no intentados y clausura transitiva de prerrequisitos ACK. Otros cambios personales pendientes, dependencias externas, catálogos parciales, registros ajenos/duplicados y envíos inciertos quedan protegidos. Si el conflicto conoce una revisión posterior a la sombra hay que actualizar antes de revisar. Una sombra posterior no se usa como ancestro y el catálogo observado no se presenta como estado actual garantizado del servidor.

No writer, evidencia portable o UI nuevos. Siguiente19g1b: decisión explícita con preview para adoptar el catálogo conocido o reaplicar el último movimiento sobre él; no equivale a enviar todo el orden local ni a descartar otros cambios. Después TX/backup/Next/UI. DoD967pass/223skip/0fail/11741aserciones, lint924 sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió el estrechamiento de tipo de la categoría primaria dentro de una función auxiliar. Sin Mongo/browser, índices, DBusuario o producción.


## 19f6 — Identidades globales de decisiones portables

Se cierra una discrepancia de integridad: backup exigía claves metadata únicas, pero dos decisiones de familias distintas podían reutilizar el mismo resolutionId. Ahora el codec rechaza IDs de decisión duplicados entre prefijos y colisión con cualquier operación conservada; los writers ya protegían esa frontera. No confunde referencias legítimas a outcomes/replacements ni IDs de entidades/importación, no altera datos ni crea ACK.

Tres pruebas nuevas combinan dos cohortes independientes válidas y rechazan ambas colisiones. Regresión backup51pass/471aserciones; suite955pass/223skip/0fail/11699aserciones, lint919 sinavisos/tipos/Webpack/worker46/diff aprobados. Sin nuevas pruebas browser/Mongo, wire, formato, UI, DBusuario o producción. Entrada23%5h/46%7d, reservas10%/1%; corte puro acotado. No se abre una nueva recuperación compleja antes del cierre seguro.


## 19f5 — Recuperación de asignación de series propias

El mismo diálogo admite ahora una serie viva propia cuando sólo quedan asignaciones pendientes. El executor remoto6 ya autorizaba esa operación con guard compartido/CAS; se retira la restricción local a planes simples, manteniendo captura completa y rechazo de contenido, otros slots o movimientos pendientes de la serie. Sólo se escribe la vista; no se sustituyen otros slots ni sus intenciones. No cambia UI, wire, índices o permisos.

Cuatro pruebas puras nuevas de variantes recurrentes protegen slots pendientes y SSR adicional usa el mismo diálogo. Nueve checksIndexedDB repetidos con padre recurrente pasan. Once Next6 focalizados `assignment-series` nointeractivos pasan con event/note mensuales, un slot realmente confirmado antes del conflicto, dos pérdidas/recargas/replay/ACK únicos y proyecciones exactas de serie/vista/slot en ambas particiones. El modo full30 y assignment interactivos permanecen disponibles; esta ejecución no afirma otra interacciónUI niGoogle/físicos. Recursos propios retirados.

952pass/223skip/0fail/11695 aserciones, lint918 sinavisos/tipos/Webpack/worker46/diff aprobados. Sin DBusuario/producción. Entrada31%5h/48%7d, reservas10%/1%; corte acotado sin repetir interacción manual. Siguen recuperación de orden/borrado de categorías, placements, cohortes recurrentes/ausencia y revisión final según dependencias.


## 19f4 — Recuperación de asignaciones visible en Ajustes

«Revisar asignación» reconstruye la comparación completa y acredita los ACK previos antes de ofrecer opciones para un plan propio simple. Permite adoptar la asignación remota o reenviar la categoría local confirmada, con radios, preview de contenido conservado, categoría/color conocidos y confirmación compacta. IDs estables enref, cuenta/época/mounted y caché propia; cancelar no escribe. No modifica contenido, categorías u orden. La captura conserva sólo nombres conocidos de las categorías revisadas, sin incluir cambios de nombres independientes ni inventar nombres/colores ausentes.

Cinco SSR nuevos y una prueba pura de nombres;947pass/223skip/0fail/11678 aserciones, lint918/tipos/Webpack/worker46/diff aprobados. Once Next6 focalizados finales pasan: ambas elecciones UI real cancelar/reabrir/confirmar y UUIDs generados por el componente, cuatro variantes, dos respuestas perdidas trascommit, recarga, ACK único y convergencia porplan. Se repitió el recorrido al mejorar nombres; un intento agotó45segundos manuales y se ajustó sólo el timeout de esa fixture (120segundos externo/90interno), no tiempos del producto. Full30 disponible, no atribuirlo almodo focalizado. Recursos propios retirados; sinGoogle/físicos nuevos/DBusuario/producción.

Entrada57%5h/52%7d, reservas10%/1%, secuencial. Cadenas de contenido+categoría y asignaciones simples ya ofrecen recuperación explícita; continúan otras preferencias/cadenas recurrentes/ausencia según dependencias. No declarar cerrada toda recuperación residual.


## 19f3 — Asignaciones: Next/Mongo y dos particiones aprobados

Once escenarios focalizados Next6: diez fronteras previas y un recorrido con cuatro variantes, productores reales y cadenas de tres asignaciones. Adopción y tres reenvíos conservan exactamente contenido, categorías, orden, outcomes y originales supersedidos. Dos respuestas perdidas tras commit remoto, recarga con pending attempt1, mismo UUID→ACK aplicado attempt2 y recibo/journal únicos aprobados. Cuenta/época/stale rechazan sin mutación; replay de la decisión no retrocede estado confirmado. Proyecciones de item/vista, shadow y cursor exactos en ambas particiones por plan. No es convergencia global, Google interactivo ni dispositivos físicos nuevos.

Selector estricto `assignment` añadido; completo30 disponible y `joint-ui` conservado. Este lote ejecuta once focalizados, no30. Se corrigió el nombre del mapa de proyección de la fixture antes de repetir compilación. Mongo/imagen pinned revalidados; proyecto, sesiones, orígenes, pestañas y recursos propios retirados.941pass/223skip/0fail/11588 aserciones, lint915/tipos/Webpack/worker46/diff aprobados. Sin índices nuevos, DBusuario ni producción; UI aún oculta. Siguiente19f4: revisión guardada en Ajustes y ambas elecciones con cancelar/reabrir/confirmar real antes de publicar. Entrada65%5h/53%7d, reservas10%/1%.


## 19f2 — Asignaciones: transacción y evidencia preparadas

Captura readonly y writer de9stores reconstruyen padre/vista/categoría/cola en una TX. Los prerrequisitos ACK se acreditan contra outcomes aplicados reales antes de devolver la comparación, también al escribir. Adopción guarda la vista remota; retry añade una sola intención pendiente con CAS nuevo. Vista, supersesión explícita, secuencia y recibo son atómicos; contenido/categorías/orden permanecen intactos. Replay previo no reescribe trabajo posterior ni notifica. Feature guardada por cuenta/época, IDs globales y capacidad previos a writes.

Backup3 incluye la decisión y valida originales exactos, outcome congelado, clausura ACK y reemplazo exacto. Rama `expected.incident` explícita; no asumir `expected.entry`. Seis pruebas portables nuevas incluyen truncado/corrupción y pending intentado; se separaron referencias compartidas en la fixture para simular ediciones posteriores sin alterar el recibo congelado. Nueve checks IndexedDB propios aprobados: readonly/reapertura, cuenta/stale, rollback tardío, dependencia semántica, IDs/counter, capacidad, falsoACK/ACKreal, retry/replay y adopción. Partición, pestaña y servidor propios retirados.

941pass/223skip/0fail/11587 aserciones, lint915 sin avisos/tipos/Webpack/worker46/diff aprobados. No UI o RPC nuevos activos, índices/DBusuario/producción; siguiente19f3 prueba Next/Mongo con dos particiones y UI únicamente tras aceptación. Entrada75%5h/54%7d, reservas10%/1%, secuencial.


## 19f1 — Contrato de asignación aislada

Planner y comparación compacta para `item-view.set` de un plan propio simple: adoptar remoto conocido o reenviar la última categoría propia confirmada con CAS/UUID nuevos. No modifica contenido, categorías u orden. Captura valida cola completa, intención exacta, grafo ordenado y clausura transitiva de prerrequisitos ACK; el DTO por sí solo no acredita esos ACK. Dependientes externos, contenido/movimientos pendientes del mismo plan, referencias ausentes, incertidumbre, ausencia/tombstone y recurrencia quedan protegidos. Categoría desconocida/borrada/sin confirmar y revisión agotada sólo permiten adoptar.

Diez pruebas puras/86 aserciones cubren cuatro variantes, planner remoto, frescura, identidad, corrupción, guardias, clausura ACK e independencia.935pass/223skip/0fail/11561 aserciones, lint908 sin avisos/tipos/Webpack/worker46/diff aprobados. No caller/writer/backup/UI nuevos ni prueba de convergencia. Siguiente19f2: captura y decisión en TX, evidencia portable y pruebas IndexedDB antes de Next/UI. Entrada81%5h/55%7d, reservas10%/1%, secuencial.


## 19e5b — Recuperación conjunta disponible en Ajustes

La revisión de un plan propio simple con asignaciones pendientes relacionadas ya lee la comparación completa antes de mostrar elecciones. Permite adoptar ambos remotos o guardar el borrador y su categoría para enviar; mantiene UUIDs de decisión estables, guardias de cuenta/época, historial y caché propia. Cancelar no escribe. Las dependencias no admitidas siguen protegidas y una decisión local no equivale a ACK.

Prueba Next6 focalizada `joint-ui`: diez escenarios de frontera más recuperación conjunta de las cuatro variantes; ambas elecciones mediante UI real, cancelar/reabrir/confirmar y UUIDs generados por el componente. Respuesta perdida de contenido y asignación, recarga antes de ACK, replay único y convergencia exacta por cohorte aprobados. Se conserva el modo completo de 29 escenarios; no se atribuyen esas 29 regresiones a esta ejecución focalizada. Un primer intento agotó el tiempo de interacción y retiró sus recursos; la repetición completa aprobó. Sesiones, particiones, pestañas, proyecto y Mongo propios retirados; sin Google interactivo ni nuevos dispositivos físicos.

925 tests, 223 opt-in omitidos, cero fallos y 11475 aserciones; lint904, tipos, Webpack y worker46 aprobados. Siguiente: recuperación residual de preferencias y cadenas de apariciones según dependencias, después accesibilidad y preparación final. Sin DB del usuario, nuevos índices o producción.


**Estado vigente19c6:** elecciones activas para raíces legacy y planes comunes sin repetición ni cadenas externas. Adopción/reintento/copia probados en Next/IndexedDB/Mongo con diálogo real. Ajustes también ofrece adoptar/reintentar la zona personal con transacción/evidencia y guardias propias; no cambia planes ni simula ACK. Quedan cadenas de contenido+categoría, otras preferencias y casos de apariciones con otros slots/dependencias, remoto ausente o copia. 19c1–2 preparan adopción de una aparición con padre/slot/cadena/evidencia exactos y executor/backup probados en26Next6.19c3 activa adopción y19c6 añade reenvío completo desde Ajustes con diálogo real ypreview;27Next6 prueban chain/replay/ACK. Copia yotras cadenas de apariciones siguen pendientes. Las cancelaciones/tombstones remotos se conservan, remoto ausente no se interpreta como permiso. Los apartados siguientes conservan la secuencia histórica.


## 19a1 — Planner de conflictos de planes simples

Opt-in `allowPlans` en planner/choices, false por defecto: callers actuales permanecen intactos. Las cuatro variantes sin repetición permiten adoptar remoto sin operación/ACK, reenviar todo el borrador con nuevoUUID/CAS de revisión remota conocida, o crear copia conIDnuevo ante tombstone sin resucitar original. Se conservan variant, estado, checklist y schedule. Valida comandos mediante planCommandSchema y política común existente; bloquea identidades ajenas, series, snapshots cambiados, chains externas e intentos inciertos. No usa shadow como ancestro ni fusiona campos.

Diez tests nuevos de cuatro variantes/elecciones/invariantes;21tests/144aserciones con regresiónlegacy al primer corte, suitefinal840pass/223skip/0fail/10844aserciones, lint851 sin avisos/tipos/buildWebpack/worker46. Se corrigió testlease para usar ownerId y se eliminaron aserciones no nulas. No nuevos índices, DBusuario, UI activada o cambios de protocolo/formatos. Siguiente19a2: extender executor local guardado y probar rollback/replay/backup/cuenta con planes y settings presentes; luego integración remota real yUI coherente.



Estado: proyección y snapshot validados (13a1a–b), comparación en Ajustes (13a1c) y contrato puro de elección (13a2a) entregados. Snapshot/comparación, executor13a2b1, integración13a2b1a y elecciones13a2b2 entregados para conflictos propios simples. Cadenas externas/rechazos/series y copia desde tombstone siguen pendientes.

## Evidencia conservada

- Entrada outbox con operación enviada congelada, revisión base, dependencias, estado ycontador deintentos.
- Outcome durable: resultado del servidor, local yshadow que existían alrecibirlo. **Ese shadow no es necesariamente el ancestro de la revisión base enviada**: pull o replay tardío pueden adelantarlo. Nunca usarlo como base histórica para una fusión de tres versiones.
- Proyección local actual: puede incluir ediciones posteriores o un tombstone; no reemplazarla con el borrador deloutcome.
- Shadow remoto más reciente conocido, distinto deun estadoactual garantizado en servidor. Respuesta conflict antigua puede llegar después deun pull nuevo; comparar versiones porrevisión, igualdad concontenido distinto es corrupción, shadow actual no regresa respecto aevidencia durable.

Todo record debe pertenecer acuenta/elemento deentrada; resultado/operación/estado/key han de coincidir. Applied yunsupported no son incidentes terminales. Outcomeausente/corrupto/cuenta ajena detienelectura; no derivar éxito ni descartarcola. El DTO no modifica nada.

## Próximos cortes

1. **13a1b lector**: snapshot readonly items/outbox/remoteShadows/syncMetadata, resultados validados sinpágina parcial, filtro cuenta+epochantes/después. Mostrar evidencia ydependientes conservados, incluidos borradoresborrados; sin IOremoto niresolución.
2. **13a1c comparación visible** en Ajustes, detalles bajo demanda; diferencias local/remoto/operación enviadayrazón clara. No ofrecer elecciones antesdeque mutación equivalente estéimplementada/probada. No nuevodestino sin ambasbarras.
3. **13a2a diseño/contrato de resolución local**: decisión explícita sobre toda la cadena deintenciones pendientes deesaentidad; expected snapshot impide resolver sobre cambios locales posteriores inadvertidos. Guardarregistro deelección con nuevoUUID, operación original/resultados intactos, adoptarremoto o construir nueva intención sobre revisión remota reciente. Revalidar actor/epoch, no inferirpermisos porcache.
4. **13a2b ejecutor yUI juntos**: transacción local de evidencia/cola/proyección/resolución; una nueva operación con nuevoID/revisiónbase, CASremoto puede conflictuar denuevo si cambióservidor. Otras entidades siguenenviando. Probar dosdispositivos, errores/reload/rollback/cuenta/tombstones.

## Reglas que el diseño debe cerrar

- Conservar remoto requiere decisión explícita también sobre ediciones dependientes; no descartarlas en silencio. Reaplicar borrador debe explicar qué contenido se enviará yreusar identidad del elemento solo si aúnvive.
- **No marcar operaciónconflict/rejected como ACK delservidor.** Considerar estado local separado de supersesión yregistro de resolución, adaptando explícitamente guards/dependencias/resumen/proyección; schema existente no lo implementa todavía. No borrarrecibos/intenciones para desbloquearla cola.
- Si el remoto tiene tombstone, nunca resucitar el mismoID. Recuperar borrador como copia exige elección explícita y nuevoID/operación; no hacerlo automáticamente.
- Rechazos unavailable/identity_reuse/invalid_command tienen causas distintas. No reintentar automáticamente un permiso retirado ni reutilizarUUID conflictivo; conservar/exportar evidencia cuando no haya resolución segura.
- Acciones sobre preferencias/series/compartidos exigirán supropio soporte; este primer contrato interpreta comandos deelementos, no inventa ACKdeotrosdominios.
- No fusión automática basada enpayloadcompleto deitem.update: podría revertir cambios remotos deestado/checklist no elegidos. Elección/preview explícitos y revisiónCAS son requisitos.

Validación13a1a: oráculos puros de borradorposterior/tombstone, replaytardío, rechazo sinpayload remoto ycorrupción/identidad/cuenta/estado/operación. LecturaIndexedDB y elección UI siguenpendientes.


13a1b entregada: snapshot consistente readonly de cuatro stores con guardias usuario/época y todas las intenciones sin ACK por elemento (incluye cadenas bloqueadas). Validación global de cuenta/identidades y proyección de cada incidente completa; outcome ausente falla toda lectura. Próxima 13a1c: comparación desplegable en Ajustes, sin elecciones todavía.


13a1c entregada: Ajustes ofrece comparación desplegable bajo demanda con caché por cuenta/época. Razón, borrado, versión remota conocida y comando enviado se muestran en español, manteniendo cola intacta. Las elecciones siguen pendientes de contrato y executor probados (13a2a–b).


## Contrato 13a2a y persistencia prevista

- `adopt_remote`: reemplazar proyección por último remoto conocido y superseder explícitamente todas las intenciones mostradas del elemento; ninguna operación remota ni ACK.
- `retry_local`: preview es todo el borrador actual (incluidos estado/checklist), no fusión automática. Nueva operación UUID sobre revision remota, update para vivo/delete para borrado local sobre remoto vivo. Si servidor avanzó, CAS producirá otro conflicto. Identidad remota borrada exige otro flujo de copia con ID nuevo, todavía no habilitado.
- Solo conflictos propios simples, con remoto conocido. Rechazos sin prueba de acceso, series/preferencias y cadenas con envío activo no habilitan estas elecciones. Snapshot exacto cubre evidencia local/remota y toda cadena; executor debe regenerarlo desde sus stores y compararlo dentro de la transacción, no confiar en DTO suministrado.
- Record `incident-resolution:<UUID>` contiene request/choice, expected con entradas originales, IDs supersedidos, nueva operación opcional y proyección elegida. Outcomes originales permanecen intactos. Replay exige record idéntico y no vuelve a modificar proyección si hay posteriores ediciones.
- 13a2b1 añadirá estado `superseded` al schema de outbox. Será terminal local, excluido de trabajo e incidentes; payload/dependencias/attempts originales preservados. No satisface dependencias como ACK. Guardar record + estados + item + secuencia + nueva operación en una transacción; no convertir decisiones locales en confirmación de servidor.
- Nuevas intenciones después de adoptar remoto no deben depender de la cola ya supersedida. Una dependencia externa pendiente que apunte a ella sigue bloqueada, nunca se confirma de forma implícita; executor debe rechazar esa cadena si no está incluida explícitamente. Preferencias siguen sin sincronización.
- Dividir13a2b: primero1 estado/executor con pruebas de rollback/replay/cuota/cuenta, después2 UI de confirmación y prueba integrada de dos dispositivos. No ofrecer elecciones antes de mutación probada.


13a2b1 entregada: estado superseded y registro durable en misma transacción que proyección/replacement/secuencia. Replay idéntico conserva posteriores ediciones. Claims no envían estados supersedidos y solo ACK satisface dependencias existentes; nuevos comandos excluyen tails supersedidos. Cadena externa pendiente y envío incierto impiden elección, sin descartar ninguna intención. Guardias de usuario/época antes/después, notificación tras commit. Pendiente13a2b1a: confirmar este flujo con servidor MongoDB real y dos particiones antes de ofrecer botones13a2b2.


13a2b1a: nueve escenarios reales de dos orígenes/MongoDB verifican retry de cadena con respuesta perdida/replay/recarga sin duplicados, adopción sin escritura remota ni ACK y tombstone sin resurrección. Proyecciones y cursores de ambos dispositivos coinciden con Mongo y cola activa vacía tras decisión. Recursos propios limpiados. Puede avanzar UI13a2b2 conservando límites de cadena externa/pending intentada/rechazos/series.


13a2b2: UI de elección habilitada con preview congelado yconfirmación sobre todaslasintenciones delelemento. Cancelación sinmutación yotra pestañacambiando localprovocarechazo deldiálogoabierto. Snapshot detecta dependientes externos antesdeofrecerbotones; contrato/executor revalidan. Timestamps/UUID deelección estables,revalidación de caches propias posterior,noACK hasta resultado remoto. Reintento/adopciónyrecarga comprobados enUI ylosnueve escenariosMongo vuelvena pasar. Próxima13a2c1 define copia nueva explicitamenteelegida frenteatombstone; rechazos sin acceso y cadenasexternaspermanecen conservados.


## Copia frente a remoto borrado, 13a2c1

copy_local es una elección adicional para conflicto simple propio con remoto tombstone y borrador local vivo. Crear elemento y operación nuevos conbase0, conservar viejo elemento como tombstone remoto ysuperseder cadena explícitamente mostrando consecuencias. Registro guarda tombstone original ycopy separada; replay no debe volveraescribir copy yaeditada/confirmada. Categorías/orden no se copian automáticamente. Nullable defaults mantienen lectura de registros anteriores.

13a2c1 solo valida planner/contrato. Executor bloquea copy sin escribir yUI no laofrece. 13a2c2 debe comprobar copyID libre, incluidos tombstones/historial local, yguardar original+copy+cola+evidencia+secuencia juntos; rollback/replay enIndexedDB yconvergencia de dosdispositivos/Mongo antesde botón13a2c3. Rechazos sinacceso yrelacionesexternas siguenpendientes.


13a2c2: copia y original tombstone guardados junto con cola/contador/evidencia en cuatro stores; nuevo ID libre frente a registros/historial/tombstones, entityKey del nuevo elemento. Rollback tardío deja ambos elementos y cola intactos; replay no sobrescribe copia editada. IndexedDB nueve checks+recarga y diez escenarios reales dos dispositivos/Mongo aprobados; lostresponse produce una sola copia revision1 y original tombstone revision2 intacto. Recursos propios limpios. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próxima13a2c3 UI de copia, sin categorías/orden duplicados ni ACK local.


13a2c3: Ajustes ofrece Crear copia de mi borrador solo para local vivo frentearemoto tombstone, conidentidad/operación/timestamp estables yconfirmación decontenido completo, originalborrado, sincategoría/orden ypending. Tests guardiaslocalmissing/deleted ySSR; normal205pass/30skip/4628aserciones, lint304files/tipos/build30recursos aprobados. FixtureUI móvil390/dialog358/buttons48 sinoverflow: cancelar sincambios, confirmar/reload origentombstone+copyrev0+createbase0/entityKeynuevo/2superseded/1pending/sinACK; limpieza propia. Próxima13b1 recuperación/transporte según dependencias.

## 19a2 — Ejecución local común comprobada

LocalSyncStore/resolveLocalSyncIncident aceptan opt-in allowPlans separado, false por defecto. Exige captura recurrente completa; aplica el planner a decisión y replay, conserva settings cuando corresponde y mantiene notificación sólo trascommit. Callers/UI actuales todavía no seleccionan planes para resolver.

Next6compilado con IndexedDB/Mongo propios:23escenarios correctos. Nuevo caso induce explícitamente conflictos locales de4variantes para comprobar24checks de stale-snapshot, rollback tardío sinnotificación, superseded sinACK, replacements pending0, payload/attempts/deps/outcomes intactos, preservación settings/occurrences/tags/views/placements/shadows yreplaytrasnuevaedición. Snapshotportable3 sevalida condecoderproductivo. Mongo permanece exactoantes/después de este caso: no se atribuye ACKremoto a conflictossembrados. Recursos propios limpiados ycaptura `/private/tmp/dalis-plan-recovery-local.png`.

DoD840pass/223skip/0fail/10844aserciones, lint851/tipos/Webpack/worker46/diff. Siguiente19a3 generará conflictos reales mediante dosparticiones y ejecutorMongo/Next, conreplay/respuestaperdida/tombstones/convergencia antesUI.

## 19a3 — Recuperación común con conflicto remoto real

Next6/BetterAuth persistido/defaults/Mongo ydosorígenes IndexedDB propios:24escenarios pasan. Productores reales deguardado/progreso/borrado generan4conflictosCAS condependiente sinintento. Adoptar remoto noañaderecibo/history; retrycrea nuevoUUID sobre revisiónremota; copiar ante tombstone creaotroID sinresucitar original y conserva variant/estado/checklist/fecha. Originalesconflict+child quedan superseded conoperaciones/deps/outcomes intactos, nuncaACK local.

Se pierdeunarespuesta trascommit real de replacement; permanecen pending/attempt1/lease liberado, replay delmismoUUID obtieneunACK sinotrorecibo/journal. Alcerrar cada variante secomparan seisstores ycursor exactos contra proyección completaMongo enambasparticiones, yreplay de decisión noescribe sobreestado confirmado. Backup3 validado en cadasnapshot. NoGoogle interactivo ni dispositivosfísicos. Primerfixture se detuvo antes de ejecutar aldetectar adaptador delete-plan ausente; se añadió productorreal yse limpiótodoantes delretry aprobado.

Suite840pass/223skip/0fail/10844aserciones, lint851/tipos/Webpack/worker46/diff. Recursos propios retirados; captura `/private/tmp/dalis-plan-recovery-remote.png`. Callers/UI todavía privados: siguiente19a4 selección coherente yprueba deldiálogo real, conguardias de cadenasexternas/series intactas. NoDBusuario/protocolo/índices nuevos.

## 19a4 — Recuperación común disponible en Ajustes

La feature y las opciones visibles seleccionan el mismo soporte de planes comunes, usando el executor ya probado. Ajustes ofrece adoptar remoto, reenviar borrador o crear copia ante tombstone para planes simples sin cadenas externas. El diálogo muestra contenido completo y explica la sustitución explícita de las intenciones revisadas; cancelar no decide nada y confirmar deja un nuevo envío pendiente, sin ACK local. Las series y las cadenas de edición con categoría dependiente siguen protegidas para su ampliación posterior.

Prueba con el componente React real dentro de Next: cancelar, reabrir y confirmar un conflicto remoto real; registro generado por la feature productiva, ACK posterior y convergencia exacta en los seis stores. Los cuatro casos remotos ahora usan la feature guardada, no el puerto privado. Veinticuatro escenarios Next6 pasan; cuatro tests SSR/60aserciones comprueban opciones, campos y guardias de las cuatro variantes. Se corrige además el texto antiguo que presentaba toda repetición como sólo local.

DoD844pass/223skip/0fail/10904aserciones, lint852 sin avisos/tipos/Webpack/worker46/diff. Capturas `/private/tmp/dalis-plan-recovery-dialog.png` y `/private/tmp/dalis-plan-recovery-ui.png`; recursos propios retirados. Sin nuevos índices, formatos, protocolo, dependencias o datos del usuario. Siguientes: cadenas comunes con categoría, recuperación de preferencias y de apariciones; no declarar cerrado todo el bloque residual.

## 19b1 — Contrato de recuperación de zona personal

Schemas y planner puros para adoptar el remoto conocido o reenviar el valor local completo de settings. Exigen conflicto propio, remoto vivo y comprometido, snapshots exactos contra outcome conservado y cadena de settings sin envíos inciertos. Adopción no genera operación niACK; reintento usaUUIDnuevo yCAS de la revisión remota más reciente conocida. La proyección añade guardia explícita de cadenas externas sólo a incidentes de settings. Las categorías independientes permanecen en evidencia y no se superseden.

El registro settings-resolution conserva comparación completa, IDs sustituidos, proyección elegida y replacement opcional; el validator del registro recalcula la decisión y rechaza contradicciones. Es preparación: todavía no se registra en backup ni se ejecuta desde UI. Siete tests/34aserciones comprueban adopción/retry, replay tardío sinancestro ficticio, snapshots cambiados, cuenta/identidad, valor ausente/tombstone, cadena externa, preferencias independientes y registro corrupto. Dos tests iniciales compartían referencias del snapshot y outcome; se corrigieron para modificar copias independientes.

Suite851pass/223skip/0fail/10938aserciones, lint856 sinavisos/tipos/Webpack/worker46/diff. Sin cambios remotos, índices, protocolo o DBusuario. Siguiente19b2: transacción local completa de9stores, replay/rollback ybackup3 connuevo registro validado; feature cuenta/epoch ypruebaNext/Mongo antes UI19b3.

## 19b2 — Decisiones de zona atómicas y portables

Executor local con captura de nueve stores en la misma transacción: revalida comparación completa, actor/partición, identidades, dependencias y contador; escribe settings, estados superseded, nuevo envío opcional y recibo juntos. La feature comprueba cuenta/epoch antes y después; un cambio posterior alcommit conserva la decisión durable pero no declara éxito para otra cuenta. Replay valida identidad/evidencia guardada y no modifica valores posteriores. Las notificaciones se emiten trascommit; evento local yBroadcastChannel pueden duplicar su entrega y no se usan como prueba deACK.

Portable3 reconoce settings-resolution y recalcula su coherencia al exportar/decodificar. No cambia intenciones1/evidencia2/wire6 ni requiere wipe; lectores antiguos rechazan conservadoramente esta nueva metadata local hasta actualizar. Test debackup verifica registro válido, rechazo en formato2/lectores previos, proyección contradictoria youtcome original ausente.

Veinticinco escenarios Next6/IndexedDB/Mongo propios pasan: guardia de cuenta/epoch, snapshot obsoleto, rollback tardío sin cambios, adopción sinrecibo remoto y conservación de otras colecciones; después conflicto real con hijo pendiente, retry de la última zona local, respuesta perdida yACK único, settings/shadow/cursor iguales en dos particiones yreplay que conserva una zona confirmada posterior. El primer fixture se detuvo antes de ejecutar para corregir una aserción que confundía entrega duplicada de notificación con duplicado decommit; cleanup/retry correctos.

Suite852pass/223skip/0fail/10944aserciones, lint858 sinavisos/tipos/Webpack/worker46/diff. Captura `/private/tmp/dalis-settings-recovery-local.png`; todos los recursos propios retirados. No botones nuevos todavía, noDBusuario/índices/producción. Siguiente19b3: elección visible ydiálogo real usando la feature ya comprobada.

## 19c4 — Reenvío completo de aparición sin nuevo comando remoto

Planner de retry prepara una cadena acotada de comandos ya soportados: primero contenido/horario/textos de checklist, estado si difiere, progresos de pasos que difieran ycancelación local alfinal. Hasta103operaciones para100pasos, cadaUUIDnuevo ydistinto; revisión de padre constante yCAS deaparición previsto porpaso. ElACK directo existente asigna alhijo la misma revisión prevista, sin alterar elpayload guardado en elrecibo. El último estado local provisional conserva revisión remota de partida: nunca representa ACK.

La futura escritura local será atómica para toda la cadena; los envíos remotos serán secuenciales conACK porpaso, sin prometer atomicidad remota multicomando. Desconexión/respuesta perdida deben conservar pasos pendientes ytodoslosUUID, mientras elpeer puede observar etapas intermedias. No se introduce plan.replace-occurrence ni otra generación dewire por esta composición de comandos existentes. Remoto cancelado/tombstone no admite retry niresurrección; adoptar sigue disponible. El registro de adopción existente permanece sin campos nuevos materializados.

Este corte sólo prepara schemas/planner: executor yexportador rechazan expresamente retry antes de escribir oaceptar evidencia incompleta; UI no ofrece botón.19c5 cerrará transacción/backup completos ypruebaNext/Mongo conpérdida de respuesta/replay antes de19c6visible.

## 19c5 — Cadena durable y recuperación real tras desconexión

Transacción local guarda todos los reemplazos pending0 con dependencias consecutivas, secuencia/counter, proyección final provisional, superseded yrecibo conjuntamente. Antes deescribir comprueba identidades nuevas contra cola/metadata, actor/cuenta/epoch, snapshot completo ydependencias. Fallo tardío alañadirrecibo revierte toda la cadena. Replay no añade entradas ni retrocede proyección posterior.

Backup3 valida todos losreemplazos exactos, suorden/secuencia/fecha/dependencia; original/outcome yACK permanecen exigidos porvalidacióncompartida. La pérdida de respuesta se prueba trascommitremoto real: primerUUID queda pending/attempt1 yresto pending0. Recarga conserva receta/cola/cursor; replay obtieneACK único ycontinúa pasos. Peer observa estadointermedio decontenido antesdeprogreso, yfinalmente ambosclientes coinciden exactamente conMongo porserie. Dos casos completos incluyen checklist conaltas/cambios/reversión deprogreso ycancelación localfinal. La UI de retry todavía no seofrece hasta19c6.

## 19c7 — Capacidad completa posterior de recuperación

Schema estricto cuenta todos losreemplazos (0–103), outbox actual ymetadata actual; rechaza suma posterior>10.000 antes de modificar proyección/cola/contador/recibo. Adopción necesita un recibo, cero operaciones; contador existente sólo seactualiza. Replay durable precede esta comprobación y no vuelve aescribir. No seborra/compacta historia ni cambia wire/backup/índices. No equivale a límite debytes ni cierra capacidad deotras mutaciones.

Una prueba pura nueva cubre 0/1/103, límites exactos/exceso/negativos/fracciones/shape estricto. Cinco checks deIndexedDB nativo enpartición browser-test propia: cola llena rechaza retry sin cambios, metadata llena rechaza adopción/retry, dos reemplazos+recibo llenan exactamente outbox/metadata, replay conambasllenas no escribe, adopción permite cola llena sinoperación. La fixture usa sentinels explícitos para capacidad, noafirma validez debackup portable deesos sentinels. Primera ejecución rechazó porIDsdependientes incompletos de lafixture, corregida usando contador real de comandos y repetida conlimpieza. Captura /private/tmp/dalis-appearance-capacity.png, partición/tab/servidor propios retirados.

Suite876pass/223skip/0fail/11107aserciones, lint872sinavisos/tipos/Webpack/worker46/diff. SinMongo, NextRPC, Google ni pruebasfísicas nuevas; últimas pruebas de27Next6 no seatribuyen aestecambio. Mismo commitpushint/HEAD/cuotas.

## 19d1 — Recuperación pura de nombre y color de categoría

Planner de cadenas aisladas tag.save con cuenta/entidad/resultado/snapshots exactos, remoto vivo comprometido yUUIDnuevos. Adopción conserva versión remota sinoperación/ACK; retry usa último nombre/color local yposición remota, sin reordenar comoefecto secundario. Catálogo de nombres actual impide retry duplicado normalizado; conservador ante nombres históricos borrados, sin reparar/borrar. Rechaza movimientos/borrados, envíos inciertos, tombstone/ausencia remota ydependencias externas. Proyección personal calcula guardia de dependencias también paracategorías; preferencias independientes permanecen intactas. DTO comparte elshape de evidencia personal existente; planner restringe dominio.

Cinco tests/42aserciones de adopción/retry/plannerremoto puro, identidad/frescura/cuenta/catálogo/registro corrupto ydependencias entrantes/salientes. Fixture seclonó sin referencias compartidas entre outcome/remoto para probar corrupción realmente. Suite881pass/223skip/0fail/11149aserciones, lint876sinavisos/tipos/Webpack/worker46/diff. No escrituras/backup/UI nuevos, índices/Mongo/DBusuario.19d2 añade transacción/evidencia portable ypruebas de rollback/replay antes de Next real/elecciones.

## 19d2 — Categoría elegida durable y evidencia portable

Executor revalida captura de9stores, cuenta/partición, comparación/outcomes/dependencias, colisionesUUIDglobales/counter ycapacidad antesdeguardar. Tags/cola/counter/recibo atómicos; superseded conserva UUID/payload/deps/intentadas/outcomes, sinACK. LocalSyncStore notifica sólo trascommit; feature protocol6 con cuenta/epoch antes/después. Replay previo valida recibo replanteado, conserva cambiosposteriores yno notifica. Schema compartido de capacidad extraído sin cambiar límite103 deapariciones. Backup3 admite tag-resolution, replanifica y exige reemplazo/estadooriginal/dependencias/secuencia/intentadas exactos. Lectores anteriores rechazan metadata desconocida conservadoramente; sinmigración/borrado/wire nuevo.

Prueba pura adicional debackup válido/truncado/dependencias eintentadas alteradas ypendingattempt1 conservado. Cinco checksIndexedDB nativos en particiónpropia: foreign/stale, fallo tardío delrecibo revierte tag/cola/counter/metadata sinnotificación, dependiente externo bloqueado, retrypending nuevo sinACK/replaytrasposterior edición/IDreuse, adopción sinoperación yreapertura. Fixture corrigió expectativa de notificación única porque la suscripción recibe evento local yBroadcastChannel; verifica notificación trascommit, nunca antesni alreplay. También corregida clave derivada de evidencia tag para evitar símbolo residual deladaptador settings. Captura /private/tmp/dalis-tag-recovery-local.png; recursospropios limpiados.

Suite882pass/223skip/0fail/11155aserciones, lint880sinavisos/tipos/Webpack/worker46/diff. Ningún Mongo/Google/NextRPC nuevo enestecorte; siguiente19d3 conflictos deproductores reales, respuesta perdida/recarga/replay/ACK único yconvergencia endosorígenes/Mongo antesdeUI19d4. NoDBusuario/índices.

## 19d3 — Categoría recuperada contra Next/Mongo reales

Productores reales tag.save de dosparticiones generan dos conflictos (adoptar/retry), cadauno conúltimo borrador dependiente sinintento. Feature productiva valida cuenta/epoch/comparación actual; tres guardias sinmutación porcaso. Elegir localmente no cambia Mongo. Adopción conserva categoría remota sinoperación; retry reenvía nombre/color másrecientes conposición remota/revisiónCAS nueva. Originales conservan todosloscampos salvo estado superseded, outcomes yresto deproyecciones intactos.

Se pierde respuesta después decommit remoto de retry: mismoUUID/payloadpendingattempt1/leasesuelta sinACK. Recarga dueño secundario conserva intención exacta; replay confirma esaoperación conattempt2 yno añade recibo/journal. Proyección/shadow/cursor deambasparticiones coinciden conMongo para cadacategoría, yreplaydeelección trasconfirmación noreescribe. No convergencia global deotras historias bloqueadas de lafixture ni pruebaGoogle/dispositivosfísicos nuevos.

28escenariosNext6 compilado/configuraciónreal/defaults/sesionesBetterAuth persistidas/Mongo/IndexedDB propios correctos, mismos27anteriores revalidados; runnerexit0/cleanupcontenedor/proxy/temporales/particiones/sesiones/tab propios. Acceso al sobre change.effects.effects de lafixture corregido antes decompilar. Captura /private/tmp/dalis-tag-recovery-next.png. SinDBusuario/wire/índices/permisos nuevos. Suite882pass/223skip/0fail/11155aserciones, lint880/tipos/Webpack/worker46/diff; publicar mismo commitpushint/HEAD/cuotas.19d4 conectaUI sólo alalcance probado.

## 19d4 — Recuperación de categoría visible en Ajustes

PersonalIncidentCard ofrece adoptar categoría remota o reenviar nombre/color sólo con cuenta propia6 y planner seguro. Confirmación congela comparación y mantiene UUID en ref hasta completar; cancelar no llama a la feature. El preview usa nombre/color local y posición/revisión remotas para reflejar lo que realmente se guardará. Explica conservación de orden, planes/asignaciones e historial, estado pendiente y posible nuevo conflicto. Comparaciones de categorías muestran ahora muestra de color y código textual, sin depender sólo del color. Caché invalidada sólo por cuenta/época propia; casos protegidos siguen visibles sin elecciones.

Dos tests SSR/30 aserciones verifican cuenta ajena, opciones/guardias, preview fiel y mensajes. Componente productivo en Next: ambos diálogos se cancelan, reabren y confirman en conflictos reales; la fixture observa los UUID generados por la UI y continúa respuesta perdida, recarga antesACK, replay, ACK único y convergencia por categoría. 28 escenarios completos aprobados; no Google ni nueva checklist física. La fixture no carga todos los estilos de producto: capturas /private/tmp/dalis-tag-recovery-dialog.png y /private/tmp/dalis-tag-recovery-ui.png documentan comportamiento, no auditoría visual móvil. Recursos propios limpiados, sin DBusuario/protocolo/índices nuevos.

Se actualizó una expectativa antigua del mensaje de categoría protegida; la guardia sigue sin ofrecer elecciones inseguras. DoD:884pass/223skip/0fail/11185aserciones, lint883/tipos/Webpack/worker46/diff. Guía actualizada y mismo commitpushint/HEAD/cuotas. Las cadenas de contenido+categoría, borrado/orden y otras preferencias siguen pendientes.

## 19e1 — Clausura de cadena de contenido y categoría

Clasificador puro recibe conflicto de plan simple y cola completa (máximo10.000). Valida cuenta/identidades/secuencias/dependencias completas; exige intenciones de contenido exactamente iguales al snapshot y asignaciones item-view.set del mismo plan sólo pending/attempt0. Cada asignación está conectada al contenido revisado. Prerrequisitos externos sólo acknowledged, nunca superseded; dependientes externos y cualquier otra operación pendiente sobre el mismo plan, incluido movimiento sin arista, bloquean. Las cadenas intercaladas conservan orden/UUID/payload/deps/estado; sólo tras demostrar clausura devuelve una comparación normalizada para el planner común privado. No concede permisos/ACK ni se conecta a callers actuales.

Nueve tests/45 aserciones: cuatro variantes, grafo incompleto/ajeno/duplicado, envíos inciertos y estados terminales, recurrencia/borrado, incoming/outgoing/ACK/superseded, movimiento semántico sin dependencia y dos asignaciones intercaladas. La fixture de movimiento se corrigió para usar taskPlacementEntityKey canónico antes de comprobar su guardia. Suite893pass/223skip/0fail/11230aserciones, lint886/tipos/Webpack/worker46/diff. Sin Mongo, DBusuario, índice o formato nuevo. Próximo19e2 debe cerrar snapshot/elección con contenido/vista/categoría exactos; ninguna UI conjunta antes de transacción/evidencia/prueba remota.

## 19e2 — Elección conjunta pura con snapshots compactos

Captura reconstruida desde cola completa validada por19e1; DTO conserva contenido, intenciones de vista, registros local/remoto de asignación, categoría local y ACKs directos preexistentes relacionados. No guarda historia independiente ni la considera ancestro. Actividad ajena no cambia comparación; contenido/vista/categoría o grafo relacionados sí. Registro puro replanteable adopta ambos remotos sinoperaciones o genera dosUUIDdistintos: item.update con borradorcompleto/CASdecontenido y item-view.set conasignaciónlocal/CASdevista. Proyección provisional conserva revisionesobservadas; executor posterior debe enlazar vista trascontenido. Historial/UUID/payload/deps/intentos originales intactos.

Remoto de vista debe ser propio/vivo/comprometido. Categoría ausente, borrada o sinconfirmar yrevisiones remotas agotadas sólo permitenadopción. Prerrequisitos son entradas ACK reales capturadas, nunca estados fabricados; la validación compacta no acredita su recibo por sí sola ni demuestra ausencia de dependientes externos. Escritura deberá repetir clausura/captura completa dentro deTX, comparar exactamente yvalidar UUIDs también contra metadata. Backup deberá verificar originales/ACKs/reemplazos reales, no aceptar sólo el DTO. No seofrece UI ni seañade elregistro a backup todavía.

Nueve tests/78aserciones de cuatrovariantes, contenido completo yCASindependientes usando applyItemCommand/planRemoteItemViewOperation puros, captura compacta/actividadindependiente, foreign/stale/categoría/ausencia/tombstone/revisiónagotada, ACKs directos ydependientes externos, IDs/corrupción de registro. Se estrechó tipo item.update enfixture yseeliminó aviso deoptionalchain; DoD902pass/223skip/0fail/11308aserciones, lint890sinavisos/tipos/Webpack/worker46/diff. SinMongo/Next/DBusuario nuevos; no seatribuye convergencia a simulación pura.

## 19c8 — Límites posteriores en recuperaciones comunes y zona

Writers de contenido y settings validan outbox+replacement ymetadata+recibo antes de modificar nada. El writer común añade captura completa limitada a10.001 para metadata y cuenta deitems cuando haycopia; copia rechazada si añade el registro10.001, sin borrar/compactar historia. Replay existente sigue anterior a laslecturas de capacidad y no reescribe/duplica; adopción permite cola llena cuando noañade operación. No cambia límites debytes, escrituras normales ni política de retención.

Ocho checksIndexedDB nativos propios (planeslegacy comunes ysettings, mismo writer común usado porplanes activos): metadata llena rechaza adopción/retry sin cambios, cola llena rechaza retry pero permiteadopción, último hueco deambas tablas yreplay con10.000 registros, copia rechazada con10.000items ypermitida con9.999. La fixture usa sentinels para capacidad, no afirma validez portable deesa historia artificial. Rótulos finales españoles revalidados. Captura /private/tmp/dalis-resolution-capacity.png; partición/tab/servidor propios limpiados.

Suite902pass/223skip/0fail/11308aserciones, lint891sinavisos/tipos/Webpack/worker46/diff. SinMongo/Next/Google/DBusuario nuevos niíndices/protocolo; últimos28Next6 del19d4 siguen evidencia deese corte. Mismo commitpushint/HEAD/cuotas; siguiente19e3 según margen.

## 19e3a — Captura conjunta consistente en IndexedDB

Helper encola evidencia/cola completas y vistas/categoría/shadow exactos dentro de la mismaTX de9stores, sin red ni esperas ajenas. Reutiliza el lector vigente con sus límites y validación global; valida actor/partición/UUID y reconstruye clausura/DTO puro antes de devolver. Wrapper readonly devuelve sólo comparación compacta, helper será reutilizado por elwriter futuro dentro de suTX. Falta de vista/remoto/outcome rechaza sinresultado parcial; categoría ausente se conserva explícitamente null, sin inventar autorización. No notify ni escrituras/ACK. No feature/UI nueva y no se reemplaza requireActiveAccount de un caller futuro.

Ocho checksIndexedDB propios: captura exacta sinmutación, otroplan independiente no invalida, actor/IDausente, vista/remoto/outcome ausentes, asignaciónintentada/dependienteexterno, categoría ausente, nueva revisiónremota yreapertura conUUID/deps/evidencia intactos. Se aplicó segunda pasada deformat estable a lafixture tras aviso deBiome; repetidoslint/tipos/suite/build ymatrizfinal. Captura /private/tmp/dalis-plan-category-capture.png; partición/tab/servidor propios limpios.

DoD902pass/223skip/0fail/11308aserciones, lint893sinavisos/tipos/Webpack/worker46/diff. SinMongo/RPC/Google/DBusuario nuevos.19e3b queda pendiente: TXlocal deitem/view/cola/counter/recibo, metadataportable/guardias UUIDglobales/capacidad, replay/rollback. Después conflictos reales ydosparticionesMongo/Next antesde ofrecer decisión conjunta.


## 19e3b1 — Evidencia conjunta portable

Backup3 incorpora rama explícita para incident+viewIntentions; replantea recibo yverifica campos completos de originales superseded, outcome local/base del conflicto, ACKs directos contra entrada/outcome aplicados reales ydosreemplazos consecutivos conCASindependientes ydependencia exclusiva vista→contenido. No compara proyección actual condecisión histórica: ediciones posteriores ypendingintentado trasrespuesta perdida permanecen válidos. Detecta dependiente externo no revisado eidentidad de resolución colisionada conoperación. No writer/elecciones conjuntos activos todavía.

Ocho tests/47aserciones: adopción/retry roundtrip, lectorantiguo rechaza, truncado/corrupción deoriginales/outcomes/reemplazos/recibo, intentos/deps/orden/fechas/CAS, ACKDTO sinrecibo no confirma. Fixture deACK se corrigió alcontrato real sequence (no replayed); aviso deoptionalchain eimportshadow corregidos. DoD910pass/223skip/0fail/11355aserciones, lint896sinavisos/tipos/Webpack/worker46/diff aprobados. SinMongo/RPC/DBusuario nuevos niíndices; siguiente19e3b2 guardado atómico yprueba nativa antes de19e4/19e5.


## 19e3b2 — Decisión conjunta durable en IndexedDB

Writer de9stores reconstruye evidencia completa enmismaTX yguarda contenido/asignación/supersesión/0o2operaciones/counter/recibo atómicamente. Reemplazos conUUID nuevos yCASindependientes; vista depende exclusivamente delnuevo contenido. Validación global deIDs encola/metadata, capacidad posterior ycounter seguro antes deguardar. Replay anterior valida recibo/petición exactos, sinreleer/proyectar encima de cambios posteriores. Store notifica sólo trascommit aplicado; feature6 protege lectura ydecisión concuenta/epoch antes/después. Ninguna UI nueva todavía.

Once checksIndexedDB reales propios pasan: actor/stale local-remoto-tag, fallo tardío alañadirrecibo/rollback deambasproyecciones/cola/counter, UUIDcola/metadata, counteratrasado/overflow, dependienteexterno/asignaciónintentada, categoríadesconocida sóloadopción, retry portable sinACK/CAS5y7/dependencia exacta, respuesta pendienteintentada/replaytrasnuevasediciones/reapertura, adopción sinoperaciones, límite metadata/replayprevio, dosops deben caber completas yguardia epoch trasapertura. Sentinels de capacidad no se declaran backups válidos. Captura /private/tmp/dalis-joint-resolution-local.png; tab/servidor/partición/control propios limpios.

Segunda pasada deformato estable tras aviso deBiome; DoD910pass/223skip/0fail/11355aserciones, lint899sinavisos/tipos/Webpack/worker46/diff. SinMongo/RPC/DBusuario niíndices/wire nuevos. Siguiente19e4: productores yconflicto reales con dosparticiones/Next/Mongo, respuesta perdida/recarga yconvergencia porcohorte antes de19e5 UI.


## 19e4 — Recuperación conjunta real y diagnóstico completo

29escenariosNext6 compilados/config/defaults/BetterAuth persistido/dosorígenes IndexedDB/Mongo propios correctos. SaveLocalPlan/progreso generan conflictos reales para las cuatrovariantes concontenidoCAS3 yvistaCAS2. Adopción sinACK remoto, tresretry con dosoperaciones nuevas, originales/outcomes intactos yguardias cuenta/epoch/stale sinmutaciones. Se pierde respuesta trascommit decontenido ytrascommit devista; recarga conserva UUID/payload/intentopending1, replay obtieneACKattempt2 sin duplicar recibos/journal. Peer observa estadointermedio válido contenido→asignación yambasparticiones convergen exactamente aMongo porcohorte. Replaydurable trasconfirmación no cambia nada. Otros históricos bloqueados se conservan, no convergencia global niGoogle físico.

La primera compilación detectó cuatro adaptadores deUIfixture que asumían expected.entry en todo registro; se estrechó elunion conjunto yseparsea elinputunknown de pérdida devista. La suite ampliada superó100cambios: el diagnóstico anterior sólo leía primera página, causando falsos fallos de proyección tanto en conjunto como enapariciones. El lector diagnóstico ahora consolida páginas productivas de100 concheckpoint inicial fijo ycap propio10.000/2MiB; no cambia transporte ni readers deproducto. Cinco pruebas propias cubren145cambios/empty/checkpoint/gaps/stall/cap/terminal vacío; fixturecorregida a sobresversion2/recipientUserId. Consulta yaindexada de journal, sin índices nuevos.

DoD916pass/223skip/0fail/11371aserciones, lint901sinavisos/tipos/Webpack/worker46/diff. Captura /private/tmp/dalis-joint-recovery-next.png; runnerexit0 ycontenedor/proxy/temporales/sesiones/particiones/tab propios retirados. SinDBusuario/permisos/wire nuevos niUI conjunta todavía; siguiente19e5preview/confirmación yrecorrido UIreal antes deactivar elecciones.


## 19e5a — Diálogo conjunto preparado, sin caller activo

Se reutilizan ConfirmationDialog, SyncIncidentVersion yPersonalIncidentVersion para mostrar elección remota o borradorcompleto conasignación local. Radio/fieldset conlabels españolas ybloqueo busy, preview estado/checklist/fecha/revisiones, nombre/color local sólo si coincide con la categoría elegida; remoto desconocido se indica sininventarnombre. Explica sustitución explícita deambasintenciones, historial intacto, pendiente deconfirmación yestadointermedio decontenido antes decategoría. Helper compacto deopciones valida actor/categoría/revisiones para presentación; no autorizaescrituras ni sustituye reread completo enTX.

Seis tests SSR/76aserciones cubren cuatrovariantes yambas elecciones, previewfiel/color, actorajeno/unknown/MAX ybusy. Testpuro adicional5aserciones. Expectativa busy corregida alrótulo real Guardando…; DoD923pass/223skip/0fail/11452aserciones, lint903sinavisos/tipos/Webpack/worker46/diff. No caller/elecciones activas nuevas niRPC/Mongo adicional.19e4 sigue evidencia backend29Next6. Siguiente19e5b: accióncuenta/epoch/cache/IDsestables ycancelar/reabrir/confirmar reales enNext antes deconectarAjustes.


## 19g1b — Decisión y preview de orden preparados

Nueve pruebas nuevas validan adoptar el catálogo observado o reaplicar únicamente el último tag.move de la cadena. La nueva operación usa UUID nuevo/CAS primario observado y vecinos originales; todos los efectos de reranking se calculan con el planner remoto existente, con límites de bytes y revisión por entidad. El preview conserva revisiones observadas, nombres/colores y tombstones remotos; no simula ACK ni reenvía campos locales obsoletos. Vecinos ausentes/no adyacentes, primaria borrada, revisión primaria/peer agotada o efectos demasiado grandes dejan sólo adopción. Registros durables se replanifican exactamente para detectar corrupción.

21pruebas focalizadas/101aserciones;976pass/223skip/0fail/11800aserciones, lint926 sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron copias independientes de intenciones en la fixture y dos estrechamientos de tipos de las aserciones. Sin writer/backup/UI nuevos, Mongo/browser o DBusuario. Siguiente19g2: reconstrucción TX y evidencia portable antes de ofrecer elecciones. Se intercala la petición humana de separar la home en Atrasadas/Hoy/Próximas.


## 19g2a — Evidencia portable de orden preparada

Backup3 admite la decisión de orden con rama específica expected.incident, replanificación exacta de catálogo/último movimiento y originales supersedidos íntegros. Exige outcome congelado original, clausura de prerrequisitos con outcomes aplicados reales, correspondencia exacta de0/1 reemplazos (UUID/comando/CAS/fecha/entidad/secuencia posterior/dependencias vacías) yguardias globales deidentidad. Un DTO de ACK no basta. Proyección actual puede avanzar después de la decisión sin que el recibo la retroceda; pending intentado sigue siendo pending.

Ocho tests nuevos/36aserciones de roundtrip/adopción/retry/truncado/corrupción/ACK/IDs;987pass/223skip/0fail/11852aserciones, lint928sinavisos/tipos/Webpack/worker46/diff aprobados. Sin writer/UI nuevos, Mongo/browser/DBusuario/protocolo/índice. Entrada77%5h/41%7d, reservas10%/1%, secuencial. Siguiente19g2b capturaTX/writer yrollback/replay/capacidad enIndexedDB propio, antes deNext/UI.


## 19g2b — Recuperación de orden atómica y portable preparada

Captura9stores reconstruye catálogo local, todas las sombras propias, cola yclausura ACK enmismaTX; outcomes realmente aplicados acreditan prerrequisitos antes deofrecer comparación o escribir. Writer guarda catálogo observado/adoptado o preview multiefecto, originales supersedidos íntegros,0/1reemplazo pending, contador yrecibo atómicos. Replay previo valida decisión sinreescribir trabajo posterior ni notificar. Guardias deactor/partición/snapshot/identidades globales/capacidad/counter anteswrites, featurecuenta/epoch antes/después ynotificación sólo trascommit.

Retry actualiza preference-tail paraque unmovimiento posterior deotraprimaria dependa delreemplazo. Si faltaba, se contabiliza suclave adicional antesdeescribir; un tail corrupto no se repara. No se cambia contenido/vistas/placements/settings/sombras/outcomes ni se inventa ACK. Adopción conserva altas/tombstones observados yno avanza contador.

Doce checks nativos IndexedDB propios aprobados: readonly/reapertura, actor/stale/catálogos, rollbacktardío, intenciones protegidas, referencias parciales/ajenas/límite10001, IDs/overflow, capacidad conysintail, ACKDTO frentearesultado aplicado, retry/nuevodependiente/replay, reranking depeers conrevisiones independientes yadopción/tombstone. Backup3 valida cadaresultado; captura /private/tmp/dalis-tag-order-native.png. Partición/pestaña/servidor propios retirados.987pass/223skip/0fail/11852aserciones, lint932sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió la firma options delproductor enlafixture antesdelaprimeraejecución. Entrada72%5h/40%7d, reservas10%/1%, secuencial. SinNext/Mongo/UI nuevos; siguiente19g3 prueba remota antesdeofrecer elecciones.


## 19g3 — Orden recuperado con Next/Mongo y dos particiones

Once escenarios focalizados tag-order deNext6 compilado/defaults/sesionesBetterAuth persistidas ydosorígenes IndexedDB/Mongo propios aprobados. Productores reales generan raízconflict yúltimo movimiento conectado conUUID/payload/dependencias exactos. Dosadopciones (incluyevecinoborrado/tombstone) ydosretry (incluyerernumeración conrevisiones independientes depeers) conservan originales/outcomes/otrasfamilias. Cuenta/época/stale rechazan sinmutaciones. Dos respuestas perdidas trascommit, recargaantesACK yreplay delmismoUUID→ACKattempt2 producen unúnicorecibo/journal porreemplazo. Catálogo completo de categorías/proyección/sombras/cursor coincide exactamente conMongo enambasparticiones; no equivale aconvergencia global deotrasfamilias niGoogle/físicos nuevos.

Full31 queda disponible; estaejecución acredita sólo11focalizados. La primera compilación detectó directiveuseclient detrás deimport enlasplantillas nuevas; corregido antesdeRPC. Primerrecorrido detectó queelschema de fixture no admitía tag.move/delete; ampliado explícitamente conregresión. UnDoD durantefixturetemporal incluyó suárbol bajo build/ yfalló tipos; repetido secuencialmente trascleanup, junto alestrechamiento de literals deltest. ÚltimaDoD989pass/223skip/0fail/11861aserciones, lint932sinavisos/tipos/Webpack/worker46/diff aprobados. Docker28.4.0/pinneddigestamd64 revalidados; runnerexit0, contenedor/proxy/temporales/sesiones/particiones/pestañas propios limpios. Captura /private/tmp/dalis-tag-order-next.png.

Entrada66%5h/39%7d, reservas10%/1%, secuencial. Sin nuevo protocolo/índice/DBusuario oUIactiva. Siguiente19g4 preview/diálogo guardado yambas eleccionesUIreales antesdepublicar caller enAjustes.


## 19g4a — Diálogo de orden preparado sin caller

Preview puro reutiliza planificación exacta sincrearIDs durables niACK. Diálogo compara catálogo local ycatálogo elegido completo, ordenado visualmente ydesplazable; nombres/colores/revisiones/tombstones yprimaria resaltada. Opciones explícitas usan remoto conocido oreaplican sólo últimomovimiento, conadvertencia sobrecamposremotos, historia conservada, sustitución deintenciones ypending sinconfirmación. Guardiasactor/retryinviable/busy/cancelar; ConfirmationDialog reutilizado ycomponentes extraídos, sin estado derivado por effect.

CuatroSSR/40aserciones ypreviewpuro/4aserciones nuevos,14tests focalizados/103aserciones;994pass/223skip/0fail/11905aserciones, lint935sinavisos/tipos/Webpack/worker46/diff aprobados. Sin interacción browser nueva ocalleractivo. Nextbackend11focalizados sigue cerrado en19g3; siguiente19g4b lectura/confirmación guardadas yambas elecciones reales concancelar/reabrir/confirmar enNext antesdepublicarAjustes. Entrada52%5h/37%7d, reservas10%/1%, secuencial.


## 19g4b — Revisión de orden visible en Ajustes

PersonalIncidentCard ofrece Revisar orden para conflicto propio tag.move. Botón sólo inicia lectura completa guardada; opciones noautorizan porDTO. Captura/confirmación cuentan conactor/época/mounted/cache propios, UUIDs estables enref ycancelación sinwrites. UIcompacta compara catálogos, mantiene guardias devecinos/otrascohortes ynomuestra retryinviable. Historial íntegro ysinACKlocal.

Once Next6 focalizados tag-order-ui aprobados: ambas elecciones conCancelar/Reabrir/Confirmar reales yUUID generados porUI, guardias deactor/epoch/stale, dospérdidas trascommit/recarga/replay/ACKreal único, reranking depeers yvecinoborrado. Proyección/shadows/cursor decatálogos coinciden conMongo endosorígenes/sesionesBetterAuth propios. Full31 sigue disponible, no se atribuye su ejecución completa nifísicos/Google nuevos. PrimeraSSR detectó nombre de comando mal reemplazado enelcandidate, corregido antesNext.

La fixtureNext valida interacción pero no cargaCSS deproducto. Se añade modo visual explícito tag-order-review alservidor propio existente; revisión conCSS real delbuild enescritorio ymóvil390px, screenshot /private/tmp/dalis-tag-order-dialog-{desktop,mobile}.png. No abre DB ni guarda datos enese modo. La pruebaNext tiene captura /private/tmp/dalis-tag-order-ui-next.png. Docker28.4.0/imagenpinnedamd64 revalidados; runnerexit0, recursosMongo/particiones/control/sesiones/pestañas/servidores propios limpios yviewportrestaurado.

995pass/223skip/0fail/11912aserciones, lint937sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada49%5h/37%7d, reservas10%/1%, secuencial. Sin nuevoíndice/wire/DBusuario/producción. Recuperación deuna primaria tag.move cerrada; otrasprimarias/dependencias quedan protegidas. Siguen borradodecategorías/placements, cohortes recurrentes/ausencia, accesibilidad/preparación final.03:25 sigueprogramación humana pendiente paraelcierre deesta ventana.


## 19h1a — Captura de borrado aislado preparada

Evidencia pura deunaúnica raíz tag.delete propia enconflicto: exige tombstone local, catálogo observado completo conprimaria conocida viva oeliminada, outcome exacto yclausura deACKs capturada. Ausencia remota, otroscambiospersonales/dependientes, envíosinciertos, datosajenos/duplicados/parciales ycapacidad siguenprotegidos. Sólo laprimaria revisada puede restaurarse desde untombstonelocal mediante unaelección explícita posterior; ningúnpeer se resucita. No choices/writer/backup/UI nuevos todavía.

Guardias comunes de catálogo/frescura/cola se extraen a tag-catalog-resolution paraevitarduplicación. Wrappers deorden conservan estructura/formato yrestricciónaprimariaviva. Siete tests nuevos/24aserciones,29tests focalizados/129aserciones ydocechecksIndexedDB deorden repetidos aprobados; captura /private/tmp/dalis-tag-order-shared-guards.png.1002pass/223skip/0fail/11936aserciones, lint943sinavisos/tipos/Webpack/worker46/diff aprobados. Partición/pestaña/servidor propios limpios; sinNext/Mongo nuevos/DBusuario/protocolo/índices.

Entrada38%5h/35%7d, reservas10%/1%, secuencial. Siguiente19h1b decisión explícita deaceptar catálogo observado oreintentar borrado conCASnuevo, despuésportable/TX/pruebaremota/UI. Mantener distinción entre capturaACKDTO ysuacreditación real; elcatálogo observado noes unestadoactual garantizado delservidor.


## 19h1b — Decisión de borrado preparada sin caller

Contrato puro admite aceptar catálogo observado oreintentar exactamente tag.delete conUUID nuevo/CAS primario observado. Adopción acepta tombstone remoto orestaura explícitamente sólolacategoría revisada; retry requiereprimariaviva yrevisión noagotada, sininferirACK. Catálogooptimista conserva campos/revisionesobservadas depeers; sólo cambia tombstone/timestamp deprimaria, mientras elexecutorremoto calcularásurevisión confirmada. No modificaasignaciones: suvisibilidadderivada cambiará segúnsucategoría ydeberá explicarseenUI. Recibo5MiB replanificableexacto, snapshot/actor/IDs nuevos/historia protegidos. Ausenciadesconocida siguefuera.

Seis tests nuevos/37aserciones,13focalizados/61aserciones;1008pass/223skip/0fail/11973aserciones, lint947sinavisos/tipos/Webpack/worker46/diff aprobados. Elajuste final deltexto deerror de19h1a necesitaba salto delformatter; se corrige yrepiteDoD completoenestecorte. Sin writer/backup/UI nuevos niMongo/browser/DBusuario. Entrada33%5h/34%7d, reservas10%/1%, secuencial. Siguiente19h2a evidencia portable; después TX/Next/UI segúnmargen. No ofrecer elecciones hastaejecutor/evidencia/pruebasreales.


## 19h2a — Borrado aislado con evidencia portable

Backup3 admite decisión deaceptar catálogo oreintentartag.delete conramaexpected.incident propia. Valida originalsuperseded exacto, outcomefrozen intacto, prerrequisitosACK conoutcomes realmente aplicados, reemplazo0/1 exacto ysecuencia posterior/depsvacías, más IDsglobales centrales. No obliga a retroceder proyección actual: lateredits ypendingintentado se conservan sinfabricarACK.

Siete tests nuevos/25aserciones de roundtrip/adopción/retry/truncado/alteración/prerrequisitos/IDs/catálogos;1015pass/223skip/0fail/11998aserciones, lint949sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió unaaserción que asumía queprimariaera primerUUIDordenado, ahora localiza porID exacto. Sinwriter/UI/Mongo/browser/DBusuario/wire/índice nuevos. Entrada29%5h/34%7d, reservas10%/1%, secuencial. Siguiente19h2b TXguardada/IndexedDB; Next/UI sólo después deaceptación ymargen real.


## 19h2b — Borrado aislado con transacción local preparada

Captura9stores reconstruye catálogo/cola/clausura yacredita prerrequisitosACK conoutcomes aplicados antesdecomparar oescribir. Writer guarda catálogo elegido, original superseded exacto,0/1reemplazo pending, contador/tail/recibo atómicos; noACKlocal ni cambios deasignaciones/otrasfamilias/sombras/outcomes. Adopción puede restaurar explícitamente laprimaria revisada omantener tombstone remoto. Replay previo conserva edits posteriores ynonotifica. Actor/partición/snapshot/IDs/capacidad/counter/tail yfeaturecuenta/época guardados; faltantetail cuenta capacidad ycorrupciónnorepara.

Diez checksIndexedDB propios aprobados: readonly/reapertura, actor/stale, rollbacktardío, asignaciones/movimientos protegidos, referenciasincompletas/ajenas, IDs/overflow/capacidad, ACKDTOvsoutcome, retry/nextdependiente/replay, tail, adopciónremotaviva ytombstone. Backup3 valida resultados; captura /private/tmp/dalis-tag-delete-native.png. Partición/pestaña/servidor propios retirados.1015pass/223skip/0fail/11998aserciones, lint953sinavisos/tipos/Webpack/worker46/diff aprobados. Formatter necesitó segundapass sobreunacadena de lafixture, corregido antesdeDoDfinal.

Entrada26%5h/33%7d, reservas10%/1%, secuencial. SinNext/Mongo/UI nuevos, producción/DBusuario/índices/wire. Siguiente19h3: prueba Next6 compilado conproductores reales de borrado, dosparticiones/Mongo, adopción/retry/tombstone, guardias ypérdida/recarga/replay/ACKúnico; sólodespués19h4 UI. Decidir trascuota si cabe entrega completa o cerrar yreactivar03:25 autorizado.

## 19h3 — Recuperación de borrado probada con RPC real

Once escenarios Next6 focalizados (`scope=tag-delete`) aprobados con acción/defaults reales, sesiones BetterAuth persistidas y dos orígenes IndexedDB/Mongo propios. Productores tag.save/tag.delete generan conflicto real; se prueban adopción remota viva, retry_delete y adopción de tombstone posterior. Guardias actor/epoch/stale no escriben; UUID/payload/dependencias/original superseded/outcomes permanecen exactos. Plan asignado y vista siguen intactos; sólo cambia visibilidad derivada de la categoría. Respuesta perdida después de commit, recarga pending/attempt1 y replay del mismo UUID producen ACK real/attempt2 y un único recibo/journal. Catálogos completos, sombras y cursor coinciden con Mongo; replay durable no retrocede estado confirmado.

DoD:1016pass/223skip/0fail/12004aserciones, lint953 sin avisos, tipos, Webpack, worker46 y diff aprobados. Scope estricto y comandos nuevos validados; full32 disponible, sin atribuirle ejecución completa. Se corrigió antes de compilar una importación de snapshot que sólo se exporta en el schema de catálogo. Recursos propios limpios; evidencia `/private/tmp/dalis-tag-delete-next.png`. Sin Google interactivo ni nuevos dispositivos físicos, DB del usuario, protocolo, índice o callerUI. Siguiente19h4: diálogo/caller de borrado, cancelar/reabrir/confirmar ambas elecciones con UI real antes de publicar.

## 19h4 — Recuperación de borrado visible y probada

Ajustes conecta revisión guardada de tag.delete aislado: captura completa antes de mostrar elecciones, cuenta/época/montaje, UUID estables y cache de la propia cuenta. Diálogo reutiliza ConfirmationDialog y catálogo con color/tombstones; explica restauración y agrupación derivada sin modificar planes/vistas, o nueva solicitud pendiente sin ACK local. Remoto ya eliminado sólo permite adoptar. Preview puro comparte planner; cancelar no escribe y error conserva intención.

Seis pruebas SSR/preview/guardias y scopes estrictos; dieciocho tests focalizados/113aserciones. Once escenarios Next6 UI focalizados pasan con cancelar/reabrir/confirmar ambas elecciones, UUID generados por UI, respuesta perdida tras commit, recarga, ACK remoto único y catálogos/shadows/cursor exactos en dos particiones/Mongo propios. Full32 sigue disponible; no atribuirlo al scope11 ni afirmar Google/nuevos físicos. Fixture visual con CSS real a390px: diálogo358px, scroll390px sin overflowhorizontal; captura /private/tmp/dalis-tag-delete-dialog-mobile.png. UI Next sinCSS sólo acredita interacción. Se corrigió fixture tombstone para que comparación remota coincidiera exactamente con su catálogo; no se relajó guardia.

DoD1022pass/223skip/0fail/12051aserciones, lint957 sinavisos/tipos/Webpack/worker46/diff aprobados. Corregidas líneas vacías finales de docs19h3; comprobación final limpia. Recursos propios retirados yviewport restablecido; main humano preservado. Sin índice/protocolo/DBusuario/producción nuevos. Entrada90%5h/30%7d, reservas10%/1%; siguiente recuperación residual deplacements/cohortes recurrentes/ausencia según dependencias, después accesibilidad/preparación final.

## 19i1 — Captura pura de orden de planes simples

Contrato de catálogo local/observado canónico para cadena task.move de misma primaria, scope, fecha civil y categoría. Cuatro variantes propias simples con contenido/categorías/vistas confirmados exactos; placement local optimista puede diferir sólo dentro del grupo revisado. Revisión positiva y conjunto de identidades conocido en ambos lados evita inferir ausencia o borrar rangos locales sin evidencia. Remoto tombstone primario puede conservarse como observación, nunca restauración automática de vecinos. Otro pending, cambio de categoría, serie, slot, catálogo parcial/ajeno/duplicado y revisión desconocida siguen protegidos.

Raíz conflict/attempted sinlease e hijos pending0 conectados conservan UUID/payload/dependencias. Captura clausura ACK transitiva; su DTO no sustituye futura acreditación con outcomes aplicados. Outcome frozen, local/remote primarios y frescura remota exactos; observación posterior no se llama ancestro. Scope overdue usa fecha civil declarada y sentinel durable; sin reloj remoto.

Trece tests/68aserciones y DoD1035pass/223skip/0fail/12119aserciones, lint962 sin avisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron estrechamiento de tipo de efectos y una entrada deliberadamente inválida del test para que el rechazo ocurriera dentro del capture; no relajación de guardias. Sin IO, backup, writer, elecciones o UI nuevos; sin DBusuario/índices/protocolo. Entrada79%5h/28%7d, reservas10%/1%, secuencial. Siguiente19i2 decisión pura de adoptar catálogo de placements conocido o reaplicar último movimiento con CAS primario fresco y multiefectos; luego evidencia/TX/prueba remota/UI según dependencias.

## 19i2 — Decisión de orden preparada sin caller

Contrato puro permite adoptar catálogo observado de placements o reaplicar sólo el último task.move exacto de la cadena revisada. Nuevo UUID y CAS de primaria observado; planner remoto común calcula reranking multirregistro/revisiones independientes, mientras proyección optimista conserva revisión conocida o0 si crea un rank nuevo. Rechaza efectos en vistas/otro grupo, primarias eliminadas, vecinos obsoletos y desbordamientos; en esos casos sólo adopción del catálogo conocido. No envía todo orden local ni inventa ACK. Recibo5MiB replanificable conserva toda cadena y decisión explícita, identidades/snapshot/cuenta exactos.

Nueve tests nuevos/73aserciones;22focalizados/141aserciones. DoD1044pass/223skip/0fail/12192aserciones, lint964 sin avisos/tipos/Webpack/worker46/diff aprobados. Fixture reranking corregida para elegir vecinos según su orden real por UUID cuando posiciones empatan; una aserción TS estrechada sin cambiar producto. Cuatro variantes/day/overdue, adopción/retry/tombstone/revisión agotada/vecinos/reranking/stale/IDs/registro corrupto aprobados. Entrada73%5h/27%7d, reservas10%/1%, secuencial. Sin IO, backup/writer/UI, índice o protocolo nuevos. Siguiente19i3 evidencia portable; después TX9stores con ACKs acreditados, pruebas remotas y UI antes de ofrecer elecciones.

## 19i3 — Orden de planes con evidencia portable

Backup3 admite decisiones de orden con rama expected.incident propia: valida catálogo/decisión replanificados, originales superseded exactos, outcome frozen intacto y clausura de ACKs contra resultados aplicados y operaciones reales conservados. Reemplazo0/1 mantiene usuario/entidad/fecha/secuencia posterior/comando/depsvacías exactos; IDs globales centrales rechazan colisiones. No exige retroceder proyección actual ni convierte superseded en ACK.

Ocho tests/35aserciones: roundtrip ambas elecciones, pendientes intentados/lateredits, ausencia oalteración deoriginal/outcome/reemplazo/recibo/catálogos/revisiones, prerequisitosDTO sin outcome yIDs. DoD1052pass/223skip/0fail/12227aserciones, lint966 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada69%5h/27%7d, reservas10%/1%, secuencial. Sin IO/writer/UI nuevos, DBusuario, índice o protocolo. Siguiente19i4 capturaTX9stores ywriter atómico con capacidad/counter/tail/IDs/replay/rollback nativo antes deNext/UI.

## 19i4 — Orden simple con decisión local atómica

CapturaTX9stores reconstruye todos los catálogos locales/sombras, cola y resultado congelado, y acredita prerrequisitos ACK con outcomes aplicados antes de comparar o escribir. Writer guarda placements elegidos, cadena original superseded exacta,0/1reemplazo pending, counter/tail/recibo en una única TX. Guardias de partición/cuenta/época/snapshot, IDs globales/capacidad/counter/tail antes de writes; replay previo valida recibo y no retrocede ediciones posteriores ni notifica. No altera contenido/vistas/categorías/apariciones/settings/outcomes/sombras.

Nueve checks IndexedDB propios aprobados: readonly/reapertura, actor/stale/sombra ausente, rollback tardío de todos los stores, otro pending protegido, IDs/overflow/tail/capacidad contando tail ausente, ACKDTOvsoutcome aplicado, retry sinACK/replay posterior y adopción sin nuevo contador. Backup3 válido en resultados; evidencia /private/tmp/dalis-placement-recovery-native.png. Fixture corregida para liberar primero las secuencias antes de insertar ACKancestro, y no asumir una sola entrega de aviso cuando existen evento local y BroadcastChannel. No se modificó producto para ocultar esos fallos del test. Partición/pestaña/servidor propios retirados.

DoD1052pass/223skip/0fail/12227aserciones, lint970 sin avisos/tipos/Webpack/worker46/diff aprobados; lint/tipos repetidos tras ajuste final de aserción nativa, build y suite productiva sin cambio semántico adicional. Entrada65%5h/26%7d, reservas10%/1%, secuencial. Sin nuevo índice/protocolo/DBusuario/UI. Siguiente19i5: productores task.move reales y Next6/Mongo/dos particiones con CAS, pérdida/replay/ACK único y catálogo exacto, luego19i6 UI revisada.

## 19i5 — Orden simple probado con productor real y RPC6

Once escenarios Next6 focalizados (`placement`) pasan con acción/defaults reales, sesiones BetterAuth persistidas y dos orígenes IndexedDB/Mongo propios. moveLocalPlan productivo crea la cadena exacta conflict+hijo; cuatro variantes/day/overdue con adopción y3retry conservan UUID/payload/dependencias, producen pérdida después decommit/recarga/mismoUUIDpendingattempt1→ACKrealattempt2 único. Catálogos completos deplacements, sombras ycursor exactos frente aMongo, otrasfamilias intactas yreplay durable sinretroceso. Scopevalidado, full33 disponible sinatribuir ejecucióncompleta; noGoogle/físicos nuevos.

La primera ejecución reveló vecinos recurrentes engrupo sincategoría delbaseline. Se incorpora contexto deapariciones local/observado íntegro yreutiliza planner recurrente6 activo; guardia explícita bloquea grupo revisado quecontenga serie viva. Fixture usa categoría propia yconserva serie ajena enotrogrupo. Regresión pura depeer recurrente y31tests focalizados/177aserciones aprobados; nuevechecks IndexedDB repetidos pasan trasajuste decaptura. No relajar vecinos ni reinterpretar cola paraaprobar. Cambios sólo preparatorios; no existían recibosdeorden deusuario que migrar. Se corrigió además estrechamiento literal delcomando deltest yun reemplazo deformato quehabía cambiado unaaserción, conservando suvalor correcto.

DoD1054pass/223skip/0fail/12236aserciones, lint970 sinavisos/tipos/Webpack/worker46/diff aprobados. Recursospropios limpios; capturas /private/tmp/dalis-placement-recovery-next.png y /private/tmp/dalis-placement-recovery-context.png. Siníndice/protocolo/DBusuario/UI. Entrada56%5h/25%7d, reservas10%/1%, secuencial; siguiente19i6 diálogo/caller guardado yambas elecciones conUI real antes depublicar, segúnmargen trascuotas.

## 19i6 — Recuperación de orden simple visible

Ajustes conecta revisión de cadena task.move simple con cuenta/época/montaje/cache propios yUUID estables. Diálogo compacto muestra grupo/categoría/color/fecha civil, orden actual yresultado, títulos conocidos, primaria yposición eliminada sin afirmar que se borró elplan. Adopción noreenvía; retry sóloúltimomovimiento, con vecinos revisados yposible reranking delgrupo, pending hastaACK. No cambia fechas/contenido/asignaciones. Mezclas conseries, cambiosdegrupo, ausencia yotros pendientes siguenprotegidos. Cancelar sinwrites yerror conservaintención.

SeisSSR/guardias/versiones yschemas estrictos,19focalizados/123aserciones. OnceNext6 UI focalizados pasan: cancelar/reabrir/confirmar ambas decisiones conUUID generados porUI; cuatrovariantes/day/overdue,3pérdidastrascommit/recarga/mismoUUID→ACKreal único, catálogos/shadows/cursor exactos en dosorígenesIndexedDB/Mongo propios. Full33 disponible sinatribuirle ejecución completa; noGoogle/físicos nuevos. Fixture CSSfinal a390px muestra diálogo358px yscroll390px, sinoverflow; captura /private/tmp/dalis-placement-dialog-mobile.png. UI Next sinCSS prueba interacción, no QAvisual.

DoD1060pass/223skip/0fail/12283aserciones, lint975 sinavisos/tipos/Webpack/worker46/diff aprobados. Recursospropios retirados/viewportrestablecido, mainhumano preservado. Entrada38%5h/22%7d, reservas10%/1%, secuencial. Siníndice/protocolo/DBusuario nuevos. Siguiente segúnmargen: guardias residuales de capacidad/presentación, después cohortes recurrentes/múltiples slots oausencia/copy yaccesibilidad/preparación final; no ampliar elecciones sincontrato/ejecutor/evidencia probados.

## 19i7 — Elecciones de orden limitadas por evidencia durable

Disponibilidad ypreview deorden comprueban ahora elrecibo completo con elmismo constructor puro queelwriter. Un snapshot por debajode5MiB no basta si al añadir placements/intención/recibo se supera eltope: enesecaso no se ofrecen elecciones imposibles deguardar. IDs conocidos se usan sólo como placeholders demedida, nuncasepersisten nienvían; la decisión real mantiene IDs nuevos/distintos ysnapshot exacto. Esto no afirma espacio físico disponible: capacidad postwrite, ACKs yguardias siguenacreditándose enTX.

Regresión desnapshot justodebajo dellímite peroambos registrosfuera aprobada, sinmutar entrada;16tests focalizados/125aserciones. DoD1061pass/223skip/0fail/12290aserciones, lint975 sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada24%5h/20%7d, reservas10%/1%, secuencial. SinIO/caller/wire/índice/DBusuario. Constructor real conservaforma ypayload ya probados; nueva disponibilidad pura/SSR cubierta sin repetir runnerNext completo innecesariamente. Siguiente19j: clasificador preparatorio de múltiples slots/cadenas recurrentes, sólo si cabe entrega completa y cierre; no nuevas elecciones antes deevidencia/ejecutor.

## 19j1a — Clasificación estructural de varias apariciones

Núcleo puro identifica cohorte completa item:seriesId conraíz conflict ycola posterior pending0 sinlease,≥2slots actuales válidos deparent propio vivo/recurrente/confirmado. Conserva orden global, comandos, UUID ydependencias cruzadas entre slots intercalados; agruparlos no los vuelve entidades aisladas. Otras operaciones delparent/dependientes externos/colas parciales oinciertas bloquean; clausura ACK transitiva sóloDTO, sin acreditarrecibos remotos.

Seis tests/30aserciones: slots intercalados/historiainmutable, casoúnico conservaresolveranterior, firstroot/partial/duplicate/disconnected/attempts/foreign, parent externo/dependientes, ACKtransitivo, parent/slot inválidos ylímite/strict. Unaaserción esperaba unerror demasiado específico: elprerequisito quepasabaa pending esdelmismoparent yse rechaza antes como primerconflicto incorrecto; se conserva rechazo sinrelajar guardia. DoD1067pass/223skip/0fail/12320aserciones, lint978 sinavisos/tipos/Webpack/worker46/diff aprobados.

Entrada21%5h/19%7d, reservas10%/1%, secuencial. Ningún caller/elección/TX/backup nuevo: clasificación noautoriza superseder ni recuperarslots. Siguiente19j1b: contrato de comparación exacta deparent/cada slot/local/remoto/outcome yclausura; sólo después decisión/portable/TX/Mongo/Next/UI. Este lote cierra sin abrir ese bloque mayor ni nueva programación.
