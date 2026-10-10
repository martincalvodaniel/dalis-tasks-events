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


### Cierre del lote renovado del 9 de octubre

Código cerrado y publicado hasta 4f0dc93, seguido del commit documental de cierre. Lectura previa al cierre: 9%5h/70%7d; reservas vigentes 4%/1%. Los dos últimos cortes completos consumieron cuatro y tres puntos, sin prometer costes futuros; la siguiente frontera real requiere margen para pruebas y reparación. Una única revisión del mismo heartbeat queda ACTIVE para el 9 de octubre a las 05:27 Europe/Madrid, confirmada por automation_update y configuración persistida. Usa el reset real 1791516313 (05:25:13), más un minuto redondeado hacia arriba. La automatización histórica alternativa sigue PAUSED. Al despertar, comprobar renovación y último HEAD completo, y registrar el nuevo reset en el primer commit de implementación. Autorización encadenada y reservas 4%5h/1%7d; no crear revisiones duplicadas ni consumir créditos/reinicios.

### Renovación desatendida del 9 de octubre, 05:27

Cuotas reales al despertar: 100%5h/70%7d, reset siguiente publicado 1791534431 (10:27:11 Madrid). Continúa la autorización encadenada del usuario con reservas 4%5h/1%7d, commit/push int y lectura tras cada entrega. Regla vigente de este lote sustituye los valores históricos anteriores; no gastar créditos ni reinicios. La próxima revisión, al cerrar, debe ser al menos un minuto tras ese reset real y redondeada hacia arriba (10:29 mientras siga siendo el reset vigente). No se programa aún ni se presupone una renovación. Paralelo sólo según ownership concreto registrado en iterations.md.


### Cierre del lote de las05:27, 9 de octubre

Último código7525376 publicado y verificado enorigin/int; cierre documental posterior. Lectura10%5h/56%7d, reservas4%/1%. Siguiente defaults/CLI+prueba Mongo propia exige margen de reparación/cierre adicional, por eso no se abre en esta ventana. Próxima revisión del mismo heartbeat confirmada9oct10:29Europe/Madrid, desde reset publicado1791534432 (10:27:12), al menosunminuto después y redondeado arriba. ACTIVE/failed_runs_only/chat preservados, alternativa históricaPAUSED. Ciclo encadenado autorizado; consultar cuotas/renovación y reprogramar únicamente con reset futuro real y margen semanal. No se ejecutó provisión en DB del usuario.


### 11c4a8auth — Autorización explícita de índices preproductivos

Objetivo y target_paths: registrar autorización humana en plan/personal-index-provisioning.md, mixed-sync-activation.md, master.md, workflow.md, iterations.md e iteration-log.md y actualizar el heartbeat existente sin cambiar horario/política. Dependencias: procedimiento preparado hasta7525376 y próxima revisión10:29. Aceptación: usuario confirma DB distintas y autoriza crear índices personales necesarios y automáticos registrados faltantes únicamente en preproducción, reutilizando ensureIndexes después de validar procedimiento, sin otra confirmación. Producción excluida; no borrar/corregir datos ni reparar incompatibilidades automáticamente. Esta autorización sustituye exclusiones históricas de DB del usuario sólo para esa provisión. Verificar conexión preview/int desde fuente de configuración de entorno; nunca asumir que .env.local es preview ni conectar para averiguarlo.

Lectura6%5h/55%7d, reservas4%/1%: sólo cierre documental ahora; defaults/CLI/prueba propia y ejecución preproductiva continúan en revisión10:29 tras verificar renovación. CLI Vercel/project link local no disponibles en comprobación inicial; resolución del destino permanece pendiente, sin acceso a DB ni credenciales impresas. No confundir autorización con ejecución o categorías activadas. Validación documental referencias/consistencia/diff, actualización de heartbeat preservando campos, ConventionalCommit/pushint/HEAD/cuotas.


### Renovación desatendida9oct10:29

Lectura real100%5h/55%7d; reset siguiente1791552560 (15:29:20Madrid). Continúa autorización encadenada, reservas4%5h/1%7d y commitpushint/HEAD/cuotas por entrega. Autorización humana de índices únicamente preproductivos vigente, incluidos automáticos registrados faltantes, sin otra confirmación tras validar procedimiento/destino; producción/datos/hosting/secretos/permisos excluidos. Registrar esta entrada junto al primer código del lote. Próxima revisión al cierre desde reset futuro real, no suma supuesta;15:31 si permanece este reset. Paralelo sólo con ownership y contratos concretos eniterations.md.


