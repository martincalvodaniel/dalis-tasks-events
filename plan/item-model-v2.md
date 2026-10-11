# Contrato común de planes — 16a2p

## Estado

Contrato implementado y **activado conjuntamente en16a4c3d**, negociación4 exclusiva con retirada3 antes del executor. Cuatro variantes/editor/lista/calendario y sincronización simple/asignación/orden/progreso/checklist probados mediante19escenarios Next reales y dos particiones/Mongo propios. Wipe remoto Preview cerrado, preparación local por confirmación por cuenta/dispositivo; producción excluida. Apariciones/repetición tienen persistencia y UI locales, pero aún no executor remoto. Los registros inferiores describen cortes históricos, no trabajo pendiente ya cerrado. Cumpleaños conserva entrega propia; autenticación, permisos y stack intactos.

## Un único contenido

Nueva entidad `kind: "plan"` con `variant: "task" | "event" | "appointment" | "note"`. `variant` sólo decide icono/nombre visual, nunca campos disponibles, permisos, descarga, completado o repetición. Todos los planes tienen `title`, `description`, `schedule`, `status`, `checklist`, `recurrence`, `completedAt` y metadata/owner existentes. Identidad estable independiente de variante; cambiarla no crea otro item ni pierde pasos/progreso/categoría.

- `schedule` reutiliza el contrato temporal existente: all_day con `startDate/endDateExclusive`, o timed con `localStart/localEnd/timeZone`; fin temporal opcional. Editor muestra fin de día completo incluido y convierte a exclusivo sólo en persistencia. Fecha y hora son controles separados, horas invisibles cuando todo el día está activo. Zona horaria, DST, fin posterior a inicio y rango civil se validan en schemas compartidos.
- `status` es not_started/in_progress/completed en las cuatro; el icono conmuta completado/reabierto y progreso intermedio queda accesible sin saturar la fila. `completedAt` sigue la misma semántica actual. Checklist por identidad de paso, visible e interactivo en las cuatro.
- `recurrence` comparte reglas y excepciones en las cuatro. Mostrar sólo reglas con persistencia real implementada, nunca un selector que se pierda al guardar. La ampliación remota de series/apariciones es un corte explícito: añadir variantes no significa anunciar sincronización de repeticiones antes de implementarla.
- Categoría/orden permanecen preferencias por usuario, mediante item-view/placements; asignar categoría al crear o editar debe estar en la misma transacción local y dejar sus intenciones dependientes correctas. El color es visible en cabecera/fila y selección.
- Por equivalencia funcional, las cuatro variantes comparten la política civil de pendientes/atrasadas: día final del intervalo si existe, o día de inicio si no; un día completo usa fin exclusivo menos un día. Cambiar variante no cambia el estado ni la fecha de vencimiento. El calendario incluye todo intervalo relevante, no sólo su fecha inicial.

## Una única lista y editor

Una lectura coherente para home y día mezcla todas las variantes y agrupa por categoría. Sin orden explícito: fecha/hora de inicio; planes de día completo antes de los horarios en la misma fecha; empate por task/event/appointment/note; identidad como último desempate estable. Una colocación manual explícita tiene precedencia dentro de su contexto; gesto nunca cambia fechas o tipo. Categorías mantienen su orden personal. No separar eventos en otro bloque bajo las tareas.

Iconos de completado: cuadrado, círculo, calendario, nota. Calendario/nota cambian de color al completar y todas las variantes ofrecen nombre accesible y estado, sin depender sólo del color. Editor único a pantalla completa, cuatro chips compactos y cruz/check; conserva datos al cambiar variante. Reusar header/date-time-fields y LongPressOrder ya publicados. No añadir destino nuevo: navegación móvil/escritorio y botón+ actuales abren ese editor.

Los cuatro iconos usan el color de la categoría asignada; neutro si no hay categoría. Completar conserva esa asociación de color y cambia relleno/forma además del nombre accesible, para no depender sólo del color.

## Transición sin compatibilidad de datos

El usuario acepta romper IndexedDB/Mongo antes del lanzamiento y puede realizar el wipe. No implementar migradores históricos salvo cambio de decisión humana. Primero completar schema/productores/local/servidor/cliente/UI y pruebas aisladas del nuevo contrato; después solicitar wipe concreto y activar conjuntamente.

