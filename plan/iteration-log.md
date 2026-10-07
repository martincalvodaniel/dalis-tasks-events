# Registro de iteraciones

## 00 — Planificación inicial

- Fecha: 6 de octubre de 2026.
- Rama: `main`, comprobada antes de editar; árbol limpio al inicio.
- Estado: planificación y validación documental completadas; cierre mediante el commit indicado abajo.
- Presupuesto inicial comunicado por el usuario: **5h 99% restante; 7d 44% restante**. Lectura posterior de cierre recibida al abrir `01a`: **5h 92%; 7d 43% restantes**.
- Alcance: `plan/**` y reglas raíz de `AGENTS.md`. Sin código de aplicación ni nuevas dependencias.
- Resultado: decisiones sobre tres tipos, categoría personal, atrasadas derivadas, series/ocurrencias, permisos, IndexedDB, shell offline, sincronización e idempotencia. Roadmap partido en subentregas con aceptación y dependencias.
- Estado real observado: login Google con allowlist y sin adaptador persistente, dashboard protegido, singleton MongoDB con registro vacío de colecciones/índices; calendario y offline aún pendientes.
- Validaciones: 20 enlaces locales comprobados y resueltos en los 7 documentos de `plan`; `git diff --check` aprobado; revisión de requisitos contra modelo, roadmap y matriz de aceptación. Tipos/build/pruebas de aplicación no se han ejecutado: no aplican a esta entrega exclusivamente documental y serán obligatorios en entregas de código.
- Commit de cierre: `docs(plan): define offline task and event roadmap`. El hash real se comunica tras crearlo; no se anticipa en este archivo.
- Siguiente candidata: `01a`, secuencial. Antes de empezar, preguntar lectura restante de **ambas** ventanas y reevaluar. El 44% semanal inicial favorece una primera entrega acotada; no autoriza completar todo el bloque `01` de una vez.

## 01a — Identidad persistente

- Fecha: 6 de octubre de 2026. Rama: `main`; árbol limpio antes de editar.
- Presupuesto de entrada facilitado por el usuario: **5h 92% restante; 7d 43% restante**. Trabajo secuencial, sin agentes adicionales. La diferencia respecto a la lectura inicial no permite atribuir consumo exclusivo a esta conversación.
- Objetivo y ámbito: conectar auth al singleton MongoDB; cuatro modelos registrados, seis índices centrales, vista guardada del adaptador, pruebas de DB/auth y control de DB de test en `src/config/env.ts`. Instrucciones de DB y documentación del plan actualizadas en la misma entrega.
- Resultado: mismo ID persistido para la misma identidad Google entre clientes independientes, logout y reapertura de conexión; separación entre dos identidades; cuenta del proveedor única; usuario/cuenta/sesión persistidos. Arranque diferido, sin conectar durante importación/build, y reintento después de error de inicialización.
- Detalles: cuentas OAuth ya no se guardan en cookie; retirada de `refreshCache` incompatible con modo DB. La caché de sesión y migración de sesiones anteriores se revisan en `01b`. No se añadieron dependencias.
- Evidencia de tipos: `bun run type-check` aprobado (`tsc --noEmit`).
- Evidencia de build: `bun run build` aprobado, sin advertencias de auth tras el ajuste y sin importaciones server-only al cliente.
- Evidencia de pruebas: `bun run test` ordinario, 14 pruebas unitarias aprobadas; suite de integración desactivada por defecto. Con `RUN_AUTH_DB_TESTS=1`, MongoDB local real aislado y credenciales ficticias: **17 pruebas aprobadas, 0 fallos**. Incluye firma de ID tokens, identidad estable, sesiones persistidas, dos cuentas diferentes, restricción única de proveedor y generación de URL Google.
- Entorno de integración: contenedor temporal de imagen MongoDB ya disponible, puerto loopback `27029`, base `dalis-auth-test-01a`; tests crean y limpian solo esa base. El helper de config rechaza host remoto o nombres fuera de `dalis-auth-test-*` antes de ejecutar limpieza. Contenedor detenido y retirado después de las comprobaciones.
- Reproducción: configurar las variables habituales de auth con valores ficticios para el test, `ALLOWED_EMAILS` con `alpha@example.test,beta@example.test`, `MONGODB_URI` apuntando a MongoDB loopback aislado, `MONGODB_DB=dalis-auth-test-01a`, y `RUN_AUTH_DB_TESTS=1`; ejecutar `bun run test`. Las claves de firma se generan temporalmente; nunca se relaja el verificador de producción.
- Evidencia de lint: Biome de todos los archivos TypeScript modificados aprobado. `bun run lint` global detecta **cinco errores anteriores** `noSvgWithoutTitle` en `public/{file,globe,next,vercel,window}.svg`; esos assets no se modificaron. Se registran para revisión en el piloto sin afirmar que el lint global pasa.
- Evidencia documental: 21 enlaces locales comprobados; `git diff --check` aprobado. Sin archivos `.env*`, credenciales reales ni cambios de dependencias incluidos.
- Ajuste de aceptación: tests con dos clientes HTTP/cookies y key source ficticio sustituyen la prueba interactiva de esta entrega. **No se ha realizado login contra Google real ni inspeccionado la base de producción**; recorrido interactivo en navegadores queda explícito en `15a`.
- Desviación documentada: las consultas internas del adaptador pasan por una vista DB guardada, en lugar de reescribir la dependencia para usar `getCollection`. Índices solo provisionados por `ensure-indexes.ts`; auth usa atomicidad de documento e índices únicos, sin transacciones multi-documento de producto hasta `11`.
- Commit de cierre: `feat(auth): persist Google identities with MongoDB`. Hash real comunicado tras crear el commit.
- Siguiente candidata: `01b`, secuencial, tras lectura nueva de ambas ventanas. No se empieza automáticamente con los valores anteriores.

