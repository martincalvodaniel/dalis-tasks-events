# Recuperación explícita de conflictos

Estado: proyección y snapshot validados (13a1a–b), comparación en Ajustes (13a1c) y contrato puro de elección (13a2a) entregados. Snapshot/comparación, executor13a2b1, integración13a2b1a y elecciones13a2b2 entregados para conflictos propios simples. Cadenas externas/rechazos/series y copia desde tombstone siguen pendientes.

## Evidencia conservada

- Entrada outbox con operación enviada congelada, revisión base, dependencias, estado ycontador deintentos.
- Outcome durable: resultado del servidor, local yshadow que existían alrecibirlo. **Ese shadow no es necesariamente el ancestro de la revisión base enviada**: pull o replay tardío pueden adelantarlo. Nunca usarlo como base histórica para una fusión de tres versiones.
- Proyección local actual: puede incluir ediciones posteriores o un tombstone; no reemplazarla con el borrador deloutcome.
- Shadow remoto más reciente conocido, distinto deun estadoactual garantizado en servidor. Respuesta conflict antigua puede llegar después deun pull nuevo; comparar versiones porrevisión, igualdad concontenido distinto es corrupción, shadow actual no regresa respecto aevidencia durable.

Todo record debe pertenecer acuenta/elemento deentrada; resultado/operación/estado/key han de coincidir. Applied yunsupported no son incidentes terminales. Outcomeausente/corrupto/cuenta ajena detienelectura; no derivar éxito ni descartarcola. El DTO no modifica nada.

## Próximos cortes

1. **13a1b lector**: snapshot readonly items/outbox/remoteShadows/syncMetadata, resultados validados sinpágina parcial, filtro cuenta+epochantes/después. Mostrar evidencia ydependientes conservados, incluidos borradoresborrados; sin IOremoto niresolución.
2. **13a1c comparación visible** en Ajustes, detalles bajo demanda; diferencias local/remoto/operación enviadayrazón clara. No ofrecer elecciones antesdeque mutación equivalente estéimplementada/probada. No nuevodestino sin ambasbarras.
3. **13a2a diseño/contrato de resolución local**: decisión explícita sobre toda la cadena deintenciones pendientes deesaentidad; expected snapshot impide resolver sobre cambios locales posteriores inadvertidos. Guardarregistro deelección con nuevoUUID, operación original/resultados intactos, adoptarremoto o construir nueva intención sobre revisión remota reciente. Revalidar actor/epoch, no inferirpermisos porcache.
4. **13a2b ejecutor yUI juntos**: transacción local de evidencia/cola/proyección/resolución; una nueva operación con nuevoID/revisiónbase, CASremoto puede conflictuar denuevo si cambióservidor. Otras entidades siguenenviando. Probar dosdispositivos, errores/reload/rollback/cuenta/tombstones.

## Reglas que el diseño debe cerrar

- Conservar remoto requiere decisión explícita también sobre ediciones dependientes; no descartarlas en silencio. Reaplicar borrador debe explicar qué contenido se enviará yreusar identidad del elemento solo si aúnvive.
- **No marcar operaciónconflict/rejected como ACK delservidor.** Considerar estado local separado de supersesión yregistro de resolución, adaptando explícitamente guards/dependencias/resumen/proyección; schema existente no lo implementa todavía. No borrarrecibos/intenciones para desbloquearla cola.
- Si el remoto tiene tombstone, nunca resucitar el mismoID. Recuperar borrador como copia exige elección explícita y nuevoID/operación; no hacerlo automáticamente.
- Rechazos unavailable/identity_reuse/invalid_command tienen causas distintas. No reintentar automáticamente un permiso retirado ni reutilizarUUID conflictivo; conservar/exportar evidencia cuando no haya resolución segura.
- Acciones sobre preferencias/series/compartidos exigirán supropio soporte; este primer contrato interpreta comandos deelementos, no inventa ACKdeotrosdominios.
- No fusión automática basada enpayloadcompleto deitem.update: podría revertir cambios remotos deestado/checklist no elegidos. Elección/preview explícitos y revisiónCAS son requisitos.

Validación13a1a: oráculos puros de borradorposterior/tombstone, replaytardío, rechazo sinpayload remoto ycorrupción/identidad/cuenta/estado/operación. LecturaIndexedDB y elección UI siguenpendientes.


13a1b entregada: snapshot consistente readonly de cuatro stores con guardias usuario/época y todas las intenciones sin ACK por elemento (incluye cadenas bloqueadas). Validación global de cuenta/identidades y proyección de cada incidente completa; outcome ausente falla toda lectura. Próxima 13a1c: comparación desplegable en Ajustes, sin elecciones todavía.


13a1c entregada: Ajustes ofrece comparación desplegable bajo demanda con caché por cuenta/época. Razón, borrado, versión remota conocida y comando enviado se muestran en español, manteniendo cola intacta. Las elecciones siguen pendientes de contrato y executor probados (13a2a–b).


## Contrato 13a2a y persistencia prevista

