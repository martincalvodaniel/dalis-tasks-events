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

### 11a — Repositorios, índices y transacciones

- `target_paths`: `src/lib/db/**`, tests de integración, scripts de setup estrictamente necesarios.
- Dependencias: `10`; confirmar replica set/clúster compatible sin exponer URI ni modificar datos reales.
- Aceptación: repositorios de entidades personales, compare-and-swap, borrados y comando de separar serie; mapeos sin driver fuera de DB; índices exactos centralizados; operación fallida revierte transacción. Preparar DB de prueba reproducible.
- Corte: si infraestructura no soporta transacciones, replantear garantía del journal antes de continuar.

### 11b — Acción validada e idempotencia

- `target_paths`: `src/features/sync/actions.ts`, validadores de sync, recibos/transacciones en DB, pruebas de autorización.
- Dependencias: `11a`.
- Aceptación: actor de sesión, input Zod limitado, recibo+mutación atómicos; mismo operation ID no duplica; payload diferente con ID reutilizado falla; revisión incorrecta devuelve conflicto; datos de otra cuenta rechazados. Separar resultado por operación del lote.

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
