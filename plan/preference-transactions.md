# Transacciones remotas de preferencias

Estado11c2b0: contrato de implementación siguiente; no ejecutor personal activo. Repositorios y planners están probados por separado. Esta propuesta exige las pruebas siguientes antes de declarar atomicidad personal o activar envío.

## Historia y resultados

Reutilizar las colecciones de recibos y journal existentes. La identidad durable sigue siendo actor+operationId; una colección separada permitiría reutilizar un UUID entre familias sin detectar otro payload. El fingerprint sigue calculándose sobre la intenciónv1 exacta mediante [operation-fingerprint.ts](../src/lib/sync/operation-fingerprint.ts); cambiar transporte no cambia intención ni digest.

Primer corte11c2b1: schemas/types puros de resultado, recibo y cambio versionados, con decodificador de historia. Recibo nuevo explícitamente versión2; resultado discriminado item/preference. Personal applied contiene el DTO completo de efectos de11c1a; conflict conserva un efecto validado del documento objetivo, sin llamar aplicado al planner. Validar actor, operationId y sequence coherentes entre envoltura/resultado/efectos. El límite512KiB debe cubrir la envoltura serializada UTF8 completa: el guard del DTO interno por sí solo no basta.

Recibos y cambios antiguos sin versión siguen pasando su schema actual y se adaptan únicamente en memoria a la variante item. No reescribir la DB ni cambiar fingerprints. Versiones desconocidas, propiedades extra, dueño/identidad/sequence inconsistentes y registro ambiguo rechazan íntegramente. Un resultado conflict/rejected no asigna secuencia aplicada; unsupported sigue conservándose sin ACK ni desbloqueo artificial.

El journal nuevo personal representa todos los efectos de una operación en una sola entrada y una sola sequence. No guardar una entrada por tag compactado, ni usar revisión de un documento como checkpoint. El contador y el journal existentes permanecen únicos por receptor; [remote-changes.ts:55](../src/lib/db/remote-changes.ts:55) requiere secuencias contiguas. Antes de escribir una variante nueva, deben existir lectores/handshake que detengan clientes antiguos antes de avanzar cursor; nunca omitir entradas personales.

## Unidad atómica propuesta

Segundo corte11c2b2: ejecutor server-only preparatorio, sin callers productivos ni activación de índices. Actor suministrado por servicio autenticado; intención validada antes de IO. Una misma sesión snapshot/majority contiene:

1. Lectura del recibo propio y comparación de fingerprint. Replay devuelve el resultado durable exacto sin escribir revisiones, contador ni journal.
2. Lecturas de categorías completas o vista/item/tag propios vigentes. Para vistas, contenido activo simple y categoría activa/null; no conceder compartidos por tener una vista propia.
3. Planner puro, CAS de cada efecto respecto a su documento leído y revisión siguiente propia. Compactación escribe el conjunto completo; cualquier CAS fallido aborta toda la transacción.
4. Incremento del contador común, validación del DTO y envoltura con la sequence real, inserción del journal íntegro y del recibo. Resultado applied solo tras commit.

El patrón vigente está en [remote-item-commands.ts:147](../src/lib/db/remote-item-commands.ts:147): contenido ya escribe ese contador en la misma transacción. Propuesta: todos los cambios personales applied también lo escriben. Dos transacciones snapshot con efectos disjuntos deben competir por ese documento común, provocar retry con snapshot fresco y conservar coherencia del catálogo y autorización. Esto evita introducir otro lock/contador; **hipótesis comprobada para contextos propios en las cinco carreras Mongo de11c2b3a descritas abajo**, no garantía derivada del CAS individual.

Probar específicamente un movimiento que leyó vecinos antes de crear/borrar otro tag y una vista que leyó contenido antes de una eliminación concurrente. La unicidad de nombres evita duplicados activos, pero no demuestra por sí sola coherencia de vecinos ni permiso vigente. No activar si el contador compartido no fuerza la relectura necesaria. El contador no sustituye las revisiones independientes de los documentos.

Errores de duplicado abortan la transacción; nunca capturarlos para continuar escribiendo en esa sesión. Reiniciar con sesión/snapshot nuevo y límite acotado, como [remote-item-commands.ts:177](../src/lib/db/remote-item-commands.ts:177). Distinguir identidad/recibo, nombre activo y CAS: una colisión de nombre debe volver a clasificarse por el planner sobre catálogo fresco; agotamiento/transitorio no se convierte en ACK o rechazo definitivo falso. Mantener ahora fuera task.move/settings/series/cumpleaños/compartidos.

