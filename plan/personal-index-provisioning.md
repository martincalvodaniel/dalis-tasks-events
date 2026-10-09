# Provisión personal de entorno

Estado: CLI separado y defaults privados entregados en11c4a8e2b; prueba integrada propia11c4a8t cerrada; pendiente ejecución preproductiva con destino verificado. `bun --no-env-file run db:preview-personal-indexes` no conecta y muestra el registro. El comando online no tiene caller productivo ni implica categorías activadas.

## Destino y autorización

La conexión futura toma credenciales sólo de configuración del proceso, nunca de argumentos ni del repositorio. Antes de cargar el adaptador que conecta, valida un descriptor estricto con entorno declarado (`local` o `preproduction`), nombre de DB esperado y autoridad Mongo esperada. Configuración debe contener `MONGODB_DB` explícito: el fallback de `getDatabaseEnv()` no constituye un destino aprobado. Comparar DB y autoridad exactas; ninguna selección por prefijo, substring o nombre parecido.

La autoridad corresponde a host/puerto o lista de hosts de la URI sin usuario, contraseña, ruta ni query. No imprimir la URI ni errores de su parser. Admitir formas compatibles con el driver instalado, incluida SRV y listas de hosts, mediante validación conservadora; rechazar formas ambiguas antes de conectar. No aceptar credenciales en la autoridad esperada. Un nombre o un descriptor no prueban que el entorno sea preproductivo: autorización humana debe identificar el entorno y su conexión concreta. El9oct el usuario confirma que preproducción y producción usan DB distintas y autoriza crear en preproducción los índices personales necesarios y automáticos registrados faltantes, una vez validado el procedimiento, reutilizando ensureIndexes sin otra confirmación. Producción, borrado y corrección automática de datos están excluidos. Esta autorización sustituye la exclusión histórica únicamente para esta actuación; verificar conexión preview/int desde fuente de entorno antes de ejecutarla, sin asumir que .env.local corresponde a preview.

## Efectos exactos y revisión

`getDatabase()` usa el singleton y asegura los índices automáticos registrados una vez por proceso. Por ello una operación online basada en ese API puede crear índices automáticos faltantes antes de inspeccionar los personales. No ofrecer una opción llamada inspección de sólo lectura ni ocultar ese bootstrap. No cambiar el singleton para eludirlo en este corte.

Antes de ejecutar la autorización de preproducción, la vista previa ampliada debe mostrar las nueve definiciones automáticas y las tres personales seleccionadas del registro vigente. Sus números son evidencia actual, no una segunda lista hardcodeada: si cambia el registro, reevaluar alcance. La autorización de ejecución incluye estos efectos de bootstrap y la creación de los personales pendientes; una incompatibilidad o un fallo del bootstrap detiene el procedimiento. Ningún comando debe autoprovisionar desde auth, routing, inicio del producto o handshake.

Tras bootstrap autorizado, verificar nombre real de DB, observar readiness y delegar en `provisionMixedSyncIndexes`. Crear únicamente las especificaciones centrales que ese servicio seleccione; reinspección, prefijo confirmado y resultado final conservan su contrato. No borrar, renombrar, deduplicar datos o deshacer índices parciales. Una creación con respuesta perdida puede existir sin figurar en `created`; no convertir esa incertidumbre en éxito de la ejecución.

## Resultado y cierre

Salida técnica en inglés con fase y estado finitos, readiness saneado y nombres confirmados; nunca mensajes Mongo crudos, tokens, documentos, URI, userinfo ni cause. El resultado offline no anuncia readiness. Fallo de configuración/destino, bootstrap, conexión, inspección, incompatibilidad o creación produce exit distinto de cero; sólo final `ready` sin fallo incierto produce éxito. Esperar cierre del singleton en finally y no borrar recursos de entorno como limpieza.

## Cortes siguientes

