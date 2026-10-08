# Flujo de trabajo con Codex

## Reserva vigente por ventana

El usuario reduce explícitamente la reserva semanal primero al5%, después al2% y finalmente al **1%** el 8 de octubre. Se mantiene **10% en 5h**. Esta política sustituye las reservas anteriores para futuras iteraciones; las entradas históricas conservan las condiciones de su ejecución. Consultar ambas cuotas tras cada commit/push y evaluar el margen de cada ventana por separado y el consumo observado, sin equiparar sus porcentajes. No empezar si 5h <=10% o 7d <=1%, ni si implementación, pruebas, reparación y cierre pueden cruzar sus reservas. Sin créditos/reinicios ni nuevas automatizaciones.

## Continuación de sincronización autorizada, 8 de octubre

El usuario autoriza continuar desatendidamente desde00:16 y una revisión posterior, con tareas pequeñas hasta conservar **10% en ambas ventanas**, sustituyendo la reserva20% de los lotes anteriores para esta continuación. Consultar cuotas después de cada commit; dividir antes de abrir un corte cuyo coste alto observado y cierre pueda cruzar10%. No consumir créditos/reinicios. Ramaint: commit+push por iteración comprobada. Esta autorización no crea una cadena indefinida de revisiones.

Lectura al renovar:100%/58%; siguiente reset5h publicado1791429393, **8oct05:16:33 Madrid**. Revisión puntual adicional creada para05:18, con ambas cuotas y continuación desde último commit cerrado. No comparar consumo5h con la ventana anterior a través del reinicio. No preguntar porcentajes durante este lote ni deducir renovación solo del reloj.

Revisión posterior autorizada ejecutada el 8 de octubre a las 05:18 Madrid: cuota real 100%/43%, reinicio 5h siguiente publicado **1791447514**. Partir de `94117a0` cerrado y publicado; continuar secuencialmente con reserva 10% en ambas ventanas. Esta es la segunda y última revisión autorizada: no programar otra cadena y pausar la automatización al cerrar.

## Reglas permanentes

- Cada iteración o subiteración es una entrega pequeña, comprobable y cerrada mediante **commit en la rama actual**. No crear o cambiar rama por iniciativa propia. No hacer push, merge o despliegue sin que formen parte de una solicitud autorizada.
- Todo código y comentarios en inglés. Labels, textos de ayuda, errores visibles, estados vacíos y nombres accesibles de la UI en español. La documentación del plan puede estar en español.
- Se puede editar `AGENTS.md` y añadir versiones anidadas cuando aporten reglas específicas. No duplicar todo el documento raíz ni contradecir sus límites.
- Mantener el stack; no añadir dependencias base, servicios o cambios materiales de seguridad sin aprobación humana. Las excepciones offline se incorporan en sus iteraciones y se documentan; nunca sustituyen autorización remota.

## Antes de editar

1. Leer `master.md`, la entrada candidata de `iterations.md`, el registro reciente y todos los `AGENTS.md` aplicables.
2. Comprobar rama y estado de Git. Preservar cambios ajenos; no incluirlos en el commit propio.
3. Formular objetivo, `target_paths`, dependencias, criterios de aceptación y validaciones. Consultar la guía instalada de Next.js relevante antes de escribir código.
4. Evaluar la lectura vigente de **las dos ventanas** y reservar margen para pruebas, reparaciones, documentación y commit.
5. Si la entrega no cabe razonablemente, dividirla antes de empezar. Una entrega no se define como “trabajar hasta agotar el presupuesto”.

## Presupuesto: ventanas de 5 horas y 7 días

Se trabaja con las dos ventanas comunicadas por el usuario. Una lectura es un porcentaje **restante**, con fecha; no es una previsión garantizada ni una cuota independiente por agente. No estimar tokens o mensajes a partir de porcentajes. Otras conversaciones pueden consumir las mismas ventanas.

Inicial: 6 de octubre de 2026, `5h = 99%`, `7d = 44%`. Usar el menor valor como señal conservadora, teniendo en cuenta que las ventanas se renuevan de forma diferente. Cuando sea útil, preguntar también la hora de reinicio; no deducirla de la fecha de trabajo.

Política inicial del proyecto, **no un límite oficial de OpenAI**:

