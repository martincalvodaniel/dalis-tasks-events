# Editor común y lista de planes

## Petición aceptada — 10 de octubre

Las variantes Tarea, Evento, Cita y Nota difieren únicamente por su presentación. Comparten estado, descripción, checklist, categoría, fecha/hora de inicio y fin, todo el día y repetición. Cuadrado para tarea, círculo para evento, calendario para cita y nota para nota; completar cambia el estado visual y el color. No confundir el tipo visual con permisos, planificación o reglas de repetición.

Requisito adicional aceptado: el icono de completado de cada item usa el color de su categoría; el estado se distingue también mediante forma/relleno y etiqueta accesible. Sin categoría utiliza el color neutro de la interfaz.

Editor a pantalla completa, encabezado mínimo cruz/check y campos compactos inspirados en la referencia. Inicio/fin separados en fecha y hora; horas ocultas con todo el día. Las cuatro variantes se muestran en una lista agrupada por categoría, con su color y pasos de checklist visibles. Orden predeterminado: fecha/hora y, en empate, Tarea → Evento → Cita → Nota; identidad como desempate final. Orden manual explícito prevalece dentro de su contexto. Reordenación mediante pulsación prolongada y arrastre sobre el elemento; conservar alternativa por teclado sin botones permanentes de subir/bajar/arrastrar.

## Estado11oct — Producto común activado

16a4c3d activa las cuatro variantes/editor/lista/calendario junto al transporte4, con19escenarios Next compilado y dos particiones propias aprobados. Wipe remoto Preview cerrado y preparación local explícita por dispositivo preservando sesión/ajustes. No migradores históricos, no producción. Repetición/progreso por aparición locales; series/apariciones aún no se sincronizan. Long-press usa gesto compartido en filas simples del día/atrasadas y categorías; no inventa vecinos en listas parciales ni orden de apariciones sin soporte. Detalle y aceptación en common-plan-activation.

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

16a3a deja el editor común preparado y probado con las cuatro variantes, categoría, checklist, repetición y fechas persistentes al alternar todo el día. Se conectará cuando el transporte común esté validado. El color de categoría en los iconos de tareas actuales ya se aplica; iconos comunes SVG preparados para la lista mixta.

16a4b completa la prueba integrada simple de dos particiones/Mongo, incluido replay/orden/checklist y borrado. Callers actuales siguen3. Siguiente frontera y matriz de activación en [common-plan-activation.md](common-plan-activation.md); no repetir pruebas ya cerradas ni afirmar RPC/Google a partir del fixture.


## Cierre operativo11oct —16a4c3f–h

Cuatro variantes/editor/lista/calendario4 ya activos y pilotoGooglePreview cerrado con14ACK/outcomes remotos. Categoría/color/checklist, fechas/horas/todoeldía, edición/progreso y orden simple persistidos trasrecarga. Importación simple como copias nuevas de cuatrotipos validada con IndexedDB y textos auxiliares actualizados. Repetición/apariciones siguen locales: su sincronización/orden constituyen siguiente bloque recomendado, sujeto a elecciónhumana. No confundir registros preparatorios anteriores con pendientes del editor entregado; gesto sin botones ya conectado, no se inventa orden para listas parciales/apariciones remotas sin soporte.


### 16c1 — Pasos con icono y color del plan

TaskChecklist reutiliza ItemCompletionIcon con variante/color heredados de PlanCard y TaskCard. Cada paso conserva completado propio y casilla nativa accesible/teclado/estado disabled, foco visible y fila táctil44px; modo readonly usa mismoSVG. Apariciones proyectadas reciben variante/categoría del padre por mismoPlanCard. Sin mutación nueva/esquema/índice/dependencia. Prueba markup verifica cuatroiconos/color/checked/disabled/readonly; React+IndexedDB propio4217 confirma check de paso/completar aparición conservan padres/otrasfechas/cola, recarga y limpiezaúnicamentepropia. Captura `/private/tmp/dalis-checklist-parent-icons.jpg`. Suite626pass/153skip/0fail/9158aserciones, lint667/tipos/build34/diff aprobados; commitpushint/HEAD/cuotas y continuar repeticiónremota elegida.


### 16c2 — Orden desde Hoy y próximas y checklist indentada

La lista principal ya permite long-press sobre planes simples, en el mismo contexto día/categoría y con vecinos completos; Todos también. Se conserva bloqueo sólo en contexto de aparición, intervalo consultado fuera de su inicio o página parcial. La checklist tiene indentación20px sin reducir44px táctiles. Fixture React/IndexedDB4251 comprueba toque corto/movimiento previo sin intención, pulsación450ms/drop con una intención task.move, refresco y recarga conservando orden; eventosPointer touch de fixture, no prueba física de móvil. Recursos propios retirados. Calendario recibe destinos en16c3.


### 16c3 — Cambio de día desde calendario

