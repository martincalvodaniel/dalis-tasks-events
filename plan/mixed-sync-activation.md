# Activación de la sincronización personal

Estado a 9 de octubre: los executors, writers, transporte, coordinador y runtime mixtos están preparados y probados en un entorno aislado. `11c4a4p` demuestra convergencia de categorías y asignaciones entre dos particiones y MongoDB, con respuesta perdida y replay. La aplicación desplegada sigue usando transporte 1 y sincroniza contenido propio simple. Preparar un módulo no lo activa.

## Alcance inicial

La primera activación incluye tareas/eventos propios sin repetición, categorías (`tag.save/delete/move`) y asignación de categoría (`item-view.set`). No incluye compartir, series, cumpleaños, settings ni orden manual de tareas (`task.move`). El orden de categorías sí dispone de executor; el orden de tareas necesita colocaciones y una política civil diferida.

Una cola histórica con `task.move` sin confirmar puede bloquear categorías posteriores y conservar toda la proyección personal. El diagnóstico debe comunicarlo, conservar la intención y permitir contenido independiente. No cambiar dependencias, confirmar localmente, superseder automáticamente ni convertir el movimiento en una asignación para desbloquearla.

## Versiones que deben mantenerse separadas

| Contrato | Valor para la transición | Regla |
| --- | --- | --- |
| Intención durable / fingerprint | 1 | Conservar UUID, payload y base de operaciones intentadas. |
| Transporte / anuncio del servidor | 2 | Envelope nuevo y lectura íntegra de journal mixto. |
| Evidencia local | Formatos legacy y 2 | Decodificar antes de seleccionar familia; replay histórico no prueba ancestralidad. |
| Backup portable | Leer 1 y 2; exportar 2 | Conservar historia y pendientes, importar mediante copias nuevas. |

[`sync-protocol.ts`](../src/config/sync-protocol.ts) mantiene por ahora ambos valores activos en 1. Cambiar sólo el anuncio no basta: el servicio legacy verifica la versión de intención, que debe seguir siendo 1. La acción pública también debe rechazar transporte antiguo antes de ejecutar.

## Cortes de activación, en orden

1. **Resumen mixto independiente.** Consumir el diagnóstico completo y las mismas capacidades del coordinador. Separar pendientes listos, espera, bloqueos, comandos sin soporte y conflictos. `settled` significa que terminó una pasada; no que todos los datos convergieron. Preparar y probar el resumen antes de conectar la UI compacta de Ajustes.
2. **Readiness de índices sólo lectura (preparada en `11c4a5i`).** El [helper](../src/lib/db/mixed-sync-index-readiness.ts) comprueba los índices registrados de categorías y vistas, incluidas claves ordenadas, unicidad y filtro de nombres activos. Ausencia, definición incompatible o error de lectura impiden habilitar escrituras personales. No crear índices desde auth, rutas o repositorios ni asumir que un nombre de índice demuestra su definición.
3. **Prerrequisito de entorno.** Los tres índices personales son `provisioning: "explicit"` en [`ensure-indexes.ts`](../src/lib/db/ensure-indexes.ts). `bun run db:ensure-indexes` sólo selecciona automáticos; no provisiona éstos. CLI y procedimiento ya están validados con MongoDB propio. El usuario ha autorizado crear exclusivamente en preproducción estos índices y los automáticos registrados faltantes; no se requiere otra confirmación. La ejecución espera el nombre explícito de DB y la configuración Preview/int verificada, sin asumir .env.local. Producción, reparación de datos y cambios de permisos quedan excluidos.
4. **Frontera autenticada mixta.** Preparar acción y respuesta pull en `features/sync/**`; `app/**` sólo conecta routing. Usar sesión vigente, cuenta esperada, schemas compartidos y servicios/DAL existentes. La guardia de transporte e índices ocurre antes del dispatcher; rechazar no autoriza ACK. Mantener respuesta privada/no-store y handshake explícito 2. La identidad conserva la verificación de Google/allowlist existente.
5. **Conexión del cliente y UI.** Cambiar conjuntamente transporte, runtime, scheduler, lectura del resumen, hooks y mensajes de capacidad. El estado personal bloqueado no debe pausar ramas de contenido independientes. Conservar cookies `same-origin`, control de cuenta/época, leases y límites globales de pasada. No activar sólo un filtro de comandos.
6. **Prueba de transición y piloto.** Probar frontera Next/Server Action autenticada con dos clientes: cuenta distinta, sesión caducada, cliente antiguo/nuevo, respuesta perdida, checkpoint, conflicto y cola histórica. Después, piloto autorizado en preproducción con Google y recarga/offline. La fixture loopback con actor propio no sustituye esta frontera ni la provisión real de índices.

