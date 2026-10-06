# Registro de iteraciones

## 00 — Planificación inicial

- Fecha: 6 de octubre de 2026.
- Rama: `main`, comprobada antes de editar; árbol limpio al inicio.
- Estado: planificación y validación documental completadas; cierre mediante el commit indicado abajo.
- Presupuesto inicial comunicado por el usuario: **5h 99% restante; 7d 44% restante**. No se ha recibido una lectura de cierre.
- Alcance: `plan/**` y reglas raíz de `AGENTS.md`. Sin código de aplicación ni nuevas dependencias.
- Resultado: decisiones sobre tres tipos, categoría personal, atrasadas derivadas, series/ocurrencias, permisos, IndexedDB, shell offline, sincronización e idempotencia. Roadmap partido en subentregas con aceptación y dependencias.
- Estado real observado: login Google con allowlist y sin adaptador persistente, dashboard protegido, singleton MongoDB con registro vacío de colecciones/índices; calendario y offline aún pendientes.
- Validaciones: 20 enlaces locales comprobados y resueltos en los 7 documentos de `plan`; `git diff --check` aprobado; revisión de requisitos contra modelo, roadmap y matriz de aceptación. Tipos/build/pruebas de aplicación no se han ejecutado: no aplican a esta entrega exclusivamente documental y serán obligatorios en entregas de código.
- Commit de cierre: `docs(plan): define offline task and event roadmap`. El hash real se comunica tras crearlo; no se anticipa en este archivo.
- Siguiente candidata: `01a`, secuencial. Antes de empezar, preguntar lectura restante de **ambas** ventanas y reevaluar. El 44% semanal inicial favorece una primera entrega acotada; no autoriza completar todo el bloque `01` de una vez.

## Plantilla para próximas entradas

| Campo | Qué registrar |
| --- | --- |
| ID, fecha, rama | La entrega concreta y la rama actual. |
| Presupuesto inicial | Lecturas restantes de 5h/7d y fuente; reinicios o incertidumbre si los hay. |
| Objetivo y `target_paths` | Alcance decidido antes de editar; responsables si hay paralelo. |
| Resultado | Comportamiento entregado y criterios cumplidos. |
| Evidencias | Comandos, escenarios reales, resultado y limitaciones precisas. |
| Decisiones revisadas | Motivo y documentos/contratos actualizados. |
| Cierre | Estado y título del commit; hash comprobado comunicado al usuario. |
| Próxima candidata | Dependencias, tamaño y propuesta secuencial/paralela. |
| Control siguiente | Pregunta de ambos presupuestos; valores nuevos se anotan al abrir la siguiente entrega. |

No rellenar evidencias a partir de intención o memoria. Un test no ejecutado es una comprobación pendiente, no un resultado aprobado.
