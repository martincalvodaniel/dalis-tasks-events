# Recuperación explícita de conflictos

**Estado vigente19c6:** elecciones activas para raíces legacy y planes comunes sin repetición ni cadenas externas. Adopción/reintento/copia probados en Next/IndexedDB/Mongo con diálogo real. Ajustes también ofrece adoptar/reintentar la zona personal con transacción/evidencia y guardias propias; no cambia planes ni simula ACK. Quedan cadenas de contenido+categoría, otras preferencias y casos de apariciones con otros slots/dependencias, remoto ausente o copia. 19c1–2 preparan adopción de una aparición con padre/slot/cadena/evidencia exactos y executor/backup probados en26Next6.19c3 activa adopción y19c6 añade reenvío completo desde Ajustes con diálogo real ypreview;27Next6 prueban chain/replay/ACK. Copia yotras cadenas de apariciones siguen pendientes. Las cancelaciones/tombstones remotos se conservan, remoto ausente no se interpreta como permiso. Los apartados siguientes conservan la secuencia histórica.


## 19a1 — Planner de conflictos de planes simples

Opt-in `allowPlans` en planner/choices, false por defecto: callers actuales permanecen intactos. Las cuatro variantes sin repetición permiten adoptar remoto sin operación/ACK, reenviar todo el borrador con nuevoUUID/CAS de revisión remota conocida, o crear copia conIDnuevo ante tombstone sin resucitar original. Se conservan variant, estado, checklist y schedule. Valida comandos mediante planCommandSchema y política común existente; bloquea identidades ajenas, series, snapshots cambiados, chains externas e intentos inciertos. No usa shadow como ancestro ni fusiona campos.

Diez tests nuevos de cuatro variantes/elecciones/invariantes;21tests/144aserciones con regresiónlegacy al primer corte, suitefinal840pass/223skip/0fail/10844aserciones, lint851 sin avisos/tipos/buildWebpack/worker46. Se corrigió testlease para usar ownerId y se eliminaron aserciones no nulas. No nuevos índices, DBusuario, UI activada o cambios de protocolo/formatos. Siguiente19a2: extender executor local guardado y probar rollback/replay/backup/cuenta con planes y settings presentes; luego integración remota real yUI coherente.



Estado: proyección y snapshot validados (13a1a–b), comparación en Ajustes (13a1c) y contrato puro de elección (13a2a) entregados. Snapshot/comparación, executor13a2b1, integración13a2b1a y elecciones13a2b2 entregados para conflictos propios simples. Cadenas externas/rechazos/series y copia desde tombstone siguen pendientes.

## Evidencia conservada

- Entrada outbox con operación enviada congelada, revisión base, dependencias, estado ycontador deintentos.
- Outcome durable: resultado del servidor, local yshadow que existían alrecibirlo. **Ese shadow no es necesariamente el ancestro de la revisión base enviada**: pull o replay tardío pueden adelantarlo. Nunca usarlo como base histórica para una fusión de tres versiones.
- Proyección local actual: puede incluir ediciones posteriores o un tombstone; no reemplazarla con el borrador deloutcome.
- Shadow remoto más reciente conocido, distinto deun estadoactual garantizado en servidor. Respuesta conflict antigua puede llegar después deun pull nuevo; comparar versiones porrevisión, igualdad concontenido distinto es corrupción, shadow actual no regresa respecto aevidencia durable.

Todo record debe pertenecer acuenta/elemento deentrada; resultado/operación/estado/key han de coincidir. Applied yunsupported no son incidentes terminales. Outcomeausente/corrupto/cuenta ajena detienelectura; no derivar éxito ni descartarcola. El DTO no modifica nada.

## Próximos cortes

1. **13a1b lector**: snapshot readonly items/outbox/remoteShadows/syncMetadata, resultados validados sinpágina parcial, filtro cuenta+epochantes/después. Mostrar evidencia ydependientes conservados, incluidos borradoresborrados; sin IOremoto niresolución.
2. **13a1c comparación visible** en Ajustes, detalles bajo demanda; diferencias local/remoto/operación enviadayrazón clara. No ofrecer elecciones antesdeque mutación equivalente estéimplementada/probada. No nuevodestino sin ambasbarras.
3. **13a2a diseño/contrato de resolución local**: decisión explícita sobre toda la cadena deintenciones pendientes deesaentidad; expected snapshot impide resolver sobre cambios locales posteriores inadvertidos. Guardarregistro deelección con nuevoUUID, operación original/resultados intactos, adoptarremoto o construir nueva intención sobre revisión remota reciente. Revalidar actor/epoch, no inferirpermisos porcache.
4. **13a2b ejecutor yUI juntos**: transacción local de evidencia/cola/proyección/resolución; una nueva operación con nuevoID/revisiónbase, CASremoto puede conflictuar denuevo si cambióservidor. Otras entidades siguenenviando. Probar dosdispositivos, errores/reload/rollback/cuenta/tombstones.

