# Entorno de pruebas de sincronización

Estado: runner y commit/rollback reales entregados en11a1a2. Prioridad: sincronización de tareas/eventos simples antes de continuar repetición y cumpleaños.

Avance11a1a1: [schema del descriptor](../src/schemas/sync-database-test.ts) implementado y [probado](../src/schemas/sync-database-test.test.ts). Exige runId UUID, puerto entero1024–65535, DB exacta `dalis-sync-test-<runId>` y URI exacta `mongodb://127.0.0.1:<port>/?replicaSet=dalis-sync-test&directConnection=true`. Solo se admite esta forma generada por el futuro runner; rechaza localhost alternativo, SRV, multihost, credenciales y parámetros adicionales. Ninguna variable de entorno se lee ni cambia ahora. No hay consumidor/runner todavía; integrar validación antes de cualquier conexión o limpieza y verificar además ownership real del recurso.

## Evidencia y límites

- Docker CLI29.8.2 y daemon28.4.0 Ubuntu/x86_64 verificados. Imagen8.2.11 fijada por digest enconfig; replica set de un nodo y transacciones comprobados por runner. `mongod` no está enPATH y no se instaló ningún paquete.
- [Singleton](../src/lib/db/client.ts) existente, [colecciones](../src/lib/db/collections.ts) e [índices](../src/lib/db/ensure-indexes.ts) contienen actualmente autenticación. No hay repositorios de producto remoto.
- [Fixture auth](../src/lib/db/auth-identity.integration.test.ts) ya exige opt-in/configuración local y limpia su DB; [guard](../src/config/env.ts) permite solo prefijo `dalis-auth-test-` y loopback. Reutilizar el patrón, sin reutilizar esa base para sync ni activar sus tests sobre otro nombre.
- [Huella](../src/lib/sync/operation-fingerprint.ts) está probada como función; no equivale a recibo persistido, transacción ni replay remoto.

## 11a1a: implementación acotada

Ejecución reproducible: `bun run test:sync-db`, [runner](../scripts/sync-db-test-runner.ts), [config de proceso](../src/config/sync-test-runner.ts), [guard](../src/config/env.ts) y [fixture](../src/lib/db/transactions.integration.test.ts). Docker run usa imagen local/pull=never, label+UUID, tmpfs y ningún volumen del usuario. El daemon observado expone su puerto loopback en otro host; el runner usa un proxyTCP Node en127.0.0.1 aDocker exec/bash del contenedor propio, sin publicar puertosMongoDB. No introduce dependencia ni altera transporte de producto. Cierra sockets/procesos, comprueba labels/imagen/nombre y elimina contenedor+volúmenes anónimos propios enfinally; SIGTERM probado. El hijo desactiva carga de.env con--no-env-file y recibe soloPATH/flags/conexión de prueba; no se heredan credenciales de producto.

Probe reutilizaauthVerification solo en la DB de prueba; no nueva colección/index especulativo. Dos tests/seis aserciones verifican visibilidad fuera de sesión, fallo de_id duplicado que aborta la primera escritura, dato previo intacto y transacción posterior válida. Suite normal omite estos tests; runner aislado los ejecuta. CAS/repositorios/recibos/journal aún pendientes. Documentación primaria: [transacciones Node](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/), [replica set](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set/).

Avance11a1b1: runner incluye [repositorio propio](../src/lib/db/remote-items.ts) ycuatro tests deCAS/owner/tombstone/paginación/corrupción. Colecciónitems eíndiceownerId+_id registrados centralmente, unicidadglobalpor_id; no driver fueraDB. Recibos/journal/servicio todavía pendientes. Total6tests/33aserciones reales.

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

## Evidencia11b1a

El runner incorpora [tests del ejecutor](../src/lib/db/remote-item-commands.integration.test.ts): replay/carrera de recibos, CAS/conflicto durable, secuencias concurrentes, aislamiento, comandos sin soporte, validación temporal y fallo tardío de journal. Este último utiliza un validator temporal solo enDB propia y lo restaura enfinally; fallo revierte elemento/recibo/journal/contador, reintento después funciona. Runner12pass/82aserciones; no se ha probado transporte ni dos dispositivos.

## Evidencia12a1