## 00b — Responsive y continuación desatendida

- Fecha: 6 de octubre de 2026. Rama `main`; árbol limpio al inicio.
- Presupuesto: **5h 82%; 7d 41% restantes**, confirmado por consulta de uso (18%/59% consumidos).
- Autorización: el usuario solicita varias iteraciones con commit mientras duerme; se sustituye temporalmente la pregunta de presupuesto por consulta de cuenta entre entregas, en secuencial y con reserva mínima del 20%.
- Resultado: requisito mobile-first, navegación inferior SVG en móvil y superior en escritorio desde un registro común; mantenimiento obligatorio con cada pantalla importante. Programada implementación `04c`, antes de UI de tareas.
- Ámbito: instrucciones raíz y documentos de plan; sin código de aplicación ni dependencias.
- Validación: revisión de consistencia, enlaces locales y `git diff --check` antes del commit.
- Commit: `docs(plan): add mobile-first navigation and unattended workflow`.
- Siguiente candidata: `01b`, previa lectura automática de ambas ventanas.

## 01b — Sesión vigente y transición

- Rama `main`; ejecución secuencial en lote desatendido autorizado. Presupuesto de entrada automático: **5h 80%; 7d 41% restantes**.
- Ámbito: auth/session, política de autorización extraída, configuración de caché, pruebas unitarias e integración DB; guía operativa y plan.
- Resultado: autorización lee DB sin caché ni renovación durante render; rechaza sesión caducada/revocada, identidad inconsistente, correo no permitido/no verificado y cookies históricas sin sesión persistida. Layout protegido conservado.
- Validación: `tsc --noEmit`, build de producción y Biome de archivos afectados aprobados; **22 tests aprobados** con MongoDB real y firmas de prueba. Incluye caché válida cuyo registro remoto se elimina/expira y configuración histórica stateless. Lint global sigue limitado por los cinco SVG anteriores, sin errores nuevos.
- Recursos: DB temporal aislada y contenedor retirados al cerrar. Sin cambios a producción, dependencias ni credenciales.
- Commit: `fix(auth): require authoritative persisted sessions`.
- Siguiente candidata: `02a`, después de consultar las dos ventanas.

## 02a — Contratos del dominio

- Rama `main`, secuencial; presupuesto de entrada: **5h 77%; 7d 40% restantes**, consulta de cuenta tras `01b`.
- Ámbito: `src/schemas/**`, tipos inferidos en `src/types/**` y documentación. Sin rutas, UI, driver ni dependencias nuevas.
- Resultado: tipos discriminados tarea/evento/cumpleaños, checklist con IDs, categorías/preferencias personales, ocurrencias con slot estable, reglas de recurrencia y permisos/invitaciones. Intenciones estrictas sin actor/propietario recibido del cliente; límite de lote por cantidad y bytes UTF-8.
- Validación: 24 tests unitarios aprobados (incluidos 7 nuevos escenarios de dominio); DB integration opt-in no repetida al no cambiar auth. Tipos, Biome de nuevos archivos y build de producción aprobados. Lint global conserva únicamente los cinco SVG de plantilla documentados.
- Representación explicitada: horarios en unión `schedule`, conversión UTC/DST pendiente de `08`; inferir tipos desde schemas evita validación duplicada. Fixtures usan datos ficticios y no se incorpora estado de prueba al producto.
- Commit: `feat(domain): define validated calendar and sync contracts`.
- Siguiente candidata: `02b`, previa consulta del presupuesto.

## 00c — Lint global sin ruido

- Rama `main`; presupuesto de entrada más reciente: **5h 73%; 7d 40% restantes**. Petición expresa de corregir los errores existentes antes de retomar `02b`.
- Objetivo y ámbito: títulos accesibles en español en los cinco SVG de plantilla de `public/**`, más registro en el plan. Sin modificaciones de rutas, dependencias ni reglas de lint.
- Resultado: desaparecen los cinco errores `noSvgWithoutTitle`; dibujos y tamaños conservados.
- Validación: `bun run lint` global aprobado (51 archivos, cero errores); `bun run type-check` y `bun run build` aprobados; `git diff --check` aprobado. No se añaden tests que dupliquen el contenido de los títulos.
- Commit: `fix(a11y): add accessible titles to template SVG assets`.
- Siguiente candidata: `02b`, secuencial, tras consulta automática de las dos ventanas.

## 02b — Fechas civiles y atrasadas

- Rama `main`, secuencial; presupuesto de entrada: **5h 71%; 7d 39% restantes**, lectura de cuenta después de `00c`.
- Objetivo y `target_paths`: fechas civiles, rangos mensuales/semanales y atrasadas en `src/lib/calendar/**`; validación de año positivo en `src/schemas/primitives.ts`; plan actualizado. Dependencia: contratos de `02a`.
- Resultado: hoy según la zona de la cuenta y reloj inyectable; aritmética sin offset local, rangos limitados con final exclusivo y semanas desde lunes. Atrasadas conserva referencias, fecha, estado y checklist; excluye completadas, borradas, canceladas, eventos/cumpleaños y padres de series. Motor de ocurrencias pendiente de `09`.
- Validación: **31 pruebas unitarias aprobadas, cero fallos**, incluidos siete escenarios de calendario; suite remota opt-in no repetida. Casos de medianoche, año nuevo, bisiestos, DST, años inferiores a 100, límites e invariancia de datos. Lint global, `tsc --noEmit`, build de producción y `git diff --check` aprobados.
- Commit: `feat(calendar): implement civil dates and overdue task selection`.
- Siguiente candidata: `03a`, secuencial y con verificación IndexedDB en navegador real; comprobar las dos ventanas antes de comenzar.

