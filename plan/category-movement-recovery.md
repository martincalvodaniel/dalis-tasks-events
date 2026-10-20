# Recuperación de movimientos entre categorías

Estado: contrato acotado preparado en 19k6a. No hay recuperación nueva conectada ni pruebas remotas aprobadas de este bloque. La implementación sigue a la aceptación remota y UI de primaria recurrente (19k5e/f). Este documento se adelanta como trabajo independiente durante el bloqueo de Docker.

## Semántica que se conserva

`task.move` contiene padre, referencia opcional de aparición, ámbito/día civil, categoría de destino y vecinos. El comando no contiene una revisión de vista: la revisión base de la operación protege la posición primaria, no el contenido del padre ni una vista capturada. Véanse [comando](../src/schemas/sync.ts:84) y [CAS primario](../src/lib/preferences/remote-recurring-task-placement-plan.ts:55).

La categoría pertenece a la vista personal del padre. Un movimiento entre grupos recategoriza el plan completo, incluidas sus otras fechas; el planner ordena los hermanos visibles y puede producir posiciones de vecinos y una vista con revisiones independientes. El executor relee el contexto y aplica CAS a cada registro en la misma transacción que journal/recibo. Véanse [selección y efectos](../src/lib/preferences/remote-recurring-task-placement-plan.ts:92), [vista del padre](../src/lib/preferences/remote-recurring-task-placement-plan.ts:122), [escritura transaccional](../src/lib/db/remote-task-placement-commands.ts:178) y [oráculo de hermanos multidía](../src/lib/preferences/remote-recurring-task-placement-plan.test.ts:263).

El reenvío conservará esa intención absoluta de destino. No se presentará como protección de una revisión de vista incluida en el comando, porque el protocolo actual no la tiene. La comparación es la versión conocida, no un ancestro ni una garantía de estado actual del servidor.

## Primera captura soportada

- Una cadena aislada de la misma posición primaria, ámbito, día declarado y categoría de destino: raíz con conflicto confirmado, sin lease, seguida sólo de movimientos pendientes no intentados y dependientes de la cadena. Padre común propio vivo; aparición original exacta cuando corresponda.
- Catálogos completos y acotados de padres, apariciones, categorías, vistas y posiciones, capturados en una única TX. Contenido, reglas, estado y checklist del padre/apariciones coinciden entre local y observado. Otras vistas no cambian; la vista del padre puede diferir por la recategorización revisada.
- Categorías conocidas y activas, o ausencia explícita de categoría. Capturar tanto la pertenencia efectiva del padre como la categoría histórica de su posición: pueden diferir y una posición ignorada por grupo no elimina el plan.
- Posiciones primarias y afectadas conocidas en ambos catálogos. Identidades y creación se conservan; cambios de posición se limitan a los miembros revisados de los grupos implicados. Las posiciones de otras fechas se conservan exactamente, aunque la pertenencia visual de todo el padre cambie al elegir una categoría.
- Reread completo de cola, outcomes, sombras y clausura de prerrequisitos. Un estado `acknowledged` o un DTO de ACK no bastan: debe existir operación/outcome aplicado coincidente. Otras intenciones o dependientes externos siguen protegidos.

La vista por sí sola no basta para adaptar la recuperación vigente: ésta exige igualdad de categoría en el grupo revisado. No quitar esa guardia para publicar este bloque. Véase [límite actual](../src/lib/sync/placement-resolution.ts:198).

## Decisiones y persistencia previstas

**Adoptar el remoto conocido:** restaurar conjuntamente la vista del padre y las posiciones revisadas conocidas; cero operaciones nuevas. La restauración de categoría afecta a todas las fechas del plan. No confirma los movimientos antiguos ni elimina su historia.

**Reaplicar el último movimiento:** conservar su comando exacto, generar un UUID nuevo y usar CAS de la posición primaria observada. El planner productivo debe justificar todos los efectos de posiciones y vista. El optimismo conserva las revisiones observadas; el único avance confirmado procede del resultado remoto. Si vecinos, destino, límites o revisiones no permiten justificar el reenvío, no ofrecerlo.

Un registro portable específico conservará catálogos, originales, outcome raíz, prerrequisitos acreditados, elección y efectos exactos. La TX local guardará vista, posiciones, supersesión explícita, 0/1 reemplazo, counter/tail y recibo de decisión de forma atómica. Replay previo no reescribe cambios posteriores ni fabrica ACK. Cuenta/época, IDs globales y capacidad posterior se validan antes de escribir. El núcleo actual ya aplica esas guardias para posiciones, pero todavía no guarda la vista elegida de este nuevo caso: [writer actual](../src/lib/local-db/placement-resolution.ts:165).

## Casos protegidos y aceptación posterior

Posiciones locales nuevas sin observación remota, remotos ausentes, padre/categoría eliminados, series modificadas, varios destinos en la misma cadena o cambios externos requieren contratos distintos. No inferir ausencia ni borrar posiciones para hacer caber la recuperación; conservar intenciones intentadas, tombstones y evidencia. Este primer corte no pretende resolver esos casos.

Antes de activar: oráculos puros de grupos simples/recurrentes y día/atrasadas; evidencia portable válida/truncada/corrupta; IndexedDB real con rollback tardío también de vista y posiciones, replay, capacidad y guardias de cuenta; productores reales en dos orígenes con Next/Mongo, CAS independientes, respuesta perdida/recarga/ACK único y proyecciones exactas; ambas decisiones UI con cancelar/reabrir/confirmar e IDs de UI. Mostrar categorías/colores conocidos y advertir expresamente del alcance sobre todo el plan y sus fechas.

No se añade ningún comando, índice, permiso, migrador, dependencia o actuación en datos por esta planificación. Cualquier cambio necesario al implementarlo debe justificarse y validarse en su propio corte.
