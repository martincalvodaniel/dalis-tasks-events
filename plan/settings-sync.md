# Zona horaria personal y sincronización de ajustes

## Alcance vigente

La preferencia editable es la zona horaria personal. Mantener lunes y UI española, como exige el schema vigente; no ampliar opciones de idioma o semana por iniciativa propia. La zona afecta la interpretación de hoy/atrasadas y la visualización; no reescribe fechas, zonas de eventos o anclas de series existentes. Una cadena de movimientos encolada conserva su as-of civil y su payload.

`settings.update` existe en intención1, pero generación5 lo conserva como unsupported. No hay aún productor outbox válido, repositorio remoto, executor, ACK/pull ni UI. El registro local inicial revision0 es un valor provisional del dispositivo, no un ACK remoto.

## 18a cerrado

Schema estricto del snapshot remoto: actor, operación, timestamp del servidor y settings propios null/revisión positiva. Planner puro crea conCAS0 o actualiza revisión exacta; conserva createdAt y aumenta sólo revisión personal. Stale/ausencia no esperada/tombstone retornan conflicto con evidencia, sin resurrección. Revisión agotada no produce efecto. Helper común local preserva revisión hasta resultado real y no admite dueño inyectado, otras cuentas, zona inválida, semana/idioma nuevos.

Sin IO, ACK, UI, callers o cambio del transporte activo. Siete tests nuevos/23aserciones; suite768pass/209skip/0fail/10370aserciones, lint793/tipos/buildWebpack/worker46. No consultas DB ni necesidad de índice en este corte.

## 18b cerrado

Colección `user_settings` registrada, `_id` canónico por actor y único `user_settings_user_uidx` sobreuserId registrado en ensure-indexes con provisión explícita. Query poruserId aprovecha ese índice; reemplazoCAS usa identidad/actor/revisión/createdAt/deletedAt. No bootstrap activo nuevo ni DBusuario. Repo impidecruce de cuentas, duplicación y resurrección; registro corrupto falla sin reparar.

Executor preparatorio comprueba replay del namespace recurrente común y fingerprint antes de leer estado. Settings+recibo+journal/counter en una transacción; conflicto sin registro remoto se expresa unavailable sin inventarlo. Retry reabre snapshotcompleto; replay antiguo conserva receipt exacto y no vuelve a tocar una revisiónposterior. Ningún caller activo.

Mongo propio: seis casos/56aserciones; creación/CAS/unique/ownership, respuesta perdida/replay/IDreuse/otra cuenta, carreras, rollback tardío y stage sinTX, tombstones/ausencia, identidad corrupta/inputs inválidos. Regresión de operador/selección central: seis casos/126aserciones, nuevo índice permanece staged. Recursos limpios. Suite769pass/217skip/0fail/10373aserciones, lint796/tipos/buildWebpack/worker46. Se corrigieron sólo tipos `_id:string`/nonnull y optional-chain de la fixture.

## Dependencias para activación

1. 18b: colección registrada/repo actor-scoped con `_id` canónico y CAS, executor con replay común primero y settings/receipt/journal/counter atómicos; comprobar ownership/rollback/carreras/retry en Mongo propio. Evaluar consultas e índices en `ensure-indexes.ts`; no crear índices ad hoc.
2. 18c: clave `settings:actor` y productor IndexedDB atómico con cola/dependencias/guardias de cuenta. Confirmar snapshots/ACK/pull/incidentes/backup para settings y preservar pendientes/intentados y evidencia. Defaults de dispositivo no son intención confirmada.
3. 18d: transporte/capacidades ampliados conjuntamente. Cliente5 no puede consumir settings: negociación nueva exclusiva y retiro5 antes de ejecutar; sobres/journal2 e intención1 conservados. No activar cambiando sólo config.
4. 18e: UI compacta de Ajustes con guardado offline y sincronización; probar dos particiones/Next/Mongo reales, cuenta/epoch/pérdida de respuesta/replay/conflicto/recarga antes de activar todos los puertos. Sin cumpleaños/sharing/producción/wipe.

Los cortes se delimitan antes de editar; pueden agruparse cuando la aceptación completa quepa. No gastar una ventana en auditar los históricos. El checkbox de estado y reordenación ya entregados no necesitan reabrirse.