[Prueba de descarga](../src/lib/db/remote-changes.integration.test.ts) captura checkpoint2, intercala tres escrituras y termina bootstrap2 antes de recuperar3–5. El estado reconstruido equivale al repositorio actual, incluidos borrados. Otra cuenta vacía, cursor futuro, hueco/corrupción y cambio simulado de propietario rechazan sin payload parcial; fixtures restaurados enfinally. Runner15pass/105aserciones; esto prueba DAL, todavía no dos dispositivos/IndexedDB/transportador.

## Evidencia12b2a4: dos particiones conectadas

Ejecutar `bun run test:sync-browser`, abrir la URL loopback que imprime el runner y pulsar «Ejecutar prueba integrada». Dos iframes con orígenes/puertos efímeros distintos comparten cuenta ficticia, con IndexedDB independiente. El servidor usa servicio de subida yjournal/DAL reales mediante descriptor aislado; no habilita bypass de auth en rutas deproducto. Capacidad UUID porrun, entradas estrictas, respuestas privadas no-store, deadline10min y cierre por resultado o señal. Runner conserva modoMongo habitual y limpieza por ownership.

Seis checks browser pasan: offline simulado/recarga, convergencia de tareas simples, progreso/checklist dependientes, respuesta perdida trascommit/replay sin duplicados, borrado durable y conflicto conservador con otra entidad independiente. Se verifican proyecciones/cursor contraMongo y conflicto tras recarga. Se eliminan solo particiones ficticias del run y recursos del runner; exit0 deambos modos. RegresiónMongo15pass/105aserciones. No sustituye pilotoGoogle/NextRPC, modo avión del shell ya probado, ni sincronización de preferencias/series/compartidos.


13a1b: `bun run scripts/browser-test-server.ts sync-incidents` ofrece fixture loopback con partición browser-test UUID. Comprueba snapshot real IndexedDB, conflicto/rechazo/dependientes/tombstones, error íntegro por outcome ausente, recarga y guardia de época durante lectura. Seis checks pasan; solo su partición y control de cuenta ficticio local, ninguna DB remota. Datos y conexiones propios limpiados al cerrar.


13a1c: `bun run scripts/sync-incident-ui-test-server.ts` sirve en127.0.0.1:4180 una fixture React/IndexedDB propia, con CSS del build. Apertura de conflicto y comando, móvil390×844 sin overflow/summary44px, recarga y comparación sin mutación de cola verificadas. Botón de validación cierra conexiones y elimina solo partición UUID propia; servidor/tab/viewport cerrados/restaurados. No llamaMongo niGoogle.


13a2b1: `bun run scripts/browser-test-server.ts sync-resolution` valida executor local con datos/respuestas ficticias en IndexedDB real. Ocho escenarios+recarga: stale, rollback de adopción/retry/contador/notificación, payload/outcome intactos, superseded nunca ACK, pull posterior, replay tras edición, nuevo conflicto, externos/tombstones/cuenta. Recursos propios limpiados. Todavía no prueba de convergencia remota de resoluciones; próxima13a2b1a amplía entorno dos dispositivos/Mongo.


13a2b1a amplía `bun run test:sync-browser` a nueve escenarios: retry explícito con cadena de dos operaciones, respuesta perdida/replay de decisión/recarga; adopción sin cambio de revisión/journal tras rechazo de snapshot local obsoleto; tombstone rechaza resurrección y converge por adopción. Ambas proyecciones/cursors comparadas con Mongo; pending/sending/conflicts/rejected0 requeridos para declarar convergencia. Originales permanecen superseded y solo replacement ACK. Runnerexit0 y limpieza de particiones/cookies/tabs/proxy/container/tmpfs propios verificados. Ninguna conexión a DB del usuario; Google/RPCNext reales todavía pendientes.


13a2b2: fixture UI soporta `?choice=retry` o`?choice=adopt`, confirma estados/historial ycleanup. Ruta `/edit?run=<UUID>` simula edición desde otra pestaña de misma partición ficticia, guardando estado completed sin cambiar cuenta/época ni limpiar recursos de la pestaña principal. Cancelación no muta, snapshot congelado rechazado tras edición, elección revisada crea3superseded/1pending; adopción2superseded/0pending. Móvil390 sinoverflow/dialog358px/buttons48px yrecarga verificados. Nueve escenariosMongo revalidadosdespués de guardiascompartidas, exit0/cleanup.


