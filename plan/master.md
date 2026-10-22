# Dalis Tasks & Events — plan maestro

## 23e — Día rojo o verde sin recuento

El calendario elimina número de planes, punto y leyenda de recuento. El número del día es rojo/negrita con al menos un plan sin completar, verde/negrita cuando todos sus planes conocidos están completados y neutro sin planes. Selección usa borde/fondo neutro para no tapar el estado; hoy mantiene borde reconocible. Rojo700/verde700 en claro y400 en oscuro. Etiquetas accesibles españolas anuncian estado sin recuento. No se afirma completado si la evidencia de progreso falta, quedan páginas de apariciones o hay errores de expansión; los pendientes conocidos sí quedan rojos. Mensajes/botón de carga mensual ya no hablan de recuento.

SSR de selección en cada estado, vacío, ausencia de evidencia y página parcial. Catorce pruebas focalizadas/114aserciones iniciales; añadida guardia parcial después de inspeccionar consumidor mensual. DoD final1368pass/225opt-in skip/0fail/14929aserciones, lint1111sinavisos/tipos/Webpack16.4.2/worker46/diff aprobados sobre fuentes finales. Cálculo común de fechas/apariciones sigue intacto, sin nueva persistencia/protocolo/índice.

QA de PlanCalendarBoard real con IndexedDB propio: hoy rojo con tres planes; completar los tres lo vuelve verde y mantiene mañana/pasado rojos; reabrir uno vuelve hoy rojo. Vacíos neutros, sin contador ni punto. Captura390px /private/tmp/dalis-23e-calendar.png. Prueba/bases propias eliminadas, servidor/pestaña retirados y viewport restablecido. La guardia de carga parcial posterior se valida en SSR; no se atribuye recorrido UI parcial ni RPC/Google/físico nuevos. Entrada73%5h/96%7d y control68%/95%, reservas10%/1%; mismo commit/pushint/SHA/cuotas, sin DBusuario/producción.

## 23d — Mi espacio continuo fuera de Hoy

Hoy mantiene bloques y orden de categorías. Atrasadas y Próximas muestran una sola lista sin encabezados de categoría, en fecha de inicio civil ascendente. Dentro de cada categoría/fecha conservan las posiciones manuales existentes; se combinan sobre el orden cronológico de base sin comparar rangos de categorías independientes ni dejar que una posición antigua cruce fechas. Cada fila conserva identidad de padre/slot, categoría editable y color propio en icono y pasos. Calendario no cambia. Contadores, plegado y carga adicional conservados; sin nuevos comandos, persistencia o índices.

Catorce pruebas focalizadas/88aserciones: fechas entre categorías, manual simple/aparición, identidad original, no mutación, independencia del orden de categorías y SSR de listas continuas/agrupadas. Los primeros fixtures se corrigieron para incluir normalizedName y usar TaskPlacement estricto; expectativa de orden por variante corregida y itemId de prueba previa restaurado tras sustitución demasiado amplia. Schemas y comportamiento anteriores no relajados. DoD1364pass/225opt-in skip/0fail/14892aserciones, lint1111sinavisos/tipos/Webpack16.4.2/worker46/diff aprobados.

