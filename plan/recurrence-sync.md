# Sincronización de series y apariciones comunes

Estado11oct: generación4 sólo sincroniza planes simples; series/apariciones/progreso/cambios de fecha siguen locales. Arrastre simple y checklist heredada entregados16c1–3. No activar parcialmente un nuevo alcance.

## Productor de aparición y replay — 17e1b3

Productor plan-occurrence-outbox real captura parentCAS1/slotCAS0 y enlaza dos UUID. Primera respuesta realaction5 se pierde después decommitMongo: receipt/journal crece uno, localfirst pending1/lease null y childpending0 sinACK. Defaultclient5 reenvía UUID/payload exactos, obtiene replayúnico y sólo rebasa CAS del dependiente nointentado0→1. Segundo ACK deja slotrevision2/in_progress y padre1 intacto; dosparticiones/cursor12/cinco proyecciones exactos y sinextra writes. Doce escenarios pasan; helperfold/canonical común evita comparación por orden de claves. DTOfixture impide actor/toggleCAS/referencia cruzada inyectados. Screenshot /private/tmp/dalis-next5-occurrence-proof.png, recursos propios limpios; siguientes categorías/orden/conflictos/tombstones y operación de índicePreview autorizada antes activación.

## Hook y época reales — 17e1b2

Hook useRecurringSyncEngine real con action5/defaults y MapSWR propio separa key5 de cache4 preexistente. Outbox de plan/vista notifica resumenpending y obtiene ACK únicos. Nuevaépoca invalida cliente/resumen/intento anteriores; mismo árbol/provider sin key observa reset sinresult/summary/busy obsoletos. Unmount seguido de outbox/online/focus/visibility deja dos intenciones nuevas pending0 y sin reports; cliente5 fresco las confirma y ambos runtimes alcanzan journal10. Once escenariosNext5 propios pasan, sinGoogle ni productorlocalaparición todavía; screenshot /private/tmp/dalis-next5-hook-proof.png ycleanup propio completo. Sigue17e1b3.

## Recuperación y convergencia — 17e1b1

Cliente5/defaults reales recupera cuatro intenciones originales guardadas por productor atómico y antes rechazadas por cliente4. ACKs/evidencia durables conservan UUID/payload/deps; rawRPC de serie/aparición complementan journal con seis operaciones únicas. Ambos runtimes reabiertos alcanzan cursor6 y proyecciones completas items/occurrences/tags/views/placements iguales al fold autoritativo. Idle conserva todosstores y Mongo. Diez escenariosNext compilado/Mongo propios pasan; noGoogle ni lifecyclehook5/productor local de aparición declarados. Siguiente17e1b2 cubre esos límites antes provisión/activación; screenshot /private/tmp/dalis-next5-convergence-proof.png.

## Cola conservada — 17e1a2

Fixture con dos particiones y productor atómico real de plan/asignación. Bootstrap4 vacío inicializa su checkpoint durable antes del snapshot; luego identity/pull4 autenticados se capturan realmente y sólo se entregan una vez al runtime4. Referencia ausente409 marcado o wrapperretiro4 noACK, sólo root incrementaattempts y libera lease propio; handshake5 posterior bloquea antesclaim. Comparación de todosstores/cursor/UUID/payload/deps/outcomes exacta con única excepción prevista deattempts; Mongo intacto. Nueve escenariosNext5 pasan. No se recupera/sincroniza aún esa cola mediante5 en este corte; sigue lifecycle/convergencia17e1b. Particiones/control/sesiones/servidores/container propios retirados, screenshot /private/tmp/dalis-next5-queue-proof.png.

## Evidencia Next5 — 17e1a1

Modo next-recurring mantiene fixture4 y superpone únicamente fronteras futuras. Ocho escenarios compilados con acción5 real y sesiones persistidas propias prueban serie/aparición, recibo/journal único y replay entre clientes, actor/sesión/readiness y cuatro rechazos matrix antesbody. Retiro4 usa wrapper preparatorio explícito; todavía no prueba ID4 retirado en deployment. ID desconocido real en Next16.4 devuelve409 con x-nextjs-action-not-found1, según implementación instalada; generación4 fixture corregida y diecinueve escenarios regresión pasan. No ACK IndexedDB ni convergencia5 atribuidos todavía. Siguiente17e1a2: capturarhandshake4 y conservar cola/lease en cliente antiguo frente a retiro/ausencia, antes lifecycle5/proof integrada. Screenshot /private/tmp/dalis-next5-boundary-proof.png; recursos propios retirados, producto sigue4.

