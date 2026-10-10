# Activación del editor y lista comunes

## Punto de partida comprobado

Contenido simple de cuatro variantes, categoría/asignación, orden/progreso/checklist y tombstones convergen en dos orígenes/IndexedDB con Mongo propio (16a4b,0d9b0cb). Incluye respuesta perdida con la misma intención y ACK remoto único. No repetir esta implementación ni confundir fixture HTTP de sesión ficticia con RPC Next/autenticación. Producto activo sigue3; preparados cliente/acción/reader/policy4. Series/apariciones comunes todavía pendientes.

## 16a4c1 — Frontera RPC4 compilada

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

Cuatro variantes tienen la misma repetición y progreso por aparición; no completar padre recurrente como sustituto ni ocultarlo del calendario. Reutilizar motor civil/reglas/excepciones existentes; fechas/zona/DST y checklist por aparición. Contrato y rutas concretos se cierran antes de editar. La sincronización remota de series permanece bloque aparte: no anunciarla al activar simples. Si un límite funcional impide cumplir equivalencia, exponerlo claramente y resolverlo antes de ofrecer el control.

## 16a4c3 — Transición y conexión conjunta

Usuario acepta incompatibilidad, por tanto no construir adaptadores históricos costosos. Preparar alcance real del eventual wipe de contenido/checkpoints/recibos y bases locales; preservar auth, excluir producción y pedir al usuario que lo realice sólo cuando el procedimiento esté validado y revisable. No borrar automáticamente ni pedir wipe prematuro.

Conectar juntos: anuncio4 exclusivo, identity/pull4, acción/client4, hook/cache4, proveedores/context/UI y editor/lista/calendario comunes; retirar acción3 con [guardia preparada](../src/features/sync/retired-sync-push-v3.ts). No cambiar intenciones1 ni sobres/journal2 por cambiar negociación. Navegación comparte destinos actuales; botón+ abre editor único, sin destinos vacíos.

Aceptación móvil: cuatro tipos juntos por categoría, iconos coloreados, checklist visible, inicio/fin separados y horas ocultas todo el día, cruz/check, densidad sin targets táctiles diminutos. Drag sólo con contexto completo; all/upcoming no inventan vecinos de un intervalo. Prueba de recarga/offline y piloto Google Preview final separados de fixtures. No afirmar dos dispositivos físicos a partir de dos pestañas.

## Continuación programada

10oct lectura9%5h/86%7d; reset publicado1791642149 (16:22:29 Europe/Madrid). Una revisión puntual del heartbeat existente a16:24 confirma cuotas/renovación reales antes de continuar16a4c1. Reservas de próxima ventana10%5h/1%7d; commit/push/HEAD/cuotas cada corte. No cadena adicional, créditos, reset manual ni tareas ajenas al rediseño.
