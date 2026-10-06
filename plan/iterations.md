# Iteraciones de implementación

Cada identificador, incluidas letras (`01a`, `01b`), representa una entrega con **su propio commit y pregunta de presupuesto**. No ejecutar automáticamente todo un bloque numerado. El orden es secuencial salvo decisión explícita conforme a [workflow.md](workflow.md).

Los `target_paths` describen el ámbito permitido; antes de editar, concretar archivos y leer instrucciones anidadas. Las rutas de pruebas se colocan junto al módulo cuando proceda. No crear todas las carpetas ni archivos vacíos por anticipado.

## Hitos y estado

| Hito | Entregas | Estado |
| --- | --- | --- |
| Plan y reglas | `00` | Completada; validación documental registrada en el log. |
| Responsive y lote desatendido | `00b` | Requisitos y protocolo incorporados. |
| Identidad y base offline | `01a–04c` | `01a–01b` implementadas y validadas automáticamente; `02–04c` pendientes. |
| Calendario personal y creación de tareas | `05a–07b` | Pendiente. |
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

### 05a — Botón `+` y formulario

- `target_paths`: `src/features/tasks/components/**`, `src/features/workspace/components/**`, primitivas realmente reutilizables en `src/components/ui/**`.
- Dependencias: `04c`.
- Aceptación: botón principal accesible; tarea con título, fecha, descripción y checklist se guarda offline; errores en español; fecha seleccionada precargada; edición y borrado lógico funcionan tras recarga.
- Alcance: mostrar solo opciones de creación ya operativas; añadir evento/cumpleaños en `08/10`, sin botones que simulen guardar.

### 05b — Categorías y estados

- `target_paths`: `src/features/tags/**`, estado/checklist en `src/features/tasks/**`, repositorios locales afectados.
- Dependencias: `05a`.
- Aceptación: crear/elegir categoría; “Sin categoría”; empezar/completar/reabrir; marcar checklist no completa tarea implícitamente; borrar categoría conserva tareas; todos los cambios escriben outbox y sobreviven offline.

## 06 — Calendario mensual y apertura del día

- `target_paths`: `src/features/calendar/**`, componentes de agenda inicial, entradas routing que los monten.
- Dependencias: `05b`.
- Aceptación: mes anterior/siguiente, “Hoy”, lunes como inicio, selección y URL del día; contadores e indicadores; abrir día muestra tareas reales; navegar a otro mes y recargar sin red; móvil y teclado usables.
- Alcance: cuadrícula propia sencilla, sin nueva librería de calendario. Contar eventos/cumpleaños cuando existan, no fabricar contenido de ejemplo como estado real.
- Hito: primera demostración útil de calendario personal offline.

## 07 — Agenda agrupada, orden y atrasadas

### 07a — Grupos y atrasadas

- `target_paths`: agenda en `src/features/calendar/components/**`, selectores/hooks de tareas, actualización de reloj.
- Dependencias: `06` y reglas de `02b`.
- Aceptación: título de categoría con sus tareas debajo; sección “Atrasadas” global con fecha original/estado; cambio de día y reentrada recalculan; completar retira de atrasadas; historial del día original preservado.

### 07b — Reordenación persistente

- `target_paths`: componentes/hooks de orden en `src/features/tasks/**` y `src/features/tags/**`, preferencias en `src/lib/local-db/**`.
- Dependencias: `07a`.
- Aceptación: mover grupos y tareas, cambiar categoría personal, ordenar atrasadas; alternativa de teclado a drag-and-drop; recarga conserva orden; operaciones por ID/intención, sin reemplazo global de arrays.

## 08 — Eventos y citas

- `target_paths`: `src/features/events/**`, selectores de calendario, reglas de zonas en `src/lib/calendar/**`, schemas de evento.
- Dependencias: `07b`.
- Aceptación: activar “Evento o cita”; hora, categoría, descripción, duración opcional y día completo; orden cronológico; evento que cruza medianoche visible en los días correctos; editar/borrar offline. Validar horas ambiguas/inexistentes y duración antes de guardar.
- Corte: si conversión de zona requiere aprobación de dependencia, cerrar primero su análisis; no aproximar horas silenciosamente.

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
