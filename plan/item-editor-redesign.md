# Editor común y lista de planes

## Petición aceptada — 10 de octubre

Las variantes Tarea, Evento, Cita y Nota difieren únicamente por su presentación. Comparten estado, descripción, checklist, categoría, fecha/hora de inicio y fin, todo el día y repetición. Cuadrado para tarea, círculo para evento, calendario para cita y nota para nota; completar cambia el estado visual y el color. No confundir el tipo visual con permisos, planificación o reglas de repetición.

Requisito adicional aceptado: el icono de completado de cada item usa el color de su categoría; el estado se distingue también mediante forma/relleno y etiqueta accesible. Sin categoría utiliza el color neutro de la interfaz.

Editor a pantalla completa, encabezado mínimo cruz/check y campos compactos inspirados en la referencia. Inicio/fin separados en fecha y hora; horas ocultas con todo el día. Las cuatro variantes se muestran en una lista agrupada por categoría, con su color y pasos de checklist visibles. Orden predeterminado: fecha/hora y, en empate, Tarea → Evento → Cita → Nota; identidad como desempate final. Orden manual explícito prevalece dentro de su contexto. Reordenación mediante pulsación prolongada y arrastre sobre el elemento; conservar alternativa por teclado sin botones permanentes de subir/bajar/arrastrar.

## Decisión de datos

El usuario confirma que aún no hay lanzamiento y permite romper compatibilidad con IndexedDB y MongoDB. El modelo futuro será un contenido común con variante visual; los tipos actuales task/event son una estructura heredada que hay que reemplazar conjuntamente con productores, lectores, contratos de sincronización y UI. No prometer cuatro variantes equivalentes añadiendo sólo labels a los formularios antiguos. La sincronización de las cuatro deberá conservar el mismo comportamiento funcional.

Si se requiere wipe, preparar primero alcance exacto (almacenamiento local y DB preproductiva), procedimiento y aceptación; pedir al usuario que lo realice. Esta petición no autoriza borrar automáticamente datos ni tocar producción. No invertir en migraciones o adaptadores de compatibilidad que el usuario acaba de descartar. Un contrato material del modelo se documenta antes de implementar y no cambia autenticación, permisos ni stack.

## Entregas

1. `16a1`: mejoras de presentación compatibles con los formularios actuales: viewport completo, cruz/check, fecha/hora separadas de evento, color en grupos y eventos, checklist de tareas visible. No habilita Cita/Nota ni añade opciones que aún no existen en los contratos actuales.
2. `16a2`: modelo común y variante visual, productores/lectores y sincronización coherentes; definir necesidad de wipe antes de activación. Prueba local/remota, sin claims de soporte mediante labels.
3. `16a3`: editor único con cuatro variantes y todas las opciones, categoría al guardar, UI compacta similar a referencia. Mantener validación DST y fin posterior a inicio.
4. `16a4`: lista mixta agrupada, color, checklist y completado con iconos; ordenar fecha/hora/tipo y orden manual explícito; calendario compartido.
5. `16a5`: integración del gesto con el nuevo modelo común; el gesto sobre tareas y categorías actuales se adelanta independientemente en `16b1`. Gesto de pulsación prolongada/arrastre para items y categorías, scroll normal antes de activar, cancelación, vecinos válidos y teclado. Actualizar productores de orden conforme al modelo común; no dejar controles antiguos visibles.

Cada corte se valida y publica en int con plan/log, commit/push y lectura real de ambas ventanas. El usuario permite apurar semanal al 1% o menos, manteniendo margen para cerrar una entrega completa; no extrapolar el coste de 5h al semanal ni consumir créditos/reinicios. Esta autorización de margen no reactiva la automatización pausada ni concede una nueva cadena programada.


## Intercalada16b1 — Reordenación sobre contenido actual

Depende sólo de16a1 y comandos task.move/tag.move existentes: sustituye handles y subir/bajar por gesto sobre la fila/cabecera. Mantener pulsación450ms, cancelar al desplazarse más de8px antes de activar para conservar scroll; capturar puntero sólo tras activar. Inputs/botones/enlaces no inician arrastre; listas anidadas no activan el grupo al arrastrar una tarea. Escape/blur/pagehide/visibility/pointercancel y cambio de peers/busy cancelan sin comando. Feedback de destino, autoscroll y Alt+flechas como alternativa por teclado; sólo onDrop con vecinos válidos genera intención persistente. El nuevo modelo común reutilizará este componente; no presenta eventos aún separados como reordenables.


Contrato concreto común en [item-model-v2.md](item-model-v2.md), cerrado documentalmente en16a2p. Aplicación y wipe siguen separados de esta decisión.16b1 adelanta el gesto actual;16a5 integrará variantes nuevas y aceptación táctil completa.

### Intercalada16a1b — Descripción y pasos directamente accesibles

La descripción se muestra debajo del título en los editores actuales de Tarea y Evento, antes de la planificación. Los pasos de tareas se editan sin desplegar opciones; la zona horaria del evento conserva su desplegable secundario, oculto con todo el día. Este corte no modifica contratos, datos ni sincronización. Cita/Nota, equivalencia de opciones y lista mixta siguen pendientes de16a2–4.