## Reglas que el diseño debe cerrar

- Conservar remoto requiere decisión explícita también sobre ediciones dependientes; no descartarlas en silencio. Reaplicar borrador debe explicar qué contenido se enviará yreusar identidad del elemento solo si aúnvive.
- **No marcar operaciónconflict/rejected como ACK delservidor.** Considerar estado local separado de supersesión yregistro de resolución, adaptando explícitamente guards/dependencias/resumen/proyección; schema existente no lo implementa todavía. No borrarrecibos/intenciones para desbloquearla cola.
- Si el remoto tiene tombstone, nunca resucitar el mismoID. Recuperar borrador como copia exige elección explícita y nuevoID/operación; no hacerlo automáticamente.
- Rechazos unavailable/identity_reuse/invalid_command tienen causas distintas. No reintentar automáticamente un permiso retirado ni reutilizarUUID conflictivo; conservar/exportar evidencia cuando no haya resolución segura.
- Acciones sobre preferencias/series/compartidos exigirán supropio soporte; este primer contrato interpreta comandos deelementos, no inventa ACKdeotrosdominios.
- No fusión automática basada enpayloadcompleto deitem.update: podría revertir cambios remotos deestado/checklist no elegidos. Elección/preview explícitos y revisiónCAS son requisitos.

Validación13a1a: oráculos puros de borradorposterior/tombstone, replaytardío, rechazo sinpayload remoto ycorrupción/identidad/cuenta/estado/operación. LecturaIndexedDB y elección UI siguenpendientes.


13a1b entregada: snapshot consistente readonly de cuatro stores con guardias usuario/época y todas las intenciones sin ACK por elemento (incluye cadenas bloqueadas). Validación global de cuenta/identidades y proyección de cada incidente completa; outcome ausente falla toda lectura. Próxima 13a1c: comparación desplegable en Ajustes, sin elecciones todavía.


13a1c entregada: Ajustes ofrece comparación desplegable bajo demanda con caché por cuenta/época. Razón, borrado, versión remota conocida y comando enviado se muestran en español, manteniendo cola intacta. Las elecciones siguen pendientes de contrato y executor probados (13a2a–b).


## Contrato 13a2a y persistencia prevista

- `adopt_remote`: reemplazar proyección por último remoto conocido y superseder explícitamente todas las intenciones mostradas del elemento; ninguna operación remota ni ACK.
- `retry_local`: preview es todo el borrador actual (incluidos estado/checklist), no fusión automática. Nueva operación UUID sobre revision remota, update para vivo/delete para borrado local sobre remoto vivo. Si servidor avanzó, CAS producirá otro conflicto. Identidad remota borrada exige otro flujo de copia con ID nuevo, todavía no habilitado.
- Solo conflictos propios simples, con remoto conocido. Rechazos sin prueba de acceso, series/preferencias y cadenas con envío activo no habilitan estas elecciones. Snapshot exacto cubre evidencia local/remota y toda cadena; executor debe regenerarlo desde sus stores y compararlo dentro de la transacción, no confiar en DTO suministrado.
- Record `incident-resolution:<UUID>` contiene request/choice, expected con entradas originales, IDs supersedidos, nueva operación opcional y proyección elegida. Outcomes originales permanecen intactos. Replay exige record idéntico y no vuelve a modificar proyección si hay posteriores ediciones.
- 13a2b1 añadirá estado `superseded` al schema de outbox. Será terminal local, excluido de trabajo e incidentes; payload/dependencias/attempts originales preservados. No satisface dependencias como ACK. Guardar record + estados + item + secuencia + nueva operación en una transacción; no convertir decisiones locales en confirmación de servidor.
- Nuevas intenciones después de adoptar remoto no deben depender de la cola ya supersedida. Una dependencia externa pendiente que apunte a ella sigue bloqueada, nunca se confirma de forma implícita; executor debe rechazar esa cadena si no está incluida explícitamente. Preferencias siguen sin sincronización.
- Dividir13a2b: primero1 estado/executor con pruebas de rollback/replay/cuota/cuenta, después2 UI de confirmación y prueba integrada de dos dispositivos. No ofrecer elecciones antes de mutación probada.


