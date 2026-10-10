# Transición del contenido de pruebas al editor común

## Estado y alcance

La conexión conjunta está preparada en `src/config/common-plan-release.ts`, todavía false. No se ha borrado nada. El nuevo contenido usa `kind: plan` y cuatro variantes; los objetos task/event antiguos no se convierten automáticamente. El usuario acepta esta ruptura antes de lanzamiento y ofrece realizar wipe si se solicita. La autorización anterior para índices no autoriza borrar datos.

Este procedimiento borra contenido de pruebas de **todas las cuentas de preproducción de int**, no sólo de un usuario; necesita confirmación humana explícita. Fuente previamente verificada: recurso Atlas **atlas-dalis-tasks-events-debug**, base **dalis-tasks-events**, conexión Preview de Vercel; Production usa otro recurso. Volver a comprobar identidad de recurso y base en el panel antes del borrado. No asumir `.env.local` como destino Preview. No copiar URI ni credenciales en comandos, documentos o chats.

## Reset humano solicitado, todavía pendiente

1. Cerrar la aplicación de preproducción en **todos los navegadores/dispositivos**, incluidos PWA y pestañas en segundo plano. No dejar un cliente antiguo enviando su outbox mientras se reinicia el servidor. Si se quiere conservar información de prueba, exportar antes desde Ajustes; el backup antiguo no se reimporta sin revisión del formato.
2. En Atlas, dentro del recurso y base Preview indicados, borrar **documentos**, sin eliminar colecciones ni índices, únicamente de esta lista:

   | Colección | Motivo |
   | --- | --- |
   | `items` | Contenido antiguo |
   | `tags` | Categorías del catálogo anterior |
   | `item_views` | Asignaciones y vistas anteriores |
   | `task_placements` | Orden de los elementos anteriores |
   | `sync_operations` | Recibos y replay del catálogo anterior |
   | `sync_changes` | Journal de descarga anterior |
   | `sync_counters` | Checkpoints del journal anterior |

   **Preservar** `users`, `accounts`, `sessions`, `verifications`, cualquier otra colección y todos los índices. No borrar datos de producción ni reparar incompatibilidades. Comprobar que las siete colecciones quedan con cero documentos.
3. En cada navegador/dispositivo utilizado para Preview, usar DevTools del origen exacto `https://dalis-tasks-events-git-int-martincalvodaniels-projects.vercel.app`. Antes de recargar, activar modo Offline en Network y Disable JavaScript en la configuración de DevTools; recargar para cerrar conexiones de la página sin arrancar el motor de sincronización. En Application → IndexedDB, borrar sólo `dalis-account-control` y las bases cuyo nombre empieza por `dalis-account:`. El formato registrado es `dalis-account:${encodeURIComponent(userId)}`. No usar «borrar todos los datos del sitio»: conservar cookies de sesión y almacenamiento de otros orígenes. No borrar las bases locales del origen productivo. Si aparece un bloqueo de borrado, hay otra pestaña/proceso con conexión abierta: cerrarlo y repetir, no dar el reset por completado. Cerrar Preview y restaurar JavaScript/red después; mantener Preview cerrado hasta el nuevo despliegue. Si el dispositivo no permite este procedimiento, comunicarlo antes de activar.
4. Confirmar al agente **reset remoto y local completado**, incluyendo todos los perfiles/dispositivos que usaron Preview. Si alguno conserva su cola antigua, detener activación y resolver ese perfil primero. No reinstaurar snapshots/checkpoints/outbox antiguos después del reset.

## Corte de activación posterior

Tras la confirmación, activar una única selección de release en código (sin hosting/secretos), validar suite/lint/tipos/build y publicar int. Comprobar identity y header pull exclusivos4, retiro3 sin ACK y readiness de índices existentes; no repetir provisión sin fallo comprobado. Preparar dispositivo y probar creación de cuatro variantes, categoría/color/checklist, lista/calendario/recarga y sincronización simple con dos particiones/perfiles. El despliegue anterior sigue3 hasta publicar; mantener clientes cerrados durante ese intervalo.

Series/apariciones tienen repetición y progreso **locales**, pero todavía no executor remoto ni ACK; el diagnóstico debe conservarlo explícito. No prometer sincronización de repetición/ocurrencias por activar planes simples. El reset no es una solución de migración para usuarios de producción.

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

**Todavía pendientes:** reset local de cada perfil/dispositivo Preview y activación conjunta posterior. No declarar reset local ni activación a partir de este wipe remoto. Mantener clientes Preview cerrados para evitar reenvío de intenciones antiguas; si vuelven a crear datos, inspeccionar antes de actuar, sin asumir otra eliminación autorizada. Selección común sigue false.
