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


13c1c: secciónplegablecompactaCopia de seguridad enAjustes, downloadsolo tras snapshotvalidado yguardiaactual, JSONBlob/filenamefecha sincuenta yURLrevocable/linkremovido. Mensajehonestodescargasolicitada, importacióntodavíano disponible; sinfetch/ACK/escrituras. FixtureUIreal390 confetchbloqueado validaBlob11stores/colaexacta, epochcambiado error sinsegundaBlob, recursospropios limpios yviewportreset; botón44px/sin overflow. Normal217pass/30skip/4727aserciones/lint325files/tipos/build30recursos aprobados. Próxima13c2apreviewpuro deimportación si margen; ejecutor/importUI posteriores.


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


### Resultado11c2a1 — Categorías propias en MongoDB

Repositorio server-only conactor/session/singleton; UUID compuesto porcuenta, catálogo íntegro<=10000 incl.tombstones yregistros positivos validados. Insert inicial yCAS porrevisión/createdAt/activo; identidad duplicadafalse solo fueradesession, nombre duplicado/error ensessionpropagados. Índices centrales únicos deidentidad/nombreactivo registrados explicit: login/bootstrap no activa colección pendiente. Compartidos/executor/wire/ACK noampliados. Se ajustó replaceOne aWithoutId deldriver: filtra_idcompuesto ypreserva_id omitiéndolo delreemplazo.

Worker paralelo propietario solotest/runner, rootrepo/contratos/registro/plan. MongoDB8.2.11amd64 digestfijado revalidado; runner aislado21pass/0fail/168aserciones, seis nuevas pruebas/63aserciones: mismoUUID/nombre entreactores, CASrace, tombstone/nombre reutilizable, carrera nombre activo ycolisión replace, corrupción, catálogo exacto10000/overflow10001, rollback tardío múltiple yduplicado dentro detransacción. Contenedor/tmpfs propios limpios, sinDBusuario/envsecrets/browser. Normal254pass/38opt-in skip/0fail/5000aserciones; lint362archivos, tipos/build34recursos/diff-check aprobados.

Siguiente11c2a2: repositorio deitemViews propio, conCAS/identidadcompuesta ysession, pruebas aisladas yautorización decontenido enexecutor posterior. Mantener cortes separados yreserva10%, sin declarar preferencias activas.


### Resultado11c2a2 — Vistas personales en MongoDB

Repo server-only propio/session/singleton poractor+itemId, claveMongo compuesta validada yrevisiónpositiva compartida conplanner. Read incluye tombstone, insert inicial yCASrevision/createdAt/activo, duplicateidentityfalse fuera desession ypropagación dentro. CategoríaUUID/null validada; índice único userId/itemId explicit, no provisionado porbootstrap. Persistencia no concede acceso acontenido: executor posterior debe verificar item/tag vigentes enmisma transacción; no nuevoscallers/envíos/ACK activos.

Worker solointegrationtest/runner; rootrepositorio/schema/registry/plan. RunnerMongoDBpropio exit0:25pass/0fail/215aserciones en6archivos; cuatro pruebas nuevas/47aserciones deaislamiento conUUIDigual, metadata/propiedad, CAS/conservar/quitarcategoría/tombstone, corrupción yrollback múltiple/duplicado ensession. Contenedor/tmpfs propios eliminados; pinned8.2.11amd64 revalidado, noDBusuario ni secrets/hosting. Normal255pass/44opt-in skip/0fail/5002aserciones, lint364archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b0: concretar contrato deatomicidad/recibos/journal ydependencias decompatibilidad antes deimplementar ejecutor multirregistro. Preferencias aún sin sincronización activada; task.move/settings/series/compartidos posteriores.


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


### Resultado 11c2b2a — Lectura común de recibos

Función server-only poractor+operationId validados, colección vigente/singleton yClientSession opcional. Quita únicamente_id yreutiliza decoder legacy/v2, valida coherencia ydevuelve clones/null sin IOextra/escrituras. Consulta ya cubierta por índice único actorUserId/operationId vigente; no requiere índice nuevo yno activa colecciones personales. No callers productivos nuevos ni cambio deejecutor/wire/ACK.