- `adopt_remote`: reemplazar proyección por último remoto conocido y superseder explícitamente todas las intenciones mostradas del elemento; ninguna operación remota ni ACK.
- `retry_local`: preview es todo el borrador actual (incluidos estado/checklist), no fusión automática. Nueva operación UUID sobre revision remota, update para vivo/delete para borrado local sobre remoto vivo. Si servidor avanzó, CAS producirá otro conflicto. Identidad remota borrada exige otro flujo de copia con ID nuevo, todavía no habilitado.
- Solo conflictos propios simples, con remoto conocido. Rechazos sin prueba de acceso, series/preferencias y cadenas con envío activo no habilitan estas elecciones. Snapshot exacto cubre evidencia local/remota y toda cadena; executor debe regenerarlo desde sus stores y compararlo dentro de la transacción, no confiar en DTO suministrado.
- Record `incident-resolution:<UUID>` contiene request/choice, expected con entradas originales, IDs supersedidos, nueva operación opcional y proyección elegida. Outcomes originales permanecen intactos. Replay exige record idéntico y no vuelve a modificar proyección si hay posteriores ediciones.
- 13a2b1 añadirá estado `superseded` al schema de outbox. Será terminal local, excluido de trabajo e incidentes; payload/dependencias/attempts originales preservados. No satisface dependencias como ACK. Guardar record + estados + item + secuencia + nueva operación en una transacción; no convertir decisiones locales en confirmación de servidor.
- Nuevas intenciones después de adoptar remoto no deben depender de la cola ya supersedida. Una dependencia externa pendiente que apunte a ella sigue bloqueada, nunca se confirma de forma implícita; executor debe rechazar esa cadena si no está incluida explícitamente. Preferencias siguen sin sincronización.
- Dividir13a2b: primero1 estado/executor con pruebas de rollback/replay/cuota/cuenta, después2 UI de confirmación y prueba integrada de dos dispositivos. No ofrecer elecciones antes de mutación probada.


13a2b1 entregada: estado superseded y registro durable en misma transacción que proyección/replacement/secuencia. Replay idéntico conserva posteriores ediciones. Claims no envían estados supersedidos y solo ACK satisface dependencias existentes; nuevos comandos excluyen tails supersedidos. Cadena externa pendiente y envío incierto impiden elección, sin descartar ninguna intención. Guardias de usuario/época antes/después, notificación tras commit. Pendiente13a2b1a: confirmar este flujo con servidor MongoDB real y dos particiones antes de ofrecer botones13a2b2.


13a2b1a: nueve escenarios reales de dos orígenes/MongoDB verifican retry de cadena con respuesta perdida/replay/recarga sin duplicados, adopción sin escritura remota ni ACK y tombstone sin resurrección. Proyecciones y cursores de ambos dispositivos coinciden con Mongo y cola activa vacía tras decisión. Recursos propios limpiados. Puede avanzar UI13a2b2 conservando límites de cadena externa/pending intentada/rechazos/series.


13a2b2: UI de elección habilitada con preview congelado yconfirmación sobre todaslasintenciones delelemento. Cancelación sinmutación yotra pestañacambiando localprovocarechazo deldiálogoabierto. Snapshot detecta dependientes externos antesdeofrecerbotones; contrato/executor revalidan. Timestamps/UUID deelección estables,revalidación de caches propias posterior,noACK hasta resultado remoto. Reintento/adopciónyrecarga comprobados enUI ylosnueve escenariosMongo vuelvena pasar. Próxima13a2c1 define copia nueva explicitamenteelegida frenteatombstone; rechazos sin acceso y cadenasexternaspermanecen conservados.


## Copia frente a remoto borrado, 13a2c1

copy_local es una elección adicional para conflicto simple propio con remoto tombstone y borrador local vivo. Crear elemento y operación nuevos conbase0, conservar viejo elemento como tombstone remoto ysuperseder cadena explícitamente mostrando consecuencias. Registro guarda tombstone original ycopy separada; replay no debe volveraescribir copy yaeditada/confirmada. Categorías/orden no se copian automáticamente. Nullable defaults mantienen lectura de registros anteriores.

13a2c1 solo valida planner/contrato. Executor bloquea copy sin escribir yUI no laofrece. 13a2c2 debe comprobar copyID libre, incluidos tombstones/historial local, yguardar original+copy+cola+evidencia+secuencia juntos; rollback/replay enIndexedDB yconvergencia de dosdispositivos/Mongo antesde botón13a2c3. Rechazos sinacceso yrelacionesexternas siguenpendientes.


13a2c2: copia y original tombstone guardados junto con cola/contador/evidencia en cuatro stores; nuevo ID libre frente a registros/historial/tombstones, entityKey del nuevo elemento. Rollback tardío deja ambos elementos y cola intactos; replay no sobrescribe copia editada. IndexedDB nueve checks+recarga y diez escenarios reales dos dispositivos/Mongo aprobados; lostresponse produce una sola copia revision1 y original tombstone revision2 intacto. Recursos propios limpios. Normal203pass/30skip/4618aserciones, lint304files/tipos/build30recursos aprobados. Próxima13a2c3 UI de copia, sin categorías/orden duplicados ni ACK local.


13a2c3: Ajustes ofrece Crear copia de mi borrador solo para local vivo frentearemoto tombstone, conidentidad/operación/timestamp estables yconfirmación decontenido completo, originalborrado, sincategoría/orden ypending. Tests guardiaslocalmissing/deleted ySSR; normal205pass/30skip/4628aserciones, lint304files/tipos/build30recursos aprobados. FixtureUI móvil390/dialog358/buttons48 sinoverflow: cancelar sincambios, confirmar/reload origentombstone+copyrev0+createbase0/entityKeynuevo/2superseded/1pending/sinACK; limpieza propia. Próxima13b1 recuperación/transporte según dependencias.