## 03a — Repositorios IndexedDB

- Rama `main`, secuencial; presupuesto de entrada: **5h 70%; 7d 39% restantes**, consulta de cuenta tras `02b`.
- Objetivo y `target_paths`: cliente, migración inicial, registro de stores, repositorio y helper transaccional en `src/lib/local-db/**`; fixture `test/browser/local-db.ts` y runner `scripts/browser-test-server.ts`; plan e instrucciones locales. Dependencia: `02b`.
- Resultado: base versionada por ID estable de usuario; ocho stores de dominio e índices por tipo/fecha/serie/categoría. Lecturas/escrituras validadas; preferencias personales no aceptan otra cuenta. CRUD y tombstones; conexiones cierran ante cambio de versión. Solo se devuelve éxito después de `complete`; abortos/constraints/versiones futuras rechazan sin borrar datos.
- Evidencia: **ocho comprobaciones aprobadas en el navegador de Codex**, incluida navegación a documento nuevo y recarga explícita. Tarea editada/borrada conservada; dos cuentas con el mismo ID aisladas; índice consultado; aborto explícito y violación de clave revierten; payload inválido rechazado; base futura mantiene sentinel tras rechazar apertura antigua. Bases ficticias limpiadas y servidor temporal detenido.
- Validación: lint global, `tsc --noEmit`, build de producción y 31 pruebas unitarias aprobados; suite auth DB opt-in sin cambios. `git diff --check` y referencias locales aprobados.
- Límites: capa de infraestructura, todavía sin shell/PWA ni outbox; no se declara uso completo offline. No se provocó agotamiento de cuota real; sí fallos transaccionales reales. Métodos low-level reservados para caché; mutaciones de producto pasan por `03b`.
- Commit: `feat(storage): add account-isolated IndexedDB repositories`.
- Siguiente candidata: `03b`, secuencial, previa lectura de ambas ventanas y manteniendo reserva del lote.

## 03b — Outbox atómica y recuperación

- Rama `main`, secuencial; presupuesto de entrada: **5h 66%; 7d 38% restantes**, consulta automática tras `03a`.
- Objetivo y `target_paths`: mutaciones de elementos, outbox, leases y migración en `src/lib/local-db/**`; contratos `src/schemas/local-sync.ts` y `src/types/local-sync.ts`; fixtures/browser runner y plan. Dependencia: `03a`.
- Resultado: dato+intención+secuencia en una transacción, IDs persistentes, reintento idempotente local, cadena de dependencias por entidad y shadows separados. Claim exclusivo por operación, bloqueo de dependientes y recuperación de leases caducados con el mismo ID tras reinicio. Migración 1→2 conserva el dominio y añade tres stores.
- Alcance decidido: crear/editar/borrar y estado de tarea no recurrente; conectar categorías/preferencias/orden en `05b/07b`, ocurrencias en `09b`, permisos de editor en `14` y ACK/reconciliación/transporte en `12b`. Los comandos sin capa de aplicación local no se aceptan silenciosamente.
- Evidencia: **35 tests unitarios aprobados**, incluidos cuatro nuevos escenarios de mutaciones/contratos; **nueve comprobaciones de outbox en navegador**, incluida recarga explícita. Se fuerza una violación de secuencia única después de encolar la escritura del item: todo revierte y no aparece intención adicional. Dos claims concurrentes solo producen un ganador. Se repiten las ocho comprobaciones de repositorios contra versión 2, sin regresiones.
- Validación: lint global, `tsc --noEmit`, build de producción, referencias locales y `git diff --check` aprobados. Sin red necesaria para escribir, sin dependencias nuevas ni cambios de producción. Fixtures limpiadas, pestaña cerrada y servidor temporal detenido.
- Commit: `feat(sync): persist atomic local mutations and recoverable outbox`.
- Siguiente candidata: `04a`; verificar ambas ventanas y acotar shell/cache de producción antes de comenzar.

## 00d — Cierre del lote desatendido

- Rama `main`; objetivo y `target_paths`: registrar cierre y siguiente paso en `plan/{master,workflow,iteration-log}.md`. Documentación únicamente, sin cambios de código.
- Lectura de entrada automática tras `03b`: **5h 61%; 7d 38% restantes**. No se agota el margen para iniciar un bloque PWA más amplio; se deja la persistencia local completa y comprobada como corte de reanudación.
- Commits del lote verificados: `8f4dd26` (responsive y flujo desatendido), `38a50e9` (sesiones), `0e11b2e` (contratos), `0f01d73` (lint), `cbedd85` (fechas), `0160785` (repositorios) y `6c96a4f` (outbox).
- Evidencia final de implementación: lint global y tipos sin errores; build aprobado; 35 tests unitarios aprobados. Nueve casos de outbox y ocho de repositorios aprobados en navegador real. La suite de auth DB se comprobó en `01b`; no se repitió con cambios exclusivamente locales. Bases y procesos ficticios retirados; sin push ni despliegue.
- Validación del cierre: referencias locales, consistencia del estado y `git diff --check` aprobados. Todos los cambios de implementación están ya comprometidos en la rama actual.
- Commit: `docs(plan): record completed unattended batch and next milestone`.
- Siguiente candidata: `04a`, luego `04b` y navegación responsive `04c`. Retomar con presupuesto nuevo en ambas ventanas y el protocolo interactivo habitual. El shell offline, calendario, UI de creación, sync remoto y compartición aún no se declaran terminados.

