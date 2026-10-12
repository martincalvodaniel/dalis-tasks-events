# Zona horaria personal y sincronización de ajustes

## 18e0 — Puertos de feature con cuenta capturada

Lectura y guardado futuros validan actor/epoch, schema e identidad esperada antes de IO; guardias antes y después de la operación, recursos de defaults siempre cerrados. Guardado delega al productor atómico con comparación esperada; no modifica planes, revisiones o UUID existentes. Si cambia cuenta después del commit, se conserva la intención durable y no se informa éxito para la sesión nueva; no afirmar rollback del commit ya ocurrido.

Cinco tests de puertos / 33 aserciones cubren orden/identidad, invalid/foreign antes IO, dato almacenado extranjero, cuenta cerrada antes/después y errorCAS. IndexedDB real ya probado en cortes anteriores; este test no acredita guard de cuenta del navegador. Se derivó el tipo de entrada del schema porque no existía el alias supuesto. Suite 819 pass / 221 skip / 0 fail / 10694 aserciones, lint 827, tipos/build Webpack/worker 46 aprobados. No UI ni caller activo; Next/lifecycle/convergencia/activación siguen pendientes.


## 18d3b — Identidad y descarga privadas autenticadas

Identidad privada 6 devuelve únicamente userId autorizado/no-store; fallo o shape con información extra se sanea. Pull futuro usa sesión persistida/allowlist existente, valida query/expected actor antes de readiness6/reader privado y valida página completa con settings antes de devolver. Errores, cursor ahead y corrupción no entregan diario parcial ni mensajes internos. Respuesta 5 y rutas activas intactas.

Cinco tests nuevos / 49 aserciones cubren identidad/header/privacy, página/orden/strict5, autenticación/query/actor, readiness/cursor y errores/foreign. Suite 814 pass / 221 skip / 0 fail / 10661 aserciones, lint 825, tipos/build Webpack/worker 46 aprobados. Sin DB usuario ni selección del producto6. Siguiente aceptación Next compilada/sesiones persistidas, lifecycle y convergencia de dos particiones; después UI/activación conjunta. No confundir tests de puertos con Google real.


## 18d3a — Acción, cliente y hook 6 privados

Referencia `pushSyncOperationsV6` usa headers Next y guard de release inactivo: todavía sólo retiro, no ejecución. Dispatcher cliente usa startTransition; cliente futuro reúne transport 6, summary/settings runtime; hook comparte scheduler/cuenta/listeners existentes con cache 6 separada y posiciones de cuenta intactas. Proveedor, APIs, acciones5 y generación activa no cambian.

Cinco tests de cliente añaden intención settings, cuenta capturada/guardias, stop, incompatibilidad antes del body y cierre. Se corrigió una matriz copiada que aún trataba 6 como inválida. Cache prueba aislamiento6 e invalidación por cuenta. Suite 809 pass / 221 skip / 0 fail / 10612 aserciones, lint 822, tipos/build Webpack/worker 46 aprobados. Tests puros no demuestran lifecycle del hook ni ID del deployment. Siguiente frontera privada identidad/pull6, después evidencia Next y dos particiones antes de activar/UI.


## 18d2 — Frontera autenticada, seis índices y retiro preparados

Defaults privados reutilizan sesión autorizada y guardias del servicio recurrente; schema/expected actor preceden una inspección readonly por lote. Dispatcher futuro selecciona executor settings y valida correspondencia/replay común; las demás familias conservan dispatch existente. Readiness añade únicamente `user_settings_user_uidx` registrado/staged a las cinco definiciones exactas; no provisión ni bootstrap. Retiro 5 reutiliza validación del sobre 2 y no puede llegar a readiness/executor.

Seis tests nuevos de auth/retirement/readiness y diez casos Mongo / 81 aserciones pasan, incluyendo dispatcher real/replay/UUIDreuse sin duplicar historia. Recursos propios retirados; no actuación en DBusuario. Se corrigió acceso tipado a keys del índice antes de validación final. Suite 804 pass / 221 skip / 0 fail / 10561 aserciones, lint 817, tipos/build Webpack/worker 46 aprobados. Producto sigue 5: faltan referencias action6/cliente/hook, prueba Next/dos particiones, UI y activación conjunta. No declarar convergencia por fixtures puros.


