# Producto y modelo de dominio

## Experiencia principal

- Aplicación responsive **mobile-first**: uso principal en teléfono, y experiencia completa en escritorio. Diseñar desde 320px, sin scroll horizontal accidental, y comprobar escritorio y ampliación de texto.
- Móvil: barra inferior fija de navegación con iconos SVG locales, labels breves y nombre accesible en español. Escritorio: barra superior con las mismas pantallas principales, estado activo y acceso a creación/cuenta.
- Un registro único de destinos alimenta ambas variantes. Actualizarlo al añadir cada pantalla importante, mostrar solo destinos operativos y usar `aria-current` para la selección. Calendario/agenda comparten destino; futuras pantallas de compartidos y ajustes aparecen al estar implementadas.
- Navegación inferior respeta `env(safe-area-inset-bottom)`, área táctil de al menos 44px y espacio reservado al pie; no tapa listas, diálogos, teclado o campos. A partir del breakpoint de escritorio se muestra exclusivamente la barra superior.
- El botón `+` sigue siendo la acción más accesible en ambas variantes. Iconos son SVG de componentes propios, sin dependencias nuevas ni recursos externos; los iconos decorativos se ocultan a lectores de pantalla y sus enlaces tienen texto/nombre accesible.
- Calendario mensual como vista de entrada; semana de lunes a domingo, formato español y botón “Hoy”.
- Cada celda muestra indicadores y contadores por tipo; no depender únicamente del color. Al tocar un día, abrir su agenda en panel de escritorio o vista adaptada a móvil.
- Botón `+` accesible desde calendario y agenda, con nombre accesible “Crear”. Opciones: “Tarea”, “Evento o cita” y “Cumpleaños”. La fecha seleccionada rellena el formulario.
- Separar en la agenda “Cumpleaños”, “Eventos y citas”, “Tareas” y “Atrasadas”. Eventos ordenados por hora; tareas por categoría y orden manual.
- La sección de atrasadas reúne pendientes de fechas anteriores a **hoy**, independientemente del día seleccionado. Mostrar su fecha original. En una fecha histórica, conservar además el historial de lo previsto ese día, sin cambiar la fecha para simular un traslado.
- Estados de sincronización comprensibles: “Sin conexión”, “Guardado en este dispositivo”, “Sincronizando”, “Todo sincronizado”, “Necesitas iniciar sesión” y “Hay cambios que revisar”. Un guardado local no se presenta como confirmación remota.

Navegación se construye en `04c`, sobre el shell offline ya operativo. Cada iteración de nuevas pantallas incluye desde entonces la actualización de móvil y escritorio, y validación del destino sin red si usa datos locales. Formularios se adaptan a pantalla completa en móvil y panel/diálogo en escritorio sin perder foco ni contenido.

## Modelo elegido

Una familia `CalendarItem` validada por `kind`: `task`, `event` o `birthday`. Base común, campos específicos y componentes de formulario separados. Colección común `items`; no tres CRUD inconexos ni una entidad con muchos campos opcionales sin restricciones.

| Entidad | Identidad y campos principales | Reglas |
| --- | --- | --- |
| `User` | ID estable de Better Auth, email verificado, nombre | Identidad remota persistente. El email sirve para invitar, no como clave mutable de todos los datos. |
| `UserSettings` | `userId`, `timeZone`, `weekStartsOn`, `locale`, `revision` | Zona IANA; valor inicial propuesto `Europe/Madrid`, editable. UI `es-ES`, lunes. |
| `CalendarItem` | `id`, `kind`, `ownerId`, `title`, `description`, `revision`, `createdAt`, `updatedAt`, `deletedAt` | UUID generado localmente; propietario derivado de sesión al crear en remoto. Borrado lógico. |
| `Task` | `scheduledDate`, `status`, `checklist`, `recurrence` opcional | Fecha civil obligatoria en MVP; estados `not_started`, `in_progress`, `completed`. |
| `Event` | `allDay`, fechas civiles o `localStart`, `localEnd`, `timeZone`, instantes UTC derivados; `recurrence` opcional | Evento/cita es el mismo tipo. Inicio obligatorio, fin opcional; duración positiva si hay fin. |
| `Birthday` | `month`, `day`, `birthYear` opcional, `timeZone` | Día completo, anual; título identifica a la persona. No estado de tarea ni checklist. |
| `Tag` | `id`, `userId`, `name`, `color`, `position`, `revision` | Categoría personal; nombre normalizado único por usuario. |
| `ItemView` | `userId`, `itemId`, `primaryTagId` opcional, preferencias | Clasificación personal: compartir un elemento no expone categorías privadas. |
| `TaskPlacement` | `userId`, `occurrenceId`, `scope`, `date`, `tagId`, `position`, `revision` | Orden personal por fecha/categoría o grupo de atrasadas; `scope` diferencia ambas vistas y no altera la planificación compartida. |
| `ItemOccurrence` | `id`, `seriesId`, `slotKey`, fecha original, excepciones, estado/checklist cuando corresponda | Solo se persisten excepciones y cambios; ocurrencias sin cambios se generan desde la serie. |
| `ItemMembership` | `itemId`, `userId`, `role`, `revision`, `revokedAt` | Lector/editor; propietario en `ownerId`. Compartir una serie concede sus ocurrencias. |
| `ShareInvitation` | `id`, `itemId`, destinatario normalizado, `role`, `status`, `expiresAt` | Estados `pending`, `accepted`, `declined`, `revoked`, `expired`. Se acepta online con email verificado coincidente. |

