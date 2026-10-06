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
