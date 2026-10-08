# Sincronización de preferencias personales

Estado11c3b2b: DTO y contratos versionados, planners y repositorios propios preparados; executors tag/view atómicos y carreras Mongo con barreras comprobados. Sus índices centrales requieren activación explícita. Contrato y reader Mongo mixto preparados; contrato push mixto y compatibilidad separados preparados; replay común en executor item comprobado; dispatcher mixto comprobado; servicio batch11c3b2c1 siguiente. Wire nuevo, ACK/pull/backup locales y activación siguen pendientes: [contrato transaccional](preference-transactions.md). Tareas/eventos simples mantienen protocolo vigente; no anunciar preferencias sincronizadas.

## Por qué hace falta otro tramo

Los comandos de categorías, vista y colocación ya existen en [sync.ts](../src/schemas/sync.ts). La cola acepta claves distintas de item, pero el coordinador solo considera comandos remotos de contenido simple ([coordinator.ts:145](../src/features/sync/coordinator.ts:145), [item-command-support.ts](../src/lib/sync/item-command-support.ts)). Recibos y cambios remotos solo contienen CalendarItem ([remote-sync.ts](../src/schemas/remote-sync.ts)); applyOperationResult excluye item-view.set/task.move y requiere itemId ([sync-store.ts:99](../src/lib/local-db/sync-store.ts:99)). Ampliar solo el filtro no constituye un ejecutor ni permite confirmar esos pendientes.

Las preferencias son personales: actor derivado de sesión, cada registro pertenece a ese userId. No confundirlo con ownerId del contenido que, más adelante, podrá ser compartido. No incluir email ni datos de sesión en intenciones o backups.

## Identidades y ámbito del cambio

| Registro | Identidad lógica | Observación |
| --- | --- | --- |
| Categoría | userId + id | normalizedName tiene que coincidir con NFKC/lowercase; duplicados activos necesitan la misma regla que el reductor local. |
| Vista | userId + itemId | Categoría personal, no cambio de contenido. Validar existencia/acceso vigente del elemento al ejecutar. |
| Colocación | userId + occurrenceId + scope + date | Usar la clave compuesta existente; atrasadas usa date=0001-01-01 aunque command.date mantiene el día de contexto. tagId no forma parte de la identidad. |
| Ajustes | userId | Contrato existente de zona/locale/lunes; settings.update figura en sync schema, pero su cola local todavía no tiene productor autorizado. |

Contratos de registro en [preferences.ts](../src/schemas/preferences.ts), claves de cola en [local-sync.ts:20](../src/schemas/local-sync.ts:20) y colocación en [ordering.ts](../src/schemas/ordering.ts). Revisiones son por registro; el contador de journal del receptor es otra magnitud. No reinterpretar baseRevision como un contador global de preferencias.

baseRevision procede del documento objetivo (0 si falta); los reducers locales no incrementan revisiones remotas al acumular ediciones offline. Varias intenciones pueden compartir base y los efectos secundarios no tienen su revisión expresada en el comando. Fuente: [preference-outbox.ts:128](../src/lib/local-db/preference-outbox.ts:128) y [task-move-outbox.ts:147](../src/lib/local-db/task-move-outbox.ts:147).

Una operación puede cambiar varias categorías al reequilibrar ranks, o una vista y varias colocaciones. El resultado debe conservar todos los efectos de esa intención en una transacción, recibo y entrada de journal. No dividirlo en ACK de documentos independientes. tag.delete conserva referencias en vistas/colocaciones; los lectores consideran sin categoría la referencia a una categoría borrada, sin cascada física. [preference-mutation.ts](../src/lib/local-db/preference-mutation.ts) es la semántica a reutilizar, no sustituir. Cambios dispersos tienen identidad explícita y tombstones; ausencia de un registro en un resultado no significa borrado ni autorización de eliminarlo.

## Contrato preparatorio11c1a

DTO framework-agnóstico de un conjunto acotado de efectos: actor userId, operationId, sequence y lista discriminada por store (tags, itemViews, taskPlacements, settings) con registro validado. Settings se representa para evolución posterior; no habilita un productor o mutación ausentes hoy. Incluir versión propia del DTO sin cambiar intención durable1. Este DTO prepara representación y validación; por sí solo no autoriza comandos, no da ACK y no modifica el contrato activo de red.

