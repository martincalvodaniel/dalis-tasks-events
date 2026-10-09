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

## 07b0 — Diseño acotado de reordenación

- Rama `main`, secuencial, exclusivamente documental. Entrada automática **5h 29%; 7d 89% restantes**, después de `459ad6b`. Objetivo/`target_paths`: diseño y reparto de `07b` en `plan/**`; dependencias `07a` y persistencia vigente. Aceptación/validación: contratos propuestos, cortes comprobables, compatibilidad/índices y referencias/diff; sin código habilitado a medias.
- Resultado: [reordering.md](reordering.md) define movimientos por vecinos, alcance por día y global de atrasadas, persistencia atómica de categoría/colocación, compactación, replay y requisitos de rollback. `07b1` une contrato+ejecutor; `07b2` conecta lectores y botones accesibles; `07b3` añade arrastre sobre la misma intención. Se corrigió también la tabla de hitos que aún marcaba base offline/calendario como pendientes.
- Fuente: store/clave/índice de colocaciones existentes, schemas de preferencias, outbox actual y reglas de producto. La clave constante de atrasadas es una decisión documentada compatible con la estructura actual; evaluar legado antes de escribir, sin borrar datos o asumir particiones vacías.
- Presupuesto: entregas recientes comparables `05c`, `06`, `07a` consumieron respectivamente 9, 10 y 9 puntos de 5h entre lecturas automáticas, con posible consumo externo. Quedan 9 puntos sobre la reserva del 20%; una entrega de código comparable más margen de cierre no cabe. Se entrega este diseño documental y no se inicia `07b1`, que toca transacciones/compactación y requiere prueba real de almacenamiento. No se extrapola el menor consumo histórico de helpers simples.
- Validación: referencias/consistencia y `git diff --check`; no se repiten tests/build para documentación. Último código validado: 46 tests aprobados, tipos/lint/build y recorridos offline/reloj de `07a`. No hay implementación abierta ni procesos/fixtures de prueba pendientes.
- Commit: `docs(plan): split personal ordering into atomic delivery steps`.
- Interrupción solicitada antes del cierre: se intercala `07c` para quitar el bloque redundante, ajustar etiquetas móviles y reproducir/corregir `+`. Leer ambas ventanas tras este commit; `07b1` no se inicia.

## 07c — Home compacta, etiquetas móviles y diálogos en desarrollo

- Rama `main`, secuencial; entrada automática **5h 21%; 7d 88%**, después de `c8e271d`. Solicitud explícita intercalada antes de cerrar el lote; no se inicia `07b1`.
- Objetivo/`target_paths`: resumen del workspace, links de navegación, composer de tarea, confirmación compartida, fixture de workspace, evidencias y plan. Dependencias `05c`, `06`, `07a`; aceptación definida antes de cambiar componentes. Sin contratos, migraciones, índices ni dependencias nuevas.
- Causa reproducida: fixture de React de desarrollo con Strict Mode; pulsar Crear tarea deja cero diálogos. El cleanup cierra el diálogo, el segundo montaje lo reabre y el evento de cierre antiguo desmonta el formulario. Las confirmaciones comparten el patrón.
- Resultado: ignorar evento de cierre si el diálogo está reabierto; mantener cleanup y cierre real por Escape. Home muestra agenda directamente; preparación/cuenta permanecen en Ajustes. Etiquetas móviles 11/12px según anchura, sin padding lateral que parta palabras a 320px; escritorio conserva tamaño y navegación superior.
- Evidencia: crear «Crear desde desarrollo», recargar y ver tarea guardada; abrir edición y cancelar, abrir confirmación y salir con Escape, crear→Escape→reabrir→Cancelar. [Formulario móvil operativo](evidence/07c-composer.png) y [home compacta](evidence/07c-mobile.png). Pruebas con identidad ficticia en loopback, sin tocar Google ni sesión del usuario.
- Medidas con cuenta activa y `+`: 320px con etiquetas completas de una línea a 11px; 390px a 12px; 1280px muestra barra superior. Texto al 200% en iframe de 310px: página 310px, barra inferior 236px y reserva 576px. No se limita el crecimiento por accesibilidad.
- Validación: lint limpio, tipos y build final aprobados; 46 tests pasan, 7 auth opt-in no repetidos, cero fallos. Diff/referencias revisados. Fixture de desarrollo ahora incluye Strict Mode para reproducir este caso en futuros recorridos.
- Limpieza: partición/control ficticios retirados, pestañas cerradas, viewport restablecido y servidor aislado detenido; servidor del usuario conservado.
- Commit: `fix(ui): keep development dialogs open and compact mobile navigation`. Cierre definitivo del lote; lectura posterior al commit comunicada al usuario. Próxima candidata `07b1` con ambos presupuestos nuevos.

## 07b1a — Ranking y movimiento atómico de categorías

- Rama `main`, secuencial; entrada automática **5h 100%; 7d 87%** tras solicitud «Continua». Se reanuda autorización de continuidad con reserva/consulta entre commits. División de `07b1` decidida antes de implementar: categorías primero, tareas después.
- Objetivo/`target_paths`: ranking, schemas/types de comando, motor/outbox de preferencias, lectores de categorías/grupos, fixture/servidor de pruebas y plan; dependencias `07b0`, `05b2`, `07a`. Sin nueva pantalla, paquetes, migración ni consultas MongoDB. Reutiliza `byPosition` y transacción existente.
- Resultado: `tag.move` transmite IDs de vecinos activos/adyacentes y rechaza vecinos propios, borrados o desactualizados. Posición intermedia o compactación determinista de la lista activa dentro de la misma transacción. Nombre/color, revisión remota, tarea y categoría asignada conservados. Dato+cola+contador+cola personal atómicos; replay previo a movimiento/compactación. Un solo comando por intención; claves personales y comandos antiguos compatibles. Lectores usan posición/ID para mantener orden al renombrar.
- Evidencia IndexedDB real: inicio/medio/final, mismo UUID sin duplicar, payload distinto rechazado, editor anterior rechazado, otra cuenta aislada, dos conexiones incompatibles confirman solo una intención. Posiciones consecutivas de punto flotante agotan intervalo; fallo inducido de índice de secuencia revierte snapshot de categorías/items/views/outbox/metadatos; recuperación compacta y guarda secuencia 12, renombrado genera 13. Nueva carga conserva orden, tombstone, tarea en curso y trece entradas consecutivas. [Captura de cinco checks](evidence/07b1a-browser.png). Dos rondas y particiones ficticias limpiadas, pestañas y servidor detenidos.
- Validación: 53 tests aprobados (7 nuevos de ranking/contrato/invariantes), 7 auth opt-in sin repetir, cero fallos; lint limpio, tipos y build aprobados. Diff/referencias revisados. Los nuevos botones aún corresponden a `07b2`.
- Commit: `feat(ordering): persist atomic category moves with bounded ranks`. Próxima candidata `07b1b`, con cuota automática nueva y sin paralelo.

## 07b1b — Movimiento atómico de tareas y colocaciones

- Rama `main`, secuencial; lectura automática **5h 93%; 7d 86%**, tras `08aa120`. Objetivo/`target_paths`: schemas/types, planificador de tareas, ejecutor separado y dispatch de preferencias, helper de lectura de rangos, fixture/servidor/evidencia y plan. Dependencias `07b1a`, `07a`; alcance y política de legado definidos antes de editar.
- Resultado: mover tarea simple entre vecinos y a otra categoría confirma colocaciones+vista+outbox+contador+cola personal en una transacción. Materializa orden implícito del destino y compacta si no queda rango representable; respeta revisiones personales y no toca fecha/estado/checklist/revisión compartida. Orden day independiente del global overdue, anclado a `0001-01-01`; fecha de evaluación comprobada contra hoy en zona de cuenta. Completadas fuera de atrasadas conservan rango/historial.
- Compatibilidad: schema de transporte permite ocurrencia nula para tarea simple y conserva comandos anteriores no nulos con clave item. Nuevas claves personales de colocación validadas por ocurrencia/scope/fecha. Ejecutar ocurrencias sigue rechazado hasta `09b`. No hay escritor de producto previo de colocaciones; fixture verifica legado real no canónico: preservado, escritura de atrasadas rechazada con exigencia de migración separada, sin vaciar ni transformar la tienda.
- Evidencia IndexedDB real: categoría Casa→Trabajo y orden inicio/medio/final sin cambiar snapshot de items; mismo UUID tras movimientos posteriores/otro día retorna operación 9 y no reordena. Dependencias incluyen creación y preferencia anterior. Dos conexiones incompatibles confirman solo una intención; cuenta distinta y vecinos obsoletos rechazados. Fallo de secuencia tras escribir revierte snapshot de vistas, posiciones, items, cola y metadatos. Compactación conserva revisión de colocación 7 y base personal 7 frente a item 0; otra fecha permanece idéntica. Avanzar día mantiene entidad/ancla de atrasadas; completar conserva colocación y rechaza mover completada. Recarga conserva ocho colocaciones y dieciséis operaciones consecutivas. [Cinco checks](evidence/07b1b-browser.png); datos ficticios y pestaña retirados, servidor detenido.
- Índices: reutiliza clave de colocación y `byDateAndScope`, comprobados en fixture. El ejecutor escanea snapshots de partición para validar categorías/vecinos/legado dentro de la misma transacción; no requiere índice adicional ni migración en este MVP. Evaluar volúmenes reales y consultas remotas en `11a`; sin nuevas consultas MongoDB.
- Validación: lint sin ruido, tipos, 58 tests aprobados (5 nuevos), 7 auth opt-in sin repetir y cero fallos. Build final aprobado después de corregir inferencia del comando en callback anidado; referencias/diff revisados. Sin dependencias nuevas ni push.
- Commit: `feat(ordering): move tasks and personal placements atomically`. Próxima candidata `07b2`, controles accesibles y lectura del orden, con nueva consulta de cuota antes de editar.

## 07b2a — Controles accesibles de categorías

- Rama `main`, secuencial; lectura automática **5h 86%; 7d 85%**, tras `4e6e345`. Objetivo/`target_paths`: controles/iconos compartidos, helper de vecinos, servicio/hook/card/manager de categorías, fixture workspace/evidencia y plan. Dependencias `07b1a–07b1b`; dividido antes de editar de controles de tareas. Sin nueva pantalla; ambas barras mantienen el destino Categorías activo y operativo.
- Resultado: Subir/Bajar invoca `tag.move`, con vecinos del orden actual y hook de intenciones/SWR/guardia de cuenta reutilizados. Bloqueo de solicitudes simultáneas por ref; guardado/error en español. Fila estable por ID y recuperación de foco tras reordenar. Límites usan `aria-disabled`, permanecen accesibles con teclado y el handler no escribe; iconos SVG locales ocultos al lector para evitar nombre duplicado. Editar/borrar/crear bloqueados durante guardado.
- Evidencia de producción con ambos servidores detenidos: crear Casa/Trabajo/Personal, subir con ratón y Enter, límite superior con Return no cambia, bajar con Espacio y ratón, límite inferior no cambia. Foco conserva el botón de Personal, incluso en límites. Renombrar Familia y recargar conserva Casa/Trabajo/Familia. Navegar a Mi espacio y volver funciona offline. Inspector confirma nueve operaciones consecutivas, exactamente cuatro `tag.move`, y tarea inicial intacta. [Captura móvil](evidence/07b2a-mobile.png).
- Responsividad: 320/390px sin desbordamiento y barra inferior; escritorio usa superior. Iframe de 310px, fuente 32px (200%): página 310px, navbar 236px y reserva 576px. Controles envuelven sin limitar ampliación. Cuenta/worker/cache ficticios retirados, viewport restablecido, pestañas y procesos aislados cerrados; servidor del usuario conservado.
- Validación: 59 tests aprobados (nuevo caso de comandos de vecinos para las cuatro direcciones), 7 auth opt-in sin repetir, cero fallos; tipos, lint limpio y build aprobados; diff/referencias revisados. Sin dependencias, migración o nuevos índices.
- Commit: `feat(tags): reorder categories with accessible offline controls`. Próxima candidata `07b2b`, lectores y controles de tareas, tras consultar ambas cuotas.

## 07b2b — Orden accesible de tareas y grupos

- Rama `main`, secuencial; entrada automática **5h 76%; 7d 83%**, tras `678ac64`. Alcance definido antes de editar: servicio/lector/hook de colocaciones, selección por alcance, controles de tareas/grupos, foco del selector, fixture y plan. Dependencias `07b1b`, `07b2a`; sin pantalla, índice, migración ni dependencia nuevos.
- Resultado: lector independiente de posiciones no oculta tareas si falla; orden por día en calendario/Hoy y próximas y global en atrasadas. Subir/Bajar y cambio de categoría usan `task.move`; grupos usan `tag.move` con vecinos de la lista completa para saltar categorías vacías. Sin categoría permanece al final. Reutiliza guardia de cuenta, bloqueo de intención y revalidación SWR; errores visibles españoles. Foco conserva flecha o selector al pasar a otro grupo.
- Producción con ambos servidores detenidos: dos movimientos de Enviar informe por click/Enter, límite por Return sin escritura, cambio Trabajo→Casa y subir grupo Casa saltando Salud vacío; subir tarea de ayer en atrasadas y completarla. Recarga y navegación offline conservan orden y estado, calendario del día original conserva la completada. Inspector confirma 19 secuencias consecutivas, exactamente cuatro `task.move`, un `tag.move`, cinco colocaciones (tres day/dos overdue) y cinco fechas intactas. Reloj de iframe avanza un día: pendientes pasan a atrasadas, el rango global previo precede tareas recién atrasadas dentro de Trabajo; no añade intenciones.
- Diseño: 320/390px sin desbordamiento; escritorio 1280px muestra barra superior. Texto al 200% en iframe de 280px: página 280px, barra inferior 269px, reserva 576px. [Orden en móvil](evidence/07b2b-mobile.png). Cuenta/control/worker/cache ficticios retirados, viewport restablecido, pestañas y procesos aislados detenidos; servidor del usuario conservado.
- Validación: 62 tests aprobados (tres casos nuevos de alcances/vecinos visibles), 7 auth opt-in omitidos, cero fallos; lint limpio, tipos y build aprobados. Se corrigió el nombre de un campo de fixture detectado por tipos antes del build final. Diff/referencias revisados.
- Commit: `feat(tasks): reorder daily tasks and overdue groups offline`. Próxima candidata `07b3`, arrastre con los mismos comandos y controles de botones conservados; leer ambas cuotas antes de definir su corte.

## 07b3a — Arrastre de categorías y handle compartido

- Rama `main`, secuencial; entrada automática **5h 67%; 7d 82%**, tras `29e0d7b`. Corte definido antes de editar para separar interacción de integración en tareas/grupos. `target_paths`: handle/icono/helper de vecinos, manager de categorías, fixtures de gesto/workspace, servidor de pruebas y plan. Sin nueva pantalla, dependencia, store, índice o cambio de contrato.
- Resultado: Pointer Events, captura y umbral de 6px, handle táctil `touch-action: none` sin bloquear scroll del resto de la tarjeta; indicador de inserción y anuncio de destino en español. RAF solo durante gesto activo, scroll junto a bordes respetando la barra fija. Cancelación por Escape, pointercancel, pérdida de captura/foco/visibilidad, cambio de peers o guardado. Click o misma posición no invocan el comando; soltar válido usa `tag.move` una vez y conserva foco. Subir/Bajar continúan disponibles.
- Evidencia: con ambos servidores detenidos, click de Casa sin cambio, arrastrar Salud fuera de lista cancela, Casa→inicio confirma Casa/Trabajo/Salud y foco en Casa. Recarga offline conserva orden. Inspector verifica 14 operaciones totales, exactamente un `tag.move`, cinco tareas y cero colocaciones de tareas: cancelación/click no escribieron. Herramienta de navegador tuvo una espera fallida; se recuperó el enlace y se completó el recorrido antes del cierre.
- Fixture táctil aislado: PointerEvent con pointerType touch prueba click, umbral, pointercancel, Escape, blur, drop fuera de lista, autoscroll y doble pointerup con una sola entrega. La captura se sustituye únicamente en el nodo ficticio para despachar eventos sintéticos; no modifica el handle de producto. Pendiente piloto con hardware táctil real en `15`, sin afirmar que esta secuencia equivale a él.
- Diseño: 320/390px sin desbordamiento, handles y alternativas envuelven; escritorio sigue con barra superior. 200% en iframe 280px: ancho/scroll 280px, barra 269px, reserva 576px. [Captura móvil](evidence/07b3a-mobile.png). Datos/control/cache/worker de cuenta ficticia limpiados; tabs, viewport y procesos retirados. Proxy de prueba ahora devuelve 503 solo al estar apagado su upstream aislado, evitando ruido esperado; no cambia auth ni el rechazo de worker faltante.
- Validación: 63 tests pasan, 7 auth opt-in omitidos, cero fallos; tipos, lint sin warnings y build final aprobados. Fixture extraído a componente propio para evitar ruido de Fast Refresh. Diff/referencias revisados.
- Commit: `feat(tags): drag categories with cancelable pointer controls`. Próxima candidata `07b3b`, con lectura automática nueva antes de integrar tareas/grupos.

## 07b3b — Arrastre de tareas y grupos

- Rama `main`, secuencial; entrada automática **5h 56%; 7d 80%**, tras `58abe8f`. `target_paths`: TaskList/TaskGroup y handle compartido, fixture táctil/workspace, evidencias y plan. Alcance previo: mismo grupo/día o global atrasadas, grupos con ranking personal; selector para cambiar categoría. Sin dependencias, esquema, índice o pantalla nuevos.
- Resultado: listas/filas identificadas para hit-test; tarea solo admite peers de su fecha o alcance overdue. Drop sobre fila de otro día se rechaza antes de calcular vecinos; cambio de peers durante gesto cancela y pointerup vuelve a comprobar snapshot. Grupo admite vecinos completos y salta categorías vacías, Sin categoría queda fijo. Reutiliza hooks de intención/SWR, errores/foco y mismo comando de botones. No cambia fechas al ordenar.
- Offline real con servidores detenidos: Enviar informe antes de Revisar notas en calendario (una intención), Pendiente de ayer antes de anteayer en atrasadas globales (una), Revisar→Casa con selector (una), arrastrar grupo Casa antes de Trabajo saltando Salud vacío (una). Foco conserva handle. Drop de Enviar sobre Mañana sin mover rechazado sin escritura. Recarga conserva filas/grupos. Inspector: 19 operaciones consecutivas, tres `task.move` y un `tag.move`, seis tareas con fecha/estado originales y cinco colocaciones; ninguna colocación inventada para mañana.
- Fixture táctil sintético agrega fila fuera de peers y lista cambiada durante gesto, ambos sin entregar; conserva umbral/cancelación/Escape/blur/scroll/doble pointerup de `07b3a`. Captura real comprobada mediante ratón, hardware táctil pendiente de piloto.
- Diseño: 320/390px sin desbordamiento, escritorio 1280×900 operativo; iframe 280px al 200% conserva ancho 280px, barra 269px y reserva 576px. [Atrasadas en móvil](evidence/07b3b-mobile.png). Cleanup confirmado en UI pese a una espera de locator fallida; cuenta/control/worker/cache ficticios retirados, pestañas/viewport/procesos restaurados.
- Validación: lint limpio, tipos, 63 tests aprobados/7 auth opt-in omitidos/cero fallos y build aprobados; diff/referencias revisados. Commit: `feat(tasks): drag daily tasks and agenda groups offline`. Próximo bloque `08`, dividir conversión de zona/persistencia y UI antes de editar según cuota automática.

## 08a — Instantes y validación temporal de eventos

