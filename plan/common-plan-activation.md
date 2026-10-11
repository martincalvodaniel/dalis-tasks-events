# Activación del editor y lista comunes

## Punto de partida comprobado

**Estado vigente16a4c3d:** selección conjunta4 activada y validada con19escenarios Next compilado/defaults/BetterAuth persistido/dos particiones/Mongo propio usando rutas productivas y retirada3 real. Editor/lista/calendario comunes conectados, guardia local por dispositivo16a4c3c y wipe remoto Preview16a4c3b completados. Series/apariciones funcionan localmente pero todavía no tienen ACK remoto. Publicación int y comprobación Preview cierran este corte; piloto Google/UI de perfiles reales se registra aparte.

Contenido simple, categoría/asignación, orden/progreso/checklist y tombstones también convergen en dos orígenes/IndexedDB con Mongo propio16a4b. Incluye respuesta perdida con la misma intención y ACK único. No confundir fixture con Google/dispositivos físicos. Las secciones inferiores conservan la matriz y evolución histórica.

## 16a4c1 — Frontera RPC4 compilada

Estado16a4c1a:19escenarios completos aprobados con recursos propios, acción4 real/defaults/sesiones persistidas y hook4 directo. Producto todavía usa3; esta evidencia no equivale a activar proveedor/callers ni Google interactivo.

Objetivo: demostrar que Next compila y referencia la acción4 real, y que sus defaults ejecutan contenido común con sesión persistida. Sin activar producto.

`target_paths`: [runner Next](../scripts/next-sync-test-runner.ts), [templates](../test/next-sync), schemas/next-sync-test sólo para comandos necesarios y fixtures DB propios. Root posee templates/runner/integración; secuencial inicialmente. Dependencias:16a4b, [acción4](../src/features/sync/actions-v4.ts), [push autenticado4](../src/features/sync/authenticated-push-v4.ts), [pull autenticado4](../src/features/sync/authenticated-pull-v4.ts) y [cliente4](../src/features/sync/mixed-sync-client-v4.ts).

Reutilizar el aislamiento y sesiones BetterAuth existentes. Nueva referencia directa action4 en compilación; el wrapper debe conservar actor/headers/defaults. Prueba de ID ausente debe pasar por RPC real compilado, no llamar al método directamente. Guardar métricas de recibos/journal/proyecciones antes y después de cada rechazo. No extrapolar resultados de templates3.

| Caso | Evidencia exigida |
| --- | --- |
| Cliente4/servidor3 y cliente3/servidor4 | Rechazo por header antes body, caché, cursor o claim; proyección/cola conservadas. |
| Sesión válida y actor esperado | Productor real guarda plan+asignación; action4 emite ACK real y pull4 converge en la segunda partición. |
| Sesión revocada/cambio de cuenta | Sin efecto remoto ni ACK; intención y lease propios quedan recuperables. |
| Readiness no válida | Rechazo antes executor; sin recibo de éxito ni avance de cursor. |
| Identity3/pull3 capturados, luego retirada3 | Respuesta update_required anterior a readiness/executor y sin ACK. |
| ID antiguo ausente en build Next | Error RPC real sin ACK; siguiente handshake exige4 antes claim. |
| Respuesta action4 perdida | Replay de UUID/payload/dependencias exactos y un recibo; dependientes llegan después. |
| Hook4: montar/desmontar, listener, cuenta/época | Sin callbacks antiguos ni doble ejecución; ninguna inferencia de cancelación de red ya enviada. |

Dividir en frontera/negociación y productor/lifecycle si no cabe una entrega completa. Cada corte ejecuta prueba propia real, suite/lint/tipos/build y limpieza antes de commit/push/HEAD/cuotas. Fixture autenticada BetterAuth no prueba login interactivo Google ni ID del deployment Preview.

## 16a4c2 — Apariciones comunes locales

Estado16a4c2a–f: núcleo, comandos, IndexedDB real, snapshot/hooks y lista/calendario preparados. Prueba UI390px de progreso/checklist por slot, cancelación y recarga aprobada. Faltan transición/callers conjuntos; series/apariciones y su orden siguen fuera de sincronización remota.

Cuatro variantes tienen la misma repetición y progreso por aparición; no completar padre recurrente como sustituto ni ocultarlo del calendario. Reutilizar motor civil/reglas/excepciones existentes; fechas/zona/DST y checklist por aparición. Contrato y rutas concretos se cierran antes de editar. La sincronización remota de series permanece bloque aparte: no anunciarla al activar simples. Si un límite funcional impide cumplir equivalencia, exponerlo claramente y resolverlo antes de ofrecer el control.

## 16a4c3 — Transición y conexión conjunta

Usuario acepta incompatibilidad, por tanto no construir adaptadores históricos costosos. Preparar alcance real del eventual wipe de contenido/checkpoints/recibos y bases locales; preservar auth, excluir producción y pedir al usuario que lo realice sólo cuando el procedimiento esté validado y revisable. No borrar automáticamente ni pedir wipe prematuro.