13a2b1 entregada: estado superseded y registro durable en misma transacción que proyección/replacement/secuencia. Replay idéntico conserva posteriores ediciones. Claims no envían estados supersedidos y solo ACK satisface dependencias existentes; nuevos comandos excluyen tails supersedidos. Cadena externa pendiente y envío incierto impiden elección, sin descartar ninguna intención. Guardias de usuario/época antes/después, notificación tras commit. Pendiente13a2b1a: confirmar este flujo con servidor MongoDB real y dos particiones antes de ofrecer botones13a2b2.


13a2b1a: nueve escenarios reales de dos orígenes/MongoDB verifican retry de cadena con respuesta perdida/replay/recarga sin duplicados, adopción sin escritura remota ni ACK y tombstone sin resurrección. Proyecciones y cursores de ambos dispositivos coinciden con Mongo y cola activa vacía tras decisión. Recursos propios limpiados. Puede avanzar UI13a2b2 conservando límites de cadena externa/pending intentada/rechazos/series.


13a2b2: UI de elección habilitada con preview congelado yconfirmación sobre todaslasintenciones delelemento. Cancelación sinmutación yotra pestañacambiando localprovocarechazo deldiálogoabierto. Snapshot detecta dependientes externos antesdeofrecerbotones; contrato/executor revalidan. Timestamps/UUID deelección estables,revalidación de caches propias posterior,noACK hasta resultado remoto. Reintento/adopciónyrecarga comprobados enUI ylosnueve escenariosMongo vuelvena pasar. Próxima13a2c1 define copia nueva explicitamenteelegida frenteatombstone; rechazos sin acceso y cadenasexternaspermanecen conservados.


## Copia frente a remoto borrado, 13a2c1

copy_local es una elección adicional para conflicto simple propio con remoto tombstone y borrador local vivo. Crear elemento y operación nuevos conbase0, conservar viejo elemento como tombstone remoto ysuperseder cadena explícitamente mostrando consecuencias. Registro guarda tombstone original ycopy separada; replay no debe volveraescribir copy yaeditada/confirmada. Categorías/orden no se copian automáticamente. Nullable defaults mantienen lectura de registros anteriores.

13a2c1 solo valida planner/contrato. Executor bloquea copy sin escribir yUI no laofrece. 13a2c2 debe comprobar copyID libre, incluidos tombstones/historial local, yguardar original+copy+cola+evidencia+secuencia juntos; rollback/replay enIndexedDB yconvergencia de dosdispositivos/Mongo antesde botón13a2c3. Rechazos sinacceso yrelacionesexternas siguenpendientes.


13a2c2: copia y original tombstone guardados junto con cola/contador/evidencia en cuatro stores; nuevo ID libre frente a registros/historial/tombstones, entityKey del nuevo elemento. Rollback tardío deja ambos elementos y cola intactos; replay no sobrescribe copia editada. IndexedDB nueve checks+recarga y diez escenarios reales dos dispositivos/Mongo aprobados; lostresponse produce una sola copia revision1 y original tombstone revision2 intacto. Recursos propios limpios. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próxima13a2c3 UI de copia, sin categorías/orden duplicados ni ACK local.


13a2c3: Ajustes ofrece Crear copia de mi borrador solo para local vivo frentearemoto tombstone, conidentidad/operación/timestamp estables yconfirmación decontenido completo, originalborrado, sincategoría/orden ypending. Tests guardiaslocalmissing/deleted ySSR; normal205pass/30skip/4628aserciones, lint304files/tipos/build30recursos aprobados. FixtureUI móvil390/dialog358/buttons48 sinoverflow: cancelar sincambios, confirmar/reload origentombstone+copyrev0+createbase0/entityKeynuevo/2superseded/1pending/sinACK; limpieza propia. Próxima13b1 recuperación/transporte según dependencias.

## 19a2 — Ejecución local común comprobada

LocalSyncStore/resolveLocalSyncIncident aceptan opt-in allowPlans separado, false por defecto. Exige captura recurrente completa; aplica el planner a decisión y replay, conserva settings cuando corresponde y mantiene notificación sólo trascommit. Callers/UI actuales todavía no seleccionan planes para resolver.

Next6compilado con IndexedDB/Mongo propios:23escenarios correctos. Nuevo caso induce explícitamente conflictos locales de4variantes para comprobar24checks de stale-snapshot, rollback tardío sinnotificación, superseded sinACK, replacements pending0, payload/attempts/deps/outcomes intactos, preservación settings/occurrences/tags/views/placements/shadows yreplaytrasnuevaedición. Snapshotportable3 sevalida condecoderproductivo. Mongo permanece exactoantes/después de este caso: no se atribuye ACKremoto a conflictossembrados. Recursos propios limpiados ycaptura `/private/tmp/dalis-plan-recovery-local.png`.

