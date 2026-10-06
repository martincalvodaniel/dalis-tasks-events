# Dalis Tasks & Events — plan maestro

Estado: identidad, sesiones y contratos del dominio comprobados (`01a–02a`); siguiente candidata `02b`. Fecha: 6 de octubre de 2026. Rama de trabajo actual: `main`.

## Objetivo

Una webapp para crear y organizar tareas, eventos, citas y cumpleaños en un calendario. El trabajo diario debe poder realizarse completamente sin conexión después de preparar el dispositivo una primera vez. Cuando vuelva la conexión, los cambios se sincronizarán con MongoDB y con los demás dispositivos autorizados. Google identifica a cada usuario; determinados elementos se pueden compartir con otra cuenta de Google mediante su dirección Gmail.

La experiencia será responsive y mobile-first: barra inferior de navegación con iconos SVG en móvil y barra superior en escritorio. Ambas se alimentan del mismo registro y se actualizan al crear cada pantalla importante. Su implementación está programada en `04c`, con criterios de accesibilidad, safe areas y navegación offline.

Este documento es la entrada al plan. La iteración `00` entregó la planificación; la implementación avanza con una lectura nueva de presupuesto entre entregas. El plan es modificable: los cambios de alcance o decisiones se registran antes de implementar y se incluyen en el commit de la iteración correspondiente.

## Documentos

| Documento | Contenido |
| --- | --- |
| [Producto y modelo](product-and-model.md) | Comportamiento, entidades, fechas, repetición, orden y permisos. |
| [Offline, sincronización y arquitectura](offline-and-sync.md) | Almacenamiento local, cola, conflictos, seguridad y rutas. |
| [Iteraciones](iterations.md) | Entregas pequeñas, dependencias, rutas y aceptación. |
| [Flujo de trabajo](workflow.md) | Ventanas de Codex, cierre, commits, pruebas y paralelismo. |
| [Registro de iteraciones](iteration-log.md) | Trabajo completado, evidencias y siguiente candidata. |
| [Operación de auth](auth-operations.md) | Transición de sesiones antiguas y verificación vigente. |

## Estado real del repositorio

Observaciones de archivos versionados; no se ha probado el login de producción ni inspeccionado credenciales.

- Next.js `16.3.8`, React `19.3.0`, Better Auth `1.7.7`, MongoDB driver `7.7.0`, SWR `2.5.1`, Zod `4.6.5`, TypeScript. Versiones de [package.json](../package.json).
- Google social login configurado en [auth.ts](../src/lib/auth/auth.ts), cliente de autenticación existente y UI de acceso en español.
- El layout de dashboard verifica sesión mediante [session.ts](../src/lib/auth/session.ts); [proxy.ts](../src/proxy.ts) realiza un filtro inicial por cookie.
- `01a` conecta Better Auth al adaptador MongoDB ya instalado: usuarios, cuentas, sesiones y verificaciones persistentes. Pruebas con MongoDB local real y dos clientes HTTP independientes comprueban estabilidad de ID tras logout y reconexión. El login interactivo contra Google real se comprobará en el piloto; los tests usan firmas válidas con una clave de prueba y conservan las verificaciones de token.
- El acceso depende de `ALLOWED_EMAILS`. Una lista vacía no admite usuarios; una invitación no debe ampliar esa lista automáticamente. Compartir en el piloto exige que ambos usuarios estén autorizados.
- Existen singleton MongoDB, cuatro colecciones de autenticación y seis índices centrales. El adaptador solo reconoce solicitudes automáticas de índices previamente registrados y provisionados. Las colecciones de producto aún están pendientes. Se respeta [src/lib/db/AGENTS.md](../src/lib/db/AGENTS.md).
- El dashboard es una pantalla inicial. No hay calendario, IndexedDB, service worker ni protocolo de sincronización.
- Hay pruebas con Bun, comprobación de tipos y Biome. El README sigue siendo el de arranque y se actualizará cuando haya un flujo ejecutable.

## Decisiones de producto

1. **Tres tipos de elemento**: `task`, `event`, `birthday`, con una base común y validación discriminada. Una cita es un evento. Evita asignar estado o checklist a un cumpleaños y permite compartir navegación, almacenamiento y sincronización.
2. **Un botón principal `+`** siempre accesible: “Tarea”, “Evento o cita” y “Cumpleaños”. Crear desde un día usa ese día como valor inicial.
3. **Lectura y escritura locales**: IndexedDB alimenta la UI; MongoDB mantiene el estado remoto aceptado. Guardar no depende de la red.
4. **Atrasadas es una condición derivada**: una tarea no completada cuya fecha prevista es anterior a hoy. Conserva fecha y estado; no necesita cron ni un cambio persistido a medianoche.
5. **Una categoría principal por usuario y elemento** en el MVP. Tareas agrupadas por esa categoría; orden manual de grupos y tareas. Múltiples etiquetas quedan para una ampliación porque requieren resolver cómo evitar duplicados al agrupar.
6. **Repetición por series y ocurrencias**: cada aparición de una tarea conserva su propio estado y checklist. Un cumpleaños genera una aparición anual de día completo.
7. **Compartición explícita** por elemento o serie, con propietario, lector y editor. Estado y checklist son compartidos; categoría y orden son preferencias personales.
8. **Sin nuevos paquetes base**: APIs nativas del navegador y el stack existente. Si las pruebas muestran necesaria una biblioteca de fechas, recurrencia, IndexedDB, calendario o PWA, se presentará su necesidad antes de añadirla.

## Alcance offline

