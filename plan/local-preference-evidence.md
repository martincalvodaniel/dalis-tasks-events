# Evidencia local para preferencias sincronizadas

Estado: contrato de transición `11c3c0`, todavía sin schemas, escritores o lectores locales nuevos. El servicio y los executors mixtos preparados están probados con MongoDB; el producto mantiene transporte 1 y sincroniza únicamente tareas/eventos propios simples.

## Punto de partida comprobado

- [local-sync.ts](../src/schemas/local-sync.ts) limita `remoteShadow` a `item:*` y el outcome a un resultado item con `local/base` de contenido. La outbox ya conserva categorías/vistas/placements y sus dependencias, sin cambiar la intención 1.
- [sync-store.ts](../src/lib/local-db/sync-store.ts) aplica ACK item en una transacción con intención, lease, contenido, shadow y outcome. Sólo `applied` da ACK; `unsupported` vuelve a pending. Un ACK repetido exige la misma intención y resultado durable.
- [pull-changes.ts](../src/lib/local-db/pull-changes.ts) aplica página y cursor juntos; [item-projection.ts](../src/lib/sync/item-projection.ts) conserva contenido optimista con pendientes, evita retroceder revisiones y rechaza dos contenidos distintos con la misma revisión.
- [local-backup.ts](../src/schemas/local-backup.ts) sólo acepta backup 1 e historia item. Su [verificador](../src/lib/backup/local-backup.ts) exige outcomes/dependencias/decisiones conservados. Añadir únicamente una variante al schema no basta: también hay acceso directo a `result.status`, `result.item` y `local/base`.
- [sync-incidents.ts](../src/lib/local-db/sync-incidents.ts) entrega todos los shadows y outcomes conflict/rejected al proyector item actual. La aparición de evidencia personal necesita routing validado antes de persistirla, incluso si todavía no se ofrecen elecciones personales.

## Versiones independientes

| Identidad | Transición prevista |
| --- | --- |
| Intención durable y fingerprint | Mantener 1, UUID, payload y bases exactos. |
| Transporte | 2 sólo al completar cliente, servidor y handshake; activo 1 mientras tanto. |
| Evidencia local nueva | 2 explícita, discriminada item/preference; lectura legacy validada y adaptación sólo en memoria. |
| Backup portable | 2 para exportar evidencia nueva; aceptar 1 y 2 mediante schemas estrictos y lectores completos. |
| IndexedDB | Mantener versión 2 si se conservan stores/keyPaths/índices. [migrations.ts](../src/lib/local-db/migrations.ts) no debe borrar ni recorrer/recrear datos para cambiar el formato de un valor. |

Antes de abrir cada corte de código, validar estas formas contra las fuentes y fixtures; cualquier ajuste de campos se registra en el mismo corte. No confundir `backup.protocolVersion` con la versión de transporte.

## Formatos propuestos

Shadow nuevo: envoltura explícita `version: 2`, `kind`, `entityKey` y `record`. Item contiene `CalendarItem`; preference contiene un `PreferenceEffect` individual, con store y documento. Mantener `entityKey` como keyPath. Tags/vistas usan las claves canónicas ya existentes; placements conservan scope/fecha/sentinel y clave histórica hasta su corte específico. El store, la clave y la identidad del documento deben coincidir. Aunque el DTO remoto reconoce settings/placements, el cliente inicial sólo aplica tags/vistas; un store todavía no soportado rechaza el conjunto sin avanzar cursor.

Outcome nuevo: `version: 2`, `kind`, `key: operation-outcome:<UUID>`, intención 1 exacta y resultado v2 íntegro. Item conserva snapshots local/base de contenido. Preference conserva snapshots local/base por clave afectada, cada uno con `entityKey` y `record: PreferenceEffect | null`; null significa ausencia observada, no borrado ni autorización. Incluir objetivo principal y unión de todos los efectos del resultado; no guardar sólo el tag movido cuando hubo compactación. Las colecciones de snapshots son únicas por clave, propias de la partición y compatibles con su store.

`base` documenta el shadow observado antes de aplicar el outcome local: **no demuestra que sea ancestro de la intención enviada**. Un replay remoto tardío puede ser anterior al shadow ya descargado. Conservar el resultado durable original en el outcome; comparar el shadow por revisión independiente de cada documento, sin sustituir el resultado por una versión posterior ni retroceder evidencia.