## Punto de continuación tras20:26

Código completo publicado `cc05d20`. Cortes17b3b–17d5 cerrados: categoría/replay/orden/dispatcher/readerMongo futuros, productores/ACK/pull/evidencia/backup/consumidoresIndexedDB, policy/coordinador/runtime y HTTP/acción/authpull/client/hook/cache5 privados. Producto activo4 intacto; sin repetición remota activada ni nueva provisión enDBusuario. Última suite748pass/201skip/0fail, lint773/tipos/build36. Recursos propios cerrados; revisión puntual eliminada sin cadena adicional.

Candidata **17e1a** detallada en [iterations.md](iterations.md): frontera real compilada Next5/defaults/sesiones/readiness/matrix/retiro4, antes de lifecycle5 y convergencia de dosparticionesMongo. No comenzar con seis puntos de margen hastareserva10%; último presupuesto16%5h/56%7d. Provisión índiceAppearance Preview sólo tras procedimiento propio validado y permiso específico; activación conjunta posterior, no config aislada. Recuperación/UI/backup recurrentes deben seleccionar consumidores futuros de manera coherente antes de exponer incidencias o activar5.

## Revisión e identidad

La intención local actual de aparición guarda `baseRevision` del padre y se encadena por `item:<seriesId>`. Esto no es la revisión de la aparición. Mantener esa semántica: en contrato futuro cada comando incluye `expectedOccurrenceRevision` explícito (cero sólo si no hay excepción materializada). `baseRevision` sigue siendo la revisión confirmada de la serie. No deducir ninguna revisión desde shadow/outcome ni reescribir intenciones históricas. El schema preparatorio17a1 exige el nuevo campo; los comandos antiguos sin él no obtienen ACK ni se reconstruyen automáticamente. La integración decidirá conservación/reintento explícito de pendientes según evidencia; no crear migradores caros ni wipe silencioso.

`seriesId:slotKey` sigue siendo identidad original, incluyendo hora civil en series timed. Cambiar fecha no cambia slot. Excepción materializada conserva contenido/progreso independiente aunque cambie regla del padre; variante/propiedad provienen del padre actual. Aparición no completa ni actualiza contenido/revisión semántica del padre. Revision propia sube sólo al commit remoto; optimismo local conserva revisión confirmada.

## Persistencia y concurrencia

El planner es puro, no da ACK ni equivale a ejecución/replay. Un executor deberá leer replay común primero y, en una misma transacción, autorizar padre, verificar revisiones, guardar aparición CAS/insert, recibo, journal y contador. Leer padre y escribir otro documento en snapshot no evita carrera con borrado/edición de serie. Registrar un guard transaccional por serie, escrito tanto por mutación del padre como por aparición, antes de aceptar el executor; no confundir CAS de aparición con autorización vigente de serie. No usar reloj/zona del servidor para cambiar slot/día declarado.

Colección futura de excepciones almacena identidad por usuario/serie/slot, ownership verificado por padre actual y retenido en tombstones; índices registrados en ensure-indexes y procedimiento propio antes de Preview. No índices/provisión ni nueva colección activa en17a1.

## Cortes y activación

1. **17a1**: contrato de intención con revisión explícita + planner puro, cuatro comandos/variantes, padre/slot/progreso/CAS/DST/cancelación. Preparado, sin tocar productores/capacidades activos.
2. **17a2**: lectores durables y captura opcional TX preparados en17a2a; default/callers actuales conservan intención histórica sin campo. IndexedDB propio valida cuatrovariantes, parent3/appearance7, slotnuevo0, replay/rollback/backup/recarga. Conexión futura de writer y rebase sólo pending no intentado dependen de ACK/pull y contrato5 completo. No reinterpretar revisión de comandos históricos.
3. **17b**: repositorio/CAS/índice explícito de apariciones preparado y validado en17b1; guard compartido preparatorio17b2a validado; sigue conexión obligatoria a ambos escritores y executor transaccional padre/aparición, replay/rollback/carreras con Mongo propio. Reader autorizado de series/excepciones/tombstones.
4. **17c**: ACK/pull atómicos en almacén occurrences, incidentes/evidencia de aparición actual y orden mixto simple/aparición (día/atrasadas), conservando dependientes y revisions por entidad.
5. **17d**: negociación exclusiva futura5, retiro4 y callers conjuntos, matriz estricta antes del body/cache/cursor, dos particiones/Mongo/Next real; activar sólo después. PilotoGoogle/segundo dispositivo si disponible. No anunciar convergencia por fixture o cola settled.