## 04a — Shell neutro y preparación offline

- Rama `main`, secuencial. Presupuesto de entrada: **5h 59%; 7d 38% restantes**. El usuario revoca el cierre anticipado y solicita continuar mientras la siguiente entrega y cierre quepan; autorización desatendida vigente.
- Objetivo y `target_paths`: ruta neutra y manifest, `features/workspace/**`, worker/cache en `lib/pwa/**`, identidad GET autenticada, proxy, build script, iconos y fixtures. Dependencia: `03b`. Guías PWA/use-client/headers instaladas y skill React consultadas.
- Resultado: `/workspace` prerenderizado sin datos personales; preparado tras identidad autorizada, DB local válida y caché completa. Worker TypeScript compilado con build ID, manifest/iconos/fuentes/chunks locales. Solo navegación neutra y recursos listados; APIs/RSC/POST/HTML privado fuera de caché. Servidor auth sigue protegiendo identidad; desarrollo no anuncia offline preparado.
- Evidencia: tres checks en navegador de producción (recursos completos, identidad 401/no-store fuera de caché, cuenta ficticia con operación persistida) y **recarga con servidor detenido**, verificada sin acceso HTTP al origen. Shell e item local restaurados. Fixture no autentica remoto ni consulta datos reales; recursos ficticios limpiados y servidor detenido.
- Validación: 36 pruebas unitarias aprobadas, incluida política de caché; lint global, tipos, build de producción y `git diff --check` aprobados. El build confirma `/workspace` y manifest estáticos. Enlaces locales revisados. No se añaden dependencias.
- Límites explícitos: navegador de Codex comprobado; móviles físicos/Google interactivo pendientes. La caché de shell no implementa tareas UI, sync remoto ni bootstrap. Logout/cuenta/versiones endurecidos en `04b`; barras responsive llegan en `04c` antes de pantallas de dominio.
- Commit: `feat(pwa): prepare a neutral offline workspace shell`.
- Siguiente candidata: `04b`, tras consulta de ambas ventanas; no cerrar el lote por haber alcanzado este hito si todavía hay margen.

## 04b — Cierre persistido, cuentas y actualización

- Rama `main`, secuencial. Presupuesto de entrada: **5h 50%; 7d 36% restantes**, consulta automática tras `04a`; lote desatendido vigente.
- Objetivo y `target_paths`: control IndexedDB mínimo, restauración/SWR y cierre en `features/workspace/**`, cierre pendiente en `features/auth/**`, observación de worker en `lib/pwa/client.ts`, schema y fixture PWA; plan e instrucciones locales. Dependencia: `04a`.
- Resultado: logout oculta todas las pestañas, preserva particiones y outbox y persiste el cierre remoto pendiente. Nonce transaccional impide reactivar una preparación invalidada. Antes de iniciar otro Google se resuelve el cierre anterior. Worker nuevo espera sin interrumpir escrituras; la UI explica cómo activarlo.
- Evidencia en navegador real de producción: dos pestañas restauran la misma cuenta; cierre con servidor detenido oculta ambas y persiste al recargar/abrir webview nueva; cola anterior intacta; segunda cuenta tiene otra partición y dos intenciones propias. Preparación con nonce antiguo rechazada. Segundo build muestra aviso de actualización, espera el cierre de clientes y activa una única caché nueva conservando las dos operaciones. Reapertura sin servidor vuelve a leer sus datos. Regresión final: tres checks iniciales, cierre offline, mensaje durable y cola conservada aprobados.
- Validación: lint sin ruido, tipos, build de producción y 36 tests unitarios aprobados, cero fallos. Suite auth DB opt-in ya comprobada en `01b`, no repetida; Google interactivo/móviles físicos pendientes. Caché Turbopack del build previo de sandbox se regeneró y el build autorizado pasó. `git diff --check` y referencias locales aprobados.
- Decisión: excepción acotada para metadatos de cuenta activa compartidos; nunca dominio o credenciales. Fixtures restringidas al puerto loopback de prueba y retiradas del directorio público después del recorrido; cuentas ficticias limpiadas, procesos detenidos. Sin nuevas dependencias ni push.
- Commit: `feat(workspace): preserve account isolation across offline sessions`.
- Siguiente candidata: `04c` en secuencial; consultar ambas ventanas y continuar mientras la entrega completa cabe con reserva.

## 04c — Barras responsive y destinos locales

