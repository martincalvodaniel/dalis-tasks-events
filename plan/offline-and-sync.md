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

Stores propuestos: `items`, `occurrences`, `tags`, `itemViews`, `taskPlacements`, `settings`, `memberships`, `invitations`, `outbox`, `remoteShadows`, `syncMetadata`, `conflicts`. Representación elegida en `03a`: una base `dalis-account:<userId codificado>` por usuario estable. Versión inicial 1 con ocho stores de dominio; `03b` migra a versión 2 añadiendo `outbox`, `remoteShadows` y `syncMetadata`, sin borrar registros. `conflicts` se incorpora al implementar su gestión en `13`. Repositorios cliente validados por Zod y preferencias personales comprobadas contra la partición.

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

`bun run build` ejecuta Next y compila después el worker TypeScript con el build ID y una lista de recursos locales: shell prerenderizado, todos los chunks/CSS/fuentes de `.next/static`, manifest e iconos. Se cachean recursos neutros con solicitudes sin credenciales, sin seguir redirects; el HTML debe llevar el marcador del shell. APIs, auth, HTML personalizado, RSC y POST no se interceptan. La activación normal espera que no haya clientes del worker anterior; no se fuerza `skipWaiting`.

`/api/sync/identity` se adelanta de `12a` porque la preparación necesita un ID autorizado y estable; verifica sesión DB vigente y responde `private, no-store`. El shell no contiene identidad en el HTML y recuerda solo una cuenta previamente preparada. `04b` añade cierre de sesión/cambio de cuenta entre pestañas y actualización controlada. Los iconos PNG proceden del SVG local; el script utiliza `sharp`, ya instalado transitivamente por Next, sin añadir dependencias.

Fixture reproducible: `bun run scripts/prepare-pwa-browser-test.ts`, arrancar producción en loopback, abrir `/pwa-check.html`, preparar cuenta ficticia y seguir el enlace a `/workspace`. Detener por completo el servidor y recargar: el espacio debe mostrar su copia local. Reiniciar solo para seguir el enlace de limpieza de la fixture y retirar `public/pwa-check.{html,js}`; esos archivos y el worker generado están ignorados por Git. No desplegar fixtures. Tres checks de preparación más recarga sin servidor comprobados; no se hizo login Google real ni prueba en móviles físicos. La primera copia remota completa se añadirá con bootstrap en `12a`; el dominio remoto todavía no existe y no se simula una descarga exitosa.
