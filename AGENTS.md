# Entorno TEST

- El usuario confirmó el 2026-10-14 que el servidor TEST usa **Ubuntu** y su IP local es **192.168.1.51**.
- Consultar [DOCS/ENTORNO-TEST.md](DOCS/ENTORNO-TEST.md) antes de trabajar en despliegues o migraciones.
- Las credenciales se gestionan en OpenBao. Hay acceso SSH verificado como `tiendi-admin` con la llave local `~/.ssh/tiendi-test/id_rsa`; no solicitar contraseñas por chat ni imprimir secretos.
- Las referencias a Windows/RupertaMini y `192.168.1.37` son históricas. No reutilizar sus rutas, usuarios ni scripts de despliegue sin verificar su compatibilidad con el servidor Ubuntu actual.