- Rama `main`, secuencial; entrada **5h 33%; 7d 33% restantes**, consulta tras `04b`. Objetivo y `target_paths`: registro tipado en `config/navigation.ts`, barras/links en `components/shared/**`, SVG local en `components/ui/navigation-icon.tsx`, resumen/ajustes y selección de vista en `features/workspace/**`; fixture de texto ampliado y plan. Dependencia: `04b`.
- Resultado: un registro alimenta barra inferior móvil y navbar superior desktop, SVG locales, destino activo, labels españoles y salto al contenido. Resumen y ajustes de cuenta son destinos operativos; enlaces HTML a `/workspace` con query restauran la vista desde el shell neutro cacheado. No necesitan RSC o servidor. El `+` se incorpora con la creación real en `05a`.
- Evidencia: build de producción, servidor detenido y navegación entre resumen y ajustes; 320/390/768/1280px sin scroll horizontal, barra fija abajo en móvil y superior desde 768px. Teclado desde navegación llega a los controles de cuenta. Fixture iframe al 200% sobre 320px: labels y contenido ajustados para evitar desbordamiento; padding inferior mayor que la altura real de la barra. Captura móvil revisada; safe areas reservadas por CSS, dispositivo físico pendiente del piloto.
- Validación: lint sin errores, `tsc --noEmit`, build y 36 tests aprobados, cero fallos; suite auth DB opt-in sin cambios. Referencias locales y `git diff --check` aprobados. Fixtures y datos ficticios retirados; sin dependencias nuevas.
- Commit: `feat(navigation): add responsive offline workspace destinations`.
- Siguiente candidata: `05a`, secuencial y acotada a tareas simples; consultar uso tras commit y conservar reserva del lote.

## 05a1 — Creación y listado de tareas offline

- Rama `main`, secuencial; entrada **5h 27%; 7d 33% restantes**, consulta tras `04c`. Se divide `05a` antes de empezar para cerrar creación y edición/borrado por separado, con reserva del lote.
- Objetivo y `target_paths`: servicio local, hook SWR y componentes de tareas; workspace/resumen, acción `+` en ambas barras; `local-db/account-control.ts` para recuperación de foco sin desmontar formulario; fixture PWA y plan. Dependencias: `04c`, `02–03`.
- Resultado: `+` abre un dialog accesible, hoy según zona de cuenta, título/fecha/descripcion y checklist inicial validados. Dato+intención se confirman atómicamente y el listado procede de IndexedDB. Errores y estados españoles; cierre no permite descartar mientras guarda. La generación de cuenta aísla caché/formulario, y revalidar al recuperar foco no oculta una cuenta inalterada.
- Evidencia: con servidor detenido se rechazan título y checklist vacíos, se crea una tarea con fecha elegida, descripción y dos pasos. Tras recargar sin servidor conserva todos los campos. Fixture comprueba item+operación pendiente asociados y solo dos intenciones incluyendo la preparación ficticia. Modal a 320px, botón operativo en desktop, texto al 200% con navegación y acción sin scroll horizontal; espacio inferior reservado y [captura móvil revisada](evidence/05a1-mobile.png). El formulario al 200% tampoco desborda horizontalmente. Última actualización del worker conserva las tareas.
- Validación: lint global sin ruido, tipos, build y 36 tests unitarios aprobados, cero fallos; suite auth DB opt-in sin cambios. `git diff --check` y referencias locales aprobados. Sin dependencias nuevas, secretos, push o despliegue; fixtures/datos y procesos de prueba retirados.
- Alcance: tareas simples y listado; edición/borrado `05a2`, clasificación/estado/checklist interactivo `05b`, eventos y cumpleaños en `08/10`. No se muestra guardado remoto ni opciones de creación ficticias.
- Commit: `feat(tasks): create and list tasks fully offline`.
- Cierre del lote: lectura durante cierre **5h 19%; 7d 31% restantes**; se termina lo abierto y no se inicia `05a2` por reserva insuficiente en 5h. Lectura final tras commit comunicada al usuario. Siguiente candidata `05a2`, con presupuestos nuevos al reanudar.

## 05a2 — Edición y borrado de tareas offline

- Rama `main`, secuencial. Entrada comunicada **100%/30%**; automática inicial **99%/30%**. Durante el recorrido ambas ventanas se renovaron: **96%/99%** al cierre; no comparar consumo entre periodos distintos. Continúa el lote autorizado con reserva del 20%.
- Objetivo y `target_paths`: formulario/composer/listado/cards de tareas, servicio local, guardia de valor esperado en `local-db/outbox.ts`, fixture PWA y plan. Dependencia: `05a1`. La guardia adicional evita sobrescribir cambios hechos mientras el editor estaba abierto y se comprueba dentro de la transacción.
- Resultado: editar conserva identidad, estado y pasos existentes; borrar mediante diálogo HTML accesible pide confirmación, ofrece conservar y persiste tombstone+intención. No se elimina la cola. Un editor obsoleto se rechaza sin añadir una operación. Se reutiliza el formulario; no se añade pantalla ni destino.
- Evidencia: Chrome nativo privado, producción en origen loopback reservado y cuenta ficticia. Servidor detenido: editar título/fecha/descripción/checklist, crear tarea desechable, cancelar su borrado, confirmar y recargar; conserva la edición en curso y excluye la borrada. Fixture: cuatro intenciones con dependencias crear→editar y crear→borrar, tombstone presente, misma identidad. Una segunda edición simulada invalida el valor esperado del editor anterior y no añade su intención. El navegador interno quedó bloqueado por una confirmación nativa de un ensayo anterior; se sustituyó esa confirmación por diálogo HTML y se completó el recorrido en Chrome. Las dos particiones ficticias internas y la de Chrome se limpiaron; no se tocaron cuentas reales.
- Validación: lint sin ruido, tipos, build de producción y 36 tests aprobados, cero fallos; 7 pruebas auth opt-in no repetidas. `git diff --check` aprobado. Sin dependencias nuevas, secretos ni push. Captura de prueba privada conservada fuera del repositorio para no versionar la interfaz del navegador del usuario.
- Commit: `feat(tasks): edit and delete tasks offline`.
- Próxima candidata: `05b1`, secuencial. `05b` se divide antes de empezar en estados/checklist, persistencia de preferencias e interfaz de categorías. Consultar ambas ventanas tras commit y continuar con reserva.