QA de PlanAgenda real a390px con cuenta/IndexedDB propios: Atrasadas0encabezados, Hoy4categorías, Próximas0encabezados; fechas y stroke de iconos/pasos propios (#e85d04/#123abc/#2b9348/#b5179e) conservados, plegado de Hoy operativo. Captura /private/tmp/dalis-23d-home.png. Prueba/bases propias eliminadas, pestaña/servidor retirados y viewport restablecido. No nuevas pruebas RPC/Google/físicas ni DBusuario/producción. Entrada83%5h/97%7d, control78%/97%, reservas10%/1%; mismo commit/pushint/HEAD/cuotas.

## 23c — Dependencias actualizadas y build validada

Ejecutado el comando solicitado `bun update --latest && bun install`: instalación final sin cambios adicionales. Actualizadas dependencias directas Next16.4.0→16.4.2, React/ReactDOM19.3.0→19.3.1, BetterAuth1.7.7→1.7.12, Zod4.6.5→4.6.7, Biome2.5.15→2.6.2, tiposBun1.4.2→1.4.3 yKnip6.41.0→6.42.1, con transitivas en bun.lock. Sin nuevas dependencias directas ni cambios de código productivo.

Biome2.6 incorpora formato Markdown y diagnósticos nuevos sobre el histórico: se conserva explícitamente el alcance anterior, desactivando formatter Markdown y reglas useConsistentTestIt/noConditionalExpect/useMathMinMax. Evita reformatear documentación y reescribir aserciones de fixtures por una actualización de herramientas; el resto de reglas siguen activas. Primer lint rechazó formato Markdown; tras ajustar política, un formato de biome.json se corrigió de forma aislada. Resultado final:1360pass/225opt-in skip/0fail/14873aserciones, lint1110sinavisos/tipos/Webpack16.4.2/worker46/diff aprobados. Build con configuración ficticia sin conexión a DBusuario y fallback Webpack ambiental habitual; no apareció el aviso de seguridad que detuvo la build16.4.0. Esto no constituye una auditoría de seguridad ni una nueva matriz RPC/Google. No DBusuario/producción/hosting/secretos/permisos.

Entrada88%5h/98%7d, control84%/97%, reservas10%/1%; mismo ConventionalCommit/pushint/verificación SHA/cuotas.

## 23b — Indicador de pendientes en el calendario

El punto junto al total diario se muestra rojo si queda algún plan sin empezar o en progreso, incluidas las cuatro variantes y las apariciones recurrentes. Al completar todos vuelve al color neutro; el número sigue incluyendo completados. Cancelados y borrados no intervienen. La descripción accesible anuncia pendientes sin depender sólo del color.

Pruebas focalizadas11/80aserciones y DoD1360pass/225opt-in skip/0fail/14873aserciones, lint1074sinavisos/tipos/Webpack/worker46 aprobados. UI productiva con IndexedDB propio: completar los tres planes de hoy elimina el rojo conservando total3; reabrir uno lo restaura y otras apariciones conservan su estado. Prueba y bases propias eliminadas, servidor y pestaña cerrados. Sin cambios de persistencia, sincronización o índices ni DBusuario/producción. Build inicial compiló pero salió por aviso de seguridad de Next16.4.0; la repetición ordinaria indicada por el comando pasó, sin actualizar dependencias ni modificar comprobaciones. No se atribuye nueva matriz RPC, Google o prueba física.

## 23a — Orden mixto restaurado en Mi espacio y Calendario

Corregida la regresión reportada: Plan1 y Plan2 de hoy siguen siendo reordenables al añadir Plan3 con repetición diaria durante3días. La selección mezcla planes simples y apariciones; cada fila conserva su clave original y el comando guarda el padre junto con occurrenceId del slot concreto. Calendario ofrece tanto orden entre filas como cambio de fecha; Mi espacio comparte las posiciones del mismo día/categoría. Próximas conserva agrupación cronológica por fecha y Atrasadas su contexto conjunto; se mantienen guardias de carga incompleta/cuenta/busy. Los planes de varios días también se pueden ordenar en el día seleccionado.

Siete pruebas del selector/comando y17focalizadas con agenda, incluyendo cuatrovariantes, planner real, orden inverso simple↔aparición, slot movido, multidía, atrasadas y cancelados/borrados. UI productiva con IndexedDB propio: pulsación prolongada+arrastre táctil sintetizado por fixture en Mi espacio y Calendario390px, teclas reales Alt+flechas, mismo orden al cambiar de vista y después de recarga. Dos ejecuciones con seis y cuatro movimientos pending/attempt0/sinlease respectivamente, tres posiciones sólo de hoy; padres, contenido, horarios, otras fechas y preferencias idénticos. No es prueba nueva en dispositivo físico ni convergencia RPC nueva. [Mi espacio tras recarga](evidence/23a-home-order-mobile.png), [Calendario](evidence/23a-calendar-order-mobile.png).

DoD1357pass/225opt-in skip/0fail/14841aserciones, lint1074sinavisos/tipos/Webpack/worker46. Regresión Mongo propia140pass/1904aserciones, exit0 y limpieza confirmada. No cambia el motor remoto, el protocolo o los índices. Matriz Next38 anterior22c1 permanece como evidencia previa, no se atribuye repetición a este corte. Sin DBusuario/producción; mismo commit/pushint/HEAD/cuotas.

## 22c1 — Versión de alcance vigente validada

El desarrollo y la validación de ingeniería de esta versión quedan cerrados. Los **38 escenarios completos Next6 automáticos** pasan en una sola ejecución, con acciones/defaults reales, sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios. Run f7a895f9-b3a8-4ce7-9003-481bacacd0f8: exit0 y retirada de recursos propios confirmados. [Checklist de cierre](release-readiness.md), [resultado exacto](evidence/22c1-next-full-auto.json) y [captura](evidence/22c1-next-full-auto.png).

full-auto conserva autorización, negociación, CAS, rollback, respuesta perdida, recarga, UUID/replay/ACK único y proyecciones exactas. Sustituye confirmaciones manuales por las features productivas; el editor de zona sí usa sus controles reales automáticamente. full y los scopes UI mantienen su recorrido manual por defecto. La evidencia de cancelar/reabrir/confirmar y UUID generados por UI sigue registrada por familia; no se atribuyen esas interacciones a los 38 automáticos. La checklist física17oct y el arrastre ya aceptados no se reabren.

DoD1352pass/225opt-in skip/0fail/14758aserciones, lint1072sinavisos, tipos, Webpack y worker46 aprobados. No hay nuevas funcionalidades pendientes dentro del alcance fijado. **Quedan promoción a main y smoke del destino publicado**, actuaciones operativas separadas; no ejecutadas ni autorizadas por este cierre. Padre recurrente eliminado, remoto desconocido, cadenas externas y copia de serie completa siguen pospuestos; cumpleaños aparcado y Gmail fuera. No se presentan como implementados ni se pierden sus guardias/evidencias.

## 22c0 — Cierre seguro; regresión conjunta todavía pendiente

22a/22b están completos y publicados en9712bf5/5d611c9: foco/títulos/calendario y errores/reflujo del editor. Este corte prepara el cierre operativo, no declara terminado22c. README elimina la política Preview obsoleta: ensureIndexes aplica todo el registro en cualquier rama/entorno. Guía de uso y release-readiness distinguen alcance fijado, recuperación excepcional pospuesta, aceptación física17oct ya cerrada y promoción a main no ejecutada. Capturas propias sin datos personales guardadas en plan/evidence.

Tres intentos de fullNext6 con sesiones BetterAuth persistidas/dosorígenes IndexedDB/Mongo propios:5abefe35 se interrumpió en interacción categoría/orden;5a8ee973 aprobó también orden recurrente/grupo mixto pero una elección manual incorrecta en orden simple invalidó el intento;17fae900 aprobó17de38 escenarios y terminó sin aprobación en orden de categorías. No atribuir el fallo genérico a producto ni afirmar matriz completa. Última ejecución ya acreditó todas las familias anteriores hasta borrado de categoría; otras pruebas focalizadas históricas permanecen separadas. Todos los runners terminaron exit1 y confirmaron retirada de contenedor/almacenamiento propios; el controlador intentó limpieza de particiones/sesiones y cerró su peer. Pestañas propias cerradas/viewport restaurado. No DBusuario/producción.

Instrumentación preparatoria: plazo global de runner settings30min (resto10min), sin relajar plazos/aceptación por caso;14hosts UI muestran instrucción española con la elección esperada, comparten helper privado y lo retiran al cerrar. No cambia producto, comandos, datos, guardias o aserciones. Next compilado validó estos templates y17escenarios ejecutados con indicaciones; el operador debe completar cancelar/reabrir/confirmar cada elección y no inferir la familia por un botón compartido. Bootstrap inicial del script rechazó recuento14≠13 antes de mutar templates, corregido con verificación de anclajes.

Entrada22c73%5h/39%7d; controles intermedios54/36,48/36,32/33,27/32,22/32 y cierre10/30. Se detiene trabajo nuevo al llegar a reserva10%; no abrir otra prueba o recuperación. DoD de cierre:1349pass/225opt-in skip/0fail/14738aserciones, lint1072sinavisos/tipos/Webpack/worker46/diff aprobados después de retirar Next temporal. Commit/pushint/HEAD/cuotas al cerrar. Siguiente único bloqueo de lanzamiento22c1: completar la matriz, con ejecución que no dependa de inferir pasos manuales; diseñar scope backend explícito separado de UI si se necesita, conservando full y aceptación UI, nunca rebajar aserciones ni anunciar38por17. No nuevos bloques de producto ni programación automática.

## 22b — Editor accesible y reflujo cerrado

Errores de PlanForm se anuncian y enfocan el control pertinente, con aria-invalid y descripción enlazada al mensaje; limpieza restaura atributos previos. Reintento del mismo error vuelve a enfocar; fallo de guardado enfoca resumen y conserva borrador. Zona oculta se revela antes de enfocar. Nombres de checklist permiten localizar el paso correcto. No cambian schema, payload ni sincronización.

QA de componentes reales en loopback4266 sin DB: título/paso vacíos, zona inválida efectiva en plan con hora, intervalo0, reintento, corrección/guardado conservando paso, marcas limpiadas y fallo simulado sin pérdida. Tres pruebas con errores reales del schema/6aserciones; fixture inicial tenía IDs noUUID y se corrigieron sin relajar schema. Inspección visual detectó solapamiento de variantes y fecha recortada al200% además de desbordamiento de repetición. Adaptación por ancho relativo sólo en formulario/fechas: tipos2columnas, filas/fechas apiladas y controles completos cuando hace falta; tamaño normal conserva4tipos y fecha/hora en la mismafila a320/390px. Sin overflow320 a200% en claro/oscuro; colores auxiliares con contraste oscuro mejorado. Capturas /private/tmp/dalis-22b-editor-mobile.png y /private/tmp/dalis-22b-editor-320-text200-final.png. Viewport/tab/servidor propios retirados. No certificación de lector humano.

DoD1349pass/225opt-in skip/0fail/14738aserciones, lint1072sinavisos/tipos/Webpack/worker46/diff sobre fuentes finales aprobados. Entrada86%5h/42%7d, control75%/40%, reservas10%/1%; commit/pushint/HEAD/cuotas. Siguiente22c: regresión Next6 completa con dosorígenes/Mongo propios, guía de uso actualizada y runbook de cierre; no nuevas funcionalidades ni recuperación excepcional. Sin DBusuario/producción/índices/dependencias/nueva programación.

## 22a — Navegación accesible cerrada

WorkspaceHeading actualiza título por destino y enfoca el h1 sólo cuando cambia la pantalla; las actualizaciones dentro de la misma pantalla mantienen foco y shell. Calendario permite PageUp/PageDown desde sus controles y conserva foco en la región al retirar celdas; mes anunciado con aria-live. Estilos compartidos dan foco visible, margen respecto a navegación fija y scroll contenido en diálogos. Detectado y corregido desbordamiento del encabezado de mes con texto al200%.

Prueba de componentes reales en loopback propio4277 sin cuenta/DB: navegación→h1/título, Atrás, UUID de montaje idéntico, PageDown→noviembre con foco conservado, confirmación nativa/Escape→botón original. A320px texto200%, scrollWidth320 en claro y oscuro, sin elementos desbordados; captura /private/tmp/dalis-22a-calendar-320-text200.png. Primer fixture falló por NextImage sin process.env: configuración ficticia aislada añadida sólo al servidor de prueba; producto no afectado. Viewport restablecido/tab/servidor propios cerrados. No prueba de lector de pantalla humano ni certificación WCAG. Guías Next instaladas/Vercel aplicadas.

DoD1346pass/225opt-in skip/0fail/14732aserciones, lint1069sinavisos/tipos/Webpack/worker46/diff aprobados sobre fuentes finales. Entrada100%5h/44%7d; control93%/43%, reservas10%/1%. Commit/pushint/HEAD/cuotas; sigue22b errores enfocados del editor, luego22c regresión/cierre operativo. Recuperaciones excepcionales quedan pospuestas conservando protecciones, no completadas. Sin DBusuario/producción/índices/dependencias ni nueva programación.

## 21q1 — Control de cuota permanente y lote cerrado

AGENTS y workflow exigen comprobar ambas ventanas también entre fases largas, antes de pruebas costosas y después de fallos imprevistos. La reserva10%5h/1%7d permanece intacta: se protege también el coste de reparar, documentar, publicar, verificar y volver a leer cuotas; no se usa como objetivo que haya que alcanzar consumiendo. Las lecturas de este lote se hicieron al empezar, durante implementación/pruebas y después de cada entrega. Último código b126453 con DoD completo; contrato de copia actualizado sin duplicaciones ni instrucciones históricas de reparar un counter ausente.

Lote retomado con100%5h/57%7d y cerrado tras recuperación categoría+orden y copia independiente de aparición cancelada, ambas activas en int. Última lectura antes de este corte23%5h/45%7d; reservas10%/1%. El siguiente bloque residual requiere contrato/implementación/pruebas y coste de reparación no acotado dentro del margen disponible: no se inicia. Sin cambios de código desde DoD1346pass/225skip/0fail, lint/tipos/Webpack/worker46. Validación documental/referencias/consistencia/diff; commit/pushint/HEAD/cuotas. Recursos Mongo/Next/IndexedDB/browser propios retirados, repo sin trabajo parcial y main humano preservado. No nueva programación, créditos ni reinicios utilizados.

## 19l5b — Copia de una aparición cancelada activa en Ajustes

Botón «Crear copia de este día» sólo para cuenta propia y comparación de un slot admitida. Antes de abrir, lee de nuevo el overview completo en TX readonly y verifica cuenta/época; congela request y tres UUID reales generados por UI. Confirmación reusa esos IDs, cancela sin escribir, valida nuevamente en writer y sólo invalida cachés de su cuenta/época. Componente identificado por cuenta/época/operación y mounted guardado; no expone copia para ausencia desconocida, padre borrado o cohorte externa. Adopción existente permanece disponible. La copia es un plan independiente sin repetición/categoría/orden; nunca resucita el original.

Once escenarios Next6 focalizados `appearance-copy-ui` aprobados con sesiones BetterAuth persistidas/dos orígenes IndexedDB/Mongo propios. Cuatro variantes remotas: task interactiva con abrir/cancelar/reabrir/confirmar, tres UUID UI distintos del request preliminar y snapshot fresco idéntico; las otras tres usan la feature directamente. Cuatro respuestas perdidas/recargas/replays obtienen un ACK real único por copia y proyecciones/shadows/cursor exactos; padre, cancelación, otros slots y preferencias intactos. No full38, Google interactivo o nuevos físicos. Run5d38f512-4000-42fd-9155-cb71d80ec8c3 exit0 y retirada de recursos propios confirmada; tabs/proyectos/procesos propios cerrados. Captura `/private/tmp/dalis-21-appearance-copy-ui-next.png`.

25 pruebas focalizadas/209 aserciones de SSR/selector, incluidas actor/null/cadena sin botón y schema estricto del host. DoD1346pass/225opt-in skip/0fail/14732 aserciones, lint1066 sin avisos/tipos/Webpack/worker46/diff aprobados después de limpiar Next temporal. Entrada34%5h/46%7d; controles31%/46% antes de interacción y26%/45% tras prueba; reservas10%/1%, secuencial. Sin índices/protocolo/dependencias ni DBusuario nuevos. Recuperación de copia de un slot cancelado cerrada en este alcance. Padre borrado, remoto desconocido y cadenas externas conservan guardias; no ampliar a copia completa de serie. Siguiente: contratos residuales acotados, accesibilidad y cierre operativo según dependencias; no abrir otro bloque grande con el margen de cierre de este lote.

## 19l5a — Diálogo de copia preparado y revisado en móvil

Disponibilidad usa el mismo planner y el tamaño completo de recibo; IDs representativos privados sólo miden la representación, nunca alcanzan writer o ejecutor. APIs públicas siguen exigiendo IDs nuevos. Diálogo recibe request real congelado, valida actor/evidencia, compara el plan nuevo con el original cancelado y explica sin repetición/categoría/orden, historial conservado y pending hasta confirmación. Vista nueva muestra el borrador sin UUID ni revisión técnica. No hay caller activo aún.

Cinco SSR con cuatro variantes/guardias/busy y pruebas de disponibilidad en snapshots inválidos y desbordamiento de recibo; 46 pruebas focalizadas/357 aserciones junto al planner. QA CSS final390×844: página390/dialog356 sin desbordamiento, botones50px accesibles tras scroll y cancelar cierra sin datos/DB. Captura `/private/tmp/dalis-21-appearance-copy-dialog-mobile-final.png`; viewport restaurado, tab/servidor propios cerrados. DoD1345pass/225opt-in skip/0fail/14723 aserciones, lint1065 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada47%5h/48%7d, control37%/47%, reservas10%/1%, secuencial. Sin IO/índices/protocolo/dependencias nuevos. Siguiente19l5b: lectura fresca de comparación, botón y modal con IDs reales estables/cuenta/época/mounted/cache; interacción real cancelar/reabrir/confirmar con UUID UI y replay remoto antes de publicar activación.

## 19l4 — Copia de aparición acreditada con Next6 y Mongo

Once escenarios Next6 focalizados (`appearance-copy`) pasan con acciones/defaults reales, sesiones BetterAuth persistidas y dos orígenes IndexedDB/Mongo propios. Cuatro variantes: excepción editada offline frente a cancelación concurrente, cuatro intenciones del mismo slot y borrador posterior al outcome. Cuenta/época/stale no escriben. Decisión local conserva originales y outcome exactos, crea un plan independiente sin repetición/categoría/orden y no confirma nada remotamente.

Cuatro respuestas perdidas después de crear copia dejan el mismo UUID pending attempt1 sin lease; recarga conserva todos los stores, replay obtiene ACK real attempt2 con un único recibo/journal. Padre, cancelación, segundo slot y preferencias intactos. Ambas particiones terminan con la copia revisión1, proyecciones/shadows/cursor exactos contra Mongo y replay durable sin retroceder estado. No se atribuye convergencia global de otros históricos, Google interactivo o nuevos dispositivos físicos; full38 disponible sin ejecución completa. Primera compilación detectó que la sombra portable de item requiere decoder (puede carecer de kind); fixture corregida con decoder productivo sin cambiar datos o protocolo. Run54a3de2b falló antes de casos y confirmó limpieza; run61e76880-d916-4192-96cf-94a715f992a8 terminó exit0 y retiró contenedor/almacenamiento propios. Captura `/private/tmp/dalis-21-appearance-copy-next.png`, tabs/proyectos/procesos propios cerrados.

DoD1340pass/225opt-in skip/0fail/14631 aserciones, lint1062 sin avisos/tipos/Webpack/worker46/diff aprobados después de limpiar Next temporal. Selector/matriz estrictos con ocho aserciones nuevas. Entrada60%5h/50%7d; control al terminar RPC48%/49%; reservas10%/1%, secuencial. Sin índices, dependencias, protocolo ni DBusuario nuevos. Siguiente19l5: disponibilidad/preview guardados, diálogo de copia y caller sólo para este alcance, con cancelar/reabrir/confirmar/UUID UI reales y QA móvil antes de activar. No hay botón de copia recurrente activo todavía.

## 19l3 — Copia de aparición guardada atómicamente en local

Writer preparatorio relee la comparación completa y outcomes con nueve stores en una TX readwrite. Original remoto cancelado/tombstone, copia, originales superseded exactos, un item.create independiente, counter y recibo se guardan juntos. Comprueba IDs contra items/tombstones, sombras, cola y metadata (incluidas otras decisiones/importaciones); límites posteriores +1item/+1outbox/+1recibo. Counter ausente/atrasado/agotado se rechaza sin reparar. Replay valida el recibo antes de capturar o escribir y conserva ediciones posteriores. Store sólo notifica tras commit aplicado; feature valida cuenta/época antes/después y cierra conexión en finally. No hay botón de copia recurrente todavía.

17 comprobaciones IndexedDB reales propias aprobadas: captura sin escrituras, stale/foreign/padre/outcome/remoto cambiados, otras fechas/cadena incierta, dependiente externo válido protegido, IDs históricos/metadata, límites completos de items/cola/metadata, counter, rollback tardío de todos los efectos, copia+backup coherentes sin modificar padre/otros slots/preferencias, recarga/replay/identidad reutilizada, época durante apertura, carrera equivalente con un commit/un aviso, y época posterior al commit que rechaza la respuesta pero conserva copia pendiente para replay con época vigente. Runs finales `15a19fb3-3820-4710-a6b6-62369c7f57df`; partición/control propios eliminados, pestaña y servidor cerrados. Captura `/private/tmp/dalis-21-appearance-copy-indexeddb-final.png`. No Mongo/RPC nuevos en este corte.

DoD1339pass/225opt-in skip/0fail/14623 aserciones, lint1062 sin avisos/tipos/Webpack/worker46/diff aprobados. Fixture formateada hasta quedar estable; cuenta de actor inyectable sólo para pruebas propias. Entrada76%5h/53%7d; control intermedio66%/52%; reservas10%/1%, secuencial. Sin nuevos índices/protocolo/dependencias ni DBusuario. Siguiente19l4: productor real de excepción y cancelación concurrente con Next6/BetterAuth persistido/dos orígenes IndexedDB/Mongo propios, pérdida tras crear copia, recarga/replay/ACK único y proyecciones exactas. Separar la futura UI19l5 hasta que esa evidencia remota pase.

## 19l2 — Copia de aparición preservada en backup3

Codec añade rama explícita occurrence_copy con recibo replanificado. Exige originales superseded exactos, outcome congelado persistido (no sólo DTO), reemplazo exacto de la nueva entidad/fecha/secuencia/dependencias y presencia de copia/padre/slot originales. Acepta copias editadas después y pending intentados tras respuesta perdida sin exigir la proyección inicial. Rechaza dependientes externos, nuevas confirmaciones de originales nunca intentados, identidad de copia usada antes, colisiones globales entre operaciones/decisiones/copias y doble atribución de originales. Superseded no equivale a ACK. Las tres pruebas antiguas de quitar un marcador ahora seleccionan su familia explícita para no quitar el marcador de la nueva familia por accidente.

16 pruebas/72 aserciones: roundtrip cuatro variantes, truncación/corrupción, originales y reemplazo alterados, edición posterior, pending intentado, ACK con outcome aplicado modelado coherente (no prueba Mongo nueva), DTO congelado falsificado, IDs y exclusividad entre familias. Se corrigieron entityKey y narrowing de una fixture con schema compartido; contratos estrictos conservaron sus rechazos. DoD final1339pass/225opt-in skip/0fail/14623 aserciones, lint1059 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada84%5h/54%7d, control intermedio78%/53%, reservas10%/1%, secuencial. Sin IO, TX ni caller nuevos: copia recurrente aún oculta. Siguiente19l3: captura y guardado atómicos con todos los IDs/capacidad/cuenta/época/replay, y comprobaciones IndexedDB propias antes de Next/Mongo/UI.

## 19l1 — Copia de una aparición cancelada preparada

Contrato [ausencia y copia](remote-absence-recovery.md) distingue versión cancelada/tombstone conocida de remoto desconocido: `unavailable`, null o ausencia en pull no autorizan recreación ni ACK. Planner separado recupera una sola aparición como plan nuevo sin repetición, categoría u orden; conserva variante, contenido efectivo, horario, progreso y checklist actuales. Original permanece cancelado/tombstone y el padre no cambia. Cadena aislada del mismo slot con raíz conflict intentada y dependientes pending no intentados/directos, sin referencias externas. IDs nuevos, snapshot exacto, recibo replanificado y límite5MiB. Comparación existente exportada sin ampliar las decisiones activas.

41 tests/265 aserciones acreditan cuatro variantes × all-day/timed × contenido propio/heredado, cambio local posterior, nueva identidad, cancelación/tombstone original intactos, stale/foreign/ausencia/cadena/IDs/recibo corrupto, evidencia que desborda al añadir recibo y hora civil ambigua rechazada por el oráculo productivo. Se corrigieron fixtures de captura, contenido heredado y narrowing null; el primer horario de prueba caía en la hora ambigua del cambio de octubre y ahora tiene prueba de rechazo explícita. Validación final1323pass/225opt-in skip/0fail/14551 aserciones, lint1056 sin avisos, tipos/Webpack/worker46/diff aprobados. Sin writer/portable/UI/IO nuevos: la opción de copia recurrente aún no se ofrece. Entrada94%5h/56%7d, control intermedio89%/55%, reservas10%/1%, secuencial. Siguiente19l2 portable, después TX/Next/UI según el contrato; no resucitar originales ni descartar otras cadenas.

## 19k6f — Recuperación conjunta de categoría y orden visible

Ajustes permite revisar y resolver movimientos entre categorías de un plan simple o una aparición recurrente con posiciones conocidas. La lectura adaptativa selecciona la familia explícita; el diálogo muestra categorías y colores conocidos, grupos origen/destino, slot exacto y hermanos. Advierte que la categoría cambia para todas las fechas del padre y que las posiciones manuales de otras fechas se conservan. Una posición eliminada se identifica como «Sin posición manual», sin presentar el plan como eliminado. Cuenta, época, caché y UUID estable por confirmación protegidos; cancelar no escribe y la elección local no fabrica ACK.

Evidencia: scope `category-placement-ui`, once escenarios Next6 compilados con defaults, sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios. Seis casos simple/moved/implicit × adoptar/reintentar; dos interactivos (simple/adoptar y moved/reintentar) con cancelar/reabrir/confirmar y UUID generados por UI. Tres respuestas perdidas tras commit, recarga, replay con el mismo UUID y ACK único; catálogos, shadows y cursor exactos. Los otros cuatro casos usan la feature directamente. No se atribuye ejecución completa de full37 ni autenticación Google o dispositivos físicos nuevos. Primer intento agotó el plazo del comando del fixture; ambos comandos UI nuevos usan ahora el plazo interactivo ya existente. Segundo run `99c095a8-906c-417a-bc97-d204104ebd42` finalizó correctamente y confirmó limpieza de contenedor y almacenamiento propios.

Catorce pruebas SSR con 205 aserciones y QA con CSS a 390 × 844: sin desbordamiento horizontal, opciones y cancelar accesibles. Capturas: `/private/tmp/dalis-1843-category-ui-next.png` y `/private/tmp/dalis-1843-category-review-390.png`. Pestañas, servidores y proyectos temporales propios cerrados; pestaña humana preservada. Validación final al retomar: 1282 pass / 225 opt-in skip / 0 fail / 14286 aserciones, lint1051 sin avisos, tipos, build Webpack y worker46 aprobados.

La ejecución anterior alcanzó el límite antes de este cierre; no había publicado el caller. Retomada el 21 de octubre con 100%5h/57%7d, reset5h observado 1792576248 y reservas 10%/1%. Se comprueban cuotas también durante entregas largas, además de después de cada commit; no abrir otro corte sin margen para reparar, publicar y cerrar. La revisión puntual antigua de las 18:43 se ha eliminado; esta continuación es interactiva y no crea otra programación. Sin índices, protocolo, dependencias, DB del usuario ni producción nuevos. Siguiente: delimitar recuperación residual de ausencia remota/copia y cadenas externas antes de cualquier caller; después accesibilidad y cierre operativo.

## 19k6e — Categoría yorden probados conRPC6/Mongo

Once escenariosNext6 focalizados (`category-placement`) aprobados conacciones/defaults reales, sesionesBetterAuth persistidas ydosorígenesIndexedDB/Mongo propios. Seiscasos simple/moved/implicit×adopt/retry usan productores reales, grupos origen/destino yposiciones comprometidas incluidaotrafecha. Competidor cambiaCASprimario sinrecategorizar remoto; colaoffline conserva comandos/UUID/dependencias exactos. Guardias actor/época/stale sinwrites; adopción0ops yretryúltimocomando conCASactual/vista independiente. Tres pérdidastrascommit mantienen pendingattempt1, recarga yreplay mismoUUID→ACKrealattempt2 único/unjournal.

Ambosorígenes terminan concatálogos completos devistas/posiciones, shadows ycursor exactos contraMongo. Parent category se mueve conjunto, posiciones deotrasfechas/contenido/reglas/apariciones/categorías/settings intactos. Replay durable no retrocede estado. Scopefull37 disponible, no ejecutado completo niUI/Google/físicos. Primerlauncher propio detenido antesdeloscasos trasrevisar vecino delorigen; sucontenedor37f31051 ausente confirmado pornombre exacto. Run83bf3c96-25a2-4664-aaa3-114485cebf69 exit0/cleanup propio confirmado. Captura /private/tmp/dalis-1843-category-next.png; pestañas/servidores/Next temporal propios cerrados ytabhumana preservada.

Schema/matrizdecomandos estrictos con7aserciones nuevas. DoD1268pass/225skip/0fail/14079aserciones, lint1047sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada48%5h/64%7d, reservas10%/1%, secuencial. Siníndice/protocolo/dependencia/DBusuario nuevos. Siguiente19k6f: diálogo compacto conorigen/destino/colores/slot yadvertencia todaslasfechas/posicionesfuturas preservadas, calleradaptativo, ambasdecisionesUIreales cancelar/reabrir/confirmar/IDsUI antes depublicar. Backend noofrece aún nuevasopciones alusuario.


## 19k6d — Categoría yorden guardados atómicamente en local

Familia category_movement usa captura propia sobreTX9stores ywriter compartido tipado; APIs previas siguenstrict. Relee contexto/cola/frozen/sombras/prerequisitosACK conoutcomes aplicados reales antes deescribir. Guarda vista delpadre+posiciones, originales superseded exactos,0/1reemplazo, counter/tail/recibo enuncommit. Replay primero no retrocede trabajo posterior; límitescompletos/IDs/counter/tail/capacidad posterior antes deescrituras. Feature/store conprotocolo6/cuenta/época antes-después yfinallyclose; aviso sólo trasaplicado, noreplay/fallo. SincallerUI nuevo.

39comprobaciones IndexedDB propias pasan:13cada una simple/moved/implicit. Readonly/familiasprevias protegidas, actor/contexto/foreign/unknownshadows/localrev0/colaexterna, fallo tardío derecibo revierte tambiénvista, IDs/overflow, retry+backup/tail/recarga/replay, adopción sinops que restaura categoría, capacidad contando tail faltante/recibo yreplay lleno, ACKDTO sinoutcome rechazado yACKconoutcome coincidente admitido, época duranteopen ydosconfirmaciones→unaplicado/unreplay/unaviso. Fixturadeactor inyectable sólo para cuentasUUID propias. Se corrigió nombre camelCase delnuevofixture antesejecutar. Particiones/control/tab/server propios retirados; pestaña humana intacta. Capturas /private/tmp/dalis-1843-category-native-{simple,moved,implicit}.png.

DoD1267pass/225skip/0fail/14072aserciones, lint1047sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada58%5h/66%7d, reservas10%/1%, secuencial. Siníndice/protocolo/dependencia/DBusuario/IOremoto nuevos. Siguiente19k6e: productores reales de movimientos entrecategorías conNext6/defaults/sesionespersistidas/dosorígenes/Mongo propios; CASindependientes/vista deparent yotrasfechas, pérdida/recarga/ACKúnico/catálogos/sombras/cursor. Después representación/UI conadvertencia sobre todoelplan antes deofrecer opciones activas.


## 19k6c — Evidencia portable conjunta preservada

Backup3 incorpora category_movement antes defamilias previas yreconstruye record completo, incluida vista elegida/posiciones. Reutiliza guardias comunes deoriginales superseded/outcome congelado/prerequisitos conhistoria youtcomes aplicados/reemplazo exacto/exclusividad/IDsglobales. Quitar familia ovista, alterar revisión/categoría/cuenta ohistoria rechaza; superseded noACK. Pending intentado trasrespuesta perdida yedicionesposteriores permanecen portables sinretroceder proyección. Sombras de categorías/vistas/padres/apariciones/posiciones incluidas enfixture.

19tests/96aserciones: simple/moved/implicit×day/overdue×adopt/retry, roundtrip, formatoanterior, truncación/corrupción, prerequisitosDTO sinoutcome aplicado rechazados, reemplazoexacto/IDs/exclusividad. Modelo puro deACKmultiefecto actualiza vista yposiciones conrevisiones independientes usando planners productivos; noesACKMongo nuevo. Recordpuede conservar evidencia aunque proyecciónactual haya cambiado después. Sinrepair/migrador nuevo.

DoD1267pass/225skip/0fail/14072aserciones, lint1045sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada63%5h/67%7d, reservas10%/1%, secuencial. Sinwriter/caller/IO/índice/dependencia/DBusuario nuevos. Siguiente19k6d: captura ywriter conjuntoTX9stores queguarde tambiénvista, acredite prerequisitos reales, capacitépostwrite/IDs/counter/tail/replay/rollback; validaciónIndexedDB nativaantes deNext/Mongo/UI.


## 19k6b2 — Decisión pura de categoría yorden preparada

Familia category_movement separada conserva snapshot canónico decatálogos/raízconflict/cola/outcome congelado/clausura deACKs. Reutiliza guardias deplacement conpolítica privada adicional, sinampliar APIs simples/mixed_group/recurring_primary. Contenido/apariciones/categorías yotrasvistas exactos; review nuevo acredita vista delpadre ygrupos. Cadenas intentadas/desconectadas/otrosdestinos/externos/identidadesausentes protegenhistoria. PrerrequisitosACK sonestructura todavía: portable/writer deberán acreditarlos conoutcomes aplicados reales.

Adoptar conserva vista yposiciones observadas sinoperación; retry reconstruye últimocomando absoluto exacto conUUIDnuevo/CASprimario conocido. Planner productivo justifica efectosdevista/posiciones únicamente yoptimismo conserva cada revisión observada. Rechaza retry si exige posición noobservada; tombstone primario sólo adopción. Record incluye vista elegida ycatálogo deposiciones conIDs/bytes/replanificación estrictos, sin fabricarACK.

16tests/213aserciones: simple/moved/implicit×day/overdue×dosdecisiones, oráculo multiefecto conCASindependientes, familiasprevias siguenstrict, incapacidadretry porpeer desconocido, tombstoneadoptable, stale/foreign/cadena/frozen/IDs/registrocorrupto. Fixture lastmove ajustado a vecino válidodeldestino; preview usa timestamp representativo ysecompara orden sin exigir fecharreal deconfirmación. Suite detectó8regresiones sólo demensaje deerror existente: sepreservó eltexto original enfamiliasvigentes, sinrelajar guardias. DoD1248pass/225skip/0fail/13976aserciones, lint1043sinavisos/tipos/Webpack/worker46/diff aprobados.

Entrada69%5h/68%7d, reservas10%/1%, secuencial. SinIO/portable/writer/caller nuevos; categoría+orden recuperable aún noofrecido enUI. Siguiente19k6c portable3 conoriginales/outcomes/prerequisitos yambosdominios, luegoTX/capacidad/replay/rollback/Mongo/Next/UI. Siníndice/protocolo/dependencia/DBusuario nuevos.


## 19k6b1 — Grupos entre categorías comparados por núcleo puro

Nuevo reviewCategoryPlacementGroups compara origen/destino con catálogos propios completos yacotados. Sólo vista delpadre puede diferir; contenido/reglas/apariciones/categorías yotrasvistas exactos. Distingue categoría efectiva local/observada delpadre ycategoría histórica deposición, sinocultar elplan porunrank deotrogrupo. Parent_all_dates declaraalcance deasignación sobre todoelplan, mientras primaryId conserva slotexacto yparentVisibleIds sushermanos delámbito. Orden porgrupo usa oráculo productivo yposiciones conocidas deambosestados; otrasfechas/otrosgrupos/intenciones desconocidas nodeben reinterpretarse.

32tests/480aserciones: primaria simple/moved/implicit×day/overdue×cuatrovariantes, sincategoría explícita, categoría histórica distintadevista, hermanos conranks independientes, otrasfechas preservadas, catálogos parciales/extra/duplicados/foreign/stale/deleted/otrasvistas/contenido rechazados. Planner remoto productivo acredita efectos sobre vista yposiciones únicamente; noes unACKni pruebaMongo. Ambas APIs antiguas siguenrechazando cross-category. Fixtures corregidas trasreferencia equivocada ainputproyectado envez decapture, narrowing TS, snapshotsindependientes yvecino deldestino; schemas productivos estrictos detectaron unaedición inicial enrankenvez decomando yse corrigió sólofixture. Non-nullassertions sustituidas porguard de fixture, sinavisos.

DoD1232pass/225skip/0fail/13763aserciones, lint1038sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada76%5h/69%7d, reservas10%/1%, secuencial. target_paths nuevos schemas/types/category-placement-review ysync review/fixture/tests; sincaller/decisiones/portable/writer/IO/índice/dependencia nuevos. Siguiente19k6b2: snapshot decadena/outcome/ACKprerequisitos ydecisiónconjunta conservadora conCASprimario yvistaindependientes; después portable/TX/Next/UI antes ofrecer nuevasopciones.


## 19k5f2 — Recuperación de orden recurrente visible en Ajustes

Lectura adaptativa conserva unúnico LocalSyncStore yrevalida cuenta/época antes/después de cada familia simple/mixed_group/recurring_primary. Acción deAjustes sólo ofrece alternativas trascomparación completa validada yelige schema/writer explícitos; UUIDs estables encada confirmación, caché sólo decuenta/época propia. Revisión señala elslotexacto, vecinos/fechas implícitas yoriginales reprogramadas; no cambia contenido/categoría/fechas ni fabricaACK. Cancelar sinwrites, dependencias externas ygrupos desconocidos conservan protección.

Once escenariosNext6 focalizados UI pasan con dosorígenesIndexedDB/sesionesBetterAuth persistidas/Mongo propios: moved/implicit×adopt/retry, cancelar/reabrir/confirmar reales, IDsgeneradosporUI diferentes delpreliminar, dos pérdidas después decommit/recarga/replay/mismoUUID→ACKreal único, catálogos/shadows/cursor exactos ydominios ajenos intactos. Scope backend mantenido, full36 disponible sinatribuir ejecucióncompleta/Google/físicos. Run5fcc72a4-1deb-4f2b-8634-34d1727228e2 exit0/cleanup propio confirmado; pestaña humana intacta. Captura /private/tmp/dalis-1843-recurring-ui-next.png. FixtureUI reutiliza harness deinteracción yaexistente con familia específica. Unaaserción SSR usaba motivo rechazado inexistente: corregida ainvalid_command antes detipos, sinrelajar contrato.

Dos SSR nuevos decandidatura/guardias yschemaUI estricto. DoD1200pass/225skip/0fail/13283aserciones, lint1033sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada91%5h/71%7d, reservas10%/1%, secuencial. Siníndice/protocolo/dependencia/DBusuario nuevos.19k5 cerrado para primaria recurrente aislada same-category/posiciones conocidas; movimientos entrecategorías/ausencia/cadenas externas siguen protegidos. Siguiente19k6b1: oráculo puro de grupos entrecategorías con asignación padre/efectos otrasfechas yCASindependientes según category-movement-recovery.md, antes decontrato/portable/TX/Next/UI posteriores.


## 19k5e — Recuperación recurrente acreditada contra Next y Mongo

Once escenarios Next6 focalizados (`recurring-placement`) aprobados con acción/defaults reales, sesiones BetterAuth persistidas y dosorígenesIndexedDB/Mongo propios. Cuatrocasos moved/implicit×adopt/retry acreditan productores reales, cadena UUID/payload/dependencias intactos, guardias actor/epoch/stale sinwrites, adopción0ops yretry conCASprimario observado. Dos pérdidas trascommit conservan pendingattempt1 sinACK, recarga yreplay delmismoUUID→ACKrealattempt2 conunrecibo/journal único. Catálogos completos/shadows/cursor exactos contraMongo, contenido/vistas/categorías/apariciones/settings intactos yreplay durable sinretroceso. Scopefull36 disponible, no ejecutado completo ni atribuido aGoogle/físicos.

Run1638b6d4-01e6-416a-af88-424ac611f3b6 exit0 yrecibo de retirada decontenedor/almacenamiento propios. Servidores/Next temporal/sesiones/particiones ytabs propios cerrados, pestaña humana preservada. Docker28.4.0/imagenpinned amd64 revalidados; recurso residual anterior5eff retirado trasidentidad exacta. Captura /private/tmp/dalis-1843-recurring-next.png. Sin cambios decódigo desdeDoD1198pass/225skip/0fail/lint1033/tipos/Webpack/worker46 previamente aprobada; compilación Next real nueva aprobada. Validación documental/consistencia/diff; commit/pushint/HEAD/cuotas. Entrada100%5h/72%7d, reset1792532603/reservas10%/1%, continuación18:43 puntualsecuencial. Siguiente19k5f2: caller/familia adaptativa yambas decisiones UI real cancelar/reabrir/confirmar/IDsUI antes depublicaractivación. No se anuncia UI recurrente activa todavía.


## 19k6a — Contrato entre categorías delimitado

Nuevo [contrato](category-movement-recovery.md) basado en comando, planner, executor y oráculo productivos. Distingue CAS primario de la vista y explicita que la categoría afecta a todo el padre, incluidas sus fechas. Primera implementación futura acotada a cadena aislada con un destino y posiciones conocidas; adopción conjunta vista/posiciones sin ops o reenvío del último comando absoluto con UUID nuevo. Portable/TX/Next/UI requieren evidencia de ambos dominios antes de ofrecer decisiones. Posiciones nuevas sin remoto, ausencias, varios destinos y dependencias externas siguen protegidos; no se elimina ni reinterpreta historia.

Planificación independiente durante el bloqueo de Docker: referencias de código y límites verificados, sin código, datos o permisos nuevos. Entrada22%5h/74%7d, reservas10%/1%, secuencial; validación documental/consistencia/diff. No acredita recuperación entre categorías implementada. Al restablecer Docker:19k5e y19k5f2 primero; después19k6b captura/decisión según este contrato y pruebas posteriores.


## 19k5f1 — Revisión visual recurrente preparada

Se reutiliza el diálogo de orden con política explícita recurring_primary. La versión compartida valida la familia, destaca el slot exacto (no el padre), conserva todos los vecinos e implícitos y diferencia hora/fecha originales de las reprogramadas. Lookup de posiciones por mapa evita búsqueda lineal por cada fila. Los caminos simples/mixed_group conservan comportamiento y guardias; todavía no hay caller recurrente activo en Ajustes.

Diez tests nuevos SSR/151 aserciones: moved/implicit × día/atrasadas × adopción/retry, familia/cuenta/contexto/busy y snapshot timed completo con horario original09:00/efectivo11:30. Corregida la identidad de slot de la fixture timed antes de validarla, sin relajar schemas. Regresión de los otros diálogos aprobada. DoD1198pass/225skip/0fail/13270aserciones, lint1033 sin avisos/tipos/Webpack/worker46/diff aprobados. Skill vercel-react-best-practices y guía Next instalada aplicadas.

QA con CSS del build a390×844: documento390 y diálogo356 sin desbordamiento horizontal; textos largos y controles caben, alternativa cambia previsualización y botones quedan accesibles al desplazar; cancelar cierra sin datos. Captura /private/tmp/dalis-recurring-placement-review-mobile.png. Fixture visual no abre bases, no representa RPC/Google. Pestaña/servidor propios cerrados y viewport restablecido. Entrada36%5h/76%7d, reservas10%/1%, secuencial.19k5e sigue pendiente del Docker no responsivo y respuesta humana; después19k5f2 conecta/probará cancelar/reabrir/confirmar/UUIDUI/Next/Mongo antes de activar. Sin índice/protocolo/dependencia/DBusuario nuevos.


## 19k5e1 — Prueba remota preparada; Docker no responde

Fixtures preparadas para cuatro casos moved/implicit × adopción/retry con productores reales, guardias y comparación exacta de ambos orígenes contra Mongo. Nuevo comando commit-recurring-move-entry devuelve la intención y conserva el comando de fixture existente. El test de schema detectó inicialmente el discriminador duplicado; se corrigió con el nombre independiente. Full36 permanece disponible; NO se ha ejecutado completo ni se da por aprobado19k5e.

Next compiló, pero dos runs se detuvieron en el bootstrap de sesión antes de los casos nuevos. Diagnóstico finito identifica HTTP403/prepare/MongoServerSelectionError. Colima informa running, pero el ping de su socket local agotó3s sin recibir datos; docker info/version también quedaron esperando y se interrumpieron sólo los diagnósticos propios. Se pidió reinicio humano o autorización específica: no se ha reiniciado la VM ni alterado recursos ajenos. El helper de bootstrap sólo expone fases/clases/código finitos, sin URI/cookies/PII; no afecta a auth de producto.

El runner registra UUID antes de crear contenedor y ahora diferencia ausencia confirmada de fallo de inspección. Tres tests/11 aserciones rechazan timeout/daemon/permisos/nombre ajeno/mensajes adicionales como prueba de limpieza. Sin respuesta Docker, la limpieza del run5effb543-bfc0-45de-bd6e-57037c00cc6d queda pendiente de verificar por nombre/label/imagen. Un probe temporal falló al crear recurso antes de registrar su UUID; no se afirma ausencia ni se autoriza borrar contenedores por patrón. Retirados procesos TCP/Next/proyectos temporales/pestañas propias; sólo pestaña humana conservada. Otros runs anteriores sí registraron retirada propia.

DoD1188pass/225skip/0fail/13119aserciones, lint1031 sin avisos/tipos/Webpack/worker46/diff aprobados. Esto acredita preparación y diagnósticos, no RPC nuevo/convergencia ni UI recurrente activa. Entrada70%5h/81%7d, reservas10%/1%, secuencial.19k5e pendiente: con Docker operativo verificar residuos propios y repetir scope recurring-placement; después19k5f interacción/UI antes de publicar caller. Mientras se espera, sólo trabajo puro independiente de19k6 según contrato, sin relajar las guardias.


## 19k5d — Persistencia de primaria recurrente probada

La familia recurring_primary tiene captura y writer propios sobre el núcleo compartido de placements; APIs simple y mixed_group conservan sus schemas/guardias. Una TX9stores relee contexto y prerrequisitos acreditados, valida familia/IDs/capacidad/counter/tail, guarda posiciones/supersesión/0–1reemplazo/recibo atómicos y resuelve sólo tras commit. Replay primero no retrocede trabajo posterior. LocalSyncStore y feature comprueban actor/protocolo6/cuenta/época antes-después y cierran siempre; aviso sólo tras commit aplicado, no replay/fallo. Sin nuevo caller UI.

Once comprobaciones IndexedDB nativas aprobadas con primaria reprogramada y otras once con primaria implícita: readonly/caminos previos protegidos, contexto stale/foreign, remotos desconocidos, otra intención, rollback tardío total, IDs/overflow, backup/recarga/replay/tail, adopción sin ops/tail, capacidad posterior, epoch duranteopen y confirmaciones simultáneas→uncommit/unreplay/unaviso. Dos fallos iniciales de fixture detectaron marcador de inyección antiguo y selector que no llegaba al constructor; corregidos sin cambios de guardias del producto. Todas las particiones/control/pestañas/servidores propios retirados. Capturas /private/tmp/dalis-recurring-placement-native-{moved,implicit}.png. El ajuste final del selector fue sólo tipado explícito.

DoD1184pass/225skip/0fail/13098aserciones, lint1029 sin avisos/tipos/Webpack/worker46/diff aprobados. Tras tsc del selector se repitieron lint/tipos/build sin repetir la suite ya aprobada. Entrada83%5h/83%7d, reservas10%/1%, secuencial; sin Mongo/Next nuevos ni índices/protocolo/dependencias/DBusuario. Siguiente19k5e: prueba Next compilado con productores reales recurrentes, conflicto/CAS/recarga/respuesta perdida/ACK único y convergencia porgrupo en dos orígenes/Mongo propios, antes de UI activa.


## 19k5c — Evidencia portable de primaria recurrente

Backup3 admite recurring_primary y selecciona su validador específico antes de reutilizar las guardias comunes de placements. Conserva originales superseded exactos, outcome congelado, prerrequisitos acreditados por operaciones/outcomes aplicados coincidentes y reemplazo exacto de la misma aparición. IDs globales y propiedad exclusiva de cada intención siguen protegidos. Quitar la marca no convierte la decisión en recuperación simple válida; pending intentado y ediciones posteriores son portables, sin inventar ACK.

Catorce tests nuevos/72 aserciones: moved/implicit × día/atrasadas × adopción/retry, roundtrip y formato2 rechazado, truncaciones/corrupción de historia/reemplazo/familia, intento sinrespuesta, proyección multiefecto por planners productivos puros, ACK previo con evidencia real y exclusividad/IDs. La fixture de prerrequisito se corrigió para usar la clave y el efecto de la aparición, sin relajar schemas. DoD1184pass/225skip/0fail/13098aserciones, lint1027 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada86%5h/84%7d, reservas10%/1%, secuencial. Sin IO ni caller nuevo; la prueba de resultado aplicada es un modelo puro, no un recibo Mongo nuevo. Siguiente19k5d: TX local/captura/feature y prueba IndexedDB nativa de replay/capacidad/rollback/cuenta, antes de Next/UI.


## 19k5b — Decisión de primaria recurrente preparada

Familia explícita recurring_primary en request/record, separada de mixed_group y del camino simple. Permite adoptar posiciones conocidas sin operaciones o reconstruir únicamente el último movimiento exacto con UUID nuevo y CAS actual del slot. Reutiliza el planner remoto y conserva revisiones observadas en optimismo; sólo un recibo remoto podrá avanzarlas. Validación reconstruye toda la decisión y protege identidad, snapshot obsoleto, originales y efectos. Vecinos obsoletos o tombstone de posición mantienen sólo adopción. Sin portable, persistencia ni caller nuevo todavía.

Siete tests nuevos/76 aserciones: moved/implicit × día/atrasadas, familia estricta, CAS independiente, supersesión exacta, adopción sin ACK, tombstone/vecino obsoleto, actor, IDs y evidencia alterada. Fixtures corregidas para incluir request/snapshot y modificar un vecino en el caso stale, manteniendo exacta la comparación primaria. Se ajustó una aserción de UUID nullable tras tsc; sin relajar schemas. DoD1170pass/225skip/0fail/13026aserciones, lint1025 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada93%5h/85%7d, reservas10%/1%, secuencial. Siguiente19k5c: familia portable3 con originales/outcomes/ACK previos/reemplazo exactos; después writer local y pruebas reales antes de UI. Sin IO, índices, protocolo o dependencias nuevos.


## 19k5a — Contrato de primaria recurrente preparado

Revisión/snapshot nuevos y puros para cadena aislada de movimientos de la misma aparición, día civil y categoría. Kernel compartido distingue políticas simple/mixed_simple/recurring_primary sin ampliar las APIs actuales. La clave primaria usa el slot completo; padre, aparición, vista y posiciones mantienen revisiones independientes. Slot implícito se deriva sólo para comparar, sin crear excepción durable. Variantes timed conservan timestamp original aunque se reprograme. Ausencia/cancelación/cambio de regla/asignación incierta, otras fechas/intenciones/slots y catálogos incompletos siguen protegidos. Cadenas, outcome congelado y prerrequisitos exactos preservados; sin ACK ni writes.

Quince tests nuevos/136aserciones más regresión simple: cuatro variantes moved/implicit, overdueas-of/sentinel, timed, actor/grafo/incertidumbre, fuera de fecha, contexto y compactación multiefecto con CAS porposición. DoD1163pass/225skip/0fail/12950aserciones, lint1021sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada100%5h/86%7d, reservas10%/1%; renovación real/reset1792514544 registrados enworkflow. Guía Next instalada leída. Sin protocolo/índice/dependencia/IO/caller nuevo.19k5b siguiente: decisión explícita marcada recurring_primary, adopción o replay del último movimiento con CASactual; portable/TX/Next/UI después antes de activarse. Cross-category queda19k6 por necesitar asignación padre yefectos sobreotrasfechas.


## 19k4b2 — Recuperación de orden mixto disponible en Ajustes

La revisión de orden captura primero el caso simple y, si no es válido, relee el contrato mixto completo en el mismo LocalSyncStore, con cuenta/época antes/después. Cada opción se ofrece sólo tras validar la familia; la UI genera IDs estables y elige explícitamente writer simple o marcado mixed_group. Mantiene isolation por cuenta/época/raíz, mounted y caché propia. Writers simples siguen strict. El diálogo completo incluye todos los vecinos simples y fechas recurrentes, posición implícita, títulos de excepciones y fechas originales/movidas; no cambia contenido ni asignaciones.

Once escenarios Next6 focalizados UI con dos orígenes IndexedDB, BetterAuth persistido y Mongo propios aprobados. Ambas elecciones realizadas desde PersonalIncidentCard real: abrir/cancelar/reabrir/confirmar, selección de alternativa y UUID generado por UI distinto del preliminar. Cancelar preserva todos los stores; adopción no envía operación. Retry conserva último comando con nuevo UUID/CAS; pérdida tras commit→pendingattempt1, recarga/replay→ACKrealattempt2 único, posiciones/shadows/cursor exactos contra Mongo y todos los dominios ajenos intactos. No extrapolar a full35/Google/físicos. Captura /private/tmp/dalis-mixed-placement-ui-proof.png. Primera compilación detectó alias duplicado en host de fixture; corregido antes de segundo run aprobado, ambos recursos propios retirados. Sólo pestaña humana conservada.

DoD1148pass/225skip/0fail/12814aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados. SSR añade candidatura mixta sin decisiones antes de captura. Entrada26%5h/88%7d, reservas10%/1%, secuencial. Rutas feature local-placement-resolution, PlacementIncidentActions, schema/test y templates de fixture mixtos; sin protocolo/índice/dependencias/DBusuario nuevos.

Cierra19k4 para primaria simple en grupo de misma categoría con vecinos recurrentes y posiciones comprometidas conocidas. No cierra primaria recurrente, cambios entre categorías, posiciones locales sin remoto acreditado ni otras intenciones externas. Siguiente19k5: delimitar contrato puro de esos movimientos con asignación de padre/efectos de otras fechas y catálogo completo, antes de permitir decisiones/persistencia/portable/Next/UI. Después ausencia/copia, accesibilidad ypreparación final según dependencias. Preservar historia yguardias; sin migradores ni descarte automático.


## 19k4b1 — Recuperación mixta probada contra Next/Mongo

Nuevo scope explícito mixed-placement mantiene full35 disponible. Once escenarios focalizados Next6 compilado/defaults/sesiones BetterAuth persistidas/dos orígenes IndexedDB/Mongo propios aprobados: adopción y retry con productores reales, tres planes simples y serie con dos fechas visibles en el mismo día (una movida y otra implícita). Antes del conflicto todas las posiciones de vecinos se confirman y sus revisiones independientes quedan conocidas; el slot implícito no se convierte en excepción. Guardias actor/epoch/snapshot obsoleto conservan todos los stores.

Se conserva la cadena original exacta de dos movimientos; elección local no crea historia remota ni cambia contenido/vistas/categorías/apariciones/settings/shadows. Adopción0ops o retry del último comando con UUIDnuevo/CAS2. Pérdida tras commit→pendingattempt1sinlease; recarga conserva UUID ypayload, replay→ACKrealattempt2 con un solo recibo y entrada de journal. Ambos orígenes terminan con catálogo completo de posiciones, shadows ycursor exactamente iguales a Mongo; replay durable no retrocede el estado. Convergencia por grupo revisado, no global de históricos protegidos. No UI interactiva/Google/físicos nuevos. Captura /private/tmp/dalis-mixed-placement-next-proof.png.

El primer build de fixture detectó unión legacy de apariciones: se filtró explícitamente kind=plan antes del catálogo recurrente, sin cambiar producto. Segundo run aprobado; recursos propios de ambos runs retirados, pestaña cerrada. Contrato nuevo valida marcador mixed_group, scope ycomandos estrictos, rechaza destinoextra/familia simple/selectorUI aún no implementado. DoD1147pass/225skip/0fail/12810aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada33%5h/90%7d, reservas10%/1%, secuencial. Sin protocolo/índice/dependencia/DBusuario/caller mixto activo nuevos.

Siguiente19k4b2: lectura adaptativa propia y familia explícita, conexión a Ajustes con UUID estable/caché cuenta/época, ambas elecciones UI reales con cancelar/reabrir/confirmar y repetir pérdida/recarga/replay antes de publicar caller. Los scopes backend permanecen disponibles sin atribuirles interacción. Primaria recurrente, cross-category y posiciones locales no comprometidas conservan protección.


## 19k4a — Representación completa de grupos mixtos preparada

Diálogo de orden añade variante explícita mixed_group sin cambiar el caller simple. Revalida opciones mediante el planner mixto y muestra todos los vecinos visibles con el mismo orden productivo, incluidas fechas implícitas sin posición y excepciones con título propio. Fecha original reprogramada y efectiva diferenciadas; una posición tombstone vuelve al orden automático sin tachar ni eliminar el plan. Explica alcance recurrente, conservación de contenido/estado/historial, envío pendiente y última observación conocida. No hay caller mixto activo todavía.

Siete tests nuevos SSR/88 aserciones y regresión simple aprobados: día/atrasadas, ambas elecciones, orden exacto con miembro implícito, título de excepción, tombstone sin borrado de plan, cuenta/contexto/familia/ocupado e inmutabilidad. Dos fixtures corregidas tras detectar referencia primaria incorrecta y parámetro default ambiguo; producto mantuvo schemas estrictos. SSR no prueba interacción ni Mongo. DoD1146pass/225skip/0fail/12800aserciones, lint1019 sin avisos/tipos/Webpack/worker46/diff aprobados.

Entrada38%5h/90%7d, reservas10%/1%, secuencial. Rutas placement-incident-resolution-dialog y nuevos mixed-placement-resolution-version/ui.test. Sin índice/protocolo/dependencias/DBusuario nuevos. Siguiente19k4b1: prueba remota focalizada con productores reales y posiciones de vecinos comprometidas antes de activar; después19k4b2 conexión/UI con cancelar/reabrir/confirmar y UUID propios. Separación por presupuesto, sin retirar guardias simples.


## 19k3 — Persistencia y frontera local de orden mixto

Captura y writer mixtos separados reutilizan el ejecutor de placements con política privada y resultados tipados; las APIs simples mantienen schemas/guardias anteriores. Una TX9stores relee catálogo completo y evidencia, valida familia/replay/identidades/contador ycapacidad posterior incluyendo tail faltante más recibo. Guarda posiciones elegidas, supersesión exacta,0/1reemplazo pendiente, tail/counter ydecisión atómicamente. Replay primero no reescribe trabajo posterior ni añade espacio. Posiciones locales sin remoto conocido y otras intenciones continúan protegidas.

LocalSyncStore/feature añaden métodos mixtos con actor/protocolo6/cuenta/época antes-después de abrir/operar y cierre siempre. Aviso local sólo tras commit aplicado, nunca fallo/replay. No promete cancelación atómica a través de la DB de control. Aún no hay caller UI mixto.

Once checks IndexedDB reales aprobados: lectura sin writes/camino simple protegido, actor/staleparent/slot/vista, remoto ausente/posición local desconocida, intención externa, rollback tardío de posiciones derivadas/cola/tail/counter/recibo, IDs/overflow, retry+backup/recarga/replay sin retroceso, adopción sin ops/tail, últimos espacios para recibo ytail, epoch cambiada duranteopen y dos confirmaciones simultáneas→uncommit/unreplay/unaviso. Partición ycontrol propios eliminados; pestaña/servidor retirados. No Mongo/Next/Google nuevos.

DoD1139pass/225opt-in skip/0fail/12712aserciones, lint1017 sin avisos/tipos/Webpack/worker46/diff aprobados. Se ajustó sólo el texto de la fixture después de la ejecución nativa. Entrada50%5h/92%7d, reservas10%/1%, secuencial. Rutas placement-resolution{,-capture}, sync-store, feature local-mixed-placement-resolution, test/browser/mixed-placement-resolution yselector. Sin protocolo/índice/dependencia/DBusuario nuevos.

Siguiente19k4: integración conjunta de revisión/adopción/retry mixtos en Ajustes más representación completa de vecinos simples y slots con títulos/fechas conocidas y orden implícito. Lectura adaptativa validada en la misma cuenta, marcador mixto explícito al escribir; no aceptar mezclas en el writer simple. Probar productores reales con posiciones de vecinos ya comprometidas, conflictoCAS, cancelación UI/reabrir/confirmar, UUID UI, pérdida/replay/recarga/ACK único y proyecciones de ambos orígenes contra Mongo antes de publicar caller. Declarar posiciones locales desconocidas/cross-category/primaria recurrente pendientes. La UI no debe listar sólo posiciones materializadas ni confundir borrar posición con borrar plan.

## 19k2 — Evidencia portable de orden mixto

Backup3 admite la familia marcada reviewKind=mixed_group. El validador distingue esa marca antes de validar la decisión y reutiliza la evidencia común de placements: originales exactos superseded, outcome congelado, prerrequisitos con operaciones/outcomes aplicados coincidentes y reemplazo exacto por usuario/entidad/payload/fecha/secuencia/dependencias. Superseded no es ACK. La propiedad exclusiva de originales y los IDs globales se conservan; quitar la marca no convierte el caso mixto en una decisión simple válida.

Ocho tests nuevos/42 aserciones: roundtrip adopción/retry con contexto recurrente/posiciones derivadas, formato2 rechazado, pending intentado y ediciones posteriores, truncación/corrupción/familia, operaciones originales y correspondencia de reemplazo, ACK previo real en la historia portable frente a DTO sinoutcome, IDs/supersesión y resultado multiefecto producido por planners productivos puros. Tras esa proyección el backup conserva evidencia y posiciones confirmadas exactas, incluidos vecinos nuevos. Esto no acredita nuevos recibos Mongo/Next ni IO. Se corrigieron entityKey y envoltorio de snapshots en la fixture manteniendo schemas estrictos.

DoD1139pass/225opt-in skip/0fail/12712aserciones, lint1015 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada59%5h/94%7d, reservas10%/1%, secuencial. Rutas local-recurring-backup, backup/local-backup/placement-resolution-evidence y fixture/test mixed-placement-resolution. Sin writer/caller/UI/índice/protocolo/dependencia/DBusuario nuevos; el resolver simple vigente conserva sus límites.

Siguiente19k3: captura/writer mixtos separados del camino simple, mismaTX9stores y replay primero, contador/capacidad/IDs globales/tail/historia/rollback y puente de cuenta/época/notificación sólo tras commit. Prueba IndexedDB nativa antes de Next/UI19k4. Conservar posiciones locales desconocidas, cambios de asignación/contenido y primarias recurrentes protegidos; no activar retirando una guardia.

## 19k1b — Decisión preparatoria de orden mixto

Captura y validación mixtas reutilizan las guardias de cadena, outcome congelado, primaria, catálogos canónicos y prerrequisitos del resolver de placements. Una política privada separa ambos caminos: las funciones vigentes siguen rechazando grupos recurrentes; sólo las nuevas funciones preparatorias admiten vecinos visibles recurrentes tras reviewPlacementGroup. La primaria sigue siendo un plan común simple y la categoría no cambia.

La decisión explícita reviewKind=mixed_group conserva la forma existente y clave placement-resolution. Adoptar conserva posiciones remotas conocidas sin operación; retry_latest_move reutiliza el planner existente con nuevo UUID/CAS de primaria, sólo si los vecinos siguen válidos y todos los efectos son posiciones de ese grupo. Cada efecto optimista conserva la revisión observada (0 para una nueva posición derivada), sin ACK local. IDs/bytes/actor/stale y evidencia íntegra protegidos; snapshot/record se reconstruyen al validar. No se registra aún en backup ni se persiste por un writer/caller.

Seis tests nuevos/47 aserciones más regresiones simples y de contexto: día/atrasadas, adopción, último comando exacto/CAS2, varias fechas y vecinos implícitos, guardias/IDs/efectos alterados, tombstone/vecinos obsoletos sólo adopción y protección externa. La fixture stale se corrigió para cambiar un vecino manteniendo la primaria exacta; sin relajar validación. DoD1131pass/225opt-in skip/0fail/12670aserciones, lint1013 sin avisos/tipos/Webpack/worker46/diff aprobados.

Entrada64%5h/94%7d, reservas10%/1%, secuencial. Rutas placement-resolution/placement-decision, schemas/types/mixed-placement-resolution, mixed-placement-decision/fixture/tests y fixture de grupo con actor. Sin IO/protocolo/índice/dependencia/UI/DBusuario nuevos. Catálogos con posiciones locales no observadas, otro contenido/asignación pendiente, primaria recurrente o cross-category siguen bloqueados. Siguiente19k2: evidencia portable3 de la familia marcada, usando historia/outcomes/ACK reales y reemplazo exacto, sin mezclar el validador simple; después TX/cuenta/Next/UI. No activar retirando una guardia aisladamente.

## 19k1a — Contexto puro de orden en grupos mixtos

Contrato preparatorio de revisión para un plan principal simple con vecinos simples/recurrentes en la misma categoría. Valida catálogos acotados propios y comprometidos, igualdad de contenido/apariciones/categorías/vistas entre local y observado, asignaciones conocidas de cada padre visible y pertenencia civil explícita. Materializa sólo para comparar: conserva identidad de slots originales, fecha efectiva, orden local/observado y claves de posiciones cambiadas. Un slot implícito no se convierte en excepción o posición durable.

Cambios de posición sólo dentro del grupo visible revisado, sin retroceder revisiones ni cambiar creación/identidad. Ausencias, catálogos duplicados/ajenos/parciales, padres o asignaciones incorrectos, posiciones de vecinos cancelados/externos y contexto divergente bloquean. Primaria recurrente y cambio de categoría requieren contratos distintos. Los catálogos son estado conocido, no prueba de completitud actual del servidor ni autorización para escribir.

Once tests nuevos/80 aserciones: cuatro variantes, slot movido e implícito del mismo padre, día/atrasadas con día de referencia y sentinel permanente, inmutabilidad, guardia activa intacta, cuentas/contexto/límites/cancelaciones y compactación real por planner remoto puro. La compactación incluye vecino implícito con revisión1 y vecinos existentes desde su revisión independiente, sin efecto de vista. Se corrigieron dirección de vecinos y posiciones densas en la fixture, sin relajar el planner.

DoD1125pass/225opt-in skip/0fail/12623aserciones, lint1008 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada72%5h/96%7d, reservas10%/1%, secuencial. Rutas schemas/types/placement-group-review y lib/sync/placement-group-review{,-fixture,-test}; sin IO/caller/backup/writer/UI/índice/protocolo/dependencia nuevos. El resolver activo todavía rechaza grupos recurrentes. Siguiente19k1b: snapshot y decisión preparatorios para grupos mixtos con evidencia exacta de cadena/prerrequisitos y efectos independientes, conservando el camino simple vigente; después portátil/TX/Next/UI antes de activar. Cross-category requiere además asignación y efectos de serie; no se deduce de este contrato.

## 19j5b — Recuperación multi-slot disponible en Ajustes

La raíz propia de un conflicto con intenciones de varias fechas muestra «Revisar fechas relacionadas». La candidatura sólo abre revisión; no autoriza ni ofrece decisiones desde el DTO. La feature captura comparación completa en IndexedDB y verifica cuenta/época. El componente queda aislado por cuenta, época y raíz; conserva IDs al reintentar, evita estados después de desmontarse e invalida sólo caché de su cuenta/época. La resolución de una sola aparición conserva su comportamiento.

El diálogo publicado permite adoptar todos los remotos conocidos o enviar todos los borradores completos. Cancelar no escribe y reabrir relee la comparación. Las versiones por fecha se pliegan, muestran contenido/horario/estado/checklist y advierten del alcance conjunto, historial conservado, confirmación pendiente y estados intermedios. Guías Next instalada y vercel-react-best-practices aplicadas; sin nuevas rutas de navegación, índices, protocolos o dependencias.

Once escenarios Next6 focalizados con dos sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios aprobados: ambas elecciones por UI real con cancelar/reabrir/confirmar, IDs generados por UI, pérdida tras commit, recarga, replay durable con mismo UUID/ACK único y proyecciones/shadows/cursor exactos por serie. No full34 ni Google interactivo o nuevos físicos. La primera ejecución detectó un error de fixture: el replay debía usar el UUID del registro generado por UI y no el preliminar del controlador. Corregido sin relajar producto; segunda ejecución aprobada y ambos recursos propios limpios.

QA con CSS del build y390px: texto largo/pasos caben, documento390/dialog358/scroll356 sin desbordamiento horizontal, secciones plegables y confirmación/cancelación accesibles. Captura /private/tmp/dalis-multi-date-review-mobile.png. Vista previa sin bases; servidor/pestaña propios cerrados y viewport restablecido. Sólo pestaña humana conservada.

DoD1114pass/225opt-in skip/0fail/12543aserciones, lint1003 sin avisos/tipos/Webpack/worker46/diff aprobados tras limpiar Next temporal. Rutas lib/sync/plan-occurrence-cohort-review, componentes de acciones/SSR, schemas de fixture y templates Next, test/browser/appearance-cohort-review y selector visual. Entrada94%5h/99%7d, reservas10%/1%, secuencial. Sin DBusuario/producción. Recuperación multi-slot queda cerrada para las cadenas aisladas contempladas; otras familias/dependencias/ausencias conservan protección. Siguiente19k1: delimitar contratos de recuperación de orden entre categorías y grupos mixtos con catálogos completos, efectos y revisiones independientes; luego persistencia/portable/Next/UI por dependencias. No ampliar automáticamente supersesión a operaciones externas. Después ausencia/copia y accesibilidad/preparación final según el plan.

## 19j5a — Revisión visual conjunta de varias apariciones

Disponibilidad pura revalida comparación completa y actor antes de presentar opciones. Reintento exige todos los borradores y cadenas válidas, revisiones seguras y capacidad de cola; casos con borrador ausente o remoto cancelado/eliminado/agotado conservan adopción. Esto sólo presenta opciones: el writer sigue releyendo todos los datos en su transacción.

Diálogo preparado reutiliza ConfirmationDialog y PlanOccurrenceIncidentVersion. Cada fecha muestra estado elegido en resumen plegable y ambas versiones completas al expandir; primera fecha abierta, diseño móvil compacto. Indica cantidad de fechas e intenciones, sustitución de toda la cadena, conservación de historial, remoto conocido, envío pendiente y estados intermedios. No promete que cambie una única fecha. Todavía no está conectado a Ajustes.

Nueve pruebas puras/SSR y57 aserciones: cuenta/snapshot alterados sin acciones, fechas/versiones/consecuencias, contenido/horario/checklist/cancelación, adopción protegida y controles ocupados. Se ajustó una expectativa al texto existente «En proceso» y se retiró una fixture sin uso; sin cambiar copias ajenas. DoD1112pass/225opt-in skip/0fail/12529aserciones, lint1000 sin avisos/tipos/Webpack/worker46/diff aprobados. SSR no acredita interacción. Sin IO, índices, protocolo, dependencias ni DB del usuario.

Entrada99%5h/100%7d, reservas10%/1%, secuencial. Rutas lib/sync/plan-occurrence-cohort-resolution.ts y features/sync/components/plan-occurrence-cohort-resolution-{dialog,ui.test}. Guía Next instalada y skill vercel-react-best-practices aplicadas. Siguiente19j5b: conectar revisión a la raíz de conflicto multi-slot con cuenta/época/mounted/IDs estables/cache propios y pruebas UI reales en Next/Mongo/dos orígenes antes de publicar el caller.

## 19j4a — Prueba integrada focalizada de varias apariciones

Next6 compilado con defaults productivos, dos sesiones BetterAuth persistidas, dos orígenes IndexedDB y Mongo propios aprueba once escenarios focalizados: diez de frontera autenticada/matriz5↔6/readiness/replay y uno nuevo con adopción y reintento de tres intenciones intercaladas entre dos fechas. Usa productores reales, snapshot capturado y feature de cuenta/época. El scope explícito appearance-cohort conserva full34 disponible; no se ha ejecutado full34 ni Google interactivo o nuevos dispositivos físicos.

La adopción conserva remotos conocidos sin crear recibos remotos. El reintento conserva UUID/payload/dependencias de todas las originales y añade la cadena completa con CAS independiente por slot. Pérdida tras primer commit remoto deja mismo UUID pending/attempt1, cero ACK local; recarga conserva backup/cola/decisión, replay recibe ACK real attempt2 y los demás attempt1. Número de recibos y journal aumenta exactamente una vez por reemplazo; ambos orígenes terminan con padre/excepciones/shadows/cursor exactos respecto al journal por serie. Superseded nunca es ACK; no se afirma convergencia global de históricos bloqueados.

Se corrigieron dos supuestos de la prueba, sin relajar el producto: la cola exportada se ordena por secuencia antes de elegir raíz (su orden físico es UUID); updatedAt/completedAt son autoritativos del ejecutor remoto. Se verifica igualdad de todos los demás campos elegidos, presencia de completado coherente y registro remoto completo exacto contra journal/shadows al terminar. Tercera ejecución aprobada; las dos anteriores limpiaron también sus recursos propios. TypeScript detectó el literal choice ensanchado en la fixture del test de schema y se estrechó desde el registro validado.

DoD1103pass/225opt-in skip/0fail/12472aserciones, lint998 sin avisos/tipos/Webpack/worker46/diff aprobados. Docker28.4.0/imagen Mongo pinned amd64 revalidados; tres contenedores/almacenamientos/proyectos Next propios retirados, particiones/sesiones cerradas, sólo pestaña humana conservada. Sin DBusuario/producción/índice/dependencia nuevos. Rutas schema/testnext-sync-test y templates local/device/controller/appearance-cohort-recovery. Entrada28%5h/6%7d, reservas10%/1%, secuencial; cuota durante cierre16%5h/4%7d. No interfaz nueva activada.

Siguiente19j5a: disponibilidad pura por cuenta y comparación revalidada más diálogo conjunto preparado, reutilizando ConfirmationDialog y PlanOccurrenceIncidentVersion por fecha. Mostrar contenido, fecha, progreso, checklist y cancelación elegidos, cantidad total de intenciones/fechas, consecuencias de sustituir toda la cohorte, remoto conocido, envío pendiente y estado intermedio. No prometer que sólo cambia una fecha. Actor/snapshot inválidos sin elecciones; remoto cancelado/eliminado o borrador ausente sólo adopción. Pruebas SSR/puras antes de caller.

Después19j5b: conectar revisión desde PlanOccurrenceIncidentActions sólo para raíz de conflicto multi-slot; leer comparación completa antes de mostrar elecciones, IDs estables y cuenta/época/mounted/cache protegidos. Scope UI propio con ambas elecciones cancelar/reabrir/confirmar, UUID generados por UI, pérdida/recarga/ACK único y convergencia por serie en Next/Mongo/dos orígenes antes de publicar el caller. No inferir interacción de SSR ni reutilizar la promesa del diálogo de una sola aparición. Sigue recuperación residual de grupos mixtos/ausencia y accesibilidad/preparación final según plan.

## 19j3c — Frontera local de cuenta y notificación

LocalSyncStore y featurecliente exponen comparación/resolución preparatorias multi-slot. Protocolo6, identidad yépoca se verifican antes deabrir, después deabrir ydespués deoperar; la conexión secierrasiempre. No ofrece aún nuevas elecciones UI. La cuenta decontrol está enotraDB: estas guardias son antes/después yno prometen cancelación atómica durante unaTX.

Sólo unresultado aplicado tras oncomplete emite elaviso local deoutbox; replay/error noemiten. Quince checksIndexedDB nativos aprobados (treceanteriores más dosdelafrontera): actor/epochincorrectos yepochcambiada duranteopen noescriben niavisan, lectura readonly, fallo tardío sinaviso, commitdurable observado desdeelsuscriptor yunúnicoeventolocal, replay sinwrites/evento. BroadcastChannelpuedeentregar además elaviso deotrorreceptor: laprueba distingue esa entrega delúnicoeventolocal, sinintroducir deduplicación ajena. Partición ycontrol propios eliminados, pestaña yservidor propios cerrados.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint998 sinavisos/tipos/Webpack/worker46/diff aprobados. Tras ajustar sólo lafixture deavisos serepitieron pruebanativa/lint/tipos; bundleproductivo sin cambiosadicionales. Entrada32%5h/6%7d, reservas10%/1%, secuencial. Rutas sync-store.ts, features/sync/local-plan-occurrence-cohort-resolution.ts, browserproof yplan. Sin nuevotransporte, protocolo, índice, UI odependencia. Siguiente19j4: productoresreales yRPCNext6/Mongo/dosparticiones para conflictos multi-slot, respuesta perdida/recarga/replay/ACKúnico yproyeccionesexactas; después19j5UI revisable.

## 19j3b — Persistencia atómica de recuperación multi-slot

Captura readonly y writer preparatorio en una TX9stores. Relee padre actual, excepciones de la serie, cola completa ordenada porsecuencia, sombras youtcomes; la decisión requiere comparación exacta, prerrequisitos conoutcomes yclausura ya probados. Unslot conIDdelparent pero seriesIdcorrupto no se oculta como borrador ausente. La escritura conserva todas las originales, supersede sólo lacohorte y guarda0/Nreemplazos, todas las excepciones elegidas, contador yrecibo enel mismo commit IndexedDB.

Antes de escribir valida IDs contra cola/metadata, capacidad posterior ycounter seguro/adelantado respecto al historial. Replay consulta primero elrecibo, revalida decisión yno toca ediciones posteriores ni exige espacio nuevo. Sin ACK local, limpieza dehistoria, reparación decontadores ni callerUI. No cambia padre, preferencias, orden, outcomes o sombras. Infraestructura departición propia: guardias de cuenta/época ynotificaciones se conectarán en siguiente corte defeature.

Trece checksIndexedDB nativos aprobados: lectura coherente, actor/staleparent/local/remoto, posterior intentada/dependiente externo, outcome/remotoausente, ACK transitivo sinoutcome, slotcorrupto, rollback tardío enrecibo detodas las escrituras, colisiones, counterausente/atrasado/overflow, reintento+backup+replay tras recarga/edición, adopción sinops/counter, metadata alúltimoespacio ycola9998 quenoadmite4ops perosíadopción. Se usaron sólo partición/origenbrowser-testpropios; partición eliminada, pestaña cerrada yservidor detenido. No DBusuario, Mongo, Next oGoogle nuevos.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint997 sin avisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron nulabilidad delstatus yformato enfixture antes delcierre. Entrada39%5h/8%7d, reservas10%/1%, secuencial. Rutas nuevas lib/local-db/plan-occurrence-cohort-{capture,resolution}, test/browser yselectorprivado, fixtures admitenactorpropio. Sin protocolo/índice/dependencia nuevo. Siguiente19j3c: conexión aLocalSyncStore/feature conguardias cuenta/época ynotificaciones sólo tras commit, pruebas nativas delciclo; después19j4 productoresreales/Next/Mongo/dosparticiones antes de19j5UI.

## 19j3a — Evidencia portable de recuperación conjunta

Backup3 admite la decisión multi-slot y valida contra historia durable: originales superseded exactos, outcomes citados y prerrequisitos aplicados reales, cadena nueva completa con payload/usuario/fecha/secuencias/dependencias exactos. Un snapshot de ACK no sustituye el outcome. Las decisiones no pueden compartir originales ni reutilizar identidades; la guardia de propiedad exclusiva también protege las familias anteriores.

Diez tests nuevos/42 aserciones: adopción/reintento, roundtrip, pending intentado sin ACK, ediciones posteriores permitidas, evidencia truncada/alterada, prerrequisitos y decisiones duplicadas. Cada resultado aplicado producido por los planners remotos/locales existentes conserva un backup válido durante toda la cadena de cuatro comandos, con tres originales superseded. Esto prueba codec y proyección pura; no añade IO ni acredita nuevos recibos Mongo/Next. Se corrigió el estrechamiento de tipo de la fixture de aparición común tras detectar tsc el acceso a content en una unión.

DoD1102pass/225opt-in skip/0fail/12466aserciones, lint994 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada50%5h/9%7d, reservas10%/1%, secuencial. Rutas schemas/local-recurring-backup.ts y lib/backup, sin writer/caller/UI/protocolo/índice nuevos. Siguiente19j3b: captura y escritura atómicas en IndexedDB con relectura completa, IDs/capacidad/counter/replay y rollback nativos; después prueba Mongo/Next y UI según dependencias.

## 19j2 — Decisión conjunta de varias apariciones

Planner puro permite adoptar todos los remotos revisados, sin reemplazos, o reconstruir todos los borradores como una sola cadena nueva de comandos existentes. Cada slot calcula su CAS desde su revisión remota, no desde el índice global; la siguiente fecha depende de la última operación de la anterior. Las originales y sus dependencias permanecen exactas en la evidencia; la supersesión sólo se declara, sin escrituras ni ACK.

IDs nuevos y distintos contra toda la cola capturada, comparación/cuenta exactas, post-capacidad de outbox y revisiones seguras protegidos. Si falta un borrador o el remoto está cancelado/eliminado, sólo puede planificarse adopción conjunta. El registro tiene límite de bytes y se revalida reconstruyendo operaciones, proyecciones y dependencias. La capacidad completa de metadata y sus colisiones quedan obligatoriamente para la futura transacción.

Ocho tests nuevos/42 aserciones: adopción íntegra, CAS9/10 y2/3, cadena global, planner remoto puro acepta cada comando y reproduce cada excepción exacta, stale/actor/IDs/cantidad, borradores/remotos protegidos, overflow por slot, registros alterados y cola llena de10000 entradas con historia intacta. DoD1092pass/225opt-in skip/0fail/12424aserciones; lint991 sin avisos/tipos/Webpack/worker46/diff aprobados. No nuevas pruebas Mongo/Next ni inferencia de ACK/convergencia real.

Entrada56%5h/10%7d, reservas10%/1%, secuencial. Rutas nuevas schemas/types/lib/sync de plan-occurrence-cohort-resolution y sus tests; sin caller, writer o codec de backup todavía. Siguiente19j3: evidencia portable3 y contrato de captura transaccional antes de persistir decisiones, conservando originales/outcomes/prerrequisitos y reemplazos exactos; después IndexedDB/Mongo/Next/UI según dependencias y margen.

## 19j1b — Comparación exacta de varias apariciones

Contrato puro y revalidable de la cohorte completa: conserva el catálogo de origen, el orden global, las dependencias entre fechas y el padre actual/congelado. Cada slot retiene su borrador y la versión remota conocida más reciente con revisión independiente. Sombras contradictorias o anteriores a la evidencia durable, cuenta/padre incorrectos, catálogos duplicados y ausencia remota desconocida siguen protegidos. Los prerrequisitos transitivos requieren outcomes aplicados exactos; un DTO de ACK no basta. Cancelación/tombstone remotos se conservan sin revivir nada.

Rutas: schemas/types y lib/sync/plan-occurrence-cohort-comparison, fixture propia plan-occurrence-cohort-fixture y pruebas. Snapshot con límite conservador de 5 MiB y catálogos de 10000 registros; serialización se reconstruye y compara con su fuente. No IO, writer, supersesión, elección visible ni nueva rama de backup. La captura futura debe releer todos los datos en una única transacción: el DTO no autoriza escrituras.

Diez tests nuevos y 40 aserciones: múltiples slots intercalados, revisiones 9/2 independientes, historia inmutable, remoto ausente/local ausente, evidencia posterior y replay antiguo, contradicción/stale, actor/padre/intención, duplicados/corrupción, tombstone/cancelación, ACK transitivos de dos slots y límites estrictos. Se corrigió la fixture para separar comandos locales de CAS remoto, añadir la secuencia del outcome aplicado y asociar cada snapshot al slot correcto; no se relajó validación del producto. DoD:1084 pass/225 opt-in skip/0 fail/12382 aserciones; lint987 sin avisos, tipos, Webpack/worker46 y diff aprobados. Sin Mongo/Next/Google nuevos ni DB del usuario.

Entrada66%5h/12%7d, reservas10%/1%, secuencial, int desdee50fcd3. Siguiente19j2: decisión pura de adoptar los remotos de todos los slots o reconstruir los borradores en una sola cadena nueva, con CAS independiente por aparición, IDs/capacidad/evidencia protegidos. Después TX/evidencia/Next-Mongo/UI según dependencias, sin ofrecer elecciones prematuras.

## 16c14 — Secciones plegables y días completos

Objetivo y rutas: Atrasadas/Hoy/Próximas plegables con recuentos, en plan-agenda/plan-list y la nueva cabecera extraída. La lista conserva detalles abiertos al plegarse porque mantiene su contenido montado. Los recuentos incompletos usan «+» y una explicación accesible; no anuncian cero mientras se está cargando. «Ver más» y «Ampliar 30 días» pasan a controles secundarios de 32 px sin borde.

Hoy y el día seleccionado del calendario cargan todas las páginas locales automáticamente. El lector preparado valida e indexa el catálogo una vez por snapshot, reutilizándolo entre páginas, y detecta cursores que no avanzan. Los intervalos de Atrasadas/Próximas y el recuento mensual mantienen su paginación. No se cambia la selección civil ni se alteran apariciones, UUID, progreso, datos o sincronización. Sin consultas Mongo nuevas ni necesidad de índices.

Aceptación: siete pruebas nuevas de lectura diaria y cabecera, además de las nueve regresiones del lector paginado, pasan. Incluyen 61 series en un día, excepciones/cancelaciones/traslados/solapamientos, intervalos paginados y recuentos/aria. Interacción real en fixture propia a 390 px: Hoy muestra 62 filas y ningún botón de carga; plegar/reabrir con Enter conserva los detalles abiertos. Las tres secciones se pliegan y «Ver más» de Próximas pasa de 2 a 3 filas. La lista diaria compartida con calendario muestra 60 filas, cero botones de carga, 4 al cambiar de día y 60 al volver. Ancho de documento/viewport 390 px, sin desbordamiento. Captura: /private/tmp/dalis-agenda-sections-mobile.png. Bases/particiones/pestaña/servidor de prueba limpiados y viewport restablecido; ningún dispositivo o dato del usuario modificado.

Validación final: 1074 tests aprobados, 225 opt-in omitidos, cero fallos y 12342 aserciones; lint de 982 archivos sin avisos, tipos, Webpack y worker de 46 recursos aprobados. Guía Next instalada y skill vercel-react-best-practices aplicadas. Entrada: 81% de 5h y 14% semanal; reservas 10%/1%. Entrega en int con commit/push, HEAD remoto y consulta de ambas cuotas; sin promoción a main ni continuación de otros bloques.

## 19p1 — Índices automáticos independientes del despliegue

Objetivo y autorización: aplicar todos los índices registrados al arrancar, con el mismo comportamiento al promover `int` a `main`. La instrucción humana del 19 de octubre de 2026 sustituye las restricciones anteriores de preview/int. Dependencias: registro central y singleton existentes; sin índices nuevos, migraciones ni wipe.

Rutas: `src/lib/db/{client,ensure-indexes,AGENTS.md}`, `src/config/env`, pruebas de bootstrap/readiness/operadores, `scripts/ensure-indexes.ts`, su comando en `package.json` y documentación de provisión. Aceptación: 15 definiciones exactas en cualquier rama y entorno; creación idempotente; datos intactos y fallo sin reparación ante duplicados o definiciones incompatibles; reintento posterior posible. Los operadores mantienen su guardia de destino y reflejan que el bootstrap completo precede al diagnóstico por ámbito. El comando público carga los módulos de servidor y no imprime errores Mongo con datos.

Validación: 1067 tests aprobados, 225 opt-in omitidos, cero fallos y 12317 aserciones. Mongo propio: 10 tests de arranque/comando/matriz, 3 del operador personal, 3 de placements, 2 de provisión y 140 de repositorios/transacciones: 158 tests y 2277 aserciones, sin fallos. La matriz usa NODE_ENV real de producción/desarrollo/test y combinaciones de Vercel/rama; cubre arranque desde cero, repetición, actualización con documentos existentes, duplicados, definiciones incompatibles y destinos rechazados sin conexión. Lint de 978 archivos, tipos, Webpack y worker de 46 recursos aprobados. El primer build sin configuración falló por GOOGLE_CLIENT_ID ausente; repetido con valores ficticios y una URI loopback no operativa, sin credenciales del usuario, pasó.

Publicación cerrada: el usuario autorizó expresamente la clave SSH personal existente y se publicó 383f2c3 en origin/int, con HEAD remoto verificado y sin cambiar la configuración global. El primer rechazo de credenciales quedó resuelto; main se conservó en d4d33a9 durante esa entrega. No se ha conectado ni modificado directamente ninguna base del usuario, ni desplegado producción. Al promover y desplegar este cambio, el primer acceso a MongoDB de cada proceso aplica el registro completo. No transforma datos antiguos ni resuelve sus conflictos automáticamente. Entrada: 98% de 5h y 17% semanal; reservas 10%/1%. La petición está cerrada; el próximo corte general sigue siendo 19j1b, sin abrirlo en esta iteración.

## 19z11 — Cierre de la continuación puntual del 19 de octubre, 03:25

Objetivo documental: dejar estado publicado, aceptación y próximo corte verificables. Rutas: plan/master.md, iterations.md, workflow.md e iteration-log.md. Dependencias: diez cortes de código completos y publicados:414bb36,2fcccc5,06aeed5,30f9b1f,e9a6f9a,dff14ef,79638f4,6cfb95e,b872999,e8b502e. Último código e8b502e04d016382ff26ddbc2c779156215c371d, HEAD deorigin/int exacto; sin WIP ni cambios del checkout humano. Este cierre sólo requiere coherencia, referencias y diff; no repetir DoD sin nuevo código.

Entregado en Ajustes: recuperación explícita de eliminación aislada de categoría y de cadena de orden de planes simples dentro de la misma categoría. Adopción o reintento conservan toda historia y efectos independientes; UI compacta muestra consecuencias, permite cancelar y no fabrica ACK. Protección nueva del contexto recurrente evita reintentar un orden con catálogo incompleto; grupos con series, cambio de categoría, referencias ausentes y otras cadenas externas siguen fuera de ese resolver. Clasificación pura de varias apariciones preparada, sin caller ni nuevas elecciones.

Validación final:1067pass/223opt-in skip/0fail/12320aserciones, lint978 sin avisos, tipos, Webpack y worker46. Cuatro ejecuciones Next6 focalizadas de once escenarios aprobaron (borrado backend/UI y orden backend/UI); no equivale a ejecutar full33. Dos orígenes IndexedDB, sesiones BetterAuth persistidas y Mongo propios acreditan pérdida tras commit, recarga, UUID intactos, ACK real único y catálogos/cursor exactos por ámbito. No Google interactivo ni nueva aceptación física; checklist humana del17oct permanece cerrada. Nueve checks IndexedDB de orden aprobados y repetidos después del ajuste de contexto. QA visual390px sin overflow; capturas /private/tmp/dalis-tag-delete-dialog-mobile.png y /private/tmp/dalis-placement-dialog-mobile.png.

Cuota después del último código:15%5h/18%7d. Reserva10%/1%. El siguiente contrato de captura multi-slot requiere más de los cinco puntos libres incluyendo pruebas/reparación/publicación/cierre: no se abre. Reset5h observado1792391120,19oct08:25:20 Europe/Madrid; se registra, no se programa otra ejecución. La automatización continuar-el-plan-a-las-21-19 queda PAUSED por automation_update; verificados prompt, regla puntual, mismo chat y failed_runs_only conservados. Esta autorización era puntual: no hay cadena adicional. OpenAI Docs consultada para el cierre; configuración modificada sólo con herramienta de app, sin editar TOML.

Recursos propios de Mongo, proyectos Next temporales, particiones, pestañas y servidores retirados; viewport restablecido, pestaña humana de preproducción intacta. Sin producción/DB del usuario, nuevos índices, secretos, hosting, permisos, dependencias, créditos ni reinicios. Cumpleaños aparcado, Gmail fuera y arrastre aceptado.

Siguiente19j1b: contrato de comparación de cohorte con padre y cada slot local/remoto/outcome exactos, revisiones independientes y clausura completa. Clasificación estructural/DTO ACK no acreditan ejecución ni autorizan supersesión. Si falta remoto conocido de un slot, conservar protección: ausencia de sombra no se convierte en excepción remota por defecto. Después decisión/portable/TX/Next-Mongo/UI según dependencias; quedan también recuperación de movimientos entre categorías/grupos mixtos, ausencia/copia, accesibilidad y preparación final de producción.


## 19j1a — Clasificación estructural de varias apariciones

Núcleo puro identifica cohorte completa item:seriesId conraíz conflict ycola posterior pending0 sinlease,≥2slots actuales válidos deparent propio vivo/recurrente/confirmado. Conserva orden global, comandos, UUID ydependencias cruzadas entre slots intercalados; agruparlos no los vuelve entidades aisladas. Otras operaciones delparent/dependientes externos/colas parciales oinciertas bloquean; clausura ACK transitiva sóloDTO, sin acreditarrecibos remotos.

Seis tests/30aserciones: slots intercalados/historiainmutable, casoúnico conservaresolveranterior, firstroot/partial/duplicate/disconnected/attempts/foreign, parent externo/dependientes, ACKtransitivo, parent/slot inválidos ylímite/strict. Unaaserción esperaba unerror demasiado específico: elprerequisito quepasabaa pending esdelmismoparent yse rechaza antes como primerconflicto incorrecto; se conserva rechazo sinrelajar guardia. DoD1067pass/223skip/0fail/12320aserciones, lint978 sinavisos/tipos/Webpack/worker46/diff aprobados.

Entrada21%5h/19%7d, reservas10%/1%, secuencial. Ningún caller/elección/TX/backup nuevo: clasificación noautoriza superseder ni recuperarslots. Siguiente19j1b: contrato de comparación exacta deparent/cada slot/local/remoto/outcome yclausura; sólo después decisión/portable/TX/Mongo/Next/UI. Este lote cierra sin abrir ese bloque mayor ni nueva programación.


## 19i7 — Elecciones de orden limitadas por evidencia durable

Disponibilidad ypreview deorden comprueban ahora elrecibo completo con elmismo constructor puro queelwriter. Un snapshot por debajode5MiB no basta si al añadir placements/intención/recibo se supera eltope: enesecaso no se ofrecen elecciones imposibles deguardar. IDs conocidos se usan sólo como placeholders demedida, nuncasepersisten nienvían; la decisión real mantiene IDs nuevos/distintos ysnapshot exacto. Esto no afirma espacio físico disponible: capacidad postwrite, ACKs yguardias siguenacreditándose enTX.

Regresión desnapshot justodebajo dellímite peroambos registrosfuera aprobada, sinmutar entrada;16tests focalizados/125aserciones. DoD1061pass/223skip/0fail/12290aserciones, lint975 sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada24%5h/20%7d, reservas10%/1%, secuencial. SinIO/caller/wire/índice/DBusuario. Constructor real conservaforma ypayload ya probados; nueva disponibilidad pura/SSR cubierta sin repetir runnerNext completo innecesariamente. Siguiente19j: clasificador preparatorio de múltiples slots/cadenas recurrentes, sólo si cabe entrega completa y cierre; no nuevas elecciones antes deevidencia/ejecutor.


## 19i6 — Recuperación de orden simple visible

Ajustes conecta revisión de cadena task.move simple con cuenta/época/montaje/cache propios yUUID estables. Diálogo compacto muestra grupo/categoría/color/fecha civil, orden actual yresultado, títulos conocidos, primaria yposición eliminada sin afirmar que se borró elplan. Adopción noreenvía; retry sóloúltimomovimiento, con vecinos revisados yposible reranking delgrupo, pending hastaACK. No cambia fechas/contenido/asignaciones. Mezclas conseries, cambiosdegrupo, ausencia yotros pendientes siguenprotegidos. Cancelar sinwrites yerror conservaintención.

SeisSSR/guardias/versiones yschemas estrictos,19focalizados/123aserciones. OnceNext6 UI focalizados pasan: cancelar/reabrir/confirmar ambas decisiones conUUID generados porUI; cuatrovariantes/day/overdue,3pérdidastrascommit/recarga/mismoUUID→ACKreal único, catálogos/shadows/cursor exactos en dosorígenesIndexedDB/Mongo propios. Full33 disponible sinatribuirle ejecución completa; noGoogle/físicos nuevos. Fixture CSSfinal a390px muestra diálogo358px yscroll390px, sinoverflow; captura /private/tmp/dalis-placement-dialog-mobile.png. UI Next sinCSS prueba interacción, no QAvisual.

DoD1060pass/223skip/0fail/12283aserciones, lint975 sinavisos/tipos/Webpack/worker46/diff aprobados. Recursospropios retirados/viewportrestablecido, mainhumano preservado. Entrada38%5h/22%7d, reservas10%/1%, secuencial. Siníndice/protocolo/DBusuario nuevos. Siguiente segúnmargen: guardias residuales de capacidad/presentación, después cohortes recurrentes/múltiples slots oausencia/copy yaccesibilidad/preparación final; no ampliar elecciones sincontrato/ejecutor/evidencia probados.


## 19i5 — Orden simple probado con productor real y RPC6

Once escenarios Next6 focalizados (`placement`) pasan con acción/defaults reales, sesiones BetterAuth persistidas y dos orígenes IndexedDB/Mongo propios. moveLocalPlan productivo crea la cadena exacta conflict+hijo; cuatro variantes/day/overdue con adopción y3retry conservan UUID/payload/dependencias, producen pérdida después decommit/recarga/mismoUUIDpendingattempt1→ACKrealattempt2 único. Catálogos completos deplacements, sombras ycursor exactos frente aMongo, otrasfamilias intactas yreplay durable sinretroceso. Scopevalidado, full33 disponible sinatribuir ejecucióncompleta; noGoogle/físicos nuevos.

La primera ejecución reveló vecinos recurrentes engrupo sincategoría delbaseline. Se incorpora contexto deapariciones local/observado íntegro yreutiliza planner recurrente6 activo; guardia explícita bloquea grupo revisado quecontenga serie viva. Fixture usa categoría propia yconserva serie ajena enotrogrupo. Regresión pura depeer recurrente y31tests focalizados/177aserciones aprobados; nuevechecks IndexedDB repetidos pasan trasajuste decaptura. No relajar vecinos ni reinterpretar cola paraaprobar. Cambios sólo preparatorios; no existían recibosdeorden deusuario que migrar. Se corrigió además estrechamiento literal delcomando deltest yun reemplazo deformato quehabía cambiado unaaserción, conservando suvalor correcto.

DoD1054pass/223skip/0fail/12236aserciones, lint970 sinavisos/tipos/Webpack/worker46/diff aprobados. Recursospropios limpios; capturas /private/tmp/dalis-placement-recovery-next.png y /private/tmp/dalis-placement-recovery-context.png. Siníndice/protocolo/DBusuario/UI. Entrada56%5h/25%7d, reservas10%/1%, secuencial; siguiente19i6 diálogo/caller guardado yambas elecciones conUI real antes depublicar, segúnmargen trascuotas.


## 19i4 — Orden simple con decisión local atómica

CapturaTX9stores reconstruye todos los catálogos locales/sombras, cola y resultado congelado, y acredita prerrequisitos ACK con outcomes aplicados antes de comparar o escribir. Writer guarda placements elegidos, cadena original superseded exacta,0/1reemplazo pending, counter/tail/recibo en una única TX. Guardias de partición/cuenta/época/snapshot, IDs globales/capacidad/counter/tail antes de writes; replay previo valida recibo y no retrocede ediciones posteriores ni notifica. No altera contenido/vistas/categorías/apariciones/settings/outcomes/sombras.

Nueve checks IndexedDB propios aprobados: readonly/reapertura, actor/stale/sombra ausente, rollback tardío de todos los stores, otro pending protegido, IDs/overflow/tail/capacidad contando tail ausente, ACKDTOvsoutcome aplicado, retry sinACK/replay posterior y adopción sin nuevo contador. Backup3 válido en resultados; evidencia /private/tmp/dalis-placement-recovery-native.png. Fixture corregida para liberar primero las secuencias antes de insertar ACKancestro, y no asumir una sola entrega de aviso cuando existen evento local y BroadcastChannel. No se modificó producto para ocultar esos fallos del test. Partición/pestaña/servidor propios retirados.

DoD1052pass/223skip/0fail/12227aserciones, lint970 sin avisos/tipos/Webpack/worker46/diff aprobados; lint/tipos repetidos tras ajuste final de aserción nativa, build y suite productiva sin cambio semántico adicional. Entrada65%5h/26%7d, reservas10%/1%, secuencial. Sin nuevo índice/protocolo/DBusuario/UI. Siguiente19i5: productores task.move reales y Next6/Mongo/dos particiones con CAS, pérdida/replay/ACK único y catálogo exacto, luego19i6 UI revisada.


## 19i3 — Orden de planes con evidencia portable

Backup3 admite decisiones de orden con rama expected.incident propia: valida catálogo/decisión replanificados, originales superseded exactos, outcome frozen intacto y clausura de ACKs contra resultados aplicados y operaciones reales conservados. Reemplazo0/1 mantiene usuario/entidad/fecha/secuencia posterior/comando/depsvacías exactos; IDs globales centrales rechazan colisiones. No exige retroceder proyección actual ni convierte superseded en ACK.

Ocho tests/35aserciones: roundtrip ambas elecciones, pendientes intentados/lateredits, ausencia oalteración deoriginal/outcome/reemplazo/recibo/catálogos/revisiones, prerequisitosDTO sin outcome yIDs. DoD1052pass/223skip/0fail/12227aserciones, lint966 sin avisos/tipos/Webpack/worker46/diff aprobados. Entrada69%5h/27%7d, reservas10%/1%, secuencial. Sin IO/writer/UI nuevos, DBusuario, índice o protocolo. Siguiente19i4 capturaTX9stores ywriter atómico con capacidad/counter/tail/IDs/replay/rollback nativo antes deNext/UI.


## 19i2 — Decisión de orden preparada sin caller

Contrato puro permite adoptar catálogo observado de placements o reaplicar sólo el último task.move exacto de la cadena revisada. Nuevo UUID y CAS de primaria observado; planner remoto común calcula reranking multirregistro/revisiones independientes, mientras proyección optimista conserva revisión conocida o0 si crea un rank nuevo. Rechaza efectos en vistas/otro grupo, primarias eliminadas, vecinos obsoletos y desbordamientos; en esos casos sólo adopción del catálogo conocido. No envía todo orden local ni inventa ACK. Recibo5MiB replanificable conserva toda cadena y decisión explícita, identidades/snapshot/cuenta exactos.

Nueve tests nuevos/73aserciones;22focalizados/141aserciones. DoD1044pass/223skip/0fail/12192aserciones, lint964 sin avisos/tipos/Webpack/worker46/diff aprobados. Fixture reranking corregida para elegir vecinos según su orden real por UUID cuando posiciones empatan; una aserción TS estrechada sin cambiar producto. Cuatro variantes/day/overdue, adopción/retry/tombstone/revisión agotada/vecinos/reranking/stale/IDs/registro corrupto aprobados. Entrada73%5h/27%7d, reservas10%/1%, secuencial. Sin IO, backup/writer/UI, índice o protocolo nuevos. Siguiente19i3 evidencia portable; después TX9stores con ACKs acreditados, pruebas remotas y UI antes de ofrecer elecciones.


## 19i1 — Captura pura de orden de planes simples

Contrato de catálogo local/observado canónico para cadena task.move de misma primaria, scope, fecha civil y categoría. Cuatro variantes propias simples con contenido/categorías/vistas confirmados exactos; placement local optimista puede diferir sólo dentro del grupo revisado. Revisión positiva y conjunto de identidades conocido en ambos lados evita inferir ausencia o borrar rangos locales sin evidencia. Remoto tombstone primario puede conservarse como observación, nunca restauración automática de vecinos. Otro pending, cambio de categoría, serie, slot, catálogo parcial/ajeno/duplicado y revisión desconocida siguen protegidos.

Raíz conflict/attempted sinlease e hijos pending0 conectados conservan UUID/payload/dependencias. Captura clausura ACK transitiva; su DTO no sustituye futura acreditación con outcomes aplicados. Outcome frozen, local/remote primarios y frescura remota exactos; observación posterior no se llama ancestro. Scope overdue usa fecha civil declarada y sentinel durable; sin reloj remoto.

Trece tests/68aserciones y DoD1035pass/223skip/0fail/12119aserciones, lint962 sin avisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron estrechamiento de tipo de efectos y una entrada deliberadamente inválida del test para que el rechazo ocurriera dentro del capture; no relajación de guardias. Sin IO, backup, writer, elecciones o UI nuevos; sin DBusuario/índices/protocolo. Entrada79%5h/28%7d, reservas10%/1%, secuencial. Siguiente19i2 decisión pura de adoptar catálogo de placements conocido o reaplicar último movimiento con CAS primario fresco y multiefectos; luego evidencia/TX/prueba remota/UI según dependencias.


## 19h4 — Recuperación de borrado visible y probada

Ajustes conecta revisión guardada de tag.delete aislado: captura completa antes de mostrar elecciones, cuenta/época/montaje, UUID estables y cache de la propia cuenta. Diálogo reutiliza ConfirmationDialog y catálogo con color/tombstones; explica restauración y agrupación derivada sin modificar planes/vistas, o nueva solicitud pendiente sin ACK local. Remoto ya eliminado sólo permite adoptar. Preview puro comparte planner; cancelar no escribe y error conserva intención.

Seis pruebas SSR/preview/guardias y scopes estrictos; dieciocho tests focalizados/113aserciones. Once escenarios Next6 UI focalizados pasan con cancelar/reabrir/confirmar ambas elecciones, UUID generados por UI, respuesta perdida tras commit, recarga, ACK remoto único y catálogos/shadows/cursor exactos en dos particiones/Mongo propios. Full32 sigue disponible; no atribuirlo al scope11 ni afirmar Google/nuevos físicos. Fixture visual con CSS real a390px: diálogo358px, scroll390px sin overflowhorizontal; captura /private/tmp/dalis-tag-delete-dialog-mobile.png. UI Next sinCSS sólo acredita interacción. Se corrigió fixture tombstone para que comparación remota coincidiera exactamente con su catálogo; no se relajó guardia.

DoD1022pass/223skip/0fail/12051aserciones, lint957 sinavisos/tipos/Webpack/worker46/diff aprobados. Corregidas líneas vacías finales de docs19h3; comprobación final limpia. Recursos propios retirados yviewport restablecido; main humano preservado. Sin índice/protocolo/DBusuario/producción nuevos. Entrada90%5h/30%7d, reservas10%/1%; siguiente recuperación residual deplacements/cohortes recurrentes/ausencia según dependencias, después accesibilidad/preparación final.


## 19h3 — Recuperación de borrado probada con RPC real

Once escenarios Next6 focalizados (`scope=tag-delete`) aprobados con acción/defaults reales, sesiones BetterAuth persistidas y dos orígenes IndexedDB/Mongo propios. Productores tag.save/tag.delete generan conflicto real; se prueban adopción remota viva, retry_delete y adopción de tombstone posterior. Guardias actor/epoch/stale no escriben; UUID/payload/dependencias/original superseded/outcomes permanecen exactos. Plan asignado y vista siguen intactos; sólo cambia visibilidad derivada de la categoría. Respuesta perdida después de commit, recarga pending/attempt1 y replay del mismo UUID producen ACK real/attempt2 y un único recibo/journal. Catálogos completos, sombras y cursor coinciden con Mongo; replay durable no retrocede estado confirmado.

DoD:1016pass/223skip/0fail/12004aserciones, lint953 sin avisos, tipos, Webpack, worker46 y diff aprobados. Scope estricto y comandos nuevos validados; full32 disponible, sin atribuirle ejecución completa. Se corrigió antes de compilar una importación de snapshot que sólo se exporta en el schema de catálogo. Recursos propios limpios; evidencia `/private/tmp/dalis-tag-delete-next.png`. Sin Google interactivo ni nuevos dispositivos físicos, DB del usuario, protocolo, índice o callerUI. Siguiente19h4: diálogo/caller de borrado, cancelar/reabrir/confirmar ambas elecciones con UI real antes de publicar.


## 19z10 — Cierre del lote22:24 y continuación19oct03:25

Doce cortes de código publicados enint conHEADremoto verificado ycuotas tras cadaentrega:7b37727/b24e25d/a8a380b/2ba5139/9761353/c9911e0/a4212bc/646af39/fb8cabd/7d9bbc4/9bad58b/da4ac47. Home queda Atrasadas/Hoy/Próximas yrecuperación deorden aislado visible enAjustes. Recuperacióndeborrado tienecontrato/captura/TX/backup cerrados con10checksIndexedDB; todavía sinpruebaremota/callerUI.1015pass/223skip/0fail/11998aserciones, lint953sinavisos/tipos/Webpack/worker46. Next6 deorden11backend+11UI focalizados aprobados; full31 disponible,noejecucióncompleta atribuida.

Última lectura después decódigo20%5h/32%7d; reservas10%/1%. PruebaNext/Mongo comparable19g3consumió14puntos incluyendoreparaciones: no abrir19h3con10puntos libres sobre reserva máspublicación/cierre. Repo sinWIP, mainhumano limpio ypreservado; todos recursos propiosMongo/browser/servidores retirados, viewportrestaurado ytabhumanodepreproducción conservado. SinDBusuario/producción/secretos/permisos/créditos/reinicios.

Elusuario intercaló separación dehome ypide continuar alas03:25 alacercarnos alcierre. Nueva instrucción sustituye pausa delheartbeat actual sóloparaesta próximacontinuación. Automation_update reutiliza continuar-el-plan-a-las-21-19, renombra Continuar el plan a las03:25 yguarda ACTIVE/unaejecución/mismochat/failed_runs_only; camposyprompt verificados desdeconfiguración guardada. NoTOMLmanual, duplicado onuevacadena. Próxima fecha19oct2026,03:25Europe/Madrid; resetpublicado1792373057=03:24:17Madrid deja43segundos: verificar renovación/margen reales aldespertar. Pausaralterminar esa revisión salvootraordenhumana. OpenAI Docs/documentaciónoficial detareasprogramadas consultada paraelcierre; laherramientadeapp gestionalaacción.

Este cierre sólo documenta estado/objetivo/próximocorte/programación; validarreferencias/coherencia/diff, mismoConventionalCommitpushint/HEAD/cuotas. No repetirDoDdecódigo sin nuevasmodificaciones. Cumpleañosaparcado, Gmailfuera, arrastreaceptado ychecklistfísica17octcerrada siguenintactos.

## 19h2b — Borrado aislado con transacción local preparada

Captura9stores reconstruye catálogo/cola/clausura yacredita prerrequisitosACK conoutcomes aplicados antesdecomparar oescribir. Writer guarda catálogo elegido, original superseded exacto,0/1reemplazo pending, contador/tail/recibo atómicos; noACKlocal ni cambios deasignaciones/otrasfamilias/sombras/outcomes. Adopción puede restaurar explícitamente laprimaria revisada omantener tombstone remoto. Replay previo conserva edits posteriores ynonotifica. Actor/partición/snapshot/IDs/capacidad/counter/tail yfeaturecuenta/época guardados; faltantetail cuenta capacidad ycorrupciónnorepara.

Diez checksIndexedDB propios aprobados: readonly/reapertura, actor/stale, rollbacktardío, asignaciones/movimientos protegidos, referenciasincompletas/ajenas, IDs/overflow/capacidad, ACKDTOvsoutcome, retry/nextdependiente/replay, tail, adopciónremotaviva ytombstone. Backup3 valida resultados; captura /private/tmp/dalis-tag-delete-native.png. Partición/pestaña/servidor propios retirados.1015pass/223skip/0fail/11998aserciones, lint953sinavisos/tipos/Webpack/worker46/diff aprobados. Formatter necesitó segundapass sobreunacadena de lafixture, corregido antesdeDoDfinal.

Entrada26%5h/33%7d, reservas10%/1%, secuencial. SinNext/Mongo/UI nuevos, producción/DBusuario/índices/wire. Siguiente19h3: prueba Next6 compilado conproductores reales de borrado, dosparticiones/Mongo, adopción/retry/tombstone, guardias ypérdida/recarga/replay/ACKúnico; sólodespués19h4 UI. Decidir trascuota si cabe entrega completa o cerrar yreactivar03:25 autorizado.

## 19h2a — Borrado aislado con evidencia portable

Backup3 admite decisión deaceptar catálogo oreintentartag.delete conramaexpected.incident propia. Valida originalsuperseded exacto, outcomefrozen intacto, prerrequisitosACK conoutcomes realmente aplicados, reemplazo0/1 exacto ysecuencia posterior/depsvacías, más IDsglobales centrales. No obliga a retroceder proyección actual: lateredits ypendingintentado se conservan sinfabricarACK.

Siete tests nuevos/25aserciones de roundtrip/adopción/retry/truncado/alteración/prerrequisitos/IDs/catálogos;1015pass/223skip/0fail/11998aserciones, lint949sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió unaaserción que asumía queprimariaera primerUUIDordenado, ahora localiza porID exacto. Sinwriter/UI/Mongo/browser/DBusuario/wire/índice nuevos. Entrada29%5h/34%7d, reservas10%/1%, secuencial. Siguiente19h2b TXguardada/IndexedDB; Next/UI sólo después deaceptación ymargen real.

## 19h1b — Decisión de borrado preparada sin caller

Contrato puro admite aceptar catálogo observado oreintentar exactamente tag.delete conUUID nuevo/CAS primario observado. Adopción acepta tombstone remoto orestaura explícitamente sólolacategoría revisada; retry requiereprimariaviva yrevisión noagotada, sininferirACK. Catálogooptimista conserva campos/revisionesobservadas depeers; sólo cambia tombstone/timestamp deprimaria, mientras elexecutorremoto calcularásurevisión confirmada. No modificaasignaciones: suvisibilidadderivada cambiará segúnsucategoría ydeberá explicarseenUI. Recibo5MiB replanificableexacto, snapshot/actor/IDs nuevos/historia protegidos. Ausenciadesconocida siguefuera.

Seis tests nuevos/37aserciones,13focalizados/61aserciones;1008pass/223skip/0fail/11973aserciones, lint947sinavisos/tipos/Webpack/worker46/diff aprobados. Elajuste final deltexto deerror de19h1a necesitaba salto delformatter; se corrige yrepiteDoD completoenestecorte. Sin writer/backup/UI nuevos niMongo/browser/DBusuario. Entrada33%5h/34%7d, reservas10%/1%, secuencial. Siguiente19h2a evidencia portable; después TX/Next/UI segúnmargen. No ofrecer elecciones hastaejecutor/evidencia/pruebasreales.

## 19h1a — Captura de borrado aislado preparada

Evidencia pura deunaúnica raíz tag.delete propia enconflicto: exige tombstone local, catálogo observado completo conprimaria conocida viva oeliminada, outcome exacto yclausura deACKs capturada. Ausencia remota, otroscambiospersonales/dependientes, envíosinciertos, datosajenos/duplicados/parciales ycapacidad siguenprotegidos. Sólo laprimaria revisada puede restaurarse desde untombstonelocal mediante unaelección explícita posterior; ningúnpeer se resucita. No choices/writer/backup/UI nuevos todavía.

Guardias comunes de catálogo/frescura/cola se extraen a tag-catalog-resolution paraevitarduplicación. Wrappers deorden conservan estructura/formato yrestricciónaprimariaviva. Siete tests nuevos/24aserciones,29tests focalizados/129aserciones ydocechecksIndexedDB deorden repetidos aprobados; captura /private/tmp/dalis-tag-order-shared-guards.png.1002pass/223skip/0fail/11936aserciones, lint943sinavisos/tipos/Webpack/worker46/diff aprobados. Partición/pestaña/servidor propios limpios; sinNext/Mongo nuevos/DBusuario/protocolo/índices.

Entrada38%5h/35%7d, reservas10%/1%, secuencial. Siguiente19h1b decisión explícita deaceptar catálogo observado oreintentar borrado conCASnuevo, despuésportable/TX/pruebaremota/UI. Mantener distinción entre capturaACKDTO ysuacreditación real; elcatálogo observado noes unestadoactual garantizado delservidor.

## 19g4b — Revisión de orden visible en Ajustes

PersonalIncidentCard ofrece Revisar orden para conflicto propio tag.move. Botón sólo inicia lectura completa guardada; opciones noautorizan porDTO. Captura/confirmación cuentan conactor/época/mounted/cache propios, UUIDs estables enref ycancelación sinwrites. UIcompacta compara catálogos, mantiene guardias devecinos/otrascohortes ynomuestra retryinviable. Historial íntegro ysinACKlocal.

Once Next6 focalizados tag-order-ui aprobados: ambas elecciones conCancelar/Reabrir/Confirmar reales yUUID generados porUI, guardias deactor/epoch/stale, dospérdidas trascommit/recarga/replay/ACKreal único, reranking depeers yvecinoborrado. Proyección/shadows/cursor decatálogos coinciden conMongo endosorígenes/sesionesBetterAuth propios. Full31 sigue disponible, no se atribuye su ejecución completa nifísicos/Google nuevos. PrimeraSSR detectó nombre de comando mal reemplazado enelcandidate, corregido antesNext.

La fixtureNext valida interacción pero no cargaCSS deproducto. Se añade modo visual explícito tag-order-review alservidor propio existente; revisión conCSS real delbuild enescritorio ymóvil390px, screenshot /private/tmp/dalis-tag-order-dialog-{desktop,mobile}.png. No abre DB ni guarda datos enese modo. La pruebaNext tiene captura /private/tmp/dalis-tag-order-ui-next.png. Docker28.4.0/imagenpinnedamd64 revalidados; runnerexit0, recursosMongo/particiones/control/sesiones/pestañas/servidores propios limpios yviewportrestaurado.

995pass/223skip/0fail/11912aserciones, lint937sinavisos/tipos/Webpack/worker46/diff aprobados. Entrada49%5h/37%7d, reservas10%/1%, secuencial. Sin nuevoíndice/wire/DBusuario/producción. Recuperación deuna primaria tag.move cerrada; otrasprimarias/dependencias quedan protegidas. Siguen borradodecategorías/placements, cohortes recurrentes/ausencia, accesibilidad/preparación final.03:25 sigueprogramación humana pendiente paraelcierre deesta ventana.

## 19g4a — Diálogo de orden preparado sin caller

Preview puro reutiliza planificación exacta sincrearIDs durables niACK. Diálogo compara catálogo local ycatálogo elegido completo, ordenado visualmente ydesplazable; nombres/colores/revisiones/tombstones yprimaria resaltada. Opciones explícitas usan remoto conocido oreaplican sólo últimomovimiento, conadvertencia sobrecamposremotos, historia conservada, sustitución deintenciones ypending sinconfirmación. Guardiasactor/retryinviable/busy/cancelar; ConfirmationDialog reutilizado ycomponentes extraídos, sin estado derivado por effect.

CuatroSSR/40aserciones ypreviewpuro/4aserciones nuevos,14tests focalizados/103aserciones;994pass/223skip/0fail/11905aserciones, lint935sinavisos/tipos/Webpack/worker46/diff aprobados. Sin interacción browser nueva ocalleractivo. Nextbackend11focalizados sigue cerrado en19g3; siguiente19g4b lectura/confirmación guardadas yambas elecciones reales concancelar/reabrir/confirmar enNext antesdepublicarAjustes. Entrada52%5h/37%7d, reservas10%/1%, secuencial.

## 19g3 — Orden recuperado con Next/Mongo y dos particiones

Once escenarios focalizados tag-order deNext6 compilado/defaults/sesionesBetterAuth persistidas ydosorígenes IndexedDB/Mongo propios aprobados. Productores reales generan raízconflict yúltimo movimiento conectado conUUID/payload/dependencias exactos. Dosadopciones (incluyevecinoborrado/tombstone) ydosretry (incluyerernumeración conrevisiones independientes depeers) conservan originales/outcomes/otrasfamilias. Cuenta/época/stale rechazan sinmutaciones. Dos respuestas perdidas trascommit, recargaantesACK yreplay delmismoUUID→ACKattempt2 producen unúnicorecibo/journal porreemplazo. Catálogo completo de categorías/proyección/sombras/cursor coincide exactamente conMongo enambasparticiones; no equivale aconvergencia global deotrasfamilias niGoogle/físicos nuevos.

Full31 queda disponible; estaejecución acredita sólo11focalizados. La primera compilación detectó directiveuseclient detrás deimport enlasplantillas nuevas; corregido antesdeRPC. Primerrecorrido detectó queelschema de fixture no admitía tag.move/delete; ampliado explícitamente conregresión. UnDoD durantefixturetemporal incluyó suárbol bajo build/ yfalló tipos; repetido secuencialmente trascleanup, junto alestrechamiento de literals deltest. ÚltimaDoD989pass/223skip/0fail/11861aserciones, lint932sinavisos/tipos/Webpack/worker46/diff aprobados. Docker28.4.0/pinneddigestamd64 revalidados; runnerexit0, contenedor/proxy/temporales/sesiones/particiones/pestañas propios limpios. Captura /private/tmp/dalis-tag-order-next.png.

Entrada66%5h/39%7d, reservas10%/1%, secuencial. Sin nuevo protocolo/índice/DBusuario oUIactiva. Siguiente19g4 preview/diálogo guardado yambas eleccionesUIreales antesdepublicar caller enAjustes.

## 19g2b — Recuperación de orden atómica y portable preparada

Captura9stores reconstruye catálogo local, todas las sombras propias, cola yclausura ACK enmismaTX; outcomes realmente aplicados acreditan prerrequisitos antes deofrecer comparación o escribir. Writer guarda catálogo observado/adoptado o preview multiefecto, originales supersedidos íntegros,0/1reemplazo pending, contador yrecibo atómicos. Replay previo valida decisión sinreescribir trabajo posterior ni notificar. Guardias deactor/partición/snapshot/identidades globales/capacidad/counter anteswrites, featurecuenta/epoch antes/después ynotificación sólo trascommit.

Retry actualiza preference-tail paraque unmovimiento posterior deotraprimaria dependa delreemplazo. Si faltaba, se contabiliza suclave adicional antesdeescribir; un tail corrupto no se repara. No se cambia contenido/vistas/placements/settings/sombras/outcomes ni se inventa ACK. Adopción conserva altas/tombstones observados yno avanza contador.

Doce checks nativos IndexedDB propios aprobados: readonly/reapertura, actor/stale/catálogos, rollbacktardío, intenciones protegidas, referencias parciales/ajenas/límite10001, IDs/overflow, capacidad conysintail, ACKDTO frentearesultado aplicado, retry/nuevodependiente/replay, reranking depeers conrevisiones independientes yadopción/tombstone. Backup3 valida cadaresultado; captura /private/tmp/dalis-tag-order-native.png. Partición/pestaña/servidor propios retirados.987pass/223skip/0fail/11852aserciones, lint932sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió la firma options delproductor enlafixture antesdelaprimeraejecución. Entrada72%5h/40%7d, reservas10%/1%, secuencial. SinNext/Mongo/UI nuevos; siguiente19g3 prueba remota antesdeofrecer elecciones.

## 19g2a — Evidencia portable de orden preparada

Backup3 admite la decisión de orden con rama específica expected.incident, replanificación exacta de catálogo/último movimiento y originales supersedidos íntegros. Exige outcome congelado original, clausura de prerrequisitos con outcomes aplicados reales, correspondencia exacta de0/1 reemplazos (UUID/comando/CAS/fecha/entidad/secuencia posterior/dependencias vacías) yguardias globales deidentidad. Un DTO de ACK no basta. Proyección actual puede avanzar después de la decisión sin que el recibo la retroceda; pending intentado sigue siendo pending.

Ocho tests nuevos/36aserciones de roundtrip/adopción/retry/truncado/corrupción/ACK/IDs;987pass/223skip/0fail/11852aserciones, lint928sinavisos/tipos/Webpack/worker46/diff aprobados. Sin writer/UI nuevos, Mongo/browser/DBusuario/protocolo/índice. Entrada77%5h/41%7d, reservas10%/1%, secuencial. Siguiente19g2b capturaTX/writer yrollback/replay/capacidad enIndexedDB propio, antes deNext/UI.

## 16c19 — Home separada en Atrasadas, Hoy y Próximas

Petición humana atendida: tres secciones compactas con la misma agrupación por categoría, colores, checklist y orden. Hoy conserva intervalos activos, incluso nocturnos/de varios días; Próximas excluye los que incluyen hoy para no duplicar la misma fila. El filtro se aplica a planes simples y apariciones (incluidas excepciones reprogramadas) y no cambia la selección inclusiva del calendario u otros listados. Usa el día de la zona personal; no necesita calcular mañana, incluso en9999-12-31. No mutaciones ni nuevos fetches remotos/protocolo/índices.

Tres regresiones nuevas/16aserciones;979pass/223skip/0fail/11816aserciones, lint926/tipos/Webpack/worker46/diff aprobados. Fixture propia dehome con cuatrovariantes, categorías yseries probada con páginas completas enescritorio y390px móvil; capturas /private/tmp/dalis-home-sections-{desktop,mobile}.png. Partición/control/session de prueba, pestaña yservidor propios retirados; viewport restablecido ypreproducción humana intacta. NoGoogle/Mongo/físicos nuevos. Entrada81%5h/42%7d, reservas10%/1%, secuencial; skill vercel-react-best-practices aplicada yguíaNext vigente.

Se retoma19g2. El usuario pide que, al acercarnos al cierre de5h ysi queda trabajo, se reprograme este mismoheartbeat para19oct03:25Europe/Madrid. Esa nueva autorización sustituye la pausa puntual anterior sólo paraesta siguiente continuación; verificar reset/cuotas reales aldespertar, sinotra cadena automática.

## 19g1b — Decisión y preview de orden preparados

Nueve pruebas nuevas validan adoptar el catálogo observado o reaplicar únicamente el último tag.move de la cadena. La nueva operación usa UUID nuevo/CAS primario observado y vecinos originales; todos los efectos de reranking se calculan con el planner remoto existente, con límites de bytes y revisión por entidad. El preview conserva revisiones observadas, nombres/colores y tombstones remotos; no simula ACK ni reenvía campos locales obsoletos. Vecinos ausentes/no adyacentes, primaria borrada, revisión primaria/peer agotada o efectos demasiado grandes dejan sólo adopción. Registros durables se replanifican exactamente para detectar corrupción.

21pruebas focalizadas/101aserciones;976pass/223skip/0fail/11800aserciones, lint926 sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigieron copias independientes de intenciones en la fixture y dos estrechamientos de tipos de las aserciones. Sin writer/backup/UI nuevos, Mongo/browser o DBusuario. Siguiente19g2: reconstrucción TX y evidencia portable antes de ofrecer elecciones. Se intercala la petición humana de separar la home en Atrasadas/Hoy/Próximas.

## 19g1a — Captura de orden preparada

Doce pruebas puras delimitan una cadena aislada de tag.move de la misma categoría primaria. Se conservan catálogo local completo, todas las categorías observadas (incluidas altas y tombstones), raíz/outcome exactos, hijos no intentados y clausura transitiva de prerrequisitos ACK. Otros cambios personales pendientes, dependencias externas, catálogos parciales, registros ajenos/duplicados y envíos inciertos quedan protegidos. Si el conflicto conoce una revisión posterior a la sombra hay que actualizar antes de revisar. Una sombra posterior no se usa como ancestro y el catálogo observado no se presenta como estado actual garantizado del servidor.

No writer, evidencia portable o UI nuevos. Siguiente19g1b: decisión explícita con preview para adoptar el catálogo conocido o reaplicar el último movimiento sobre él; no equivale a enviar todo el orden local ni a descartar otros cambios. Después TX/backup/Next/UI. DoD967pass/223skip/0fail/11741aserciones, lint924 sinavisos/tipos/Webpack/worker46/diff aprobados. Se corrigió el estrechamiento de tipo de la categoría primaria dentro de una función auxiliar. Sin Mongo/browser, índices, DBusuario o producción.


## Continuación programada: 18 de octubre a las 22:24

El usuario solicita reanudar el plan completo hoy a las22:24, Europe/Madrid. Se reutiliza el heartbeat existente `continuar-el-plan-a-las-21-19`, ACTIVE y puntual, en este chat y con la política de notificaciones conservada. Configuración y prompt guardados verificados; no se crea otra cadena.

Punto de partida: último código f4ebaec y cierre2a36cd4 publicados; esta programación añade sólo documentación. Lectura16%5h/45%7d; reservas10%/1%. El reset publicado de5h es1792354998 (22:23:18Madrid); comprobar renovación y cuotas reales al despertar, incluso aunque ya sean22:24. Continuar desde19g1, con pruebas, plan/log, commit/push aint y HEAD remoto exacto por iteración. Preservar main humano, evidencia y datos; sin créditos/reinicios gratuitos ni producción. Pausar la ejecución al concluir sin nueva programación automática.


## Cierre de la continuación puntual del 18 de octubre a las 17:23

Siete iteraciones de código publicadas yHEADremoto verificado:22cb3d2 (revisión conjunta),f8d8cd5 (contrato deasignación),25410d7 (TX/evidencia),c5a77a9 (prueba remota),c1b0fa3 (UI),0b04a31 (series) yf4ebaec (identidades portables). Ajustes permite recuperar contenido+categoría conjuntamente y asignaciones aisladas de planes simples o series sin otros cambios pendientes. No equivale a cerrar toda recuperación residual.

Pruebas focalizadas Next6, dosorígenes IndexedDB/sesiones BetterAuth/Mongo propios: ambas elecciones reales con cancelar/reabrir/confirmar, cuatrovariantes, pérdida de respuesta/recarga/ACKúnico/convergencia porcohorte. Series conservan un slot confirmado;9checksIndexedDB repetidos con padre recurrente. Full30 permanece disponible, no se atribuye su ejecución completa a los scopes11. ÚltimaDoD955pass/223skip/0fail/11699aserciones, lint919sinavisos/tipos/Webpack/worker46. Sin nuevoGoogle/físicos niDBusuario/producción. Checklistfísica17oct sigue aprobada.

Lectura20%5h/46%7d, reservas10%/1%. La siguiente recuperación deorden tiene efectos multirregistro y necesita contrato/captura/pruebas yreparación; no abrirla con sólo10puntos disponibles sobre reserva. Repo coherente sin WIP, mainhumano limpio yrecursos Mongo/browser propios retirados. Heartbeat puntual continuar-el-plan-a-las-21-19 PAUSED, mismochat/política failed_runs_only verificados; sin nueva cadena, créditos o reinicios.

Siguiente19g1: contrato de recuperación de orden de categorías propias con catálogos/revisiones y guardias completos; luego persistencia/evidencia yNext/UI. Continúan borrado de categorías/placements, cohortes de apariciones/ausencia remota, accesibilidad ypreparación productiva autorizada. Cumpleaños aparcado ycompartirGmail fuera. No pedir repetir la checklist física sin cambio/fallo específico.


## 19f6 — Identidades globales de decisiones portables

Se cierra una discrepancia de integridad: backup exigía claves metadata únicas, pero dos decisiones de familias distintas podían reutilizar el mismo resolutionId. Ahora el codec rechaza IDs de decisión duplicados entre prefijos y colisión con cualquier operación conservada; los writers ya protegían esa frontera. No confunde referencias legítimas a outcomes/replacements ni IDs de entidades/importación, no altera datos ni crea ACK.

Tres pruebas nuevas combinan dos cohortes independientes válidas y rechazan ambas colisiones. Regresión backup51pass/471aserciones; suite955pass/223skip/0fail/11699aserciones, lint919 sinavisos/tipos/Webpack/worker46/diff aprobados. Sin nuevas pruebas browser/Mongo, wire, formato, UI, DBusuario o producción. Entrada23%5h/46%7d, reservas10%/1%; corte puro acotado. No se abre una nueva recuperación compleja antes del cierre seguro.


## 19f5 — Recuperación de asignación de series propias

El mismo diálogo admite ahora una serie viva propia cuando sólo quedan asignaciones pendientes. El executor remoto6 ya autorizaba esa operación con guard compartido/CAS; se retira la restricción local a planes simples, manteniendo captura completa y rechazo de contenido, otros slots o movimientos pendientes de la serie. Sólo se escribe la vista; no se sustituyen otros slots ni sus intenciones. No cambia UI, wire, índices o permisos.

Cuatro pruebas puras nuevas de variantes recurrentes protegen slots pendientes y SSR adicional usa el mismo diálogo. Nueve checksIndexedDB repetidos con padre recurrente pasan. Once Next6 focalizados `assignment-series` nointeractivos pasan con event/note mensuales, un slot realmente confirmado antes del conflicto, dos pérdidas/recargas/replay/ACK únicos y proyecciones exactas de serie/vista/slot en ambas particiones. El modo full30 y assignment interactivos permanecen disponibles; esta ejecución no afirma otra interacciónUI niGoogle/físicos. Recursos propios retirados.

952pass/223skip/0fail/11695 aserciones, lint918 sinavisos/tipos/Webpack/worker46/diff aprobados. Sin DBusuario/producción. Entrada31%5h/48%7d, reservas10%/1%; corte acotado sin repetir interacción manual. Siguen recuperación de orden/borrado de categorías, placements, cohortes recurrentes/ausencia y revisión final según dependencias.


## 19f4 — Recuperación de asignaciones visible en Ajustes

«Revisar asignación» reconstruye la comparación completa y acredita los ACK previos antes de ofrecer opciones para un plan propio simple. Permite adoptar la asignación remota o reenviar la categoría local confirmada, con radios, preview de contenido conservado, categoría/color conocidos y confirmación compacta. IDs estables enref, cuenta/época/mounted y caché propia; cancelar no escribe. No modifica contenido, categorías u orden. La captura conserva sólo nombres conocidos de las categorías revisadas, sin incluir cambios de nombres independientes ni inventar nombres/colores ausentes.

Cinco SSR nuevos y una prueba pura de nombres;947pass/223skip/0fail/11678 aserciones, lint918/tipos/Webpack/worker46/diff aprobados. Once Next6 focalizados finales pasan: ambas elecciones UI real cancelar/reabrir/confirmar y UUIDs generados por el componente, cuatro variantes, dos respuestas perdidas trascommit, recarga, ACK único y convergencia porplan. Se repitió el recorrido al mejorar nombres; un intento agotó45segundos manuales y se ajustó sólo el timeout de esa fixture (120segundos externo/90interno), no tiempos del producto. Full30 disponible, no atribuirlo almodo focalizado. Recursos propios retirados; sinGoogle/físicos nuevos/DBusuario/producción.

Entrada57%5h/52%7d, reservas10%/1%, secuencial. Cadenas de contenido+categoría y asignaciones simples ya ofrecen recuperación explícita; continúan otras preferencias/cadenas recurrentes/ausencia según dependencias. No declarar cerrada toda recuperación residual.


## 19f3 — Asignaciones: Next/Mongo y dos particiones aprobados

Once escenarios focalizados Next6: diez fronteras previas y un recorrido con cuatro variantes, productores reales y cadenas de tres asignaciones. Adopción y tres reenvíos conservan exactamente contenido, categorías, orden, outcomes y originales supersedidos. Dos respuestas perdidas tras commit remoto, recarga con pending attempt1, mismo UUID→ACK aplicado attempt2 y recibo/journal únicos aprobados. Cuenta/época/stale rechazan sin mutación; replay de la decisión no retrocede estado confirmado. Proyecciones de item/vista, shadow y cursor exactos en ambas particiones por plan. No es convergencia global, Google interactivo ni dispositivos físicos nuevos.

Selector estricto `assignment` añadido; completo30 disponible y `joint-ui` conservado. Este lote ejecuta once focalizados, no30. Se corrigió el nombre del mapa de proyección de la fixture antes de repetir compilación. Mongo/imagen pinned revalidados; proyecto, sesiones, orígenes, pestañas y recursos propios retirados.941pass/223skip/0fail/11588 aserciones, lint915/tipos/Webpack/worker46/diff aprobados. Sin índices nuevos, DBusuario ni producción; UI aún oculta. Siguiente19f4: revisión guardada en Ajustes y ambas elecciones con cancelar/reabrir/confirmar real antes de publicar. Entrada65%5h/53%7d, reservas10%/1%.


## 19f2 — Asignaciones: transacción y evidencia preparadas

Captura readonly y writer de9stores reconstruyen padre/vista/categoría/cola en una TX. Los prerrequisitos ACK se acreditan contra outcomes aplicados reales antes de devolver la comparación, también al escribir. Adopción guarda la vista remota; retry añade una sola intención pendiente con CAS nuevo. Vista, supersesión explícita, secuencia y recibo son atómicos; contenido/categorías/orden permanecen intactos. Replay previo no reescribe trabajo posterior ni notifica. Feature guardada por cuenta/época, IDs globales y capacidad previos a writes.

Backup3 incluye la decisión y valida originales exactos, outcome congelado, clausura ACK y reemplazo exacto. Rama `expected.incident` explícita; no asumir `expected.entry`. Seis pruebas portables nuevas incluyen truncado/corrupción y pending intentado; se separaron referencias compartidas en la fixture para simular ediciones posteriores sin alterar el recibo congelado. Nueve checks IndexedDB propios aprobados: readonly/reapertura, cuenta/stale, rollback tardío, dependencia semántica, IDs/counter, capacidad, falsoACK/ACKreal, retry/replay y adopción. Partición, pestaña y servidor propios retirados.

941pass/223skip/0fail/11587 aserciones, lint915 sin avisos/tipos/Webpack/worker46/diff aprobados. No UI o RPC nuevos activos, índices/DBusuario/producción; siguiente19f3 prueba Next/Mongo con dos particiones y UI únicamente tras aceptación. Entrada75%5h/54%7d, reservas10%/1%, secuencial.


## 19f1 — Contrato de asignación aislada

Planner y comparación compacta para `item-view.set` de un plan propio simple: adoptar remoto conocido o reenviar la última categoría propia confirmada con CAS/UUID nuevos. No modifica contenido, categorías u orden. Captura valida cola completa, intención exacta, grafo ordenado y clausura transitiva de prerrequisitos ACK; el DTO por sí solo no acredita esos ACK. Dependientes externos, contenido/movimientos pendientes del mismo plan, referencias ausentes, incertidumbre, ausencia/tombstone y recurrencia quedan protegidos. Categoría desconocida/borrada/sin confirmar y revisión agotada sólo permiten adoptar.

Diez pruebas puras/86 aserciones cubren cuatro variantes, planner remoto, frescura, identidad, corrupción, guardias, clausura ACK e independencia.935pass/223skip/0fail/11561 aserciones, lint908 sin avisos/tipos/Webpack/worker46/diff aprobados. No caller/writer/backup/UI nuevos ni prueba de convergencia. Siguiente19f2: captura y decisión en TX, evidencia portable y pruebas IndexedDB antes de Next/UI. Entrada81%5h/55%7d, reservas10%/1%, secuencial.


## Estado operativo — 18 de octubre de 2026

## 19e5b — Recuperación conjunta disponible en Ajustes

La revisión de un plan propio simple con asignaciones pendientes relacionadas ya lee la comparación completa antes de mostrar elecciones. Permite adoptar ambos remotos o guardar el borrador y su categoría para enviar; mantiene UUIDs de decisión estables, guardias de cuenta/época, historial y caché propia. Cancelar no escribe. Las dependencias no admitidas siguen protegidas y una decisión local no equivale a ACK.

Prueba Next6 focalizada `joint-ui`: diez escenarios de frontera más recuperación conjunta de las cuatro variantes; ambas elecciones mediante UI real, cancelar/reabrir/confirmar y UUIDs generados por el componente. Respuesta perdida de contenido y asignación, recarga antes de ACK, replay único y convergencia exacta por cohorte aprobados. Se conserva el modo completo de 29 escenarios; no se atribuyen esas 29 regresiones a esta ejecución focalizada. Un primer intento agotó el tiempo de interacción y retiró sus recursos; la repetición completa aprobó. Sesiones, particiones, pestañas, proyecto y Mongo propios retirados; sin Google interactivo ni nuevos dispositivos físicos.

925 tests, 223 opt-in omitidos, cero fallos y 11475 aserciones; lint904, tipos, Webpack y worker46 aprobados. Siguiente: recuperación residual de preferencias y cadenas de apariciones según dependencias, después accesibilidad y preparación final. Sin DB del usuario, nuevos índices o producción.

### Cierre de la continuación puntual12:22

**Cuatro cortes publicados; último c42bde7.** Recuperación conjunta decontenido+categoría tiene ahora backup3 completo, guardado local atómico yprueba real deconflicto/replay enlas cuatrovariantes.29Next6 compilados conMongo/dosorígenes propios verifican pérdida de respuesta decontenido yvista, recarga, ACK únicos yconvergencia exacta porcohorte. Once checksIndexedDB propios validan rollback/guardias/capacidad. El diagnóstico recorre todas las páginas deljournal sinampliar límite productivo100.

Diálogo conjunto yopciones revisadas preparados con seis testsSSR yguardias puras, **sin callerUI nuevo activo**. Siguiente19e5b conecta revisión desdeAjustes conlectura guardada, UUIDs estables ycache propia, ydebe probar cancelar/reabrir/confirmar reales antes deofrecerlo. DoD923pass/223skip/0fail/11452aserciones, lint903sinavisos/tipos/Webpack/worker46. NoGoogle/dispositivosfísicos nuevos, DBusuario ni producción; recursos propios limpios ymainhumano intacto.

Lectura24%5h/59%7d, reservas10%/1%; elcoste observado deNext másintegración/reparación/cierre no permite abrirlo congarantía deconservar margen. Heartbeat puntual pausado, sin nueva cadena. Las notas siguientes describen entregas previas del lote yno sustituyen este cierre.

### Continuación puntual12:22

Renovación comprobada100%5h/71%7d, reservas10%/1%.19e3b1 añade evidencia portable de recuperación conjunta: originales youtcomes exactos, ACKs previos reales yreemplazos consecutivos conCASindependientes/dependencia vista→contenido. Ocho tests nuevos/910totales yDoD aprobados; no writer niUI conjuntos todavía. 19e3b2 cierra persistencia atómica yonce checksIndexedDB: contenido/vista/cola/counter/recibo juntos, replay sinretroceder trabajo posterior, límites ycuenta/epoch. 19e4 pasa29Next6 conproductores reales ycuatrovariantes: pérdida de respuesta decontenido yvista, recarga, ACKúnicos yconvergencia exacta porcohorte. 19e5a prepara diálogo conpreview exacto deplan/categoría yopciones revisadas;923tests/DoD aprobados. **La UI conjunta aún no está conectada**: siguiente19e5b acción guardada yrecorrido UIreal antes deofrecer elección enAjustes. No producción ni nueva cadena automática.

### Cierre del lote puntual de las07:21

**Nueve cortes de código publicados, último0665080.** Ajustes permite recuperar conflictos aislados de nombre/color de categorías mediante adopción remota o reenvío local con orden remoto conservado. Historial, intenciones youtcomes permanecen intactos; confirmación real y28escenariosNext6 conMongo/dosorígenes propios aprobados. Límites de recuperación protegen cola/metadata/copias antes de escribir, conpruebas nativas de frontera yreplay.

Recuperación conjunta decontenido+categoría: guardia decohorte, contrato puro ysnapshot transaccional preparados, **sin writer/backup/UI conjuntos activos todavía**. Próximo19e3b define la entrega durable completa; después prueba remota19e4 yUI19e5. Siguen otros conflictos personales/recurrentes, accesibilidad ypublicación autorizada. Cumpleaños aparcado/compartirfuera, checklistfísica aprobada sinrepetición.

DoD final902pass/223opt-in skip/0fail/11308aserciones, lint893sinavisos/tipos/Webpack/worker46. NoGoogle físico nuevo niDBusuario/producción. Recursos propios retirados ymainhumano preservado. Lectura16%5h/72%7d frente areserva10%/1%; no cabe writer+portable+reparación/cierre completos. Heartbeat puntual pausado, sin otra cadena programada. Las notas siguientes conservan la preparación del lote yno sustituyen este cierre.

19e3a prepara captura consistente de recuperación conjunta dentro de una transacción local: ocho checks IndexedDB propios prueban lectura sin mutación, actividad independiente, cuenta/ausencias/corrupción, intenciones inciertas, revisión remota y reapertura. No habilita la escritura conjunta. Siguiente19e3b: writer atómico y evidencia portable con rollback/replay antes de Next y UI.

19c8 aplica la protección de capacidad también a recuperaciones comunes y de zona: rechaza crecimiento de cola/evidencia fuera del límite y copias que superen10.000 elementos antes de escribir. Ocho checks IndexedDB propios, replay sin duplicados y DoD completos aprobados. La decisión conjunta19e2 sigue preparatoria.

19e2 cierra el contrato puro de decisión conjunta: comparación compacta de contenido/vista/categoría y ACKs previos relacionados, adopción de ambos remotos o dos operaciones nuevas con CAS independientes para reenviar ambos borradores. Las revisiones agotadas y categorías no confirmadas limitan el reenvío. Aún no hay transacción/backup/UI conjuntos: siguiente19e3 debe reconstruir la captura dentro de unaTX y preservar evidencia antes de prueba remota/elecciones.

19e1 prepara la revisión conjunta de contenido y asignación: un clasificador puro valida la cola completa y demuestra que sólo las intenciones del plan y sus asignaciones no intentadas forman la cohorte. Protege dependientes externos y movimientos pendientes, sin activar decisiones todavía. Siguiente: contrato de elección con snapshots exactos de contenido/vista/categoría; después transacción, evidencia y pruebas remotas antes de UI.

**19d4: Ajustes permite recuperar conflictos aislados de nombre y color de categorías.** Puedes usar la categoría remota o reenviar el nombre/color local conservando el orden remoto. Ambos diálogos, cancelar/reabrir/confirmar y el recorrido hasta ACK/convergencia por categoría pasan en 28 escenarios Next6 propios. Las dependencias externas, borrado y orden mantienen sus guardias. Continúa recuperación de contenido con categoría y otras preferencias según dependencias.

19d3 aprobado:28Next6 compilado con dosorígenes/IndexedDB/sesionesBetterAuth/Mongo propios prueban adopción/retry de categoría, respuestaperdida/recarga yACK único. Siguiente19d4: ofrecer elecciones desdeAjustes conpreview/confirmación yUI real, sin ampliar soporte aborrado/orden/cadenas externas.

19d2 cierra transacción/backup/feature guardada de categorías con cinco checksIndexedDB propios;882tests yDoD aprobados. UI todavía oculta: siguiente19d3 prueba remota Next/Mongo real.

19d1 prepara recuperación de nombre/color de categorías propias con remoto vivo conocido: adoptar oreenviar conCASnuevo conservando orden remoto. Dependencias externas bloqueadas; sin executor/backup/UI nuevos aún.881tests aprobados, siguiente19d2 persistencia/evidencia yprueba nativa antes de integración remota/UI.

19c7 entregado en la continuación07:21: recuperación de apariciones valida capacidad posterior decola/metadata antes de escribir, sincompactar historia. Cinco checksIndexedDB reales y876tests/lint/tipos/Webpack/worker46 aprobados; siguiente recuperación residual según dependencias.

Protocolo de cuotas actualizado por indicación humana: consulta directa de ambas ventanas tras cada entrega; sólo preguntar si la herramienta no puede leerlas. Reservas10%5h/1%7d y alcance de autorizaciones intactos.

La zona horaria personal ya es editable offline, sincroniza por cuenta y está validada en el piloto Google de preproducción. El índice autorizado se crea mediante `ensureIndexes()` sólo en Preview de `int`; su disponibilidad está comprobada por readiness y dos ACK reales. Se ha restaurado Europe/Madrid, sin modificar los seis elementos ni sus preferencias de contenido.

[Guía de uso](user-guide.md) preparada y [checklist física de diez pasos](manual-device-checklist.md) **aprobada por el usuario el17oct2026**: recorrido secuencial de dos dispositivos, reapertura offline y reconexión cerrados. Siguen pendientes las cadenas de recuperación de contenido+categoría, las apariciones y las preferencias distintas de la zona personal, la revisión completa de accesibilidad y la publicación productiva autorizada. La checklist no valida conflictos concurrentes ni autoriza producción. Cumpleaños aparcado; compartir fuera de alcance.

### Continuación18oct02:20

**Lote cerrado tras bfa0fc5:** seis cortes de código19c1–19c6 publicados yverificados. Adopción yreenvío completo de aparición disponibles en Ajustes;27Next6/875tests aprobados yrecursos propios limpios. Lectura13%5h/86%7d, reservas10%/1%. Ejecución puntual pausada, sin otra programación. Próxima revisión acotada: impedir que una nueva cadena/recibo sobrepase los límites de captura completa de outbox/metadata antes de escribir; después contenido+categoría/otraspreferencias ycasos recurrentes protegidos. No abrir más código con margen de cierre.

**19c6 entregado:** Ajustes permite adoptar remoto conocido o reenviar toda la excepción local de un slot, con preview, confirmación, historial intacto yUUID/CAS nuevos cuando corresponde.27escenariosNext6 propios pasan concancelación/reapertura/confirmación real, respuestaperdida, recarga antesACK yconvergencia porserie.875pass/223skip/0fail, lint871/tipos/Webpack/worker46. Otros slots pendientes, dependencias externas, rechazos yremoto ausente siguen conservados sin elección insegura; remoto cancelado/tombstone sólo permiteadopción. No nueva pruebaGoogle/física ni producción.

Las notas siguientes registran preparación histórica del mismo lote; no sustituyen el estado vigente anterior.

19c5 cierra retry durable de toda la excepción: cola/counter/proyección/recibo atómicos ybackup de cada reemplazo exacto.27Next6 prueban dos reintentos reales, respuestaperdida, recarga antesACK, UUID/payloads intactos, etapas intermedias yconvergencia final porserie.873pass/223skip/0fail, lint871/tipos/Webpack/worker46. Falta botón/diálogo de retry19c6; adopción permanece activa.

19c4 prepara reenvío completo de aparición usando1–103 comandos existentes conUUIDnuevos/CAS porpaso yregistro ordenado. Cinco pruebas nuevas incluyen simulación de planner remoto yACK: payloads previstos permanecen exactos yproyección final coincide. Retry permanece rechazado por executor/backup yoculto en UI hasta19c5–6; adopción activa intacta.872pass/223skip/0fail, lint871/tipos/Webpack/worker46.

19c3 activa en Ajustes la adopción de aparición remota conocida, con preview completo yconfirmación explícita probada. Sólo slot propio seguro: otros slots/dependencias externas/envíos inciertos permanecen protegidos.26Next6,867pass/223skip/0fail, lint870/tipos/Webpack/worker46. La recuperación de apariciones todavía no ofrece reintento del borrador ni copia; seguir ese contrato sin inventar ACK o descartar cadenas.

19c2 prueba transacción/evidencia portable de adopción con26Next6: dos conflictos CAS reales (progreso/cancelación), rollback tardío, cuenta/epoch/stale/replay y otros slots conservados. Proyección/shadow/cursor de cada serie recuperada coinciden exactamente conMongo en dosparticiones; un tercer caso con otro slot pendiente sigue bloqueado yconservado. No se atribuye convergencia global a esa cola de prueba deliberadamente bloqueada. Aún falta UI19c3; sólo adopción preparada, sin retry/copia de aparición.

Renovación real100%5h/100%7d, reset5h1792300836; reservas10%/1%, continuación puntual y secuencial. 19c1 prepara contrato/planner de adopción de la excepción remota de un slot, con padre vivo, snapshots/evidencia exactos y bloqueos de otras apariciones/dependencias/intentos inciertos. Aún sin executor/backup/UI nuevos. Nueve pruebas nuevas; suite864pass/223skip/0fail, lint865/tipos/Webpack/worker46. La checklist física permanece aprobada; no reabrirla ni activar producción.

### Continuación de las21:19

Ocho cortes cerrados con recuperación visible de planes simples sin cadenas externas y zona personal, más guardia de dependientes externos de apariciones. La sincronización previa sigue activa en generación6. Última suite855pass/223skip/0fail/10967aserciones, lint861/tipos/Webpack/worker46. Durante ese lote no se ejecutó otro piloto Google ni la checklist física; posteriormente el usuario aprobó los diez pasos en15a3. Se cierra este lote puntual con reserva; no se programa otra cadena.

Siguiente corte coherente: contrato puro de recuperación de una aparición, con revisión de padre y slot, captura exacta y guardias completas de dependencias. Después transacción/evidencia portable/prueba remota real y UI; no ofrecer botones mientras falte esa aceptación. Cadenas de contenido+categoría y otras preferencias siguen en el bloque residual.

19b3 conecta en Ajustes la adopción de zona remota conocida y el reenvío de la última zona local, con comparación congelada, confirmación explícita y guardias de cuenta/epoch. No modifica fechas de planes ni declara ACK por decisión local. Otras preferencias, apariciones y cadenas externas siguen pendientes.

19b2 prueba decisiones atómicas de zona ybackup3,25Next6 conadopción/retry/replay/CASreal. Aún falta conectar suUI; generación6 conserva las funciones previas activas.


19b1 prepara contrato y guardias de recuperación de zona personal, aún sin executor/backup/UI. Siete pruebas nuevas y851tests aprobados; siguientes19b2–3 conectan transacción, evidencia portable yelección visible tras prueba real.


19a4 activa en Ajustes la recuperación de planes simples sin cadenas externas, tras diálogo real y24Next6 correctos. Las ediciones con categoría dependiente, preferencias y apariciones siguen pendientes. Suite844pass/223skip, lint852/tipos/Webpack/worker46.


19a3 prueba4conflictos reales con24Next6, reintento conrespuestaperdida/ACKúnico yconvergencia exacta de6stores en dosparticiones/Mongo. SigueUI coherente antesofrecerelecciones.

19a2 prueba el executor durable con24checks de4variantes/rollback/replay/backup y23escenariosNext6. Sigue prueba de conflictosremotos reales antes de activarUI.

19a1 prepara recuperación de conflictos de planes sin repetición: planner opt-in de cuatro variantes, adoptar/reintentar/copiar con invariantes y diez pruebas nuevas. Aún no ofrece elecciones nuevas enUI; sigue executor/integración antes de activarlas. Generación6 y piloto de zona anteriores siguen cerrados.

### Entregas del lote


**18e2c entregado: pilotoGooglePreview6 aprobado.** Zona personal sincronizada yrestauradaEurope/Madridrevision2 con2ACKremotosreales, shadows/outcomesconservados y0pendientes;6items/restocoleccionesintactos, recargapersistente. Índicesettingsoperativovíabootstrap/readiness6; producciónintacta. Preferenciasresiduales: recuperaciónexplícitadeconflictos, noediciónde zona.

**18e2b entregado: generación6 activada conjuntamente enint.** Zona horaria editableoffline ysincronizada porcuenta, sinreprogramarplanes.22escenariosNextpropiossinaliaspasan;830pass/223skip/0fail, lint850/tipos/Webpack/worker46. ÍndicesettingscentralautorizadosóloPreview/int; confirmaroperativoenpilotoGoogletrasdespliegue. No producción/nuevapruebafísicadedosdispositivos. Siguenrecuperaciónresidualyaceptaciónfinal.

**18e2a entregado:** editorzona compacto yguardadooffline preparado,22Next6 pasanincluyendoUIreal/validación/cancelación/ACKúnico. Hoy/Atrasadas ya leen zonapersonal de snapshot. Producto5hastaactivaciónconjuntasiguiente; índicePreviewautorizadocentralpublicado.

**18e1c2 entregado:** índiceuser_settings_user_uidx autorizado incorporado albootstrapcentral sóloPreview/int;8casosMongo prueban restricción/reintento y fallos sinrepair. Producción intacta. SigueUI compacta yactivación6conjunta; producto5.

**18e1c1 entregado:** veintiún escenarios Next6 pasan, incluida transición con cola5 capturada sinACK y recuperaciónoriginal6. Incidentes6/resoluciónlegacy conservan settings; no amplía recuperacióncomún. Permiso user_settings_user_uidx recibido, sóloPreview/int medianteensureIndexes; pendiente incorporarlo albootstrap, UI/zona y activación conjunta. Producto5.

**18e1b2 entregado:** proveedor6 productivo guardado por selector completo, probado en Nextpropio con caché5 separada/cambioépoca/remontaje/unmount/listeners. Diecinueve escenarios6 pasan: respuesta perdida/replayúnico, epochtrascommit sinACK antiguo, otra cuenta antesclaim y conflicto de zona con hijo conservado/categoríaindependiente. Producto5; siguiente compatibilidad de resoluciónroot/cola5 capturada, UI/zona y activación coníndice autorizado. Permiso recibido posteriormente en18e1c1.

**18e1b1 entregado:** catorce escenarios Next6 con IndexedDB/Mongo reales pasan. Zona personal, categoría, serie y aparición convergen exactamente en dos particiones; ACK directo rebasa sólo hijo pending0 y recarga conserva todos los stores/cursor. Producto aún5: faltan respuesta perdida/lifecycle6 y selección/UI/índice Preview autorizados. Petición de permiso específico para user_settings_user_uidx enviada; pendientes no impiden trabajo independiente.

**18e1a1 entregado:** Next6 compilado con acciones reales/defaults y dos sesiones BetterAuth persistidas/Mongo propios: nueve escenarios de identidad/readiness/retiro/matriz/CAS/replay/historia pasan. Diecinueve escenarios5 anteriores también pasan. Producto continúa5; sigue ACK/pullIndexedDB+lifecycle6 antes de activar zona personal. No Google nuevo ni dos dispositivos físicos; no DBusuario.

**16c16 entregado:** Ajustes ofrece Sistema/Claro/Oscuro. Elección local por navegador/dispositivo, aplicada inmediatamente y desde HTML inicial; Sistema sigue preferenciasOS, explícitos las sobrescriben. Recarga y pestañas mantienen elección. No añade tema a userSettings remoto ni activa generación6.

**16c15 corrige el color de categoría:** la muestra nativa vuelve a pintar el color elegido en creación/edición, al excluir inputcolor de la regla compacta heightauto. Sin cambio de guardado/sync.

**16c14b corrige la fila móvil:** fecha, flechas y hora permanecen juntas desde320px, con menores anchos/márgenes; todo el día sigue ocultando horas.

**16c14 entregado:** inicio/fin correlacionados por días civiles, fin explícito opcional con «Con fin» y flechas de día en inicio, fin y última fecha de repetición. Conserva horas elegidas; todo el día sin fin explícito ocupa un día. Formulario real probado en creación/edición y cuatro variantes, sin cambios de contrato/DB/sync. Detalle en [item-editor-redesign.md](item-editor-redesign.md). La checklist física de dos dispositivos sigue pendiente.

**Arrastre cerrado por el usuario.** Checklist física de dos dispositivos entregada; resultados pendientes en [manual-device-checklist.md](manual-device-checklist.md). No se ha ejecutado ni aprobado todavía este recorrido.

Lote cerrado tras 5cd93f4: quince cortes de código publicados; lectura real 13% 5h / 11% semanal, reserva 10% / 1%. 18e1a0 ahora prepara selector/rutas/retiro para la frontera Next6, aún inactiva; siguiente 18e1a1 delimitado en [iterations.md](iterations.md); no se inicia Next amplio sin margen para reparar/cerrar. Sin nueva automatización.

En esta ventana se cerraron 18a–18e0b: preparación de zona personal offline/remota, repo/CAS/ejecutor atómicos, productor independiente, ACK/pull/evidencia/backup, runtime/política y frontera privada 6 (HTTP/auth/readiness/action/cliente/hook). Quince cortes de código validados, cada uno con commit/push/HEAD y cuota. Diez casos Mongo / 81 aserciones; nueve checks de productor, diez ACK/evidencia y ocho descarga en IndexedDB con recargas. **Todavía no está activada la sincronización ni la edición de zona horaria personal.** La generación 5 del producto sigue activa.

Cambio visible 18e0b: Ajustes muestra la zona almacenada en una fila compacta, sólo de cuenta/epoch activos y sin edición. Último DoD: suite 819 pass / 221 skip / 0 fail / 10694 aserciones, lint 829, tipos/build Webpack/worker 46. Recursos de prueba propios limpios; sin cambios de producción ni índices/datos de Mongo del usuario. [settings-sync.md](settings-sync.md) contiene evidencia y dependencias.

Siguiente: 18e1a prueba Next compilada/BetterAuth persistido y dos particiones, retirada5/matriz5–6/lifecycle/ACK real/replay y convergencia. Después conectar editor/proveedor/rutas6 conjuntamente y probar Preview. El índice settings está registrado y staged, sin bootstrap nuevo todavía; resolver selección/autorización de entorno al cerrar activación, sin capturar secretos ni reparar datos. No hace falta wipe.

## Base activa anterior al lote de ajustes

16c13 mejora el gesto compartido: activación350ms/tolerancia12px, TouchEvents propios para preservar scroll antes de agarrar y bloquearlo después, pointercancel táctil no interrumpe el agarre; selección visible y etiqueta que acompaña al dedo/destino. Scroll automático sólo tras mover el dedo. Sin botones de arrastre nuevos ni cambios de contratos/persistencia. Orden y cambio de día simple/aparición pasan en navegador390×844 con React/CSS/IndexedDB reales y eventos táctiles simulados; cancelación/corto/scroll previo no escriben, drop escribe una intención, recarga conserva resultados. El 12 de octubre el usuario confirma que funciona mejor y lo da por terminado; aceptación humana de usabilidad cerrada.

Validación de 16c13: suite761pass/209skip/0fail/10347aserciones, lint788/tipos/buildWebpack/worker46. Pruebas propias y servidor limpios. Cumpleaños aparcado; siguientes bloques activos: preferencias/configuración y recuperación explícita residual, aceptación final móvil/dosdispositivos/offline/accesibilidad/guía y publicación productiva autorizada con índices centrales.


**Generación 5 activada conjuntamente en el código de `int`**: planes simples y repetidos, progreso/checklist de apariciones, categorías, asignaciones y orden. Se conserva identidad, cursor, UUID, dependencias y evidencia; los históricos sin CAS siguen unsupported sin reescritura ni ACK falso. No hay nueva resolución de apariciones ni despliegue productivo.

17e2b2a (`b9f1005`) añade el índice registrado desde el singleton únicamente en Preview de `int`, según autorización y petición del usuario. No necesita captura de secretos ni Reauthenticate Vercel. Producción, local y otras ramas conservan sus nueve índices automáticos; los cuatro índices personales anteriores siguen registrados/provisionados en Preview. Publicar repetición en producción requerirá habilitar allí su índice, usando el mismo registro central, antes de esa entrega.

17e2b2b conecta todos los puertos ya preparados con el selector 5: identidad, descarga, acciones/retirement 4, proveedor/caché, productores CAS, incidentes y backup 3. El fixture ahora utiliza la **configuración del producto sin alias preparatorio**. Readiness de cinco índices sigue siendo obligatorio en el servidor antes de aceptar comandos.

Validación: **19 escenarios Next/React/IndexedDB/Mongo propios** con dos sesiones Better Auth persistidas y dos particiones; replay/ACK único, progreso, categoría/orden de aparición, conflictos/tombstones, backup y época en vuelo. Bootstrap Mongo: seis casos / 120 aserciones. Suite 755 pass / 209 skip / 0 fail, lint 783, tipos, build Webpack y worker 46 aprobados. Recursos propios retirados. No equivale a piloto Google, prueba física multidispositivo ni evidencia del ID exacto del deployment.

**17e2b2c cerrado: piloto Google Preview real aprobado.** Se actualiza el cliente 4 conservando sus datos mediante el flujo «Comprobar actualización»/cerrar/reabrir. Deployment 5 muestra el alcance recurrente. Serie diaria de tres apariciones creada desde el editor, con categoría y checklist; hoy pasa a `in_progress` y su paso se completa, sin cambiar las otras dos apariciones.

Backup portable 3 validado con el decoder productivo: cinco items (cuatro anteriores y la serie), una aparición revision 2 y cuatro ACK del piloto — creación, vista/categoría, estado y checklist — con un intento cada uno, lease null y outcomes conservados. Shadow remoto de aparición coincide con el estado local; 18 acknowledged totales, cero pendientes. Estado y pasos persisten tras recarga. Las acciones 5 reales han pasado readiness obligatorio de cinco índices: el índice de aparición está operativo en Preview mediante bootstrap de la propia web. No se han capturado credenciales ni ejecutado el CLI sobre DB del usuario.

Evidencia: `/private/tmp/dalis-recurring-preview-pilot.png`. No es una nueva prueba en dos dispositivos físicos ni reapertura sin red; esas comprobaciones pertenecen a la aceptación final. Las apariciones con conflicto tienen comparación, pero su resolución explícita sigue pendiente. Cumpleaños aparcado; siguiente prioridad: usabilidad de arrastre y cierre residual del MVP, siguiendo [iterations.md](iterations.md).

Autorización: continuar el plan completo, commit + push por entrega validada en `int`, cuotas automáticas; reservas 10% de 5h / 1% semanal. Entrada de activación 32% / 29%. Sin nueva automatización. Compartir Gmail fuera de alcance. Checkout humano `main` intacto; worktree gestionado de `int` conservado.

10a cerrado: contrato y generación anual de cumpleaños, paginación civil/edad opcional y29feb sólo años bisiestos. No pantalla ni sincronización de cumpleaños activadas. Seis tests nuevos, suite761pass/209skip/0fail; lint787/tipos/buildWebpack/worker46. Detalle y siguiente entrega coherente en [birthdays.md](birthdays.md).

Estimación vigente: **aproximadamente 10% pendiente del MVP activo**, rango orientativo8–15%, ponderado por complejidad. Cumpleaños queda **aparcado** por decisión humana, con 10a preparado y sin pantalla/remote; compartir Gmail sigue fuera de alcance. No contabilizar reducción de alcance como implementación entregada.

Orden restante:
1. Agarre/arrastre táctil de 16c13: cerrado por aceptación humana el 12 de octubre.
2. Preferencias/configuración residual y recuperación explícita de conflictos pendientes, incluidas apariciones y contenido común donde falte.
3. Aceptación final en móvil real, dos dispositivos físicos, reapertura offline/reconexión y accesibilidad; guía de uso.
4. Preparar publicación productiva cuando el usuario la autorice, incluido bootstrap de los índices necesarios en el registro central. No desplegar producción por un push a `int`.

Si se retoma cumpleaños, el total anterior rondaba15% pendiente (10–20%). Las estimaciones históricas20–25% preceden a la activación de repetición.

## Histórico — lote puntual de las 01:27 del 12 de octubre


**Lote01:27 cerrado tras17e1b5a.** Ocho cortes publicados enint: fronteraNext5, colaantigua conservada, recuperación/convergencia, hook/época, productoraparición/replay, preferencias/conflictos/tombstones, operadoríndices y cuentaRemota. Dieciséis escenarios reales Next/React/IndexedDB/Mongo propios pasan; operadorCLI trescasos100aserciones y regresiónNext4 diecinuevecasos aprobados. ÚltimoDoD751pass/206skip/0fail, lint779/tipos/buildWebpack/worker46. **Producto sigue generación4; repetición remota NO activada.**

Permiso específico para índiceapariciónPreview solicitado y pendiente. Ninguna conexión/provisiónDBusuario en este lote; nombre confirmado no se repregunta, fuentePreview actual deberá verificarse antesabrir. Siguiente con margen:17e1b5b guardia real deépoca después de commit en vuelo; luego integración conjunta17e2 (API/identidad/action4 retirement/factory/hook/provider/context/consumidoresUI/backup/incidentes/productores conCAS) y pilotoPreview sólo tras índice autorizado/readiness. Conservar históricos sinCAS/UUID/deps/outcomes/tombstones, no wipe/migración automática niACKfalso.

Checkout humano main preservado; int vive en worktree gestionado `/Users/03762078/.codex/worktrees/recurring-sync-next/dalis-tasks-events`, conservar/reutilizar al continuar. Ejecución puntual eliminada por automation_update al cerrar, sin nueva programación/cadena.

17e1c1 cerrado: operador recurrente separado/singleton/ensureIndexes/guardias antes de conexión y cierre saneado, validado con tres casosMongo propios100aserciones. Bootstrap9+personal5/noop, target inválido sinIO y duplicados conservados/prefix4/retry sólo índiceaparición. ProvisiónPreview NO ejecutada: autorización específica solicitada por UI para plan_occurrences_user_series_slot_uidx; esperar respuesta y verificar fuentePreview/target antes abrir. Procedimiento en [recurring-index-provisioning.md](recurring-index-provisioning.md).

17e1b4 cerrado: categoría/vista de serie y placement de aparición usan productores reales/CAS independientes; cinco proyecciones convergen. Conflicto entre clientes conserva operación y dependiente sinACK; cancelación/root-tombstone mantienen descarga de historia/placement/cursor y replay antiguo no resucita nada. Evidencia del conflicto sigue original3 incluso tras cancelar4/borrarparent2. Quince escenarios pasan, journal18/receipts19; peer con conflicto sigue deliberadamente bloqueado pese a pasada settled.

17e1b3 cerrado: productor local real captura CAS0 para slotnuevo y dependencia directa; se pierde respuesta tras commitMongo sinACKlocal. Replay conserva UUID/payload intentado, sólo rebasa CAS1 del dependiente nointentado y ambos obtienen ACK únicos. Slot revision2/estadoin_progress, padre1 intacto, cinco proyecciones/cursor12 iguales en dos particiones. Doce escenarios reales pasan. Faltan integración ampliada de categoría/orden/conflictos/tombstones y procedimiento específico de índices/autorización/activación conjunta.

17e1b2 cerrado: hook5 React real separado de cache4, notificación de productor atómico, ACKs únicos, cambio deépoca con mismo componente sin key y rechazo de cliente anterior. Unmount más señaleswake/outbox no reclama ni actualiza; cliente fresco recupera cola posterior. Once escenariosNext5 propios pasan, journal10 con planes/series/aparición y ambas particiones al checkpoint. Falta productorlocal de aparición/replay/dependientes y casos recurrentes ampliados antes activar.

17e1b1 cerrado: cliente/runtime/action5 predeterminados recuperan cuatro intenciones originales conservadas (dos planes y dos vistas), ACK durable/evidencia sin cambiar UUID/payload/dependencias. Dos particiones IndexedDB convergen en cinco colecciones y cursor con serie/aparición Mongo; seis recibos/secuencias en total, idle sin writes. Diez escenarios compilados pasan; falta lifecyclehook5/productorlocal de aparición y demás casos recurrentes integrados.

17e1a2 cerrado: dos particiones IndexedDB propias, productor real de plan/asignación y handshake4 autenticado capturado conservan todos los stores/UUID/payload/dependencias/cursor ante referencia ausente o retiro4. Sólo increments de attempts sobre root y lease propio liberado; siguientehandshake5 bloquea antesclaim. Nueve escenariosNext5/Mongo pasan, sinACK antiguo ni recuperación/convergencia local5 declarada. Sigue17e1b lifecycle/convergencia.

17e1a1 cerrado: acción5 real compilada/defaults, dos sesiones BetterAuth propias y Mongo efímero verifican serie/aparición/replay con dos recibos exactos, auth/actor/readiness y matrix4↔5 antesbody. Retiro4 se prueba mediante wrapper preparatorio, no ID del producto activo. Next16.4 devuelve409 marcado para ID desconocido; assertion actualizada con código instalado verificado. Regresión diecinueve escenariosNext4 aprobada. Siguen cola/lease/capturedhandshake4, lifecycle5 y convergencia IndexedDB/Mongo antes provisión autorizada/activación conjunta; generación4 sigue activa. Trabajo aislado en worktreeint gestionado para preservar checkout humano main.

Ajuste visual16c12: acciones de categorías/ajustes y controles del editor común reducidos a36px, con extensión invisible del target de botones a44px. Menos espaciado, descripción inicial de dos líneas y tarjeta de ajustes más compacta; navegación y comportamiento conservados. Validación en navegador propio con componentes reales y CSS compilado; tipos/lint/suite y buildWebpack aprobados.

Continuación20:26 cerrada en código `cc05d20`: executors de serie/aparición/asignación/orden, dispatcher y readers autorizados preparados con Mongo propio; ACK/pull, evidencia/backup y productor de orden preparados con IndexedDB real. Cliente/transporte/acción/runtime/hook/cache futuros5 coherentes y privados. Suite748pass/201opt-in skip/0fail, lint773/tipos/build36 aprobados. Seis escenarios recientes de runtime IndexedDB pasan; respuestas sintéticas no prueban RPC/convergencia. **Generación4 sigue activa; repetición remota todavía no activada.**

Siguiente: guardia real deépoca en vuelo, índicePreview bajo permiso pendiente e integración/activación conjunta. Provisión específica de índice de apariciones Preview requiere procedimiento validado y permiso específico antes de ejecutar; ninguna nueva actuación en DBusuario en este lote. Lectura16%5h/56%7d con reservas10%/1%; no abrir prueba integrada con seis puntos hastareserva. Revisión puntual eliminada al concluir, sin nueva ejecución programada. Detalle en [recurrence-sync.md](recurrence-sync.md) y [iterations.md](iterations.md).

La raíz entra directamente en /workspace, sin landing intermedia; callbackGoogle por defecto directo al espacio. Navegación raíz offline reutiliza el shell neutral ya preparado. Favicon Dalis SVG/ICO público incluido en caché offline. Arrastre bloquea selección/callout desde montaje, preservando scroll previo y campos editables (16c8–16c9).

Calendario16c10 cambia de mes al deslizar horizontalmente: izquierda al siguiente, derecha al anterior. Corrección16c10b elimina el scroll horizontal interno que interceptaba gestos sobre los días y desactiva drag nativo de enlaces; ambas direcciones desde celdas, selección de día y ausencia de cambio por gesto vertical comprobadas en navegador propio. Sin botones Anterior/Siguiente; mes/año y Hoy comparten cabecera compacta. Hoy tiene menor altura visual y target táctil44px; selección de días y scroll vertical preservados. Re Pág/Av Pág desde los enlaces del calendario permiten cambiar de mes por teclado.

Navegación16c11 dentro de workspace actualiza la URL sin recargar el documento, conservando proveedores/cache de cuenta. Enlaces, selección de día, gesto mensual y Atrás verificados con montaje persistente en navegador propio. Los mensajes de lectura aparecen sólo tras300ms; durante comprobación inicial no se muestra falsamente Preparar esta versión ni se habilita contenido protegido. Preparación realmente requerida, errores y consentimiento permanecen disponibles.

**Editor común y sincronización de planes simples activados en preproducción.** Tarea, Evento, Cita y Nota comparten formulario de pantalla completa, cruz/check, descripción, checklist, categoría, fechas/horas separadas y todo el día. Lista/calendario mezclan variantes por categoría y fecha/hora/tipo, muestran pasos de checklist con el mismo icono y color de categoría del plan padre, además de sus iconos de estado. El icono principal recorre Sin empezar→En progreso→Completado→Sin empezar desde la lista (vacío/raya/check), conservando color y tipo; checklist mantiene dos estados. Pulsación prolongada y arrastre disponibles en categorías y filas simples de día/atrasadas/Hoy y próximas/Todos con contexto completo; alternativa por teclado accesible. Checklist ligeramente indentada. Ajustes muestra nombre/correo y ambas barras usan avatarGoogle con fallbackSVG; perfil de presentación cacheado por cuenta para consultaoffline. Desde la lista del día se puede mantener pulsado y soltar sobre otro día del calendario para mover el plan o sólo esa aparición, conservando hora/duración. Movimiento simple sincroniza mediante item.update; apariciones siguen locales.

**Categorías, asignaciones y orden de planes simples se sincronizan.** Generación4 exclusiva conecta identidad/pull, acciones/cliente/runtime/hook/cache/provider y pantallas comunes; acción3 retirada antes del executor, intenciones1 y sobres/journal2 conservados. Diecinueve escenarios Next compilado con callers productivos, BetterAuth persistido, dos particiones IndexedDB y Mongo propio pasan: cuatro variantes/asignaciones, replay tras respuesta perdida, ACK único, guardias de cuenta/época/retirada/readiness y proyecciones exactas. Esto no equivale a dos dispositivos físicos ni a Google interactivo.

Piloto16a4c3f adicional con sesiónGoogle REAL Preview cerrado: cuatro planes creados desde+, categoría azul, checklist, edición de Cita y progreso de Nota/paso de Evento, calendario4 y orden manual persistidos tras recarga. JSON exportado validado con decoder productivo:4items/1tag/4views/4placements y14intenciones acknowledged con14outcomes remotos, un intento cada una. No declarar nueva prueba física multidispositivo ni reapertura offline a partir de este piloto. Captura `/private/tmp/dalis-common-editor-preview-pilot.jpg`.

Wipe de contenido remoto Preview16a4c3b cerrado antes de activar; auth/índices conservados, producción intacta. Preparación local explícita por cuenta/dispositivo conserva sesión/ajustes y bloquea editor/motor hasta marca4; IABPreview confirmado por respuesta humana y preparado, otros perfiles anteriores confirmarán independientemente. No repetir wipeMongo ni borrar automáticamente otros dispositivos. Procedimiento en [common-plan-transition.md](common-plan-transition.md).

Backup16a4c3g exporta datos/intenciones/evidencia y permite importar copias nuevas de los cuatro tipos simples sin repetición, conservando originales. Preview respeta marca4 y no convierte legacy; categorías, orden e historial del archivo no se aplican como estado restaurado.9checks IndexedDB propios de atomicidad/replay/rollback/guardias/recarga pasan. Última suite625pass/153opt-in skip/0fail, lint667/tipos/build34 aprobados.

**Repetición y progreso por aparición funcionan localmente; series/apariciones y su orden siguen sin sincronización remota.**17a1 prepara contrato de revisión explícita/planner de aparición;17a2a conserva revisión propia en lectores y captura TX opcional validada con IndexedDB, sin activar productores/capacidades;17b1 prepara repositorio/CAS/índice explícito remoto de apariciones con Mongo propio, sin provisión de usuario ni executor;17b2a prepara guard compartido transaccional serie/aparición;17b2b1 conecta escritor preparatorio de series con guard/CAS/recibo/journal, sin callers activos;17b2b2 define evidencia/recibos futuros de aparición, manteniendo decoder activo estricto;17b2b3 conecta executor preparatorio de aparición con guard/replay/recibo/journal/CAS atómicos y cinco escenariosMongo reales;17b2c1 prepara descarga autorizada/checkpoint de series y apariciones, validada con Mongo propio;17c1a prepara evidencia/correspondencia local de aparición sin ACK;17c1b prepara proyección/planACK/rebase conservador puro;17c2a prepara ACK IndexedDB atómico probado con recarga, sin callers activos; siguientes cortes en [recurrence-sync.md](recurrence-sync.md). Cumpleaños y aceptación final permanecen bloques posteriores. Compartir por Gmail queda fuera del alcance actual por decisión del usuario del11oct. Alcance entregado en [item-editor-redesign.md](item-editor-redesign.md) y [common-plan-activation.md](common-plan-activation.md). Continuación puntual solicitada para11oct15:25Europe/Madrid, previa consulta de cuota real; el usuario elige continuar repeticiónremota y después el orden recomendado, tras el ajuste16c1 de checklist. Los apartados siguientes registran la trayectoria histórica.

Cierre histórico de la continuación anterior del 11 de octubre (antes de20:26): el código publicado llegó a `c6449ed`: ACK/pull atómicos de aparición y serie, incidentes, consumidores personales y backup recurrente están preparados y probados por separado. La asignación de categoría a una serie tiene planner puro; su executor **17b3b** es la siguiente candidata. Después faltan orden mixto recurrente, integración/negociación5, índices de aparición y prueba conjunta antes de activar. Las mejoras de cuenta/avatar, arrastre sin selección, entrada directa y favicon ya están publicadas. La revisión puntual se pausa; no hay otra continuación programada. Detalle y evidencia en [recurrence-sync.md](recurrence-sync.md) e [iteration-log.md](iteration-log.md).

## Estimación y siguiente elección

Actualización tras16c12: queda aproximadamente20% del alcance vigente (rango orientativo15–25%, estimación ponderada, no por commits). Mucho código recurrente ya preparado hasta17d5, pero la integración real/activación todavía cuenta como pendiente. Orden:1) cerrar repetición remota, prueba conjunta/índice autorizado/activación;2) cumpleaños anual y sincronización;3) preferencias residuales y aceptación final móvil/multidispositivo/offline/accesibilidad/guía. CompartirGmail excluido. Usuario solicita continuar el12oct01:27Europe/Madrid; heartbeat puntual reactivado desde17e1a, sin cadena adicional.

