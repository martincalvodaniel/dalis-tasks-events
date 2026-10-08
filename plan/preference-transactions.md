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

El patrón vigente está en [remote-item-commands.ts:147](../src/lib/db/remote-item-commands.ts:147): contenido ya escribe ese contador en la misma transacción. Propuesta: todos los cambios personales applied también lo escriben. Dos transacciones snapshot con efectos disjuntos deben competir por ese documento común, provocar retry con snapshot fresco y conservar coherencia del catálogo y autorización. Esto evita introducir otro lock/contador; **es una hipótesis de implementación pendiente de prueba Mongo real**, no garantía derivada del CAS individual.

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
