# Sincronización de series y apariciones comunes

Estado11oct: generación4 sólo sincroniza planes simples; series/apariciones/progreso/cambios de fecha siguen locales. Arrastre simple y checklist heredada entregados16c1–3. No activar parcialmente un nuevo alcance.

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