Continuación20:26:17b3b conecta executor preparatorio de categorías de series, con guard/CAS/recibo/journal y carreras Mongo probados. Generación4 activa sin cambios; orden recurrente, integración/negociación5 y prueba conjunta siguen pendientes.

17b3c cierra replay común de categorías con recibos de aparición y rollback real. Siguiente17c5a: orden mixto recurrente puro; todavía sin activar repetición remota.

17c5a prepara orden mixto simple/aparición en día/atrasadas, slots timed, CAS independiente y catálogos completos limitados. Sigue executor17c5b y consumidores antes de negociación5/activación conjunta; producto sigue4.

17c5b conecta executor preparatorio de orden con guards/CAS/recibo/journal atómicos y prueba Mongo de retry/rollback. Sigue17c5c descarga autorizada de placements recurrentes y consumidores/productor futuros; aún sin activar repetición remota.

17c5c prepara descarga autorizada por padre propio de posiciones recurrentes implícitas/timed e historia conservada tras cambio de regla/borrado.17c5d cierra productor IndexedDB futuro con replay/dependencias/rollback/ACK personal y recarga reales. Siguen frontera de envío, consumidores/política y negociación5/prueba conjunta. Activo4 intacto.

17c6a cierra validación pura de envío con tres familias y correspondencia compartida de aparición, sin cambiar sobre2/intención1 ni callers4. Sigue dispatcher Mongo, servicios/política y negociación5 conjunta.