Decoders aceptan únicamente legacy estricto o evidencia 2 conocida, devuelven clones y rechazan futuro, extra, ambigüedad, propietario o identidad incoherentes. No reescribir historia ni convertir un resultado de otra familia en ACK. Las relaciones de intención, familia, objetivo, cuenta y estado requieren verificador externo además del schema individual.

## Aplicación y recuperación

ACK personal: una sola transacción IndexedDB incluye outbox, shadows, syncMetadata y todos los stores de los efectos soportados. Validar intención enviada exacta, lease del sender, cuenta y guardias de época existentes; no hacer IO de red dentro de ella. Efectos/shadows/outcome/estado de intención se confirman juntos; fallo tardío revierte todo. Replay local de intención acknowledged comprueba resultado exacto y no vuelve a aplicar efectos.

La revisión CAS de una compactación pertenece a cada documento: no inferir que todos los efectos siguen `operation.baseRevision + 1`. Para dependientes nunca enviados, sólo actualizar una base cuando exista efecto confirmado de su propia identidad y dependencia directa probada; no cambiar payload/UUID/base de intentos ya enviados. No desbloquear dependencias de unsupported/conflict/rejected/superseded como si fueran ACK remoto.

Proyección inicial conservadora: si quedan intenciones personales no resueltas, conservar el estado personal local acumulado y actualizar los shadows por revisión. Revisar la cadena personal completa, porque su operación principal puede haber afectado otras claves. Al desaparecer los pendientes, reconciliar desde shadows válidos en transacción, evitando que datos optimistas de una compactación anterior queden permanentes. Probar ausencia, tombstones, cambios de nombres y vista/tag; no usar el cursor del journal como revisión del documento.

Pull mixto: validar página completa, cuenta, checkpoint congelado, continuidad y cada store antes de escribir. Aplicar todos los efectos de una entrada o ninguno; guardar todos los shadows y cursor en la misma transacción. Preservar pendientes y dependientes. Página desconocida/corrupta/store sin soporte no se filtra ni incrementa cursor.

Incidentes: decodificar toda evidencia primero. El lector item puede seleccionar variantes item conocidas después de validar la partición; no saltar formatos desconocidos. Conflictos personales deben aparecer como bloqueos conservados en el resumen, con intención y comparación disponibles. No ofrecer elecciones hasta que contrato, executor y UI personales estén cerrados. Una resolución local o una importación nunca fabrica ACK remoto ni descarta dependientes/tombstones.

Backup 2: ownership recursivo, claves únicas, dependencia/tail/sequence exactos y evidencia correspondiente a cada estado conservados en ambos formatos. Exportación readonly completa y límite UTF8 vigente; no omitir metadata para que un backup pase. Importación mantiene su política de copias nuevas y no restaura recibos como permisos o comandos ya aceptados. Si el formato es futuro, rechazar conservando el archivo y la DB. El cliente antiguo debe pausarse mediante handshake/actualización antes de cualquier writer mixto.

## Cortes siguientes

| Corte | Rutas y evidencia requerida |
| --- | --- |
| `11c3c1a` | Schemas/types/decoders puros de shadow 2 y snapshot personal, verificador de claves/cuenta; legacy readonly, clones, futuro/extra/tombstones y revisión por documento. Sin writer ni callers activos. |
| `11c3c1b` | Outcome/input ACK mixtos puros y correspondencia intención/lease/familia/efectos/snapshots. Replay viejo no es ancestro; errores sin documento no conceden permisos. |
| `11c3c2` | Backup 2, lector/exportador/import preview y verificadores de ownership/evidencia para ambas historias. Fixtures de dependencia/tail/decisiones, UTF8 y snapshot readonly real; todos los lectores listos antes de writers. |
| `11c3c3` | ACK y proyección personal atómicos con IndexedDB propio: compactación multiefecto, replay/rollback tardío, pendientes/dependientes y reconciliación al terminar cadena. |
| `11c3c4` | Pull mixto/cursor y routing de incidentes compatibles, cuenta/época/cierre, unknown-store sin avance y tombstones. No elecciones personales prematuras. |
| `11c4a–b` | Coordinador/capacidades y conflictos personales, dos particiones con Mongo, clientes mixtos y piloto autorizado; sólo después índices personales explícitos y activación wire 2. |

Partir cada corte antes de implementarlo si su evidencia no cabe en el presupuesto. Mantener commit/push y cuotas por iteración, reserva vigente 10% en 5h y 1% en 7d; esta propuesta no autoriza producción, nuevas dependencias ni pérdida de datos.