MongoDB propio runner28pass/0fail/231aserciones en7archivos; tres nuevaspruebas: mismoUUID entreactores/legacy+personal/independencia/requests inválidos; corrupción/futuro rechaza yfixture restaurada; receipt visible sólo dentro desession yrollback intacto. Runner revalida disponibilidad medianteimagen fijada/guards, contenedor/tmpfs propios eliminados; noDBusuario/secrets/hosting. Fixtures ajustan_id string ydiscriminantes literales a tipado deldriver. Normal265pass/49opt-in skip/0fail/5121aserciones, lint378archivos, tipos/build34recursos/diff-check aprobados.

Próxima11c2b2b: mutaciones multirregistro propias + contador compartido + journal/recibo enmisma sesión, replay/CAS/fallos tardíos ypruebasMongo;11c2b3 probará carreras conbarreras antes deactivar. Este lector no verifica digest contraintención por sísolo: futuroexecutor debe comparar fingerprint yautorización vigente. Elegir siguientecorte trascuotas, reservando margen de reparación/cierre ysin equiparar porcentajes deventanas.


11c2b2b1: runner incluye `remote-tag-commands.integration.test.ts`; Mongo propio33pass/305aserciones/0fail en8archivos. Commit/replay, CAS/tombstone/nombres, compactación de tres efectos con rollback tras recibo e historial mixto item/tag probados. Sin callers reales; no prueba nueva de navegador ni de convergencia. Índices personales explícitos sólo en DB propia; contenedor/tmpfs limpiados. Carreras con barreras11c2b3 pendientes.


11c2b2b2: runner incorpora pruebas de comandos de vistas; Mongo aislado37pass/363aserciones/0fail, nueve archivos. Validaciones de cuenta/contexto, asignar/cambiar/quitar/CAS, duplicados/replay, contenido intacto, rollback tardío y exclusión de series/birthday. Regresión de categorías al extraer helper común. Recursos propios eliminados. No prueba nueva de UI real ni carreras con barreras;11c2b3 pendiente.


11c2b3a: nuevo archivo `remote-preference-races.integration.test.ts` en runner; Mongo42pass/412aserciones/0fail,10archivos. Barreras de promesas/spies readonly en tests fuerzan snapshots solapados frente a commits create/delete de vecinos, item/tag delete y colisión NFKC. Relecturas, tombstones y ledger sin efectos parciales comprobados; recursos propios y mocks limpios. No browser/convergencia ni activation nuevos.


11c3a2: runner incorpora reader mixto; Mongo46pass/475aserciones/0fail,11archivos. Historia de executors item/tag/view, checkpoint congelado/tombstones, fixtures de corrupción/restauración/permiso ausente y paginación UTF8 de28tareas completas. Fixtures grandes creadas transaccionalmente en DB propia para probar límites del reader, no como prueba de ACK. Contenedor/tmpfs eliminados. Sin piloto nuevo de navegador ni activación.


11c3b2a: runner vigente11archivos, Mongo48pass/494aserciones/0fail; replay item v2 tras tombstone sin reescritura, corrupción/restauración y UUID personal reutilizado frente al executor item probados. Índices de categoría registrados sólo en DB propia; recursos propios eliminados. Sin activación ni piloto nuevo.


11c3b2b: runner incorpora dispatcher, Mongo52pass/520aserciones/0fail en12archivos; mezcla y replay tardío, colisiones entre familias, aislamiento, unsupported sin efectos y familia histórica incompatible/restauración. Recursos propios eliminados; no nueva ruta, protocolo activo ni navegador.


11c3b2c2: runner vigente12archivos, Mongo55pass/618aserciones/0fail. Batch real: pérdida de respuesta tras commit de categoría y replay sin duplicados, identity_reuse por familia/foreign-view unavailable y respuestaUTF8>2MiB sobre16tareas que conserva intención excluida ya committed y converge en32secuencias. Sin ACK local ni piloto físico nuevo; recursos propios eliminados.


### 11c3c2b — Backup e importación reales con historia mixta

Fixtures propios en loopback4179/4188: backup cinco checks más recarga conservan once stores, cola/tombstones, snapshots personales local0/base5/conflict2 y shadow item2 sin cambio de datos. Import once checks más recarga comprueba source2 y archivo legacy, outcome personal/counter/tail/conflict/shadow preexistentes intactos, fuente JSON byteexacta, replay/rollback final/carrera y cuenta/época. Comparación del registro bruto IDB prueba que importar no reescribe el outcome personal; comparación del snapshot validado conserva representación lógica. Evidencia sintética sólo en partición browser-test propia, no resultado remoto ni convergencia. Cleanup de todas las particiones/control propios confirmado; servidores y pestañas de fixture cerrados.


