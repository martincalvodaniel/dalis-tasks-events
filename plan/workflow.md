# Flujo de trabajo con Codex

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
| 10% o menos | No empezar trabajo nuevo. Cerrar lo ya abierto y esperar recuperación del presupuesto. |

Objetivo: conservar al menos **10 puntos porcentuales en ambas ventanas**, con reserva mayor en sincronización, migraciones o fallos difíciles de reproducir. Es una heurística revisable, no una garantía de que Codex nunca alcanzará un límite. El coste real depende de contexto, modelo, herramientas y pruebas; contrastar con la [documentación oficial de uso](https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan).

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