El cliente4 no admite proyecciones de apariciones. Nueva negociación separada de sobres/journal2 e intenciones1; no cambiar protocolos de evidencia/UUID por cambiar transporte. El nombre5 representa futuro alcance, no una activación por config. Cumpleaños/cierreMVP siguen después según elección humana vigente. Compartir por Gmail retirado del alcance actual el11oct.

## Evidencia17a2a

`planOccurrenceDurableCommandSchema` admite expectedOccurrenceRevision opcional en las cuatrointenciones; ausencia se preserva, no se normaliza a0. Entradas de outbox/backup/fingerprint reutilizan este decoder. El inputUI conserva schema estricto anterior. `captureRemoteRevision:true` captura la revisión de aparición leída en la misma TX que verifica snapshots y escribe aparición/outbox/secuencia; revisión local confirmada y base del padre no aumentan. Replay exige misma presencia/revisión/base y conserva UUID/payload/dependencias. Writer activo sigue false y todas las políticas remotas continúan unsupported para apariciones.

Cuatro checks IndexedDB propios pasan, incluida recarga, seisintenciones exactas (cinco con campo y una histórica sin campo), rollback por overflow y CAS rechazado sin escritura. Recursos propios limpiados. No executor remoto/ACK/nueva capacidad ni DB de usuario.


## Persistencia17b1

RemotePlanOccurrenceRepository aísla por actor y conserva identidad original serie/slot. Read y catálogo incluyen cancelaciones/tombstones; catálogo de una serie valida todos los registros y rechaza10001 sin truncar. Insert exige revisión1 y metadata inicial; replace exige base+1, createdAt original, slot y registro vivo/no cancelado. Sesión opcional integra commit/rollback reales; duplicado dentro deTX se propaga para abortar, fuera devuelve false. Usuario se añade en persistencia y se retira después de validar el registro, no cambia schema local de aparición ni propiedad derivada del padre. Este primitivo no autoriza el padre, no escribe guard compartido ni emite recibo/journal/ACK.

Colección plan_occurrences e índice único plan_occurrences_user_series_slot_uidx (userId/seriesId/slotKey) registrados explícitos. Singleton automático y selectores de provisión3/4 no incluyen este índice. Ninguna provisión Preview/producción en este corte. Executor/reader futuros deben autorizar padre vigente en mismaTX y escribir guard compartido también desde mutación de serie antes de aceptar esta persistencia.


## Guard compartido17b2a

writeRemotePlanSeriesGuard exige TXactiva y valida registro infra por _id canónico [actor,seriesId]. Cada adquisición escribe un tokenUUID nuevo, sin tocar revisión/contenido de serie. Guard permanecedurable, no es lease ni prueba de propiedad; ningún writer productivo lo usa todavía. Futuro executor debe releer propiedad/CAS tras cualquier retry y mutaciones de serie/aparición deben escribir el mismo guard en la TX de contenido/recibo/journal. Duplicado de primera creación no se absorbe dentroTX: el retry del wrapper debe abarcar autorización y todaslaslecturas.

Colección plan_series_guards usa sólo igualdad por _id; índice único nativo suficiente, siníndiceextra ni nueva provisiónPreview. Prueba controlada de snapshot previo demuestra reintento completo tras edición/borrado del padre, revisiónobservada1→2 y ceroapariciones nuevas; no equivale a activación/executor productivo.


## Escritor de series17b2b1

executeRemoteRecurringPlanOperation reutiliza namespace/recibo/journal deitems y habilita recurrencia sólo para planes, detrás de función preparatoria sin caller activo. Guarda el guard compartido en cada mutación de plan de este camino, incluso al quitar repetición; misma TX de contenido/CAS/contador/journal/recibo. Progreso del padre recurrente sigue unsupported y no deja ACK. Replay retorna recibo exacto antes de escribir guard, incluye tombstone y rechaza reutilizarUUID. Generación4 y legacy conservan rechazo de payload/recibo recurrente. Carrera de edición admite un ganador; fallo tardío de journal revierte guard nuevo o previo y contenido/recibo/contador. Mongo propio107pass/1342aserciones, sin provisiónPreview ni activación. Aparición aún requiere DTO/recibo/replay explícitos y executor con el mismo guard antes de conectar consumidores.


## Contrato de evidencia17b2b2