### 11c3c2c — Lectura de incidentes mixtos y resolución item compatible

Fixture sync-incidents: cinco checks más dos tras reload, item2 + conflicto personal con shadow/base más nuevos que replay, snapshot local0/tombstone y dependiente cruzado bloqueado. Corrupción futura rechaza ambos readers sin snapshot parcial, cuenta/época impiden exponer datos. Fixture sync-resolution vigente: ocho checks más reload, decisiones/replay/copia/rollback y externos retenidos siguen funcionando con reader compatible. Cleanup propios/servidor confirmados; estos fixtures no prueban ACK personal remoto ni convergencia. Render puro verifica personalcard compacta con detalles en español y sin botones/choices.


### 11c3c3a — ACK personal standalone en IndexedDB

Runner propio4191, dos particiones UUID sin control real: diez checks completos prueban compactación/rebase por clave y revisión independiente, ACK final reconcilia cachedshadow más nuevo sin cambiar replay, conflictos/rechazos/unsupported preservan cadenas, leases/intención/cuenta, vista sin modificar contenido, guardia de nombre de DB incluso con filas ajenas contaminadas, store unsupported antes de TX, evidencia futura de otro registro, fallo outcome tardío rollback completo y fila10001 sin truncar/ACK. Recursos propios limpiados y servidor detenido. Resultado sintético local: no prueba executor remoto ni convergencia de dos clientes.


### 11c3c2d — Readers item2 sobre flujo vigente

Sync-results siete checks+reload preservan getter y replay acknowledged brutos con outcome/shadow item2; ACK siguiente aplica frente a shadow2. Sync-pull seis checks+reload conserva pendiente/cursor y acepta shadow2 al plegar tombstones/versiones, rollback/carrera/historia vieja. Helper de fixture restringido a browser-test loopback; no cambia filas reales ni simula convergencia. Cleanup y servidor propios cerrados.


### 11c3c4a2 — Descarga mixta local aislada

Runner sync-pull-v2-test-server en4192 y fixture sync-pull-v2 restringida a loopback/browser-test UUID. Ocho escenarios IndexedDB comprobados: multiefectos+item/view/shadows/cursor y reopen, replay readonly, pendientes/historia, checkpoint/contradicción, late cursor rollback/retry, cuenta/store antes de TX, fila10001, paginación/tombstones y corrupción futura incluso página ignorada. Particiones y pestaña/servidor propios limpiados; no control ni datos de despliegue real. Falta11c3c4b1: convergencia con dos particiones/executors Mongo reales; esta prueba sintética local no la sustituye.


### 11c3c4b1 — Dos orígenes, ACK y descarga mixta con Mongo real

`bun scripts/sync-db-test-runner.ts browser-mixed` consume descriptor propio y levanta dos orígenes loopback efímeros con capability run; abrir URL impresa y pulsar Ejecutar prueba mixta integrada. Ocho escenarios reales cubren offline/reload, bootstrap paginado, ACK personal/item y rebalance, pérdida de respuesta con replay UUID y receipt único, tombstone/desasignación explícita, cursor compartido, conflicto con dependientes y task.move histórico unsupported sin ACK. Comparación de ambas particiones con DAL/journal Mongo sólo donde no hay blockers. Cleanup de todas las bases UUID y recursos runner propios confirmado, exit0. No control de cuenta real ni nuevas rutas públicas/transportes activos. La prueba anterior de descarga standalone sigue siendo evidencia local complementaria.


### 11c4a3s — Wrapper mixto en navegador

Runner `bun scripts/mixed-sync-store-test-server.ts` imprime origen efímero loopback/capability; botón ejecuta seis checks de snapshot/historia/recarga/grafo/actor/10001/dispatch/ACK/replay/pull/partialopen/close. Índiceuniquesequence rechaza seed duplicado con rollback, no se puede sembrar fila inválida así. Toda DBficticia y conexiones/pestaña/servidor propiaslimpias y exit0. Son resultados locales sintéticos; no prueba remota de coordinator/runtime.


### 11c4a3r — Control de cuenta y vida del runtime