DoD840pass/223skip/0fail/10844aserciones, lint851/tipos/Webpack/worker46/diff. Siguiente19a3 generará conflictos reales mediante dosparticiones y ejecutorMongo/Next, conreplay/respuestaperdida/tombstones/convergencia antesUI.

## 19a3 — Recuperación común con conflicto remoto real

Next6/BetterAuth persistido/defaults/Mongo ydosorígenes IndexedDB propios:24escenarios pasan. Productores reales deguardado/progreso/borrado generan4conflictosCAS condependiente sinintento. Adoptar remoto noañaderecibo/history; retrycrea nuevoUUID sobre revisiónremota; copiar ante tombstone creaotroID sinresucitar original y conserva variant/estado/checklist/fecha. Originalesconflict+child quedan superseded conoperaciones/deps/outcomes intactos, nuncaACK local.

Se pierdeunarespuesta trascommit real de replacement; permanecen pending/attempt1/lease liberado, replay delmismoUUID obtieneunACK sinotrorecibo/journal. Alcerrar cada variante secomparan seisstores ycursor exactos contra proyección completaMongo enambasparticiones, yreplay de decisión noescribe sobreestado confirmado. Backup3 validado en cadasnapshot. NoGoogle interactivo ni dispositivosfísicos. Primerfixture se detuvo antes de ejecutar aldetectar adaptador delete-plan ausente; se añadió productorreal yse limpiótodoantes delretry aprobado.

Suite840pass/223skip/0fail/10844aserciones, lint851/tipos/Webpack/worker46/diff. Recursos propios retirados; captura `/private/tmp/dalis-plan-recovery-remote.png`. Callers/UI todavía privados: siguiente19a4 selección coherente yprueba deldiálogo real, conguardias de cadenasexternas/series intactas. NoDBusuario/protocolo/índices nuevos.

## 19a4 — Recuperación común disponible en Ajustes

La feature y las opciones visibles seleccionan el mismo soporte de planes comunes, usando el executor ya probado. Ajustes ofrece adoptar remoto, reenviar borrador o crear copia ante tombstone para planes simples sin cadenas externas. El diálogo muestra contenido completo y explica la sustitución explícita de las intenciones revisadas; cancelar no decide nada y confirmar deja un nuevo envío pendiente, sin ACK local. Las series y las cadenas de edición con categoría dependiente siguen protegidas para su ampliación posterior.

Prueba con el componente React real dentro de Next: cancelar, reabrir y confirmar un conflicto remoto real; registro generado por la feature productiva, ACK posterior y convergencia exacta en los seis stores. Los cuatro casos remotos ahora usan la feature guardada, no el puerto privado. Veinticuatro escenarios Next6 pasan; cuatro tests SSR/60aserciones comprueban opciones, campos y guardias de las cuatro variantes. Se corrige además el texto antiguo que presentaba toda repetición como sólo local.

DoD844pass/223skip/0fail/10904aserciones, lint852 sin avisos/tipos/Webpack/worker46/diff. Capturas `/private/tmp/dalis-plan-recovery-dialog.png` y `/private/tmp/dalis-plan-recovery-ui.png`; recursos propios retirados. Sin nuevos índices, formatos, protocolo, dependencias o datos del usuario. Siguientes: cadenas comunes con categoría, recuperación de preferencias y de apariciones; no declarar cerrado todo el bloque residual.

## 19b1 — Contrato de recuperación de zona personal

Schemas y planner puros para adoptar el remoto conocido o reenviar el valor local completo de settings. Exigen conflicto propio, remoto vivo y comprometido, snapshots exactos contra outcome conservado y cadena de settings sin envíos inciertos. Adopción no genera operación niACK; reintento usaUUIDnuevo yCAS de la revisión remota más reciente conocida. La proyección añade guardia explícita de cadenas externas sólo a incidentes de settings. Las categorías independientes permanecen en evidencia y no se superseden.

El registro settings-resolution conserva comparación completa, IDs sustituidos, proyección elegida y replacement opcional; el validator del registro recalcula la decisión y rechaza contradicciones. Es preparación: todavía no se registra en backup ni se ejecuta desde UI. Siete tests/34aserciones comprueban adopción/retry, replay tardío sinancestro ficticio, snapshots cambiados, cuenta/identidad, valor ausente/tombstone, cadena externa, preferencias independientes y registro corrupto. Dos tests iniciales compartían referencias del snapshot y outcome; se corrigieron para modificar copias independientes.