## 18d1 — HTTP exclusivo de ajustes preparado

Factory 6 comparte conexión/deadline con transporte recurrente, selecciona header exclusivo 6 y valida página completa con settings. Factory 5 mantiene rechazo estricto; rango 5–6, header ausente o generación distinta se rechazan antes del body de identidad/pull. Cookies same-origin de Preview intactas. Envío conserva intención 1 y sobre 2; expected actor falla antes del envío y timeout no implica ACK.

Cinco tests nuevos / 27 aserciones prueban matriz, body no leído, página/actor, credentials/query, payload y deadline. Se corrigieron tipos de los mocks/literales antes del DoD final. Suite 798 pass / 220 skip / 0 fail / 10515 aserciones, lint 812, tipos/build Webpack/worker 46 aprobados. Sin ruta/acción/caller activo. Sigue 18d2 frontera autenticada, readiness de seis índices y retiro 5 preparatorios, luego Next/dos particiones/UI/activación conjunta.


## 18c5 — Bundle local privado de ajustes

Política congelada de settings amplía la recurrente y conserva sus validaciones/unsupported. Store futuro selecciona ACK y pull completos; runtime compartido elige store/política/coordinador juntos y reutiliza cuenta/epoch/cierre. Resumen y coordinador usan la misma política, incluida revalidación después del claim. Defaults/callers 5 siguen intactos; sin transporte/API/UI/bootstrap nuevos.

Cinco tests de puertos / 23 aserciones: policy/strict5, diagnóstico y resumen, envío futuro con payload íntegro, claim cambiado sin send y cuenta cerrada en vuelo sin consumo de resultado. Son simulaciones de consumidores, no ACK durable/convergencia. Store compuesto pasa los diez checks ACK/evidencia/backup y ocho de descarga en IndexedDB, ambas recargas; recursos propios limpios. Se corrigió sólo el tipo epoch del fixture y optional-chain. Suite 793 pass / 220 skip / 0 fail / 10488 aserciones, lint 811, tipos/build Webpack/worker 46 aprobados. Siguiente 18d1: HTTP 6 exclusivo y matriz antes de frontera autenticada/Next/UI/activación.


## 18c4b — Evidencia actual y copia portable

Captura futura readonly de incidentes incluye settings en la misma TX, valida toda evidencia recurrente y conserva puertos actuales. Comparación distingue valor actual, local congelado al resultado, base observada y última remota; ausencia real sigue null y tombstones conservan registro exacto. No resolución, supersesión ni ACK local nuevos.

Tres tests puros / 11 aserciones y diez checks IndexedDB + recarga pasan. Modificación posterior visible en comparación, evidencia congelada intacta, identidad extranjera rechazada. Backup 3 existente roundtrip conserva ajustes/cola/outcomes/shadows y no escribe; no necesita cambiar formato. Fixture no demuestra Google/servidor. Se corrigió el tipo del helper de fixture. Particiones/tab/servidor propios retirados. Suite 788 pass / 220 skip / 0 fail / 10465 aserciones, lint 809, tipos/build Webpack/worker 46 aprobados. Captura `/private/tmp/dalis-settings-evidence-proof.png`. Sigue composición de política/store/runtime y negociación 6 antes de activación/UI.


## 18c4a — Historia remota privada de ajustes

Nuevo reader privado reutiliza paginación, snapshot, byte ceiling y colecciones del reader recurrente. Cada efecto settings necesita registro actual propio, identidad canónica y revisión actual no inferior a la histórica. Tombstone conserva autorización de historia; ausencia, otra cuenta o corrupción impiden devolver una página parcial. Reader activo 5 sigue rechazando ajustes y no cambia caller, bootstrap o negociación.

Mongo propio: nueve casos / 76 aserciones, incluyendo los seis de executor y tres nuevos de páginas/replay/checkpoint/ownership/tombstone/revisión/identidad. Docker e imagen pinned revalidados por runner, recursos retirados; nunca DB del usuario. Índice userId de 18b ya cubre la consulta. Suite 785 pass / 220 skip / 0 fail / 10454 aserciones, lint 808, tipos/build Webpack/worker 46 aprobados. Siguiente 18c4b: evidencia local actual/backup antes de consumidores y frontera 6.


## 18c3b — Descarga completa y cursor de ajustes

