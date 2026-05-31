---
tags:
  - tiendi-go
  - assets
  - notificaciones
aliases:
  - Sonidos de Notificaciones
---

# Sonidos de Notificaciones

Este directorio contiene los archivos de sonido para las notificaciones push.

## Archivos requeridos

| Archivo | Canal Android | Descripción |
|---------|---------------|-------------|
| `offer.wav` | `offers` | Sonido de nueva oferta de pedido — 3 notas ascendentes, ≤ 2s |

## Cómo agregar `offer.wav`

1. Crear o conseguir un archivo WAV mono, 22kHz o 44kHz, ≤ 2 segundos.
2. Nombrarlo exactamente `offer.wav`.
3. Colocarlo en este directorio (`assets/sounds/offer.wav`).
4. El plugin de `expo-notifications` en `app.json` ya lo referencia:
   ```json
   "sounds": ["./assets/sounds/offer.wav"]
   ```
   EAS lo copia automáticamente a:
   - Android: `android/app/src/main/res/raw/offer_wav`
   - iOS: bundle root (referenciado desde el payload FCM como `"sound": "offer.wav"`)

## Notas

- El nombre del archivo en Android se normaliza: `offer.wav` → `offer_wav` (guiones y puntos se reemplazan por `_`).
- El backend debe enviar `channelId: "offers"` en el payload FCM para Android.
- Para iOS el backend debe enviar `sound: "offer.wav"` en el payload APNs.
- Sin este archivo el build compila pero las notificaciones de oferta usan el sonido del sistema.

## Ver también

- [[STACK-TECNOLOGICO]] — stack definido
- [[FUNCIONALIDADES]] — módulo 3, recepción de pedidos