El mismo gesto del día puede soltar sobre una celda del mes del mismo board, incluso con una sola fila; destino resaltado/aria y cancelación conservados. Reprograma inicio y fin por días civiles, manteniendo horas/zona/duración civil/progreso/checklist/categoría. ValidaciónDST rechaza horas ambiguas/inexistentes sin escribir. Simple usa item.update/expectedItem y outbox existentes; una aparición usa plan.update-occurrence/expectedOccurrence/expectedItem, conserva slot y serie. Mismo inicio no genera intención. Ninguna nueva ruta/índice/dependencia ni cambio de transporte4: aparición aún local. Prueba propiaReact/IndexedDB de cancelación/mismafecha, dos drops→dos intenciones exactas, serie intacta y recarga aprobada; viewport390 sin overflow, no equivalente a móvil físico. Captura `/private/tmp/dalis-plan-calendar-drag.jpg`. Recursos propios limpiados;631tests/lint673/tipos/build34 aprobados. Repeticiónremota es siguiente bloque elegido.


### 16c4 — Checklist tras categoría

Editor común sitúa checklist inmediatamente debajo de categoría, antes de Todo el día/fechas/repetición/estado. Mismo componente/estado/guardado para creación/edición y cuatrovariantes; sin cambios de datos. Prueba UIlocal móvil390 desde editar confirma orden y valores, cancelación preserva contenido. Captura `/private/tmp/dalis-plan-editor-checklist-under-category.jpg`; recursospropioslimpiados. DoDglobal aprobado.


### 16c5 — Estado directo desde icono

Entregado11oct: icono principal de los cuatrotipos recorre Sin empezar→En progreso→Completado→Sin empezar en cada pulsación, sin abrir detalles/editor. Vacío/raya/check con colorcategoría y SVGpropio; aria-pressed mixed para progreso, etiquetaespañolaestado+siguienteacción y target44px/teclado. Usa productores/CAS existentes; simples sincronizan4, apariciones continúan locales. Seriepadre permanece deshabilitada y progreso sólo desde aparición. Checklist conserva estado binario eicono/color heredados. No nueva opción/campo de datos.


## 16c14 — Fechas relacionadas y fin realmente opcional

El editor común desplaza la fecha final definida al modificar inicio (campo nativo o flechas), conservando el intervalo de días civiles y las horas separadas. Una edición manual del fin establece la duración que se conserva en el siguiente cambio. Las horas siguen sometidas a validación DST; no se promete duración absoluta en milisegundos a través de cambios de horario. Entradas vacías/incompletas no desplazan el fin hasta recuperar un inicio válido. Extremos civiles quedan acotados por el máximo representable, sin overflow.

«Con fin» permite quitar y volver a añadir la fecha/hora final. Sin fin explícito, timed guarda localEndnull y all_day usa un intervalo implícito de un día; no se inventa un fin visible al cambiar inicio. Al añadirlo de nuevo se inicia en la fecha de inicio. All_day conserva el contrato de fin exclusivo persistido, por lo que al reabrir un plan de un día se muestra su fecha final incluida; no se añade un flag persistente artificial. Todas las variantes comparten el control.

CivilDateInput reutiliza flechas SVG pequeñas izquierda/derecha con targets44px y etiquetas españolas; inicio, fin y última fecha de repetición. Cada flecha resta/suma un día civil, incluidos cambios de mes/año/leap, y se deshabilita en fecha vacía/inválida o límite. DateTimeFields conserva sus callers anteriores sin flechas y mantiene horas ocultas con todo el día. Sin escrituras hasta Guardar ni cambios de transporte/indexes.

Validación: tres tests civiles nuevos/19aserciones, ocho tests específicos/69aserciones incluyendo parser existente; React real4266 con creación/edición, cuatro variantes, ajuste manual/entrada nativa, conservación22:15/08:45, optional all_day/timed, quitar/añadir y última fecha de repetición. Anchos320/390 sin overflow. Payload onSave inspeccionado, fixture sin DB ni sesión; no nuevo pilotoGoogle/dispositivo físico. Captura `/private/tmp/dalis-plan-date-controls.png`. Servidor/tab propios retirados. Suite822pass/221opt-in skip/0fail/10713aserciones; lint835/tipos/buildWebpack/worker46 aprobados.


## 16c14b — Fecha y hora en una fila desde320px

Se corrige la cuadrícula de dos columnas móvil que enviaba hora a una segunda fila al añadir flechas. Ahora etiqueta40px, fecha flexible y hora80px, separaciones4px y padding horizontal4px; escritorio conserva columnas más amplias. Flechas32px de ancho y sin gap redundante; altura visual36px con extensión táctil44px ya existente en los controles compactos. El texto sigue14px efectivo por CSS común y los selectores nativos permanecen accesibles.

FixtureReact4266/CSS recién compilado: viewport real320 muestra fecha104px/hora80px y tops idénticos390.5/434.5 respectivamente, sin overflow ni truncar fecha/hora. Escritorio real1280 tiene fechas152px/horas96px y misma fila. Flecha Inicio desplaza12→13oct/fin14→15oct y Guardar conserva22:15/08:45; Todo el día oculta ambos selectores de hora (width0), al volver conserva valores. No DB/sesión/persistencia nueva. Captura `/private/tmp/dalis-plan-date-time-one-row.png`. Pestañas/servidor propios retirados;824pass/221skip/0fail/10723aserciones, lint837/tipos/Webpack/worker46/diff aprobados.