Puerto futuro captura todas las familias, incluyendo settings, en una TX. La proyección valida página, actor, checkpoint, registros locales y toda la cola antes de guardar. Ajustes pendientes conservan valor/identidad sin congelar categorías; una categoría bloqueada no impide settings. Planes y apariciones conservan su zona/ancla. Página vieja se ignora; ninguna descarga crea ACK o modifica outcomes/intenciones.

Seis tests puros / 24 aserciones y ocho checks IndexedDB con recarga pasan. Fallo tardío del cursor revierte categorías/shadows; corrupción y solapamiento no producen escritura parcial, familia extranjera no se filtra. Un caso de fixture confundía una página vieja válida con un solapamiento inválido: corregido antes del ensayo final. Particiones/tab/servidor propios retirados. Suite 785 pass / 217 skip / 0 fail / 10454 aserciones, lint 808, tipos/build Webpack/worker 46 aprobados. Captura `/private/tmp/dalis-settings-pull-proof.png`. Generación 5 intacta; sigue reader privado/evidencia/consumidores y frontera 6 antes de UI/activación.


## 18c3a — Confirmación durable de ajustes

Puerto futuro `applyLocalSettingsPreferenceResult` captura settings, preferencias, items, cola, shadows y outcome en una única TX. La composición valida todas las familias recurrentes antes de proyectar; cada familia conserva sus pendientes. Valor local, ACK, lease, dependientes directos, shadow y outcome se confirman juntos. Puertos activos siguen estrictos y no se modifica negociación/UI.

Ocho checks IndexedDB reales y recarga pasan: consumidor anterior/lease/partición, rollback tardío, ACK/evidencia/hijo pendiente, replay, shadow posterior/CAS mayor, conflicto/dependiente intentado, independencia inversa con categoría y registro extranjero. Respuestas de fixture explícitas: no prueban servidor ni Google. Particiones/tab/servidor propios retirados. Suite 779 pass / 217 skip / 0 fail / 10430 aserciones, lint 805, tipos/build Webpack aprobados; worker 46 recursos. Captura `/private/tmp/dalis-settings-results-proof.png`. Siguiente 18c3b: descarga y cursor atómicos con settings.


## Alcance vigente

La preferencia editable es la zona horaria personal. Mantener lunes y UI española, como exige el schema vigente; no ampliar opciones de idioma o semana por iniciativa propia. La zona afecta la interpretación de hoy/atrasadas y la visualización; no reescribe fechas, zonas de eventos o anclas de series existentes. Una cadena de movimientos encolada conserva su as-of civil y su payload.

`settings.update` existe en intención1, pero generación5 lo conserva como unsupported. Productor, repositorio, executor y proyección están preparados; ACK/pull durables están probados; integración, evidencia y UI siguen pendientes. El registro local inicial revision0 es un valor provisional del dispositivo, no un ACK remoto.

## 18a cerrado

Schema estricto del snapshot remoto: actor, operación, timestamp del servidor y settings propios null/revisión positiva. Planner puro crea conCAS0 o actualiza revisión exacta; conserva createdAt y aumenta sólo revisión personal. Stale/ausencia no esperada/tombstone retornan conflicto con evidencia, sin resurrección. Revisión agotada no produce efecto. Helper común local preserva revisión hasta resultado real y no admite dueño inyectado, otras cuentas, zona inválida, semana/idioma nuevos.

Sin IO, ACK, UI, callers o cambio del transporte activo. Siete tests nuevos/23aserciones; suite768pass/209skip/0fail/10370aserciones, lint793/tipos/buildWebpack/worker46. No consultas DB ni necesidad de índice en este corte.

## 18b cerrado

Colección `user_settings` registrada, `_id` canónico por actor y único `user_settings_user_uidx` sobreuserId registrado en ensure-indexes con provisión explícita. Query poruserId aprovecha ese índice; reemplazoCAS usa identidad/actor/revisión/createdAt/deletedAt. No bootstrap activo nuevo ni DBusuario. Repo impidecruce de cuentas, duplicación y resurrección; registro corrupto falla sin reparar.

Executor preparatorio comprueba replay del namespace recurrente común y fingerprint antes de leer estado. Settings+recibo+journal/counter en una transacción; conflicto sin registro remoto se expresa unavailable sin inventarlo. Retry reabre snapshotcompleto; replay antiguo conserva receipt exacto y no vuelve a tocar una revisiónposterior. Ningún caller activo.

