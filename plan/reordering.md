# Reordenación personal — siguiente bloque `07b`

Diseño previo a implementar. `07a` ya agrupa y deriva atrasadas; aún no hay controles ni comandos de reordenación. Este corte documental concreta las siguientes entregas sin aceptar operaciones que el motor todavía no sabe ejecutar.

## Base comprobada y objetivo

- Categorías: posición personal y registros separados del contenido. La lectura existente usa `byPosition`; hoy desempata por nombre e ID. El bloque de orden unificará lectores y mutaciones para desempatar por ID, de modo que renombrar no mueva una categoría con posición igual.
- Tareas: `taskPlacements` ya existe, con clave `[occurrenceId, scope, date]` e índice `byDateAndScope` sobre `[date, scope]`. No crear otro store por iniciativa propia. Véase [store-config.ts](../src/lib/local-db/store-config.ts#L63).
- El registro tiene `userId`, alcance, fecha, categoría y posición; el calendario real se conserva en `Task.scheduledDate`. Véase [preferences.ts](../src/schemas/preferences.ts#L35).
- La outbox de preferencias actualmente acepta únicamente `tag.save`, `tag.delete` e `item-view.set`, con replay, secuencia y dependencias en una transacción. Los nuevos comandos deben integrarse allí con validación explícita; no guardar una posición directamente desde la UI. Véase [preference-outbox.ts](../src/lib/local-db/preference-outbox.ts#L20).

El usuario puede mover grupos y tareas mediante controles accesibles. El movimiento comunica IDs de vecinos, conserva contenido/estado y no reemplaza arrays completos. Arrastre y botones comparten la misma intención. El transporte remoto permanece en `11–13`.

## Intenciones y alcances propuestos

1. `tag.move`: categoría y vecinos `beforeId`/`afterId`. Solo cambia orden personal, sin reenviar nombre o color obsoletos.
2. `task.move`: elemento, ocurrencia, alcance, categoría de destino y vecinos. En `07b` únicamente tareas simples: ocurrencia nula significa usar el ID de tarea como clave de colocación. Ocurrencias reales se habilitan en `09b`; rechazarlas hasta entonces.
3. `beforeId` es el sucesor deseado y `afterId` el predecesor. Excluir la fila movida antes de comprobarlos; ambos deben ser vecinos activos y compatibles. Null representa el límite inicial/final; ambos null solo son válidos si el destino queda vacío. El mismo ID no puede aparecer como fila y vecino ni como ambos vecinos.
4. `day`: fecha explícita, independiente por día/categoría. Verificar que la tarea pertenece a ese día. Mover a otra categoría actualiza `itemViews` y la colocación en una sola transacción.
5. `overdue`: orden global, no una lista nueva cada medianoche. Usar una clave de alcance constante `0001-01-01` en la colocación local, compatible con el schema/índice existentes; el comando no permite elegir esta fecha. Esa clave nunca cambia ni se muestra como fecha de tarea. La elegibilidad se deriva del día real de cuenta, fecha original y estado.

La clave constante evita perder el orden cuando cambia hoy, sin cambiar el modelo de almacenamiento existente. Antes de escribir, evaluar registros de colocación previos no canónicos: no asumir que el store está vacío, descartarlos ni crear una migración sin fixtures de compatibilidad. Cualquier transformación que resulte necesaria se separará y conservará los datos anteriores.

Una colocación cuyo `tagId` no coincide con la categoría personal efectiva no impone orden en otro grupo. Una categoría borrada se resuelve a Sin categoría; no borrar tareas/colocaciones/cola para reparar referencias. Una completada conserva su colocación aunque deje de aparecer en atrasadas; el calendario conserva su historial.

## Cierre transaccional y ranking

Leer y validar dentro de la transacción: pertenencia a partición, entidad activa, destino, vecinos, alcance y orden actual. Si los vecinos dejaron de ser compatibles, rechazar la intención y pedir actualizar/reintentar; no mostrar un movimiento confirmado que no existe.

Calcular la nueva posición entre vecinos. Si no queda un número representable válido dentro de los límites de `positionSchema`, compactar únicamente la lista afectada en esa misma transacción, con resultado determinista y desempate por ID. Dato, posible cambio de categoría, ranking, secuencia y una única intención se confirman juntos. Un fallo de outbox revierte todo; replay del mismo UUID no vuelve a mover ni compactar.

Añadir clave de entidad personal para colocaciones y validar su correspondencia con comando, alcance y ocurrencia. Mantener compatibilidad con operaciones ya guardadas. Evaluar dependencias de creación del elemento, categoría, colocación anterior y cola personal; no saltar conflictos ni depender de un registro inexistente. No usar la revisión compartida del contenido como revisión de una preferencia personal.

Reutilizar `byPosition` y `byDateAndScope`. Evaluar índices locales si aparece otra consulta. MongoDB aún no recibe movimientos; sus índices se registrarán en `ensure-indexes.ts` con las consultas reales de `11a`.

## Entregas y aceptación

| Corte | Alcance y rutas | Evidencia de cierre |
| --- | --- | --- |
| `07b0` | Este diseño y reparto en `plan/**`; sin cambios de código. | Referencias/consistencia/diff y commit documental. |
| `07b1a / 07b1b` | Ranking y categorías (`07b1a`); colocaciones y tareas (`07b1b`). `schemas/**`, `types/**`, `lib/ordering/**`, `lib/local-db/**`, lectores, pruebas/plan. Cada comando se añade junto a su ejecutor. | Mover inicio/medio/final, mismo UUID, vecinos obsoletos, cuentas aisladas, destino borrado, posición agotada, rollback tras fallo de outbox y lectura tras recarga en IndexedDB real. Compatibilidad de registros previos. |
| `07b2` | Lecturas/selectores y controles de grupos/tareas en `features/tasks/**` y `features/tags/**`; fixtures/plan. | Botones Arriba/Abajo y elección de categoría con teclado/móvil; orden real del día y atrasadas, recarga sin servidor, un solo commit por intención, errores españoles y foco conservado. Actualizar ambas barras si se añade una pantalla. |
| `07b3` | Arrastre táctil/ratón en las filas existentes y sus pruebas; sin sustituir botones. | Cancelar arrastre no escribe; soltar invoca el mismo comando una vez; funciona con scroll móvil y alternativa de teclado. Sin dependencias nuevas. |

Cada corte requiere su commit y control de ambas ventanas. `08` comienza después de completar todos los cortes de código. Presupuesto y disponibilidad de pruebas pueden dividirlos más antes de editar; no separar la aceptación de un comando de su ejecución atómica.

## Corte al reanudar el 7 de octubre

Se divide `07b1` por dominio: categorías primero, tareas después. La primera entrega añade `tag.move` y ranking reutilizable, conserva registros/colas anteriores y cambia desempates de lectores a posición/ID. La segunda evaluará colocaciones previas antes de habilitar escrituras de tareas. `07b2` depende de ambas y conecta los controles; no hay un nuevo botón en la primera entrega de infraestructura.

## Contrato de tareas al abrir `07b1b`

El schema de transporte anterior ya contenía `task.move` con fecha y ocurrencia. Se amplía para permitir ocurrencia nula (tarea simple), sin invalidar lectura de colas antiguas. Para atrasadas, `date` es el día de evaluación verificado frente a hoy en la zona local; la clave persistida se deriva y nunca toma esa fecha como ancla. Claves nuevas de colocación personales; claves item antiguas solo legibles para comandos de ocurrencia anteriores. Registros activos de atrasadas con ancla antigua se preservan y bloquean escrituras de ese alcance hasta una migración separada; no se transforma ni borra legado automáticamente.

Para listas con colocaciones parciales, primero rangos compatibles por posición/ID y luego tareas sin rango por fecha/creación/ID. La primera escritura materializa filas implícitas del destino en el mismo commit atómico y una sola intención. Cambiar categoría conserva colocaciones de otros días/alcances; una colocación con tag distinto del efectivo no dicta el orden.