| Menor porcentaje restante | Decisión inicial |
| --- | --- |
| Más del 40% | Una entrega pequeña/mediana. Paralelo solo si hay beneficio claro y margen observado. |
| Del 20% al 40%, inclusive | Una entrega pequeña secuencial; partir entregas medianas o con incertidumbre. |
| Más del 10% y menos del 20% | Solo una entrega mínima cuyo cierre esté bien acotado; en caso de duda, detener. |
| 10% o menos | Para 5h, no empezar. Para 7d, aplicar la reserva vigente del 1% y el coste observado de la entrega completa. |

Objetivo vigente: conservar al menos **10% en 5h y 1% en 7d**, con reserva mayor en sincronización, migraciones o fallos difíciles de reproducir. Es una heurística revisable, no una garantía de que Codex nunca alcanzará un límite. El coste real depende de contexto, modelo, herramientas y pruebas; contrastar con la [documentación oficial de uso](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan).

Registrar consumos observados solo si hay lecturas comparables antes/después y no hubo reinicio. Si otras sesiones consumieron presupuesto, señalar la incertidumbre. Para nuevas tareas, usar como referencia el consumo más alto de entregas similares y añadir margen de cierre; no usar una media optimista. Con poca evidencia, trabajar secuencialmente.

## Cierre obligatorio de cada entrega

1. Verificar todos los criterios de aceptación. Si una comprobación falla, resolverla o registrar la limitación; nunca declarar funcionalidad completada sin evidencias.
2. Para código: ejecutar `bun run type-check` (`tsc --noEmit`), `bun run lint`, pruebas pertinentes con `bun run test` y `bun run build` (`next build`). Comprobar que módulos server-only no lleguen al cliente. Si el entorno impide alguna prueba, identificar exactamente cuál y por qué; un build no ejecutado no equivale a aprobado.
3. Para documentación exclusivamente: comprobar enlaces locales, consistencia del plan y `git diff --check`. No añadir pruebas que solo repliquen Markdown ni exigir ejecución de la aplicación para editar texto.
4. Revisar el diff y los archivos a incluir, sin secretos, `.env*` ni cambios ajenos. Actualizar `iterations.md` e `iteration-log.md` con resultado y evidencias.
5. Hacer un Conventional Commit en la rama actual. Ejemplo de estilo: `docs(plan): define offline task and event roadmap`. Comprobar que se creó y revisar el estado final. No referenciar un hash futuro dentro del mismo commit; registrar su hash en el cierre al usuario o en una iteración posterior.
6. Comunicar entrega, validaciones y commit. **Preguntar: “¿Cuánto queda ahora en las ventanas de 5h y 7d, en porcentaje restante?”**, salvo un lote desatendido autorizado expresamente, que sigue el protocolo de abajo.
7. En trabajo interactivo, esperar esos valores antes de iniciar la siguiente entrega. Con la respuesta, elegir tarea concreta y ejecución secuencial o paralela. Si falta uno de los valores, pedirlo; no sustituirlo por el anterior. Una recomendación provisional no autoriza encadenar trabajo sin el control de presupuesto.

La consulta automática complementa la lectura en trabajo interactivo y sustituye la pregunta únicamente durante un lote desatendido autorizado. No modificar el registro después de un commit solo para incorporar una lectura: hacerlo al abrir la siguiente iteración o en una entrega documental explícita.

## Lote desatendido autorizado el 6 de octubre de 2026

El usuario ha autorizado continuar varias iteraciones sin feedback mientras duerme, con commit individual y evitando quedar a mitad de una tarea. Lectura inicial: **5h 82%; 7d 41% restantes**, contrastada con la consulta de uso de la cuenta. Esta excepción solo aplica al lote actual; no cambia permanentemente el protocolo interactivo.

- Ejecutar secuencialmente y consultar las dos ventanas después de cada commit. Calcular restante como `100 - usedPercent`; no confundir consumido con disponible. Las cuotas son compartidas por toda la cuenta.
- Reserva reforzada: no comenzar una entrega si alguna ventana tiene **20% o menos** restante, ni si el coste alto observado de entregas similares más margen de cierre haría cruzar esa reserva. No consumir reinicios gratuitos o créditos por iniciativa propia.
- Primera candidata `01b`; después `02a`, `02b` y base IndexedDB si el margen lo permite. Cerrar cada subentrega antes de elegir otra; no prometer llegar a un hito que dependa de decisiones pendientes.
- Si no se puede consultar el uso, una decisión requiere aprobación, una validación crítica no está disponible, o el siguiente corte es demasiado amplio, detener el lote con código comprobado y commit. Una herramienta de aprobación bloqueada no autoriza a dejar archivos incoherentes ni a rebajar la aceptación.
- Al terminar, registrar la lectura más reciente, commits, pruebas y siguiente candidata; volver al protocolo normal para la siguiente sesión del usuario.

