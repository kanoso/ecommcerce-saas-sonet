# Decisiones Técnicas — Plataforma de Rifas

> Documento de registro de decisiones de arquitectura y diseño técnico.
> Referencia: [GUIA-IMPLEMENTACION-RIFAS.md](GUIA-IMPLEMENTACION-RIFAS.md)

---

## DT-01: Selección de red de drand y verificación de aleatoriedad (Spike Fase 1)

**Fecha:** 2026-10-29  
**Estado:** Aprobada / Verificada  
**Fase:** Fase 1 (`packages/raffle-draw`)

### Contexto
El sistema requiere una fuente pública de aleatoriedad verificable no manipulable para el sorteo commit-reveal + drand. Drand ofrece dos redes públicas operadas por League of Entropy:
1. Red principal histórica (`default`): periodo de 30 segundos, esquema BLS encadenado (chained).
2. Red rápida (`quicknet`): periodo de 3 segundos, esquema BLS no encadenado (unchained `bls-unchained-g1-rfc9380`).

### Decisión
Se elige **`quicknet`** como la red oficial para todos los sorteos de la plataforma.

### Parámetros oficiales de la cadena Quicknet
- **Chain Hash:** `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`
- **Periodo (`period`):** 3 segundos
- **Tiempo génesis (`genesis_time`):** `1692803367` (2023-08-23T15:09:27Z)
- **Esquema criptográfico (`schemeID`):** `bls-unchained-g1-rfc9380`
- **Clave pública (`public_key`):**  
  `83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a`

### Justificación
1. **Experiencia de usuario en el Sorteo en Vivo:** un periodo de 3 segundos permite que la cuenta regresiva en vivo alcance la ronda casi en tiempo real (espera máxima de 3s vs hasta 30s de la red clásica).
2. **Verificabilidad unchained:** Cada ronda de `quicknet` contiene su firma y puede verificarse de manera aislada con la clave pública de la red, sin necesidad de descargar ni validar rondas previas.

### Validación de Relays HTTP y CORS
Se verificaron mediante peticiones con header `Origin: http://localhost:4200`:
- `https://api.drand.sh`: Activo (`HTTP 200 OK`, `Access-Control-Allow-Origin: *`)
- `https://api2.drand.sh`: Activo (`HTTP 200 OK`, `Access-Control-Allow-Origin: *`)
- `https://drand.cloudflare.com`: Activo (`HTTP 200 OK`, `Access-Control-Allow-Origin: *`)

Todos los relays permiten consumo directo vía `fetch()` desde el navegador sin intermediación de servidores de la plataforma (cumpliendo la regla V-01 de la especificación).

### Librería cliente oficial
- Nombre en npm: `drand-client` (v1.4.2 vigencia confirmada).
- Compatible con Node.js y navegadores para verificación BLS con `@noble/curves`.