Suite851pass/223skip/0fail/10938aserciones, lint856 sinavisos/tipos/Webpack/worker46/diff. Sin cambios remotos, índices, protocolo o DBusuario. Siguiente19b2: transacción local completa de9stores, replay/rollback ybackup3 connuevo registro validado; feature cuenta/epoch ypruebaNext/Mongo antes UI19b3.

## 19b2 — Decisiones de zona atómicas y portables

Executor local con captura de nueve stores en la misma transacción: revalida comparación completa, actor/partición, identidades, dependencias y contador; escribe settings, estados superseded, nuevo envío opcional y recibo juntos. La feature comprueba cuenta/epoch antes y después; un cambio posterior alcommit conserva la decisión durable pero no declara éxito para otra cuenta. Replay valida identidad/evidencia guardada y no modifica valores posteriores. Las notificaciones se emiten trascommit; evento local yBroadcastChannel pueden duplicar su entrega y no se usan como prueba deACK.

Portable3 reconoce settings-resolution y recalcula su coherencia al exportar/decodificar. No cambia intenciones1/evidencia2/wire6 ni requiere wipe; lectores antiguos rechazan conservadoramente esta nueva metadata local hasta actualizar. Test debackup verifica registro válido, rechazo en formato2/lectores previos, proyección contradictoria youtcome original ausente.

Veinticinco escenarios Next6/IndexedDB/Mongo propios pasan: guardia de cuenta/epoch, snapshot obsoleto, rollback tardío sin cambios, adopción sinrecibo remoto y conservación de otras colecciones; después conflicto real con hijo pendiente, retry de la última zona local, respuesta perdida yACK único, settings/shadow/cursor iguales en dos particiones yreplay que conserva una zona confirmada posterior. El primer fixture se detuvo antes de ejecutar para corregir una aserción que confundía entrega duplicada de notificación con duplicado decommit; cleanup/retry correctos.

Suite852pass/223skip/0fail/10944aserciones, lint858 sinavisos/tipos/Webpack/worker46/diff. Captura `/private/tmp/dalis-settings-recovery-local.png`; todos los recursos propios retirados. No botones nuevos todavía, noDBusuario/índices/producción. Siguiente19b3: elección visible ydiálogo real usando la feature ya comprobada.

## 19c4 — Reenvío completo de aparición sin nuevo comando remoto

Planner de retry prepara una cadena acotada de comandos ya soportados: primero contenido/horario/textos de checklist, estado si difiere, progresos de pasos que difieran ycancelación local alfinal. Hasta103operaciones para100pasos, cadaUUIDnuevo ydistinto; revisión de padre constante yCAS deaparición previsto porpaso. ElACK directo existente asigna alhijo la misma revisión prevista, sin alterar elpayload guardado en elrecibo. El último estado local provisional conserva revisión remota de partida: nunca representa ACK.

La futura escritura local será atómica para toda la cadena; los envíos remotos serán secuenciales conACK porpaso, sin prometer atomicidad remota multicomando. Desconexión/respuesta perdida deben conservar pasos pendientes ytodoslosUUID, mientras elpeer puede observar etapas intermedias. No se introduce plan.replace-occurrence ni otra generación dewire por esta composición de comandos existentes. Remoto cancelado/tombstone no admite retry niresurrección; adoptar sigue disponible. El registro de adopción existente permanece sin campos nuevos materializados.

Este corte sólo prepara schemas/planner: executor yexportador rechazan expresamente retry antes de escribir oaceptar evidencia incompleta; UI no ofrece botón.19c5 cerrará transacción/backup completos ypruebaNext/Mongo conpérdida de respuesta/replay antes de19c6visible.

## 19c5 — Cadena durable y recuperación real tras desconexión

Transacción local guarda todos los reemplazos pending0 con dependencias consecutivas, secuencia/counter, proyección final provisional, superseded yrecibo conjuntamente. Antes deescribir comprueba identidades nuevas contra cola/metadata, actor/cuenta/epoch, snapshot completo ydependencias. Fallo tardío alañadirrecibo revierte toda la cadena. Replay no añade entradas ni retrocede proyección posterior.