El lote se cerró después de `03b`, con base local y cola verificadas y sin tareas de implementación abiertas. Lectura previa al cierre documental: **61% / 38% restantes**. Ese cierre se revocó por instrucción posterior del usuario: continuar sin feedback mientras la siguiente entrega y su cierre quepan en el presupuesto. La autorización desatendida sigue vigente para esta continuación; consultar ambas ventanas tras cada commit y detener únicamente por falta de margen o un bloqueo real. La navegación responsive sigue prevista en `04c`.

## Secuencial y paralelo

Por defecto, secuencial. Las primeras entregas de identidad, dominio, IndexedDB, service worker y sincronización comparten contratos y tendrán un único responsable.

Se puede elegir paralelo cuando el usuario o las instrucciones aplicables lo autoricen, los contratos estén cerrados, haya presupuesto suficiente y los archivos no se solapen. Ejemplo futuro: ajustes de accesibilidad en componentes de calendario y ampliación de pruebas de un motor de recurrencia ya estable. No se lanzan ambos trabajos si uno necesita cambios del otro.

Antes de delegar, registrar `target_paths` de cada agente y responsable de integración. `package.json`, lockfiles, `ensure-indexes.ts`, esquemas compartidos y registro del plan tendrán siempre un único responsable. Recordar a los agentes que no están solos y que no deben revertir cambios ajenos. Integrar, probar y hacer el commit desde el responsable principal; no confundir final de un agente con cierre de iteración.

## Cambio del plan o interrupción

- Registrar qué decisión cambió, motivo, documentos afectados, impacto en datos/cola y aceptación. Si exige migración, separar una entrega segura para ella.
- Si surge una incertidumbre material sobre dependencias o seguridad, completar antes el análisis independiente y presentar una opción concreta para decidir.
- Si hay una interrupción inesperada, dejar un punto de reanudación con archivos y verificaciones pendientes. No afirmar que la iteración se completó ni crear un commit de código que se sabe roto para cumplir formalmente la regla.
- Detenerse en un límite de entrega cerrado es correcto; el objetivo es evitar abandonar a mitad de una mutación, migración o integración.

### Continuación autorizada tras el cierre de `03b`

El usuario aclara que el presupuesto restante (60%/38%) todavía permite continuar y autoriza seguir mientras duerme. Nueva lectura al reanudar: 59%/38% restantes. Se retoma `04a` en secuencial; el cierre anticipado anterior no es un límite de alcance. Se mantiene la reserva reforzada del 20% y se parte una entrega amplia antes de detener por tamaño. Parar exige margen insuficiente para completar la siguiente entrega con pruebas y commit, una aprobación necesaria o un bloqueo de validación; no basta alcanzar un hito cómodo.

### Cierre tras `05a1`, 7 de octubre

El lote reanudado entrega `04a`, `04b`, `04c` y `05a1`, con commits individuales. Lectura durante el cierre de `05a1`: **5h 19%; 7d 31% restantes**. Se termina validación/documentación/commit de lo abierto y no se inicia `05a2`: la ventana corta ya está por debajo de la reserva del 20%. Las iteraciones de UI/offline consumieron más que los helpers iniciales, por lo que no se extrapola una media optimista a otra entrega con pruebas de navegador. El cierre final comunica la lectura posterior al commit; al reanudar se recupera el protocolo de ambos porcentajes nuevos. No hay una tarea de implementación dejada a medias: creación/listado se separó de edición/borrado antes de comenzar.

### Reanudación autorizada, 7 de octubre

El usuario comunica nueva ventana de **5h 100%; 7d 30% restantes** y sigue durmiendo dos horas. Se reanuda el lote desatendido en secuencial desde `05a2`, consultando ambas ventanas tras cada commit y conservando la reserva del 20%. La lectura automática al abrir es 99%/30%; el reinicio impide comparar consumo de 5h con el lote anterior. No se toma la renovación de 5h como renovación semanal.

La consulta automática durante `05a2` pasó de 99%/30% a 96%/99% con nuevos reinicios informados por la cuenta. Esta renovación permite seguir el lote; no se calcula consumo semanal a través del reinicio ni se deduce de ello una garantía de duración.

