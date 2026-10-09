# Provisión personal de entorno

Estado: contrato preparatorio. El único comando entregado es `bun --no-env-file run db:preview-personal-indexes`, que no conecta y no acepta argumentos; muestra índices automáticos y personales del registro. No hay todavía un CLI online de provisión; los nombres de interfaz de este documento son objetivos futuros.

## Destino y autorización

La conexión futura toma credenciales sólo de configuración del proceso, nunca de argumentos ni del repositorio. Antes de cargar el adaptador que conecta, valida un descriptor estricto con entorno declarado (`local` o `preproduction`), nombre de DB esperado y autoridad Mongo esperada. Configuración debe contener `MONGODB_DB` explícito: el fallback de `getDatabaseEnv()` no constituye un destino aprobado. Comparar DB y autoridad exactas; ninguna selección por prefijo, substring o nombre parecido.

La autoridad corresponde a host/puerto o lista de hosts de la URI sin usuario, contraseña, ruta ni query. No imprimir la URI ni errores de su parser. Admitir formas compatibles con el driver instalado, incluida SRV y listas de hosts, mediante validación conservadora; rechazar formas ambiguas antes de conectar. No aceptar credenciales en la autoridad esperada. Un nombre o un descriptor no prueban que el entorno sea preproductivo: autorización humana debe identificar el entorno y su conexión concreta. La autorización desatendida actual excluye la DB del usuario.

## Efectos exactos y revisión

`getDatabase()` usa el singleton y asegura los índices automáticos registrados una vez por proceso. Por ello una operación online basada en ese API puede crear índices automáticos faltantes antes de inspeccionar los personales. No ofrecer una opción llamada inspección de sólo lectura ni ocultar ese bootstrap. No cambiar el singleton para eludirlo en este corte.

Antes de solicitar autorización de entorno, la vista previa ampliada debe mostrar las nueve definiciones automáticas y las tres personales seleccionadas del registro vigente. Sus números son evidencia actual, no una segunda lista hardcodeada: si cambia el registro, reevaluar alcance. La autorización de ejecución incluye estos efectos de bootstrap y la creación de los personales pendientes; una incompatibilidad o un fallo del bootstrap detiene el procedimiento. Ningún comando debe autoprovisionar desde auth, routing, inicio del producto o handshake.

Tras bootstrap autorizado, verificar nombre real de DB, observar readiness y delegar en `provisionMixedSyncIndexes`. Crear únicamente las especificaciones centrales que ese servicio seleccione; reinspección, prefijo confirmado y resultado final conservan su contrato. No borrar, renombrar, deduplicar datos o deshacer índices parciales. Una creación con respuesta perdida puede existir sin figurar en `created`; no convertir esa incertidumbre en éxito de la ejecución.

## Resultado y cierre

Salida técnica en inglés con fase y estado finitos, readiness saneado y nombres confirmados; nunca mensajes Mongo crudos, tokens, documentos, URI, userinfo ni cause. El resultado offline no anuncia readiness. Fallo de configuración/destino, bootstrap, conexión, inspección, incompatibilidad o creación produce exit distinto de cero; sólo final `ready` sin fallo incierto produce éxito. Esperar cierre del singleton en finally y no borrar recursos de entorno como limpieza.

## Cortes siguientes

1. **11c4a8g:** schema/guardia pura de destino y configuración explícita; pruebas de mismatch, fallback, credenciales, SRV/listas/ambigüedad y errores saneados. Sin conectar ni modificar variables globales de tests.
2. **11c4a8e:** ampliar revisión offline del registro completo y construir adaptador server-only/CLI separado. Validación de destino antes de conexión; toda operación Mongo permanece en lib/db, sin cliente adicional. Probar config inválida sin conexión y contratos de salida/exit/cierre.
3. **11c4a8t:** prueba integrada sólo en DB propia del descriptor, con bootstrap, partial-create/retry y cierre. No ejecutar comandos con configuración del usuario para verificar el CLI.
4. **Activación:** preparar conexión conjunta de identidad/ruta/acción/runtime/UI y matriz de transición; solicitar autorización sólo con procedimiento concreto revisable y prerrequisitos de entorno cerrados. El producto sigue transporte1 hasta entonces. Piloto Google requiere sesión autorizada; evidencia Next con usuarios sintéticos no lo sustituye.

Referencias: [activación mixta](mixed-sync-activation.md), [registro central](../src/lib/db/ensure-indexes.ts), [singleton](../src/lib/db/client.ts), [provisión preparada](../src/lib/db/mixed-sync-index-provisioning.ts) y [prueba propia](../src/lib/db/mixed-sync-index-provisioning.integration.test.ts).


Avance11c4a8g1: [schema del descriptor](../src/schemas/personal-index-target.ts) y [guardia pura](../src/lib/db/personal-index-target.ts) cerrados con dos tests/54 aserciones. Compara descriptores ya resueltos; no parser de URI, lector de env o permiso. Siguiente11c4a8g2 debe derivar y validar autoridad/config sin fallback antes de conectar, y probar formas ambiguas según el driver instalado. Restricción de caracteres del descriptor no sustituye formato completo de hosts/puertos/SRV.


Avance11c4a8e1: vista previa ampliada usa automaticIndexSpecs real y selector personal exacto, nueve y tres definiciones actuales respectivamente. Se ejecutó con entorno vacío sin conexión y argumentos/apply rechazados. La parte de conexión de11c4a8e todavía depende de resolver/config11c4a8g2 y pruebas propias posteriores.