Backup3 valida todos losreemplazos exactos, suorden/secuencia/fecha/dependencia; original/outcome yACK permanecen exigidos porvalidacióncompartida. La pérdida de respuesta se prueba trascommitremoto real: primerUUID queda pending/attempt1 yresto pending0. Recarga conserva receta/cola/cursor; replay obtieneACK único ycontinúa pasos. Peer observa estadointermedio decontenido antesdeprogreso, yfinalmente ambosclientes coinciden exactamente conMongo porserie. Dos casos completos incluyen checklist conaltas/cambios/reversión deprogreso ycancelación localfinal. La UI de retry todavía no seofrece hasta19c6.

## 19c7 — Capacidad completa posterior de recuperación

Schema estricto cuenta todos losreemplazos (0–103), outbox actual ymetadata actual; rechaza suma posterior>10.000 antes de modificar proyección/cola/contador/recibo. Adopción necesita un recibo, cero operaciones; contador existente sólo seactualiza. Replay durable precede esta comprobación y no vuelve aescribir. No seborra/compacta historia ni cambia wire/backup/índices. No equivale a límite debytes ni cierra capacidad deotras mutaciones.

Una prueba pura nueva cubre 0/1/103, límites exactos/exceso/negativos/fracciones/shape estricto. Cinco checks deIndexedDB nativo enpartición browser-test propia: cola llena rechaza retry sin cambios, metadata llena rechaza adopción/retry, dos reemplazos+recibo llenan exactamente outbox/metadata, replay conambasllenas no escribe, adopción permite cola llena sinoperación. La fixture usa sentinels explícitos para capacidad, noafirma validez debackup portable deesos sentinels. Primera ejecución rechazó porIDsdependientes incompletos de lafixture, corregida usando contador real de comandos y repetida conlimpieza. Captura /private/tmp/dalis-appearance-capacity.png, partición/tab/servidor propios retirados.

Suite876pass/223skip/0fail/11107aserciones, lint872sinavisos/tipos/Webpack/worker46/diff. SinMongo, NextRPC, Google ni pruebasfísicas nuevas; últimas pruebas de27Next6 no seatribuyen aestecambio. Mismo commitpushint/HEAD/cuotas.

## 19d1 — Recuperación pura de nombre y color de categoría

Planner de cadenas aisladas tag.save con cuenta/entidad/resultado/snapshots exactos, remoto vivo comprometido yUUIDnuevos. Adopción conserva versión remota sinoperación/ACK; retry usa último nombre/color local yposición remota, sin reordenar comoefecto secundario. Catálogo de nombres actual impide retry duplicado normalizado; conservador ante nombres históricos borrados, sin reparar/borrar. Rechaza movimientos/borrados, envíos inciertos, tombstone/ausencia remota ydependencias externas. Proyección personal calcula guardia de dependencias también paracategorías; preferencias independientes permanecen intactas. DTO comparte elshape de evidencia personal existente; planner restringe dominio.

Cinco tests/42aserciones de adopción/retry/plannerremoto puro, identidad/frescura/cuenta/catálogo/registro corrupto ydependencias entrantes/salientes. Fixture seclonó sin referencias compartidas entre outcome/remoto para probar corrupción realmente. Suite881pass/223skip/0fail/11149aserciones, lint876sinavisos/tipos/Webpack/worker46/diff. No escrituras/backup/UI nuevos, índices/Mongo/DBusuario.19d2 añade transacción/evidencia portable ypruebas de rollback/replay antes de Next real/elecciones.

## 19d2 — Categoría elegida durable y evidencia portable

Executor revalida captura de9stores, cuenta/partición, comparación/outcomes/dependencias, colisionesUUIDglobales/counter ycapacidad antesdeguardar. Tags/cola/counter/recibo atómicos; superseded conserva UUID/payload/deps/intentadas/outcomes, sinACK. LocalSyncStore notifica sólo trascommit; feature protocol6 con cuenta/epoch antes/después. Replay previo valida recibo replanteado, conserva cambiosposteriores yno notifica. Schema compartido de capacidad extraído sin cambiar límite103 deapariciones. Backup3 admite tag-resolution, replanifica y exige reemplazo/estadooriginal/dependencias/secuencia/intentadas exactos. Lectores anteriores rechazan metadata desconocida conservadoramente; sinmigración/borrado/wire nuevo.

Prueba pura adicional debackup válido/truncado/dependencias eintentadas alteradas ypendingattempt1 conservado. Cinco checksIndexedDB nativos en particiónpropia: foreign/stale, fallo tardío delrecibo revierte tag/cola/counter/metadata sinnotificación, dependiente externo bloqueado, retrypending nuevo sinACK/replaytrasposterior edición/IDreuse, adopción sinoperación yreapertura. Fixture corrigió expectativa de notificación única porque la suscripción recibe evento local yBroadcastChannel; verifica notificación trascommit, nunca antesni alreplay. También corregida clave derivada de evidencia tag para evitar símbolo residual deladaptador settings. Captura /private/tmp/dalis-tag-recovery-local.png; recursospropios limpiados.