Rama preparatoria plan-occurrence mantiene sobres/recibos/journal2 y usa userId explícito porque aparición deriva propiedad del padre y no almacenaowner. Applied lleva record confirmado/revisión propia>=1, seriesRevision observada>=1 ysequence; conflicto lleva padrepropio yapariciónmaterializada opcional (null significa ausencia), con relaciónserie validada. Recibo ligaactor/UUID/fingerprint/resultado; journal registra originalslot/serie ymetadata decommit; límite512KiB comocontratos existentes. Decoderfuturo admite recibos anteriores sin reescribirlos; decoderactual sigue rechazando rama nueva. No persistencia/ACK/capacidad activa por parsear DTO; nextcorte conecta replayyexecutor usando estos contratos.

## Executor preparatorio17b2b3

executeRemotePlanOccurrenceOperation valida intención, consulta replay común yautoriza padre/lee aparición enmismaTX; cuatrocomandos requieren expectedOccurrenceRevision explícita. Guardcompartido+CAS, recibo2/journal2 ycontador atómicos; replay único precede autorización nueva, incluyeborrado/cancelación yconserva resultado anterior de ausencia aunque después se materialice aparición. Futuro writer de serie usa reader de recibos ampliado para detectar identidad reutilizada entre ramas; readers activos estrictos intactos. Wrapper de preferencias generalizado sólo en tipo de retorno, retries siguen abarcando toda autorización. Relación de identificador cruzada no llega a lookuprepositorio inválido: planner devuelve invalid_command. Histórico sinrevisión devuelveunsupported sinrecibo, UUID/payloadintactos.

Cinco escenarios Mongo nuevos cubren cuatrovariantes/cuatrocomandos, revisiones independientes, slotoriginal trasreprogramar, cancelación, aislamiento/CAS, replaytrasborrado yterminalesdurables, rollback tardío completo yrelectura real tras edición/borrado concurrente. SuiteMongo112pass/1503aserciones, recursospropios limpiados. Sin callerproductivo/índicePreview/ACKlocal ni capacidadesnuevas; sigue reader autorizado ydespués ACK/pull/evidencia locales según17c.

## Descarga privada17b2c1

readRemoteRecurringChangesV2 preparatorio añade rama de aparición en páginas de evidencia2, conservando checkpoint, límites/continuidad, adaptaciónlegacy ydatosoriginales. Un único motor Mongo comparte cursor/snapshot/controles conreaders vigentes, usando decoder/validación explícitos; readers activos siguen estrictos. Aparición exige padre actual propio kindplan yregistrodurable actual, incluidos cancelados/tombstones; sus revisiones actuales no pueden estar por debajo de evidencia histórica. Regla retirada o softdelete del padre no borran propiedad de historia. Ausencia/corrupción/hueco bloquean página entera, sin filtrado niavance parcial.

Trescasospure y tresMongo prueban mixedbootstrap, throughcongelado/incremental, antiguahistoriatrascambiopadre/borrado, cancelación, aislamiento/versión/UUID/metadata/correspondencia/rango, registrocurrentausente oparentajeno/revisioninferior/hueco. SuiteMongo115pass/1518aserciones. No rutaproductiva5, DBusuario/índice niACKlocal; siguiente17c evidencia yproyección/ACK/pull deapariciones.

## Evidencia local17c1a

Contratos preparatorios de submission, outcome yshadow deaparición mantienen versión2. Applied exige UUID/actor/serie/slot originales, parentbase exacta yexpectedOccurrenceRevision+1, además de corresponder aestado/checklist/edición/cancelación solicitados. Shadow independiente `plan-occurrence:<id>` conserva revisión propia yparentobservado explícito; decoderfuturo adapta shadowslegacy sinmutarlos, activo sigueestricto. Outcome captura apariciónlocal/base yserieactualnullable; observación puede serposterior acommit/replay yno prueba ancestro. Cinco pruebas puras comprueban correspondencia, corrupción/actor/slot/revisión/terminales, conflicto currentnull, replayconobservaciónposterior, evidencialocal yscopelegacy. SinACK/escritorlocal/capacidad activa; siguiente17c1b proyección/rebase y17c2 TXIndexedDB.

## Proyección yplan17c1b

Planner puro valida cola completa yshadows antes de decisión; pendiente de mismaaparición o padre conserva recordlocal, otraaparición no bloquea su proyección. Observación mayor no retrocede conreplaytardío; recorddistinto enmisma revisión eserror, parentobservado másreciente sobre recordidéntico esobservaciónválida sinatribuirancestro. Cancelación/tombstone permanecendurables.