1. **11c4a8g:** schema/guardia pura de destino y configuración explícita; pruebas de mismatch, fallback, credenciales, SRV/listas/ambigüedad y errores saneados. Sin conectar ni modificar variables globales de tests.
2. **11c4a8e:** ampliar revisión offline del registro completo y construir adaptador server-only/CLI separado. Validación de destino antes de conexión; toda operación Mongo permanece en lib/db, sin cliente adicional. Probar config inválida sin conexión y contratos de salida/exit/cierre.
3. **11c4a8t:** prueba integrada sólo en DB propia del descriptor, con bootstrap, partial-create/retry y cierre. No ejecutar comandos con configuración del usuario para verificar el CLI.
4. **Activación:** preparar conexión conjunta de identidad/ruta/acción/runtime/UI y matriz de transición; ejecutar la provisión preproductiva ya autorizada sólo con procedimiento validado y destino de entorno verificado, sin nueva confirmación. El producto sigue transporte1 hasta entonces. Piloto Google requiere sesión autorizada; evidencia Next con usuarios sintéticos no lo sustituye.

Referencias: [activación mixta](mixed-sync-activation.md), [registro central](../src/lib/db/ensure-indexes.ts), [singleton](../src/lib/db/client.ts), [provisión preparada](../src/lib/db/mixed-sync-index-provisioning.ts) y [prueba propia](../src/lib/db/mixed-sync-index-provisioning.integration.test.ts).


Avance11c4a8g1: [schema del descriptor](../src/schemas/personal-index-target.ts) y [guardia pura](../src/lib/db/personal-index-target.ts) cerrados con dos tests/54 aserciones. Compara descriptores ya resueltos; no parser de URI, lector de env o permiso. Siguiente11c4a8g2 debe derivar y validar autoridad/config sin fallback antes de conectar, y probar formas ambiguas según el driver instalado. Restricción de caracteres del descriptor no sustituye formato completo de hosts/puertos/SRV.


Avance11c4a8e1: vista previa ampliada usa automaticIndexSpecs real y selector personal exacto, nueve y tres definiciones actuales respectivamente. Se ejecutó con entorno vacío sin conexión y argumentos/apply rechazados. La parte de conexión de11c4a8e todavía depende de resolver/config11c4a8g2 y pruebas propias posteriores.


Avance11c4a8g2: [resolver puro](../src/config/personal-index-provisioning.ts) y getter config/env.ts leen DB explícita sin fallback y derivan autoridad exacta sin credenciales. Dos tests/81 aserciones; conserva orden de seeds y no normaliza lo devuelto. DNS/IP/IPv6/puertos y SRV único sin puerto validados conservadoramente; no sockets Unix ni validación completa de opciones del driver, disponibilidad, permisos u ownership. Rechazos genéricos sin URI/cause y cero conexión. Siguiente11c4a8e2 adaptador/CLI online (la revisión offline ya está cerrada), seguido de prueba propia11c4a8t antes de actuar sobre entorno autorizado.


Avance11c4a8e2a: [ciclo privado por puertos](../src/lib/db/personal-index-execution.ts) exige descriptor/acuse de bootstrap, compara destino antes de abrir, verifica DB real y cierra cualquier intento de bootstrap. Cierre fallido conserva resultado/prefijo confirmado y no anuncia éxito. Cuatro tests/28 aserciones; sin defaults/caller/DB. Siguiente11c4a8e2b conecta defaults/CLI separado sólo para proceso operador propio;11c4a8t lo ejecuta únicamente con descriptor Mongo propio antes de actuar sobre entorno autorizado.


## Evidencia de ejecución preproductiva — 11c4a8receipt

Antes de conectar, identificar la configuración de la instancia preview/int desde una fuente de entorno verificable y conservar su procedencia; ni rama int ni .env.local prueban el destino. Comparar el descriptor esperado con la configuración resuelta y comprobar nombre real de DB después de bootstrap. No consultar producción para confirmar la separación ya declarada por el usuario.