17c6b cierra dispatcher preparatorio con todas las familias, replay real y doce comandos mixtos probados en Mongo. Sigue frontera autenticada/readiness, consumidores/política y negociación5; recurrencia aún no activa.

17c6c prepara frontera autenticada/readiness de cinco índices sin provisión ni ruta nueva. Siguen policy/consumidores/runtime futuro y negociación5/pruebas conjuntas; producto permanece4.

17c7a cierra policy y diagnóstico/resumen futuros, con familia propia de aparición y bloqueo explícito de históricos sinCAS. Sigue consumidor/coordinador/runtime preparatorio, luego prueba integrada y negociación5; todavía4 activo.

17c7b cierra apertura y enrutado del store futuro con veinte checks reales IndexedDB. Falta coordinador/runtime/transporte5 y evidencia conjunta Mongo/Next antes activación; no confundir pruebas locales sintéticas con convergencia.

17c7c cierra coordinador privado con guards de cuenta/stop, claim fresco y cadena de tres familias. Siguen runtime/HTTP5 y pruebas reales conjuntas antes de activar; no se anuncia convergencia con puertos simulados.

Nueva petición humana11oct: continuación puntual programada hoy20:26Europe/Madrid, previa comprobación real de renovación para17b3b. Código85d788c, reservas10%5h/1%7d; heartbeat existente ACTIVE sin cadena adicional.

