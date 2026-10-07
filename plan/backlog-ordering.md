# Orden de apariciones atrasadas: siguiente corte

Estado: diseño pendiente de validar; no existe ejecutor de movimiento overdue para apariciones. El día mixto está entregado en09b4a y el lookup acotado por identidad en09b4b1. No activar todavía formularios ni controles de repetición sobre ese alcance.

## Problema observado

[orderPlacedTasks](../src/lib/ordering/task-order.ts) ordena primero colocaciones explícitas, después tareas implícitas por fecha/creación/ID. Al primer movimiento de tareas simples, el planner materializa posiciones de todos los peers del grupo. Ese contrato funciona para datos finitos existentes, pero una serie diaria desde0001 hasta9999 puede tener millones de apariciones pendientes.

- Expandir todo ese historial dentro de una transacción bloquearía la interacción y generaría colocaciones innecesarias.
- Materializar solo la página visible mueve sus elementos delante de todo el historial implícito restante, aunque el usuario pretendiera un cambio entre vecinos.
- El resolver de referencias valida target y vecinos en tiempo acotado por slot, pero no demuestra que sean adyacentes en el grupo completo.
- Cambiar categoría pertenece a la serie: puede reclasificar múltiples apariciones. Debe conservar esa semántica sin compactar todo el historial.

Estos son límites del algoritmo actual, no motivos para truncar o borrar datos. No habilitar un botón que aparenta ordenar el grupo completo usando solo los primeros100 registros.

## Propuesta a validar en09b4b2

Evaluar una clave de orden lexicográfica opcional en la colocación, derivada por el ejecutor a partir de vecinos, junto a una clave implícita determinista por fecha/creación/identidad. Podría permitir insertar una aparición entre dos claves sin materializar todos los peers. No se adopta aún el formato ni se cambia el schema; primero demostrar comparación, inserción, límites y compatibilidad con un oráculo de grupos pequeños completamente expandidos.

Requisitos del diseño:

1. Mantener el orden que hoy producen los ranks numéricos existentes. Una migración o prefijo para legado no puede cambiar la vista sin una intención de usuario.
2. Una aparición no colocada tiene una clave estable sin persistencia. Reprogramar cambia su fecha efectiva para la vista, conserva ID original; colocaciones de día/overdue permanecen separadas.
3. Vecinos deben ser adyacentes después de retirar target en la vista completa. Incluir simples, virtuales pendientes y excepciones activas; excluir completadas/canceladas/borradas y aplicar categorías personales de serie.
4. Buscar candidatos por series y excepciones con trabajo limitado. Si una página solo contiene slots suprimidos, continuar con cursor explícito. Si la verificación necesita más trabajo, no escribir ni fingir que la adyacencia quedó validada.
5. Todo cursor/prueba de preparación se asocia al snapshot vigente. Un cambio de serie, excepción, progreso, categoría, zona o cuenta invalida el cálculo; volver a leer conservando la intención del editor.
6. Limitar longitud/tamaño de claves y definir agotamiento/compactación. No resolver una colisión renumerando millones de slots. Probar alternativas antes de fijar formato; si no hay solución acotada, registrar el fallo y dividir la preparación en operaciones explícitas y recuperables.
7. Remoto deberá derivar y validar el mismo orden desde task.move y revisión personal; no confiar en claves o prueba de autorización enviadas por cliente. No cambiar permisos, transporte o dependencias core como parte de este diseño.

Alternativas que deben compararse: claves lexicográficas dispersas con legado compatible; preparación paginada explícita antes de ordenar grupos muy grandes. Rechazados: expansión total síncrona del backlog y materialización silenciosa de una sola página. No añadir biblioteca de orden ni dependencia nueva sin aprobación.

## Subentregas sugeridas