Plan de resultado requiere leasepropio o replayACKidéntico/outcomedurable. Captura local/baseobservada/serie antes de proyección, estadosconflict/rejected/unsupported noACK; libera sólo leasepropio. ACKrebasa únicamente expectedOccurrenceRevision de comandos explícitos de lamismaaparición en pending+attempts0 condependencia directa. baseRevisionparent, UUID, dependencias, históricas sincampo, otrasapariciones ycomandosintentados intactos; cadenasrebasan sucesivamente al recibir sus commits reales, sin atribuir causalidad alshadow. Siete pruebas puras aprueban estasfronteras. No escribir ACK fuera deTX; sigue17c2 función IndexedDB yprueba real antes decallers/pull.

## TXlocal17c2a

applyLocalPlanOccurrenceResult preparatorio captura padre/aparición/cola/shadows/outcome enmismaTX IndexedDB yvalida partición/actor/lease/snapshotbounded; sólo transactioncomplete resuelveapplied/replayed. Cola/shadow/outcome/aparición se escriben juntos; replayidéntico noescribe, falloúltimooutcome reviertewrites yaencolados. No cambia padre ni borrarecordsnull/historia; epoch sigue responsabilidad delcaller futuro. Seischecks enbrowserreal4253 pruebancommit/replay/rebase/fallotardío/actorlease/corrupción/recarga, sólo particionesrunpropias limpiadas. Respuestas de esta fixture son sintéticas: no equivalen aconvergencia/RPC/Google; executorremoto ya probado aparteconMongo. Siguiente17c2b pullmixto atómico antes de conectarmotor5.

## Planner de pull17c2b1

Página mixta futura se valida y proyecta entera antes de escribir: checkpoint congelado, actor/cola/snapshot completo, identidad/revisión por entidad y padre propio con revisión disponible. Aparición pendiente preservada, progreso de otra aparición independiente, cancelados/tombstones y cache legacy conservados. Descarga no confirma comandos ni cambia payloads/outcomes. Seis pruebas puras pasan; TX local con cursor final continúa17c2b2, callers4 siguen intactos.

## TX de pull17c2b2

Puerto preparatorio IndexedDB captura contenido/personal/apariciones/cola/shadows/cursor coherentemente, valida toda página/snapshot y escribe cursor último enmismaTX. NoACK/rebase/outcome ni eliminación de datosnull; writes sólo de records cambiados y replayignored sinput. Fallo cursor revierte todos los cambios, retry limpio. Siete comprobaciones realesbrowser4254 incluyen partialcheckpoint/pending/actor/corrupción/tombstones/cachelegacy/recarga exacta, particiones propias limpiadas. Sin API/caller/generación5 activa; siguiente17c3 evidencia/incidentes yconsumidores futuros, después negociación conjunta yprueba dosparticiones.

## Incidentes puros17c3a

Decoder futuro de outcomes y snapshot de aparición validan todo estado/evidencia antes de comparación, incluidos estados terminales legacy e intenciones congeladas. Comparación toma apariciónactual del store, nunca planpadre; conserva localalresultado/baseobservada y serie actual/observada separados. Última evidencia remota no convierte shadow enancestro, contradicción de revisión eserror, null sólose captura comoausencia. Pendientesrelacionados visibles, sin resolución/supersession/ACK. Seis tests pasan; readerTX preparatorio continúa17c3b, consumidoresactivos4 aúnstrict.

## Captura de incidentes17c3b

Reader privado readonly obtiene apariciónactual yparent/cola/shadows/outcomes coherentes, valida partición/catálogos antes de comparación yresuelve sólo TXcomplete. Conflicto realmente persistido yposterior modificaciónlocal verificados con browser4253, comparación exacta trasrecarga, ceroACK/escritura yrecursospropios cerrados. SinUIresolución/consumidoractivo; futuros consumidores de resultados/backup/diagnóstico requieren decoders coherentes antes activar5, junto con orden mixto deapariciones.

## ACK personal preparatorio17c4a

Planner futuro valida todaslasfamilias/actor/parent/cola antes del plannerpersonal, conserva shadowsitem/aparición exactos yaplica límiteglobal10000 tras nuevos efectos. ACKpersonal/replay/lease/outcome/rebasecondicionado existentes intactos, no rebase deapariciones ni deintentadas. Cuatrotests aprueban mixedshadow/strict/actor/corrupción/parent/dependientes/unsupported; puertoTX futuro continúa17c4b. Sinampliación de parser/calleractual4.

## PuertoTX personal17c4b

