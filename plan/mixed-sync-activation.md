# Activación de la sincronización personal

Estado a 9 de octubre: los executors, writers, transporte, coordinador y runtime mixtos están preparados y probados en un entorno aislado. `11c4a4p` demuestra convergencia de categorías y asignaciones entre dos particiones y MongoDB, con respuesta perdida y replay. La aplicación desplegada sigue usando transporte 1 y sincroniza contenido propio simple. Preparar un módulo no lo activa.

## Alcance inicial

La primera activación incluye tareas/eventos propios sin repetición, categorías (`tag.save/delete/move`) y asignación de categoría (`item-view.set`). No incluye compartir, series, cumpleaños, settings ni orden manual de tareas (`task.move`). El orden de categorías sí dispone de executor; el orden de tareas necesita colocaciones y una política civil diferida.

Una cola histórica con `task.move` sin confirmar puede bloquear categorías posteriores y conservar toda la proyección personal. El diagnóstico debe comunicarlo, conservar la intención y permitir contenido independiente. No cambiar dependencias, confirmar localmente, superseder automáticamente ni convertir el movimiento en una asignación para desbloquearla.

## Versiones que deben mantenerse separadas

| Contrato | Valor para la transición | Regla |
| --- | --- | --- |
| Intención durable / fingerprint | 1 | Conservar UUID, payload y base de operaciones intentadas. |
| Transporte / anuncio del servidor | 2 | Envelope nuevo y lectura íntegra de journal mixto. |
| Evidencia local | Formatos legacy y 2 | Decodificar antes de seleccionar familia; replay histórico no prueba ancestralidad. |
| Backup portable | Leer 1 y 2; exportar 2 | Conservar historia y pendientes, importar mediante copias nuevas. |

[`sync-protocol.ts`](../src/config/sync-protocol.ts) mantiene por ahora ambos valores activos en 1. Cambiar sólo el anuncio no basta: el servicio legacy verifica la versión de intención, que debe seguir siendo 1. La acción pública también debe rechazar transporte antiguo antes de ejecutar.

## Cortes de activación, en orden

1. **Resumen mixto independiente.** Consumir el diagnóstico completo y las mismas capacidades del coordinador. Separar pendientes listos, espera, bloqueos, comandos sin soporte y conflictos. `settled` significa que terminó una pasada; no que todos los datos convergieron. Preparar y probar el resumen antes de conectar la UI compacta de Ajustes.
2. **Readiness de índices sólo lectura (preparada en `11c4a5i`).** El [helper](../src/lib/db/mixed-sync-index-readiness.ts) comprueba los índices registrados de categorías y vistas, incluidas claves ordenadas, unicidad y filtro de nombres activos. Ausencia, definición incompatible o error de lectura impiden habilitar escrituras personales. No crear índices desde auth, rutas o repositorios ni asumir que un nombre de índice demuestra su definición.
3. **Prerrequisito de entorno.** Los tres índices personales son `provisioning: "explicit"` en [`ensure-indexes.ts`](../src/lib/db/ensure-indexes.ts). `bun run db:ensure-indexes` sólo selecciona automáticos; no provisiona éstos. Preparar una ejecución concreta revisable antes de solicitar autorización del entorno. El lote desatendido actual no autoriza tocar la DB del usuario ni sus permisos. El runner aislado ya provisiona exclusivamente su propia DB.
4. **Frontera autenticada mixta.** Preparar acción y respuesta pull en `features/sync/**`; `app/**` sólo conecta routing. Usar sesión vigente, cuenta esperada, schemas compartidos y servicios/DAL existentes. La guardia de transporte e índices ocurre antes del dispatcher; rechazar no autoriza ACK. Mantener respuesta privada/no-store y handshake explícito 2. La identidad conserva la verificación de Google/allowlist existente.
5. **Conexión del cliente y UI.** Cambiar conjuntamente transporte, runtime, scheduler, lectura del resumen, hooks y mensajes de capacidad. El estado personal bloqueado no debe pausar ramas de contenido independientes. Conservar cookies `same-origin`, control de cuenta/época, leases y límites globales de pasada. No activar sólo un filtro de comandos.
6. **Prueba de transición y piloto.** Probar frontera Next/Server Action autenticada con dos clientes: cuenta distinta, sesión caducada, cliente antiguo/nuevo, respuesta perdida, checkpoint, conflicto y cola histórica. Después, piloto autorizado en preproducción con Google y recarga/offline. La fixture loopback con actor propio no sustituye esta frontera ni la provisión real de índices.

Cada corte incluye sus rutas, aceptación, pruebas, plan, commit/push en `int` y lectura de ambas cuotas. Si un corte requiere una actuación externa no autorizada, cerrar primero toda la preparación revisable y conservar un bloqueo concreto; no activar parcialmente para aparentar progreso.

## Matriz obligatoria de compatibilidad

| Cliente / servidor | Resultado requerido antes de efectos |
| --- | --- |
| Cliente 1 / servidor 2 | Actualización requerida antes de pull y ejecución; cursor y pendientes intactos. |
| Cliente 2 / servidor 1 | Actualización requerida al leer anuncio 1; no interpretar página legacy como mixta. |
| Push legacy iniciado tras un handshake 1 anterior | La nueva acción exige envelope 2 y no llama al executor. |
| Transporte 2 / intención futura | Rechazar antes de ejecutor; no reinterpretar intención ni fingerprint. |
| Transporte 2 / índice faltante o incompatible | Escrituras personales deshabilitadas; pendientes conservados. |
| Cuenta remota distinta / cierre local durante red | Ningún resultado tardío aplicado; liberar únicamente lease propio anterior. |

No anunciar un rango 1–2 para permitir al cliente antiguo saltarse efectos personales. Si alguna prueba de transición falla, no habilitar la nueva frontera.

## Orden manual posterior

`11c5a1p` extrae el núcleo de ranking sin cambiar el comportamiento local. El executor de colocaciones exige después catálogo por cuenta/ámbito/fecha, autorización del contexto y vecinos, CAS por cada efecto y commit conjunto con vista, recibo y journal. ACK y pull locales deberán admitir placements antes de habilitarlo.

La intención histórica 1 no conserva timestamp de encolado. `command.date` de atrasadas es contexto civil y la fecha almacenada usa el sentinel `0001-01-01`. El reloj remoto actual no puede reemplazar ese contexto ni justificar rechazar automáticamente un movimiento offline. Cerrar esa política como decisión explícita antes de implementar el planner remoto; no inventar una fecha de intención.
