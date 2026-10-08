# Backup y recuperación

Contrato1 almacena un snapshot validado de los once stores propios de IndexedDB2: contenido y apariciones, categorías/vistas/colocaciones/settings, memberships/invitations, outbox, shadows y metadata (contador, preference-tail, cursor, outcomes y decisiones de resolución). Incluye tombstones, operaciones confirmadas y supersedidas y leases como evidencia. El ownerId de una lease es el nonce del sender, no el propietario de los datos.

Formato dalis-local-backup/version1/protocol1/databaseVersion2, cuenta y fecha de exportación. Todos los stores son obligatorios; arrays acotados a10000 registros (settings1), fichero <=16MiB UTF8. Claves y secuencias únicas, dependencias hacia registros anteriores, contador vigente, outcome ligado al payload conservado, decisiones ligadas a su historia Superseded/replacement. No se filtran silenciosamente registros incompatibles ni se borra nada al fallar.

El fichero no incluye cookies, Google tokens, secretos o control de cuenta/época. La cuenta activa debe coincidir al generar o leer un backup. Se soportan datos propios actuales; registros compartidos ajenos y versiones futuras necesitan un contrato posterior y se rechazan íntegramente. Un fichero local nunca constituye autorización remota. El contrato es validación estructural y coherencia; no firma ni prueba de autenticidad del servidor.

13c1a solo contrato/codificador/lector puros y tests. Siguiente13c1b: snapshot de una transacción readonly de todos los stores, conexión cerrada y guardias de cuenta/época antes/después. Siguiente13c1c: descarga JSON desde Ajustes, bajo petición, sin red y solo tras validación completa, con error honesto y fichero de cuenta/fecha sin PII en filename.

Importación disponible desde13c2d1 para tareas/eventos propios simples vivos como copias nuevas, con comparación y confirmación explícitas. Preferencias, series, cumpleaños e importación global requieren cortes posteriores. No restaurar directamente outbox, ACK, leases, cursores, revisión remota ni permisos; generar intenciones nuevas por decisiones de producto y conservar copia/evidencia original. Reintentos o fallos de cuota no deben producir éxito ni borrar datos. Repeticiones/preferencias necesitan ejecutores compatibles; no declarar importación global lista a partir del exportador.


13c1b: lector getAlllimit10001 de11stores enmisma txreadonly, ownershippartición/DBversion/fecha/byteguard sintruncate, wrapperactor/epochantesdespués yclosefinally. IndexedDB4checks+reload: snapshot completo/colaexacta/tombstone/preferencias/roundtrip, snapshotprecedewritecoherente, unknownmetadatarechaza sin cambios, wrongpartition/epoch yepochcambiada durantelectura noentregadatos/closeexacto. Owncleanupnormal217pass/30skip/4727aserciones/lint321files/tipos/build30recursos. Próxima13c1cdescargaUI si margen, importación siguependiente.


13c1c: secciónplegablecompactaCopia de seguridad enAjustes, downloadsolo tras snapshotvalidado yguardiaactual, JSONBlob/filenamefecha sincuenta yURLrevocable/linkremovido. Mensajehonestodescargasolicitada, importacióntodavíano disponible; sinfetch/ACK/escrituras. FixtureUIreal390 confetchbloqueado validaBlob11stores/colaexacta, epochcambiado error sinsegundaBlob, recursospropios limpios yviewportreset; botón44px/sin overflow. Normal217pass/30skip/4727aserciones/lint325files/tipos/build30recursos aprobados. Próxima13c2apreviewpuro deimportación si margen; ejecutor/importUI posteriores.


13c1d: outcome.local/base/current/applieditem deben coincidirconcommand.itemId; replacement exacto contra operaciónpreservada, sinaceptarevidenciamanipulada. Dos tests identity/payload/actornested/counter/shadowduplicado; 219pass/30skip/4734aserciones/lint325files/tipos/build30recursos aprobados. Fixture usa operaciónclonada separada de decisiónpara quealterar una pruebe realmenterechazo. Sin nuevaUI/IO/migración. Código cerrado, próxima13c2apreviewimportación.


## 13c2a — Comparación antes de importar

`previewLocalBackupImport` acepta el JSON y un snapshot local íntegro de la misma cuenta; valida versiones, estructura, historia y bytes de ambos antes de devolver filas. La identidad usa la clave de cada store (incluidas colocaciones y membresías compuestas). No une títulos iguales con IDs distintos. Las filas representan registros del archivo; registros existentes exclusivamente en el dispositivo quedan intactos.