### Reserva tras `07a` y diseño de `07b0`

Lote reanudado: `05a2`, `05b1–05b3`, corrección solicitada `05c`, calendario `06` y grupos/atrasadas `07a`, todos con commits y verificaciones propias. Después de `07a`: **5h 29%; 7d 89% restantes**. Las tres últimas entregas de código consumieron 9/10/9 puntos de la ventana corta entre consultas comparables, sin poder atribuir consumo de otras conversaciones. Los 9 puntos sobre la reserva no cubren otra entrega comparable más cierre.

Se completa únicamente `07b0`, diseño documental de movimientos/ranking y corte de siguientes entregas. No se inicia un cambio de transacciones, ni se dejan comandos aceptados sin ejecutor. El cierre comunica la lectura posterior al commit documental y el árbol limpio; próxima candidata `07b1`. Antes del cierre, el usuario solicita tres ajustes de la home/barra móvil y corregir el botón `+`. Se intercala `07c` como corrección pequeña, con lectura nueva tras `07b0`; `07b1` permanece aplazada. El cierre definitivo se decidirá tras validar y hacer commit de esa corrección.

### Cierre tras corrección intercalada `07c`

La lectura posterior a `07b0` fue **21%/88% restantes**, menor que al abrir su diseño. El usuario intercala explícitamente la corrección pequeña de home/nav/`+`; se completa y valida antes del cierre. No se empieza reordenación, eventos ni otra entrega. La corrección termina en commit propio con lectura automática final comunicada al usuario. Esta priorización consume margen de cierre y no rebaja permanentemente la reserva. Al reanudar, solicitar ambos porcentajes nuevos y elegir el corte `07b1` o dividirlo antes de implementar.

### Reanudación solicitada tras `07c`

El usuario pide «Continua». Se retoma la autorización previa de avanzar mientras haya margen, con commits y lecturas automáticas individuales, sin cambiar la reserva del 20%. Lectura inicial de la cuenta: **5h 100%; 7d 87%**; nueva ventana corta, sin inferir consumo a través del reinicio. Se divide `07b1` en categorías (`07b1a`) y colocaciones de tareas (`07b1b`), cada una con comando y ejecutor juntos. Ninguna entrega habilita botones sobre mutaciones incompletas.

### Cierre tras 08b y revisión móvil 07d–07d2

La continuación autorizada tras 07c completa ranking/categorías/colocaciones, controles y arrastre, motor temporal y persistencia de eventos, y dos cortes de UI compacta solicitados por el usuario. Todos tienen commit independiente. Última lectura automática después de `cfa8a9f`: **5h 25%; 7d 75% restantes**. La entrega 07d consumió ocho puntos entre consultas comparables; 07d2, de alcance menor, cuatro. Estas observaciones no excluyen uso en otras conversaciones ni son garantías.

No comenzar 08c1: formulario/lector/calendario de eventos, pruebas offline, reparaciones y cierre no caben razonablemente en los cinco puntos sobre la reserva del 20%. No hay código abierto ni tarea a medias; eventos persistibles no se anuncian como formulario disponible. Se cierra solo el registro documental, con diff/enlaces y commit, y consulta automática posterior. Al reanudar se recupera el protocolo de ambos porcentajes nuevos, salvo autorización desatendida expresa aún vigente en la nueva solicitud.

### Reanudación con ventana próxima a renovar

El usuario revoca el cierre tras `206fac6`: pide aprovechar el 24% y comunica renovación de 5h en unos veinte minutos. Lectura automática al abrir: 24%/75%. Se retoma secuencial y desatendido, con consulta tras cada commit. Para esta continuación se usa la reserva base del 10% en 5h (20% semanal), atendiendo a la autorización explícita de aprovechar el margen; no depender de la renovación para cerrar lo abierto ni modificar créditos. Cortes pequeños: `07d3` categorías compactas, seguido de selectores de calendario de eventos `08c1a` si cabe. Si se confirma renovación en la herramienta, volver a reserva reforzada20% para nuevas entregas amplias. No es una reducción permanente del protocolo.

### Publicación de iteraciones en integración int

El usuario confirma la rama de integración `int` y autoriza commit y push tras cada iteración terminada para activar el autodespliegue preproductivo existente. Comprobar rama/diff/tests/build y cerrar el commit antes del push; verificar que HEAD remoto coincide. No crear despliegues adicionales, publicar producción ni modificar secretos/configuración de hosting. La autorización sustituye la prohibición por defecto de push para esta rama; sigue vigente la protección de otras ramas.

