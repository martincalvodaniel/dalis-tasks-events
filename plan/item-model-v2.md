# Contrato común de planes — 16a2p

## Estado

Decisión documentada, no activada.16a1 y16b1 están publicados; Cita/Nota y todas las opciones equivalentes siguen pendientes de implementación. Este contrato sustituye la separación funcional task/event sólo para el rediseño elegido; cumpleaños conserva su entrega propia. No modifica autenticación, permisos ni stack.

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

## Transición sin compatibilidad de datos

El usuario acepta romper IndexedDB/Mongo antes del lanzamiento y puede realizar el wipe. No implementar migradores históricos salvo cambio de decisión humana. Primero completar schema/productores/local/servidor/cliente/UI y pruebas aisladas del nuevo contrato; después solicitar wipe concreto y activar conjuntamente.

La base Mongo debe conservar usuarios/cuentas/sesiones y distinguir producción de preproducción. Un eventual wipe de contenido abarcaría items, preferencias/placements, recibos/journal/contadores de sincronización asociados: vaciar sólo items dejaría recibos/cursors capaces de simular replay de contenido retirado. El almacenamiento local de cada navegador incluye items, preferencias, cola/outcomes/shadow/incidentes/checkpoints y caché offline de esa versión. No borrar automáticamente ni pedir todavía el wipe: aún no hay código nuevo listo para activación. Enumerar nombres reales y procedimiento validado en la entrega que lo necesite; no improvisar desde estos nombres conceptuales.

Negociación de generación4 para impedir que clientes3 muten datos después del cambio; guardia antes del executor y retiro de acciones3. El número de negociación no obliga a cambiar sobres/journal/intenciones si sus contratos se reutilizan sin reinterpretación. Readiness e índices se revisan en el mismo corte según las consultas nuevas; registros centrales, singleton y permisos actuales intactos. Sólo DB Preview autorizada para pruebas humanas; producción requiere alcance explícito separado.

## Siguiente corte implementable16a2

`target_paths`: schemas calendar-item/event-input/command/preference y tipos; reductores de contenido y calendario; repositorios/cola locales; executor/reader/política remotos, ACK/pull y backup que consumen el item; contratos de pruebas. Integración compartida de un único dueño. UI final y activación sólo cuando todas las fronteras leen el mismo contenido; dividir en núcleo preparado y pruebas antes de conectar si el presupuesto lo exige.

Aceptación: misma validación y estado para cuatro variantes, cambio visual sin nueva identidad ni pérdida de opciones, checklist/fechas/recurrencia consistentes; crear/editar/confirmar/pull simples en dos particiones con Mongo propio; rechazo de generación antigua sin ACK falso; categoría y orden preservados; editor/lista/backup coherentes. No anunciar sincronización de series aún no soportadas. Cierre con suite/lint/tipos/build, plan/log, commit/pushint/HEAD y lectura de ambas ventanas.