Tipos de dominio sin `ObjectId`, driver MongoDB ni imports Next.js en `src/types/**`. Zod compartido en `src/schemas/**`. Tipos de persistencia y mapeos de MongoDB en `src/lib/db/**`.

Implementación inicial de contratos (`02a`): tipos derivados de los esquemas Zod para no duplicar shapes. Eventos usan `schedule.mode = all_day | timed`, con campos civiles o de hora separados; la conversión a instantes UTC y la elección de horas DST se implementan en `08`, no se aceptan instantes del cliente como autoridad. Recurrencias de una serie anclan en su fecha inicial; las excepciones mantienen `id = seriesId:slotKey` aunque se reprograme la fecha visible.

Límites iniciales: título 160 caracteres, descripción 10.000, checklist 100 puntos con texto de hasta 500, categoría 60; lotes de sincronización hasta 50 operaciones y 512 KiB de JSON UTF-8, sin IDs de operación repetidos. Son límites de producto/protocolo revisables, no límites impuestos por MongoDB. Las formas estrictas rechazan campos de otro tipo e identidad/roles inyectados en intenciones.

Los campos de transporte (`operationId`, `baseRevision`, etc.) no forman parte del formulario del usuario. El servidor no confía en `ownerId`, `userId`, roles, revisiones o timestamps recibidos como prueba de autorización.

## Tareas

- Título obligatorio; descripción opcional; categoría seleccionable o creable desde el formulario. Una tarea sin categoría aparece en “Sin categoría”.
- Checklist con IDs estables, texto, posición y estado de cada punto; no usar el índice del array como identidad.
- El cambio de estado de tarea es explícito. Completar todos los puntos no completa automáticamente la tarea; puede haber tareas sin checklist.
- Permitir “Empezar”, “Completar” y “Reabrir”. Reabrir establece `not_started`; si su fecha ya pasó, aparece en atrasadas inmediatamente.
- Editar, reprogramar y borrar disponibles offline. Reprogramar modifica fecha, conserva estado y muestra la fecha nueva; borrar se marca localmente y se sincroniza después.
- Se guarda `completedAt` como dato informativo, no como mecanismo de resolución de conflictos. Los timestamps del dispositivo no ordenan cambios remotos.

### Atrasadas

Condición: `kind = task`, no borrada/cancelada, estado distinto de `completed` y `scheduledDate < today(user.timeZone)`.

Se calcula al abrir, volver al primer plano, cambiar zona y cambiar el día mientras la app está abierta. Si estuvo cerrada tres días, se recalcula en la siguiente apertura sin ejecutar procesos de fondo. No necesita MongoDB para funcionar.

Ejemplo: una tarea prevista para el 6 de octubre que esté `in_progress` aparece el 7 en “Atrasadas”, en curso y con fecha 6. Completarla la elimina de atrasadas y conserva el historial de su fecha prevista. Los eventos pasados y cumpleaños no pasan a atrasadas.

## Categorías y orden

- Una categoría principal por elemento para cada usuario en el MVP. Las categorías pertenecen al usuario y no son compartidas automáticamente.
- Compartir muestra el elemento al destinatario inicialmente en “Sin categoría”. Este puede clasificarlo sin alterar al propietario ni necesitar permiso de editor.
- Permitir reordenar categorías y tareas dentro de ellas; mover entre grupos cambia la categoría personal. El orden se sincroniza entre dispositivos de la misma cuenta.
- Reordenar usa una intención estable (`beforeId`/`afterId`) y una posición calculada, con desempate por ID. No sustituir el array completo de tareas para mover una fila.
- Botones “Mover arriba/abajo” además de arrastre, para móvil y teclado. Si una posición requiere normalización, hacerla como operación controlada de la misma lista.
- Atrasadas agrupadas por categoría, con fecha prevista como orden inicial; pueden reordenarse mediante preferencias propias del grupo de atrasadas. Volver a una agenda no pierde el orden personal previo.
- Borrar categoría envía sus asignaciones a “Sin categoría”; no borra elementos. Representar el borrado de forma que asignaciones pendientes no vuelvan a crear una categoría eliminada.