Clasificaciones: new, identical, changed, source_deleted, current_deleted y both_deleted. Los borrados tienen prioridad sobre igualdad. La comparación exacta incluye timestamps/revisión y nunca deduce antigüedad remota de exportedAt. Simple_item identifica contenido de tarea/evento sin repetición; no significa que exista todavía ejecutor. Preferencias/series/apariciones/cumpleaños siguen unsupported; outbox/shadows/metadata/permisos/invitaciones quedan evidence_only, conservados íntegramente para revisión. No se generan operaciones ni se acepta un ACK del archivo como resultado local. Salida por clave determinista O(n log n), con snapshots independientes y sin IO.

Próxima `13c2b`: contrato validado de selecciones, identidades y operaciones nuevas. El ejecutor deberá revalidar cuenta/época y snapshot actual, preservar historia y pendientes, asegurar atomicidad/replay y rechazar elecciones obsoletas; solo después se ofrecerá confirmación UI.


### Resultado 13c2b

Contrato puro de selecciones e intenciones nuevas entregado. Cada copia es una tarea/evento propio vivo sin repetición, con UUID nuevo distinto del archivo, dispositivo e historia, operación nueva y base/revisión0. No modifica originales ni restaura permisos/preferencias/ACK/cursor/leases. Snapshot esperado validado e igualdad exacta de stores; exportedAt no determina antigüedad y puede variar al leer. Se conserva el JSON original literal y el snapshot revisado como evidencia del plan. Progreso/checklist copiados; fecha de finalización de una copia completada se establece en la nueva creación, conservando original en el archivo. Entre1–50 selecciones distintas y512KiB de intenciones, sin IO ni UI de confirmación.

Cinco pruebas/41 aserciones y suite231pass/30opt-in skip/0fail/4845aserciones; lint332archivos, tipos ybuild30recursos aprobados. Se corrigió la fixture del límite de bytes para exceder realmente512KiB con UTF8 multibyte; no se relajó el límite. Próxima `13c2c1`: recibo durable de importación compatible con backup, sin ejecutar todavía; después ejecutor atómico, replay/rollback/recarga y UI.


### Resultado 13c2c1

Registro local `backup-import:<UUID>` añadido al contrato de metadata existente, sin tabla nueva ni migración. Conserva cuenta/fecha/archivo original y selecciones ligadas al payload exacto de las operaciones preservadas; no concede ACK ni permisos. Archivo archivado acotado y validado estructuralmente, ownership completo, identidad de fuentes única y selección de contenido vivo simple, batch512KiB, payload/fecha idénticos al historial. Archivos dentro de archivos históricos se preservan como evidencia opaca, sin recursión ni restauración. Formato portable1 mantiene rechazo íntegro de metadata desconocida en lectores antiguos.

Ownership extraído a helper único compartido para evitar duplicar su validación. Tres pruebas/14 aserciones y regresión234pass/30opt-in skip/0fail/4859aserciones, lint336archivos, tipos/build30recursos aprobados. Aún no se escribe ningún recibo ni se ofrece importación UI. Próxima `13c2c2`: crear items/outbox/contador/recibo en una transacción propia, rechazo stale, rollback y replay tras recarga sin sobrescribir ediciones posteriores.


### Resultado 13c2c2

Importador client-only guarda nuevas copias, intenciones pending, contador y recibo en una sola transacción de los once stores. El lector de snapshot acotado se comparte con exportación y se invoca dentro de la misma transacción; valida partición, versión y post-state portable completo antes de escribir. Conserva originales, preferencias y cola existente; add/contador seguros y resultado únicamente tras complete. Notificación postcommit no invalida guardado. Recibo exacto permite replay sin exigir el snapshot antiguo vigente y sin reescribir copias editadas; misma importId con archivo/selección/fecha distintos rechaza.

Fixture propia de loopback4188 e IndexedDB real: seis checks de multicopia/preservación, replay/progreso, reutilización/stale/collision, cuenta/partición, fallo tardío con rollback y concurrencia una sola copia. Séptimo check tras recarga verifica snapshot/cola/recibo exactos y replay sin escrituras. Se corrigió la fixture porque getAll de outbox está ordenado por UUID, no por secuencia; ahora encuentra por identidad y ordena secuencias explícitamente. Ambas ejecuciones limpiaron exclusivamente particiones UUID propias; pestaña y servidor cerrados.