- Todos los userId coinciden; identidades compuestas canónicas, únicas dentro del conjunto, incluido settings único. No unir por título o nombre normalizado: la regla de nombre se aplica al ejecutar la categoría.
- Revisiones remotas positivas, registros íntegros, tombstones preservados. No aceptar registros de revisión0 como efectos remotos confirmados. Los ajustes/categorías/vistas/colocaciones no conceden acceso al contenido al que hacen referencia.
- Entre1 y10000 efectos, conjunto UTF8<=512KiB antes de persistir; exceso no se trunca ni aplica parcialmente. El corte de ejecutor deberá tratar un cambio demasiado grande explícitamente, conservando su intención para recuperación; no convertir ese caso en éxito vacío.
- Reutilizar schemas de dominio; no introducir tipos MongoDB/framework, lectura de env, IO o tipos de permisos compartidos.
- Incluir oráculos de claves y bytes, Unicode, claves distintas entre stores y rechazo de cuentas/revisiones/versiones/duplicados. Salida independiente de la entrada. Tests no deben ser la única especificación de autorización.

## Compatibilidad y conservación

Hoy syncProtocolVersion controla simultáneamente header de transporte y versión de operación, y push-batch rechaza toda operación de otra versión antes de ejecutar ([sync-protocol.ts](../src/config/sync-protocol.ts), [push-batch.ts:36](../src/features/sync/push-batch.ts:36)). Un simple cambio a2 dejaría fuera toda la cola durable de versión1. No reescribir UUID/payload ni huella de recibos ya enviados para evitarlo.

La ampliación propuesta diferencia transporte2 e intención durable1. El servidor actualizado acepta las intenciones1 soportadas bajo transporte2, conservando su huella exacta; versión futura de intención falla antes de efectos. Cliente antiguo/transporte1 se pausa antes de enviar o descargar/cambiar cursor. Cliente nuevo frente a servidor antiguo también se pausa. Esta transición requiere implementación/pruebas de ambas direcciones antes de activar preferencias; de momento todo sigue en1.

Mantener recibos/journal item antiguos legibles, con adaptación validada al sobre discriminado nuevo de item/preference. No destruir ni reescribir historia MongoDB. El journal sigue siendo una secuencia completa por receptor: [remote-changes.ts:55](../src/lib/db/remote-changes.ts:55) verifica que no haya huecos. Nunca filtrar preferencias de esa secuencia avanzando el cursor de un cliente que no puede aplicarlas.

El ACK local incorpora todos los efectos, shadow, outcome y estado de intención en una transacción; replay verifica el payload exacto. Pull persiste shadow y checkpoint atómicos y conserva el estado local acumulado cuando haya pendientes relacionados. No usar únicamente la entityKey primaria para decidir qué registros pueden sobrescribirse: una operación personal puede tocar varias identidades. Primera opción conservadora: retener proyección local de preferencias mientras exista cadena personal no resuelta, almacenando remoto para comparar; probar después reproducción/reconciliación y desatasco de esa cadena.

Backup portable1 representa intención1, no automáticamente transporte1. Nueva metadata/shadow/outcome necesita versión/lectura compatible antes de persistirla. El lector actual rechaza íntegramente metadata desconocida ([local-backup.ts](../src/schemas/local-backup.ts)), lo que evita descarte silencioso pero obliga a completar su evolución y la exportación antes de activar nuevos efectos. No restaurar recibos del archivo como autorización remota.

## Orden de entregas