Queda aproximadamente **20–25% del alcance actual** (75–80% completado). Estimación ponderada por complejidad, no por commits ni duración. Al retirar compartir (13puntos del alcance original), quedan alrededor de20puntos sobre87: repetición remota/series/apariciones y orden10, cumpleaños5, preferencias residuales/aceptación final5. La mejora del porcentaje corresponde a una reducción de alcance, no a implementar compartir.

Orden recomendado, sujeto a elección del usuario:

1. **Sincronizar repetición y apariciones**: identidad de serie/slot, progreso independiente, excepciones, backlog/reprogramación y orden entre dispositivos; conservar cambios offline y resolver conflictos.
2. **Cumpleaños** (`10`): creación/edición, regla anual, año opcional, política del29febrero y sincronización.
3. **Cierre del MVP** (`15a–15b`): preferencias/configuración residual, recuperación explícita de incidentes que falten, aceptación en móviles/dispositivos físicos, offline, accesibilidad y guía de uso.

El usuario puede elegir más cambios visuales o funcionales antes de estos bloques; no se abre uno nuevo por tener cuota disponible. Commit/pushint y consulta de ambas cuotas por iteración continúan vigentes.

## Recorrido registrado

Estado: shell offline, cuentas, navegación, tareas, categorías, calendario, grupos y atrasadas comprobados (`01a–07a`); preparación tras Google y desarrollo corregidos en `05c`; diálogos y navegación móvil corregidos en `07c`; ranking y colocaciones atómicas entregados en `07b1a–07b1b`; controles accesibles y arrastre entregados en `07b2a–07b3b`; conversión temporal y persistencia de eventos comprobadas en `08a–08b`, formulario entregado en `08c1b1`; agenda/cabeceras y formulario de tareas compactos entregados en las intercaladas `07d–07d3`; selectores de eventos entregados en `08c1a`; snapshot mensual compartido entregado en `08c1b0`; creación y lectura en agenda/calendario entregadas en `08c1b1`; edición, borrado y reparación entregados en `08c2`; fechas civiles de repetición entregadas en `09a1`; proyección de apariciones entregada en `09a2`; progreso atómico por aparición entregado en `09b1`; edición/reprogramación/cancelación local entregadas en `09b2`; lectura pura paginada con excepciones entregada en `09b3a`; snapshot transaccional entregado en `09b3b`; colocaciones mixtas del día entregadas en `09b4a`; lookup acotado por identidad entregado en `09b4b1`; compatibilidad textual del rank legado comprobada en `09b4b2a1` y clave implícita/orden mixto en `09b4b2a2`; huella validada de operaciones remotas preparada en `11b0`; prioridad revisada a sincronización de tareas/eventos simples, entorno/matriz de prueba preparados en `11a0`; descriptor local validado en `11a1a1`; runner/transacciones reales entregados en `11a1a2`; repositorio propio/CAS entregados en `11a1b1`; reductor compartido entregado en `11a1b2`; atomicidad remota entregada en `11b1a`; acción autenticada preparada en `11b1b`; descarga privada/checkpoint entregada en `12a1`; proyección conservadora preparada en `12b1a`; ACK local atómico entregado en `12b1b`; pull/cursor locales atómicos entregados en `12b1c`; protección de cuenta esperada entregada en `12b2a1`; pasada acotada/lease entregados en `12b2a2`; transporte/runtime preparados en `12b2a3`; prueba integrada de dos dispositivos entregada en `12b2a4`; resumen local de cola y bloqueos entregado en `12b2b1`; ejecución manual desde Ajustes entregada en `12b2b2`; scheduler acotado preparado en `12b2b3`; proveedor único y sincronización automática en Workspace entregados en `12b2b4`; señal local y aviso compacto entregados en `12b2c`; proyección validada de incidentes preparada en `13a1a`; snapshot local de incidentes entregado en `13a1b`; comparación compacta en Ajustes entregada en `13a1c`; contrato puro de elección preparado en `13a2a`; supersesión y executor local atómico entregados en `13a2b1`; resolución entre dos dispositivos/MongoDB comprobada en `13a2b1a`; elecciones explícitas desde Ajustes entregadas en `13a2b2`; contrato de copia nueva frente a tombstone preparado en `13a2c1`; copia atómica y convergencia real entregadas en `13a2c2`; copia explícita desde Ajustes entregada en `13a2c3`; recuperación de sesión/cierre/lease comprobada en `13b1a`; handshake de protocolo entregado en `13b1b1`; incompatibilidad de envío/despliegue mixto comprobada en `13b1b2`; comprobación segura de actualización y worker real entregadas en `13b2a`; contrato de backup portable preparado en `13c1a`; snapshot completo readonly entregado en `13c1b`; descarga de backup desde Ajustes entregada en `13c1c` y evidencias reforzadas en `13c1d`; vista previa pura de importación entregada en `13c2a`; contrato de copias nuevas entregado en `13c2b`; registro durable compatible con backup entregado en `13c2c1`; ejecutor atómico y replay/rollback comprobados en `13c2c2`; guardias de cuenta/época y preparación comprobadas en `13c2c3`; selección y confirmación compactas en Ajustes y convergencia de copias entregadas en `13c2d1`; cortes de preferencias revisados en `11c0`; DTO puro de efectos personales entregado en `11c1a`; reductor personal compartido entregado en `11c1b1`; planning remoto puro de categorías entregado en `11c1b2a`; planning de vista personal simple entregado en `11c1b2b`; índices de activación explícita entregados en `11c2a0`; repositorio propio de categorías/CAS probado con MongoDB aislado en `11c2a1`; repositorio de vistas personales/CAS probado en `11c2a2`; contrato transaccional personal documentado en `11c2b0`; resultados versionados y adaptación readonly preparados en `11c2b1a`; recibos versionados preparados en `11c2b1b`; journal versionado preparado en `11c2b1c`; lector común de recibos probado en `11c2b2a`; replay canónico entregado en `11c2b2a2`; executor de categorías atómico preparatorio comprobado en `11c2b2b1`; executor de vista personal preparado en `11c2b2b2`; carreras con snapshots solapados comprobadas en `11c2b3a`; contrato de página mixta preparado en `11c3a1`; reader Mongo mixto preparado en `11c3a2`; contrato push mixto preparado en `11c3b1a`; compatibilidad separada de intención preparada en `11c3b1b`; replay común en executor item comprobado en `11c3b2a`; dispatcher mixto preparado en `11c3b2b`; servicio batch mixto preparado en `11c3b2c1`; servicio/dispatcher mixtos probados con Mongo en `11c3b2c2`; transición de metadata local definida en `11c3c0`; shadow mixto puro entregado en `11c3c1a1`; snapshot personal puro entregado en `11c3c1a2`; recepción mixta pura entregada en `11c3c1b1`; outcome item versionado readonly preparado en `11c3c1b2a`; outcome personal/decoder común preparados en `11c3c1b2b` y proyección personal pura adelantada en `11c3c3p`; backup portable mixto puro entregado en `11c3c2a`; snapshot/export portable2 e importación real compatibles entregados en `11c3c2b`; lectores e incidentes mixtos compatibles entregados en `11c3c2c`; ACK personal atómico preparatorio probado en `11c3c3a`; readers item legacy/versionados compatibles en `11c3c2d`; recepción local de páginas mixtas preparada en `11c3c4a1` y decisión pura de cursor en `11c3c4a2p`, proyección personal de página completa preparada en `11c3c4a2q`; descarga local mixta atómica preparatoria comprobada en `11c3c4a2`; prueba mixta con dos particiones/Mongo entregada en `11c3c4b1`; capacidades/diagnóstico de cola preparatorios entregados en `11c4a1p`; coordinador mixto aislado preparado en `11c4a2p`; transporte mixto preparado en `11c4a3t`; snapshot/dispatch propios preparados en `11c4a3s`; runtime de cuenta/época preparado en `11c4a3r`; piloto conjunto de coordinador/transporte/runtime con Mongo entregado en `11c4a4p`; contrato de activación segura definido en `11c4a5p` y núcleo puro de colocaciones extraído en `11c5a1p`; resumen mixto puro entregado en `11c4a5s`; readiness de índices preparada y comprobada en `11c4a5i`; frontera pull privada preparada en `11c4a6p`; guardia de envío mixto preparada en `11c4a6s`; adaptadores autenticados/acción mixta preparados en `11c4a7p`; anuncio explícito aislado preparado en `11c4a7h`; provisión personal por puertos preparada en `11c4a8p` y panel compacto compatible en `11c4a9u`; provisión parcial probada con Mongo propio en `11c4a8m`; frontera RPC Next real propia comprobada en `11c4a7n`; vista previa offline de índices entregada en `11c4a8v`; contrato de destino/provisión definido en `11c4a8c`; guardia del descriptor entregada en `11c4a8g1` y revisión offline completa en `11c4a8e1`; resolver/configuración sin conexión entregados en `11c4a8g2`; ciclo de ejecución por puertos preparado en `11c4a8e2a`; trayectoria posterior de defaults/CLI, activación y piloto registrada en los resultados; estado vigente al inicio de este documento. `09b4b2a`, `09c` y `10` quedan aplazadas. Fecha: 9 de octubre de 2026. Rama de trabajo actual: `int` (integración, commit y push autorizados por el usuario para autodespliegue preproductivo).

