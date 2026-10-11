# Sincronización de series y apariciones comunes

Estado11oct: generación4 sólo sincroniza planes simples; series/apariciones/progreso/cambios de fecha siguen locales. Arrastre simple y checklist heredada entregados16c1–3. No activar parcialmente un nuevo alcance.

## Revisión e identidad

La intención local actual de aparición guarda `baseRevision` del padre y se encadena por `item:<seriesId>`. Esto no es la revisión de la aparición. Mantener esa semántica: en contrato futuro cada comando incluye `expectedOccurrenceRevision` explícito (cero sólo si no hay excepción materializada). `baseRevision` sigue siendo la revisión confirmada de la serie. No deducir ninguna revisión desde shadow/outcome ni reescribir intenciones históricas. El schema preparatorio17a1 exige el nuevo campo; los comandos antiguos sin él no obtienen ACK ni se reconstruyen automáticamente. La integración decidirá conservación/reintento explícito de pendientes según evidencia; no crear migradores caros ni wipe silencioso.

`seriesId:slotKey` sigue siendo identidad original, incluyendo hora civil en series timed. Cambiar fecha no cambia slot. Excepción materializada conserva contenido/progreso independiente aunque cambie regla del padre; variante/propiedad provienen del padre actual. Aparición no completa ni actualiza contenido/revisión semántica del padre. Revision propia sube sólo al commit remoto; optimismo local conserva revisión confirmada.

## Persistencia y concurrencia

El planner es puro, no da ACK ni equivale a ejecución/replay. Un executor deberá leer replay común primero y, en una misma transacción, autorizar padre, verificar revisiones, guardar aparición CAS/insert, recibo, journal y contador. Leer padre y escribir otro documento en snapshot no evita carrera con borrado/edición de serie. Registrar un guard transaccional por serie, escrito tanto por mutación del padre como por aparición, antes de aceptar el executor; no confundir CAS de aparición con autorización vigente de serie. No usar reloj/zona del servidor para cambiar slot/día declarado.

Colección futura de excepciones almacena identidad por usuario/serie/slot, ownership verificado por padre actual y retenido en tombstones; índices registrados en ensure-indexes y procedimiento propio antes de Preview. No índices/provisión ni nueva colección activa en17a1.

## Cortes y activación

1. **17a1**: contrato de intención con revisión explícita + planner puro, cuatro comandos/variantes, padre/slot/progreso/CAS/DST/cancelación. Preparado, sin tocar productores/capacidades activos.
2. **17a2**: productor local captura revisión de aparición dentro de TX; decoders/evidencia/backup preservan campo e intenciones previas, guardias de cuenta/época y rebase sólo pending no intentado. No reinterpretar revisión de comandos históricos.
3. **17b**: repositorio/CAS/índices de apariciones y guard compartido de serie; executor transaccional padre/aparición, replay/rollback/carreras con Mongo propio. Reader autorizado de series/excepciones/tombstones.
4. **17c**: ACK/pull atómicos en almacén occurrences, incidentes/evidencia de aparición actual y orden mixto simple/aparición (día/atrasadas), conservando dependientes y revisions por entidad.
5. **17d**: negociación exclusiva futura5, retiro4 y callers conjuntos, matriz estricta antes del body/cache/cursor, dos particiones/Mongo/Next real; activar sólo después. PilotoGoogle/segundo dispositivo si disponible. No anunciar convergencia por fixture o cola settled.

El cliente4 no admite proyecciones de apariciones. Nueva negociación separada de sobres/journal2 e intenciones1; no cambiar protocolos de evidencia/UUID por cambiar transporte. El nombre5 representa futuro alcance, no una activación por config. Cumpleaños/compartir/cierreMVP siguen después según elección humana vigente.