Conectar juntos: anuncio4 exclusivo, identity/pull4, acción/client4, hook/cache4, proveedores/context/UI y editor/lista/calendario comunes; retirar acción3 con [guardia preparada](../src/features/sync/retired-sync-push-v3.ts). No cambiar intenciones1 ni sobres/journal2 por cambiar negociación. Navegación comparte destinos actuales; botón+ abre editor único, sin destinos vacíos.

Aceptación móvil: cuatro tipos juntos por categoría, iconos coloreados, checklist visible, inicio/fin separados y horas ocultas todo el día, cruz/check, densidad sin targets táctiles diminutos. Drag sólo con contexto completo; all/upcoming no inventan vecinos de un intervalo. Prueba de recarga/offline y piloto Google Preview final separados de fixtures. No afirmar dos dispositivos físicos a partir de dos pestañas.

## Continuación programada

10oct lectura9%5h/86%7d; reset publicado1791642149 (16:22:29 Europe/Madrid). Una revisión puntual del heartbeat existente a16:24 confirma cuotas/renovación reales antes de continuar16a4c1. Reservas de próxima ventana10%5h/1%7d; commit/push/HEAD/cuotas cada corte. No cadena adicional, créditos, reset manual ni tareas ajenas al rediseño.

### 16a4c3a — Ensamblado listo, selección de release cerrada

Todos los callers comparten `config/common-plan-release.ts`: identity, pull, retiro action3 antes readiness, proveedor/hook4 y pantallas editor/agenda/calendario. La selección permanece false: continúa producto3, no borrar ni ocultar contenido antiguo. Los hooks viven en proveedores separados; cambiar selección no altera el orden de hooks ni monta dos motores. La transición precisa confirmación del reset humano descrito en [common-plan-transition.md](common-plan-transition.md), luego un único corte cambia la selección, valida el producto ensamblado y publica. No modificar sólo anuncio ni variables de hosting. FixtureNext19 y UI preparada no sustituyen piloto de callers activos.

### 16a4c3c — Preparación local explícita validada

Barrera del proveedor deja editor y motor desmontados hasta marca4 propia. Cuenta vacía se prepara sin borrar; contenido anterior exige confirmación por dispositivo sólo Preview/local. Reset TX de diez stores conserva settings, sesión/control/época e índices; replay/race preservan planes nuevos. Guardias runtime antes de claim/ACK/pull, backup portable excluye marca y rechaza import antiguo en partición preparada. Caches de cuenta/época invalidados antes de montar children; ningún borrado automático ante error. Fixture React/IndexedDB propia prueba cancelación/confirmación/rollback/guardias/concurrencia/recarga, sin actuar en perfiles del usuario. Producto sigue3/selección false hasta16a4c3d. Wipe remoto ya completo; no volver a pedir su autorización ni nombre de DB.

### 16a4c3d — Producto4 ensamblado y validado

Única selección true conecta todos los callers/pantallas4; no despliegue de producción ni nuevo wipe. Runner exige selección4, referencia action4 y acción3 retirada reales; wrappers identity/pull delegan a rutas productivas conservando capability/sesión/Host. Particiones propias vacías preparan marca4 antes de productores. Los19escenarios pasan: dos sesiones BetterAuth persistidas, cuatro variantes/asignación tras perder respuesta/replay único/ACK real, proyecciones exactas, orden/dependientes, epochs/lifecycle, versiones/IDausente/acción3retirada/readiness/cuentas rechazadas sin mutación. Recursos propios cerrados y eliminados, evidencia `/private/tmp/common-plan-next-active-proof.png`. No Google ni IDexactoPreview inferido. Suite621/153skip/0fail, lint665/tipos/build34/diff aprobados. Verificación operacional Preview se registra después de publicar; cada dispositivo anterior necesita su consentimiento local en la barrera, no un borrado automático.

### 16a4c3e — Preview Ready y barrera4 comprobados

Vercel deployment `dalis-tasks-events-e1x29ue70-martincalvodaniels-projects.vercel.app` muestra Ready, Preview/int y96a6237db631b32cbb2f14702e68637bec2248e5, creado11oct04:22:56CEST. Alias int mantiene Google; worker anterior muestra actualización, al cerrar única pestañaDalis/reabrir carga barrera4. Se abre diálogo revisable sin confirmar borrado. Mobile390: diálogo358px, scrollWidth=clientWidth356 (sin overflow), targets50px; viewport restaurado. Captura normal `/private/tmp/common-plan-preview-confirmation.png` y deployment `/private/tmp/common-plan-preview-deployment-ready.png`; screenshotmobile proveedor reescala superficie, no usar como prueba de layout en lugar de geometríaDOM. Pestaña app entregable, Atlas del usuario conservada y Vercel temporal cerrada.

Se pide únicamente consentimiento para borrar contenido anterior **local** de la cuenta del navegador integradoPreview; la autorización del wipeMongo no se reinterpreta como permiso para otros dispositivos. Cancelar/no respuesta no autorizan borrar. Sesión/ajustes preservados por contrato probado, no nueva eliminación remota. PilotoGoogle de cuatro tipos desde+ sigue pendiente de este paso; fixture19 prueba RPC/convergencia, no la interfaz completa conGoogle.