applyLocalRecurringPreferenceResult preparatorio reutilizaTX actual con selección privada explícita, captura parentitems enmismaTX yvalida todaslasfamilias antes ACK. Puertoactualstrict intacto; futuro conservaaparición/parent/intención intentada exactos yshadow no modificado, últimooutcome atómico. Ocho checksbrowser4254 incluyenrechazoactivo/rollback/retry/replay/recarga ylimpieza propias. Callers4 sin cambios; raízserie/backup/diagnóstico/ordenmixto futuros aún requieren cierre coherente antes activación5.

## Raízserie local17c4c

Nuevo método preparatorio valida correspondencia exacta create/update/delete común yactor/UUID/revisión, admite recurrencia sóloplan; métodoactual no cambia yprogreso de padre recurrente noACK. Padre/shadow/cola/outcome atómicos, expectedOccurrenceRevision/localaparición independientes yintencionesintentadas preservadas; sólo baseparent de dependientedirecto unattempted rebasa. Tres puretests yfixtureIndexedDB4254 nuevechecks aprueban rollback/replay/recarga/strict. Backup/diagnóstico/ordenmixto futuros siguen antes del motor5; no anuncios/callers nuevos.

## Copia portable17c5a

Formato backup3 preparatorio representa nuevasfamilias sin ampliar codecsactivos1/2; intención1 yshadows/outcomes2 siguen originales, versionportable separada de negociación5. Codec futuro lee3/1/2 sin normalizarhistoria. Integridad común mantiene actores/cola/counter/ACK/decisiones yvalida parents/slots/contradicciones/revisiones observadas deaparición. Cinco tests nuevos yregresiónbackups pasan; exportTX futuro17c5b yUI/consumidores aúnpendientes, sinrestore/wipe automático.

## ExportTX17c5b

Snapshot común recibe codec/versiontipados: exportactual2 sigueestricto, nuevo export3readonly valida todosstores/namespace/marker/counter/outcomes/size antes TXcomplete. Conflicto realmente persistido yapariciónactualmodificada exportados, roundtripexacto ysnapshot/incidente/JSONidénticos trasrecarga probadosbrowser4253 (diezchecks, recursospropioslimpios). Sinrestore/import/caller5; ordenmixto deapariciones, executorpersonal de serie ypolítica/consumidores siguen pendientes antes integración.

## Planner de asignación17b3a

Exportfuturo permite asignar/limpiar categoría en parentcomún recurrente de cuatrovariantes usandoCAS de vista independiente; exportactivo4/legacy no se amplía, recurrenciaslegacyunsupported. Sincontenido/progreso/revisiónparentalterados; actor/parent/tagactual/deleted/CAS aprobados con tres tests nuevos. Planner no sustituye executor/guard/commit; siguiente17b3b pruebaMongo antes de integrar transporte5.

## Cierre histórico anterior a la continuación20:26 del 11 de octubre

El último código publicado es `c6449ed`. Series y apariciones cuentan con executors preparatorios, descarga privada, ACK/pull IndexedDB, evidencia de incidentes y exportación portable probados por separado. Esto todavía no constituye sincronización de repetición activada.

El siguiente corte es **17b3b**, descrito en [iterations.md](iterations.md): asignación de categoría a series con replay común, guard del padre y commit atómico. Después quedan el orden mixto de apariciones, consumidores y política coherentes, negociación5 conjunta, índices de aparición en Preview según procedimiento autorizado y prueba integrada de dos particiones Mongo/Next antes de activar. Mantener separadas las pruebas de fixture y el piloto Google/dispositivos físicos.

La revisión de esta ventana era puntual: se pausa al cerrar. No hay una nueva ejecución programada.

## Executor de asignación17b3b

Puerto futuro de vista comparte replay recurrente antes de mutar y usa el guard de serie en la misma TX que CAS/vista/journal/recibo. Callers activos mantienen su decoder y alcance. Históricos unsupported se replayean intactos, UUID de otra familia no se reutiliza. Pruebas Mongo propias demuestran cuatro variantes, asignación/limpieza/conflicto/replay, rollback tardío total y reread tras edición/borrado concurrentes. No cambia contenido/revisión del padre ni activa sincronización de repetición. Índices existentes de vista/recibo y `_id` del guard cubren las consultas; sin nueva provisión.

## Replay de categorías17b3c

El puerto futuro de categorías usa el decoder común de recibos recurrentes; creación/edición/movimiento/borrado conservan CAS y journal actuales. Recibos anteriores se replayean exactamente y la reutilización de un UUID de aparición se rechaza por fingerprint antes de efectos. Prueba Mongo incluye entrega concurrente única y rollback después de recibo. Callers4 intactos; índices existentes suficientes. Sigue17c5a: contrato/planner puro de orden mixto de planes simples y apariciones, antes de executor y consumidores.