### Cierre 11c4a9z — Lote del 9 de octubre, 10:29

Lote completo publicado desde25eca36 hasta9a34fa4f6b691757219ee081394671106bf4d3a4: operador/CLI privado, prueba real de bootstrap y provisión propia, composición/resumen/controles mixtos y retirementlegacy, nueve escenarios Next directos ampliados a doce con conservación de cola y recuperación tras revocación, cuenta remota distinta y época local invalidada. Suite459pass/98opt-in skip/0fail/7504aserciones, lint513/tipos/build34 aprobados; producto mantiene transporte1, una acciónnode/ceroedge. Mongo/Next/IndexedDB/cookies/procesos/builds/pestañas propios cerrados y evidencia visual conservada. No DB del usuario ni credenciales leídas, sin dependencias nuevas o cambios de hosting/secretos/permisos.

Provisión preproductiva ya autorizada y procedimiento validado; falta únicamente el nombre explícito de DB solicitado al usuario. Vercel Preview identificado, guía autenticada dejada para continuación. No pedir otra aprobación para los índices, no convertir fallback/.env.local en destino aprobado, no tocar producción ni reparar datos. Hay trabajo independiente:11c4a9h hook mixto inactivo con cache separado, lifecycle real y guardias; conexión conjunta posterior condicionada al recibo ready+closed. Target_paths y matriz de referencia antigua ausente concretados en mixed-sync-activation.md. No confundir prueba de referencia Next local con ID desplegado/Google o cancelación en vuelo.

Lecturas14%5h/41%7d tras último código y13%/41% durante cierre; reservas4%/1%. Cortes anteriores10/9/8puntos sin promesa de coste futuro: siguiente hook más prueba/reparación/publicación/cierre no cabe con seguridad. Sólo documentación y revisión futura; repo sin código abierto. Reinicio vigente verificado1791552560,9oct15:29:20Madrid, hora observada de cierre11:45Madrid. Una sola revisión de comprobar-renovaci-n-de-cuota actualizada y verificada ACTIVE para9oct15:31Europe/Madrid (reset+unminuto y redondeo), COUNT1, failed_runs_only y mismochat. Automatización histórica alternativa siguePAUSED, no duplicados/TOML manual/cron/hora supuesta. Próximo despertar verifica ambas cuotas/renovación/HEAD y continúa mientras haya trabajo útil/margen; reservas4%5h/1%7d y autorización encadenada vigentes, sin créditos/reinicios. Validación referencias/consistencia/diff y commitpushint/HEAD/cuotas al cierre.

### Renovación desatendida 9oct15:31

Lectura real100%5h/40%7d; reset futuro publicado1791570682 (20:31:22Madrid). Continúa autorización encadenada con reservas4%5h/1%7d, commitpushint/HEAD/cuotas por iteración. Índices preproductivos autorizados, nombre dalis-tasks-events confirmado y verificación Vercel completada; únicamente esa provisión puede actuar sobre DB del usuario, sin producción/repair/delete/hosting/secretos/permisos. Registrar renovación en primer commit de este lote. Revisión única posterior al cerrar desde reset real (20:33 si permanece), sin hora supuesta ni créditos/reinicios. Paralelo sólo con ownership disjunto registrado antes de editar.


### Cierre15a2f — Deployment listo y criterio pendiente

Commit1a6911899fd16adf2dd7aa00e69d9f85075cb750 publicado y HEAD remoto exacto verificado; Vercel Preview EqJ7xmXaBiCfet2PFjLJiHLfWcaF mostró Ready con ese commit. La app avisó de actualización; cerrar la última pestaña y reabrir conservó Google, siete elementos y el pendiente personal sin soporte. No se modificó la intención task.move del piloto ni se declaró ACK/convergencia. Lectura tras commit36%5h/30%7d; cierre por decisión de alcance pendiente, no por cuota. Sólo IAB y MCP Apps disponibles: no segundo perfil de navegador independiente para piloto vivo.

