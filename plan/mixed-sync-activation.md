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
3. **Prerrequisito de entorno.** Los tres índices personales son `provisioning: "explicit"` en [`ensure-indexes.ts`](../src/lib/db/ensure-indexes.ts). `bun run db:ensure-indexes` sólo selecciona automáticos; no provisiona éstos. Preparar una ejecución concreta revisable antes de solicitar autorización del entorno. El lote desatendido actual no autoriza tocar la DB del usuario ni sus permisos. El runner aislado ya provisiona exclusivamente su propia DB.
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

Antes de activar en el entorno del usuario, preparar una ejecución explícita de los tres índices registrados con destino verificable, inspección previa y sin cambios ajenos; no ejecutar esa actuación con la autorización actual, que excluye la DB del usuario. Los módulos preparados permiten seguir trabajo útil independiente en la próxima ventana. El orden manual conserva su dependencia de política civil y recepción de placements.


Adaptadores y acción preparatoria `11c4a7p` cerrados: defaults usan sesión persistida/allowlist y DAL reales; tests de puertos verifican guardias y headers. Falta runner Next real y conexión conjunta para habilitarlos desde el producto. La API y acción legacy conservan su comportamiento actual.


La respuesta de identidad admite anuncio explícito validado desde `11c4a7h`. Default del producto sigue1; futuras fixtures/rutas mixtas pueden seleccionar2 sin cambiar configuración global. Se conservan body validado, privacidad y estados; versiones inválidas rechazan, sin anunciar compatibilidad1–2.


### Provisión preparatoria cerrada

`11c4a8p` aporta selección central exacta y ejecución con puertos, sin conexión de entorno. Reinspecciona antes de cada alta, bloquea definiciones incompatibles y conserva estado parcial ante fallo. created enumera sólo calls resueltas: una call rechazada puede haber creado índice, por eso readiness final se observa aparte. Duplicados o equivalente con otro nombre requieren revisión, nunca drop/rename/deduplicación automática. El siguiente corte debe probar Mongo propio y preparar un CLI con destino explícito validado antes de conectar, sin ejecutar en DB del usuario.


Panel `11c4a9u` preparado: alcance opcional con default de transporte1 y summary2 para pendientes personales compactos. Activación futura debe cambiar el caller y el resumen en el mismo corte del runtime/transporte, no sólo seleccionar el texto de categorías sincronizadas. Una pasada settled no oculta conflictos ni bloqueos personales.


`11c4a8m` comprueba provisión parcial/reintento y respuesta perdida con MongoDB real del descriptor propio (dos escenarios/20 aserciones). No ejecuta el procedimiento en DB del usuario ni habilita caller productivo. CLI/destino revisables y autorización del entorno siguen pendientes antes de activación.


### Evidencia de frontera autenticada 11c4a7n

Siete escenarios con Next compilado, dos sesiones Better Auth persistidas y MongoDB propios pasan: action2/defaults autentican y escriben tareas/categorías/asignaciones, ambas sesiones descargan journal real, replay no duplica y estados de cuenta/versión/sesión rechazan sin efectos. Wrapper exclusivo valida capability/cookies dentro de RPC; no equivale al ID exacto del endpoint desplegado ni a Google interactivo. Índices sólo del descriptor propio. Producto permanece transporte1. Falta procedimiento de provisión de entorno revisable/autorizado y conexión conjunta de ruta/acción/identidad/cliente/UI; no anunciar2 por configuración aislada.


### Revisión offline de las definiciones 11c4a8v

Ejecutar `bun --no-env-file run db:preview-personal-indexes` imprime sólo las tres especificaciones centrales, sin conectar ni leer configuración de DB/auth. Es una vista previa de código; no inspección del despliegue. Cualquier argumento (incluido --apply) se rechaza. Falta CLI de ejecución con destino explícito validado antes de conexión, revisión de efectos del bootstrap automático y autorización de entorno. La autorización actual excluye ejecutarlo en DB del usuario.


El [contrato de provisión de entorno](personal-index-provisioning.md) (`11c4a8c`) divide guardia de destino, CLI/adaptador y prueba propia. La ejecución basada en getDatabase incluye bootstrap automático de índices registrados; no se ofrece como readonly. DB sin fallback y autoridad exacta preceden conexión, pero no sustituyen autorización del entorno. Siguiente corte11c4a8g antes de conexión conjunta.