Cada corte incluye sus rutas, aceptación, pruebas, plan, commit/push en `int` y lectura de ambas cuotas. Si un corte requiere una actuación externa no autorizada, cerrar primero toda la preparación revisable y conservar un bloqueo concreto; no activar parcialmente para aparentar progreso.

## Matriz obligatoria de compatibilidad

| Cliente / servidor | Resultado requerido antes de efectos |
| --- | --- |
| Cliente 1 / servidor 2 | Actualización requerida antes de pull y ejecución; cursor y pendientes intactos. |
| Cliente 2 / servidor 1 | Actualización requerida al leer anuncio 1; no interpretar página legacy como mixta. |
| Push legacy iniciado tras un handshake 1 anterior | La nueva acción exige envelope 2 y no llama al executor. |
| Transporte 2 / intención futura | Rechazar antes de ejecutor; no reinterpretar intención ni fingerprint. |
| Transporte 2 / índice faltante o incompatible | Escrituras personales deshabilitadas; pendientes conservados. |
| Cuenta remota distinta / cierre local durante red | Ningún resultado tardío aplicado; liberar únicamente lease propio anterior. |

No anunciar un rango 1–2 para permitir al cliente antiguo saltarse efectos personales. Si alguna prueba de transición falla, no habilitar la nueva frontera.

## Orden manual posterior

`11c5a1p` extrae el núcleo de ranking sin cambiar el comportamiento local. El executor de colocaciones exige después catálogo por cuenta/ámbito/fecha, autorización del contexto y vecinos, CAS por cada efecto y commit conjunto con vista, recibo y journal. ACK y pull locales deberán admitir placements antes de habilitarlo.

La intención histórica 1 no conserva timestamp de encolado. `command.date` de atrasadas es contexto civil y la fecha almacenada usa el sentinel `0001-01-01`. El reloj remoto actual no puede reemplazar ese contexto ni justificar rechazar automáticamente un movimiento offline. Cerrar esa política como decisión explícita antes de implementar el planner remoto; no inventar una fecha de intención.


La descarga privada preparatoria `11c4a6p` exige cuenta esperada y readiness antes del journal, y valida la página mixta completa. El anuncio 2 vive sólo en ese servicio aislado; conectar la ruta requiere completar también el envío, cliente y matriz de transición.


La guardia de envío preparatoria `11c4a6s` delega validaciones al batch y observa readiness antes del primer executor. No reemplaza sesión/autorización del dispatcher ni la provisión explícita de índices; un fallo conserva las intenciones para reintento. Próximo corte `11c4a7p`: conectar estos servicios a una frontera autenticada preparatoria y probar la matriz en aislamiento antes de la activación conjunta.


## Preparación concreta de la próxima frontera

`11c4a7p` comienza por un adapter server-only de descarga autenticada y una acción de envío 2 independiente, todavía sin conectar la ruta, el hook, la identidad ni el anuncio activo. Rutas candidatas: `src/features/sync/authenticated-pull-v2.ts`, `src/features/sync/actions-v2.ts` y tests acotados de frontera; la integración y plan tienen un solo dueño. Reusar [la sesión persistida](../src/lib/auth/session.ts), [descarga privada](../src/features/sync/pull-response-v2.ts), [envío guardado](../src/features/sync/guarded-push-batch-v2.ts), readiness central y executors/DAL existentes. No aceptar actor del cliente ni omitir allowlist; la sesión debe seguir usando disableCookieCache/disableRefresh. Toda entrada sigue validada por schemas compartidos antes de ejecución.