La base Mongo debe conservar usuarios/cuentas/sesiones y distinguir producción de preproducción. Un eventual wipe de contenido abarcaría items, preferencias/placements, recibos/journal/contadores de sincronización asociados: vaciar sólo items dejaría recibos/cursors capaces de simular replay de contenido retirado. El almacenamiento local de cada navegador incluye items, preferencias, cola/outcomes/shadow/incidentes/checkpoints y caché offline de esa versión. No borrar automáticamente: wipe remoto autorizado ya cerrado y preparación local explícita implementada según common-plan-transition. Enumerar nombres reales y procedimiento validado en la entrega que lo necesite; no improvisar desde estos nombres conceptuales.

Negociación de generación4 para impedir que clientes3 muten datos después del cambio; guardia antes del executor y retiro de acciones3. El número de negociación no obliga a cambiar sobres/journal/intenciones si sus contratos se reutilizan sin reinterpretación. Readiness e índices se revisan en el mismo corte según las consultas nuevas; registros centrales, singleton y permisos actuales intactos. Sólo DB Preview autorizada para pruebas humanas; producción requiere alcance explícito separado.

## Siguiente corte implementable16a2

`target_paths`: schemas calendar-item/event-input/command/preference y tipos; reductores de contenido y calendario; repositorios/cola locales; executor/reader/política remotos, ACK/pull y backup que consumen el item; contratos de pruebas. Integración compartida de un único dueño. UI final y activación sólo cuando todas las fronteras leen el mismo contenido; dividir en núcleo preparado y pruebas antes de conectar si el presupuesto lo exige.

Aceptación: misma validación y estado para cuatro variantes, cambio visual sin nueva identidad ni pérdida de opciones, checklist/fechas/recurrencia consistentes; crear/editar/confirmar/pull simples en dos particiones con Mongo propio; rechazo de generación antigua sin ACK falso; categoría y orden preservados; editor/lista/backup coherentes. No anunciar sincronización de series aún no soportadas. Cierre con suite/lint/tipos/build, plan/log, commit/pushint/HEAD y lectura de ambas ventanas.

16a2c: transacción local plan+itemView y executor remoto4 de contenido/progreso/asignación preparados y probados con recursos propios. Negociación4 es exclusiva, intenciones1/receipt-journal2 no se reescriben; transporte/runtime4 siguen sin caller activo. Orden manual común requiere extensión explícita siguiente; no extrapolar executor3 task.move a planes. Reutiliza índices existentes, sin wipe ni provisión.

16a4a: orden remoto/local4 y lista común preparados, con propiedad/CAS/receipt/journal y revisiones optimistas sin ACK ficticio. Readers3 estrictos, reader4 admite planes; 96casos Mongo y cuatro checks IndexedDB reales. Rowgesture habilitado en día/overdue, categorías en todas; all/upcoming multidía requiere contexto de vecinos antes de ofrecerlo. Repeticiones de planes permanecen pendientes de capa de apariciones (padre visible en all con estado explícito). Antes de activar faltan prueba integrada de dos particiones/RPC, apariciones y transición explícita de contenido anterior; no wipe ni cambio de callers activos.

16a4b completa la prueba integrada simple de dos particiones/Mongo, incluido replay/orden/checklist y borrado. Callers actuales siguen3. Siguiente frontera y matriz de activación en [common-plan-activation.md](common-plan-activation.md); no repetir pruebas ya cerradas ni afirmar RPC/Google a partir del fixture.

16a4c2a prepara schema/tipo/generador puro de apariciones comunes (sin caller activo). kind plan, identidad seriesId:slotKey original; variante/owner siguen en el padre, sin duplicarlos en excepciones. Horarios conservan extremos civiles/offsets y validación DST; checklist/estado iniciales independientes. Proyección temporal extraída y compartida con eventos anteriores. Overlay de excepciones, mutaciones locales y UI por aparición se cierran en siguientes cortes; no afirmar persistencia ni sync remota de series.

16a4c2b prepara mutaciones puras de aparición: plan.set-occurrence-status/checklist-entry, plan.update-occurrence y plan.cancel-occurrence. Progreso/edición/cancelación independientes con permiso por padre y slot original; aún no añadidas al contrato de sincronización ni persistencia. Excepciones existentes conservan su original tras cambios de regla; nueva aparición sólo se genera desde una fecha real válida.

Índice puro16a4c2c cerrado: apariciones/excepciones usan identidad original y ownership del padre; intervalos actuales y cursores civiles estables, sin duplicar slots suprimidos. Persistencia y callers todavía pendientes.

16a4c2d: apariciones comunes y sus cuatro comandos se validan en almacenamiento/backup y outbox. Guardado CAS/rollback/replay probado IndexedDB real con cuatro variantes; no ACK remoto de series/apariciones y ninguna UI activa todavía.