- Rama `main`, secuencial; entrada automática **5h 48%; 7d 79%**, tras `0d544c2`; espera de cuota completada antes de editar. Bloque `08` dividido en conversión, persistencia y UI creación/edición. `target_paths`: helpers de calendario puros, tests/fixture y plan. Sin dependencia, pantalla, schema almacenado, índice o migración nuevos.
- Resultado: Intl ISO/latn/h23 con zona explícita, offsets candidatos cercanos y comparación exacta de todas las partes (incluidos segundos/era). API devuelve cero/uno/varios instantes, y resolución exige uno: no aplica política automática en gaps/repeticiones. Fecha civil usa aritmética UTC como carrier, sin reasignarla a zona del host. Programa de evento valida duración real, fin opcional nulo y todo el día con final exclusivo.
- Política documentada: schema actual no guarda un offset/disambiguación elegidos; futura UI pide otra hora válida si se repite/no existe. Ofrecer las dos apariciones exige primero contrato compatible, sin normalizar registros históricos. Motor sigue sin activar Evento o cita: guardado/lectura en `08b`, UI en `08c1–08c2`.
- Fuentes técnicas: [Intl/formatToParts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts), [explicación de ambigüedad de TC39](https://tc39.es/proposal-temporal/docs/timezone.html) y [referencia de candidatos del polyfill](https://github.com/js-temporal/temporal-polyfill/blob/main/lib/ecmascript.ts). Implementación propia reducida para el contrato local a precisión de minuto; no se añade ni copia el polyfill. Se usa TZDB del runtime, sin red: diferencias/actualizaciones de reglas entre dispositivos se reevaluarán al sincronizar; no se guarda un UTC derivado como decisión de usuario.
- Evidencia: Madrid/NY, Lord Howe (30min), Apia (día inexistente), Kathmandu, Paris histórico con segundos, años 0001/0099/9999. Duración real de 1h y 3h para intervalos locales de 2h alrededor de DST; medianoche, fin nulo y rangos inválidos. Cuatro casos nuevos en Bun, repetidos con `TZ=Pacific/Honolulu`; [navegador aislado](evidence/08a-browser.png) coincide en offsets/eras/gaps/duración. Fixture no abre cuenta ni escribe; pestaña/servidor retirados.
- Validación: 67 tests aprobados, 7 auth opt-in omitidos, cero fallos; lint limpio, tipos y build aprobados; diff/referencias revisados. Commit: `feat(calendar): resolve event times without silent DST shifts`. Próxima candidata `08b`, con lectura automática nueva.

## 08b — Persistencia atómica de eventos simples

- Rama `main`, secuencial; entrada 43%/78% tras `587e12b`. Alcance y aceptación definidos antes de editar: servicio local de eventos, schema de input, ejecutor item existente, fixture/tests y plan. Se incorpora también la nueva prioridad del usuario en AGENTS y master: UI móvil mínima y densa, acciones secundarias desplegables, revisión antes del formulario de eventos.
- Resultado: lectura separada de eventos con guardia de cuenta y zona; crear/editar/borrar reutiliza outbox atómica y CAS. Validación temporal en ejecutor después de replay, antes de escribir; schema almacenado sigue leyendo legado. Repetición pendiente de su capa de ocurrencias. No cambia estructura de datos, índices, auth ni dependencias; pantalla de eventos sigue pendiente.
- [IndexedDB real](evidence/08b-browser.png): temporizado cruzando medianoche y todo el día; gap/ambigüedad sin modificar dato/cola/secuencia; edición obsoleta y expected de otro propietario rechazados; UUID repetido no duplica, colisión de payload rechazada; fallo único de outbox revierte las tres stores y guardado posterior funciona. Registro histórico ambiguo conserva revisión 7, replay no revalida ni modifica; borrado mantiene tombstone y replay no resucita. Recarga verifica cinco secuencias consecutivas. Base ficticia, pestaña y proceso aislados eliminados.
- Validación: lint sin warnings, tipos, 69 tests aprobados/7 auth opt-in omitidos/cero fallos, build aprobado. Referencias y diff revisados. Commit: `feat(events): persist validated events in the local outbox`. Próxima candidata intercalada `07d`, tareas y cabeceras móviles compactas; cuota automática antes de abrir.

## 07d — Agenda y cabeceras móviles compactas

- Rama `main`, secuencial; entrada automática 37%/77% tras `27db322`. Petición expresa del usuario intercalada antes de 08c1. Alcance/aceptación definidos antes de editar: tareas/grupos/estado, cabecera Workspace, fixture/evidencias y plan. Sin dependencia, contrato, índice, permiso ni nueva pantalla; se mantiene el registro único de ambas barras.
- Resultado: título y metadata breves, fecha/estado/progreso de pasos; completar/reabrir directamente con SVG local y área 44×44px. Resto dentro de details/summary accesible con teclado: descripción, checklist, estado en curso, categoría, orden, editar/borrar. Estado de apertura por ID en TaskList conserva detalles/foco al pasar de grupo. Grupo ordenable desplegable; menos separación y vacíos. Móvil retira marca/subtítulo y aviso repetidos; escritorio conserva descripción de pantalla.
- [Móvil a 390px](evidence/07d-mobile.png): seis filas de 66px y sin overflow; targets 44×44px. 320px real y detalle expandido ancho/scroll 320px. Escritorio 1280px usa barra superior y navega a Calendario offline. Iframe de 280px con fuente 32px (200%): ancho/scroll 280px incluso expandido, navbar 269px y reserva 576px, sin controles cubiertos.
- Con ambos servidores detenidos: completar/reabrir por click/Espacio sin desplegar; Enter abre/cierra detalles, empezar, Revisar→Casa conserva selector enfocado y detalles abiertos, Subir Casa por teclado, Subir tarea atrasada, editar descripción/paso, completar paso, eliminar con confirmación y crear desde +. Recarga preserva todo y vuelve a filas cerradas. Inspector confirma 25 intenciones consecutivas: tres estados, dos task.move, un tag.move, editar/paso/borrar/crear; seis tareas activas y un tombstone. No se duplica por desplegar. Fixture cuenta/control/worker/cache limpiados, viewport/pestañas/procesos propios retirados, servidor del usuario conservado.
- Validación: lint limpio, tipos, 69 tests aprobados/7 auth opt-in omitidos/cero fallos y build final aprobado; referencias y diff revisados. Commit: `feat(ui): compact mobile task rows and workspace headings`. Próxima candidata 08c1, partida de edición/borrado; evaluar lectura automática y margen sobre reserva antes de abrir. Formularios/categorías/ajustes se revisan por cortes futuros, sin afirmar revisión completa de todas las pantallas.

## 07d2 — Formulario de tareas compacto

- Rama `main`, secuencial; entrada automática 29%/76% tras `2ed4ec1`. Corte definido antes de editar: TaskForm/TaskComposer/ChecklistFields, fixture y plan. Sin cambios en contratos/persistencia/navegación. Nueva pantalla de eventos se aplaza mientras se ejecuta la prioridad explícita de densidad.
- Resultado: menos padding/espaciado/título, campos y botones de 44px, descripción y pasos opcionales en details. Crear comienza plegado; editar contenido existente abre extras. Los campos siguen montados y FormData conserva valores plegados; validación de pasos/descripción abre extras. No cambia guardado, CAS, intención ni lifecycle de modal.
- [Formulario móvil](evidence/07d2-form.png): 320px, diálogo de 304×353px con extras plegados. Botones 44px; raíz sin overflow. Iframe 280px/font32 (200%): modal 248px con scrollWidth246px tanto plegado como abierto, controles accesibles por scroll; Cancelar operativo. Formularios de categorías/ajustes aún no revisados.
- Con ambos servidores detenidos: abrir +/Cancelar/reabrir/Escape, título vacío no escribe; añadir paso vacío, plegar, guardar muestra error y abre extras; rellenar descripción/paso, plegar y guardar crea. Editar abre contenido existente y conserva texto, plegar/cambiar título/guardar; recarga conserva tarea. Inspector verifica dos tareas/tres intenciones consecutivas (base, crear, editar) y descripción/paso exactos; cancelación/validación no escribieron. Cuenta/control/worker/cache ficticios limpiados, viewport/pestañas/procesos propios retirados.
- Validación: lint limpio, tipos, 69 tests aprobados/7 auth opt-in omitidos/cero fallos, build final aprobado; diff y referencias revisados. Commit: `feat(ui): compact task forms with optional detail fields`. Cuota automática de cierre decide si 08c1 cabe sobre reserva 20%; no hay otra implementación abierta.

## Cierre documental de la continuación tras 07c

- Rama main; entrada automática 25%/75% tras `cfa8a9f`. Objetivo y target_paths exclusivamente plan/master, workflow y registro: dejar punto de reanudación y decisión de presupuesto, sin abrir implementación.
- Commits de este lote: `08aa120` ranking de categorías; `4e6e345` colocaciones; `678ac64` botones categorías; `29e0d7b` botones tareas/grupos; `58abe8f` arrastre categorías; `0d544c2` arrastre tareas/grupos; `587e12b` tiempos de eventos; `27db322` persistencia eventos; `2ed4ec1` agenda compacta; `cfa8a9f` formulario compacto. Cada entrada contiene sus verificaciones; no se repiten tests de código en este cierre documental.
- Decisión: 08c1 requiere UI/lector/calendario y pruebas offline, más cierre. Cinco puntos disponibles sobre reserva no cubren una entrega comparable (07d consumió ocho); tampoco se expande su alcance para gastar el presupuesto restante. Motor local de eventos completo, formulario pendiente. No hay código abierto ni procesos propios. Siguiente sesión: cuotas nuevas y corte08c1, secuencial.
- Validación documental: enlaces locales, coherencia de referencias y git diff --check; commit `docs(plan): close verified batch with mobile density guidance`. Lectura final automática se comunica después del commit; sin push.

## 07d3 — Categorías compactas y reanudación autorizada

- Rama main, secuencial; entrada automática 24%/75% tras206fac6. Usuario pide aprovechar margen y comunica renovación próxima; reapertura y reserva temporal documentadas antes de editar. Alcance/aceptación definidos en iterations: TagCard/Manager/Form, fixture, evidencia y plan.
- Resultado: fila plegable con nombre/color, botones/arrastre/editar/borrar desplegables; formulario nombre+color compacto, menos títulos/padding/instrucción repetida en móvil. Reutiliza guardado/ranking/outbox y navegación; sin dependencia/contrato/permiso nuevos.
- [Móvil320px](evidence/07d3-tags.png): filas58px y ancho/scroll320px. Texto200% en iframe280px conserva ancho/scroll280px, incluido detalle desplegado. Targets nuevos44px o mayores; botones/arrastre existentes48px conservados.
- Sin ambos servidores: crear Casa/Trabajo/Personal, Subir Personal con Enter, arrastrar Personal al inicio, Bajar con Espacio y click, renombrar Familia y borrar Trabajo con confirmación. Panel permanece abierto y foco conserva flecha/handle al ordenar. Recarga conserva Casa/Familia; inspector confirma diez intenciones consecutivas, cuatro tag.move, tres categorías con un tombstone y tarea base intacta. Cuenta/control/worker/cache ficticios y procesos propios retirados, viewport restaurado.
- Validación: lint limpio, tipos,69 tests/7 auth opt-in omitidos/cero fallos y build final aprobados; referencias/diff revisados. Commit `feat(ui): compact category rows and creation form`. Siguiente corte08c1a selectores de días/zonas de eventos, condicionado a cuota automática antes de editar.

## 08c1a — Selección temporal y civil de eventos

- Rama actual int, secuencial; entrada17%/74% tras6216981. El usuario confirma integración int y autoriza commit+push de cada entrega para activar preproducción; se registra en AGENTS/workflow y master. Scope previo: helper puro, tests y plan; sin UI/DB/dependencias/contratos almacenados nuevos.
- Resultado: consultas inclusivas1–62días para admitir años0001 y31/12/9999 sin extremo10000; eventos all-day conservan final exclusivo. Cuenta proyecta instantes, fin nulo solo día de inicio, fin a medianoche excluye siguiente día. No altera inputs; all-day primero, exact start luego ID estable; series/tombstones excluidos. Errores temporales históricos retornan separados con motivo, sin ocultar válidos.
- Precisión: endpoints civiles no bastan si la fecha retrocede brevemente; envelope UTC conservador y sondeo de minutos cacheados dentro de consulta, mediodía primero, endpoints conocidos como camino rápido. Apia día inexistente no recibe temporizado, all-day sigue siendo civil. St Johns1987 visita un minuto de25oct entre endpoints24oct y se selecciona ambos días. Ruta rara alcanza1440sondeos/día y exige medición/reutilización antes de usar contadores por celda; helper todavía no conectado a UI.
- Evidencia: seis nuevos casos Bun cubren exclusividad, medianoche, cambio de zona LA/Madrid, DST, punto sin fin, Apia, rollback, legado, orden porID, arrays intactos, límites/zonas/rangos. Repetidos con host TZ Pacific/Honolulu:6pass. Global75pass/7auth opt-in omitidos/cero fallos, lint limpio/tipos/build aprobados, referencias/diff revisados. No fixture nueva para este helper puro; el motor Intl base ya se contrastó en navegador08a.
- Commit `feat(calendar): select events by account date with explicit legacy issues`. Push a int autorizado; verificar HEAD remoto después de crear commit, sin afirmar que el autodespliegue terminó antes de observarlo. Próxima candidata08c1b: formulario/listado y selección mensual preparados, según cuota automática y renovación comprobada.

## 08c1a2 — Formateador temporal reutilizable

- Rama int, secuencial; entrada13%/73% tras3667c97 y push aorigin/int verificado con HEAD remoto idéntico. Vercel informa deployment completado success y check asociado success, comprobados por GitHub API. Diagnóstico previo: rango mensual12eventos24ms;31consultas/día5161ms.
- Scope mínimo definido antes de editar: zoned-time factory, selector y prueba de equivalencia, plan. Un Intl.DateTimeFormat por consulta/zona reutilizado en sondeos, sin cache global, red ni cambios en política de fechas. API existente conserva resultados; factory explícita evita mezclar zonas. No conecta todavía UI.
- Validación:76tests aprobados/7auth opt-in omitidos/cero fallos; nuevo caso compara factory con normales, gaps, repeats, años/histórico, zonas independientes e inválidas. Regresión de día breve/Apia pasa. Lint/tipos/build/diff/referencias aprobados. Mismo fixture: rango mensual25ms y31consultas706ms,12apariciones intactas. Medida puntual del host, no afirmación de latencia en móvil; aún exige preparación mensual compartida antes de usar celdas.
- Commit `perf(calendar): reuse zone formatters within event queries`; push int autorizado y verificar remoto después. Próxima candidata08c1b; consultar cuota y confirmar renovación antes de una entrega UI amplia. Código de esta entrega cerrado independientemente de la renovación.

## 08c1b0 — Snapshot compartido y lectura de eventos

- Int, secuencial; entrada100%/73% tras renovación confirmada después de071a2c4 publicado y Vercel success. Se restaura reserva reforzada20%, sin inferir consumo atravesando reinicio. Scope/aceptación previos: índice/snapshot/tests/hook/plan, sin UI ni persistencia nuevos.
- Resultado: resolución/programas y orden se preparan una vez por índice; contadores/eventsByDate se calculan una vez para rango validado1–62días, cache local acotada a62×1440sondeos. Ningún estado global ni petición por celda. Hook SWR separado por cuenta+epoch usa lector con guardias, no retry infinito. Pureza y API existente conservadas.
- Evidencia: snapshot de cuatro días da[0,2,2,0], orden all-day/temporizado, equivalencia de consultas y fuente sin mutaciones, último día9999 sin overflow, rango inválido rechazado. Todos los casos anteriores DST/Apia/StJohns/legado pasan. Muestra12eventos mes31días:191ms preparación;3100lecturas1ms,12apariciones intactas. Medida puntual del host; revisar volumen/móvil en piloto.
- Validación:77tests/7auth opt-in omitidos/cero fallos, lint limpio/tipos/build aprobados, diff/referencias revisados. Commit `feat(calendar): prepare shared event snapshots and local reader`; push int autorizado, verificación remota posterior. Próxima08c1b1 creación/listado compacto y contadores integrados, leer cuota antes de abrir.

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


## 08c1b1 — Crear y consultar eventos offline, 7 de octubre

- Rama `int`, secuencial, entrada97%/72%; dependencias08b/08c1b0/07d. Creación común en workspace, EventForm/Card/List/Agenda propios del dominio y botónSVG compartido. TaskComposer existente sigue usado al editar tareas.
- Tarea/Evento o cita desde+; formularios permanecen montados al alternar. All-day UI final inclusivo se convierte a exclusivo; timed fin opcional, zonaIANA y descripción plegadas. Schema compartido valida horas exactas antes de guardar y transacción local repite validación. No se añade dependencia/colección/index/mutación remota.
- Mes prepara snapshot memoizado y mezcla contadores; día conserva lectura independiente de tareas/eventos. Agenda muestra una sola fila por evento próximo en14días; sin atrasadas de eventos. Categoría es intención personal posterior al guardado, usando selector existente. Legado inválido queda identificado en detalles, no se mezcla con eventos situables.
- Navegador real, origen aislado4184/cuenta ficticia: preparación seischecks, diálogo operativo en producción (doble montaje de desarrollo comprobado después en08c2), cambio de tipo conserva títulos/fecha/descripcion, cancelar/Escape sin escritura. GapMadrid29mar02:30 y fold25oct02:30 rechazados en español; guardar después funciona sin servidor4183.
- Tres eventos: Reuniónlocal23:30→00:00 con descripción plegada; Viaje7→8oct inclusive; PuntoLA09:00 mostrado18:00Madrid. Dos tareas en hoy; contadores5hoy/1mañana; reunión fuera de mañana y viaje presente. CategoríaTrabajo aplicada al evento conserva detalle abierto. Inspector7intenciones consecutivas/5items, sin escrituras de validación/cancelación.
- Ambos servidores detenidos, recarga del shell de producción conserva items/categorías. A320px página scrollWidth320, filas52px; formulario compacto y targets44px. Iframe280px a200%: rootscrollWidth280, diálogoclient/scroll246, vertical1435/966 accesible por scroll; botones88–112px. Desktop1280navsuperior sin overflow.
- [Home móvil](evidence/08c1-events-mobile.png), [formulario](evidence/08c1-event-form.png). Fixture/datos/worker/cache ficticios limpiados; propios servidores detenidos, viewport restablecido. No se altera localhost3000 ni cuentas reales.
- Lint181files limpio; tsc/build pasan29recursosneutros;79tests/7authopt-in skip/0fallos. Diff/referencias revisados. Commit/pushint al cerrar; consulta ambas cuotas después para siguiente08c2. Crear/leer no anuncia aún edición/borrado ni repetición/cumpleaños/sync.


## 08c2 — Edición, borrado y reparación de eventos, 7 de octubre

- Int secuencial, entrada84%/70% tras08705cc publicado; estadoVercelsuccess confirmado. EventForm recibe snapshot inicial sin convertir su hora para mostrarlo, conserva final inclusivo/fin opcional/zona/descripcion. EventComposer usa updateLocalEvent con expected y UUID por intención; EventActions secundarios compartidos por cards válidas y lista de legado. DeleteEventDialog reutiliza ConfirmationDialog; lock evita envío doble y CAS valida snapshot antes del tombstone.
- Prueba real detectó caché vieja al reabrir tras rechazo CAS: editor y borrado ahora releen con mutate al fallar, sin sustituir el snapshot/borrador abierto. Repetición de conflicto demuestra títuloexterno al reabrir y edición final con descripción de otra pestaña intacta. No se modifica el motor08b ni auth/deps/schema/índices.
- Origen4184 ficticio: editar hora/fin vacío y all-day final inclusivo; detalle abierto persiste. Dos editores: primera pestaña falla sin escribir, conserva borrador; cancelar/reabrir y guardar versión actual funciona. Borrado abierto antes de edición externa rechaza sin tombstone; reabrir versión actual permite eliminar. Cancelar/Escape no escribe. Legado fold se convierte a all-day manteniendo descripción; legado gap se elimina sin resolver hora histórica.
- Inspector final16intenciones consecutivas,7updates (incluye repetición del conflicto),2deletes;3items activos/5incluyendoborrados. CategoríaTrabajo de reunión y tarea basal intactas. Servidores detenidos, recarga y navegación mes/día conservan reuniónfinal y legadoreparado; contadores2hoy/1mañana, borrados y advertencias resueltas ausentes.
- A320px editorclient/scroll302, páginascroll320; [editor móvil](evidence/08c2-edit-event.png). Iframe280 a200% root280, editorclient/scroll246, vertical1762/966; Cancelar accesible. React de desarrollo/StrictMode4179 verifica selector+ de08c1, edición, Escape, Cancelar y confirmación sin cierres accidentales. Navegación desktop existente1280 comprobada en08c1; sin nuevo destino.
- Lint184files limpio, tsc/build29recursos pasan,79tests/7authopt-in skip/0fallos. Fixtures sintéticos propios de ambos orígenes limpiados, servidores/tabs propios cerrados, viewport restablecido; usuario/localhost3000 intactos. Diff/referencias revisados y commit+pushint al cerrar, cuotas después. Siguiente09a: repetición pura antes de UI/ocurrencias.


## 09a1 — Fechas de recurrencia paginadas, 7 de octubre

- Int secuencial, entrada71%/68% trasfe47801; Verceldeploysuccess confirmado durante corte. Motorpuro en [recurrence.ts](../src/lib/calendar/recurrence.ts) y consultaZodcompartida. Cuatro frecuencias, intervalos1–365, weekdays0domingo/semana lunes, count/until, primera semana parcial; reglas existentes sin modificar.
- Fechaqueryinclusiva0001–9999; páginas1–500, cursorfechaexclusivo, nextAfter solo sihaymás. No reiniciar count al consultar lejos o paginar. Meses inexistentes/anuales29feb se omiten sin consumir count. Aritmética de cadencia salta al rango; conteos mensuales/anuales con ciclo400años evitan enumerar millones de días. No estado mutable global ni dependencia/DB/UI/ID de ocurrencia aún.
- Siete tests: ejemplos de diaria/semanal/parcial/mensual31/anualbisiesto1900/2000, countagotado/fechauntil/extremos0001/9999/limitecursor; oráculo independiente día por día192combinaciones de anclas/frecuencias/intervalos/límites, comparadas con páginas3. Conteosmensuales después de ciclo400años y intervalos2/12 comprobados.
- Repetición de esos7tests con hostTZPacific/Honolulu pasa. Benchmark100queriesdiarias desdeancla0001 a diciembre9999/página3:13ms total observados, no garantía universal.86tests pasan/7authopt-in omitidos/0fallos; lint187files/tipos/build29recursos aprobados, diff/ref revisados.
- Commit+pushint al cerrar y cuotas después. Próxima09a2: generar IDs/slots y plantillas de ocurrencias, conservando hora local/estadoindividual y avisos explícitosDST; no activar recurrencia enUI antes deejecutor/lector completo.


## 09a2 — Proyección pura de apariciones, 7 de octubre

- Int secuencial, entrada67%/68% tras4b1aa2a publicado. [occurrences.ts](../src/lib/calendar/occurrences.ts) valida serie y consulta existentes; IDsseriesId:slotKey, metadatos inicialesrevision0/createdAtde serie, tombstonepadre vacío. Sin DB/UI/mutaciones/deps nuevas.
- Tarea copia cada checklist con IDsoriginales, completadosfalse, estado sinempezar/completedAtnull; ninguna aparición comparte objetos/estado con otra ni padre. All-day desplaza longitudcivil; timed conserva ambos endpoints locales y día relativo del final, con zona de serie explícita. No suma24h ni conserva duraciónUTC fija al cruzarDST.
- Incidenciasgap/fold/out-of-range llevan mismoID/slot, no normalizan ni consumen un slot extra; count/limit cuentan intentos programadosciviles. nextAfterse conserva aunque página entera falle. Consulta se define sobre comienzos originales, solapes/zona de cuenta se integran en09c.
- Cinco tests: copia/IDs/páginas/tombstone, all-day y años0001/9999, Madridprimavera2h→1h y otoñoovernight5h→4h, gap/fold/conteo/pagecontinúa, fininexistente/Apia/saltofechacivil/desbordamientotimed.32assertions; repeticiónTZPacificHonolulu pasa. Página500timed09→10 diario:269ms/500válidas/0issues/cursor2027-05-15observados, no garantía de móvil.
- Lint189files/tipos/build29recursos pasan;91tests/7authopt-in skip/0fallos; diff/ref revisados. Commit+pushint al cerrar, cuotas automáticas después. Próxima09b1: estado/checklist/cancelación local de ocurrencias, con creación de excepción atómica y validación de slot/serie, antes de lectura/formulario.


## 09b1 — Progreso atómico por aparición, 7 de octubre

- Rama `int`, secuencial; entrada 5h 65% / 7d 67% tras `7b1b8f9`. Router LocalOutbox reutiliza contratos existentes para estado/checklist con occurrenceId. Motor validado y transacción propia de items/occurrences/outbox/syncMetadata; sin versión, índice, dependencia ni UI nuevos.
- Primera escritura genera solo el slot original validado; cada aparición conserva estado/checklist independiente. Las excepciones existentes preservan su historia frente a cambios futuros. completedAt se mantiene al completar de nuevo y se vacía al reabrir; canceladas/tombstones rechazan cambios. Padre intacto, entityKey y revisión base agregados por serie, documentados para 11–12.
- Dos tests puros y veinte aserciones cubren copia, pertenencia, extremos del conteo, permisos, checklist histórico y rechazos. IndexedDB real en origen aislado 4179: tres apariciones, siete intenciones encadenadas, dos cuentas, replay de mismo UUID y payload distinto, CAS, cancelación/tombstone de fixture y borrado de padre. Secuencia duplicada fuerza fallo de outbox: no queda excepción parcial y el guardado posterior funciona.
- Recarga conserva tres apariciones y siete intenciones: primera en curso con paso completado, segunda reabierta sin paso completado, padre borrado. Replay previo sigue devolviendo recibo tras ese borrado. Regresión outbox (ocho checks y recarga) y eventos (cinco checks y recarga) aprobada. Solo bases ficticias limpiadas y propios servidores/tabs cerrados; usuario/localhost3000 intactos.
- Lint 193 archivos, tipos y build con 29 recursos neutros aprobados; 93 tests pasan / 7 auth opt-in omitidos / cero fallos. Diff/referencias revisados; commit y push a int al cerrar, cuotas después. Próxima candidata 09b2: edición/reprogramación/cancelación de una aparición; lectores y formulario de repetición aún pendientes.


## 09b2 — Editar y cancelar una aparición, 7 de octubre

- `int`, secuencial, entrada 56%/66% tras 5448f71 publicado. Schema de contenido opcional compatible con excepciones antiguas, dos contratos de comando con ejecutor; validación común de serie/slot y transacción de 09b1 reutilizadas. Sin dependencia, DB version, índice o UI nuevos.
- Primera mutación congela contenido. Editar conserva ID/slot, progreso/completedAt y completado de IDs de pasos presentes; pasos nuevos empiezan false. Cancelar preserva registro y marca cancelled. Guardias CAS obligatorias de padre/aparición (virtual o persistida); progreso posterior no sustituye contenido ni fecha de excepción.
- Tres tests nuevos, regresión de progreso: 56 aserciones conjuntas cubren identidad, copia, checklist, legacy sin content, canceladas/tombstones, input estricto, slots/permisos. Lint 197 archivos, tipos/build 29 recursos aprobados; suite 96 pass/7 auth opt-in skip/0 fail.
- IndexedDB real 4179: primera edición, progreso desde segunda conexión, editor obsoleto rechazado sin escritura, edición nueva conserva completado, dos cancelaciones (una virtual), CAS de serie/identidad, otra cuenta, rollback por secuencia duplicada y guardado posterior. Replay tras cancelación y tras borrar padre no reaplica. Recarga conserva tres excepciones y nueve intenciones consecutivas/encadenadas.
- Regresión fixture progreso: cinco checks y recarga de tres apariciones/siete intenciones aprobados. Solo particiones ficticias limpiadas; tabs/servidores propios cerrados, localhost3000/cuentas reales intactos. Diff/referencias revisados; commit+push int y cuotas al cerrar. Siguiente 09b3a: selector puro paginado con excepciones, incluyendo reprogramadas e historia; interfaz después.


## 09b3a — Lectura pura con excepciones, 7 de octubre

- `int`, secuencial, entrada 50%/65% tras 852266f; despliegue Vercel de 5448f71 confirmado. [task-occurrence-selection.ts](../src/lib/calendar/task-occurrence-selection.ts) prepara series propias activas y excepciones validadas; cada página devuelve copias, no referencias mutables del snapshot.
- Flujos separados: slots virtuales paginados por serie, materializadas por fecha efectiva/ID. Cualquier excepción suprime el slot virtual; canceladas/deleted no se muestran. Historia materializada conserva checklist/estado/contenido aunque se acorte count; legacy sin content hereda plantilla. Duplicados y slot task con hora rechazan.
- Excepciones activas/completadas preparadas una vez y pendientes indexadas aparte; búsqueda binaria salta al cursor/rango y solo considera límite+1 registros por página. Generación salta a la fecha solicitada y no recorre desde ancla. Consultas admiten 0001–9999, límites 1–500.
- Cinco tests y 56 aserciones: movida desde septiembre, movida fuera de octubre, cancelada/tombstone, dos ocurrencias en misma fecha sin colisión, historia tras count/plantilla, desempate interseries, aislamiento/orphans, no alias mutable, extremos y cursores inválidos. Sesenta slots completados/cancelados producen seis páginas vacías con cursor y después tres pendientes de marzo; no corte silencioso.
- Host Pacific/Honolulu repite cinco tests sin fallos. Cien consultas de diez apariciones en diciembre9999 desde ancla0001: 17ms observados. Lint 200 archivos/tipos/build 29 recursos aprobados; suite 101 pass/7 auth opt-in skip/0 fallos. Sin UI, DB, dependencias o mutaciones nuevas; diff/referencias revisados, commit+push int/cuotas. Siguiente 09b3b: snapshot IndexedDB coherente, después lector/orden/UI.


## 09b3b — Snapshot IndexedDB coherente, 7 de octubre

- `int`, secuencial, entrada 46%/64% tras 7af654e. [task-snapshot.ts](../src/lib/local-db/task-snapshot.ts) valida partición y lee items/occurrences/settings sin filtrar tombstones, resolviendo después del complete. [local-recurring-tasks.ts](../src/features/tasks/local-recurring-tasks.ts) comprueba cuenta+epoch antes/después, prepara índice puro y cierra DB en finally. Sin red, UI, DB version, índices o dependencias nuevos.
- Origen aislado 4179, cuatro checks reales: canceladas/tombstones suprimen slots; transacciones concurrentes de escritura y lectura devuelven generaciones 1/2 coherentes entre tres stores; settings ausentes/borrados/zonas inválidas y occurrence corrupta rechazan sin resultado parcial; cuenta ajena/epoch/cierre durante lectura rechazan, segunda partición vacía queda aislada.
- Fixture corregida: corrupción inicial chocaba primero con índice único bySlot, ahora usa un slot distinto inválido por identidad para comprobar el schema previsto. Cierre simulado completa solo metadata ficticia al reactivar/limpiar, sin auth remota. Recarga repite selección y guardias, conserva revisión2 y tres intenciones; leer no crea operaciones. Ejecuciones fallidas y final limpiadas mediante UI de fixture, únicamente sus particiones, control final bloqueado/localmente vacío. Tabs/servidor propios cerrados y localhost3000 intacto.
- Lint 203 archivos, tipos/build 29 recursos y suite 101 pass/7 auth opt-in skip/0 fail aprobados. Diff/referencias revisados; commit+push int/cuotas al cerrar. Siguiente 09b4a: colocaciones por aparición en día, luego backlog antes de UI de repetición.


## 09b4a — Orden mixto dentro de un día, 7 de octubre

- `int`, secuencial, entrada 39%/63% tras d5082cc. [day-task-move.ts](../src/lib/local-db/day-task-move.ts) proyecta series solo para el día y pagina excepciones por fecha efectiva; planner de ranks compartido sin cambiar algoritmo de 07b. Comparator de tareas ahora admite identidad estructural de aparición.
- task.move admite vecinos UUID simples o UUID:fecha civil, distintos/no propios. Snapshot transaccional incorpora occurrences, mantiene namespace personal de colocación y dependencias de padre/cola personal. Solo colocaciones, ItemView y outbox se escriben; nunca materializa estado virtual ni toca shared item/exceptions.
- Categoría personal por serie, orden por aparición y fecha. Canceladas/deleted/reprogramadas fuera del día, vecinos fuera de grupo, otra cuenta y backlog recurrente rechazados. Tres tests nuevos, regresión de cinco tests previos: mezclas en ambas direcciones, guardias, categoría de dos apariciones y grupo de502 registros recuperando segunda página de excepciones.
- IndexedDB real4179: aparición virtual entre dos simples, simple junto a aparición, reintento/reusedUUID, fallo outbox sin colocación parcial y guardado posterior, cancelar invalida fecha pero conserva replay, categoría de serie, aislamiento y scopes no admitidos. Recarga conserva cuatro colocaciones/nueve intenciones y solo una excepción cancelada; padre intacto.
- Regresión fixture simple/day/overdue: concurrencia, guardias, compactación/revisiones, rollback/ancla, ocho colocaciones/dieciséis operaciones tras recarga. Ambos fixtures limpiados únicamente en sus particiones; propios tabs/servidores cerrados, localhost3000 intacto. Lint207files/tipos/build29recursos aprobados;104pass/7auth opt-in skip/0fail. Diff/referencias revisados, commit+push int/cuotas al cerrar. Próxima09b4b: backlog repetido y orden acotado antes de UI.


## 09b4b1 — Referencias acotadas para el orden, 7 de octubre

- `int`, secuencial, entrada31%/62% tras6ea331b; Vercel success del snapshotd5082cc confirmado. [task-reference.ts](../src/lib/calendar/task-reference.ts) prepara padres/excepciones propios y resuelve referencia simple/original con una sola proyección de slot. Devuelve copias; cancels/tombstones/orphans/otras cuentas excluidos, padres recurrentes no ejecutables.
- Excepciones históricas reprogramadas mantienen identidad/progreso aunque count futuro se acorte; input corrupto y duplicados fallan antes de devolver datos. Guardia del día reutiliza lookup y distingue UUID simple de aparición, verificando fecha efectiva antes de calcular peers. Sin nuevas mutaciones, schema, DB, dependencia o UI.
- Tres tests y27aserciones: copias, cadencia/count, identidad inválida, historia/checklist, permisos/canceladas/tombstones, años0001/0004/1900/9999. Mil lookup9999-12-31 desdeancla0001:116msobservados, sin recorrerhistoria. Suite107pass/7auth opt-in skip/0fallos; lint209files/tipos/build29recursos pasan.
- RegresiónIndexedDB real4179: cuatro checks de ordenmixto/rollback/replay/cancelación/aislamiento y recarga9intenciones/4colocaciones/1excepción pasan. Particionesficticias limpiadas, propios tabs/servidor cerrados; localhost3000 intacto. Diff/referencias revisados; commit+push int/cuotas al cerrar. Siguiente09b4b2: adyacencia/ranks de backlog; resolver referencias por sí solo no habilita orden de atrasadas ni formulario.


## 09b4b0 — Diseño de siguiente corte y cierre, 7 de octubre

- Documental enint, entrada28%/61% tras7c8dc42; Vercelsuccess de6ea331b confirmado. [backlog-ordering](backlog-ordering.md) registra el problema real de registros explícitos antes de implícitos, alternativas acotadas y propuesta de claves a validar, sin adoptar schema ni migración. Cortes09b4b2a–c y09b5 separados con pruebas de adyacencia, legado, paginación, snapshot y rollback.
- No empezar código nuevo: siete/ocho puntos consumidos por entregas comparables anteriores frente a ocho puntos sobre reserva20%, con incertidumbre mayor en orden/backlog. Se deja el repositorio comprobado, sin tarea a medias; repeticiónUI/cumpleaños/sync/sharing no se anuncian completas.
- Enlaces locales/consistencia ygit diff --check aprobados; no exige rerun de build para Markdown. Commit+push int al cerrar, verificar HEAD remoto y consulta final de ambas ventanas. Próxima09b4b2a requiere presupuesto suficiente y lectura nueva; cierre comunica cuotas actualizadas.

## 09b4b2a1 — Comparación compatible de ranks, 7 de octubre

- Usuario pide una entrega que quepa en26%; lectura efectiva al abrir23%/61%, secuencial enint. Se parte09b4b2a antes de editar para probar únicamente compatibilidad del orden legado.
- [Adaptador puro](../src/lib/ordering/legacy-rank-key.ts) valida el rank, codifica IEEE754 en prefijo hexadecimal fijo y conserva desempate binario por ID; normaliza ambos ceros. Sin runtime/IO, nuevas dependencias, cambios de schema ni consumidores de UI. El orden vigente sigue siendo numérico; formato persistido definitivo pendiente de demostrar inserción, clave implícita y agotamiento.
- Cuatro [tests](../src/lib/ordering/legacy-rank-key.test.ts),1.306 aserciones: oráculo de2.112 registros deterministas con posiciones repetidas, negativos/subnormales/adyacentes/extremos, ceros e identidades con prefijo común; rechaza valores no finitos/fuera de rango y conserva input. Suite completa111 pass/7auth opt-in skip/0fallos, lint211 archivos, tipos y build29recursos neutros aprobados. No necesita IndexedDB/navegador: no se integra lectura, escritura ni pantalla.
- Diff/referencias y consistencia revisados; cierre en commit+push int con comparación de HEAD remoto. Cuotas finales tras commit al usuario y vuelta al protocolo interactivo. Siguiente09b4b2a continúa con clave implícita/inserción/agotamiento; adyacencia paginada y ejecutor preceden UI recurrente.

## 09b4b2a2 — Comparación implícita y mixta, 7 de octubre

- Petición expresa en voz de otro corte pequeño con la cuota restante21%/60%; secuencial enint. [Clave implícita](../src/lib/ordering/default-task-key.ts) validada con schemas compartidos, derivada de fecha efectiva/creación/identidad sin persistencia. Sigue sin consumidores de aplicación; no cambia la UI ni los datos guardados.
- Cuatro [tests](../src/lib/ordering/default-task-key.test.ts)/2.036 aserciones:2.025 comparaciones por pares, fechas0001/9999, desempates, reprogramación preservando identidad, estabilidad/input intacto y rechazo de input inválido. Oráculo mixto45 tareas/15 colocaciones con prefijos candidatos y rank0 conserva el resultado deorderPlacedTasks.
- Lint213 archivos, tipos,115 pass/7auth opt-in skip/0fallos y build29recursos neutros pasan; diff/referencias/consistencia revisados. Sin IO ni integración; no necesita fixture IndexedDB. Commit/push int y HEAD remoto se verifican al cerrar, junto a ambas cuotas; no se encadena otra entrega. Inserción/agotamiento y luego adyacencia paginada/ejecutor siguen pendientes antes de UI de repetición.

## 11b0 — Preparación de idempotencia remota, 7 de octubre

- Usuario prioriza sincronización y pide adelantar algo con17%; lectura17%/60%, secuencial enint. Plan revisado para adelantar tareas/eventos simples, aplazando09b4b2a/09c/10; garantía de soporte completo sigue pendiente. Scope/aceptación definidos antes de editar, sin cambios materiales de arquitectura, dependencia, seguridad o datos remotos.
- [Huella server-only](../src/lib/sync/operation-fingerprint.ts) valida toda operación con Zod y calcula SHA256 de JSON normalizado, propiedades ordenadas, arrays conservados y dominio de canonicalización versionado. ID/revisión/comando incluidos, input intacto. No persiste recibos ni acepta huellas como autorización; sin endpoint ni red/DB/secretos.
- Cuatro [tests](../src/lib/sync/operation-fingerprint.test.ts)/18 aserciones, oráculo independiente WebCrypto y rechazo de inputs/IDs/campos extra. Suite119 pass/7auth opt-in skip/0fallos; lint215 archivos/tipos/build29recursos neutros pasan. No necesita fixture browser/DB: sin lectura ni escritura persistente. Diff/referencias/consistencia revisados, commit/push int y HEAD remoto al cerrar; cuotas finales al usuario, no encadenar otra entrega.
- Siguiente11a1a: replica set aislado y transacciones reales de prueba; después11a1b repositorio simple/CAS/índices y11b1 recibos+journal+autorización. Descarga/reconciliación/coordinador antes de declarar dos dispositivos convergentes; preferencias y operaciones aún no soportadas nunca se confirman como sincronizadas.

## 11a0 — Entorno y aceptación de sync, 7 de octubre

- Usuario solicita otro corte con14%; lectura14%/59%, secuencial enint, documental. Docker CLI29.8.2 confirmado; mongod ausente dePATH, runtime/replica set/transacciones no verificados. No arrancar servicio ni conectar DB en este corte.
- [Entorno de prueba](sync-test-environment.md) define configuración opt-in separada, DB/instancia/almacenamiento propios, validación antes de limpieza, ownership de recursos, timeout y finally. Reutiliza patrón del guard de auth sin reutilizar su DB ni cambiar singleton/colecciones/índices.
- Matriz de12 escenarios para transacciones/CAS/actor/replay/journal/recuperación, cada uno asignado a11a1a/11a1b/11b1/12 con resultado observable. Diseño y tooling distinguidos de garantías no implementadas. Referencias/consistencia/diff aprobados; fuente y tests intactos, no repetir build por Markdown. Commit/push int y comparación HEAD remoto al cerrar; cuota final al usuario. Siguiente11a1a implementa runner y commit/rollback en DB real aislada.

## 11a1a1 — Descriptor de prueba validado, 7 de octubre

- Usuario pide otro mínimo con12%; lectura12%/59%, secuencial enint. [Schema](../src/schemas/sync-database-test.ts) exige UUID, puerto entero acotado, nombreDB vinculado y URI exacta loopback/replica set propio. Rechaza conexiones remotas/SRV/multihost/credenciales/parámetros, bases normales/auth y otras ejecuciones. No lee env, no usa driver, no abre DB ni altera configuración existente.
- Tres [tests](../src/schemas/sync-database-test.test.ts)/24 aserciones pasan; suite122 pass/7auth opt-in skip/0fallos, lint217 archivos, tipos/build29recursos neutros aprobados. Referencias/diff/consistencia revisados, commit/push int y comparación HEAD remoto al cerrar; consultar ambas cuotas.
- Sin consumidor: aún no protege una ejecución real ni demuestra ownership/transacciones. Siguiente11a1a2 integra descriptor con runner y configura singleton al proceso aislado, verifica recurso propio y commit/rollback reales. No iniciar otro corte con reserva agotada.

## 11a1a2 — MongoDB aislado y atomicidad real, 8 de octubre

- Lote autorizado00:16, entrada100%/58%, int/secuencial/reserva10% documentados enworkflow. Reset real siguiente05:16:33, revisión adicional05:18 creada antes de código. [Runner](../scripts/sync-db-test-runner.ts), config/guard y [fixture](../src/lib/db/transactions.integration.test.ts) usan descriptor UUID/URI de test y singleton; Docker8.2.11 fijado por digest, label/imagen/nombre/almacenamiento propios.
- Primer intento con puerto publicado en daemonUbuntu falló ECONNREFUSED desdeMac y limpió sus recursos. Transporte de fixture ajustado a proxyTCP loopback→Docker exec/bash; sin publicar MongoDB ni instalar paquetes. Dos tests reales/seis aserciones pasan: confirmación conjunta, invisibilidad antes de commit, rollback por escritura duplicada, dato previo intacto y siguiente transacción válida. Probe enauthVerification deDBprivada usa_id existente, sin índices nuevos.
- SIGTERM del runner sale1 y limpia; listado de contenedores conlabel propio vacío. Lint220 archivos/tipos/build29recursos/suite122pass+11opt-in skip pasan, sin fallos. Referencias/consistencia/diff revisados, commit+pushint/HEADremoto/cuotas al cierre. Siguiente11a1b1 repositorio simple y CAS; recibos/journal/API/coordinador todavía pendientes.

## 11a1b1 — Persistencia propia y revisiones, 8 de octubre

- Entrada92%/57% tras79652d7, int/secuencial/reserva10%. [Repositorio](../src/lib/db/remote-items.ts) vincula actor validado, usa singleton/colecciónitems y devuelveDTO sin driver. Insert revision1, CAS siguiente revisión con filtrosowner/ID/kind/createdAt/activo; tombstones legibles y no restaurables. Página1–100 por_ID incluye borrados, ownerId+_id centralizado;_id nativo conserva unicidadglobal.
- [Cuatro tests reales](../src/lib/db/remote-items.integration.test.ts): duplicados/otra cuenta, dos editores conmisma revisión (uno solo guarda), borrado/sinresurrección, cursor/página sin datos ajenos y registro corrupto falla sin página parcial. Runner6pass/33aserciones con atomicidad previa, recursos propios limpiados. Normal123pass/17opt-in skip, lint223files/tipos/build29recursos aprobados; diff/referencias revisados, commit+pushint/cuotas al cerrar.
- No ejecutor de comandos niendpoint: metadatos proceden del futuro servicio validado, no de un payload de UI. Siguiente11a1b2 comparte reductor de comandos simples con capa local para no duplicar reglas; después11b1 recibo+mutación+journal atómicos y autorización de sesión.

## 11a1b2 — Reglas compartidas de elementos, 8 de octubre

- Entrada84%/55% tras0618280, int/secuencial/reserva10%. [Reductor puro](../src/lib/calendar/item-command.ts) reúne reglas de creación, edición, progreso/checklist y tombstones sin cliente/servidor/IO; wrappercliente mantiene imports previos, tipoItemCommand compartido sin cambiar protocolo.
- Tests existentes apuntan al reductor compartido; regresión de eventos conserva wrappercliente. Revisión optimista0/actual, propiedad, identidad, completedAt y reglas recurrentes conservadas. Suite123pass/17opt-in skip/0fail, lint224files/tipos/build29recursos pasan. Referencias/diff revisados, commit+pushint y cuotas al cerrar. Siguiente11b1 integra recibo+mutación+journal, aún sin transporte activo.

## 11b1a — Mutación y registro remoto atómicos, 8 de octubre

- Entrada82%/55% trasd6734f0, int/secuencial/reserva10%. [Ejecutor DAL](../src/lib/db/remote-item-commands.ts) valida actor/operación, aplica reductor compartido a tareas/eventos simples propios e incrementa revisión. Recibo actor+operationId conhuella, contador_id receptor yjournal receptor+secuencia se confirman juntos en snapshot/majority; sesión permanece enDB. Índices únicos centrales, sin TTL; replay precede guardias de estado, ID reutilizado rechazado.
- Seis tests MongoDB reales: cuatro reintentos concurrentes convergen en un recibo; replay tras borrado, corrupción de propietario del recibo, dos editores uno conflicta y conflicto conserva resultado; aislamiento/ID forjado, cinco commits concurrentes con secuencias1–6, comandos no soportados sin recibo, evento inválido porDST, edición/borrado válidos y fallo tardío de journal con rollback de las cuatro colecciones y recuperación posterior.
- Runner12pass/82aserciones, contenedor/almacenamiento propios limpiados; suite124pass/25opt-in skip/0fail, lint228files/tipos/build29recursos pasan. Diff/referencias revisados; commit+pushint/HEADremoto y cuotas al cerrar. Actor de sesión/acción externa en11b1b; pull/reconciliación/coordinador pendientes. Sin convergencia anunciada ni ACK de preferencias/recurrencia/cumpleaños.

## 11b1b — Subida autenticada por lotes, 8 de octubre

- Entrada79%/55% tras1f8a920, int/secuencial/reserva10%. [Acción](../src/features/sync/actions.ts) obtiene actor de sesión persistida sin cookiecache/refresh; [servicio](../src/features/sync/push-batch.ts) valida lote completo de1–50/512KiB, rechaza duplicados/actorinjetado y ejecuta secuencialmente. Identidad reutilizada devuelve rechazo explícito; fallo transitorio devuelve prefijo terminado y operación fallida, sin ocultar pendientes ni ejecutar siguientes.
- Cinco tests de servicio con dependencias controladas: sesión ausente/caducada/noautorizada, lote inválido tardío y límites, actor/orden sin concurrencia, comandosunsupported preservados, fallo parcial/reutilización. No sustituyen MongoDB real11b1a ni pilotoGoogle. Suite129pass/25opt-in skip/0fail, lint231files/tipos/build29recursos pasan; diff/referencias y commit+pushint/cuotas al cerrar.
- No envío automático ni ACK/rebase IndexedDB habilitados; la acción queda preparada para el futuro transporte. Siguiente11c1 descarga por secuencia propia, después bootstrap/reconciliación y coordinador.

## 12a1 — Descarga privada con checkpoint, 8 de octubre

- Entrada77%/54% tras77ec288, int/secuencial/reserva10%. [DAL](../src/lib/db/remote-changes.ts) lee contador/journal bajo snapshot; página1–100 conserva through fijo, orden y contigüidad exactos; cursores futuros fallan. [GET](../src/app/api/sync/changes/route.ts) usa sesión vigente y serviciofeature, validación compartida/query sin claves extra/duplicadas, respuestasprivate/no-store y errores internos ocultos. Propiedad actual comprobada por payload histórico; incluye tombstones.
- Bootstrap inicial reproducejournal durable desde0 hasta checkpoint, después cambios posteriores; evita páginas de elementos móviles y no compacta historia. Requiere que toda escritura de producto vaya por ejecutor atómico; datos preexistentes sinjournal necesitan migración específica, no se ocultan como bootstrap completo. Preferencias/sharing siguen fuera de soporte.
- Tres tests nuevos Mongo: páginas bajo edición/borrado/creación intercalados y estado final reconstruido equivalente aDAL; aislamiento/cursor futuro; hueco/corrupción/propiedad actual invalidan página entera. Cuatro tests HTTPhelper401/400/200/409/503 sin caché/detalles. Runner15pass/105aserciones y recursos propios limpios; normal133pass/30opt-in skip, lint236files/tipos/build29recursos pasan. Diff/referencias/commit+pushint/cuotas al cerrar. Siguiente12b1 ACK/pull locales atómicos antes de coordinador; todavía sin prueba de dos dispositivos.

## 12b1a — Pull conserva intenciones, 8 de octubre

- Entrada75%/54% trasa4672a2, int/secuencial/reserva10%. [Planner puro](../src/lib/sync/item-projection.ts) valida cuenta/identidad/cola conschema compartido, avanza shadow sin regresión y rechaza misma revisión concontenido distinto. Sin pendientes adopta remoto/tombstone; pendientes/enviando/conflicto/rechazadas conservan local íntegro. No asume ACK porque coincida UUIDdejournal, no fusiona concurrentes ni modifica cola.
- Cuatro tests/26aserciones: edición y borrado locales, creación optimistarev0, ausencia local conpendientes, acknowledged no bloquea, respuestas viejas/replay, foreign/corrupt/identidades/duplicados y input intacto. Suite137pass/30opt-in skip/0fail, lint239files/tipos/build29recursos pasan; no necesita browser porque no hayIO/consumidor todavía. Diff/referencias/commit+pushint/cuotas al cerrar; siguiente12b1b ACKatómico y revisión congelada para dependientes.

## 12b1b — ACK local durable y dependencias, 8 de octubre

- Entrada73%/54% trasc9d2618, int/secuencial/reserva10%. [LocalSyncStore](../src/lib/local-db/sync-store.ts) liga resultado a operación completa/sender delease/cuenta/ID/revisión. Resultados/outcome conlocal/base/intención, outbox, shadow yvista se guardan en una transacciónIndexedDB; replayACK exige mismooutcome. Unsupported vuelvependiente, conflicto/rechazo preservan borrador y evidencia; comandos no implementados no admiten applied.
- ACK confirma suintención y propaga revisión solo a dependientes directos pendientes conattempts0, sin cambiar enviados. Conediciones posteriores conserva contenido optimista yactualiza metadata; últimaACK adopta shadow monotónico. Noavanza cursor deljournal. Sin DBversion/stores/deps nuevos; outcomes usan syncMetadata ya existente.
- [Fixture](../test/browser/sync-results.ts) siete checks: lease/cuenta/operación/revisión incorrectos, creación+progreso dependiente, últimaACK/replaycontradictorio, conflicto, unsupported/reintento congelado, putmetadata forzado revierte cuatrostores, rechazo ycursor intacto. Recarga conserva5operaciones/3ACK/1conflicto/1rechazo y3elementos. Ambas ejecuciones ficticias limpias, propios tabs/servidor cerrados; localhost3000 intacto.
- Suite137pass/30opt-in skip/0fail, lint241files/tipos/build29recursos pasan; diff/referencias ycommit+pushint/cuotas al cerrar. Siguiente12b1c pull+cursoratómicos; no prueba de dos dispositivos ni envío automático aún.

## 12b1c — Descarga y cursor local indivisibles, 8 de octubre

- Entrada68%/53% trasfee2687, int/secuencial/reserva10%. [Aplicador](../src/lib/local-db/pull-changes.ts) valida cuenta/secuencia/checkpoint ypliegaúltimas versiones porID. Cursor CAS contraestado guardado: stale completo ignored, salto/solape/checkpoint distinto rechaza. Proyección/shadow/cursor se confirman juntos; outbox no se confirma porUUIDdejournal. ACKadelantado conserva revisión másalta, pendientes mantienen local. Checkpointdurable permite reabrir a mitad depáginas; sinawait externo niDBversion nueva.
- [Fixture](../test/browser/sync-pull.ts) seischecks yrecarga: bootstrap concreate/editpendientes, checkpointerróneo, tombstones/pliegue/replayviejo, tresACK adelantadas yhistoriaanterior, cursorputforzado revierte datos+shadows, dosrespuestas compiten (applied/ignored), foreign/gap/future/empty-no-progress/revisionregression rechazadas. Recarga conserva cursor7/sincheckpoint,3items/1tombstone/3ACK. Particiónpropia limpiada, tab/servidor propios cerrados; localhost3000 intacto.
- Suite137pass/30opt-in skip/0fail, lint243files/tipos/build29recursos pasan; diff/referencias/commit+pushint/cuotas al cerrar. Siguiente12b2a transporte/coordinador acotados eidentidad; preferencias/ocurrencias/sharing pendientes ysin convergencia de dispositivos anunciada.

## 12b2a1 — Carrera de cuenta cerrada, 8 de octubre

- Entrada64%/52% tras7684154, int/secuencial/reserva10%. Contrato de subida preparado añadeexpectedUserId como condición decoherencia conactor de sesión vigente; noautoriza ni reemplaza sesión. Service devuelveaccount_changed sin ejecutar si cambiócuenta despuésdeconsulta identidad. Inputsinexpected oactorinyectado se rechaza; cliente futuro conserva pendientes ydetiene envío.
- Nuevo test sesiónB/payloadA conejecutor quefallaría si fuera llamado, ycontrato sincuenta esperada; regresiones existentes conexpected matching pasan. Primer types/build detectó forwarding deZodIssue incompatible conversión instalada; corregido conissuecustom explícito yvalidaciones repetidas. Suite138pass/30opt-in skip/0fail, lint243files/tipos/build29recursos pasan; diff/referencias/commit+pushint/cuotas al cerrar. Siguiente12b2a2 coordinador; sin cambios deDB/hosting/permisos niUIactivada.

## 12b2a2 — Coordinación secuencial limitada, 8 de octubre

- Entrada60%/52% trasb8e6ed6, int/secuencial/reserva10%. [Coordinador](../src/features/sync/coordinator.ts) porpuertos tipados comprueba cuentaactiva/identidad, descarga checkpoint antesdeclaim y envía unaoperación porpetición conexpectedUserId. Relee cola trasACK para obtenerbasedependiente; filtra comandos sinsoporte yusa lease entrepestañas. Pasada4páginas/5envíos, runcoalesced/stop yrespuestaexacta; ACKadelantado sigueprotegidoporstore. Release solo deldueño trasfallo/retorno mantiene payload congelado.
- Sietetests: identidad ausente/distinta sinclaims; bases0→1/despuesACKyoccurrenciassinsend; respuesta perdida mismoUUID/payload, runconcurrente coalesce/stopduringidentity/accountasync, descargagrandeantespush,5envíosmáximo yconflicto conentidadindependiente. Se detectó ycerró stopduranteawait deaccountcheck conregresión específica. FixtureIndexedDB añadewrong-ownerreleasefalse, ownrelease/reclaimattempts3/mismooperation;7checks+recarga aprobados, particiónpropia limpiada/tab/servidor cerrados.
- Suite145pass/30opt-in skip/0fail, lint246files/tipos/build29recursos pasan; diff/referencias/commit+pushint/cuotas al cerrar. Puertos aúnsinadaptadorproductivo, noUIautomática ni prueba dedispositivos conectados; próxima12b2a3 transporte/entorno yprueba integrada de dos particiones.

## 12b2a3 — Transporte privado y ciclo de recursos, 8 de octubre

- Entrada55%/51% tras26659d2, int/secuencial/reserva10%. [Transportador](../src/features/sync/http-transport.ts) usa identidad/pull same-origin/no-store, expectedUserId/checkpoint/limit50 ydeadline30s (incluidolecturaJSON). Callbackinyectado deacción evitaimportsdeDB/auth enbrowser; input/output/contextosecuencial validados, timeout conservaIDsinACK. GuardGETesperado compara sesiónantesdeleer, códigoscuenta/cursor tipados; coordinador devuelveunauthorized/account_changed/recovery_required sinclaims.
- [Runtime](../src/features/sync/local-runtime.ts) verificaepochlocal, abre reposoutbox/sync/repositorio propios, closesfulfilled siotroopen falla, claim120s; stopespera pasada/release antesdecerrar ycloseesidempotente. Factory preparada aún sinconsumidorUI, será ejercitada en12b2a4.
- SeisHTTPtestscontrolados: cookies/cache/identidad, checkpointesperado, estados401/409/503, ambos lados deacción/cuentadistinta, deadlinerespuesta perdida/fetchabort ymalformed/pagejump. GuardGET sesiónB/payloadA noleejournal; regresióncoordinador mapea recovery/auth antesclaim. Al reforzar contexto, mockdepagequeomitía3registros fallócorrectamente; corregido afixturecontiguo, suite153pass/30opt-in skip/0fail. Lint250files/tipos/build29recursos pasan. Commit código b29017e/HEADremoto verificados; dosdispositivos/transporteHTTPcompleto todavía no comprobados, siguiente12b2a4 entorno integrado.

## 12b2a3d — Registro documental corregido, 8 de octubre

- Entrada51%/50% trasb29017e. Error de sintaxis delscript impidió cierreMarkdown, mientras elcódigo validado yscopeprevio quedaron publicados. Corrección inmediata documental conplan/resultado/log encommit propio; noalterar historiaremota ni código.
- Referencias/consistencia/diff verificados; no repetirbuild porMarkdown. Commit+pushint/HEADremoto/cuotas al cerrar. Próxima12b2a4, margen suficiente para continuar; no es un cierre del lote.

## 12b2a4 — Pila integrada entre dos dispositivos simulados, 8 de octubre

- Entrada49%/50% tras822a163, int/secuencial/reserva10%. `bun run test:sync-browser` reutiliza descriptor/imagen/ownership/proxy/cleanup del [runner](../scripts/sync-db-test-runner.ts). [Servidor de fixture](../scripts/sync-browser-test-server.ts) usa dos puertos loopback efímeros con capacidad porrun y actor ficticio propio, sin cargar.env ni credenciales. TransporteHTTP/runtime/coordinador/IndexedDB son los de producto; callback de subida usa servicio y DAL reales.
- [Fixture de dos dispositivos](../test/browser/sync-devices.ts) y [dispositivo aislado](../test/browser/sync-device.ts) verifican seis escenarios en navegador: crear sin red (adaptador controlado) y recargar conservando operación exacta; conexión/ACK/bootstrap y DTOs iguales aMongo; estado/checklist dependientes desdeB haciaA; perder respuesta después decommit real y repetir mismoUUID/payload con revisión/journal únicos; borrado/tombstone/recarga; ediciones concurrentes que conservan borrador+shadow/conflicto durable mientras otra entidad llega aMongo/B. Conflicto exige recuperación explícita; no se anuncia convergencia de su borrador.
- Schema de fixture valida run/cuenta/orígenes loopback independientes/puerto válido y comandos estrictos. Normal154pass/30opt-in skip/0fail,4392aserciones; lint255files/tipos/build29recursos pasan. Regresión modoMongo15pass/105aserciones; ambos runners exit0 con contenedor/volúmenes/sockets/hijos cerrados, particiones ficticias eliminadas y pestaña propia cerrada. Docker/imagen fijada revalidados. Diff/referencias y commit+pushint/HEADremoto/cuotas al cerrar.
- Evidencia integra pila de tareas propias simples, no Google interactivo, RPCNext ServerAction, preferencias, recurrencia/cumpleaños o compartir. UI automática sigue apagada. Próximo corte12b2b1: resumen local que distinga pendientes soportados, sin soporte y conflictos/rechazos antes de exponer sincronización en ajustes.

## 12b2b1 — Resumen local veraz de sincronización, 8 de octubre

- Entrada42%/49% trasccb0211. [Clasificador puro](../src/lib/sync/queue-summary.ts) distingue pendientesready/waiting/blocked/unsupported, sending, conflictos yrechazos; ACK excluidos. Valida cuenta/identidades/duplicados ypropaga dependencias conrecorrido iterativo lineal, sin cambiar operación ni suestado. Dependencia ausente/ciclo ydescendientes permanecen bloqueados. [Lectura local](../src/lib/local-db/queue-summary.ts) usa una transacciónreadonly items/outbox, expuesta porLocalSyncStore.
- Cinco oráculos: mezcla deestados ypayload intacto; fallo transitivo/ACK; ciclos/dependenciaausente; cadena invertida1500sinrecursión; foreign/duplicados. Fixture dosorígenes/Mongo incorpora resumen en snapshots yverifica pendingoffline1, ACKpending0 yconflicto1 tras otra entidad confirmada; seis escenarios pasan, recursos propios limpiados/exit0 ytabcerrado.
- Normal159pass/30opt-in skip/0fail,4405aserciones; lint259files/tipos/build29recursos pasan, diff/referencias ycommit+pushint/HEADremoto/cuotas al cerrar. Siguiente12b2b2: UI compacta de Ajustes con ejecución manual yactualización de caches; después scheduler/activaciónautomática.

## 12b2b2 — Sincronizar ahora desde Ajustes, 8 de octubre

- Entrada38%/48% tras1771b47, int/secuencial/reserva10%. [Hook](../src/features/sync/hooks/use-sync-engine.ts) lee resumen local viaSWR user/epoch, ejecuta pasada acotada yrenueva solo caches deesa cuenta. [Attempt](../src/features/sync/manual-sync.ts) coalesce llamadas, invalida ejecución desmontada y cierra runtime exactouna vez aunque falle apertura/pasada/cache. [Dispatcher](../src/features/sync/client-action.ts) llamaacción autenticada desde startTransition conforme guíaNext instalada; Nextbuild separa referencia cliente deejecutor/auth/Mongo servidor.
- [Panel compacto](../src/features/sync/components/sync-status-panel.tsx) en Ajustes muestra únicamente contadores no cero, alcance de tareas/eventos simples, limitaciones depreferencias/series yconflictos/rechazos conservados. Authcaducada ofreceenlaceGoogle; fallos/cuentacambiada/cursor inválido no confirman pendientes. No nuevo destino, ambasbarras siguen accediendo aAjustes. Todavía solo ejecución manual.
- Cinco tests deattempt/caches y tresSSR cubren coalescing, stopduranteopen/run, cierre enfallos, filtrocuenta/epoch, conflictos/unsupported visibles incluso despuésdesettled yauth/colailegible. [FixtureReact](../test/browser/sync-settings.tsx) ejecuta hook/componentes reales con sustitución exclusiva deacción enbundle de test haciaHTTP/DB propio: crear tarea+categoría, pulsarSincronizar confirma una operación/revisión1 enMongo ydeja preferencia pendiente sinfalsa convergencia. Móvil390×844 sinoverflow ybotón44px; validación durable+limpieza/tab/server/container cerrados, exit0. Cookiecapacidad ficticia HttpOnly/SameSite/600s eliminada alcerrar, sin tocarcookies deauth.
- Normal167pass/30opt-in skip/0fail,4434aserciones; lint267files sinavisos/tipos/build30recursos pasan. Se corrigió ruidoBiomede dependencycleanup (componente conkeyepoch) yternariolabel antesdecierre. Diff/referencias/commit+pushint/HEADremoto/cuotas al cerrar. No pruebaGoogleinteractivo/RPCNext contra sesiónreal; piloto pendiente. Siguiente12b2b3 scheduler debackoff/pasadas acotadas antesdearranqueautomático.

## 12b2b3 — Política de reintento acotada, 8 de octubre

- Entrada30%/47% trasb0767ea. [Scheduler](../src/features/sync/scheduler.ts) ofrece una pasada activa, start/wake/manual coalescidos; intervalo60s alacabar, continuación2s trasmore_work, backoff30/60/120/240/300s trasfallo. Eventos de foco/reconexión noadelantan deadline; oculto/offline noejecuta automáticamente. Auth/cambiocuenta/cursor/stoppausan hasta solicitudmanual, sinbucles deautenticación. Stopterminal cancela timer/pasada ysuprime callbacks tardíos. Puertos inyectados, ningún listenerglobal/UI nuevo aún.
- Cinco tests conreloj/timers propios validan tiempos exactos, flooddewake, offline/hidden, pausa/manual, coalescing ystop. Suite172pass/30opt-in skip/0fail,4465aserciones; lint269files/tipos/build30recursos pasan. Diff/referencias/commit+pushint/HEADremoto/cuotas al cerrar; próxima12b2b4 integra proveedorúnico conWorkspace yAjustes, conservando límites de comandos simples yestadoveraz.

## 12b2b4 — Sincronización automática en el espacio, 8 de octubre

- Entrada28%/47% trasf735f9f. [Provider](../src/features/sync/components/workspace-sync-provider.tsx) monta unmotor porusuario/epoch a lo largo deWorkspace; navegación no crea otra instancia. [Engine](../src/features/sync/hooks/use-sync-engine.ts) usa scheduler ytransporte/acción existente, autoarranque/online/foco/visibilidad congateonline+visible, intervalos/backoff/pausas ya probados. BotónAjustes comparte exactamente misma instancia/estado; desmontar detiene timer/listeners/attempt ysuprime efectos tardíos.
- Guard/runtime aceptan solo userId+epoch (campos requeridos para aislamiento), sin ampliar permisos ni alterar almacenamiento. Se adaptó fixture decontrato trasfallo de exceso de campos enliteral; checks repetidos. Resumen/SWR de cuenta renovado traspasada, sincachedeotra cuenta/epoch. Copy aclara appabierta, alcance simple ypendientes sinsoporte/conflictos.
- FixtureReact real conMongoaislado: alabrir (sinpulsación) pasa de2pendientes a1preferencia sinsoporte; pulsaciónmanualposterior noañade escritura, revisión1 yACK1 exactos. Validación durable/cleanup aprobados, recursos propios limpiados ytabcerrado/exit0. Scheduler/attempt/cuentas permanecen cubiertos porsuite172pass/30opt-in skip/0fail,4465aserciones; lint272files/tipos/build30recursos pasan. No nueva dependencia/UIruta/índice. Diff/referencias/commit+pushint/HEADremoto/cuotas al cerrar.
- La app real queda habilitada para simples propios con sesión válida yMongo transaccional; DBproducto/Googleinteractivo/RPCNext todavía requierenpiloto. No backgroundsync conappcerrada, ni preferencias/series/compartidos. Próximas tareas pequeñas12b2c: señal de cambio local sin adelantarbackoff yaviso compacto deincidencias fueraAjustes; después13a recuperación explícita, manteniendo borradores pendientes.

## 12b2c — Cambios locales despiertan motor y aviso mínimo, 8 de octubre

- Entrada24%/46% tras3cbd96d. [Notificaciones](../src/lib/local-db/sync-notifications.ts) solotrascommitdeintenciónoutbox, víaCustomEvent/BroadcastChannel propio. Schemaestricto/cuentafiltrada, ausencia/fallo decanal no invalida escritura ycanal cerradoconfinally. Claim/release/ACK/pull no producenestas señales. Scheduleradelanta idle a1s yrevisa pronto cambios llegadosdurantepasada; noadelanta backoff niauth/cursorpausados. Engine renueva resumen local alaviso, limpia listener/canal alcerrar.
- [Aviso](../src/features/sync/components/sync-issue-notice.tsx) compactoen vistas ajenasAjustes soloanteconflictos/rechazos oauth/cuenta/recuperación; enlace aldestinocomúnAjustes. Éxito/fallo transitorio no añadenbloque. Sin nuevaspantallas/destinos.
- Siete tests nuevos: idlesignal/coalescing/backoff/pausas ywrite durantepass; canalpostfallido cerradosinerror/foreign+malformed rechazados/cleanup; tresSSR de aviso material/normal. FixtureReact arrancaauto, segundoitem creado despuésactiva señal/subida sinpulsaciónmanual niintervalo60s; dosACK/revisión1 ycategoría pendientedurable confirmados, mensajesforáneos/extra ignorados. Todosrecursos propios limpios/exit0 ytabcerrado.
- Normal179pass/30opt-in skip/0fail,4482aserciones; lint276files/tipos/build30recursos pasan. Diff/referencias revisados; referencia histórica delhook eliminadose actualizaasu sucesor (detectada trascommit12b2b4; sinreescribir historia). Commit+pushint/HEADremoto/cuotas al cerrar. Próxima13a1 lectura validada deincidentes para recuperación; no automatizar elección deversión nidescartarborradores.

## 13a1a — Evidencia de incidente validada, 8 de octubre

- Entrada17%/45% trasa8f6255, int/secuencial/reserva10%. [Proyección](../src/lib/sync/incident-projection.ts) produce DTO deincidente deelemento propio: entradaoutbox congelada, razón, borradoractual/deloutcome, shadowalresultado yremotomásreciente conocido. Valida schema/estado/key/cuenta/identidad/operación completa, rechaza applied/unsupported ydatoscorruptos, conserva tombstones/edicionesposteriores sinIO/ACK/rebase.
- Revisión de escenario de replay encontróque elshadow existente alrecibirconflicto puede ser másnuevo que larespuesta durable original; se compara porrevisión envezde presumir ordenbase→respuesta. Igualdadcontradictoria/cachéregresiva fallan. Cinco tests cubren borradorposterior/inputintacto, tombstones, rechazo sinremoto, replaytardío y11variantescorruptas/foreign. Normal184pass/30opt-in skip/0fail,4508aserciones; lint280files/tipos/build30recursos pasan.
- [Diseño de recuperación](conflict-recovery.md) separa evidencia, snapshot13a1b, comparación yelección/mutación posterior. Shadowdeoutcome no es necesariamente ancestrodeoperación; no fusionar automáticamente sobre él. Decisión debe conservar registro/operaciónoriginal, considerar toda lacadena dependiente, crearUUIDnuevo yrespetar tombstones/CAS/cuenta. Supersesiónlocal no es ACKservidor; estado/contrato yUI aúnpendientes.
- Diff/referencias/commit+pushint/HEADremoto/cuotas al cerrar. No consumidorUI ni lectorIndexedDB nuevo; próxima13a1b antesderesolución. Evaluar margen de5h frente acosteobservado decortes deIO/browser, sin abrir otro siarriesga10%.

## Cierre del lote del 8 de octubre, 00:16

- Tras `f4ba680`, con HEAD remoto verificado y árbol limpio, quedan 12%/44%. El último código pasa 184 pruebas, 30 opt-in omitidas y 4508 aserciones; lint de 280 archivos, tipos y build de 30 recursos aprobados. No quedan contenedores de prueba por label; servidores y pestañas propios cerrados. No se incorporaron cambios ajenos ni se alteraron rama, dependencias core, hosting o secretos.
- Sigue `13a1b`: snapshot de items, outbox, shadows y outcomes, con guardias de cuenta y época; después, comparación y resolución explícita. Los dos puntos sobre la reserva del 10% no cubren IO, navegador y cierre: los últimos cortes comparables consumieron 5–8 puntos. No queda tarea abierta. La proyección pura está preparada; no hay elecciones ni ACK supuestos.
- El heartbeat actual `comprobar-renovaci-n-de-cuota` está PAUSED. La revisión única `continuar-sincronizaci-n-siguiente-ventana` está ACTIVE para las 05:18 de Madrid, con reinicio publicado 1791429393 y política failed_runs_only. Su prompt usa el plan y último HEAD cerrado. No se crea otra cadena; las cuotas deben confirmarse antes de continuar.
- Scope de cierre: cuatro documentos del plan. Referencias, consistencia y diff verificados; commit, push a int, HEAD remoto y cuota final al terminar. No repetir pruebas aprobadas por Markdown. El protocolo interactivo vuelve al acabar la autorización de la revisión posterior.


## 13a1b — Lectura coherente de incidentes, 8 de octubre, revisión 05:18

- Entrada 100%/43%, renovación real confirmada y HEAD 94117a0 igual a origin/int, árbol limpio; reserva 10%. Nuevo reset publicado 1791447514, sin programar una cadena adicional. Autorización de la segunda continuación registrada en workflow.
- [Snapshot puro](../src/lib/sync/incident-snapshot.ts) valida cuenta/identidades/duplicados y evidencia completa antes de devolver incidentes ordenados. [Lector IndexedDB](../src/lib/local-db/sync-incidents.ts) usa una sola transacción readonly de items/outbox/remoteShadows/syncMetadata y solicita los outcomes terminales sin await ajeno. Conserva borradores posteriores, tombstones y todas las intenciones sin ACK del elemento. [Wrapper](../src/features/sync/local-incidents.ts) verifica usuario/época antes/después y cierra recurso propio. No mutación, ACK, rebase ni llamada remota.
- Tres tests puros nuevos cubren cadenas/tombstones/payload intacto, ACK excluido/rechazo sin remoto y corrupción/foreign/duplicados/outcome ausente. [Fixture real IndexedDB](../test/browser/sync-incidents.ts): cuatro checks iniciales y dos tras recarga, snapshot no parcial ante evidencia ausente, cuenta cambiada durante lectura sin exposición; partición generada eliminada, conexión/tab/servidor cerrados. Fallo inicial de recarga era logout ficticio pendiente: fixture completa su logout local antes de reactivar.
- Normal 187 pass/30 opt-in skip/0 fail/4526 aserciones; lint 285 archivos sin ruido, tipos y build 30 recursos pasan. Referencias/diff revisados; commit y push int/HEAD remoto/cuotas al cerrar. Próxima 13a1c comparación compacta, sin ofrecer resoluciones hasta executor probado.


## 13a1c — Comparación de conflictos desde Ajustes, 8 de octubre

- Entrada 93%/42% tras 7a06c0f, int/secuencial/reserva 10%. [Detalles](../src/features/sync/components/sync-incident-details.tsx) cargan snapshot solo al abrir, mediante SWR por usuario/época, polling local 15s y revalidación tras sincronización o intención local. No duplican motor ni nuevos listeners. Ajustes existentes accesibles en ambas barras; ninguna ruta nueva.
- [Comparación](../src/features/sync/components/sync-incident-card.tsx) muestra borrador actual, remoto conocido (puede estar desactualizado), razones y tombstones. Comando enviado e intenciones pendientes desplegables; no usa shadow del outcome como ancestro ni presenta elecciones sin executor. Error de lectura oculta resultados cacheados. Contenido largo ajusta ancho, tipografía compacta y controles 44px. Guía vercel-react-best-practices aplicada a SWR bajo demanda; guide use-client de Next instalado revisada.
- Dos tests SSR: diferencia entre borrado local/remoto/comando, rechazo sin remoto y fallo que oculta caché; 189 pass/30 opt-in skip/0 fail/4543 aserciones, lint 294 archivos, tipos/build 30 recursos aprobados. [Fixture React real](../test/browser/sync-incident-ui.tsx) valida apertura, borrador posterior En proceso frente a enviado Sin empezar, historial dos intenciones, recarga y cola exacta intacta. Viewport 390×844, ancho 390 y summaries 44px. Partición propia limpiada, tab/servidor cerrados y viewport restaurado.
- Referencias/diff y commit/push int/HEAD/cuotas al cerrar. Sigue 13a2a: resolución local explícita con evidencia durable y supersesión, sin convertir conflicto/rechazo en ACK remoto.


## 13a2a — Elección explícita validada como contrato puro, 8 de octubre

- Entrada 89%/42% tras a1ce590, int/secuencial/reserva10%. [Schemas](../src/schemas/sync-resolution.ts) y [planner](../src/lib/sync/incident-resolution.ts) reciben snapshot esperado completo/actual, choice, UUIDs y timestamp; comparan exactamente toda evidencia y cadena, validan cuenta/identidad/versión simple/sin envío activo. No IO ni UI de elección todavía.
- Adoptar remoto conocido devuelve esa proyección sin operación; enviar borrador completo construye nueva operación update o delete sobre revisión remota, reusa metadatos remotos y conserva intención original como evidencia. Registro durable previsto guarda elección, snapshot íntegro e IDs supersedidos; no ACK. Remoto tombstone solo se adopta, nunca se resucita. Rechazos/sin remoto/series quedan conservados hasta flujo apropiado. Cambio posterior de local, remoto o cola invalida elección; ID reutilizado/lease/foreign/duplicado/cadena ausente falla.
- Cinco tests nuevos cubren adopción, draft/checklist/status completo y base3, borrado/tombstone y todas las guardias. Suite194pass/30opt-in skip/0fail/4576aserciones; lint298files/tipos/build30recursos aprobados. Referencias/diff, commit/pushint/HEAD/cuotas alcerrar. Siguiente13a2b1 executor atómico y supersesión local explícita, despuésUI y prueba dos dispositivos.


## 13a2b1 — Decisión local atómica y supersesión, 8 de octubre

- Entrada86%/41% tras7b45a3f, int/secuencial/reserva10%. Estado local `superseded` añadido a schema existente sin nueva colección/índice o upgrade físico. [Predicado](../src/lib/sync/outbox-state.ts) separa intenciones activas de historial supersedido; proyección/lectura de incidentes y creación de nuevas dependencias lo usan. Clasificador no cuenta superseded como pendiente ni lo considera ACK para dependientes ajenos. Claim requiere ACK verdadero y no envía superseded.
- [Executor](../src/lib/local-db/sync-resolution.ts) regenera snapshot dentro de transacción items/outbox/shadows/metadata, compara exactamente esperado, verifica secuencia/UUID/cadena completa/no dependientes externos, guarda decisión+item+supersesión+replacement/secuencia juntos. Entrada original completa queda en record expected; operación/dependencias/attempts/outcomes originales intactos. Replay recalcula record válido y compara evidencia sin reescribir ediciones posteriores. Intención pendiente antes intentada impide elegir por incertidumbre de envío, igual que lease activo.
- Wrapper exige usuario/época antes de apertura, antes de escribir y después; recursos propios cerrados. Notificación solo al completar commit aplicado, ninguna al fallar o replay. Lectura compartida fue extraída a encolado sin await para reuse en transacción. Rechazo/cadena externa/sin remoto/series permanecen conservados; no UI nueva todavía.
- Tres tests nuevos: superseded no bloquea futura proyección, nunca satisface dependencia como ACK, pending intentada no se supersede. Normal197pass/30opt-in skip/0fail/4584aserciones; lint301files/tipos/build30recursos aprobados. [FixtureIndexedDB](../test/browser/sync-resolution.ts): ocho checks y uno de recarga, stale snapshot, rollback tardío adopción/retry con contador/cola/item/evidencia exactos y sin notificación; adopción permite pull posterior, outcome/payload intactos; replay tras edición no sobrescribe, replacement puede conflictuar otra vez; externos/cuenta/tombstone conservados. Particiones/tab/servidor propios limpiados.
- Referencias/diff y commit/pushint/HEAD/cuotas alcerrar. Próximo13a2b1a prueba integrada dos dispositivos y MongoDB aislado antes de UI13a2b2. No declarar convergencia por fixture de respuestas simuladas.


## 13a2b1a — Recuperación explícita converge en dos dispositivos, 8 de octubre

- Entrada79%/40% tras170a38b, int/secuencial/reserva10%. Docker28.4linuxamd64 ydigestlocal Mongo8.2.11 revalidados, sin contenedor residual. [Fixture integrada](../test/browser/sync-devices.ts) amplía de seis a nueve escenarios; [dispositivo](../test/browser/sync-device.ts) expone snapshot de incidentes y comando de resolución validado mediante wrapper real usuario/época. No nuevoendpoint deproducto ni bypass deauth.
- Reintento de conflicto conedición posterior supersede dosintenciones originales, crea UUIDnueva/base2 yservidor revision3. Respuesta perdida despuésdelcommit, replay deelección yrecarga conservan operación congelada; segunda pasada confirma solo replacement, sin duplicarrevisión/journal. Proyecciones/cursores deambos orígenes coinciden conMongo ycontadores pendientes/sending/conflicto/rechazo0.
- Nueva colisión seguida de ediciónlocal invalida snapshotviejo sin modificar ningúnrecord; adoptar remoto conocido yrecargar noañade revisión nieventojournal. Remoto borrado produceconflicto/tombstone; retrylocal rechaza sinresucitar nidiscardarborrador, adopción explícita hace converger ambasparticiones. Estos escenarios sí pruebanconvergencia remota, a diferencia defixture local de13a2b1.
- `bun run test:sync-browser` exit0/nuevechecks aprobados; particiones, cookiescapacidad, tab, servidores/proxies/container/storage propios limpiados. ConsultaDockerporlabel confirma vacío. Normal197pass/30opt-in skip/0fail/4584aserciones, lint301files/tipos/build30recursos aprobados. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar. Siguiente13a2b2 ofrece elecciones con confirmación explícita enAjustes; pilotoGoogle/RPCNext siguependiente.


## 13a2b2 — Elecciones de versión en Ajustes, 8 de octubre

- Entrada75%/40% trasbd4594e, int/secuencial/reserva10%. [Acciones](../src/features/sync/components/sync-incident-actions.tsx) habilitan adoptar remoto conocido oreenviar borrador completo solo con guardias comunes delplanner. Snapshot incorpora bloqueo deintenciones relacionadas fuera del elemento yUI noofrece acciones enesos casos; executor sigue revalidando toda cola dentro detransacción. Schema defaultfalse mantienelectura de registros previos. Rechazos/series/sinremoto/envíos inciertos siguen sololectura; tombstone únicamenteadopción, nieresurrección.
- [Confirmación](../src/features/sync/components/sync-incident-resolution-dialog.tsx) reutiliza diálogo genérico (tono primary opcional, dangerdefaultpreservado), muestra versión exacta congelada/cantidad deintenciones sustituidas/historial conservado ypending hasta confirmaciónreal. UUID/timestamp se preservan parareintento delmismo diálogo. Cancelar no escribe; ediciónposterior falla yrequiere revisar. Trascommit renueva caches propias poruser/epoch, error decaché no convierte decisión guardada enfracaso. Ningún nuevo destino; navegación compartida sigue Ajustes.
- Tres tests nuevos de disponibilidad/blockedchains/SSR; normal200pass/30opt-in skip/0fail/4597aserciones, lint304files sinavisos/tipos/build30recursos aprobados. [FixtureUI](../test/browser/sync-incident-ui.tsx) comprueba cancelar sin cambios, edición real deotra [pestaña ficticia](../test/browser/sync-incident-edit.ts) mientras diálogoabierto provoca rechazo, preview congeladoconservado; refrescar comparación incluye tercer cambio ypermite reenviar con3superseded/1pending, sinACK; recarga mantiene estado. Otra ejecuciónadopta remoto con2superseded/0pending. Móvil390×844 sinoverflow, diálogo358px/controles48px; particiones/control/tabs/servidor propios limpiados yviewportreset.
- Nueve escenarios reales dosdispositivos/Mongo repetidos tras compartir guardias, runnerexit0 yrecursos propios limpios. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar. Próxima13a2c1 flujo de copia explícita para borrador conservado frente a tombstone remoto, sin reutilizar identidadborrada. PilotoGoogle/RPCNext genuino siguependiente yno se tocóDBproducto.


## 13a2c1 — Copia explícita de borrador ante remoto borrado, 8 de octubre

- Entrada63%/38% tras00043bd, int/secuencial/reserva10%. Contrato copy_local requiere nuevoitemId/operationId/resolutionId distintos, frente a conflicto propio simple conremoto tombstone/localvivo ysin envíos/externos. Planner prepara createbase0 concontenido completo delborrador yproyección original=tombstone, sinresucitar identidad. Estado/checklist/fecha copiados; preferencias/categoría/orden no pertenecen aeste contrato yno se duplican.
- Record.copy separado, defaultsnull enrequest.copyItemId/record.copy permiten leer evidenciaprevia. Schema asegura correspondencia choice/copia/createUUID. Identidades nuevas no coinciden entre ellas/conroot/conoriginales; localborrado oremotovivo impiden copia. Executor aúnrechaza copy antesdetransacción yUI noofrecebotón: solo contrato purohasta13a2c2. Fixturedevicerequest añade nullable decompatibilidad, sin nuevas escenas aún.
- Tres tests nuevos: payload/checklist/copyrevision0 yoriginal tombstone/inputintacto, rechazo identidad reutilizada/incorrectostates, compatibilidad legacy/defaults. Normal203pass/30opt-in skip/0fail/4618aserciones; lint304files/tipos/build30recursos aprobados. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar. Próximo13a2c2 persistencia atómica de ambos elementos/cola/evidencia yconvergencia realantesdebotón.


## 13a2c2 — Copia atómica probada entre dispositivos, 8 de octubre

- Entrada59%/37% tras03873ae, int/secuencial/reserva10%. Executor valida copyID sin reutilización de item, tombstone ni historial local; añade copia concreate/base0, conserva original remoto borrado, supersede originales y registra replacement/secuencia/decisión juntos. EntityKey corresponde a nueva identidad. Replay devuelve decisión sin reescribir una copia posteriormente editada.
- Fixture IndexedDB: colisión conserva todos los stores; fallo tardío de metadata.add revierte ambos elementos, cola, secuencia y evidencia. Copia conestado/checklist/fecha ypending sin ACK, replay tras editar estado no cambia datos. Nueve checks+recarga aprobados y partición propia limpiada.
- Fixture integrada amplía a diez escenarios reales: borrar en segundo dispositivo y editar en primero genera conflicto, copia explícita, respuesta perdida, replay/recarga y ACK auténtico. Ambos dispositivos convergen en proyecciones/cursors y sin cola activa; original tombstone revision2 intacto y copia nueva revision1 única. Runnerexit0 y container/storage/proxy/servidores/tabs propios limpios, consultaDockerlabelvacía. No DB de producto ni Google/RPCNext reales.
- Normal203pass/30opt-in skip/0fail/4618aserciones; lint304files sinavisos/tipos/build30recursos aprobados. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar. Próxima13a2c3 ofrece opción explícita de copia mediante confirmación compacta; preferencias y categorías no se copian.


## 13a2c3 — Copia explícita en Ajustes, 8 de octubre

- Entrada53%/36% tras29d0377, int/secuencial/reserva10%. Disponibilidad comparte guardias delplanner yofrececopy solo cuando localvivo/remotoborrado; localausente/borrado únicamenteadopción. Nuevos itemId/operationId/timestamp quedancongelados en misma solicitud deconfirmación parareintento. Sin nueva pantalla nidestino denavegación.
- Confirmación reutilizada muestra contenido completo/cadena sustituidayhistorial conservado. Explica original sigue eliminado, copia independiente sin categoría/orden y pendientehasta confirmación real. Dos tests nuevos guardias/SSR, normal205pass/30opt-in skip/0fail/4628aserciones; lint304files sinavisos/tipos/build30recursos aprobados.
- FixtureReact+IndexedDB móvil390×844: botónúnicamentecopy/adopt, cancelar colaexactaintacta, confirmar yrecargar; proyección originaltombstone/copiarev0/checklist/estado/fecha, nuevaentrycreatebase0/entityKeypropia, dosSuperseded/1pending/sinACK. Dialog358px/buttons48px sin overflow; todos recursosown limpiados/viewportrestaurado. Convergenciareal ya comprobada13a2c2 yexecutor no cambió enestecorte. PilotoGoogle/RPCNext siguependiente. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar; próxima13b1 recuperación ycompatibilidad.


## 13b1a — Recuperar sesión y cierre durante envío, 8 de octubre

- Entrada50%/36% tras76caaff, int/secuencial/reserva10%. 13b1a: doce escenarios reales dos dispositivos/IndexedDB/Mongo aprueban sesiónausente(no claim), sesióncaducada alpush(release sinACK yUUID/payload intacto), cierre después decommitremoto(release pending) yleaseexpirada durable/recarga/replay único. Ambosdispositivos/cursors convergen conMongo, revisiones1 sin duplicados; normal205pass/30skip/4628aserciones/lint304files/tipos/build30recursos. Auth simulado soloenfixture; Google/RPCNext siguepiloto. Cleanup ownrunnerexit0. Próxima13b1b compatibilidad deprotocolo.
- Tests ejecutan runtime real y transporte normal; fixture intercepta únicamente identidad401/pushunauthorized para caducidad yllama close tras respuesta delcommit. El runnerusaMongoaislado conownershiplabel/digestpin, limpia proxies/contenedor/tmpfs/particiones propias yexit0. Ningún cambio auth oDBproducto. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13b1b1 — Pausa por protocolo incompatible, 8 de octubre

- Entrada46%/35% tras23ecadd, int/secuencial/reserva10%. 13b1b1: identidad/pull anuncian rango min/max por x-dalis-sync-protocol sin modificar bodyidentity existente. Nuevo cliente exige header válido <=128bytes con rango quecontieneprotocol1; ausencia/corrupto/incompatible pausa update_required antesdeleerbody/claim/cursor. Schedulerpausa yUI indica cerrar/reabrir conconexión, pendientes conservados; sinreloadautomático. Rango estricto Zod1..1000000/min<=max; noPII. Clientesanteriores sinhandshake noobtienenprotección retroactiva. 209pass/30skip/4670aserciones/lint310files/tipos/build30recursos y12escenariosMongoaprobados; ownresourceslimpios. Próxima13b1b2 guarda incompatibilidad enpush yprueba mixeddeployment.
- Cuatro tests nuevos rango/header/responsebody/UI, escenarios coordinador/scheduler actualizados para pausa. Headeridentity preserva preparaciónGoogle conbody estricto anterior; auth401 clasificada antes decompatibilidad. GuíaNext route instalada leída; app conserva routing yfeaturecontiene response. Ningún cambio DB/worker/auth. Raceposterior alhandshake requiere13b1b2, yno atribuir protección aningúnbundle anterior quecarece delcódigo. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13b1b2 — Incompatibilidad durante envío, 8 de octubre

- Entrada43%/35% tras6492a2b, int/secuencial/reserva10%. 13b1b2: envelope Zodacotado/estricto verifica identidad/versión/duplicados/payloadsize antes deejecutar, batch conversiónfutura devuelupdate_required sinprefijoaplicado; auth/cuenta precedenexecutor. Coordinador libera lease yconservaUUID/payloadsinACK. TreceescenariosMongo: missing/future/futurepull conservan snapshotexacto; futurepush deja pending/lease0/attempt1; reload compatibleconverge una revisión1 enambosdispositivos. 211pass/30skip/4685aserciones/lint310files/tipos/build30recursos, ownrunnerexit0/cleanup. Próxima13b2a comprobaciónactualización segura.
- Dos tests nuevos servergate/lease yfixture13incluye protocolomixed. Límites debatch512KiB/50/UUIDunicos, protocolpositivoacotado ycomandoobjeto incluso futuro. Protocol1 aún exige contrato completo compartido; comandosfuturos protocol1 soninvalid_batch. Auth simulada/HTTPfixture no sonGoogle/RPCNext real. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13b2a — Actualización segura y datos preservados, 8 de octubre

- Entrada40%/34% tras8aabe3d, int/secuencial/reserva10%. 13b2a: Ajustes ofreceComprobaractualización anteupdate_required, registroexistente/online ywaiting/installing/current/offline/unavailable, sinregister/skipWaiting/reload. Observador conecta instalaciónyaencurso ydisposequitalisteners; avisoesperacompacto. 214pass/30skip/4702aserciones/lint314files/tipos/build30recursos. FixtureReact/IndexedDB/workerdeproductoreal con2versionesownloopback: v1activo/v2waiting mantienedatos/colaexactos, cerrar/reabriractivav2yconservaUUID/payload/estado, cleanupownreg/caches/partición/baseline. Móvil390sin overflow/checkbutton44px. Próxima13c1a backupcontractportable; import/exportUIposteriores. Google/RPCNextrequierepiloto.
- Tres tests helpers/dispose/installationrace, UIreuse deOfflineUpdateCheck enpanel existente; no pantalla nueva. Worker deproducto compilado conassetsneutros propios yversionesUUIDfixture. Dos ejecuciones IO; segunda guarda baselineownparaassertcolaexacta entrecierres. Preparaciónworker/statuscompleto ycacheactivation real sinforzar. Limpieza propia verificada, servidores/tabs cerrados/viewportreset. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13c1a — Contrato portable de backup, 8 de octubre

- Entrada33%/33% tras151ea64, int/secuencial/reserva10%. 13c1a: backup estricto completo de11stores, cuentaspropias ymetadata validada, tombstones/leases/outcomes/resolutions/Superseded intactos, clavesúnicas/sequence/dependencias/counter/evidencia. UTF8<=16MiB/records<=10000, nofiltrar registros/secretos/control de cuenta. Tres tests roundtrip/invalidactor/version/duplicates/historicalmissing/size/unknownmetadata; 217pass/30skip/4727aserciones, lint318files/tipos/build30recursos aprobados. Contrato puro, noDB/UI/importación; próxima13c1b snapshotreadonly. Backupnoautoriza ni restauraACK/leases/cursors, compartidos/versionesfuturas requierennuevocontrato.
- Lease.ownerId es sendernonce yse conserva sinconfundirconowner de datos; ownership valida records/metadata/resultado/decisión/cuenta. JSON es evidencia validada pero nofirmada, no concede permisos remotos. Diseño enbackup-recovery; wrapper snapshot/exportUI posteriores. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13c1b — Snapshot readonly para backup, 8 de octubre

- Entrada25%/32% trasf83158b, int/secuencial/reserva10%. 13c1b: lector getAlllimit10001 de11stores enmisma txreadonly, ownershippartición/DBversion/fecha/byteguard sintruncate, wrapperactor/epochantesdespués yclosefinally. IndexedDB4checks+reload: snapshot completo/colaexacta/tombstone/preferencias/roundtrip, snapshotprecedewritecoherente, unknownmetadatarechaza sin cambios, wrongpartition/epoch yepochcambiada durantelectura noentregadatos/closeexacto. Owncleanupnormal217pass/30skip/4727aserciones/lint321files/tipos/build30recursos. Próxima13c1cdescargaUI si margen, importación siguependiente.
- Wrapper cierra todas sus conexiones incluso cambio deépoca inducido después de snapshot. Exportcontiene evidencia ypendientes, noescribe ni restaura ningunregistro. Fixtureloopback ypartitionUUID propia concontrolnull/own, baselineporrunID para recarga ycleanupverificados. NoMongoauthniDBproducto. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13c1c — Descargar backup sin conexión, 8 de octubre

- Entrada22%/31% tras6f83498, int/secuencial/reserva10%. 13c1c: secciónplegablecompactaCopia de seguridad enAjustes, downloadsolo tras snapshotvalidado yguardiaactual, JSONBlob/filenamefecha sincuenta yURLrevocable/linkremovido. Mensajehonestodescargasolicitada, importacióntodavíano disponible; sinfetch/ACK/escrituras. FixtureUIreal390 confetchbloqueado validaBlob11stores/colaexacta, epochcambiado error sinsegundaBlob, recursospropios limpios yviewportreset; botón44px/sin overflow. Normal217pass/30skip/4727aserciones/lint325files/tipos/build30recursos aprobados. Próxima13c2apreviewpuro deimportación si margen; ejecutor/importUI posteriores.
- Cuenta preparada única, keyporépoca para desmontar accionesprevias, filenameUTCfecha sinPII. No afirmar queel navegador guardóarchivo; sólo se solicita trasvalidación. Fixtureinstrumenta Blob/anchor ynoautorizaotrosdestinos. Snapshot/codificadores probadospreviamente, suite/build finalpassed despuésdecorregir firmaBunfetch defixture. Referencias/diff ycommit/pushint/HEAD/cuotas alcerrar.


## 13c1d — Evidencias de backup y cierre del lote, 8 de octubre

- Entrada16%/30% trase4abc42, int/secuencial/reserva10%. 13c1d: outcome.local/base/current/applieditem deben coincidirconcommand.itemId; replacement exacto contra operaciónpreservada, sinaceptarevidenciamanipulada. Dos tests identity/payload/actornested/counter/shadowduplicado; 219pass/30skip/4734aserciones/lint325files/tipos/build30recursos aprobados. Fixture usa operaciónclonada separada de decisiónpara quealterar una pruebe realmenterechazo. Sin nuevaUI/IO/migración. Código cerrado, próxima13c2apreviewimportación.
- Lectura previa cierre13%/30%; se cierra esta iteración y el lote. AutomatizaciónPAUSED yno nueva cadena. Referencias/diff/commit/pushint/HEAD/cuotasalcierre; siguiente13c2a requiere nuevaautorización/margen.


### Cierre de la segunda continuación, 8 de octubre, 05:18

El lote autorizado partió de la renovación real con 100%/43% y reinicio 1791447514. Se entrega hasta 13c1d: lectura y comparación de incidentes; supersesión local diferenciada de ACK y elecciones explícitas de adopción, reintento o copia; pruebas de dos dispositivos con MongoDB; recuperación de sesión, cierre y leases; compatibilidad de protocolo; actualización del worker; backup portable, lectura coherente y descarga offline. Cada iteración tiene commit y push en int, con HEAD remoto verificado. Se preservaron cambios ajenos y no se tocó la DB, los secretos o la configuración de producción.

La lectura previa al cierre es 13%/30%, con reserva del 10% en ambas ventanas. Tres puntos no cubren la siguiente implementación con pruebas, reparaciones y cierre. Los últimos cortes consumieron tres puntos para el snapshot, seis para la descarga y tres para las guardias mínimas; el contrato anterior consumió ocho con reparaciones. Las lecturas pueden incluir otros chats y no garantizan costes futuros. El repo queda coherente y sin código abierto.

La automatización puntual continuar-sincronizaci-n-siguiente-ventana queda PAUSED. La autorización cubría esta última revisión; no se crea otra cadena ni se usan créditos o reinicios.

La siguiente candidata es 13c2a: preview puro de un archivo validado y del snapshot propio actual, sin escribir ni enviar. Clasificará contenido nuevo, idéntico, cambiado, tombstones y tipos sin ejecutor, conservando los datos no admitidos. El contrato y ejecutor de importación vendrán después, con UUID nuevos y confirmación sólo tras pruebas. Nunca restaurar directamente ACK, cursores, leases, revisiones remotas o permisos.

El piloto de Google y RPC de Next real sigue pendiente. Preferencias, series, cumpleaños y compartidos todavía no se sincronizan. Rechazos sin acceso y cadenas externas permanecen conservados. Reanudar exige nueva autorización y ambas cuotas; vuelve el protocolo normal de consulta tras cada iteración salvo otro lote explícito.


## Intercalada 13b2b: cookies de acceso en preproducción protegida

El 8 de octubre el usuario autoriza un intento mínimo con aproximadamente 8% de la ventana de 5h, consumiendo la reserva exclusivamente para esta corrección. Trabajo secuencial en `int`; no encadenar implementación al cerrar.

- Objetivo: preparar recursos offline en un preview protegido sin omitir su cookie de acceso del mismo origen.
- `target_paths`: `src/lib/pwa/service-worker.ts`, `src/lib/pwa/service-worker.test.ts`, `plan/{master,workflow,iterations,iteration-log}.md`.
- Dependencias: worker existente, shell `/workspace` neutro y documentación instalada de Next sobre PWA; no cambios en hosting, permisos, secretos, DB o dependencias.
- Aceptación: solicitudes de precache con `credentials: "same-origin"`; mantener rechazo de respuestas redirigidas, URL inesperada y shell sin marcador neutro, y eliminación de caché fallida. APIs, autenticación y contenido personalizado siguen fuera del precache.
- Validación: worker de producto compilado y ejecutado en sandbox de pruebas con gate de autenticación simulado; tres pruebas cubren opciones de cada recurso, redirección SSO y HTML sin marcador. El simulador representa explícitamente opciones del navegador porque Bun normaliza `same-origin` a `include`. Suite 222 pass / 30 opt-in skip / 0 fail, 4749 aserciones; lint 326 archivos y tipos aprobados. Build aprobado: `/workspace` estático y worker preparado con 30 recursos neutros; diff y rutas comprobados para el cierre.
- Límite: no se ha reproducido el acceso SSO en el dominio real de Vercel; el usuario debe recargar el preview publicado y verificar preparación. No borrar IndexedDB ni trabajo local. La siguiente candidata de producto continúa siendo `13c2a`; piloto real Google/RPC Next pendiente.


## 13c2a — Vista previa pura de importación

Entrada: 100% de 5h y 29% de 7d, `int` limpio desde `cde71b3`. El usuario autoriza commit/push, consulta automática de cuotas y siguiente corte si hay margen; trabajo secuencial y reserva del 10%. Rutas: `src/lib/backup/import-preview{,.test}.ts`, `src/types/backup-import.ts` y documentación relacionada.


### Resultado 13c2a

La vista previa pura valida el archivo y el snapshot actual completos para la cuenta activa; clasifica registros por identidad en los once stores sin IO, nuevas operaciones ni restauración de ACK, cursores, leases o permisos. Conserva contenido e historia en objetos independientes. Los tipos sin ejecutor quedan explícitos; igualdad exacta incluye metadatos y no establece precedencia remota. Se indexa cada store con Map y se ordena por clave: O(n log n) por ordenación, sin búsquedas cuadráticas ni mezcla por títulos. Cuatro pruebas/55 aserciones cubren stores, independencia, cambios, tombstones, orden determinista, tipos incompatibles y rechazo íntegro. Suite 226 pass / 30 opt-in skip / 0 fail / 4804 aserciones, lint 329 archivos, tipos y build de 30 recursos neutros aprobados. Próximo corte `13c2b`: contrato puro de selecciones e intenciones nuevas antes de ejecutor o UI.

El usuario confirma que `13b2b` funciona en preproducción. La comprobación del navegador aislado termina en login de Vercel; falta sesión y cuenta de piloto, por lo que no se declara probado Google/RPC Next real ni convergencia en preproducción. No se modifica la DB del usuario.


### Resultado 13c2b

Contrato puro de selecciones e intenciones nuevas entregado. Cada copia es una tarea/evento propio vivo sin repetición, con UUID nuevo distinto del archivo, dispositivo e historia, operación nueva y base/revisión0. No modifica originales ni restaura permisos/preferencias/ACK/cursor/leases. Snapshot esperado validado e igualdad exacta de stores; exportedAt no determina antigüedad y puede variar al leer. Se conserva el JSON original literal y el snapshot revisado como evidencia del plan. Progreso/checklist copiados; fecha de finalización de una copia completada se establece en la nueva creación, conservando original en el archivo. Entre1–50 selecciones distintas y512KiB de intenciones, sin IO ni UI de confirmación.

Cinco pruebas/41 aserciones y suite231pass/30opt-in skip/0fail/4845aserciones; lint332archivos, tipos ybuild30recursos aprobados. Se corrigió la fixture del límite de bytes para exceder realmente512KiB con UTF8 multibyte; no se relajó el límite. Próxima `13c2c1`: recibo durable de importación compatible con backup, sin ejecutar todavía; después ejecutor atómico, replay/rollback/recarga y UI.


### Resultado 13c2c1

Registro local `backup-import:<UUID>` añadido al contrato de metadata existente, sin tabla nueva ni migración. Conserva cuenta/fecha/archivo original y selecciones ligadas al payload exacto de las operaciones preservadas; no concede ACK ni permisos. Archivo archivado acotado y validado estructuralmente, ownership completo, identidad de fuentes única y selección de contenido vivo simple, batch512KiB, payload/fecha idénticos al historial. Archivos dentro de archivos históricos se preservan como evidencia opaca, sin recursión ni restauración. Formato portable1 mantiene rechazo íntegro de metadata desconocida en lectores antiguos.

Ownership extraído a helper único compartido para evitar duplicar su validación. Tres pruebas/14 aserciones y regresión234pass/30opt-in skip/0fail/4859aserciones, lint336archivos, tipos/build30recursos aprobados. Aún no se escribe ningún recibo ni se ofrece importación UI. Próxima `13c2c2`: crear items/outbox/contador/recibo en una transacción propia, rechazo stale, rollback y replay tras recarga sin sobrescribir ediciones posteriores.


### Resultado 13c2c2

Importador client-only guarda nuevas copias, intenciones pending, contador y recibo en una sola transacción de los once stores. El lector de snapshot acotado se comparte con exportación y se invoca dentro de la misma transacción; valida partición, versión y post-state portable completo antes de escribir. Conserva originales, preferencias y cola existente; add/contador seguros y resultado únicamente tras complete. Notificación postcommit no invalida guardado. Recibo exacto permite replay sin exigir el snapshot antiguo vigente y sin reescribir copias editadas; misma importId con archivo/selección/fecha distintos rechaza.

Fixture propia de loopback4188 e IndexedDB real: seis checks de multicopia/preservación, replay/progreso, reutilización/stale/collision, cuenta/partición, fallo tardío con rollback y concurrencia una sola copia. Séptimo check tras recarga verifica snapshot/cola/recibo exactos y replay sin escrituras. Se corrigió la fixture porque getAll de outbox está ordenado por UUID, no por secuencia; ahora encuentra por identidad y ordena secuencias explícitamente. Ambas ejecuciones limpiaron exclusivamente particiones UUID propias; pestaña y servidor cerrados.

Normal234pass/30opt-in skip/0fail/4859aserciones, lint339archivos, tipos ybuild30recursos aprobados; sin DB remota ni falsa declaración de ACK/convergencia nueva. Próxima `13c2c3`: guardias de cuenta/época y preparación de confirmación a nivel workspace, luego UI compacta y prueba de envío de copias con dos dispositivos/Mongo aislado.


### Resultado 13c2c3

Servicios client-only de workspace entregados: lectura/comparación readonly, preparación con UUID/fecha generados una vez y commit del plan estable. Capturan cuenta/época e inputs antes de awaits, validan snapshot actual, verifican cuenta antes/después y de nuevo tras abrir importer, y cierran conexiones en finally. Si la cuenta cambia tras commit, no exponen éxito a otra cuenta ni deshacen copias propias; el recibo permite replay desde su cuenta.

Fixture IndexedDB real alcanza diez checks y uno tras recarga: preparación readonly, época invalidada durante apertura, caller mutando identidad/plan durante awaits, cambio tras commit con copia conservada/replay exacto, además de los checks anteriores. Cleanup valida control de cuenta propio/nulo antes de borrar exclusivamente sus particiones y control en loopback4188; pestaña/servidor cerrados. Suite234pass/30opt-in skip/0fail/4859aserciones, lint340archivos, tipos/build30recursos aprobados. Próxima `13c2d1`: selección y confirmación UI compactas en Ajustes; sincronización de copias con dos dispositivos/Mongo aislado en corte posterior.


### Resultado13c2d1 — UI de importación y convergencia de copias

Ajustes ofreceImportar JSON enCopia de seguridad. Diálogo cargado bajo demanda con archivo propio<=16MiB, selección vacía por defecto, máximo50 y páginas de20 filas; tipos no admitidos/borrados no seleccionables. Clasificación visible y contenido/comparación plegables, confirmación explícita de copias nuevas, UUID/plan estables, guardia síncrona contra doble envío y revalidación solo de caches propias. Fallo de refresco posterior no niega guardado; error incierto conserva plan para replay sin duplicación. Sin nueva pantalla ni cambio de navegación. Labels españolas, incluso selector visual de archivo; fila52px y controles44px, sin overflow en390px.

Fixture React/IndexedDB offline en4189 comprueba JSON inválido/ajeno, selección inicialmente vacía, preview/selección/cancelación sin escrituras, contenido comparado, cambio del original antes de confirmar con rechazo íntegro y nueva comparación, doble pulsación con una sola copia, progreso/checklist/archivo literal/cola pending/original conservados. Fixture definitiva parte de control vacío, no adopta cuentas ajenas; partición UUID/control propios, pestañas y servidor limpios. Durante desarrollo se reutilizó únicamente la partición que esta misma ejecución había creado, para limpiar tras reiniciar la fixture; ese mecanismo no forma parte del código final. Regresión SSR acota20 filas y deshabilita tombstones.

El agente con rutas disjuntas amplía únicamente sync-devices.ts:14 escenarios reales entre dos orígenes yMongoDB aislado pasan. Backup capturado enrev3 conACK/shadow/cursor históricos; después originalrev5 tombstone. Importación preserva los once stores existentes salvo copia/cola/counter/recibo. Copia base0 pending obtieneACK real/rev1 y converge; pérdida de respuesta+recarga+replay no duplica, progreso posterior converge enrev2 y nuevo replay no sobrescribe. Tombstone yarchivo/recibo exactos. Runnerexit0, contenedor/tmpfs/particiones propios limpios; Google/RPCNext real sigue pendiente y no se tocóDB del usuario.

Suite235pass/30opt-in skip/0fail/4865aserciones; lint347archivos, tipos/build34recursos neutros ydiff-check aprobados. Se corrigió la versión deDB de la fixture SSR para ajustarla al contrato2, sin cambiarlo. Las pruebas paralelas permiten incorporar la evidencia remota en este mismo corte; no queda un13c2d2 de convergencia abierto. Próxima candidata11c0: diseñar cortes de sincronización de preferencias personales/categorías/orden usando comandos locales existentes, compatibilidad explícita y conservación de pendientes antes de ampliar el ejecutor.


### Resultado11c0

Diseño de preferencias personales basado en comandos/reductores/cola/wire reales, con referencias a fuente y secuencia enpreference-sync.md. El explorador de solo lectura confirma base por documento, tail personal/dependencias de contenido, replay, ranks numéricos, sentinel atrasadas, efectos multirregistro de compactación y vista de serie, y ausencia de productor settings. Root revisa journal/cursor/receipts/protocol. No se activan comandos ni cambia transporte1, ni se ejecutan índices/migraciones.

Transición propuesta wire2/intención1 requiere nuevas pruebas, adapters históricos, ACK/pull/backup compatibles y rechazo de bundles mixtos antes de avanzar cursores. No reescribir payloads/fingerprints1, inventar timestamps de movimientos overnight ni dar ACK para desbloquear pendientes. Cortes acotados definidos; siguiente11c1a DTO puro de efectos dispersos propios con claves/bytes/revisiones/duplicados. Documentación validada por referencias/consistencia/diff; código sin cambios, build anterior vigente.


### Resultado11c1a — Efectos personales validados

DTO preparatorio versión1 para efectos dispersos en tags/itemViews/taskPlacements/settings; reutiliza schemas de dominio con revisión remota positiva, actor/operationUUID/sequence válidos. Clave documental JSON incluye store, userId eidentidad original (placement incluye referencia/scope/date, no tagId). Identidades únicas, settings único, referencias de tarea/aparición y sentinel overdue canónicos. Propiedad uniforme y esperado actor, registros completos/tombstones, salida clonada; hasta10000 registros y512KiB UTF8 de DTO validado, rechazo íntegro sin truncado. Settings representa evolución posterior, no añade productor.

Cuatro pruebas/39aserciones cubren oráculo de claves, IDs iguales entrestores/cuentas, misma colocación cambiando tagId, fechas distintas, tombstones/independencia, cuenta ajena, revisiones0, referencia/sentinel inválidos, normalización, futuro/campos extra/conteo y byteguard Unicode. Se ajustó el tamaño de la fixture para demostrar caracteres por debajo de512KiB pero bytes por encima, sin relajar límite. Suite239pass/30opt-in skip/0fail/4904aserciones; lint351archivos, tipos ybuild34recursos aprobados. Sin framework/IO/env/driver, índices, ACK, writes o cambio de protocolo activo.

Siguiente11c1b1: extraer el reductor personal existente a módulo puro compartido, equivalencia local y sin activar envío; después11c1b2 añade planning remoto/CAS/efectos completos. Mantener payloads ybase locales, historia ytipos no soportados.


### Resultado11c1b1 — Transformaciones personales compartidas

Funciones de categorías/vistas/ranking extraídas al módulo puro lib/preferences/preference-command, sin directiva de cliente ni IO/driver/framework. El adapter client-only local reexporta aliases de la API existente; todos los consumidores siguen usando exactamente esas transformaciones. Comparación textual contraHEAD anterior verifica igualdad completa salvo directiva y nombres genéricos. Revisión local, payload/errores/fechas/tombstones mantienen semántica.

Regresión nueva fuerza compactación sin posición representable: devuelve tres categorías afectadas, orden esperado y posiciones-1024/0/1024, campos/revisiones/entrada/tombstone preservados. Tests existentes de preferencias/day/overdue/rank reutilizan adapter;240pass/30opt-in skip/0fail/4915aserciones, lint352archivos, tipos/build34recursos ydiff-check aprobados. NoCAS/envío/ACK nuevo. Próxima11c1b2a planning remoto puro de familia tag.save/delete/move y efectos completos; item-view ytask.move siguen después según dependencias.


### Resultado11c1b2a — Planning de categorías remotas

Familia tag.save/delete/move convertida porplanner puro a changes/conflict/unavailable/invalid_command/unsupported, sinapplied/ACK niIO. Snapshot remoto propio valida IDs/nombres activos únicos yrevisiones positivas, actor/fecha/operaciónv1; cuenta corrupta falla antes deproducirplan. CAS porcategoríaobjetivo ybase0 solocreación, tombstone devuelvesu conflicto sinrestauración. Reutiliza transformaciones compartidas, conserva createdAt/campos yeleva cada revisión afectada desde su propio valor; overflowfalla íntegramente.

Movimientos devuelven todos los efectos decompactación; vecinos obsoletos ycolisiones NFKC produceninvalid_command sin cambios. Borrado mantiene tombstone yno toca referencias personales. DTO deefectos sevalida reservando el tamaño deMAX_SAFE_INTEGER de secuencia; no se asigna un número dejournal ni se declara recibo. Límite512KiB rechaza uncompactado grande sin truncarlo.

Seis pruebas/39aserciones yregresión246pass/30opt-in skip/0fail/4954aserciones; lint356archivos, tipos/build34recursos/diff-check aprobados. Fuente yentrada independientes, conflicto clonado, cuentas/futuro/normalización/bases/overflow/compactación comprobados. Próxima11c1b2b: planner puro deitem-view.set para elementos propios simples, conservación decontenido yCAS propio; series/movimientos/settings requieren sus cortes posteriores. DB yprotocolo todavía sin ampliación.


### Resultado11c1b2b — Planning de vista personal

item-view.set depropios simples convierte contexto remoto validado enefecto deúnica vista oconflicto/invalid/unavailable/unsupported. Contexto íntegro propio yreferenciascoherentes, revisiónpositiva detag/view/item, CAS debase0 nueva/actual ydeltombstone sinresurrección. Itemactivo ycategoríaactiva/null; reusa transformaciones, createdAt preservado yrevisión siguiente, límiteDTO conreservasecuencia máxima sinasignarjournal. Estado/checklist/descr./fechas delcontenido permanecen intactos; series/cumpleaños/settingsfamilia no seactivan.

Cuatropruebas/34aserciones: asignar/cambiar/quitar categoría, contextosajenos/identidadesincongruentes/base0stored/overflow, faltas/tombstones/CAS, clones ycontenido intacto, evento simple yrecurrencia/otra familiaunsupported. Se corrigió fixture derepetición al contratoend vigente; no cambio deschema. Suite250pass/30opt-in skip/0fail/4988aserciones; lint360archivos, tipos/build34recursos/diff-check aprobados.

Explorador sololectura confirma quegetDatabase/auth ejecutanINDEX_SPECS automáticamente. Próxima11c2a0 protegeíndices staged medianteprovisionamiento explícito central, antes deregistrar colecciones personales: no crear índices deproducto latenteporlogin enint. Luego11c2a1 repositorio decategorías/CAS yMongoDB propio, separado deexecutor/wire/ACK. No servicios/DB/envsecrets enesta investigación.


### Resultado11c2a0 — Provisionamiento explícito

Registro central admite índices conprovisioning=explicit. Selección automática valida catálogo completo antes de excluirlos; bootstrap/auth/script mantienen exactamente los índices vigentes. Selección explícita conserva keys/options ypermite provisionar pendientes únicamente en unentorno autorizado. Duplicados incluso entre entrada automática/pendiente, nombres vacíos ypolítica inválida fallan antes dewrites. No se registra todavía colección ni índice nuevo yno se conecta aDB real. Instrucción anidada actualizada.

Tres regresiones conDB simulada; suite253pass/30opt-in skip/0fail/4999aserciones, lint360archivos, tipos/build34recursos/diff-check aprobados. Próxima11c2a1: repositorio actor-scoped decategorías, catálogo íntegro/CAS/unicidad activa ypruebas deMongoDB propio; índices pendientes centrales, sinexecutor/wire/ACK activados.


### Resultado11c2a1 — Categorías propias en MongoDB

Repositorio server-only conactor/session/singleton; UUID compuesto porcuenta, catálogo íntegro<=10000 incl.tombstones yregistros positivos validados. Insert inicial yCAS porrevisión/createdAt/activo; identidad duplicadafalse solo fueradesession, nombre duplicado/error ensessionpropagados. Índices centrales únicos deidentidad/nombreactivo registrados explicit: login/bootstrap no activa colección pendiente. Compartidos/executor/wire/ACK noampliados. Se ajustó replaceOne aWithoutId deldriver: filtra_idcompuesto ypreserva_id omitiéndolo delreemplazo.

Worker paralelo propietario solotest/runner, rootrepo/contratos/registro/plan. MongoDB8.2.11amd64 digestfijado revalidado; runner aislado21pass/0fail/168aserciones, seis nuevas pruebas/63aserciones: mismoUUID/nombre entreactores, CASrace, tombstone/nombre reutilizable, carrera nombre activo ycolisión replace, corrupción, catálogo exacto10000/overflow10001, rollback tardío múltiple yduplicado dentro detransacción. Contenedor/tmpfs propios limpios, sinDBusuario/envsecrets/browser. Normal254pass/38opt-in skip/0fail/5000aserciones; lint362archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2a2: repositorio deitemViews propio, conCAS/identidadcompuesta ysession, pruebas aisladas yautorización decontenido enexecutor posterior. Mantener cortes separados yreserva10%, sin declarar preferencias activas.


### Resultado11c2a2 — Vistas personales en MongoDB

Repo server-only propio/session/singleton poractor+itemId, claveMongo compuesta validada yrevisiónpositiva compartida conplanner. Read incluye tombstone, insert inicial yCASrevision/createdAt/activo, duplicateidentityfalse fuera desession ypropagación dentro. CategoríaUUID/null validada; índice único userId/itemId explicit, no provisionado porbootstrap. Persistencia no concede acceso acontenido: executor posterior debe verificar item/tag vigentes enmisma transacción; no nuevoscallers/envíos/ACK activos.

Worker solointegrationtest/runner; rootrepositorio/schema/registry/plan. RunnerMongoDBpropio exit0:25pass/0fail/215aserciones en6archivos; cuatro pruebas nuevas/47aserciones deaislamiento conUUIDigual, metadata/propiedad, CAS/conservar/quitarcategoría/tombstone, corrupción yrollback múltiple/duplicado ensession. Contenedor/tmpfs propios eliminados; pinned8.2.11amd64 revalidado, noDBusuario ni secrets/hosting. Normal255pass/44opt-in skip/0fail/5002aserciones, lint364archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b0: concretar contrato deatomicidad/recibos/journal ydependencias decompatibilidad antes deimplementar ejecutor multirregistro. Preferencias aún sin sincronización activada; task.move/settings/series/compartidos posteriores.


### Resultado11c2b0 — Contrato transaccional siguiente

Documento preference-transactions.md concreta envolturas/resultados/recibos/journal versionados, adaptación readonly dehistoria item yfingerprint deintenciónv1 conservado. Comparte contador/receiptidentities vigentes, conjuntos multirregistro atómicos yautorización decontenido previa aview. Límite512KiB cubre envolturaUTF8, no solo DTO interno. Hipótesis decontador común para coherencia devecinos yviewfrente adelete queda explícitamente pendiente de prueba conbarreras/Mongo; no seintroduce lock ni seafirma garantía sinprueba.

Separa11c2b1 contrato puro,11c2b2 ejecutor/atomicidad,11c2b3 carreras con snapshots solapados, luego compatibilidad/ACK/pull/backup/dosdispositivos antes deactivar. Header depreferencias actualizado yrefs/coherencia/diff comprobados. Sin código/DB/secretos/hosting ni nuevoACK; builds/pruebas anteriores vigentes. Cierre del lote: último código d65048a comprobado, todo concommit/push. Entrada15%/15%; últimos cortes de repos consumieron7/5puntos5h, conuso compartido incierto; no iniciar otra implementación conpruebas/reparación/cierre quepueda cruzarreserva10. Reanudar desde11c2b1 conlectura vigente.


### Resultado15a0 — Preproducción autenticada

Usuario completó autenticación en pestaña integrada36 yworkspace real quedó accesible. EnAjustes, revisión automática pasa deSincronizando aÚltima revisión terminada/Sin cambios locales pendientes. Pulsación manualSincronizar ahora repite transición yrecupera botón; recarga conserva sesión, cuatroelementos existentes yestado preparado, yotra revisión automática termina. No se cambian contenidos/tareas/categorías ni se crean registros de prueba, no se accede aDBdirectamente, no se registranidentidad/tokens. Pestaña visible conservada parausuario.

Evidencia limitada: sesión real, shell/preparación yrevisión/descarga concola vacía funcionando enint protegido. Coordinador llama pull ysolo push al seleccionar intención ([coordinator.ts:105](../src/features/sync/coordinator.ts:105), [coordinator.ts:159](../src/features/sync/coordinator.ts:159)); por tanto **no demuestra ServerActionpush con escritura/ACK ni convergencia real entre dispositivos**. Piloto siguiente debe crear únicamente elementos propios identificados de prueba, comprobar ACK durable/recarga ylimpiar conborrado normal, conpresupuesto suficiente; no ampliar15a0 alestado delusuario. No pruebaoffline completo ni logout/login multicliente.

Documentación/refs/coherencia/diff aprobados; código/build anterior vigente, commitpushint ycuotas alcierre. Entrada12%/15%, solo dospuntos5h sobre reserva10: no abrirmutación ylimpieza ni repararproblemas nuevos. Próxima implementación sigue11c2b1; piloto escritura real pendiente15a1.


### Resultado15a0b — Móvil real sin mutaciones

Preproducción autenticada conviewport390x844 temporal: calendario octubre2026 muestra cuatroelementos el8oct yunevento quecontinúa el9oct. Cambiar aldía9 muestraese únicoevento ysin tareas; Hoy vuelve aldía8 yrestaura1tarea/3eventos. No nombres/identidades delusuario en registro. DOMreadonly: innerWidth390/scrollWidth390, enlacesdenavegación75x64px, Crear56x56px ycontroles mes>=48pxalto; no overflowhorizontal. Crear abre diálogoTarea/Evento, fecha9oct seleccionada; Cancelar cierra sin guardar. No acciones deprogreso/edit/delete ni nuevasoperaciones de prueba.

AvisoActualización disponible aparece trasdeployment: no se fuerza activación/skipWaiting nireinicio. Viewportrestaurado, pestaña/sesiónabiertas encalendariohoy. No pruebaRPCpush/ACK/2dispositivos nueva ni validaciónoffline adicional. Scopeextraordinario pedido con9%5h finalizado; noamplíareserva delplan permanentemente. Referencias/coherencia/diff aprobados ycommitpushint/HEAD/cuotas; códigoanterior vigente.


### Resultado15a1 — Create y delete reales

Lectura inicial real6%5h/14%7d, excepción puntual solicitada con7. Enint protegido con sesión real/navegadorintegrado: Crear desdecalendario8oct, títuloexclusivo `Codex sync pilot 15a1`, guardar tarea simple. Calendario pasa4→5elementos; Ajustes5guardados, revisiónautomática termina ycola visible sinpendientes. Recarga conserva sesión/5elementos; Mi espacio muestra la tarea exacta despuésderecarga. No seam defixture: UI/coordinador/transporte delproducto real.

Limpieza únicamente deesa tarea: abrir susdetalles, Eliminar yconfirmar diálogo normal. Elemento desaparece, Ajustes vuelve4guardados; se observa1pendiente→Sin cambios locales pendientes/Última revisión terminada. Captura visual delestado limpio/revisado tomada; pestaña/sesión abierta enAjustes. Cuatroelementosprevios conservados, sin editar/progreso/categorías delusuario ni accesodirectoDB/tokens/secrets. El borrado conserva tombstone/historia normal: no purge. Aviso deactualización disponible permanece sin forzarworker/reinicio.

La evidencia deUI confirma recorrido real deescritura+envío/revisión yborrado confirmado porelproducto, conpersistencia trasrecarga. ACK se infiere del estado durablevisible sinpendientes; no se inspeccionó reciboMongo/registroACK directamente. No demuestra convergencia dedosdispositivos reales, pérdida derespuesta o conflictos; evidenciaaislada previa sigue separada. Piloto multicliente15a2 pendiente ycontratos11c2b1 siguientes conpresupuesto nuevo.

Validación documental coherencia/diff ycommitpushint/HEAD/cuotas; código/build previo vigente. Excepción deesta petición finalizada, sin abrir reparaciones ni ampliarla indefinidamente.


### Resultado 11c2b1a — Resultados versionados

Envoltura pura kind=item/preference con outcome discriminado; item reutiliza schema vigente, personal applied contiene DTO completo y exige misma operationId, conflict conserva un efecto positivo/tombstone sin sequence. Errores estrictos no conceden ownership ni ACK. Verificador exige expectedUserId válido y compara propietario de todo resultado con datos. Decoder reconoce variante nueva o legacy estricto, adapta legacy solo en memoria y devuelve clones; no modifica intención/fingerprint/historia, wire activo, DB o localACK.

Guard512KiB UTF8 de envoltura completa. Cuatro pruebas/53aserciones: seis estados item/legacy, personales, conflictos/tombstones, cuenta/identidad/sequence/extra/futuro/ambiguo, independencia y DTO interno válido que excede límite al envolverlo. Se corrigieron literales TS de fixtures sin cambiar contrato. Normal259pass/44opt-in skip/0fail/5055aserciones; lint368archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2b1b: recibo explícito versión2, actor/op/fingerprint/resultado/fecha coherentes, decode legacy readonly y guard de recibo completo, sin activar writes. Después11c2b1c journal. Con cuotas compartidas, elegir por consumo observado de ambas ventanas, no equivalencia entre sus porcentajes.


### Resultado 11c2b1b — Recibos versionados

Schema puro recibo explícito versión2 reutiliza resultados item/preference; identidad de operación coincide outcome, actor coincide propietario de resultado con datos y expectedUserId externo incluso en errores sin contenido. Propietario extraído mediante helper único compartido por resultado/recibo. Digest64hex y fecha se preservan: decoder legacy readonly conserva payload y devuelve clones, no verifica commit remoto/digest/acceso actual ni concede ACK al importar archivo. Guard512KiBUTF8 cubre recibo completo además del resultado.

Tres pruebas/39aserciones cubren seis resultados legacy y personal, clones, errores/tombstone/conflict, cuenta/ID/digest/fecha/versión/extras/ambigüedad; resultado válido que excede límite al añadir metadata rechazado. Aviso opcional-chain yformato deguardia defixture corregidos, lint sin ruido. Suite262pass/44opt-in skip/0fail/5094aserciones; lint372archivos, tipos/build34recursos/diff-check aprobados. No wire/IO/DB ni escritores activos ampliados.

Siguiente11c2b1c: journal versionado/discriminado, adaptación legacy sin huecos ni reescrituras, validación recipient/op/sequence/efectos y envoltura completa; luego ejecutor atomicidad con pruebasMongo propio antes deactivar.


### Resultado 11c2b1c — Journal versionado

Schema puro versión2 discriminado item/preference conserva recipientUserId/operationId/sequence en raíz paraqueries/índices vigentes; variante item reutiliza schema actual/refinamiento deowner. Personal exige mismo actor/operationId/sequence en DTO interno y conserva multirregistro/tombstones en una entrada. Verificador externo valida actor esperado; decoder adapta legacy sólo en memoria, con clones ysin filtrado/reindexación/checkpoint. Guard512KiB UTF8 incluye envoltura completa.

Tres pruebas/27aserciones: historial mixto secuencias1/2 ytopkeys intactos, dos efectos/un tombstone, independencia, IDs/owners/sequence/extra/ambiguo/futuro, DTO válido cuyojournal excede porenvoltura. Suite265pass/44opt-in skip/0fail/5121aserciones; lint376archivos, tipos/build34recursos/diff-check aprobados. No DB/IO/escritor/ruta/wire/ACK/pull activo nuevo; adaptación individual no implementa paginación ni garantiza convergencia por sí sola.

11c2b1a–c completan contratos preparatorios separados deactivación. Siguiente11c2b2: ejecutar conjuntos deefectos, contador/journal/recibo conmisma sesión yautorización vigente, replay/CAS/fallos tardíos conMongo propio; dividir antes deabrir segúncuota yconservarreserva10.


### Resultado 11c2b2a — Lectura común de recibos

Función server-only poractor+operationId validados, colección vigente/singleton yClientSession opcional. Quita únicamente_id yreutiliza decoder legacy/v2, valida coherencia ydevuelve clones/null sin IOextra/escrituras. Consulta ya cubierta por índice único actorUserId/operationId vigente; no requiere índice nuevo yno activa colecciones personales. No callers productivos nuevos ni cambio deejecutor/wire/ACK.

MongoDB propio runner28pass/0fail/231aserciones en7archivos; tres nuevaspruebas: mismoUUID entreactores/legacy+personal/independencia/requests inválidos; corrupción/futuro rechaza yfixture restaurada; receipt visible sólo dentro desession yrollback intacto. Runner revalida disponibilidad medianteimagen fijada/guards, contenedor/tmpfs propios eliminados; noDBusuario/secrets/hosting. Fixtures ajustan_id string ydiscriminantes literales a tipado deldriver. Normal265pass/49opt-in skip/0fail/5121aserciones, lint378archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b2b: mutaciones multirregistro propias + contador compartido + journal/recibo enmisma sesión, replay/CAS/fallos tardíos ypruebasMongo;11c2b3 probará carreras conbarreras antes deactivar. Este lector no verifica digest contraintención por sísolo: futuroexecutor debe comparar fingerprint yautorización vigente. Elegir siguientecorte trascuotas, reservando margen de reparación/cierre ysin equiparar porcentajes deventanas.


### Resultado 11c2b2a2 — Replay ligado a la intención

`readRemoteOperationReplay` valida actor e intención antes de IO, calcula el fingerprint v1 canónico en servidor y compara contra el recibo propio legacy/v2 leído en la sesión suministrada. Devuelve resultado normalizado/null; UUID reutilizado con otra base, contenido o familia lanza `OperationIdentityReuseError`. Clase extraída a módulo server-only compartido y reexportada desde el executor item, conservando compatibilidad y comportamiento activo. No acepta digest del cliente, no escribe ni concede autorización/ACK por el recibo; el servicio futuro debe aplicar su política de acceso. Query ya cubierta por índice actor+operationId, sin nuevos índices ni callers productivos.

MongoDB aislado: 29 pruebas, 249 aserciones, cero fallos; legacy/personal, orden de propiedades equivalente, aislamiento por actor, reutilización de identidad, input inválido, historia intacta y visibilidad de sesión/rollback. Contenedor y almacenamiento propios eliminados. Suite normal 265 pass/50 opt-in skip/0 fail/5121 aserciones; lint 379 archivos, tipos y build con 34 recursos neutrales aprobados. Se corrigió únicamente el literal discriminante de una fixture tras detectar el error de tipos. Diff comprobado; commit y push a int con verificación de HEAD remoto y lectura de cuotas al cierre.

Próxima candidata 11c2b2b: aplicar efectos, contador compartido, journal y recibo en una transacción; conservar pruebas de fallo tardío/replay/CAS y carreras 11c2b3 antes de activar preferencias remotas. El helper entregado es preparatorio y no activa su sincronización.


### Resultado 11c2b2b1 — Categorías atómicas preparadas

Executor server-only valida actor/intención antes de IO y usa replay común con fingerprint v1. Dentro de snapshot/majority, lee catálogo propio, aplica CAS de todos los efectos, incrementa contador compartido e inserta journal/recibo v2 completos. Wrapper devuelve resultado sólo después de commit; etapa interna exige transacción activa y su resultado no constituye ACK. Conflictos/rechazos conservan recibo sin secuencia aplicada; unsupported nuevo no escribe. Duplicados/CAS abortan y admiten hasta tres sesiones nuevas, sin continuar una sesión abortada. Índices existentes registrados cubren las consultas, los personales se provisionan únicamente en Mongo de prueba propio. Sin callers productivos, wire/pull/ACK activos ni activación personal.

Cuatro escenarios nuevos Mongo: entrega duplicada concurrente produce un solo efecto/recibo/journal; replay exacto e identidad reutilizada; CAS/tombstones/nombres NFKC/aislamiento/unsupported; compactación de tres revisiones y fallo después del recibo que revierte efectos, contador, journal y recibo; historial mixto item/category/item conserva secuencias1/2/3 y registros legacy intactos. No equivalen a barreras de snapshots solapados de11c2b3. Total Mongo33pass/0fail/305aserciones en8archivos, recursos propios eliminados. Normal265pass/56opt-in skip/0fail/5121aserciones; lint381archivos, tipos/build34recursos/diff aprobados. Tipos de_id y refinamiento de fixtures corregidos antes del cierre.

Reserva vigente actualizada por solicitud humana:10%5h y5%7d, evaluadas por margen y coste propios. Próxima11c2b2b2: executor de vista personal con autorización de item/tag dentro de la misma transacción; después11c2b3 carreras de catálogo y autorización con barreras. Antes de activar cualquier writer personal deben existir lectores/handshake/ACK/pull compatibles.


### Resultado11c2b2b2 — Vista personal atómica preparada

item-view.set lee item/vista/tag propios dentro de la sesión, limita contexto a contenido simple activo y aplica CAS sin editar el contenido/progreso. Tag ajeno o eliminado rechaza; vista propia de un item ajeno no concede permiso. Contador/journal/recibo/retry extraídos a helper server-only reutilizado con categorías; guardias de transacción, contratos/bytes y comportamiento de categorías conservados. Wrapper responde tras commit; stage no es ACK. Replay histórico conserva resultado/fingerprint exactos sin reescribir estado o conferir acceso a contenido. Unsupported de cumpleaños/series conserva recibo sin efectos ni sequence; tipos de comando fuera del executor no escriben. Sin callers, wire/pull/ACK ni índices productivos nuevos.

Cuatro escenarios nuevos: asignar/cambiar/quitar y stale-CAS, entrega duplicada/replay y contenido intacto; aislamiento mediante item/tag ajenos y eliminados; fallo después del recibo revierte vista/contador/journal/recibo; evento simple soportado y cumpleaños/serie conservados como unsupported. Regresión real de categorías también aprobada. Mongo aislado37pass/0fail/363aserciones en9archivos, recursos propios eliminados. Normal265pass/62opt-in skip/0fail/5121aserciones, lint384archivos, tipos/build34recursos/diff aprobados.

Petición humana durante esta entrega reduce reserva semanal5→2%; 5h sigue10%. AGENTS/workflow actualizados en este commit, entradas históricas conservadas. Tras commit/push y HEAD/cuotas, próxima11c2b3: barreras para snapshots solapados, coherencia de vecinos/create/delete/nombres y autorización de vista frente a delete. Pruebas secuenciales de acceso no demuestran todavía ese aislamiento concurrente. Compatibilidad/handshake/ACK/pull siguen obligatorios antes de activar.


### Resultado11c2b3a — Snapshots solapados comprobados

Cinco carreras deterministas en MongoDB propio, mediante spies de lectura y barreras de promesas exclusivamente en tests. Movimiento pausa catálogo vigente; create/delete de vecino confirma primero; al reanudar, target no comparte escritura con el vecino pero contador común provoca retry/relectura y invalid_command durable sin efectos del movimiento. Vista pausa lectura de item/tag activo; delete confirma primero; retry observa tombstone y responde unavailable/invalid_command sin vista ni journal/sequence applied. Colisión de nombre NFKC pausa catálogo antiguo, ganador confirma; inserción perdedora aborta por unicidad y reclasifica sobre snapshot fresco. Se comprueban lectura repetida/tombstone observado, revisiones del target intactas, secuencias sin huecos, recibos durables y ausencia de journal del perdedor. Barreras/spies restaurados y operaciones drenadas incluso al fallar.

La hipótesis del contador compartido queda demostrada para los contextos propios activos ensayados, incluyendo efectos en documentos disjuntos y permiso frente a borrado; la unicidad de nombres se prueba por separado y no sustituye el contador. No se introducen locks, hooks productivos ni temporizadores para ordenar commits. No extender la evidencia a permisos compartidos o series, aún no soportados.

Mongo42pass/0fail/412aserciones en10archivos; recursos propios eliminados. Normal265pass/69opt-in skip/0fail/5121aserciones, lint385archivos, tipos/build34recursos/diff aprobados. Sin código productivo nuevo ni activación. Próxima11c3a: contrato mixto de transporte/descarga y compatibilidad, antes de readers/ACK/pull/backup/dos dispositivos y provisionamiento explícito. Commit/push/HEAD/cuotas al cierre, reserva10%5h/2%7d vigente.


### Resultado11c3a1 — Descarga mixta validada

Schema/type/verificador puros para página explícita versión2 con journal item/preference normalizado íntegro. Hasta100 registros, secuencias consecutivas y operationIDs distintos; nextAfter/checkpoint/hasMore coherentes. ExpectedUserId y query externos comprueban cada receptor, after+1, limit y through congelado. Página vacía no avanza ni oculta huecos. Salida clonada, futuro/extra/legacy página rechazan; adaptación readonly de registros legacy sigue siendo tarea del futuro reader antes de crear el envelope. No IO, wire/ACK/cursor/DB ni callers activos nuevos.

Guard2MiB UTF8 para página completa, separado de512KiB por journal. Permite futura paginación de menos registros que limit, nunca truncar contenido; cabe cualquier primer registro admitido con metadata. Cuatro pruebas/58aserciones nuevas cubren mezcla/tombstones/clones, continuación/checkpoint/vacío, dueño/query/saltos/duplicados/extra/futuro/100máximo y página Unicode que excede bytes aun siendo válidos todos sus registros individuales. Fixture de duplicados corregida para reutilizar realmente el UUID del primer registro. Suite269pass/69opt-in skip/0fail/5179aserciones, lint389archivos, tipos/build34recursos/diff aprobados; sin repetir Mongo por este contrato puro.

Próxima11c3a2: reader Mongo propio mixto con snapshot/cursor/byte-paginación sin filtrar historia, seguido de handshake/transporte y ACK/pull/backup compatibles antes de activar. Contrato puro no negocia compatibilidad, concede permisos ni prueba convergencia. Reserva10%5h/2%7d; commitpushHEAD/cuotas al cierre.


### Resultado11c3a2 — Reader mixto preparatorio

readRemoteChangesV2 valida actor/query antes de IO y lee contador/journal/autorización en una misma snapshot. Adapta registros legacy readonly a item/v2, conserva cada efecto personal y secuencias sin huecos. Consulta recipientUserId/sequence usa índice vigente; count<=100 y byte-paginación2MiB con tamaño exacto de registros/commas/envelope, sin partir entradas. Cursor siempre cerrado. Checkpoint congelado y error de cursor futuro conservados.

Item exige pertenencia actual incluso para historia; categorías exigen registro propio actual y vistas documento propio más acceso propio al item/tag referido. Tombstones preservan ownership y permiten descargar historia anterior intacta; ausencia/futuro/corrupción/store personal aún sin executor rechazan página sin filtrar ni avanzar. No callers/rutas/transporte/ACK/pull productivos nuevos, ningún índice nuevo ni provisionamiento personal fuera de test propio.

Cuatro escenarios nuevos Mongo: journal mixto producido por executors reales y checkpoint/incremental tras deletes; aislamiento/cursor/input inválido; huecos/futuro/corrupción/settings no soportado/item con owner cambiado/vista ausente, fixtures restauradas;28tareas grandes en fixtures transaccionales propias, dos páginas por UTF8 con28secuencias y checklist completo en todas. Esta última fixture prueba reader/bounds, no ACK de escritura real. Mongo46pass/0fail/475aserciones en11archivos; recursos propios eliminados. Normal269pass/75opt-in skip/0fail/5179aserciones, lint391archivos, tipos/build34recursos/diff aprobados.

Próxima11c3b1: contrato de respuesta push mixta/versionada y compatibilidad transporte2/intención1, sin activar todavía. Después servicios/handshake, metadata/ACK/pull/backup y prueba de dos dispositivos antes de activar preferencias. Reserva10%5h/2%7d vigente, commitpushHEAD/cuotas al cierre.


### Resultado11c3b1a — Push mixto preparatorio

Input explícito transportVersion2 reutiliza schema de intenciones durables1, UUIDs/operaciones intactos y fingerprint v1 sin cambios. Guard512KiB incluye envoltura completa además del batch interior. Respuesta versión2 discriminada complete/retry_later/rechazos generales, resultados item/preference strict<=50/49, operación distinta por resultado y guard2MiB completo. Verificador exige actor/request, orden/IDs/familia, resultado completo o prefijo retry exacto/failedOperationId siguiente. Dueño de datos y objetivo principal de applied/conflict coinciden con el comando; efectos multirregistro conservados. Validación no concede ACK ni negocia compatibilidad; no IO/wire/config/ServerAction/metadata/DB activos modificados.

Cinco pruebas/70aserciones: digest exacto y clones/mezcla/errores, prefijos incluidos vacío/parcial, truncado/desorden/duplicados/versiones/cuenta/familia/objetivo ajeno, batch interior válido justo512KiB cuya envoltura excede, respuestaUnicode que excede2MiB con outcomes individuales válidos y prefijo menor intacto. Tupla Zod y literales/tipo de fixtures ajustados antes del cierre; lint sin ruido. Suite274pass/75opt-in skip/0fail/5249aserciones, lint395archivos, tipos/build34recursos/diff aprobados. No repetir Mongo por contrato puro.

Próxima11c3b1b: separar versión de transporte de la intención1 en compatibilidad/config preparatoria, conservando transporte activo1 y probando negociación2/1 en ambas direcciones. Servicio mixto/metadata/ACK/pull/backup/dos dispositivos siguen antes de activar. Si response futura excede límite, conservar prefijo completo y pedir retry de siguiente intención, incluso si el commit durable ya existe: replay lo preserva, no falso fallo ni pérdida de intención. Reserva10%5h/2%7d, commitpushHEAD/cuotas al cierre.


### Resultado 11c3b1b — Compatibilidad separada de intención

La versión durable de operación conserva1 y el transporte activo conserva1, ahora con constantes distintas. El batch actual compara contra la versión de intención; helpers puros permiten anunciar/verificar una versión explícita validada sin ampliar el rango activo. Negociación2/1 se rechaza en ambas direcciones,2/2 y1/1 se aceptan; defaults y UUID/payload/fingerprint de cola intactos. No caller productivo2, cambios de DB, metadata, ACK/pull ni activación personal.

Prueba nueva de23aserciones cubre direcciones incompatibles, versión válida/explícita y valores inválidos. Suite275pass/75opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados. Contrato puro no requiere repetir Mongo. Por petición humana durante esta entrega, reserva semanal2→1%; reserva5h10% conservada, AGENTS/workflow actualizados en este mismo commit. Las entradas históricas mantienen su política original.

Próxima candidata11c3b2a: lectura común fingerprint-bound en executor item para clasificar UUID reutilizado frente a recibos personales/versionados, conservando resultado activo legacy y escrituras actuales. Después dispatcher/servicio mixto y metadata/ACK/pull/backup compatibles antes de activar. Commit/push/HEAD/cuotas al cierre, reserva10%5h/1%7d vigente.


### Resultado 11c3b2a — Replay item compatible con recibos mixtos

Executor item usa replay común dentro de su transacción snapshot y compara fingerprint canónico antes de interpretar la familia. Recibos legacy/v2 item devuelven outcome legacy independiente; recibo personal exacto rechaza por incompatibilidad sin convertirlo en ACK item. UUID reutilizado con payload/familia diferente lanza identidad reutilizada sin efectos. Escritores/journal/resultado activo1 y autorización propios conservados; índices actor+operationId vigentes, sin rutas o activación personal.

Dos pruebas Mongo nuevas: fixture de recibo item legacy adaptado a v2, replay tras tombstone, independencia de salida/historia, corrupción de dueño/futuro y restauración; recibo de categoría producido por executor real, UUID reutilizado/familia incompatible sin item/journal/counter nuevos y mismo UUID permitido a otro actor. Mongo48pass/0fail/494aserciones en11archivos, contenedor/tmpfs propios eliminados. Suite275pass/77opt-in skip/0fail/5272aserciones; lint395archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2b: dispatcher preparatorio para delegar por familia a executors reales, conservando validación antes de IO, replay/unsupported y resultado v2 sin activar wire2. Después servicio autenticado y metadata/ACK/pull/backup compatibles antes de preferencias remotas activas. Reserva10%5h/1%7d vigente; commit/push/HEAD/cuotas al cierre.


### Resultado 11c3b2b — Dispatcher mixto preparado

executeRemoteOperationV2 valida actor/intención antes de IO y delega a executors item/tag/view con sus transacciones reales. Items se envuelven readonly en resultado v2; personal conserva resultado íntegro. Settings/task.move pasan por rechazo unsupported previo al catálogo del executor personal, con replay/fingerprint dentro de sesión sin escribir para comandos nuevos. Resultado propio clonado, familia/operationId coherentes; historia incompatible rechaza sin relabel ni falso ACK. Sin prelectura de autorización/recibo fuera de transacción, índices nuevos ni callers productivos.

Cuatro escenarios nuevos Mongo: mezcla item/tag/view con secuencias1/2/3 y replay tardío tras delete sin reescritura; UUID reutilizado en ambas direcciones y actor aislado; unsupported e inputs futuros/extra/inválidos sin efectos y UUID reutilizado incluso para unsupported; fixture de familia incompatible rechaza y se restaura. Runner52pass/0fail/520aserciones en12archivos, contenedor/tmpfs propios eliminados. Normal275pass/83opt-in skip/0fail/5272aserciones; lint397archivos, tipos/build34recursos/diff aprobados.

Próxima candidata11c3b2c1: envelope de clasificación transport2/intención1 y servicio batch mixto preparatorio autenticado por actor externo, prefijos/retry/identidad/bounds sin publicar nueva acción. Separar pruebas puras de política de integración Mongo si margen lo requiere; no conectar wire2 antes de metadata/ACK/pull/backup compatibles. Reserva10%5h/1%7d; commitpushHEAD/cuotas al cierre.


### Resultado 11c3b2c1 — Batch mixto preparatorio

Envelope strict compartido reconoce transporte ausente/1/futuro e intención futura como update_required antes de interpretar comandos, tras política de actor/cuenta; inputs inválidos, inyección/duplicados/count/UTF8 rechazan antes de execute. Servicio server-only usa dependencias de sesión confiable y executor, sin acción pública ni caller activo. Execute secuencial; resultados vinculados a cuenta, orden, IDs, familia y objetivo mediante verificador puro; identidad reutilizada se devuelve con familia correcta y continúa. Fallo transitorio/outcome incoherente conserva prefijo válido y detiene posteriores.

Cada candidato incluye metadata de continuación y guard2MiB antes de acumularse; si no cabe, devuelve prefijo anterior y retry de operación ya ejecutada. Su posible commit durable no se niega: siguiente intento debe replay con UUID/fingerprint intactos, sin falso ACK ni truncamiento de outcome. Sin activar wire2, DB/índices/cola/ACK/pull actuales intactos.

Seis pruebas/59aserciones de política con executor simulado: sesión/cuenta, negociación, validación completa, secuencialidad/identidad por familia, fallo/familia/ID/owner/target incoherentes y respuesta Unicode con16outcomes individuales válidos que corta antes de2MiB sin ejecutar posteriores. Fixture unión discriminada ajustada antes del cierre. Suite281pass/83opt-in skip/0fail/5331aserciones; lint399archivos, tipos/build34recursos/diff aprobados. No repetir Mongo para política pura; prueba de servicio+executor real queda en11c3b2c2.

Próxima candidata11c3b2c2: integración del batch con dispatcher Mongo, pérdida de respuesta/replay/prefijo y clasificación de acceso/identidad, sin nueva ruta. Después metadata/ACK/pull/backup locales compatibles antes de activación. Reserva10%5h/1%7d; commitpushHEAD/cuotas al cierre.


### Resultado 11c3b2c2 — Batch mixto probado con commits reales

Tres escenarios nuevos conectan servicio preparatorio y dispatcher con Mongo propio. Error intencional tras commit de categoría devuelve sólo prefijo item; retry con la intención original conserva recibo/sequence2 y confirma vista ensequence3, replay posterior no escribe. UUID reutilizado entre ambas familias responde identity_reuse correspondiente sin efectos; vista de contenido ajeno devuelve unavailable sin contador propio ni tocar owner.

16tareas grandes se crean individualmente, luego un batch pequeño de status produce respuesta>2MiB. Servicio devuelve prefijo íntegro, y se verifica antes de cualquier retry que la operación excluida ya tiene recibo/commit. Replay exacto conserva ledger; restantes avanzan una vez hasta32secuencias contiguas/32recibos, todas las tareas revision2/in_progress y checklist completo. No falso ACK ni pérdida de respuesta confundida con fallo remoto. Esta prueba no implementa ACK local ni equivale a dos dispositivos reales.

Mongo55pass/0fail/618aserciones en12archivos; recursos propios eliminados. Normal281pass/86opt-in skip/0fail/5331aserciones; lint399archivos, tipos/build34recursos/diff aprobados. Sólo pruebas/plan nuevos; no rutas/protocolo activo/índices productivos ni activación personal.

Próxima candidata11c3c0: contrato de transición de metadata local item/personal y backup, antes de schemas/ACK/pull/recuperación compatibles. Debe conservar intención1, chains/tombstones, historial legacy, propiedad/época, replay más antiguo y rechazar futuro/corrupto sin borrar ni avanzar. Servicio/reader preparados siguen sin callers activos. Elegir corte con cuota posterior, reserva10%5h/1%7d y margen de reparación/cierre.


### Resultado 11c3c0 — Transición local definida

Nuevo contrato `local-preference-evidence.md` basado en schemas/ACK/pull/backup/incident reader reales. Separa intención1, transporte2, evidencia2, backup2 e IndexedDB2 si stores/keys no cambian. Shadows personales por documento; outcome multiefecto con snapshots de ausencia observada, sin inventar ancestro. Lectores estrictos/backup/routing antes de writers, proyección conservadora con cadena personal y reconciliación final, ACK/pull/cursor/rollback atómicos, CAS independiente por efecto y bases enviadas inmutables.

Formatos legacy siguen readonly/clonados, desconocido/corrupto rechaza sin borrado ni cursor; importación/resolución local no fabrica ACK o permisos. Cortes11c3c1a–4 definidos con rutas/evidencias antes de coordinador/dos dispositivos/activación. Ningún schema/writer/runtime nuevo en esta entrega documental; estado preparatorio y limitaciones separados del producto activo.

Referencias locales y coherencia/diff comprobados; sin repetir lint/tipos/build del código íntegro validado en corte anterior. Próxima candidata11c3c1a: shadow/snapshot personal puros, sólo si cuota posterior y cierre caben; dividir antes de abrir si hace falta. Reserva10%5h/1%7d vigente; commitpushHEAD/cuotas al cierre.


### Resultado 11c3c1a1 — Shadow mixto puro

Schema/type explícitos version2/kind item/preference y decoder/verificador puros. Legacy item estricto se adapta sólo en memoria conservando entidad/revisión/tombstone y sin modificar historia. Preferencia individual usa claves tag/item-view/placement canónico/settings por identidad; store, documento, clave y cuenta externa coherentes. Clones y rechazo futuro/extra/ambiguo/corrupto. Reconocer settings/placements como evidencia no implementa sus productores o aplicación; parse no demuestra commit, permiso, ACK ni ancestro.

Cuatro pruebas/39aserciones: legacy/tombstone, familias personales e independencia, scope/fecha de aparición/sentinel overdue, claves cruzadas/cuenta/futuro/extra/corrupción. Tipos de fixtures discriminadas corregidos antes de cierre. Suite285pass/86opt-in skip/0fail/5370aserciones; lint403archivos, tipos/build34recursos/diff aprobados. Contrato sin IO no requiere repetir Mongo. Ningún consumidor/writer/backup activo o migración cambiado.

Próxima candidata11c3c1a2: snapshot personal puro por clave con ausencia observada y sets de evidencia, antes de outcome/backup/ACK/pull. Evaluar cuota posterior contra coste alto observado y reparación/cierre; no abrir si puede cruzar reserva10%5h/1%7d. Repo coherente, protocolo activo1 y preferencias aún preparatorias. CommitpushHEAD/cuotas al cierre.


### Resultado 11c3c1a2 — Snapshot personal puro

Snapshot por clave con registro personal local o ausencia null, conjunto externo exacto y propietario de partición. Claves únicas<=10000/canónicas, revisión0 local admitida, tombstones y clones; settings ausente exige clave de la misma cuenta. Guard2MiBUTF8 para conjunto íntegro, no sólo registros. Overdue conserva sentinel en clave y documento, sin normalizar silenciosamente fecha observada. Formato local separado de efectos remotos positivos: creación optimista actual usa revisión0 en preference-command.ts.

Cinco pruebas/23aserciones: revisión0/ausencia/tombstones/clones, conjuntos vacíos/exactos/incompletos/extra/duplicados, dueño/settings-null, shapes futuros/extra/claves corruptas,7000categorías individualmente válidas que exceden bytes y coherencia civil overdue. Aviso optional-chain corregido antes de cierre; lint sin ruido. Suite290pass/86opt-in skip/0fail/5393aserciones; lint407archivos, tipos/build34recursos/diff aprobados. Contrato sin IO, no repetir Mongo; no writer/migración/backup/ACK/pull/caller activo nuevo.

Próxima candidata11c3c1b: outcome/submission mixtos y relación intención/familia/cuenta/efectos/snapshots exactos. Requiere margen para contratos y fixtures multiefecto/replay viejo; no abrir si cuota posterior menos coste alto observado y reparación/cierre puede cruzar1%7d/10%5h. Repo cerrado, preferencias siguen preparatorias y protocolo activo1. CommitpushHEAD/cuotas al cierre.


### Resultado 11c3c1b1 — Recepción mixta pura

Schema/type de submission intención1/senderUUID/resultado v2, relación operationId exacta y verificador puro de cuenta/familia/objetivo reutilizando correspondencia push mixta. Devuelve clones y conserva multiefecto con revisiones independientes; futuro/extra/identidad/cuenta ajena rechazan. Sender UUID no acredita lease vigente; validación no escribe ACK ni demuestra commit/acceso/ancestro. Sin callers, outcome durable, writer, backup o protocolo activo nuevos.

Tres pruebas/20aserciones: multiefecto y clones, cuentas/objetivos/familias/UUID/versiones/extras incoherentes, estados de error de ambas familias preservados. Suite293pass/86opt-in skip/0fail/5413aserciones; lint411archivos sin ruido, tipos/build34recursos/diff aprobados. Contrato sin IO, no repetir Mongo. Petición de una iteración adicional completada con commit/push/HEAD/cuotas y reserva vigente10%5h/1%7d.

Próxima candidata11c3c1b2: outcome mixto durable con snapshots exactos, legacy readonly y replay previo al shadow actual; después backup/ACK/pull compatibles. No ampliar esta entrega al executor local ni activar preferencias.


### Resultado 11c3c1b2a — Outcome item versionado readonly

Variante explícita2/item con resultado item/v2; schema/type y decoder/verificador puros. Key e operationId exactos, correspondencia de cuenta/familia/objetivo reutilizada, snapshots local/base propios y de la misma identidad. Legacy se adapta sólo en memoria conservando intención, resultado, revisión/tombstone y clones. Replay anterior al shadow observado se admite sin fabricar ancestro, actualizar resultado ni retroceder datos. Desconocido/extra/ambiguo/identidad o cuenta ajena rechaza íntegro.

Tres pruebas/22aserciones: conflicto revision2 frente a shadow observado5/local0, clones, applied con tombstone y cuatro rechazos preservados, key/IDs/snapshots/resultado ajenos y versiones/familias/extras inválidos. Suite296pass/86opt-in skip/0fail/5435aserciones; lint415archivos, tipos/build34recursos/diff aprobados. Contrato sin IO no requiere repetir Mongo. Sin lector común, writer, backup, ACK, outbox o caller activo nuevo.

Petición de una iteración adicional cerrada con reserva10%5h/1%7d ya vigente. Próxima candidata11c3c1b2b: variante outcome personal con snapshots exactos y decoder común, antes de backup/ACK/pull. No abrir persistencia personal como ampliación de este corte. CommitpushHEAD/cuotas al cierre.


### Resultado11c3c1b2b — Outcome personal y decoder común

Lote renovado autorizado por usuario100%/100%; primera lectura posterior a trabajo paralelo83%/97%, sin inferir consumo exacto entre agentes. Reserva vigente10%5h/1%7d y commit/push/cuotas por corte. Outcome2/preference conserva resultado completo y snapshots exactos del objetivo más todos los efectos, incluidos compactación, ausencias y tombstones. Local admite0; base exige revisión remota positiva, sin ancestralidad ni ordenar replay frente a shadow. Decoder común adapta item legacy sólo en memoria y verifica cuenta/familia/objetivo; límites UTF8 individuales y global5MiB, sin truncar.

Ocho pruebas específicas/95aserciones. Validación global con proyección paralela terminada:314pass/86opt-in skip/0fail/5636aserciones, lint422archivos/tipos/build/diff aprobados. Sin IO/ACK/writer/migración/caller/activación nuevos; Mongo no se repite para contratos puros. Siguiente11c3c2a backup mixto; proyección11c3c3p se cierra separadamente como preparación adelantada.


### Resultado11c3c3p — Proyección personal preparatoria paralela

Adelanto independiente sobre contratos cerrados:10pruebas/106aserciones de revisión propia por documento, replay viejo, contradicción igual revisión incluso con pendientes, toda cadena personal pending/sending/conflict/rejected, dependiente tras supersesión, reconciliación desde shadows con incoming null, local-only/ausencias/tombstones/clones y guards10k/2MiB. Validación completa de outbox propia/dependencias incluso para intención item no bloqueante; settings y stores futuros no representables rechazan íntegro. Sin IO/ACK/writer ni consumers nuevos.

Mismo estado de código validado centralmente antes de separar commits:314pass/86skip/0fail/5636aserciones, lint422archivos/tipos/build/diff aprobados; no repetir checks sin cambios o dudas nuevos. `34dcb55` outcomes publicado y quota79%/97%; proyección conserva reserva10%/1%. Siguiente11c3c2a portable mixto puro antes de exportación/lectores y writers.


### Resultado 11c3c2a — Backup portable mixto puro

Formatos estrictos portable1/2 con intención1/DB2 independientes del transporte. Portable2 admite shadow/outcome legacy y ambas familias2; validación semántica mediante decoders sólo en memoria y retorno original sin transformación. Propiedad, intención exacta, grafo, sequence, identidad tail presente, estados y decisiones conservados. No se impone ancestro ni replay posterior al shadow; tampoco se redefine tail histórico. Archivos sourceJson siguen opacos, byteexactos y no restauran permisos/ACK ni se verifican recursivamente como estado vivo.

Worker posee schemas/types/verificador/tests, root posee matriz preview/planner: source1/current2 y source2/current1 mantienen evidencia completa y sólo generan copias item nuevas base0. Veinticuatro tests pertinentes/216aserciones. DoD global321pass/86opt-in skip/0fail/5710aserciones, lint422archivos/tipos/build34recursos/diff aprobados. No writer/snapshot/export/migración/UI/transporte nuevos; Mongo innecesario para contrato puro. Entrada79%/97% tras bf094fd. Siguiente11c3c2b snapshot readonly e import real, mientras preparación de reader de incidentes puede avanzar con rutas propias.


### Resultado 11c3c2b — Exportación e importación reales compatibles

Snapshot readonly de once stores exporta portable2, con protocolo de intención1 y DB2, sin escribir/migrar historia. Importadores/preview/preparación ya consumen union estricta compartida1/2; no duplicar validación ni añadir cambios innecesarios. Fixture backup cinco checks más reload y fixture import once más reload aprobados. Preservan historia personal preexistente, conflicto/resultado bruto byteexacto, shadow item2/personal, contador/tail y tombstones; import sólo crea items/intenciones base0, sin ACK ni restauración de sync. Guardias cuenta/época, errores sin éxito falso, replay/carrera y rollback tardío comprobados. Corrección de fixture comparó snapshot normalizado con su baseline normalizado, y además registro bruto contra original para demostrar ausencia de reescritura.

DoD global324pass/86skip/0fail/5733aserciones, lint424archivos/tipos/build34recursos/diff aprobados en estado estable compartido con reader paralelo. Recursos own browser-test y servidores limpiados. Entrada tras ae5a87267%/95%, lectura intermedia55%/93%. Próxima11c3c2c reader/incidentes ya preparado en paralelo;11c3c3a standalone ACK personal se prepara con rutas propias y sin caller productivo, pendiente de cerrar lectores y pruebas reales.


### Resultado 11c3c2c — Readers e incidentes personales compatibles

Decoder de todos los shadows/outcomes antes de routing, incluidos outcomes no terminales en metadata; keys de outcome corrupto sin result también rechazan. Item2 adaptado sólo en memoria al contrato vigente de resolución, con grafo completo de dependencias y bloqueos cruzados. Overview separado en readonly único incluye tags/vistas, variantes item/preference ordenadas, intención congelada, local actual/al outcome/base/remoto conocido y cadena personal conservados. Igual revisión contradictoria y regresión de shadow frente a evidencia rechazan; base posterior a replay no inventa ancestro. UI details compactos españoles, nombres de categoría actuales y ninguna elección personal prematura. Existing account/epoch guardias preservadas, sin writes/cursor/ACK/caller wire2 nuevos.

Doce tests puros/render pertinentes89aserciones; suite325pass/86skip/0fail/5749aserciones, lint427archivos/tipos/build34recursos/diff aprobados. Browser incidentes cinco checks+dos reload y regresión resolución item ocho+reload aprobadas; corrupción/dep externos/rollback/copia/época, limpieza propia confirmada. Entrada49%/92% tras f84061d; siguiente11c3c3a standalone ACK personal preparado en paralelo sin caller productivo. Reserva10%5h/1%7d, commit/push/cuotas central.


### Resultado 11c3c3a — ACK personal atómico preparatorio

Planner puro/submission y writer standalone tags/vistas en una TX: intención congelada, lease sender, snapshots exactos previos local0/base positiva/null, resultado durable completo, applied único ACK, error/conflict/unsupported conservados. Rebase sólo directo pending/attempts0 por revisión del efecto de su identidad; intentadas/payload/dependencias intactos. Proyección conserva cadena personal y reconcilia shadows al terminar; resultado/cursor no confundidos, no IO ni atomicidad ficticia entre control y partición. Replay acknowledged íntegro readonly, retorno tras oncomplete. Revisión independiente detectó guardia de partición faltante; corregida antes de cierre, con test de DB equivocada que contiene filas válidas del actor. Stores unsupported rechazan antes de TX.

Cinco tests/74aserciones y diez checks browser propios aprobados, incluido lateabort íntegro y lectura10001. Fixtures canónicos con schemas corrigen comparación por orden de propiedades sin debilitar campos ni baseline byteexact de rollback/replay. Suite330pass/86skip/0fail/5823aserciones, lint430archivos/tipos/build34recursos/diff aprobados; repetir suite/tipos/lint tras último cambio de fixture, build de código productivo sin cambios nuevos. Cleanup/servidor propios. Sin caller productivo, transporte activo1 y preferencias aún preparatorias. Entrada41%/91%, lectura intermedia32%/89%; siguiente reader item11c3c2d antes de pull/coordinador, sólo si margen observado permite cierre.


### Resultado 11c3c2d — Compatibilidad de readers item

Adapter común readonly decodifica item shadow/outcome legacy o2 con cuenta/key/familia estrictas y devuelve shape de APIs vigentes. Getter de outbox, replay acknowledged y lecturas de ACK/pull lo reutilizan; personal/futuro/corrupto no se convierte en item. Getter/replay no reescriben evidencia. ACK/pull de transporte1 mantienen sus escrituras actuales al aplicar mutaciones reales; sin wire2/migración/caller nuevo. Fixtures own loopback versionan evidencia sintética mediante helper compartido y prueban persistencia bruta idéntica antes/después de lecturas/replay.

Browser sync-results siete checks+reload y sync-pull seis+reload aprobados: ACK nuevo frente a shadow2, dependientes/contenido, resultado íntegro, tombstones, cursor congelado/antiguo/carrera, límites de cuenta/versión y rollback tardío. Recursos propios/servidor limpios. Suite330pass/86skip/0fail/5823aserciones, lint432archivos/tipos/build34recursos/diff aprobados. Entrada28%/89% tras753c944, secuencial. Siguiente11c3c4a contrato/download local mixto y cursor antes de coordinator/activación; elegir tamaño con cuota real posterior y reserva10%5h/1%7d.


### Resultado 11c3c4a1 — Recepción local de páginas mixtas

Contrato puro estricto conserva la consulta completa normalizada por el schema remoto existente (after/through/limit) junto con página2. Reutiliza verificador remoto de cuenta, continuidad, rango, tamaño y checkpoint congelado; verifica todos los efectos antes de retornar. Sólo propios simples task/event con revisión positiva y tags/vistas. Settings/placements, series/cumpleaños y formatos futuros rechazan íntegros; no filtrar efectos válidos para aceptar parte de una entrada. Items repetidos exigen revisión ascendente dentro de página, mientras revisiones personales permanecen independientes del cursor. Resultado clonado, sin IO/ACK/rebase/cursor ni caller nuevo.

Cuatro pruebas específicas/26 aserciones. DoD global: 334 pass/86 opt-in skip/0 fail/5849 aserciones; lint435 archivos, tipos/build34 recursos/diff aprobados. Contrato puro sin persistencia: no repetir Mongo o navegador ni declarar convergencia. Entrada24%5h/88%7d tras224eb66, secuencial con reserva10%/1%. Commit/push/HEAD y ambas cuotas determinan cierre del lote; no abrir transacción mixta con margen insuficiente para pruebas, reparación y publicación.

Siguiente11c3c4a2: validar la página entera antes de abrir/aplicar cambios, guardar items/tags/vistas/shadows/cursor en una TX propia con lectura de outbox completa; conservar intenciones, dependientes, outcomes y tombstones. Sin ACK o rebase por descarga. Probar checkpoint/carrera/página antigua, cuentas/épocas, stores sin soporte, revisión independiente y fallo tardío de cursor que revierta todos los efectos. Preparar writer aislado antes de capacidades/coordinador; no activar transporte2 sin guardia de cadena personal histórica y evidencia de dos particiones.


### Resultado 11c3c4a2p — Decisión pura de cursor mixto

Planner sin IO valida receipt íntegro y cursor almacenado antes de decidir. Exige after y checkpoint de consulta iguales al estado actual; congela checkpoint mientras hasMore y lo libera al terminar. Sólo ignora páginas completamente superadas, conservando cursor vigente; solapamiento, consulta futura o checkpoint alterado rechazan. Incluso una página superada rechaza cuenta ajena, futuro, corrupción, límites o store sin soporte. Devuelve evidencia/cursor clonados, sin avanzar DB ni ACK. El writer futuro debe ejecutar esta decisión con el cursor leído dentro de su transacción y persistirla junto con todos los efectos.

Cuatro tests específicos/26 aserciones; suite338 pass/86 opt-in skip/0 fail/5875 aserciones, lint437 archivos, tipos/build34 recursos/diff aprobados. Entrada17%5h/87%7d, secuencial; corte limitado antes de abrir IndexedDB con reserva10%/1%. Sin caller nuevo, cambios a transporte1 o repetición de Mongo/browser para este planner puro. Commit/push/HEAD y cuota posterior determinan cierre. Siguiente11c3c4a2 mantiene transacción mixta, pruebas browser de atomicidad/rollback/carrera/cuentas y conservación íntegra antes de activación.


### Resultado 11c3c4a2q — Proyección personal de página completa

Composición pura de proyección personal existente sobre cada entrada de receipt íntegro, en orden. Estado propio validado con incoming inicial null y cola completa; página valida cuenta/rango/checkpoint/stores antes de seleccionar variante personal. Preserva cadena optimista con pendientes, acumula todos los shadows/multiefectos, mantiene revisión por documento y tombstones. No colapsa entradas a último documento antes de validar: contradicción intermedia de igual revisión rechaza incluso si existe revisión posterior. Resultados clonados y inputs intactos. Items recibidos se validan en receipt, pero su proyección/aplicación pertenece al writer mixto posterior; ningún resultado de este planner autoriza persistencia parcial.

Cuatro tests/19 aserciones, incluido replay antiguo, multiefecto tag/view, tombstone, intención pendiente, corrupción/actor incluso página vacía y contradicción tardía sin mutación. DoD342 pass/86 opt-in skip/0 fail/5894 aserciones, lint440 archivos, tipos/build34 recursos/diff aprobados. Entrada15%5h/87%7d; secuencial con reserva10%/1%, commit/push/HEAD/cuotas al cierre. Sin IO/ACK/cursor/caller ni activación; Mongo/browser innecesarios para composición pura. Siguiente11c3c4a2 transacción IndexedDB reutiliza receipt, cursor y proyección de página dentro del snapshot propio, con atomicidad de todos los efectos/cursor, rollback y dos particiones antes de integración.


### Resultado 11c3c4a2 — Descarga mixta atómica preparatoria

Writer client-only aislado valida receipt y partición antes de abrir TX; lee snapshot de items/tags/vistas/outbox/shadows/cursor completo con límite10001 detectado. Decodifica todos los shadows antes de seleccionar familia, valida cuentas/identidades/cola y proyección personal íntegra; decide cursor sobre el estado leído en TX, ignora sólo página completamente superada sin puts. Prepara efectos item/personales antes de escribir; no colapsa contradicción intermedia, conserva acumulados pendientes y tombstones/revisiones independientes. Shadows sólo se escriben si cambian, sin normalizar historia ajena a la página. Cola/outcomes/dependencias intactos, sin ACK/rebase por descarga. Stores/efectos/cursor se confirman juntos y resolve tras oncomplete. Cuenta/época de control sigue responsabilidad del caller futuro, sin atomicidad inventada entre bases.

Ocho escenarios browser en origen propio4192 aprobados: commit completo y reopen, replay ignorado byteexact, pendientes e historia intactos, cambio checkpoint/contradicción sin writes, fallo final cursor con rollback íntegro/retry, DB equivocada/store unsupported antes de TX, fila10001, checkpoint paginado y tombstones de contenido/vista, corrupción futura/cuenta incluso página superada. Primer fallo de fixture era comando task.status inexistente; corregido a task.set-status con occurrenceId null. Tipo de filas opcionales corregido y formatter aplicado, checks repetidos hasta pasar. Sólo recursos propios limpiados, servidor/pestaña cerrados.

DoD342 pass/86 opt-in skip/0 fail/5894 aserciones, lint443 archivos, tipos/build34 recursos/diff aprobados, más ocho checks reales IndexedDB. Entrada12%5h/86%7d con autorización puntual de reserva4%5h/1%7d registrada en workflow. No caller productivo ni transporte2 activados; fixtures locales sintéticas no demuestran convergencia remota. Siguiente11c3c4b1 prueba de dos particiones/Mongo con APIs preparadas, antes de integrar coordinación/capacidades y recuperación de cadena personal histórica. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c3c4b1 — Prueba mixta integrada con dos dispositivos

Runner browser-mixed consume descriptor validado y MongoDB8.2.11amd64 aislado, provisiona sólo índices explícitos en su DB propia. Dos servidores loopback/orígenes y particiones IndexedDB UUID, servicios/dispatchers/DAL reales y capability run. Ocho escenarios aprobados: offline/recarga, bootstrap paginado y ACK durable, asignación/rebalance multiefecto, respuesta perdida/UUID/replay sin duplicados y shadow más reciente que outcome, tombstone con desasignación explícita independiente, contenido/personal con cursor común, conflicto conservado con dependientes tras recarga, task.move histórico sin executor que permanece pendiente y bloquea la cadena. Convergencia sólo comprobada entre ambas particiones y Mongo en escenarios soportados sin bloqueos; no activación de categorías en producto ni resolución implícita.

Primer arranque falló por faltar contenedor actions en HTML de fixture; corregido antes de ejecutar. Borrado de categoría conserva referencia histórica hasta item-view.set explícito; fixture respeta ese contrato. Ocho checks posteriores correctos, bases/pestaña/servidores/contenedor/tmpfs propios limpiados y runner exit0. Suite Mongo aislada55 pass/618 aserciones/0fail, suite global354 pass/86 opt-in skip/0fail/6049 aserciones (incluye preparación paralela de capacidades todavía no publicada), lint453 archivos/tipos/build34 recursos/diff aprobados. Sin cambios a credenciales/DB/hosting reales.

Entrada renovada100%5h/85%7d; autorización desatendida de cadena y reservas4%/1% registrada con reset real1791516313 (9oct05:25:13Madrid). Siguiente11c4a1p: publicar capacidades/diagnóstico preparados, después coordinador mixto aislado con cuenta/época/dependencias y consultas completas. Commitpush/HEAD y cuota por corte; movimiento histórico exige executor compatible o recuperación explícita, nunca ACK fabricado.


### Resultado 11c4a1p — Capacidades y diagnóstico de cola preparatorios

Registry exhaustivo y congelado describe executors preparados, no protocolo activo ni autorización. Tags/vistas/contenido simple admitidos condicionalmente; placements/settings/series/cumpleaños/ocurrencias sin executor explícitos. Contexto desconocido requiere validación remota. Diagnóstico puro valida cuenta, duplicados, límite10000, dependencias completas y ordenadas antes de clasificar listas listas/esperando/bloqueadas/unsupported/settled. Sólo acknowledged satisface un padre; superseded bloquea hijos. Toda intención personal unresolved mantiene proyección conservadora. Devuelve blockers directos y grafo íntegro sin copiar ancestros cuadráticamente; no muta inputs ni ACK/historia. Ramas de contenido independientes siguen listas aunque cadena personal esté bloqueada. Settings.update se describe sin ampliar la outbox vigente que todavía no admite su entityKey.

Worker personal_outcomes posee seis rutas disjuntas ya definidas, revisión root completa; sin consumidores.12 tests/155 aserciones incluyen move→tag→view, create→view, conflicto/superseded, tag anterior a move, cuenta/futuro/corrupción, clones y cadena10000 (10001 rechaza). DoD global ya ejecutada sobre exactamente estos archivos estables:354pass/86opt-inskip/0fail/6049 aserciones, lint453/tipos/build34 recursos; diffcheck y referencias documentales comprobados tras actualización. Sin repetir pruebas caras por cambios sólo documentales. Entrada69%5h/80%7d después de a87ca07 publicado; reserva4%/1%, siguiente11c4a2p coordinador mixto preparatorio con contratos cerrados. Commitpush/HEAD/cuotas al cierre.


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


### Resultado 11c4a4p — Recorrido completo de dos dispositivos con Mongo real

Diez escenarios correctos con servicios/DAL/executorsMongo propios y dosorígenes/particiones. Conserva ochopruebas previas y añade runtime/coordinator/HTTP reales: crear tarea/categoría/vista, perder respuesta después de commitreal y antes deACK, conservar UUID/payload/leasepending, replay durable con unjournal porintención y diagnóstico fresco que desbloquea tresACKs; otrodispositivo converge contraMongo. Reload/idle conservaoutcomesliteralmente. Segundoescenario mueve contenidoindependiente mientras moveunsupported/tagdependiente/conflicto enotradispositivo permanecen conservados y visiblesdiagblockers; settled es pasada sinrunnable, no convergenciapersonal. Nunca claimed niACK ni superseded dehistoriabloqueada.

HTTPshim sólo remapea rutas al servidor loopbackpropio con cookies/cache/signal/query originales; servidor anuncia2 sólo enfixture y exige capabilityrun/cuentaesperada. Controlficticio usa epochactual y cleanupverifica own/null incluso despuésdereload via markerporrun; pagehideclose sinborrado. Amboscontroles/DBproductos/pestaña/servidores/runnerMongo/container/tmpfs propioslimpios, exit0, sinerroresconsole. FullDoD373pass/86opt-inskip/0fail/6418aserciones/lint463/tipos/build34recursos/diff correctos, prueba Mongo navegador diezchecks. Activohooks/API/config/producción/índicesfueraDBtest sin cambios; preferencias siguen preparadas hasta activaciónsegura. Entrada42%5h/76%7d, reserva4%/1%. Próxima11c4a5p contratoactivaciónsegura+diagnósticos/resumen; task.move histórico requiereexecutorcompatible o recuperación explícita antesdeprometer ordensinblockers. Commitpush/HEAD/cuotas porentrega.


### Resultado 11c4a5p — Contrato de activación segura

Documento [mixed-sync-activation.md](mixed-sync-activation.md) distingue módulos preparados de producto activo, intención1/transporte2/evidencia2/backup2 y alcance tags/vistas frente a movimientos/series/settings. Orden: resumen compartido, readiness de índices readonly, provisión explícita autorizada, frontera autenticada, conexión conjunta cliente/UI y piloto de transiciónNext/Google. Matriz incluye acciónlegacy tras handshake previo, cliente2/servidor1, intenciónfutura, índicefaltante y cuenta/época. No anunciar rango1–2 ni fabricar ACK para cola histórica. Políticacivil overdue sigue pendiente, sin inventartimestamp ni relojremoto.

Sólo docs, rutas/referencias/consistencia y diffcheck validados; no repetir suite/build ya aprobados ni ejecutar acciones sobre DB real. Entrada34%5h/74%7d; paralelo disjunto con extracción11c5a1p, reserva4%/1%. Siguiente11c4a5s resumen puro compartido antes de readiness/API/UI. Commitpush/HEAD y cuotas por corte.


### Resultado 11c5a1p — Núcleo puro de colocaciones

Extracción sin cambio de comportamiento: planTaskPlacements pasa a lib/preferences/task-placement-command.ts, tipo TaskMoveCommand inferido desde SyncCommand agnóstico; adapter cliente reexporta para conservar todos los callers. Cuerpo del algoritmo idéntico al HEAD anterior, sin nuevos permisos, validación ni activación. Mantiene metadata/revisiones locales, ranks implícitos/negativos/fraccionarios y compactación multiefecto, identidad de aparición y sentinel overdue sin alterar command.date. No permite restaurar tombstones ni vecinos no adyacentes.

Seis tests directos/35aserciones, más regresiones task-move/day:18tests/116aserciones. FullDoD379pass/86opt-inskip/0fail/6453aserciones/lint465/tipos/build34recursos/diff aprobados. No Mongo ni browser repetidos por extracción pura; local UI/reordenación conserva lógica. Entrada28%5h/73%7d, reserva4%/1%, worker disjunto personal_outcomes y revisión root. Siguiente de activación11c4a5s/resumen y11c4a5i/readiness en preparación; futuro orden11c5a2 cierra política/planner remoto antes de repositorios/executor/ACKpull de placements. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a5s — Resumen mixto puro

Resumen independiente consume diagnosePersonalQueue, sin segundo filtro de capacidades ni grafo propio. Cuenta categorías pending mutuamente exclusivas, sender/conflict/rejected separados y total personal no resuelto con bandera conservadora. Schema mantiene suma de pendientes vigente, bandera coherente con count personal y count acotado por estados no resueltos. Superseded no es ACK de hijos; solo no bloquea proyección personal si no quedan intenciones pendientes. Conteo no autoriza envío ni declara convergencia, sin IO/normalización/hookactivo.

Cuatro tests/16aserciones: movimiento histórico con descendiente y contenido independiente, ACK frente a superseded, estados personales en vuelo/conflicto/rechazo sin doble conteo, cuenta/grafo y contrato de counts/clones. DoD383pass/86opt-inskip/0fail/6469aserciones/lint469/tipos/build34recursos/diff aprobados sobre fuentes estables. Entrada25%5h/73%7d trasfd1e090, reserva4%/1%, root paralelo disjunto con readiness. Siguiente11c4a5i lectura de índices centrales con prueba Mongo propia; después frontera mixta y conexión compacta del cliente según contrato. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a5i — Readiness de índices personales

Helper server-only de lectura selecciona exactamente tres índices explícitos tags/item_views del registro central. Verifica definición completa relevante: nombres únicos, orden de claves, unique, filtro canonical JSON y opciones sparse/hidden/collation/TTL; metadata Mongo inocua v/ns/background no cambia la decisión. Devuelve sólo ready/nombres missing/incompatible, sin datos de cuenta. NamespaceNotFound Mongo26 equivale a ausencia; otros errores propagan para no anunciar falso ready. No create/drop/provisión personal propia; getCollection conserva bootstrap automático existente del singleton. No caller activo ni nuevo índice registrado.

Diez tests mock/46aserciones y prueba Mongo real: DB exacta del descriptor, ensureIndexes central sólo en DB propia, readinesstrue y listIndexes antes/después iguales. Runner incluye nuevo test explícitamente,56pass/0fail/620aserciones/13files y recursos propios limpios. FullDoD393pass/89opt-inskip/0fail/6515aserciones/lint471/tipos/build34recursos/diff correctos. Entrada20%5h/72%7d tras764ab5d publicado, reserva4%/1%. Fuente/revisión root y tests worker disjuntos; última preparación paralela11c4a6p pullresponse privada, después revisar coste de siguiente acción y cerrar con reprogramación verificada. No autorización de índices/DB del usuario. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a6p — Descarga mixta privada preparatoria

Servicio server-only independiente con puertos de actor, readiness y journal. Exige cuenta esperada; rechaza parámetros duplicados, desconocidos o fuera de límites antes de leer índices o datos. Todas las respuestas son privadas, no-store y anuncian exclusivamente transporte 2. La cuenta incorrecta y el cursor adelantado tienen códigos específicos; los demás fallos ocultan detalles internos. Readiness incompleta impide leer el journal. Valida la página completa contra actor, consulta capturada, checkpoint y stores admitidos; entrega un clon de la consulta al reader para impedir que cambie la validación posterior.

Ocho tests nuevos y regresión legacy: 13 tests/307 aserciones. DoD global: 401 pass, 89 opt-in skip, 0 fail, 6796 aserciones; lint 474 archivos, tipos, build con 34 recursos neutros y diff correctos. Sin rutas/actions/config ni callers activados. Entrada 16%5h/71%7d, reserva 4%/1%. Siguiente corte pequeño: readiness del servicio de envío mixto antes de conectar fronteras reales y clientes. Commit/push, HEAD remoto y cuotas al cierre.


### Resultado 11c4a6s — Guardia del envío mixto

Servicio server-only independiente que reutiliza pushSyncBatchV2. Actor, cuenta esperada, envelope y versión se validan antes de readiness. Comprueba índices una vez por invocación válida, inmediatamente antes del primer executor; ausencia, inconsistencia o error conserva todas las intenciones mediante retry_later vacío y UUID de la primera operación. No guarda readiness entre invocaciones ni promete que los índices sean inmutables. Si falla una operación posterior, conserva el prefijo durable validado del servicio existente. Fallos del puerto de autenticación propagan un error genérico sin cause ni detalles privados, sin inventar unauthorized o ACK.

Seis tests nuevos y batch vigente: 12 tests/116 aserciones; suite global 407 pass, 89 opt-in skip, 0 fail, 6853 aserciones. Lint 476 archivos, tipos, build con 34 recursos neutros y diff correctos. Sin callers/rutas/actions/config ni DB del usuario. Entrada 12%5h/71%7d; reserva 4%/1%, cierre documental y revisión del reinicio después de publicación. Siguiente candidata 11c4a7p: preparar frontera autenticada real y pruebas de transición, sin activar parcialmente categorías antes de índices y cliente mixto. Commit/push, HEAD remoto y cuotas al cierre.


### Cierre 11c4a8d — Lote del 9 de octubre y siguiente ventana

Objetivo y target_paths: cerrar estado real y presupuesto en plan/master.md, workflow.md, iterations.md, iteration-log.md y mixed-sync-activation.md, con próxima revisión del mismo heartbeat verificada. Dependencias: entregas publicadas hasta 11c4a6s, HEAD de código 4f0dc939f01b9270809db7968a10ad896c11ee20. Aceptación: no código abierto ni falsa activación; siguiente corte definido, fecha futura real y una única revisión pendiente. Validación documental: referencias, consistencia y git diff --check; commit/push en int, HEAD remoto y cuotas después.

Se cerraron prueba mixta de dos dispositivos/Mongo, capacidades/diagnóstico, coordinador, HTTP2, snapshot/dispatch, runtime, piloto conjunto, contrato de activación, núcleo puro de orden, resumen, readiness, descarga privada y guardia de envío. Suite final 407 pass/89 opt-in skip/0 fail; tipos, lint y build aprobados. Todos los recursos de pruebas creados por el lote se limpiaron. El producto sigue en transporte 1: tareas/eventos propios simples activos; categorías/asignaciones preparadas, orden manual/series/compartidos pendientes de sus executors y activación. No se tocaron DB del usuario, hosting, permisos ni secretos.

Lectura después del último código publicado: 9%5h/70%7d, reset real 1791516313 (9 de octubre, 05:25:13 Europe/Madrid). La próxima revisión está confirmada para las 05:27: reinicio más un minuto, redondeado hacia arriba. automation_update actualizó el mismo comprobar-renovaci-n-de-cuota, ACTIVE, misma política failed_runs_only y mismo chat; la revisión histórica alternativa permanece PAUSED. No duplicados ni hora inferida. Revisar cuotas reales al despertar antes de continuar; reserva 4%5h/1%7d y cadena autorizada mientras haya trabajo/margen. Los últimos cortes completos consumieron cuatro y tres puntos; con reparación/publicación/cierre, no cabe la siguiente frontera autenticada completa dentro del margen sobre reserva. Este cierre no abre otro corte de código.


### Resultado 11c4a7p — Adaptadores autenticados y acción mixta preparatoria

Adapters server-only usan por defecto sesión persistida/allowlist, readiness y reader/dispatcher reales, con imports diferidos para no inicializar auth en pruebas de puertos. La acción independiente use-server acepta sólo input unknown, obtiene headers reales de Next y no expone actor ni puertos por RPC. Cada invocación lee sesión fresca; cuenta/protocolo/query y readiness mantienen las guardias de los servicios existentes. Sin sesión o account mismatch no hay DAL; errores internos no se filtran. Ninguna ruta, cliente, anuncio o acción legacy se ha activado o cambiado.

Ocho tests de puertos/109 aserciones prueban headers exactos, sesión nueva, rechazos antes de índices, readiness antes de IO, privacidad y prefijo durable. No se presenta como prueba de RPC Next/Google. Root revisó los cinco archivos. FullDoD sobre estas fuentes y anuncio explícito paralelo estable: 417 pass/89 opt-in skip/0 fail/6982 aserciones; lint481/tipos/build34 recursos neutros/diff correctos. Entrada 100%5h/70%7d renovada; reservas4%/1%, reset real1791534431. Publicación y cuotas al cierre; anuncio explícito 11c4a7h pendiente de su commit independiente y después runner de frontera Next real.


### Resultado 11c4a7h — Identidad con anuncio explícito

Respuesta privada de identidad reutilizable con versión opcional validada por encoder. Sin parámetro conserva exactamente anuncio1; versión explícita2 conserva body/status/no-store y excluye cliente1, sin rango1–2. Versiones inválidas rechazan. Ruta y configuración activas intactas. Tres tests/29 aserciones; dos nuevos. FullDoD ya ejecutada sobre estos dos archivos estables junto a adapters: 417pass/89opt-in skip/0fail/6982 aserciones, lint481/tipos/build34 recursos/diff correctos. No repetir checks caros sin cambios nuevos. Entrada87%5h/68%7d trasbb18501 publicado, reservas4%/1%. Siguiente: runner de frontera Next real y preparación explícita de índices en recursos propios; commit/push/HEAD/cuotas por corte.


### Resultado 11c4a8p — Provisión explícita por puertos

Selector central devuelve copias detached de las tres especificaciones exactas y conserva provisioning explícito; readiness reutiliza la selección. Schema exige nombres conocidos, únicos/disjuntos y bandera coherente. Plan distingue ready/create_missing/blocked sin recibir definición arbitraria. Ejecución sin conexión/defaultcaller reinspecciona antes de cada create y después del último/error, bloquea incompatibilidad, conserva sólo calls resueltas en created y observa posible efecto de un create rechazado. Drift o desaparición de un índice propio devuelve incomplete, sin bucle de reparación. No drop/rename/rollback/deduplicación. Errores finitos para duplicados/definición/creación/inspección, sin mensajes/cause/URI/valores.

Nueve escenarios nuevos más readiness/registro:32 tests/146 aserciones. Root revisó cinco archivos y la suite global sobre fuentes estables junto al panel preparado:428pass/89opt-in skip/0fail/7058 aserciones; lint485/tipos/build34 recursos/diff correctos. No DB conectada ni CLI/caller/índices nuevos. El bootstrap automático vigente sigue separado; no afirmar inspección de conexión totalmente readonly. Entrada86%5h/68%7d tras950617a, reservas4%/1%. Siguiente prueba Mongo propia del planner/provisión y CLI revisable, además de fixture Next en paralelo disjunto. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a9u — Panel compacto preparado para resumen mixto

El panel existente admite summary2 y un alcance opcional explícito. Default mantiene el texto de transporte1; sólo un caller futuro seleccionará categorías/asignaciones sincronizadas. Orden de tareas y repetición siguen descritos como locales. Contador personal compacto indica conservación de categorías/asignaciones cuando la proyección está retenida; settled conserva pendientes/conflictos visibles y no declara convergencia. No nueva tarjeta grande, ruta, nav, hook o transporte activado.

Dos tests nuevos de render; seis tests/25 aserciones del panel, incluida sesión/cola/protocolo vigente. Root fullDoD sobre archivos estables:428pass/89opt-in skip/0fail/7058 aserciones, lint485/tipos/build34 recursos/diff correctos. Sin repetir global tras sólo docs. Entrada68%5h/65%7d tras25cd628, reservas4%/1%; siguiente RPC Next propia y prueba Mongo de provisión. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a8m — Provisión parcial con MongoDB real propio

Modo aislado indexes consume el descriptor validado y ejecuta sólo la prueba de provisión en una DB nueva propia. Dos escenarios/20 aserciones pasan: duplicado sintético causa fallo unique después de dos creaciones confirmadas, conserva registros y resultado saneado; limpieza explícita de la única fixture duplicada permite crear sólo el índice pendiente, y ready no crea. Una respuesta perdida tras create real no se incluye falsamente en created, pero readiness observa el efecto y el reintento crea sólo los restantes. Índices y registros limpiados son exclusivamente los del run; contenedor/tmpfs/proxy propios cerrados y runner exit0. Sin DB del usuario ni reparación automática.

FullDoD sobre fuentes estables, incluido harness Next preparatorio todavía sin ejecutar:431 pass/93 opt-in skip/0 fail/7074 aserciones; lint491 archivos, tipos, build34 recursos neutros y diff aprobados. Entrada67%5h/65%7d, reservas4%/1%. La prueba RPC Next es un corte independiente pendiente de build y navegador, no evidencia Google. Commit/push/HEAD remoto y cuotas al cierre.


### Resultado 11c4a7n — Frontera RPC Next real en recursos propios

App Next temporal compila y arranca en dos procesos/orígenes loopback con env sintético explícito y MongoDB del descriptor propio. Cliente llama una referencia Server Action compilada de wrapper exclusivo del fixture; capability y cookies propias se verifican dentro de la RPC antes de invocar acción2 productiva sin puertos ni actor. Defaults reales usan sesión Better Auth persistida/allowlist, readiness, dispatcher y DAL. No es el ID exacto de la acción productiva desplegada ni Google interactivo. Dos hosts aíslan cookies; registry privado por run compartido entre chunks reconoce sólo valores propios, cookies ajenas bloquean sin sobrescribir/borrar. Cleanup selecciona sólo cookies/sesiones/procesos/archivos registrados y timeout10min acota espera; fallos muestran sólo fase/HTTP/categoría finita.

Siete escenarios aprobados en navegador integrado: RPC sin sesión no escribe; dos sesiones de la misma cuenta; crear tarea/categoría/asignación con tres recibos y journal3, ambas descargas iguales a Mongo; replay conserva revisiones/diario; cuenta/versiones incompatibles no escriben; revocación y caducidad rechazan sin afectar la otra sesión; usuario no verificado rechazado. Correspondencia y applied se validan contra intención original. Recursos propios y cookies limpiados; runner exit0, pestañas propias cerradas. Captura de evidencia local /private/tmp/dalis-next-rpc-proof-20261009.jpg. Prueba funcional del servidor, no proyección IndexedDB de producto; evidencia de runtime/coordinador de dos dispositivos permanece en11c4a4p.

La compilación detectó alias absolutos interpretados como relativos por Turbopack y la prueba de readiness corrigió runId. Next16 instalado normaliza127.0.0.1 a localhost en Request.url; fixture valida protocolohttp y Host exacto registrado, mantiene Origin/capability y no modifica configuración experimental. Templates compiladas reales y app normal build34 recursos aprobados; no routing/config/auth productivos alterados. FullDoD final432pass/93opt-in skip/0fail/7079 aserciones, lint491/tipos/build34/diff. Cuatro tests/21 aserciones de guardias incluyen Host normalizado, Host/Origin/protocolo ajenos y rechazo de forwarded-only; ningún cambio funcional al recorrido ya aprobado. Entrada45%5h/62%7d tras26d2738; lectura durante cierre26%/59%, reservas4%/1%. Siguiente: destino/CLI de provisión revisables y conexión conjunta del cliente según contrato; no ejecutar índices en DB del usuario sin autorización de entorno. Commitpush/HEAD/cuotas al cerrar.


### Resultado 11c4a8v — Definiciones revisables sin conexión

Comando db:preview-personal-indexes imprime JSON inglés con scope offline_definition_preview/databaseAccess none y las tres especificaciones exactas del selector central. No acepta argumentos ni apply; no llama auth/getDatabase/readiness/ensureIndexes. Usa condición react-server instalada, sin mocks. Smoke ejecutado con entorno vacío y --no-env-file pasa sin variables Mongo/auth, selección exacta y provisioning explicit comprobados; --apply rechaza con exit1 y sin JSON parcial. El launcher bun run puede heredar variables de su padre, pero la vista previa no las consume; para revisión aislada usar bun --no-env-file run db:preview-personal-indexes. No prueba disponibilidad de índices de un entorno ni autoriza crearlos.

FullDoD432pass/93opt-in skip/0fail/7079 aserciones, lint492/tipos/build34/diff correctos. Sin tests redundantes añadidos por script reversible; smoke verifica el comportamiento solicitado. Entrada22%5h/58%7d, reservas4%/1%. Siguiente: contrato de destino explícito y procedimiento de ejecución autorizado, sin DB del usuario. Commitpush/HEAD/cuotas por entrega.


### Resultado 11c4a8c — Destino y efectos del futuro CLI

Contrato [personal-index-provisioning.md](personal-index-provisioning.md) cierra destino explícito, autoridad sin credenciales, DB sin fallback, autorización de conexión concreta y nueve índices automáticos del singleton además de tres personales. No ofrecer inspección readonly: getDatabase puede crear índices automáticos faltantes antes de readiness. CLI sigue sin implementar; preview offline vigente no conecta. Servicio personal existente conserva partial-create/retry/error incierto y nunca rollback/deduplicación. Cortes siguientes guardia pura11c4a8g, adaptador/CLI11c4a8e, prueba propia11c4a8t, conexión conjunta/piloto autorizado.

Sólo docs: referencias, consistencia con fuente/registro y diffcheck validados, sin repetir suite/build estables432pass/93skip. Entrada20%5h/58%7d, reservas4%/1%. Commitpush/HEAD/cuotas al cierre. Sin DB del usuario ni cambio de permisos/hosting/protocolo activo.


### Resultado 11c4a8g1 — Descriptor de destino comparado sin IO

Schema estricto exige entorno declarado local/preproduction, DB explícita conservadora y autoridad de conexión ya resuelta sin userinfo/URI/ruta/query/whitespace. Guardia pura compara DB/autoridad exactas con configuración resuelta y devuelve copia; todo rechazo usa error finito sin cause ni valores. No lee env, interpreta URI, conecta ni acredita ownership/autorización. Formato completo/resolución de autoridad desde URI y ausencia de fallback del lector son dependencia11c4a8g2; esta guardia no debe conectarse a CLI directamente con getDatabaseEnv fallback.

Dos tests/54 aserciones: coincidencia/copia, descriptores loopback/seedlist/IPv6, mismatch exacto frente a substring, production/extra/ausencia y datos inseguros sin filtración. FullDoD434pass/93opt-in skip/0fail/7133 aserciones; lint495/tipos/build34/diff correctos después de corregir literal de entorno del test. Sin Mongo/browser adicionales porque no IO ni cambios al producto. Entrada19%5h/57%7d, reservas4%/1%. Siguiente11c4a8g2 resolver/config, antes de adaptador de conexión. Commitpush/HEAD/cuotas al cierre.


### Resultado 11c4a8e1 — Revisión offline del alcance completo

Preview conserva indexes personales y añade automaticIndexes desde automaticIndexSpecs, el selector real del bootstrap del singleton. Nueve automáticos y tres explícitos actuales quedan separados, sin duplicados ni una segunda lista. No conecta, lee env o admite argumentos/apply; smoke en proceso con entorno vacío/--no-env-file confirma salida íntegra y rechazo exit1 sin JSON parcial. No ejecutar este JSON como instrucciones ni anunciar readiness; es revisión de definiciones del código.

FullDoD434pass/93opt-in skip/0fail/7133 aserciones; lint495/tipos/build34/diff y referencias correctos. Sin nuevos tests redundantes por extensión de presentación; separación del catálogo ya cubierta por pruebas centrales. Entrada17%5h/57%7d, reservas4%/1%. Adelanto offline independiente cerrado;11c4a8g2 resolver/configuración permanece siguiente antes del adaptador/CLI online. Commitpush/HEAD/cuotas por entrega.


### Resultado 11c4a8g2 — Configuración explícita y autoridad sin conexión

Parser puro y getter config/env.ts derivan descriptor desde MONGODB_URI/MONGODB_DB raw explícitos, sin fallback. URI mongodb/SRV, userinfo escapado, lista ordenada de seeds, puertos y IPv6 conservadores; SRV único sin puerto. Devuelve sólo DB/autoridad exacta sin credenciales/ruta/query, errores genéricos sin cause/URI. No abre conexión ni muta env; comparación exacta reutiliza guardia previa. Referencia: parser del paquete del driver instalado, sin importarlo como dependencia nueva. No parser completo de opciones/disponibilidad ni sockets Unix; rechaza formas ambiguas/duplicadas, caracteres sin escapar y puertos fuera de rango/ceros iniciales.

Dos tests nuevos/81 aserciones y guardia:4 tests/135 aserciones. FullDoD436pass/93opt-in skip/0fail/7214 aserciones; lint497/tipos/build34/diff correctos. Pruebas usan objetos sintéticos, sin modificar variables globales ni DB. Entrada16%5h/57%7d, reservas4%/1%. Siguiente adaptador/CLI online11c4a8e2 y prueba propia11c4a8t, antes de autorización de entorno/conexión conjunta. No activar producto ni ejecutar DB del usuario. Último corte de código de esta ventana; commitpush/HEAD/cuotas y cierre con revisión futura real.


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


### 11c4a8receipt — Evidencia mínima de provisión real

Objetivo/target_paths: cerrar el recibo operativo en plan/personal-index-provisioning.md e iteration-log.md. Dependencias: autorización humana preproductiva y ciclo privado preparado; aceptación: procedencia preview/int y descriptor verificados, resultado parcial/readiness/cierre fieles, sin conexión a producción/secretos/documentos ni falsa activación. Sólo docs; referencias/consistencia/git diff --check, commitpushint/HEAD/cuotas. Entrada5%5h/55%7d, reserva4%/1%. Resultado: criterios documentados para registrar provisión real separada de fixtures; no se ejecutó ninguna DB. Mantener revisión10:29 y siguiente defaults/CLI/prueba propia con ventana renovada.


### Resultado11c4a8e2b — Defaults privados y CLI operador

Adapter server-only reutiliza config explícita, ciclo por puertos, getDatabase singleton, readiness y ensureIndexes central. CLI separado con cinco argumentos exactos, sin URI/credenciales; parser antes de import, exit0 sólo ready+closed. Excepción inesperada produce stderr genérico sin recibo inventado. Tests parser3/126aserciones y smoke entorno vacío config ausente -> failed/configuration/not_opened exit1. Suite443pass/93skip/0fail/7368aserciones, lint503/tipos/build34/diff aprobados. Entrada renovación100%5h/55%7d, reservas4%/1%, reset real1791552560 (15:29:20Madrid). No conexión DBusuario ni activación producto. Investigación readonly encontró Vercel Preview/Production URI separadas; falta DB explícita solicitada. Siguiente11c4a8t CLI/defaults/bootstrap real con descriptor propio, después provisión preproductiva autorizada al verificar destino. Commitpushint/HEAD/cuotas al cerrar.


### Resultado11c4a8t — Procedimiento online validado con Mongo propio

CLI real por subprocess sin preloadmock, defaults singleton/config/ensureIndexes y descriptor propio:3pass/70aserciones. Antes de drops de test se acreditan nombre DBfresh, todas colecciones vacías y registro automático; singleton padre queda cached para observar sin reparar automáticamente. Invalidargs/config DB ausente/mismatchDB/autoridad mantienen nueve índices retirados deliberadamente sólo en test. Aplicación válida recrea exactamente9automáticos+3personales y luego noop. Duplicados11000 mantienen documentos/prefijo2/readiness y cierre; eliminación explícita de una fixture propia permite retry sólo active-name restante. Exit0 sólo ready+closed, salida parseada finita, timeout, errores sin URI/PII. Docker28.4/imagepinned8.2.11amd64 revalidados, contenedor/tmpfs/bridge propios limpiados.

Suite443pass/98opt-in skip/0fail/7368aserciones, lint504/tipos/build34/diff aprobados. Root runner modooperator y agenttest con rutas disjuntas, sin DBusuario. Entrada87%5h/53%7d reservas4%/1%. Procedimiento ya validado para actuación preproductiva autorizada; falta nombre DB explícito solicitado tras inspección de VercelPreview. Mientras tanto siguiente ensamblaje cliente2 inactivo/controles mixtos y guardia de retirolegacy, según dependencia de activación; no activar parcialmente producto. Commitpushint/HEAD/cuotas al cerrar.


### Resultado11c4a9c1 — Ensamblaje cliente2 preparado

Dispatcher2 independiente, lector de resumen mixto con identidad capturada/guardias antes y después/cierre seguro, y adapters de intento/scheduler sobre controles existentes. Ocho tests/57aserciones: conserva pendientes personales/diagnósticos de bloqueo, rechaza snapshot/cuenta ajena, coalescencia/cierre/cancelación/backoff y pausa; stopped/account_changed/fallback no retienen diagnóstico. Sin hook/providers/rutas/config activa editados. Manifiesto Next conserva exactamente una acciónnode/ceroedge antes y después: dispatcher2 todavía sin caller productivo. Suite451pass/98skip/0fail/7425aserciones, lint509/tipos/build34/diff aprobados. Entrada75%5h/51%7d, reservas4%/1%. Próximo11c4a9c2 composición privada de runtime/transport/controles2 y prueba; retirolegacy preparatorio y matriz antes de activación. NombreDBpreprod solicitado sigue pendiente, no conexiónusuario. Commitpushint/HEAD/cuotas.


### Resultado11c4a9c2 — Composición privada y retirolegacy

createMixedSyncClient valida userId/epoch compartidos y captura identidad inmutable; enlaza HTTP2, dispatcher/runtime/resumendefaults, SyncAttemptV2 y refreshguardado. Retirement server-only autentica sesiónpersistida y envelope/cuenta, responde estado legacy update_required sin executor/recibos/readiness. Ocho tests/79aserciones; legacyHTTP con handshake1 anterior conserva intención/cursor/historia, libera lease y no aplicaACK. Fallosdeauth saneados sin causes. Ningún calleractivo conectado ni config/rutas actuales cambiadas; manifiesto mantiene una acciónnode/ceroedge. Suite459pass98skip0fail7504aserciones, lint513/tipos/build34/diff aprobados. Entrada68%5h/50%7d reservas4%/1%; commitpushint/HEAD/cuotas. Siguiente pruebaNext de composicióndefaults/directactionref/retirement en recursos propios, sin Google ni activaciónreal; DBpreprod siguependiente de nombre explícito solicitado.


### Resultado11c4a9n — Composición default y acción directa en Next

Nueve escenarios Next compilado con dos sesiones BetterAuth persistidas, dos orígenes/particionesIndexedDB y Mongo propios pasan. Se usa dispatchSyncOperationsV2 directo y createMixedSyncClient sin puertos sustituidos: tres intencioneslocales pending con dependencias reales pasan a acknowledged por ACK remoto; ambos snapshots items/tags/itemViews y cursor coinciden exactamente con journalMongo de seisrecibos. Summary/noop conservan todos los stores e historia; replay no duplica. Retirementfixtureautenticado devuelve legacyupdate_required sin mutaciones. Matriz auth/cuenta/versiones/revocación/caducidad/noverificado conservada.

APIs exactas sólo en proyecto temporal, guardadas por cookiecapacidadúnica delrun y config/Host/Origin/cookiesauthregistradas antes de defaults. Sólo particiones/control sin estado previo creadosporrun; cleanupcontrol/marker/cookiepropios verificado y serializado antesdefinish. Dosservidores/buildtemp/container/tmpfs/bridge/pestañas/cookies/IndexedDB propios limpiados. Evidencia local /private/tmp/dalis-next-client-proof-20261009.jpg. Ningún Googleinteractivo ni ID del deploymentreal acreditados, no DBusuario. Producto permanece1 con unaacciónnode/ceroedge; lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados trascleanup. Entrada58%5h/48%7d reservas4%/1%; commitpushint/HEAD/cuotas. Siguiente recuperación de sesión/epoch con cola local mediante mismacomposicióndefault si cabe; provisiónpreprod mantiene pendiente nombreDBexplicito solicitado.


### Resultado 11c4a9r — Reautenticación con intención local conservada

Diez escenarios del fixture Next compilado pasan. El nuevo caso revoca la sesión del segundo dispositivo, guarda una intención real mediante outbox y obtiene unauthorized antes de claim: todos los stores, UUID/payload, attempts0, lease null y cursor permanecen idénticos; Mongo no cambia. Reautenticar al mismo actor permite un único envío y ACK, con la operación original y attempts1; exactamente un item, recibo y entrada de diario nuevos. Ambos dispositivos descargan y coinciden con las proyecciones y cursor de Mongo; noop conserva ACK/historia sin duplicados. Los nueve escenarios previos se mantienen.

Sólo controller de fixture editado, sin caller activo o cambios de protocolo del producto. Un narrowing de tipos detectado por el build del fixture se corrigió antes de ejecutar; ambos runs limpiaron exclusivamente sus recursos propios. Evidencia /private/tmp/dalis-next-recovery-proof-20261009.jpg. Docker28.4/Mongo8.2.11amd64 fijado revalidados, sesiones/cookies/IndexedDB/servidores/build/container/tmpfs/bridge/pestañas propios cerrados. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada41%5h/46%7d, reservas4%/1%; commitpushint/HEAD/cuotas al cerrar. Producto todavía transporte1, sin Google interactivo ni provisión del usuario. Nombre DB preproductiva explícito sigue pendiente. Próxima prueba acotada de época local si el margen permite cerrar completa.


### Resultado 11c4a9a — Aislamiento al cambiar la sesión remota

Once escenarios Next compilado pasan. Una intención local propia pending, attempts0 y lease null permanece idéntica cuando la sesión persistida es de otro actor verificado del fixture: la composición default devuelve account_changed/upload0 antes de claim. Todos los stores/cursor y Mongo de ambas cuentas conservados. Al recuperar la sesión del propietario original, un único ACK mantiene UUID/payload, attempts1 y revisiones; ambos dispositivos convergen exactamente con el journal/cursor, categorías/vistas anteriores intactas y ninguna escritura en la otra cuenta. El helper común mantiene baseline anterior al ACK y los diez escenarios previos.

Sólo controller de fixture y plan editados. Recursos propios Next/Mongo/cookies/IndexedDB/procesos/build/container/tmpfs/bridge/pestañas limpiados; evidencia /private/tmp/dalis-next-account-proof-20261009.jpg. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada31%5h/44%7d reservas4%/1%; commitpushint/HEAD/cuotas al cerrar. Estado operativo destacado al principio del master y prerrequisito de índices actualizado con autorización vigente, sin otra aprobación. Transporte1 activo, dato DB pendiente; no Google ni DB del usuario. Siguiente preparación de hook mixto o prueba de época según margen de cierre completo.


### Resultado 11c4a9e — Época local invalidada antes del envío

Doce escenarios Next compilado pasan. DTO rotate-local cerrado y guardado opera únicamente el control propio del fixture: activatePreparedAccount del mismo actor con expectedEpoch, seguimiento inmediato de nueva época/marker para cleanup y creación de cliente default nuevo. La cuenta capturada, el resumen y el intento del cliente viejo rechazan específicamente por la guardia Local account changed during the operation; otro error hace fallar el escenario. La intención pending mantiene UUID/payload/attempts0/lease null, todos los stores/cursor y Mongo intactos. La nueva composición confirma un único ACK con intención original y ambos dispositivos convergen exactamente con diario/cursor, categorías/vistas previas e historia sin duplicados. No acredita cancelación de red en vuelo.

Once escenarios anteriores conservados, recursos propios Next/Mongo/IndexedDB/control/cookies/build/procesos/container/tmpfs/bridge/pestañas cerrados. Evidencia /private/tmp/dalis-next-epoch-proof-20261009.jpg. Lint513/tipos/suite459pass98skip0fail7504aserciones/build34/diff aprobados. Entrada22%5h/43%7d reservas4%/1%, ownership agente schema y tres templates/root plan+ejecución. Producto aún1; nombre DB preproductiva pendiente, ninguna credencial leída/conexión al usuario. Siguiente hook mixto inactivo y matriz del despliegue antes de activación conjunta, o provisión ya autorizada si llega el dato. Commitpushint/HEAD/cuotas al cerrar.


### Cierre 11c4a9z — Lote del 9 de octubre, 10:29

Lote completo publicado desde25eca36 hasta9a34fa4f6b691757219ee081394671106bf4d3a4: operador/CLI privado, prueba real de bootstrap y provisión propia, composición/resumen/controles mixtos y retirementlegacy, nueve escenarios Next directos ampliados a doce con conservación de cola y recuperación tras revocación, cuenta remota distinta y época local invalidada. Suite459pass/98opt-in skip/0fail/7504aserciones, lint513/tipos/build34 aprobados; producto mantiene transporte1, una acciónnode/ceroedge. Mongo/Next/IndexedDB/cookies/procesos/builds/pestañas propios cerrados y evidencia visual conservada. No DB del usuario ni credenciales leídas, sin dependencias nuevas o cambios de hosting/secretos/permisos.

Provisión preproductiva ya autorizada y procedimiento validado; falta únicamente el nombre explícito de DB solicitado al usuario. Vercel Preview identificado, guía autenticada dejada para continuación. No pedir otra aprobación para los índices, no convertir fallback/.env.local en destino aprobado, no tocar producción ni reparar datos. Hay trabajo independiente:11c4a9h hook mixto inactivo con cache separado, lifecycle real y guardias; conexión conjunta posterior condicionada al recibo ready+closed. Target_paths y matriz de referencia antigua ausente concretados en mixed-sync-activation.md. No confundir prueba de referencia Next local con ID desplegado/Google o cancelación en vuelo.

Lecturas14%5h/41%7d tras último código y13%/41% durante cierre; reservas4%/1%. Cortes anteriores10/9/8puntos sin promesa de coste futuro: siguiente hook más prueba/reparación/publicación/cierre no cabe con seguridad. Sólo documentación y revisión futura; repo sin código abierto. Reinicio vigente verificado1791552560,9oct15:29:20Madrid, hora observada de cierre11:45Madrid. Una sola revisión de comprobar-renovaci-n-de-cuota actualizada y verificada ACTIVE para9oct15:31Europe/Madrid (reset+unminuto y redondeo), COUNT1, failed_runs_only y mismochat. Automatización histórica alternativa siguePAUSED, no duplicados/TOML manual/cron/hora supuesta. Próximo despertar verifica ambas cuotas/renovación/HEAD y continúa mientras haya trabajo útil/margen; reservas4%5h/1%7d y autorización encadenada vigentes, sin créditos/reinicios. Validación referencias/consistencia/diff y commitpushint/HEAD/cuotas al cierre.


### 11c4a8pre — Nombre confirmado; acceso pendiente de Vercel

El usuario confirma dalis-tasks-events como nombre de DB preproductiva. Se revalidó la misma guía del recurso Preview identificado previamente; Show secret solicita Reauthenticate y queda deshabilitado hasta verificar identidad. Captura privada se abortó sin obtener URI, fichero de credenciales ni conexión Mongo; ninguna ejecución del operador, índice o mutación remota. Se pidió únicamente completar la verificación de Vercel en su propia pestaña, sin códigos en chat ni otra aprobación de índices. CLI/procedimiento siguen validados y autorización vigente; tras verificación reanudar captura privada/descriptor explícito/ejecución única/readiness/cierre, no reabrir pregunta del nombre.

Entrada10%5h/41%7d reservas4%/1%. Este corte no activa producto ni modifica código. Validación documental referencias/consistencia/diff, commitpushint/HEAD/cuotas al cerrar si el acceso no queda disponible. Mantener revisión única15:31 con prompt actualizado a nombre confirmado y gate de reautenticación. Fuera de la provisión, siguiente hook mixto inactivo11c4a9h requiere ventana nueva.


### Actualización 11c4a8pre — Identidad verificada; ejecución aplazada por cuota

El usuario completó Reauthenticate. La URI del mismo recurso Preview se capturó en fichero temporal privado600 y se volvió a ocultar; no se imprimieron credenciales. El launcher no inició el CLI: primer fallo por condición react-server ausente en el proceso padre; segundo por pasar el campo de procedencia source al schema estricto de conexión. Ambos anteriores a spawn/conexión. Para siguiente ejecución usar --no-env-file --conditions=react-server en padre e hijo y pasar al resolver únicamente {mongodbUri,databaseName}, verificando procedencia aparte. La corrección del launcher se identificó pero no se ejecutó otra conexión. El finally eliminó el fichero de credenciales; launcher propio retirado al cierre. Ningún índice/DB/documento remoto tocado ni recibo de provisión inventado.

Lectura real4%5h/40%7d: no abrir otra ejecución sobre reserva4%/1%. Nombre y verificación Vercel ya confirmados; única revisión15:31 preservada con prompt actualizado. Próximo lote revalida fuente Preview, recaptura URI privada y ejecuta procedimiento ya probado; no repetir pregunta del nombre ni pedir nueva autorización. Producto permanece1. Este corte cierra documentación y diagnóstico, no provisión completada; referencias/diff/consistencia, commitpushint/HEAD/cuotas.


### Resultado11c4a8pre2 — Índices Preview listos

Fuente revalidada: guía del recurso conectado a MONGODB_URI Preview de Vercel, diferente del recurso Production previamente identificado; nombre dalis-tasks-events confirmado por el usuario. Credenciales capturadas sólo en fichero privado600 fuera del repo, ocultadas de nuevo en Vercel y eliminadas después de ejecutar; no URI/credenciales/autoridad ni datos en logs/versionado. Launcher propio retirado. Padre e hijo con --no-env-file --conditions=react-server, resolver estricto sólo {mongodbUri,databaseName} y procedencia validada aparte.

CLI real preproduction con destino explícito y acuse bootstrap autorizado terminó exit0: status ready, phase complete, connection closed; provisioning ready, created item_views_user_item_uidx, tags_user_id_uidx, tags_user_active_name_uidx; readiness ready:true/missing:[]/incompatible:[], error:null. Singleton/ensureIndexes registrados usados, sin índices ad hoc ni corrección/borrado de documentos. Sólo la DB preproductiva autorizada; no producción/hosting/secretos/permisos. Recibo acredita provisión, todavía no activación del producto ni Google/convergencia desplegada. Procedimiento previo probado con Mongo propio; este corte operativo/documental valida recibo, referencias, consistencia y diff. Commit/pushint/HEAD/cuotas; siguiente11c4a9h y conexión conjunta con prueba de transición.


### Resultado11c4a9h — Hook mixto y lifecycle comprobados

useMixedSyncEngine reutiliza composición/controladores2, clave de resumen separada por cuenta/época/transporte, estado/controlador con ownership y cleanup guardado. Trece escenarios Next compilado pasan con sesiones/IndexedDB/Mongo propios: notificación de outbox refresca resumen, hook confirma la intención original una sola vez y ambas particiones convergen; rerender del mismo componente sin key descarta summary/busy/result de época vieja. Desmontaje idle elimina señales/listeners/scheduler; una intención posterior permanece pending/attempts0/lease null tras señales de despertar y1200ms sin reports ni efectos Mongo, antes de recuperación independiente. No acredita cancelación de red en vuelo.

Fixture extraída en tres componentes/helpers propios con cache SWR aislada y sentinellegacy conservado; cleanup awaited antes de borrar exclusivamente particiones/control/cookies propias. Recursos Next/Docker/Mongo propios cerrados, evidencia /private/tmp/dalis-next-hook-proof-20261009.jpg. Suite459pass/98skip/0fail/7504aserciones, lint514/tipos/build34/diff aprobados. Producto todavía1, índices Preview ready+closed. Siguiente conexión conjunta11c4a10 con matriz de referencia antigua ausente y fronteras/proveedor reales antes de push; sin otra actuación sobre índices ni dependencias core.


### Resultado11c4a10 — Activación conjunta del transporte2 en int

Identidad anuncia2 explícito con sesión autorizada; cambios delega en adapter autenticado mixto; legacy push deja de ejecutar y responde retiro compatible si su referencia existe. ActiveSyncProvider/SyncContext/hook/resumen2 y alcance compacto de Ajustes conectados conjuntamente. Aviso mínimo enlaza Ajustes cuando la proyección personal permanece bloqueada, incluso con settled. Intenciones/defaultslegacy permanecen1; ningún rango1–2, nuevo índice desde requests o ACK de task.move. Production no provisionada: su rollout queda condicionado a actuación separada autorizada, nunca a este pushint.

Catorce escenarios Next compilado pasan, ahora usando GET de las rutas de producto y ActiveSyncProvider/SyncContext reales detrás de guardias propias. Referencia candidata42hex verificada ausente del manifiesto propio: probeHTTP404/x-nextjs-action-not-found y dispatcher real callServer rechazado como UnrecognizedActionError. Runtimelegacy con snapshot previo1 explícitamente capturado produce retry_later, conserva todos los stores/cursor/UUID/deps, libera leasepropio y sólo aumenta attempts a1; siguiente handshakeHTTPactual2 devuelve update_required antes declaim. Mongo intacto en ambas pasadas; recuperación2 da ACK real único con attempts2 y dos particiones convergentes. No acredita ID de otro deployment ni handshake1 actual, Google o cancelación en vuelo.

Suite460pass/98skip/0fail/7507aserciones, lint514/tipos/build34/diff aprobados. Manifiesto del producto: una acciónnode pushSyncOperationsV2, ceroedge; legacy action eliminada del build sin conservarendpointficticio. Recursos Next/Mongo/IndexedDB/cookies propios limpiados; evidencia /private/tmp/dalis-next-activation-proof-20261009.jpg. Índices Preview ya ready+closed en b7f0aaa. Commit/pushint/HEAD/cuotas; siguiente15a2 piloto preproductivo real con Google, recarga y comprobación de categorías/asignaciones. Pedir sólo intervención de acceso/dispositivo que realmente falte, no repetir aprobación de índices. Ordenmanual/series/compartidos siguen fuera.


### Resultado15a2f — Selector de tareas corregido; piloto histórico conservado

El deployment e54d93f se observó Ready en Vercel. El cliente PWA anterior mostró update_required sin borrar sus cuatro elementos; cerrar la última pestaña Dalis y reabrir activó el alcance mixto manteniendo la sesión Google. La categoría propia «Piloto sync 9 oct 2026» pasó a cola vacía. La tarea propia «Piloto asignación 9 oct 2026» se creó, pero su selector emitió task.move, fuera del alcance remoto; Ajustes terminó la revisión conservando un pendiente personal sin soporte. No es un ACK ni convergencia de la asignación.

TaskList conecta ahora el selector a useItemCategory/assignLocalCategory: elegir/quitar usa item-view.set sin escribir colocaciones; reordenación explícita continúa task.move local. Busy/error/foco y bloqueo de elección rápida conservados. Prueba real de TaskList/hooks/IndexedDB en origen loopback separado: asignar Casa y quitar produce exactamente dos nuevas item-view.set pending/attempts0/lease null, con items, colocaciones y entradas anteriores intactos. Cinco casos anteriores de orden y recarga pasan; inspección tras recarga repite persistencia y selector. Control y particiones propios limpiados. La primera prueba rechazó correctamente un origen con control previo; no se borró ese control ajeno al run. Evidencia /private/tmp/dalis-category-selector-proof-20261009.jpg.

Suite460pass/98opt-in skip/0fail/7507aserciones, lint515/tipos/build34/diff aprobados. Queda el movimiento histórico del piloto en preproducción: preservado, bloquea la cadena y proyección personal según contrato. No convertirlo en item-view.set, modificar dependencias, borrar ni fabricarACK. El fix evita nuevas asignaciones mediante task.move; no resuelve por sí solo colas históricas. Falta validar deployment del fix y piloto real con partición de segundo dispositivo; dos pestañas IAB no son dos dispositivos. La recuperación de ese bloqueo necesita ejecutor de movimientos o una elección explícita respaldada por contrato/ejecutor, aún inexistente para unsupported. No declarar categorías/asignaciones completamente resueltas en esta cuenta mientras permanezca.

El usuario pide cerrar categorías/asignaciones y después recibir porcentaje estimado y titulares restantes en orden óptimo, para elegir siguiente bloque. No continuar automáticamente a bloques ajenos tras cerrar ese objetivo. Pedir sólo intervención de dispositivo/acceso/decisión que realmente falte. Commit/pushint/HEAD/cuotas al cierre.


### Cierre15a2f — Deployment listo y criterio pendiente

Commit1a6911899fd16adf2dd7aa00e69d9f85075cb750 publicado y HEAD remoto exacto verificado; Vercel Preview EqJ7xmXaBiCfet2PFjLJiHLfWcaF mostró Ready con ese commit. La app avisó de actualización; cerrar la última pestaña y reabrir conservó Google, siete elementos y el pendiente personal sin soporte. No se modificó la intención task.move del piloto ni se declaró ACK/convergencia. Lectura tras commit36%5h/30%7d; cierre por decisión de alcance pendiente, no por cuota. Sólo IAB y MCP Apps disponibles: no segundo perfil de navegador independiente para piloto vivo.

Se solicitó al usuario elegir entre completar orden remoto para conservar/sincronizar el movimiento histórico o desarrollar recuperación explícita para mantenerlo sólo local y reenviar asignación. Ambas necesitan implementación y evidencia, no son herramientas ya disponibles. Según su petición de interrumpir si hace falta criterio y esperar elección tras cerrar categorías/asignaciones, se pausó comprobar-renovaci-n-de-cuota conservando nombre/chat/RRULE/notificaciones failed_runs_only; no nueva revisión encadenada. No comenzar trabajo dependiente sin respuesta. Al cerrar la sincronización, informar porcentaje total estimado y titulares pendientes en orden óptimo antes de otro bloque. Código íntegro aprobado; este cierre sólo verifica referencias/coherencia/diff y termina commitpushint/HEAD/cuotas.


### Resultado11c5a2 — Plan remoto puro de movimientos simples

Planner valida catálogo íntegro propio (10000 por familia), identidades/revisiones/categorías y ancla canónica; CAS primario por colocación y revisiones independientes de cada efecto. Reutiliza planTaskPlacements/orden implícito/reductor de vistas. Day exige fecha actual de tarea; overdue interpreta command.date como día civil declarado, sin comparar hora actual ni zona remota. Tarea completada/reprogramada, vecinos obsoletos, tombstones y series/ocurrencias conservan rechazo/unsupported; ninguna intención histórica reescrita. Categoría y compactación son efectos conjuntos acotados512KiB antes de journal; contenido intacto. Sin Mongo/ACK/callers/capacidades activos nuevos.

Siete tests/45aserciones prueban creación, cambio categoría, CAS/ausencia/tombstone, atraso tardío/cambio fecha/completado, vecinos/ranks implícitos/compactación, corrupción/aislamiento/catalog10001 y5000efectos que exceden bytes sin salida parcial. Suite467pass/98opt-in skip/0fail/7552aserciones, lint519 sinruido/tipos/build34/diff aprobados. Próximo11c5a3: repo de colocaciones/índice explícito y catálogos propios acotados items/views, con CAS/rollback Mongo antes de executor multiefecto. El piloto histórico sigue pendiente hasta activar toda cadena. Commitpushint/HEAD/cuotas al cierre; usuario eligió conservar/sincronizar el movimiento.


### Resultado11c5a3 — Repositorio y catálogos completos probados

RemoteTaskPlacementRepository usa singleton/sesión, _id compuesto actor/scope/fecha/identidad, key canónica, revisión positiva y CAS por cada documento; duplicado fuera de TXfalse y dentro aborta, tombstone no resucita. Catálogos de placements/items/views propios, deterministas y limit10001 rechazan exceso/corrupción sin recortar. Una misma snapshot ve lecturas/escrituras conjuntas y rollback tardío conserva todo. Único índice registrado task_placements_user_scope_date_occurrence_uidx explícito cubre identidad y catálogo, no automático. Selección productiva personal permanece3 índices tags/views: test existente actualizado para comprobar su subconjunto explícito, no asumir todos los índices staged de features futuras. Target_paths de reparación acotada incluye mixed-sync-index-provisioning.test.ts.

Docker28.4.0 e imagen local fijada8.2.11amd64 revalidados. Mongo propio62pass/0fail/733aserciones14archivos, seis casos nuevos: aislamiento compuesto, CAS/metadata/tombstone, corrupción, catálogos own/sort/tombstones, snapshot/rollback/duplicado y exact10000frente10001 en tresfamilias. Runner exit0 limpió únicamente contenedor/tmpfs/bridge propios. Suite468pass/106opt-in skip/0fail/7555aserciones, lint521/tipos/build34/diff aprobados. No DBusuario/índices en preproducción nuevos, executor/capacidades/UI sin activar.

Siguiente11c5a4: executor multiefecto con replay/actor/catálogo en misma TX, CAS cada placement y vista, receipt+journal atómicos/rollback/races; luego autorización del reader, ACKpull/snapshot/incidentes y prueba dosdispositivos antes de activar. Revisión readonly detectó que lectoresclientes2 rechazan placements; transición obligatoria negociación3 separada de sobres/evidencia2/intenciones1, retiro acción2 incluso después de identity2/pull2 capturados, acción3/cache3 y matrixNext. No saltarse esta transición ni anunciarordenremoto por registrar repo. Movimiento histórico del piloto intacto. Commitpushint/HEAD/cuotas al cierre.


### Cierre11c5a3 — Continuación tras renovación

8c70e49 completo y HEADorigin/int verificado; repo limpio, pruebas propias cerradas. Lectura5%5h/25%7d: no abrir executor/transacciones sobre reserva4/1. Reset real1791570682 (9oct20:31:22Madrid), reloj de cierre16:49Madrid. Una única revisión del mismo heartbeat reactivada/confirmada ACTIVE para9oct20:33Madrid, reset+unminuto redondeadoarriba, COUNT1/failed_runs_only/chat preservados; sin duplicados/créditos/reinicios. Elección humana de completar orden remoto reanuda este objetivo; no otros bloques después de cerrar categorías/asignaciones sin su elección. Siguiente11c5a4 executor multiefecto preparatorio, luego reader/ACKpull/incidentes y negociación3 con retiro de acción2 antes de activación. Task.move histórico intacto y aún pending. Validación documental coherencia/referencias/diff; commitpushint y consulta final de ambas cuotas.


### Resultado11c5a4 — Movimientos propios atómicos preparados

Ejecutor privado valida/replay común primero, catálogos íntegros en snapshot y CAS independiente de cada colocación/vista; receipt, journal y secuencia comparten TX. No caller/capacidad activa ni índices en DBusuario. Ocho casos Mongo nuevos pasan: compactación tres efectos/contenido intacto, replay exacto tras revocar acceso y UUID reuse, CAS principal frente vista independiente/tombstones, aislamiento/errores/kinds, rollback tardío completo, corrupción de cuatro catálogos, carreras y overdue civil declarado con snapshot. Mongo70pass/0fail/883aserciones15archivos; recursos propios retirados. Suite468pass/116opt-in skip/0fail/7555aserciones; lint523/tipos/build34/diff aprobados. Próximo reader autorizado y ACK/proyección/pull/incidentes; negociación3 y retiro2 obligatorios antes de activar. Movimiento del piloto conservado, aún sin ACK productivo. Cierre commitpushint/HEAD/cuotas.


### Resultado11c5a5 — Lectura privada y ACK puro de colocaciones

Reader envelope2 admite colocaciones sólo con placement/tarea propios actuales y tags históricos/actuales propios en snapshot; tombstones conservan ownership, ausencia/foreign rechaza página completa. ACK puro usa switch explícito de primary taskPlacementEntityKey aunque el comando tenga tagId; proyección conserva colocaciones, vista, secundarios, revisiones/evidencia y rebase exclusivamente de dependientes directos pending/attempts0. UUID/payload/intentadas sin reinterpretación. Tests incluyen historia tras cambiar categoría/tombstones y ausencias/foreign placement/task/tags; ACK/rebase/overdue/conflictos/replay tardío/tombstones/guardias puros. Mongo72pass/0fail/904aserciones15archivos/limpieza propia; suite473pass/118opt-in skip/0fail/7634aserciones, lint523/tipos/build34/diff aprobados. Primera compilación leyó fixture paralelo aún en edición y falló tipos; la final tras READY pasó. Productores/capacidades permanecen desconectados; IDB/incidentes/transición3/readiness pendientes. Commitpushint/HEAD/cuotas; piloto histórico intacto.


### Resultado11c5a6 — ACK/pull IndexedDB de colocaciones

Snapshots acotados, escrituras personales/ACK/evidencia y cursor incluyen colocaciones en la misma TX; páginas mantienen efectos íntegros y rechazan settings, cuentas ajenas y fechas overdue no canónicas. Rebase/conservación de intentadas y reconciliación completa reutilizan el plan puro. IAB ownorigins4191/4192:14 checksACK y9pull observados completos (conteo real, no15 preliminar); revision1/8/4, dependientes/UUID/intentadas, replay/shadows nuevos/tombstones, rollback tardío de placement/outcome/cursor, cadena pendiente/proyección y fila10001. Primeras ejecuciones encontraron comparaciones raw/canonical y sort que mutaba snapshot en fixture; corregidos sin alterar producto y repetición completa aprobada. Particiones propias eliminadas, pestañas/servers propios cerrados; pruebas no sustituyen executor integrado/two-device/Google. Evidencia /private/tmp/dalis-placement-ack-proof-20261009.png y dalis-placement-pull-proof-20261009.png. Suite474pass/118opt-in skip/0fail/7638aserciones, lint523/tipos/build34/diff aprobados. Sin productores/capacidades nuevos ni DBusuario. Próximos incidentes que lean placements actuales, compatibilidad3/readiness/prueba integrada antes de activar. Commitpushint/HEAD/cuotas.


### Resultado11c5a7 — Incidentes con colocación actual

Overview exige catálogo local de placements canónicos y lo lee junto a seis stores en TX readonly; current/localAtOutcome/base/remote conservan versiones independientes y no inventan null. Schema canónico compartido extraído de personal-snapshot, sin default vacío que oculte un reader incompleto. Componente existente muestra día/atrasadas, posición y categoría/revisión/tombstone de forma compacta; sin nueva resolución ni botones inexistentes. Dos tests puros prueban conflicto overdue y vista dependiente, intenciones intentadas/congeladas/grafo, clones/foreign/duplicates/canonical. Test componente día/atrasadas y15 checksACK/incident en IAB real completados: cambio posterior de posición sólo actualiza current; lectura de siete stores readonly exacta. Evidencia /private/tmp/dalis-placement-incident-proof-20261009.png, particiones/servers/pestañas propios cerrados. Suite477pass/118opt-in skip/0fail/7693aserciones, lint523/tipos/build34/diff aprobados. Próxima compatibilidad negociación3/retiro2, readiness e integración antes de activar; task.move histórico intacto/sinACK productivo. Commitpushint/HEAD/cuotas.


### Resultado11c5a8 — Negociación3 y retiro2 preparados

Factory3 sobre kernel común requiere anuncio3 antesbody; firma/semántica V2 fixed2 y defaultlegacy1 intactos. DTO/push/journal/evidencia2 e intención1 no se reescriben. Matrix legacy/2↔3 rechaza body;3↔3 valida colocaciones/sobres2/cookies/account, deployment tras identidad capturada y guards. Helper de retiro2 autenticaheaders/envelope/expectedUserId y rechaza sin readiness/executor/ACK. Coordinator2 con identity2/pull2 capturados conserva intención/deps/cursor/historia y libera únicamente sulease; siguienteidentity3 bloquea antesclaim. Fallos auth saneados y comandos futuros preservados. Nada conectado a rutas/acción2/client/provider activos: no retirar2 antes de conexión conjunta ni anunciar rango2–3. Suite484pass/118opt-in skip/0fail/7798aserciones, lint527/tipos/build34/diff aprobados. Próxima acción/defaults3 y readiness4 preparatorios, prueba Nextreal retiro2/IDausente y transporte3; luego provisiónplacement autorizada validada y activación/piloto. Commitpushint/HEAD/cuotas.


### Resultado11c5a9 — Dispatcher/acción3 y readiness de cuatro índices preparados

Dispatcher3 valida intención1/actor y enruta task.move al executor multiefecto, reutilizando2 para otros comandos sin reescribir UUID/payload/receipt. Acción y cliente3 preparados conservan envelope2, sesión BetterAuth/allowlist y guardia de cuatro índices antes de ejecutar. Selector/inspector4 exige placement único exacto registrado; active2 mantiene selector3 y schema de provisión3 intactos. Mongo propio prueba UUID histórico unsupported2 sin receipt → ACK3 único/replay exacto → dependientes tag/view con revisiones independientes → descarga íntegra; foreign/identity reuse/deleted-source replay y ocurrencia/event/serie unsupported. Mongo75pass/0fail/985aserciones16archivos, recursos propios retirados. Suite493pass/123opt-in skip/0fail/7905aserciones; lint534/tipos/build34/diff aprobados. Producto sigue negociación2 y no se han creado índices en DBusuario. Próxima composición cliente3/cache separado y pruebas Next de transición; operador/provisión4 validada y conexión conjunta antes de activar. Movimiento piloto pendiente conservado. Commitpushint/HEAD/cuotas.


### Resultado11c5a10 — Cliente3 y caché preparados

Núcleo compartido captura cuenta/época inmutables y conserva attempt/runtime, guardias de refresh y coalescencia/cierre. Wrapper3 selecciona transport3/acción3 juntos; cliente activo2 mantiene sus defaults. Clave de resumen2/3 conserva posiciones cuenta/época e invalidación común, pero distingue generaciones; hook activo conserva exactamente key2. Siete tests nuevos prueban DTO2/intención1, anuncio1/2 rechazado antesbody/dispatch, identidad capturada, refresh/account loss, stop-before-open, caché/guards; tests existentes2 pasan. Suite500pass/123opt-in skip/0fail/7948aserciones, lint539/tipos/build34/diff aprobados. Primer fixture usó nombre de método incorrecto y literales ampliados; corregidos y compilación final aprobada. Sin migración de metadata/caller3/capabilities/provisión. Próximas pruebasNext reales de transición, operador4/provisión autorizada y conexión conjunta. Commitpushint/HEAD/cuotas.


### Resultado11c5a11 — Provisión4 por puertos validada

Inventario4 estricto y nombres centrales incluyen placement; motor común mantiene semántica/schema/API3 y planifica exclusivamente definiciones registradas/clonadas. Antes de cada creación y al final inspecciona de nuevo, incompatibilidad bloquea toda escritura, prefijos parciales/respuesta perdida se observan sin inferir éxito ni borrar/reparar/reintentar indefinidamente. Seis tests4 nuevos y nueve previos3 pasan: maxcinco inspecciones, noop, corrupción, duplicate_data, falta persistente y failed-call aplicado. Suite506pass/123opt-in skip/0fail/7976aserciones; lint543/tipos/build34/diff aprobados. Ningún caller/default/CLI/conexión4 ni DBusuario aún: operador/destino/lifecycle y pruebaMongo propia próximos, antes de provisiónPreview autorizada. Producto sigue2; piloto histórico intacto. Commitpushint/HEAD/cuotas.


### Resultado11c5a12 — Operador4/defaults/CLI probado en Mongo propio

Proceso separado comparte validación destino/acuse y ciclo de conexión con operador3, exige DB real despuésbootstrap y cierre antesready. Defaults4 reusan singleton/ensureIndexes automático9 y selección personal4; scripts preview/provision específicos, URI sóloenv privado y recibo finito saneado. Cuatro tests lifecycle nuevos y cuatro previos3 pasan. Mongo propio3casos88aserciones: destino/argumentos/env erróneos no recrean automático9 retirado por fixture; CLI/defaults bootstrap9+personal4 y noop; duplicate placement conserva documentos/prefijo3, retry sóloplacement tras retirar exclusivamente duplicado del fixture. Recursos propios limpiados. Previewoffline9+4 confirmado sinDB. Suite510pass/128opt-in skip/0fail/7998aserciones, lint550/tipos/build34/diff aprobados. FuenteVercel consultada readonly: MONGODB_URI Preview sigue enlazada al recurso debug distinto deProduction, listado sinMONGODB_DB/overrideint; valoresno revelados. ProvisiónPreview4 pendiente y ya autorizada, nombreDB confirmado; no conexiónDBusuario en este corte. Nextmatrix/jointactivation/piloto posteriores. Commitpushint/HEAD/cuotas.


### Resultado11c5a13 — Placement Preview provisionado ready+closed

Procedimiento4 publicado bafeaa9 y probado Mongo propio ejecutado únicamente en fuentePreview/int verificada deVercel (recurso debug diferenteProduction; sinMONGODB_DB/overrideint). DBconfirmada dalis-tasks-events. Recaptura privadaURI en fichero600 fuera repo, descriptor estricto sólo{mongodbUri,databaseName}, padre/hijo no-env-file/react-server, credenciales sóloenvprivado y targetguardantesbootstrap/DBrealdespués. Recibo real saneado: statusready/phasecomplete/connectionclosed; provisioningready; created sólo task_placements_user_scope_date_occurrence_uidx; missing[]/incompatible[]/errornull. Los tres índices personales previos ya estaban listos; no modificación de datos, reparación/borrado ni accesoProduction. Credencial oculta enVercel y fichero/launcher temporal eliminados; ningún secretoargs/log/repo. Operación completada9oct21:26Madrid. Producto sigue negociación2; requisito índices4 cerrado, falta Nextmatrix/clientehook3/jointactivation/dosdispositivos/piloto histórico. Validación documental referencias/coherencia/diff; commitpushint/HEAD/cuotas. No anunciar convergencia ni ACK productivo del movimiento aún.


### Resultado11c5a14 — Hook3 privado y lifecycle compartido preparados

Wrapper2 conserva cliente2/key2 y proveedor activo; wrapper3 preparado captura cliente3/key3. Núcleo único conserva scheduler/señales/listeners/unsubscribe/cancelación/cierre, guardias cuenta/epoch e invalidación por cuenta; pass/controlador ahora también poseen generación para no mostrar/solicitar estado de otro protocolo. Sin caller3/provider/rutas/capacidades ni metadatarewrite. Extracción revisada contra código previo; suites composición/cache/controles y full510pass/128opt-in skip/0fail/7998aserciones, lint552/tipos/build34/diff aprobados. Compilación no prueba lifecycle3 ni convergencia: sigue requerida fronteraNextreal/matrix/retiro2/IDausente y dosparticiones con productor task-move-outbox antes de activar. ÍndicesPreview4 ready+closed en699c075; movimiento piloto intacto/sinACK productivo. Commitpushint/HEAD/cuotas.