Se solicitó al usuario elegir entre completar orden remoto para conservar/sincronizar el movimiento histórico o desarrollar recuperación explícita para mantenerlo sólo local y reenviar asignación. Ambas necesitan implementación y evidencia, no son herramientas ya disponibles. Según su petición de interrumpir si hace falta criterio y esperar elección tras cerrar categorías/asignaciones, se pausó comprobar-renovaci-n-de-cuota conservando nombre/chat/RRULE/notificaciones failed_runs_only; no nueva revisión encadenada. No comenzar trabajo dependiente sin respuesta. Al cerrar la sincronización, informar porcentaje total estimado y titulares pendientes en orden óptimo antes de otro bloque. Código íntegro aprobado; este cierre sólo verifica referencias/coherencia/diff y termina commitpushint/HEAD/cuotas.


### Reanudación11c5 por elección del usuario

El usuario elige completar orden remoto para preservar y sincronizar el movimiento histórico del piloto. Continúa el lote con cuota real33%5h/29%7d y reservas4%/1%, consulta tras cada commitpushint; no supersesión ni reinterpretación de intención. La automatización pausada sólo se reprogramará al cierre si el objetivo requiere nueva ventana, con reset futuro real y campos/política preservados. Una vez cerrado categorías/asignaciones, reportar porcentaje ponderado y titulares restantes en orden óptimo y esperar elección antes de otros bloques.


### Cierre11c5a3 — Continuación tras renovación

8c70e49 completo y HEADorigin/int verificado; repo limpio, pruebas propias cerradas. Lectura5%5h/25%7d: no abrir executor/transacciones sobre reserva4/1. Reset real1791570682 (9oct20:31:22Madrid), reloj de cierre16:49Madrid. Una única revisión del mismo heartbeat reactivada/confirmada ACTIVE para9oct20:33Madrid, reset+unminuto redondeadoarriba, COUNT1/failed_runs_only/chat preservados; sin duplicados/créditos/reinicios. Elección humana de completar orden remoto reanuda este objetivo; no otros bloques después de cerrar categorías/asignaciones sin su elección. Siguiente11c5a4 executor multiefecto preparatorio, luego reader/ACKpull/incidentes y negociación3 con retiro de acción2 antes de activación. Task.move histórico intacto y aún pending. Validación documental coherencia/referencias/diff; commitpushint y consulta final de ambas cuotas.


### Renovación desatendida9oct20:33

Renovación real verificada99%5h/25%7d, lectura de trabajo posterior97%/24%; próximo reset publicado1791588799. Continúa autorización encadenada para cerrar categorías/asignaciones preservando el movimiento histórico, reservas4%5h/1%7d y consulta tras cada commitpushint. Paralelo sólo particionado eniterations.md; no otros bloques tras cerrar el objetivo sin elección humana. Revisión posterior única desde reset futuro real, no reloj supuesto ni créditos/reinicios gratuitos.


### Cierre11c5a16 — Próxima frontera tras renovación

Código5902599a89c840dedf6862e3c1ba043c4148571d completo/publicado con HEADorigin/int exacto, repo limpio y recursos propios cerrados. Últimas519pass/128opt-in skip/0fail/8077aserciones, lint553/tipos/build34 aprobadas. Mongo dispatcher75pass985aserciones y operador4 trescasos88aserciones; ACK/pull/incidentes reales anteriores conservados. ProvisiónPreview REAL4 cerrada ready+closed en699c075: sólo índiceplacement faltante creado, sin datos/producción. FuentePreview distinta confirmada, secretos ocultados/eliminados; tabs15guía y30Google conservados, tab34readonly propia cerrada.

Lectura9%5h/10%7d, reservas4%/1%. Siguiente prueba Next/auth/two-partition requiere más que cinco puntos disponibles hastareserva más reparación/cierre; no abrirla ni activar parcialmente. Resetfuturo real1791588799 (10oct01:33:19Madrid), reloj9oct21:37Madrid. Revisión única de este heartbeat ACTIVE confirmada para10oct01:35Madrid (>=unminuto redondeadoarriba), COUNT1/failed_runs_only/chat preservados, sin duplicados/créditos/reinicios. Reanudar desdeúltimoHEADcompleto confirmado; anuncio/provider/API siguen2 y piloto histórico sinACK.

