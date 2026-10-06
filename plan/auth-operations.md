# Identidad y sesiones — operación

- Google OAuth requiere las variables de auth existentes y MongoDB accesible en ejecución. El build no abre una conexión; las primeras consultas provisionan los índices registrados.
- Tras migrar desde el modo antiguo sin DB, las cookies firmadas anteriores no son una identidad persistida. Volver a iniciar sesión con Google crea o recupera el usuario persistente; no reutilizar IDs transitorios para datos offline.
- El layout protegido mantiene la comprobación en servidor. Todas las futuras acciones/APIs usan `getAuthorizedSessionFromHeaders` o `getAuthorizedSession`, que ignoran caché de cookie y leen sesión vigente sin renovación durante render.
- Una sesión expirada, revocada, sin usuario persistido, con identidad inconsistente o email no verificado/permitido no autoriza. La configuración de auth también deshabilita la caché de cookie para lecturas del cliente.
- `ALLOWED_EMAILS` sigue delimitando el piloto; invitar no amplía el registro. Al retirar un correo de la configuración del despliegue, nuevas verificaciones de acceso lo rechazan.
- La sesión remota caducada no impedirá editar la copia local preparada cuando se construya el shell offline: eso no concede permiso remoto; reenviar requerirá sesión válida de la misma cuenta.
- Integración automatizada: DB local con nombre `dalis-auth-test-*`, flag `RUN_AUTH_DB_TESTS=1`, credenciales ficticias y correos `example.test`; el test rechaza host remoto antes de limpiar. El origen de claves es de prueba, pero firma, emisor, audiencia y edad se verifican.
- El login Google interactivo real se valida en el piloto. No se han probado ni modificado cuentas o documentos de producción.
