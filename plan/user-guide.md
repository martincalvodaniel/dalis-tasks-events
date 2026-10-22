# Guía de uso de Dalis

Versión de referencia: generación 6 de `int`, revisión del 21 de octubre de 2026. Describe el código validado de esta rama; su publicación en producción se comprueba por separado en la [guía de cierre](release-readiness.md). El usuario ya [aprobó los diez pasos en dos dispositivos físicos](manual-device-checklist.md), incluidos reapertura offline y reconexión.

## Preparar un dispositivo

Abre Dalis con conexión, inicia sesión con Google y prepara tu espacio en ese navegador. Comprueba tu cuenta en Ajustes y que aparece «Disponible sin conexión». Cada dispositivo necesita su preparación inicial; iniciar sesión en otro dispositivo no copia automáticamente la caché del primero.

Después puedes crear y editar planes sin red. El guardado es local; los cambios pendientes se envían cuando vuelve la conexión y la aplicación está abierta. El servidor de desarrollo local no sustituye a la versión construida con soporte offline para probar cierre y reapertura sin red.

## Planes y calendario

El botón `+` permite crear Tarea, Evento, Cita o Nota. Comparten opciones y se distinguen por su icono. El formulario ocupa la pantalla: cruz para cancelar, check para guardar. Puedes añadir categoría, descripción, pasos, fechas, horas y repetición.

Inicio y fin tienen fecha y hora separadas. «Todo el día» oculta las horas; «Con fin» permite añadir o quitar el fin. Cambiar la fecha de inicio desplaza el fin el mismo número de días. Las flechas junto a una fecha restan o suman un día.

En la lista, pulsa el icono de un plan para pasar de sin empezar a en progreso, completado y de nuevo sin empezar. Los pasos tienen dos estados y se pueden marcar directamente; heredan el icono y color del plan. La categoría agrupa los planes y aporta su color. Un plan pendiente cuya fecha haya pasado aparece en Atrasadas conservando su estado. Mi espacio separa Atrasadas, Hoy y Próximas; puedes plegar cada sección y consultar sus contadores. Hoy y el día seleccionado en calendario muestran todos sus planes; Próximas puede ofrecer más apariciones por bloques.

Mantén pulsado un plan o categoría hasta ver la selección y arrástralo para ordenar. En Mi espacio y en el día del calendario puedes mezclar planes simples y apariciones de repeticiones dentro de su categoría. El orden de una aparición afecta sólo a ese día, no a las demás fechas de la serie. En el calendario puedes arrastrar un plan a otro día. Desliza horizontalmente sobre la cuadrícula para cambiar de mes; «Hoy» vuelve al actual. Tocar un día abre su contenido. Las acciones de una aparición de una repetición permiten cambiar su progreso y pasos sin completar las demás.

Con teclado, usa Tab para recorrer controles. «Saltar al contenido» evita recorrer la navegación; al cambiar de pantalla el foco pasa al título. En el calendario, Re Pág/Av Pág cambian de mes desde sus controles. Para ordenar una fila enfocada, usa Alt y flecha arriba/abajo. Para cambiar una fecha sin arrastrar, abre Editar y modifica Inicio; las flechas junto al campo permiten sumar o restar un día. Los errores del editor se anuncian y enfocan el control que revisar. El diseño permite ampliar texto y adapta filas cuando falta espacio.

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

Si aparece un conflicto, Ajustes compara tu borrador, la versión remota conocida y el envío. La versión revisada puede haber cambiado después: una elección local todavía necesita confirmación del servidor y puede encontrar otro conflicto. Cancelar no escribe y las decisiones conservan el historial.

Las opciones disponibles dependen de la evidencia y de los cambios relacionados:

- **Plan sin repetición:** usar la versión remota o reenviar el borrador. Con un borrado remoto confirmado, crear una copia con identidad nueva.
- **Apariciones:** revisar una aparición o una cohorte compatible de varias fechas; usar lo remoto o reenviar las excepciones revisadas. Una aparición remota cancelada/eliminada puede copiarse como plan independiente cuando el diálogo lo ofrece: conserva su borrador, sin repetición, categoría ni orden, y no resucita el original.
- **Categorías:** revisar nombre/color, borrado u orden. Adoptar una categoría remota viva puede restaurar su visibilidad y la de sus asignaciones; no modifica el contenido de los planes.
- **Asignación y orden de planes:** comparar la categoría y las posiciones implicadas, incluidas otras fechas cuando el movimiento de la categoría del padre las afecta. La revisión de contenido+categoría permite elegir ambos conjuntamente. Un reenvío de varios cambios puede verse de forma intermedia hasta confirmarse por completo.
- **Zona personal:** usar la zona remota o reenviar la local, sin mover las fechas de los planes.

No todas las combinaciones permiten resolver desde la interfaz. Un padre eliminado, una versión remota desconocida o dependencias externas pueden mantener el caso protegido y bloquear los cambios que dependan de él. Esto no acredita borrado ni autoriza descartar pendientes. Descarga el JSON, conserva el identificador de incidencia y solicita revisión; no borres almacenamiento ni bases de datos para desbloquearlo. La copia de una serie completa y las resoluciones excepcionales aplazadas no forman parte de esta versión.

La exportación es evidencia y copia local; importar no reconstruye automáticamente una cuenta, series o historial. Mantén el archivo privado y revisa el alcance de la vista previa.

## Alcance actual

Se sincronizan planes propios simples y repetidos, progreso y pasos de apariciones, categorías, asignaciones, orden y zona horaria. Compartir por Gmail está fuera del alcance actual; cumpleaños está aparcado. El tema se mantiene por dispositivo.

El [plan maestro](master.md) registra lo pendiente. La [checklist física](manual-device-checklist.md) permite comunicar resultados sin enviar contraseñas, cookies ni tokens.
