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