| Corte | Resultado y criterio de cierre |
| --- | --- |
| 09b4b2a | Especificación concreta de claves/legado y motor puro; comparación con oráculo expandido, vecinos iguales, extremos y agotamiento. Solo elegir formato al pasar esas pruebas. |
| 09b4b2a1 (entregado) | Adaptador puro de rank legado a clave textual: precisión y desempate demostrados. Clave implícita cubierta en09b4b2a2; inserción y agotamiento pendientes. |
| 09b4b2a2 (entregado) | Clave implícita por fecha/creación/ID y oráculo mixto legado/implícito; inserción y agotamiento pendientes. |
| 09b4b2b | Búsqueda paginada de vecinos virtuales/materializados; páginas vacías, series largas, completadas y reprogramadas; cursor de snapshot explícito. Sin escrituras. |
| 09b4b2c | Ejecutor local completo con schema de colocación compatible, dependencias, CAS y rollback; IndexedDB real, concurrencia, recarga y regresión día/simple. Comando solo se habilita cuando ejecutor y lector convergen. |
| 09b5 | Hook/lector/UI de repetición de tareas, backlog paginado y formulario compacto; estado/checklist/editar/cancelar/orden offline y calendario real. |

Si el motor requiere otro corte, registrar objetivo y aceptación antes de modificar código. Mantener commit/push int individual y consulta de ambas cuotas al terminar cada subentrega. Continuación futura sigue los límites de [workflow](workflow.md); no prometer consumo exacto.

### Compatibilidad probada en09b4b2a1

[legacy-rank-key.ts](../src/lib/ordering/legacy-rank-key.ts) transforma los ocho bytes IEEE754 de cada posición válida en16 dígitos hexadecimales ordenables: invierte bits de negativos, cambia el bit de signo de no negativos y normaliza−0 a0. Añade `:id` para conservar el desempate binario actual. Comparar con `<`/`>`, nunca con `localeCompare`; el prefijo de longitud fija impide que el ID altere la prioridad numérica. Validación reutiliza `positionSchema`.

[Pruebas](../src/lib/ordering/legacy-rank-key.test.ts) contrastan con `compareRank`: extremos±1e12, negativos, subnormales, valores adyacentes, ceros, IDs con prefijo común y posiciones repetidas; oráculo de2.112 registros deterministas. Rechazan NaN/infinito/fuera de rango y comprueban input intacto.

Es un adaptador candidato sin consumidores en la aplicación. El formato persistido continúa siendo numérico y no se migra ningún dato. Este primer corte resuelve compatibilidad de comparación, no demuestra inserción entre claves, agotamiento, prefijos implícitos, adyacencia ni orden paginado del backlog. El siguiente apartado documenta el avance de claves implícitas; no habilitar UI de repetición por estos resultados.

### Clave implícita probada en09b4b2a2

[default-task-key.ts](../src/lib/ordering/default-task-key.ts) valida fecha civil efectiva, timestamp de creación e ID con schemas compartidos, y devuelve `fecha:creación:id`. Fechas ISO validadas tienen anchura fija; comparación binaria reproduce fecha/creación/ID del comparador existente. Una reprogramación cambia la fecha efectiva de la clave, conserva ID original y no necesita guardar una colocación. No usar `localeCompare` sobre la clave completa.

[Pruebas](../src/lib/ordering/default-task-key.test.ts):2.025 comparaciones por pares con años0001/9999 y desempates, reprogramación/copia/input intacto, valores inválidos. Oráculo mixto de45 tareas con15 colocaciones contrasta prefijos candidatos `0:legado` y `1:implícita` contra `orderPlacedTasks`, incluido rank0. Ambos adaptadores siguen sin consumidores; prefijos son propuesta probada para comparación, no formato persistido adoptado. Quedan inserción/extremos/agotamiento de09b4b2a y adyacencia/ejecutor paginados antes de UI.

## Escenarios mínimos de validación

- Movimiento simple junto a aparición y entre apariciones de series distintas, tanto colocadas como virtuales.
- Una página visible a mitad del historial: cambiar dos vecinos no desplaza el resto del grupo ni altera otras fechas/scopes.
- Más de500 slots completados/cancelados antes del primer pendiente; progreso paginado y ninguna omisión silenciosa.
- Reprogramada desde otra fecha entra por fecha efectiva; original cancelada no resurge como virtual.
- Reordenar una pendiente no modifica estado/checklist/parent; completar después no bloquea las pendientes siguientes.
- Cambio de categoría de serie con otras apariciones cargadas y no cargadas; no producir duplicados ni posiciones prestadas de otra categoría.
- Cambio de día/zona/epoch durante preparación, otra pestaña editando vecino y pérdida de respuesta al guardar.
- Legacy numérico, ancla overdue0001-01-01, años0001/9999, claves agotadas y rollback de toda la intención.