Al ejecutar, registrar entorno preproduction, fase/estado, nombres personales de created confirmados, readiness final missing/incompatible y estado de cierre. No incluir URI, credenciales, tokens, cuenta, documentos o mensajes Mongo crudos en el registro de proyecto; los metadatos concretos de conexión permanecen fuera del repositorio. Conservar resultado parcial también si falla el cierre; creación con respuesta perdida no figura como confirmada aunque listIndexes observe su efecto. Sólo resultado ready con cierre correcto permite registrar provisión completada; fallo/incompatibilidad conserva estado y exige diagnóstico, sin borrar/corregir datos ni índices. Esta evidencia acredita índices de preproducción, no activación del cliente, Google interactivo o convergencia multidispositivo.


Avance11c4a8e2b: [operador privado](../src/lib/db/personal-index-operator.ts), [CLI](../scripts/provision-personal-indexes.ts) y [parser puro](../src/schemas/personal-index-cli.ts). Invocar en proceso separado: `bun --no-env-file run db:provision-personal-indexes <local|preproduction> <expected-database> <expected-authority> --apply --acknowledge-automatic-bootstrap`; credenciales exclusivamente en env del proceso. El primer --no-env-file también evita carga automática del launcher exterior. Guardia antes de singleton, bootstrap registrado, DB real, readiness/provisión centrales y cierre awaited. No invocar desde el servidor de aplicación: el proceso operador es dueño de la conexión que cierra. Sólo resultado ready+closed da exit0. Args inválidos generan recibo configuration/not_opened; excepción inesperada de import/operador imprime únicamente error genérico a stderr y exit1, sin inventar fase o cierre. Tres tests/126 aserciones del parser y smoke con entorno vacío (args válidos pero config ausente) rechazan antes de conexión. Suite443pass/93skip/0fail, lint/tipos/build34 aprobados. Todavía ninguna DB del usuario conectada.

Fuente disponible: panel Vercel autenticado del proyecto muestra MONGODB_URI específico Preview y otro Production; no MONGODB_DB ni overrides de rama visibles en listado. El recurso de Preview y su guía de conexión se identificaron sin revelar credenciales. Nombre explícito solicitado al usuario; el default del código no se ha convertido silenciosamente en autorización del destino. Continuar prueba propia e integración preparatoria mientras falta ese dato.


Avance11c4a8t: [prueba del CLI/defaults](../src/lib/db/personal-index-operator.integration.test.ts) ejecutada con `bun run scripts/sync-db-test-runner.ts operator` en DB propia del descriptor:3pass/70aserciones. Acredita bootstrap9, personales3, guardias sin escrituras, noop, prefijo parcial/duplicados intactos/retryonlymissing y cierre exitoso de cada proceso. No conexión al usuario. Procedimiento validado; destino preproductivo aún requiere nombre explícito y configuración Preview verificada, con autorización humana ya otorgada.


### 11c4a8pre — Nombre confirmado; acceso pendiente de Vercel

El usuario confirma dalis-tasks-events como nombre de DB preproductiva. Se revalidó la misma guía del recurso Preview identificado previamente; Show secret solicita Reauthenticate y queda deshabilitado hasta verificar identidad. Captura privada se abortó sin obtener URI, fichero de credenciales ni conexión Mongo; ninguna ejecución del operador, índice o mutación remota. Se pidió únicamente completar la verificación de Vercel en su propia pestaña, sin códigos en chat ni otra aprobación de índices. CLI/procedimiento siguen validados y autorización vigente; tras verificación reanudar captura privada/descriptor explícito/ejecución única/readiness/cierre, no reabrir pregunta del nombre.

Entrada10%5h/41%7d reservas4%/1%. Este corte no activa producto ni modifica código. Validación documental referencias/consistencia/diff, commitpushint/HEAD/cuotas al cerrar si el acceso no queda disponible. Mantener revisión única15:31 con prompt actualizado a nombre confirmado y gate de reautenticación. Fuera de la provisión, siguiente hook mixto inactivo11c4a9h requiere ventana nueva.


### Actualización 11c4a8pre — Identidad verificada; ejecución aplazada por cuota