| Corte | Rutas previstas | Aceptación y prueba |
| --- | --- | --- |
|11c1a|schemas/types y lib/sync puros|DTO de efectos y claves/propiedad/límites; no wire activo.|
|11c1b|reductor puro personal y tests|CAS y efectos completos de tag.save/delete/move/item-view.set; duplicados/tombstone/rank/dependencias; límites sin resultado parcial. task.move/settings permanecen pendientes de política/productor.|
|11c2a|lib/db, índices centrales y tests aislados|Repositorios personales por actor, CAS/identidades, unicidad activa de categorías y consultas reales; MongoDB propio con concurrencia. Registrar solo índices de consultas implementadas.|
|11c2b|recibos/journal/executor remoto|Efectos+recibo+contador+journal atómicos; replay/identidad reutilizada, fallo tardío, permisos vigentes para vistas. Sin activar envío todavía.|
|11c3a|wire/protocol/transport y tests|Separar intención1/transporte2, envelopes discriminados, adaptación de historia y pausa cliente/servidor mixtos; no huecos de cursor.|
|11c3b|schemas backup/local-sync, local-db y fixtures|ACK/pull/shadows/outcomes/backup completos, rollback y replay, preservación de cadenas y cuenta/época; evolución versionada sin borrado.|
|11c4a|coordinador y resumen/UI actuales|Selección por capacidades y dependencias, no mandar lo no soportado; conflictos personales conservados y visibles sin elecciones engañosas.|
|11c4b|fixtures dos dispositivos/Mongo, piloto|Categorías/vistas/ranks convergen, colisión nombres/edición concurrente/tombstones, desconexión/recarga/replay y clientes mixtos. Activación solo después de evidencia completa.|
|11c5|task.move y settings productor/reconciliación|Resolver contexto civil diferido y multiregistro, backlog/repetición pendiente; después pruebas de orden y zona en ambos dispositivos. No prometer fecha o granularidad antes del análisis de ese corte.|

Cada entrega conserva commit/push/cuotas y definición de terminado. Cambios de código: tests pertinentes, lint, tipos y build; DB/IndexedDB con fixtures propias cuando se implementen. Solo de lectura/documentación: referencias, coherencia ydiff-check. No nuevos paquetes, secretos, permisos o cambios de hosting.

## Riesgos que quedan abiertos

- No hay timestamp de creación dentro de syncOperation. La fecha de un movimiento de atrasadas puede pertenecer a otro día cuando llega al servidor. No validar usando sin más el reloj remoto ni inventar una hora de encolado.11c5 debe decidir semántica de as-of declarada o conflicto conservado y probar cambios de zona/día.
- Un conflicto temprano en preference-tail puede bloquear otros comandos personales. Conservar dependientes y evidencia; no saltarse dependencias ni dar ACK para desbloquear. Diseñar resolución explícita personal antes de anunciar sincronización completa.
- Compartidos siguen fuera: futuras vistas requieren autorización vigente del contenido; el primer ejecutor se limita a propios simples.
- Google/RPC Next real sigue pendiente de piloto con sesión autorizada de prueba. Las fixtures verifican pila de sync/MongoDB, no sustituyen ese piloto ni justifican tocar datos del usuario.


## Hallazgos adicionales de la revisión paralela

[preference-outbox.ts:162](../src/lib/local-db/preference-outbox.ts:162) y [task-move-outbox.ts:137](../src/lib/local-db/task-move-outbox.ts:137) enlazan tail personal, última operación de clave y última operación del contenido en view/move. La cola de contenido no espera preferencias: no hay orden total entre ambos dominios. Un tail inexistente falla; conflictos/rechazos no resueltos bloquean dependientes. Replay local exacto no avanza secuencia/tail.

Ranks numéricos pueden ser negativos/fraccionarios; conservar payloads y orden position/id, usando el adaptador legado sin sustituirlo automáticamente. Vecinos deben ser adyacentes tras retirar destino; reequilibrio modifica toda la lista pertinente sin cambiar revisiones remotas locales. [rank.ts](../src/lib/ordering/rank.ts), [legacy-rank-key.ts](../src/lib/ordering/legacy-rank-key.ts).

Day task.move permite aparición de serie con identidad original aunque se reprograme; categoría cambia el view de la serie y puede afectar varios placements. Overdue actual solo soporta tareas no recurrentes y exige sentinel/settings/día actual local; mantener la clave alternativa histórica de ocurrencias admitida por schema hasta migración específica. [day-task-move.ts:99](../src/lib/local-db/day-task-move.ts:99), [task-move-mutation.ts:45](../src/lib/local-db/task-move-mutation.ts:45). No habilitar recurrencia remota por aceptar un DTO personal genérico.


### Resultado11c1a — Efectos personales validados

DTO preparatorio versión1 para efectos dispersos en tags/itemViews/taskPlacements/settings; reutiliza schemas de dominio con revisión remota positiva, actor/operationUUID/sequence válidos. Clave documental JSON incluye store, userId eidentidad original (placement incluye referencia/scope/date, no tagId). Identidades únicas, settings único, referencias de tarea/aparición y sentinel overdue canónicos. Propiedad uniforme y esperado actor, registros completos/tombstones, salida clonada; hasta10000 registros y512KiB UTF8 de DTO validado, rechazo íntegro sin truncado. Settings representa evolución posterior, no añade productor.

