# Cumpleaños

**Aparcado por decisión del usuario.** No conectar UI, persistencia ni sincronización de cumpleaños hasta nueva elección. 10a permanece como preparación histórica sin caller. Las notas con categoría y repetición anual ya cubren una alternativa disponible.

## 10a — Contrato civil y generador cerrado

El contrato existente `birthday` es específico: persona/título, descripción, mes/día, año de nacimiento opcional y zona. No incorpora estado ni checklist. La aparición es anual y de día completo; no hay un timestamp UTC ni un comando de progreso por aparición.

`birthdayAppearancesPage()` valida el registro y la consulta civil, genera identidades `seriesId:YYYY-MM-DD` y pagina con cursor exclusivo/límite máximo500. No modifica el padre, usa reloj ni hace IO. Cumpleaños borrados no aparecen; el año conocido excluye fechas previas al nacimiento. Edad es `año de aparición - birthYear`, o null si no se conoce el año. Año civil limitado a1..9999.

Política inicial del29febrero: **sólo años bisiestos**, igual que la repetición anual vigente. No sustituir silenciosamente por28febrero o1marzo. La futura pantalla mostrará esta regla de forma visible. Se prueban las centurias1900/2000/2100, el año opcional, rangos inclusivos, cursores sin pérdida, igualdad entre zonas y límites civiles. Cambiar posteriormente esta política requiere definir sus identidades antes de activar otras fechas.

Schemas/types/motor preparados, sin caller de UI, persistencia, comandos remotos nuevos o activación parcial. Seis tests nuevos /37aserciones; suite761pass/209skip/0fail/10347aserciones, lint787/tipos/buildWebpack/worker46. No nueva consulta DB: los índices existentes permanecen en `ensure-indexes.ts`; evaluar las consultas reales al conectar repositorios.

## Siguiente entrega coherente

Conectar creación/edición/borrado de cumpleaños, categoría y calendario con soporte remoto explícito. Reutilizar registro de contenido, repositorios/CAS, recibos/journal y productores atómicos; no inventar progreso ni guardar apariciones derivadas como si fueran planes. El protocolo5 actual excluye cumpleaños: mantener rechazo/cola y cerrar negociación/consumidores/backup/pruebas antes de publicar el nuevo alcance. No ofrecer una pantalla que prometa sincronización sin ejecutor.

Antes de editar10b, delimitar soporte de asignación/orden y diagnóstico, rutas concretas, schema/wire y acceptanceNext/dosparticiones. No repetir la auditoría histórica ni crear nuevos índices especulativos; añadir toda necesidad real al registro central. Sin wipe, migración de identidad, supersesión automática o cambios productivos.
