# Cierre de la versión de lanzamiento

Referencia: generación 6 de `int`, 21 de octubre de 2026. Este documento es el índice de cierre; las entradas anteriores del [plan maestro](master.md) conservan la historia y no reabren automáticamente trabajo pospuesto.

## Alcance fijado y límites

Incluye las cuatro variantes de plan, editor común, listas Atrasadas/Hoy/Próximas, calendario, trabajo offline, Google y aislamiento de cuentas, categorías/asignaciones/orden, repetición y apariciones, zona personal sincronizada, tema local, copias y recuperación explícita de los casos compatibles. No se amplía la funcionalidad durante el cierre.

- El usuario aprobó los diez pasos con dos dispositivos físicos el 17 de octubre; no se solicita repetirlos sin un cambio o fallo concreto. El arrastre también fue aceptado.
- Padre recurrente eliminado, remoto desconocido y cadenas externas no admitidas quedan **pospuestos**. Sus guardias, pendientes, outcomes, tombstones y exportación se conservan; no se consideran implementados. Pueden bloquear cambios dependientes y requerir revisión manual. No se ofrecen decisiones sin evidencia.
- La copia de serie completa queda fuera de esta versión. Cumpleaños sigue aparcado y compartir por Gmail está excluido.
- El JSON exportado conserva datos y evidencia locales; la importación de planes simples como copias nuevas no es una restauración completa de cuenta/series/historial.
- La sincronización necesita la aplicación abierta y conexión para confirmar cambios. Una revisión terminada o un guardado local no prueban por sí solos convergencia de todos los dispositivos.

## Matriz de cierre — todavía no aprobada

| Bloque | Estado y evidencia |
| --- | --- |
| Recorrido físico offline/multidispositivo | Aceptado por el usuario17oct; [checklist](manual-device-checklist.md). |
| Sincronización y recuperación ordinaria | Activas en generación 6; regresión completa Next/Mongo22c **pendiente**: último intento aprobó 17 de 38 escenarios y terminó sin aprobación durante orden de categorías. No presentar scopes focalizados anteriores ni esta pasada parcial como matriz completa. |
| Calidad de código final | 22b: 1349 pruebas aprobadas,225 opt-in omitidas,0 fallos; lint de 1072 archivos sin avisos, tipos, Webpack y worker de 46 recursos. Las omitidas requieren sus runners aislados; no son pruebas de producción. |
| Navegación y teclado | 22a: título y foco por pantalla, historial sin remontar shell, mes con PageUp/PageDown sin perder foco, skip link y confirmación nativa/Escape. |
| Formularios y ampliación | 22b: errores enlazados/foco/limpieza, borrador conservado ante fallo,320 px al 200% y390 px normal, claro/oscuro. Fecha/hora siguen en la misma fila a tamaño normal. |
| Documentación y operación | Guía y política de índices actualizadas en22c; checklist de promoción inferior. |
| Producción | No se despliega ni se inspecciona una DB del usuario en esta entrega. La verificación del entorno publicado va después de la promoción autorizada. |

La revisión de accesibilidad usa componentes reales, árbol de accesibilidad del navegador, teclado, estilos y capturas; no equivale a una certificación WCAG ni a una sesión auditiva con un usuario de lector de pantalla. Se corrigieron los hallazgos observados, sin afirmar cobertura de todas las combinaciones de navegador/tecnología asistiva.

Evidencia visual de fixtures propios sin DB ni cuenta: [calendario320 px/texto200%](evidence/22a-calendar-320-text200.png), [editor móvil390 px](evidence/22b-editor-mobile.png), [editor320 px/texto200%](evidence/22b-editor-320-text200.png). Fuentes de revisión: [guía de interfaces Vercel](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), guía instalada Next16 de accesibilidad y [componentes compartidos](../src/components).

## Promoción y comprobación operativa

1. **Identificar la versión:** comprobar commit completo de `int`, árbol limpio y resultado de la matriz. La promoción a `main` es una actuación separada; no inferir que un push a `int` publicó producción.
2. **Comprobar configuración del destino:** URI/DB de Mongo, URL pública de BetterAuth, callbacks Google, secreto y allowlist vigentes a través de la configuración del entorno. No copiar secretos en tickets, logs o repositorio. Preview y Production pueden apuntar a DB distintas: mismo código no copia los datos de una a otra.
3. **Conservar recuperación:** mantener la política de copia remota del operador y, si hay un incidente, exportar el JSON del dispositivo afectado. No hacer wipe, descartar pendientes ni eliminar índices para actualizar.
4. **Promover el código aprobado:** respetar el proceso habitual de merge/despliegue. Abrir la versión con conexión; una pestaña antigua puede necesitar comprobar actualización, cerrarse y reabrirse antes de usar el protocolo vigente. Los pendientes se conservan.
5. **Verificar arranque de DB:** [getDatabase](../src/lib/db/client.ts) aplica todos los índices de [ensureIndexes](../src/lib/db/ensure-indexes.ts), sin distinguir rama/entorno. Es idempotente; no migra documentos ni resuelve conflictos. Duplicados, definiciones incompatibles o permisos insuficientes pueden bloquear el arranque; conservar el fallo y revisarlo, sin reparación automática. No ejecutar un operador creyendo que es una inspección sin efectos: también hace bootstrap.
6. **Smoke del despliegue real:** carga deJS/CSS sin redirecciones de protección, login/cuenta correcta, listado existente, sincronización y recarga. Cualquier prueba de escritura usa un elemento desechable identificado por su dueño y se comprueba tras confirmar. No pedir de nuevo toda la checklist física salvo regresión concreta.
7. **Cerrar la publicación:** registrar SHA desplegado, entorno y resultado del smoke sin PII. Un fallo de Google, protección de Preview o permisos de DB es una incidencia del destino; no declarar producción validada a partir del fixture aislado.

## Si algo falla

- **Carga o login:** comprobar origen público/callback y protección del despliegue antes de atribuirlo a datos. La protección de Preview puede redirigir recursos si faltan sus cookies; no cambiar CORS a ciegas.
- **Actualización requerida:** conservar formularios/pendientes y seguir el procedimiento de actualización de la [guía](user-guide.md). No borrar IndexedDB ni usar otra cuenta para reenviar la misma cola.
- **Índices:** revisar el registro central y el error saneado. No mostrar URI, documentos ni errores con datos personales. No deduplicar ni sustituir índices automáticamente.
- **Conflictos protegidos:** exportar evidencia, anotar incidencia y conservar la cola. No convertir ausencia desconocida en borrado o confirmación.
- **Retirada de una versión:** evaluar compatibilidad de protocolo y evidencia antes de volver a una versión anterior; un rollback de hosting no revierte Mongo ni IndexedDB. Preferir la última versión compatible conocida o una corrección hacia adelante. Nunca reescribir UUID/colas para forzar compatibilidad.

La versión todavía no se declara cerrada: falta completar la regresión conjunta de 38 escenarios. No quedan nuevos bloques de funcionalidad dentro de esta checklist. El trabajo pospuesto se mantiene separado y sólo se retoma mediante una decisión nueva; una incidencia real de regresión sí bloquea el cierre hasta resolverse.
