# Reordenación personal — siguiente bloque `07b`

Diseño previo a implementar. `07a` ya agrupa y deriva atrasadas; aún no hay controles ni comandos de reordenación. Este corte documental concreta las siguientes entregas sin aceptar operaciones que el motor todavía no sabe ejecutar.

Estado posterior: `07b1a–07b3b` entregados y verificados; los párrafos de base describen el snapshot previo al bloque. Botones, selector de categoría y arrastre usan los mismos ejecutores atómicos. Queda el piloto táctil de dispositivo real en `15` y sincronización remota en `11–13`.

## Base comprobada y objetivo

- Categorías: posición personal y registros separados del contenido. La lectura existente usa `byPosition`; hoy desempata por nombre e ID. El bloque de orden unificará lectores y mutaciones para desempatar por ID, de modo que renombrar no mueva una categoría con posición igual.
- Tareas: `taskPlacements` ya existe, con clave `[occurrenceId, scope, date]` e índice `byDateAndScope` sobre `[date, scope]`. No crear otro store por iniciativa propia. Véase [store-config.ts](../src/lib/local-db/store-config.ts#L63).
- El registro tiene `userId`, alcance, fecha, categoría y posición; el calendario real se conserva en `Task.scheduledDate`. Véase [preferences.ts](../src/schemas/preferences.ts#L35).
- La outbox de preferencias actualmente acepta únicamente `tag.save`, `tag.delete` e `item-view.set`, con replay, secuencia y dependencias en una transacción. Los nuevos comandos deben integrarse allí con validación explícita; no guardar una posición directamente desde la UI. Véase [preference-outbox.ts](../src/lib/local-db/preference-outbox.ts#L20).

El usuario puede mover grupos y tareas mediante controles accesibles. El movimiento comunica IDs de vecinos, conserva contenido/estado y no reemplaza arrays completos. Arrastre y botones comparten la misma intención. El transporte remoto permanece en `11–13`.

## Intenciones y alcances propuestos

1. `tag.move`: categoría y vecinos `beforeId`/`afterId`. Solo cambia orden personal, sin reenviar nombre o color obsoletos.
2. `task.move`: elemento, ocurrencia, alcance, categoría de destino y vecinos. En `07b` únicamente tareas simples: ocurrencia nula significa usar el ID de tarea como clave de colocación. Apariciones del día se habilitan en `09b4a`; las atrasadas siguen rechazadas hasta `09b4b`.
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
| `07b2a / 07b2b` | Botones de categorías (`07b2a`); lectores y controles de grupos/tareas (`07b2b`) en `features/tasks/**` y `features/tags/**`; fixtures/plan. | Botones Arriba/Abajo y elección de categoría con teclado/móvil; orden real del día y atrasadas, recarga sin servidor, un solo commit por intención, errores españoles y foco conservado. Actualizar ambas barras si se añade una pantalla. |
| `07b3a / 07b3b` | Handle compartido y categorías (`07b3a`); tareas/grupos (`07b3b`), sin sustituir botones. | Cancelar arrastre no escribe; soltar invoca el mismo comando una vez; funciona con scroll móvil y alternativa de teclado. Sin dependencias nuevas. |

Cada corte requiere su commit y control de ambas ventanas. `08` comienza después de completar todos los cortes de código. Presupuesto y disponibilidad de pruebas pueden dividirlos más antes de editar; no separar la aceptación de un comando de su ejecución atómica.

## Corte al reanudar el 7 de octubre

Se divide `07b1` por dominio: categorías primero, tareas después. La primera entrega añade `tag.move` y ranking reutilizable, conserva registros/colas anteriores y cambia desempates de lectores a posición/ID. La segunda evaluará colocaciones previas antes de habilitar escrituras de tareas. `07b2` depende de ambas y conecta los controles; no hay un nuevo botón en la primera entrega de infraestructura.

## Contrato de tareas al abrir `07b1b`

El schema de transporte anterior ya contenía `task.move` con fecha y ocurrencia. Se amplía para permitir ocurrencia nula (tarea simple), sin invalidar lectura de colas antiguas. Para atrasadas, `date` es el día de evaluación verificado frente a hoy en la zona local; la clave persistida se deriva y nunca toma esa fecha como ancla. Claves nuevas de colocación personales; claves item antiguas solo legibles para comandos de ocurrencia anteriores. Registros activos de atrasadas con ancla antigua se preservan y bloquean escrituras de ese alcance hasta una migración separada; no se transforma ni borra legado automáticamente.

Para listas con colocaciones parciales, primero rangos compatibles por posición/ID y luego tareas sin rango por fecha/creación/ID. La primera escritura materializa filas implícitas del destino en el mismo commit atómico y una sola intención. Cambiar categoría conserva colocaciones de otros días/alcances; una colocación con tag distinto del efectivo no dicta el orden.


## Día con apariciones — 09b4a

El snapshot de movimiento incluye excepciones en la misma transacción. Proyecta cada serie solo para el día elegido y pagina todas las excepciones cuya fecha efectiva pertenece a ese día; no expande historia ni trunca el grupo a500. Un slot cancelado/borrado o movido fuera del día no puede ser target ni vecino. Vecinos aceptan UUID simple o UUID:fecha civil de tarea, con comprobación de existencia y adyacencia sobre el grupo actual.

Colocaciones mantienen clave personal de aparición/scope/date y revisión propia, separada del contenido. El movimiento virtual no crea excepción de progreso. Categoría pertenece a ItemView del elemento/serie: cambiarla desde una aparición cambia la categoría de esa serie, incluyendo otras apariciones suyas en ese día. La UI futura deberá indicar esa semántica. Compactación de ranks se comparte con tareas simples, preserva revisiones y otras fechas/scopes; outbox depende de cola personal, colocación previa y comandos de padre.

Atrasadas repetidas requieren un corte distinto: el historial puede contener millones de slots virtuales. No reutilizar expansión completa del día para todo el backlog ni ordenar solo una página fingiendo que es todo el grupo. `09b4b` debe definir peers/cursor y ranking compatible antes de habilitar controles o el formulario.


### Referencias acotadas — 09b4b1

El índice `task-reference` permite validar target/vecinos sin generar el rango entre ancla y hoy. UUID simple resuelve solo tarea simple; UUID:fecha original resuelve excepción propia activa o genera exactamente un slot validando la cadencia/count. Reprogramadas conservan su fecha efectiva; historia materializada no desaparece por cierre futuro de regla. Padre recurrente, canceladas/borradas, orphans y otras cuentas no son referencias ejecutables. El planner del día lo usa ya; backlog sigue rechazado.

Próximo 09b4b2 debe validar adyacencia entre vecinos sobre la vista real y mantener el orden de slots aún no cargados. Los ranks actuales colocan registros explícitos antes de los implícitos: materializar solo los vecinos de una página movería ese subconjunto delante del historial restante. Resolver IDs no basta para cerrar ese problema; no habilitar comandos de backlog sobre ese atajo. Definir y probar un cálculo acotado (incluido agotamiento de posiciones/compactación) o partir una preparación paginada con progreso visible, antes de integrar UI.


La investigación y próximos cortes de backlog se concretan en [backlog-ordering.md](backlog-ordering.md), entregado documentalmente en09b4b0 después del lookup09b4b1. La clave lexicográfica es una propuesta a validar; no un nuevo formato ya implementado o una migración aplicada.