## Objetivo

Una webapp para crear y organizar tareas, eventos, citas, notas y cumpleaños en un calendario. El trabajo diario debe poder realizarse completamente sin conexión después de preparar el dispositivo una primera vez. Cuando vuelva la conexión, los cambios se sincronizarán con MongoDB y con los demás dispositivos autorizados. Google identifica a cada usuario; los datos permanecen separados por cuenta. Compartir por Gmail queda fuera del alcance actual.

La experiencia será responsive y mobile-first: barra inferior de navegación con iconos SVG en móvil y barra superior en escritorio. Ambas se alimentan del mismo registro y se actualizan al crear cada pantalla importante. Implementada en `04c` con resumen y ajustes reales, accesibilidad, safe areas y navegación offline. El botón `+` está operativo para tareas en ambas barras desde `05a1`.

Este documento es la entrada al plan. La iteración `00` entregó la planificación; la implementación avanza con una lectura nueva de presupuesto entre entregas. El plan es modificable: los cambios de alcance o decisiones se registran antes de implementar y se incluyen en el commit de la iteración correspondiente.

## Documentos

| Documento | Contenido |
| --- | --- |
| [Evidencia local de preferencias](local-preference-evidence.md) | Transición de shadow/outcome/backup y orden de lectores antes de writers. |
| [Producto y modelo](product-and-model.md) | Comportamiento, entidades, fechas, repetición, orden y permisos. |
| [Offline, sincronización y arquitectura](offline-and-sync.md) | Almacenamiento local, cola, conflictos, seguridad y rutas. |
| [Activación personal](mixed-sync-activation.md) | Fronteras, índices, transición y evidencia de activación del transporte 3. |
| [Preferencias personales](preference-sync.md) | Contratos, compatibilidad y cortes para sincronizar categorías/vistas/orden sin alterar pendientes. |
| [Pruebas de sincronización](sync-test-environment.md) | Entorno aislado, transacciones/CAS/recibos y pruebas de dos particiones con MongoDB real. |
| [Iteraciones](iterations.md) | Entregas pequeñas, dependencias, rutas y aceptación. |
| [Flujo de trabajo](workflow.md) | Ventanas de Codex, cierre, commits, pruebas y paralelismo. |
| [Backup y recuperación](backup-recovery.md) | Contrato portable, conservación de pendientes y cortes de exportación/importación. |
| [Recuperación de conflictos](conflict-recovery.md) | Evidencias conservadas y cortes de elección explícita. |
| [Reordenación](reordering.md) | Intenciones, ranking, alcances y cortes concretos de `07b`. |
| [Orden del backlog repetido](backlog-ordering.md) | Problema de ranks implícitos, propuesta a validar y próximos cortes de `09b4b2`. |
| [Registro de iteraciones](iteration-log.md) | Trabajo completado, evidencias y siguiente candidata. |
| [Operación de auth](auth-operations.md) | Transición de sesiones antiguas y verificación vigente. |

