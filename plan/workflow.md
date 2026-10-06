# Flujo de trabajo con Codex

## Reglas permanentes

- Cada iteración o subiteración es una entrega pequeña, comprobable y cerrada mediante **commit en la rama actual**. No crear o cambiar rama por iniciativa propia. No hacer push, merge o despliegue sin que formen parte de una solicitud autorizada.
- Todo código y comentarios en inglés. Labels, textos de ayuda, errores visibles, estados vacíos y nombres accesibles de la UI en español. La documentación del plan puede estar en español.
- Se puede editar `AGENTS.md` y añadir versiones anidadas cuando aporten reglas específicas. No duplicar todo el documento raíz ni contradecir sus límites.
- Mantener el stack; no añadir dependencias base, servicios o cambios materiales de seguridad sin aprobación humana. Las excepciones offline propuestas en el plan no están todavía implementadas.

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
6. Comunicar entrega, validaciones y commit. **Preguntar: “¿Cuánto queda ahora en las ventanas de 5h y 7d, en porcentaje restante?”**
7. Esperar esos valores antes de iniciar la siguiente entrega. Con la respuesta, elegir tarea concreta y ejecución secuencial o paralela. Si falta uno de los valores, pedirlo; no sustituirlo por el anterior. Una recomendación provisional no autoriza encadenar trabajo sin el control de presupuesto.

La consulta automática de uso, si está disponible, puede complementar la lectura, pero no sustituye la pregunta solicitada por el usuario. No modificar el registro después de un commit solo para incorporar una lectura: hacerlo al abrir la siguiente iteración o en una entrega documental explícita.

## Secuencial y paralelo

Por defecto, secuencial. Las primeras entregas de identidad, dominio, IndexedDB, service worker y sincronización comparten contratos y tendrán un único responsable.

Se puede elegir paralelo cuando el usuario o las instrucciones aplicables lo autoricen, los contratos estén cerrados, haya presupuesto suficiente y los archivos no se solapen. Ejemplo futuro: ajustes de accesibilidad en componentes de calendario y ampliación de pruebas de un motor de recurrencia ya estable. No se lanzan ambos trabajos si uno necesita cambios del otro.

Antes de delegar, registrar `target_paths` de cada agente y responsable de integración. `package.json`, lockfiles, `ensure-indexes.ts`, esquemas compartidos y registro del plan tendrán siempre un único responsable. Recordar a los agentes que no están solos y que no deben revertir cambios ajenos. Integrar, probar y hacer el commit desde el responsable principal; no confundir final de un agente con cierre de iteración.

## Cambio del plan o interrupción

- Registrar qué decisión cambió, motivo, documentos afectados, impacto en datos/cola y aceptación. Si exige migración, separar una entrega segura para ella.
- Si surge una incertidumbre material sobre dependencias o seguridad, completar antes el análisis independiente y presentar una opción concreta para decidir.
- Si hay una interrupción inesperada, dejar un punto de reanudación con archivos y verificaciones pendientes. No afirmar que la iteración se completó ni crear un commit de código que se sabe roto para cumplir formalmente la regla.
- Detenerse en un límite de entrega cerrado es correcto; el objetivo es evitar abandonar a mitad de una mutación, migración o integración.