Cuatro pruebas/39aserciones cubren oráculo de claves, IDs iguales entrestores/cuentas, misma colocación cambiando tagId, fechas distintas, tombstones/independencia, cuenta ajena, revisiones0, referencia/sentinel inválidos, normalización, futuro/campos extra/conteo y byteguard Unicode. Se ajustó el tamaño de la fixture para demostrar caracteres por debajo de512KiB pero bytes por encima, sin relajar límite. Suite239pass/30opt-in skip/0fail/4904aserciones; lint351archivos, tipos ybuild34recursos aprobados. Sin framework/IO/env/driver, índices, ACK, writes o cambio de protocolo activo.

Siguiente11c1b1: extraer el reductor personal existente a módulo puro compartido, equivalencia local y sin activar envío; después11c1b2 añade planning remoto/CAS/efectos completos. Mantener payloads ybase locales, historia ytipos no soportados.


### Resultado11c1b1 — Transformaciones personales compartidas

Funciones de categorías/vistas/ranking extraídas al módulo puro lib/preferences/preference-command, sin directiva de cliente ni IO/driver/framework. El adapter client-only local reexporta aliases de la API existente; todos los consumidores siguen usando exactamente esas transformaciones. Comparación textual contraHEAD anterior verifica igualdad completa salvo directiva y nombres genéricos. Revisión local, payload/errores/fechas/tombstones mantienen semántica.

Regresión nueva fuerza compactación sin posición representable: devuelve tres categorías afectadas, orden esperado y posiciones-1024/0/1024, campos/revisiones/entrada/tombstone preservados. Tests existentes de preferencias/day/overdue/rank reutilizan adapter;240pass/30opt-in skip/0fail/4915aserciones, lint352archivos, tipos/build34recursos ydiff-check aprobados. NoCAS/envío/ACK nuevo. Próxima11c1b2a planning remoto puro de familia tag.save/delete/move y efectos completos; item-view ytask.move siguen después según dependencias.


### Resultado11c1b2a — Planning de categorías remotas

Familia tag.save/delete/move convertida porplanner puro a changes/conflict/unavailable/invalid_command/unsupported, sinapplied/ACK niIO. Snapshot remoto propio valida IDs/nombres activos únicos yrevisiones positivas, actor/fecha/operaciónv1; cuenta corrupta falla antes deproducirplan. CAS porcategoríaobjetivo ybase0 solocreación, tombstone devuelvesu conflicto sinrestauración. Reutiliza transformaciones compartidas, conserva createdAt/campos yeleva cada revisión afectada desde su propio valor; overflowfalla íntegramente.

Movimientos devuelven todos los efectos decompactación; vecinos obsoletos ycolisiones NFKC produceninvalid_command sin cambios. Borrado mantiene tombstone yno toca referencias personales. DTO deefectos sevalida reservando el tamaño deMAX_SAFE_INTEGER de secuencia; no se asigna un número dejournal ni se declara recibo. Límite512KiB rechaza uncompactado grande sin truncarlo.

Seis pruebas/39aserciones yregresión246pass/30opt-in skip/0fail/4954aserciones; lint356archivos, tipos/build34recursos/diff-check aprobados. Fuente yentrada independientes, conflicto clonado, cuentas/futuro/normalización/bases/overflow/compactación comprobados. Próxima11c1b2b: planner puro deitem-view.set para elementos propios simples, conservación decontenido yCAS propio; series/movimientos/settings requieren sus cortes posteriores. DB yprotocolo todavía sin ampliación.


### Resultado11c1b2b — Planning de vista personal

item-view.set depropios simples convierte contexto remoto validado enefecto deúnica vista oconflicto/invalid/unavailable/unsupported. Contexto íntegro propio yreferenciascoherentes, revisiónpositiva detag/view/item, CAS debase0 nueva/actual ydeltombstone sinresurrección. Itemactivo ycategoríaactiva/null; reusa transformaciones, createdAt preservado yrevisión siguiente, límiteDTO conreservasecuencia máxima sinasignarjournal. Estado/checklist/descr./fechas delcontenido permanecen intactos; series/cumpleaños/settingsfamilia no seactivan.

