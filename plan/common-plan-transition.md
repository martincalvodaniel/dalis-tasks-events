# Transición del contenido de pruebas al editor común

## Estado y alcance vigentes

Wipe remoto Preview ejecutado en16a4c3b por autorización humana, resultado abajo. No repetir el borrado. Selección conjunta en `src/config/common-plan-release.ts` todavía false; generación3 activa hasta16a4c3d. El usuario acepta ruptura del contenido previo antes de lanzamiento; nunca convertir ni borrar automáticamente datos de producción.

La transición local16a4c3c ya está implementada dentro de la aplicación. No requiere borrar `dalis-account-control` ni usar DevTools. Cada cuenta/dispositivo conserva sesión, selección/época y ajustes. Una partición nueva vacía se prepara sin borrado; una partición anterior muestra «Preparar dispositivo» y exige confirmación explícita «Borrar y continuar». Sólo Preview/int y localhost permiten esta limpieza, nunca el origen productivo. Cerrar otras pestañas/PWA Preview antes de confirmar.

## Preparación local por dispositivo

1. Tras la publicación conjunta4, abrir Preview. Si hay contenido anterior, el editor y el motor4 permanecen desmontados hasta la preparación. Cancelar mantiene todos los datos.
2. Confirmar el borrado irreversible de contenido local anterior de **esa cuenta en ese dispositivo**: items, occurrences, tags, itemViews, taskPlacements, memberships, invitations, outbox, remoteShadows y syncMetadata. La TX conserva settings, cookies/sesión, account-control e índices. La base remota no se modifica. No borrar bases de otros usuarios/orígenes.
3. La misma TX guarda marca infra de generación4/owner en syncMetadata. Replay o confirmaciones concurrentes no vuelven a borrar planes nuevos. Datos o marca inválidos bloquean sin borrado automático; cuenta/época se comprueban antes/después. La marca no se exporta en backup portable y un import antiguo no puede contaminar la partición preparada.
4. Se invalidan caches de esa cuenta/época y se refresca el resumen local antes de montar producto4. El runtime verifica la marca también antes de claim/ACK/pull. Recargar conserva preparación. Cada otro dispositivo/perfil confirma por separado.

## Corte de activación posterior

16a4c3d cambia una única selección, valida los callers ensamblados y publica int. Identity/pull exclusivos4 y retirada3 antes de readiness/executor conservan intenciones1/sobres2. El wipe remoto ya está cerrado, no es un prerrequisito pendiente. Comprobar Preview y cuatro tipos desde+, categoría/color/checklist, lista/calendario/recarga y sincronización simple con dos particiones propias; separar esta evidencia de Google/dispositivos físicos.

Series/apariciones tienen repetición y progreso **locales**, pero todavía no executor remoto ni ACK; no prometer sincronización de repetición por activar planes simples. El reset de pruebas no sustituye una migración para producción. La autorización de esta actuación excluye producción, cambios de hosting/secretos/permisos y nuevas eliminaciones remotas.

## Resultado16a4c3b — Wipe remoto ejecutado

10oct: el usuario solicita que el agente haga el borrado y corrige expresamente el destino a **Preproduction**, tras aclaración de producción/preproducción. Esta autorización cubre el contenido remoto enumerado, no producción ni borrado local de otros dispositivos. Ejecutado por Atlas Data Explorer vía SSO del recurso Vercel identificado, sin leer URI, credenciales ni documentos de autenticación. La revisión automática bloqueó abrir/volcar variables de entorno por riesgo de exponer secretos; se respetó el bloqueo y se completó por UI Atlas sin secretos.

Destino verificado: proyecto/clúster `atlas-dalis-tasks-events-debug`, proyecto Atlas `6ac6750220c6cbecd1c55b2c`, base `dalis-tasks-events`. Borrado bulk con filtro None, confirmación y resultado de éxito por colección. Sin drop de colección/base/índices, sin cambios de permisos/hosting. Recuento final refrescado:

| Colección | Antes | Después | Índices conservados |
| --- | ---: | ---: | ---: |
| items | 13 | 0 | 2 |
| item_views | 4 | 0 | 2 |
| tags | 6 | 0 | 3 |
| task_placements | 1 | 0 | 2 |
| sync_operations | 58 | 0 | 2 |
| sync_changes | 57 | 0 | 2 |
| sync_counters | 1 | 0 | 1 |

Autenticación sin alteración: `users`3/índices2, `accounts`3/índices3, `sessions`5/índices3, `verifications`0/índices2, iguales antes/después. Evidencia visual `/private/tmp/dalis-preview-content-reset.png`. Producción no abierta ni modificada. El primer diálogo de item_views mostró Update en lugar de Delete; guardia de ámbito detuvo la operación y se canceló sin escribir, luego Delete comprobado y ejecutado.

**Actualización16a4c3c:** preparación local explícita por dispositivo implementada y probada; activación conjunta4 pendiente del siguiente corte. No declarar reset local ni activación a partir de este wipe remoto. Mantener clientes Preview cerrados para evitar reenvío de intenciones antiguas; si vuelven a crear datos, inspeccionar antes de actuar, sin asumir otra eliminación autorizada. Selección común sigue false.
