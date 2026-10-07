# Entorno de pruebas de sincronización

Estado: diseño de11a0; implementación y pruebas reales pendientes en11a1a. Prioridad: sincronización de tareas/eventos simples antes de continuar repetición y cumpleaños.

## Evidencia y límites

- Docker CLI29.8.2 disponible localmente. No se ha verificado daemon, imagen MongoDB, replica set ni transacciones. `mongod` no está enPATH; no instalar paquetes ni modificar hosting como parte de este documento.
- [Singleton](../src/lib/db/client.ts) existente, [colecciones](../src/lib/db/collections.ts) e [índices](../src/lib/db/ensure-indexes.ts) contienen actualmente autenticación. No hay repositorios de producto remoto.
- [Fixture auth](../src/lib/db/auth-identity.integration.test.ts) ya exige opt-in/configuración local y limpia su DB; [guard](../src/config/env.ts) permite solo prefijo `dalis-auth-test-` y loopback. Reutilizar el patrón, sin reutilizar esa base para sync ni activar sus tests sobre otro nombre.
- [Huella](../src/lib/sync/operation-fingerprint.ts) está probada como función; no equivale a recibo persistido, transacción ni replay remoto.

## 11a1a: implementación acotada

Rutas previstas: configuración tipada en `src/config/**`, soporte de test y fixture de integración en `src/lib/db/**`, scripts TypeScript de ejecución/limpieza bajo `scripts/**` y este plan. Respetar [reglas DB](../src/lib/db/AGENTS.md): driver solo en la capa DB, servidor aislado del cliente, conexión singleton y registro central de colecciones/índices.

1. Comprobar runtime Docker existente antes de elegir una imagen compatible y fijar versión. Preparar instancia de test propia con replica set de un nodo, puerto loopback y almacenamiento temporal; registrar identificador único de la ejecución. No usar volumen ni contenedor del usuario.
2. Proponer opt-in separado `RUN_SYNC_DB_TESTS=1`, validado desdeconfig, y DB `dalis-sync-test-<run-id>` creada para esa ejecución. Antes de abrir/limpiar: verificar esquema URI local, todos los hosts loopback, nombre exacto y ownership del recurso del runner. Rechazar URI remota/multihost no local, prefijo auth y DB normal. No leer secretos para construir la fixture.
3. Esperar disponibilidad/elegibilidad del replica set con timeout acotado. Un ping no prueba soporte transaccional; la aceptación exige escribir y abortar/confirmar transacciones reales. Declarar fallo si el runtime falta; tests omitidos no cuentan como evidencia de transacciones.
4. Usar conexión singleton configurada al proceso de test. Colección de probe registrada centralmente si se necesita; evaluar índices por operaciones realmente implementadas, sin anticipar colecciones de producto. Mantener objetos del driver dentro deDB.
5. Ejecutar pruebas contra DB única y comprobar resultados desde lecturas fuera de la sesión. Cerrar sesiones/conexión enfinally; eliminar solo DB/instancia/almacenamiento propios tras verificar su identidad. Un fallo de arranque tampoco debe dejar recursos propios activos.

Salida: runner reproducible, guards de aislamiento probados y evidencia de commit/rollback real. No endpoint de subida, repo de tareas ni garantía de idempotencia todavía.

## Matriz de aceptación por corte

| Corte | Escenario | Resultado observable |
| --- | --- | --- |
| 11a1a | Dos escrituras en una transacción confirmada | Ambas visibles desde otra sesión. |
| 11a1a | Fallo tras primera escritura y aborto | Ninguna escritura visible; siguiente transacción funciona. |
| 11a1a | Configuración remota, DB no propia o auth | Rechazo antes de conexión destructiva/limpieza. |
| 11a1a | Cierre/fallo de arranque | Recursos propios liberados; ninguna DB del usuario tocada. |
| 11a1b | Dos editores con misma revisión | Solo uno modifica; otro obtiene conflicto; revisión sube una vez. |
| 11a1b | Leer/editar/borrar ID de otra cuenta | Ningún dato expuesto/modificado; tombstone conserva identidad. |
| 11b1 | Repetir operationId y payload válido | Mismo recibo; una sola mutación/revisión/entrada journal. |
| 11b1 | Reutilizar operationId con payload distinto | Rechazo; recibo y datos previos intactos. |
| 11b1 | Fallo en recibo o journal tras mutación | Todo revierte, incluidos contador y revisión. |
| 11b1 | Dos operaciones concurrentes del receptor | Secuencias únicas; ninguna modificación confirmada queda detrás de cursor ya consumido. |
| 11b1 | Comando sin soporte o lote con fallos parciales | Resultado por operación; nunca ACK ficticio ni pérdida de pendientes. |
| 12 | Corte de red antes/después del commit remoto | Reintento con mismo ID; shadow/ACK/cursor locales atómicos; pendientes intactos. |

Las pruebas de actor/membresía en acciones se añaden en11b1 con sesiones verificadas, además de aislamiento del repositorio. Preferencias, descarga completa y reconciliación son necesarias antes de anunciar convergencia del espacio en dos dispositivos. La matriz no sustituye implementar esas capas.

Cerrar cada corte con lint/tipos/tests/build pertinentes, plan/registro y commit/pushint. Mantener fuera de la suite normal las pruebas que exigen runtime explícito, con ejecución de integración separada y evidencia clara de qué se ejecutó. Ver [workflow](workflow.md) para presupuesto y reservas.