## Fechas y horas

- Tareas y cumpleaños usan fechas civiles, sin convertir “2026-10-06” a medianoche UTC para decidir el día.
- Eventos con hora guardan fecha/hora local y zona IANA como programación; los instantes UTC permiten ordenar y detectar duración. La repetición conserva la hora de la zona de la serie, aunque cambie el horario de verano.
- Eventos de día completo guardan inicio inclusivo y fin exclusivo como fechas civiles. Un evento que cruza medianoche aparece en ambos días pertinentes.
- “Hoy” y atrasadas usan la zona de la cuenta; mostrar la zona de un evento si difiere. Un viaje no cambia silenciosamente la programación.
- En horas inexistentes o ambiguas por cambio horario, validar y pedir una elección explícita en el formulario; no desplazar silenciosamente una cita. Implementar y probar la conversión con el runtime disponible; una biblioteca adicional requiere aprobación.
- Corte de eventos MVP (`08a`): como el contrato actual no almacena un offset elegido, las horas repetidas o inexistentes se rechazan y se pide elegir otra hora válida. No se modifica un evento almacenado para normalizarlo. Ofrecer las dos apariciones de una hora repetida requiere primero ampliar el contrato de programación en una entrega separada; no se simula esa elección con un UTC derivado que luego se perdería.
- Nombres de días/meses y horas mediante `Intl`; no construir strings de fecha ambiguos para persistencia.

## Repetición

Alcance MVP: diaria, semanal con días seleccionados, mensual y anual; intervalo positivo; final opcional por fecha o número de apariciones. No se promete RRULE completo.

- Regla tipada con frecuencia, intervalo, fecha ancla, zona y límite. Validación compartida y generación pura en `src/lib/calendar/**`.
- Identidad determinista de ocurrencia a partir de `seriesId` y `slotKey` original. Reprogramar una sola aparición conserva esa identidad; no recalcularla desde la fecha modificada.
- Cada ocurrencia de tarea comienza `not_started`, con una copia de la plantilla de checklist y sus IDs de punto. Completar una no completa las siguientes ni las anteriores.
- Ocurrencias pasadas no completadas se acumulan en atrasadas. No reemplazar automáticamente lo pendiente por una única tarea nueva.
- Generar por rangos y paginar atrasadas para no expandir una serie infinita. Para atrasadas, cubrir desde la fecha ancla hasta hoy, aunque quede fuera del mes visible; limitar trabajo por páginas sin omitir silenciosamente resultados.
- Edición/borrado: “Solo esta aparición” crea excepción o cancelación; “Esta y las siguientes” cierra el tramo previo y crea otro, preservando IDs, estados e historial anteriores. No ofrecer edición retroactiva masiva de toda la serie en el MVP.
- Editar la plantilla de checklist afecta a las nuevas ocurrencias del tramo futuro; no modifica checklists históricos ya materializados.
- Un día 31 se omite en meses sin ese día. El editor muestra esta regla. Cumpleaños del 29 de febrero se muestran el 28 en años no bisiestos; el cumpleaños original sigue siendo el 29.
- Recurrencia de eventos evita duplicados en horario de verano. Pruebas con años bisiestos, límites de mes/año, excepciones, separación de tramos y dos dispositivos.

## Compartición por Gmail

- Compartir tarea, evento o cumpleaños; para repetidos, se comparte la serie. Compartir solo una ocurrencia queda fuera del MVP.
- Propietario: edita, borra, invita y revoca. Editor: edita contenido, estado y checklist, sin borrar el elemento completo ni cambiar miembros. Lector: consulta. Ambos pueden clasificar y ordenar su vista personal.
- El estado de una tarea es común para sus colaboradores; no es una lista de finalizaciones individuales. Esta elección se hará visible al compartir.
- Escribir correo crea una invitación. No enviar email automáticamente ni usar Gmail API; el destinatario verá la invitación dentro de la app al conectarse. Envío de email es ampliación posterior con proveedor y permiso específicos.
- Normalizar espacios y mayúsculas; no eliminar puntos ni sufijos `+` de Gmail por suposiciones. Vincular la aceptación a un email verificado y al ID persistente del destinatario.
- No buscar o publicar un directorio de usuarios, ni revelar si un email está registrado antes de la aceptación.
- Invitación pendiente no da acceso. Aceptación y revocación solo se consideran efectivas con respuesta remota confirmada. El borrador offline permite preparar una invitación, nunca conceder permisos localmente.
- Revalidar membresía en todas las operaciones del servidor. Si se revoca mientras alguien está offline, su copia existe hasta que se conecte; al reconectar se retira de la vista activa y sus cambios se rechazan, sin convertirlos en escritura autorizada.

