# Instalar ORBTIME para pruebas

Versión de prueba para el equipo. Funciona en cualquier Mac, con chip Apple
o Intel, desde macOS 10.15. No está notarizada por Apple, así que la primera
vez macOS pide un permiso extra.

## 1. Instalar

1. Abre `ORBTIME_0.2.0_universal.dmg`.
2. Arrastra **ORBTIME** a **Aplicaciones**.
3. Expulsa el disco.

## 2. Abrirla la primera vez

macOS avisa que no pudo verificar la app. En una versión de prueba es normal.

1. Cierra el aviso con **Listo**. No la mandes a la papelera.
2. Abre **Ajustes del Sistema → Privacidad y seguridad**.
3. Baja hasta el mensaje sobre ORBTIME y pulsa **Abrir igualmente**
   (*Open Anyway*).
4. Pon tu contraseña y confirma.

Desde ahí abre normal. Si prefieres Terminal, esto hace lo mismo:

```bash
/usr/bin/xattr -dr com.apple.quarantine /Applications/ORBTIME.app
```

## 3. Permisos

La app pide dos permisos. Acéptalos:

- **Notificaciones**: para las alarmas de cada hora.
- **Carpeta Documentos**: para guardar el reporte del día en
  `Documentos/ORBTIME`.

## Qué probar

- Abrir cuentas, agregar personas y cambiar paquete o modalidad.
- Cobrar con y sin descuento de estudiante.
- Cerrar la ventana: la app sigue en la barra de menús (la ō).
- **Cerrar día**, y luego salir: el reporte aparece en `Documentos/ORBTIME`.

Si algo falla, anota qué hiciste y manda una captura junto con los archivos de
`Documentos/ORBTIME`.

## Versiones nuevas

Reemplaza la app en Aplicaciones y repite el paso 2. El día en curso y los
ajustes se conservan.