Normal234pass/30opt-in skip/0fail/4859aserciones, lint339archivos, tipos ybuild30recursos aprobados; sin DB remota ni falsa declaración de ACK/convergencia nueva. Próxima `13c2c3`: guardias de cuenta/época y preparación de confirmación a nivel workspace, luego UI compacta y prueba de envío de copias con dos dispositivos/Mongo aislado.


### Resultado 13c2c3

Servicios client-only de workspace entregados: lectura/comparación readonly, preparación con UUID/fecha generados una vez y commit del plan estable. Capturan cuenta/época e inputs antes de awaits, validan snapshot actual, verifican cuenta antes/después y de nuevo tras abrir importer, y cierran conexiones en finally. Si la cuenta cambia tras commit, no exponen éxito a otra cuenta ni deshacen copias propias; el recibo permite replay desde su cuenta.

Fixture IndexedDB real alcanza diez checks y uno tras recarga: preparación readonly, época invalidada durante apertura, caller mutando identidad/plan durante awaits, cambio tras commit con copia conservada/replay exacto, además de los checks anteriores. Cleanup valida control de cuenta propio/nulo antes de borrar exclusivamente sus particiones y control en loopback4188; pestaña/servidor cerrados. Suite234pass/30opt-in skip/0fail/4859aserciones, lint340archivos, tipos/build30recursos aprobados. Próxima `13c2d1`: selección y confirmación UI compactas en Ajustes; sincronización de copias con dos dispositivos/Mongo aislado en corte posterior.


### Resultado13c2d1 — UI de importación y convergencia de copias

Ajustes ofreceImportar JSON enCopia de seguridad. Diálogo cargado bajo demanda con archivo propio<=16MiB, selección vacía por defecto, máximo50 y páginas de20 filas; tipos no admitidos/borrados no seleccionables. Clasificación visible y contenido/comparación plegables, confirmación explícita de copias nuevas, UUID/plan estables, guardia síncrona contra doble envío y revalidación solo de caches propias. Fallo de refresco posterior no niega guardado; error incierto conserva plan para replay sin duplicación. Sin nueva pantalla ni cambio de navegación. Labels españolas, incluso selector visual de archivo; fila52px y controles44px, sin overflow en390px.

Fixture React/IndexedDB offline en4189 comprueba JSON inválido/ajeno, selección inicialmente vacía, preview/selección/cancelación sin escrituras, contenido comparado, cambio del original antes de confirmar con rechazo íntegro y nueva comparación, doble pulsación con una sola copia, progreso/checklist/archivo literal/cola pending/original conservados. Fixture definitiva parte de control vacío, no adopta cuentas ajenas; partición UUID/control propios, pestañas y servidor limpios. Durante desarrollo se reutilizó únicamente la partición que esta misma ejecución había creado, para limpiar tras reiniciar la fixture; ese mecanismo no forma parte del código final. Regresión SSR acota20 filas y deshabilita tombstones.

El agente con rutas disjuntas amplía únicamente sync-devices.ts:14 escenarios reales entre dos orígenes yMongoDB aislado pasan. Backup capturado enrev3 conACK/shadow/cursor históricos; después originalrev5 tombstone. Importación preserva los once stores existentes salvo copia/cola/counter/recibo. Copia base0 pending obtieneACK real/rev1 y converge; pérdida de respuesta+recarga+replay no duplica, progreso posterior converge enrev2 y nuevo replay no sobrescribe. Tombstone yarchivo/recibo exactos. Runnerexit0, contenedor/tmpfs/particiones propios limpios; Google/RPCNext real sigue pendiente y no se tocóDB del usuario.

Suite235pass/30opt-in skip/0fail/4865aserciones; lint347archivos, tipos/build34recursos neutros ydiff-check aprobados. Se corrigió la versión deDB de la fixture SSR para ajustarla al contrato2, sin cambiarlo. Las pruebas paralelas permiten incorporar la evidencia remota en este mismo corte; no queda un13c2d2 de convergencia abierto. Próxima candidata11c0: diseñar cortes de sincronización de preferencias personales/categorías/orden usando comandos locales existentes, compatibilidad explícita y conservación de pendientes antes de ampliar el ejecutor.