Aceptación del primer corte: actor sólo desde headers/sesión real; cuenta esperada, transporte/intención y readiness antes del dispatcher; sin sesión/cuenta cambiada/envelope antiguo/índice ausente no hay escrituras ni ACK. No cambiar actions legacy o config1 hasta que el cliente 2 y los índices estén preparados conjuntamente. Validar por puertos las llamadas y ausencia de efectos; esta prueba no se presenta como RPC real. Corte posterior: runner Next/Server Action autenticado en recursos propios, que cubra la matriz anterior y pérdida de respuesta. El piloto Google de preproducción requiere sus prerrequisitos y sesión vigente.

Antes de activar, ejecutar el procedimiento validado de índices únicamente en preproducción con destino verificable y la autorización explícita del 9 de octubre. El nombre de DB sigue pendiente; no usar el fallback del código como declaración del destino ni pedir otra aprobación para los índices. Los módulos preparados permiten seguir trabajo útil independiente en la próxima ventana. El orden manual conserva su dependencia de política civil y recepción de placements.


Adaptadores y acción preparatoria `11c4a7p` cerrados: defaults usan sesión persistida/allowlist y DAL reales; tests de puertos verifican guardias y headers. Falta runner Next real y conexión conjunta para habilitarlos desde el producto. La API y acción legacy conservan su comportamiento actual.


La respuesta de identidad admite anuncio explícito validado desde `11c4a7h`. Default del producto sigue1; futuras fixtures/rutas mixtas pueden seleccionar2 sin cambiar configuración global. Se conservan body validado, privacidad y estados; versiones inválidas rechazan, sin anunciar compatibilidad1–2.


### Provisión preparatoria cerrada

`11c4a8p` aporta selección central exacta y ejecución con puertos, sin conexión de entorno. Reinspecciona antes de cada alta, bloquea definiciones incompatibles y conserva estado parcial ante fallo. created enumera sólo calls resueltas: una call rechazada puede haber creado índice, por eso readiness final se observa aparte. Duplicados o equivalente con otro nombre requieren revisión, nunca drop/rename/deduplicación automática. El siguiente corte debe probar Mongo propio y preparar un CLI con destino explícito validado antes de conectar, sin ejecutar en DB del usuario.


Panel `11c4a9u` preparado: alcance opcional con default de transporte1 y summary2 para pendientes personales compactos. Activación futura debe cambiar el caller y el resumen en el mismo corte del runtime/transporte, no sólo seleccionar el texto de categorías sincronizadas. Una pasada settled no oculta conflictos ni bloqueos personales.


`11c4a8m` comprueba provisión parcial/reintento y respuesta perdida con MongoDB real del descriptor propio (dos escenarios/20 aserciones). No ejecuta el procedimiento en DB del usuario ni habilita caller productivo. CLI/destino revisables y autorización del entorno siguen pendientes antes de activación.


### Evidencia de frontera autenticada 11c4a7n

Siete escenarios con Next compilado, dos sesiones Better Auth persistidas y MongoDB propios pasan: action2/defaults autentican y escriben tareas/categorías/asignaciones, ambas sesiones descargan journal real, replay no duplica y estados de cuenta/versión/sesión rechazan sin efectos. Wrapper exclusivo valida capability/cookies dentro de RPC; no equivale al ID exacto del endpoint desplegado ni a Google interactivo. Índices sólo del descriptor propio. Producto permanece transporte1. Falta procedimiento de provisión de entorno revisable/autorizado y conexión conjunta de ruta/acción/identidad/cliente/UI; no anunciar2 por configuración aislada.


### Revisión offline de las definiciones 11c4a8v