## Aceptación posterior

| Corte | Evidencia necesaria |
| --- | --- |
|11c2b1|Schemas estrictos puros; legacy exacto adaptado sin mutación; applied/conflict por familia; actor/identidades/sequence/UTF8/futuro; wire e historia almacenada actuales sin cambios.|
|11c2b2|Mongo propio: CAS multirregistro, fallo después del último efecto/counter/journal con rollback íntegro; mismas operaciones concurrentes un recibo/journal; replay perdido exacto e identidad reutilizada rechazada.|
|11c2b3|Barreras en tests para snapshots solapados: catálogo/vecinos frente a create/delete, nombres NFKC concurrentes y autorización de vista frente a item.delete; demostrar contador común, retry y ausencia de efectos parciales.|
|11c3a–4b|Handshake/lectores de ambas historias, ACK/pull/backup atómicos, conflictos visibles y dos dispositivos; solo después provisionamiento/activación explícitos.|

Estos cortes actualizan plan y registro, pruebas/lint/tipos/build, commit+push enint y consulta de ambas cuotas. Las pruebas de repositorios11c2a1/2 no sustituyen las pruebas de recibo/journal/autorización del ejecutor.


### Resultado 11c2b1a — Resultados versionados

Envoltura pura kind=item/preference con outcome discriminado; item reutiliza schema vigente, personal applied contiene DTO completo y exige misma operationId, conflict conserva un efecto positivo/tombstone sin sequence. Errores estrictos no conceden ownership ni ACK. Verificador exige expectedUserId válido y compara propietario de todo resultado con datos. Decoder reconoce variante nueva o legacy estricto, adapta legacy solo en memoria y devuelve clones; no modifica intención/fingerprint/historia, wire activo, DB o localACK.

Guard512KiB UTF8 de envoltura completa. Cuatro pruebas/53aserciones: seis estados item/legacy, personales, conflictos/tombstones, cuenta/identidad/sequence/extra/futuro/ambiguo, independencia y DTO interno válido que excede límite al envolverlo. Se corrigieron literales TS de fixtures sin cambiar contrato. Normal259pass/44opt-in skip/0fail/5055aserciones; lint368archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2b1b: recibo explícito versión2, actor/op/fingerprint/resultado/fecha coherentes, decode legacy readonly y guard de recibo completo, sin activar writes. Después11c2b1c journal. Con cuotas compartidas, elegir por consumo observado de ambas ventanas, no equivalencia entre sus porcentajes.


### Resultado 11c2b1b — Recibos versionados

Schema puro recibo explícito versión2 reutiliza resultados item/preference; identidad de operación coincide outcome, actor coincide propietario de resultado con datos y expectedUserId externo incluso en errores sin contenido. Propietario extraído mediante helper único compartido por resultado/recibo. Digest64hex y fecha se preservan: decoder legacy readonly conserva payload y devuelve clones, no verifica commit remoto/digest/acceso actual ni concede ACK al importar archivo. Guard512KiBUTF8 cubre recibo completo además del resultado.

Tres pruebas/39aserciones cubren seis resultados legacy y personal, clones, errores/tombstone/conflict, cuenta/ID/digest/fecha/versión/extras/ambigüedad; resultado válido que excede límite al añadir metadata rechazado. Aviso opcional-chain yformato deguardia defixture corregidos, lint sin ruido. Suite262pass/44opt-in skip/0fail/5094aserciones; lint372archivos, tipos/build34recursos/diff-check aprobados. No wire/IO/DB ni escritores activos ampliados.

Siguiente11c2b1c: journal versionado/discriminado, adaptación legacy sin huecos ni reescrituras, validación recipient/op/sequence/efectos y envoltura completa; luego ejecutor atomicidad con pruebasMongo propio antes deactivar.


### Resultado 11c2b1c — Journal versionado

Schema puro versión2 discriminado item/preference conserva recipientUserId/operationId/sequence en raíz paraqueries/índices vigentes; variante item reutiliza schema actual/refinamiento deowner. Personal exige mismo actor/operationId/sequence en DTO interno y conserva multirregistro/tombstones en una entrada. Verificador externo valida actor esperado; decoder adapta legacy sólo en memoria, con clones ysin filtrado/reindexación/checkpoint. Guard512KiB UTF8 incluye envoltura completa.

