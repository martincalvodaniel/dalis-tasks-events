# Backup y recuperación

Contrato1 almacena un snapshot validado de los once stores propios de IndexedDB2: contenido y apariciones, categorías/vistas/colocaciones/settings, memberships/invitations, outbox, shadows y metadata (contador, preference-tail, cursor, outcomes y decisiones de resolución). Incluye tombstones, operaciones confirmadas y supersedidas y leases como evidencia. El ownerId de una lease es el nonce del sender, no el propietario de los datos.

Formato dalis-local-backup/version1/protocol1/databaseVersion2, cuenta y fecha de exportación. Todos los stores son obligatorios; arrays acotados a10000 registros (settings1), fichero <=16MiB UTF8. Claves y secuencias únicas, dependencias hacia registros anteriores, contador vigente, outcome ligado al payload conservado, decisiones ligadas a su historia Superseded/replacement. No se filtran silenciosamente registros incompatibles ni se borra nada al fallar.

El fichero no incluye cookies, Google tokens, secretos o control de cuenta/época. La cuenta activa debe coincidir al generar o leer un backup. Se soportan datos propios actuales; registros compartidos ajenos y versiones futuras necesitan un contrato posterior y se rechazan íntegramente. Un fichero local nunca constituye autorización remota. El contrato es validación estructural y coherencia; no firma ni prueba de autenticidad del servidor.

13c1a solo contrato/codificador/lector puros y tests. Siguiente13c1b: snapshot de una transacción readonly de todos los stores, conexión cerrada y guardias de cuenta/época antes/después. Siguiente13c1c: descarga JSON desde Ajustes, bajo petición, sin red y solo tras validación completa, con error honesto y fichero de cuenta/fecha sin PII en filename.

Importación aún no disponible. Cortes posteriores deben mostrar contenido/duplicados/cuenta/versión y confirmar explícitamente. No restaurar directamente outbox, ACK, leases, cursores, revisión remota ni permisos; generar intenciones nuevas por decisiones de producto y conservar copia/evidencia original. Reintentos o fallos de cuota no deben producir éxito ni borrar datos. Repeticiones/preferencias necesitan ejecutores compatibles; no declarar importación global lista a partir del exportador.


13c1b: lector getAlllimit10001 de11stores enmisma txreadonly, ownershippartición/DBversion/fecha/byteguard sintruncate, wrapperactor/epochantesdespués yclosefinally. IndexedDB4checks+reload: snapshot completo/colaexacta/tombstone/preferencias/roundtrip, snapshotprecedewritecoherente, unknownmetadatarechaza sin cambios, wrongpartition/epoch yepochcambiada durantelectura noentregadatos/closeexacto. Owncleanupnormal217pass/30skip/4727aserciones/lint321files/tipos/build30recursos. Próxima13c1cdescargaUI si margen, importación siguependiente.


13c1c: secciónplegablecompactaCopia de seguridad enAjustes, downloadsolo tras snapshotvalidado yguardiaactual, JSONBlob/filenamefecha sincuenta yURLrevocable/linkremovido. Mensajehonestodescargasolicitada, importacióntodavíano disponible; sinfetch/ACK/escrituras. FixtureUIreal390 confetchbloqueado validaBlob11stores/colaexacta, epochcambiado error sinsegundaBlob, recursospropios limpios yviewportreset; botón44px/sin overflow. Normal217pass/30skip/4727aserciones/lint325files/tipos/build30recursos aprobados. Próxima13c2apreviewpuro deimportación si margen; ejecutor/importUI posteriores.


13c1d: outcome.local/base/current/applieditem deben coincidirconcommand.itemId; replacement exacto contra operaciónpreservada, sinaceptarevidenciamanipulada. Dos tests identity/payload/actornested/counter/shadowduplicado; 219pass/30skip/4734aserciones/lint325files/tipos/build30recursos aprobados. Fixture usa operaciónclonada separada de decisiónpara quealterar una pruebe realmenterechazo. Sin nuevaUI/IO/migración. Código cerrado, próxima13c2apreviewimportación.


## 13c2a — Comparación antes de importar

`previewLocalBackupImport` acepta el JSON y un snapshot local íntegro de la misma cuenta; valida versiones, estructura, historia y bytes de ambos antes de devolver filas. La identidad usa la clave de cada store (incluidas colocaciones y membresías compuestas). No une títulos iguales con IDs distintos. Las filas representan registros del archivo; registros existentes exclusivamente en el dispositivo quedan intactos.

Clasificaciones: new, identical, changed, source_deleted, current_deleted y both_deleted. Los borrados tienen prioridad sobre igualdad. La comparación exacta incluye timestamps/revisión y nunca deduce antigüedad remota de exportedAt. Simple_item identifica contenido de tarea/evento sin repetición; no significa que exista todavía ejecutor. Preferencias/series/apariciones/cumpleaños siguen unsupported; outbox/shadows/metadata/permisos/invitaciones quedan evidence_only, conservados íntegramente para revisión. No se generan operaciones ni se acepta un ACK del archivo como resultado local. Salida por clave determinista O(n log n), con snapshots independientes y sin IO.

Próxima `13c2b`: contrato validado de selecciones, identidades y operaciones nuevas. El ejecutor deberá revalidar cuenta/época y snapshot actual, preservar historia y pendientes, asegurar atomicidad/replay y rechazar elecciones obsoletas; solo después se ofrecerá confirmación UI.