Ejecutar `bun --no-env-file run db:preview-personal-indexes` imprime las tres especificaciones personales y, desde11c4a8e1, las nueve automáticas del selector central real, sin conectar ni leer configuración de DB/auth. Es una vista previa de código; no inspección del despliegue. Cualquier argumento (incluido --apply) se rechaza. Falta CLI de ejecución con destino explícito validado antes de conexión, revisión de efectos del bootstrap automático y autorización de entorno. La autorización actual excluye ejecutarlo en DB del usuario.


El [contrato de provisión de entorno](personal-index-provisioning.md) (`11c4a8c`) divide guardia de destino, CLI/adaptador y prueba propia. La ejecución basada en getDatabase incluye bootstrap automático de índices registrados; no se ofrece como readonly. DB sin fallback y autoridad exacta preceden conexión, pero no sustituyen autorización del entorno. Siguiente corte11c4a8g antes de conexión conjunta.


Guardia de descriptor11c4a8g1 y resolver/config explícita11c4a8g2 cerrados sin IO. DB raw sin fallback y autoridad exacta sin userinfo se comparan antes de futura conexión; esto no acredita entorno o autorización. Revisión offline completa11c4a8e1 está entregada. Siguiente11c4a8e2 adaptador/CLI online y11c4a8t prueba de destino propio; no tocar DB del usuario ni activar transporte2 hasta prerrequisitos.


Cierre del lote05:27: código7525376, ciclo privado por puertos preparado y probado sin defaults/CLI. Siguiente11c4a8e2b conecta defaults/CLI y11c4a8t verifica Mongo propio antes de ofrecer ejecución de entorno. Transporte1 vigente; una revisión futura confirmada9oct10:29Madrid, reservas4%/1%. No ejecutar índices en DB del usuario ni anunciar2 por config aislada.


### 11c4a8auth — Autorización explícita de índices preproductivos

Objetivo y target_paths: registrar autorización humana en plan/personal-index-provisioning.md, mixed-sync-activation.md, master.md, workflow.md, iterations.md e iteration-log.md y actualizar el heartbeat existente sin cambiar horario/política. Dependencias: procedimiento preparado hasta7525376 y próxima revisión10:29. Aceptación: usuario confirma DB distintas y autoriza crear índices personales necesarios y automáticos registrados faltantes únicamente en preproducción, reutilizando ensureIndexes después de validar procedimiento, sin otra confirmación. Producción excluida; no borrar/corregir datos ni reparar incompatibilidades automáticamente. Esta autorización sustituye exclusiones históricas de DB del usuario sólo para esa provisión. Verificar conexión preview/int desde fuente de configuración de entorno; nunca asumir que .env.local es preview ni conectar para averiguarlo.

Lectura6%5h/55%7d, reservas4%/1%: sólo cierre documental ahora; defaults/CLI/prueba propia y ejecución preproductiva continúan en revisión10:29 tras verificar renovación. CLI Vercel/project link local no disponibles en comprobación inicial; resolución del destino permanece pendiente, sin acceso a DB ni credenciales impresas. No confundir autorización con ejecución o categorías activadas. Validación documental referencias/consistencia/diff, actualización de heartbeat preservando campos, ConventionalCommit/pushint/HEAD/cuotas.


11c4a8e2b/11c4a8t: defaults/CLI separado y prueba real propia cerrados. Bootstrap9+personal3, guardias sin IO, partial-create/retry/noop y cierre comprobados con3casos/70aserciones. Autorización preproductiva ya otorgada; queda nombre DB explícito tras localizar configuración Preview de Vercel. Producto transporte1. La siguiente preparación independiente es ensamblaje cliente2/controles mixtos y respuesta legacy update_required antes de retirar su executor durante transición; no activar parcial ni anunciar2 sin índices/cliente/rutas conjuntos.


Ensamblajecliente11c4a9c1: dispatcher2 y resumen guardado independientes, SyncAttemptV2/SyncSchedulerV2 delegan controles existentes conservando diagnóstico/coalescencia y limpiándolo ante cancelación/cuenta distinta/fallback. Sin imports desde hook/provider activo ni config/rutas editadas; build sigue una acciónnode. Antes de activación, conectar composición conjunta y retirar acciónlegacy mediante resultado legacy update_required antes de executor, no devolver envelope2 al cliente1. Ocho tests/57aserciones no sustituyen pilotoGoogle.