La consulta al llegar al reinicio confirma nueva ventana **100%/73%**, 7oct19:15Madrid, después de cerrar/push071a2c4. Vercel deployment success confirmado para ese SHA. Se vuelve a reserva reforzada20% y se continúa secuencial: preparar snapshot mensual08c1b0, después UI de creación/listado08c1b1. No comparar consumo5h a través del reinicio.


### Cierre tras09b4b1

Continuación de integración entrega hasta referencias acotadas de tarea/aparición y movimiento mixto del día. Todos los cortes tienen commit y push aorigin/int; Vercel success confirmado hasta6ea331b. Después de7c8dc42:28%/61% restantes. Desde09b3b/09b4a se observaron7/8 puntos de consumo5h por entrega entre consultas comparables; no excluyen otras sesiones.

Ocho puntos disponibles sobre reserva20% no cubren el siguiente cambio de orden del backlog, paginación, compatibilidad de datos y reparaciones. Se cierra solo diseño09b4b0 (referencias/diff/consistencia/commit/push), sin abrir otro cambio de código. Cuota final se comunica tras ese commit; no se consumen créditos ni se depende de un reinicio no confirmado. Próximo corte09b4b2a segúnbacklog-ordering; recuperar ambas lecturas nuevas al reanudar.

### Cierre del lote del 8 de octubre, 00:16

La continuación llega hasta `13a1a` (`f4ba680`), con todos los cortes validados, commit y push a `int` y HEAD remoto verificado. La primera renovación dio 100%/58%; después del último corte de código quedan 12%/44%. Los cortes recientes consumieron 2 puntos para el scheduler, 4 para el proveedor, 7 para notificaciones y navegador y 5 para la proyección y diseño de recuperación. Estas lecturas pueden incluir uso de otros chats. Dos puntos sobre la reserva del 10% no cubren el siguiente snapshot, pruebas de navegador, reparaciones y cierre. Se cierra solo documentación y no se inicia `13a1b`.

La automatización puntual actual `comprobar-renovaci-n-de-cuota` queda pausada. La única revisión posterior `continuar-sincronizaci-n-siguiente-ventana` queda ACTIVE para el 8 de octubre a las 05:18 de Madrid, usando el reinicio publicado 1791429393 (05:16:33) y la política failed_runs_only. Su prompt continúa desde el último HEAD completo y el plan de `13a1b`. No crear otra cadena. Esa ejecución debe comprobar renovación y margen real, reservar el 10% en ambas ventanas y cerrar sin créditos ni reinicios. Cualquier continuación posterior requiere una nueva solicitud del usuario.


### Cierre de la segunda continuación, 8 de octubre, 05:18

El lote autorizado partió de la renovación real con 100%/43% y reinicio 1791447514. Se entrega hasta 13c1d: lectura y comparación de incidentes; supersesión local diferenciada de ACK y elecciones explícitas de adopción, reintento o copia; pruebas de dos dispositivos con MongoDB; recuperación de sesión, cierre y leases; compatibilidad de protocolo; actualización del worker; backup portable, lectura coherente y descarga offline. Cada iteración tiene commit y push en int, con HEAD remoto verificado. Se preservaron cambios ajenos y no se tocó la DB, los secretos o la configuración de producción.

La lectura previa al cierre es 13%/30%, con reserva del 10% en ambas ventanas. Tres puntos no cubren la siguiente implementación con pruebas, reparaciones y cierre. Los últimos cortes consumieron tres puntos para el snapshot, seis para la descarga y tres para las guardias mínimas; el contrato anterior consumió ocho con reparaciones. Las lecturas pueden incluir otros chats y no garantizan costes futuros. El repo queda coherente y sin código abierto.

La automatización puntual continuar-sincronizaci-n-siguiente-ventana queda PAUSED. La autorización cubría esta última revisión; no se crea otra cadena ni se usan créditos o reinicios.

La siguiente candidata es 13c2a: preview puro de un archivo validado y del snapshot propio actual, sin escribir ni enviar. Clasificará contenido nuevo, idéntico, cambiado, tombstones y tipos sin ejecutor, conservando los datos no admitidos. El contrato y ejecutor de importación vendrán después, con UUID nuevos y confirmación sólo tras pruebas. Nunca restaurar directamente ACK, cursores, leases, revisiones remotas o permisos.