## Orden mixto puro17c5a

Contexto futuro valida propiedad, identidad y revisión positiva de todos los catálogos durables antes de seleccionar; apariciones implícitas se generan con revisión0 únicamente como candidatos. Paginación completa por serie evita volver a parsear todas las series en cada página. Máximo10000 candidatos/catálogos y efectos512KiB: overflow o issue civil rechaza todo, nunca una lista parcial. Día incluye intervalos multidía; atrasadas usa fecha declarada y sentinel permanente, no reloj remoto. Cancelaciones/tombstones/reprogramaciones sustituyen slot original; excepciones explícitas permanecen visibles aunque cambie la regla vigente.

Rank manual comparte kernel actual, defaultfecha/hora/variante/identidad. CAS primario es posición, independiente de serie/aparición/vista; efectos no modifican contenido/progreso/slot. Categoría es del padre; cambio de grupo contempla sus otras apariciones visibles y actualiza su vista. Referencias de intención/efecto admiten canónicamente slots de hora para representar este futuro; los callers/políticas activos4 no amplían alcance y legacy comprueba rechazo del vecino timed fuera de su catálogo. Siguiente17c5b: catálogo Mongo/executor con guards y commit atómico; después autorización de descarga/ACK/pull y negociación5.

## Executor de orden17c5b

Puerto futuro consulta replay común antes de abrir catálogos y lee items/tags/views/placements/apariciones en una misma TX. Catálogo de apariciones completo del actor ordenado por serie/slot usa el índice explícito existente; incluye cancelados/tombstones, valida todos y rechaza10001. Planner autoriza padres de toda apariencia. Cada padre común con efecto se guarda mediante guard compartido en orden estable antes de CAS; placement/vista/journal/contador/recibo se confirman juntos. Root y apariciones no se alteran.

Mongo propio confirma cuatro variantes, peers simples, apariciones implícitas y materializadas/timed, entrega duplicada con recibo único, CAS competido, UUID entre familias, terminal histórico exacto, rollback después de recibo y reread completo tras edición/borrado de padre. Activo4 permanece estricto. Siguiente17c5c: autorización de descarga de placements por padre actual conservando historia/slots implícitos/tombstones; luego productor/ACK/pull y política futuros coherentes antes de generación5 conjunta.

## Descarga de posiciones17c5c

Reader privado recurrente resuelve UUID del padre desde slot canónico, exige parentactual propio kindplan y placementdurable con revisión al menoshistórica; categorías actual e histórica conservan autorización. Una posición implícita no exige excepción persistida ni regla actual para poder descargar historia. Cancelación/retirada de regla/borrado/tombstone no pierde propiedad; ausencia/corrupción/revisión inferior/padre extranjero/categoría ausente rechazan toda página. Lectores activos4 continúan strict; ninguna ruta nueva.

Dos escenarios Mongo prueban all_day/timed sin excepción, categorías de serie y checkpoint tras retirar regla/borrar padre/tombstoneplacement, y snapshot íntegro frente a faltantes/actor/corrupción/revisión/categoría.

## Productor de orden17c5d

Puerto IndexedDB futuro conserva revisión confirmada de posición y lee contexto/categorías/apariciones/cola en mismaTX antes de escribir optimismo y outbox. Identidad/slot/payload/sequence/tail/deps exactos; no cambia padre/aparición. Replay readonly y rollback tardío probados; ACK personal futuro sólo rebasa pendiente nointentado directamente dependiente y mantiene optimismo. Siete checks browser reales incluyen recarga/snapshot exacto y limpieza own; resultado ACK sintético no equivale a convergencia remota. Caller4 intacto. Siguen envío/consumidores/política/transporte5 y pruebas conjuntas.

## Frontera de envío17c6a

Contrato puro recurrente conserva sobre2 e intenciones1; resultado ordenado puede ser contenido, preferencia o aparición. Prefix retry y éxito completo se validan sin truncar; actor/UUID/familia/slot/revisiones/efectos exactos con límites UTF8. Correspondencia de aparición compartida con ACK local; históricos sinCAS sólo conservan terminales/conflicto, nunca crean aplicado. No habilita permisos/callers ni ACK. Sigue17c6b dispatcher remoto antes de servicios/política5.

## Dispatcher17c6b

