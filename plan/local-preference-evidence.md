# Evidencia local para preferencias sincronizadas

Estado: contrato de transición `11c3c0`; shadow/decoder puros preparados en `11c3c1a1` y snapshot personal puro en `11c3c1a2`. Recepción mixta pura preparada en `11c3c1b1` y outcome item readonly en `11c3c1b2a`. Outcome personal/decoder común preparados en `11c3c1b2b`, con snapshots exactos y límite global5MiBUTF8. Proyección personal pura preparada en `11c3c3p`: tags/vistas por revisión propia, preservación de toda cadena personal no resuelta y reconciliación de shadows al terminarla. Backup portable 1/2 y verificador mixto entregados en `11c3c2a`, sin normalizar la historia devuelta. Snapshot/export readonly emite portable2 desde `11c3c2b`; importación conserva ambas generaciones como evidencia y sólo aplica copias item nuevas. Readers e incidentes mixtos compatibles desde `11c3c2c`: variantes conocidas decodificadas antes de routing, grafo completo para resolución item y bloqueos personales visibles sin elecciones. ACK personal standalone preparatorio probado en `11c3c3a`, sin caller productivo. Readers item de outbox/ACK/pull legado adaptan ambas generaciones en memoria desde `11c3c2d`, con cuenta/familia estrictas y replay readonly. Pull/coordinador mixtos siguen pendientes. El servicio y los executors mixtos preparados están probados con MongoDB; el producto mantiene transporte 1 y sincroniza únicamente tareas/eventos propios simples.

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

Outcome nuevo: `version: 2`, `kind`, `key: operation-outcome:<UUID>`, intención 1 exacta y resultado v2 íntegro. Item conserva snapshots local/base de contenido. Preference conserva snapshots local/base por clave afectada, cada uno con `entityKey` y `record: LocalPreferenceRecord | null`; null significa ausencia observada, no borrado ni autorización. El registro personal local admite revisión 0 de un borrador; no reutilizar el schema remoto que exige revisión positiva para esa evidencia optimista. Incluir objetivo principal y unión de todos los efectos del resultado; no guardar sólo el tag movido cuando hubo compactación. Las colecciones de snapshots son únicas por clave, propias de la partición y compatibles con su store.

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
| `11c3c1a1` | Shadow 2/decoder puro entregado y probado, sin consumidores activos. [Schema](../src/schemas/remote-shadow-v2.ts), [decoder](../src/lib/sync/remote-shadow-v2.ts). |
| `11c3c1a2` | Snapshot personal puro entregado: [schema](../src/schemas/personal-snapshot.ts) y [verificador](../src/lib/sync/personal-snapshot.ts), revisión0 local/ausencia/conjunto exacto/propiedad/UTF8, sin consumidores activos. |
| `11c3c1b1` | Recepción mixta pura entregada: [schema](../src/schemas/local-sync-result-v2.ts) y [verificador](../src/lib/sync/local-sync-result-v2.ts), intención/sender/cuenta/familia/objetivo, sin lease o ACK. |
| `11c3c1b2a` | Variante item2/legacy readonly preparada: [schema](../src/schemas/local-item-outcome-v2.ts) y [decoder](../src/lib/sync/local-item-outcome-v2.ts), ownership/identidad/replay histórico sin inventar ancestro. Sin consumidores activos. |
| `11c3c1b2b` | Entregado: [outcome personal](../src/schemas/local-preference-outcome-v2.ts) y [decoder común](../src/lib/sync/local-operation-outcome-v2.ts), snapshots exactos objetivo+todos efectos, local0/base positiva,5MiB global. Replay viejo no es ancestro; errores sin documento no conceden permisos. |
| `11c3c2a` | Entregado: [schemas portable1/2](../src/schemas/local-backup.ts), [verificador](../src/lib/backup/local-backup.ts), decoders de cuenta/familia/snapshots y matriz de importación cruzada sólo como copias nuevas. JSON archivado opaco y byteexacto; retorno sin transformar. |
| `11c3c2b` | Entregado: snapshot readonly de once stores exporta2 sin reescribir datos, imports1/2 y rollback/replay/recarga con conflictos personales preexistentes intactos, guardias cuenta/época y límites. |
| `11c3c2c` | Entregado: overview readonly propio mixto, item2 adaptado en memoria para resolución existente, toda evidencia decodificada antes de seleccionar. UI compacta personal sin choices; pruebas reales de grafo, corrupción, recarga/época y regresión item. |
| `11c3c3p` | Adelanto puro entregado: [proyección](../src/lib/sync/preference-projection.ts), cuentas/stores/cadena completa/contradicción por revisión, ausencia y tombstones. No writers/ACK ni avance de dependencias. |
| `11c3c3a` | Entregado: [writer personal preparatorio](../src/lib/local-db/preference-sync-results.ts), [plan puro](../src/lib/sync/preference-result-plan.ts); commit/rollback/replay/lease/rebase/partición/bounds probados, sin caller productivo. |
| `11c3c2d` | Entregado: [adapter item readonly](../src/lib/sync/item-evidence.ts) para getter/outcome replay/ACK/pull vigentes; persistencia nueva sólo en mutación real, sin activar transporte. Browser getter/replay byteexact, ACK/pull/rollback/cursor/recarga aprobados. |
| `11c3c4a1` | Entregado: [recepción local mixta](../src/lib/sync/local-changes-page-v2.ts) y [schema](../src/schemas/local-changes-page-v2.ts) conservan consulta completa y verifican cuenta/checkpoint/rango/stores. Sólo propios simples y tags/vistas; reject íntegro antes de IO, sin cursor ni ACK. |
| `11c3c4a2p` | Entregado: [decisión pura de cursor](../src/lib/sync/local-mixed-pull-cursor.ts), consulta/checkpoint coincidentes, página completamente superada ignorada sólo tras validar íntegra y rechazo de solapamiento/carrera. Propuesta clonada, sin persistencia. |
| `11c3c4a2q` | Entregado: [proyección personal de página](../src/lib/sync/local-personal-changes-page.ts) compone todas las entradas en orden, mantiene pendientes y detecta contradicciones intermedias/tardías sin IO. Receipt íntegro validado antes de seleccionar efectos personales; no persiste cursor ni contenido item. |
| `11c3c4a2` | Siguiente: descarga mixta atómica y cursor, cuenta/época/cierre, unknown-store sin avance y tombstones. Pruebas IndexedDB de rollback tardío, página antigua y dos particiones antes de caller/activación. |
| `11c4a–b` | Coordinador/capacidades y conflictos personales, dos particiones con Mongo, clientes mixtos y piloto autorizado; sólo después índices personales explícitos y activación wire 2. |

Partir cada corte antes de implementarlo si su evidencia no cabe en el presupuesto. Mantener commit/push y cuotas por iteración, reserva vigente 10% en 5h y 1% en 7d; esta propuesta no autoriza producción, nuevas dependencias ni pérdida de datos.


Guardia previa a activación: la cadena personal incluye colocaciones aún sin executor remoto. Una colocación pending/sending/conflict/rejected puede bloquear dependencias posteriores y conservar toda proyección personal; no resolverla con ACK fabricado ni supersesión automática. El corte de capacidades/coordinador debe comprobar cola histórica real y definir progreso/recuperación con executor compatible o decisiones explícitas, antes de anunciar sincronización personal completa.