## Estado real del repositorio

Observaciones de archivos versionados; no se ha probado el login de producción ni inspeccionado credenciales.

- Next.js `16.3.8`, React `19.3.0`, Better Auth `1.7.7`, MongoDB driver `7.7.0`, SWR `2.5.1`, Zod `4.6.5`, TypeScript. Versiones de [package.json](../package.json).
- Google social login configurado en [auth.ts](../src/lib/auth/auth.ts), cliente de autenticación existente y UI de acceso en español.
- El layout de dashboard verifica sesión mediante [session.ts](../src/lib/auth/session.ts); [proxy.ts](../src/proxy.ts) realiza un filtro inicial por cookie.
- `01a` conecta Better Auth al adaptador MongoDB ya instalado: usuarios, cuentas, sesiones y verificaciones persistentes. Pruebas con MongoDB local real y dos clientes HTTP independientes comprueban estabilidad de ID tras logout y reconexión. El login interactivo contra Google real se comprobará en el piloto; los tests usan firmas válidas con una clave de prueba y conservan las verificaciones de token.
- El acceso depende de `ALLOWED_EMAILS`. Una lista vacía no admite usuarios; no se amplía automáticamente.
- Existen singleton MongoDB, cuatro colecciones de autenticación y seis índices centrales. El adaptador solo reconoce solicitudes automáticas de índices previamente registrados y provisionados. Colecciónitems/índiceownerId+_id y persistencia propia/CAS entregados en11a1b1; sync_operations/sync_changes/sync_counters y sus invariantes atómicos entregados en11b1a; restantes colecciones de producto pendientes. Se respeta [src/lib/db/AGENTS.md](../src/lib/db/AGENTS.md).
- El dashboard conserva una entrada al espacio, con preparación automática en `05c`. `06` incorpora calendario mensual y tareas del día. `03a–03b` aportan repositorios IndexedDB y una outbox atómica; `04a–04b` añaden shell neutro `/workspace`, worker de recursos, preparación y cierre de cuenta entre pestañas. Recarga y reapertura sin servidor probadas en producción; transporte/coordinador de propios simples activo desde12b2b4, prueba integrada con dos particiones/MongoDB. Preferencias/series/compartidos siguen sin sincronización.
- Hay pruebas con Bun, comprobación de tipos y Biome. El README sigue siendo el de arranque y se actualizará cuando haya un flujo ejecutable.

## Decisiones de producto

Prioridad visual añadida por el usuario el 7 de octubre: UI minimalista y densa, especialmente en móvil. Filas compactas, menos título/subtítulo redundante y acciones secundarias/detalles desplegables; evitar que botones y tarjetas consuman la pantalla. Mantener creación accesible y controles táctiles utilizables. Intercalar revisión de la UI actual después de `08b`, antes del formulario de eventos.

1. **Modelo común elegido por el usuario**: `plan` con variantes `task`, `event`, `appointment` y `note`, mismas opciones/progreso y diferencia visual en el icono. `birthday` mantiene contrato específico anual y bloque de implementación posterior; reemplaza la decisión inicial de tratar cita como evento.
2. **Un botón principal `+`** siempre accesible abre editor común con Tarea, Evento, Cita y Nota. Crear desde un día usa ese día como valor inicial; cumpleaños se añadirá cuando su pantalla funcione.
3. **Lectura y escritura locales**: IndexedDB alimenta la UI; MongoDB mantiene el estado remoto aceptado. Guardar no depende de la red.
4. **Atrasadas es una condición derivada**: un plan no completado cuyo inicio previsto es anterior a hoy. Conserva fecha y estado; no necesita cron ni un cambio persistido a medianoche.
5. **Una categoría principal por usuario y elemento** en el MVP. Planes de las cuatro variantes agrupados por esa categoría; orden manual de grupos y planes simples. Múltiples etiquetas quedan para una ampliación porque requieren resolver cómo evitar duplicados al agrupar.
6. **Repetición por series y ocurrencias**: cada aparición de una tarea conserva su propio estado y checklist. Un cumpleaños genera una aparición anual de día completo.
7. **Compartir por Gmail fuera de alcance**: no implementar invitaciones, colaboradores, permisos de lector/editor ni revocación hasta nueva decisión humana. Las referencias posteriores a compartición documentan el plan histórico.
8. **Sin nuevos paquetes base**: APIs nativas del navegador y el stack existente. Si las pruebas muestran necesaria una biblioteca de fechas, recurrencia, IndexedDB, calendario o PWA, se presentará su necesidad antes de añadirla.

## Alcance offline

| Operación | Sin conexión |
| --- | --- |
| Abrir y recargar la app ya preparada | Sí, incluido cierre y reapertura del navegador. |
| Consultar meses y días con datos descargados | Sí; todas las series descargadas se expanden localmente. |
| Crear, editar, borrar, clasificar y reordenar | Sí, con guardado local y cola persistente. |
| Cambiar estado, checklist y repetición | Sí, incluso con sesión remota caducada. |
| Iniciar sesión con Google en un dispositivo nuevo | Requiere conexión. |
| Recibir modificaciones de otros usuarios/dispositivos | Requiere conexión. |

No se promete abrir una web nunca descargada sin red. El almacenamiento del navegador puede perderse si el usuario lo borra o el navegador lo expulsa; habrá persistencia solicitada, detección de errores y exportación/importación local. Estos límites se reflejarán en la UI donde afecten a una decisión.

## Orden de entrega

`00 Plan → 01 Identidad → 02 Dominio → 03 Persistencia local → 04 Apertura offline → 05 Tareas → 06 Calendario → 07 Agenda y orden → 08 Eventos → 09 Repetición → 10 Cumpleaños → 11 Persistencia remota → 12 Sincronización → 13 Conflictos y recuperación → 15 Piloto`.

Las iteraciones complejas están partidas en subentregas en [iterations.md](iterations.md), cada una con su propio commit y control de presupuesto. Las interfaces de sincronización se diseñan desde `02–03`, aunque el transporte remoto llegue después. La primera demostración útil offline llega en `06`; el MVP completo exige también sincronización, repetición y recuperación.

## Condiciones de éxito del MVP

- En modo avión y tras reabrir: crear los tres tipos, modificar checklist/estado, repetir, navegar meses, reordenar y ver atrasadas; todo persiste.
- Al recuperar conexión: dos dispositivos de una cuenta convergen sin duplicados; una pérdida de respuesta no repite una mutación.
- Dos cuentas solo reciben sus datos propios; otro usuario no accede adivinando un ID.
- Una tarea en curso pasa a “Atrasadas” conservando su estado al cambiar el día; una tarea completada desaparece de esa sección.
- Editar una aparición no altera otras. Una ocurrencia pasada pendiente no desaparece al modificar la programación futura.
- Cierre inesperado, conflicto, sesión caducada, actualización de versión y falta de espacio no provocan un falso “Guardado” ni descartan silenciosamente cambios pendientes.
- Código, comentarios e identificadores en inglés; copy y accesibilidad de la UI en español. Cada subiteración completada tiene commit en la rama actual.

## Presupuesto actual y siguiente paso

Lectura inicial: **5h: 99%; 7d: 44%**. Lectura posterior a `00`, usada para `01a`: **5h: 92% restante; 7d: 43% restante**. Son porcentajes restantes, no consumidos, y no equivalen a un número fijo de tareas. El presupuesto semanal sigue siendo el condicionante. Es un registro histórico; la candidata vigente figura al principio de este documento y en el registro de iteraciones.

Al final de **cada** iteración se preguntarán ambos porcentajes y se elegirá continuar, dividir o detener según [workflow.md](workflow.md). No se encadenan varias iteraciones a partir de esta lectura inicial.

Excepción autorizada posteriormente: lote desatendido del 6 de octubre, iniciado con **5h 82%; 7d 41% restantes**. Entre commits se consulta el uso real sin esperar feedback, con reserva reforzada del 20%. La autorización y sus condiciones figuran en `workflow.md`; el protocolo interactivo se recupera al terminar el lote.

Lote cerrado tras `03b`: lectura automática **5h 61%; 7d 38% restantes** antes del commit documental de cierre. Se entregaron sesiones vigentes, contratos, corrección de lint solicitada, fechas, repositorios IndexedDB y outbox atómica, con commits separados y validaciones. El usuario ha solicitado continuar este lote sin feedback mientras haya margen para completar otra entrega. Se reanudó `04a` con lectura 59%/38%. `04a–04b` ya verifican el shell offline y el cierre persistido; creación de tareas, navegación responsive y calendario ya se han incorporado; sincronización remota sigue pendiente.

## Prerrequisitos por confirmar en su iteración

- `01b` completada: sesiones antiguas sin fila persistida exigen login y autorización consulta DB vigente. La allowlist del piloto se mantiene; el recorrido Google real está pendiente de `15a`.
- `04a`: dispositivos/navegadores del piloto. Base de prueba propuesta: Chrome de escritorio/Android y Safari/iPhone instalado; ajustar al entorno real, sin prometer soporte no probado.
- `11a`: MongoDB con replica set o clúster compatible con transacciones. Si no lo hay, la sincronización definida necesita otro diseño aprobado antes de implementarla.
- `15a`: destino y configuración del despliegue existente, sin asumir proveedor ni publicar como parte de la planificación.

## Fuentes y decisiones

La arquitectura y las reglas funcionales son decisiones de este proyecto. Las limitaciones de plataforma se contrastan con fuentes primarias:

- Guías instaladas de Next.js: [PWA](../node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md) y [Server Actions](../node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Consultarlas de nuevo en la iteración que escriba ese código; instalar una PWA no garantiza funcionamiento offline.
- [IndexedDB — MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): almacenamiento local indexado y transaccional.
- [Persistencia y cuotas — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): almacenamiento sujeto a cuotas y posible expulsión.
- [Background Synchronization — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API): disponibilidad limitada; no será un requisito del funcionamiento normal.
- [Transacciones — MongoDB](https://www.mongodb.com/docs/manual/core/transactions/): atomicidad entre documentos y despliegues compatibles.
- [Límites de uso — OpenAI](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan): consumo variable según tarea y configuración. Las ventanas 5h/7d aquí son las comunicadas para esta cuenta; comprobar los valores vigentes después de cada entrega.

### Último corte de implementación

Lote reanudado cerrado al completar `05a1`: shell offline, cierre/cuentas, barras responsive y creación/listado de tareas. Lectura durante cierre: 19%/31%; consulta final tras commit comunicada al usuario. No se abre `05a2` por reserva insuficiente de 5h. Próxima entrega: editar y borrar tareas offline, seguida de categorías/estado, calendario y agenda. El MVP remoto/recurrencia/compartición sigue pendiente; no se presenta como completado.

### Reanudación del 7 de octubre

`05a2` completa edición y borrado offline con confirmación y protección frente a editores obsoletos. Lote reanudado con 100%/30% comunicados; las lecturas automáticas posteriores reflejan renovación de ambas ventanas (96%/99% durante el cierre). Se conserva la reserva del 20% y el control tras cada commit. Próxima candidata `05b1`, estados y checklist interactivos; categorías se separan para mantener entregas pequeñas.

`05b1` incorpora estados y checklist interactivos con intenciones por campo, recarga offline y acciones accesibles comprobadas en móvil. Próxima entrega: transacciones de categorías y preferencias (`05b2`) antes de su interfaz (`05b3`).

`05b2` deja operativas las intenciones locales de categorías y asignaciones personales: unicidad normalizada, tombstones, aislamiento, reintento y rollback comprobados en IndexedDB real. La interfaz de categorías es la próxima entrega (`05b3`).

`05b3` entrega pantalla de categorías, selector personal en cada tarea y navegación SVG coherente en ambas barras. Crear/editar/borrar/asignar/retirar funciona offline; nombre duplicado y confirmación en español. La clasificación actual se hace después de guardar la tarea, sin fingir un guardado conjunto. Próxima entrega: calendario mensual y día (`06`).

`05c` se intercala a petición del usuario: Google autorizaba la sesión pero el espacio no se preparaba automáticamente; en desarrollo la preparación además exigía un worker desactivado. Abrir `/workspace` prepara una sesión verificada sin segundo botón, conserva cierre/época y distingue un 401. En desarrollo se puede usar IndexedDB, tareas y categorías sin worker; la UI explica que reabrir sin red exige producción (`bun run build` y `bun run start`). Producción mantiene el requisito de shell completo antes de activar una cuenta. No cambia auth, permisos, allowlist, particiones ni outbox. Calendario sigue pendiente en `06`.

`06` completa mes, selección del día por URL, contadores reales, anterior/siguiente y Hoy en la zona de la cuenta. Crear desde un día preselecciona su fecha; el listado permite editar, borrar, cambiar progreso y categoría mediante los controles existentes. Las dos barras incorporan Calendario y SVG local. Navegación/recarga/creación sin servidores, fechas extremas y reflow al 200% comprobados. Próxima entrega: agrupación y atrasadas (`07a`); eventos/cumpleaños y repetición siguen en sus iteraciones posteriores.

`07a` agrupa las tareas del día por categorías personales, con “Sin categoría” cuando corresponde, y añade Atrasadas global en Mi espacio. Las pendientes anteriores a hoy mantienen fecha/estado; completarlas las retira de esa sección sin perder su historial en el calendario. Hoy y próximas contiene las fechas actuales/futuras; las completadas antiguas se consultan desde su día. El día de cuenta se revisa cada minuto con la app abierta y al recuperar foco/visibilidad; no hay cron, traslado de fecha ni nuevas intenciones por reclasificar. Un reloj simulado en iframe ficticio comprueba la transición de día con el servidor de aplicación detenido. Reordenación manual queda en `07b`.

`07c` retira de Mi espacio el resumen verde redundante con Ajustes. Las etiquetas inferiores usan tamaños en rem según anchura (11px a 320px, 12px desde 360px, con fuente raíz normal); escritorio conserva 14px. Se reproduce y corrige el cierre accidental de diálogos durante el doble montaje de Strict Mode en desarrollo: eventos de cierre antiguos no desmontan un diálogo reabierto. Crear/editar/confirmar, Cancelar, Escape y persistencia tras recarga comprobados. No se desactiva Strict Mode. Lote cerrado después del commit de esta corrección; próxima candidata `07b1` con nuevas cuotas.

`07b1a` entrega el motor de ranking y `tag.move` atómico: vecinos activos validados, compactación de posiciones agotadas, replay y rollback, sin tocar contenido compartido ni revisiones remotas. Lectores de categorías y grupos desempatan por ID; renombrar no reordena posiciones iguales. Los controles visibles dependen de completar también colocaciones de tareas (`07b1b`) antes de `07b2`.

`07b1b` conecta `task.move` para tareas simples a una transacción de colocaciones/categoría/cola, sin cambiar el contenido compartido. Días y atrasadas tienen órdenes independientes; el ancla global de atrasadas es constante, validando hoy según zona de cuenta. Se preservan posiciones/revisiones previas y las colas antiguas de ocurrencias siguen siendo legibles. Registros activos de atrasadas con ancla antigua bloquean escrituras hasta migración separada; no se borra ni transforma legado. Próxima entrega: controles y lectura visual del orden (`07b2`).

`07b2a` añade Subir/Bajar en gestión de categorías, con SVG locales y teclado. Los límites no escriben; foco y nombres accesibles se conservan al reordenar. Cuatro movimientos offline producen cuatro intenciones, renombrar mantiene orden y recarga persiste. Próxima entrega: conectar colocaciones y controles de tareas del día/atrasadas (`07b2b`).

`07d` aplica la prioridad móvil mínima: tareas de 66px en la muestra de 390px, completar/reabrir directo con hit area 44px, metadata breve y resto desplegable. Apertura se conserva por ID al cambiar de grupo, con foco en categoría; orden de grupos también desplegable. Cabecera sin marca/subtítulo repetidos y vacíos/separaciones menores. Operaciones completas y recarga sin servidores verificadas; 320px y texto al 200% sin overflow. Formularios/categorías/ajustes siguen el criterio permanente en sus siguientes entregas; no se presenta toda la UI como revisada.

`07d2` compacta el formulario de tareas: título/fecha/guardar visibles, descripción/pasos opcionales plegados en creación y abiertos al editar contenido existente. Plegar conserva los campos; error de paso abre la sección. En 320px, diálogo de creación de 353px de alto y botones de 44px; texto 200% sin overflow horizontal. Crear/editar/Cancelar/Escape y recarga offline verificados; tres intenciones totales en fixture (base, crear, editar), ninguna por errores/cancelación. Próxima candidata funcional sigue 08c1; no iniciar si el margen tras consulta y reserva 20% no cubre UI/lectores/pruebas/cierre.

### Cierre de esta continuación

Entregas `07b1a–07b3b`, `08a–08b`, `07d–07d2` cerradas individualmente. UI móvil compacta es criterio permanente en AGENTS; muestra de seis tareas visibles y formulario reducido comprobados. Última cuota al cerrar código: **25%/75% restantes**, tras `cfa8a9f`; consulta final posterior al commit documental se comunica al usuario. `08c1` queda pendiente por margen insuficiente sobre reserva20%, con motor temporal y persistencia ya disponibles. Sin implementación abierta; al reanudar comprobar cuotas y mantener ese corte antes de edición/borrado, repetición, cumpleaños y sincronización.

`07d3` compacta Categorías: filas plegables de 58px en 320px, nombre/color en la misma línea del formulario y menos padding/texto repetido. CRUD, cuatro movimientos incluidos arrastre/teclado, foco y recarga offline comprobados; texto al 200% sin overflow. El usuario ha reabierto el lote tras206fac6 para aprovechar24% mientras se aproxima renovación; reserva temporal descrita en workflow, sin depender de ella para cerrar cambios.

`08c1a` selecciona eventos simples por día/rango acotado, con consultas civiles inclusivas (1–62días), todo el día antes de temporizados y desempate por ID. El programa all-day sigue siendo final exclusivo; temporizados se proyectan a zona de cuenta y fin exacto a medianoche no ocupa el siguiente día. No genera eventos fantasmas en un día saltado ni omite visitas breves a un día por rollback horario. Legado ambiguo/gap se devuelve como issues separado de válidos; tombstones y series se excluyen hasta09. Motor puro aún no conectado a UI.

Al integrar contadores mensuales en08c1, preparar selección por rango y reutilizar resultados por render; las fechas inexistentes o sin solapamiento pueden exigir hasta1440sondeos de minuto, cacheados solo dentro de la consulta. Se comprobó corrección de casos raros en Bun; medir y optimizar esa ruta antes de conectarla repetidamente a cada celda. No confundir un helper validado con la pantalla de eventos entregada.

`08c1a2` reutiliza Intl.DateTimeFormat mediante factory por consulta, sin estado global ni selección arbitraria de offsets. Mismo diagnóstico de12eventos:31consultas independientes pasan de5161ms a706ms, rango mensual24→25ms, resultados intactos (medidas del host, no garantía móvil). Antes de UI: preparar snapshot/rango de una vez y no disparar consultas independientes por cada celda. Push3667c97 confirmado enint y estado GitHub/Vercel success; siguientes commits se publican bajo autorización de integración.

`08c1b0` crea un índice por snapshot de cuenta y prepara contadores/listas por fecha en un único rango1–62días. Cache por consulta/índice, sin estado global; tamaño acotado y reutilización entre celdas. Hook SWR de eventos por userId+epoch y guardia local existente. Muestra12eventos/31días: preparación191ms y3100lecturas1ms en el host, frente a706ms consultando individualmente; resultados/orden/legado/extremos conservados. Interfaz de eventos sigue pendiente08c1b1.

`08c1b1` conecta el+ a Tarea/Evento o cita con borradores conservados. Eventos temporizados o de días completos se guardan localmente, aparecen en agenda de dos semanas y mes/día con contadores conjuntos, y permiten categoría personal tras guardar. Filas compactas52px, calendario con final exclusivo, zona de cuenta y recarga sin servidores comprobados. Editar/borrar evento es la siguiente entrega08c2; cumpleaños/recurrencia/sync siguen pendientes.

`08c2` completa eventos simples: editar título/descripcion/programa, convertir a día completo y borrar con confirmación/tombstone. Legado horario inválido admite reparación/borrado explícitos. CAS preserva cambios de otra pestaña y el borrador del editor; tras rechazo se relee caché antes de reabrir. Contadores/recarga offline comprobados; próxima09a.

`09a1` entrega fechas de repetición diaria/semanal/mensual/anual, con count global/until inclusivo, meses sin31/bisiestos y paginación. Consulta lejana salta al rango y devuelve cursor explícito; aún no habilita formularios ni genera instantes/estado de ocurrencias. Próxima09a2.

`09a2` proyecta apariciones puras por slot original: estado/checklist independientes de tarea, eventos con longitudcivil/horaslocales conservadas, IDs estables y problemashorarios identificados poraparición. Páginas limitadas avanzan incluso con incidencias. Persistencia/excepciones y formularios de repetición siguen09b–09c.


`09b1` materializa estado/checklist por aparición en la misma transacción que su intención y secuencia. El padre y otras apariciones conservan su contenido; replay y rollback comprobados en IndexedDB real. Lectura/UI de repetición siguen pendientes tras edición/cancelación `09b2`.


`09b2` añade contenido por aparición compatible con registros anteriores, edición/reprogramación y cancelación con snapshot de serie y aparición. Mantiene progreso y slot original; las operaciones siguen sin UI hasta completar lectura/orden de repetición.


`09b3a` proporciona páginas virtuales por serie y páginas de excepciones por fecha efectiva. Las canceladas/borradas suprimen el slot original; reprogramadas entran desde otro mes sin duplicados. Ambos cursores son explícitos, incluidas páginas vacías de backlog. Sigue pendiente conectar lectores/orden/UI.


`09b3b` lee series/excepciones/settings en una transacción readonly y comprueba cuenta/epoch antes y después. Incluye tombstones necesarios para suprimir slots, rechaza datos inválidos sin resultado parcial y cierra conexión incluso al fallar. Lectura coherente comprobada entre escrituras; falta integrar colocaciones y UI.


`09b4a` ordena tareas simples y apariciones en un día, incluidas reprogramadas, sin materializar progreso ni tocar contenido. La categoría se conserva personal por serie y el orden por aparición/día. Backlog repetido y UI/formulario siguen pendientes; no se habilitan antes de sus dependencias.


`09b4b1` resuelve una tarea/aparición por identidad original con una sola consulta de slot, sin expandir años de backlog. Guarda la semántica de excepciones históricas y se reutiliza al validar el target del día. Ordenar backlog de apariciones y conectar UI de repetición siguen pendientes.


### Cierre tras09b4b1

Lote completado hasta lookup de referencias: estado/checklist, edición/cancelación, selección paginada, snapshot coherente y orden mixto del día, con commits y push aint individuales. Lectura previa al cierre documental28%/61%. La siguiente entrega modifica orden/paginación/persistencia y necesita más que ocho puntos sobre reserva20%; cortes comparables anteriores consumieron7/8 puntos sin contar incertidumbre compartida. Se documenta propuesta y subentregas en [backlog-ordering](backlog-ordering.md), sin modificar schema ni activar el ejecutor pendiente. No hay código abierto; UI de repetición, cumpleaños, sincronización y compartición siguen pendientes. La próxima sesión requiere ambas lecturas nuevas para elegir09b4b2a.

### Cierre de la continuación del 8 de octubre, 00:16

Se entrega hasta `13a1a`, con sincronización de tareas y eventos propios sin repetición mientras la aplicación esté visible y con red: repositorio y CAS, recibo y journal atómicos, descarga con checkpoint, ACK y cursor locales, coordinador y leases, botón de Ajustes, motor automático con backoff, señal de guardado y aviso compacto. Dos orígenes de IndexedDB con MongoDB aislado verifican convergencia simple, progreso dependiente, replay tras perder la respuesta, tombstones y conservación de conflictos.

Código cerrado en `f4ba680`: 184 pruebas pasan, 30 opt-in omitidas y ningún fallo; lint, tipos y build de 30 recursos aprobados. Google interactivo y el RPC de Next en el entorno real requieren el piloto; la prueba React sustituye la referencia de acción por HTTP solo en la fixture. Preferencias, series, cumpleaños, compartidos y resolución explícita siguen pendientes.

Antes del cierre quedan 12%/44%, con reserva del 10%. `13a1b`, snapshot de incidentes, no cabe con pruebas, reparaciones y cierre en ese margen. La única revisión posterior está programada para el 8 de octubre a las 05:18 de Madrid, más de un minuto después del reinicio real de 5h a las 05:16:33. Comprobará las cuotas y continuará desde el último HEAD completo. El heartbeat actual queda pausado; no se consumen créditos ni se crean nuevas cadenas.


### Cierre de la segunda continuación, 8 de octubre, 05:18

El lote autorizado partió de la renovación real con 100%/43% y reinicio 1791447514. Se entrega hasta 13c1d: lectura y comparación de incidentes; supersesión local diferenciada de ACK y elecciones explícitas de adopción, reintento o copia; pruebas de dos dispositivos con MongoDB; recuperación de sesión, cierre y leases; compatibilidad de protocolo; actualización del worker; backup portable, lectura coherente y descarga offline. Cada iteración tiene commit y push en int, con HEAD remoto verificado. Se preservaron cambios ajenos y no se tocó la DB, los secretos o la configuración de producción.

La lectura previa al cierre es 13%/30%, con reserva del 10% en ambas ventanas. Tres puntos no cubren la siguiente implementación con pruebas, reparaciones y cierre. Los últimos cortes consumieron tres puntos para el snapshot, seis para la descarga y tres para las guardias mínimas; el contrato anterior consumió ocho con reparaciones. Las lecturas pueden incluir otros chats y no garantizan costes futuros. El repo queda coherente y sin código abierto.

La automatización puntual continuar-sincronizaci-n-siguiente-ventana queda PAUSED. La autorización cubría esta última revisión; no se crea otra cadena ni se usan créditos o reinicios.

La siguiente candidata es 13c2a: preview puro de un archivo validado y del snapshot propio actual, sin escribir ni enviar. Clasificará contenido nuevo, idéntico, cambiado, tombstones y tipos sin ejecutor, conservando los datos no admitidos. El contrato y ejecutor de importación vendrán después, con UUID nuevos y confirmación sólo tras pruebas. Nunca restaurar directamente ACK, cursores, leases, revisiones remotas o permisos.

El piloto de Google y RPC de Next real sigue pendiente. Preferencias, series, cumpleaños y compartidos todavía no se sincronizan. Rechazos sin acceso y cadenas externas permanecen conservados. Reanudar exige nueva autorización y ambas cuotas; vuelve el protocolo normal de consulta tras cada iteración salvo otro lote explícito.


### Corrección intercalada del preview protegido, 8 de octubre

`13b2b`: el precache enviaba `credentials: "omit"`, lo que impide presentar la cookie de acceso de Vercel y provoca redirecciones SSO/CORS al preparar recursos. Se cambia a `same-origin` conservando las guardias de caché neutra. Pruebas con gate simulado; la comprobación en el dominio real sigue pendiente tras publicar. Corte mínimo autorizado con aproximadamente 8% de 5h, sin ampliar la sesión ni cambiar protección del despliegue. Próxima candidata `13c2a`.


### Reanudación del 8 de octubre: importación

`13c2a` entrega comparación íntegra y pura de los once stores por identidad, incluidos borrados y registros sin ejecutor, sin escrituras ni envío. Siguiente `13c2b`: contrato de elecciones explícitas e intenciones nuevas; después ejecutor atómico y UI. El usuario confirma el acceso al preview tras `13b2b`; Google/RPC Next real requiere sesión de piloto y sigue pendiente.


### 13c2b — Contrato de copias nuevas

La importación selecciona explícitamente elementos propios simples vivos y construye nuevas intenciones de creación, sin reemplazar originales ni restaurar datos de sincronización. Archivo y comparación preservados, límites y UUID/historia revisados. Próxima `13c2c1`: registro durable y validación del backup; después atomicidad/replay y UI.


### 13c2c1 — Registro de importación

Contrato de metadata preserva archivo/selección e historial exacto sin ACK ni autorización remota. Exportación y validación reconocen el recibo; lectores anteriores rechazan metadata nueva sin borrarla. Próxima `13c2c2`, escritura atómica y replay; UI posterior.


### 13c2c2 — Ejecutor de importación

Copias/cola/contador/recibo atómicos, replay durable sin sobrescribir progreso y fallo tardío con rollback comprobados con IndexedDB real propio. Sin UI todavía; guardias workspace de cuenta/época en `13c2c3`, luego confirmación compacta y prueba de sincronización de copias con dos dispositivos aislados.


### 13c2c3 — Cuenta y confirmación estable

Lectura/prepare/commit de workspace capturan identidad y decisiones, invalidan épocas obsoletas y conservan guardados propios ante cambio de cuenta. Once checks de IndexedDB incluyendo recarga aprobados. Próxima `13c2d1`, UI compacta de selección/confirmación en Ajustes.


### 13c2d1 — Importación desde Ajustes

Selección paginada y confirmación compactas entregadas; copias nuevas conservan originales y archivo, sin restaurar ACK/cursor/permisos. UI offline y14escenarios con dos dispositivos/MongoDB comprobados en paralelo con rutas propias. Próxima11c0, diseño acotado de preferencias personales/categorías/orden; Google/RPCNext real sigue pendiente de piloto.


### 11c0 — Ampliación personal

Código local y wire revisados en paralelo; cambios multirregistro, revisiones por documento, tail/dependencias, sentinel atrasadas y contexto civil identificados. Se documentan cortes y transición futura wire2/intención1 sin modificar protocolo activo ni historia. Siguiente11c1a DTO puro; settings productor, movimientos temporales y recurrencia quedan explícitamente posteriores.


### 11c1a — Contrato preparatorio personal

Efectos con propiedades/claves/revisiones/bytes estrictos y39aserciones entregados, sin cambio de wire ni ACK personal. Siguiente11c1b1 extracción pura del reductor vigente, antes del planner/CAS remoto.


### 11c1b1 — Reductor reutilizable

Transformaciones personales vigentes extraídas sin cambio de comportamiento ycompactación multirregistro probada. Adapter local conserva API. Próxima11c1b2a planner de categorías/CAS preparado, antes deDB ywire.


### 11c1b2a — Planner de categorías

CAS/creación/borrado/movimiento conefectos completos yrevisión propia preparados; sinIO/ACK/wire nuevo. Próxima11c1b2b planner devista personal, antes deDB/compatibilidad/ACK/pull.


### 11c1b2b — Vista personal preparada

Asignar/cambiar/quitar categoría conCAS propio, sin alterar contenido ysinactivar envío, comprobado. Próxima11c2a0 proteger registro deíndices latentes antes delrepo propio personal.


### Piloto mínimo preproductivo15a0

Sesión activa delusuario en navegadorintegrado, revisión automática/manual concola vacía yrecarga comprobadas enint. Datos existentes conservados, sesión/pestaña abiertas. No se declaraServerActionpush/ACK deescritura ni convergencia multicliente real; piloto15a1 requierepresupuesto paraelementos propios de prueba ysu limpieza. Registro en [sync-test-environment](sync-test-environment.md). Implementación siguiente11c2b1 conservaorden delplan.


### 11c2b2a2 — Replay verificado

Lector común de recibos legacy/v2 ahora dispone de comprobación del fingerprint de intención v1: mismo UUID con otra base/payload/familia se rechaza, sin escrituras ni nuevos permisos. MongoDB aislado demuestra aislamiento, sesión y conservación de historia; pruebas/tipos/lint/build aprobados. Continúa preparatoria la ampliación personal. Siguiente 11c2b2b: efectos y contador/journal/recibo atómicos, después carreras 11c2b3.


### 11c2b2b1 — Commit de categorías preparado

MongoDB aislado confirma CAS multirregistro, contador/journal/recibo atómicos, replay/rollback tardío e historial mixto con el executor item. Las categorías aún no se envían desde la app: compatibilidad y carreras con snapshots solapados siguen pendientes. Reserva vigente por petición explícita del usuario:10%5h/5%7d. Siguiente11c2b2b2, asignación personal de categorías a elementos con autorización vigente dentro de la transacción.


### 11c2b2b2 — Asignación personal preparada

Executor propio de vista comprobado con CAS, autorización dentro de la sesión, contenido intacto y rollback. Reutiliza contador/journal/recibo transaccionales con categorías. Mongo37pass/363aserciones; futuras carreras con barreras11c2b3 y compatibilidad siguen pendientes antes de activar envío. Reserva vigente revisada por usuario a10%5h/2%7d; las entradas previas mantienen su contexto histórico.


### 11c2b3a — Concurrencia del contexto propio

Cinco carreras Mongo con barreras prueban relectura tras create/delete de vecinos, delete de item/tag y nombres NFKC simultáneos, sin efectos parciales ni huecos. Contador común verificado para esos contextos propios; permisos compartidos/series quedan fuera. Contratos/lectores mixtos y ACK/pull/backup/dos dispositivos siguen pendientes antes de activar categorías/vistas remotas.


### 11c3a1 — Página mixta preparatoria

Contrato puro para descargar ambas familias sin saltos/filtros ni avances vacíos, con propietario/query/checkpoint verificados y2MiB UTF8 por página. Legacy journal será normalizado a item/v2 por reader futuro; páginas legacy/futuras rechazan. Suite/tipos/lint/build aprobados. Siguiente11c3a2, lector Mongo mixto con paginación por bytes; wire/ACK/pull personales permanecen posteriores.


### 11c3a2 — Descarga mixta en Mongo preparada

Reader propio adapta historia legacy sin reescribirla, mantiene checkpoint/autoridad snapshot y pagina por count/2MiB sin omisiones. Mongo46pass/475aserciones, incluida continuación de28registros grandes íntegros. Sin activación en ruta/coordinador; contratos push mixtos, servicios/handshake y ACK/pull/backup locales siguen antes de activar preferencias.


### 11c3b1a — Intención1 y transporte2 preparados

Contrato push versionado conserva UUID/payload/fingerprint durables1; verifica actor, prefijo completo, familia/objetivo y límitesUTF8. Sin negociación ni ACK/config activa nuevos. Siguiente11c3b1b, separación de versiones y compatibilidad preparada antes de servicios ymetadata/pull personales.


Cierre del lote del 9 de octubre: última entrega de código 4f0dc93; 407 pruebas correctas, tipos/lint/build aprobados. Próxima revisión automática confirmada para las 05:27 Europe/Madrid, tras el reset publicado 05:25:13. Continuación desde 11c4a7p y la preparación concreta de [activación personal](mixed-sync-activation.md), con cuota real y último HEAD completo. Las categorías aún no están activadas en la aplicación.


### Cierre de la ventana9oct05:27

Código cerrado7525376 y cierre documental posterior; pruebas440pass/93opt-in skip sin fallos, lint/tipos/build34 aprobados. Frontera RPC Next con sesiones sintéticas/Mongo propios comprobada en siete escenarios; producto sigue transporte1. Provisión parcial propia, preview completo y destino/ciclo por puertos preparados; siguiente11c4a8e2b defaults/CLI+11c4a8t prueba propia antes de ejecución de entorno autorizada y conexión conjunta. Lectura10%5h/56%7d, reservas4%/1%. Única revisión verificada9oct10:29Madrid tras reset real1791534432 (10:27:12); al despertar confirmar renovación/HEAD/cuotas. No DB del usuario ni activación parcial.


### 11c4a8auth — Autorización explícita de índices preproductivos

Objetivo y target_paths: registrar autorización humana en plan/personal-index-provisioning.md, mixed-sync-activation.md, master.md, workflow.md, iterations.md e iteration-log.md y actualizar el heartbeat existente sin cambiar horario/política. Dependencias: procedimiento preparado hasta7525376 y próxima revisión10:29. Aceptación: usuario confirma DB distintas y autoriza crear índices personales necesarios y automáticos registrados faltantes únicamente en preproducción, reutilizando ensureIndexes después de validar procedimiento, sin otra confirmación. Producción excluida; no borrar/corregir datos ni reparar incompatibilidades automáticamente. Esta autorización sustituye exclusiones históricas de DB del usuario sólo para esa provisión. Verificar conexión preview/int desde fuente de configuración de entorno; nunca asumir que .env.local es preview ni conectar para averiguarlo.

Lectura6%5h/55%7d, reservas4%/1%: sólo cierre documental ahora; defaults/CLI/prueba propia y ejecución preproductiva continúan en revisión10:29 tras verificar renovación. CLI Vercel/project link local no disponibles en comprobación inicial; resolución del destino permanece pendiente, sin acceso a DB ni credenciales impresas. No confundir autorización con ejecución o categorías activadas. Validación documental referencias/consistencia/diff, actualización de heartbeat preservando campos, ConventionalCommit/pushint/HEAD/cuotas.


Actualización9oct10:29 —11c4a8e2b: CLI online separado y adapter privado preparados; validan destino/config explícitos antes de singleton y cierran conexión del proceso operador. Suite443pass/93skip sin fallos, lint/tipos/build34 aprobados. Siguiente prueba CLI/defaults en Mongo propio11c4a8t; todavía producto transporte1. Vercel Preview/Production identificados sin revelar valores; nombre DB preproductiva pendiente de respuesta. La creación de índices preproductivos ya está autorizada, falta acreditar destino/procedimiento, no otra aprobación. Reservas4%5h/1%7d; renovación100%/55%, reset real15:29:20Madrid.


11c4a8t cerrado: CLI/defaults/procedimiento completo probado en Mongo propio (3casos/70aserciones), limpieza terminada; lint/tipos/suite443pass98skip/build34 aprobados. Provisión preproductiva ya autorizada pero no ejecutada: nombre explícito solicitado al usuario, configuración Preview localizada. Producto aún transporte1. Siguiente ensamblajecliente2 inactivo/controles y retirolegacy antes de activación conjunta y piloto.


11c4a9c1 preparado y probado: dispatcher/resumen/controlescliente2 independientes; guardias cuenta/época, diagnóstico y cierre preservados. Suite451pass98skip sin fallos; lint/tipos/build34 aprobados. Producto sigue1 y manifiesto conserva una solaacción, sin activarendpointmixto. Siguiente composición privada y retirolegacy/matriz; provisiónpreprod espera nombre explícito solicitado.


11c4a9c2 preparado: composición cliente2 completa y retirementcompatible de pushlegacy, sin caller activo. Ocho tests79aserciones prueban identidadcapturada, refreshguardado y actualización sinACK tras handshakeviejo. Suite459pass98skip sin fallos/lint/tipos/build34. Próxima pruebaNext directa de estas conexiones, sólo recursos propios; nombreDBpreproductivo pendiente. Producto sigue1.


11c4a9n probado: nueve escenarios Next, dispatcheracción2 directo y composicióndefault sin sustitución de puertos, con dos sesiones/IndexedDB/Mongo propios. Ambosdispositivos proyectan exactamente tareas/categorías/asignaciones y cursor del journal; ACK, replay/noop y retirolegacy sin mutaciones comprobados. Recursospropioslimpios; suite459pass98skip/lint/tipos/build34 aprobados. Transporte productivo aún1, nombreDBpreproductivo pendiente, autorizacióníndices ya concedida.


11c4a9r: diez escenarios Next correctos; sesión revocada conserva toda la intención/cola/cursor, reautenticación del mismo actor confirma una sola vez y ambos dispositivos convergen con Mongo propio. FullDoD aprobado y recursos propios cerrados. Producto sigue transporte1 y provisión preproductiva espera únicamente nombre DB explícito, con actuación ya autorizada.


15a2f corrige la integración del selector de categoría de tareas: ahora crea item-view.set; el orden explícito mantiene task.move local. Seis checks browser, suite/lint/tipos/build aprobados. Piloto real confirmó categoría propia y encontró un task.move histórico de asignación que se conserva sinACK: esa cuenta aún tiene cadena personal bloqueada. Falta piloto del arreglo desplegado y recuperación del histórico; no declarar convergencia por settled ni presentar toda la sincronización de preferencias como terminada. Al cerrar categorías/asignaciones, estimar porcentaje y ordenar pendientes para que el usuario elija; detener continuación de bloques ajenos.


### Resultado11c5a9 — Dispatcher/acción3 y readiness de cuatro índices preparados

Dispatcher3 valida intención1/actor y enruta task.move al executor multiefecto, reutilizando2 para otros comandos sin reescribir UUID/payload/receipt. Acción y cliente3 preparados conservan envelope2, sesión BetterAuth/allowlist y guardia de cuatro índices antes de ejecutar. Selector/inspector4 exige placement único exacto registrado; active2 mantiene selector3 y schema de provisión3 intactos. Mongo propio prueba UUID histórico unsupported2 sin receipt → ACK3 único/replay exacto → dependientes tag/view con revisiones independientes → descarga íntegra; foreign/identity reuse/deleted-source replay y ocurrencia/event/serie unsupported. Mongo75pass/0fail/985aserciones16archivos, recursos propios retirados. Suite493pass/123opt-in skip/0fail/7905aserciones; lint534/tipos/build34/diff aprobados. Producto sigue negociación2 y no se han creado índices en DBusuario. Próxima composición cliente3/cache separado y pruebas Next de transición; operador/provisión4 validada y conexión conjunta antes de activar. Movimiento piloto pendiente conservado. Commitpushint/HEAD/cuotas.


### Resultado11c5a10 — Cliente3 y caché preparados

Núcleo compartido captura cuenta/época inmutables y conserva attempt/runtime, guardias de refresh y coalescencia/cierre. Wrapper3 selecciona transport3/acción3 juntos; cliente activo2 mantiene sus defaults. Clave de resumen2/3 conserva posiciones cuenta/época e invalidación común, pero distingue generaciones; hook activo conserva exactamente key2. Siete tests nuevos prueban DTO2/intención1, anuncio1/2 rechazado antesbody/dispatch, identidad capturada, refresh/account loss, stop-before-open, caché/guards; tests existentes2 pasan. Suite500pass/123opt-in skip/0fail/7948aserciones, lint539/tipos/build34/diff aprobados. Primer fixture usó nombre de método incorrecto y literales ampliados; corregidos y compilación final aprobada. Sin migración de metadata/caller3/capabilities/provisión. Próximas pruebasNext reales de transición, operador4/provisión autorizada y conexión conjunta. Commitpushint/HEAD/cuotas.


### Resultado11c5a11 — Provisión4 por puertos validada

Inventario4 estricto y nombres centrales incluyen placement; motor común mantiene semántica/schema/API3 y planifica exclusivamente definiciones registradas/clonadas. Antes de cada creación y al final inspecciona de nuevo, incompatibilidad bloquea toda escritura, prefijos parciales/respuesta perdida se observan sin inferir éxito ni borrar/reparar/reintentar indefinidamente. Seis tests4 nuevos y nueve previos3 pasan: maxcinco inspecciones, noop, corrupción, duplicate_data, falta persistente y failed-call aplicado. Suite506pass/123opt-in skip/0fail/7976aserciones; lint543/tipos/build34/diff aprobados. Ningún caller/default/CLI/conexión4 ni DBusuario aún: operador/destino/lifecycle y pruebaMongo propia próximos, antes de provisiónPreview autorizada. Producto sigue2; piloto histórico intacto. Commitpushint/HEAD/cuotas.


### Resultado11c5a12 — Operador4/defaults/CLI probado en Mongo propio

Proceso separado comparte validación destino/acuse y ciclo de conexión con operador3, exige DB real despuésbootstrap y cierre antesready. Defaults4 reusan singleton/ensureIndexes automático9 y selección personal4; scripts preview/provision específicos, URI sóloenv privado y recibo finito saneado. Cuatro tests lifecycle nuevos y cuatro previos3 pasan. Mongo propio3casos88aserciones: destino/argumentos/env erróneos no recrean automático9 retirado por fixture; CLI/defaults bootstrap9+personal4 y noop; duplicate placement conserva documentos/prefijo3, retry sóloplacement tras retirar exclusivamente duplicado del fixture. Recursos propios limpiados. Previewoffline9+4 confirmado sinDB. Suite510pass/128opt-in skip/0fail/7998aserciones, lint550/tipos/build34/diff aprobados. FuenteVercel consultada readonly: MONGODB_URI Preview sigue enlazada al recurso debug distinto deProduction, listado sinMONGODB_DB/overrideint; valoresno revelados. ProvisiónPreview4 pendiente y ya autorizada, nombreDB confirmado; no conexiónDBusuario en este corte. Nextmatrix/jointactivation/piloto posteriores. Commitpushint/HEAD/cuotas.


### Resultado11c5a13 — Placement Preview provisionado ready+closed

Procedimiento4 publicado bafeaa9 y probado Mongo propio ejecutado únicamente en fuentePreview/int verificada deVercel (recurso debug diferenteProduction; sinMONGODB_DB/overrideint). DBconfirmada dalis-tasks-events. Recaptura privadaURI en fichero600 fuera repo, descriptor estricto sólo{mongodbUri,databaseName}, padre/hijo no-env-file/react-server, credenciales sóloenvprivado y targetguardantesbootstrap/DBrealdespués. Recibo real saneado: statusready/phasecomplete/connectionclosed; provisioningready; created sólo task_placements_user_scope_date_occurrence_uidx; missing[]/incompatible[]/errornull. Los tres índices personales previos ya estaban listos; no modificación de datos, reparación/borrado ni accesoProduction. Credencial oculta enVercel y fichero/launcher temporal eliminados; ningún secretoargs/log/repo. Operación completada9oct21:26Madrid. Producto sigue negociación2; requisito índices4 cerrado, falta Nextmatrix/clientehook3/jointactivation/dosdispositivos/piloto histórico. Validación documental referencias/coherencia/diff; commitpushint/HEAD/cuotas. No anunciar convergencia ni ACK productivo del movimiento aún.


### Resultado11c5a14 — Hook3 privado y lifecycle compartido preparados

Wrapper2 conserva cliente2/key2 y proveedor activo; wrapper3 preparado captura cliente3/key3. Núcleo único conserva scheduler/señales/listeners/unsubscribe/cancelación/cierre, guardias cuenta/epoch e invalidación por cuenta; pass/controlador ahora también poseen generación para no mostrar/solicitar estado de otro protocolo. Sin caller3/provider/rutas/capacidades ni metadatarewrite. Extracción revisada contra código previo; suites composición/cache/controles y full510pass/128opt-in skip/0fail/7998aserciones, lint552/tipos/build34/diff aprobados. Compilación no prueba lifecycle3 ni convergencia: sigue requerida fronteraNextreal/matrix/retiro2/IDausente y dosparticiones con productor task-move-outbox antes de activar. ÍndicesPreview4 ready+closed en699c075; movimiento piloto intacto/sinACK productivo. Commitpushint/HEAD/cuotas.


### Resultado11c5a15 — Política3 pura de movimientos preparada

Registro3 independiente/inmutable añade taskPlacements y task.move; reader común mantiene2 sin soporte. Sólo permite movimiento de tarea simple conocida con occurrenceIdnull, validando comando/contextID; contexto ausente/event/birthday/recurrence/ocurrencia permanece unsupported y requiere siempre remoteValidation. No atribuye ownership ni éxito por contexto local, no nuevos callers/capacidades activas. Cuatro tests nuevos matrix/familias/canonical/futuros/immutability y cuatro previos2 pasan. Suite514pass/128opt-in skip/0fail/8032aserciones, lint553/tipos/build34/diff aprobados. Próximo policy bundle explícito para diagnóstico/resumen/coordinador/runtime3 que incluya stores y reader coherentes, después Nextmatrix/dosparticiones/jointactivation; movimiento histórico intacto. Commitpushint/HEAD/cuotas.


### Resultado11c5a16 — Policy3 coherente en runtime privado

Bundle inmutable reader+stores2/3 explícito cruza diagnóstico, resumen, coordinator (antes/despuésclaim y validaciónrespuesta), runtime y composición3 preparada. Defaults/firma anteriores conservan2, senderIdtercerarg y cuartoargpolicy explícito; wrappers3 eligenresumen/runtime3. Cinco tests nuevos: default2 no claim del histórico, fixture3 conserva UUID/payload/deps al aplicar movimiento+vista dependiente, contexto se vuelve recurrente trasclaim y noenvía/libera sólopropio, placementenrespuesta2/settingsen3 sinACK, resumen3 listo sinreescribirpending ni afirmarconvergencia. Fixtures puros no sustituyen Mongo/Next/dosparticiones. Suite519pass/128opt-in skip/0fail/8077aserciones, lint553/tipos/build34/diff aprobados. ÍndicesPreview4 ready+closed en699c075; provider/API activos siguen2. Próximo11c5a17 pruebaNextreal de matrix/retiro2/IDausente y dosparticiones con productor task-move-outbox; luego activaciónjoint/pilotoGoogle original. Commitpushint/HEAD/cuotas.


### Cierre11c5a16 — Próxima frontera tras renovación

Código5902599a89c840dedf6862e3c1ba043c4148571d completo/publicado con HEADorigin/int exacto, repo limpio y recursos propios cerrados. Últimas519pass/128opt-in skip/0fail/8077aserciones, lint553/tipos/build34 aprobadas. Mongo dispatcher75pass985aserciones y operador4 trescasos88aserciones; ACK/pull/incidentes reales anteriores conservados. ProvisiónPreview REAL4 cerrada ready+closed en699c075: sólo índiceplacement faltante creado, sin datos/producción. FuentePreview distinta confirmada, secretos ocultados/eliminados; tabs15guía y30Google conservados, tab34readonly propia cerrada.

Lectura9%5h/10%7d, reservas4%/1%. Siguiente prueba Next/auth/two-partition requiere más que cinco puntos disponibles hastareserva más reparación/cierre; no abrirla ni activar parcialmente. Resetfuturo real1791588799 (10oct01:33:19Madrid), reloj9oct21:37Madrid. Revisión única de este heartbeat ACTIVE confirmada para10oct01:35Madrid (>=unminuto redondeadoarriba), COUNT1/failed_runs_only/chat preservados, sin duplicados/créditos/reinicios. Reanudar desdeúltimoHEADcompleto confirmado; anuncio/provider/API siguen2 y piloto histórico sinACK.

Siguiente11c5a17: adaptar fixtureNext compilado para comprobar preparedaction3/defaults4/policy3/header3, retiro2 aunqueidentity2/pull2capturados y oldIDausente404 sinACK, matrix2↔3 antesbody/cache/cursor. Reutilizar runner/templates con sesionesBetterAuth y dosparticiones/Mongo propias; productor realtask-move-outbox mantieneUUID/payload/deps→ACKúnico/replay→dependientes→convergenciaexacta (peer/view/placement), lifecyclehook3 real/guardias/cancelación. Dividir frontera/movimiento/lifecycle en cortes coherentes anteseditar si margen exige. No extrapolar fixtures aGoogle real ni dospestañasIAB a dosdispositivos; pedir segundo dispositivo sólo si falta al piloto final. Activaciónjoint después: exclusivo3/no2–3, identity/pullheaders3/action3/client3/hook3/cache3/provider/context/UI, retiroactions2 antesreadiness/executor; envelopes/evidence2/intention1 intactos. Al cerrar categorías/asignaciones informar porcentajeponderado/titulares pendientes y esperar elección humana antes otrosbloques. Cierre documental referencia/coherencia/diff, commitpushint/HEAD y consulta finalcuotas.


### Resultado11c5a17 — RPC3 y dos particiones completos

Diecisiete escenarios Next compilado/React/IndexedDB/Mongo propios pasan: acción3 real/defaults4, header3 exclusivo y sobres2, matrix2↔3 antesJSON, UUID/payload/deps del productor task-move-outbox preservados, commit remoto con respuesta perdida sinACK local, replay único y dependientes confirmados, proyecciones exactas tags/views/placements en dos orígenes independientes. Retiro2 tras handshake2 capturado y acción ausente404 real no mutan Mongo ni ACK; lease propio liberado y siguiente handshake3 bloquea antesclaim, recuperación con intento2. Hook3/cache3 real conserva época, account guards, desmontaje y listeners; sesiones revocadas/caducadas/unverified rechazadas. Download3 privado usa readiness4 y mismo reader/envelope2; defaults2 activos intactos. Primer buildfixture detectó nombres de campos inexistentes en el test, corregidos; última ejecución completa exit0, todos recursos propios retirados. Suite520pass/128skip/0fail/8084aserciones, lint554/tipos/build34/diff aprobados. No Google interactivo ni IDexacto Vercel probado; índicesPreview4 ya ready+closed. Siguiente11c5a18 conexión conjunta provider/context/identity/pull/action2 retirement/UI3 y piloto original, sin reescribir intención1/metadata/cursors. Commitpushint/HEAD/cuotas.


### Resultado11c5a18 — Generación3 activada conjuntamente

Identidad/pull3 exclusivo, acción3/cliente/runtime/hook/cache3 y provider/context conectados; acción2 retorna update_required antesreadiness/executor. UI declara categorías/asignaciones/orden de tareas simples, manteniendo repeticiones locales. Sobres/journal2 e intenciones1 sin migración de UUID/metadata/cursors. Fixture consume rutas/provider/action2 reales del producto y los17escenarios Next/React/IndexedDB/Mongo propios vuelven a pasar, incluidos pérdida de respuesta/replay único/dependientes/proyección exacta y transiciones; recursos propios limpiados. Suite521pass/128skip/0fail/8087aserciones, lint554/tipos/build34/diff aprobados. Publicación int habilita sólo preproducción; pilotoGoogle histórico sigue como aceptación operativa siguiente, sin afirmar convergencia real aún. Copia JSON previa del IAB conserva7items y movimiento pending; Chrome ya autenticado con7items, almacenamiento independiente. La exportación esperó al navegador; al retomar reloj10oct07:26Madrid, cuota100%5h/7%7d y reset1791627993, sin código ajeno ni nueva tarea abierta. Continuación mismo objetivo/reservas4/1, sin consumo de créditos o resets. Commitpushint/HEAD/cuotas, después comprobar deploymentReady/recarga/offline/piloto original.


### Ajuste de cierre11c5a18

La comprobación diff detectó un espacio final en el template ya probado; retirado sin cambios semánticos. El recibo Next17 y DoD código anteriores siguen válidos; diff final corregido. La copia previa contiene8registros de items, incluidos borrados, y la UI7activos; un task.move pendiente attempts0/deps0. Este ajuste documental/formato corrige la precisión del registro anterior y no altera datos del piloto. Validación diff/referencias, commitpushint/HEAD/cuotas.