## Fuera del MVP

Google Calendar, importar contactos/cumpleaños de Google, email transaccional, recordatorios push, adjuntos, subtareas jerárquicas, semana/kanban, múltiples etiquetas por elemento, búsqueda avanzada, edición colaborativa en tiempo real y CRDT, cuentas invitadas sin Google, y cifrado local con contraseña independiente. El backup local básico sí está incluido para recuperar trabajo offline.

Estas extensiones no forman parte de “completamente offline” y no deben introducirse mientras se construye la base.

### Reglas iniciales implementadas en `02b`

Fechas civiles admitidas: años `0001–9999`, sin conversión implícita a la zona del dispositivo. La zona de la cuenta determina hoy mediante un reloj inyectable. Los rangos usan final exclusivo, semanas de lunes a domingo y un límite de expansión. Atrasadas conserva la fecha y el estado; excluye completadas, tombstones y ocurrencias canceladas. Una serie se evalúa por ocurrencias, nunca por su registro padre; su generación llega en `09`.


### Semántica civil de repetición implementada en09a1

- `weekdays`:0domingo–6sábado; cadence semanal anclada a semana de lunes que contiene `anchorDate`. En la primera semana solo se incluyen días iguales/posteriores al ancla, aunque esta no figure entre los días seleccionados.
- `until` incluye su fecha. `count` limita las fechas programadas válidas desde el origen, sin reiniciarse al cambiar rango/página. Mes sin el día anclado y año sin29feb no generan slot ni consumen count. Cumpleaños mantiene su regla separada28feb pendiente10.
- Consulta civil inclusiva, cursorfecha exclusivo y páginas1–500 con `nextAfter` explícito; rango máximo soportado0001–9999. El límite controla resultados, no elimina silenciosamente lo restante. Se salta a rango por aritmética, y count de fechas omitidas usa ciclo gregoriano400años.
- Este corte entrega fechas, no instantes/ocurrencias/UI.09a2 proyectará slots de eventos y señalará gaps/folds; la política de conteo de slots con problema horario se documentará allí antes de activarlos.


### Proyección de ocurrencias implementada en09a2

- Página por fecha original de inicio en la zona de la serie, no por visibilidad en la cuenta. Slot de tarea/all-day es fecha; timed es fecha+hora original. IDseriesId:slotKey nunca depende de la fecha visible que después cambie una excepción.
- Tarea generada comienza sin empezar, con completedAtnull y copia independiente del checklist no completada. Metadata inicialrevision0/timestampscreatedAtde serie; el padre no presta progreso ni estado a una aparición.
- All-day conserva número de díasciviles. Timed desplaza fechas de inicio/final por el mismo offsetcivil, conserva ambas horas locales y zona. Así09:00→10:00 se mantiene local, y una duración que cruzaDST puede variar en instantes. No usar duraciónUTC fija ni sumar24h para repetir.
- Gap/fold/desbordamiento del año9999 se devuelve como incidencia con ID/slot original, junto a apariciones válidas. `count`/limit cuentan slotsciviles, incluidos los que necesitan revisiónhoraria; no reemplazarlos ni extender el conteo silenciosamente. Cursor sigue avanzando aunque la página contenga solo incidencias.
- Excepciones, persistencia, lectura por zona de cuenta y UI siguen09b–09c. Este helper no escribe DB ni interpreta una aparición reprogramada como un nuevo slot.


### Excepciones locales de tareas — 09b2

La excepción de tarea admite `content: {title, description}` opcional. Los registros anteriores sin contenido siguen siendo válidos y heredan de su padre al leerse; la siguiente materialización o mutación congela el contenido vigente. Una aparición editada conserva su propia copia. La nueva fecha prevista puede quedar fuera de la cadencia; `id` y `slotKey` siempre identifican la programación original.

Editar recibe título, descripción, fecha prevista e IDs/textos de checklist. Conserva el completado de pasos existentes y crea los nuevos sin completar; no modifica estado/completedAt. Cancelar marca `cancelled` y conserva contenido, fecha y progreso. Ambos comandos exigen snapshots de serie y aparición (virtual o persistida), comprobados dentro de la transacción para evitar sobrescribir progreso concurrente. La UI todavía no ofrece repetición; los lectores deben aplicar excepciones y seleccionar reprogramadas por su fecha efectiva en 09b3.