## 05b1 — Estado y checklist interactivos

- Rama `main`, secuencial. Entrada automática tras `f006292`: **5h 91%; 7d 99%**. Lote vigente; reserva 20%.
- Objetivo y `target_paths`: componentes/hook/servicio de tareas, comando compartido en `schemas/sync.ts` y tipo local, mutación y outbox de elementos, prueba de mutación y fixture PWA, plan/evidencia. Dependencia `05a2`. No añade pantalla ni navegación; usa componentes existentes y extrae checklist/controles a archivos propios.
- Resultado: empezar, completar, reabrir y dejar sin empezar; checklist con checkbox accesible y botones de al menos 48px. Intención `task.set-checklist-entry` cambia un solo paso sobre el registro actual y mantiene otros campos; no completa implícitamente. El hook bloquea doble envío y conserva intención de reintento. Reabrir mantiene checklist y vuelve a sin empezar. Padres recurrentes siguen sin acciones de progreso hasta `09b`.
- Evidencia: build de producción en navegador interno recuperado, servidor detenido. Crear tarea con paso, empezar, marcar, completar, reabrir, desmarcar y empezar de nuevo; tras comprobar guardado, recargar sin servidor conserva en curso y paso pendiente. Fixture confirma siete intenciones de esa tarea, dependencias consecutivas y rechazo de un paso inexistente sin cambiar dato/cola. [Captura móvil revisada](evidence/05b1-mobile.png): checklist y acciones sin solapamiento con navegación. El primer intento de recarga inmediata antes de terminar la escritura no se contó como guardado; la transacción y su intención no se habían confirmado y se repitió el cambio esperando su estado persistido.
- Validación: lint global limpio, tipos/build aprobados; 37 tests pasan, cero fallos, 7 auth opt-in sin cambios. Caso unitario comprueba dos pasos independientes, desmarcar, revisión/fecha conservadas, estado no completado y rechazo de paso inexistente/ocurrencia. Sin cambios de índices ni dependencias; fixture cuenta/worker limpiados y procesos de prueba detenidos; `git diff --check` aprobado.
- Commit: `feat(tasks): change status and checklist progress offline`.
- Próxima candidata `05b2`, contratos/transacciones de categorías y preferencias en secuencial; consultar cuotas tras commit y reservar cierre completo.

## 05b2 — Categorías y asignaciones personales atómicas

- Rama `main`, secuencial; entrada automática tras `acce8ab`: **5h 83%; 7d 97%**. Reserva 20%, lote vigente.
- Objetivo y `target_paths`: schema/tipo de entidades personales en outbox, mutación/transacción de preferencias en `lib/local-db/**`, suite `test/browser/preferences.ts` y su servidor, pruebas unitarias y plan. Dependencia `05b1`. Entrega de infraestructura, sin nueva pantalla ni dependencia.
- Resultado: crear/editar/borrar categoría propia y asignar/retirar categoría por elemento; nombres activos normalizados únicos, borrado lógico sin tocar tareas/vistas, nuevo ID al repetir nombre borrado. Dato+intención+contador+cola de preferencias atómicos, IDs estables para reintento y protección de editor obsoleto. Dependencias evitan enviar asignación antes de elemento/categoría o borrar antes de asignar.
- Evidencia en IndexedDB real: cinco checks pasan; reintento no duplica y colisión de payload rechazada; cambio con valor esperado antiguo rechazado; borrar conserva tarea idéntica; retirar/reasignar y reutilizar nombre con nuevo ID; dos conexiones concurrentes dejan solo un nombre NFKC normalizado; segunda cuenta tiene cola separada. Fallo inducido del índice de secuencia después de escribir revierte categoría/cola/metadatos, siguiente operación conserva secuencia 11. Nueva carga de documento conserva dos categorías activas, dos tombstones, vista personal y doce operaciones consecutivas. Particiones de prueba limpiadas y servidor detenido.
- Validación: tipos, lint global y build aprobados; 40 tests pasan, cero fallos y 7 auth opt-in sin cambios. `git diff --check` aprobado. Índices/migración evaluados y documentados: reutilizar tiendas/versiones existentes, escaneo local de nombres bajo transacción y claves primarias; MongoDB/índices remotos pendientes de `11a`. Sin secretos ni push.
- Decisión: cola conservadora de preferencias `preference-tail`, máximo tres dependencias directas; referencias a categorías borradas quedan disponibles para reconciliación y se mostrarán sin categoría. Documentado impacto de conflicto en coordinador futuro.
- Commit: `feat(tags): persist personal categories and assignments atomically`.
- Próxima candidata `05b3`, interfaz de gestión/asignación y navegación coherente, secuencial; consultar cuotas tras commit.

## 05b3 — Gestión y asignación de categorías offline

