# Sincronización de preferencias personales

Estado11c0/11c1a: diseño yDTO puro de efectos entregados, sin nuevo ejecutor, envío, índice o migración. Reductor compartido entregado11c1b1; planning de categorías entregado11c1b2a; vista personal simple entregada11c1b2b; próximo11c2a0: staged indexes explícitos. Tareas/eventos simples siguen usando el protocolo vigente hasta cerrar compatibilidad, persistencia remota y reconciliación local. No anunciar convergencia completa del espacio.

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