Siguiente11c5a17: adaptar fixtureNext compilado para comprobar preparedaction3/defaults4/policy3/header3, retiro2 aunqueidentity2/pull2capturados y oldIDausente404 sinACK, matrix2↔3 antesbody/cache/cursor. Reutilizar runner/templates con sesionesBetterAuth y dosparticiones/Mongo propias; productor realtask-move-outbox mantieneUUID/payload/deps→ACKúnico/replay→dependientes→convergenciaexacta (peer/view/placement), lifecyclehook3 real/guardias/cancelación. Dividir frontera/movimiento/lifecycle en cortes coherentes anteseditar si margen exige. No extrapolar fixtures aGoogle real ni dospestañasIAB a dosdispositivos; pedir segundo dispositivo sólo si falta al piloto final. Activaciónjoint después: exclusivo3/no2–3, identity/pullheaders3/action3/client3/hook3/cache3/provider/context/UI, retiroactions2 antesreadiness/executor; envelopes/evidence2/intention1 intactos. Al cerrar categorías/asignaciones informar porcentajeponderado/titulares pendientes y esperar elección humana antes otrosbloques. Cierre documental referencia/coherencia/diff, commitpushint/HEAD y consulta finalcuotas.

### Renovación10oct01:35

Lectura real100%5h/9%7d, siguiente reset1791606925 (06:35:25Madrid). Continúa autorización desatendida sólo hasta cerrar categorías/asignaciones conservando task.move histórico; reservas4%5h/1%7d y consulta tras cada commitpushint. Semanal limita el lote. ÍndicesPreview4 ya ready+closed; no repetir provisión. Prueba integrada3 y activación conjunta prioritarias, sin otros bloques ni créditos/reinicios. Sesión IAB verificada antes del sueño; se pidió Chrome autenticado con misma cuenta para piloto independiente, sin exigirlo para trabajo preparatorio.


### Cierre del lote10oct — Esperar elección humana

Objetivo de categorías/asignaciones cerrado con generación 3 y ACK histórico real (`11c5a19`). La automatización de continuación queda PAUSED, conservando sus campos y política failed_runs_only; no reprogramar mientras el usuario elige el siguiente bloque. El porcentaje ponderado y titulares pendientes están en [master.md](master.md). No interpretar presupuesto disponible como autorización para abrir otro bloque. La próxima iteración partirá del último HEAD publicado de `int` y de la elección del usuario, con una lectura nueva de ambas cuotas y el protocolo vigente de cierre.


### Bloque de rediseño elegido10oct

El usuario elige editor/lista de cuatro variantes y long-press drag. Entrada85%5h/5%7d. Acepta ruptura de compatibilidad antes de lanzamiento y wipe realizado por él si se solicita; no borrado automático. Permite apurar semanal al1% o menos, conservando margen real para cerrar pruebas/reparaciones/publicación. Consultar cuotas tras cada entrega, no equiparar coste porcentual de ventanas; automatización permanece pausada. El lote anterior de sincronización está cerrado y no justifica tareas ajenas al rediseño.

### Nuevo lote de rediseño tras reinicio humano10oct

El usuario reinicia cuotas y autoriza continuar hasta alcanzar un límite operativo. Lectura real100%5h/100%7d; reset5h1791642149 publicado. Continuar sólo el rediseño elegido mediante cortes completos con commit/pushint/HEAD y cuotas después de cada commit. Reservar cierre antes del límite:10%5h/1%7d conforme a AGENTS vigente, usando consumo observado y dividiendo antes de abrir tareas grandes; no agotar una ventana a mitad de entrega. No usar créditos/reinicios adicionales ni reactivar automatización pausada. Wipe por el usuario sólo si se requiere y una vez preparado/validado el procedimiento exacto.

### Aprovechamiento mínimo y revisión puntual10oct

Tras0d9b0cb el usuario pide aprovechar9% y continuar después del reset. Esta instrucción permite el corte documental mínimo16a4c0 por debajo de reserva habitual; no abre RPC/build/integración grande con este margen ni modifica la reserva10%5h/1%7d de la próxima ventana. Cuotas reales9%/86%, reset1791642149 (10oct16:22:29Madrid), reloj de petición13:08Madrid. Heartbeat existente comprobar-renovaci-n-de-cuota actualizado ACTIVE para16:24Madrid, puntual COUNT1/mismochat/failed_runs_only; alternativa histórica permanece pausada. Sustituye prohibición de nueva programación sólo para esta revisión; no autoriza cadena adicional. Confirmar renovación real antes de16a4c1 y consultar cuotas tras cada commitpushint. No créditos/reinicios, wipe automático ni producción.
