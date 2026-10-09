# Documentación — Arte Odontológico

Fuente de la documentación del proyecto. Los archivos `.md` son la versión editable (versionada en Git). La carpeta `para-drive/` tiene las versiones en Word (`.docx`) e imágenes listas para subir a la carpeta compartida de Google Drive.

> Cuando llegue la plantilla oficial de la FET, el contenido se pasa a ella; el texto no cambia.

## Qué va en cada carpeta del Drive

| Carpeta del Drive | Archivo para subir (`para-drive/`) | Fuente editable | Estado |
|---|---|---|---|
| Anteproyecto | *(el documento aprobado que ya tienen)* | — | — |
| Requerimientos | `Alcance v2.docx` | `02-requerimientos/alcance-v2.md` | Listo |
| Requerimientos | *Requerimientos, backlog e historias de usuario* | — | Debe actualizarse al alcance v2 |
| Diseño | `Modelo de datos.docx`, `Diagrama entidad-relación.png` y `Diagrama de arquitectura.png` | `03-diseno/` | Listo |
| Diseño | `Contrato de la API.docx` | `03-diseno/contrato-api.md` | Listo |
| Diseño | `Decisiones técnicas.docx` | `decisiones-tecnicas.md` | Listo |
| Manuales | `Manual de instalación.docx` | `04-manuales/manual-instalacion.md` | Borrador (falta la publicación en servidor) |
| Manuales | `Manual técnico.docx` | `04-manuales/manual-tecnico.md` | Borrador (falta la parte del frontend) |
| Manuales | `Manual de usuario.docx` | `04-manuales/manual-usuario.md` | Solo estructura (faltan las capturas) |
| Avances y actas | `Informe de avance (septiembre).docx` | `informe-avance.md` | Histórico (alcance anterior) |
| Pruebas | `Pruebas.docx` y las dos guías `.txt` | `06-pruebas/` | Listo; faltan pruebas manuales y del frontend |

## Regenerar los Word

Desde la carpeta `docs/`, con [Pandoc](https://pandoc.org) instalado:

```bash
pandoc 04-manuales/manual-tecnico.md -o "para-drive/Manual técnico.docx"
```

Para el modelo de datos hay que ejecutarlo desde `03-diseno/`, para que encuentre la imagen del diagrama.