`bun scripts/runtime-pilot-v2-test-server.ts` imprime origen/capability efímeros; botón ejecuta seis checks con guardias realesaccount-control y puertosremotos diferidos sintéticos. Cuenta inactiva, singleflight/close, cambioepoch durantepull/push, release/intenciónexacta sinACK, cierre/reopen y confirmaciónposterior durable+cursor. Controlficticio/partición/servidor/pestaña propios limpios y exit0. No nuevos permisos, cuentaGoogle ni Mongo parafixtureguardias. Piloto remoto conjunto pendiente11c4a4p.


### 11c4a4p — Coordinador/runtime/HTTP con Mongo

Runner browser-mixed ahora diezescenarios. Ademásde8anteriores, comando coordinate abre runtimereal con accountcontrolficticio y transporteHTTP2, remapeando sólo rutas al mismo loopback, sin inyectarhandshakecliente. Servidorfixture anuncia2, propioMongoexecute/services validados. Respuestaperdida de create antesACK, replay y categoría/vista dependientes confirman tresintenciones únicas y convergenciadosparticionesMongo; recarga/idleoutcomesliteral. Runtime también conserva move/conflictopersonal y permitecontenidoindependiente. Cleanupowncontrol/particiones/conexiones/container/tmpfs/pestaña/server y exit0 confirmados. NoGoogle/prod/activaciónpersonal, ni convergenciadecolasbloqueadas.


### 11c4a5i — Readiness contra índices Mongo reales

El runner aislado incorpora mixed-sync-index-readiness.integration.test.ts. Provisiona sólo tres specs centrales explícitos en la DB exacta de su descriptor, inspecciona definición real mediante singleton y verifica listIndexes byteequivalente antes/después de readiness. Suite56pass/620aserciones sin fallo, container/tmpfs/proxy propios limpiados. Mocks verifican ausencia/definiciones incompatibles/error sin provisión; no comprobar DB del despliegue ni alterar sus índices.


### Provisión personal aislada 11c4a8m

`bun run scripts/sync-db-test-runner.ts indexes` ejecuta únicamente [mixed-sync-index-provisioning.integration.test.ts](../src/lib/db/mixed-sync-index-provisioning.integration.test.ts), sin compartir índices explícitos con otras suites. MongoDB propio:2 pass/20 aserciones, duplicados/creación parcial/reintento/noop y respuesta perdida tras create real; registros conservados. Recursos propios limpiados y exit0. No inspección ni provisión del entorno del usuario. La frontera RPC Next todavía requiere ejecutar su fixture independiente.


### Next/Server Action con sesión persistida — 11c4a7n

`bun run scripts/sync-db-test-runner.ts next` crea app temporal ignorada y MongoDB propios. Build/start Next reales, env sintético exacto, dos hosts con sesiones BetterAuth persistidas, wrapper ServerAction compilado→acción2/defaultauth/DAL reales. Siete escenarios navegador correctos de escritura/descarga/replay/cuenta/protocolo/revocación/caducidad/noverificado; tres entidades/recibos/journal sin duplicados, ambas descargas verificadas contra Mongo. No Google interactivo ni ID exacto del endpoint productivo; runtime IndexedDB validado por el piloto mixto previo. Host exacto del request se valida por encabezado porque NextURL normaliza loopback; Origin/capability/cookies ajenas permanecen protegidas. Cleanup sólo propios y runner exit0, main/popup cerrados; captura /private/tmp/dalis-next-rpc-proof-20261009.jpg. Ninguna DB/cookie productiva tocada.


Modo `operator` del runner aislado: selecciona exclusivamente personal-index-operator.integration.test.ts para no compartir drops/creaciones de definiciones con otras suites. CLI subprocess real --no-env-file/--conditions=react-server, sin mocks, recibe sólo env del descriptor. Tres casos/70aserciones pasan (bootstrap completo, guardias, partial-create/retry/noop); contenedor/tmpfs/bridge limpiados. Nunca ejecutarlo con env del usuario.


Ampliación11c4a9n del modoNext: nueve escenarios con referencias directasaction2 y composicióndefault, APIs exactas privadas guardadas por cookiecapacidad y Host/Origin/cookiespropias, dos particiones IndexedDB además de sesionesMongo. Inventario local previo rechaza todo estado ajeno antesdeaccount-control; limpieza sólo recursos creados/trackedporrun. Cursor/snapshots/ACK/summary/noop igualesjournalMongo. Fixture/build/servidores/container/cookies/particiones propioslimpios y evidencia visual local conservada; Google/endpointIDdeployed fuera de alcance.