| Operación | Sin conexión |
| --- | --- |
| Abrir y recargar la app ya preparada | Sí, incluido cierre y reapertura del navegador. |
| Consultar meses y días con datos descargados | Sí; todas las series descargadas se expanden localmente. |
| Crear, editar, borrar, clasificar y reordenar | Sí, con guardado local y cola persistente. |
| Cambiar estado, checklist y repetición | Sí, incluso con sesión remota caducada. |
| Ver datos compartidos previamente descargados | Sí, con los permisos conocidos localmente. |
| Preparar una invitación | Sí como borrador pendiente, sin conceder acceso todavía. |
| Iniciar sesión con Google en un dispositivo nuevo | Requiere conexión. |
| Aceptar invitaciones, confirmar permisos o revocar acceso | Requiere confirmación del servidor. |
| Recibir modificaciones de otros usuarios/dispositivos | Requiere conexión. |

No se promete abrir una web nunca descargada sin red. El almacenamiento del navegador puede perderse si el usuario lo borra o el navegador lo expulsa; habrá persistencia solicitada, detección de errores y exportación/importación local. Tampoco es posible eliminar inmediatamente una copia compartida de un dispositivo desconectado. Estos límites se reflejarán en la UI donde afecten a una decisión.

## Orden de entrega

`00 Plan → 01 Identidad → 02 Dominio → 03 Persistencia local → 04 Apertura offline → 05 Tareas → 06 Calendario → 07 Agenda y orden → 08 Eventos → 09 Repetición → 10 Cumpleaños → 11 Persistencia remota → 12 Sincronización → 13 Conflictos y recuperación → 14 Compartición → 15 Piloto`.

Las iteraciones complejas están partidas en subentregas en [iterations.md](iterations.md), cada una con su propio commit y control de presupuesto. Las interfaces de sincronización se diseñan desde `02–03`, aunque el transporte remoto llegue después. La primera demostración útil offline llega en `06`; el MVP completo exige también sincronización, repetición, compartición y recuperación.

## Condiciones de éxito del MVP

- En modo avión y tras reabrir: crear los tres tipos, modificar checklist/estado, repetir, navegar meses, reordenar y ver atrasadas; todo persiste.
- Al recuperar conexión: dos dispositivos de una cuenta convergen sin duplicados; una pérdida de respuesta no repite una mutación.
- Dos cuentas solo reciben sus datos propios y los elementos expresamente compartidos; otro usuario no accede adivinando un ID.
- Una tarea en curso pasa a “Atrasadas” conservando su estado al cambiar el día; una tarea completada desaparece de esa sección.
- Editar una aparición no altera otras. Una ocurrencia pasada pendiente no desaparece al modificar la programación futura.
- Invitación aceptada concede el permiso elegido; lector no puede editar, editor no puede compartir; revocación rechaza futuras mutaciones.
- Cierre inesperado, conflicto, sesión caducada, actualización de versión y falta de espacio no provocan un falso “Guardado” ni descartan silenciosamente cambios pendientes.
- Código, comentarios e identificadores en inglés; copy y accesibilidad de la UI en español. Cada subiteración completada tiene commit en la rama actual.

## Presupuesto actual y siguiente paso

Lectura inicial: **5h: 99%; 7d: 44%**. Lectura posterior a `00`, usada para `01a`: **5h: 92% restante; 7d: 43% restante**. Son porcentajes restantes, no consumidos, y no equivalen a un número fijo de tareas. El presupuesto semanal sigue siendo el condicionante. Siguiente candidata: `01b` en secuencial, pendiente de la lectura después de cerrar `01a`.

Al final de **cada** iteración se preguntarán ambos porcentajes y se elegirá continuar, dividir o detener según [workflow.md](workflow.md). No se encadenan varias iteraciones a partir de esta lectura inicial.

Excepción autorizada posteriormente: lote desatendido del 6 de octubre, iniciado con **5h 82%; 7d 41% restantes**. Entre commits se consulta el uso real sin esperar feedback, con reserva reforzada del 20%. La autorización y sus condiciones figuran en `workflow.md`; el protocolo interactivo se recupera al terminar el lote.

## Prerrequisitos por confirmar en su iteración

- `01b` completada: sesiones antiguas sin fila persistida exigen login y autorización consulta DB vigente. La allowlist del piloto se mantiene; el recorrido Google real está pendiente de `15a`.
- `04a`: dispositivos/navegadores del piloto. Base de prueba propuesta: Chrome de escritorio/Android y Safari/iPhone instalado; ajustar al entorno real, sin prometer soporte no probado.
- `11a`: MongoDB con replica set o clúster compatible con transacciones. Si no lo hay, la sincronización definida necesita otro diseño aprobado antes de implementarla.
- `14a`: ambos participantes autorizados en el piloto. Apertura de registro general o envío de correos exige una decisión específica; no se introduce un servicio de email en este MVP.
- `15a`: destino y configuración del despliegue existente, sin asumir proveedor ni publicar como parte de la planificación.

## Fuentes y decisiones

La arquitectura y las reglas funcionales son decisiones de este proyecto. Las limitaciones de plataforma se contrastan con fuentes primarias:

- Guías instaladas de Next.js: [PWA](../node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md) y [Server Actions](../node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Consultarlas de nuevo en la iteración que escriba ese código; instalar una PWA no garantiza funcionamiento offline.
- [IndexedDB — MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): almacenamiento local indexado y transaccional.
- [Persistencia y cuotas — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): almacenamiento sujeto a cuotas y posible expulsión.
- [Background Synchronization — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API): disponibilidad limitada; no será un requisito del funcionamiento normal.
- [Transacciones — MongoDB](https://www.mongodb.com/docs/manual/core/transactions/): atomicidad entre documentos y despliegues compatibles.
- [Límites de uso — OpenAI](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan): consumo variable según tarea y configuración. Las ventanas 5h/7d aquí son las comunicadas para esta cuenta; comprobar los valores vigentes después de cada entrega.