Tres pruebas/27aserciones: historial mixto secuencias1/2 ytopkeys intactos, dos efectos/un tombstone, independencia, IDs/owners/sequence/extra/ambiguo/futuro, DTO válido cuyojournal excede porenvoltura. Suite265pass/44opt-in skip/0fail/5121aserciones; lint376archivos, tipos/build34recursos/diff-check aprobados. No DB/IO/escritor/ruta/wire/ACK/pull activo nuevo; adaptación individual no implementa paginación ni garantiza convergencia por sí sola.

11c2b1a–c completan contratos preparatorios separados deactivación. Siguiente11c2b2: ejecutar conjuntos deefectos, contador/journal/recibo conmisma sesión yautorización vigente, replay/CAS/fallos tardíos conMongo propio; dividir antes deabrir segúncuota yconservarreserva10.


### Resultado 11c2b2a — Lectura común de recibos

Función server-only poractor+operationId validados, colección vigente/singleton yClientSession opcional. Quita únicamente_id yreutiliza decoder legacy/v2, valida coherencia ydevuelve clones/null sin IOextra/escrituras. Consulta ya cubierta por índice único actorUserId/operationId vigente; no requiere índice nuevo yno activa colecciones personales. No callers productivos nuevos ni cambio deejecutor/wire/ACK.

MongoDB propio runner28pass/0fail/231aserciones en7archivos; tres nuevaspruebas: mismoUUID entreactores/legacy+personal/independencia/requests inválidos; corrupción/futuro rechaza yfixture restaurada; receipt visible sólo dentro desession yrollback intacto. Runner revalida disponibilidad medianteimagen fijada/guards, contenedor/tmpfs propios eliminados; noDBusuario/secrets/hosting. Fixtures ajustan_id string ydiscriminantes literales a tipado deldriver. Normal265pass/49opt-in skip/0fail/5121aserciones, lint378archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b2b: mutaciones multirregistro propias + contador compartido + journal/recibo enmisma sesión, replay/CAS/fallos tardíos ypruebasMongo;11c2b3 probará carreras conbarreras antes deactivar. Este lector no verifica digest contraintención por sísolo: futuroexecutor debe comparar fingerprint yautorización vigente. Elegir siguientecorte trascuotas, reservando margen de reparación/cierre ysin equiparar porcentajes deventanas.


### Resultado 11c2b2a2 — Replay ligado a la intención

`readRemoteOperationReplay` valida actor e intención antes de IO, calcula el fingerprint v1 canónico en servidor y compara contra el recibo propio legacy/v2 leído en la sesión suministrada. Devuelve resultado normalizado/null; UUID reutilizado con otra base, contenido o familia lanza `OperationIdentityReuseError`. Clase extraída a módulo server-only compartido y reexportada desde el executor item, conservando compatibilidad y comportamiento activo. No acepta digest del cliente, no escribe ni concede autorización/ACK por el recibo; el servicio futuro debe aplicar su política de acceso. Query ya cubierta por índice actor+operationId, sin nuevos índices ni callers productivos.

MongoDB aislado: 29 pruebas, 249 aserciones, cero fallos; legacy/personal, orden de propiedades equivalente, aislamiento por actor, reutilización de identidad, input inválido, historia intacta y visibilidad de sesión/rollback. Contenedor y almacenamiento propios eliminados. Suite normal 265 pass/50 opt-in skip/0 fail/5121 aserciones; lint 379 archivos, tipos y build con 34 recursos neutrales aprobados. Se corrigió únicamente el literal discriminante de una fixture tras detectar el error de tipos. Diff comprobado; commit y push a int con verificación de HEAD remoto y lectura de cuotas al cierre.

Próxima candidata 11c2b2b: aplicar efectos, contador compartido, journal y recibo en una transacción; conservar pruebas de fallo tardío/replay/CAS y carreras 11c2b3 antes de activar preferencias remotas. El helper entregado es preparatorio y no activa su sincronización.


### Resultado 11c2b2b1 — Categorías atómicas preparadas