Cuatropruebas/34aserciones: asignar/cambiar/quitar categoría, contextosajenos/identidadesincongruentes/base0stored/overflow, faltas/tombstones/CAS, clones ycontenido intacto, evento simple yrecurrencia/otra familiaunsupported. Se corrigió fixture derepetición al contratoend vigente; no cambio deschema. Suite250pass/30opt-in skip/0fail/4988aserciones; lint360archivos, tipos/build34recursos/diff-check aprobados.

Explorador sololectura confirma quegetDatabase/auth ejecutanINDEX_SPECS automáticamente. Próxima11c2a0 protegeíndices staged medianteprovisionamiento explícito central, antes deregistrar colecciones personales: no crear índices deproducto latenteporlogin enint. Luego11c2a1 repositorio decategorías/CAS yMongoDB propio, separado deexecutor/wire/ACK. No servicios/DB/envsecrets enesta investigación.


## Provisionamiento previo11c2a0

[client.ts:50](../src/lib/db/client.ts:50) llamaensureIndexes porprimera conexión y[auth-adapter.ts:66](../src/lib/db/auth-adapter.ts:66) usaesegetDatabase. Registrar índices detags sinprotección loscrearía alautenticar aunque elrepo noestéactivo. Antes11c2a1, añadirpropiedad opcionalprovisioning=explicit aIndexSpec: especificaciones pendientes siguenenINDEX_SPECS central, peroensureIndexes pordefecto seleccionasoloautomáticas. Testaislado puedeprovisionarselección explícita. Auth yscriptnormal siguenenautomáticos; activación futuraesun corteexplícito probado. No ejecutarconfiguración deDB real nimodificarsecretos/hosting.


### Resultado11c2a0 — Provisionamiento explícito

Registro central admite índices conprovisioning=explicit. Selección automática valida catálogo completo antes de excluirlos; bootstrap/auth/script mantienen exactamente los índices vigentes. Selección explícita conserva keys/options ypermite provisionar pendientes únicamente en unentorno autorizado. Duplicados incluso entre entrada automática/pendiente, nombres vacíos ypolítica inválida fallan antes dewrites. No se registra todavía colección ni índice nuevo yno se conecta aDB real. Instrucción anidada actualizada.

Tres regresiones conDB simulada; suite253pass/30opt-in skip/0fail/4999aserciones, lint360archivos, tipos/build34recursos/diff-check aprobados. Próxima11c2a1: repositorio actor-scoped decategorías, catálogo íntegro/CAS/unicidad activa ypruebas deMongoDB propio; índices pendientes centrales, sinexecutor/wire/ACK activados.


## Repositorio de categorías11c2a1

`RemoteTagRepository` es server-only yusa singleton/getCollection, conactor validado ysession opcional en todos los accesos. ClaveMongo `_id=JSON.stringify([userId,id])`: UUID iguales deactores distintos son válidos, a diferencia dela identidad global delcontenido. Read poruserId/id incluye tombstone; catálogo ordena porid ylee10001 para rechazar más de10000 sinresultado parcial. Registros validan schema remoto de revisión positiva, normalización, propiedad eidentidad almacenada; catálogo valida unicidad ID/nombre activo.

Insert requiere revisión1/metadatos iniciales/activo. Duplicado deidentidad devuelvefalse solo fuera desession; colisión de nombre activoyerrores en sesión sepropagan para no disimular abort. Replace filtra actor/id/claveMongo/base>=1/createdAt/currentactive, exige revisión siguiente ypreserva_id. No resurrección. Índices centrales pendientes: `{userId:1,id:1}` único pararead/catalogsorted; `{userId:1,normalizedName:1}` único parcial deletedAt:null. Nombres borrados sonreutilizables conotroUUID; bootstrap/auth no provisionan estos índices. Activación yexecutor multirregistro permanecen posteriores, sin nuevosACK.


### Resultado11c2a1 — Categorías propias en MongoDB

Repositorio server-only conactor/session/singleton; UUID compuesto porcuenta, catálogo íntegro<=10000 incl.tombstones yregistros positivos validados. Insert inicial yCAS porrevisión/createdAt/activo; identidad duplicadafalse solo fueradesession, nombre duplicado/error ensessionpropagados. Índices centrales únicos deidentidad/nombreactivo registrados explicit: login/bootstrap no activa colección pendiente. Compartidos/executor/wire/ACK noampliados. Se ajustó replaceOne aWithoutId deldriver: filtra_idcompuesto ypreserva_id omitiéndolo delreemplazo.

