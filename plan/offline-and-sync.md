# Offline, sincronización y arquitectura

## Principio de escritura

La UI siempre lee de IndexedDB y escribe primero en IndexedDB, con red o sin ella. Una transacción local guarda el cambio visible y su operación de outbox; solo después aparece “Guardado en este dispositivo”. La respuesta remota confirma el estado canónico, pero no sustituye cambios locales pendientes sin reconciliarlos.

SWR puede suscribirse a lecturas locales y gestionar revalidación, sin convertirse en fuente persistente. Un fetch remoto nunca reemplaza directamente el estado visible. IndexedDB almacena datos, no tokens Google ni cookies de sesión.

## Estructura propuesta

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/(auth)/**` | Páginas de autenticación existentes. |
| `src/app/(dashboard)/**` | Entrada protegida online; mantener comprobación de sesión en layout. |
| `src/app/(offline)/workspace/page.tsx` | Envoltorio neutro prerenderizable, sin datos personales ni auth de servidor; monta el espacio local. |
| `src/app/manifest.ts` | Manifest PWA, inicio en `/workspace`, metadata de instalación. |
| `src/app/api/sync/{identity,bootstrap,changes,protocol}/route.ts` | Lecturas autenticadas y handshake; thin handlers, lógica fuera de `app`. |
| `src/features/{tasks,events,birthdays,tags,calendar,sharing}/**` | Componentes, hooks y casos de uso por dominio. |
| `src/features/sync/actions.ts` | Server Action de lote que valida y aplica intenciones pendientes. |
| `src/features/sync/**` | Coordinador, estados, reconciliación, conflictos y componentes. |
| `src/features/workspace/**` | Arranque local, cambio de cuenta y shell reutilizado por ambas entradas. |
| `src/lib/local-db/**` | Cliente IndexedDB, repositorios locales, migraciones y backup; frontera cliente. |
| `src/lib/calendar/**` | Reglas puras: rangos, fechas civiles, ocurrencias y atrasadas. |
| `src/lib/db/**` | Repositorios MongoDB, transacciones, adaptador auth y mapeos server-only. |
| `src/lib/pwa/service-worker.ts` | Fuente TypeScript del worker; salida JavaScript generada durante build. |
| `src/schemas/**`, `src/types/**` | Contratos compartidos, sin dependencias de Next.js ni driver. |
| `src/config/**` | Configuración servidor y configuración pública explícita, sin filtrar secretos. |
| `src/proxy.ts` | Permitir shell y assets neutros; APIs verifican sesión real, no solo cookie. |

La ruta `/workspace` y la UI interactiva cliente son una desviación deliberada del server-first para satisfacer la reapertura offline. No exponen datos remotos ni sustituyen autenticación de APIs/acciones. Se conserva el layout protegido para la entrada online existente. `app/manifest.ts` es metadata oficial del framework; ningún caso de uso se mueve a `app/**`.

Las mutaciones remotas seguirán en Server Actions. En el MVP la sincronización ocurre mientras la app está abierta; no se invocan acciones desde el worker ni se persisten sus IDs de build. Si pruebas de actualización muestran necesario un endpoint de mutación estable, proponer una excepción concreta a esta regla antes de implementarla.

## Identidad local y remota

1. Primera conexión: Google login, comprobar autorización del piloto y persistir usuario/cuenta/sesión con Better Auth y su adaptador MongoDB. El driver se mantiene encapsulado en `lib/db/**`, compartiendo singleton e índices.
2. Obtener identidad mínima desde servidor e inicializar partición IndexedDB del `userId` estable. Datos de cuenta y cola se particionan por usuario; no usar email o presencia de cookie como prueba remota de propiedad.
3. Preparar shell, recursos y copia local; mostrar “Disponible sin conexión” únicamente tras verificar la preparación.
4. Desconectado: recordar cuenta previamente preparada y permitir continuar localmente aunque expire la sesión. No autorizar endpoints basándose en ese recuerdo.
5. Al reconectar: autenticar de nuevo si hace falta y comparar identidad remota/local **antes** de enviar una operación. Una cuenta diferente no hereda la cola ni los datos de la anterior.
6. Cambio de cuenta requiere sesión online válida para activar otra partición. Cerrar sesión oculta y desactiva la partición; no la borra automáticamente si hay cambios sin subir. Ofrecer exportar, conservar para la próxima sesión de la misma cuenta o descartar explícitamente.
7. En varias pestañas, propagar logout/cambio de cuenta y detener sincronización. Logout offline bloquea acceso local y registra que falta completar logout remoto; no fingir que se revocó una sesión en el servidor.

El aislamiento local es funcional dentro de un navegador, no cifrado frente a otra persona con acceso a ese mismo perfil. Un XSS o acceso al perfil del dispositivo puede leer IndexedDB. No prometer una protección criptográfica no implementada.

Las sesiones actuales sin adaptador requieren migración: en `01b` comprobar comportamiento, forzar nueva autenticación cuando no exista identidad persistida y evitar asignar datos a IDs transitorios. Las mutaciones y lecturas de permisos usan verificación remota vigente; una cookie cacheada de siete días no basta como evidencia de revocación actual.

### Implementación de `01a`

El adaptador MongoDB de Better Auth está conectado mediante inicialización diferida en `src/lib/db/auth-adapter.ts`. La importación no exige `MONGODB_URI` ni abre red; el primer acceso obtiene la conexión del singleton y provisiona índices desde el registro central. La vista de DB del adaptador solo admite las cuatro colecciones de auth y reconoce peticiones automáticas de índices sin crearlos por su cuenta. Esta excepción limitada a las consultas internas de una dependencia está recogida en `src/lib/db/AGENTS.md`.

Se han desactivado la cookie de datos de cuenta y `refreshCache`, pensado por Better Auth para sesiones sin DB. `01b` también desactiva caché de sesión y obliga a leer DB vigente en autorización; las cookies antiguas sin sesión persistida se rechazan. Transición, revocación y expiración se comprueban con tokens firmados y MongoDB local real.

Auth conserva las escrituras atómicas por documento y los índices únicos, sin habilitar transacciones de varios documentos del adaptador: no se le proporciona un segundo `MongoClient` ni se asume un replica set. El protocolo de sincronización de `11` sí exige las transacciones y la comprobación de infraestructura descritas abajo.

## IndexedDB

Stores propuestos: `items`, `occurrences`, `tags`, `itemViews`, `taskPlacements`, `settings`, `memberships`, `invitations`, `outbox`, `remoteShadows`, `syncMetadata`, `conflicts`. Representación elegida en `03a`: una base `dalis-account:<userId codificado>` por usuario estable. Versión inicial 1 con ocho stores de dominio; `03b` migra a versión 2 añadiendo `outbox`, `remoteShadows` y `syncMetadata`, sin borrar registros. `13a` reutiliza `syncMetadata` para outcomes y resoluciones con claves propias; no necesita un store `conflicts` separado ni una migración física adicional. Repositorios cliente validados por Zod y preferencias personales comprobadas contra la partición.

- Índices locales por tipo/fecha, serie, usuario, categoría y operaciones pendientes según consultas reales.
- Outbox guarda intención tipada: ID UUID de operación, ID entidad, tipo, `baseRevision`, payload validado, orden local, dependencias y versión de protocolo. No guardar un POST de Next.js ni su action ID.
- `remoteShadows` mantiene la última versión remota aceptada; la vista local añade las intenciones pendientes encima. Esto evita que un pull borre un cambio offline.
- Estados de operación: pendiente, enviando con lease recuperable, confirmada, conflicto o rechazada. Reiniciar devuelve un envío sin confirmación a pendiente; nunca suponer que “enviando” significa aplicado.
- Crear y luego editar/borrar offline respeta dependencias. Tras cada ACK, avanzar revisión base de la siguiente intención compatible de esa entidad; no mandar diez revisiones basadas en el mismo valor.
- Si fallan cuota, migración o transacción, no cerrar el formulario como guardado. Permitir reintento y exportación de información recuperable.
- Versiones de esquema y migraciones pequeñas. No borrar la base como estrategia de actualización. Datos importados y datos locales antiguos también se validan con Zod.
- Copia local completa de los datos accesibles de tamaño MVP, incluidas series/historial. Una descarga parcial muestra progreso; no declarar un calendario vacío como si fuese completo.

IndexedDB ofrece almacenamiento indexado y transacciones; Cache API tiene otra responsabilidad: recursos de la aplicación. Referencias: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [cuotas y expulsión](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## PWA y apertura offline

- Manifest, icons locales, HTTPS en producción y registro del worker; no depender de recursos externos en ejecución para la UI principal.
- Cachear exclusivamente shell neutro y sus assets versionados: HTML, JS, CSS, fuentes e iconos necesarios. Probar que navegar a meses/días y recargar no requiere descargar un chunk que falta.
- No cachear HTML personalizado del dashboard, respuestas de auth, API privadas, POST de acciones ni payloads RSC con datos de usuario.
- El worker responde a navegación `/workspace` con shell preparado; selección de mes/día se resuelve con estado local y URL sin necesitar render remoto. Si se usa router/prefetch, probar su comportamiento desconectado expresamente.
- Fuente del worker en TypeScript; compilar con herramientas ya instaladas a un asset JavaScript. No escribir fuente nueva en JS ni añadir Serwist automáticamente. Comprobar cómo servir la salida con el build actual en `04a`.
- Cache por versión de build; preparar completamente la nueva antes de activar. No recargar a mitad de guardar ni borrar IndexedDB al actualizar.
- Solicitar persistencia mediante Storage API cuando proceda; su denegación no bloquea uso, pero se informa del estado y se ofrece backup. La [política de almacenamiento](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) depende del navegador.
- Exportación/importación JSON versionada y validada para la cuenta activa. Incluye trabajo pendiente; importar no conserva recibos remotos como prueba, genera nuevas intenciones idempotentes y revisa duplicados/propiedad.

La guía instalada incluye `experimental.useOffline`: no activarlo como solución a persistencia/reapertura. No mezclar su reintento automático con una segunda cola que pueda duplicar mutaciones. El MVP usa una única outbox propia. Consultar [guía PWA instalada](../node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md) y las guías de `useOffline` antes de cualquier cambio de esa decisión.

## Transporte de sincronización

Disparadores: arranque, conexión recuperada, retorno al primer plano, nueva operación con red y botón “Sincronizar”. Son señales para intentarlo; `navigator.onLine` no demuestra acceso al servidor. Mientras esté visible, polling moderado para recibir cambios de colaboradores, con pausa/backoff ante errores.

No prometer sincronización con la app cerrada. [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) tiene disponibilidad limitada y no es requisito del MVP. Se puede evaluar después de tener un transporte compatible.

Secuencia del ciclo:

1. Adquirir lease de sincronización por cuenta en IndexedDB; coordinar pestañas con `BroadcastChannel`. Lease expira y puede recuperarse si la pestaña muere; deduplicación remota sigue siendo necesaria.
2. Confirmar sesión e identidad. Obtener versión de protocolo y compatibilidad de build mediante una lectura sin caché. Pausar si requiere login o actualización.
3. Descargar cambios desde cursor y reconciliarlos con shadows/intenciones. Aplicar datos y cursor en la **misma transacción local**.
4. Enviar lote limitado a la Server Action; validar cada intención y limitar tamaño/cantidad en esquemas. No depender de paralelizar Server Actions desde el navegador.
5. Para cada respuesta, actualizar shadow/revisión y confirmar outbox en una transacción local. Una respuesta de lote parcial identifica operación por operación, nunca asume éxito de todo el lote.
6. Descargar cambios posteriores hasta el límite de este ciclo, actualizar estados y liberar lease. Reintento con backoff y jitter, sin bucle constante mientras falta red o sesión.

Server Actions cambian de ID entre builds. La [guía instalada](../node_modules/next/dist/docs/01-app/02-guides/server-actions.md) lo documenta: si un cliente antiguo no puede llamar a una acción, conservar intenciones, obtener shell compatible al volver la conexión y reintentar con los **mismos operation IDs**. Una actualización incompatible de protocolo no convierte errores en “sincronizado”; exige migración verificable o deja la cola detenida y exportable.

## Garantías remotas

Primer avance preparatorio11b0: [operation-fingerprint.ts](../src/lib/sync/operation-fingerprint.ts), módulo server-only, valida el payload con syncOperationSchema y calcula SHA256 hexadecimal de64 caracteres. Canonicalización propia v1: ordenar claves de objetos por comparación binaria en todos los niveles, conservar orden de arrays y serializar JSON tras normalización de Zod; prefijo `sync-operation-fingerprint:v1\n` antes del JSON, UTF8. Incluye operationId/protocolVersion/baseRevision/command. No es una implementación de un estándar externo de JSON canónico; futuros cambios de normalización/schema requieren revisar compatibilidad de recibos.

El servidor futuro recalcula la huella y busca recibo por actor de sesión+operationId; nunca acepta una huella del cliente como prueba de ejecución/autorización. Desde11b1a hay [ejecutor atómico](../src/lib/db/remote-item-commands.ts), colecciones de recibos/journal/contadores e integración real para tareas/eventos simples propios. Desde11b1b existe acción autenticada de subida por lotes, aún sin coordinador ni sincronización activa. Persistencia transaccional y replay remoto deben probarse en11a/11b; la huella por sí sola no impide duplicados. Alcance inicial remoto adelantado a tareas/eventos simples, antes de09c/10; comandos todavía sin soporte conservan cola pendiente y no se confirman.

- Derivar actor de la sesión persistida; comprobar dueño/membresía en cada lectura y mutación. Validar estructura con Zod no autoriza un ID ajeno.
- Aplicar control optimista por `baseRevision` con compare-and-swap y subir `revision` en el servidor. No usar timestamps del cliente como ganador.
- Recibo de operación único por `(actorUserId, operationId)` y hash de payload: repetir devuelve el mismo resultado; reutilizar ID con otro contenido se rechaza. Conservar recibos durante el horizonte compatible; no TTL arbitrario que permita reproducir una operación antigua.
- Mutación, revisión, recibo y entradas del registro de cambios se escriben en una transacción MongoDB. Prerrequisito: replica set/clúster compatible, confirmado en `11a`. Las operaciones del driver quedan en la capa de datos; no exponer `ClientSession` a componentes/features.
- Cambios ordenados por secuencia **por usuario receptor**, asignada mediante contador actualizado en esa misma transacción. La escritura al contador serializa operaciones concurrentes para evitar saltar un cambio que termine de confirmar después. Actualizar contadores en orden estable al compartir con varios usuarios y reintentar conflictos transaccionales.
- Journal por receptor permite enviar solo cambios propios/autorizados y eventos de retirada de acceso. Lecturas también revalidan permisos actuales; no entregar un payload viejo cuya membresía ya se revocó.
- Bootstrap completo: capturar un cursor de inicio y paginar una vista consistente o mantener un checkpoint durable; después reproducir todos los cambios posteriores a ese cursor. No leer documentos en páginas móviles y devolver un cursor final que omita cambios intermedios. Conservar outbox durante cualquier bootstrap.
- Borrados lógicos y cancelaciones de ocurrencia viajan como tombstones. Revocar acceso genera retirada para el usuario afectado, sin enviar nuevos datos del elemento.
- Si se compacta el journal, exponer cursor mínimo. Cursor caducado fuerza nueva copia remota sin borrar intenciones locales. Mantener tombstones/recibos necesarios para no resucitar borrados ni repetir operaciones; en MVP evitar compactación prematura.
- No se usan change streams ni procesos residentes como requisito de serverless; el journal durable y polling resuelven la base.

MongoDB garantiza operaciones atómicas por documento y transacciones entre documentos en despliegues compatibles: [documentación primaria](https://www.mongodb.com/docs/manual/core/transactions/). El protocolo anterior es diseño del proyecto, no una funcionalidad automática del driver.

## Conflictos y permisos revocados

MVP conservador: un desajuste de revisión no sobrescribe automáticamente contenido remoto. Guardar conflicto con versión base, estado remoto e intención local; pausar operaciones dependientes de esa entidad y continuar otras independientes.

- Mostrar versión local/remota y permitir conservar remoto o reaplicar el cambio propio sobre la revisión actual, con un nuevo operation ID y validación de permisos. Preservar el original como evidencia hasta resolverlo.
- Checklist por IDs permite una fusión explícita de puntos independientes en una ampliación; no asumir que todos los cambios pueden fusionarse.
- Eliminación frente a edición: no resucitar. Si el dueño quiere recuperar, crear una copia nueva con ID nuevo y confirmación explícita.
- Permiso revocado: retirar elemento de la vista activa, rechazar mutaciones y conservar un registro mínimo recuperable del trabajo no aceptado, sin exponerlo como acceso vigente. Definir su exportación/descartado en `14c`.
- `401`: detener envío y ofrecer login; mantener el trabajo local. `403`: revisar acceso, sin reintentos infinitos. Error de validación: explicar y permitir corregir; error transitorio: reintentar con mismo ID.

## Colecciones e índices

Registrar al implementar, nunca crear índices desde una acción: `users/accounts/sessions` del adaptador auth, `items`, `occurrences`, `tags`, `item_views`, `task_placements`, `user_settings`, `item_memberships`, `share_invitations`, `sync_operations`, `sync_changes`, `sync_counters`.

Evaluaciones previstas, ajustadas a las consultas reales de cada iteración:

- Unicidad de ID de elemento y de `(seriesId, slotKey)` en excepciones.
- Ítems por propietario/borrado/tipo/fecha; series por propietario/tipo y rango aplicable.
- Tags únicos por usuario/nombre normalizado; preferencias por usuario/elemento y usuario/ocurrencia.
- Membresía única `(itemId, userId)` y listado de compartidos por usuario/estado.
- Invitaciones por destinatario/estado y elemento/estado; expiración lógica sin perder trazabilidad de aceptación.
- Recibos únicos `(actorUserId, operationId)`; journal único `(recipientUserId, sequence)`; contador único por receptor.
- Índices requeridos por el adaptador Better Auth, centralizados y comprobados con su configuración real.

Cada índice nuevo entra en `src/lib/db/ensure-indexes.ts` con nombre estable y prueba; no añadir todos anticipadamente solo por estar enumerados aquí.

## Validación de arquitectura

[Entorno y matriz de sync](sync-test-environment.md), preparados en11a0, concretan el siguiente corte11a1a: configuración local opt-in, replica set de prueba propio y commit/rollback real antes de repositorios. Docker CLI disponible no confirma runtime ni soporte transaccional. CAS, recibos y journal se verifican después en11a1b/11b1; no presentar tests omitidos como sincronización probada.

Pruebas de reglas puras con Bun; contratos/schema y repositorios con pruebas de autorización; navegador real para IndexedDB, worker, múltiples pestañas y recarga offline; MongoDB de prueba compatible para transacciones, journal e idempotencia. Si no hay entorno de integración, prepararlo en su entrega sin tocar datos reales; los mocks no bastan para declarar probada la convergencia.

Ningún cliente importa auth servidor, MongoDB o PDF. Revisar esto con tipos, lint y build en cada iteración de código, además de la [definición de terminado](../AGENTS.md).

### Evidencia local de `03a`

`bun run scripts/browser-test-server.ts` sirve una fixture aislada en `http://127.0.0.1:4179`. Abrir, comprobar siete casos y pulsar “Verificar tras recarga”; tras recargar de nuevo, la tarea editada y borrada lógicamente debe permanecer, y la otra cuenta conserva su versión distinta. El botón de limpieza solo elimina las particiones ficticias de esa ejecución. Este servidor no usa sesiones reales, no forma parte del producto y no demuestra aún reapertura sin red: esa garantía necesita el shell de `04`. Los errores de aborto/unicidad y la versión futura se rechazan sin falso éxito ni borrado automático. No se ha forzado una cuota real del dispositivo.

Fuentes primarias consultadas: [ciclo de vida y abortos de transacciones IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) y [actualización bloqueada por otra conexión](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/blocked_event).

### Escritura local atómica de `03b`

`LocalOutbox.commitItemCommand` valida intenciones y aplica crear/editar/borrar/estado simple en una transacción de `items`, `outbox` y contador de `syncMetadata`. La revisión del registro permanece remota; las operaciones se encadenan por entidad y no se envía una dependiente antes del ACK de la anterior. El mismo ID con el mismo comando devuelve la intención persistida sin repetir el cambio; otro payload con ese ID se rechaza. Los lectores de shadow permanecen separados de la vista local.

`claim` concede un lease exclusivo; al reabrir se recuperan únicamente leases caducados, preservando IDs y dependencias. No se reactivan leases vivos de otra pestaña. El coordinador de `12b` conectará ACK, revisión base, transporte y lease global; la cola actual no declara sincronización remota. La autorización local de edición permite solo propietario por ahora; membresías/editors se integran en `14`. Las ocurrencias tienen su capa propia en `09`.

Prueba reproducible: `bun run scripts/browser-test-server.ts outbox`, abrir la misma URL loopback, comprobar ocho casos y verificar recarga. Incluye migración 1→2, fallo real por índice único que revierte dato+operación, idempotencia local, dependencias, shadow, dos claims concurrentes y recuperación tras cerrar/reabrir la conexión.

### Implementación y prueba de `04a`

`bun run build` ejecuta Next y compila después el worker TypeScript con el build ID y una lista de recursos locales: shell prerenderizado, todos los chunks/CSS/fuentes de `.next/static`, manifest e iconos. Se cachean recursos neutros con credenciales del mismo origen para admitir previews protegidos (`13b2b`), rechazando respuestas redirigidas; el HTML debe llevar el marcador del shell. APIs, auth, HTML personalizado, RSC y POST no se interceptan. La activación normal espera que no haya clientes del worker anterior; no se fuerza `skipWaiting`.

`/api/sync/identity` se adelanta de `12a` porque la preparación necesita un ID autorizado y estable; verifica sesión DB vigente y responde `private, no-store`. El shell no contiene identidad en el HTML y recuerda solo una cuenta previamente preparada. `04b` añade cierre de sesión/cambio de cuenta entre pestañas y actualización controlada. Los iconos PNG proceden del SVG local; el script utiliza `sharp`, ya instalado transitivamente por Next, sin añadir dependencias.

Fixture reproducible: `bun run scripts/prepare-pwa-browser-test.ts`, arrancar producción en loopback, abrir `/pwa-check.html`, preparar cuenta ficticia y seguir el enlace a `/workspace`. Detener por completo el servidor y recargar: el espacio debe mostrar su copia local. Reiniciar solo para seguir el enlace de limpieza de la fixture y retirar `public/pwa-check.{html,js}`; esos archivos y el worker generado están ignorados por Git. No desplegar fixtures. Tres checks de preparación más recarga sin servidor comprobados; no se hizo login Google real ni prueba en móviles físicos. La primera copia remota completa se añadirá con bootstrap en `12a`; el dominio remoto todavía no existe y no se simula una descarga exitosa.

### Cuenta activa y actualizaciones de `04b`

La única base compartida entre cuentas, `dalis-account-control`, guarda el puntero activo, fecha de preparación, nonce de generación y cierre remoto pendiente. No contiene elementos, emails, credenciales ni colas: el dominio permanece en su partición por usuario. Su transacción invalida preparaciones antiguas si se cerró o cambió la cuenta mientras se esperaba la red. El puntero legacy de `04a` se migra; un valor corrupto no habilita acceso.

Cerrar sesión primero oculta localmente y avisa a todas las pestañas, sin borrar datos ni operaciones. Si no hay red, persiste el cierre remoto pendiente y su mensaje tras reapertura. Al volver a iniciar Google se completa ese cierre **antes** del nuevo login, evitando cerrar la sesión recién creada. SWR restaura la cuenta preparada desde IndexedDB; el acceso remoto sigue exigiendo la sesión autorizada del servidor.

La UI avisa cuando hay un worker esperando. La nueva versión se activa al cerrar todas las pestañas antiguas, sin `skipWaiting`, reload forzado ni borrado de IndexedDB. Prueba real con dos builds: aviso visible, datos todavía legibles, cierre de clientes, nueva caché activa y las dos operaciones pendientes intactas. La fixture loopback incluye modos `inspect`, `switch` y `version`; usa cuentas ficticias y no demuestra login Google real. También se cerraron todas las pestañas de prueba y se abrió una webview nueva con el servidor detenido. El reinicio completo de un navegador móvil físico se comprueba en el piloto.

### Tareas locales y formulario de `05a1`

El botón `+` comparte acción en ambas barras y abre un dialog nativo. `readLocalTasks` y `createLocalTask` comprueban el ID/generación local antes de usar su partición; la fecha inicial procede de la zona configurada. El formulario usa Zod compartido, mensajes españoles y IDs estables de checklist. Solo se cierra tras confirmar la transacción dato+outbox; fallar conserva campos e intención para reintentar. SWR usa una clave por usuario/generación y recarga el listado local sin necesidad de red. La identidad remota no se sustituye por esta comprobación local.

Las notificaciones de cambio de cuenta siguen ocultando inmediatamente las vistas. Recuperar foco utiliza revalidación SWR sin vaciar la cuenta durante una lectura normal, para conservar un formulario abierto de la misma cuenta. Una generación diferente desmonta el formulario anterior. Edición/borrado completados en `05a2`; estados/checklist en `05b1`; categorías pendientes de `05b2–05b3`; no se anuncia sincronización remota. La fixture `task-create` comprueba los datos introducidos en la UI y su operación pendiente tras recarga offline.

## Progreso por campo (`05b1`)

`task.set-status` y `task.set-checklist-entry` son comandos absolutos: estado o booleano por ID de paso, sin reemplazar el contenido completo. Se validan con el contrato compartido y operan sobre el registro actual dentro de la misma transacción de dato+outbox. Marcar todos los pasos no completa implícitamente la tarea; reabrir la deja sin empezar y mantiene checklist. Un paso eliminado o un padre recurrente rechaza la operación sin cambio parcial. El ejecutor de apariciones se incorpora en `09b1`; la UI actual solo ofrece progreso de tareas simples.

El hook bloquea envíos simultáneos, conserva ID de intención para reintentar el mismo comando y revalida IndexedDB tras el commit; no usa una respuesta remota ni confirma guardado por un estado optimista. Editores completos siguen usando la guardia de valor esperado de `05a2`. El transporte remoto de `11b` deberá aceptar estos mismos comandos acotados. No se añade índice: la escritura busca por la clave primaria de elemento y el paso se valida dentro de su checklist limitado a 100 entradas.

## Preferencias personales (`05b2`)

`LocalOutbox.commitPreferenceCommand` admite `tag.save`, `tag.delete` e `item-view.set`. Datos y operación comparten una transacción con contador global y cola. Claves `tag:<id>` e `item-view:<itemId>` separan preferencias personales de `item:<id>`; mantienen la versión 2 de IndexedDB y los registros anteriores, sin nueva tienda ni migración destructiva. Edición/borrado de categoría pueden comparar el registro esperado para rechazar un editor obsoleto.

Nombres activos únicos por normalización NFKC y minúsculas; espacios exteriores se recortan en el schema de entrada. La comprobación lee categorías de la partición dentro de la transacción serializada: dos pestañas no pueden aprobar el mismo nombre. Se evaluaron índices: `byPosition`/`byTag` existentes cubren orden/asignación, y la validación de nombres requiere leer también tombstones; se mantiene escaneo local sin índice único que impida reutilizar un nombre borrado. Si el volumen real lo exige, se diseñará una migración para índice de nombre activo. MongoDB aún no recibe estas consultas; sus índices parciales se evaluarán en `11a`.

Borrar conserva la categoría como tombstone y no modifica tareas ni vistas. Resolver una referencia a categoría borrada produce “Sin categoría” en la interfaz (`05b3`), con el ID anterior preservado para reconciliación. Reutilizar el nombre crea otro ID; nunca revive el ID borrado. Asignar exige elemento activo y categoría propia activa; retirar categoría usa `null`. Son preferencias de la cuenta, también para futuros elementos compartidos descargados, y no conceden autorización remota.

Un pequeño metadato `preference-tail` encadena las preferencias personales. Una asignación depende además del último cambio pendiente de su elemento; borrar categoría depende de las preferencias anteriores, incluidas sus asignaciones. El número de dependencias directas queda acotado a tres y se deduplica. Es una serialización conservadora: un conflicto de preferencias puede bloquear posteriores preferencias hasta resolverse. `12b/13a` deberán respetar esa causalidad y tratar explícitamente conflictos; no descartar ni saltarse su cola. La cola de contenido no queda globalmente serializada por esta decisión.

Prueba reproducible: `bun run scripts/browser-test-server.ts preferences`, origen loopback `127.0.0.1:4179`, cuentas `browser-test-<uuid>-preferences`; enlaces de inspección tras carga y limpieza exclusiva de esas particiones. La suite induce fallo de índice de outbox después de encolar escrituras y comprueba rollback de categoría/cola/metadatos. No usa red para mutaciones ni datos de cuentas reales.

## Interfaz de categorías (`05b3`)

El registro de destinos ahora incluye categorías y SVG local en móvil/escritorio. Título y descripción de pantalla proceden del mismo registro. `readLocalTags` lee categorías por `byPosition` y vistas personales, ambas con aislamiento de cuenta/generación. Se reutiliza la comprobación de cuenta activa entre servicios locales. SWR comparte la clave de preferencias; selector/control se revalidan después de commit sin depender de la red.

Un selector en cada tarea permite clasificarla después de guardar o retirar su categoría. Una referencia a un tombstone se muestra “Sin categoría” sin perder el registro previo. El formulario de creación de tarea no promete guardar una categoría en la misma transacción: esa comodidad requeriría un comando compuesto o un lote local atómico diseñado expresamente en una futura mejora, sin dos pasos presentados como un único guardado.

Confirmación HTML y bloqueo/reintento de intenciones se extraen para compartirlos entre tareas/categorías; cancelar conserva, borrar exige confirmación y los fallos preservan formulario. La edición de categoría conserva posición/identidad y compara el snapshot inicial. El coordinador remoto sigue pendiente; no se etiqueta una categoría como sincronizada por tenerla localmente guardada.


### Progreso de apariciones — 09b1

Los comandos de estado/checklist con `occurrenceId` materializan la excepción en `occurrences`, junto con outbox y secuencia, dentro de una única transacción. La primera escritura valida que el slot original pertenece a la regla; una excepción existente conserva su checklist e historia aunque cambie la plantilla futura. No se permite progreso sobre series borradas ni apariciones canceladas/borradas.

La cola usa `entityKey=item:seriesId` y `baseRevision` del padre, serializando sus comandos y los de sus apariciones como un agregado. El progreso local no modifica el padre ni incrementa revisiones remotas. En `11–12`, un ACK deberá avanzar la revisión agregada y publicar los cambios de excepciones asociados; el pull debe traer ambas partes. El replay de un UUID ya guardado devuelve su recibo antes de validar el estado actual, incluso después de borrar la serie, sin reescribir. No hay transporte remoto habilitado todavía.


### Edición y cancelación de aparición — 09b2

`task.update-occurrence` y `task.cancel-occurrence` tienen ejecutor local y contratos estrictos de transporte. Se encolan en el agregado `item:seriesId`, igual que progreso. No aceptan identidad/regla/estado dentro del input de edición. La guardia de edición compara ambos snapshots dentro de la transacción; el snapshot local no viaja como prueba de autorización. Remoto 11–12 deberá validar permisos y revisión del agregado y aplicar estas intenciones por campo, preservando progreso concurrente según su política de conflictos. No existe transporte desplegado que acepte estos comandos todavía.


### Snapshot de repetición — 09b3b

Series, excepciones (incluidas canceladas/tombstones) y settings se leen en una sola transacción readonly antes de preparar el índice. Evita combinar la regla de una versión con excepciones/zona de otra. El servicio comprueba cuenta/epoch antes y después y no devuelve datos si se cierra o cambia la cuenta durante la lectura; siempre cierra la conexión. La autenticación remota no se sustituye por nombre de DB ni por ese índice. No se escriben intenciones al leer; los hooks/UI se conectarán después de colocaciones por aparición.

### Ejecutor inicial11b1a

Resultado tipado aplicado incluye elemento y secuencia; conflicto incluye solo elemento propio, unavailable no expone registros ajenos, invalid_command no modifica, unsupported no crea recibo ni confirma pendientes. Conflictos/rechazos soportados conservan recibo para replay estable; comandos aún no implementados podrán ejecutarse después al ampliar soporte. El servicio autenticado futuro suministra actor, nunca el payload. Duplicados de inserción abortan y reintentan con nuevo snapshot; fallos de journal no se convierten en éxito. El counter por receptor está en la misma transacción que el cambio, evitando un cursor que salte un commit posterior. Sin compactación/TTL ni fanout compartido todavía.

### Subida11b1b

Server ActionpushSyncOperations obtiene sesión persistida vigente desdeheaders; no admite actor como entrada. El servicio valida el lote completo antes de escribir. Complete significa que cada operación tiene resultado, no que todas estén aplicadas; soloapplied permite futuroACK local. Unauthorized/invalid_batch no escriben; retry_later incluye prefijo terminado para conservar IDs y reintentar duraderamente. Identity_reuse rechaza IDconotrocontenido; unsupported nunca se vacía de outbox. Activación del cliente exige pull/reconciliación e integración de pendientes.

### Descarga12a1

GET `/api/sync/changes` acepta after (0por defecto), through (checkpoint opcional) ylimit1–100. Actor siempre de sesión. Primera página captura through decontador confirmado en snapshot; páginas siguientes conservan ese valor. Journal immutable/sincompactación, contigüidad exacta y consulta porreceptor+secuencia impiden saltos. nextAfter/hasMore se devuelven solo tras validar todos los registros y propiedad actual. Cursor adelantado409; corrupción/hueco/permisoausente503 sin página parcial.

Primer bootstrap reproduce todas las entradas desde0 hasta through y mantiene el registro más reciente por identidad, incluidos tombstones; después continúa desde through. Se elige historia paginada porque journal aún no se compacta y todas las nuevas escrituras de producto pasan por11b1a. Una importación o colección histórica sin entradas exigirá migración antes de activar este camino. Reconciliación local debe persistir cursor y shadow junto a la proyección optimista, nunca reemplazar outbox por bootstrap. Preferencias/ocurrencias y fanout compartido se incorporarán antes de garantizar convergencia completa del espacio.

### Proyección conservadora12b1a

Al recibir remoto, shadow conserva la revisión más alta; misma revisión concontenido contradictorio falla. Si hay intenciones de la entidad sinACK, la vista local existente se conserva íntegra como borrador acumulado y remoto queda separado. Esto evita reaplicar automáticamente sobre concurrentes. Cuando no quedan intenciones, la vista adopta shadow, incluido tombstone. Un journal cuyooperationId coincide no basta para confirmar intención: el siguiente corte verificará resultado del envío contra operación congelada/lease y lo persistirá atómicamente conshadow. El planner todavía no escribe IndexedDB ni avanza cursor.

### ACK local12b1b

LocalSyncStoreapplyOperationResult recibe operación enviada/sender delease/resultado; operación completa debe coincidir conoutbox, ID/cuenta/revisión sucesora ykind/tombstone deben concordar. Una respuesta delease antiguo se rechaza siotroenvío ya tomó posesión. Resultado durable en syncMetadata(operation-outcome:UUID) conserva intención/base/local; replay deACK solo admite mismoresultado.

Applied confirma la intención, actualiza shadow monotónico/vista y prepara baseRevision de dependientes directos pendientes nunca enviados. Intentos posteriores conservan payload congelado para recibos. Pendientes posteriores mantienen contenido local; metadata de revisión/creación se actualiza, últimaACK adopta shadow. Conflict/rejected conservan borrador y evidencia ybloquean dependencias; unsupported vuelvependiente y no se presenta como confirmado. Todo se escribe en una transacción sin await externo; cursor de descarga no cambia porACK. Activación del coordinador y resolución visible aún pendientes.

### Pull local12b1c

SyncMetadata pull-cursor conserva after ythrough mientras quede página. Aplicación comparaafter/checkpoint persistidos dentro detransacción, valida secuencias/cuenta/revisiones, pliega últimas versiones de cadaID yusa proyección conservadora. Shadow/vista/cursor comparten commit; fallo tardío revierte todo. Respuesta completamentestale no escribe; futuros/solapes/checkpoint distinto requieren relectura/reintento sin saltos. ACK adelantado no regresa al consumir historia, journalUUID coincidente nunca confirma cola. Al terminar checkpoint, through vuelve null para capturar próxima pasada. Coordinador todavía no activa red/polling.

### Cuenta esperada12b2a1

Consultar identidad antesdepush no basta si sesión cambia entrepeticiones. Por ello subida exige expectedUserId, validado conZod ycomparado conactor derivado de sesiónantes demutar. Expected es solo afirmación decoherencia; actor ypermisos continúan exclusivos del servidor. Account_changed/unauthorized paran envíos ypreservan cola sinACK. Estecontrato se preparó antesdeactivar consumidores, sincompatibilidadUIprevia que mantener.

### Pasadas12b2a2

Coordinador limita una pasada a4páginas antesdepush y5operaciones individuales; devuelve more_work para continuar acotadamente. Consultar identidad, comprobar cuentaactiva antesdeefectos, recuperar leases expirados yterminar checkpoint precede subir. Releer cola entreACK prepara revisión dependiente, no construirunbatchconbasesviejas. Commandsupport filtra simples ynoenvía preferencias/recurrencias/cumpleaños.

Runcoalesced evita pasadas superpuestas delmismocoordinador; claim deIndexedDB impide enviar mismaintención desde dospestañas. Release verificado porowner devuelve sendingapending sin modificar operation/attempts, preservando replay después derespuesta perdida. Stop noaplica respuestas tardías; no cancela uncommit yaaceptadoporelservidor, cuyo recibo resolverá futuroreintento. Settled solo significa pasada terminada, nunca que todoelespacio esté sincronizado; UI/transportadapter pendientes.

### Transporte y recursos12b2a3

Httptransport requiere identidad yGETprivado concookies same-origin/no-store; pull añade expectedUserId, after/through/limit50 yvalida salida/contigüidad contraafter. GETtambién comparaexpectedconactor antesdeleer (opcional para consumidores previos, siempre enviado portransportador). Unauthorized detiene; account_changed detiene sinotrosdatos; cursoradelantado409 requiere recuperaciónexplícita ynoresetea cola/cursor automáticamente.

Deadline30s cubre fetch/lecturaJSON yespera decallbackdeacción. Timeout no cancela una mutación remota ya iniciada; devuelveerror, releaseconservapayload yreciboidempotente resolveráreintento. Runtimelocal ligado aepoch/cuenta usa conexiones propias, claim120s ystopesperapasada antesdecerrar. No hayhook/polling/UIoperativos todavía; prueba de dosalmacenes de navegador conbackendreal en12b2a4.

### Prueba integrada12b2a4

Dos orígenes de navegador conectados aMongo aislado ejercitan transporte/runtime/coordinador con IndexedDB real: cola sinred/recarga, bootstrap, progreso dependiente, replay después derespuesta perdida y tombstone convergen sin duplicación. Concurrentes mantienen conflicto/borrador/shadow ypermiten otra entidad; recuperación deconflicto no está implementada todavía. Véase [entorno](sync-test-environment.md). Falta consumidorUI yprueba deRPC/autenticación real; el próximo resumen decola debe evitar mensajes de sincronización total cuando existan comandos sinsoporte o conflictos.

### Estado local12b2b1

LocalSyncStore ofrece resumen en snapshotreadonly deitems/outbox. Distingue pendientes enviables, esperando dependencia, bloqueados y sin soporte; además enviando, conflictos yrechazos. ACK no cuentan comopendientes. Grafo iterativo evita recursión yno interpreta ciclos/dependenciasausentes comoenviables. Este resumen será fuente de UI; settled delcoordinador indica solo pasada acabada, nunca «todo sincronizado».

### Ejecución manual12b2b2

Ajustes ofrece «Sincronizar ahora» para tareas/eventos propios sinrepetición. Cada pulsación abre runtimepropio, verifica cuenta, ejecuta pasada acotada, renueva caches user/epoch ycierra conexiones. Unmount detieneefectos. Pasadas máslargas requieren otrapulsación hasta scheduler; auth/cursor/red/cambiocuenta conservan cola. Panel muestra pendientes/conflictos/rechazos ycomandos sinsoporte; no promete sincronización depreferencias/series ni resolución deconflictos. DispatcherServerActionusa startTransition; compilación frontera aprobada, pilotoGoogle/RPC real pendiente.

### Política de scheduler12b2b3

Una pasada activa compartida; revisión60s trasacabar ycontinuación2s siquedan páginas/operaciones soportadas. Fallo transitorio usa backoff30s hasta5min, que foco/online noadelantan. Oculto/offline espera disponibilidad, auth/cuentacambiada/cursor inviable exige reintentomanual. Stopterminal limpia timer/cancela recursos deejecución ysuprime callbackstardíos. Preparado para proveedorúnico en12b2b4; todavía sinarranque automático.

### Arranque automático12b2b4

Workspace monta proveedorúnico porusuario/epoch; comparte motor/estado conAjustes, no reinicia por cambiarvista. Autoarranca conappvisible/conred, reanuda mediante online/foco/visibility yrespeta deadline/backoff/pausas. Cleanup detiene resources/listeners/timer ylaspasadaspropias. UserId+epoch siguenverificados anteefectos. Puertas servidor sesióngenuina/CAS/recibo/journal yvalidación permanecen. Primeralcance: propiossimples, no preferencias/series/sharing niworker cuandoappestácerrada; conflictos yrechazos conservados para13a. PruebaReact/Mongo deauto+manualsin duplicado aprobada; falta pilotoGoogle/RPCNext real en entorno desplegado.

### Reacción local12b2c

Guardar intenciónoutbox emite aviso validado deusuario trascommit; evento local yBroadcastChannel mismo origen despiertan motor yresumen. Fallos denotificación no cambian éxito delguardado. Scheduler adelanta idle a1s, respetando backoff/pausas yrevisando escrituras llegadas durantepasada; ninguna señal depull/ACK provoca bucle. VistasfueraAjustes muestran enlacecompacto de revisión solo para incidencias que requierenatención. Conflictos/rechazos siguenconservados hasta13a.

### Evidencia para recuperación13a1a

Proyecciónpure deconflicto/rechazo ligaentrada congelada/outcome/records propios, preserva borradoractual yversiones conocidas. Replaytardío puede tener versiónmenor queshadowalrecibirlo; elegir másnueva porrevisión yrechazar igualcontenido contradictorio. Shadowoutcome no es basehistórica deoperación. [Diseño](conflict-recovery.md) exige elección explícita ycadenasdependientes, registro/nuevoUUID/CAS/tombstones; snapshot/lector/UI/ejecutor siguenpendientes.


### Recuperación explícita13a1b–13a2b2

Snapshots de cuatrostores conservan cadena/outcome/borradores/tombstones yguardias usuario/época. Ajustes ofrece comparación bajo demanda y elecciones probadas: adoptar remoto conocido o crearUUID nuevo para enviarborradorcompleto sobre revisión remota. Estado `superseded` es decisión local auditada, nuncaACK; operación/resultados originales intactos. Registro+cola+proyección+replacement/secuencia atómicos, replay no reescribeediciones posteriores. Dependientes externos y envíosinciertos impiden resolver; nuevos comandos ignoran tails ya supersedidos yotrasdependencias siguenrequiriendoACKreal. Reutilización de metadata mantiene versiones/stores/índices existentes (desviación justificada delstore `conflicts` previsto).

Confirmacióncongela preview ycantidad decambios; edición enotra pestaña invalida elección sinperdertrabajo. Error decaché no hacefracasarlocalcommityaplicado. Reintento/adopción/tombstone convergen enprueba de dosorígenes yMongoDBpropio sinduplicación. Identidadremotaborrada no resucita: copia explícita nueva sigueen13a2c1. Preferencias/series/sharing ypilotoGoogle/RPCNext genuino siguenpendientes.


13b1b1: identidad/pull anuncian rango min/max por x-dalis-sync-protocol sin modificar bodyidentity existente. Nuevo cliente exige header válido <=128bytes con rango quecontieneprotocol1; ausencia/corrupto/incompatible pausa update_required antesdeleerbody/claim/cursor. Schedulerpausa yUI indica cerrar/reabrir conconexión, pendientes conservados; sinreloadautomático. Rango estricto Zod1..1000000/min<=max; noPII. Clientesanteriores sinhandshake noobtienenprotección retroactiva. 209pass/30skip/4670aserciones/lint310files/tipos/build30recursos y12escenariosMongoaprobados; ownresourceslimpios. Próxima13b1b2 guarda incompatibilidad enpush yprueba mixeddeployment.


13b1b2: envelope Zodacotado/estricto verifica identidad/versión/duplicados/payloadsize antes deejecutar, batch conversiónfutura devuelupdate_required sinprefijoaplicado; auth/cuenta precedenexecutor. Coordinador libera lease yconservaUUID/payloadsinACK. TreceescenariosMongo: missing/future/futurepull conservan snapshotexacto; futurepush deja pending/lease0/attempt1; reload compatibleconverge una revisión1 enambosdispositivos. 211pass/30skip/4685aserciones/lint310files/tipos/build30recursos, ownrunnerexit0/cleanup. Próxima13b2a comprobaciónactualización segura.


13b2a: Ajustes ofreceComprobaractualización anteupdate_required, registroexistente/online ywaiting/installing/current/offline/unavailable, sinregister/skipWaiting/reload. Observador conecta instalaciónyaencurso ydisposequitalisteners; avisoesperacompacto. 214pass/30skip/4702aserciones/lint314files/tipos/build30recursos. FixtureReact/IndexedDB/workerdeproductoreal con2versionesownloopback: v1activo/v2waiting mantienedatos/colaexactos, cerrar/reabriractivav2yconservaUUID/payload/estado, cleanupownreg/caches/partición/baseline. Móvil390sin overflow/checkbutton44px. Próxima13c1a backupcontractportable; import/exportUIposteriores. Google/RPCNextrequierepiloto.