11c4a9r: diez escenarios Next correctos; sesión revocada conserva toda la intención/cola/cursor, reautenticación del mismo actor confirma una sola vez y ambos dispositivos convergen con Mongo propio. FullDoD aprobado y recursos propios cerrados. Producto sigue transporte1 y provisión preproductiva espera únicamente nombre DB explícito, con actuación ya autorizada.


11c4a9a: once escenarios Next correctos; otra sesión verificada produce account_changed sin claim ni mutaciones locales o en ninguna de las dos cuentas remotas. Recuperar la sesión original confirma una sola vez y ambos dispositivos convergen con el diario propio. Baselines anteriores al ACK y escenarios previos conservados; fullDoD aprobado, recursos propios cerrados. Producto1 sigue activo y provisión preproductiva espera nombre explícito, con autorización vigente.


11c4a9e: doce escenarios Next correctos. La composición de época antigua rechaza resumen/intento por la guardia exacta, conserva toda intención/cola/cursor y la composición de la nueva época confirma una sola vez; ambas particiones convergen con Mongo propio. Cleanup sigue la nueva época comprometida; fullDoD aprobado. No prueba de red en vuelo ni activación productiva, y provisión preproductiva continúa pendiente del nombre explícito.


### Resultado15a2f — Selector de tareas corregido; piloto histórico conservado

El deployment e54d93f se observó Ready en Vercel. El cliente PWA anterior mostró update_required sin borrar sus cuatro elementos; cerrar la última pestaña Dalis y reabrir activó el alcance mixto manteniendo la sesión Google. La categoría propia «Piloto sync 9 oct 2026» pasó a cola vacía. La tarea propia «Piloto asignación 9 oct 2026» se creó, pero su selector emitió task.move, fuera del alcance remoto; Ajustes terminó la revisión conservando un pendiente personal sin soporte. No es un ACK ni convergencia de la asignación.

TaskList conecta ahora el selector a useItemCategory/assignLocalCategory: elegir/quitar usa item-view.set sin escribir colocaciones; reordenación explícita continúa task.move local. Busy/error/foco y bloqueo de elección rápida conservados. Prueba real de TaskList/hooks/IndexedDB en origen loopback separado: asignar Casa y quitar produce exactamente dos nuevas item-view.set pending/attempts0/lease null, con items, colocaciones y entradas anteriores intactos. Cinco casos anteriores de orden y recarga pasan; inspección tras recarga repite persistencia y selector. Control y particiones propios limpiados. La primera prueba rechazó correctamente un origen con control previo; no se borró ese control ajeno al run. Evidencia /private/tmp/dalis-category-selector-proof-20261009.jpg.

Suite460pass/98opt-in skip/0fail/7507aserciones, lint515/tipos/build34/diff aprobados. Queda el movimiento histórico del piloto en preproducción: preservado, bloquea la cadena y proyección personal según contrato. No convertirlo en item-view.set, modificar dependencias, borrar ni fabricarACK. El fix evita nuevas asignaciones mediante task.move; no resuelve por sí solo colas históricas. Falta validar deployment del fix y piloto real con partición de segundo dispositivo; dos pestañas IAB no son dos dispositivos. La recuperación de ese bloqueo necesita ejecutor de movimientos o una elección explícita respaldada por contrato/ejecutor, aún inexistente para unsupported. No declarar categorías/asignaciones completamente resueltas en esta cuenta mientras permanezca.

El usuario pide cerrar categorías/asignaciones y después recibir porcentaje estimado y titulares restantes en orden óptimo, para elegir siguiente bloque. No continuar automáticamente a bloques ajenos tras cerrar ese objetivo. Pedir sólo intervención de dispositivo/acceso/decisión que realmente falte. Commit/pushint/HEAD/cuotas al cierre.

## 16a4b — Prueba común de cuatro variantes

`bun run scripts/sync-db-test-runner.ts browser-plan` arranca Mongo propio con descriptor validado y dos orígenes loopback/IndexedDB independientes. Abrir URL impresa y pulsar «Ejecutar prueba de planes integrada». Cinco escenarios verifican guardado offline atómico, categoría/asignación, respuesta perdida/replay/ACK único, orden/progreso/checklist/borrado y recarga; comparación exacta de proyecciones/cola/cursor con13recibos. Servidor dispone de plazo y limpieza ownership; iframe elimina únicamente bases con marcador propio. Ejecución16a4b correcta con limpieza completa. No sustituye prueba RPC Next, autenticación Google ni dispositivos físicos.