Worker paralelo propietario solotest/runner, rootrepo/contratos/registro/plan. MongoDB8.2.11amd64 digestfijado revalidado; runner aislado21pass/0fail/168aserciones, seis nuevas pruebas/63aserciones: mismoUUID/nombre entreactores, CASrace, tombstone/nombre reutilizable, carrera nombre activo ycolisión replace, corrupción, catálogo exacto10000/overflow10001, rollback tardío múltiple yduplicado dentro detransacción. Contenedor/tmpfs propios limpios, sinDBusuario/envsecrets/browser. Normal254pass/38opt-in skip/0fail/5000aserciones; lint362archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2a2: repositorio deitemViews propio, conCAS/identidadcompuesta ysession, pruebas aisladas yautorización decontenido enexecutor posterior. Mantener cortes separados yreserva10%, sin declarar preferencias activas.


### Resultado11c2a2 — Vistas personales en MongoDB

Repo server-only propio/session/singleton poractor+itemId, claveMongo compuesta validada yrevisiónpositiva compartida conplanner. Read incluye tombstone, insert inicial yCASrevision/createdAt/activo, duplicateidentityfalse fuera desession ypropagación dentro. CategoríaUUID/null validada; índice único userId/itemId explicit, no provisionado porbootstrap. Persistencia no concede acceso acontenido: executor posterior debe verificar item/tag vigentes enmisma transacción; no nuevoscallers/envíos/ACK activos.

Worker solointegrationtest/runner; rootrepositorio/schema/registry/plan. RunnerMongoDBpropio exit0:25pass/0fail/215aserciones en6archivos; cuatro pruebas nuevas/47aserciones deaislamiento conUUIDigual, metadata/propiedad, CAS/conservar/quitarcategoría/tombstone, corrupción yrollback múltiple/duplicado ensession. Contenedor/tmpfs propios eliminados; pinned8.2.11amd64 revalidado, noDBusuario ni secrets/hosting. Normal255pass/44opt-in skip/0fail/5002aserciones, lint364archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b0: concretar contrato deatomicidad/recibos/journal ydependencias decompatibilidad antes deimplementar ejecutor multirregistro. Preferencias aún sin sincronización activada; task.move/settings/series/compartidos posteriores.


11c2b2b1 entrega executor preparatorio de categorías y pruebas de atomicidad/replay/rollback con Mongo propio. No activado: antes deben completarse vistas11c2b2b2, carreras11c2b3 y compatibilidad/ACK/pull. Reserva actual10%5h/5%7d por solicitud humana, con comprobación tras commit/push.


11c2b2b2 prepara asignación de categorías propia para tareas/eventos simples con autorización transaccional, CAS/rollback y ledger común; sin activación. Próxima11c2b3 exige carreras deterministas con snapshots solapados antes de compatibilidad/ACK/pull. Política vigente10%5h/2%7d por petición posterior del usuario.


11c2b3a demuestra con cinco carreras Mongo de snapshots solapados la coherencia de vecinos, autorización propia frente a delete y unicidad NFKC. Retry observa contexto nuevo y conserva ausencia de efectos/journal del perdedor. No locks productivos. Próxima11c3a, contrato mixto/compatibilidad previo a lectores y ACK/pull; no activar por estas pruebas aisladas.


### Resultado11c3a1 — Descarga mixta validada

Schema/type/verificador puros para página explícita versión2 con journal item/preference normalizado íntegro. Hasta100 registros, secuencias consecutivas y operationIDs distintos; nextAfter/checkpoint/hasMore coherentes. ExpectedUserId y query externos comprueban cada receptor, after+1, limit y through congelado. Página vacía no avanza ni oculta huecos. Salida clonada, futuro/extra/legacy página rechazan; adaptación readonly de registros legacy sigue siendo tarea del futuro reader antes de crear el envelope. No IO, wire/ACK/cursor/DB ni callers activos nuevos.

Guard2MiB UTF8 para página completa, separado de512KiB por journal. Permite futura paginación de menos registros que limit, nunca truncar contenido; cabe cualquier primer registro admitido con metadata. Cuatro pruebas/58aserciones nuevas cubren mezcla/tombstones/clones, continuación/checkpoint/vacío, dueño/query/saltos/duplicados/extra/futuro/100máximo y página Unicode que excede bytes aun siendo válidos todos sus registros individuales. Fixture de duplicados corregida para reutilizar realmente el UUID del primer registro. Suite269pass/69opt-in skip/0fail/5179aserciones, lint389archivos, tipos/build34recursos/diff aprobados; sin repetir Mongo por este contrato puro.