Suite882pass/223skip/0fail/11155aserciones, lint880sinavisos/tipos/Webpack/worker46/diff. Ningún Mongo/Google/NextRPC nuevo enestecorte; siguiente19d3 conflictos deproductores reales, respuesta perdida/recarga/replay/ACK único yconvergencia endosorígenes/Mongo antesdeUI19d4. NoDBusuario/índices.

## 19d3 — Categoría recuperada contra Next/Mongo reales

Productores reales tag.save de dosparticiones generan dos conflictos (adoptar/retry), cadauno conúltimo borrador dependiente sinintento. Feature productiva valida cuenta/epoch/comparación actual; tres guardias sinmutación porcaso. Elegir localmente no cambia Mongo. Adopción conserva categoría remota sinoperación; retry reenvía nombre/color másrecientes conposición remota/revisiónCAS nueva. Originales conservan todosloscampos salvo estado superseded, outcomes yresto deproyecciones intactos.

Se pierde respuesta después decommit remoto de retry: mismoUUID/payloadpendingattempt1/leasesuelta sinACK. Recarga dueño secundario conserva intención exacta; replay confirma esaoperación conattempt2 yno añade recibo/journal. Proyección/shadow/cursor deambasparticiones coinciden conMongo para cadacategoría, yreplaydeelección trasconfirmación noreescribe. No convergencia global deotras historias bloqueadas de lafixture ni pruebaGoogle/dispositivosfísicos nuevos.

28escenariosNext6 compilado/configuraciónreal/defaults/sesionesBetterAuth persistidas/Mongo/IndexedDB propios correctos, mismos27anteriores revalidados; runnerexit0/cleanupcontenedor/proxy/temporales/particiones/sesiones/tab propios. Acceso al sobre change.effects.effects de lafixture corregido antes decompilar. Captura /private/tmp/dalis-tag-recovery-next.png. SinDBusuario/wire/índices/permisos nuevos. Suite882pass/223skip/0fail/11155aserciones, lint880/tipos/Webpack/worker46/diff; publicar mismo commitpushint/HEAD/cuotas.19d4 conectaUI sólo alalcance probado.

## 19d4 — Recuperación de categoría visible en Ajustes

PersonalIncidentCard ofrece adoptar categoría remota o reenviar nombre/color sólo con cuenta propia6 y planner seguro. Confirmación congela comparación y mantiene UUID en ref hasta completar; cancelar no llama a la feature. El preview usa nombre/color local y posición/revisión remotas para reflejar lo que realmente se guardará. Explica conservación de orden, planes/asignaciones e historial, estado pendiente y posible nuevo conflicto. Comparaciones de categorías muestran ahora muestra de color y código textual, sin depender sólo del color. Caché invalidada sólo por cuenta/época propia; casos protegidos siguen visibles sin elecciones.

Dos tests SSR/30 aserciones verifican cuenta ajena, opciones/guardias, preview fiel y mensajes. Componente productivo en Next: ambos diálogos se cancelan, reabren y confirman en conflictos reales; la fixture observa los UUID generados por la UI y continúa respuesta perdida, recarga antesACK, replay, ACK único y convergencia por categoría. 28 escenarios completos aprobados; no Google ni nueva checklist física. La fixture no carga todos los estilos de producto: capturas /private/tmp/dalis-tag-recovery-dialog.png y /private/tmp/dalis-tag-recovery-ui.png documentan comportamiento, no auditoría visual móvil. Recursos propios limpiados, sin DBusuario/protocolo/índices nuevos.

Se actualizó una expectativa antigua del mensaje de categoría protegida; la guardia sigue sin ofrecer elecciones inseguras. DoD:884pass/223skip/0fail/11185aserciones, lint883/tipos/Webpack/worker46/diff. Guía actualizada y mismo commitpushint/HEAD/cuotas. Las cadenas de contenido+categoría, borrado/orden y otras preferencias siguen pendientes.

## 19e1 — Clausura de cadena de contenido y categoría