11c4a9c2 cierra [composición cliente](../src/features/sync/mixed-sync-client.ts) privada y [retirementcompatible](../src/features/sync/retired-sync-push.ts). El nuevo cliente usa defaults2 con cuenta/epochcapturados, guardiasrefresh y cierrepropio. Retirementautenticado validaenvelope/cuenta y retorna legacyupdate_required sin executor/ACK; acción1 activa todavía conserva comportamiento1. Ocho tests79aserciones, incluidohandshake1 anterior→update_required con intención/cursor/historia intactos y lease liberado. Antes de activar conectar retirementenacciónlegacy y composiciónenhook junto a identidad/pull/UI; nueva pruebaNext directa pendiente. Manifiesto app conserva una solaacción.


11c4a9n refuerza prueba RPC: nueve escenarios compilados usan dispatcher2 directo a la acción productiva, ya sin wrapperparaV2, y createMixedSyncClient con defaults íntegros. Dos account-control/IndexedDB y sesiones persistidas/Mongo propios prueban tresACKs locales, proyección igualjournal/cursor en ambos, summary/noop/historia intactos y retirementhelperautenticado sin writes. APIs exactas sólo fixture, cookiecaprun/Host/Origin/authcookiesown; cleanup completo. Esto acredita la referencia generada en fixturelocal, no el ID del despliegue ni Googleinteractivo. Producto sigue1 y creacióníndicespreprod aún requiere nombreDBexplicito/fuenteverificada, sin nuevaaprobación.


11c4a9r: diez escenarios Next correctos; sesión revocada conserva toda la intención/cola/cursor, reautenticación del mismo actor confirma una sola vez y ambos dispositivos convergen con Mongo propio. FullDoD aprobado y recursos propios cerrados. Producto sigue transporte1 y provisión preproductiva espera únicamente nombre DB explícito, con actuación ya autorizada.


11c4a9a: once escenarios Next correctos; otra sesión verificada produce account_changed sin claim ni mutaciones locales o en ninguna de las dos cuentas remotas. Recuperar la sesión original confirma una sola vez y ambos dispositivos convergen con el diario propio. Baselines anteriores al ACK y escenarios previos conservados; fullDoD aprobado, recursos propios cerrados. Producto1 sigue activo y provisión preproductiva espera nombre explícito, con autorización vigente.


11c4a9e: doce escenarios Next correctos. La composición de época antigua rechaza resumen/intento por la guardia exacta, conserva toda intención/cola/cursor y la composición de la nueva época confirma una sola vez; ambas particiones convergen con Mongo propio. Cleanup sigue la nueva época comprometida; fullDoD aprobado. No prueba de red en vuelo ni activación productiva, y provisión preproductiva continúa pendiente del nombre explícito.

## Siguiente corte concreto — 11c4a9h

Mientras falta el nombre de DB, puede prepararse `src/features/sync/hooks/use-mixed-sync-engine.ts` sin caller activo. Reutilizar `createMixedSyncClient`, `SyncSchedulerV2`, `isAccountSyncCacheKey` y las señales existentes, sin duplicar algoritmos de envío/scheduling. Capturar userId/epoch; usar un cache key de resumen separado de transporte1 que conserve las tres primeras posiciones de cuenta (por ejemplo, `["dalis:sync-queue", userId, epoch, 2]`). Notificaciones deben refrescar ese key y los incidentes propios; refresh general conserva el filtro de cuenta. Cancelar intento/scheduler/listeners al desmontar, impedir actualizaciones tardías con disposed y no reutilizar estado de otra época. Summary y result son mixtos; alcance preparado no se muestra desde el proveedor actual. Esta entrega requiere prueba de lifecycle real del hook, además de los controles y composición ya probados; dividir hook/prueba antes de abrir si el coste no cabe.

La conexión productiva es un corte posterior conjunto, condicionado al recibo de índices de preproducción ready+closed:

- `src/app/api/sync/identity/route.ts`: anunciar2 explícito con identidad autorizada vigente.
- `src/app/api/sync/changes/route.ts`: delegar en getAuthenticatedSyncChangesResponseV2; routing únicamente.
- `src/features/sync/actions.ts`: retirar ejecución legacy mediante rejectRetiredSyncPush y headers reales; conservar resultado legacy cuando se pueda resolver esa referencia.
- Hook mixto, `components/active-sync-provider.tsx`, `sync-context.ts` y `components/device-sync-settings.tsx` bajo features/sync: conectar cliente/runtime2, tipos/summary2 y scope de UI al mismo tiempo. Nueva acción sigue actions-v2/client-action-v2.
- No cambiar intención durable1 ni habilitar un rango1–2, crear índices desde requests o prometer orden manual/series/compartidos. No basta cambiar sync-protocol.ts.

Los IDs de Server Actions pueden cambiar con el build y las acciones sin referencia se eliminan, según `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`. La prueba local de referencia directa no demuestra que un ID antiguo del deployment invoque el retirementhelper. La matriz de transición debe contemplar también referencia antigua ausente: no efectos/ACK, cola y lease conservados/liberados correctamente, rechazo temporal comprensible y siguiente handshake2 que exige actualización. No conservar un endpoint mediante un botón ficticio ni alterar secretos de cifrado o hosting para el piloto. Google real y recarga/offline de preproducción permanecen una evidencia distinta del fixture.


### 11c4a8pre — Nombre confirmado; acceso pendiente de Vercel

El usuario confirma dalis-tasks-events como nombre de DB preproductiva. Se revalidó la misma guía del recurso Preview identificado previamente; Show secret solicita Reauthenticate y queda deshabilitado hasta verificar identidad. Captura privada se abortó sin obtener URI, fichero de credenciales ni conexión Mongo; ninguna ejecución del operador, índice o mutación remota. Se pidió únicamente completar la verificación de Vercel en su propia pestaña, sin códigos en chat ni otra aprobación de índices. CLI/procedimiento siguen validados y autorización vigente; tras verificación reanudar captura privada/descriptor explícito/ejecución única/readiness/cierre, no reabrir pregunta del nombre.

Entrada10%5h/41%7d reservas4%/1%. Este corte no activa producto ni modifica código. Validación documental referencias/consistencia/diff, commitpushint/HEAD/cuotas al cerrar si el acceso no queda disponible. Mantener revisión única15:31 con prompt actualizado a nombre confirmado y gate de reautenticación. Fuera de la provisión, siguiente hook mixto inactivo11c4a9h requiere ventana nueva.


### Actualización 11c4a8pre — Identidad verificada; ejecución aplazada por cuota

El usuario completó Reauthenticate. La URI del mismo recurso Preview se capturó en fichero temporal privado600 y se volvió a ocultar; no se imprimieron credenciales. El launcher no inició el CLI: primer fallo por condición react-server ausente en el proceso padre; segundo por pasar el campo de procedencia source al schema estricto de conexión. Ambos anteriores a spawn/conexión. Para siguiente ejecución usar --no-env-file --conditions=react-server en padre e hijo y pasar al resolver únicamente {mongodbUri,databaseName}, verificando procedencia aparte. La corrección del launcher se identificó pero no se ejecutó otra conexión. El finally eliminó el fichero de credenciales; launcher propio retirado al cierre. Ningún índice/DB/documento remoto tocado ni recibo de provisión inventado.

Lectura real4%5h/40%7d: no abrir otra ejecución sobre reserva4%/1%. Nombre y verificación Vercel ya confirmados; única revisión15:31 preservada con prompt actualizado. Próximo lote revalida fuente Preview, recaptura URI privada y ejecuta procedimiento ya probado; no repetir pregunta del nombre ni pedir nueva autorización. Producto permanece1. Este corte cierra documentación y diagnóstico, no provisión completada; referencias/diff/consistencia, commitpushint/HEAD/cuotas.