Próxima11c3a2: reader Mongo propio mixto con snapshot/cursor/byte-paginación sin filtrar historia, seguido de handshake/transporte y ACK/pull/backup compatibles antes de activar. Contrato puro no negocia compatibilidad, concede permisos ni prueba convergencia. Reserva10%5h/2%7d; commitpushHEAD/cuotas al cierre.


### Resultado11c3a2 — Reader mixto preparatorio

readRemoteChangesV2 valida actor/query antes de IO y lee contador/journal/autorización en una misma snapshot. Adapta registros legacy readonly a item/v2, conserva cada efecto personal y secuencias sin huecos. Consulta recipientUserId/sequence usa índice vigente; count<=100 y byte-paginación2MiB con tamaño exacto de registros/commas/envelope, sin partir entradas. Cursor siempre cerrado. Checkpoint congelado y error de cursor futuro conservados.

Item exige pertenencia actual incluso para historia; categorías exigen registro propio actual y vistas documento propio más acceso propio al item/tag referido. Tombstones preservan ownership y permiten descargar historia anterior intacta; ausencia/futuro/corrupción/store personal aún sin executor rechazan página sin filtrar ni avanzar. No callers/rutas/transporte/ACK/pull productivos nuevos, ningún índice nuevo ni provisionamiento personal fuera de test propio.

Cuatro escenarios nuevos Mongo: journal mixto producido por executors reales y checkpoint/incremental tras deletes; aislamiento/cursor/input inválido; huecos/futuro/corrupción/settings no soportado/item con owner cambiado/vista ausente, fixtures restauradas;28tareas grandes en fixtures transaccionales propias, dos páginas por UTF8 con28secuencias y checklist completo en todas. Esta última fixture prueba reader/bounds, no ACK de escritura real. Mongo46pass/0fail/475aserciones en11archivos; recursos propios eliminados. Normal269pass/75opt-in skip/0fail/5179aserciones, lint391archivos, tipos/build34recursos/diff aprobados.

Próxima11c3b1: contrato de respuesta push mixta/versionada y compatibilidad transporte2/intención1, sin activar todavía. Después servicios/handshake, metadata/ACK/pull/backup y prueba de dos dispositivos antes de activar preferencias. Reserva10%5h/2%7d vigente, commitpushHEAD/cuotas al cierre.


### Resultado11c3b1a — Push mixto preparatorio

Input explícito transportVersion2 reutiliza schema de intenciones durables1, UUIDs/operaciones intactos y fingerprint v1 sin cambios. Guard512KiB incluye envoltura completa además del batch interior. Respuesta versión2 discriminada complete/retry_later/rechazos generales, resultados item/preference strict<=50/49, operación distinta por resultado y guard2MiB completo. Verificador exige actor/request, orden/IDs/familia, resultado completo o prefijo retry exacto/failedOperationId siguiente. Dueño de datos y objetivo principal de applied/conflict coinciden con el comando; efectos multirregistro conservados. Validación no concede ACK ni negocia compatibilidad; no IO/wire/config/ServerAction/metadata/DB activos modificados.

Cinco pruebas/70aserciones: digest exacto y clones/mezcla/errores, prefijos incluidos vacío/parcial, truncado/desorden/duplicados/versiones/cuenta/familia/objetivo ajeno, batch interior válido justo512KiB cuya envoltura excede, respuestaUnicode que excede2MiB con outcomes individuales válidos y prefijo menor intacto. Tupla Zod y literales/tipo de fixtures ajustados antes del cierre; lint sin ruido. Suite274pass/75opt-in skip/0fail/5249aserciones, lint395archivos, tipos/build34recursos/diff aprobados. No repetir Mongo por contrato puro.

Próxima11c3b1b: separar versión de transporte de la intención1 en compatibilidad/config preparatoria, conservando transporte activo1 y probando negociación2/1 en ambas direcciones. Servicio mixto/metadata/ACK/pull/backup/dos dispositivos siguen antes de activar. Si response futura excede límite, conservar prefijo completo y pedir retry de siguiente intención, incluso si el commit durable ya existe: replay lo preserva, no falso fallo ni pérdida de intención. Reserva10%5h/2%7d, commitpushHEAD/cuotas al cierre.