Mongo propio: seis casos/56aserciones; creación/CAS/unique/ownership, respuesta perdida/replay/IDreuse/otra cuenta, carreras, rollback tardío y stage sinTX, tombstones/ausencia, identidad corrupta/inputs inválidos. Regresión de operador/selección central: seis casos/126aserciones, nuevo índice permanece staged. Recursos limpios. Suite769pass/217skip/0fail/10373aserciones, lint796/tipos/buildWebpack/worker46. Se corrigieron sólo tipos `_id:string`/nonnull y optional-chain de la fixture.

## 18c1 cerrado: productor offline

Clave canónica `settings:actor` validada contra el dueño de la intención. `LocalOutbox.commitUserSettingsCommand()` guarda valor, operación y secuencia en una transacción y notifica después del commit. CAS procede del shadow observado; una revisión positiva sin evidencia se rechaza. La revisión local se conserva hasta un ACK real. No modifica intentos/payloads existentes, no usa el tail global de categorías y depende sólo de la intención previa de ajustes.

Replay exige mismo UUID/payload y no restaura un valor posterior. Snapshot esperado detecta otro editor; otra partición o cuenta no puede escribir. Fallo tardío y overflow preservan datos/cola sin notificar éxito. Método preparatorio: generación5 sigue declarando settings unsupported; no hay UI/caller nuevo.

Nueve escenarios IndexedDB reales y recarga correctos, con particiones propias ya retiradas. Se corrigió la sintaxis de un await del fixture, el narrowing en callback e imports. Suite770pass/217skip/0fail/10381aserciones, lint801/tipos/buildWebpack/worker46. Evidencia: `/private/tmp/dalis-settings-outbox-proof.png`. Siguiente18c2: projection/ACK/pull para settings, separado del bloqueo de otras preferencias y con consumidores activos estrictos.

## 18c2 cerrado: proyección independiente y resultados

El contrato futuro valida el contexto completo antes de separar ajustes de categorías, asignaciones y posiciones. Cada familia conserva sus intenciones pendientes sin congelar la otra. ACK/replay mantienen lease, payload y evidencia; una respuesta antigua no degrada un shadow posterior ni un CAS deliberadamente más reciente. Sólo dependientes directos pendientes sin intentos se rebasan al resultado correspondiente. Consumidores actuales siguen estrictos; este corte no activa UI ni escribe ACK durable.

Nueve pruebas nuevas cubren independencia, conflicto, replay, lease, respuestas tardías, dependientes, ownership y corrupción. Suite 779 pass / 217 skip / 0 fail, 10430 aserciones; lint 803 archivos, tipos y build Webpack aprobados. Siguiente 18c3: escritura ACK y descarga atómicas con IndexedDB real. Sin cambios en Mongo del usuario ni generación activa.

## Dependencias para activación

1. 18b: colección registrada/repo actor-scoped con `_id` canónico y CAS, executor con replay común primero y settings/receipt/journal/counter atómicos; comprobar ownership/rollback/carreras/retry en Mongo propio. Evaluar consultas e índices en `ensure-indexes.ts`; no crear índices ad hoc.
2. 18c: clave `settings:actor` y productor IndexedDB atómico con cola/dependencias/guardias de cuenta. Confirmar snapshots/ACK/pull/incidentes/backup para settings y preservar pendientes/intentados y evidencia. Defaults de dispositivo no son intención confirmada.
3. 18d: transporte/capacidades ampliados conjuntamente. Cliente5 no puede consumir settings: negociación nueva exclusiva y retiro5 antes de ejecutar; sobres/journal2 e intención1 conservados. No activar cambiando sólo config.
4. 18e: UI compacta de Ajustes con guardado offline y sincronización; probar dos particiones/Next/Mongo reales, cuenta/epoch/pérdida de respuesta/replay/conflicto/recarga antes de activar todos los puertos. Sin cumpleaños/sharing/producción/wipe.

Los cortes se delimitan antes de editar; pueden agruparse cuando la aceptación completa quepa. No gastar una ventana en auditar los históricos. El checkbox de estado y reordenación ya entregados no necesitan reabrirse.
