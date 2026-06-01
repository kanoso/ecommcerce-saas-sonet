---
tags: [testing, e2e, detox, react-native]
---

# E2E Tests — Detox

E2E tests for the tiendi-go rider app using Detox + Jest.

> These tests require a **native build**. They do NOT work with Expo Go.

## Install

```bash
npm install --save-dev detox jest-circus @config-plugins/detox
```

## Add the config plugin

In `app.json`, add to the `plugins` array:

```json
["@config-plugins/detox", { "subdomains": "*" }]
```

## Generate native projects

```bash
npx expo prebuild
```

## Build

**Android:**
```bash
detox build --configuration android.emu.debug
```

**iOS:**
```bash
detox build --configuration ios.sim.debug
```

Or use the npm scripts:
```bash
npm run e2e:build:android
npm run e2e:build:ios
```

## Run tests

**Android:**
```bash
detox test --configuration android.emu.debug
```

**iOS:**
```bash
detox test --configuration ios.sim.debug
```

Or use the npm scripts:
```bash
npm run e2e:test:android
npm run e2e:test:ios
```

## Prerequisites at runtime

- Android emulator `Pixel_7_API_35` created and available (or iOS simulator iPhone 16 for iOS)
- Test backend running at `http://localhost:3000` with seed data
- For `pod-otp-invalid.test.ts`: a delivery record with ID `test-delivery-id` must exist in `EN_DESTINO` state in the test database
- For `offer-timeout.test.ts`: the test backend must inject an offer for `carlos.quispe@rider.test` after the rider goes online

## testIDs required in app components

The following `testID` props must be added to the corresponding components before these tests can pass:

| testID | Component / location |
|---|---|
| `email-input` | Login screen — email TextInput |
| `password-input` | Login screen — password TextInput |
| `login-btn` | Login screen — submit button |
| `home-screen` | Home screen root View |
| `go-online-btn` | Home screen — go-online toggle button |
| `status-online` | Home screen — online status indicator |
| `offer-card` | Offer modal / overlay card |
| `offer-timer` | Offer card — countdown timer element |
| `accept-offer-btn` | Offer card — accept button |
| `delivery-screen` | Delivery detail screen root View |
| `pickup-btn` | Delivery screen — confirm pickup button |
| `pickup-manual-tab` | Pickup modal — manual code tab |
| `pickup-code-input` | Pickup modal — code TextInput |
| `confirm-pickup-btn` | Pickup modal — confirm button |
| `status-en-camino-cliente` | Delivery screen — "en camino al cliente" status indicator |
| `pod-btn` | Delivery screen — proof-of-delivery button |
| `pod-otp-input` | POD modal — OTP TextInput |
| `confirm-pod-btn` | POD modal — confirm button |
| `pod-error-msg` | POD modal — error message element |

## Ver también

- [[tiendi-go — arquitectura]]
- [[tiendi-go — flujos de entrega]]
