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