### Resultado 11c3b1b — Compatibilidad separada de intención

La versión durable de operación conserva1 y el transporte activo conserva1, ahora con constantes distintas. El batch actual compara contra la versión de intención; helpers puros permiten anunciar/verificar una versión explícita validada sin ampliar el rango activo. Negociación2/1 se rechaza en ambas direcciones,2/2 y1/1 se aceptan; defaults y UUID/payload/fingerprint de cola intactos. No caller productivo2, cambios de DB, metadata, ACK/pull ni activación personal.

Prueba nueva de23aserciones cubre direcciones incompatibles, versión válida/explícita y valores inválidos. Suite275pass/75opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados. Contrato puro no requiere repetir Mongo. Por petición humana durante esta entrega, reserva semanal2→1%; reserva5h10% conservada, AGENTS/workflow actualizados en este mismo commit. Las entradas históricas mantienen su política original.

Próxima candidata11c3b2a: lectura común fingerprint-bound en executor item para clasificar UUID reutilizado frente a recibos personales/versionados, conservando resultado activo legacy y escrituras actuales. Después dispatcher/servicio mixto y metadata/ACK/pull/backup compatibles antes de activar. Commit/push/HEAD/cuotas al cierre, reserva10%5h/1%7d vigente.


### Resultado 11c3b2a — Replay item compatible con recibos mixtos

Executor item usa replay común dentro de su transacción snapshot y compara fingerprint canónico antes de interpretar la familia. Recibos legacy/v2 item devuelven outcome legacy independiente; recibo personal exacto rechaza por incompatibilidad sin convertirlo en ACK item. UUID reutilizado con payload/familia diferente lanza identidad reutilizada sin efectos. Escritores/journal/resultado activo1 y autorización propios conservados; índices actor+operationId vigentes, sin rutas o activación personal.

Dos pruebas Mongo nuevas: fixture de recibo item legacy adaptado a v2, replay tras tombstone, independencia de salida/historia, corrupción de dueño/futuro y restauración; recibo de categoría producido por executor real, UUID reutilizado/familia incompatible sin item/journal/counter nuevos y mismo UUID permitido a otro actor. Mongo48pass/0fail/494aserciones en11archivos, contenedor/tmpfs propios eliminados. Suite275pass/77opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2b: dispatcher preparatorio para delegar por familia a executors reales, conservando validación antes de IO, replay/unsupported y resultado v2 sin activar wire2. Después servicio autenticado y metadata/ACK/pull/backup compatibles antes de preferencias remotas activas. Reserva10%5h/1%7d vigente; commit/push/HEAD/cuotas al cierre.


### Resultado 11c3b2b — Dispatcher mixto preparado

executeRemoteOperationV2 valida actor/intención antes de IO y delega a executors item/tag/view con sus transacciones reales. Items se envuelven readonly en resultado v2; personal conserva resultado íntegro. Settings/task.move pasan por rechazo unsupported previo al catálogo del executor personal, con replay/fingerprint dentro de sesión sin escribir para comandos nuevos. Resultado propio clonado, familia/operationId coherentes; historia incompatible rechaza sin relabel ni falso ACK. Sin prelectura de autorización/recibo fuera de transacción, índices nuevos ni callers productivos.

Cuatro escenarios nuevos Mongo: mezcla item/tag/view con secuencias1/2/3 y replay tardío tras delete sin reescritura; UUID reutilizado en ambas direcciones y actor aislado; unsupported e inputs futuros/extra/inválidos sin efectos y UUID reutilizado incluso para unsupported; fixture de familia incompatible rechaza y se restaura. Runner52pass/0fail/520aserciones en12archivos, contenedor/tmpfs propios eliminados. Normal275pass/83opt-in skip/0fail/5272aserciones; lint397archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2c1: envelope de clasificación transport2/intención1 y servicio batch mixto preparatorio autenticado por actor externo, prefijos/retry/identidad/bounds sin publicar nueva acción. Separar pruebas puras de política de integración Mongo si margen lo requiere; no conectar wire2 antes de metadata/ACK/pull/backup compatibles. Reserva10%5h/1%7d; commitpushHEAD/cuotas al cierre.