El piloto de Google y RPC de Next real sigue pendiente. Preferencias, series, cumpleaños y compartidos todavía no se sincronizan. Rechazos sin acceso y cadenas externas permanecen conservados. Reanudar exige nueva autorización y ambas cuotas; vuelve el protocolo normal de consulta tras cada iteración salvo otro lote explícito.


### Excepción puntual para el fix de preproducción

El usuario autoriza «Haz un intento mínimo» tras conocer que ejecutar el fix con aproximadamente 8% restante de 5h consume la reserva del 10%. Esta autorización cubre únicamente `13b2b`, pruebas y commit/push en `int`. Cerrar después, sin otro corte ni automatización. No modifica permanentemente la reserva. La última lectura automática previa fue 9% de 5h y 29% de 7d; las cifras pueden incluir uso de otros chats. Volver al protocolo normal de ambas cuotas al cerrar.


### Continuación autorizada tras renovación del 8 de octubre

Lectura real al reanudar: 100% de 5h / 29% de 7d, reinicio publicado 1791470291. «Adelante» y la instrucción posterior autorizan commit y push por iteración, consulta automática de ambas ventanas y siguiente corte si todavía hay margen. Trabajo secuencial con reserva base del 10% en ambas ventanas, sin automatizaciones nuevas ni créditos. El menor margen semanal limita el alcance aunque la ventana de 5h esté renovada. Antes de cada corte usar coste observado más reparación/cierre. `13c2a` es puro; piloto real necesita sesión de Vercel/Google en los navegadores de prueba y no bloquea este trabajo independiente.


### Paralelismo autorizado en13c2d1

El usuario pide adelantar lo posible en paralelo. Se asignan rutas disjuntas: rootUI/helper/fixture4189/plan, agente únicamente fixtures de dos dispositivos/Mongo. Una integración y commit por corte; ningún recurso ni archivo de otro agente se limpia o revierte. Reserva10% en ambas ventanas, consulta después del commit/push, sin nuevas automatizaciones.


### Reanudación tras piloto real, 8 de octubre

Elusuario comunica nueva ventana ypideAdelante. Lectura real100%5h/13%7d, reset5h publicado1791489092; la renovación corta no renueva semanal. Continúa autorización decommitpushint yconsultaautomática poriteración conreserva10ambas; peticiones extraordinarias bajo10 de15a0b/15a1 no seextienden aeste lote. División11c2b1a/b/c, secuencial para mantenercierreconsemanaescasa; no crearautomatizaciones ni consumircréditos/reinicios.


El 8 de octubre el usuario comunica reinicio de ambas ventanas y autoriza ambición/paralelismo. Lectura real100%5h/100%7d desdeb77c7d6. Continuación con cuotas automáticas por commit/push y reservas10%5h/1%7d. Trabajo paralelo sólo con ownership disjunto elegido eniterations.md, integración/plan/commits centralizados; no comparar coste con la ventana agotada ni activar writers sin lectores compatibles.

### Continuación puntual con reserva4% en 5h

El usuario autoriza aprovechar el margen restante y seguir hasta conservar4%5h; lectura al abrir12%5h/86%7d. Esta instrucción sustituye10% sólo para esta continuación; semanal permanece1%. Cortes secuenciales pequeños con pruebas/reparación/commitpush/HEAD/cuotas; no abrir trabajo cuyo cierre razonablemente cruce4%. No créditos/reinicios/automatizaciones ni cambios productivos. No implica activar sincronización personal antes de pruebas integradas.

### Renovación desatendida9oct00:25 y revisiones encadenadas autorizadas

Lectura real100%5h/85%7d, reset5h1791516313 (9oct05:25:13Madrid). El usuario autoriza continuar tras cada renovación y reprogramar una única revisión pendiente al cerrar según resetsAt real; sustituye restricción histórica de una sola revisión. Reserva4%5h/1%7d durante este ciclo, consulta tras commit/push; no abrir corte cuyo cierre pueda cruzarla. Próxima programación al menos un minuto después del reinicio publicado, redondeada hacia arriba al minuto, vía automation_update de heartbeat existente y misma política silenciosa. No sumar cinco horas por suposición, duplicados, créditos/reinicios ni nuevas cron. Cuota ilegible/renovación no verificable/bloqueo o weekly<=1% cierran seguro; fecha futura verificada y trabajo/margen requeridos para reprogramar.