Executor server-only valida actor/intención antes de IO y usa replay común con fingerprint v1. Dentro de snapshot/majority, lee catálogo propio, aplica CAS de todos los efectos, incrementa contador compartido e inserta journal/recibo v2 completos. Wrapper devuelve resultado sólo después de commit; etapa interna exige transacción activa y su resultado no constituye ACK. Conflictos/rechazos conservan recibo sin secuencia aplicada; unsupported nuevo no escribe. Duplicados/CAS abortan y admiten hasta tres sesiones nuevas, sin continuar una sesión abortada. Índices existentes registrados cubren las consultas, los personales se provisionan únicamente en Mongo de prueba propio. Sin callers productivos, wire/pull/ACK activos ni activación personal.

Cuatro escenarios nuevos Mongo: entrega duplicada concurrente produce un solo efecto/recibo/journal; replay exacto e identidad reutilizada; CAS/tombstones/nombres NFKC/aislamiento/unsupported; compactación de tres revisiones y fallo después del recibo que revierte efectos, contador, journal y recibo; historial mixto item/category/item conserva secuencias1/2/3 y registros legacy intactos. No equivalen a barreras de snapshots solapados de11c2b3. Total Mongo33pass/0fail/305aserciones en8archivos, recursos propios eliminados. Normal265pass/56opt-in skip/0fail/5121aserciones; lint381archivos, tipos/build34recursos/diff aprobados. Tipos de_id y refinamiento de fixtures corregidos antes del cierre.

Reserva vigente actualizada por solicitud humana:10%5h y5%7d, evaluadas por margen y coste propios. Próxima11c2b2b2: executor de vista personal con autorización de item/tag dentro de la misma transacción; después11c2b3 carreras de catálogo y autorización con barreras. Antes de activar cualquier writer personal deben existir lectores/handshake/ACK/pull compatibles.


### Resultado11c2b2b2 — Vista personal atómica preparada

item-view.set lee item/vista/tag propios dentro de la sesión, limita contexto a contenido simple activo y aplica CAS sin editar el contenido/progreso. Tag ajeno o eliminado rechaza; vista propia de un item ajeno no concede permiso. Contador/journal/recibo/retry extraídos a helper server-only reutilizado con categorías; guardias de transacción, contratos/bytes y comportamiento de categorías conservados. Wrapper responde tras commit; stage no es ACK. Replay histórico conserva resultado/fingerprint exactos sin reescribir estado o conferir acceso a contenido. Unsupported de cumpleaños/series conserva recibo sin efectos ni sequence; tipos de comando fuera del executor no escriben. Sin callers, wire/pull/ACK ni índices productivos nuevos.

Cuatro escenarios nuevos: asignar/cambiar/quitar y stale-CAS, entrega duplicada/replay y contenido intacto; aislamiento mediante item/tag ajenos y eliminados; fallo después del recibo revierte vista/contador/journal/recibo; evento simple soportado y cumpleaños/serie conservados como unsupported. Regresión real de categorías también aprobada. Mongo aislado37pass/0fail/363aserciones en9archivos, recursos propios eliminados. Normal265pass/62opt-in skip/0fail/5121aserciones, lint384archivos, tipos/build34recursos/diff aprobados.

Petición humana durante esta entrega reduce reserva semanal5→2%; 5h sigue10%. AGENTS/workflow actualizados en este commit, entradas históricas conservadas. Tras commit/push y HEAD/cuotas, próxima11c2b3: barreras para snapshots solapados, coherencia de vecinos/create/delete/nombres y autorización de vista frente a delete. Pruebas secuenciales de acceso no demuestran todavía ese aislamiento concurrente. Compatibilidad/handshake/ACK/pull siguen obligatorios antes de activar.


### Resultado11c2b3a — Snapshots solapados comprobados

Cinco carreras deterministas en MongoDB propio, mediante spies de lectura y barreras de promesas exclusivamente en tests. Movimiento pausa catálogo vigente; create/delete de vecino confirma primero; al reanudar, target no comparte escritura con el vecino pero contador común provoca retry/relectura y invalid_command durable sin efectos del movimiento. Vista pausa lectura de item/tag activo; delete confirma primero; retry observa tombstone y responde unavailable/invalid_command sin vista ni journal/sequence applied. Colisión de nombre NFKC pausa catálogo antiguo, ganador confirma; inserción perdedora aborta por unicidad y reclasifica sobre snapshot fresco. Se comprueban lectura repetida/tombstone observado, revisiones del target intactas, secuencias sin huecos, recibos durables y ausencia de journal del perdedor. Barreras/spies restaurados y operaciones drenadas incluso al fallar.