Clasificador puro recibe conflicto de plan simple y cola completa (máximo10.000). Valida cuenta/identidades/secuencias/dependencias completas; exige intenciones de contenido exactamente iguales al snapshot y asignaciones item-view.set del mismo plan sólo pending/attempt0. Cada asignación está conectada al contenido revisado. Prerrequisitos externos sólo acknowledged, nunca superseded; dependientes externos y cualquier otra operación pendiente sobre el mismo plan, incluido movimiento sin arista, bloquean. Las cadenas intercaladas conservan orden/UUID/payload/deps/estado; sólo tras demostrar clausura devuelve una comparación normalizada para el planner común privado. No concede permisos/ACK ni se conecta a callers actuales.

Nueve tests/45 aserciones: cuatro variantes, grafo incompleto/ajeno/duplicado, envíos inciertos y estados terminales, recurrencia/borrado, incoming/outgoing/ACK/superseded, movimiento semántico sin dependencia y dos asignaciones intercaladas. La fixture de movimiento se corrigió para usar taskPlacementEntityKey canónico antes de comprobar su guardia. Suite893pass/223skip/0fail/11230aserciones, lint886/tipos/Webpack/worker46/diff. Sin Mongo, DBusuario, índice o formato nuevo. Próximo19e2 debe cerrar snapshot/elección con contenido/vista/categoría exactos; ninguna UI conjunta antes de transacción/evidencia/prueba remota.

## 19e2 — Elección conjunta pura con snapshots compactos

Captura reconstruida desde cola completa validada por19e1; DTO conserva contenido, intenciones de vista, registros local/remoto de asignación, categoría local y ACKs directos preexistentes relacionados. No guarda historia independiente ni la considera ancestro. Actividad ajena no cambia comparación; contenido/vista/categoría o grafo relacionados sí. Registro puro replanteable adopta ambos remotos sinoperaciones o genera dosUUIDdistintos: item.update con borradorcompleto/CASdecontenido y item-view.set conasignaciónlocal/CASdevista. Proyección provisional conserva revisionesobservadas; executor posterior debe enlazar vista trascontenido. Historial/UUID/payload/deps/intentos originales intactos.

Remoto de vista debe ser propio/vivo/comprometido. Categoría ausente, borrada o sinconfirmar yrevisiones remotas agotadas sólo permitenadopción. Prerrequisitos son entradas ACK reales capturadas, nunca estados fabricados; la validación compacta no acredita su recibo por sí sola ni demuestra ausencia de dependientes externos. Escritura deberá repetir clausura/captura completa dentro deTX, comparar exactamente yvalidar UUIDs también contra metadata. Backup deberá verificar originales/ACKs/reemplazos reales, no aceptar sólo el DTO. No seofrece UI ni seañade elregistro a backup todavía.

Nueve tests/78aserciones de cuatrovariantes, contenido completo yCASindependientes usando applyItemCommand/planRemoteItemViewOperation puros, captura compacta/actividadindependiente, foreign/stale/categoría/ausencia/tombstone/revisiónagotada, ACKs directos ydependientes externos, IDs/corrupción de registro. Se estrechó tipo item.update enfixture yseeliminó aviso deoptionalchain; DoD902pass/223skip/0fail/11308aserciones, lint890sinavisos/tipos/Webpack/worker46/diff. SinMongo/Next/DBusuario nuevos; no seatribuye convergencia a simulación pura.

## 19c8 — Límites posteriores en recuperaciones comunes y zona

Writers de contenido y settings validan outbox+replacement ymetadata+recibo antes de modificar nada. El writer común añade captura completa limitada a10.001 para metadata y cuenta deitems cuando haycopia; copia rechazada si añade el registro10.001, sin borrar/compactar historia. Replay existente sigue anterior a laslecturas de capacidad y no reescribe/duplica; adopción permite cola llena cuando noañade operación. No cambia límites debytes, escrituras normales ni política de retención.

Ocho checksIndexedDB nativos propios (planeslegacy comunes ysettings, mismo writer común usado porplanes activos): metadata llena rechaza adopción/retry sin cambios, cola llena rechaza retry pero permiteadopción, último hueco deambas tablas yreplay con10.000 registros, copia rechazada con10.000items ypermitida con9.999. La fixture usa sentinels para capacidad, no afirma validez portable deesa historia artificial. Rótulos finales españoles revalidados. Captura /private/tmp/dalis-resolution-capacity.png; partición/tab/servidor propios limpiados.

Suite902pass/223skip/0fail/11308aserciones, lint891sinavisos/tipos/Webpack/worker46/diff. SinMongo/Next/Google/DBusuario nuevos niíndices/protocolo; últimos28Next6 del19d4 siguen evidencia deese corte. Mismo commitpushint/HEAD/cuotas; siguiente19e3 según margen.