Switch futuro usa exclusivamente executors preparados recurrentes y correspondencia común. Mongo real confirma doce comandos de contenido/aparición/checklist/edición/cancelación/categoría/asignación/orden/borrado, replay íntegro sin writes incluso después de borrados y UUID/actor/historia estrictos. Root4 rechaza recurrencia sin persistir recibo; si existe recibo histórico incompatible el futuro lo conserva y rechaza sin relabel. Sin rutas5/activación; sigue servicio autenticado y readiness del índice de aparición registrado.

## Servicio autenticado17c6c

Defaults privados validan sesión autorizada, expectedUserId, versiones y batch completo antes de readiness. Selección futura añade únicamente índice de aparición registrado a los cuatro personales; inspección exacta readonly sin crear índices. Retry preserva prefijo y posibilidad de replay tras respuesta perdida; errores no exponen secretos. Generación4 sigue inspección/executor/schemas propios. Falta política/consumidores y negociación5 conjunta; provisión de índice de aparición Preview requiere procedimiento y permiso específico antes de activación, no se ha ejecutado en DBusuario.

## Policy17c7a

Bundle futuro declara occurrences/kindplan-occurrence sin activar consumidores. ReadCommand permite contenido de serie/aparición/vista/placement según executors y conserva el contexto actual sólo como selector, no propiedad. FaltaCAS histórico bloquea explícitamente sin normalización; rootstatus de serie/legacy/settings/birthday fuera. Slots canónicos se conservan tras regla retirada/borrado para permitir replay remoto. Diagnóstico/resumen futuros sólo si se solicita bundle explícito; policy4 intacta. Sigue store/coordinador/runtime futuro coherente y pruebas conjuntas antes de5.

## Consumidor17c7b

OpenRecurring privado selecciona ACK root/aparición/preference y pull recurrentes de forma conjunta; apertura normal4 permanece strict. Actor/partición/sender/correspondencia/cierre se validan, TX existentes confirman todo antes de ACK/cursor. Veinte checks reales en4253/4254 reutilizan fixtures con almacenamiento sintético, incluyendo root/personal/appearance/rebase/rollback/recarga/cierre y comparación/backup intactos; todos recursos propios limpiados. Sigue coordinador/runtime futuro y negociación5 con pruebas de dosparticiones/Mongo/Next antes de activar.

## Coordinador17c7c

Policy y validadores futuros fijados juntos; generación4 conserva DTO/kernel estrictos. Guardias antes/después de red y cuenta/stop impiden ACK fuera de época. Claim se relee antes de envío, UUID/payload/deps originales y lease propio conservados; trabajo independiente puede avanzar pese a históricos bloqueados. Cinco pruebas puras con puertos simulados no equivalen a convergencia. Runtime, HTTP5, frontera Next y dos particiones/Mongo siguen como aceptación integrada pendiente.

## Transporte17d1

HTTP privado fija header5 exclusivo antes de body, cookies same-origin/no-store y deadline; matrix4↔5 rechaza sin datos/ACK y sobre2/intención1 quedan intactos. Cuatro pruebas puras cubren actor/DTO/query/deadlines; ninguna ruta o caller activo cambia. Runtime y prueba integrada siguen pendientes.

## Runtime17d2

Puerto privado fija coordinador/store/policy recurrentes juntos, captura cuenta/época y release, conserva lease propio al cerrar o perder cuenta. Seis checks browser propios prueban coalescencia/stop/cambios durante red/reapertura y ACK/pull local de aparición producida realmente. Respuestas simuladas; sin activación ni prueba RPC/convergencia. Next/índice de aparición/proof conjunta siguientes.

## Fronteras17d3

Descarga privada usa readiness5/reader recurrente y header5 exclusivo antes de datos; sesión/query/expectedactor primero y errores saneados. Acción5 preparada y retiro4 sin ejecución/ACK, ninguno conectado al producto activo. Ocho pruebas puras incluyen página recurrente y lease/intención intactos tras handshake4 capturado. Referencias RPC compiladas y dosparticiones/Mongo siguen pendientes.

## Cliente17d4

Factory5 privado selecciona acción/transporte/runtime/resumen recurrentes juntos; core tipa transporte sin ampliar DTO4. Identidad inmutable, guards y cleanup conservados. Resumen futuro exige release/store/policy coherentes, históricos sinCAS bloqueados sin rewriting. Seis pruebas nuevas puras; hook/cache y RPC/Next aún pendientes.

## Hook17d5

Wrapper5 privado comparte scheduler/listeners/cleanup pero separa cache y ownership de generación4 por actor/época/protocolo. Regresión de invalidación aprobada, sin provider activo. Lifecycle real5 y acción compilada Next/two-partitionMongo siguen como prueba próxima antes activar.