- Rama `main`, secuencial; entrada automática tras `dab07f9`: **5h 77%; 7d 96%**. Lote/reserva vigentes.
- Objetivo y `target_paths`: `features/tags/**`, selector en tareas, pantalla e integración workspace, registro/SVG de navegación, confirmación y hook de intenciones reutilizados, guardia compartida de cuenta, fixture/evidencia y plan. Dependencia `05b2`. Ambas barras se actualizan en la misma entrega.
- Resultado: crear/editar nombre y color, listar categorías propias, asignar/retirar desde tarea y confirmar borrado conservando tarea. Duplicados muestran error español. Formulario de edición recibe foco; botones/checkbox/select respetan estados pendientes. Guardado confirmado tras transacción; separación por usuario/generación y snapshot esperado de categoría. Estado/checklist continúan operativos con hook compartido.
- Evidencia: producción con servidor detenido, navegar a categorías, crear Casa, rechazar CASA, renombrar a Personal, asignar→retirar→asignar, cancelar borrado y confirmarlo. Tarea conservada sin categoría; completar/reabrir y recarga offline conservan sin empezar. Fixture valida nueve intenciones, tombstone, asignación previa preservada y dependencia de borrar tras asignar. Barra móvil a 320/390px y superior a 1280px, destino activo Categorías, sin scroll horizontal. Fixture a 200% sobre 304px útiles: formulario y navbar no desbordan; [captura móvil](evidence/05b3-mobile.png) revisada. Cuenta/cache/worker ficticios limpiados y servidor detenido.
- Validación: tipos/build aprobados, lint global limpio, 40 tests pasan y cero fallos; 7 auth opt-in sin cambios. `git diff --check` aprobado. Sin nuevos paquetes ni índices: `byPosition` existente alimenta la lista y consultas por clave usan tiendas actuales.
- Decisión de UX acotada: categoría se elige en la tarea después de crearla. No mostrar dos transacciones como un guardado único; comodidad de categoría en formulario inicial queda documentada como mejora con atomicidad propia. No bloquea clasificar, agrupar u ordenar el MVP.
- Commit: `feat(tags): manage and assign categories offline`.
- Próxima candidata `06`, calendario mensual y apertura del día en secuencial; leer cuotas tras commit y dividir si el alcance supera la reserva.

## 05c — Preparación tras Google y desarrollo local

- Rama `main`, secuencial; entrada automática **5h 57%; 7d 93% restantes**. El usuario intercala una corrección con tres capturas de workspace sin activar; `06` queda pendiente.
- Objetivo y `target_paths`: preparación/restauración y hook compartido en `features/workspace/**`, textos de ajustes/resumen/entrada, fixture `test/browser/workspace.tsx`, servidor de pruebas `scripts/workspace-test-server.ts` y plan. Dependencias `04b`, `05b3`.
- Causa: login remoto y preparación local eran pasos separados; `prepareLocalAccount` exigía un worker que `NODE_ENV=development` desactiva. Las pruebas anteriores preparaban la identidad ficticia directamente y no cubrían esta entrada con sesión.
- Resultado: SWR restaura primero el espacio y prepara automáticamente una sesión verificada si no hay cuenta activa ni cierre pendiente. Un 401 muestra Google; errores de infraestructura permiten reintentar. Desarrollo activa/restaura IndexedDB sin worker y muestra su limitación; producción exige shell completo y mantiene el estado offline real. Una época cambiada invalida la preparación; una cuenta activada en otra pestaña no se sustituye al terminar una lectura antigua. No modifica autenticación, allowlist ni esquema persistido.
- Evidencia: cinco casos de desarrollo y seis de producción en navegador real: 401 sin activación, preparación automática, tarea/outbox conservadas sin consultar sesión al restaurar, cierre pendiente sin peticiones, cierre durante respuesta retrasada y rechazo de worker ausente en producción. Interfaz React de desarrollo y build Next de producción usan los componentes reales con identidad ficticia servida exclusivamente en loopback. Después de detener ambos servidores de producción: recarga, navegación a ajustes, creación por `+` y segunda recarga conservan dos tareas. [Captura móvil revisada](evidence/05c-mobile.png). Google real no se ha repetido; la verificación cubre el paso posterior a una identidad autorizada, sin usar la cuenta del usuario.
- Validación: lint sin ruido, tipos, build de producción y 40 tests unitarios aprobados; 7 pruebas auth opt-in no repetidas. Revisión de diff y `git diff --check`. La fixture de proxy corrigió sus propias cabeceras de compresión antes de aprobar el recorrido; no se debilitó la política del worker.
- Limpieza: datos ficticios, registros/cachés de worker y pestañas retirados; procesos aislados detenidos. El servidor local del usuario no se detiene ni se modifica. Sin nuevas dependencias ni push.
- Commit: `fix(workspace): prepare authenticated local sessions automatically`.
- Próxima candidata: `06`, con lectura automática de ambas ventanas tras commit y reserva del lote del 20%.

## 06 — Calendario mensual y día