La hipótesis del contador compartido queda demostrada para los contextos propios activos ensayados, incluyendo efectos en documentos disjuntos y permiso frente a borrado; la unicidad de nombres se prueba por separado y no sustituye el contador. No se introducen locks, hooks productivos ni temporizadores para ordenar commits. No extender la evidencia a permisos compartidos o series, aún no soportados.

Mongo42pass/0fail/412aserciones en10archivos; recursos propios eliminados. Normal265pass/69opt-in skip/0fail/5121aserciones, lint385archivos, tipos/build34recursos/diff aprobados. Sin código productivo nuevo ni activación. Próxima11c3a: contrato mixto de transporte/descarga y compatibilidad, antes de readers/ACK/pull/backup/dos dispositivos y provisionamiento explícito. Commit/push/HEAD/cuotas al cierre, reserva10%5h/2%7d vigente.


### Resultado11c3a1 — Descarga mixta validada

Schema/type/verificador puros para página explícita versión2 con journal item/preference normalizado íntegro. Hasta100 registros, secuencias consecutivas y operationIDs distintos; nextAfter/checkpoint/hasMore coherentes. ExpectedUserId y query externos comprueban cada receptor, after+1, limit y through congelado. Página vacía no avanza ni oculta huecos. Salida clonada, futuro/extra/legacy página rechazan; adaptación readonly de registros legacy sigue siendo tarea del futuro reader antes de crear el envelope. No IO, wire/ACK/cursor/DB ni callers activos nuevos.

Guard2MiB UTF8 para página completa, separado de512KiB por journal. Permite futura paginación de menos registros que limit, nunca truncar contenido; cabe cualquier primer registro admitido con metadata. Cuatro pruebas/58aserciones nuevas cubren mezcla/tombstones/clones, continuación/checkpoint/vacío, dueño/query/saltos/duplicados/extra/futuro/100máximo y página Unicode que excede bytes aun siendo válidos todos sus registros individuales. Fixture de duplicados corregida para reutilizar realmente el UUID del primer registro. Suite269pass/69opt-in skip/0fail/5179aserciones, lint389archivos, tipos/build34recursos/diff aprobados; sin repetir Mongo por este contrato puro.

Próxima11c3a2: reader Mongo propio mixto con snapshot/cursor/byte-paginación sin filtrar historia, seguido de handshake/transporte y ACK/pull/backup compatibles antes de activar. Contrato puro no negocia compatibilidad, concede permisos ni prueba convergencia. Reserva10%5h/2%7d; commitpushHEAD/cuotas al cierre.


### Resultado11c3a2 — Reader mixto preparatorio

readRemoteChangesV2 valida actor/query antes de IO y lee contador/journal/autorización en una misma snapshot. Adapta registros legacy readonly a item/v2, conserva cada efecto personal y secuencias sin huecos. Consulta recipientUserId/sequence usa índice vigente; count<=100 y byte-paginación2MiB con tamaño exacto de registros/commas/envelope, sin partir entradas. Cursor siempre cerrado. Checkpoint congelado y error de cursor futuro conservados.

Item exige pertenencia actual incluso para historia; categorías exigen registro propio actual y vistas documento propio más acceso propio al item/tag referido. Tombstones preservan ownership y permiten descargar historia anterior intacta; ausencia/futuro/corrupción/store personal aún sin executor rechazan página sin filtrar ni avanzar. No callers/rutas/transporte/ACK/pull productivos nuevos, ningún índice nuevo ni provisionamiento personal fuera de test propio.

Cuatro escenarios nuevos Mongo: journal mixto producido por executors reales y checkpoint/incremental tras deletes; aislamiento/cursor/input inválido; huecos/futuro/corrupción/settings no soportado/item con owner cambiado/vista ausente, fixtures restauradas;28tareas grandes en fixtures transaccionales propias, dos páginas por UTF8 con28secuencias y checklist completo en todas. Esta última fixture prueba reader/bounds, no ACK de escritura real. Mongo46pass/0fail/475aserciones en11archivos; recursos propios eliminados. Normal269pass/75opt-in skip/0fail/5179aserciones, lint391archivos, tipos/build34recursos/diff aprobados.

Próxima11c3b1: contrato de respuesta push mixta/versionada y compatibilidad transporte2/intención1, sin activar todavía. Después servicios/handshake, metadata/ACK/pull/backup y prueba de dos dispositivos antes de activar preferencias. Reserva10%5h/2%7d vigente, commitpushHEAD/cuotas al cierre.
