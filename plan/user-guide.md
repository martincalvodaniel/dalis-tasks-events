# Guía de uso de Dalis

Versión de referencia: generación6 en `int`, 17 de octubre de 2026. La aplicación sigue en preproducción. Esta guía describe las funciones disponibles; la aceptación final en dos dispositivos físicos continúa [pendiente](manual-device-checklist.md).

## Preparar un dispositivo

Abre Dalis con conexión, inicia sesión con Google y prepara tu espacio en ese navegador. Comprueba tu cuenta en Ajustes y que aparece «Disponible sin conexión». Cada dispositivo necesita su preparación inicial; iniciar sesión en otro dispositivo no copia automáticamente la caché del primero.

Después puedes crear y editar planes sin red. El guardado es local; los cambios pendientes se envían cuando vuelve la conexión y la aplicación está abierta. El servidor de desarrollo local no sustituye a la versión construida con soporte offline para probar cierre y reapertura sin red.

## Planes y calendario

El botón `+` permite crear Tarea, Evento, Cita o Nota. Comparten opciones y se distinguen por su icono. El formulario ocupa la pantalla: cruz para cancelar, check para guardar. Puedes añadir categoría, descripción, pasos, fechas, horas y repetición.

Inicio y fin tienen fecha y hora separadas. «Todo el día» oculta las horas; «Con fin» permite añadir o quitar el fin. Cambiar la fecha de inicio desplaza el fin el mismo número de días. Las flechas junto a una fecha restan o suman un día.

En la lista, pulsa el icono de un plan para pasar de sin empezar a en progreso, completado y de nuevo sin empezar. Los pasos tienen dos estados y se pueden marcar directamente; heredan el icono y color del plan. La categoría agrupa los planes y aporta su color. Un plan pendiente cuya fecha haya pasado aparece en Atrasadas conservando su estado.

Mantén pulsado un plan o categoría hasta ver la selección y arrástralo para ordenar. En el calendario puedes arrastrar un plan a otro día. Desliza horizontalmente sobre la cuadrícula para cambiar de mes; «Hoy» vuelve al actual. Tocar un día abre su contenido. Las acciones de una aparición de una repetición permiten cambiar su progreso y pasos sin completar las demás.

## Ajustes de cuenta y dispositivo

Ajustes muestra la cuenta Google activa. «Cambiar cuenta» mantiene separados los espacios locales; los pendientes no se transfieren a otra cuenta.

«Editar zona» guarda una zona horaria válida, por ejemplo `Europe/Madrid`, también sin conexión. Esta preferencia se sincroniza con tu cuenta y se usa para Hoy/Atrasadas. No desplaza las fechas ni cambia la zona guardada en planes o series existentes. No se cambian automáticamente al viajar.

Tema ofrece Sistema, Claro y Oscuro. Es una elección de este navegador/dispositivo y permanece local; Sistema sigue el aspecto del sistema operativo.

## Sincronización y actualización

En Ajustes, «Sincronizar ahora» revisa envíos y descargas. Los contadores permiten distinguir pendientes, conflictos y cambios rechazados. «Última revisión terminada» informa sobre esa pasada; para comprobar dos dispositivos hay que comparar también sus datos visibles.

Si se pide actualización, guarda cualquier formulario abierto, pulsa «Comprobar actualización» cuando esté disponible, cierra las pestañas de Dalis y vuelve a abrir con conexión. El procedimiento conserva los datos y las intenciones locales. No requiere limpiar almacenamiento.

Un cambio de cuenta remota o una sesión caducada puede detener la sincronización. Comprueba la identidad e inicia sesión con la cuenta correspondiente; los cambios locales siguen conservados.

## Copias y conflictos

Desde Copia de seguridad puedes descargar un JSON de este dispositivo, incluida su cola y evidencia de sincronización. Conserva el archivo en un lugar privado: contiene datos personales. Exportar no confirma cambios pendientes ni crea una copia de todos los dispositivos.

La importación muestra una vista previa y crea copias nuevas de planes sin repetición compatibles. No es un reemplazo completo de la cuenta ni una restauración de la cola, de las preferencias o de las series. Revisa la vista previa antes de confirmar.

Si aparece un conflicto, Ajustes permite comparar el estado local, la versión remota conocida y la evidencia del envío. Esa versión remota puede haber cambiado después. Para planes sin repetición y sin cambios relacionados externos, puedes adoptar la versión remota conocida, reenviar todo tu borrador o crear una copia si el original remoto fue eliminado. El diálogo explica qué intenciones sustituye y permite cancelar. Para un conflicto de zona horaria personal, puedes usar la zona remota conocida o guardar tu última zona local para enviarla de nuevo; no cambia las fechas de los planes y puede aparecer otro conflicto. Quedan casos de contenido con categoría dependiente, apariciones y otras preferencias sin resolución disponible. Conserva el JSON y el número de incidencia si el caso no tiene resolución disponible. No borres datos para desbloquearlo ni interpretes un cambio local como confirmación del servidor.

## Alcance actual

Se sincronizan planes propios simples y repetidos, progreso y pasos de apariciones, categorías, asignaciones, orden y zona horaria. Compartir por Gmail está fuera del alcance actual; cumpleaños está aparcado. El tema se mantiene por dispositivo.

El [plan maestro](master.md) registra lo pendiente. La [checklist física](manual-device-checklist.md) permite comunicar resultados sin enviar contraseñas, cookies ni tokens.
