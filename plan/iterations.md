# Iteraciones de implementación

Cada identificador, incluidas letras (`01a`, `01b`), representa una entrega con **su propio commit y pregunta de presupuesto**. No ejecutar automáticamente todo un bloque numerado. El orden es secuencial salvo decisión explícita conforme a [workflow.md](workflow.md).

Los `target_paths` describen el ámbito permitido; antes de editar, concretar archivos y leer instrucciones anidadas. Las rutas de pruebas se colocan junto al módulo cuando proceda. No crear todas las carpetas ni archivos vacíos por anticipado.

## Hitos y estado

| Hito | Entregas | Estado |
| --- | --- | --- |
| Plan y reglas | `00` | Completada; validación documental registrada en el log. |
| Responsive y lote desatendido | `00b` | Requisitos y protocolo incorporados. |
| Identidad y base offline | `01a–04c` | Completada; identidad, persistencia, worker/cierre y barras comprobados. Google real y dispositivos físicos siguen en el piloto. |
| Calendario personal y creación de tareas | `05a–07b` | `05a–07a` completadas, con corrección intercalada `05c`; reordenación pendiente. |
| Eventos, repetición y cumpleaños | `08–10` | Pendiente. |
| Remoto, convergencia y recuperación | `11a–13c` | Pendiente. |
| Compartición y piloto | `14a–15b` | Pendiente. |

Para toda entrega con código: tipos, lint, pruebas pertinentes y build según [workflow.md](workflow.md). Los criterios siguientes añaden evidencia específica, no reemplazan esas comprobaciones. No marcar un hito terminado si falta una subentrega.

Toda nueva pantalla importante debe actualizar en la misma entrega el registro único que alimenta navegación inferior móvil y superior escritorio, después de construirlas en `04c`. Las entregas de UI incluyen comprobación responsive, interacción táctil/teclado y contenido no tapado por barras fijas.

## 00 — Plan inicial

- Objetivo: documentar producto, decisiones, arquitectura, secuencia y reglas de trabajo.
- `target_paths`: `plan/**`, `AGENTS.md`.
- Dependencias: inspección del estado real del repositorio y restricciones del usuario.
- Aceptación: todos los requisitos tienen decisión y entrega; reglas de idioma, commit y ambas ventanas persistidas; enlaces locales válidos, diff limpio y commit en la rama actual.
- Siguiente candidata: `01a`, secuencial; confirmar lectura nueva de ambas ventanas antes de empezar.

## 01 — Identidad persistente y separación de cuentas

### 01a — Adaptador de identidad

- Estado: completada la integración y sus comprobaciones automatizadas; verificación interactiva con Google real en `15a`.
- Objetivo: persistir usuarios y cuentas de Google con ID estable, reutilizando singleton y adaptador Better Auth existente.
- `target_paths`: `src/lib/auth/auth.ts`, `src/lib/db/{client,collections,ensure-indexes}.ts`, `src/lib/db/{auth-adapter,auth-models}.ts`, pruebas de DB/auth, configuración de seguridad de la DB de test en `src/config/env.ts` e instrucciones de la capa DB.
- Dependencias: `00`; revisar tipos/documentación instalada del adaptador; acceso a base de pruebas. No abrir otro cliente ni crear índices fuera del registro central.
- Aceptación automatizada: misma cuenta obtiene el mismo ID tras cerrar sesión/reconectar y desde dos clientes HTTP con cookies independientes; cuentas distintas tienen IDs distintos; índices de auth registrados; URL de autorización Google conserva proveedor, client ID y callback. Firmas/emisor/audiencia se verifican con clave de prueba y MongoDB real. El recorrido interactivo completo en dos navegadores y Google real se verifica en `15a`, sin atribuir esa evidencia a esta entrega.
- Ajuste de validación: clientes HTTP independientes hacen la comprobación reproducible de persistencia sin cuentas personales ni intervención OAuth; el test usa el handler real y solo sustituye el origen de claves públicas. Los detalles de ejecución están en [el registro](iteration-log.md).
- Riesgo/corte: si el arranque async del adaptador afecta a la API actual, documentar y resolver en esta entrega; no avanzar a datos de producto con identidad transitoria.

### 01b — Sesiones anteriores, autorización y cuenta activa

- Estado: completada; política y operación en [auth-operations.md](auth-operations.md).
- Objetivo: endurecer verificación vigente para sync y definir transición desde auth sin DB.
- `target_paths`: `src/lib/auth/{session,authorized-session,auth}.ts`, pruebas de auth y suite DB de identidad, documentación de setup.
- Dependencias: `01a`; mantener `ALLOWED_EMAILS` como restricción del piloto.
- Aceptación: sesión vieja sin identidad persistida exige login; sesión revocada/caducada no autoriza remoto; usuario no autorizado no entra; no registrar tokens/PII. Prueba con dos cuentas autorizadas de prueba, sin escribir sus emails en el plan.

### 00c — Eliminar ruido de lint

- Estado: completada por petición expresa del usuario durante el lote desatendido.
- Objetivo y `target_paths`: añadir títulos accesibles en español a `public/{file,globe,next,vercel,window}.svg`; registrar el cierre en `plan/**`.
- Dependencias: ninguna funcional; se intercala antes de `02b`.
- Aceptación y validación: lint global sin errores, tipos y build aprobados; sin desactivar reglas ni cambiar el dibujo de los assets.

## 02 — Contratos y reglas básicas del dominio

### 02a — Entidades y comandos

- Estado: contratos iniciales implementados y comprobados; generación de recurrencia y mutaciones remotas siguen en sus entregas.
- `target_paths`: `src/types/{calendar-item,preferences,sharing,sync}.ts`, `src/schemas/**` relevantes.
- Dependencias: `01b` para confirmar tipo de identidad; reglas de [product-and-model.md](product-and-model.md).
- Aceptación: unión discriminada tarea/evento/cumpleaños, checklist por ID, preferencias personales, esquemas de intenciones/versiones; rechazar datos incompatibles por tipo, títulos vacíos, fechas imposibles y payloads desmesurados. Tipos/esquemas sin imports de framework/driver.
- Alcance: contratos iniciales, sin implementar aún auth, transporte, UI ni recurrencia completa.

### 02b — Fechas civiles y atrasadas

- Estado: completada; aritmética civil y selección probadas, conexión con UI prevista en `06–07`.
- `target_paths`: `src/lib/calendar/{civil-date,date-range,overdue}.ts`, pruebas asociadas.
- Dependencias: `02a`.
- Aceptación: fecha local no cambia por offset UTC; atraso conserva estado y fecha; completadas/eventos/cumpleaños excluidos; pruebas de cambio de día, mes/año y zona, con reloj inyectable.

## 03 — Persistencia local y outbox

### 03a — Repositorios IndexedDB

- Estado: completada; ocho comprobaciones en navegador real, incluida recarga; escritura con outbox se incorpora en `03b`.
- `target_paths`: `src/lib/local-db/**`, tipos/esquemas locales específicos.
- Dependencias: `02b`.
- Aceptación: crear/leer/editar/borrar lógico persiste tras recarga; datos de dos cuentas aislados; stores e índices locales definidos; migración inicial versionada; error de almacenamiento no devuelve guardado exitoso.
- Validación adicional: navegador real, no solo mock en memoria.

### 03b — Escritura atómica e intenciones

- Estado: completada para infraestructura y mutaciones básicas de elementos; comandos de categorías/preferencias/orden se conectan en `05b/07b`, ocurrencias en `09b` y ACK/reconciliación en `12b`.
- `target_paths`: outbox y transacciones en `src/lib/local-db/**`, `src/features/sync/**` local, contratos afectados en `src/schemas/**`.
- Dependencias: `03a`.
- Aceptación: dato+operación en una transacción; UUID estable en reintentos; orden/dependencias de crear-editar-borrar; recuperar envío interrumpido; shadow remoto separado. Ninguna llamada a red necesaria para guardar.
- Validación adicional: interrumpir la transacción y comprobar que no existe cambio sin operación ni operación sin cambio.

## 04 — Arranque y reapertura offline

### 04a — Shell neutro y preparación PWA

- Estado: completada, incluyendo recarga de producción con servidor detenido. Navegador de Codex comprobado; Safari/iPhone/Android físicos pendientes del piloto.
- `target_paths`: `src/app/(offline)/workspace/page.tsx`, `src/app/manifest.ts`, `src/features/workspace/**`, `src/lib/pwa/**`, `src/proxy.ts`, assets `public/**`, configuración/build del worker si hace falta.
- Dependencias: `03b`; leer guía PWA instalada y precisar navegadores del piloto. Un único responsable de configuración compartida.
- Aceptación: entrada neutra sin datos privados, cliente con partición preparada, worker TypeScript compilado y assets necesarios cacheados; `/workspace` y manifest no bloqueados por auth; API sigue protegida; “Disponible sin conexión” solo tras preparar recursos y datos.
- Corte: no dar por completado por obtener un icono instalable; primero probar que el shell funciona offline en build de producción.

### 04b — Cierre, cuenta y versión

- Estado: completada en navegador de Codex; cierre de todas las pestañas y nueva webview sin servidor, aislamiento y actualización probados. Reinicio físico de navegadores móviles pendiente de `15a`.

- `target_paths`: `src/features/workspace/**`, `src/lib/pwa/**`, arranque de `src/lib/local-db/**` y pruebas de navegador.
- Dependencias: `04a`.
- Aceptación: cerrar navegador, desconectar y abrir shell; partición persistida disponible sin sesión remota vigente; logout oculta datos en todas las pestañas; cambio de cuenta no arrastra cola. Actualizar shell conserva IndexedDB y no interrumpe una escritura.

### 04c — Navegación responsive mobile-first

- Estado: completada para barras, resumen/ajustes, navegación offline y texto al 200%; creación operativa se conecta en `05a`.

- Corte de implementación: resumen y ajustes reales de dispositivo; el botón `+` se activa con el formulario operativo de `05a`, inmediatamente después, sin destino ficticio en esta entrega.

- `target_paths`: componentes extraídos en `src/components/shared/**` para barra inferior/superior, SVG en `src/components/ui/**`, registro tipado en `src/config/navigation.ts` y shell de workspace.
- Dependencias: `04b`; solo incluir pantallas que existan. Un registro de destinos, dos presentaciones responsive; sin nuevo kit de UI.
- Aceptación: móvil con barra inferior de iconos SVG y labels en español; escritorio con navbar superior; estado activo y navegación por teclado; botón `+` accesible; safe areas y padding impiden tapar contenido. Verificar a 320/390/768/1280px y con texto ampliado; navegación entre destinos locales disponible offline.
- Mantenimiento: actualizar ambas variantes al introducir calendario/agenda, compartidos o ajustes; no añadir botones sin implementación ni duplicar registros.

## 05 — Crear y editar tareas

### 05a — Botón `+` y formulario (dividida para el lote)

- `target_paths`: `src/features/tasks/components/**`, `src/features/workspace/components/**`, primitivas realmente reutilizables en `src/components/ui/**`.
- Dependencias: `04c`.
- Aceptación: botón principal accesible; tarea con título, fecha, descripción y checklist se guarda offline; errores en español; fecha seleccionada precargada; edición y borrado lógico funcionan tras recarga.
- Alcance: mostrar solo opciones de creación ya operativas; añadir evento/cumpleaños en `08/10`, sin botones que simulen guardar.


#### 05a1 — Crear y listar tareas offline

- Estado: completada; formulario y guardado offline probados en producción, incluidas recarga y outbox.

- Objetivo: activar `+`, crear tarea simple validada con fecha/descripcion/checklist inicial y listar datos locales, con modal accesible y guardado dato+outbox.
- `target_paths`: `src/features/tasks/{local-tasks.ts,hooks/**,components/**}`, integración en workspace/resumen y ambas barras; revalidación de foco en `local-db/account-control.ts`; fixture y plan. Dependencias: `04c`, contratos/IndexedDB de `02–03`; sin nuevas dependencias.
- Aceptación/validación: hoy de la zona de la cuenta precargado; errores españoles; no afirmar guardado antes de commit transaccional; tarea creada sin servidor se conserva tras recarga; outbox verificable; móvil/teclado; tipos, lint, pruebas, build. Estado/checklist existentes solo lectura en esta entrega.

#### 05a2 — Editar y borrar tareas offline

- Estado: completada; edición/borrado y recarga sin servidor en Chrome de producción, outbox y rechazo de edición obsoleta comprobados.

- Objetivo y `target_paths`: ampliar formulario/listado y `local-tasks.ts` para actualizar y borrar lógicamente mediante outbox; plan y fixture pertinente. Dependencia: `05a1`.
- Aceptación: editar título/fecha/descripción/checklist conserva identidad/estado; borrar pide confirmación explícita y crea tombstone, sin borrar cola; recarga sin servidor conserva ambos resultados; comprobación de dependencias de intenciones.

### 05b — Categorías y estados (dividida)

- Estado: completada mediante `05b1–05b3`; clasificación personal desde cada tarea ya guardada.

- `target_paths`: `src/features/tags/**`, estado/checklist en `src/features/tasks/**`, repositorios locales afectados.
- Dependencias: `05a2`.
- Aceptación: crear/elegir categoría; “Sin categoría”; empezar/completar/reabrir; marcar checklist no completa tarea implícitamente; borrar categoría conserva tareas; todos los cambios escriben outbox y sobreviven offline.

#### 05b1 — Estado y checklist interactivos

- Estado: completada; estados/checklist y siete intenciones encadenadas de una tarea conservados tras recarga sin servidor.

- Objetivo: empezar, completar y reabrir tareas simples; marcar pasos sin completar implícitamente la tarea.
- `target_paths`: servicio/componentes/hooks de tareas, comando de checklist compartido y mutación local, pruebas y plan. Dependencia: `05a2`.
- Aceptación: cambios por ID y campo, dato+outbox atómicos, estado/checklist persisten tras recarga offline; fallo visible y bloqueo de doble envío mientras guarda. Conserva fechas y contenido; no edita padres recurrentes como si fueran ocurrencias.
- Validación: casos de completar/reabrir/paso inexistente, cola y dependencias en IndexedDB, UI real sin servidor, tipos/lint/tests/build.

#### 05b2 — Intenciones locales para categorías y preferencias

- Estado: completada; transacciones, duplicados concurrentes, dependencias, rollback e inspección tras nueva carga comprobados en IndexedDB real.

- Objetivo: contratos y transacciones de crear/editar/borrar categoría personal y asignar categoría al elemento sin alterar su contenido.
- `target_paths`: schemas/types compartidos, outbox/mutaciones de preferencias en `lib/local-db/**`, pruebas y plan. Dependencia: `05b1`.
- Aceptación: pertenencia a cuenta validada, nombres duplicados tratados explícitamente, borrado conserva tareas y cola; asignaciones y categoría/orden quedan listos para transporte remoto. Evaluar índices y compatibilidad de registros existentes antes de editar.

#### 05b3 — Categorías en la interfaz

- Estado: completada; gestión/asignación/borrado y recarga offline con cola comprobados, ambas barras actualizadas y texto al 200% sin desbordamiento.

- Objetivo: crear/elegir/gestionar categorías; tareas sin categoría siguen accesibles.
- `target_paths`: `features/tags/**`, integración en tareas/workspace y registro de navegación si añade pantalla importante; fixture y plan. Dependencia: `05b2`.
- Aceptación: operaciones reales offline con errores españoles, asignar y retirar categoría, borrar categoría conserva tareas, recarga mantiene resultado. Si añade destino, actualizar ambas barras en la misma entrega.

## 05c — Preparación tras Google y pruebas en desarrollo

- Estado: completada; cinco casos de desarrollo y seis de producción, recarga/navegación/creación sin servidores y captura móvil comprobados con identidades ficticias.
- Objetivo: abrir automáticamente el espacio de una sesión autorizada y permitir probar tareas/categorías en desarrollo sin exigir el worker de producción.
- `target_paths`: `features/workspace/local-account.ts`, hook y textos de workspace/ajustes, pruebas de navegador aisladas y scripts de fixture; `plan/**`. Dependencias: `04b`, `05b3`; ejecución secuencial.
- Aceptación: sesión verificada activa la partición local y el `+`; un 401 solicita Google sin activar datos; desarrollo restaura datos sin worker y explica que la reapertura offline requiere producción; producción sigue exigiendo shell preparado. Cierre pendiente y época invalidada impiden reactivación; se conservan particiones y outbox.
- Validación: fixture con identidad ficticia servida únicamente en loopback, preparación/recarga/401/cierre y producción sin servidor; lint, tipos, tests, build y revisión de diff. No modifica Google, allowlist ni autorización remota.

## 06 — Calendario mensual y apertura del día

- Estado: completada; mes/día/creación y recarga sin servidores comprobados, ambas barras actualizadas, extremos de fecha y reflow al 200% validados. Entrada automática 48%/92%, secuencial.
- Objetivo: mes y día reales con enlaces offline, creación preseleccionada desde el día y ambas barras actualizadas.
- `target_paths`: `src/features/calendar/**`, filtro del listado/composer de tareas, workspace, registro/links/iconos de navegación, pruebas y `plan/**`.
- Dependencias: `05b3`, corrección intercalada `05c`.
- Aceptación: mes anterior/siguiente, “Hoy”, lunes como inicio, selección y URL del día; contadores e indicadores; abrir día muestra tareas reales; navegar a otro mes y recargar sin red; móvil y teclado usables.
- Alcance: cuadrícula propia sencilla, sin nueva librería de calendario. Contar eventos/cumpleaños cuando existan, no fabricar contenido de ejemplo como estado real.
- Hito: primera demostración útil de calendario personal offline.

## 07 — Agenda agrupada, orden y atrasadas

### 07a — Grupos y atrasadas

- Estado: completada; grupos, atrasadas, completar/recargar offline, historial original y cambio de día sin nuevas intenciones comprobados. Entrada automática 38%/90%, entrega secuencial.
- Objetivo: grupos personales en el día y sección global de atrasadas que conserva fecha/estado y se recalcula al cambiar de día.
- `target_paths`: selectores/componentes de tareas y calendario, hook de día de cuenta, resumen del workspace, pruebas/fixtures y `plan/**`.
- Dependencias: `06` y reglas de `02b`.
- Aceptación: título de categoría con sus tareas debajo; sección “Atrasadas” global con fecha original/estado; cambio de día y reentrada recalculan; completar retira de atrasadas; historial del día original preservado.
- Validación: selectores para categorías ausentes/borradas y completadas; reloj/foco con tiempo simulado únicamente en iframe de fixture; recorrido offline de completar y recargar, inspección de datos/cola; lint, tipos, tests y build. Reutiliza ambas pantallas existentes, sin nuevos destinos.

### 07b — Reordenación persistente (dividida)

- Diseño y cortes: [reordering.md](reordering.md). `07b0–07b3b` completos; candidata `08`, dividir antes de implementar.
- `target_paths`: componentes/hooks de orden en `src/features/tasks/**` y `src/features/tags/**`, preferencias en `src/lib/local-db/**`.
- Dependencias: `07a`.
- Aceptación: mover grupos y tareas, cambiar categoría personal, ordenar atrasadas; alternativa de teclado a drag-and-drop; recarga conserva orden; operaciones por ID/intención, sin reemplazo global de arrays.

#### 07b0 — Diseño de intenciones

- Estado: completada, exclusivamente documental. Entrada 29%/89%; `target_paths`: `plan/**`, dependencias `07a` y código de preferencias vigente.
- Objetivo: concretar scopes, clave global de atrasadas, validaciones transaccionales y separación de persistencia/controles/arrastre. Aceptación: rutas y evidencias de cada corte, sin habilitar comandos no implementados. Validación: referencias locales, consistencia y `git diff --check`.

#### 07b1a — Ranking y movimiento atómico de categorías

- Estado: completada, secuencial. Reanudación autorizada «Continua»; lectura automática 5h 100% / 7d 87%. Árbol limpio, rama `main`.
- Objetivo: `tag.move` con vecinos activos, orden determinista por posición/ID, compactación local y una sola intención atómica e idempotente.
- `target_paths`: `schemas/sync.ts`, `schemas/local-sync.ts`, `types/local-sync.ts`, ranking en `lib/ordering/**`, mutaciones/outbox de preferencias, lectores de categorías/grupos, fixture `test/browser/ordering.ts`, registro del servidor de fixtures y `plan/**`. Un responsable, sin paralelo.
- Dependencias: `07b0`, `05b2`, `07a`; reutiliza índice `byPosition`, stores y versión actuales. Sin consultas MongoDB ni nuevos paquetes.
- Aceptación: inicio/medio/final, vecinos obsoletos/borrados/self rechazados, desempate estable frente a renombrar, compactación acotada, revisión/contenido preservados, replay sin doble movimiento, colisión de UUID rechazada, particiones separadas, rollback tras fallo de cola y persistencia tras recarga. Colas anteriores legibles; no habilitar movimiento de tareas aquí.
- Validación: tests de ranking/contrato, IndexedDB real (concurrencia, rollback, recarga), tipos/lint/build, diff y referencias. Tras commit consultar ambas ventanas automáticamente durante la continuación autorizada; conservar reserva del 20%.

#### 07b1b — Movimiento atómico de tareas y colocaciones

- Estado: completada, secuencial. Entrada automática 5h 93% / 7d 86%, después de `08aa120`.
- Objetivo y alcance decidido: `task.move` para tareas simples, nueva clave personal de colocación, ejecutor separado de movimiento y helper de planificación, schemas/types, fixture de IndexedDB/servidor y `plan/**`. Un responsable; sin controles de UI todavía.
- Fecha de atrasadas: el campo de comando `date` existente indica el día de evaluación y debe coincidir con hoy según ajustes de cuenta/reloj al escribir; la colocación/clave usan siempre `0001-01-01`. Mantener lectura de comandos antiguos con ocurrencia no nula/clave item; no ejecutarlos en la capa de tareas simples.
- Legado: las tiendas existen pero no hay escritor de producto de colocaciones. Leer/validar registros existentes; un registro activo de atrasadas con fecha no canónica bloquea ese movimiento con error técnico y conserva todo, hasta migración separada. Colocaciones de otro día/categoría se conservan y no imponen rango en el destino.
- Orden inicial: colocaciones compatibles primero por posición/ID; filas sin posición después por fecha/creación/ID. Materializar filas implícitas del destino dentro de la misma transacción, con compactación si las posiciones exceden límites. Esta política será usada por lectores de `07b2`.
- `target_paths`: schemas/types de movimientos, preferencias/colocaciones en `lib/local-db/**`, pruebas y plan. Dependencia: `07b1a`.
- Aceptación: tareas simples por día y atrasadas, vecinos/actor/scope validados; categoría+colocación/compactación en una transacción; replay, rollback, legado y recarga comprobados. Evaluar colocaciones existentes antes de escribir. No escribir posiciones desde componentes.

#### 07b2a — Botones accesibles para categorías

- Estado: completada, secuencial; entrada automática 5h 86% / 7d 85%, después de `4e6e345`.
- Objetivo: Subir/Bajar categorías desde gestión, usar `tag.move`, conservar foco y bloquear duplicados durante guardado. Sin nueva pantalla; registro de ambas barras se conserva.
- `target_paths`: controles/icono genéricos en `components/ui/**`, helper de vecinos, servicio/hook/card/manager de categorías, fixture workspace/evidencia y `plan/**`. Dependencias `07b1a`, `07b1b`; reutilizar SWR/intent/account guard.
- Aceptación: orden confirmado y persistido tras recarga, inicio/final no escriben, teclado Enter/Espacio y foco conservado, reintentos no duplican, UI española legible en móvil/escritorio/200%, offline real con servidores detenidos. Una intención por movimiento; nombres/color/edición siguen operativos.
- Validación: fixture con cuenta ficticia y build de producción, inspección de cola, lint/tipos/tests/build, referencias/diff. Sin dependencia adicional.

#### 07b2b — Orden visible y controles de tareas

- Estado: completa, secuencial; entrada automática 5h 76% / 7d 83%, tras `678ac64`.
- Objetivo: leer colocaciones de forma independiente (fallo de preferencias no oculta tareas), ordenar por día o global atrasadas, botones Subir/Bajar, cambio de categoría vía `task.move` y grupos con `tag.move`. Una intención por movimiento; fechas intactas.
- Alcance: `features/tasks/**`, selector de categoría compartido, helper de vecinos visibles/rangos, fixture workspace/servidor/evidencia y `plan/**`. Dependencias `07b1b`, `07b2a`; reutilizar controles, SWR/intent y cuenta. Sin nueva pantalla ni destinos.
- Foco: preservar botón al reordenar; al cambiar grupo, recuperar el selector de la tarea en su nueva fila dentro de la sección. Grupos saltan categorías vacías mediante vecinos de la lista completa; Sin categoría permanece al final.
- Hoy y próximas: ordenar y mover dentro de la fecha original de cada tarea, sin cruzar días. Atrasadas usa lista global; completar conserva colocaciones/historial y cambio de día no escribe.
- Aceptación/validación: prueba de producción con servidores detenidos, día/atrasadas, grupo vacío intermedio, cambio de categoría atómico, teclado/foco, recarga, inspección de cola y estado, 320/390/escritorio/200%, tipos/lint/tests/build, referencias/diff.
- Resultado: todos los criterios anteriores comprobados; 62 tests aprobados, 7 auth opt-in omitidos, cero fallos; lint/tipos/build aprobados. Inspector confirma 19 operaciones consecutivas y cinco colocaciones, sin cambiar fechas; [evidencia móvil](evidence/07b2b-mobile.png).
- `target_paths`: lecturas/selectores/hooks y controles de grupos/tareas, fixture/plan. Dependencias: `07b1b`, `07b2a`.
- Aceptación: movimientos por botones y categoría con teclado/móvil; orden real por día y global atrasadas, recarga offline, una sola intención por cambio, errores españoles y foco conservado. Usar el mismo planificador de orden inicial; no mover fechas. Añadir controles de grupos si aportan acceso directo útil. Actualizar ambas barras si se añade pantalla.

#### 07b3a — Arrastre de categorías y control compartido

- Estado: completa, secuencial; entrada automática 5h 67% / 7d 82%, tras `29e0d7b`. División decidida antes de editar para probar el gesto antes de conectarlo a tareas/grupos.
- Objetivo: handle de Pointer Events para ratón/táctil con umbral, captura, cancelación por Escape/pérdida de foco, indicador de destino y scroll en bordes; una operación solo al soltar en un destino válido. Reutilizar `tag.move` y Subir/Bajar.
- `target_paths`: `components/ui/drag-order-handle.tsx`, icono SVG, helper puro de vecinos de drop y tests, manager/card de categorías, fixture/servidor/evidencias y plan. Dependencias `07b2b`. Sin nueva pantalla, paquetes, esquema o índice.
- Aceptación: cancelación y click sin mover no escriben; soltar guarda una intención, límites/destinos obsoletos no inventan vecinos, foco tras guardar, recarga offline; arrastre con scroll y teclado alternativo. Prueba real de ratón más secuencia táctil en fixture aislado, responsividad; lint/tipos/tests/build/referencias/diff.
- Resultado: ratón real con servidores detenidos, cancelación fuera de lista, un `tag.move` y recarga comprobados; secuencia táctil sintética con captura sustituida solo en fixture comprueba handlers/cancelación/scroll. No sustituye piloto táctil de dispositivo real. 63 tests, lint/tipos/build aprobados; [controles móviles](evidence/07b3a-mobile.png).

#### 07b3b — Arrastre de tareas y grupos

- Estado: completa, secuencial; entrada automática 5h 56% / 7d 80%, tras `58abe8f`.
- `target_paths`: filas/controles de tareas y grupos, pruebas/fixture, plan. Dependencia: `07b3a`.
- Objetivo: conectar el control compartido a comandos existentes por día/global atrasadas y al orden de grupos; categoría se cambia con selector accesible. No cruzar días ni modificar fechas.
- Detalle previo: cada lista de grupo identifica sus filas; peers de tarea solo incluyen mismo día (o global overdue). El hit-test rechaza una fila de otro día o grupo antes de calcular vecinos; grupos usan vecinos completos para saltar categorías vacías. Sin categoría queda fijo. Foco/errores/cola reutilizan hooks existentes.
- Validación: arrastre real de ratón offline en día/atrasadas/grupos, rechazo fuera de lista/otro día, inspector con una intención por drop y fechas intactas; fixture táctil del handle conserva cancelación/scroll. Recarga, móvil/escritorio/200%, lint/tipos/tests/build/referencias/diff.
- Resultado: 19 operaciones consecutivas, tres `task.move` y un `tag.move` sobre seis tareas, sin modificar fechas/estado; drop entre días rechazado. 63 tests, lint/tipos/build aprobados, fixture táctil añade destino incompatible/lista cambiante; [móvil](evidence/07b3b-mobile.png).
- Aceptación: arrastre táctil/ratón y cancelación, una intención al soltar, scroll móvil; alternativa por botones permanece operativa. Sin biblioteca nueva.

#### 07b3 — Arrastre con el mismo comando (bloque)

- `target_paths`: filas/controles de orden y pruebas, plan. Dependencia: `07b2b`.
- Aceptación: arrastre táctil/ratón y cancelación, una intención al soltar, scroll móvil; alternativa por botones permanece operativa. Sin biblioteca nueva.

## 08 — Eventos y citas

- `target_paths`: `src/features/events/**`, selectores de calendario, reglas de zonas en `src/lib/calendar/**`, schemas de evento.
- Dependencias: `07b1a–07b3b`.
- Aceptación: activar “Evento o cita”; hora, categoría, descripción, duración opcional y día completo; orden cronológico; evento que cruza medianoche visible en los días correctos; editar/borrar offline. Validar horas ambiguas/inexistentes y duración antes de guardar.
- Corte: si conversión de zona requiere aprobación de dependencia, cerrar primero su análisis; no aproximar horas silenciosamente.

### 08a — Conversión de hora/zona y validación temporal

- Estado: completa, secuencial; entrada automática 5h 48% / 7d 79%, tras `0d544c2`. Cuota recibida tras demora; no se editó código antes de recibirla.
- `target_paths`: `lib/calendar/zoned-time.ts`, `event-time.ts`, tests/fixture de runtime y plan. Dependencias `07b3b`, schemas de `02a`. Sin UI nueva, dependencia, store, índice o cambio de formato persistido.
- Objetivo: convertir fecha/hora local con Intl y comprobar candidatos UTC mediante vuelta exacta; distinguir instante único, hora repetida y hora inexistente. Validar inicio/fin y duración real antes del futuro guardado. Todo el día conserva fechas civiles/final exclusivo; fin opcional no inventa duración.
- Política MVP: no hay campo persistido que distinga las dos apariciones de una hora repetida. Rechazar esa programación y pedir otra hora válida explícitamente; no elegir antes/después silenciosamente. Una futura elección de offset exige contrato separado compatible. Mantener schema almacenado para no invalidar datos antiguos; la validación temporal se aplicará al input de producto en `08b`.
- Validación: UTC, Madrid/NY, transición de media hora, salto de día, offsets fraccionarios/históricos, años extremos, medianoche/duración real y casos inválidos; runtime Bun y navegador aislado, lint/tipos/tests/build/referencias/diff.
- Resultado: 67 tests pasan (cuatro nuevos), casos temporales repetidos con host TZ Honolulu y en navegador; sin normalización, escrituras o cuenta. Lint/tipos/build aprobados, [evidencia](evidence/08a-browser.png).

### 08b — Persistencia atómica y lectura de eventos

- Estado: completada, secuencial; entrada automática 5h 43% / 7d 78%, tras `587e12b`. IndexedDB real verifica cinco intenciones, rechazo sin escrituras, CAS, replay histórico y rollback; detalle en el registro.
- `target_paths`: `features/events/local-events.ts`, validación de input temporal compartida, mutación/outbox existente y fixture/tests, plan. Dependencia `08a`.
- Objetivo: crear/editar/borrar eventos simples, rechazar horas inválidas antes de guardar, mismo UUID y CAS conservados; lector separado de tareas, datos/cola atómicos. No activar UI antes de completar motor.
- Detalle previo: schema de input temporal separado del schema almacenado; validarlo en ejecutor local después de replay/guardias, antes de escribir. Reutilizar outbox item y singleton local; servicio valida estructura y guardia de cuenta. Lectura no reconvierte/rechaza registros históricos ambiguos. Recurrencia en input pendiente de `09c`.
- Aceptación: creación/edición/borrado simples, rechazo gap/repetición sin secuencia ni escritura, CAS/editor obsoleto, replay sin duplicar, legado legible y replay anterior preservado; IndexedDB real, cuentas aisladas, fallo de outbox revierte todo. Lint/tipos/tests/build/referencias/diff; sin pantalla/índice/dependencia nuevos.

### 08c1 / 08c2 — Crear/ver, después editar/borrar eventos

- `target_paths`: composer/list/card de eventos, creación compartida del workspace, selectores de calendario y plan. Dependencias `08b`; separar creación/listado de edición/borrado antes de empezar según cuota.
- Aceptación conjunta: selector + con Evento o cita activo, día completo/hora/duración/descripcion/categoría, cronología y días correctos, UI española y navegación responsive, offline/recarga/una intención, errores horarios explícitos y foco.

## 09 — Series y ocurrencias

### 09a — Motor de repetición

- `target_paths`: `src/lib/calendar/{recurrence,occurrences}.ts`, schemas de reglas y pruebas.
- Dependencias: `08`.
- Aceptación: diaria/semanal/mensual/anual, intervalo y límites; IDs deterministas; rango paginado; regla del día 31; misma hora local en cambios DST; fechas/zonas válidas. No expandir infinito.

### 09b — Ocurrencias de tareas y backlog

- `target_paths`: `src/features/tasks/**`, selectores de agenda, repositorios de excepciones locales.
- Dependencias: `09a`.
- Aceptación: estado/checklist por aparición; completar una no afecta a otra; atrasadas repetidas desde ancla hasta hoy por páginas, incluso fuera del mes visible; editar/cancelar solo una mantiene slot original.

### 09c — Eventos repetidos y programación futura

- `target_paths`: `src/features/events/**`, formularios compartidos de recurrencia, repositorios/contratos de separación de serie.
- Dependencias: `09b`.
- Aceptación: eventos repetidos y formulario de repetición; “Solo esta” y “Esta y las siguientes”; separación en una transacción local con comando remoto correspondiente; conserva pendientes anteriores e IDs históricos. Borrar futuras no borra checklist/estados pasados.
- Riesgo: no partir este comando entre dos entregas que dejen tramos incoherentes; cerrar modelo+persistencia+UI de la operación juntos.

## 10 — Cumpleaños

- `target_paths`: `src/features/birthdays/**`, variantes de calendario, regla anual y schemas asociados.
- Dependencias: `09c`.
- Aceptación: activar “Cumpleaños”; persona, día/mes y año opcional; aparición anual de día completo; edad solo si hay año; política de 29 de febrero visible y probada; sin estado/checklist; editar/borrar offline.

## 11 — Persistencia remota autorizada

Prioridad revisada el7oct: adelantar sincronización del alcance local ya operativo, a petición del usuario.09b4b2a/09c/10 quedan aplazadas; no son prerrequisitos de persistencia de tareas/eventos simples. Primer corte11b0 prepara huella de recibos sin IO; después11a1 confirma transacciones en DB de prueba y desarrolla repositorios/índices, antes de activar acciones11b. No ACK ni envío de comandos sin ejecutor remoto probado; recurrencia/cumpleaños/sharing se incorporan después sin borrar intenciones pendientes.

### 11a — Repositorios, índices y transacciones

- `target_paths`: `src/lib/db/**`, tests de integración, scripts de setup estrictamente necesarios.
- Dependencias revisadas para11a1: contratos/outbox y tareas/eventos simples ya entregados; confirmar replica set/clúster compatible sin exponer URI ni modificar datos reales. Cobertura de separar serie y cumpleaños espera09c/10 y se añade después; no declararla probada en el primer corte.
- Aceptación: repositorios de entidades personales, compare-and-swap, borrados y comando de separar serie; mapeos sin driver fuera de DB; índices exactos centralizados; operación fallida revierte transacción. Preparar DB de prueba reproducible.
- Corte: si infraestructura no soporta transacciones, replantear garantía del journal antes de continuar.

Primeros cortes revisados:11a1a configura/valida replica set de prueba aislado y comprueba commit/rollback sin acceder a datos reales;11a1b introduce repositorio de elementos simples con CAS y registro central de índices, conflictos/concurrencia/borrados comprobados contra esa DB. Revisar estado de herramientas existentes al abrir, no instalar servicios ni cambiar configuración de hosting por iniciativa propia. Después11b1 integra recibo+mutación+journal atómicos, autorización y replay, antes de exponer acción de subida. Preferencias pendientes deben viajar antes de anunciar convergencia completa del espacio.

### 11a0 — Entorno y matriz de pruebas de sincronización

- Objetivo documental: dejar11a1a listo para implementación con aislamiento, ejecución y pruebas concretas. Entrada14%/59%, secuencial enint; usuario pide otra entrega mínima. No configurar ni arrancar servicios en este corte.
- `target_paths`: `plan/{sync-test-environment,master,iterations,iteration-log,offline-and-sync}.md`. Dependencias:11b0, singleton/índices y fixture de auth existentes. Herramientas locales inspeccionadas sin credenciales/conexión DB.
- Aceptación: distinguir tooling disponible de runtime/replica set no comprobados; definir guards de configuración/limpieza, lifecycle y casos verificables de atomicidad/CAS/replay/journal. Separar11a1a de11a1b/11b1 sin afirmar garantías remotas ni añadir índices especulativos.
- Validación: referencias/consistencia/diff, commit/push int y ambas cuotas. Código sin cambios; no requiere repetir build para documentación.

- Resultado: [entorno/matriz](sync-test-environment.md) documentados con guards, lifecycle y12 escenarios por cortes. Docker CLI29.8.2 confirmado, runtime/replica set pendientes; no se inició servicio ni se conectó a una DB. Referencias/diff/consistencia aprobados. Siguiente11a1a implementa runner y prueba commit/rollback reales.

### 11a1a1 — Contrato de configuración aislada de test

- Objetivo: validator puro del descriptor que consumirá el futuro runner antes de conectar. Entrada12%/59%, entrega mínima explícita, secuencial enint. `target_paths`: `src/schemas/sync-database-test.ts`, su test, `plan/{master,iterations,iteration-log,sync-test-environment}.md`. Depende de11a0/Zod existente; no API nueva de Next, guía instalada ya revisada.
- Aceptación: UUID de ejecución/puerto acotado, DB exacta derivada del UUID y URI única loopback de replica set de test; rechazar URI normal/remota/SRV/multihost/credenciales, DB auth/otra ejecución, campos extra. No leer env ni abrir DB; validar descriptor no prueba ownership ni transacciones. Tests, lint/tipos/build/diff/referencias, commit/pushint y cuotas.

- Resultado: tres tests/24 aserciones, configuración válida/extremos de puerto y conexiones/DB inválidas comprobadas. Lint217 archivos, tipos y suite122 pass/7auth opt-in skip/0fallos; build/cierre enregistro. Sin IO ni consumidor; siguiente11a1a2 conecta este guard al runner aislado y verifica ownership/commit/rollback reales.

### 11a1a2 — Runner y transacciones reales aisladas

- Entrada100%/58%, int/secuencial, reserva10% autorizada enworkflow. Objetivo: runner propio consumiendo descriptor/guard, MongoDB8.2.11 fijado por digest, probar commit/rollback con singleton y limpiar solo recursos propios.
- `target_paths`: `scripts/sync-db-test-runner.ts`, `src/config/{env,sync-test-runner}.ts`, `src/lib/db/transactions.integration.test.ts`, package.json yplan. Dependencias11a1a1/Docker existente. Guía instalada de ServerActions y documentación MongoDB transacciones/replica set consultadas.
- Aceptación: puerto loopback dinámico, runId/label/imagen verificados antes de test y limpieza, sin bind/volumen del usuario. Configdeproceso testeada antes de conexión, opt-in separado; readinessprimary con plazo, driver soloDB/singleton. Confirmar dos escrituras, aborto por fallo intermedio sin cambios parciales, recuperación y lecturas fuera de sesión. Testnormal omite integración; runner real la ejecuta y falla si nohay runtime. No nueva colección/índice: probe solo enauthVerification de DB propia, índice_id existente.
- Validación: integración real, limpieza verificada, suite/lint/tipos/build/diff/ref; plan/registro, commit+pushint ycuotas. Siguiente11a1b repositorio/CAS; no endpoint ni sync activos todavía.

- Ajuste antes de integrar: Docker es un daemon Ubuntu/x86_64 accesible por socketunix; publicar127.0.0.1 queda en el host del daemon y el puerto fue ECONNREFUSED desde macOS. El primer intento falló y limpió su contenedor propio. Runner usará proxyTCP local127.0.0.1 haciaDocker exec/bash del contenedor propio, sin publicar puertosMongoDB. Solo APIs nativas Node, no dependencias/credenciales nuevas; cerrar sockets/procesos al limpiar. La URI validada/singleton y prueba de transacción permanecen iguales.

- Resultado: runner propio, guard de env y pruebas reales pasan; dos tests/seis aserciones, recuperación después de rollback y lecturas externas. SIGTERM exit1/limpieza comprobados y listado de contenedores propios vacío. Lint220 archivos/tipos/build29recursos aprobados; suite122pass/11opt-in skip/0fallos. Siguiente11a1b1 repositorio simple/CAS con índices de producto, antes de subir operaciones.

### 11a1b1 — Repositorio remoto propio y CAS

- Entrada92%/57%, secuencial/int. Objetivo: persistir registros CalendarItem validados enitems, con actor vinculado al repositorio y escrituras por revisión; todavía sin ejecutor de comandos/endpoint.
- `target_paths`: `src/lib/db/{collections,ensure-indexes,ensure-indexes.test,remote-items,remote-items.integration.test}.ts`, `src/schemas/remote-items.ts`, runner yplan. Depende de11a1a2/schema existente; guía Next data-security revisada. Driver y tipos físicos soloDB; singleton/getCollection.
- Aceptación: IDs únicos globales, insert revision1/no borrado; CAS base→base+1 con owner/id/kind/createdAt activo, tombstones conservados y sin resurrección. Lectura/página propias (incluye tombstones), cursor_ID ylimit1–100 validados; índiceownerId+_id por consulta real. Otra cuenta/registro corrupto rechazado sin datos ajenos. Dos editores de misma revisión solo uno modifica, duplicatecreate no sobrescribe; paginación y aislamiento enMongo real. Source/tests/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas. Recibos/journal todavía posteriores.

- Resultado: repo server-only yDTO CalendarItem propios, CAS/duplicados/tombstones/paginación/corrupción pasan enMongoDB8.2.11 propio. Cuatro tests nuevos; runner6pass/33aserciones, normal123pass/17opt-in skip/0fallos, lint223files/tipos/build29recursos pasan. ÍndiceownerId+_id registrado, sin ad hoc. Siguiente11a1b2 reductor de comandos simples compartido, después11b1 recibo/journal transaccionales; sin transporte activo todavía.

### 11b — Acción validada e idempotencia

- `target_paths`: `src/features/sync/actions.ts`, validadores de sync, recibos/transacciones en DB, pruebas de autorización.
- Dependencias: `11a`.
- Aceptación: actor de sesión, input Zod limitado, recibo+mutación atómicos; mismo operation ID no duplica; payload diferente con ID reutilizado falla; revisión incorrecta devuelve conflicto; datos de otra cuenta rechazados. Separar resultado por operación del lote.

### 11b0 — Huella validada de operaciones (preparatoria)

- Objetivo: huella SHA256 determinista del payload validado para futuros recibos idempotentes; entrada17%/60%, secuencial enint, entrega mínima pedida explícitamente. No depende de DB ni de11a; acciones/remoto aún pendientes.
- `target_paths`: `src/lib/sync/operation-fingerprint.ts`, su test, `plan/{master,iterations,iteration-log,offline-and-sync}.md`. Dependencias: `syncOperationSchema`, Node crypto instalado; guía use-server instalada revisada. Módulo server-only sin endpoint, credenciales, auth nueva, persistencia o índices.
- Aceptación: orden de propiedades irrelevante en cualquier nivel; array ordenado y campos significativos cambian huella; semántica normalizada por schemas existentes; todos los campos de operación incluidos, formato canonical versionado, rechazar input inválido/extra. Hash no autoriza al actor ni prueba que una operación se ejecutó. Oráculo independiente SHA256 y input intacto.
- Validación: tests/suite, lint/tipos/build, diff/referencias, plan/registro y commit/push int; cuotas al cerrar. Siguiente11a1 replica set de prueba/repo inicial; no abrir conexión ni declarar sincronización en esta entrega.

- Resultado: cuatro tests/18 aserciones, oráculo independiente WebCrypto, canonicalización/normalización, cambios significativos, input intacto y rechazo validado pasan. Suite119 pass/7auth opt-in skip/0fallos, lint215 archivos/tipos aprobados; build y cierre enregistro. No hay llamadas ni mutaciones remotas. Siguiente11a1 verifica replica set de prueba y primer repositorio/índices.

## 12 — Descarga incremental y conexión automática

### 12a — Journal y bootstrap

- `target_paths`: repositorios/counters de sync en DB, servicios server de `src/features/sync/**`, rutas GET `src/app/api/sync/**`.
- Dependencias: `11b`.
- Aceptación: cursor por usuario estable bajo transacciones concurrentes; bootstrap paginado no omite modificaciones durante descarga; journal+recibo+mutación atómicos; borrados y preferencias viajan; lecturas privadas sin caché pública y con autorización. Cursor y query input validados.

### 12b — Coordinador local

- `target_paths`: hooks/coordinador de `src/features/sync/**`, outbox y reconciliación de `src/lib/local-db/**`, componentes de estado.
- Dependencias: `12a`.
- Aceptación: mismo flujo con/sin conexión; detectar identidad antes de push; pull no borra pendientes; ACK/cursor locales atómicos; lease entre pestañas; reintento con mismo ID y backoff; polling visible recibe cambios de otro dispositivo.
- Hito: dos dispositivos de la misma cuenta convergen al conectarse.

## 13 — Conflictos y recuperación

### 13a — Resolución visible

- `target_paths`: `src/features/sync/components/**`, registro/resolución de conflictos locales, schemas de resolución.
- Dependencias: `12b`.
- Aceptación: dos cambios incompatibles dejan conflicto legible, no pérdida silenciosa; conservar remoto o reaplicar sobre revisión actual; nuevo ID de resolución; tombstone impide resurrección; otras entidades siguen sincronizando.

### 13b — Sesión, cierre y despliegue

- `target_paths`: recuperación/coordinador de sync, shell/worker, handshake de protocolo y pruebas de integración.
- Dependencias: `13a`.
- Aceptación: respuesta perdida después de commit remoto no duplica; cierre durante envío recuperable; login requerido conserva cola; bundle antiguo tras despliegue pausa, actualiza y reintenta; versión incompatible conserva/exporta pendientes, sin falso éxito.

### 13c — Backup y fallos de almacenamiento

- `target_paths`: `src/lib/local-db/{backup,migrations}.ts`, schemas de backup, UI de workspace para almacenamiento/importación.
- Dependencias: `13b`.
- Aceptación: exportar pendientes offline; importar JSON validado/versionado solo a cuenta activa, revisar duplicados y generar nuevas intenciones; fallo de cuota no borra datos ni confirma guardado; denegación de persistencia explicada; migración preserva outbox.

## 14 — Compartir con otra cuenta Gmail

### 14a — Invitaciones y permisos remotos

- `target_paths`: `src/features/sharing/actions.ts`, schemas, repositorios/membresías/invitaciones y registro de índices.
- Dependencias: `13c` y dos cuentas permitidas en el piloto.
- Aceptación: invitación pendiente sin acceso; aceptación exige email verificado coincidente; propietario/lector/editor aplicados en servidor; usuario no autorizado no obtiene acceso por invitación. Caducidad, rechazar, revocar y reenviar con reglas explícitas, sin envío de emails.

### 14b — UI y visibilidad compartida

- `target_paths`: `src/features/sharing/components/**`, hooks/inbox y selectores locales; journal/fanout según contratos de `14a`.
- Dependencias: `14a`.
- Aceptación: compartir desde elemento/serie, estado pendiente claro; destinatario recibe invitación dentro de app; aceptar online descarga elemento sin duplicar; categoría/orden independientes; estado/checklist compartidos; repetir visible en ambos dispositivos.

### 14c — Revocación y cambios offline de colaboradores

- `target_paths`: autorización/journal remotos, manejo local de retirada y conflictos de permisos, pruebas multicuenta.
- Dependencias: `14b`.
- Aceptación: lector/editor no elevan privilegios; edición tras revocación rechazada; retiro local al reconectar; nuevo pull no expone payloads antiguos; copia offline no se presenta como revocación instantánea. Conservar trabajo rechazado de forma explícita, sin enviarlo ni restaurar acceso.

## 15 — Piloto y aceptación completa

### 15a — Recorrido real y accesibilidad

- `target_paths`: solo los componentes/módulos que fallen en el recorrido, evidencia de aceptación, documentación de operación.
- Dependencias: `14c`.
- Aceptación: ejecutar matriz siguiente en navegador/DB reales y build de producción; comprobar UI móvil, teclado, foco, nombres accesibles, formularios y contraste. Corregir fallos por entregas acotadas sin ampliar producto.
- Incluir login Google interactivo en dos navegadores y tras cerrar sesión, complementando la evidencia automatizada de `01a`. Los cinco avisos iniciales de accesibilidad de SVG de plantilla se corrigieron en `00c`; revisar los assets usados en la UI durante el recorrido.

### 15b — Cierre del MVP y guía de uso

- `target_paths`: `README.md`, `plan/**`, setup/configuración solo si la aceptación lo requiere.
- Dependencias: `15a`, todas las pruebas críticas aprobadas.
- Aceptación: instrucciones de preparación offline, sync, permisos, backup y recuperación; checks de código completos; registrar límites reales de navegadores y decisiones revisadas; commit final del hito. Publicar solo si se ha autorizado como parte de esta entrega.

## Matriz de aceptación

| Escenario | Evidencia requerida | Entrega principal |
| --- | --- | --- |
| Modo avión y reapertura completa | Shell, recursos y datos disponibles; navegar y recargar otro mes. | `04b`, `06`, `15a` |
| Crear/editar los tres tipos sin red | Guardado local y cola sobreviven cierre. | `05`, `08`, `10` |
| Cambio de día y atrasadas | Estado conservado; completadas excluidas; historial intacto. | `07a`, `09b` |
| Recurrencia y excepciones | DST, bisiestos, día 31, corte futuro y ocurrencias pendientes. | `09`, `10` |
| Orden personal | Grupos/tareas/atrasadas; teclado; persiste y se sincroniza. | `07b`, `12b` |
| Dos dispositivos, respuesta perdida | Convergencia, ID único, sin duplicados ni sobrescritura silenciosa. | `11b–13b` |
| Cuenta diferente/ID ajeno | Aislamiento local y denegación remota, incluidas APIs y acciones. | `01b`, `03a`, `11b` |
| Compartir y revocar desconectado | Permisos, aceptación verificada, retiro y rechazo al reconectar. | `14` |
| Despliegue y migración con pendientes | Outbox intacta; versión compatible; reintento idempotente. | `04b`, `13b–13c` |
| Cuota/backup/logout | Sin falso guardado ni descarte implícito; restauración validada. | `03a`, `04b`, `13c` |

Si el alcance de una subentrega supera el presupuesto, dividirla conservando estos criterios y registrar nuevos IDs antes de empezar. No marcar “parcialmente completa” una garantía crítica de sincronización.

### 07c — Corrección intercalada de home, navegación y diálogos

- Estado: completada, secuencial; solicitada por el usuario tras `07b0`.
- Objetivo: retirar resumen redundante de home, adaptar fuente móvil y corregir apertura de `+` en desarrollo.
- `target_paths`: resumen del workspace, links de navegación, composer de tarea, confirmación compartida, fixture de workspace, evidencia y `plan/**`.
- Dependencias: `05c`, `06`, `07a`; sin cambios de contratos/persistencia.
- Aceptación: home muestra agenda directamente; etiquetas legibles a 320/390px; `+`, edición y confirmaciones abren y cierran correctamente con Strict Mode, incluidos Cancelar/Escape; crear persiste tras recarga; navegación desktop y ampliación al 200% sin desbordamiento de página.
- Validación: reproducción previa en React de desarrollo, recorrido posterior, lint/tipos/tests/build y diff. Presupuesto automático 21%/88%; se prioriza esta corrección explícita y pequeña antes de cerrar el lote, aunque el margen reforzado ya no permite otra iteración de producto.
- Resultado: bloque retirado; etiquetas completas a 320/390px, barra superior a 1280px. Diálogos operativos bajo Strict Mode; Escape/Cancelar/reapertura y creación persistida tras recarga aprobados. Texto al 200% en iframe de 310px sin desbordamiento: barra 236px, reserva 576px.
- Cierre: lint/tipos/build aprobados; 46 tests pasan, 7 auth opt-in omitidos, cero fallos. Fixture ahora monta Strict Mode y permite ampliar texto. Datos ficticios limpiados y servidor aislado detenido.

## 07d — UI móvil compacta (intercalada antes de 08c1)

- Estado: completada, secuencial; entrada automática 5h 37% / 7d 77%, tras `27db322`. Prioridad explícita del usuario. Evidencia de filas de 66px/targets de 44px, 25 intenciones verificadas offline y reflow 200% en el registro.
- Objetivo/target_paths: cards/listas/grupos de tareas, controles de estado, cabecera de Workspace y helpers UI estrictamente necesarios, fixture/evidencia y plan. Dependencias: 07b completo; sin cambios en persistencia, permisos, contratos o navegación.
- Aceptación: fila compacta con título, fecha/estado y progreso de checklist; completar/reabrir accesible directamente. Descripción, checklist, categoría, orden, editar/borrar desplegables; estado abierto y foco conservados al cambiar de grupo. Cabecera móvil sin marca/subtítulo redundantes; separación y vacíos reducidos. Grupo con orden desplegable. 320/390px, desktop y texto 200% sin desbordamiento; tap esencial >=44px, teclado, CRUD/estado/categoría/orden y recarga offline operativos. Lint/tipos/tests/build/diff/referencias.
- Corte: compactar agenda y chrome primero; formularios/categorías/ajustes se revisarán en entregas pequeñas posteriores siguiendo el criterio permanente. No reducir indiscriminadamente todos los targets táctiles.

## 07d2 — Formulario de tareas compacto

- Estado: completada, secuencial; entrada automática 5h 29% / 7d 76%, tras `2ed4ec1`. Corte menor de densidad antes del formulario de eventos; margen estimado a partir de 07d y alcance reducido, reserva 20% vigente.
- Objetivo/target_paths: TaskComposer, TaskForm, ChecklistFields, fixture/evidencia y plan. Dependencias 07d. Reducir padding, título y espaciado; campos/botones >=44px. Descripción/pasos opcionales desplegables al crear, abiertos cuando hay contenido al editar; conservar contenido al plegar y abrir si la validación señala pasos inválidos.
- Aceptación: crear/cancelar/Escape/editar siguen operativos, campos opcionales cerrados no desaparecen de FormData, errores no ocultan paso inválido, offline y recarga conservan datos; 320px y 200% sin overflow, lint/tipos/tests/build/diff/referencias. Sin cambios de contratos, outbox, navegación ni dependencias.

## 07d3 — Categorías compactas

- Estado: completada; secuencial, entrada 24%/75% tras `206fac6`, continuación explícita del usuario y reserva temporal en workflow.
- Objetivo/target_paths: TagCard/TagManager/TagForm, fixture/evidencias y plan. Dependencias 07b y criterio07d. Filas compactas con nombre/color y controles secundarios desplegables, padding/formulario reducidos, sin texto redundante.
- Aceptación: crear/editar/borrar, ordenar por botones y arrastre siguen accesibles; detalle abierto conserva foco al reordenar, 320px/200% sin overflow, pulsaciones >=44px. Prueba offline y recarga; lint/tipos/tests/build/diff/referencias. Persistencia/contratos/permisos/navegación intactos.

### 08c1a — Selección de eventos por día y rango

- Estado: completada, secuencial; entrada automática17%/74% tras6216981. Rama actual `int` observada al commit anterior; no se ha cambiado por el agente.
- Objetivo/target_paths: helpers puros de selección de eventos y tests, plan. Dependencias08a–08b. Corte previo a UI: día/rango y orden cronológico sin expandir recurrencias, ni enumerar rangos infinitos.
- Aceptación: todo el día usa fechas civiles/final exclusivo; temporizados aparecen en días de la zona de la cuenta según instantes, cruces de medianoche y DST, fin nulo, fin exacto medianoche; eventos inválidos históricos identificados sin ocultar válidos, exclusión de tombstones y series pendientes; IDs/orden deterministas, rangos/zonas validados. Consulta civil inclusiva de1–62días para incluir31/12/9999 sin inventar año10000; programas all-day mantienen fin exclusivo. Lint/tipos/tests/build/diff/referencias, sin UI/DB/contrato/dependencia nuevos.

### 08c1a2 — Reutilizar el formateador temporal por consulta

- Estado: completada, secuencial; entrada13%/73% tras3667c97 y push verificado aorigin/int. Corte mínimo previo a UI, sin confiar en renovación.
- Objetivo/target_paths: factory de resolver en zoned-time, selector de eventos, test de equivalencia y plan. Dependencias08c1a. Diagnóstico:12eventos/rango mensual24ms frente a31consultas independientes5161ms; cada minuto construye Intl.DateTimeFormat nuevo.
- Aceptación: un formateador por consulta/zona, sin cache global ni política de offsets elegida; mismos candidatos normales/históricos/gaps/repeticiones, no mezclar zonas al reutilizar. Medir mismo fixture, lint/tipos/tests/build/diff/referencias, commit+push int. No conectar contadores aún; preparación mensual sigue siendo corte siguiente.

### 08c1b0 — Snapshot mensual de eventos

- Estado: completada, secuencial; int, entrada100%/73% después de renovación confirmada y071a2c4 publicado.
- Objetivo/target_paths: selector/calendar snapshot y tests, hook local de eventos, plan. Dependencias08c1a2. Preparar programas y resolver de cuenta una sola vez, compartir cache local entre consultas de las celdas, entregar contadores/listado sin reparse por render. Sin estado global o petición por celda.
- Aceptación: mismo resultado de consultas aisladas, rango1–62días/fechas extremas, casos DST/Apia/rollback/legado preservados, eventos simples una vez por día aunque cruce medianoche. Hook separado por account+epoch y lector validado. Medir12eventos mensual; lint/tipos/tests/build/diff/referencias, commit+push int. Sin UI aún.

### 08c1b1 — Crear y ver eventos en agenda/calendario

- Estado: completada; int secuencial, entrada97%/72% tras05ce7fd y renovación. Scope antes de editar: EventForm/Card/List/Agenda/hooks de calendario, creación compartida Workspace (+), CalendarBoard/MonthGrid y registry copy, fixture/evidencia/tests pertinentes y plan. Dependencias08b,08c1b0,07d.
- Objetivo: selector de tipo desde+, Tarea y Evento o cita operativos; evento simple todo el día o hora/fin opcional/zona, descripción opcional; elegir otra hora ante gap/repetición. Leer en día/mes y próximas2semanas de home, cronología, categoría personal tras guardar mediante mismo selector de tareas. Actualizar copy de destino Calendario en ambas barras, sin nueva pantalla ficticia.
- Aceptación: crear/cancelar/Escape/cambiar tipo conserva campos, una intención por evento y datos sin red/recarga; errores españoles y foco, horas inexistentes/ambiguas rechazadas; all-day final exclusivo explicado mediante última fecha inclusiva en UI; medianoche/zonas/contadores correctos; categorización separada atómica, no falso guardado conjunto. Compacta320/390px/200% y escritorio, targets>=44px; no esconder tareas si falla eventos. Lint/tipos/tests/build/diff/referencias, commit+pushint.
- Corte: editar/borrar evento después en08c2; recurrencia/cumpleaños siguen09–10. No activar esas opciones anticipadamente, sin cambios de core/deps/auth/remoto.

- Resultado08c1b1: selector conserva borradores, eventos simples guardados y leídos sin red, categoría personal reutilizada, contadores5/1 y fin a medianoche exclusivo comprobados. Filas52px a320px, iframe280px/texto200% sin overflow horizontal del diálogo, navegación superior1280px. 79tests pasan/7auth opt-in omitidos; lint/tipos/build aprobados. Edición/borrado siguen08c2.

### 08c2 — Editar/borrar y reparar eventos

- Estado: completada; int secuencial, entrada84%/70% tras08705cc publicado y Vercel success. Dependencias08b,08c1b1. Scope antes de editar: EventForm/Card/List, EventComposer/acciones/borrado, fixture de conflicto/legado y plan/evidencias/tests pertinentes.
- Objetivo: editar programa/descripcion/título con snapshot esperado; borrar solo tras confirmación; reparar o borrar legado ambiguo/inexistente desde lista explícita. Reutilizar confirmación compartida y formulario compacto, sin controles nuevos en filas plegadas.
- Aceptación: editar todo el día/timed/fin opcional/zona conserva valores y final inclusivo; cambio a all-day conserva descripción; calendario/agenda revalidan al guardar, borrar usa tombstone/intención única y no pierde categoría ni tarea. Cancelar/Escape no escribe. Edición/borrado con expected antiguo falla sin sobrescribir otra pestaña y mantiene datos; reparación legado no requiere reinterpretarlo para abrir formulario. Offline/recarga,320px/200%/desktop, lint/tipos/tests/build/diff/ref, commit+pushint y cuotas al cerrar.
- Límites: simples, no recurrencia ni birthday; mutaciones atómicas08b se reutilizan sin cambios de schema/DB/deps/auth/remoto. Lector conserva legado; no migración automática destructiva.

- Resultado08c2: formulario edición/confirmación operativos, reparación/borrado de legado y CAS en dos pestañas; caché revalidada tras rechazo conservando borrador. Inspector16intenciones/7updates/2tombstones, tarea y categoría intactas; recarga sin servidores y contadores2/1; desarrolloStrictMode,320px y200% sin overflow. Lint/tipos/build/79tests+7skip aprobados; próxima09a.

### 09a1 — Fechas civiles de recurrencia paginadas

- Estado: completada; int secuencial, entrada71%/68% trasfe47801 publicado. Dependencias08; scope antes de editar: lib/calendar/recurrence.ts y tests, schema de consulta compartido si necesario, plan. Corte de09a: fechas civiles primero; proyección de eventos/ocurrencias y DST después09a2, UI09b–09c.
- Decisiones: días semanales0domingo–6sábado, semanaslunes; intervalo semanal anclado a semana del inicio, primera semana omite días anteriores al ancla. Until inclusivo; count cuenta fechas programadas válidas (meses sin31 y años sin29feb se omiten, no consumen count). Rango de consulta inclusivo0001–9999, cursorfecha exclusivo, límite1–500 y nextAfter explícito cuando quedan resultados; no truncado silencioso.
- Aceptación: diaria/semanal/mensual/anual conintervalo/límites, no mutar regla ni depender de zona host; ancla/cadencia estables al consultar páginas o fechas lejanas; count global no se reinicia por rango/página; calendario31/bisiestos/centurias y años extremos. Saltar directamente a rango, sin recorrer millones de días; prefixcalendar400años solo donde haga falta, trabajo acotado. Tests ejemplos+oráculo independiente/paginación, medir rango remoto; lint/tipos/tests/build/diff/ref y commit+pushint.
- No materializar ocurrencias/activar repetición todavía; contrato de series actual intacto, sin DB/deps.09a2 resolverá slots/IDs y problemas horarios explícitos, sin normalizar una cita silenciosamente.

- Resultado09a1: cuatro frecuencias paginadas, count global/ciclo400años/oráculo independiente192combinaciones y hostTZHonolulu aprobados. Cien consultas0001→9999 con página3:13ms observados. Lint/tipos/build,86tests+7skip; siguiente09a2 slots/ocurrencias, sin UI nueva.

### 09a2 — Proyección pura de ocurrencias y problemas horarios

- Estado: completada; int secuencial, entrada67%/68% tras4b1aa2a publicado. Dependencias09a1/08a; scope antes de editar: lib/calendar/occurrences.ts/tests, esquemas/tipos compartidos existentes solo si necesario y plan.
- Objetivo: página de slots originales con IDseriesId:slotKey; tareas empiezan sin empezar/checklistcopia no completada, eventos all-day conservan longitudcivil; timed desplaza fecha de inicio y final el mismo número de díasciviles, conservando ambas horas locales/zona (duración exacta puede variar porDST).
- Decisión: limit/count cuentan slots de fechas civiles, aunque un horario resultegap/fold; devolver issueconID/slot/reason, no normalizar ni sustituir porotrafecha. nextAfter sigue la página de slots aunque todos fallen. Query se refiere a fechas de inicio en zona de serie; selección por zona de cuenta/solapes será integración09c. Cumpleaños y excepciones/materialización09b–10 posteriores.
- Aceptación: IDs/páginas deterministas, tareaestado/checklist independientes sin mutar padre ni otraaparición; medianoche/duracióncivil/DSTsin24hfijo; gaps/folds/fin inválido y desbordamiento9999 explícitos con IDs conservados y otrasapariciones válidas; count/cursor no duplican slots; tombstonepadre vacío, schemas/zonas/extremos validados. Tests/hostTZalterno/lint/tipos/build/diff/ref, commit+pushint, cuotas. Sin UI/mutaciones nuevas ni deps/DB.

- Resultado09a2: IDs/metadata/checklist independientes, extremos/gaps/folds/Apia y endpointsDST/cursor comprobados;91tests+7skip, hostHonolulu, lint/tipos/build aprobados. Página500timed:269ms observados, sin expandir más slots que el límite. Siguiente09b1 ejecutor local para estado/excepciones de tareas.

### 09b1 — Progreso atómico por aparición de tarea

- Estado: completada; int secuencial, entrada65%/67% tras7b1b8f9 publicado. Dependencias09a2/03b/05b1; scope antes de editar: local-db/occurrence-progress y occurrence-outbox, routerLocalOutbox existente, servicio de progreso si necesario, tests puros/IndexedDB fixture+script y plan.
- Corte: estado/checklist de aparición; edición/reprogramación/cancelación en09b2 y lectura/formulario en09b3+. Reutilizar task.set-status/task.set-checklist-entry con occurrenceId no nulo, crear excepción al primer cambio dentro de misma transacción que cola/secuencia. No comando nuevo ni UI anticipada.
- Decisión: entityKey item:seriesId y baseRevision de serie mantienen protocolo agregado existente; dependencias serializan creación/edición/progreso de la serie. El registro padre no cambia localmente al cambiar progreso; revision de excepción conservada. Remoto11–12 deberá publicar/aplicar excepciones junto con revisión agregada, sin afirmar sync ahora.
- Aceptación: validar propiedad/serie activa/ID de slot civil y pertenencia al generar primera excepción, las existentes conservan su checklist/historia aunque la plantilla futura cambie; canceladas/tombstones no admiten progreso. Intenciones por campo sobre registroactual preservan otros campos, completedAt/reapertura correctos, sin afectar otrasapariciones/padre. Replay antes de guardias, mismoUUID/command idempotente y payload distinto rechazado; fallo outbox revierte excepción/secuencia, aislamiento/recarga y cola/despendencias. Tests/IndexedDB real/lint/tipos/build/diff/ref, commit+pushint y cuotas. Sin DBversion/index/deps/auth nuevo.

- Resultado 09b1: tres apariciones con progreso independiente y siete intenciones consecutivas sobreviven recarga; replay, aislamiento, CAS y rollback de primera materialización comprobados en IndexedDB real. Regresión de outbox y eventos con recarga aprobada; 93 tests pasan, 7 auth opt-in omitidos, lint/tipos/build aprobados. Siguiente 09b2: editar/reprogramar/cancelar una aparición con identidad original.

### 09b2 — Editar, reprogramar y cancelar una aparición de tarea

- Estado: completada; `int`, secuencial, entrada 5h 56% / 7d 66% tras 5448f71 publicado. Dependencias 09b1. Scope previo: schemas occurrence/sync y tipos de comandos, motor/guardia de apariciones y transacción existentes, LocalOutbox, tests puros/fixture IndexedDB/script y plan.
- Corte: comandos task.update-occurrence/task.cancel-occurrence con ejecutor atómico; solo una aparición de tarea. Eventos y separación futura siguen 09c, lectura/UI 09b3+. No habilitar controles antes de lectura/orden compatibles.
- Modelo: contenido opcional {title, description} en excepción de tarea, compatible con registros antiguos sin ese campo; materializar congela contenido heredado. Checklist editada recibe IDs/textos, conserva completado de IDs existentes y empieza nuevos false; estado/completedAt se cambian únicamente con comandos de progreso. Reprogramar conserva ID y slot original. Cancelar conserva todo el registro y marca cancelled; no borrado físico.
- Aceptación: progreso/otras apariciones/padre intactos; primera edición/cancelación genera excepción válida. Comandos estrictos no admiten cambiar status/kind/serie/regla/identidad; expectedItem y expectedOccurrence obligatorios para edición/cancelación, comparados dentro de transacción con snapshot virtual o persistido. Editor obsoleto, slot falso, otra cuenta, cancelada/borrada rechazan sin escrituras; replay previo devuelve recibo. Rollback revierte excepción y secuencia, dependencias agregadas como 09b1; recarga/IndexedDB real, regresión progreso, lint/tipos/tests/build/diff/ref, commit+push int y cuotas.

- Resultado 09b2: edición/reprogramación/cancelación con CAS de padre y aparición, contenido compatible, progreso conservado y replay/rollback verificados. Cinco checks IndexedDB y nueve intenciones sobreviven recarga; regresión de progreso aprobada. Lint/tipos/build, 96 tests y 7 auth opt-in omitidos; siguiente 09b3a, lectura pura paginada de tareas con excepciones.

### 09b3a — Lectura paginada de tareas repetidas con excepciones

- Estado: completada; `int`, secuencial, entrada 50%/65% tras 852266f publicado. Dependencias 09b2. Scope antes de editar: lector puro/index de tareas repetidas y tests, schemas de consulta compartidos y plan. Sin UI/DB/mutaciones nuevas.
- Objetivo: snapshot de series y excepciones de una cuenta; proyección paginada de slots virtuales por serie y página independiente de excepciones ordenadas por fecha efectiva/ID. Toda excepción suprime su slot virtual, incluso cancelada/borrada o reprogramada fuera del rango; una movida desde otro mes entra por su fecha efectiva y conserva ID. Contenido antiguo sin content hereda padre.
- Decisión: dos flujos con cursors propios, porque materializadas pueden estar fuera del rango original y su fecha puede cambiar. Una página virtual consume slots, no solo pendientes: páginas vacías con nextAfter siguen explícitamente hasta agotar backlog. Excepciones paginadas con cursor compuesto fecha+ID; quien integre debe agotar ambos flujos y ordenar resultados visibles, sin resetear el otro cursor ni declarar atrasadas completas tras la primera página. Corte siguiente lector IndexedDB/hook, después orden/UI.
- Aceptación: propiedad/series activas, canceladas/tombstones/orphans excluidos; excepciones históricas sobreviven cambios de regla/plantilla; duplicados/mismatch de identidad rechazados. Consultas civiles 0001–9999/límite 1–500, completar excluye solo cuando includeCompleted=false; contenido/checklist/progreso no mutados, una aparición nunca duplicada entre flujos. Paginación cuenta global y continúa por largas series completadas/canceladas, ejemplos reprogramadas/extremos y tests; lint/tipos/build/diff/ref, commit+push int/cuotas.

- Resultado 09b3a: dos flujos sin duplicados, fechas efectivas/legacy/historia, cursores y páginas vacías comprobados; consultas de excepciones usan índice preparado y búsqueda binaria, sin recorrer completadas en cada página. Cinco tests/56 aserciones y host Honolulu pasan; suite 101 pass/7 skip, lint/tipos/build aprobados. Cien consultas remotas de diez apariciones: 17ms observados; siguiente 09b3b snapshot IndexedDB.

### 09b3b — Snapshot local coherente para tareas repetidas

- Estado: completada; `int`, secuencial, entrada 46%/64% tras 7af654e publicado. Dependencias 09b3a. Scope previo: local-db/task-snapshot, servicio features/tasks/local-recurring-tasks, fixture IndexedDB y script, plan. Sin UI/hook anticipado ni nuevas mutaciones/DB version/índices/dependencias.
- Objetivo: leer items, occurrences (incluidas canceladas/tombstones) y settings en una única transacción readonly. Validar registros y settings propios/activos; resolver solo al complete. Servicio verifica cuenta+epoch antes/después, cierra conexión en finally y devuelve índice preparado y zona, sin red.
- Aceptación: no filtrar tombstones antes del índice (suprimen slots); concurrente snapshot refleja un estado completo anterior/posterior, nunca registros mezclados. Cuenta ajena/epoch obsoleto y settings inválidos/ausentes fallan; apertura repetida/recarga no encola comandos. Error de schema no expone resultado parcial. IndexedDB real, aislamiento/recarga/concurrencia/guardias, lint/tipos/tests/build/diff/ref, commit+push int/cuotas. Después 09b4 colocaciones por aparición antes de integrar UI.

- Resultado 09b3b: snapshot de tres stores validado al complete, servicio con doble guardia y finally. Concurrencia real devuelve generaciones 1/2 completas; corrupción, settings borrados/ausentes, cuenta/epoch y cierre durante lectura rechazan. Canceladas/tombstones suprimen slots tras recarga; no se añaden intenciones. Lint/tipos/build/101 tests + 7 skip aprobados. Siguiente 09b4a: colocaciones de apariciones en un día, separadas de backlog.

### 09b4a — Colocaciones mixtas en el día

- Estado: completada; `int`, secuencial, entrada 39%/63% tras d5082cc publicado. Dependencias 09b3b. Scope previo: planner de movimientos del día y helper de ranks compartido, tipos estructurales de orden, task-move-outbox/snapshot, schema de vecinos, tests/fixture/script y plan. Sin UI, dependencias ni DB version nuevos.
- Objetivo: mover dentro de un día tareas simples y apariciones (virtuales o reprogramadas), con vecinos mezclados y ranking atómico; guardar solo colocaciones/preferencia/cola, sin materializar progreso ni alterar padre/otras fechas. Leer excepciones en misma transacción. Backlog de apariciones queda explícitamente rechazado hasta 09b4b.
- Decisión: categoría personal pertenece al elemento/serie como ItemView existente. Cambiar categoría mediante aparición cambia la categoría de la serie; las demás apariciones de esa serie en ese día pertenecen al nuevo grupo y entran al cálculo. La futura UI lo indicará como categoría de serie; no inventar un override distinto por aparición. Orden sí tiene identidad de aparición+scope+date propia.
- Aceptación: grupo completo del día proyectado sin expandir historia; todas las excepciones de ese día recuperadas por páginas, sin truncar a500. ID/fecha efectiva y vecinos/categorías activos validados dentro de transacción; canceladas/borradas/otra cuenta y editores de día obsoleto rechazan. Ranks/compactación/revisión personal/replay/rollback/dependencias conservados; schema admite vecinos de aparición para mover una simple y exige identidades distintas. Regresión simples/day/overdue, IndexedDB real/recarga, lint/tipos/tests/build/diff/ref, commit+push int/cuotas.

- Resultado 09b4a: vecinos mixtos, identidad/fecha efectiva/categoría de serie y grupo de 502 apariciones comprobados; transacción solo escribe preferencias/colocaciones/cola. IndexedDB: nueve intenciones/recarga/rollback/replay/cancelación/aislamiento; regresión simple conserva ocho colocaciones y dieciséis operaciones. Lint/tipos/build, 104 tests + 7 skip aprobados; siguiente 09b4b, orden de backlog de apariciones.

### 09b4b1 — Resolver referencias activas sin expandir backlog

- Estado: completada; `int`, secuencial, entrada 31%/62% tras 6ea331b publicado. Dependencias 09b4a. Corte de 09b4b previo a ranking de backlog. Scope: lib/calendar/task-reference, tests, guardia del planner del día y plan. No habilitar movement overdue de apariciones ni UI/hook nuevos.
- Objetivo: índice validado de padres/excepciones de cuenta, resolver UUID simple o UUID:slot civil en consulta de una fecha; heredada virtual se genera solo para ese slot. Excepciones históricas/reprogramadas conservan su identidad/progreso aunque la regla futura cambie. Reusar resolver en target del día antes de proyectar peers.
- Aceptación: padre recurrente no es tarea ejecutable; otra cuenta/cancelada/borrada/orphan no se resuelve, slot falso fuera de count/cadencia devuelve ausencia. Input corrupto/ID mal formado/duplicados rechaza; devuelve copias sin mutar snapshot. Fechas lejanas/extremos y reprogramación, regresión día/orden y tests, medir consultas sin expansión histórica; lint/tipos/build/diff/ref, commit+push int/cuotas. Próximo 09b4b2 tendrá que resolver adyacencia y ranks del backlog con límites explícitos; no sustituir grupo completo por página cargada silenciosamente.

- Resultado 09b4b1: referencias propias activas, copias e historia/identidad comprobadas; lookup único sin expandir intervalo. Guardia del día reutiliza resolver y comprueba identidad simple/aparición. Tres tests/27 aserciones, regresión IndexedDB de orden mixto y recarga; lint/tipos/build/107 pass + 7 skip aprobados. Mil referencias9999 desdeancla0001:116ms observados. Siguiente09b4b2, adyacencia/ranks del backlog paginado.

### 09b4b0 — Diseño y cierre del lote antes de ordenar backlog

- Estado: completada; documental secuencial, `int`, entrada28%/61% después de7c8dc42. Scope previo: plan/backlog-ordering.md, master/iterations/workflow/log/reordering. Dependencias09b4b1; sin código ni cambios de datos/contratos.
- Objetivo: documentar problema real de ranks explícitos/implícitos, opción acotada a validar y subentregas para evitar expandir historia o mover slots no cargados silenciosamente. Registrar cierre: últimas entregas comparables de código consumieron7/8 puntos de5h; ocho puntos sobre reserva no cubren siguiente cambio de orden+paginación+persistencia con incertidumbre y margen de reparaciones.
- Aceptación: opciones/propuesta y decisiones no validadas claramente separadas del comportamiento entregado; casos de adyacencia/legado/snapshot/paginación/extremos; pasos concretos y rollback completo antes deUI. Enlaces/diff/consistencia, commit+push int y cuotafinal. No iniciar implementación09b4b2 en este lote.

- Resultado09b4b0: problema de ranks observado documentado, alternativas/propuesta no validada y cuatro cortes definidos, sin schema/código abiertos. Referencias/consistencia/diff comprobados; cierre en commit+push int, cuotas finales al usuario. Próxima09b4b2a con presupuesto renovado suficiente.

### 09b4b2a1 — Compatibilidad del orden numérico en claves textuales

- Objetivo: primer corte puro de09b4b2a, representar el orden legado de posiciones sin pérdida de precisión. Entrada23%/61%, secuencial enint, solicitud expresa de una entrega pequeña.
- `target_paths`: `src/lib/ordering/legacy-rank-key.ts`, su test y `plan/{master,iterations,iteration-log,backlog-ordering}.md`. Depende de09b4b1 y del comparador actual `compareRank`; guía instalada use-client revisada, helper independiente de runtime.
- Aceptación: comparación binaria de claves coincide con el comparador numérico y su desempate por ID; negativos, fracciones adyacentes, subnormales, ±0, límites±1e12 y posiciones iguales. Rechazar posiciones inválidas; clave con prefijo fijo y sin mutar input. Contrastar contra oráculo de registros deterministas. Solo adaptador candidato, sin schema, migración, integración ni formato definitivo de inserción.
- Validación: tests del helper y suite completa, lint, tipos, build, diff/referencias; actualizar resultado y registro, commit/push int. Restan clave implícita, inserción/agotamiento y adyacencia antes de ordenar backlog o habilitar UI.

- Resultado: cuatro tests/1.306 aserciones, oráculo determinista de2.112 registros y extremos/desempates aprobados; lint211 archivos, tipos y suite111 pass/7auth opt-in skip/0fallos. Adaptador candidato aislado; formato persistido y comportamiento UI intactos. Build y cierre registrados eniteration-log. Próximo corte09b4b2a continúa con clave implícita/inserción y agotamiento; este resultado no adopta el formato definitivo.

### 09b4b2a2 — Clave implícita compatible de tareas

- Objetivo: representar el orden sin colocación por fecha efectiva/creación/ID, siguiente corte puro tras09b4b2a1. Entrada21%/60%, petición explícita de otra entrega mínima; secuencial enint, protocolo interactivo.
- `target_paths`: `src/lib/ordering/default-task-key.ts`, su test y `plan/{master,iterations,iteration-log,backlog-ordering}.md`. Depende del comparador vigente y adaptador legado; guía instalada use-client ya revisada, sin APIs nuevas de Next ni runtime/IO.
- Aceptación: clave determinista/copia implícita sin persistir, comparación binaria equivalente a `compareDefaultTaskOrder`, años0001/9999, desempates y reprogramación manteniendo ID; validar campos con schemas compartidos. Oráculo mixto contra `orderPlacedTasks` usando prefijos candidato para colocadas/implícitas. Sin cambio de schema/formato persistido/consumidores; inserción y agotamiento siguen pendientes.
- Validación: tests y suite, lint/tipos/build, diff/referencias; plan/registro y commit/push int. Cerrar después de este corte y consultar ambas ventanas.

- Resultado: clave implícita validada y equivalente al comparador, cuatro tests/2.036 aserciones y oráculo mixto45 tareas/15 colocaciones aprobados. Lint213 archivos, tipos y suite115 pass/7auth opt-in skip/0fallos; build y cierre enregistro. Sin integración/migración ni adopción del formato; próximos pasos inserción/agotamiento, después adyacencia paginada y ejecutor.

### 11a1b2 — Reductor de elementos compartido

- Objetivo previo: extraer las reglas ya probadas de mutación local a un módulo puro importable por cliente y servidor, sin duplicar reglas ni cambiar revisiones optimistas. Entrada84%/55%, int/secuencial/reserva10%; dependencias03b/08b/11a1b1.
- `target_paths`: `src/lib/calendar/item-command.ts`, `src/lib/local-db/item-mutation.ts` y su test, `src/types/{sync,local-sync}.ts`, `plan/{master,iterations,iteration-log}.md`.
- Aceptación: crear mantiene revision0; editar/progreso/borrado conservan revisión remota, propiedad, identidad, historial completedAt y reglas de eventos. Reutilizar tests de reglas sobre módulo compartido y mantener wrapper cliente para consumidores existentes. Sin Mongo/auth/Next en módulo puro; sin cambio de protocolo, persistencia o UI.
- Validación: suite existente/lint/tipos/build/diff/referencias, plan/registro/commit+pushint y cuotas. Después11b1 aplica el reductor dentro de recibo+mutación+journal atómicos, con límites explícitos de soporte.

- Resultado11a1b2: reductor puro compartido, wrapper local compatible y tipoItemCommand genérico; regresiones locales y eventos pasan sin cambio de semántica/revisión. Suite123pass/17opt-in skip, lint224files/tipos/build29recursos aprobados; sin IO ni UI nuevos. Siguiente11b1 transacción remota.

### 11b1a — Recibo, mutación y journal remotos atómicos

- Objetivo previo: ejecutar comandos de tareas/eventos simples propios con CAS, recibo idempotente y secuencia durable por receptor en una misma transacción. Entrada82%/55%, int/secuencial/reserva10%; depende11b0/11a1a2/11a1b1–2.
- `target_paths`: `src/lib/db/{remote-items,remote-item-commands,collections,ensure-indexes}.ts`, tests DB asociados, `src/schemas/remote-sync.ts`, `src/types/remote-sync.ts`, runner y `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: actor validado recibido solo por futura capa autenticada; ninguna identidad/metadato de propietario en comando cliente. Mismo actor+operationId devuelve resultado guardado sin duplicar; payload distinto rechazado. CAS inválido/conflicto y ID ajeno no sobrescriben ni filtran datos; comandos recurrentes/cumpleaños/preferencias no soportados nunca aceptados. Revision/recibo/journal/contador commit o rollback conjuntos. Secuencia por receptor serializa commits; índices únicos reales registrados, sin TTL.
- Pruebas MongoDB propio: reintentos concurrentes, dos editores/base igual, múltiples escrituras/destinatarios aislados, pérdida de respuesta/replay tras tombstone, reutilizaciónID, fallo tardío forzado sin restos y posterior recuperación. Suite/lint/tipos/build/diff/ref; plan/registro/commit+pushint/cuotas. Acción autenticada y descarga siguen en cortes posteriores, sin habilitar sync UI.

- Resultado11b1a: transacción snapshot/majority, recibos propios/huella, CAS/revisión y journal+contador serializado; seis tests nuevos enMongo real, runner12pass/82aserciones y recursos limpios. Normal124pass/25opt-in skip, lint228files/tipos/build29recursos pasan. Siguiente11b1b acción autenticada; no subida automática/UI activada.

### 11b1b — Acción autenticada de subida limitada

- Objetivo previo: exponer ejecutor11b1a mediante Server Action, obteniendo actor exclusivamente de sesión persistida vigente; validar lote completo antes de la primera escritura. Entrada79%/55%, int/secuencial/reserva10%; dependencias11b1a/01b/contrato03b.
- `target_paths`: `src/features/sync/{actions,push-batch,push-batch.test}.ts`, `src/schemas/remote-sync.ts` y tipos si necesario, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: sin sesión no ejecutar ni aceptar actor cliente; lote inválido/duplicado/excesivo falla antes de mutar. Orden secuencial por operación; resultados explícitos, ID reutilizado no acepta y fallo transitorio conserva prefijo aplicado para reintento idempotente. Comandos sin soporte se mantienen pendientes; no arranque automático de envío ni mutación IndexedDB hasta reconciliación.
- Validación: pruebas del servicio con dependencia de sesión/ejecutor controladas (no sustituyenMongo real11b1a ni loginGoogle piloto), suite/lint/tipos/build/diff/ref; plan/registro/commit+pushint/cuotas. Después descarga consistente y reconciliación local antes de coordinador.

- Resultado11b1b: acción obtiene sesión persistida sin caché/refresh yactor exclusivo; lote entero validado antes de ejecutor, secuencial, identidad reutilizada explícita y prefijo durable tras fallo. Cinco tests del servicio, suite129pass/25opt-in skip, lint231files/tipos/build29recursos pasan. No coordinador/ACK local todavía; siguiente11c1 descarga propia porjournal.

### 12a1 — Descarga propia paginada con checkpoint de journal

- Objetivo previo: leer cambios propios por secuencia hasta un checkpoint fijo, incluido bootstrap desde0; corte de12a tras11b1b (candidata antes llamada11c1). Entrada77%/54%, int/secuencial/reserva10%.
- `target_paths`: `src/lib/db/remote-changes.ts`/test integración, `src/features/sync/pull-response.ts`/test, `src/app/api/sync/changes/route.ts`, schemas/tiposremote-sync, runner y `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: actor de sesión porrequest, query estricto/cursor entero/limit1–100, página privada no-store sin datos ajenos. Capturar through decontador en snapshot; siguientes páginas conservan through y cambios posteriores esperan siguiente pasada. Contigüidad verificada, corrupción/huecos/cursor futuro rechazan sin avanzar. Revalidar propiedad actual para cada payload histórico, tombstones incluidos.
- Decisión: primer bootstrap reconstruye el estado reproduciendo journal durable desde0 hasta through; evita snapshot móvil y mantiene todas las versiones mientras no haya compactación. Todas las escrituras de producto deben pasar por11b1a; documentos preexistentes sinjournal exigirían migración antes de activar sincronización. Preferencias/compartidos todavía sin soporte.
- Pruebas Mongo real: checkpoint bajo ediciones/borrado/nuevos elementos durante páginas, siguiente pasada recupera posteriores; otroactor, cursorfuturo, hueco/corrupción y permisoactual denegado no entregan página parcial. GETtests401/400/no-store/sesión/500 sin detalles. Suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas; reconciliación/coordinador después.

- Resultado12a1: GETprivado/actor de sesión/query limitado, checkpoint decontador y secuencias contiguas en snapshot; bootstrap desdejournal0 y replay posteriores preservan todos los cambios. Mongo15pass/105aserciones, normal133pass/30opt-in skip, lint236files/tipos/build29recursos pasan. Siguiente12b1 reconciliación IndexedDB; no convergencia de dispositivos anunciada.

### 12b1a — Proyección conservadora de cambios con trabajo pendiente

- Objetivo previo: helper puro para decidir shadow/vista al recibir un elemento remoto, conservando la proyección local mientras existan intenciones sinACK. Entrada75%/54%, int/secuencial/reserva10%; dependencias12a1/03b.
- `target_paths`: `src/lib/sync/item-projection.ts` ytest, `src/schemas/item-projection.ts`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: validar cuenta/identidad/registros/cola de entidad; shadow solo avanza revisión, igualdad concontenido distinto falla, respuesta vieja no regresa metadata. Sin pendientes adoptar remoto/tombstone; conpendientes conservar local íntegro (incluidas series no soportadas) y guardar remoto separado. ACK porUUID de journal no se presume; recibo/payload verificado precederá confirmación. Sin escrituras IndexedDB ni modificación de cola aún.
- Decisión conservadora: pull no reaplica automáticamente una intención sobre cambios remotos concurrentes ni sobrescribe su borrador. Vista local existente representa intenciones acumuladas; shadow conserva remoto para resolver/reconciliar posteriormente. Cortes siguientes: recibos/ACKatómico, cursor/pullatómico, preparación de revisión de envío congelada ycoordinador.
- Validación: oráculos de ediciones/crear/borrar local, replay/viejas/misma revisión contradictoria, foreign/corrupt/no identidad, input sinmutar; suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas.

- Resultado12b1a: planner puro valida cuenta/identidad/cola y conserva optimismo sinACK, shadow monotónico y replayigual; cuatro tests/26aserciones, normal137pass/30opt-in skip, lint239files/tipos/build29recursos pasan. No persistencia/cursor/ACK nuevos; siguiente12b1b confirma recibos e intenciones localmente.

### 12b1b — Resultado de envío y ACK local atómicos

- Objetivo previo: persistir resultado ligado a operación ylease vigentes, estadooutbox, shadow/proyección y base de dependientes juntos. Entrada73%/54%, int/secuencial/reserva10%; dependencias12b1a/11b1b/03b.
- `target_paths`: `src/lib/local-db/sync-store.ts`, `src/schemas/local-sync.ts`, `test/browser/sync-results.ts`, whitelistserverfixture y `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: verificar operación enviada completa/actor/ID/revisión/lease, respuesta obsoleta no escribe; replay deACK devuelve resultado persistido sin cambiar. Applied confirma solo suintención, conserva ediciones posteriores ypropaga revisión exclusivamente a dependientes directos nunca enviados (attempts0). No alterar payload ya enviado/reintentos congelados. Conflicto/rechazo conservan local/base/intención para recuperación; unsupported vuelvependiente, noACK. Cursor no avanza porunACK. Resultado/shadow/vista/cola/metadata commit o rollback conjuntos; sin cambioDBversion/deps.
- Validación browserIndexedDB propio: creación+edición posterior, claims dependientes, replay/cambio de payload/stalelease/cuenta, conflicto/rechazo/unsupported, fallo tardío metadata revierte todo, recarga. Suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas. Después12b1c pull/cursoratómicos y coordinador.

- Resultado12b1b: LocalSyncStore verifica operación/lease/cuenta/revisión ypersistencia conjunta de resultado/outbox/shadow/vista; dependientes nunca enviados reciben base deACK, reintentos congelados. Siete checks browser+recarga pasan, rollback tardío/cursor intacto; normal137pass/30opt-in skip, lint241files/tipos/build29recursos pasan. Próxima12b1c pull/cursor; sin coordinador todavía.

### 12b1c — Pull, shadow y cursor locales atómicos

- Objetivo previo: guardar página de cambios ycursor en misma transacción, con checkpoint fijo y proyección conservadora. Entrada68%/53%, int/secuencial/reserva10%; dependencias12a1/12b1a–b.
- `target_paths`: `src/lib/local-db/{sync-store,pull-changes}.ts`, `src/schemas/local-sync.ts`, tiposlocal-sync si necesario, `test/browser/sync-pull.ts`, whitelistserverfixture y `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: validar cuenta, secuencias contiguas desdeafter ycheckpoint; cursor local CAS, páginas viejas no regresan, futuras/solapadas no saltan. Agrupar últimas versiones porID; conservar local conpendientes yshadowmonotónico incluso ante ACKmásnuevo. Página no confirma outbox aunque coincida operationId. Datos/shadows/cursor se confirman o revierten juntos; sinnetwork/await dentroIDB, sin borrar bases/cola. Persistircheckpoint para reabrir y continuar bootstrap; sinDBversion/deps nuevos.
- Validación IndexedDB real: páginas/checkpoint/recarga, tombstones, ACKadelantado ypendingcreate/edits, malformed/foreign/gap/futurecursor, fallo tardío metadata revierte todo, dos respuestas delmismoafter compiten seguras. Suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas; coordinador después.

- Resultado12b1c: cursor CAS/checkpoint durable, páginas contiguas/pliegue porID/proyección pendiente yshadow monotónico; seis checks IndexedDB+recarga pasan, rollback tardío y dos respuestas seguras. Normal137pass/30opt-in skip, lint243files/tipos/build29recursos pasan. Próxima12b2a coordinador; sin sync automática aún.

### 12b2a1 — Protección ante cambio de cuenta durante el envío

- Objetivo previo: cerrar carrera entre consulta de identidad y subida cuando sesión cambia deA aB; expectedUserId es afirmación de coherencia, nunca fuente de autorización. Entrada64%/52%, int/secuencial/reserva10%; dependencias11b1b/12b1c. Corte previo al coordinador12b2a2.
- `target_paths`: `src/schemas/remote-sync.ts`, `src/features/sync/push-batch.ts` ytest, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: actor exclusivamente de sesión vigente; inputestricto esperado ybatchvalidado, expectedUserId distinto devuelveaccount_changed sin ejecutar ni filtrar sesión actual. Inputsin expected oconactorinyectado rechazado; cuenta coincidente conservaorden/resultados. Cambio no borra ni confirma intenciones. Se cambia contrato preparado todavía sinconsumidorUI para hacerla comprobación indivisible respecto al actor usado enmutación.
- Validación servicio: simular sesiónB ypayloadA (cero escrituras), match ycamposforjados; suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas. SinconsultaDBnueva/índices/deps/seguridadampliada.

- Resultado12b2a1: expectedUserId estrictamente validado ycomparado conactor de sesión antes deejecutor; account_changed noescribe. SesiónB/payloadA ysinafirmación probados, suite138pass/30opt-in skip, lint243files/tipos/build29recursos pasan. Candidata12b2a2 coordinador; ningúnconsumidorUI antiguo.

### 12b2a2 — Pasada acotada de sincronización y liberación de lease

- Objetivo previo: coordinar identidad/pull/claim/push/ACK secuencialmente mediante puertos tipados, con límites por pasada, coalescing ystop. Entrada60%/52%, int/secuencial/reserva10%; dependencias12b2a1/12b1c. Aún sin activar UI/redautomática.
- `target_paths`: `src/features/sync/{coordinator,coordinator.test}.ts`, `src/lib/sync/item-command-support.ts`, `src/lib/local-db/outbox.ts`, `test/browser/sync-results.ts`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: cuenta esperada antesdeclaim ycadaefecto; pull hasta checkpoint antesdepush, unaoperación porenvío yresultado exacto. Releer cola trasACK para basesdependientes, lease entrepestañas yrelease solo dueño; pérdida respuesta reintenta mismo payload. Comandos sin soporte nuncaenviar/ACK; conflicto/rechazo no bloquea entidades independientes. Pasada acotada ycoalesced, stop evita efectos posteriores, sin falsas garantíastodas lasentidades convergen.
- Validación puertoscontrolados: cambio de cuenta/noenvío, dependency/orden/bases, presupuesto de páginas/ops, coalescing/stop, fallo/liberación/payload; IndexedDBfixture verifica release propietario/reclaimsinmutación. Suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas. Adaptador de transporte ydosdispositivos reales/simulados después, antesdehabilitarUI.

- Resultado12b2a2: coordinador porpuertos/identidad/guardias/budgets4páginas+5envíos, rereaddependientes trasACK/coalescing/stop, release exclusivodueño ypayload congelado. Sietetests nuevos, fixtureACK+release+recarga pasan. Normal145pass/30opt-in skip, lint246files/tipos/build29recursos pasan. Próxima12b2a3 adaptador ydosdispositivos; UIaúnnoactivada.

### 12b2a3 — Transporte HTTP y runtime local cerrable

- Objetivo previo: conectar puertos a fetch/accióninyectada yrepositorios propios sinactivarUI, separando backend deentorno de dosdispositivos12b2a4. Entrada55%/51%, int/secuencial/reserva10%; dependencias12b2a2.
- `target_paths`: `src/features/sync/{http-transport,http-transport.test,transport-error,local-runtime}.ts`, coordinator/pull-response ytests, `src/schemas/remote-sync.ts`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: identidad/pull concredentials same-origin/no-store/query esperado/checkpoint ydeadline; callback deServerActioninyectado sinbundlear auth/DB enbrowser. Cambio de cuenta también protegeGET, cursorfuturo requiere recuperación, 401 pausa. Validar input/output y límites; fallos noACK. Runtime verificaepochlocal, abre/cierra recursos propios ystopespera pasada antesdecerrar conexiones; claim120s protege envíos acotados. Sinpolling/UItodavía.
- Validación transporte conRequest/Responsecontrolados (HTTP real de dosparticiones después): identity/query/cookies/no-cache/códigos/timeout/payloadmalformado; regresióncoordinador. Suite/lint/tipos/build/diff/ref, plan/registro/commit+pushint/cuotas. Ningunadependencia/secret/hosting/cambioDB.

- Resultado12b2a3: transporte privado/deadlines/schema+contexto, accountChangedGET/401/cursorfuturotipados yfactorylocalstop/cierrepropio; seisHTTPtests+guardGET+regresióncoordinador pasan. Normal153pass/30opt-in skip, lint250files/tipos/build29recursos pasan. Próxima12b2a4 prueba integrada real de dosparticiones antesdeUI.

### 12b2a3d — Completar registro de transporte

- Entrada51%/50% trasb29017e, int/secuencial/reserva10%; objetivo yscope previo: solo `plan/{master,iterations,iteration-log,offline-and-sync}.md`. El scriptdocumental falló por sintaxis antes deactualizar archivos, pero elcomando siguiente hizo commit/push delcódigo validado yscopeprevio. Registrar cierre encommit adicional sinreescribir historia publicada.
- Aceptación: estado/evidencias/siguiente candidata exactos, referencias/diff consistentes; sin cambios decódigo ni repetirvalidaciones aprobadas porMarkdown. Commit+pushint/verificar HEAD/cuotas.

### 12b2a4 — Dos particiones de navegador con MongoDB real

- Objetivo previo: ejercer runtime/coordinador/transporte con IndexedDB de dos orígenes independientes y el ejecutor/journal reales en la instancia propia del runner. Entrada49%/50%, int/secuencial/reserva10%; dependencias12b2a3.
- `target_paths`: `scripts/{sync-db-test-runner,sync-browser-test-server}.ts`, `test/browser/sync-{devices,device}.ts`, `src/schemas/sync-browser-test.ts` ytests, `package.json`, `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: descriptor/ownership existentes antes de conectar, HTTP solo loopback con capacidad porrun, sin env/auth deproducto. Dospuertos efímeros aíslan IndexedDB delmismoactor; crear sinred conserva intención tras recarga, conectar/descargar/progreso/borrado convergen en ambos yMongo. Pérdida derespuesta después decommit reintenta mismaoperación sin duplicar; concurrentes preservan conflicto/borrador yentidadindependiente avanza. Todoslosrecursos propios secierran ysolo particiones ficticias seeliminan.
- Límite: lafixture inyecta actor ficticio verificado ycallbackHTTP en lugar delRPC deServerAction; prueba pila sync/DB, no loginGoogle ni convergencia de preferencias/series/compartidos. No habilitar sync enUI hastaevidencia.
- Validación: esquemas deldescriptor/comandosfixture, pruebasbrowser dosorígenes+recarga/rollbackprevios, runnerMongo, suite/lint/tipos/build/diff/referencias; plan/registro/commit+pushint/HEADremoto/cuotas.

- Resultado12b2a4: dos orígenes efímeros con IndexedDB real y MongoDB propio pasan seis escenarios: cola offline/recarga, bootstrap/convergencia, estado/checklist dependientes, respuesta perdida/replay, tombstone/recarga y conflicto con entidad independiente. Runner original15pass/105aserciones; normal154pass/30opt-in skip, lint255files/tipos/build29recursos pasan. Ambos modos limpian contenedor y recursos propios. Siguiente12b2b1 resumen de pendientes/bloqueos; aún sin UI automática ni RPCGoogle probado.

### 12b2b1 — Resumen consistente de cola y bloqueos

- Objetivo previo: distinguir trabajo pendiente/enviable/dependiente/bloqueado/sin soporte/conflictos/rechazos sin interpretar una pasada settled como sincronización total. Entrada42%/49%, int/secuencial/reserva10%; dependencias12b2a4.
- `target_paths`: `src/lib/sync/{queue-summary,queue-summary.test}.ts`, `src/schemas/sync-queue.ts`, `src/lib/local-db/{queue-summary,sync-store}.ts`, `test/browser/sync-device.ts`, `test/browser/sync-devices.ts`, schemafixture y `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: snapshot items/outbox en una sola transacciónreadonly, actor/identidad/duplicados validados; ACK excluidos, pendientes clasificados sin modificar ni reconstruir operación; bloqueo transitivo, dependencia ausente/ciclo no se anuncia enviable. Resumen no expone otra cuenta ni descarta comandos no soportados.
- Validación: oráculos puros de mezcla de estados/dependencias/ciclo/aislamiento; fixture integrada usa resumen real antes/después deACK yconflicto, suite/lint/tipos/build/diff/referencias. Commit+pushint/HEADremoto/cuotas. UI/arranque queda en12b2b2.

- Resultado12b2b1: snapshot readonly atómico yclasificación validada, bloqueo transitivo/ciclos/ausentes sinrecursión ni mutar cola; cinco tests nuevos yseis escenariosbrowser concontadores pasan. Normal159pass/30opt-in skip/4405aserciones, lint259files/tipos/build29recursos; recursosfixture cerrados. Siguiente12b2b2 ejecución manual enAjustes antesdeautomatismo.

### 12b2b2 — Sincronización manual en Ajustes

- Objetivo previo: conectar acción autenticada ytransporte/runtime a botón funcional en Ajustes con resumen durable, copycompacto ycache local renovada. Entrada38%/48%, int/secuencial/reserva10%; dependencias12b2b1.
- `target_paths`: `src/features/sync/{manual-sync,manual-sync.test,client-action}.ts`, `src/features/sync/hooks/**`, `src/features/sync/components/**`, `src/features/workspace/components/device-settings.tsx`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`, fixture de UI si hace falta.
- Aceptación: una pasada acotada porpulsación, bloquear solapes; wrapServerAction constartTransition segúnguíaNextinstalada. Cierre/unmount/cambio deepoch detiene efectos ylibera recursos propios; revalidar solo caches deuser+epoch. UI enespañol distingueguardado local/alcance simple/pendientes/conflictos yauth/reintento/cursor inválido, sinfalso «todo sincronizado» ni borrar intenciones. Ajustes mantiene destino común ambasbarras, sin pantalla nueva.
- Validación: servicio manual con puertoscontrolados comprueba cierre/errores/suspensión/cuentainvalidada; SSRdepanel ybrowser UI local cuando viable; lint/tipos/suite/buildfronteras/PWA/diff/referencias. La prueba12b2a4 cubre transportador+DB; no declararpilotoGoogle/RPCreal completado hasta ejecución autorizadaaislada oentorno real. Commit+pushint/HEADremoto/cuotas; automatismo en12b2b3.

- Ampliación concreta de fixture12b2b2 antes de editar: `scripts/sync-browser-test-server.ts`, `test/browser/sync-settings.tsx`. Renderizar DeviceSyncSettings/hook reales en origen propio con actor/DB ficticios; plugin de bundle sustituye solo referencia deServerAction por callbackHTTP defixture, sincambiar acción/rutas producto. Botónreal debe confirmar tarea yseguir mostrando preferencia sinsoporte; control«Validar y cerrar» verificará resultado/cola/Mongo antesdelimpiar. No afirmar RPCNext probado por este seam.

- Resultado12b2b2: botón manual funcional/estado durable en Ajustes, ServerAction envuelta entransición yruntime propio coalescido/cerrable; cache filtrada user+epoch. Ocho tests nuevos devida/cierre/caches/SSR; UIhookreal sobrefixtureMongo confirma tarea yretiene categoría pendiente, móvil390px sinoverflow/control44px. Normal167pass/30opt-in skip/4434aserciones, lint267files/tipos/build30recursos pasan. Próxima12b2b3 scheduler acotado; Google/RPCreal/piloto aúnporcomprobar.

### 12b2b3 — Scheduler limitado con backoff y pausa

- Objetivo previo: política de arranque/reanudación/reintentos que conserve una sola pasada activa, intervalos ypausa porauth/cuenta/cursor, sin depender delworker. Entrada30%/47%, int/secuencial/reserva10%; dependencias12b2b2.
- `target_paths`: `src/features/sync/{scheduler,scheduler.test}.ts`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: 60s traspasada acabada, 2s para more_work, backoff30s–5min trasfallo; foco/online respetan deadline yno ocasionan flood. No ejecutar automáticamente oculto/offline, reanudar alwake disponible; auth/cuentacambiada/cursorpausan hasta peticiónmanual. Coalescer peticiónmanual/automática, stop cancela timer ypasada propia/suprime callbacks tardíos. Testrelojinyectado, sin timers reales prolongados.
- Validación: oráculos de tiempos/morework/fallo/eligibilidad/flood/coalescing/stop/pausa/manual; suite/lint/tipos/build/diff/referencias. SinUIcambio aún, no índices/deps nuevos. Commit+pushint/HEADremoto/cuotas. 12b2b4 conectará proveedor común enWorkspace/Ajustes.

- Resultado12b2b3: scheduler coalesce/manual, intervalos60s/2s ybackoff30s–5min, gatevisible/online, auth/cuenta/recuperaciónpausan, stopcancela ysilenciarespuestatardía. Cinco tests conrelojcontrolado pasan; normal172pass/30opt-in skip/4465aserciones, lint269files/tipos/build30recursos. Próxima12b2b4 proveedorcomún yarranqueUI, todavíanoautomático.

### 12b2b4 — Proveedor único y sincronización automática

- Objetivo previo: arrancar scheduler mientrasWorkspace estévisible/conred ycompartir motor/estado con botónAjustes. Entrada28%/47%, int/secuencial/reserva10%; dependencias12b2b3.
- `target_paths`: `src/features/sync/{sync-context,scheduler,scheduler.test}.ts`, `src/features/sync/hooks/**`, `src/features/sync/components/{workspace-sync-provider,active-sync-provider,device-sync-settings,sync-status-panel}.tsx`, `src/features/workspace/components/workspace.tsx`, `src/features/workspace/require-active-account.ts`, `src/features/sync/local-runtime.ts`, fixtureReact y `plan/{master,iterations,iteration-log,offline-and-sync}.md`. Tipos deguard/runtime reducidos auserId+epoch, sin cambio deautorización.
- Aceptación: motorúnico poruser/epoch, providerestable al navegarysinlistenersduplicados; arranque/online/foco/visibility gates+backoff delcorte anterior. Botónmanual compartepasada yestado, no abre motorextra. Cleanup detiene passtimer/listeners ycapturacuentaantes/después; cachés deotraépoca intactas. Offline guarda/navega igual, unsupported/conflictos siguen visibles/pendientes. Automatismo solo conappabierta; sinprometer backgroundworker/pilotoGoogle.
- Validación: suite/relojscheduler existente, fixtureReact prueba arranqueautomático de tarea yretenciónpreferencia, botónmanual sinmutaciónduplicada ycleanup, lint/tipos/buildPWA/diff/referencias. Commit+pushint/HEADremoto/cuotas; si margen no cubresiguientecorte, cerrar antesdeabrir recuperación.

- Ajuste de contrato12b2b4: también `test/browser/sync-device.ts` retira campos no usados delargumento runtime reducido; tsc/builddetectaron exceso deliteral ypasaron trasadaptación.
- Resultado12b2b4: providerúnico keyeduser/epoch monta engine común; autoarranque/gates/backoff/listenersconcleanup ybotónmanual compartidos. FixtureReact confirma tarea automáticamente sinpulsar, botónmanual posterior deja misma revisión1/ACK1 ypreferencia pendiente; limpiezaexit0. Normal172pass/30opt-in skip/4465aserciones, lint272files/tipos/build30recursos pasan. Próximo12b2c señal local/aviso compacto antesde13a recuperación.

### 12b2c — Señal de intención local y aviso compacto

- Objetivo previo: despertar motor al confirmar intención local (también pestañas delmismo origen), conservando backoff/pausas; señalar incidencias relevantes fueraAjustes sinbloques grandes. Entrada24%/46%, int/secuencial/reserva10%; dependencias12b2b4.
- `target_paths`: `src/lib/local-db/{outbox,sync-notifications}.ts`, `src/schemas/sync-queue.ts`, `src/features/sync/{scheduler,scheduler.test}.ts`, `src/features/sync/hooks/use-sync-engine.ts`, `src/features/sync/components/sync-issue-notice.tsx` ytest, `src/features/workspace/components/workspace.tsx`, `test/browser/sync-settings.tsx`, `plan/{master,iterations,iteration-log,offline-and-sync}.md`.
- Aceptación: avisar solodespués decommitoutbox, eventos locales/BC validados yfiltrados porusuario; nevernotificaciónporpull/claim/ACK evitando loop. Falta deBroadcastChannel no afecta escritura, notificaciones best effort nofalseerror trascommit. Cambios locales adelantan idle a1s, pero nunca backoff ni pausa auth/cursor; coalescing ystop permanecen. Aviso compacto enlazaAjustes solo para conflictos/rechazos oproblemas desesión/recuperación, sinduplicarlo enAjustes.
- Validación: testrelojde signal/backoff, SSRnoticecasos relevantes/normal, fixtureReact segunda creación trasauto provoca subida sinpulsación ysin esperar60s; demás pruebas/lint/tipos/build/diff/referencias. Corregir referenciahistórica delhookrenombrado detectada alcerrar12b2b4; noalterarhistoriaremota. Commit+pushint/HEADremoto/cuotas.

- Resultado12b2c: notificacióntrascommit validada/filtrada eneventlocal+BC, best effort ycierre incluso alfallar; nuevos intents aceleran idle1s incluidodurantepasada, sinadelantarbackoff/pausas. Avisocompacto material enlazaAjustes. Dos testsnotificaciones, dos scheduler ytresSSR pasan; fixtureReact segunda creación se confirmaautomáticamente yretiene preferencia. Normal179pass/30opt-in skip/4482aserciones, lint276files/tipos/build30recursos. Referenciahistórica alhookrenombrado corregida. Próxima13a1 lectorvalidado deincidentes.

### 13a1a — Proyección validada de incidente conservado

- Objetivo previo: preparar DTOlegible deconflicto/rechazo propio a partir de entradaoutbox/outcome/local/shadow, sinmutaciones ni interfazde elección prematura. Entrada17%/45%, int/secuencial/reserva10%; corte mínimo de13a1 tras12b2c.
- `target_paths`: `src/schemas/sync-incident.ts`, `src/types/sync-incident.ts`, `src/lib/sync/{incident-projection,incident-projection.test}.ts`, `plan/{master,iterations,iteration-log,offline-and-sync,conflict-recovery}.md`.
- Aceptación: operacióncompleta ligada aresultado+estado terminal; cada record tieneidentidad/cuenta propia; versiones remotas positivas/monotónicas sin igualdadcontradictoria. Preservar borradores posteriores/tombstones ypayload exacto; no inferir base original a partir delshadowalmacenado alrecibirrespuesta. Applied/unsupported/missingoutcome/foreign/corruptrechazan antesdeDTO; no IOniACK/rebase/export/UI.
- Validación: oráculos derechazo/conflicto, borradorposterior/tombstone/remoto másnuevo, operaciónmutada/cuenta/estado/revisión/keycorruptos/inputintacto; lint/tipos/suite/build/diff/referencias. Documentar diseño de elección explícita/cola dependiente antesdesnapshot13a1b. Commit+pushint/HEADremoto/cuotas; si no cabesiguientecorte+ cierre sobre10%, finalizar lote cerrado.

- Resultado13a1a: DTO puro valida operación/estado/outcome/cuenta/identidad/revisiones; conserva local actual ydeloutcome, shadow alresultado yremoto másnuevo, sin suponerordencronológico de respuestasreplay. Cinco tests/26aserciones nuevas pasan. Normal184pass/30opt-in skip/4508aserciones, lint280files/tipos/build30recursos. Diseño13a deelección explícita documentado; lectorIO13a1b yresolución quedanpendientes.

### Cierre del lote del 8 de octubre, 00:16 — Reserva y revisión

- Objetivo y scope previos: cierre documental después de `f4ba680`, solo `plan/{master,workflow,iterations,iteration-log}.md`. Lectura 12%/44%. El siguiente `13a1b` necesita IO y navegador; los dos puntos sobre la reserva del 10% no cubren pruebas, reparaciones y cierre. Los últimos cortes de código consumieron 5–8 puntos entre lecturas, que pueden incluir uso compartido.
- Aceptación: código validado y publicado, sin archivos abiertos; siguiente candidata y límites precisos. Heartbeat actual pausado; revisión de las 05:18 de Madrid preservada con reinicio real 1791429393 y continuación desde el último HEAD completo. Sin cadena extra ni créditos o reinicios de cuota.
- Validación documental: referencias, consistencia y diff; commit, push a int, HEAD remoto y cuotas finales. No repetir build por Markdown.


### 13a1b — Snapshot consistente de incidentes locales

- Objetivo previo: leer evidencias y todas las intenciones sin ACK del elemento desde una única transacción readonly de items/outbox/shadows/metadata. Entrada 100%/43%, int/secuencial, reserva 10%; dependencia 13a1a.
- `target_paths`: `src/{schemas,types}/sync-incident.ts`, `src/lib/sync/{incident-snapshot,incident-snapshot.test}.ts`, `src/lib/local-db/{sync-incidents,sync-store}.ts`, `src/features/sync/local-incidents.ts`, `test/browser/sync-incidents.ts`, `scripts/browser-test-server.ts`, `plan/{master,workflow,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: snapshot íntegro o error, orden estable por secuencia, borradores posteriores y tombstones conservados, intenciones dependientes incluidas con payload exacto; aislamiento por usuario y época antes/después y conexiones propias cerradas. Sin ACK, red ni elección de versión.
- Validación: proyección pura con corrupción/cuenta/duplicados/evidencia ausente; navegador IndexedDB real con conflicto, rechazo, dependientes, tombstones, recarga y cuenta cambiada; lint, tipos, suite, build, diff/referencias. Commit y push int con HEAD remoto comprobado, cuotas tras commit.

- Resultado 13a1b: snapshot readonly de cuatro stores, proyección íntegra y orden estable; conserva todas las intenciones sin ACK de cada elemento y tombstones. Wrapper exige usuario/época antes y después y cierra conexión. Tres tests nuevos; 187 pass/30 opt-in skip/0 fail/4526 aserciones, lint 285 archivos, tipos/build aprobados. Navegador valida conflicto+rechazo+dependiente, outcome ausente, recarga y cambio de época. Fixture corregida para completar su logout ficticio antes de nueva preparación; datos propios limpiados y servidor cerrado. Próxima 13a1c.


### 13a1c — Comparación compacta de incidentes en Ajustes

- Objetivo previo: mostrar razón, borrador actual, remoto conocido y comando congelado, con intenciones posteriores, usando snapshot 13a1b. Entrada 93%/42%, secuencial/int/reserva 10%.
- `target_paths`: `src/features/sync/{components,hooks}/sync-incident*`, `src/features/sync/components/{device-sync-settings,sync-status-panel}.tsx`, `src/features/sync/hooks/use-sync-engine.ts`, `test/browser/sync-incident-ui.tsx`, `scripts/sync-incident-ui-test-server.ts`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: lectura solo con incidentes y bajo demanda, clave SWR usuario/época y guardias existentes; razones y detalles en español, borrados y remoto desconocido explícitos; datos extensos desplegables, contadores sin acciones de resolución prematuras. Sin nueva ruta; Ajustes accesible en ambas navegaciones. Renovar lectura ante edición local sin adelantar backoff.
- Validación: SSR de comparación/rechazo/tombstone y error sin datos; fixture React/IndexedDB real, apertura de detalles, móvil sin overflow, recarga y cleanup; lint/tipos/suite/build/diff/referencias, commit/push int/HEAD/cuotas.

- Resultado 13a1c: lectura bajo demanda SWR usuario/época y detalles en Ajustes con borrador, remoto conocido, comando e intenciones conservadas; estados/borrados/rechazos explícitos, error oculta caché. Aviso de cambios locales renueva también caché de incidentes sin cambiar política scheduler. Dos SSR nuevas; 189 pass/30 opt-in skip/0 fail/4543 aserciones, lint 294 archivos sin avisos, tipos/build 30 recursos aprobados. Fixture React/IndexedDB: móvil 390×844 sin overflow, summaries 44px, detalles y recarga con cola intacta; limpieza y servidor/tab cerrados. Próxima 13a2a contrato de resolución.


### 13a2a — Contrato puro de elección explícita

- Objetivo previo: validar snapshot esperado completo y producir plan local durable, sin escribir ni ofrecer botones aún. Entrada 89%/42%, int/secuencial/reserva 10%; dependencias 13a1b–c.
- `target_paths`: `src/schemas/{sync-incident,sync-resolution}.ts`, `src/types/sync-resolution.ts`, `src/lib/sync/{incident-resolution,incident-resolution.test}.ts`, `plan/{master,iterations,iteration-log,conflict-recovery}.md`.
- Aceptación: elección usar remoto conocido o enviar borrador completo para conflicto de elemento propio simple. Comparación exacta de snapshot esperado/actual; toda cadena sin ACK incluida, sin leases activos; UUID nuevo, base remota reciente y CAS posterior. Conservar entrada/resultado original y registrar supersesión como decisión local, nunca ACK. Rechazos, series, remoto ausente, identidades contradictorias o resurrección de tombstone no permiten envío. Borrado local sobre remoto vivo genera nueva intención de borrado.
- Validación: tests puros de adopción, nueva operación/payload/base, borrador cambiado, cadena/lease/foreign/UUID, tombstones y rechazo. Lint/tipos/suite/build/diff/referencias, commit/push int/HEAD/cuotas. 13a2b habilitará estado superseded y transacción/executor, antes de botones.

- Resultado 13a2a: contrato y planner puros validan snapshot esperado/actual exacto, cuenta/elemento simple, cadena íntegra soportada sin leases y UUID nuevos. Adoptar remoto no genera operación; reenviar borrador completo crea update/delete sobre revisión remota conocida, sin resurrect tombstone. Registro conserva expected e IDs supersedidos; todavía no persiste ni cambia estado outbox. Cinco tests nuevos; 194 pass/30 opt-in skip/0 fail/4576 aserciones, lint 298 archivos/tipos/build aprobados. Próximo 13a2b dividido en executor con estado superseded y UI de elección después de prueba integrada.


### 13a2b1 — Supersesión local y resolución atómica

- Objetivo previo: ejecutar contrato 13a2a en una transacción de cuatro stores con registro durable y replay; todavía sin botones de elección. Entrada86%/41%, int/secuencial/reserva10%.
- `target_paths`: `src/schemas/local-sync.ts`, `src/lib/sync/{outbox-state,queue-summary,item-projection,incident-snapshot,incident-resolution}.ts` y tests afectados, `src/lib/local-db/{sync-incidents,sync-resolution,sync-store,outbox,preference-outbox,occurrence-outbox,task-move-outbox}.ts`, `src/features/sync/local-incidents.ts`, `test/browser/sync-resolution.ts`, `scripts/browser-test-server.ts`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: nuevo estado local superseded no ACK, no envío ni bloqueo de proyección posterior; original payload/resultado/evidencia intactos. Record+item+cola+secuencia+replacement atómicos, replay idéntico no modifica ediciones posteriores. Snapshot regenerado dentro de transacción; lease/pending intentada/externos dependientes/cambios/UUID collision rechazan sin escritura. Nueva edición no depende de tail superseded, otras dependencias superseded siguen bloqueadas. Guardias cuenta/época y notificación únicamente tras commit.
- Validación: tests pure de clasificación/proyección y pending intentada; IndexedDB real adopción/retry/delete/replay/edit posterior/conflicto nuevo/rollback/cadena externa/stale/account/reload. Lint/tipos/suite/build/diff/referencias, commit/push int/HEAD/cuotas. UI13a2b2 después de prueba integrada.

- Resultado13a2b1: superseded conserva operación y outcome originales, excluido de proyección/cola activa pero nunca satisface dependencias como ACK. Nuevas intenciones no dependen del tail supersedido. Executor regenera snapshot en misma transacción de cuatro stores, registra decisión y crea replacement+secuencia opcionales juntos; replay idéntico no muta posteriores cambios. Guardias cuenta/época/cadena externa/lease/intención pendiente ya intentada/UUID. Tres tests nuevos; 197pass/30opt-in skip/0fail/4584aserciones, lint301files/tipos/build30recursos. Fixture ocho checks+recarga, rollback adopción/retry/contador/notificación y limpieza propios aprobados. Próxima13a2b1a integración de dos dispositivos antes de UI13a2b2.


### 13a2b1a — Resolución entre dos dispositivos y MongoDB real

- Objetivo previo: comprobar adopción/retry explícitos con runtime real, dos orígenes IndexedDB y MongoDB8.2.11 propio antes de botones UI. Entrada79%/40%, int/secuencial/reserva10%; depende13a2b1. Docker28.4 Linuxamd64 e imagen digest local revalidados; ningún contenedor de prueba residual.
- `target_paths`: `src/schemas/sync-browser-test.ts`, `test/browser/{sync-device,sync-devices}.ts`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: chain supersedida conserva originales y nueva operación se confirma remotamente; respuesta perdida/reload/replay no duplica revisión/journal. Adopción no escribe servidor ni ACK ficticio. Snapshot local cambiado rechaza elección; tombstone remoto no resucita. Convergencia completa comprobada por ambas proyecciones/cursors vs MongoDB, incluidos borrados; limpiar únicamente runner/particiones propios.
- Validación: fixture integrada amplía seis escenarios con reintento/cadena/replay, adopción/stale y tombstone; suite/lint/tipos/build/diff/referencias. Commit/pushint/HEAD/cuotas, UI13a2b2 después.

- Resultado13a2b1a: nueve escenarios integrados pasan con dos particiones reales/runtime/MongoDB. Replacement sobrebase2 se confirma enrevisión3 una vez pese arespuesta perdida/recarga/replay; originales permanecen superseded. Adopción noañade revisión/journal ysnapshot obsoleto rechaza sin cambios. Tombstone remoto nunca resucita; proyecciones ycursores deambos dispositivos coinciden conMongo ysin pendientes/conflictos/rechazos/sending. Runnerexit0/container/storage/servidores/tabs propios limpiados. Suite197pass/30skip/4584aserciones, lint301files/tipos/build30recursos aprobados. PróximaUI13a2b2.


### 13a2b2 — Elecciones explícitas desde Ajustes

- Objetivo previo: habilitar adoptar remoto conocido o enviar borrador completo tras pruebas13a2b1a. Entrada75%/40%, int/secuencial/reserva10%.
- `target_paths`: `src/features/sync/components/sync-incident*`, `src/components/ui/confirmation-dialog.tsx`, `src/lib/sync/{incident-snapshot,incident-resolution}.ts` y tests afectados, `src/{schemas,types}/sync-incident.ts`, `test/browser/{sync-incident-ui.tsx,sync-incident-edit.ts}`, `scripts/sync-incident-ui-test-server.ts`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment,offline-and-sync}.md`.
- Aceptación: acciones solo donde contrato permite; cadenas externas bloquean ofertas, rechazos/sin soporte/tombstone no ofrecen retry. Confirmación reutiliza diálogo existente y muestra versión exacta congelada, consecuencias sobre toda cadena y estado local pendiente del servidor. UUID/timestamp se preservan en reintento, caché propia refrescada tras commit; fallo de caché no convierte commit en fracaso. Cancelar no escribe y snapshot cambiado rechaza. UI compacta/móvil/accesible; sin ruta nueva.
- Validación: SSR disponibilidad/no falsas elecciones, fixture UI real con cancelación/confirmación/stale/supersesión/newpending/cola intacta; móvil sin overflow ytargets44px, lint/tipos/suite/build/diff/referencias. Commit/pushint/HEAD/cuotas.

- Resultado13a2b2: Ajustes ofrece elecciones solo permitidas por guardias compartidas. Snapshot señala dependientes externos; esos casos conservan lectura sin acciones. Confirmación existente reutilizada con tono primary, versión congelada y consecuencias completas, UUID/timestamp estables en reintento, fallo de caché nofalseerrortrascommit. Tres tests nuevos; suite200pass/30skip/4597aserciones, lint304files/tipos/build30recursos aprobados. UIreal: cancelar sinmutación, edición enotra pestaña rechaza confirmación abierta, revisión nueva sustituye3intenciones ycrea1pending sinACK, recarga; adopción2superseded/0pending, recursospropios limpios. Móvil390px sinoverflow/dialog358px/buttons48px. Nueve escenarios dosdispositivos/Mongo revalidados exit0. Próxima13a2c1 copia explícita desde tombstone.


### 13a2c1 — Contrato de copia explícita frente a tombstone remoto

- Objetivo previo: planificar copia de borrador vivo como nuevo elemento cuando remoto conocido está borrado, preservando identidad original y cadena. Entrada63%/38%, int/secuencial/reserva10%; depende13a2b2.
- `target_paths`: `src/schemas/sync-resolution.ts`, `src/lib/sync/{incident-resolution,incident-resolution.test}.ts`, `src/lib/local-db/sync-resolution.ts` (rechazo explícito hasta executor), `test/browser/sync-devices.ts` (nullable de compatibilidad), `plan/{master,iterations,iteration-log,conflict-recovery}.md`.
- Aceptación: copy_local requiere nuevo itemId yoperationId distintos/resolutionUUID nuevos, base0/create; viejo elemento queda tombstone remoto, nuevo conserva contenido completo/checklist/fecha sin copiar preferencias. Record guarda proyección original ycopy, sinACK. Solo conflictos propios simples/cadena sin envíos/externos, local vivo yremoto tombstone. Defaultsnullable mantienen lectura/replay de registros anteriores. No botón ni copia persistida hasta siguiente executor.
- Validación: tests freshIDs/payload/tombstones/collisions/localdeleted/remotealive/defaultslegacy; lint/tipos/suite/build/diff/referencias, commit/pushint/HEAD/cuotas.

- Resultado13a2c1: contrato copy_local producecreate/base0/UUID nuevos y conserva tombstone original; record.copy separado deproyección original, nullabledefaults para compatibilidad. Tres tests nuevos yguardias freshIDs/remotovivo/localborrado. Executor rechaza explícitamentecopy hasta siguiente corte, UI noofrecebotón. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próximo13a2c2 atomicidad/copiacolision/rollback/replay yprueba dosdispositivos; despuésUI.


### 13a2c2 — Copia atómica y convergencia real

- Objetivo previo: persistir original tombstone/copia/cola/evidencia en misma transacción y probar dos dispositivos antes de botón. Entrada59%/37%, int/secuencial/reserva10%; depende13a2c1.
- `target_paths`: `src/lib/local-db/sync-resolution.ts`, `test/browser/{sync-resolution,sync-devices}.ts`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: nuevo copyID libre incluso frente a tombstones/historial local; nunca overwrite ni reutilizar ID deoperación. Old record conserva tombstone, new item se añade, entry.entityKey corresponde alcopyID, secuencia/registro/originales juntos. Rollback tardío revierte ambos elementos/cola/counter/decision; replay no sobreescribe copia editada. Subida ydosdispositivos convergen nuevoitemrevision1 yviejo tombstone sin cambiarrevision, lostresponse/recarga sinduplicados.
- Validación: IndexedDB real collision/rollback/replay/status/newpending; nueva escena integradaMongo; suite/lint/tipos/build/diff/referencias ycleanup propios. Commit/pushint/HEAD/cuotas; UI13a2c3posterior.


13a2c2: copia y original tombstone guardados junto con cola/contador/evidencia en cuatro stores; nuevo ID libre frente a registros/historial/tombstones, entityKey del nuevo elemento. Rollback tardío deja ambos elementos y cola intactos; replay no sobrescribe copia editada. IndexedDB nueve checks+recarga y diez escenarios reales dos dispositivos/Mongo aprobados; lostresponse produce una sola copia revision1 y original tombstone revision2 intacto. Recursos propios limpios. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próxima13a2c3 UI de copia, sin categorías/orden duplicados ni ACK local.

### 13a2c3 — Copia explícita desde Ajustes

- Objetivo previo: ofrecer copia nueva solo cuando local vivo y remoto borrado, tras persistencia/convergencia13a2c2. Entrada53%/36%, int/secuencial/reserva10%.
- `target_paths`: `src/lib/sync/{incident-resolution,incident-resolution.test}.ts`, `src/features/sync/components/{sync-incident-actions,sync-incident-resolution-dialog,sync-incident-panel.test}.tsx`, `test/browser/sync-incident-ui.tsx`, `plan/{master,iterations,iteration-log,conflict-recovery,sync-test-environment}.md`.
- Aceptación: opciones cumplen contrato, copia requiere nueva identidad y operación estables durante reintento; preview exacta y confirmación indican original borrado, categorías/orden no copiados y cola pendiente, sin ACK. Cancelar no cambia nada; recarga conserva original tombstone/copia/cola e historial. Móvil compacto sin overflow, botones utilizables; sin nuevo destino de navegación.
- Validación: tests disponibilidad (local borrado/no local bloquean copia), SSR label/confirmación, UIreal cancelación/confirmación/reload/IDs/estados/copy sinACK; suite/lint/tipos/build/diff/referencias. Commit/pushint/HEAD/cuotas.


13a2c3: Ajustes ofrece Crear copia de mi borrador solo para local vivo frentearemoto tombstone, conidentidad/operación/timestamp estables yconfirmación decontenido completo, originalborrado, sincategoría/orden ypending. Tests guardiaslocalmissing/deleted ySSR; normal205pass/30skip/4628aserciones, lint304files/tipos/build30recursos aprobados. FixtureUI móvil390/dialog358/buttons48 sinoverflow: cancelar sincambios, confirmar/reload origentombstone+copyrev0+createbase0/entityKeynuevo/2superseded/1pending/sinACK; limpieza propia. Próxima13b1 recuperación/transporte según dependencias.

### 13b1a — Sesión y cierre durante envío, prueba integrada

- Objetivo previo: verificar conservación ante sesión remota ausente/caducada y cierre después de commit, con recuperación de lease expirada tras recarga. Entrada50%/36%, int/secuencial/reserva10%; depende13a2c3.
- `target_paths`: `src/schemas/sync-browser-test.ts`, `test/browser/{sync-device,sync-devices}.ts`, `plan/{master,iterations,iteration-log,sync-test-environment}.md`.
- Aceptación: identidad ausente no reclama ni altera cola; sesión que caduca alpush libera lease pero no ACK ni modifica operación. Cierre trascommit remoto sinACKlocal conserva UUID y replay converge una solarevisión. Leaseexpirada recuperable trasrecarga, ambos dispositivos/Mongo coherentes. Fallos de auth se simulan solo en fixture, nunca atribuirlos aGoogle/RPCNext.
- Validación: escenas nuevas conruntime/IndexedDB/Mongo aislado, assertions exactas operación/state/revisión/cursor; suite/lint/tipos/build/diff/referencias ycleanup propios. Commit/pushint/HEAD/cuotas. Compatibilidad deprotocolo siguiente corte13b1b.


13b1a: doce escenarios reales dos dispositivos/IndexedDB/Mongo aprueban sesiónausente(no claim), sesióncaducada alpush(release sinACK yUUID/payload intacto), cierre después decommitremoto(release pending) yleaseexpirada durable/recarga/replay único. Ambosdispositivos/cursors convergen conMongo, revisiones1 sin duplicados; normal205pass/30skip/4628aserciones/lint304files/tipos/build30recursos. Auth simulado soloenfixture; Google/RPCNext siguepiloto. Cleanup ownrunnerexit0. Próxima13b1b compatibilidad deprotocolo.

### 13b1b1 — Handshake de protocolo antes de efectos

- Objetivo previo: anunciar rango de protocolo por header de identidad/pull ypausar transporte si falta/incompatible/corrupto, antes de reclamar oaplicar descarga. Entrada46%/35%, int/secuencial/reserva10%.
- `target_paths`: `src/{config,schemas,lib/sync}/sync-protocol.ts`, `src/features/sync/{identity-response,http-transport,transport-error,coordinator,pull-response}.ts` ytests, `src/app/api/sync/identity/route.ts`, `src/features/sync/components/{sync-status-panel,sync-issue-notice}.tsx` ytests, `scripts/sync-browser-test-server.ts`, `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: contrato versionado estricto yacotado sinPII, headersprivate/no-store, auth antesdeexposición deidentidad; bodyidentity existente intacto. Nuevo cliente exige protocol1 dentroderango; ausencia/invalid/incompatible produceupdate_required yschedulerpausa sinclaim/ACK/cursor. UI compacta explica actualizar conpendientespreservados, noforzar reload. Header evita romper preparaciónGoogle existente. Clientes anteriores sinhandshake no adquieren esta protección retroactivamente; ServerAction valida operation.protocolVersion como siempre, race posterior se cubre siguiente corte.
- Validación: range/header/body tests, transporte nofalsoparse/scheduler pausado/coordinadorzeroeffects/UIespañola, suite/lint/tipos/build/diff/referencias; fixture integrada revalida headers en12escenarios. Commit/pushint/HEAD/cuotas. Sin nueva dependencia, DBmigration nipermisos.


13b1b1: identidad/pull anuncian rango min/max por x-dalis-sync-protocol sin modificar bodyidentity existente. Nuevo cliente exige header válido <=128bytes con rango quecontieneprotocol1; ausencia/corrupto/incompatible pausa update_required antesdeleerbody/claim/cursor. Schedulerpausa yUI indica cerrar/reabrir conconexión, pendientes conservados; sinreloadautomático. Rango estricto Zod1..1000000/min<=max; noPII. Clientesanteriores sinhandshake noobtienenprotección retroactiva. 209pass/30skip/4670aserciones/lint310files/tipos/build30recursos y12escenariosMongoaprobados; ownresourceslimpios. Próxima13b1b2 guarda incompatibilidad enpush yprueba mixeddeployment.

### 13b1b2 — Incompatibilidad durante envío y despliegue mixto

- Objetivo previo: resultado update_required delpush sin ningún efecto remoto yprueba deausencia/incompatibilidad delhandshake antesdedescarga. Entrada43%/35%, int/secuencial/reserva10%; depende13b1b1.
- `target_paths`: `src/schemas/{remote-sync,sync-browser-test}.ts`, `src/features/sync/{push-batch,coordinator}.ts` ytests, `test/browser/{sync-device,sync-devices}.ts`, `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: envelope futuro estrictovalidado/acotado distingue incompatibilidad deinputmalformado; sesión/cuenta sevalidan antesdeexecutor yningún prefijo es aplicado sialguna versión es incompatible. Coordinador update_required libera lease/conserva UUID/payload/dependientes/cursor, noACK. Fixturemissing/future/futurepull/futurepush pausa conservando datos yrestaurar compatibilidad/recargar converge sin duplicados.
- Validación: unit protocolgate/auth/invalid/prefix/lease, escena integradaMongo/2origins; suite/lint/tipos/build/diff/referencias/cleanup. Commit/pushint/HEAD/cuotas. Sin cambiar DB ni trabajadores, no heurísticas deerrorNext nidarporprobadoGoogle real.


13b1b2: envelope Zodacotado/estricto verifica identidad/versión/duplicados/payloadsize antes deejecutar, batch conversiónfutura devuelupdate_required sinprefijoaplicado; auth/cuenta precedenexecutor. Coordinador libera lease yconservaUUID/payloadsinACK. TreceescenariosMongo: missing/future/futurepull conservan snapshotexacto; futurepush deja pending/lease0/attempt1; reload compatibleconverge una revisión1 enambosdispositivos. 211pass/30skip/4685aserciones/lint310files/tipos/build30recursos, ownrunnerexit0/cleanup. Próxima13b2a comprobaciónactualización segura.

### 13b2a — Comprobar actualización sin interrumpir escrituras

- Objetivo previo: permitir revisar worker desde incompatibilidad en Ajustes, ydetectar instalación yaencurso almontar aviso. Entrada40%/34%, int/secuencial/reserva10%; depende13b1b2.
- `target_paths`: `src/lib/pwa/{client,client.test}.ts`, `src/features/workspace/components/{offline-update-check,update-notice}.tsx`, `src/features/sync/components/sync-status-panel.tsx`, `test/browser/pwa-update.tsx`, `scripts/pwa-update-test-server.ts`, `plan/{master,iterations,iteration-log,offline-and-sync,sync-test-environment}.md`.
- Aceptación: check solo registroexistente/online, no instalar si falta ni skipWaiting/reload/delete; resultado distingue waiting/installing/current/offline/unavailable. Observador conecta installing existente yse desconecta aldispose. UI44px/compacta indica conservaciónde pendientes yguardarformularios/cerrarpestañas antesdeactualizar. Workerreal cache neutral versionesfixture1/2 sobreloopbackpropio demuestra waitingconcola intacta, activación naturalal cerrar/reabrir conserva datos. Limpiar solo recursospropios.
- Validación: estados/helper/dispose conpuertosnativosficticios yfixture React/IndexedDB/SWreal, lint/tipos/suite/build/diff/referencias. Commit/pushint/HEAD/cuotas. No modifica protocolo niDBschema/producción.


13b2a: Ajustes ofreceComprobaractualización anteupdate_required, registroexistente/online ywaiting/installing/current/offline/unavailable, sinregister/skipWaiting/reload. Observador conecta instalaciónyaencurso ydisposequitalisteners; avisoesperacompacto. 214pass/30skip/4702aserciones/lint314files/tipos/build30recursos. FixtureReact/IndexedDB/workerdeproductoreal con2versionesownloopback: v1activo/v2waiting mantienedatos/colaexactos, cerrar/reabriractivav2yconservaUUID/payload/estado, cleanupownreg/caches/partición/baseline. Móvil390sin overflow/checkbutton44px. Próxima13c1a backupcontractportable; import/exportUIposteriores. Google/RPCNextrequierepiloto.

### 13c1a — Contrato de backup portable completo

- Objetivo previo: validar backup local versionado de todos los stores de partición propia, pendientes y evidencias incluidas, sin importar ni escribir. Entrada33%/33%, int/secuencial/reserva10%; depende13b2a.
- target_paths: src/{schemas,types}/local-backup.ts, src/lib/backup/{local-backup,local-backup.test}.ts, plan/{master,iterations,iteration-log,backup-recovery}.md.
- Aceptación: format/version/protocol/databaseversion/actor/timestamp estrictos; 11stores completos con records válidos/tombstones/Superseded/outcomes/resolutions. Sin secretos/cookies/controlcuenta, sin filtrado parcial. Propiedad propia o error, claves únicas/sequence/counter/dependencias/evidencia consistentes; backups futuros sin soporte rechazan. Entrada UTF8 <=16MiB/<=10000records porstore, conserva leases como evidencia pero no restaurables. Codificador valida antes de producir JSON, lector no cambia entrada. Compartidos futuros requieren contrato nuevo; backup no otorga permisos. Importación posterior genera nuevas intenciones explícitas y jamás restaura ACK/cursors/leases.
- Validación: roundtripmultistore con intenciones/metadata, wrongactor/version/schema/duplicado/historialincompleto/size rechazados e input intacto, lint/tipos/suite/build/diff/referencias. Commit/pushint/HEAD/cuotas. Snapshot readonly13c1b/UIexport13c1c siguientes.


13c1a: backup estricto completo de11stores, cuentaspropias ymetadata validada, tombstones/leases/outcomes/resolutions/Superseded intactos, clavesúnicas/sequence/dependencias/counter/evidencia. UTF8<=16MiB/records<=10000, nofiltrar registros/secretos/control de cuenta. Tres tests roundtrip/invalidactor/version/duplicates/historicalmissing/size/unknownmetadata; 217pass/30skip/4727aserciones, lint318files/tipos/build30recursos aprobados. Contrato puro, noDB/UI/importación; próxima13c1b snapshotreadonly. Backupnoautoriza ni restauraACK/leases/cursors, compartidos/versionesfuturas requierennuevocontrato.

### 13c1b — Snapshot completo readonly con cuenta vigente

- Objetivo previo: leer los once stores en misma transacción, validar backup íntegro y cerrar recursos antes de entregar datos a UI. Entrada25%/32%, int/secuencial/reserva10%; depende13c1a.
- target_paths: src/lib/local-db/backup.ts, src/features/workspace/local-backup.ts, test/browser/backup.ts, scripts/browser-test-server.ts, plan/{master,iterations,iteration-log,backup-recovery,sync-test-environment}.md.
- Aceptación: getAll enmisma transacciónreadonly sin awaits, límite10001detecta excedente sintruncar. Wrapper comprueba usuario/época antes y después, fecha/exportmetadata desde runtime ydb.version, closes siempre. Ninguna escritura/ACK/notification/counter; datosinválidos/actorcambiado producenerror sinpartial. Snapshot coherente bajo escritura posterior, recarga yJSONroundtrip conpendientes/tombstones.
- Validación: IndexedDBfixture real coherence/corrupt/account/epoch/reload exact/cleanup, lint/tipos/suite/build/diff/referencias. Commit/pushint/HEAD/cuotas. DescargaUI13c1c después si margen sobre10%.


13c1b: lector getAlllimit10001 de11stores enmisma txreadonly, ownershippartición/DBversion/fecha/byteguard sintruncate, wrapperactor/epochantesdespués yclosefinally. IndexedDB4checks+reload: snapshot completo/colaexacta/tombstone/preferencias/roundtrip, snapshotprecedewritecoherente, unknownmetadatarechaza sin cambios, wrongpartition/epoch yepochcambiada durantelectura noentregadatos/closeexacto. Owncleanupnormal217pass/30skip/4727aserciones/lint321files/tipos/build30recursos. Próxima13c1cdescargaUI si margen, importación siguependiente.

### 13c1c — Descargar backup validado desde Ajustes

- Objetivo previo: botón compacto bajo detalles debackup, descargaJSON solicitada solo tras snapshotvalidado y guardiaactual. Entrada22%/31%, int/secuencial/reserva10%; depende13c1b. Coste esperado menor que cortesUI anteriores (snapshot ya probado, sinformulario/import ni navegación nueva).
- target_paths: src/features/workspace/{download-backup.ts,components/{backup-settings,device-settings}.tsx}, test/browser/backup-ui.tsx, scripts/backup-ui-test-server.ts, plan/{master,iterations,iteration-log,backup-recovery,sync-test-environment}.md.
- Aceptación: sólo cuenta preparada/época vigente, offline/sinfetch, snapshotcompleto yJSONvalidado antesdeBlob; filenamefecha sinusuario/PII, revocaciónURL ylinkremovido, sinnetwork/ACK/escrituras. UI44px/compacta español, errorhonesto conserva datos, mensaje descarga solicitada (no afirmar que navegadorguardó). Detalles explican restauraciónpendiente; no nuevapantalla.
- Validación: UIreal390 confetchbloqueado capturaBlob+filename+11stores+pending+colaexacta, cuentaobsoleta falla sinBlob, cleanup propio; lint/tipos/suite/build/diff/referencias. Commit/pushint/HEAD/cuotas, después cierre si reserva no admite otrocorte.


13c1c: secciónplegablecompactaCopia de seguridad enAjustes, downloadsolo tras snapshotvalidado yguardiaactual, JSONBlob/filenamefecha sincuenta yURLrevocable/linkremovido. Mensajehonestodescargasolicitada, importacióntodavíano disponible; sinfetch/ACK/escrituras. FixtureUIreal390 confetchbloqueado validaBlob11stores/colaexacta, epochcambiado error sinsegundaBlob, recursospropios limpios yviewportreset; botón44px/sin overflow. Normal217pass/30skip/4727aserciones/lint325files/tipos/build30recursos aprobados. Próxima13c2apreviewpuro deimportación si margen; ejecutor/importUI posteriores.

### 13c1d — Identidad y payload de evidencias de backup

- Objetivo previo: endurecer relación outcome/elemento yreplacement/payload sinnuevaUI niIO, antesdeimportación. Entrada16%/30%, int/secuencial/reserva10%; corte mínimo de dosguardias ytests sobrefixtureexistente (margen6puntos; noabrir13c2aimplementaciónmayor).
- target_paths: src/lib/backup/{local-backup,local-backup.test}.ts, plan/{master,iterations,iteration-log,backup-recovery}.md.
- Aceptación: local/base/current/applieditem deloutcome ligado acommand.itemId, versionessupersedidas conservan outcomeoriginal; replacement debe coincidirpayloadexacto conentryhistórica. Manipulación deID/payload/actoranidado/counterrechaza íntegramente, leasesendernoncelegítimo sigueválido. Sin cambiar ficheroscorrectos ni restaurarestado.
- Validación: tests purecontra identidad/payload/counter/actor/duplicates, suite/lint/tipos/build/diff/referencias. Commit/pushint/HEAD/cuotas ycerrarlote/reservasin nuevaautomatización.


13c1d: outcome.local/base/current/applieditem deben coincidirconcommand.itemId; replacement exacto contra operaciónpreservada, sinaceptarevidenciamanipulada. Dos tests identity/payload/actornested/counter/shadowduplicado; 219pass/30skip/4734aserciones/lint325files/tipos/build30recursos aprobados. Fixture usa operaciónclonada separada de decisiónpara quealterar una pruebe realmenterechazo. Sin nuevaUI/IO/migración. Código cerrado, próxima13c2apreviewimportación.


## Intercalada 13b2b: cookies de acceso en preproducción protegida

El 8 de octubre el usuario autoriza un intento mínimo con aproximadamente 8% de la ventana de 5h, consumiendo la reserva exclusivamente para esta corrección. Trabajo secuencial en `int`; no encadenar implementación al cerrar.

- Objetivo: preparar recursos offline en un preview protegido sin omitir su cookie de acceso del mismo origen.
- `target_paths`: `src/lib/pwa/service-worker.ts`, `src/lib/pwa/service-worker.test.ts`, `plan/{master,workflow,iterations,iteration-log}.md`.
- Dependencias: worker existente, shell `/workspace` neutro y documentación instalada de Next sobre PWA; no cambios en hosting, permisos, secretos, DB o dependencias.
- Aceptación: solicitudes de precache con `credentials: "same-origin"`; mantener rechazo de respuestas redirigidas, URL inesperada y shell sin marcador neutro, y eliminación de caché fallida. APIs, autenticación y contenido personalizado siguen fuera del precache.
- Validación: worker de producto compilado y ejecutado en sandbox de pruebas con gate de autenticación simulado; tres pruebas cubren opciones de cada recurso, redirección SSO y HTML sin marcador. El simulador representa explícitamente opciones del navegador porque Bun normaliza `same-origin` a `include`. Suite 222 pass / 30 opt-in skip / 0 fail, 4749 aserciones; lint 326 archivos y tipos aprobados. Build aprobado: `/workspace` estático y worker preparado con 30 recursos neutros; diff y rutas comprobados para el cierre.
- Límite: no se ha reproducido el acceso SSO en el dominio real de Vercel; el usuario debe recargar el preview publicado y verificar preparación. No borrar IndexedDB ni trabajo local. La siguiente candidata de producto continúa siendo `13c2a`; piloto real Google/RPC Next pendiente.


## 13c2a — Vista previa pura de importación

- Entrada: 100% de 5h y 29% de 7d; usuario autoriza continuar y consultar ambas cuotas tras cada commit/push para escoger el siguiente corte. Trabajo secuencial en `int`, reserva base del 10% y cortes pequeños.
- Objetivo: comparar un archivo de backup íntegro con un snapshot propio actual antes de introducir ejecutor o UI de confirmación.
- `target_paths`: `src/lib/backup/import-preview.ts`, su test, `src/types/backup-import.ts`, `plan/{master,workflow,iterations,iteration-log,backup-recovery,offline-and-sync}.md`.
- Dependencias: contrato portable `13c1d`, snapshot readonly y fix de preview `13b2b`.
- Aceptación: validar íntegramente ambos snapshots y su cuenta/versión/bytes; comparar por identidad de cada store, clasificar nuevos, idénticos, cambiados y tombstones de origen/destino; conservar contenido no admitido e historia como evidencia, sin restaurar permisos/ACK/leases/cursor ni generar intenciones o escribir. Igualdad exacta del registro validado, incluidos metadatos; no deduplicar por título ni inferir cuál versión es más nueva. Indexación lineal y ordenación O(n log n), salida determinista por clave.
- Validación: casos mixtos en once stores, tombstones en ambos lados, mismos títulos con identidades distintas, tipo no soportado, entrada ajena/incompatible/corrupta/acotada; entradas sin mutación y salida independiente; suite, lint, tipos, build, diff/rutas/plan.
- Piloto: el usuario confirma que el fix funciona en preproducción. El navegador aislado de Codex requiere login de Vercel; no tiene la sesión del usuario y no se ha realizado prueba de Google/RPC Next ni escritura en DB remota. Se continúa trabajo puro independiente.


### Resultado 13c2a

La vista previa pura valida el archivo y el snapshot actual completos para la cuenta activa; clasifica registros por identidad en los once stores sin IO, nuevas operaciones ni restauración de ACK, cursores, leases o permisos. Conserva contenido e historia en objetos independientes. Los tipos sin ejecutor quedan explícitos; igualdad exacta incluye metadatos y no establece precedencia remota. Se indexa cada store con Map y se ordena por clave: O(n log n) por ordenación, sin búsquedas cuadráticas ni mezcla por títulos. Cuatro pruebas/55 aserciones cubren stores, independencia, cambios, tombstones, orden determinista, tipos incompatibles y rechazo íntegro. Suite 226 pass / 30 opt-in skip / 0 fail / 4804 aserciones, lint 329 archivos, tipos y build de 30 recursos neutros aprobados. Próximo corte `13c2b`: contrato puro de selecciones e intenciones nuevas antes de ejecutor o UI.

El usuario confirma que `13b2b` funciona en preproducción. La comprobación del navegador aislado termina en login de Vercel; falta sesión y cuenta de piloto, por lo que no se declara probado Google/RPC Next real ni convergencia en preproducción. No se modifica la DB del usuario.


## 13c2b — Contrato puro de importación como copias

- Entrada: 95% de 5h / 28% de 7d después de `5a1ef70`, remoto verificado; continuar secuencialmente con reserva del 10%.
- Objetivo: transformar selecciones explícitas de tareas/eventos propios vivos sin repetición en nuevas intenciones `item.create`, sin IO ni confirmación UI. Copiar a identidad nueva evita resucitar tombstones o reemplazar trabajo existente.
- `target_paths`: `src/schemas/backup-import.ts`, `src/types/backup-import.ts`, `src/lib/backup/import-plan{,.test}.ts`, `plan/{master,iterations,iteration-log,backup-recovery}.md`.
- Dependencias: vista previa `13c2a`.
- Aceptación: petición estricta con cuenta, UUID/fecha estables, snapshot esperado y entre 1 y 50 selecciones únicas; cuenta/versión/bytes íntegros, comparación actual no obsoleta, IDs nuevos y distintos respecto al archivo/snapshot/historia. Selecciones solo de items simples vivos; archivo original y evidencia preservados en el plan, sin copiar permisos/categorías/orden/ACK/cursor/leases/revisión. Crear contenido con revisión/base0 y nuevas fechas locales, mantener progreso/checklist; completedAt nuevo se deriva del estado y evidencia original se conserva. Batch <=512KiB; archivos omitidos/no soportados sin escrituras.
- Validación: copies/duplicados/tombstone destino, revisión y progreso, stale comparison, IDs históricos y repetidos, tipos no soportados, cuenta ajena, límites del batch, independencia y entrada intacta. Suite, lint, tipos, build, plan/diff/rutas; commit/push/HEAD y cuotas.


### Resultado 13c2b

Contrato puro de selecciones e intenciones nuevas entregado. Cada copia es una tarea/evento propio vivo sin repetición, con UUID nuevo distinto del archivo, dispositivo e historia, operación nueva y base/revisión0. No modifica originales ni restaura permisos/preferencias/ACK/cursor/leases. Snapshot esperado validado e igualdad exacta de stores; exportedAt no determina antigüedad y puede variar al leer. Se conserva el JSON original literal y el snapshot revisado como evidencia del plan. Progreso/checklist copiados; fecha de finalización de una copia completada se establece en la nueva creación, conservando original en el archivo. Entre1–50 selecciones distintas y512KiB de intenciones, sin IO ni UI de confirmación.

Cinco pruebas/41 aserciones y suite231pass/30opt-in skip/0fail/4845aserciones; lint332archivos, tipos ybuild30recursos aprobados. Se corrigió la fixture del límite de bytes para exceder realmente512KiB con UTF8 multibyte; no se relajó el límite. Próxima `13c2c1`: recibo durable de importación compatible con backup, sin ejecutar todavía; después ejecutor atómico, replay/rollback/recarga y UI.


## 13c2c1 — Registro durable de importación

- Entrada91%/27% después de `8a44954`; int/secuencial/reserva10%.
- Objetivo: contrato de recibo local para replay sin duplicar copias, compatible con exportación/validación del backup y sin ejecutor todavía.
- `target_paths`: `src/schemas/backup-import-record.ts`, `src/lib/backup/{import-record,backup-ownership}.ts`, tests, `src/schemas/local-backup.ts`, `src/lib/backup/local-backup.ts`, `src/types/backup-import.ts`, `plan/{master,iterations,iteration-log,backup-recovery}.md`.
- Aceptación: key/UUID/cuenta/fecha estrictos, archivo original acotado preservado,1–50 operaciones create/base0 simples y UUIDs distintos. Validar archivo archivado estructuralmente y ownership, selección/payload exacto y correspondencia con operaciones preservadas en outbox. Los archivos dentro de archivos históricos son evidencia opaca y nunca autorizaciones ni estados a restaurar. No recursión de archivos históricos. Sin nuevas tablas, índices, migraciones, ACK ni escrituras.
- Validación: recibo/backup roundtrip, archivo ajeno/manipulado, payload alterado, historia faltante/key inválida, entrada independiente; suite/lint/tipos/build/diff/rutas/commit/push/HEAD/cuotas.


### Resultado 13c2c1

Registro local `backup-import:<UUID>` añadido al contrato de metadata existente, sin tabla nueva ni migración. Conserva cuenta/fecha/archivo original y selecciones ligadas al payload exacto de las operaciones preservadas; no concede ACK ni permisos. Archivo archivado acotado y validado estructuralmente, ownership completo, identidad de fuentes única y selección de contenido vivo simple, batch512KiB, payload/fecha idénticos al historial. Archivos dentro de archivos históricos se preservan como evidencia opaca, sin recursión ni restauración. Formato portable1 mantiene rechazo íntegro de metadata desconocida en lectores antiguos.

Ownership extraído a helper único compartido para evitar duplicar su validación. Tres pruebas/14 aserciones y regresión234pass/30opt-in skip/0fail/4859aserciones, lint336archivos, tipos/build30recursos aprobados. Aún no se escribe ningún recibo ni se ofrece importación UI. Próxima `13c2c2`: crear items/outbox/contador/recibo en una transacción propia, rechazo stale, rollback y replay tras recarga sin sobrescribir ediciones posteriores.


## 13c2c2 — Importación local atómica y replay

- Entrada87%/27% tras `8e78cd2`, int/secuencial/reserva10%.
- Objetivo: guardar copias/cola/contador/recibo en una única transacción, preservando originales y pendientes; replay durable sin duplicar ni sobrescribir ediciones posteriores.
- `target_paths`: `src/lib/local-db/{backup,backup-import}.ts`, `src/types/backup-import.ts`, `scripts/backup-import-test-server.ts`, `test/browser/backup-import.ts`, `plan/{master,iterations,iteration-log,backup-recovery,sync-test-environment}.md`.
- Dependencias: planner y recibo, `13c2b–13c2c1`. Leer instrucciones de local-db y guía use-client instalada.
- Aceptación: partición/cuenta/DBversion válidas; helper compartido de snapshot acotado en la misma transacción. Primera ejecución requiere comparación vigente e IDs libres, cola pending nueva y contador seguro; recibo exacto permite replay con snapshot antiguo sin reescribir items/colas. Reutilización de importId con otro archivo/selección/fecha falla. Backup posterior validado y acotado antes de escribir. Resolve solo tras complete, rollback tardío de todos los cambios; notificación solo postcommit. Sin red, secretos, nuevaDBtabla o UI de confirmación.
- Validación: fixture UUID/origen loopback propio con IndexedDB real: preservación/multicopia/counter, replay+recarga/edición, stale/cuenta/collision, fallo tardío y recovery; limpieza exclusiva de recursos propios. Suite/lint/tipos/build/diff/rutas/commit/push/HEAD/cuotas. Guardias de cuenta/época a nivel workspace y UI en corte posterior.


### Resultado 13c2c2

Importador client-only guarda nuevas copias, intenciones pending, contador y recibo en una sola transacción de los once stores. El lector de snapshot acotado se comparte con exportación y se invoca dentro de la misma transacción; valida partición, versión y post-state portable completo antes de escribir. Conserva originales, preferencias y cola existente; add/contador seguros y resultado únicamente tras complete. Notificación postcommit no invalida guardado. Recibo exacto permite replay sin exigir el snapshot antiguo vigente y sin reescribir copias editadas; misma importId con archivo/selección/fecha distintos rechaza.

Fixture propia de loopback4188 e IndexedDB real: seis checks de multicopia/preservación, replay/progreso, reutilización/stale/collision, cuenta/partición, fallo tardío con rollback y concurrencia una sola copia. Séptimo check tras recarga verifica snapshot/cola/recibo exactos y replay sin escrituras. Se corrigió la fixture porque getAll de outbox está ordenado por UUID, no por secuencia; ahora encuentra por identidad y ordena secuencias explícitamente. Ambas ejecuciones limpiaron exclusivamente particiones UUID propias; pestaña y servidor cerrados.

Normal234pass/30opt-in skip/0fail/4859aserciones, lint339archivos, tipos ybuild30recursos aprobados; sin DB remota ni falsa declaración de ACK/convergencia nueva. Próxima `13c2c3`: guardias de cuenta/época y preparación de confirmación a nivel workspace, luego UI compacta y prueba de envío de copias con dos dispositivos/Mongo aislado.


## 13c2c3 — Preparación y guardias de cuenta/época

- Entrada81%/26% tras `adc40e7`, int/secuencial/reserva10%.
- Objetivo: servicios workspace de lectura/comparación, preparación con UUID/fecha estables y commit del plan bajo cuenta/época capturada; sin UI aún.
- `target_paths`: `src/features/workspace/import-backup.ts`, `src/schemas/backup-import.ts`, `src/types/backup-import.ts`, `test/browser/backup-import.ts`, `plan/{master,iterations,iteration-log,backup-recovery,sync-test-environment}.md`.
- Dependencias: ejecutor `13c2c2`.
- Aceptación: identidad capturada antes de awaits, guardias antes/después de lectura/preparación/commit, inputs validados y clonados para impedir cambios del caller durante awaits, cierre finally. Prepare compara snapshot actual y asigna UUID/fecha una vez; commit no regenera decisiones. Cuenta/época obsoleta falla antes de escritura. Si cambia después del commit, conservar copia propia y permitir replay desde su cuenta, sin mostrar éxito a otra cuenta ni deshacer el guardado.
- Validación: fixture propia IndexedDB real incluye lectura/prepare sin escritura, época caducada antes de commit, cambio tras commit/replay y mutación del caller; cleanup de control local solo tras comprobar cuenta propia o nula. Suite/lint/tipos/build/plan/diff/rutas/commit/push/HEAD/cuotas.


### Resultado 13c2c3

Servicios client-only de workspace entregados: lectura/comparación readonly, preparación con UUID/fecha generados una vez y commit del plan estable. Capturan cuenta/época e inputs antes de awaits, validan snapshot actual, verifican cuenta antes/después y de nuevo tras abrir importer, y cierran conexiones en finally. Si la cuenta cambia tras commit, no exponen éxito a otra cuenta ni deshacen copias propias; el recibo permite replay desde su cuenta.

Fixture IndexedDB real alcanza diez checks y uno tras recarga: preparación readonly, época invalidada durante apertura, caller mutando identidad/plan durante awaits, cambio tras commit con copia conservada/replay exacto, además de los checks anteriores. Cleanup valida control de cuenta propio/nulo antes de borrar exclusivamente sus particiones y control en loopback4188; pestaña/servidor cerrados. Suite234pass/30opt-in skip/0fail/4859aserciones, lint340archivos, tipos/build30recursos aprobados. Próxima `13c2d1`: selección y confirmación UI compactas en Ajustes; sincronización de copias con dos dispositivos/Mongo aislado en corte posterior.


## 13c2d1 — Selección y confirmación compactas, con prueba remota paralela

- Entrada74%5h/25%7d después de9437812, HEAD remoto verificado; int/reserva10% ambas. El usuario autoriza explícitamente adelantar trabajo en paralelo.
- Objetivo: importar JSON propio desde Ajustes mediante comparación, selección explícita y confirmación de copias nuevas, manteniendo originales y evidencia.
- Root owns `src/features/workspace/components/backup*.tsx`, helpers UI enworkspace, `scripts/backup-import-ui-test-server.ts`, `test/browser/backup-import-ui.tsx` yplan. Worker import_sync_proof owns únicamente `test/browser/sync-devices.ts` y módulo nuevo de fixture de importación si necesario. No archivos compartidos ni commits independientes del agente.
- Dependencias:13c2c3. Sin nueva pantalla de navegación ni dependencias.
- Aceptación: archivo acotado/validado de cuenta propia, selección ninguna por defecto, máximo50 simples vivos, comparación paginada y contenido secundario bajo demanda. Mostrar clasificación y tipos no admitidos. Confirmación explícita con plan estable, prevención de doble envío, guardias de cuenta y replay; error no afirma pérdida de guardados. Revalidación de caches propias tras commit sin confundir su fallo con fallo de guardado. No restaurar ACK/cursor/permisos ni reemplazar originales. UI española, controles44px, móvil compacto.
- Validación: fixture UI offline/IndexedDB propio en4189 para selección/confirmación/cancelación, cuenta/archivo inválido, stale snapshot, doble intento y preservación. Agente prepara prueba de nuevas copias entre dos orígenes yMongoDB aislado con recursos propios y limpieza; root integra/revisa. Suite/lint/tipos/build/diff/plan/commit/push/HEAD/cuotas.


### Resultado13c2d1 — UI de importación y convergencia de copias

Ajustes ofreceImportar JSON enCopia de seguridad. Diálogo cargado bajo demanda con archivo propio<=16MiB, selección vacía por defecto, máximo50 y páginas de20 filas; tipos no admitidos/borrados no seleccionables. Clasificación visible y contenido/comparación plegables, confirmación explícita de copias nuevas, UUID/plan estables, guardia síncrona contra doble envío y revalidación solo de caches propias. Fallo de refresco posterior no niega guardado; error incierto conserva plan para replay sin duplicación. Sin nueva pantalla ni cambio de navegación. Labels españolas, incluso selector visual de archivo; fila52px y controles44px, sin overflow en390px.

Fixture React/IndexedDB offline en4189 comprueba JSON inválido/ajeno, selección inicialmente vacía, preview/selección/cancelación sin escrituras, contenido comparado, cambio del original antes de confirmar con rechazo íntegro y nueva comparación, doble pulsación con una sola copia, progreso/checklist/archivo literal/cola pending/original conservados. Fixture definitiva parte de control vacío, no adopta cuentas ajenas; partición UUID/control propios, pestañas y servidor limpios. Durante desarrollo se reutilizó únicamente la partición que esta misma ejecución había creado, para limpiar tras reiniciar la fixture; ese mecanismo no forma parte del código final. Regresión SSR acota20 filas y deshabilita tombstones.

El agente con rutas disjuntas amplía únicamente sync-devices.ts:14 escenarios reales entre dos orígenes yMongoDB aislado pasan. Backup capturado enrev3 conACK/shadow/cursor históricos; después originalrev5 tombstone. Importación preserva los once stores existentes salvo copia/cola/counter/recibo. Copia base0 pending obtieneACK real/rev1 y converge; pérdida de respuesta+recarga+replay no duplica, progreso posterior converge enrev2 y nuevo replay no sobrescribe. Tombstone yarchivo/recibo exactos. Runnerexit0, contenedor/tmpfs/particiones propios limpios; Google/RPCNext real sigue pendiente y no se tocóDB del usuario.

Suite235pass/30opt-in skip/0fail/4865aserciones; lint347archivos, tipos/build34recursos neutros ydiff-check aprobados. Se corrigió la versión deDB de la fixture SSR para ajustarla al contrato2, sin cambiarlo. Las pruebas paralelas permiten incorporar la evidencia remota en este mismo corte; no queda un13c2d2 de convergencia abierto. Próxima candidata11c0: diseñar cortes de sincronización de preferencias personales/categorías/orden usando comandos locales existentes, compatibilidad explícita y conservación de pendientes antes de ampliar el ejecutor.


## 11c0 — Cortes de sincronización de preferencias personales

- Entrada53%5h/21%7d trasb7987f9; int/reserva10%. Objetivo documental: revisar comandos y persistencia reales y definir ampliación compatible para categorías/vistas/orden/settings sin admitir comandos antes de sus ejecutores.
- `target_paths`: root `plan/{preference-sync,master,iterations,iteration-log,offline-and-sync}.md`; explorador únicamente lectura de schemas/outbox/reducer/preferencias, sin escrituras. El usuario permite trabajo paralelo; root revisa protocolo/journal y posee toda integración.
- Dependencias: sincronización propia simple y recuperación13c2d1.
- Aceptación: describir identidades, atomicidad multiregistro, revisiones, dependencia entre contenido y categoría, CAS/conflicto/replay/journal/pull y compatibilidad de clientes/cursor. Identificar colas existentes que requieren traducción o conservación, no reset niACK ficticio; subcortes independientes con rutas/tests/aceptación. Sin configuración/DB/índices ejecutados ni activación de preferencias.
- Validación: citas de fuente reales, referencias/consistencia/diff, commit+pushint/HEAD/cuotas; documentación no requiere build adicional.


### Resultado11c0

Diseño de preferencias personales basado en comandos/reductores/cola/wire reales, con referencias a fuente y secuencia enpreference-sync.md. El explorador de solo lectura confirma base por documento, tail personal/dependencias de contenido, replay, ranks numéricos, sentinel atrasadas, efectos multirregistro de compactación y vista de serie, y ausencia de productor settings. Root revisa journal/cursor/receipts/protocol. No se activan comandos ni cambia transporte1, ni se ejecutan índices/migraciones.

Transición propuesta wire2/intención1 requiere nuevas pruebas, adapters históricos, ACK/pull/backup compatibles y rechazo de bundles mixtos antes de avanzar cursores. No reescribir payloads/fingerprints1, inventar timestamps de movimientos overnight ni dar ACK para desbloquear pendientes. Cortes acotados definidos; siguiente11c1a DTO puro de efectos dispersos propios con claves/bytes/revisiones/duplicados. Documentación validada por referencias/consistencia/diff; código sin cambios, build anterior vigente.


## 11c1a — DTO puro de efectos personales

- Entrada45%5h/20%7d tras36c41fb, int/secuencial/reserva10%.
- Objetivo: representar efectos dispersos de una operación remota personal sin modificar wire/cola ni autorizar un ejecutor.
- `target_paths`: `src/schemas/preference-effects.ts`, `src/types/preference-effects.ts`, `src/lib/sync/preference-effects{,.test}.ts`, `plan/{preference-sync,master,iterations,iteration-log}.md`. Dependencia11c0.
- Aceptación: versiónDTO1, actor/operationUUID/sequence positivos,1–10000 registros discriminados tags/itemViews/taskPlacements/settings reutilizando schemas existentes con revisión>=1. Propiedad uniforme y esperada, claves canónicas con actor/store eidentidadcompuesta, únicas sin deduplicar nombres. Settings solo representación preparatoria, sin mutación. Límite512KiB UTF8, no truncado. Salida clonada porvalidación; sinframework/IO/env/Mongo ni cambio de protocolo activo.
- Validación: oráculos independientes de claves/bytes, efectos mixtos/tombstones/settings, IDs iguales enstores/cuentas diferentes, Unicode/duplicados/revisiones/cuenta/futuro/campos extra/10000límite/512KiB. Suite/lint/tipos/build/diff/plan/commit+push/HEAD/cuotas.


### Resultado11c1a — Efectos personales validados

DTO preparatorio versión1 para efectos dispersos en tags/itemViews/taskPlacements/settings; reutiliza schemas de dominio con revisión remota positiva, actor/operationUUID/sequence válidos. Clave documental JSON incluye store, userId eidentidad original (placement incluye referencia/scope/date, no tagId). Identidades únicas, settings único, referencias de tarea/aparición y sentinel overdue canónicos. Propiedad uniforme y esperado actor, registros completos/tombstones, salida clonada; hasta10000 registros y512KiB UTF8 de DTO validado, rechazo íntegro sin truncado. Settings representa evolución posterior, no añade productor.

Cuatro pruebas/39aserciones cubren oráculo de claves, IDs iguales entrestores/cuentas, misma colocación cambiando tagId, fechas distintas, tombstones/independencia, cuenta ajena, revisiones0, referencia/sentinel inválidos, normalización, futuro/campos extra/conteo y byteguard Unicode. Se ajustó el tamaño de la fixture para demostrar caracteres por debajo de512KiB pero bytes por encima, sin relajar límite. Suite239pass/30opt-in skip/0fail/4904aserciones; lint351archivos, tipos ybuild34recursos aprobados. Sin framework/IO/env/driver, índices, ACK, writes o cambio de protocolo activo.

Siguiente11c1b1: extraer el reductor personal existente a módulo puro compartido, equivalencia local y sin activar envío; después11c1b2 añade planning remoto/CAS/efectos completos. Mantener payloads ybase locales, historia ytipos no soportados.


## 11c1b1 — Reductor personal compartido

- Entrada42%5h/20%7d tras537664b; secuencial/int/reserva10%.
- Objetivo: sacar transformaciones existentes de módulo client-only para reutilizarlas local/remoto sin duplicarlas ni alterar semántica.
- `target_paths`: `src/lib/preferences/preference-command.ts`, adapter `src/lib/local-db/preference-mutation.ts`, test de este adapter yplan. Dependencia11c1a.
- Aceptación: funciones puras enlib/preferences, sinframework/IO/driver; adapter client-only mantiene API vigente mediante reexport/alias, sin cambio de firma/payload/revisión/errores. Schemas yreductor existentes reutilizados. Añadir regresión de compactación multirregistro conservando revisiones/tombstones/campos/entrada, además de pruebas existentes. NoCAS ni ejecutor/envíos/ACK nuevos.
- Validación: regresión de preferencias/day/overdue/rank, suite/lint/tipos/build/diff/plan/commit+push/HEAD/cuotas.


### Resultado11c1b1 — Transformaciones personales compartidas

Funciones de categorías/vistas/ranking extraídas al módulo puro lib/preferences/preference-command, sin directiva de cliente ni IO/driver/framework. El adapter client-only local reexporta aliases de la API existente; todos los consumidores siguen usando exactamente esas transformaciones. Comparación textual contraHEAD anterior verifica igualdad completa salvo directiva y nombres genéricos. Revisión local, payload/errores/fechas/tombstones mantienen semántica.

Regresión nueva fuerza compactación sin posición representable: devuelve tres categorías afectadas, orden esperado y posiciones-1024/0/1024, campos/revisiones/entrada/tombstone preservados. Tests existentes de preferencias/day/overdue/rank reutilizan adapter;240pass/30opt-in skip/0fail/4915aserciones, lint352archivos, tipos/build34recursos ydiff-check aprobados. NoCAS/envío/ACK nuevo. Próxima11c1b2a planning remoto puro de familia tag.save/delete/move y efectos completos; item-view ytask.move siguen después según dependencias.


## 11c1b2a — Planner puro de categorías remotas

- Entrada40%5h/19%7d tras71b3ae7; int/secuencial/reserva10%.
- `target_paths`: `src/schemas/remote-tag-planning.ts`, `src/types/remote-tag-planning.ts`, `src/lib/preferences/remote-tag-plan{,.test}.ts`, `plan/{preference-sync,master,iterations,iteration-log}.md`.
- Objetivo: convertir operaciónv1 tag.save/delete/move ysnapshot remoto propio validado en conflicto o efectos íntegros con revisiones siguientes. DependenciasDTO11c1a/reductor11c1b1.
- Aceptación: snapshot<=10000 tags conidentidad/propiedad/normalización activa/revisiones>=1, actor/fecha/operación validados; CAS del documento objetivo, base0 solo creación, tombstone sin resurrección. Reutilizar transformaciones, conservar campos/createdAt, elevar revisión de cada efecto afectado según su propia revisión, no global. Cambios de vecinos/duplicados semánticos devuelveninvalid_command sin efecto. Overflow de revisión/corrupción falla íntegramente. Efectos DTO512KiB contando reserva de secuencia máxima; sin número de journal asignado, IO/auth/DB/wire/ACK. Familia distinta unsupported conservada.
- Validación: create/update/delete/tombstone/CAS/falta, normalización/unicidad activa/reutilización nombre, rank/compactación plurales, vecinos cambiados, overflow/byteguard, entradasintactas/cuenta/tipos no soportados; suite/lint/tipos/build/plan/diff/commit/push/HEAD/cuotas.


### Resultado11c1b2a — Planning de categorías remotas

Familia tag.save/delete/move convertida porplanner puro a changes/conflict/unavailable/invalid_command/unsupported, sinapplied/ACK niIO. Snapshot remoto propio valida IDs/nombres activos únicos yrevisiones positivas, actor/fecha/operaciónv1; cuenta corrupta falla antes deproducirplan. CAS porcategoríaobjetivo ybase0 solocreación, tombstone devuelvesu conflicto sinrestauración. Reutiliza transformaciones compartidas, conserva createdAt/campos yeleva cada revisión afectada desde su propio valor; overflowfalla íntegramente.

Movimientos devuelven todos los efectos decompactación; vecinos obsoletos ycolisiones NFKC produceninvalid_command sin cambios. Borrado mantiene tombstone yno toca referencias personales. DTO deefectos sevalida reservando el tamaño deMAX_SAFE_INTEGER de secuencia; no se asigna un número dejournal ni se declara recibo. Límite512KiB rechaza uncompactado grande sin truncarlo.

Seis pruebas/39aserciones yregresión246pass/30opt-in skip/0fail/4954aserciones; lint356archivos, tipos/build34recursos/diff-check aprobados. Fuente yentrada independientes, conflicto clonado, cuentas/futuro/normalización/bases/overflow/compactación comprobados. Próxima11c1b2b: planner puro deitem-view.set para elementos propios simples, conservación decontenido yCAS propio; series/movimientos/settings requieren sus cortes posteriores. DB yprotocolo todavía sin ampliación.


## 11c1b2b — Planner puro de vista personal

- Entrada37%5h/19%7d tras4a5b11d; int/reserva10%. Root secuencial enplanner; explorador read-only prepara preguntas concretas de repositorios/indexado, sin escritura/IO/servicios ni tocar env.
- `target_paths`: root `src/schemas/remote-item-view-planning.ts`, `src/types/remote-item-view-planning.ts`, `src/lib/preferences/remote-item-view-plan{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync}.md`. Explorador lectura lib/db/config únicamente.
- Objetivo: planning deitem-view.set propio simple conCAS propio, categoría activa ymantenimiento decontenido. Dependencia11c1b1/DTO11c1a; no autorización de compartidos.
- Aceptación: snapshot contexto propio validado, identities referencia coherentes, CAS view/base0 nueva, tombstone no restorable; item activo ysimple, tag activo/null; inválidosin cambios. Efecto soloitemView conrevisión siguiente/createdAt preservado yDTO byteguard conreservasecuencia máxima, sinIO/wire/ACK. Tipos sin ejecutor quedanunsupported. Overflow/corrupción rechaza íntegro.
- Validación: asignar/cambiar/quitar categoría, no alterar estado/checklist/contenido, cuenta/contexto/IDs/tipos/tombstone/bases/overflow/categoría inválida; suite/lint/tipos/build/diff/plan/commit/push/HEAD/cuotas.


### Resultado11c1b2b — Planning de vista personal

item-view.set depropios simples convierte contexto remoto validado enefecto deúnica vista oconflicto/invalid/unavailable/unsupported. Contexto íntegro propio yreferenciascoherentes, revisiónpositiva detag/view/item, CAS debase0 nueva/actual ydeltombstone sinresurrección. Itemactivo ycategoríaactiva/null; reusa transformaciones, createdAt preservado yrevisión siguiente, límiteDTO conreservasecuencia máxima sinasignarjournal. Estado/checklist/descr./fechas delcontenido permanecen intactos; series/cumpleaños/settingsfamilia no seactivan.

Cuatropruebas/34aserciones: asignar/cambiar/quitar categoría, contextosajenos/identidadesincongruentes/base0stored/overflow, faltas/tombstones/CAS, clones ycontenido intacto, evento simple yrecurrencia/otra familiaunsupported. Se corrigió fixture derepetición al contratoend vigente; no cambio deschema. Suite250pass/30opt-in skip/0fail/4988aserciones; lint360archivos, tipos/build34recursos/diff-check aprobados.

Explorador sololectura confirma quegetDatabase/auth ejecutanINDEX_SPECS automáticamente. Próxima11c2a0 protegeíndices staged medianteprovisionamiento explícito central, antes deregistrar colecciones personales: no crear índices deproducto latenteporlogin enint. Luego11c2a1 repositorio decategorías/CAS yMongoDB propio, separado deexecutor/wire/ACK. No servicios/DB/envsecrets enesta investigación.
## 11c2a0 — Índices con activación explícita

- Entrada tras03a8ff8: 28%5h/17%7d; int, secuencial, reserva10% en ambas ventanas.
- `target_paths`: `src/lib/db/ensure-indexes{,.test}.ts`, `src/lib/db/AGENTS.md`, `plan/{master,iterations,iteration-log,preference-sync}.md`.
- Objetivo: permitir registro central de índices pendientes sin provisionarlos al conectar/autenticar. Dependencia: revisión del bootstrap y contrato personal11c1b.
- Aceptación: propiedad opcional `provisioning: "explicit"`; selección automática excluye solo esas entradas, valida el catálogo completo antes de filtrar y falla antes de IO si es inválido. `ensureIndexes(database)` conserva índices actuales; lista explícita permite provisionar pendientes. Sin nuevos índices/colecciones ni cambios de DB real, auth, secretos o hosting.
- Validación: selección automática frente a explícita con DB simulada, rechazo de duplicados ocultos por el filtro antes de writes, registro actual y auth intactos; suite/lint/tipos/build/diff, documentación, commit+push/HEAD/cuotas.


### Resultado11c2a0 — Provisionamiento explícito

Registro central admite índices conprovisioning=explicit. Selección automática valida catálogo completo antes de excluirlos; bootstrap/auth/script mantienen exactamente los índices vigentes. Selección explícita conserva keys/options ypermite provisionar pendientes únicamente en unentorno autorizado. Duplicados incluso entre entrada automática/pendiente, nombres vacíos ypolítica inválida fallan antes dewrites. No se registra todavía colección ni índice nuevo yno se conecta aDB real. Instrucción anidada actualizada.

Tres regresiones conDB simulada; suite253pass/30opt-in skip/0fail/4999aserciones, lint360archivos, tipos/build34recursos/diff-check aprobados. Próxima11c2a1: repositorio actor-scoped decategorías, catálogo íntegro/CAS/unicidad activa ypruebas deMongoDB propio; índices pendientes centrales, sinexecutor/wire/ACK activados.


## 11c2a1 — Repositorio remoto de categorías

- Entrada27%5h/17%7d tras a14693d, int/reserva10%; paralelo autorizado con rutas disjuntas.
- Root: `src/lib/db/remote-tags.ts`, `src/lib/db/{collections,ensure-indexes,ensure-indexes.test}.ts`, `src/schemas/remote-tag-planning.ts`, `plan/{master,iterations,iteration-log,preference-sync,sync-test-environment}.md`; worker: solo `src/lib/db/remote-tags.integration.test.ts` y `scripts/sync-db-test-runner.ts`. Root integra/valida/commit.
- Objetivo: read/catalog/insert/replace propios por actor ysession Mongo singleton; identidad compuesta actor+UUID, catálogo completo<=10000 incl.tombstones sin truncado, revisiones positivas/CAS, no resurrección; nombres activos únicos reutilizables tras borrado. Dependencia11c2a0 yplanner/DTO. Índices actor/id yactor/normalizedName conpartialdeletedAt:null registrados centrales explicit, no bootstrap activo ni modificaciónDBusuario.
- Contrato worker: `RemoteTagRepository.open(actorInput,session?)`; `read(id):Tag|null`, `catalog():Tag[]`, `insert(input):boolean`, `replace(baseRevision,input):boolean`; newrev1/createdAt==updatedAt/active; replacebase>=1/nextbase+1/createdAtvigente/currentactive; duplicado identidad false fuera sesión, colisión nombre yduplicate en sesión throws. Doc `_id=JSON.stringify([userId,id])`. `maximumRemoteTags=10000` exportado remote-tag-planning schema.
- Aceptación/pruebas: dosactores mismoUUID/nombre sin fuga; carreraCAS unganador; tombstone conservaID/nombre reutilizable; carrera nombre activo única; corrupción yoverflowcatalog rechazan; sesión+rollback real devarias escrituras; stagedíndices provisionados soloenMongoaislado propio. RunnerDockerpropio limpio, suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas; sinexecutor/wire/ACK ni activaciónpersonal.


### Resultado11c2a1 — Categorías propias en MongoDB

Repositorio server-only conactor/session/singleton; UUID compuesto porcuenta, catálogo íntegro<=10000 incl.tombstones yregistros positivos validados. Insert inicial yCAS porrevisión/createdAt/activo; identidad duplicadafalse solo fueradesession, nombre duplicado/error ensessionpropagados. Índices centrales únicos deidentidad/nombreactivo registrados explicit: login/bootstrap no activa colección pendiente. Compartidos/executor/wire/ACK noampliados. Se ajustó replaceOne aWithoutId deldriver: filtra_idcompuesto ypreserva_id omitiéndolo delreemplazo.

Worker paralelo propietario solotest/runner, rootrepo/contratos/registro/plan. MongoDB8.2.11amd64 digestfijado revalidado; runner aislado21pass/0fail/168aserciones, seis nuevas pruebas/63aserciones: mismoUUID/nombre entreactores, CASrace, tombstone/nombre reutilizable, carrera nombre activo ycolisión replace, corrupción, catálogo exacto10000/overflow10001, rollback tardío múltiple yduplicado dentro detransacción. Contenedor/tmpfs propios limpios, sinDBusuario/envsecrets/browser. Normal254pass/38opt-in skip/0fail/5000aserciones; lint362archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2a2: repositorio deitemViews propio, conCAS/identidadcompuesta ysession, pruebas aisladas yautorización decontenido enexecutor posterior. Mantener cortes separados yreserva10%, sin declarar preferencias activas.


## 11c2a2 — Repositorio de vistas personales

- Entrada20%5h/16%7d tras2af4e89; int/reserva10%; paralelo conrutas disjuntas porpetición vigente.
- Root: `src/lib/db/remote-item-views.ts`, `src/lib/db/{collections,ensure-indexes,ensure-indexes.test}.ts`, `src/schemas/remote-item-view-planning.ts`, `plan/{master,iterations,iteration-log,preference-sync,sync-test-environment}.md`. Worker: solo`src/lib/db/remote-item-views.integration.test.ts`, `scripts/sync-db-test-runner.ts`. Root integración/commit.
- API: `RemoteItemViewRepository.open(actorInput,session?)`, `read(itemId):ItemView|null`, `insert(input):boolean`, `replace(base,input):boolean`; clave_id JSON.stringify([userId,itemId]); nuevo revision1/activo/created==updated; replacebase>=1/nextbase+1/currentactive/createdpreservado; duplicateidentityfalse solo fuera sesión ythrows dentro. Schema remoto revisiónpositiva exportado `remoteItemViewSchema` desde remote-item-view-planning; COLLECTION_NAMES.itemViews=`item_views`.
- Aceptación: aislamiento UUID igual doscuentas, primaryTagIdválido/null, CAS/tombstone noresurrection, corrupción/propiedad rechaza, session/read/write yrollback reales. Índice único pendiente userId/itemId, sin bootstrap activo. Repo no autoriza compartir ni existencia/propiedad decontenido: executor posterior debe leer item/tag vigentes enmisma sesión yvalidar conplanner antes deescribir. Sin consumidores productivos/envíos/ACK niDBusuario.
- Validación: worker MongoDBpropio runner, suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas; no dependenciascore/secretos/hosting.


### Resultado11c2a2 — Vistas personales en MongoDB

Repo server-only propio/session/singleton poractor+itemId, claveMongo compuesta validada yrevisiónpositiva compartida conplanner. Read incluye tombstone, insert inicial yCASrevision/createdAt/activo, duplicateidentityfalse fuera desession ypropagación dentro. CategoríaUUID/null validada; índice único userId/itemId explicit, no provisionado porbootstrap. Persistencia no concede acceso acontenido: executor posterior debe verificar item/tag vigentes enmisma transacción; no nuevoscallers/envíos/ACK activos.

Worker solointegrationtest/runner; rootrepositorio/schema/registry/plan. RunnerMongoDBpropio exit0:25pass/0fail/215aserciones en6archivos; cuatro pruebas nuevas/47aserciones deaislamiento conUUIDigual, metadata/propiedad, CAS/conservar/quitarcategoría/tombstone, corrupción yrollback múltiple/duplicado ensession. Contenedor/tmpfs propios eliminados; pinned8.2.11amd64 revalidado, noDBusuario ni secrets/hosting. Normal255pass/44opt-in skip/0fail/5002aserciones, lint364archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b0: concretar contrato deatomicidad/recibos/journal ydependencias decompatibilidad antes deimplementar ejecutor multirregistro. Preferencias aún sin sincronización activada; task.move/settings/series/compartidos posteriores.


## 11c2b0 — Contrato de transacciones personales

- Entrada15%5h/15%7d trasd65048a; secuencial/documental/int/reserva10%. Últimos repositorios consumieron7 y5 puntos5h entrecierres, sinatribución exclusiva; otrocódigo+reparación podría cruzarreserva.
- `target_paths`: `plan/{preference-transactions,preference-sync,master,iterations,iteration-log}.md`.
- Objetivo: concretar resultados/recibos/journal versionados, historia ycontador compartidos, autorización ypruebas deconcurrencia antes del ejecutor. Dependencias repos11c2a1/2 yDTO/planners previos.
- Aceptación: no nuevas colecciones/locks, activarjournal ni cambiarwire; propuesta explícita decompatibilidad/adaptación readonly yreserva debyteguard deenvoltura; races decontador/multirregistro/permisos/replay identificadas sin declararlas probadas. Cortes siguientes conaceptación ydependencias, no ACK sincommit remoto.
- Validación: referencias locales exactas, coherencia/candidata/diff; commitpush/HEAD/cuotas. Código yDB sin cambios; no repetirbuild porMarkdown.


### Resultado11c2b0 — Contrato transaccional siguiente

Documento preference-transactions.md concreta envolturas/resultados/recibos/journal versionados, adaptación readonly dehistoria item yfingerprint deintenciónv1 conservado. Comparte contador/receiptidentities vigentes, conjuntos multirregistro atómicos yautorización decontenido previa aview. Límite512KiB cubre envolturaUTF8, no solo DTO interno. Hipótesis decontador común para coherencia devecinos yviewfrente adelete queda explícitamente pendiente de prueba conbarreras/Mongo; no seintroduce lock ni seafirma garantía sinprueba.

Separa11c2b1 contrato puro,11c2b2 ejecutor/atomicidad,11c2b3 carreras con snapshots solapados, luego compatibilidad/ACK/pull/backup/dosdispositivos antes deactivar. Header depreferencias actualizado yrefs/coherencia/diff comprobados. Sin código/DB/secretos/hosting ni nuevoACK; builds/pruebas anteriores vigentes. Cierre del lote: último código d65048a comprobado, todo concommit/push. Entrada15%/15%; últimos cortes de repos consumieron7/5puntos5h, conuso compartido incierto; no iniciar otra implementación conpruebas/reparación/cierre quepueda cruzarreserva10. Reanudar desde11c2b1 conlectura vigente.


## 15a0 — Piloto real mínimo de sesión y revisión

- Solicitud explícita del usuario trasautenticar en navegadorintegrado; entrada12%5h/15%7d, reserva10. Scope acotado readonly: verificar sesión activa y revisión manual/recarga en preproducción int. No comenzar create/edit/delete o prueba multicliente cuyo cierre/limpieza podría cruzarreserva.
- `target_paths`: `plan/{master,iterations,iteration-log,sync-test-environment}.md`; navegador pestaña36 usuario autenticada. Preservar todos sus registros ysesión; no logging tokens/PII, archivos ni accesoDBdirecto/secretos/hosting.
- Aceptación: estado UI verificado después derevisión manual yrecarga, distinguir sesión/descarga deServerAction push yconvergencia; registro preciso dequé no seprobó. Validación documental refs/coherencia/diff, commitpushint/HEAD/cuotas.


### Resultado15a0 — Preproducción autenticada

Usuario completó autenticación en pestaña integrada36 yworkspace real quedó accesible. EnAjustes, revisión automática pasa deSincronizando aÚltima revisión terminada/Sin cambios locales pendientes. Pulsación manualSincronizar ahora repite transición yrecupera botón; recarga conserva sesión, cuatroelementos existentes yestado preparado, yotra revisión automática termina. No se cambian contenidos/tareas/categorías ni se crean registros de prueba, no se accede aDBdirectamente, no se registranidentidad/tokens. Pestaña visible conservada parausuario.

Evidencia limitada: sesión real, shell/preparación yrevisión/descarga concola vacía funcionando enint protegido. Coordinador llama pull ysolo push al seleccionar intención ([coordinator.ts:105](../src/features/sync/coordinator.ts:105), [coordinator.ts:159](../src/features/sync/coordinator.ts:159)); por tanto **no demuestra ServerActionpush con escritura/ACK ni convergencia real entre dispositivos**. Piloto siguiente debe crear únicamente elementos propios identificados de prueba, comprobar ACK durable/recarga ylimpiar conborrado normal, conpresupuesto suficiente; no ampliar15a0 alestado delusuario. No pruebaoffline completo ni logout/login multicliente.

Documentación/refs/coherencia/diff aprobados; código/build anterior vigente, commitpushint ycuotas alcierre. Entrada12%/15%, solo dospuntos5h sobre reserva10: no abrirmutación ylimpieza ni repararproblemas nuevos. Próxima implementación sigue11c2b1; piloto escritura real pendiente15a1.


## 15a0b — Calendario y navegación móvil real

- Usuario solicita probaralgomás con9%5h, excepción puntual por debajo dereserva10; solo corte mínimo readonly ysu cierre, sin ampliar implementacióndelote ni mutacionesdelusuario.
- `target_paths`: `plan/{iterations,iteration-log,sync-test-environment}.md`; pestaña autenticada depreproducción, viewport móvil temporal/restaurado.
- Objetivo/aceptación: calendario mensual/día actual muestra elementos propios yaexistentes, navegación móvil accesible, sin overflowhorizontal; sesión/datos preservados. No introducir registros ni falsa prueba deACK/2dispositivos.
- Validación: UI real/DOM readonly, referencias/coherencia/diff, commitpushint/HEAD/cuotas. No repetirchecks decódigo porregistroMarkdown.


### Resultado15a0b — Móvil real sin mutaciones

Preproducción autenticada conviewport390x844 temporal: calendario octubre2026 muestra cuatroelementos el8oct yunevento quecontinúa el9oct. Cambiar aldía9 muestraese únicoevento ysin tareas; Hoy vuelve aldía8 yrestaura1tarea/3eventos. No nombres/identidades delusuario en registro. DOMreadonly: innerWidth390/scrollWidth390, enlacesdenavegación75x64px, Crear56x56px ycontroles mes>=48pxalto; no overflowhorizontal. Crear abre diálogoTarea/Evento, fecha9oct seleccionada; Cancelar cierra sin guardar. No acciones deprogreso/edit/delete ni nuevasoperaciones de prueba.

AvisoActualización disponible aparece trasdeployment: no se fuerza activación/skipWaiting nireinicio. Viewportrestaurado, pestaña/sesiónabiertas encalendariohoy. No pruebaRPCpush/ACK/2dispositivos nueva ni validaciónoffline adicional. Scopeextraordinario pedido con9%5h finalizado; noamplíareserva delplan permanentemente. Referencias/coherencia/diff aprobados ycommitpushint/HEAD/cuotas; códigoanterior vigente.


## 15a1 — Escritura real mínima en preproducción

- Usuario pide probaralgo más con7%5h: excepción puntual para piloto propio create/ACKvisible/reload/delete normal ysu cierre. Sin implementar código ni ampliar lotedesatendido.
- `target_paths`: `plan/{iterations,iteration-log,sync-test-environment}.md`; pestaña autenticada int ysolo nuevoelemento titulado `Codex sync pilot 15a1`.
- Aceptación: crear tarea simple propia desdeUI, revisión terminada/pendientes0 trasenvío, recarga conservatarea; borrar exclusivamente esa tarea desdeUI yconfirmar revisiónterminada/ausencia/elementosexistentes4. No accesoDBdirecto/tokens/secrets, cambioscore/hosting/permisos ni datosprevios. Si fallo, conservarevidencia/cerrar sin perseguirreparación amplia.
- Validación: UI realproducto conServerAction, límites sobre ACKinferido vsrecibo/2dispositivos explícitos; refs/coherencia/diff/commitpushHEAD/cuotas. No afirmar convergencia multicliente ni lectura durableACK directa sin observarla.


### Resultado15a1 — Create y delete reales

Lectura inicial real6%5h/14%7d, excepción puntual solicitada con7. Enint protegido con sesión real/navegadorintegrado: Crear desdecalendario8oct, títuloexclusivo `Codex sync pilot 15a1`, guardar tarea simple. Calendario pasa4→5elementos; Ajustes5guardados, revisiónautomática termina ycola visible sinpendientes. Recarga conserva sesión/5elementos; Mi espacio muestra la tarea exacta despuésderecarga. No seam defixture: UI/coordinador/transporte delproducto real.

Limpieza únicamente deesa tarea: abrir susdetalles, Eliminar yconfirmar diálogo normal. Elemento desaparece, Ajustes vuelve4guardados; se observa1pendiente→Sin cambios locales pendientes/Última revisión terminada. Captura visual delestado limpio/revisado tomada; pestaña/sesión abierta enAjustes. Cuatroelementosprevios conservados, sin editar/progreso/categorías delusuario ni accesodirectoDB/tokens/secrets. El borrado conserva tombstone/historia normal: no purge. Aviso deactualización disponible permanece sin forzarworker/reinicio.

La evidencia deUI confirma recorrido real deescritura+envío/revisión yborrado confirmado porelproducto, conpersistencia trasrecarga. ACK se infiere del estado durablevisible sinpendientes; no se inspeccionó reciboMongo/registroACK directamente. No demuestra convergencia dedosdispositivos reales, pérdida derespuesta o conflictos; evidenciaaislada previa sigue separada. Piloto multicliente15a2 pendiente ycontratos11c2b1 siguientes conpresupuesto nuevo.

Validación documental coherencia/diff ycommitpushint/HEAD/cuotas; código/build previo vigente. Excepción deesta petición finalizada, sin abrir reparaciones ni ampliarla indefinidamente.


## 11c2b1a — Resultados versionados puros

- Reanudación explícita delusuario tras92bcb94: nueva5h100%, semanal13%, reserva10ambas; secuencial. Se divide11c2b1 enresultados(a), recibos(b) yjournal(c) para cierres pequeños.
- `target_paths`: `src/schemas/remote-operation-result-v2.ts`, `src/types/remote-operation-result-v2.ts`, `src/lib/sync/remote-operation-result-v2{,.test}.ts`, `plan/{master,workflow,iterations,iteration-log,preference-transactions,preference-sync}.md`.
- Dependencias: DTOefectos11c1a, resultadoitem vigente, contrato11c2b0; noNext/runtime/IO/DB.
- Objetivo: envoltura discriminada kind=item/preference conoutcome propio, estados applied/conflict/errores, validación completa yadaptación readonly delresultado legacy. Reutilizar schema item actual sin reescribir payload/recibos/digest.
- Aceptación: personalapplied operationId coincideDTO, conflict unefecto positivo sinsequence; variantes/campos extras/futuro/propiedad sevalidan, expectedUserId externo comparado cuando resultado llevadatos, salida independiente.512KiBUTF8 envoltura completa, no sólo efectosinternos. Legacyresultado soloenmemoria→item/outcome, sinpretenderactualizarwire/recibos/journal/ACK.
- Validación: applied/conflict/errores ambasfamilias, legacy exacto/clones, dueños/operationIDs incoherentes, no sequence enconflict/errores, límitesUTF8 yDTOcasi límite cuyaenvolturaexcede, futuro/ambiguo/invalid; suite/lint/tipos/build/diff, plan/commitpushHEAD/cuotas.


### Resultado 11c2b1a — Resultados versionados

Envoltura pura kind=item/preference con outcome discriminado; item reutiliza schema vigente, personal applied contiene DTO completo y exige misma operationId, conflict conserva un efecto positivo/tombstone sin sequence. Errores estrictos no conceden ownership ni ACK. Verificador exige expectedUserId válido y compara propietario de todo resultado con datos. Decoder reconoce variante nueva o legacy estricto, adapta legacy solo en memoria y devuelve clones; no modifica intención/fingerprint/historia, wire activo, DB o localACK.

Guard512KiB UTF8 de envoltura completa. Cuatro pruebas/53aserciones: seis estados item/legacy, personales, conflictos/tombstones, cuenta/identidad/sequence/extra/futuro/ambiguo, independencia y DTO interno válido que excede límite al envolverlo. Se corrigieron literales TS de fixtures sin cambiar contrato. Normal259pass/44opt-in skip/0fail/5055aserciones; lint368archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2b1b: recibo explícito versión2, actor/op/fingerprint/resultado/fecha coherentes, decode legacy readonly y guard de recibo completo, sin activar writes. Después11c2b1c journal. Con cuotas compartidas, elegir por consumo observado de ambas ventanas, no equivalencia entre sus porcentajes.


## 11c2b1b — Recibos versionados puros

- Entrada96%5h/13%7d tras91790aa; secuencial/reserva10ambas. Coste anterior4puntos5h, semanal sin cambio visible; no equivalencia entreporcentajes.
- `target_paths`: `src/schemas/remote-operation-receipt-v2.ts`, `src/types/remote-operation-receipt-v2.ts`, `src/lib/sync/remote-operation-receipt-v2{,.test}.ts`, helper depropietario en `src/schemas/remote-operation-result-v2.ts` ysu verificador puro existente, `plan/{master,iterations,iteration-log,preference-transactions,preference-sync}.md`.
- Objetivo/dependencias: recibo estrictoversión2 reutilizando resultados11c2b1a yschema legacy actual; actor/op/fingerprint/fecha/resultado coherentes. Helper único depropietario reutilizado por resultado yrecibo.
- Aceptación: resultadoopigualreceipt op, dueño resultadoigualactor si haydatos, expectedUserId externo validado/comparado incluso enrechazos sincontenido. Guard512KiBUTF8 de recibo completo; legacy adaptado readonly confecha/fingerprint/payload intactos, clones, sinconceder permiso/ACK porvalidación dearchivo. Unknown/ambiguo/extra/incoherente rechaza; no IO/wire/DB/metadata activa.
- Validación: variantesdatos/errores, legacy/status/identidad/propiedad/digest/fecha/versiones, resultado válido cuyorecibo excedelímite, clones; suite/lint/tipos/build/diff/plan/commitpushHEAD/cuotas.


### Resultado 11c2b1b — Recibos versionados

Schema puro recibo explícito versión2 reutiliza resultados item/preference; identidad de operación coincide outcome, actor coincide propietario de resultado con datos y expectedUserId externo incluso en errores sin contenido. Propietario extraído mediante helper único compartido por resultado/recibo. Digest64hex y fecha se preservan: decoder legacy readonly conserva payload y devuelve clones, no verifica commit remoto/digest/acceso actual ni concede ACK al importar archivo. Guard512KiBUTF8 cubre recibo completo además del resultado.

Tres pruebas/39aserciones cubren seis resultados legacy y personal, clones, errores/tombstone/conflict, cuenta/ID/digest/fecha/versión/extras/ambigüedad; resultado válido que excede límite al añadir metadata rechazado. Aviso opcional-chain yformato deguardia defixture corregidos, lint sin ruido. Suite262pass/44opt-in skip/0fail/5094aserciones; lint372archivos, tipos/build34recursos/diff-check aprobados. No wire/IO/DB ni escritores activos ampliados.

Siguiente11c2b1c: journal versionado/discriminado, adaptación legacy sin huecos ni reescrituras, validación recipient/op/sequence/efectos y envoltura completa; luego ejecutor atomicidad con pruebasMongo propio antes deactivar.


## 11c2b1c — Journal versionado puro

- Entrada93%5h/12%7d tras21d50ef, secuencial/reserva10ambas; recibos3puntos5h/1semanal observados, pequeño contrato comparable con cierre.
- `target_paths`: `src/schemas/remote-change-v2.ts`, `src/types/remote-change-v2.ts`, `src/lib/sync/remote-change-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-transactions,preference-sync}.md`.
- Objetivo/dependencias: journal estrictoversión2 kind=item/preference, reutiliza schemaitem/DTOefectos previos. Mantiene recipientUserId/operationId/sequence enraíz paraqueries/índices existentes; validaciónpersonal exige coincidir conDTO interno. Una operación, unaentrada ysequence aunque múltiples efectos.
- Aceptación: actor esperado externo, ID/sequence/owner positivos/coherentes, outerguard512KiBUTF8; decodelegacy sóloenmemoria, payload intacto/clones, futuro/extras/ambigüedad rechazados. No filtrar registros personales dehistoria mixta ni cambiarcheckpoint; helpers individuales no implementan lector/paginación/ACK ni activanwriters/índices.
- Validación: mixedlegacy/personal orden/topkeys, multirregistro/tombstone, owners/IDs/sequences/extras/futuro, bytewrapper, clones; suite/lint/tipos/build/diff/plan/commitpushHEAD/cuotas.


### Resultado 11c2b1c — Journal versionado

Schema puro versión2 discriminado item/preference conserva recipientUserId/operationId/sequence en raíz paraqueries/índices vigentes; variante item reutiliza schema actual/refinamiento deowner. Personal exige mismo actor/operationId/sequence en DTO interno y conserva multirregistro/tombstones en una entrada. Verificador externo valida actor esperado; decoder adapta legacy sólo en memoria, con clones ysin filtrado/reindexación/checkpoint. Guard512KiB UTF8 incluye envoltura completa.

Tres pruebas/27aserciones: historial mixto secuencias1/2 ytopkeys intactos, dos efectos/un tombstone, independencia, IDs/owners/sequence/extra/ambiguo/futuro, DTO válido cuyojournal excede porenvoltura. Suite265pass/44opt-in skip/0fail/5121aserciones; lint376archivos, tipos/build34recursos/diff-check aprobados. No DB/IO/escritor/ruta/wire/ACK/pull activo nuevo; adaptación individual no implementa paginación ni garantiza convergencia por sí sola.

11c2b1a–c completan contratos preparatorios separados deactivación. Siguiente11c2b2: ejecutar conjuntos deefectos, contador/journal/recibo conmisma sesión yautorización vigente, replay/CAS/fallos tardíos conMongo propio; dividir antes deabrir segúncuota yconservarreserva10.


## 11c2b2a — Lectura común de recibos en MongoDB

- Entrada91%5h/12%7d trasc12a18a, secuencial/reserva10. Se divide ejecutor11c2b2 antes deabrir: lectura común(a), mutaciones/recibo/journal atómicos(b) yfallos/carreras segúncoste posterior.
- `target_paths`: `src/lib/db/remote-operation-receipts{,.integration.test}.ts`, `scripts/sync-db-test-runner.ts`, `plan/{master,iterations,iteration-log,preference-transactions,preference-sync,sync-test-environment}.md`.
- Objetivo: función server-only readRemoteOperationReceipt(actorInput,operationIdInput,session?) desde colección vigente/singleton, normaliza legacy/v2 enmemoria condecoder11c2b1b. Queryactor+op yaindexado/implementado: noíndice nuevo ni alteración bootstrap/DBreal.
- Aceptación: leer recibo propio completo/null, op/request yresultado coherentes, cuenta validada ysin fugas; quitar sólo_id interno, rechazar corrupción/futuro envez deretornar parcial. PropagaClientSession para replay atómico futuro; no escritores/ACK/envíos/ejecutor nuevo.
- Validación: MongoDBpropio sameoperationId dosactores, legacy/personalversion2, corrupción op/resultado/cuenta, snapshot-sessionvisibility/rollback defixture yrequests inválidos. Runnerowncleanup, normal/lint/tipos/build/diff/plan/commitpushHEAD/cuotas.


### Resultado 11c2b2a — Lectura común de recibos

Función server-only poractor+operationId validados, colección vigente/singleton yClientSession opcional. Quita únicamente_id yreutiliza decoder legacy/v2, valida coherencia ydevuelve clones/null sin IOextra/escrituras. Consulta ya cubierta por índice único actorUserId/operationId vigente; no requiere índice nuevo yno activa colecciones personales. No callers productivos nuevos ni cambio deejecutor/wire/ACK.

MongoDB propio runner28pass/0fail/231aserciones en7archivos; tres nuevaspruebas: mismoUUID entreactores/legacy+personal/independencia/requests inválidos; corrupción/futuro rechaza yfixture restaurada; receipt visible sólo dentro desession yrollback intacto. Runner revalida disponibilidad medianteimagen fijada/guards, contenedor/tmpfs propios eliminados; noDBusuario/secrets/hosting. Fixtures ajustan_id string ydiscriminantes literales a tipado deldriver. Normal265pass/49opt-in skip/0fail/5121aserciones, lint378archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b2b: mutaciones multirregistro propias + contador compartido + journal/recibo enmisma sesión, replay/CAS/fallos tardíos ypruebasMongo;11c2b3 probará carreras conbarreras antes deactivar. Este lector no verifica digest contraintención por sísolo: futuroexecutor debe comparar fingerprint yautorización vigente. Elegir siguientecorte trascuotas, reservando margen de reparación/cierre ysin equiparar porcentajes deventanas.


## 11c2b2a2 — Replay común ligado a la intención

- Entrada 85% de 5h / 11% semanal; petición «Siguiente», secuencial y reserva 10% en ambas ventanas. Corte mínimo previo al ejecutor, sin abrir mutaciones personales.
- Objetivo: comprobar el fingerprint canónico de la intención v1 contra el recibo propio legacy/v2; replay devuelve el resultado durable normalizado o null, y reutilizar UUID con otro contenido lanza el error compartido de identidad.
- `target_paths`: `src/lib/db/remote-operation-receipts{,.integration.test}.ts`, `src/lib/sync/operation-identity-reuse.ts`, reexport compatible en `src/lib/db/remote-item-commands.ts`, `plan/{master,iterations,iteration-log,preference-transactions}.md`.
- Dependencias: lector 11c2b2a, fingerprint vigente, schemas v1/v2; consulta existente actor+operationId ya indexada. No nuevos índices, escritores, callers, wire ni ACK.
- Aceptación: intención validada antes de IO, actor externo validado, comparación de digest calculado en servidor sin aceptar digest del cliente; error de clase idéntica al executor vigente. Propagar sesión, conservar historia y no conceder autorización por el recibo.
- Validación: Mongo propio, replay legacy/v2, orden de propiedades equivalente, cambios de base/payload/familia con mismo UUID rechazados, aislamiento por actor, invalid input, historia intacta y visibilidad transaccional/rollback. Suite normal, lint/tipos/build/diff, commit+push int/HEAD y cuotas.


### Resultado 11c2b2a2 — Replay ligado a la intención

`readRemoteOperationReplay` valida actor e intención antes de IO, calcula el fingerprint v1 canónico en servidor y compara contra el recibo propio legacy/v2 leído en la sesión suministrada. Devuelve resultado normalizado/null; UUID reutilizado con otra base, contenido o familia lanza `OperationIdentityReuseError`. Clase extraída a módulo server-only compartido y reexportada desde el executor item, conservando compatibilidad y comportamiento activo. No acepta digest del cliente, no escribe ni concede autorización/ACK por el recibo; el servicio futuro debe aplicar su política de acceso. Query ya cubierta por índice actor+operationId, sin nuevos índices ni callers productivos.

MongoDB aislado: 29 pruebas, 249 aserciones, cero fallos; legacy/personal, orden de propiedades equivalente, aislamiento por actor, reutilización de identidad, input inválido, historia intacta y visibilidad de sesión/rollback. Contenedor y almacenamiento propios eliminados. Suite normal 265 pass/50 opt-in skip/0 fail/5121 aserciones; lint 379 archivos, tipos y build con 34 recursos neutrales aprobados. Se corrigió únicamente el literal discriminante de una fixture tras detectar el error de tipos. Diff comprobado; commit y push a int con verificación de HEAD remoto y lectura de cuotas al cierre.

Próxima candidata 11c2b2b: aplicar efectos, contador compartido, journal y recibo en una transacción; conservar pruebas de fallo tardío/replay/CAS y carreras 11c2b3 antes de activar preferencias remotas. El helper entregado es preparatorio y no activa su sincronización.


## 11c2b2b1 — Categorías con commit transaccional

- Entrada 82%5h/10%7d. Usuario reduce reserva semanal a5%; ventana5h conserva10%. Secuencial, corte de categorías separado de vistas y de carreras con barreras.
- Objetivo: aplicar catálogo propio y CAS de todos los efectos tag.save/delete/move, contador común, journal v2 y recibo v2 en una sola transacción snapshot/majority; replay canónico sin nuevas escrituras.
- `target_paths`: `src/lib/db/remote-tag-commands{,.integration.test}.ts`, `scripts/sync-db-test-runner.ts`, `AGENTS.md`, `plan/{master,workflow,iterations,iteration-log,preference-transactions,preference-sync,sync-test-environment}.md`.
- Dependencias: planners/repos tag y contratos v2, lector/replay común, índices personales explícitos sólo en DB de prueba propia. Sin callers productivos ni activación, wire/pull/ACK vigentes intactos.
- Aceptación: validar antes de IO; actor externo autenticado por futuro servicio; replay usa digest exacto, conflictos/rechazos sin secuencia, un journal por conjunto completo. CAS y duplicados abortan/reintentan con sesión fresca acotada; nada aplicado retornado por wrapper antes de commit. Etapa transaccional interna exige sesión activa y no concede ACK.
- Validación: Mongo propio commit/replay/identidad, CAS/tombstone/nombre, compactación multirregistro, rollback intencional después del recibo que revierte todos los efectos/contador/journal/recibo, dos intentos de misma operación; suite/lint/tipos/build/diff, commitpush/HEAD/cuotas. Autorización y carreras de vecinos con snapshots solapados quedan 11c2b3, no se declaran probadas aquí.


### Resultado 11c2b2b1 — Categorías atómicas preparadas

Executor server-only valida actor/intención antes de IO y usa replay común con fingerprint v1. Dentro de snapshot/majority, lee catálogo propio, aplica CAS de todos los efectos, incrementa contador compartido e inserta journal/recibo v2 completos. Wrapper devuelve resultado sólo después de commit; etapa interna exige transacción activa y su resultado no constituye ACK. Conflictos/rechazos conservan recibo sin secuencia aplicada; unsupported nuevo no escribe. Duplicados/CAS abortan y admiten hasta tres sesiones nuevas, sin continuar una sesión abortada. Índices existentes registrados cubren las consultas, los personales se provisionan únicamente en Mongo de prueba propio. Sin callers productivos, wire/pull/ACK activos ni activación personal.

Cuatro escenarios nuevos Mongo: entrega duplicada concurrente produce un solo efecto/recibo/journal; replay exacto e identidad reutilizada; CAS/tombstones/nombres NFKC/aislamiento/unsupported; compactación de tres revisiones y fallo después del recibo que revierte efectos, contador, journal y recibo; historial mixto item/category/item conserva secuencias1/2/3 y registros legacy intactos. No equivalen a barreras de snapshots solapados de11c2b3. Total Mongo33pass/0fail/305aserciones en8archivos, recursos propios eliminados. Normal265pass/56opt-in skip/0fail/5121aserciones; lint381archivos, tipos/build34recursos/diff aprobados. Tipos de_id y refinamiento de fixtures corregidos antes del cierre.

Reserva vigente actualizada por solicitud humana:10%5h y5%7d, evaluadas por margen y coste propios. Próxima11c2b2b2: executor de vista personal con autorización de item/tag dentro de la misma transacción; después11c2b3 carreras de catálogo y autorización con barreras. Antes de activar cualquier writer personal deben existir lectores/handshake/ACK/pull compatibles.


## 11c2b2b2 — Vista personal con autorización transaccional

- Entrada77%5h/10%7d tras19c15dc publicado/verificado. Reserva10%5h/5%7d, secuencial.
- Objetivo: item-view.set para item propio simple activo, tag propio activo/null y CAS de vista personal dentro de snapshot/majority. Reutilizar contador/journal/recibo/retry en helper común con categorías para evitar dos implementaciones de invariantes.
- `target_paths`: `src/lib/db/remote-preference-transactions.ts`, `src/lib/db/remote-tag-commands.ts`, `src/lib/db/remote-item-view-commands{,.integration.test}.ts`, `scripts/sync-db-test-runner.ts`, `plan/{master,iterations,iteration-log,preference-transactions,preference-sync,sync-test-environment}.md`.
- Dependencias: planner/repos de vista/item/tag, contratos v2, lector/replay y executor tag11c2b2b1. Helper sólo DB server-only, APIs actuales conservadas; índices centrales ya cubren consultas, explícitos sólo en prueba.
- Aceptación: validar actor/intención antes de IO; sin contenido ajeno/deleted ni series/birthday. Vista no altera item/progreso; categoría ajena/deleted rechaza. Nuevos efectos, contador, journal y recibo atomizan juntos. Replay histórico conserva resultado/digest sin repetir efectos ni conceder acceso al contenido; stage no es ACK y wrapper responde tras commit. Sin callers/wire/pull/activación nuevos.
- Validación: Mongo propio asignar/cambiar/quitar categoría, CAS, contenido sin modificación, aislamiento y contexto eliminado/unsupported, duplicados/replay/UUID reutilizado, rollback tras recibo. Regresión íntegra de categorías y suite/lint/tipos/build/diff, plan/commitpush/HEAD/cuotas. Carreras de autorización con snapshots solapados se prueban posteriormente en11c2b3.


Durante11c2b2b2, el usuario reduce de nuevo la reserva semanal al2%; 5h mantiene10%. Actualización de AGENTS/workflow en el mismo commit de implementación. No equiparar porcentajes ni iniciar cortes que puedan cruzar el margen vigente.


### Resultado11c2b2b2 — Vista personal atómica preparada

item-view.set lee item/vista/tag propios dentro de la sesión, limita contexto a contenido simple activo y aplica CAS sin editar el contenido/progreso. Tag ajeno o eliminado rechaza; vista propia de un item ajeno no concede permiso. Contador/journal/recibo/retry extraídos a helper server-only reutilizado con categorías; guardias de transacción, contratos/bytes y comportamiento de categorías conservados. Wrapper responde tras commit; stage no es ACK. Replay histórico conserva resultado/fingerprint exactos sin reescribir estado o conferir acceso a contenido. Unsupported de cumpleaños/series conserva recibo sin efectos ni sequence; tipos de comando fuera del executor no escriben. Sin callers, wire/pull/ACK ni índices productivos nuevos.

Cuatro escenarios nuevos: asignar/cambiar/quitar y stale-CAS, entrega duplicada/replay y contenido intacto; aislamiento mediante item/tag ajenos y eliminados; fallo después del recibo revierte vista/contador/journal/recibo; evento simple soportado y cumpleaños/serie conservados como unsupported. Regresión real de categorías también aprobada. Mongo aislado37pass/0fail/363aserciones en9archivos, recursos propios eliminados. Normal265pass/62opt-in skip/0fail/5121aserciones, lint384archivos, tipos/build34recursos/diff aprobados.

Petición humana durante esta entrega reduce reserva semanal5→2%; 5h sigue10%. AGENTS/workflow actualizados en este commit, entradas históricas conservadas. Tras commit/push y HEAD/cuotas, próxima11c2b3: barreras para snapshots solapados, coherencia de vecinos/create/delete/nombres y autorización de vista frente a delete. Pruebas secuenciales de acceso no demuestran todavía ese aislamiento concurrente. Compatibilidad/handshake/ACK/pull siguen obligatorios antes de activar.


## 11c2b3a — Carreras deterministas sobre contexto leído

- Entrada74%5h/9%7d tras0694e49 publicado. Secuencial, reserva10%5h/2%7d.
- Objetivo: probar la hipótesis del contador compartido con snapshots realmente solapados, sin hooks productivos: barreras de tests en lecturas de catálogo/item/tag antes de un commit concurrente.
- `target_paths`: `src/lib/db/remote-preference-races.integration.test.ts`, `scripts/sync-db-test-runner.ts`, `plan/{master,iterations,iteration-log,preference-transactions,preference-sync,sync-test-environment}.md`. Si evidencia muestra bug, abrir reparación acotada antes de cerrar; no activar writers.
- Dependencias: executors tag/view/common ledger11c2b2b1/2 y executor item vigente; Mongo aislado e índices registrados explícitos sólo allí.
- Aceptación: movimiento que leyó vecinos frente a creación/borrado relee catálogo y no aplica orden inválido; vista que leyó item activo frente a delete y categoría activa frente a delete relee autorización y no deja efectos/counter/journal aplicados. Nombres NFKC concurrentes producen un solo activo y rechazo durable del perdedor. Demostrar lecturas repetidas y secuencias/recibos coherentes, sin añadir locks al producto ni usar temporizadores para decidir el orden.
- Validación: barreras y cleanup de spies/sesiones propios incluso al fallar, pruebas Mongo completas, suite/lint/tipos/build/diff y plan/commitpush/HEAD/cuotas. No declarar convergencia ni activación; compatibilidad/ACK/pull posteriores.


### Resultado11c2b3a — Snapshots solapados comprobados

Cinco carreras deterministas en MongoDB propio, mediante spies de lectura y barreras de promesas exclusivamente en tests. Movimiento pausa catálogo vigente; create/delete de vecino confirma primero; al reanudar, target no comparte escritura con el vecino pero contador común provoca retry/relectura y invalid_command durable sin efectos del movimiento. Vista pausa lectura de item/tag activo; delete confirma primero; retry observa tombstone y responde unavailable/invalid_command sin vista ni journal/sequence applied. Colisión de nombre NFKC pausa catálogo antiguo, ganador confirma; inserción perdedora aborta por unicidad y reclasifica sobre snapshot fresco. Se comprueban lectura repetida/tombstone observado, revisiones del target intactas, secuencias sin huecos, recibos durables y ausencia de journal del perdedor. Barreras/spies restaurados y operaciones drenadas incluso al fallar.

La hipótesis del contador compartido queda demostrada para los contextos propios activos ensayados, incluyendo efectos en documentos disjuntos y permiso frente a borrado; la unicidad de nombres se prueba por separado y no sustituye el contador. No se introducen locks, hooks productivos ni temporizadores para ordenar commits. No extender la evidencia a permisos compartidos o series, aún no soportados.

Mongo42pass/0fail/412aserciones en10archivos; recursos propios eliminados. Normal265pass/69opt-in skip/0fail/5121aserciones, lint385archivos, tipos/build34recursos/diff aprobados. Sin código productivo nuevo ni activación. Próxima11c3a: contrato mixto de transporte/descarga y compatibilidad, antes de readers/ACK/pull/backup/dos dispositivos y provisionamiento explícito. Commit/push/HEAD/cuotas al cierre, reserva10%5h/2%7d vigente.


## 11c3a1 — Contrato puro de descarga mixta

- Entrada71%5h/9%7d tras87088f2, secuencial/reserva10%5h/2%7d.
- Objetivo: página explícita versión2 con cambios item/preference v2 normalizados, límites por página y verificación externa de actor/query/cursor. Una secuencia propia completa, sin filtrar preferencias.
- `target_paths`: `src/schemas/remote-changes-page-v2.ts`, `src/types/remote-changes-page-v2.ts`, `src/lib/sync/remote-changes-page-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions}.md`.
- Dependencias: journal v211c2b1c, query puro vigente y races11c2b3a; sin IO, Next, DB, cursor/ACK ni callers activos.
- Aceptación: propiedades estrictas, versión2, hasta100 cambios con secuencias consecutivas/operationIDs únicos, último igual nextAfter, hasMore/checkpoint coherentes. Verificador expectedUserId/query externo exige primer after+1, número<=limit, through congelado exacto si solicitado; página vacía no avanza ni deja hueco. Salida independiente. Límite2MiB UTF8 de página completa (cada journal<=512KiB), permite al futuro reader emitir menos que limit pero nunca truncar un registro. Legacy página/futuro rechazados; futuro reader adaptará registros legacy íntegros a item/v2 antes de producir la página.
- Validación: mezcla normalizada y tombstones, clones, páginas inicial/continuación/vacía, cuenta/query/saltos/duplicados/checkpoint/extras/futuro, máximo100 y UTF8; límite global que supera sumando registros individualmente válidos. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Contrato no negocia compatibilidad ni concede permisos/convergencia.


### Resultado11c3a1 — Descarga mixta validada

Schema/type/verificador puros para página explícita versión2 con journal item/preference normalizado íntegro. Hasta100 registros, secuencias consecutivas y operationIDs distintos; nextAfter/checkpoint/hasMore coherentes. ExpectedUserId y query externos comprueban cada receptor, after+1, limit y through congelado. Página vacía no avanza ni oculta huecos. Salida clonada, futuro/extra/legacy página rechazan; adaptación readonly de registros legacy sigue siendo tarea del futuro reader antes de crear el envelope. No IO, wire/ACK/cursor/DB ni callers activos nuevos.

Guard2MiB UTF8 para página completa, separado de512KiB por journal. Permite futura paginación de menos registros que limit, nunca truncar contenido; cabe cualquier primer registro admitido con metadata. Cuatro pruebas/58aserciones nuevas cubren mezcla/tombstones/clones, continuación/checkpoint/vacío, dueño/query/saltos/duplicados/extra/futuro/100máximo y página Unicode que excede bytes aun siendo válidos todos sus registros individuales. Fixture de duplicados corregida para reutilizar realmente el UUID del primer registro. Suite269pass/69opt-in skip/0fail/5179aserciones, lint389archivos, tipos/build34recursos/diff aprobados; sin repetir Mongo por este contrato puro.

Próxima11c3a2: reader Mongo propio mixto con snapshot/cursor/byte-paginación sin filtrar historia, seguido de handshake/transporte y ACK/pull/backup compatibles antes de activar. Contrato puro no negocia compatibilidad, concede permisos ni prueba convergencia. Reserva10%5h/2%7d; commitpushHEAD/cuotas al cierre.


## 11c3a2 — Reader Mongo mixto sin omisiones

- Entrada67%5h/8%7d tras1b56930, secuencial/reserva10%5h/2%7d.
- Objetivo: lector server-only preparatorio de journal propio legacy/v2, adaptación readonly, snapshot/checkpoint congelado y paginación por count/2MiB sin filtrar entradas personales ni partir registros.
- `target_paths`: `src/lib/db/remote-changes-v2{,.integration.test}.ts`, `scripts/sync-db-test-runner.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,sync-test-environment}.md`.
- Dependencias: contrato página11c3a1, decoder de journal, repos propios/executors/races vigentes; índices existentes recipientUserId/sequence y repos personales centrales explícitos sólo en DB propia. Sin nuevos índices ni callers/route/wire/ACK/pull activos.
- Aceptación: input validado antes de IO, actor externo confiable, secuencia contigua completa a través de ambos dominios. Counter/checkpoint y autorizaciones actuales en la misma snapshot. Item exige pertenencia actual, incluso histórico; tag/view exigen documento propio actual y vistas acceso al item/tag referenciado, conservando tombstones. Stores personales aún sin executor rechazan sin omitir ni avanzar. Futuro/corrupción/hueco/permiso ausente rechaza página íntegra. Límite de bytes emite prefijo contiguo y hasMore, cursor cerrado incluso al fallar. Legacy DB intacta.
- Validación: Mongo propio mezcla ejecutores reales, checkpoint congelado/incremental/tombstones, aislamiento/cursor futuro/input inválido, corrupción/huecos/autorización ausente con restauración de fixture, página por bytes y continuación íntegra. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. No activar lectores en transporte ni proclamar convergencia.


### Resultado11c3a2 — Reader mixto preparatorio

readRemoteChangesV2 valida actor/query antes de IO y lee contador/journal/autorización en una misma snapshot. Adapta registros legacy readonly a item/v2, conserva cada efecto personal y secuencias sin huecos. Consulta recipientUserId/sequence usa índice vigente; count<=100 y byte-paginación2MiB con tamaño exacto de registros/commas/envelope, sin partir entradas. Cursor siempre cerrado. Checkpoint congelado y error de cursor futuro conservados.

Item exige pertenencia actual incluso para historia; categorías exigen registro propio actual y vistas documento propio más acceso propio al item/tag referido. Tombstones preservan ownership y permiten descargar historia anterior intacta; ausencia/futuro/corrupción/store personal aún sin executor rechazan página sin filtrar ni avanzar. No callers/rutas/transporte/ACK/pull productivos nuevos, ningún índice nuevo ni provisionamiento personal fuera de test propio.

Cuatro escenarios nuevos Mongo: journal mixto producido por executors reales y checkpoint/incremental tras deletes; aislamiento/cursor/input inválido; huecos/futuro/corrupción/settings no soportado/item con owner cambiado/vista ausente, fixtures restauradas;28tareas grandes en fixtures transaccionales propias, dos páginas por UTF8 con28secuencias y checklist completo en todas. Esta última fixture prueba reader/bounds, no ACK de escritura real. Mongo46pass/0fail/475aserciones en11archivos; recursos propios eliminados. Normal269pass/75opt-in skip/0fail/5179aserciones, lint391archivos, tipos/build34recursos/diff aprobados.

Próxima11c3b1: contrato de respuesta push mixta/versionada y compatibilidad transporte2/intención1, sin activar todavía. Después servicios/handshake, metadata/ACK/pull/backup y prueba de dos dispositivos antes de activar preferencias. Reserva10%5h/2%7d vigente, commitpushHEAD/cuotas al cierre.


## 11c3b1a — Contrato push mixto e intención intacta

- Entrada63%5h/8%7d tras28e6874 publicado, secuencial/reserva10%5h/2%7d. Se separa contrato puro del handshake/servicio/activación.
- Objetivo: input explícito transportVersion2 con intenciones durables1 sin reescribir payload/UUID; respuesta status/version2 con resultados item/preference y prefijo retry. Verificador relaciona request/cuenta/orden/familia/outcomes, sin ACK/IO.
- `target_paths`: `src/schemas/remote-push-v2.ts`, `src/types/remote-push-v2.ts`, `src/lib/sync/remote-push-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions}.md`.
- Dependencias: input/operaciones actuales, resultados v2 y reader mixto; ningún cambio de config activa/ServerAction/cola/DB.
- Aceptación: input estricto transport2, versión de operación1 conservada; UUIDs únicos y envoltura completa<=512KiB UTF8. Response completa o prefijo retry_later exacto según request, failedOperationId coincide siguiente intención, orden/IDs/familias/propietarios verificados. Rechazos generales sin resultados; results<=50/49 y respuesta completa<=2MiB, no truncar un outcome. Transport1/futuro/extras/incoherencia rechazados sin conceder ACK ni compatibilidad.
- Validación: mezcla/errores/complete/retry vacíos/parciales/clones, input2+intención1exacta, futuro/legacy/duplicados/cuenta/familia/op/desorden/truncado, request/responseUTF8 independientes. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Si response preparada excede2MiB, futuro batch responderá un prefijo completo y pedirá retry de la siguiente intención, preservando replay aunque su commit ya exista.


### Resultado11c3b1a — Push mixto preparatorio

Input explícito transportVersion2 reutiliza schema de intenciones durables1, UUIDs/operaciones intactos y fingerprint v1 sin cambios. Guard512KiB incluye envoltura completa además del batch interior. Respuesta versión2 discriminada complete/retry_later/rechazos generales, resultados item/preference strict<=50/49, operación distinta por resultado y guard2MiB completo. Verificador exige actor/request, orden/IDs/familia, resultado completo o prefijo retry exacto/failedOperationId siguiente. Dueño de datos y objetivo principal de applied/conflict coinciden con el comando; efectos multirregistro conservados. Validación no concede ACK ni negocia compatibilidad; no IO/wire/config/ServerAction/metadata/DB activos modificados.

Cinco pruebas/70aserciones: digest exacto y clones/mezcla/errores, prefijos incluidos vacío/parcial, truncado/desorden/duplicados/versiones/cuenta/familia/objetivo ajeno, batch interior válido justo512KiB cuya envoltura excede, respuestaUnicode que excede2MiB con outcomes individuales válidos y prefijo menor intacto. Tupla Zod y literales/tipo de fixtures ajustados antes del cierre; lint sin ruido. Suite274pass/75opt-in skip/0fail/5249aserciones, lint395archivos, tipos/build34recursos/diff aprobados. No repetir Mongo por contrato puro.

Próxima11c3b1b: separar versión de transporte de la intención1 en compatibilidad/config preparatoria, conservando transporte activo1 y probando negociación2/1 en ambas direcciones. Servicio mixto/metadata/ACK/pull/backup/dos dispositivos siguen antes de activar. Si response futura excede límite, conservar prefijo completo y pedir retry de siguiente intención, incluso si el commit durable ya existe: replay lo preserva, no falso fallo ni pérdida de intención. Reserva10%5h/2%7d, commitpushHEAD/cuotas al cierre.


## 11c3b1b — Negociación separada de intención

- Entrada55%5h/6%7d tras531e189, secuencial/reserva10%5h/2%7d. Corte mínimo, sin activar protocolo2.
- Objetivo: versión durable de operación1 distinta de transporte activo1; helpers de negociación aceptan versión explícita validada para preparar2 y conservan default1. Batch activo compara intención contra constante propia, no contra transporte.
- `target_paths`: `src/config/sync-protocol.ts`, `src/schemas/sync-protocol.ts`, `src/lib/sync/sync-protocol{,.test}.ts`, `src/features/sync/push-batch.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions}.md`.
- Dependencias: contrato transport2/intención1 y protocolo vigente. No nuevo caller2, ruta/ServerAction/DB/metadata ni rango activo ampliado.
- Aceptación: default y comportamiento batch actuales1 conservados; encode2 anuncia sólo2; cliente1/servidor2 y cliente2/servidor1 incompatibles. Versiones inválidas no admitidas, JSON/mínimo/máximo estrictos; versión durable de cola/fingerprint intacta.
- Validación: pruebas bidireccionales de negociación, invalid versions/default y regresión de batch/transporte existentes; suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Servicios mixtos ymetadata/pull compatibles siguen pendientes antes de activar.


Durante11c3b1b, el usuario reduce explícitamente reserva semanal2→1%; 5h conserva10%. AGENTS/workflow se actualizan en este mismo commit sin extender autorización a créditos, reinicios ni otras ramas. Mantener margen de reparación/cierre por encima del suelo vigente.


### Resultado 11c3b1b — Compatibilidad separada de intención

La versión durable de operación conserva1 y el transporte activo conserva1, ahora con constantes distintas. El batch actual compara contra la versión de intención; helpers puros permiten anunciar/verificar una versión explícita validada sin ampliar el rango activo. Negociación2/1 se rechaza en ambas direcciones,2/2 y1/1 se aceptan; defaults y UUID/payload/fingerprint de cola intactos. No caller productivo2, cambios de DB, metadata, ACK/pull ni activación personal.

Prueba nueva de23aserciones cubre direcciones incompatibles, versión válida/explícita y valores inválidos. Suite275pass/75opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados. Contrato puro no requiere repetir Mongo. Por petición humana durante esta entrega, reserva semanal2→1%; reserva5h10% conservada, AGENTS/workflow actualizados en este mismo commit. Las entradas históricas mantienen su política original.

Próxima candidata11c3b2a: lectura común fingerprint-bound en executor item para clasificar UUID reutilizado frente a recibos personales/versionados, conservando resultado activo legacy y escrituras actuales. Después dispatcher/servicio mixto y metadata/ACK/pull/backup compatibles antes de activar. Commit/push/HEAD/cuotas al cierre, reserva10%5h/1%7d vigente.


## 11c3b2a — Replay común en executor item

- Entrada51%5h/6%7d tras52bf49d publicado; secuencial, reserva10%5h/1%7d. Corte mínimo de compatibilidad antes del dispatcher.
- Objetivo: leer recibos legacy/v2 mediante replay canónico común dentro de la transacción item, reconocer identidad reutilizada entre familias y devolver sólo outcome item compatible; resultado personal no debe convertirse en ACK legacy.
- `target_paths`: `src/lib/db/remote-item-commands{,.integration.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,sync-test-environment}.md`.
- Dependencias: decoder/replay común, executors y contratos existentes; índice actor+operationId vigente. Escritores/journal/protocolo activos1 intactos; no nuevas rutas, índices ni activación personal.
- Aceptación: replay legacy y v2 item estable y sin reescrituras; UUID con fingerprint diferente, incluyendo recibo personal, lanza identidad reutilizada antes de cualquier efecto. Resultado personal exacto rechaza por familia incompatible, no entrega ACK legacy. Actor aislado, corrupto/futuro rechaza; tests actuales de concurrencia/conflicto/rollback conservados.
- Validación: Mongo propio con fixture legacy→v2 item readonly y recibo personal real, UUID reutilizado/familia inválida sin efectos, restauración de fixtures e historia intacta. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. No declarar sincronización personal activa ni convergencia nueva.


### Resultado 11c3b2a — Replay item compatible con recibos mixtos

Executor item usa replay común dentro de su transacción snapshot y compara fingerprint canónico antes de interpretar la familia. Recibos legacy/v2 item devuelven outcome legacy independiente; recibo personal exacto rechaza por incompatibilidad sin convertirlo en ACK item. UUID reutilizado con payload/familia diferente lanza identidad reutilizada sin efectos. Escritores/journal/resultado activo1 y autorización propios conservados; índices actor+operationId vigentes, sin rutas o activación personal.

Dos pruebas Mongo nuevas: fixture de recibo item legacy adaptado a v2, replay tras tombstone, independencia de salida/historia, corrupción de dueño/futuro y restauración; recibo de categoría producido por executor real, UUID reutilizado/familia incompatible sin item/journal/counter nuevos y mismo UUID permitido a otro actor. Mongo48pass/0fail/494aserciones en11archivos, contenedor/tmpfs propios eliminados. Suite275pass/77opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2b: dispatcher preparatorio para delegar por familia a executors reales, conservando validación antes de IO, replay/unsupported y resultado v2 sin activar wire2. Después servicio autenticado y metadata/ACK/pull/backup compatibles antes de preferencias remotas activas. Reserva10%5h/1%7d vigente; commit/push/HEAD/cuotas al cierre.


## 11c3b2b — Dispatcher mixto preparatorio

- Entrada49%5h/5%7d trasd7149d7 publicado, secuencial/reserva10%5h/1%7d.
- Objetivo: validar actor/intención antes de IO, delegar items simples/categorías/vistas a executors reales y devolver outcome v2 propio de la familia; sin caller productivo.
- `target_paths`: `src/lib/db/remote-operation-commands{,.integration.test}.ts`, `scripts/sync-db-test-runner.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,sync-test-environment}.md`.
- Dependencias: replay común item, executors atómicos y clasificación pura existentes. Cada executor mantiene su transacción/autoridad; sin prelectura de recibo fuera de sesión. Settings/task.move se delegan al rechazo unsupported previo al catálogo del executor personal, que comprueba replay/identidad dentro de sesión sin efectos.
- Aceptación: resultados propios válidos, identidad/familia del resultado coherentes; mezcla conserva secuencias compartidas y replay tras commits/tombstones sin reescribir; UUID reutilizado entre familias rechaza. Recibo histórico de familia incoherente no se convierte en ACK nuevo. Unsupported no crea efectos/recibo para comandos nuevos; invalid/future inputs rechazan. No nuevos índices/transportes/acciones, preferencias no activadas.
- Validación: Mongo propio routing item/tag/view, lectura mixta y replay tardío, colisión en ambas direcciones/aislamiento, unsupported/inputs y corrupción de familia restaurada. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Servicios autenticados y metadata/pull siguen después.


### Resultado 11c3b2b — Dispatcher mixto preparado

executeRemoteOperationV2 valida actor/intención antes de IO y delega a executors item/tag/view con sus transacciones reales. Items se envuelven readonly en resultado v2; personal conserva resultado íntegro. Settings/task.move pasan por rechazo unsupported previo al catálogo del executor personal, con replay/fingerprint dentro de sesión sin escribir para comandos nuevos. Resultado propio clonado, familia/operationId coherentes; historia incompatible rechaza sin relabel ni falso ACK. Sin prelectura de autorización/recibo fuera de transacción, índices nuevos ni callers productivos.

Cuatro escenarios nuevos Mongo: mezcla item/tag/view con secuencias1/2/3 y replay tardío tras delete sin reescritura; UUID reutilizado en ambas direcciones y actor aislado; unsupported e inputs futuros/extra/inválidos sin efectos y UUID reutilizado incluso para unsupported; fixture de familia incompatible rechaza y se restaura. Runner52pass/0fail/520aserciones en12archivos, contenedor/tmpfs propios eliminados. Normal275pass/83opt-in skip/0fail/5272aserciones; lint397archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2c1: envelope de clasificación transport2/intención1 y servicio batch mixto preparatorio autenticado por actor externo, prefijos/retry/identidad/bounds sin publicar nueva acción. Separar pruebas puras de política de integración Mongo si margen lo requiere; no conectar wire2 antes de metadata/ACK/pull/backup compatibles. Reserva10%5h/1%7d; commitpushHEAD/cuotas al cierre.


## 11c3b2c1 — Política de batch mixto preparatoria

- Entrada45%5h/5%7d tras3456b0f publicado, secuencial/reserva10%5h/1%7d; separar servicio puro de integración Mongo/acción activa.
- Objetivo: envelope compartido de clasificación y servicio server-only con dependencias de sesión/ejecución; transport2/intención1, lote completo validado antes de efectos, prefijo sequential/retry y resultados ligados a intención/cuenta/familia/objetivo.
- `target_paths`: `src/schemas/remote-push-v2.ts`, `src/features/sync/push-batch-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions}.md`.
- Dependencias: contratos/verificador v2 y dispatcher preparado. ReadActor debe aplicar política de sesión vigente; no confiar en actor del input. Ninguna acción pública/config transporte activa modificada.
- Aceptación: sesión ausente o cambiada sin execute; legado/futuro transporte o intención requieren actualización antes de ejecutar prefijo; inválido/inyección/duplicado/tamaño completo rechazan. Outcomes strict/versionados/propios y correspondencia verificada; identity_reuse explícito conserva familia y continúa; fallo transitorio/outcome inválido devuelve prefijo válido sin ejecutar posteriores. Antes de acumular outcome, validar respuesta completa o retry con metadata<=2MiB; si no cabe devolver prefijo previo y retry de la operación ejecutada, sin negar su posible commit durable ni perder intención/replay.
- Validación: pruebas de política con executors simulados, sesión/negociación/lote entero/secuencialidad/errores/familias y tamaño UTF8 con outcomes individuales válidos. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Integración real servicio+dispatcher en corte posterior, no nueva prueba de convergencia todavía.


### Resultado 11c3b2c1 — Batch mixto preparatorio

Envelope strict compartido reconoce transporte ausente/1/futuro e intención futura como update_required antes de interpretar comandos, tras política de actor/cuenta; inputs inválidos, inyección/duplicados/count/UTF8 rechazan antes de execute. Servicio server-only usa dependencias de sesión confiable y executor, sin acción pública ni caller activo. Execute secuencial; resultados vinculados a cuenta, orden, IDs, familia y objetivo mediante verificador puro; identidad reutilizada se devuelve con familia correcta y continúa. Fallo transitorio/outcome incoherente conserva prefijo válido y detiene posteriores.

Cada candidato incluye metadata de continuación y guard2MiB antes de acumularse; si no cabe, devuelve prefijo anterior y retry de operación ya ejecutada. Su posible commit durable no se niega: siguiente intento debe replay con UUID/fingerprint intactos, sin falso ACK ni truncamiento de outcome. Sin activar wire2, DB/índices/cola/ACK/pull actuales intactos.

Seis pruebas/59aserciones de política con executor simulado: sesión/cuenta, negociación, validación completa, secuencialidad/identidad por familia, fallo/familia/ID/owner/target incoherentes y respuesta Unicode con16outcomes individuales válidos que corta antes de2MiB sin ejecutar posteriores. Fixture unión discriminada ajustada antes del cierre. Suite281pass/83opt-in skip/0fail/5331aserciones; lint399archivos, tipos/build34recursos/diff aprobados. No repetir Mongo para política pura; prueba de servicio+executor real queda en11c3b2c2.

Próxima candidata11c3b2c2: integración del batch con dispatcher Mongo, pérdida de respuesta/replay/prefijo y clasificación de acceso/identidad, sin nueva ruta. Después metadata/ACK/pull/backup locales compatibles antes de activación. Reserva10%5h/1%7d; commitpushHEAD/cuotas al cierre.


## 11c3b2c2 — Batch y dispatcher con Mongo real

- Entrada42%5h/4%7d tras7f243b6 publicado, secuencial/reserva10%5h/1%7d; pruebas acotadas sin cambios de runtime activo.
- Objetivo: comprobar servicio batch preparatorio con executor real, pérdida de respuesta después de commit y replay sin secuencias duplicadas, identidad/acceso y respuesta grande con prefijo íntegro.
- `target_paths`: `src/lib/db/remote-operation-commands.integration.test.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,sync-test-environment}.md`.
- Dependencias: servicio de política, dispatcher, executors/reader reales; runner/índices propios vigentes. Sin acciones/rutas/colecciones/índices productivos.
- Aceptación: commit real oculto tras error devuelve prefijo anterior; retry de intención intacta replay sin efectos duplicados y posteriores avanzan una vez. UUID reutilizado clasificado por familia, acceso ajeno no concede efectos. Batch de status pequeño sobre tareas grandes supera2MiB de respuesta: excluida puede estar committed, retry debe conservar registro y evitar nuevo sequence/conflict; contenidos completos y secuencias sin huecos.
- Validación: Mongo propio casos anteriores y regresión existente, suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. No declarar ACK local/convergencia ni activar preferencias; siguiente metadata local según margen nuevo.


### Resultado 11c3b2c2 — Batch mixto probado con commits reales

Tres escenarios nuevos conectan servicio preparatorio y dispatcher con Mongo propio. Error intencional tras commit de categoría devuelve sólo prefijo item; retry con la intención original conserva recibo/sequence2 y confirma vista ensequence3, replay posterior no escribe. UUID reutilizado entre ambas familias responde identity_reuse correspondiente sin efectos; vista de contenido ajeno devuelve unavailable sin contador propio ni tocar owner.

16tareas grandes se crean individualmente, luego un batch pequeño de status produce respuesta>2MiB. Servicio devuelve prefijo íntegro, y se verifica antes de cualquier retry que la operación excluida ya tiene recibo/commit. Replay exacto conserva ledger; restantes avanzan una vez hasta32secuencias contiguas/32recibos, todas las tareas revision2/in_progress y checklist completo. No falso ACK ni pérdida de respuesta confundida con fallo remoto. Esta prueba no implementa ACK local ni equivale a dos dispositivos reales.

Mongo55pass/0fail/618aserciones en12archivos; recursos propios eliminados. Normal281pass/86opt-in skip/0fail/5331aserciones; lint399archivos, tipos/build34recursos/diff aprobados. Sólo pruebas/plan nuevos; no rutas/protocolo activo/índices productivos ni activación personal.

Próxima candidata11c3c0: contrato de transición de metadata local item/personal y backup, antes de schemas/ACK/pull/recuperación compatibles. Debe conservar intención1, chains/tombstones, historial legacy, propiedad/época, replay más antiguo y rechazar futuro/corrupto sin borrar ni avanzar. Servicio/reader preparados siguen sin callers activos. Elegir corte con cuota posterior, reserva10%5h/1%7d y margen de reparación/cierre.


## 11c3c0 — Transición de evidencia local y backup

- Entrada40%5h/4%7d trasb2d285a publicado, secuencial/reserva10%5h/1%7d; corte documental independiente antes de cambiar persistencia.
- Objetivo: definir formatos/evolución de shadow/outcome personales y backup, ordenar lectores antes de escritores y hacer explícitas invariantes de ACK/pull/incident recovery.
- `target_paths`: `plan/{local-preference-evidence,master,iterations,iteration-log,preference-sync,preference-transactions}.md`.
- Dependencias: fuentes reales schemas/local-sync, schemas/local-backup, local-db/sync-store/pull-changes/sync-incidents y backup/ownership. No código/runtime nuevo, DB ni migración ejecutada.
- Aceptación: distinguir transporte2/intención1/evidencia2/backup2/DBversion vigente; mantener registros legacy readonly y keys/indexes, evidencia completa multiefecto, ownership y snapshot observado sin inventar ancestro. Lectores estrictos antes de writers, rollback/cursor/replay/tombstones/cadenas y UI de incidentes sin elecciones prematuras. Definir cortes posteriores con rutas/pruebas, sin declarar funciones preparatorias activas.
- Validación: consistencia y referencias locales, diff-check; commitpush/HEAD/cuotas. Reservar implementación de metadata/backup y pruebas al corte siguiente según consumo observado.


### Resultado 11c3c0 — Transición local definida

Nuevo contrato `local-preference-evidence.md` basado en schemas/ACK/pull/backup/incident reader reales. Separa intención1, transporte2, evidencia2, backup2 e IndexedDB2 si stores/keys no cambian. Shadows personales por documento; outcome multiefecto con snapshots de ausencia observada, sin inventar ancestro. Lectores estrictos/backup/routing antes de writers, proyección conservadora con cadena personal y reconciliación final, ACK/pull/cursor/rollback atómicos, CAS independiente por efecto y bases enviadas inmutables.

Formatos legacy siguen readonly/clonados, desconocido/corrupto rechaza sin borrado ni cursor; importación/resolución local no fabrica ACK o permisos. Cortes11c3c1a–4 definidos con rutas/evidencias antes de coordinador/dos dispositivos/activación. Ningún schema/writer/runtime nuevo en esta entrega documental; estado preparatorio y limitaciones separados del producto activo.

Referencias locales y coherencia/diff comprobados; sin repetir lint/tipos/build del código íntegro validado en corte anterior. Próxima candidata11c3c1a: shadow/snapshot personal puros, sólo si cuota posterior y cierre caben; dividir antes de abrir si hace falta. Reserva10%5h/1%7d vigente; commitpushHEAD/cuotas al cierre.


## 11c3c1a1 — Shadow versionado puro

- Entrada36%5h/3%7d tras5f8e976 publicado, secuencial/reserva10%5h/1%7d. Dividir11c3c1a: sólo shadow/decoder ahora; snapshots y outcome después.
- Objetivo: schema/type puro de shadow2 item/preference, claves canónicas y decodificación legacy readonly con expectedUserId externo.
- `target_paths`: `src/schemas/remote-shadow-v2.ts`, `src/types/remote-shadow-v2.ts`, `src/lib/sync/remote-shadow-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,local-preference-evidence}.md`.
- Dependencias: schema legacy item, efectos personales y placement keys existentes. Settings/placements se reconocen como evidencia tipada, pero no se habilita su aplicación ni productores. No IO, migración, writer, backup, outbox ni consumidores activos nuevos.
- Aceptación: misma clave item legacy, tag/view/placement/settings por identidad propia; discriminantes/store/clave/propiedad coherentes, clones/null no inventado; futuro/extra/ambiguo/corrupto rechaza. Legado conserva payload/revisiones/tombstones sólo en memoria; parse no demuestra commit/permiso/ACK/ancestro.
- Validación: pruebas de ambas familias/legacy, cuenta/claves/store/placement scope-date/sentinel, tombstones/clones/futuro/extra. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Próximo snapshot personal puro separado según margen.


### Resultado 11c3c1a1 — Shadow mixto puro

Schema/type explícitos version2/kind item/preference y decoder/verificador puros. Legacy item estricto se adapta sólo en memoria conservando entidad/revisión/tombstone y sin modificar historia. Preferencia individual usa claves tag/item-view/placement canónico/settings por identidad; store, documento, clave y cuenta externa coherentes. Clones y rechazo futuro/extra/ambiguo/corrupto. Reconocer settings/placements como evidencia no implementa sus productores o aplicación; parse no demuestra commit, permiso, ACK ni ancestro.

Cuatro pruebas/39aserciones: legacy/tombstone, familias personales e independencia, scope/fecha de aparición/sentinel overdue, claves cruzadas/cuenta/futuro/extra/corrupción. Tipos de fixtures discriminadas corregidos antes de cierre. Suite285pass/86opt-in skip/0fail/5370aserciones; lint403archivos, tipos/build34recursos/diff aprobados. Contrato sin IO no requiere repetir Mongo. Ningún consumidor/writer/backup activo o migración cambiado.

Próxima candidata11c3c1a2: snapshot personal puro por clave con ausencia observada y sets de evidencia, antes de outcome/backup/ACK/pull. Evaluar cuota posterior contra coste alto observado y reparación/cierre; no abrir si puede cruzar reserva10%5h/1%7d. Repo coherente, protocolo activo1 y preferencias aún preparatorias. CommitpushHEAD/cuotas al cierre.


## 11c3c1a2 — Snapshot personal puro por conjunto exacto

- Entrada33%5h/3%7d tras3faf4e1 publicado, secuencial/reserva10%5h/1%7d; corte puro separado de outcome/ACK.
- Objetivo: snapshots por clave personal con documento observado o ausencia null, conjunto esperado externo exacto y cuenta propia; formatos locales incluyen revisión0 de borrador no confirmado, distintos de efectos remotos positivos.
- `target_paths`: `src/schemas/{remote-shadow-v2,personal-snapshot}.ts`, `src/types/personal-snapshot.ts`, `src/lib/sync/personal-snapshot{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,preference-transactions,local-preference-evidence}.md`.
- Dependencias: schemas personales locales, claves shadow/placement y decoder preparado. Ajuste documentado: snapshot local/base usa variante de registro personal local, no exige revisión remota>=1 a borrador. No IO/backup/writer/ACK/cursor activos.
- Aceptación: documento y clave/store coherentes, null sólo ausencia observada, claves únicas<=10000, conjunto exacto sin omisiones/extra, cuenta propia incluso settings ausente, clones y guard2MiBUTF8 total. Future/extra/corrupto rechaza; sin conceder permiso/ACK/ancestro por null o parse.
- Validación: grupos multirregistro con revisión0/ausencia/tombstones, conjunto vacío/exacto/incompleto, clave/cuenta/duplicado/settings-null/futuro/extra/UTF8. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. No abrir outcome si su coste completo amenaza reserva semanal1%.


### Resultado 11c3c1a2 — Snapshot personal puro

Snapshot por clave con registro personal local o ausencia null, conjunto externo exacto y propietario de partición. Claves únicas<=10000/canónicas, revisión0 local admitida, tombstones y clones; settings ausente exige clave de la misma cuenta. Guard2MiBUTF8 para conjunto íntegro, no sólo registros. Overdue conserva sentinel en clave y documento, sin normalizar silenciosamente fecha observada. Formato local separado de efectos remotos positivos: creación optimista actual usa revisión0 en preference-command.ts.

Cinco pruebas/23aserciones: revisión0/ausencia/tombstones/clones, conjuntos vacíos/exactos/incompletos/extra/duplicados, dueño/settings-null, shapes futuros/extra/claves corruptas,7000categorías individualmente válidas que exceden bytes y coherencia civil overdue. Aviso optional-chain corregido antes de cierre; lint sin ruido. Suite290pass/86opt-in skip/0fail/5393aserciones; lint407archivos, tipos/build34recursos/diff aprobados. Contrato sin IO, no repetir Mongo; no writer/migración/backup/ACK/pull/caller activo nuevo.

Próxima candidata11c3c1b: outcome/submission mixtos y relación intención/familia/cuenta/efectos/snapshots exactos. Requiere margen para contratos y fixtures multiefecto/replay viejo; no abrir si cuota posterior menos coste alto observado y reparación/cierre puede cruzar1%7d/10%5h. Repo cerrado, preferencias siguen preparatorias y protocolo activo1. CommitpushHEAD/cuotas al cierre.


## 11c3c1b1 — Recepción mixta pura

- Entrada30%5h/2%7d tras455432d; el usuario solicita una iteración adicional. Secuencial, reserva10%5h/1%7d conservada; dividir outcome/submission y entregar sólo submission.
- Objetivo: contrato puro de intención enviada/sender/resultado v2 y verificador externo de cuenta/familia/objetivo mediante verificador mixto existente.
- `target_paths`: `src/schemas/local-sync-result-v2.ts`, `src/types/local-sync-result-v2.ts`, `src/lib/sync/local-sync-result-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,local-preference-evidence}.md`.
- Dependencias: resultados/verificador push v2; intención1 y sender UUID vigentes. Sin IO, metadata/outcome durable, writer, ACK, backup ni consumidores activos.
- Aceptación: relación operationId exacta, sender válido, schema strict y resultado clonado; cuenta, familia y objetivo comprobados; multiefecto completo conserva revisiones independientes. Futuro/extra/identidad ajena rechaza; validación no demuestra lease vigente/commit/ACK.
- Validación: pruebas puras item/preference/errores, multiefecto, clones y cuenta/familia/objetivo/UUID/futuro/extra; suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. No ampliar a outcome/ACK durante esta petición de una iteración.


### Resultado 11c3c1b1 — Recepción mixta pura

Schema/type de submission intención1/senderUUID/resultado v2, relación operationId exacta y verificador puro de cuenta/familia/objetivo reutilizando correspondencia push mixta. Devuelve clones y conserva multiefecto con revisiones independientes; futuro/extra/identidad/cuenta ajena rechazan. Sender UUID no acredita lease vigente; validación no escribe ACK ni demuestra commit/acceso/ancestro. Sin callers, outcome durable, writer, backup o protocolo activo nuevos.

Tres pruebas/20aserciones: multiefecto y clones, cuentas/objetivos/familias/UUID/versiones/extras incoherentes, estados de error de ambas familias preservados. Suite293pass/86opt-in skip/0fail/5413aserciones; lint411archivos sin ruido, tipos/build34recursos/diff aprobados. Contrato sin IO, no repetir Mongo. Petición de una iteración adicional completada con commit/push/HEAD/cuotas y reserva vigente10%5h/1%7d.

Próxima candidata11c3c1b2: outcome mixto durable con snapshots exactos, legacy readonly y replay previo al shadow actual; después backup/ACK/pull compatibles. No ampliar esta entrega al executor local ni activar preferencias.


## 11c3c1b2a — Outcome item versionado readonly

- Entrada27%5h/2%7d trasf2a5458; petición adicional de una iteración si cabe, reserva semanal1% ya vigente. Secuencial/reserva10%5h/1%7d.
- Objetivo: dividir outcome mixto; preparar variante item2 y decoder de outcome legacy readonly antes de la variante personal y del lector común.
- `target_paths`: `src/schemas/local-item-outcome-v2.ts`, `src/types/local-item-outcome-v2.ts`, `src/lib/sync/local-item-outcome-v2{,.test}.ts`, `plan/{master,iterations,iteration-log,preference-sync,local-preference-evidence}.md`.
- Dependencias: outcome legacy, resultados item y verificador push mixto vigentes. Sin IO, writer, backup, cambios de outbox/ACK o consumidores activos.
- Aceptación: envoltura2/item y resultado item/v2, key/operationId/cuenta/objetivo coherentes; snapshots local/base propios y de misma identidad, sin exigir ancestro ni comparar su revisión contra replay histórico. Legacy conserva intención, resultado, tombstones, revisiones y clones, sin reescritura. Futuro/extra/familia/cuenta/objetivo corruptos rechazan íntegros.
- Validación: legacy conflict anterior al shadow observado, estado aplicado/tombstone y errores, clones, dueño/objetivo/IDs/key/futuro/extra. Suite/lint/tipos/build/diff/plan/commitpush/HEAD/cuotas. Una sola entrega; variante personal/verificador común pendientes.


### Resultado 11c3c1b2a — Outcome item versionado readonly

Variante explícita2/item con resultado item/v2; schema/type y decoder/verificador puros. Key e operationId exactos, correspondencia de cuenta/familia/objetivo reutilizada, snapshots local/base propios y de la misma identidad. Legacy se adapta sólo en memoria conservando intención, resultado, revisión/tombstone y clones. Replay anterior al shadow observado se admite sin fabricar ancestro, actualizar resultado ni retroceder datos. Desconocido/extra/ambiguo/identidad o cuenta ajena rechaza íntegro.

Tres pruebas/22aserciones: conflicto revision2 frente a shadow observado5/local0, clones, applied con tombstone y cuatro rechazos preservados, key/IDs/snapshots/resultado ajenos y versiones/familias/extras inválidos. Suite296pass/86opt-in skip/0fail/5435aserciones; lint415archivos, tipos/build34recursos/diff aprobados. Contrato sin IO no requiere repetir Mongo. Sin lector común, writer, backup, ACK, outbox o caller activo nuevo.

Petición de una iteración adicional cerrada con reserva10%5h/1%7d ya vigente. Próxima candidata11c3c1b2b: variante outcome personal con snapshots exactos y decoder común, antes de backup/ACK/pull. No abrir persistencia personal como ampliación de este corte. CommitpushHEAD/cuotas al cierre.


## Lote renovado: 11c3c1b2b y proyección preparatoria paralela

- Entrada100%5h/100%7d trasb77c7d6; usuario autoriza ampliar alcance y paralelizar. Reservas10%5h/1%7d vigentes; consultar ambas tras cada entrega, commitpushint/HEAD; sin nuevas automatizaciones ni cambios productivos.
- Objetivo11c3c1b2b: outcome personal estricto2 con snapshots exactos de objetivo+efectos, cuenta/intención/familia, decoder común item legacy/personal nuevo. Shadow observado no es ancestro ni obliga a revision posterior del replay.
- `target_paths` worker outcome: `src/schemas/local-preference-outcome-v2.ts`, `src/types/local-operation-outcome-v2.ts`, `src/lib/sync/local-operation-outcome-v2{,.test}.ts`. Sólo estos archivos; no commits ni plan por worker.
- Objetivo paralelo11c3c3p preparatorio: proyección personal pura por clave con revisiones independientes, snapshot local conservado mientras exista intención personal no resuelta y reconciliación cuando desaparecen pendientes; sin activar escritores antes de lectores/backup.
- `target_paths` worker proyección: `src/schemas/preference-projection.ts`, `src/lib/sync/preference-projection{,.test}.ts`. Dependencias sólo schemas/snapshots/outbox ya cerrados; no importar archivos del worker outcome en curso.
- Exploración paralela readonly: identificar adaptaciones exactas de backup/evidencia/importación para corte11c3c2, sin editar archivos.
- Ownership raíz: plan/workflow/registro e integración/revisión/build/commitpush. Agentes no están solos y preservan cambios ajenos; disjoint paths y validación global al integrar.
- Aceptación outcome: snapshots propios por conjunto exacto, objetivo incluso error sin efectos, multiefecto íntegro, clones, legado readonly, future/extra/familia/objetivo/owner incoherentes rechazan; guard de envoltura total y base remoto positivo/ausencia observada sin imponer ancestralidad.
- Aceptación proyección: claves/store/owner y conjuntos coherentes, revisiones remotas por documento, replay viejo no retrocede, misma revisión diferente contenido rechaza, tombstones y pendientes/rejected/conflict/unsupported conservados; decisiones locales no fabrican ACK. Limitar inicialmente tags/itemViews, rechazar store sin soporte íntegro. Sin IO ni UI/callers activos.
- Validación: tests puros pertinentes para cada corte; raíz suite/lint/tipos/build/diff/plan por entrega cerrada. Proyección anticipada documentada como preparatoria, no saltar lectores/backup ni activar ACK/pull. Actualizar orden/candidata al integrar; completar cada corte antes de reservar el siguiente.

### 11c3c2a — Backup portable mixto puro (lote paralelo renovado)

Objetivo: formato portable2 conserva shadows/outcomes legacy y versionados, mientras portable1 mantiene su shape y bytes lógicos. Protocolo de intención1 y DB2 no cambian. Dependencias: decoder común11c3c1b2b cerrado antes de integrar. Ownership delegado: src/schemas/local-backup.ts, src/types/local-backup.ts, src/lib/backup/local-backup.ts y sus tests, src/lib/backup/import-record.test.ts. Root conserva documentación e integración; sin cambio de snapshot/export/IndexedDB/UI en este corte.

Aceptación: validación de propiedad/claves/familia/objetivo mediante decoders mixtos sólo en memoria; intención exacta, dependencias, tail, sequence, evidencia ACK/conflict/rejected y decisiones superseded intactas. Multiefectos completos, revisión0 local/ausencias, base positiva y replay anterior al shadow aceptados sin fabricar ancestro. Fuente JSON archivada permanece opaca/byteexacta, no introducir verificación recursiva ni aplicar estados importados. Pruebas puras de ambas generaciones, corrupción/cuenta/futuro y roundtrip; lint/tipos/suite/build/diff completos antes de commit/push/cuotas.


Cierre11c3c3p: proyección preparatoria entregada y probada independientemente del outcome nuevo; no altera orden de activación.11c3c2a sigue candidata de integración. Actor/outbox completos se validan antes de preservar/reconciliar; union shadows<=10k y snapshot de salida<=2MiB.

Integración paralela11c3c2a: root asume únicamente src/lib/backup/import-preview.test.ts y src/lib/backup/import-plan.test.ts para matriz source1/current2 y source2/current1, evidencia personal completa sin selección ni ACK importado, comparación exacta de stores sin normalización. Contratos/aliases compartidos siguen propiedad del worker de backup. La entrega se integra y valida junta antes de commit.


Cierre11c3c2a: contrato/verificador portable mixto y matriz import pura entregados.11c3c2b integra snapshot readonly y fixtures reales antes de writers. Adaptación estricta de metadata/shadow sólo en memoria; export aún1.

### 11c3c2b y 11c3c2c — Lectores reales paralelos antes de writers

Entrada tras ae5a872: 67%5h/95%7d, reserva10%/1%. Selección explícita de paralelo por autorización del usuario, contratos cerrados; no activar wire2 ni writers mixtos todavía.

11c3c2b (root): src/lib/local-db/backup.ts, test/browser/backup.ts, test/browser/backup-import.ts; adaptaciones necesarias de schemas/backup-import sólo si hay evidencia (union ya transita por schema compartido). Objetivo exportar portable2 readonly de once stores sin reescribir IndexedDB, fixtures de historia mixta persistida, snapshot anterior/posterior/recarga y conservación exacta durante importación como copias nuevas. Aceptación: legado sigue exportable, portable1/2 importables, límite16MiB y unknown/owner reject preservan DB; import replay/rollback/tail/queue sin ACK fabricado. Validación: suite/lint/tipos/build y browser backup+import con particiones propias, cleanup propio.

11c3c2c (worker personal_projection): src/schemas/sync-incident.ts, src/types/sync-incident.ts, src/lib/sync/incident-snapshot.ts y tests, nuevos módulos de proyección de incidentes personales si necesarios, src/lib/local-db/sync-incidents.ts, src/lib/local-db/sync-store.ts (sólo reader/API, no mutation), src/features/sync/local-incidents.ts, src/features/sync/components/sync-incident-panel.tsx y tests, nuevos componentes compactos personales y test/browser/sync-incidents.ts. Objetivo decodificar toda historia mixta antes de seleccionar variantes; mantener contrato item de resolución y cola completa para dependencias cruzadas, API overview separada visible sin opciones personales prematuras. Aceptación: cuenta/familia/identidad/estados/intención exactos, formatos futuros/corruptos nunca filtrados, personal no confundido con item por itemId, block visible con comparación actual/outcome/remote y sin choices. Store/epoch guardias conservadas, sólo readonly. Guía React y Next instalada obligatorias; fixtures propias browser y tests puros/render, fullDoD central. No editar archivos de backup ni writers/pull/outbox actuales; root posee documentación/integración/commits/build.

### 11c3c3a — ACK personal atómico preparatorio (tercer frente independiente)

Lectura previa55%5h/93%7d. Root cerrará lectores antes de integrar cualquier API de persistencia mixta; worker personal_outcomes puede preparar un módulo aislado sin caller productivo mientras11c3c2b/c terminan. Ownership exclusivo: src/lib/local-db/preference-sync-results.ts, src/lib/sync/preference-result-plan.ts y su test, nuevos schemas/types del plan si necesarios, test/browser/preference-sync-results.ts y scripts/preference-sync-results-test-server.ts. Sin editar sync-store/outbox/pull/incidentes/backup ni documentación compartida.

Objetivo y aceptación: tags/vistas sólo, submission propio válido, intención exacta y lease sender sending; replay acknowledged exacto readonly. Capturar local/base antes de resultado para objetivo+todos efectos. Applied único ACK; unsupported pending; errores/conflicto retenidos; no cambio de cursor. Rebase sólo dependiente directo pending/attempts0 y revisión de su efecto propio, sin mutar intención intentada. Proyección conservadora de toda cadena personal y reconciliación final; todos los estados, documentos, shadows y outcome se confirman en una transacción y se resuelven tras oncomplete. Reject de cuenta/formatos/stores/corrupción antes de writes, bounds reales y late abort revierte todo. No await de red/control en IDB ni claims de atomicidad entre dos bases. Pruebas puras y browser IndexedDB propias con multiefectos/clones/replay/lease robado/rebase/unsupported/cadena/reconciliación/fallo final; fullDoD/plan/commit/push/cuotas central. Sin caller productivo ni activación wire2; integrar sólo tras cerrar lectores compatibles.


Cierre11c3c2b: snapshot/export portable2 e importación de ambos formatos probados con IndexedDB real, lectura/recarga/conservación byteexacta/rollback/guardias.11c3c2c sigue antes de integración de writer11c3c3a.


Cierre11c3c2c: readers/incidentes mixtos y comparaciones compactas personales comprobados, resolución item preserva grafo completo.11c3c3a puede integrar y probar su writer preparatorio; todavía sin negociación/activación transporte2.


Cierre11c3c3a: módulo standalone y pruebas reales de atomicidad aprobados tras guardias de partición/stores. No activado en LocalSyncStore/coordinador. Dependencias de reader item2 y cola histórica con placements pendientes explícitas antes de pull/activación; no manufacturar ACK para progresar.

### 11c3c2d — Readers item legacy/versionados compatibles

Entrada28%5h/89%7d tras753c944, secuencial y reserva10%/1%. Objetivo adaptar readonly en memoria shadow/outcome item2 a las APIs item vigentes antes de pull mixto; sin activar transporte ni escribir nuevos formatos. target_paths root: src/lib/sync/item-evidence.ts, src/lib/local-db/outbox.ts, src/lib/local-db/sync-store.ts, src/lib/local-db/pull-changes.ts, test/browser/sync-results.ts, test/browser/sync-pull.ts. Dependencias: decoders item2/shadow y readers/backup cerrados. Aceptación: misma cuenta/key/familia estrictas, getters/replay acknowledged/ACK nuevo/pull admiten ambas generaciones, resultado durable exacto e intención conservados; personal/futuro/corrupto no se convierten a item. Escrituras siguen formato vigente cuando correspondan a mutación real; simple getter/replay no reescribe evidencia. Browser fixtures deben persistir item2, confirmar getter/replay readonly y ACK/pull con snapshot2, recarga/cursor/rollback vigentes. Lint/tipos/suite/build/diff/plan/commit/push/cuotas antes de cierre. No nuevo API de envío ni migración; si reparación amenaza reserva, limitar el corte antes de abrir pull/coordinador.

Fixture compartida adicional root: test/browser/item-evidence-fixture.ts encapsula versionado sintético de evidencia y lectura bruta sólo en partición browser-test/loopback, usada por sync-results y sync-pull. No añadir helpers de producción sólo para fixtures ni simular resultados remotos desde decoder.


Cierre11c3c2d: readers item compatibles verificados con evidencia2 realmente persistida, getter/replay readonly y ACK/pull vigentes. Próxima11c3c4a requiere contrato local y cursor mixtos, desconocidos no filtrados; separar contrato de transacción antes de abrir si margen limitado.

### 11c3c4a1 — Recepción de página local mixta, contrato puro

Entrada24%5h/88%7d tras224eb66. Corte mínimo secuencial antes de TX: target_paths src/schemas/local-changes-page-v2.ts, src/lib/sync/local-changes-page-v2.ts y su test. Dependencias remote page/query v2 y readers/ACK locales cerrados. Envoltorio estricto conserva query completa (after/through/limit, normalizada por schema remoto existente) más page2; verificar relación consulta/cuenta/checkpoint/límites y todos los stores antes de cualquier futura escritura. Sólo items propios simples task/event con revisión positiva y tags/vistas; settings/placements/series/birthday no se filtran, reject whole. Item repetido en página exige revisiones ascendentes como reader vigente; revisiones personales independientes no se convierten en cursor. No IO/ACK/rebase/cursor/caller/writer nuevo. Tests puros: mixto íntegro/clones, consultas congeladas/rango/cuenta/futuro/corrupción/extra, efecto sin soporte al final, revisiones item y formatos admitidos. FullDoD/plan/commit/push/cuotas. Transacción futura11c3c4a2 se abrirá en ventana con margen suficiente para browser/rollback/dos dispositivos.


### Resultado 11c3c4a1 — Recepción local de páginas mixtas

Contrato puro estricto conserva la consulta completa normalizada por el schema remoto existente (after/through/limit) junto con página2. Reutiliza verificador remoto de cuenta, continuidad, rango, tamaño y checkpoint congelado; verifica todos los efectos antes de retornar. Sólo propios simples task/event con revisión positiva y tags/vistas. Settings/placements, series/cumpleaños y formatos futuros rechazan íntegros; no filtrar efectos válidos para aceptar parte de una entrada. Items repetidos exigen revisión ascendente dentro de página, mientras revisiones personales permanecen independientes del cursor. Resultado clonado, sin IO/ACK/rebase/cursor ni caller nuevo.

Cuatro pruebas específicas/26 aserciones. DoD global: 334 pass/86 opt-in skip/0 fail/5849 aserciones; lint435 archivos, tipos/build34 recursos/diff aprobados. Contrato puro sin persistencia: no repetir Mongo o navegador ni declarar convergencia. Entrada24%5h/88%7d tras224eb66, secuencial con reserva10%/1%. Commit/push/HEAD y ambas cuotas determinan cierre del lote; no abrir transacción mixta con margen insuficiente para pruebas, reparación y publicación.

Siguiente11c3c4a2: validar la página entera antes de abrir/aplicar cambios, guardar items/tags/vistas/shadows/cursor en una TX propia con lectura de outbox completa; conservar intenciones, dependientes, outcomes y tombstones. Sin ACK o rebase por descarga. Probar checkpoint/carrera/página antigua, cuentas/épocas, stores sin soporte, revisión independiente y fallo tardío de cursor que revierta todos los efectos. Preparar writer aislado antes de capacidades/coordinador; no activar transporte2 sin guardia de cadena personal histórica y evidencia de dos particiones.

### 11c3c4a2p — Decisión pura de cursor mixto

Petición del usuario de adelantar lo posible del paso1; entrada real17%5h/87%7d, reserva10%/1%. Partir antes de la transacción: root posee src/lib/sync/local-mixed-pull-cursor.ts y su test, además de plan/master.md, local-preference-evidence.md y registro. Dependencias: receipt11c3c4a1 y cursor local vigente. Aceptación: validar receipt íntegro y cursor almacenado antes de decidir; ignorar sólo página completamente superada, rechazar solapamiento/consulta futura/cambio de checkpoint, exigir consulta completa coincidente con estado actual y proponer cursor congelado o liberado al terminar. Resultado clonado; corrupción o efecto sin soporte no se ignora por ser página antigua. Sin IO/writes/ACK/rebase/activación. Tests puros de primer checkpoint, continuidad, final vacío, carrera/solapamiento, invalid/future/unsupported/clones; suite/lint/tipos/build/diff/commitpush/HEAD y cuotas. Writer11c3c4a2 sigue pendiente y reutilizará esta decisión dentro de TX propia, con browser/rollback antes de conexión.


### Resultado 11c3c4a2p — Decisión pura de cursor mixto

Planner sin IO valida receipt íntegro y cursor almacenado antes de decidir. Exige after y checkpoint de consulta iguales al estado actual; congela checkpoint mientras hasMore y lo libera al terminar. Sólo ignora páginas completamente superadas, conservando cursor vigente; solapamiento, consulta futura o checkpoint alterado rechazan. Incluso una página superada rechaza cuenta ajena, futuro, corrupción, límites o store sin soporte. Devuelve evidencia/cursor clonados, sin avanzar DB ni ACK. El writer futuro debe ejecutar esta decisión con el cursor leído dentro de su transacción y persistirla junto con todos los efectos.

Cuatro tests específicos/26 aserciones; suite338 pass/86 opt-in skip/0 fail/5875 aserciones, lint437 archivos, tipos/build34 recursos/diff aprobados. Entrada17%5h/87%7d, secuencial; corte limitado antes de abrir IndexedDB con reserva10%/1%. Sin caller nuevo, cambios a transporte1 o repetición de Mongo/browser para este planner puro. Commit/push/HEAD y cuota posterior determinan cierre. Siguiente11c3c4a2 mantiene transacción mixta, pruebas browser de atomicidad/rollback/carrera/cuentas y conservación íntegra antes de activación.

### 11c3c4a2q — Proyección personal de página completa

Usuario pide aprovechar15%; lectura real15%5h/87%7d, reserva10%/1%. Corte puro secuencial root: src/schemas/local-personal-changes-page.ts, src/lib/sync/local-personal-changes-page.ts y test; plan/master, evidencia y registro. Dependencias receipt/cursor/proyección personal cerrados. Objetivo componer proyección existente sobre todos los efectos personales de una página validada antes de cualquier IO. Aceptación: actor y estado propios, incoming inicial necesariamente null, cola completa validada; procesar entradas en orden sin colapsar efectos intermedios, preservar local con pendientes y revisiones/tombstones independientes. Contradicción tardía rechaza el conjunto sin modificar inputs; item recibido se valida pero su proyección pertenece al writer mixto posterior. Sin cursor/writes/ACK/caller/activación. Tests de multientrada/multiefecto, revisiones antiguas, tombstones/pendientes, contradicción tardía, cuenta/futuro y clones; fullDoD/commitpush/HEAD/cuotas, TX sigue pendiente.


### Resultado 11c3c4a2q — Proyección personal de página completa

Composición pura de proyección personal existente sobre cada entrada de receipt íntegro, en orden. Estado propio validado con incoming inicial null y cola completa; página valida cuenta/rango/checkpoint/stores antes de seleccionar variante personal. Preserva cadena optimista con pendientes, acumula todos los shadows/multiefectos, mantiene revisión por documento y tombstones. No colapsa entradas a último documento antes de validar: contradicción intermedia de igual revisión rechaza incluso si existe revisión posterior. Resultados clonados y inputs intactos. Items recibidos se validan en receipt, pero su proyección/aplicación pertenece al writer mixto posterior; ningún resultado de este planner autoriza persistencia parcial.

Cuatro tests/19 aserciones, incluido replay antiguo, multiefecto tag/view, tombstone, intención pendiente, corrupción/actor incluso página vacía y contradicción tardía sin mutación. DoD342 pass/86 opt-in skip/0 fail/5894 aserciones, lint440 archivos, tipos/build34 recursos/diff aprobados. Entrada15%5h/87%7d; secuencial con reserva10%/1%, commit/push/HEAD/cuotas al cierre. Sin IO/ACK/cursor/caller ni activación; Mongo/browser innecesarios para composición pura. Siguiente11c3c4a2 transacción IndexedDB reutiliza receipt, cursor y proyección de página dentro del snapshot propio, con atomicidad de todos los efectos/cursor, rollback y dos particiones antes de integración.

### 11c3c4a2 — Descarga mixta atómica preparatoria

Entrada12%5h/86%7d; usuario autoriza reserva puntual4%5h/1%7d. Root secuencial posee src/lib/local-db/pull-changes-v2.ts, test/browser/sync-pull-v2.ts, scripts/sync-pull-v2-test-server.ts y plan/registro. Dependencias receipt, cursor y proyección personal de página cerrados. Objetivo writer aislado, sin caller productivo: snapshot propio de items/tags/vistas/outbox/shadows/cursor en una TX, validación completa antes de puts, composición item/personal, shadows/cursor confirmados juntos. Aceptación: partición errónea/store sin soporte rechaza antes de TX; lectura10001 rechaza sin truncar; cuenta/identidad/shadows/cola completos válidos, pendientes/resultados/dependencias intactos, oldpage ignorada readonly, checkpoint/carrera y contradicción tardía rechazan. Resolver tras commit, fallo tardío cursor revierte todos los puts; epoch guardia sigue en caller futuro. Browser propio multiefecto/item/tombstone/pending/reload/replay/cuenta/rollback, fullDoD/cleanup/commitpush/HEAD/cuotas. Sin convergencia remota declarada ni activación wire2; dos particiones/Mongo/coordinador posteriores.


### Resultado 11c3c4a2 — Descarga mixta atómica preparatoria

Writer client-only aislado valida receipt y partición antes de abrir TX; lee snapshot de items/tags/vistas/outbox/shadows/cursor completo con límite10001 detectado. Decodifica todos los shadows antes de seleccionar familia, valida cuentas/identidades/cola y proyección personal íntegra; decide cursor sobre el estado leído en TX, ignora sólo página completamente superada sin puts. Prepara efectos item/personales antes de escribir; no colapsa contradicción intermedia, conserva acumulados pendientes y tombstones/revisiones independientes. Shadows sólo se escriben si cambian, sin normalizar historia ajena a la página. Cola/outcomes/dependencias intactos, sin ACK/rebase por descarga. Stores/efectos/cursor se confirman juntos y resolve tras oncomplete. Cuenta/época de control sigue responsabilidad del caller futuro, sin atomicidad inventada entre bases.

Ocho escenarios browser en origen propio4192 aprobados: commit completo y reopen, replay ignorado byteexact, pendientes e historia intactos, cambio checkpoint/contradicción sin writes, fallo final cursor con rollback íntegro/retry, DB equivocada/store unsupported antes de TX, fila10001, checkpoint paginado y tombstones de contenido/vista, corrupción futura/cuenta incluso página superada. Primer fallo de fixture era comando task.status inexistente; corregido a task.set-status con occurrenceId null. Tipo de filas opcionales corregido y formatter aplicado, checks repetidos hasta pasar. Sólo recursos propios limpiados, servidor/pestaña cerrados.

DoD342 pass/86 opt-in skip/0 fail/5894 aserciones, lint443 archivos, tipos/build34 recursos/diff aprobados, más ocho checks reales IndexedDB. Entrada12%5h/86%7d con autorización puntual de reserva4%5h/1%7d registrada en workflow. No caller productivo ni transporte2 activados; fixtures locales sintéticas no demuestran convergencia remota. Siguiente11c3c4b1 prueba de dos particiones/Mongo con APIs preparadas, antes de integrar coordinación/capacidades y recuperación de cadena personal histórica. Commitpush/HEAD/cuotas al cierre.

## Lote desatendido renovado, 9 de octubre00:25

Lectura real100%5h/85%7d, reset5h publicado1791516313 (05:25:13Madrid). Autorización vigente de trabajo/push por corte y revisión siguiente al cierre; reserva4%5h/1%7d sustituye10% de5h durante este ciclo. Paralelo explícitamente seleccionado sólo para contrato cerrado/fixtures independientes: explorador backup_transition_review readonly analiza capacidades/coordinador y cadena personal histórica; root posee planificación, schema/server/runner e integración. No caller productivo hasta evidencia completa.

### 11c3c4b1 — Prueba integrada mixta preparatoria

Objetivo: comprobar ACK personal real y pull mixto de dos orígenes/particiones IndexedDB con executors Mongo propios; offline/reload/replay/respuesta perdida/tombstones/conflicto/cola histórica y ausencia de ACK inventado. Dependencias writers/decoders/readers/protocolo preparados y runnerMongo aislado actual; Docker28.4.0 e imagen8.2.11amd64/digest vigente revalidados. Root target_paths: scripts/sync-db-test-runner.ts (modo adicional), scripts/mixed-sync-browser-test-server.ts, src/schemas/mixed-sync-browser-test.ts y plan/registro. Worker después de schema cerrado poseerá únicamente test/browser/mixed-sync-devices.ts y mixed-sync-device.ts; sin archivos producto/compartidos, commits ni otros recursos. Cuenta browser-test UUID, orígenes loopback distintos y capability run; servicios/DAL reales, sin credenciales reales/bypass auth público. Cerrar recursos sólo propios. Aceptación: dos proyecciones/cursor coinciden con Mongo donde no haya blockers, journal/revisiones una sola vez tras replay, pendientes/conflictos/tombstones preservados, unsupported task.move no hace ACK ni desaparece. Pruebas browser propias+suite/lint/tipos/build/diff, commitpush/HEAD/cuotas. Convergencia se limita a escenarios soportados, no prometer categorías activadas en producto ni órdenes sin executor. Registrar autorización y reinicio en primer commit de este lote.

Adelanto paralelo11c4a1p (preparatorio sin consumidores): worker personal_outcomes posee sólo src/lib/sync/sync-capabilities.ts y test, src/lib/sync/personal-queue-diagnostics.ts y test, src/schemas/personal-queue-diagnostics.ts y types si necesarios. Objetivo registry puro y diagnóstico completo de cola histórica, sin modificar coordinator/queue-summary/sharedfiles; dependencias contratos existentes cerrados. Cuenta/grafo/IDs/sequences/dependencias validan antes de clasificación; categorías/vistas simples soportadas, task.move/settings/series/birthday sin executor explícitos. Listas listas/esperando/bloqueadas/unsupported y blockers personales no fabrican ACK ni convierten superseded en acknowledged. Tests de move→tag→view, create→view, conflictos/superseded/externos/cuenta/futuro y ramas independientes; root integra sólo tras revisión y cierre de entrega actual, fullDoD/plan/commitpush/cuotas separados. Rutas disjuntas con fixture y root.


### Resultado 11c3c4b1 — Prueba mixta integrada con dos dispositivos

Runner browser-mixed consume descriptor validado y MongoDB8.2.11amd64 aislado, provisiona sólo índices explícitos en su DB propia. Dos servidores loopback/orígenes y particiones IndexedDB UUID, servicios/dispatchers/DAL reales y capability run. Ocho escenarios aprobados: offline/recarga, bootstrap paginado y ACK durable, asignación/rebalance multiefecto, respuesta perdida/UUID/replay sin duplicados y shadow más reciente que outcome, tombstone con desasignación explícita independiente, contenido/personal con cursor común, conflicto conservado con dependientes tras recarga, task.move histórico sin executor que permanece pendiente y bloquea la cadena. Convergencia sólo comprobada entre ambas particiones y Mongo en escenarios soportados sin bloqueos; no activación de categorías en producto ni resolución implícita.

Primer arranque falló por faltar contenedor actions en HTML de fixture; corregido antes de ejecutar. Borrado de categoría conserva referencia histórica hasta item-view.set explícito; fixture respeta ese contrato. Ocho checks posteriores correctos, bases/pestaña/servidores/contenedor/tmpfs propios limpiados y runner exit0. Suite Mongo aislada55 pass/618 aserciones/0fail, suite global354 pass/86 opt-in skip/0fail/6049 aserciones (incluye preparación paralela de capacidades todavía no publicada), lint453 archivos/tipos/build34 recursos/diff aprobados. Sin cambios a credenciales/DB/hosting reales.

Entrada renovada100%5h/85%7d; autorización desatendida de cadena y reservas4%/1% registrada con reset real1791516313 (9oct05:25:13Madrid). Siguiente11c4a1p: publicar capacidades/diagnóstico preparados, después coordinador mixto aislado con cuenta/época/dependencias y consultas completas. Commitpush/HEAD y cuota por corte; movimiento histórico exige executor compatible o recuperación explícita, nunca ACK fabricado.


### Resultado 11c4a1p — Capacidades y diagnóstico de cola preparatorios

Registry exhaustivo y congelado describe executors preparados, no protocolo activo ni autorización. Tags/vistas/contenido simple admitidos condicionalmente; placements/settings/series/cumpleaños/ocurrencias sin executor explícitos. Contexto desconocido requiere validación remota. Diagnóstico puro valida cuenta, duplicados, límite10000, dependencias completas y ordenadas antes de clasificar listas listas/esperando/bloqueadas/unsupported/settled. Sólo acknowledged satisface un padre; superseded bloquea hijos. Toda intención personal unresolved mantiene proyección conservadora. Devuelve blockers directos y grafo íntegro sin copiar ancestros cuadráticamente; no muta inputs ni ACK/historia. Ramas de contenido independientes siguen listas aunque cadena personal esté bloqueada. Settings.update se describe sin ampliar la outbox vigente que todavía no admite su entityKey.

Worker personal_outcomes posee seis rutas disjuntas ya definidas, revisión root completa; sin consumidores.12 tests/155 aserciones incluyen move→tag→view, create→view, conflicto/superseded, tag anterior a move, cuenta/futuro/corrupción, clones y cadena10000 (10001 rechaza). DoD global ya ejecutada sobre exactamente estos archivos estables:354pass/86opt-inskip/0fail/6049 aserciones, lint453/tipos/build34 recursos; diffcheck y referencias documentales comprobados tras actualización. Sin repetir pruebas caras por cambios sólo documentales. Entrada69%5h/80%7d después de a87ca07 publicado; reserva4%/1%, siguiente11c4a2p coordinador mixto preparatorio con contratos cerrados. Commitpush/HEAD/cuotas al cierre.

### 11c4a2p y adelanto11c4a3t — Coordinación y transporte preparatorios

Entrada67%5h/80%7d, reserva4%/1%. Contrato cerrado registry/diagnóstico2e35916 y pruebaa87ca07. Paralelo explícitamente seleccionado: worker personal_outcomes posee sólo src/features/sync/coordinator-v2.ts y coordinator-v2.test.ts; root posee planificación/integración y transporte separado src/features/sync/http-transport-v2.ts y test. No tocar callers/configprotocol/acciones/routes vigentes. Coordinador puertos independientes readQueueState snapshot completo entries/items; pull recibe remotePullQuery conlimit50, applyPage guarda {query,page}; push requiere envelope2/intención1; applyResult recibe variante2. Guardia cuenta/epoch tras await y antes de efectos, claim fresco validado/lease/dependencias/capacidad, release en finally UUID solicitado, sólo applied durable suma uploaded. Máximo4pull globales y5pushintentados, single-flight/stop, retry prefijo vacío sin ACK, diagnóstico completo visible separado de settled (pasada sin runnable, no convergencia). Relectura después de ACK. Tests de cuenta/stop/lease/claim rebase/familia, query/checkpoint/store/corrupción, cadenas históricas/independientes, límites/errores/correspondencia. Root valida fullDoD/plan/commitpush/HEAD/cuota en corte independiente antes de publicar transporte.

Transporte puro preparatorio: constructor recibe userId y sendOperations callback2; identidad/descarga fetch mismo origen, no-store/AbortController/timeout y guardia protocolo2 explícita independiente de anuncio activo1. Reutilizar versión constante nueva sólo local/exported sin cambiar config activo. Consulta completa preservada y páginas/resultados validados con actor/request, nullthrough omitido en URL, cuenta esperada requerida; errores400/401/409/426/futuro/timeout sin ACK. Callback de acción timeout no cancela commit remoto; preservar replay de intención. Tests mock de fetch/callback y correspondencia/headers/cookies/abort/timeout; sin navegador/Mongo repetidos por transporte puro. Runtime posterior conecta snapshot/writers con guards y prueba real del coordinador antes de activar protocolos/índices.

Adelanto11c4a3s seleccionado con entrada62%5h/79%7d: worker mixed_devices_proof posee sólo src/lib/local-db/mixed-sync-store.ts, test/browser/mixed-sync-store.ts y scripts/mixed-sync-store-test-server.ts. Contratos cerrados de writers/diagnóstico; sin tocar coordinator ni transporte/rootplan. Objetivo wrapper client-only aislado que abre recursos propios, expone cursor/snapshot atómico readonly de items+outbox (10001 rechaza, partición/cuentas/grafo íntegros), aplica receipt mixto y resultado familia2 dispatch item legacy/personal standalone; cierre consistente y partialopen cleanup. No caller/epochcontrol ni permisos: caller futuro debe comprobar cuenta/época. Tests browser reales own UUID de snapshot, historia/raw readonly/reopen, cuenta/corrupción/10001, ACK item/personal/replay y pull compartido, cleanup propio. FullDoD y publicación separada tras coordinador/transporte, sin dar autorización de activar wire2.

### 11c4a3r — Runtime mixto aislado (después de11c4a2p/11c4a3t/11c4a3s)

Root owns src/features/sync/local-runtime-v2.ts y test/browser/runtime-pilot-v2.ts/scripts/runtime-pilot-v2-test-server.ts si la evidencia necesaria cabe, además de plan. API openLocalSyncRuntimeV2(account userId/epoch, transport2), recursos outbox+mixedstore allSettled con cleanup parcial; verificación inicial y posterior a apertura, isActive compara control real de cuenta/época/logout y cierre; proteger cada efecto propio antes de TX, sin atomicidad inventada entre DBcontrol/partición. close idempotente stop+espera pasada y closes todos handles sólo propios; run después de close devuelve stopped. Sin activehooks/rutas/handshake/indexactivation. Tests browser aislados control de cuenta fixture propio: cuenta errónea/noactivada, cambio de época durante pull/push, noACK al perder cuenta, commits previos preservados, cierre in-flight libera lease y DB, reabrir/singleflight. Integración Mongo de dos dispositivos con coordinator/runtime/transport seguirá como corte específico antes de activación. No confundir preparación con funcionalidad disponible para usuario.


### Resultado 11c4a2p — Coordinador mixto preparatorio

Puertos aislados consumen snapshot completo de cola/items y diagnóstico validado; consulta exacta after/through/limit y envelope transporte2/intención1, capturados antes de entregar clones al transporte. Claims frescos validan UUID solicitado, actor/entity/estado/sender y operación vigente; enviar base recién rebased, revalidar capacidad/cadena tras claim. Sólo ACK durable applied suma uploaded. Guardias después de awaits y antes de efectos; cambio de cuenta/stop oculta diagnóstico previo. Release siempre UUID solicitado y sender propio incluso null/corrupt/cierre. No descartar movimientos/dependientes ni interpretar settled como convergencia.

Máximo4 descargas globales inclusive postupload,5 claims/globalpushintentados incluyendo claimsnull; división more_work sin sexto intento. Prefijo retry vacío válido no aplica outcome ni ACK. Tests propios12/313aserciones cubren guardias/claims frescos y malformados/familia/dependencia cambiada, cadenas históricas con contenido independiente, checkpoint/store/cuenta/futuro, respuesta perdida/correspondencia/argumentosmutables, límites y single-flight/stop. Root revisión incluyó boundclaims y clones además de puertos versionados. Suite global373pass/86opt-inskip/0fail/6418aserciones, lint463/tipos/build34 recursos/diff correctos; incluye módulos paralelos estables todavía separados. No caller activo, sin repetirMongo para coordinator ports; prueba conjunta real pendiente tras runtime. Entrada67%5h/80%7d, reserva4%/1%; transporte11c4a3t y wrapper11c4a3s preparados en paralelo disjunto. Publicación y cuotas por corte.


### Resultado 11c4a3t — Transporte HTTP mixto preparatorio

Constructor independiente conserva cookies same-origin requeridas por protección Vercel, no-store, deadline/AbortController y cuenta esperada. Exige anuncio compatible2 antes de leer datos; activo config/rutas/hooks siguen1. Consulta completa capturada viaja hasta validación íntegra actor/rango/checkpoint/stores; through null se omite de URL. Push2 valida intención1 y correspondencia exacta después de callback, pasando copia para evitar mutación de request validado; prefijo retry vacío válido.400/503 retry,401 unauthorized,409 cambio de cuenta/recuperación cursor,426 actualización. Timeout no revoca commit remoto: conservar intención/UUID para replay.

Siete tests/56aserciones: cookies/header, querymutable/checkpoint, futuro/protocolo antes de payload, códigosHTTP, corrupción/cuota/rango/cuenta, envelope/familia/UUID/prefijo/callbackmutable y deadlines/abort. Root corrigió inferencia literal de retornos fixture para tipos estrictos. FullDoD ejecutada sobre fuentes estables junto al coordinador:373pass/86opt-inskip/0fail/6418aserciones, lint463/tipos/build34 recursos; diff/referencias documentales al cierre. Transporte puro con fetch/callbackmock; no repetirMongo/browser ni declarar activación. Entrada44%5h/76%7d tras24306b5 publicado; reserva4%/1%, siguiente wrapper y runtime preparatorios con evidencia local y luego piloto integrado de coordinador con Mongo.


### Resultado 11c4a3s — Snapshot y dispatch mixtos propios

Wrapper client-only aislado abre y cierra dos conexiones propias, cierra primera si segunda falla y protege partición antes de métodos. Readonly de items/outbox en una TX, getAll10001 rechaza límite10000 sin truncar; schemas validan toda cuenta/grafo/identidad. Clones sin writes a historia. Cursor propio; dispatch resultado2 valida actor/intención/familia antes de delegar ACKitem vigente o writerpersonal standalone, descarga recibida aplica writer mixto atómico. No callers/época nuevos; guardia de control de cuenta pertenece al runtime siguiente.

Seis checks realesIndexedDB ownUUID: snapshot/historia/clones/reopen, datosforeign/missingdep/futuro y rollback por índiceuniquesequence, 10001contenido/cola, dispatchitem/personallease/ACK/replay traspullmixto, correspondencia/partición antes deTX, partialopenfailure capturaconexióncerrada/closeidempotente. Primera fixture intentaba sembrar duplicadosequence imposible por índicebySequence; corregida aassertreject delwrite y snapshotbyteexactconservado, sin producto modificado. Repetición final completa y bases/pestaña/server propioslimpios, exit0. Lint/tipos/suite373pass/86opt-inskip/0fail/6418aserciones/diff aprobados trascorrección; build34 recursos sobre mismas fuentesestables ya pasó, fixturecambió sólo escenario fallido. Sin efecto en producto. Entrada43%5h/76%7d trasf8e1296, reserva4%/1%; siguiente11c4a3r runtime y prueba conjunta real posterior.


### Resultado 11c4a3r — Runtime mixto con control de cuenta

Runtime aislado valida cuenta/época antes y después de apertura allSettled, limpia recursos abiertos si falla una rama o cuenta cambia. Integra outbox y wrapper propio al coordinador2 con snapshot completo/cursor/dispatch y transporte2; cada efecto verifica control local antes deTX, guardias posteriores del coordinador impiden continuar tras cambio. Control y partición son DB distintas: no se promete atomicidad entre ambas. Cleanup de lease permite liberar sólo sender/UUID propio anterior aun tras cambio/cierre. Cuenta copiada al abrir para impedir mutación externa. Close idempotente para coordinator, espera trabajo en vuelo y cierra todos handles, run posterior stopped. No activehooks/caller ni cambios a producción.

Seis checks browser propios con account-control de origen efímero: cuenta inactiva rechaza, deferredpull singleflight/close/latepage, cambioepoch durantepull sinwrites/diagnósticos anteriores, durantepush sinACK/release/intenciónexacta, closepush/reopen sinACK falso, pasada posterior durableACK+pull/cursor y controlintacto. Resultados sintéticos locales válidos para guardias/cierre; no prueban Mongo remoto. Basesaccount-control/partición/pestaña/servidor sólo propios limpiados y exit0. FullDoD373pass/86opt-inskip/0fail/6418aserciones/lint463/tipos/build34 recursos/diff ya aprobada sobre estas fuentesestables, ahora referencias/alcance revisados. Entrada43%5h/76%7d tras2a4f0b4; reserva4%/1%. Siguiente11c4a4p prueba conjunta real runtime/coordinator/HTTP con Mongo y dos orígenes, antes de activación; cadena personal histórica sigue bloqueada sin executor y requiere recuperación explícita.

### 11c4a4p — Piloto mixto con la coordinación preparada y Mongo real

Entrada43%5h/76%7d anteslectura posterior, reserva4%/1%; dependencias cerradas24306b5/f8e1296/2a4f0b4/ebd9d2c. Paralelo explícito sólo fixturecliente: mixed_devices_proof posee test/browser/mixed-sync-device.ts para comando coordinate con openLocalSyncRuntimeV2+createHttpSyncTransportV2 y control ficticio propio; root owns test/browser/mixed-sync-devices.ts, src/schemas/mixed-sync-browser-test.ts, scripts/mixed-sync-browser-test-server.ts y plan. HTTP real loopback conserva opciones/requestcaptured y mapea URLs al mismo servidoraislado (noauthreal); anuncia2 únicamente allí. Dos orígenes UUID prueban create/tag/view por runtime acotado, ambos estados frente aDALMongo y journal; movimiento histórico bloqueado conserva cadena pero contenido independiente progresa. Mantener ocho pruebas previas, addingcoordinación y diagnosticosbounded/paginación. Cleanup control sólo ficticio propio/locked, DBproducto sólo ownUUID, todos handles y runner recursos propios. FullDoD+browserMongo/commitpush/HEAD/cuotas; no activar wire2/índicesfueraDBtest ni declarar convergencia con blockers.


### Resultado 11c4a4p — Recorrido completo de dos dispositivos con Mongo real

Diez escenarios correctos con servicios/DAL/executorsMongo propios y dosorígenes/particiones. Conserva ochopruebas previas y añade runtime/coordinator/HTTP reales: crear tarea/categoría/vista, perder respuesta después de commitreal y antes deACK, conservar UUID/payload/leasepending, replay durable con unjournal porintención y diagnóstico fresco que desbloquea tresACKs; otrodispositivo converge contraMongo. Reload/idle conservaoutcomesliteralmente. Segundoescenario mueve contenidoindependiente mientras moveunsupported/tagdependiente/conflicto enotradispositivo permanecen conservados y visiblesdiagblockers; settled es pasada sinrunnable, no convergenciapersonal. Nunca claimed niACK ni superseded dehistoriabloqueada.

HTTPshim sólo remapea rutas al servidor loopbackpropio con cookies/cache/signal/query originales; servidor anuncia2 sólo enfixture y exige capabilityrun/cuentaesperada. Controlficticio usa epochactual y cleanupverifica own/null incluso despuésdereload via markerporrun; pagehideclose sinborrado. Amboscontroles/DBproductos/pestaña/servidores/runnerMongo/container/tmpfs propioslimpios, exit0, sinerroresconsole. FullDoD373pass/86opt-inskip/0fail/6418aserciones/lint463/tipos/build34recursos/diff correctos, prueba Mongo navegador diezchecks. Activohooks/API/config/producción/índicesfueraDBtest sin cambios; preferencias siguen preparadas hasta activaciónsegura. Entrada42%5h/76%7d, reserva4%/1%. Próxima11c4a5p contratoactivaciónsegura+diagnósticos/resumen; task.move histórico requiereexecutorcompatible o recuperación explícita antesdeprometer ordensinblockers. Commitpush/HEAD/cuotas porentrega.

### 11c5a1p — Núcleo puro reutilizable de colocaciones

Intercalar extracción acotada mientras activación/diagnóstico se documentan; entrada34%5h/74%7d, reserva4%/1%. Paralelo explícito disjunto: worker personal_outcomes posee src/lib/preferences/task-placement-command.ts, test en misma carpeta y adapter src/lib/local-db/task-placement-mutation.ts. Root posee únicamente plan/contrato de activación. Extraer algoritmo planTaskPlacements sin cambiar comportamiento ni ampliar productores: tipo TaskMoveCommand inferido agnóstico desde SyncCommand, sin useclient ni import de módulos cliente en núcleo; adapter vigente reexporta para conservar callers. Mantener ranks implícitos/negativos/fraccionarios/compactación multiefecto, sentinel overdue, metadata/tombstones/revisiones locales y outputs clonados. No autoridad/CAS/ACK/fecha de envío remota ni executor. Tests directos de compacción/revisiones/createdAt/sentinel/ocurrencia/tombstones/vecinos y regresiones vigentes task-move/day; fullDoD y commitpush/HEAD/cuotas separado. No introducir validación nueva que cambie algoritmo sin justificarla; wrappers actuales ya validan contexto. La política civil diferida para intención1 sigue decisión pendiente: no usar reloj remoto actual para rechazar offline histórico ni inventar timestamp.

### 11c4a5p — Contrato de activación segura

Root owns plan/mixed-sync-activation.md, master/iterations/local-preference-evidence/iteration-log. Documentación sólo: definir transición completa servidor+cliente1/2, diferencias intención1/envelope2/metadata2/backup2, guardia previa a executor y cursor, prerrequisitos de índices explícitos y pasos sin tocar DB de usuario. Aceptación: ninguna activación implícita al registrar módulo o anuncio2; clientes antiguos bloqueados incluso push iniciado tras handshake1 anterior; servidor1 antecliente2 rechaza antesefectos; resumen visible de bloqueos conservados y pilotoRPCNext/Google separados de fixtureloopback. Señalar límites task.move/series/settings y recuperación pendiente. Validar rutas/referencias/consistencia/diff; commitpush y cuotas. Paralelo con extracción disjunta11c5a1p ya seleccionada, sin código compartido.


### Resultado 11c4a5p — Contrato de activación segura

Documento [mixed-sync-activation.md](mixed-sync-activation.md) distingue módulos preparados de producto activo, intención1/transporte2/evidencia2/backup2 y alcance tags/vistas frente a movimientos/series/settings. Orden: resumen compartido, readiness de índices readonly, provisión explícita autorizada, frontera autenticada, conexión conjunta cliente/UI y piloto de transiciónNext/Google. Matriz incluye acciónlegacy tras handshake previo, cliente2/servidor1, intenciónfutura, índicefaltante y cuenta/época. No anunciar rango1–2 ni fabricar ACK para cola histórica. Políticacivil overdue sigue pendiente, sin inventartimestamp ni relojremoto.

Sólo docs, rutas/referencias/consistencia y diffcheck validados; no repetir suite/build ya aprobados ni ejecutar acciones sobre DB real. Entrada34%5h/74%7d; paralelo disjunto con extracción11c5a1p, reserva4%/1%. Siguiente11c4a5s resumen puro compartido antes de readiness/API/UI. Commitpush/HEAD y cuotas por corte.

### 11c4a5i — Readiness de índices personales, sólo lectura

Entrada28%5h/73%7d, reserva4%/1%. Paralelo seleccionado: worker mixed_devices_proof owns src/lib/db/mixed-sync-index-readiness.ts y test, opcional integration.test mismafamilia si runnerselecciónvigente lo recoge; rootowns resumen puro de cola2+plan. Readonly de índices centrales explícitos tags/item_views por singleton, no create/drop ni modificar auth/productDB. Ready exige nombres+clavesordenadas+unique+partialfilter y ausencia de opciones incompatibles (sparse/collation/TTL/hidden) según definiciónregistrada; fallo de lectura no ready silencioso. Missingnamespace clasifica faltantes, demáserrorespropagan. API devuelve sólo ready/missing/incompatible (sin DBnames/PII/driver a features). Unitmock significativos de definiciones/errores/no writes; comprobaciónreal sólo DBdescriptoraislada y ensureIndexescentral seleccionado explícitamente, nunca tocar DBusuario. Sin calleractivo ni índicesnuevos; fullDoD/plan/commitpush/cuotas separados. Si no cabe prueba deMongo, limitar cierre al matcher puro y registrar lectura real pendiente.

### 11c4a5s — Resumen mixto puro

Root owns src/lib/sync/queue-summary-v2.ts y test, src/schemas/sync-queue-v2.ts. Reutilizar diagnosePersonalQueue y syncQueueSummarySchema vigente; categoríaspending mutuamenteexclusivas según capacidades/cadena, sending/conflicts/rejected porstate, contar unresolvedpersonales y bandera independiente de settled. Sin permiso/IO/ACK/normalización/hookactivo; ningún filtro aparte del registrycompartido. Tests ramascontenidoindependiente, histórico→dependientes, sender/conflict/rejected, supersededsolo frente a hijos, corrupción íntegra y resultado clonado. FullDoD/plan/commitpush/HEAD/cuotas; UI/activationposteriores.


### Resultado 11c5a1p — Núcleo puro de colocaciones

Extracción sin cambio de comportamiento: planTaskPlacements pasa a lib/preferences/task-placement-command.ts, tipo TaskMoveCommand inferido desde SyncCommand agnóstico; adapter cliente reexporta para conservar todos los callers. Cuerpo del algoritmo idéntico al HEAD anterior, sin nuevos permisos, validación ni activación. Mantiene metadata/revisiones locales, ranks implícitos/negativos/fraccionarios y compactación multiefecto, identidad de aparición y sentinel overdue sin alterar command.date. No permite restaurar tombstones ni vecinos no adyacentes.

Seis tests directos/35aserciones, más regresiones task-move/day:18tests/116aserciones. FullDoD379pass/86opt-inskip/0fail/6453aserciones/lint465/tipos/build34recursos/diff aprobados. No Mongo ni browser repetidos por extracción pura; local UI/reordenación conserva lógica. Entrada28%5h/73%7d, reserva4%/1%, worker disjunto personal_outcomes y revisión root. Siguiente de activación11c4a5s/resumen y11c4a5i/readiness en preparación; futuro orden11c5a2 cierra política/planner remoto antes de repositorios/executor/ACKpull de placements. Commitpush/HEAD/cuotas al cierre.

11c4a5i: root añade scripts/sync-db-test-runner.ts como target_path de integración para incluir explícitamente el nuevo integration.test en el runner propio; worker conserva sólo sus tres archivos. La selección de índices no modifica el bootstrap automático existente del singleton; el helper sólo ejecuta listIndexes y no provisiona índices personales.


### Resultado 11c4a5s — Resumen mixto puro

Resumen independiente consume diagnosePersonalQueue, sin segundo filtro de capacidades ni grafo propio. Cuenta categorías pending mutuamente exclusivas, sender/conflict/rejected separados y total personal no resuelto con bandera conservadora. Schema mantiene suma de pendientes vigente, bandera coherente con count personal y count acotado por estados no resueltos. Superseded no es ACK de hijos; solo no bloquea proyección personal si no quedan intenciones pendientes. Conteo no autoriza envío ni declara convergencia, sin IO/normalización/hookactivo.

Cuatro tests/16aserciones: movimiento histórico con descendiente y contenido independiente, ACK frente a superseded, estados personales en vuelo/conflicto/rechazo sin doble conteo, cuenta/grafo y contrato de counts/clones. DoD383pass/86opt-inskip/0fail/6469aserciones/lint469/tipos/build34recursos/diff aprobados sobre fuentes estables. Entrada25%5h/73%7d trasfd1e090, reserva4%/1%, root paralelo disjunto con readiness. Siguiente11c4a5i lectura de índices centrales con prueba Mongo propia; después frontera mixta y conexión compacta del cliente según contrato. Commitpush/HEAD/cuotas al cierre.

### 11c4a6p — Respuesta pull mixta privada preparatoria

Entrada20%5h/72%7d, reserva4%/1%. Worker personal_outcomes owns src/features/sync/pull-response-v2.ts y test, src/schemas/mixed-pull-request.ts; rootowns readinesscierre+plan. Dependenciasreader2/receipt2/transport2 ya cerradas; sin routes/actions/hooks/configactivo. Exige cuentaesperada no opcional en schema compartido, parámetros únicos/strict/cursorbound, actor autenticado válido y coincidente antes readiness/reader. Readinessserver dependency estructural ready+missing/incompatiblevacíos o503 sin leerjournal; falloauth/readiness/reader no filtra errores. Respuestaempre privada/no-store/anuncio2 explícito independiente deconfigactivo1; validar página completa contra actor/query capturada antes responder, usar guardlocal receipt para stores aún admitidos. Querycaptured clones protegen de mutaciónreader; cursorfuturo409 y cuenta409, auth401, invalid400, fallostemporales503. Unitmock meaningful fronte2/1/actormismatch/error/missingidx/corruptpage/checkpoint, sinACK/writes/IOreal nideclarar piloto Google. FullDoD/plan/commitpush/HEAD/cuotas; siguiente acciónmixta conguardiadeíndices y prueba fronteraNextantesconectar.


### Resultado 11c4a5i — Readiness de índices personales

Helper server-only de lectura selecciona exactamente tres índices explícitos tags/item_views del registro central. Verifica definición completa relevante: nombres únicos, orden de claves, unique, filtro canonical JSON y opciones sparse/hidden/collation/TTL; metadata Mongo inocua v/ns/background no cambia la decisión. Devuelve sólo ready/nombres missing/incompatible, sin datos de cuenta. NamespaceNotFound Mongo26 equivale a ausencia; otros errores propagan para no anunciar falso ready. No create/drop/provisión personal propia; getCollection conserva bootstrap automático existente del singleton. No caller activo ni nuevo índice registrado.

Diez tests mock/46aserciones y prueba Mongo real: DB exacta del descriptor, ensureIndexes central sólo en DB propia, readinesstrue y listIndexes antes/después iguales. Runner incluye nuevo test explícitamente,56pass/0fail/620aserciones/13files y recursos propios limpios. FullDoD393pass/89opt-inskip/0fail/6515aserciones/lint471/tipos/build34recursos/diff correctos. Entrada20%5h/72%7d tras764ab5d publicado, reserva4%/1%. Fuente/revisión root y tests worker disjuntos; última preparación paralela11c4a6p pullresponse privada, después revisar coste de siguiente acción y cerrar con reprogramación verificada. No autorización de índices/DB del usuario. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a6p — Descarga mixta privada preparatoria

Servicio server-only independiente con puertos de actor, readiness y journal. Exige cuenta esperada; rechaza parámetros duplicados, desconocidos o fuera de límites antes de leer índices o datos. Todas las respuestas son privadas, no-store y anuncian exclusivamente transporte 2. La cuenta incorrecta y el cursor adelantado tienen códigos específicos; los demás fallos ocultan detalles internos. Readiness incompleta impide leer el journal. Valida la página completa contra actor, consulta capturada, checkpoint y stores admitidos; entrega un clon de la consulta al reader para impedir que cambie la validación posterior.

Ocho tests nuevos y regresión legacy: 13 tests/307 aserciones. DoD global: 401 pass, 89 opt-in skip, 0 fail, 6796 aserciones; lint 474 archivos, tipos, build con 34 recursos neutros y diff correctos. Sin rutas/actions/config ni callers activados. Entrada 16%5h/71%7d, reserva 4%/1%. Siguiente corte pequeño: readiness del servicio de envío mixto antes de conectar fronteras reales y clientes. Commit/push, HEAD remoto y cuotas al cierre.

### Preparación 11c4a6s — Guardia del envío mixto

Objetivo: preparar un servicio server-only aislado que reutilice pushSyncBatchV2 y compruebe readiness antes del primer executor, sin activar acciones ni cambiar el protocolo del producto. Target_paths: src/features/sync/guarded-push-batch-v2.ts y su test; root posee plan/**. Dependencias: batch/dispatcher 2, readiness 11c4a5i y descarga 11c4a6p. Worker personal_outcomes posee únicamente estas dos rutas; otros agentes pueden estar en el repositorio y no se revierten sus cambios.

Aceptación: cuenta/protocolo/query inválidos no leen índices ni ejecutan; readiness incompleta o fallo devuelve el prefijo retry_later vacío del batch, conservando UUID e intención. Readiness se consulta una vez por invocación válida, antes de ejecutar; no es garantía de inmutabilidad futura de índices. Fallos de auth ocultan detalles y no inventan unauthorized ni ACK. Reutilizar validación de resultados y semántica de replay existente. No IO de producción, nuevos índices, cambios de rutas/config/hooks ni deps. Validación: tests de puertos para guardias/readiness/fallos/replay, lint, tipos, suite global, build y diff; documentación, commit/push y cuotas. Entrada 12%5h/71%7d; reservar cierre 4%/1% y no abrir otro corte de producto largo.


### Resultado 11c4a6s — Guardia del envío mixto

Servicio server-only independiente que reutiliza pushSyncBatchV2. Actor, cuenta esperada, envelope y versión se validan antes de readiness. Comprueba índices una vez por invocación válida, inmediatamente antes del primer executor; ausencia, inconsistencia o error conserva todas las intenciones mediante retry_later vacío y UUID de la primera operación. No guarda readiness entre invocaciones ni promete que los índices sean inmutables. Si falla una operación posterior, conserva el prefijo durable validado del servicio existente. Fallos del puerto de autenticación propagan un error genérico sin cause ni detalles privados, sin inventar unauthorized o ACK.

Seis tests nuevos y batch vigente: 12 tests/116 aserciones; suite global 407 pass, 89 opt-in skip, 0 fail, 6853 aserciones. Lint 476 archivos, tipos, build con 34 recursos neutros y diff correctos. Sin callers/rutas/actions/config ni DB del usuario. Entrada 12%5h/71%7d; reserva 4%/1%, cierre documental y revisión del reinicio después de publicación. Siguiente candidata 11c4a7p: preparar frontera autenticada real y pruebas de transición, sin activar parcialmente categorías antes de índices y cliente mixto. Commit/push, HEAD remoto y cuotas al cierre.


### Cierre 11c4a8d — Lote del 9 de octubre y siguiente ventana

Objetivo y target_paths: cerrar estado real y presupuesto en plan/master.md, workflow.md, iterations.md, iteration-log.md y mixed-sync-activation.md, con próxima revisión del mismo heartbeat verificada. Dependencias: entregas publicadas hasta 11c4a6s, HEAD de código 4f0dc939f01b9270809db7968a10ad896c11ee20. Aceptación: no código abierto ni falsa activación; siguiente corte definido, fecha futura real y una única revisión pendiente. Validación documental: referencias, consistencia y git diff --check; commit/push en int, HEAD remoto y cuotas después.

Se cerraron prueba mixta de dos dispositivos/Mongo, capacidades/diagnóstico, coordinador, HTTP2, snapshot/dispatch, runtime, piloto conjunto, contrato de activación, núcleo puro de orden, resumen, readiness, descarga privada y guardia de envío. Suite final 407 pass/89 opt-in skip/0 fail; tipos, lint y build aprobados. Todos los recursos de pruebas creados por el lote se limpiaron. El producto sigue en transporte 1: tareas/eventos propios simples activos; categorías/asignaciones preparadas, orden manual/series/compartidos pendientes de sus executors y activación. No se tocaron DB del usuario, hosting, permisos ni secretos.

Lectura después del último código publicado: 9%5h/70%7d, reset real 1791516313 (9 de octubre, 05:25:13 Europe/Madrid). La próxima revisión está confirmada para las 05:27: reinicio más un minuto, redondeado hacia arriba. automation_update actualizó el mismo comprobar-renovaci-n-de-cuota, ACTIVE, misma política failed_runs_only y mismo chat; la revisión histórica alternativa permanece PAUSED. No duplicados ni hora inferida. Revisar cuotas reales al despertar antes de continuar; reserva 4%5h/1%7d y cadena autorizada mientras haya trabajo/margen. Los últimos cortes completos consumieron cuatro y tres puntos; con reparación/publicación/cierre, no cabe la siguiente frontera autenticada completa dentro del margen sobre reserva. Este cierre no abre otro corte de código.

### Preparación 11c4a7p — Frontera autenticada preparatoria

Renovación comprobada: 100%5h/70%7d, reset siguiente 1791534431 (9 de octubre, 10:27:11 Europe/Madrid); reservas 4%5h/1%7d y continuación encadenada autorizada. Partida cc091b9 publicada, int limpio. Objetivo: conectar los servicios mixtos preparados a sesión persistida y DAL reales en módulos independientes, sin cambiar rutas, anuncios ni cliente activos. Target_paths worker personal_outcomes: src/features/sync/authenticated-pull-v2.ts, src/features/sync/authenticated-push-v2.ts, src/features/sync/actions-v2.ts y tests de los dos adapters. Root posee plan/** e integración. Dependencias: sesión/allowlist vigentes, descarga y envío guardados, readiness y dispatcher2.

Aceptación: actor exclusivamente de getAuthorizedSessionFromHeaders, flags persistidos vigentes y cuenta esperada validada por schemas; readiness antes de reader/executor; acción sólo input unknown y headers reales, sin actor inyectable desde RPC. Puertos de pruebas no son endpoints ni bypass de auth; sin sesión/cuenta cambiada/envelope legado/índices ausentes no hay escritura ni ACK. Defaults de adapters usan auth/DAL registrados sin Mongo fuera de lib/db. Prueba por puertos verifica orden, query/rango, privacidad, prefix replay y sesión rechazada; no llamarla RPC real. Fuente inglesa, copia gráfica española si fuese necesaria. Validar tests, lint, tipos, build, suite global, diff y referencias, plan/registro, commit/push/HEAD/cuotas.

Paralelo seleccionado con contratos y rutas disjuntas: personal_outcomes implementa sólo esos cinco archivos; mixed_devices_proof revisa en lectura únicamente el runner Next/auth real y propone el corte siguiente; backup_transition_review revisa en lectura únicamente los prerrequisitos de provisión explícita y transición. Ningún agente modifica plan, scripts compartidos, config o índices; root integra. Todos saben que no están solos y no revierten cambios ajenos.

### Preparación paralela 11c4a7h — Anuncio explícito de identidad

Objetivo: permitir que una futura frontera mixta anuncie exactamente 2 reutilizando la respuesta privada de identidad, conservando el default 1 y el body validado. Target_paths root: src/features/sync/identity-response.ts y identity-response.test.ts; root comparte únicamente plan/integración. No solapa adapters de personal_outcomes. Dependencias: encoder de rango y schema workspace existentes. Aceptación: llamada actual mantiene 1, llamada explícita 2 rechaza cliente1 y admite2, body/status/caché intactos, versión inválida rechaza y no rango1–2. No cambiar ruta/identidad ni configuración activa. Validar tests directos, suite, lint, tipos/build/diff; cierre separado tras 11c4a7p, cuotas antes de elegir otra entrega.


### Resultado 11c4a7p — Adaptadores autenticados y acción mixta preparatoria

Adapters server-only usan por defecto sesión persistida/allowlist, readiness y reader/dispatcher reales, con imports diferidos para no inicializar auth en pruebas de puertos. La acción independiente use-server acepta sólo input unknown, obtiene headers reales de Next y no expone actor ni puertos por RPC. Cada invocación lee sesión fresca; cuenta/protocolo/query y readiness mantienen las guardias de los servicios existentes. Sin sesión o account mismatch no hay DAL; errores internos no se filtran. Ninguna ruta, cliente, anuncio o acción legacy se ha activado o cambiado.

Ocho tests de puertos/109 aserciones prueban headers exactos, sesión nueva, rechazos antes de índices, readiness antes de IO, privacidad y prefijo durable. No se presenta como prueba de RPC Next/Google. Root revisó los cinco archivos. FullDoD sobre estas fuentes y anuncio explícito paralelo estable: 417 pass/89 opt-in skip/0 fail/6982 aserciones; lint481/tipos/build34 recursos neutros/diff correctos. Entrada 100%5h/70%7d renovada; reservas4%/1%, reset real1791534431. Publicación y cuotas al cierre; anuncio explícito 11c4a7h pendiente de su commit independiente y después runner de frontera Next real.


### Resultado 11c4a7h — Identidad con anuncio explícito

Respuesta privada de identidad reutilizable con versión opcional validada por encoder. Sin parámetro conserva exactamente anuncio1; versión explícita2 conserva body/status/no-store y excluye cliente1, sin rango1–2. Versiones inválidas rechazan. Ruta y configuración activas intactas. Tres tests/29 aserciones; dos nuevos. FullDoD ya ejecutada sobre estos dos archivos estables junto a adapters: 417pass/89opt-in skip/0fail/6982 aserciones, lint481/tipos/build34 recursos/diff correctos. No repetir checks caros sin cambios nuevos. Entrada87%5h/68%7d trasbb18501 publicado, reservas4%/1%. Siguiente: runner de frontera Next real y preparación explícita de índices en recursos propios; commit/push/HEAD/cuotas por corte.

### Preparación paralela 11c4a8p — Provisión personal explícita con puertos

Objetivo: preparar selección central y ejecución explícita verificable, sin conectar DB real ni CLI del usuario. Target_paths backup_transition_review: src/lib/db/mixed-sync-index-specs.ts, mixed-sync-index-provisioning.ts y test; mixed-sync-index-readiness.ts para reutilizar selector; schema compartido src/schemas/mixed-sync-index-provisioning.ts si hace falta. No editar ensure-indexes.ts ni registro/config/scripts compartidos. Root integra plan; no solapa futura prueba Next propia. Dependencias: tres specs explícitas registradas y readiness cerrada. Entrada86%5h/68%7d, reserva4%/1%; contratos de índice conocidos, no política de datos nueva.

Aceptación: selección exacta de tres nombres/colecciones/provisioning desde registro, sin duplicar claves/opciones. Plan distingue ready/noop, create_missing y blocked_incompatible; valida cuenta de nombres/duplicados/coherencia del snapshot y no recibe selección arbitraria. Reinspección antes de ejecutar; incompatibilidad bloquea todos los creates, sólo crea missing registrados, conserva prefijo confirmado ante fallo y reinspecciona sin rollback/drop/rename/deduplicar. Resultado saneado sin errores Mongo crudos/URI/valores. Equivalente con otro nombre puede fallar y requiere revisión, no reparación automática. Testear reintento/estado parcial/cambio de readiness/corrupción y exclusión del bootstrap automático. No driver fueraDB, dependencias nuevas, prod/userDB ni afirmar índices inmutables. FullDoD, documentación, commit/push/HEAD/cuotas.

### Preparación paralela 11c4a7n — RPC real de Next en entorno propio

Objetivo: preparar y ejecutar una app Next temporal que importe acción2 real mediante referencia compilada y use sus defaults de sesión/DAL. Target_paths mixed_devices_proof: test/next-sync/**, src/lib/db/next-sync-fixture.ts y test, nuevos src/config/next-sync-test.ts y src/schemas/next-sync-test.ts, scripts/next-sync-test-runner.ts. Root posee únicamente integración scripts/sync-db-test-runner.ts y plan/**. No solapa provisión 11c4a8p, config/índices existentes no se editan. Dependencias: adapters/action2 publicados bb18501, identidad explícita950617a, descriptor/runner Mongo existente. Contrato de puertos cerrado; dos cortes si compilación y prueba completas lo requieren, nunca commit de fixture rota.

Aceptación: build/start Next reales en build/dalis-next-sync-<run> ignorado, alias al src real, sin routing/proxy productivos ni fabricar Next-Action/POST manual. Cliente importado usa startTransition. Subprocesos reciben sólo descriptor y auth fake explícitos; no env real ni preload server-only en Next. Sesiones BetterAuth persistidas via plugin testUtils instalado y cookies Set-Cookie, nunca tokens en JSON/logs; prueba no representa Google interactivo. Requests de fixture validados por schemas compartidos y capability del run, loopback/orígenes exactos. Dos hosts 127.0.0.1/localhost aíslan cookies; puertos solos no. Acción real sin cookie/actor equivocado/sesión revocada/legacy envelope no escribe. Cuenta válida confirma own task/tag/view; otro cliente descarga, replay no duplica revisión/journal. Índices sólo en DB descriptor propia y selector central. Cleanup sólo procesos/archivos/DB/container del run con ownership verificado, sin recursos/cookies de usuario. Scope de ejecución completa puede cerrarse después del harness en corte separado. FullDoD y evidencia browser/Next pertinente, plan/registro/commitpush/HEAD/cuotas.

### Preparación paralela 11c4a9u — Resumen compacto compatible con preferencias

Objetivo: preparar el panel existente para el futuro resumen mixto sin activar el transporte. Target_paths root únicamente src/features/sync/components/sync-status-panel.tsx y test; no solapa provisión ni fixture Next. Dependencias: summary2 validado y estado de pasada existente. Aceptación: alcance por enum opcional con default de tareas/eventos vigente; cuando el caller futuro seleccione alcance mixto, describir categorías/asignaciones y mantener orden/repetición local. Si summary2 conserva proyección personal, mostrar contador compacto y conservación local; settled no oculta pendientes ni supone convergencia. Default actual/callback/nav/tamaño táctil intactos, sin nuevo bloque de estado grande o destino. Testear renders de alcance1/2 y bloqueos personales; fullDoD al estabilizar fuentes, plan/registro, commit/push/HEAD/cuotas. Entrada86%5h/68%7d, reserva4%/1%; corte útil pequeño independiente mientras se prepara prueba Next.


### Resultado 11c4a8p — Provisión explícita por puertos

Selector central devuelve copias detached de las tres especificaciones exactas y conserva provisioning explícito; readiness reutiliza la selección. Schema exige nombres conocidos, únicos/disjuntos y bandera coherente. Plan distingue ready/create_missing/blocked sin recibir definición arbitraria. Ejecución sin conexión/defaultcaller reinspecciona antes de cada create y después del último/error, bloquea incompatibilidad, conserva sólo calls resueltas en created y observa posible efecto de un create rechazado. Drift o desaparición de un índice propio devuelve incomplete, sin bucle de reparación. No drop/rename/rollback/deduplicación. Errores finitos para duplicados/definición/creación/inspección, sin mensajes/cause/URI/valores.

Nueve escenarios nuevos más readiness/registro:32 tests/146 aserciones. Root revisó cinco archivos y la suite global sobre fuentes estables junto al panel preparado:428pass/89opt-in skip/0fail/7058 aserciones; lint485/tipos/build34 recursos/diff correctos. No DB conectada ni CLI/caller/índices nuevos. El bootstrap automático vigente sigue separado; no afirmar inspección de conexión totalmente readonly. Entrada86%5h/68%7d tras950617a, reservas4%/1%. Siguiente prueba Mongo propia del planner/provisión y CLI revisable, además de fixture Next en paralelo disjunto. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a9u — Panel compacto preparado para resumen mixto

El panel existente admite summary2 y un alcance opcional explícito. Default mantiene el texto de transporte1; sólo un caller futuro seleccionará categorías/asignaciones sincronizadas. Orden de tareas y repetición siguen descritos como locales. Contador personal compacto indica conservación de categorías/asignaciones cuando la proyección está retenida; settled conserva pendientes/conflictos visibles y no declara convergencia. No nueva tarjeta grande, ruta, nav, hook o transporte activado.

Dos tests nuevos de render; seis tests/25 aserciones del panel, incluida sesión/cola/protocolo vigente. Root fullDoD sobre archivos estables:428pass/89opt-in skip/0fail/7058 aserciones, lint485/tipos/build34 recursos/diff correctos. Sin repetir global tras sólo docs. Entrada68%5h/65%7d tras25cd628, reservas4%/1%; siguiente RPC Next propia y prueba Mongo de provisión. Commitpush/HEAD/cuotas al cierre.

### Preparación paralela 11c4a8m — Provisión en Mongo propio

Objetivo: comprobar partial-create y reintento reales sin DB del usuario. Target_paths backup_transition_review sólo src/lib/db/mixed-sync-index-provisioning.integration.test.ts; root posee integración futura del modo indexes en scripts/sync-db-test-runner.ts y plan. No solapa fixture Next ni config compartida. Dependencias: 11c4a8p publicado, descriptor/imagen Mongo propios. Aceptación: modo aislado sólo para este test, DB exacta nueva, sin compartir índices con otras suites; duplicados propios causan fallo unique después de prefijo confirmado, registros intactos y error saneado. Tras limpiar sólo fixture duplicada, reintento crea únicamente missing; ready/noop no crea. Simular respuesta perdida después de create real y comprobar reinspección, sin falso created/rollback. Cada índice borrado/registro limpiado es creado por este run y se verifica ownership. GlobalDoD más ejecución del runner propio y cleanup; commitpush/HEAD/cuotas. Entrada67%5h/65%7d, reservas4%/1%; no agregar más entregas largas antes de revisar coste de fixture Next.

Ajuste de 11c4a7n: cliente invoca referencia compilada de un wrapper ServerAction exclusivo del fixture. Ese wrapper valida capability y cookies propias dentro de la misma RPC y llama a pushSyncOperationsV2 sin puertos ni actor. Prueba NextRPC→acción productiva/defaultauth/DAL reales, pero no equivale a probar el ID exacto del endpoint productivo. Evita TOCTOU del guard GET; sin cookie puede probar unauthorized, cookie ajena bloquea sin tocarla. Business logic del fixture fuera de routing.


### Resultado 11c4a8m — Provisión parcial con MongoDB real propio

Modo aislado indexes consume el descriptor validado y ejecuta sólo la prueba de provisión en una DB nueva propia. Dos escenarios/20 aserciones pasan: duplicado sintético causa fallo unique después de dos creaciones confirmadas, conserva registros y resultado saneado; limpieza explícita de la única fixture duplicada permite crear sólo el índice pendiente, y ready no crea. Una respuesta perdida tras create real no se incluye falsamente en created, pero readiness observa el efecto y el reintento crea sólo los restantes. Índices y registros limpiados son exclusivamente los del run; contenedor/tmpfs/proxy propios cerrados y runner exit0. Sin DB del usuario ni reparación automática.

FullDoD sobre fuentes estables, incluido harness Next preparatorio todavía sin ejecutar:431 pass/93 opt-in skip/0 fail/7074 aserciones; lint491 archivos, tipos, build34 recursos neutros y diff aprobados. Entrada67%5h/65%7d, reservas4%/1%. La prueba RPC Next es un corte independiente pendiente de build y navegador, no evidencia Google. Commit/push/HEAD remoto y cuotas al cierre.


### Resultado 11c4a7n — Frontera RPC Next real en recursos propios

App Next temporal compila y arranca en dos procesos/orígenes loopback con env sintético explícito y MongoDB del descriptor propio. Cliente llama una referencia Server Action compilada de wrapper exclusivo del fixture; capability y cookies propias se verifican dentro de la RPC antes de invocar acción2 productiva sin puertos ni actor. Defaults reales usan sesión Better Auth persistida/allowlist, readiness, dispatcher y DAL. No es el ID exacto de la acción productiva desplegada ni Google interactivo. Dos hosts aíslan cookies; registry privado por run compartido entre chunks reconoce sólo valores propios, cookies ajenas bloquean sin sobrescribir/borrar. Cleanup selecciona sólo cookies/sesiones/procesos/archivos registrados y timeout10min acota espera; fallos muestran sólo fase/HTTP/categoría finita.

Siete escenarios aprobados en navegador integrado: RPC sin sesión no escribe; dos sesiones de la misma cuenta; crear tarea/categoría/asignación con tres recibos y journal3, ambas descargas iguales a Mongo; replay conserva revisiones/diario; cuenta/versiones incompatibles no escriben; revocación y caducidad rechazan sin afectar la otra sesión; usuario no verificado rechazado. Correspondencia y applied se validan contra intención original. Recursos propios y cookies limpiados; runner exit0, pestañas propias cerradas. Captura de evidencia local /private/tmp/dalis-next-rpc-proof-20261009.jpg. Prueba funcional del servidor, no proyección IndexedDB de producto; evidencia de runtime/coordinador de dos dispositivos permanece en11c4a4p.

La compilación detectó alias absolutos interpretados como relativos por Turbopack y la prueba de readiness corrigió runId. Next16 instalado normaliza127.0.0.1 a localhost en Request.url; fixture valida protocolohttp y Host exacto registrado, mantiene Origin/capability y no modifica configuración experimental. Templates compiladas reales y app normal build34 recursos aprobados; no routing/config/auth productivos alterados. FullDoD final432pass/93opt-in skip/0fail/7079 aserciones, lint491/tipos/build34/diff. Cuatro tests/21 aserciones de guardias incluyen Host normalizado, Host/Origin/protocolo ajenos y rechazo de forwarded-only; ningún cambio funcional al recorrido ya aprobado. Entrada45%5h/62%7d tras26d2738; lectura durante cierre26%/59%, reservas4%/1%. Siguiente: destino/CLI de provisión revisables y conexión conjunta del cliente según contrato; no ejecutar índices en DB del usuario sin autorización de entorno. Commitpush/HEAD/cuotas al cerrar.


### Preparación 11c4a8v — Vista previa offline de índices personales

Objetivo: hacer revisables las tres definiciones centrales antes de preparar el comando de provisión de entorno. Target_paths root: scripts/preview-personal-indexes.ts, package.json y plan/**; secuencial, sin agentes. Dependencias: selector central11c4a8p y provisión real propia11c4a8m. Aceptación: comando separado sólo de vista previa, sin argumentos/URI/destino/flags de apply ni llamadas a getDatabase/auth/ensureIndexes; salida JSON inglesa con scope offline e índices centrales exactos, sin crear índices o anunciar disponibilidad. Runtime server-only mediante condición react-server, sin preload de mocks ni archivo env. No equivale a inspección Mongo o autorización del entorno. Validación: ejecutar preview sin env cargado, revisar selección exacta y rechazar argumentos desconocidos sin salida parcial; lint/tipos/suite/build/diff y referencias. Entrada22%5h/58%7d, reservas4%/1%; cerrar con commitpush/HEAD/cuotas antes de elegir más trabajo.


### Resultado 11c4a8v — Definiciones revisables sin conexión

Comando db:preview-personal-indexes imprime JSON inglés con scope offline_definition_preview/databaseAccess none y las tres especificaciones exactas del selector central. No acepta argumentos ni apply; no llama auth/getDatabase/readiness/ensureIndexes. Usa condición react-server instalada, sin mocks. Smoke ejecutado con entorno vacío y --no-env-file pasa sin variables Mongo/auth, selección exacta y provisioning explicit comprobados; --apply rechaza con exit1 y sin JSON parcial. El launcher bun run puede heredar variables de su padre, pero la vista previa no las consume; para revisión aislada usar bun --no-env-file run db:preview-personal-indexes. No prueba disponibilidad de índices de un entorno ni autoriza crearlos.

FullDoD432pass/93opt-in skip/0fail/7079 aserciones, lint492/tipos/build34/diff correctos. Sin tests redundantes añadidos por script reversible; smoke verifica el comportamiento solicitado. Entrada22%5h/58%7d, reservas4%/1%. Siguiente: contrato de destino explícito y procedimiento de ejecución autorizado, sin DB del usuario. Commitpush/HEAD/cuotas por entrega.


### Preparación 11c4a8c — Contrato de ejecución de índices de entorno

Objetivo: cerrar destino, efectos y cortes del futuro CLI antes de implementar conexión. Target_paths root: plan/personal-index-provisioning.md, mixed-sync-activation.md, master.md, iterations.md e iteration-log.md. Secuencial, sólo documentación. Dependencias: preview11c4a8v, planner/provisión11c4a8p y pruebas Mongo11c4a8m. Aceptación: distinguir preview offline de operación online; destino explícito con DB sin fallback y autoridad Mongo exacta antes de cualquier import que conecte; detallar nueve índices automáticos del singleton además de tres personales; no llamarlo inspección readonly ni inferir preproducción desde un nombre de DB. Errores/exit/resultados saneados, sin reparación/rollback ni secretos/URI en argumentos/logs. Plan dividir guardia pura, adaptador/CLI y prueba propia antes de autorización de entorno y activación conjunta. Validar referencias/consistencia/diff, commitpush/HEAD/cuotas; no repetir DoD de código estable. Entrada20%5h/58%7d, reservas4%/1%.


### Resultado 11c4a8c — Destino y efectos del futuro CLI

Contrato [personal-index-provisioning.md](personal-index-provisioning.md) cierra destino explícito, autoridad sin credenciales, DB sin fallback, autorización de conexión concreta y nueve índices automáticos del singleton además de tres personales. No ofrecer inspección readonly: getDatabase puede crear índices automáticos faltantes antes de readiness. CLI sigue sin implementar; preview offline vigente no conecta. Servicio personal existente conserva partial-create/retry/error incierto y nunca rollback/deduplicación. Cortes siguientes guardia pura11c4a8g, adaptador/CLI11c4a8e, prueba propia11c4a8t, conexión conjunta/piloto autorizado.

Sólo docs: referencias, consistencia con fuente/registro y diffcheck validados, sin repetir suite/build estables432pass/93skip. Entrada20%5h/58%7d, reservas4%/1%. Commitpush/HEAD/cuotas al cierre. Sin DB del usuario ni cambio de permisos/hosting/protocolo activo.


### Preparación 11c4a8g1 — Guardia pura del descriptor de destino

Objetivo: validar descriptor explícito y comparar DB/autoridad resueltas sin IO. Target_paths root: src/schemas/personal-index-target.ts, src/lib/db/personal-index-target.ts y test, plan/**. Secuencial, sin agentes. Dependencias11c4a8c. Aceptación: schema estricto local/preproduction, nombre DB explícito conservador y autoridad sin URI/credenciales/ruta/query; comparar exactamente con configuración ya resuelta y devolver copia; rechazo genérico sin cause/valores. Sin leer env/URI, conectar, auth o defaults. Este subcorte no resuelve autoridad desde URI:11c4a8g2 debe validar formas del driver/configuración sin fallback antes de conectar CLI. Probar mismatch, selección production, ausencia/credenciales y seedlist/SRV como descriptores, no como conexiones Mongo. FullDoD/diff/referencias, plan/registro/commitpush/HEAD/cuotas. Entrada19%5h/57%7d, reservas4%/1%; no abrir adaptador de conexión en esta ventana.


### Resultado 11c4a8g1 — Descriptor de destino comparado sin IO

Schema estricto exige entorno declarado local/preproduction, DB explícita conservadora y autoridad de conexión ya resuelta sin userinfo/URI/ruta/query/whitespace. Guardia pura compara DB/autoridad exactas con configuración resuelta y devuelve copia; todo rechazo usa error finito sin cause ni valores. No lee env, interpreta URI, conecta ni acredita ownership/autorización. Formato completo/resolución de autoridad desde URI y ausencia de fallback del lector son dependencia11c4a8g2; esta guardia no debe conectarse a CLI directamente con getDatabaseEnv fallback.

Dos tests/54 aserciones: coincidencia/copia, descriptores loopback/seedlist/IPv6, mismatch exacto frente a substring, production/extra/ausencia y datos inseguros sin filtración. FullDoD434pass/93opt-in skip/0fail/7133 aserciones; lint495/tipos/build34/diff correctos después de corregir literal de entorno del test. Sin Mongo/browser adicionales porque no IO ni cambios al producto. Entrada19%5h/57%7d, reservas4%/1%. Siguiente11c4a8g2 resolver/config, antes de adaptador de conexión. Commitpush/HEAD/cuotas al cierre.


### Preparación 11c4a8e1 — Alcance completo en revisión offline

Objetivo: mostrar bootstrap automático junto a selección personal exacta sin conectar. Target_paths root: scripts/preview-personal-indexes.ts y plan/**; secuencial. Dependencias11c4a8v/11c4a8c y selector automaticIndexSpecs central. Adelanto independiente de la parte offline de11c4a8e: resolver/config11c4a8g2 sigue necesario antes del CLI online. Aceptación: preservar indexes personales y añadir automaticIndexes directamente del selector que usa getDatabase; sin listas/números hardcodeados, IO/env o apply; datos sólo de registro. Smoke en entorno vacío verifica nueve automáticos/tres explícitos actuales y separación sin duplicados; argumentos desconocidos siguen rechazados sin JSON. FullDoD/diff/referencias, plan/registro/commitpush/HEAD/cuotas. Entrada17%5h/57%7d, reservas4%/1%.


### Resultado 11c4a8e1 — Revisión offline del alcance completo

Preview conserva indexes personales y añade automaticIndexes desde automaticIndexSpecs, el selector real del bootstrap del singleton. Nueve automáticos y tres explícitos actuales quedan separados, sin duplicados ni una segunda lista. No conecta, lee env o admite argumentos/apply; smoke en proceso con entorno vacío/--no-env-file confirma salida íntegra y rechazo exit1 sin JSON parcial. No ejecutar este JSON como instrucciones ni anunciar readiness; es revisión de definiciones del código.

FullDoD434pass/93opt-in skip/0fail/7133 aserciones; lint495/tipos/build34/diff y referencias correctos. Sin nuevos tests redundantes por extensión de presentación; separación del catálogo ya cubierta por pruebas centrales. Entrada17%5h/57%7d, reservas4%/1%. Adelanto offline independiente cerrado;11c4a8g2 resolver/configuración permanece siguiente antes del adaptador/CLI online. Commitpush/HEAD/cuotas por entrega.


### Preparación 11c4a8g2 — Resolver de configuración explícita sin conexión

Objetivo: derivar descriptor DB/autoridad desde configuración sin fallback antes del futuro CLI. Target_paths root: src/config/personal-index-provisioning.ts y test, src/config/env.ts getter, plan/**. Secuencial. Dependencias11c4a8g1/11c4a8c; revisar parser instalado del driver para userinfo/SRV/listas. Aceptación: DB explícita, URI mongodb/mongodb+srv, extraer autoridad exacta sin credenciales/path/query; validar conservadoramente DNS/IP/puertos/IPv6 y SRV único sin puerto, rechazar ambigüedad/espacios/fragmentos/credenciales sin escapar; no devolver URI/PII/cause ni conectar. Getter sólo config/env.ts; parser puro no muta env. No validar disponibilidad/permisos/opciones completas del driver ni admitir sockets Unix; documentar alcance conservador. Tests de formas válidas, fallbacks, mismatch via guardia y errores sin URI. FullDoD/diff/referencias, plan/registro/commitpush/HEAD/cuotas. Entrada16%5h/57%7d, reservas4%/1%; último corte de código antes de cierre/reprogramación, sin adaptador online.


### Resultado 11c4a8g2 — Configuración explícita y autoridad sin conexión

Parser puro y getter config/env.ts derivan descriptor desde MONGODB_URI/MONGODB_DB raw explícitos, sin fallback. URI mongodb/SRV, userinfo escapado, lista ordenada de seeds, puertos y IPv6 conservadores; SRV único sin puerto. Devuelve sólo DB/autoridad exacta sin credenciales/ruta/query, errores genéricos sin cause/URI. No abre conexión ni muta env; comparación exacta reutiliza guardia previa. Referencia: parser del paquete del driver instalado, sin importarlo como dependencia nueva. No parser completo de opciones/disponibilidad ni sockets Unix; rechaza formas ambiguas/duplicadas, caracteres sin escapar y puertos fuera de rango/ceros iniciales.

Dos tests nuevos/81 aserciones y guardia:4 tests/135 aserciones. FullDoD436pass/93opt-in skip/0fail/7214 aserciones; lint497/tipos/build34/diff correctos. Pruebas usan objetos sintéticos, sin modificar variables globales ni DB. Entrada16%5h/57%7d, reservas4%/1%. Siguiente adaptador/CLI online11c4a8e2 y prueba propia11c4a8t, antes de autorización de entorno/conexión conjunta. No activar producto ni ejecutar DB del usuario. Último corte de código de esta ventana; commitpush/HEAD/cuotas y cierre con revisión futura real.


### Preparación 11c4a8e2a — Ciclo de ejecución por puertos

Objetivo: cerrar orden de destino/bootstrap/provisión/cierre antes de conectar CLI. Target_paths root: src/lib/db/personal-index-execution.ts y test, src/schemas/personal-index-target.ts request, plan/**. Secuencial; sin defaults ni caller/DB real. Dependencias11c4a8g1/g2/provisión preparada. Aceptación: acuse explícito del bootstrap automático y target schema antes de leer configuración; mismatch sin bootstrap/cierre, DB real distinta tras bootstrap sin crear personales, intento bootstrap fallido cierra, cierre fallido no declara éxito ni pierde resultado durable. Puertos requeridos sólo server-only, errores/estado finitos sin causas/URI, proceso propio como requisito del futuro adaptador. Tests de orden/ausencia de efectos/cierre y conservación de resultado; fullDoD/diff/referencias/plan/commitpush/HEAD/cuotas. Entrada13%5h/56%7d, reservas4%/1%; cierre seguro tras esta entrega, sin abrir conexión real ni CLI.


### Resultado 11c4a8e2a — Ciclo privado por puertos

Servicio server-only con puertos requeridos, sin defaults/caller/conexión: valida target y acuse explícito de bootstrap antes de configuración, compara destino antes de abrir, comprueba DB real antes de provisión y cierra tras cualquier intento de bootstrap, incluso si éste rechaza después de abrir. Estado/fase/cierre finitos sin detalles externos; fallo de cierre no declara éxito y conserva observación de provisión y prefijo confirmado. No revierte índices ni limpia recursos de entorno. Futura integración debe usar proceso operador propio y singleton, no RPC ni startup productivo.

Cuatro tests/28 aserciones por puertos prueban guardias antes de IO, bootstrapfallido, DBdistinta, ready/noop con cierre, fallo de cierre y partial-create+closefail sin perder prefijo/readiness. FullDoD440pass/93opt-in skip/0fail/7242 aserciones, lint499/tipos/diff; build34 aprobado sobre runtime estable y caso adicional test-only validado después con tipos/suite. No prueba Mongo del nuevo ciclo/CLI real todavía. Entrada13%5h/56%7d, reservas4%/1%. Siguiente11c4a8e2b defaults/CLI,11c4a8t ejecución propia; no DB del usuario. Última entrega de código del lote antes de cierre/revisión futura. Commitpush/HEAD/cuotas al cerrar.


### Cierre 11c4a8z — Ventana del 9 de octubre, 05:27

Objetivo/target_paths: cierre seguro en plan/master.md, workflow.md, iterations.md, iteration-log.md y mixed-sync-activation.md, revisión futura del mismo heartbeat y candidato desde último código completo. Dependencias: todas las entregas publicadas hasta7525376a3dd38083bfcecbef100d11644c5e5b52. Aceptación: repo sin código abierto, recursos propios limpios, estado activo/preparado fiel y una única revisión verificada; sólo docs, referencias/consistencia/diffcheck, commitpush/HEAD/cuotas al cierre.

Lote cerrado: adapters autenticados/action2/identidad explícita; UI mixta compacta; provisión personal por puertos y partial-create/retry/respuesta perdida con MongoDB propio; siete escenarios RPC Next reales con dos sesiones BetterAuth persistidas y Mongo propios; preview offline de nueve índices automáticos/tres personales; contrato y guardia/resolver de destino explícito sin fallback; ciclo de ejecución por puertos con cierre seguro/prefijo conservado. Suite final440pass/93opt-in skip/0fail/7242 aserciones, lint499/tipos/build34 aprobados. Todos los contenedores/procesos/builds/pestañas/cookies propios de las pruebas limpiados; evidencia visual local conservada. No DB del usuario/hosting/secretos/permisos ni nuevas dependencias core. Producto permanece transporte1; categorías/asignaciones preparadas, orden manual/series/compartidos siguen sus dependencias. Next sintético no acredita Google interactivo ni ID exacto del endpoint desplegado.

Lectura después del último código:10%5h/56%7d; reserva4%/1%. El último ciclo completo consumió tres puntos, pero siguiente defaults/CLI más prueba real propia requiere margen adicional de integración/reparación/publicación/cierre, no abrirlo sobre esta reserva. Próxima11c4a8e2b defaults/CLI separado y11c4a8t prueba propia, antes de pedir autorización de ejecución concreta de entorno y activar conjuntamente API/runtime/UI. No fabricar ACK para task.move histórico ni descartar dependientes.

Reset publicado actualizado1791534432 (9oct10:27:12Madrid; primer registro del lote fue10:27:11). Una única revisión de comprobar-renovaci-n-de-cuota reprogramada y verificada ACTIVE para9oct10:29Madrid, reset+unminuto redondeado hacia arriba; notificationPolicy failed_runs_only y chat preservados. Automatización alternativa histórica siguePAUSED; no duplicados/cron/TOML manual ni hora supuesta. Al despertar verificar renovación real, ambas cuotas y último HEAD completo antes de continuar. Autorización encadenada mientras haya trabajo útil/margen y no cancele usuario, reservas4%5h/1%7d, sin créditos/reinicios.


### 11c4a8auth — Autorización explícita de índices preproductivos

Objetivo y target_paths: registrar autorización humana en plan/personal-index-provisioning.md, mixed-sync-activation.md, master.md, workflow.md, iterations.md e iteration-log.md y actualizar el heartbeat existente sin cambiar horario/política. Dependencias: procedimiento preparado hasta7525376 y próxima revisión10:29. Aceptación: usuario confirma DB distintas y autoriza crear índices personales necesarios y automáticos registrados faltantes únicamente en preproducción, reutilizando ensureIndexes después de validar procedimiento, sin otra confirmación. Producción excluida; no borrar/corregir datos ni reparar incompatibilidades automáticamente. Esta autorización sustituye exclusiones históricas de DB del usuario sólo para esa provisión. Verificar conexión preview/int desde fuente de configuración de entorno; nunca asumir que .env.local es preview ni conectar para averiguarlo.

Lectura6%5h/55%7d, reservas4%/1%: sólo cierre documental ahora; defaults/CLI/prueba propia y ejecución preproductiva continúan en revisión10:29 tras verificar renovación. CLI Vercel/project link local no disponibles en comprobación inicial; resolución del destino permanece pendiente, sin acceso a DB ni credenciales impresas. No confundir autorización con ejecución o categorías activadas. Validación documental referencias/consistencia/diff, actualización de heartbeat preservando campos, ConventionalCommit/pushint/HEAD/cuotas.


### Preparación11c4a8e2b — Defaults privados y CLI operador

Objetivo: conectar ciclo privado a singleton/selector/ensureIndexes y comando separado sin caller productivo. Target_paths root: src/lib/db/personal-index-operator.ts y test si puertos/defaults lo requieren, package.json e integraciónplan; personal_outcomes: scripts/provision-personal-indexes.ts, src/schemas/personal-index-cli.ts y tests puros del parser. Contrato cerrado: runPersonalIndexProvisioning(input:unknown) retorna PersonalIndexExecutionResult; defaults sólo en adapter server-only, input DTO target+acknowledgeAutomaticBootstrap; sin actor/puertos RPC. CLI cincoargs entorno/DB/autoridad/--apply/--acknowledge-automatic-bootstrap, valida schema antes de llamar adapter y no imprime URI/args/causes. Resultado JSON finite; exit0 sólo ready+closed, fallos exit1. Root publica package script tras revisión, no duplicar lógica deprovisión.

Dependencias: guardia/config/resolver/ciclo11c4a8g1/g2/e2a, registro/provisión central, autorización preprod explícita. Aceptación: validación/config destino antes de cualquier conexión; bootstrap sólo getter singleton, DB real antes de personales, readiness/creates centrales, cierre awaited y errores saneados; no tocarDBusuario todavía hasta CLI validado con Mongo propio11c4a8t. Invocación inválida con envvacío rechaza sin conexión; ningún logging de errores crudos. Lint/tipos/suite/build/diff y smoke pertinent; plan/registro/commitpush/HEAD/cuotas. Entrada100%5h/55%7d, reservas4%/1%, reset1791552560.

Paralelo seleccionado: root adapter/integración/plan, personal_outcomes únicamenteCLI/schemaCLI/test; backup_transition_review sólo investigación readonly de fuentes/configuración preview/int y acceso disponible, sin abrir DB, imprimir credenciales, instalar herramientas o modificararchivos. No solapar package/scriptshared/config existente; agentes no están solos y no revierten cambios ajenos. Investigación no implica autorización de hosting/secretos/permisos; sólo localizar acceso/fuentes necesarios para creación de índices ya aprobada.


### Resultado11c4a8e2b — Defaults privados y CLI operador

Adapter server-only reutiliza config explícita, ciclo por puertos, getDatabase singleton, readiness y ensureIndexes central. CLI separado con cinco argumentos exactos, sin URI/credenciales; parser antes de import, exit0 sólo ready+closed. Excepción inesperada produce stderr genérico sin recibo inventado. Tests parser3/126aserciones y smoke entorno vacío config ausente -> failed/configuration/not_opened exit1. Suite443pass/93skip/0fail/7368aserciones, lint503/tipos/build34/diff aprobados. Entrada renovación100%5h/55%7d, reservas4%/1%, reset real1791552560 (15:29:20Madrid). No conexión DBusuario ni activación producto. Investigación readonly encontró Vercel Preview/Production URI separadas; falta DB explícita solicitada. Siguiente11c4a8t CLI/defaults/bootstrap real con descriptor propio, después provisión preproductiva autorizada al verificar destino. Commitpushint/HEAD/cuotas al cerrar.


### Preparación11c4a8t — CLI y defaults con Mongo propio

Objetivo: ejecutar comando separado real y adapter default contra descriptor aislado, acreditar bootstrap9/personal3, guardias antes de escribir, fallo parcial por duplicados sin reparación y retry/noop/cierre. Target_paths personal_outcomes: src/lib/db/personal-index-operator.integration.test.ts; root scripts/sync-db-test-runner.ts (modo operator aislado) e integraciónplan. Dependencias25eca36, descriptor validado, runner ownership y registro central; sólo DB temporal propia del run. Paralelo seleccionado con rutas disjuntas y contratos cerrados; root dueño sharedrunner/plan. No agentes adicionales.

Aceptación: CLI bun --no-env-file --conditions=react-server, configuración exclusivamente descriptor propio, stdout finito y exitstatus/connection coherentes; invalidargs/mismatch/missingexplicitDB dejan índices pendientes; comando válido bootstrap automático y personales exactos, secondrunnoop, datos duplicados intactos con prefijo/readiness/retry. Tests no conectan sin optin; limpian sólo fixtures/índices propios, timeout/cierre de proceso. Verificar frescura y DBnombre antes de drops de test; ningún drop de usuario. Docker/imagen revalidados. PruebaMongo pertinente y lint/tipos/suite/build/diff, plan/registro/commitpush/HEAD/cuotas. Entrada87%5h/53%7d reservas4%/1%.


### Resultado11c4a8t — Procedimiento online validado con Mongo propio

CLI real por subprocess sin preloadmock, defaults singleton/config/ensureIndexes y descriptor propio:3pass/70aserciones. Antes de drops de test se acreditan nombre DBfresh, todas colecciones vacías y registro automático; singleton padre queda cached para observar sin reparar automáticamente. Invalidargs/config DB ausente/mismatchDB/autoridad mantienen nueve índices retirados deliberadamente sólo en test. Aplicación válida recrea exactamente9automáticos+3personales y luego noop. Duplicados11000 mantienen documentos/prefijo2/readiness y cierre; eliminación explícita de una fixture propia permite retry sólo active-name restante. Exit0 sólo ready+closed, salida parseada finita, timeout, errores sin URI/PII. Docker28.4/imagepinned8.2.11amd64 revalidados, contenedor/tmpfs/bridge propios limpiados.

Suite443pass/98opt-in skip/0fail/7368aserciones, lint504/tipos/build34/diff aprobados. Root runner modooperator y agenttest con rutas disjuntas, sin DBusuario. Entrada87%5h/53%7d reservas4%/1%. Procedimiento ya validado para actuación preproductiva autorizada; falta nombre DB explícito solicitado tras inspección de VercelPreview. Mientras tanto siguiente ensamblaje cliente2 inactivo/controles mixtos y guardia de retirolegacy, según dependencia de activación; no activar parcialmente producto. Commitpushint/HEAD/cuotas al cerrar.


### Preparación11c4a9c1 — Ensamblaje cliente mixto inactivo

Objetivo: dispatchercliente2, resumen mixto con guardias cuenta/época y adaptación de intento/scheduler existentes sin duplicar su scheduling; conservar diagnóstico de éxito y limpiarlo al cancelar/cambiar cuenta o ante fallback de error. Target_paths root: features/sync/client-action-v2.ts, mixed-sync-summary.ts y tests; personal_projection: mixed-sync-controls.ts y tests. Rutas relativas bajo src; root integra plan. Paralelo seleccionado, contratoscerrados/propiedad disjunta, sin ediciones de hook/providers/routes/config activa. Agentes no están solos. Dependenciasd5f29dc, acciones/runtime2/queue-summary2 y controles1 probados. Entrada75%5h/51%7d reservas4%/1%.

Aceptación: startTransition llamaaction2 sólo desde dispatcherpreparado; resumen abre partición esperada tras guardia, snapshot2, guardia posterior y cierre siempre; controles2 reutilizan SyncAttempt/SyncScheduler con coalescencia/backoff/cierre, diagnóstico intacto de settled sin afirmarconvergencia, cancelled/account_changed diagnosticonull. No imports nuevos desde caller productivo: transporte1 sigue vigente y no endpoint2activado porconfig. Tests pertinentes sin globalmocks/cuotaDBusuario, lint/tipos/suite/build/diff, plan/registro/commitpush/HEAD/cuotas. Índices preprod pendientes únicamente de destino explícito solicitado, no permiso.


### Resultado11c4a9c1 — Ensamblaje cliente2 preparado

Dispatcher2 independiente, lector de resumen mixto con identidad capturada/guardias antes y después/cierre seguro, y adapters de intento/scheduler sobre controles existentes. Ocho tests/57aserciones: conserva pendientes personales/diagnósticos de bloqueo, rechaza snapshot/cuenta ajena, coalescencia/cierre/cancelación/backoff y pausa; stopped/account_changed/fallback no retienen diagnóstico. Sin hook/providers/rutas/config activa editados. Manifiesto Next conserva exactamente una acciónnode/ceroedge antes y después: dispatcher2 todavía sin caller productivo. Suite451pass/98skip/0fail/7425aserciones, lint509/tipos/build34/diff aprobados. Entrada75%5h/51%7d, reservas4%/1%. Próximo11c4a9c2 composición privada de runtime/transport/controles2 y prueba; retirolegacy preparatorio y matriz antes de activación. NombreDBpreprod solicitado sigue pendiente, no conexiónusuario. Commitpushint/HEAD/cuotas.


### Preparación11c4a9c2 — Composición privada y retirolegacy preparado

Objetivo: ensamblar HTTP/runtime/intento/resumen2 con identidad capturada y refreshguardado; preparar rechazo compatible del pushlegacy que podría llegar tras handshake1 antiguo. Target_paths root: src/features/sync/mixed-sync-client.ts y tests/plan; personal_outcomes: retired-sync-push.ts y tests bajo features/sync. Paralelo seleccionado con contratoscerrados y rutas disjuntas, sin cambios de acciones/rutas/hook/providers/config actuales. Dependenciasdecf92e y fronterasautenticadas existentes. Entrada68%5h/50%7d reserva4%/1%.

Contratos: createMixedSyncClient(account, privateportsdefaults) retorna readSummary/createAttempt; valida userId/epoch compartidos, transport2 bindcuenta, runtime2 propio, guardiarefresh+close. Retirement server-only readSession headers persistida, envelopelegacy validado/cuenta esperada, resultado legacy update_required sin puertoexecutor (una ausencia/cambio de sesión mantiene unauthorized/account_changed). Aceptación: composición sin calleractivo, coalescencia/guardias/resourceclose/diagnóstico, inputcapturado/transport2, no fallbackRPClegacy; retirementnoACK/noDBexecutor y salida legacyparseable. Pruebas pertinentes, lint/tipos/suite/build/diff, manifiesto app aúnacción1; plan/registro/commitpush/HEAD/cuotas. Provisiónpreprod sigueesperando datoDBexplicito, sin credenciales leídas/conexiónusuario.


### Resultado11c4a9c2 — Composición privada y retirolegacy

createMixedSyncClient valida userId/epoch compartidos y captura identidad inmutable; enlaza HTTP2, dispatcher/runtime/resumendefaults, SyncAttemptV2 y refreshguardado. Retirement server-only autentica sesiónpersistida y envelope/cuenta, responde estado legacy update_required sin executor/recibos/readiness. Ocho tests/79aserciones; legacyHTTP con handshake1 anterior conserva intención/cursor/historia, libera lease y no aplicaACK. Fallosdeauth saneados sin causes. Ningún calleractivo conectado ni config/rutas actuales cambiadas; manifiesto mantiene una acciónnode/ceroedge. Suite459pass98skip0fail7504aserciones, lint513/tipos/build34/diff aprobados. Entrada68%5h/50%7d reservas4%/1%; commitpushint/HEAD/cuotas. Siguiente pruebaNext de composicióndefaults/directactionref/retirement en recursos propios, sin Google ni activaciónreal; DBpreprod siguependiente de nombre explícito solicitado.


### Preparación11c4a9n — Next directo con composicióndefault y dosparticiones

Objetivo: probar composicióncliente2 sin puertos sustituidos, dispatcher2/reference acciónproductiva directa, account-control/IndexedDB reales y RPC/Mongo propios; retirementfixtureautenticado separado sin invocaracciónlegacy writable. Target_paths root: test/next-sync/features/default-api.ts.template, handler.ts.template/actions.ts.template y nuevos templates app/api/sync/identity|changes routing-only, integraciónplan y ejecuciónUI; import_sync_proof: schemas/next-sync-test.ts, test/next-sync/features/controller.tsx.template/device-client.ts.template y nuevo local-client.ts.template. Rutasdisjuntas, rootúnicodueño sharedintegration. Paralelo seleccionado, no agentesadicionales ni edits productactiveroutes/hook/config. Dependencias5ed278f y runnerNextcerrado. Entrada58%5h/48%7d reservas4%/1%; dividir/cerrar si prueba/reparación/publicación deja sin margen.

Contratofixture: nuevasAPIsexactas /api/sync/identity|changes verifican configdescriptorpropio, cookiecapacidad delrun, Host/Origin/cookiesauthregistradas antes de helpersdefault. Bootstrap setea cookiepropiaephemeral; cleanupúnicamenteesa cookie si propiedadverificada. Clientcommands cerrados por schema: prepare-local/commit-local/mixed-summary/mixed-run/local-snapshot/cleanup-local; comandosdurables restringidos item.create/tag.save/item-view.set. createMixedSyncClient sinsegundoarg. Pushdirecto dispatchSyncOperationsV2 tras guardiafixture, retirementRPC separado validateNextSyncFixtureHeaders->rejectRetiredSyncPush.

Aceptación: dosorigins/sessionespersistidas propias y particioneslocales propias, intención/ACK/summary/cursor/proyección igualMongo para tareacategoríaasignación; replay/noop no duplica, sesiónsinpermiso noACK, retirementupdate_required conMongo intacto. Limpiar sólo particiones/control/cookies/servidores/build/containerpropios verificados, awaitstop/closeantescleanup. No Google real ni endpointIDdeldeployment acreditados, producto sigue1. Prueba Next compilado+UI con evidencia y lint/tipos/suite/build despuésde limpiargeneratedworkspace; plan/registro/commitpush/HEAD/cuotas. DBpreprod pendiente de nombre explícito solicitado, sin conexiónusuario.


### Resultado11c4a9n — Composición default y acción directa en Next

Nueve escenarios Next compilado con dos sesiones BetterAuth persistidas, dos orígenes/particionesIndexedDB y Mongo propios pasan. Se usa dispatchSyncOperationsV2 directo y createMixedSyncClient sin puertos sustituidos: tres intencioneslocales pending con dependencias reales pasan a acknowledged por ACK remoto; ambos snapshots items/tags/itemViews y cursor coinciden exactamente con journalMongo de seisrecibos. Summary/noop conservan todos los stores e historia; replay no duplica. Retirementfixtureautenticado devuelve legacyupdate_required sin mutaciones. Matriz auth/cuenta/versiones/revocación/caducidad/noverificado conservada.

APIs exactas sólo en proyecto temporal, guardadas por cookiecapacidadúnica delrun y config/Host/Origin/cookiesauthregistradas antes de defaults. Sólo particiones/control sin estado previo creadosporrun; cleanupcontrol/marker/cookiepropios verificado y serializado antesdefinish. Dosservidores/buildtemp/container/tmpfs/bridge/pestañas/cookies/IndexedDB propios limpiados. Evidencia local /private/tmp/dalis-next-client-proof-20261009.jpg. Ningún Googleinteractivo ni ID del deploymentreal acreditados, no DBusuario. Producto permanece1 con unaacciónnode/ceroedge; lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados trascleanup. Entrada58%5h/48%7d reservas4%/1%; commitpushint/HEAD/cuotas. Siguiente recuperación de sesión/epoch con cola local mediante mismacomposicióndefault si cabe; provisiónpreprod mantiene pendiente nombreDBexplicito solicitado.

### Preparación 11c4a9r — Recuperación de sesión con cola local real

Objetivo: demostrar que la composición cliente mixta por defecto conserva una intención local mientras la sesión remota está revocada y la confirma una sola vez después de volver a autenticar al mismo usuario. Dependencias: 9119cc5, fixture Next de nueve escenarios y particiones propias. Entrada 41%5h/46%7d, reservas 4%/1%.

Paralelo seleccionado con ownership disjunto: import_sync_proof sólo test/next-sync/features/controller.tsx.template y local-client.ts.template/device-client.ts.template/src/schemas/next-sync-test.ts si fueran necesarios; root integra plan, ejecuta runner/UI, revisa evidencia y publica. No cambios de producto activo, rutas o configuración; no DB del usuario. El agente conserva cambios ajenos y no hace commits.

Aceptación: intención propia nueva guardada offline antes de enviar, sesión revocada devuelve unauthorized sin claim/ACK ni mutación Mongo; reautenticación del mismo actor permite ACK real único preservando UUID/payload y después ambas particiones convergen con el journal. Se mantienen los escenarios previos y cleanup exclusivo de recursos propios. Validación Next compilado con Mongo/IndexedDB/sesiones reales y evidencia visual, lint/tipos/suite/build/diff; registro y Conventional Commit/push int/HEAD/cuotas. No afirmar prueba de Google interactivo ni activación productiva.


### Resultado 11c4a9r — Reautenticación con intención local conservada

Diez escenarios del fixture Next compilado pasan. El nuevo caso revoca la sesión del segundo dispositivo, guarda una intención real mediante outbox y obtiene unauthorized antes de claim: todos los stores, UUID/payload, attempts0, lease null y cursor permanecen idénticos; Mongo no cambia. Reautenticar al mismo actor permite un único envío y ACK, con la operación original y attempts1; exactamente un item, recibo y entrada de diario nuevos. Ambos dispositivos descargan y coinciden con las proyecciones y cursor de Mongo; noop conserva ACK/historia sin duplicados. Los nueve escenarios previos se mantienen.

Sólo controller de fixture editado, sin caller activo o cambios de protocolo del producto. Un narrowing de tipos detectado por el build del fixture se corrigió antes de ejecutar; ambos runs limpiaron exclusivamente sus recursos propios. Evidencia /private/tmp/dalis-next-recovery-proof-20261009.jpg. Docker28.4/Mongo8.2.11amd64 fijado revalidados, sesiones/cookies/IndexedDB/servidores/build/container/tmpfs/bridge/pestañas propios cerrados. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada41%5h/46%7d, reservas4%/1%; commitpushint/HEAD/cuotas al cerrar. Producto todavía transporte1, sin Google interactivo ni provisión del usuario. Nombre DB preproductiva explícito sigue pendiente. Próxima prueba acotada de época local si el margen permite cerrar completa.

### Preparación 11c4a9a — Cambio de cuenta remota con cola propia

Objetivo: probar que el cliente mixto por defecto detecta otra cuenta autenticada antes de reclamar o enviar una intención de la cuenta local y permite reanudar únicamente tras recuperar su sesión. Dependencias 2f37e8a y fixture con actores propios owner/other. Entrada31%5h/44%7d, reservas4%/1%.

Target_paths/ownership: import_sync_proof sólo test/next-sync/features/controller.tsx.template; root plan, revisión y ejecución/evidencia/publicación. Paralelo explícito de rutas disjuntas; sin nuevos actores, esquemas, DBusuario, calleractivo o configuración productiva. Aceptación: intención pending attempts0/lease null; sesión other válida con identidad distinta produce account_changed/upload0; backup completo/cursor y Mongo de owner/other intactos; reautenticación owner confirma exactamente una vez, mantiene UUID/payload y ambas proyecciones/cursor convergen sin duplicados. Mantener diez escenarios previos y cleanupown. Validación Next compilado/IndexedDB/Mongo reales más lint/tipos/suite/build/diff, plan/registro/commitpushint/HEAD/cuotas.


### Resultado 11c4a9a — Aislamiento al cambiar la sesión remota

Once escenarios Next compilado pasan. Una intención local propia pending, attempts0 y lease null permanece idéntica cuando la sesión persistida es de otro actor verificado del fixture: la composición default devuelve account_changed/upload0 antes de claim. Todos los stores/cursor y Mongo de ambas cuentas conservados. Al recuperar la sesión del propietario original, un único ACK mantiene UUID/payload, attempts1 y revisiones; ambos dispositivos convergen exactamente con el journal/cursor, categorías/vistas anteriores intactas y ninguna escritura en la otra cuenta. El helper común mantiene baseline anterior al ACK y los diez escenarios previos.

Sólo controller de fixture y plan editados. Recursos propios Next/Mongo/cookies/IndexedDB/procesos/build/container/tmpfs/bridge/pestañas limpiados; evidencia /private/tmp/dalis-next-account-proof-20261009.jpg. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada31%5h/44%7d reservas4%/1%; commitpushint/HEAD/cuotas al cerrar. Estado operativo destacado al principio del master y prerrequisito de índices actualizado con autorización vigente, sin otra aprobación. Transporte1 activo, dato DB pendiente; no Google ni DB del usuario. Siguiente preparación de hook mixto o prueba de época según margen de cierre completo.

### Preparación 11c4a9e — Invalidación real de época local

Objetivo: demostrar con IndexedDB real que la composición por defecto vinculada a una época anterior rechaza resumen/intento antes de enviar, conserva la intención pendiente y permite reanudar sólo mediante una composición de la nueva época. Dependenciasada2d62; entrada22%5h/43%7d reservas4%/1%. Coste observado de los dos cortes anteriores10/9puntos, margen para prueba/reparación/publicación/cierre; no ampliar a red en vuelo.

Ownership paralelo disjunto: import_sync_proof schemas/next-sync-test.ts y fixtures controller/local-client/device-client; root plan, revisión y ejecución/evidencia/publicación. DTO cerrado rotate-local sin parámetros: sólo control propio preparado y guardado, activatePreparedAccount mismo actor/expectedEpoch, captura nueva época/marker para cleanupown, composición vieja guardada para probar ambos rechazos y luego composición nueva sin puertos sustituidos. No usar errores externos como resultado ni comprobar cualquier rechazo accidental: requireActiveAccount de época antigua falla y el cliente viejo rechaza; la época nueva está activa.

Aceptación: UUID/payload/attempts0/lease null/stores/cursor y Mongo permanecen intactos tras invalidación; la nueva composición confirma una única operación y ambos dispositivos convergen. Cleanup verifica únicamente la nueva época propia. Mantener once escenarios previos; prueba Next real, lint/tipos/suite/build/diff, plan/registro/commitpush/HEAD/cuotas. No actor nuevo, logout remoto, DBusuario, protocolos/callers activos ni prueba de cancelación con red en vuelo.


### Resultado 11c4a9e — Época local invalidada antes del envío

Doce escenarios Next compilado pasan. DTO rotate-local cerrado y guardado opera únicamente el control propio del fixture: activatePreparedAccount del mismo actor con expectedEpoch, seguimiento inmediato de nueva época/marker para cleanup y creación de cliente default nuevo. La cuenta capturada, el resumen y el intento del cliente viejo rechazan específicamente por la guardia Local account changed during the operation; otro error hace fallar el escenario. La intención pending mantiene UUID/payload/attempts0/lease null, todos los stores/cursor y Mongo intactos. La nueva composición confirma un único ACK con intención original y ambos dispositivos convergen exactamente con diario/cursor, categorías/vistas previas e historia sin duplicados. No acredita cancelación de red en vuelo.

Once escenarios anteriores conservados, recursos propios Next/Mongo/IndexedDB/control/cookies/build/procesos/container/tmpfs/bridge/pestañas cerrados. Evidencia /private/tmp/dalis-next-epoch-proof-20261009.jpg. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada22%5h/43%7d reservas4%/1%, ownership agente schema y tres templates/root plan+ejecución. Producto aún1; nombre DB preproductiva pendiente, ninguna credencial leída/conexión al usuario. Siguiente hook mixto inactivo y matriz del despliegue antes de activación conjunta, o provisión ya autorizada si llega el dato. Commitpushint/HEAD/cuotas al cerrar.