13a2c2: copia y original tombstone guardados junto con cola/contador/evidencia en cuatro stores; nuevo ID libre frente a registros/historial/tombstones, entityKey del nuevo elemento. Rollback tardío deja ambos elementos y cola intactos; replay no sobrescribe copia editada. IndexedDB nueve checks+recarga y diez escenarios reales dos dispositivos/Mongo aprobados; lostresponse produce una sola copia revision1 y original tombstone revision2 intacto. Recursos propios limpios. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próxima13a2c3 UI de copia, sin categorías/orden duplicados ni ACK local.


13a2c3: Ajustes ofrece Crear copia de mi borrador solo para local vivo frentearemoto tombstone, conidentidad/operación/timestamp estables yconfirmación decontenido completo, originalborrado, sincategoría/orden ypending. Tests guardiaslocalmissing/deleted ySSR; normal205pass/30skip/4628aserciones, lint304files/tipos/build30recursos aprobados. FixtureUI móvil390/dialog358/buttons48 sinoverflow: cancelar sincambios, confirmar/reload origentombstone+copyrev0+createbase0/entityKeynuevo/2superseded/1pending/sinACK; limpieza propia. Próxima13b1 recuperación/transporte según dependencias.


13b1a: doce escenarios reales dos dispositivos/IndexedDB/Mongo aprueban sesiónausente(no claim), sesióncaducada alpush(release sinACK yUUID/payload intacto), cierre después decommitremoto(release pending) yleaseexpirada durable/recarga/replay único. Ambosdispositivos/cursors convergen conMongo, revisiones1 sin duplicados; normal205pass/30skip/4628aserciones/lint304files/tipos/build30recursos. Auth simulado soloenfixture; Google/RPCNext siguepiloto. Cleanup ownrunnerexit0. Próxima13b1b compatibilidad deprotocolo.


13b1b1: identidad/pull anuncian rango min/max por x-dalis-sync-protocol sin modificar bodyidentity existente. Nuevo cliente exige header válido <=128bytes con rango quecontieneprotocol1; ausencia/corrupto/incompatible pausa update_required antesdeleerbody/claim/cursor. Schedulerpausa yUI indica cerrar/reabrir conconexión, pendientes conservados; sinreloadautomático. Rango estricto Zod1..1000000/min<=max; noPII. Clientesanteriores sinhandshake noobtienenprotección retroactiva. 209pass/30skip/4670aserciones/lint310files/tipos/build30recursos y12escenariosMongoaprobados; ownresourceslimpios. Próxima13b1b2 guarda incompatibilidad enpush yprueba mixeddeployment.


13b1b2: envelope Zodacotado/estricto verifica identidad/versión/duplicados/payloadsize antes deejecutar, batch conversiónfutura devuelupdate_required sinprefijoaplicado; auth/cuenta precedenexecutor. Coordinador libera lease yconservaUUID/payloadsinACK. TreceescenariosMongo: missing/future/futurepull conservan snapshotexacto; futurepush deja pending/lease0/attempt1; reload compatibleconverge una revisión1 enambosdispositivos. 211pass/30skip/4685aserciones/lint310files/tipos/build30recursos, ownrunnerexit0/cleanup. Próxima13b2a comprobaciónactualización segura.


13b2a: Ajustes ofreceComprobaractualización anteupdate_required, registroexistente/online ywaiting/installing/current/offline/unavailable, sinregister/skipWaiting/reload. Observador conecta instalaciónyaencurso ydisposequitalisteners; avisoesperacompacto. 214pass/30skip/4702aserciones/lint314files/tipos/build30recursos. FixtureReact/IndexedDB/workerdeproductoreal con2versionesownloopback: v1activo/v2waiting mantienedatos/colaexactos, cerrar/reabriractivav2yconservaUUID/payload/estado, cleanupownreg/caches/partición/baseline. Móvil390sin overflow/checkbutton44px. Próxima13c1a backupcontractportable; import/exportUIposteriores. Google/RPCNextrequierepiloto.


13c1b: lector getAlllimit10001 de11stores enmisma txreadonly, ownershippartición/DBversion/fecha/byteguard sintruncate, wrapperactor/epochantesdespués yclosefinally. IndexedDB4checks+reload: snapshot completo/colaexacta/tombstone/preferencias/roundtrip, snapshotprecedewritecoherente, unknownmetadatarechaza sin cambios, wrongpartition/epoch yepochcambiada durantelectura noentregadatos/closeexacto. Owncleanupnormal217pass/30skip/4727aserciones/lint321files/tipos/build30recursos. Próxima13c1cdescargaUI si margen, importación siguependiente.
