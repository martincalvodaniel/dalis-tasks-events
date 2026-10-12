# Provisión de índices de repetición

## Verificación real Preview — 17e2b2c

El deployment 375cafe con sesión Google existente confirma creación de serie/vista y dos cambios de aparición. Los cuatro ACK de acción5 y su proyección remota pasan el readiness obligatorio de cinco índices. El índice de aparición está operativo en Preview, creado por el arranque central, sin CLI, captura de URI o Reauthenticate. Decoder portable3 y recarga confirman persistencia. No actuación productiva, reparación ni borrado. Captura: `/private/tmp/dalis-recurring-preview-pilot.png`.


## Procedimiento vigente — 12 de octubre, 17e2b2a

El usuario autoriza crear el índice en preproducción y pide que lo haga la propia aplicación. Esta elección sustituye el procedimiento externo para la activación Preview: no leer/copiar credenciales ni exigir Reauthenticate en Vercel.

La definición está en el registro central `src/lib/db/ensure-indexes.ts`: colección `plan_occurrences`, índice `plan_occurrences_user_series_slot_uidx`, keys `{userId:1,seriesId:1,slotKey:1}`, `unique:true`. `getDatabase()` selecciona ese índice junto al bootstrap automático sólo si los metadatos server-only son `VERCEL_ENV=preview` y `VERCEL_GIT_COMMIT_REF=int`. Usa la conexión configurada de la propia aplicación y conserva el singleton y su retry tras fallo. Producción, local y otras ramas conservan la selección anterior. Los cuatro índices personales anteriores permanecen registrados/provisionados.

La creación es idempotente. Duplicados o una definición incompatible hacen fallar el arranque sin borrar datos, sustituir índices ni reparar registros. No se imprime URI ni un recibo con credenciales. Las guardias readiness 5 siguen siendo obligatorias antes de ejecutar sincronización recurrente. El deployment debe verificarse antes de declarar la creación real; esta entrega sólo prueba Mongo propio y publica el camino automático.

Para un futuro despliegue productivo de repetición también deberá habilitarse el índice en su arranque. Este push a `int` no despliega ni modifica producción. Todos los índices necesarios para la aplicación deben seguir registrados aquí, no en componentes, acciones ni repositorios.

Validación: `bun --no-env-file scripts/sync-db-test-runner.ts recurring-operator`, seis escenarios / 120 aserciones. Tres casos nuevos prueban el arranque real: aislamiento de entorno/rama, unicidad/no-op, duplicados e incompatibilidades conservados. Recursos propios limpiados. Suite general 755 pass / 209 skip / 0 fail, lint 783, tipos/build Webpack/worker 46 aprobados.

## Histórico del operador separado, sustituido para Preview

## Estado y alcance

17e1c1 valida el procedimiento con Mongo propio. Ninguna conexión ni creación en Preview/producción. Permiso específico solicitado12oct: pendiente de respuesta humana; no inferirlo del permiso anterior de categorías/asignaciones.

Nuevo índice registrado en ensure-indexes: colección `plan_occurrences`, nombre `plan_occurrences_user_series_slot_uidx`, keys `{userId:1,seriesId:1,slotKey:1}`, `unique:true`, provisión explícita. Selector recurrente incluye los cuatro índices personales ya registrados más éste; no definiciones ad hoc. El singleton puede crear nueve índices automáticos faltantes antes de los explícitos: no llamar readonly a la ejecución.

## Revalidación de fuente — 12 de octubre

El panel autenticado de Vercel muestra dos `MONGODB_URI`: una de Preview y otra de Production, ligadas a recursos Atlas distintos. No se ve `MONGODB_DB` ni un override de `int` en el listado. El enlace de Preview abre la guía de `atlas-dalis-tasks-events-debug`, disponible y con el secreto oculto. Pestaña 60 conservada para retomar la actuación.

Nombre de DB ya confirmado: `dalis-tasks-events`. No repreguntarlo. No se han leído credenciales, abierto Mongo del usuario ni creado índices en esta continuación. La autorización específica para el nuevo índice sigue pendiente. El selector conjunto está preparado y probado en 17e2b1, pero permanece desactivado hasta provisión y readiness reales.

## Prerrequisitos antes de abrir una conexión

1. Respuesta humana afirmativa para Preview únicamente; no producción ni repair/delete de datos.
2. Verificar fuente de configuración Vercel Preview/int y posible override de rama. No asumir .env.local como Preview. Referencia histórica: recurso atlas-dalis-tasks-events-debug distinto de Production y nombre DB humano confirmado `dalis-tasks-events`; revalidar fuente actual. No volver a pedir el nombre ya dado.
3. Resolver conexión con adapter conservador `{mongodbUri,databaseName}`, autoridad aparte; URI/credenciales sólo envprivado, nunca args/logs/repositorio. Configuración/destino declarados no prueban por sí solos entorno/permisos.
4. Proceso operador propio con --no-env-file --conditions=react-server, target explícito y acuse del bootstrap. Padre también react-server si importa config server-only.

## Ejecución autorizada futura

Invocar `scripts/provision-recurring-indexes.ts` en proceso propio con argumentos: `preproduction DATABASE_NAME MONGODB_AUTHORITY --apply --acknowledge-automatic-bootstrap`. DATABASE_NAME confirmado; autoridad obtenida de fuente Preview, no URI ni credenciales. Configuración envprivada MONGODB_URI/MONGODB_DB.

CLI valida tuple/schema/target antes de bootstrap, comprueba DB real después, reutiliza singleton/ensureIndexes y readiness5 exacta. Reinspección antes de cada create y al terminar; crea sólo missing, incompatible bloquea, duplicados/definición incompatible no se reparan ni borran automáticamente. Conserva prefix exitoso ante fallo o respuesta perdida. Sólo statusready/phasecomplete/connectionclosed y exit0 confirman finalización; created/readiness/error saneados son el recibo. Cualquier fallo conserva datos y exige investigar, nunca anunciar ready por intención. Cerrar/eliminar launcher/envprivado y ocultar credenciales reveladas en UI.

## Evidencia propia

`bun --no-env-file scripts/sync-db-test-runner.ts recurring-operator`: tres escenarios,100aserciones,0fallos. Targets inválidos/implícitos/mismatch no recrean automáticos retirados; defaultsCLI crea exactamente9automáticos+5personales y luego noop; duplicados se conservan con prefix4 y retry sólo aparición tras eliminar expresamente UNA fila de fixture propia, nunca reparación operativa. Recursos propios/tmpfs/bridge retirados.

Después de provisiónPreview validada, integrar/activar generación5 conjuntamente conforme a recurrence-sync. Guardias reales de sesión/época en vuelo y pilotoGoogle/endpointdesplegado siguen como cortes posteriores; este operador no activa capacidades.