El usuario completó Reauthenticate. La URI del mismo recurso Preview se capturó en fichero temporal privado600 y se volvió a ocultar; no se imprimieron credenciales. El launcher no inició el CLI: primer fallo por condición react-server ausente en el proceso padre; segundo por pasar el campo de procedencia source al schema estricto de conexión. Ambos anteriores a spawn/conexión. Para siguiente ejecución usar --no-env-file --conditions=react-server en padre e hijo y pasar al resolver únicamente {mongodbUri,databaseName}, verificando procedencia aparte. La corrección del launcher se identificó pero no se ejecutó otra conexión. El finally eliminó el fichero de credenciales; launcher propio retirado al cierre. Ningún índice/DB/documento remoto tocado ni recibo de provisión inventado.

Lectura real4%5h/40%7d: no abrir otra ejecución sobre reserva4%/1%. Nombre y verificación Vercel ya confirmados; única revisión15:31 preservada con prompt actualizado. Próximo lote revalida fuente Preview, recaptura URI privada y ejecuta procedimiento ya probado; no repetir pregunta del nombre ni pedir nueva autorización. Producto permanece1. Este corte cierra documentación y diagnóstico, no provisión completada; referencias/diff/consistencia, commitpushint/HEAD/cuotas.


### Resultado11c4a8pre2 — Índices Preview listos

Fuente revalidada: guía del recurso conectado a MONGODB_URI Preview de Vercel, diferente del recurso Production previamente identificado; nombre dalis-tasks-events confirmado por el usuario. Credenciales capturadas sólo en fichero privado600 fuera del repo, ocultadas de nuevo en Vercel y eliminadas después de ejecutar; no URI/credenciales/autoridad ni datos en logs/versionado. Launcher propio retirado. Padre e hijo con --no-env-file --conditions=react-server, resolver estricto sólo {mongodbUri,databaseName} y procedencia validada aparte.

CLI real preproduction con destino explícito y acuse bootstrap autorizado terminó exit0: status ready, phase complete, connection closed; provisioning ready, created item_views_user_item_uidx, tags_user_id_uidx, tags_user_active_name_uidx; readiness ready:true/missing:[]/incompatible:[], error:null. Singleton/ensureIndexes registrados usados, sin índices ad hoc ni corrección/borrado de documentos. Sólo la DB preproductiva autorizada; no producción/hosting/secretos/permisos. Recibo acredita provisión, todavía no activación del producto ni Google/convergencia desplegada. Procedimiento previo probado con Mongo propio; este corte operativo/documental valida recibo, referencias, consistencia y diff. Commit/pushint/HEAD/cuotas; siguiente11c4a9h y conexión conjunta con prueba de transición.


### Resultado11c5a12 — Operador4/defaults/CLI probado en Mongo propio

Proceso separado comparte validación destino/acuse y ciclo de conexión con operador3, exige DB real despuésbootstrap y cierre antesready. Defaults4 reusan singleton/ensureIndexes automático9 y selección personal4; scripts preview/provision específicos, URI sóloenv privado y recibo finito saneado. Cuatro tests lifecycle nuevos y cuatro previos3 pasan. Mongo propio3casos88aserciones: destino/argumentos/env erróneos no recrean automático9 retirado por fixture; CLI/defaults bootstrap9+personal4 y noop; duplicate placement conserva documentos/prefijo3, retry sóloplacement tras retirar exclusivamente duplicado del fixture. Recursos propios limpiados. Previewoffline9+4 confirmado sinDB. Suite510pass/128opt-in skip/0fail/7998aserciones, lint550/tipos/build34/diff aprobados. FuenteVercel consultada readonly: MONGODB_URI Preview sigue enlazada al recurso debug distinto deProduction, listado sinMONGODB_DB/overrideint; valoresno revelados. ProvisiónPreview4 pendiente y ya autorizada, nombreDB confirmado; no conexiónDBusuario en este corte. Nextmatrix/jointactivation/piloto posteriores. Commitpushint/HEAD/cuotas.
