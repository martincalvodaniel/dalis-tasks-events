# Provisión de índices de repetición

## Estado y alcance

17e1c1 valida el procedimiento con Mongo propio. Ninguna conexión ni creación en Preview/producción. Permiso específico solicitado12oct: pendiente de respuesta humana; no inferirlo del permiso anterior de categorías/asignaciones.

Nuevo índice registrado en ensure-indexes: colección `plan_occurrences`, nombre `plan_occurrences_user_series_slot_uidx`, keys `{userId:1,seriesId:1,slotKey:1}`, `unique:true`, provisión explícita. Selector recurrente incluye los cuatro índices personales ya registrados más éste; no definiciones ad hoc. El singleton puede crear nueve índices automáticos faltantes antes de los explícitos: no llamar readonly a la ejecución.

## Revalidación de fuente — 12oct

Vercelautenticado: búsquedaMONGODB envariablesdelproyecto muestra dosMONGODB_URI con Preview yProduction vinculados arecursosdistintos, sin MONGODB_DB ni overrideint visible. LinkPreview abre guíade atlas-dalis-tasks-events-debug disponible, conexiónoculta. Tab60 delnavegadorintegrado conservada para retomar; no recapturarURI hasta actuacióndestinoautorizado, ninguna conexión/creaciónenDBusuario encontinuaciónactual. Nombre dalis-tasks-events ya confirmado, no repreguntar. Permisoespecífico de índiceaparición sigue pendiente; elecciónconjunta5 preparada/desactivada yprobada17e2b1, noflipantesreadiness.

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