- Rama `main`, secuencial; entrada automática **5h 48%; 7d 92% restantes**, después de cerrar la corrección intercalada `05c`.
- Objetivo y `target_paths`: `features/calendar/**`, filtro/composer de tareas, workspace, registro/links/iconos de navegación, pruebas de navegador y plan. Dependencias `05b3`, `05c`.
- Resultado: semanas de lunes a domingo, meses anterior/siguiente con día conservado y acotado, Hoy según zona de cuenta, URL del día validada y selección visible. Contadores de tareas reales, incluidas completadas; día seleccionado reutiliza todos los controles del listado. `+` preselecciona la fecha elegida. Navegación local por enlaces HTML, sin RSC o API de calendario. Ambas barras incorporan Calendario con SVG local; escritorio puede envolver enlaces sin desbordar.
- Evidencia con build de producción y cuenta ficticia: calendario muestra la tarea existente del día 7; sin ambos servidores, elegir el día 10 deja lista vacía y abre formulario con fecha 10. Guardar «Plan del sábado», recargar, pasar a noviembre y volver conserva tarea/contador/fecha. Hoy recupera el día de cuenta; Tab llega al siguiente día y Enter lo abre. Fixture inspecciona dos tareas y dos intenciones de creación, sin duplicados. [Captura móvil del build final](evidence/06-mobile.png).
- Responsividad: 320/390/768/1280px sin desbordamiento horizontal de página, variante inferior/superior y destino activo. Iframe de 304px con fuente al 200% mantiene ancho de página: la tabla permite desplazamiento horizontal local. Se detectó barra inferior de 457px frente a reserva anterior de 448px; se corrigió a 576px y se volvió a medir, dejando margen para contenido/foco. No se limita el crecimiento de los textos.
- Validación: 43 tests unitarios aprobados, incluidos fechas URL inválidas, febrero bisiesto, cambio de año, cuadrícula de 4/5 semanas y extremos 0001/9999. Siete pruebas auth opt-in no repetidas. Lint sin ruido, tipos y build final aprobados; revisión de referencias/diff. Reutiliza lectura local compartida por SWR e índices existentes; no añade consultas/índices MongoDB ni dependencias.
- Limpieza: fixtures públicas generadas retiradas, partición/control/cachés ficticios limpiados, pestañas y procesos de prueba cerrados. No se toca el servidor local del usuario.
- Alcance: tareas simples; agrupación, orden y atrasadas corresponden a `07`; eventos/cumpleaños se incorporarán cuando existan. No se fabrican elementos o indicadores remotos.
- Commit: `feat(calendar): browse monthly tasks and create from selected days`.
- Próxima candidata: `07a`, con consulta automática de ambas ventanas y reserva del lote del 20%.

## 07a — Grupos personales y atrasadas

- Rama `main`, secuencial; entrada automática **5h 38%; 7d 90% restantes**, después de `06`. Objetivo y `target_paths`: selectores/grupos/listado de tareas, agenda de resumen, reloj de día y board de calendario, fixture de navegador y plan. Dependencias `06`, `02b`.
- Resultado: cada tarea del día aparece una vez bajo su categoría, según posición personal de grupos, con Sin categoría para referencias ausentes/borradas. Fallo de lectura conserva acceso a las tareas bajo título neutral. H2 de sección, H3 de grupo y H4 de tarea. Mi espacio separa Atrasadas de Hoy y próximas; calendario mantiene todas las tareas de su día, incluidas completadas. No hay nueva pantalla; ambas barras conservan destinos operativos.
- Reclasificación: conserva fecha, estado y contenido; usa condición derivada existente. Hook compartido revisa día en zona de cuenta cada 60s y en foco/visibilidad, con limpieza de intervalos/listeners. El cambio no escribe datos ni outbox. La fecha de URL sigue siendo la selección explícita; Hoy usa el día actualizado.
- Evidencia de producción: cuatro tareas ficticias, categoría Trabajo y Sin categoría. Ayer en curso aparece en Atrasadas, ayer completada queda solo en historial y dos tareas de hoy en sus grupos. Con ambos servidores detenidos, completar la atrasada la retira; recargar conserva ausencia y abrir ayer muestra las dos completadas bajo sus categorías y fecha original. [Captura móvil revisada](evidence/07a-mobile.png).
- Reloj: fixture en iframe, con Date simulado únicamente allí, avanza un día y emite foco con el servidor de aplicación detenido. Las dos tareas de hoy pasan a Atrasadas sin cambiar sus fechas/estados, y Hoy y próximas queda vacío. Inspección posterior confirma cuatro items y ocho intenciones: solo una nueva para completar; el reloj no añade operaciones.
- Validación: 46 tests unitarios aprobados, incluidos grupos/duplicados, referencias borradas, historial y medianoche de Europe/Madrid sin mutación. Siete tests auth opt-in no repetidos. Lint sin ruido, tipos y build aprobados; revisión de diff/referencias. Reutiliza lectura/indexación local y SWR, sin queries MongoDB o dependencias nuevas.
- Limpieza: iframe/reloj y pestaña descartados, datos/control/caché ficticios limpiados y procesos detenidos. No se modifica la cuenta, reloj ni servidor local del usuario.
- Commit: `feat(agenda): group tasks by category and surface overdue work`.
- Próxima candidata: `07b`, reordenación persistente. Consultar uso después del commit; elegir un corte que incluya validaciones y conserve la reserva del 20%.

## Plantilla para próximas entradas

| Campo | Qué registrar |
| --- | --- |
| ID, fecha, rama | La entrega concreta y la rama actual. |
| Presupuesto inicial | Lecturas restantes de 5h/7d y fuente; reinicios o incertidumbre si los hay. |
| Objetivo y `target_paths` | Alcance decidido antes de editar; responsables si hay paralelo. |
| Resultado | Comportamiento entregado y criterios cumplidos. |
| Evidencias | Comandos, escenarios reales, resultado y limitaciones precisas. |
| Decisiones revisadas | Motivo y documentos/contratos actualizados. |
| Cierre | Estado y título del commit; hash comprobado comunicado al usuario. |
| Próxima candidata | Dependencias, tamaño y propuesta secuencial/paralela. |
| Control siguiente | Pregunta de ambos presupuestos; valores nuevos se anotan al abrir la siguiente entrega. |

No rellenar evidencias a partir de intención o memoria. Un test no ejecutado es una comprobación pendiente, no un resultado aprobado.
