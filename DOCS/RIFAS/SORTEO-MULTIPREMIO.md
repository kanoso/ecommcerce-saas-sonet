# Sorteo con varios premios (algoritmo v2)

> Referencias: [DECISIONES-TECNICAS-RIFAS.md](DECISIONES-TECNICAS-RIFAS.md) (DT-21) · [RUNBOOK-RIFAS.md](RUNBOOK-RIFAS.md) (§3.4 y §8) · [ESPECIFICACIONES-RIFAS.md](ESPECIFICACIONES-RIFAS.md) (§10)
> Código: `FUENTES/packages/raffle-draw/src/index.ts`, `FUENTES/tiendi-rifas-api/src/modules/raffles`, `FUENTES/tiendi-rifas-web/src/app/core/{verification,live}` · Commit `330997f`

Una rifa puede tener entre 1 y 20 premios ordenados. Los premios se sortean uno tras otro con la misma semilla y la misma ronda de drand. Después de cada premio, el ganador (o todos los boletos de su comprador) sale del bolillero. Las rifas de un solo premio no cambian: siguen con el algoritmo v1.

---

## 1. Resumen en una tabla

| Tema | Regla |
|---|---|
| Cantidad de premios | 1 a 20 (`MAX_PRIZES` / `MAX_RAFFLE_PRIZES`). Posiciones 1..N sin huecos; el premio 1 se sortea primero. |
| Intento ganador | El mismo `winningAttempt` (1 a 5) para cada premio. Los intentos anteriores son "al agua" y vuelven al bolillero para el premio siguiente. |
| Modo de exclusión | `TICKET_ONLY` (por defecto): sale solo el boleto ganador. `BUYER`: salen todos los boletos del comprador ganador (`TicketOrder.userId`). |
| Bolillero insuficiente | Si quedan menos boletos que `winningAttempt`, ese premio y todos los siguientes quedan `VOID` (desiertos). El sorteo no se rechaza. |
| Algoritmo | v1 si la rifa tiene 1 premio; v2 si tiene más de 1. La versión sale de la cantidad de premios, nunca de lo que informe el servidor. |
| Cambio de modo | Solo en `DRAFT`, o en `ACTIVE` antes de `salesCloseAt`. Se congela en `drawConfigHash` al cierre de ventas. |
| Integridad | Un sorteo v2 se rechaza si la configuración no coincide con el hash congelado o si se congeló cuando la ronda de drand ya era pública. |

---

## 2. Reglas de negocio

### 2.1 Premios
- Cada premio tiene título (obligatorio), descripción opcional y hasta 10 imágenes.
- La posición de un premio es su lugar en la lista enviada por el operador.
- Los premios solo se editan mientras la rifa está en `DRAFT` (validación de dominio y trigger de base de datos).
- Los campos heredados `Raffle.prize`, `prizeDescription` y `prizeImages` siguen existiendo y reflejan el premio 1.

### 2.2 Intentos "al agua"
Para cada premio se hacen `winningAttempt` extracciones sin reposición sobre una **copia** del bolillero. La última extracción gana. Las anteriores no salen del bolillero: siguen participando en los premios siguientes.

### 2.3 Modos de exclusión

| Modo | Qué sale del bolillero tras un premio ganado | Efecto práctico |
|---|---|---|
| `TICKET_ONLY` | Solo el boleto ganador. | Un mismo comprador puede ganar varios premios con boletos distintos. |
| `BUYER` | Todos los boletos vendidos del comprador ganador, agrupados por `TicketOrder.userId`. | Cada comprador gana como máximo un premio. El bolillero se reduce más rápido. |

- Un boleto vendido sin orden cuenta como su propio comprador. Si ese boleto gana, el sorteo se bloquea igual (`WINNING_TICKET_WITHOUT_ORDER`, DT-13).
- Con un solo premio el modo no tiene efecto en el resultado (v1 no lo usa).

### 2.4 Premios desiertos (`VOID`)
- Antes de cada premio se compara el tamaño del bolillero con `winningAttempt`.
- Si es menor, el premio queda `VOID` y también todos los siguientes. Un premio `VOID` no tiene boleto, digest ni extracciones.
- Diferencia con v1: en v1 un bolillero insuficiente rechaza el sorteo (`UNDER_THRESHOLD`); en v2 nunca se rechaza por esa causa.
- Si no se vendió ningún boleto, el sorteo no se ejecuta en ninguna versión (`DrawNotPossibleError`).

---

## 3. Ejemplo resuelto

Rifa con **3 premios**, `winningAttempt = 3` y 10 boletos vendidos (1 a 10). Compradores: A = {1, 2, 3, 4}, B = {5, 6}, C = {7, 8, 9}, D = {10}.

> Los números ganadores son ilustrativos: en un sorteo real salen del digest (§4). Lo que el ejemplo muestra es cómo cambia el bolillero.

### 3.1 Modo `TICKET_ONLY`

| Premio | Bolillero antes | Extracciones (copia: 10 → 9 → 8) | Ganador | Sale del bolillero |
|---|---|---|---|---|
| 1 | 10 boletos | 7 (al agua), 2 (al agua), **3** | 3 | {3} |
| 2 | 9 boletos | 2 (al agua), 9 (al agua), **4** | 4 | {4} |
| 3 | 8 boletos | 1 (al agua), 10 (al agua), **7** | 7 | {7} |

El comprador A gana dos premios (boletos 3 y 4): está permitido en este modo. Los boletos 7, 2, 9, 1 y 10 salieron "al agua" y siguieron participando.

### 3.2 Modo `BUYER`

| Premio | Bolillero antes | Ganador | Comprador | Sale del bolillero | Queda |
|---|---|---|---|---|---|
| 1 | 10 boletos | 3 | A | {1, 2, 3, 4} | 6 |
| 2 | 6 boletos | 8 | C | {7, 8, 9} | 3 |
| 3 | 3 boletos | (el último que queda en la copia) | B o D | — | — |

En el premio 3 el bolillero tiene exactamente 3 boletos: las tres extracciones agotan la copia y gana el último.

### 3.3 Variante con premio desierto
Si C hubiera comprado {6, 7, 8, 9} y B solo {5}, tras el premio 2 quedarían {5, 10}: 2 boletos, menos que `winningAttempt = 3`. El premio 3 queda `VOID`.

---

## 4. Algoritmo v2 (tal como está implementado)

Función `computeMultiPrizeWinners` en `@kanoso/raffle-draw` (`MULTI_PRIZE_ALGORITHM_VERSION = 'v2'`).

1. **Lista normalizada:** `soldNumbers` ordenados de forma ascendente y sin duplicados (`normalizeSoldNumbers`). El bolillero inicial es esa lista.
2. Para cada premio `p = 1..N`, en orden:
   1. Si `bolillero.length < winningAttempt` (o un premio anterior ya fue `VOID`), el premio es `VOID`.
   2. Si no, se copia el bolillero en `remaining` y, para cada intento `k = 1..winningAttempt`:

      ```text
      digest = SHA-256( seed (32 bytes)
                     || drandRandomness (32 bytes)
                     || utf8(lower(trim(raffleId)))
                     || utf8(":prize:" + p + ":attempt:" + k) )
      index  = BigInt("0x" + digest) mod remaining.length
      elegido = remaining[index]
      remaining.splice(index, 1)
      ```

   3. La extracción `k = winningAttempt` es la ganadora (`isWinner = true`). En cada extracción, `index` publicado es la posición del número en la **lista normalizada completa**, no en `remaining`.
   4. Se calculan los excluidos: `[ganador]` en `TICKET_ONLY`, o el grupo completo del comprador en `BUYER`. El bolillero se filtra quitando esos números; conserva el orden ascendente.
3. Cada resultado publica: `position`, `status` (`WON` / `VOID`), `poolSize` (bolillero antes del premio), `winningTicket`, `winnerIndex`, `digestHex`, `extractions` y `excludedTickets`.

**Diferencias con v1 (`computeWinnerSequence`):** v1 no agrega sufijo en el intento 1 y usa `":attempt:" + k` desde el intento 2. v2 agrega siempre `":prize:p:attempt:k"`, también en el intento 1. Por eso v1 y v2 dan resultados distintos con los mismos datos, y una rifa de un premio nunca se calcula con v2.

### 4.1 Grupos de compradores
`normalizeBuyerGroups`: cada grupo ordenado y sin duplicados, grupos vacíos descartados, grupos ordenados por su boleto más bajo. Un boleto en dos grupos es un error. En modo `BUYER` cada boleto vendido debe pertenecer a exactamente un grupo. Los grupos se publican sin identidades de comprador.

### 4.2 Contenido canónico de `drawConfigHash`
`drawConfigHash = hex(SHA-256(utf8(canonicalDrawConfig)))`, con:

```text
tiendi-raffle-draw/v2;mode=<MODO>;attempts=<k>;prizes=<N>;buyers=<g1>|<g2>|...
```

- Cada grupo `gi` son sus números unidos por comas, en orden ascendente.
- `buyers=` queda vacío en `TICKET_ONLY`.
- Ejemplo (`BUYER`, datos de §3.2): `tiendi-raffle-draw/v2;mode=BUYER;attempts=3;prizes=3;buyers=1,2,3,4|5,6|7,8,9|10`.

---

## 5. Regla de integridad y por qué existe

**Problema:** el modo de exclusión cambia quién gana los premios 2 en adelante. Si un operador pudiera elegir el modo después de que la aleatoriedad de la ronda de drand es pública, podría calcular ambos resultados y quedarse con el que prefiera. Lo mismo vale para la agrupación de boletos por comprador.

**Solución:** congelar la configuración antes de que exista la ronda.

| Momento | Qué se permite / qué se hace |
|---|---|
| `DRAFT` | El modo se edita libremente (`PATCH admin/rifas/:id` o `PATCH admin/rifas/:id/modo-exclusion`). |
| `ACTIVE`, antes de `salesCloseAt` | El modo se edita solo con `PATCH admin/rifas/:id/modo-exclusion`, bajo el bloqueo de la rifa y con auditoría `WINNER_EXCLUSION_MODE_CHANGED`. |
| `ACTIVE`, desde `salesCloseAt` | Rechazado aunque el job de cierre no haya corrido (`SalesClosedError`, 409; trigger `Raffle_exclusion_mode_locked`). |
| Cierre `ACTIVE → CLOSED` | En la misma transacción que congela `soldListHash`: se calcula `drawConfigHash` y se registra `drawConfigFrozenAt`. Auditoría `SALES_CLOSED` con `drawConfigHash`, `drawConfigFrozenAt`, `winnerExclusionMode` y `prizeCount`. |
| `CLOSED`, `DRAWN`, `CANCELLED` | El modo, el hash y la hora de congelamiento no cambian (trigger). |
| Sorteo v2 | Se rechaza si `drawConfigFrozenAt` no es anterior a la hora de publicación de la ronda (`DRAW_CONFIG_FROZEN_LATE`) o si la configuración actual no da el hash congelado (`DRAW_CONFIG_MISMATCH`). |

- **Hora de publicación de la ronda:** `timeOfRound(drandRound) = genesis + (round − 1) × period`. Un cierre tardío (por ejemplo, un job de cierre que corrió después de esa hora) no puede probar que eligió el modo a ciegas, así que el sorteo se rechaza antes de consultar drand.
- **Reloj de la base:** el trigger fija `drawConfigFrozenAt` como el mayor entre el valor enviado por la aplicación y `clock_timestamp()` de PostgreSQL. Un reloj de aplicación atrasado no puede hacer parecer temprano un congelamiento tardío.
- **Doble comprobación:** el hash se recalcula antes de consultar drand y otra vez dentro de la transacción que registra el sorteo, bajo bloqueo.

### 5.1 Ancla en el correo de pago aprobado
El correo `TICKET_CONFIRMATION` (DT-20) agrega en "Datos para verificar tu sorteo":
- `Cantidad de premios` e `Intento ganador`.
- Solo si hay más de un premio: `Modo de exclusión al momento de tu pago`, con la aclaración de que puede cambiar hasta el cierre de ventas y que la página de verificación muestra el que quedó fijado.

**Limitación:** el correo no puede llevar `drawConfigHash`, porque el hash se calcula al cierre, después del pago. El correo ancla el modo vigente al pagar, no el modo final. Si el operador cambia el modo mientras la rifa está `ACTIVE`, el comprador solo lo nota comparando el correo con la página de verificación. Ver §11.

---

## 6. Compatibilidad con v1

| Caso | Comportamiento |
|---|---|
| Rifa con 1 premio | Algoritmo v1 (`computeWinnerSequence`) sin cambios: mismo resultado, mismos correos, misma verificación. |
| Rifa con más de 1 premio | Algoritmo v2. Exige `drawConfigHash`; sin él, el sorteo no se ejecuta. |
| Rifas y sorteos anteriores a la migración | Se rellenan como un premio en posición 1 y un `DrawWinner` en posición 1. Las columnas de `Draw` no cambian, así que la verificación v1 lee lo mismo que antes. |
| Navegador | Decide la versión por `premios.length > 1`. Si el servidor informa otra versión, la verificación falla aunque los números coincidan. |

El cierre de ventas calcula `drawConfigHash` para todas las rifas, también las de un premio, pero v1 no lo comprueba.

---

## 7. Modelo de datos

### 7.1 Tablas nuevas

| Tabla | Columnas principales | Restricciones |
|---|---|---|
| `RafflePrize` | `raffleId`, `position`, `title`, `description`, `images[]` | `UNIQUE (raffleId, position)`; borrado en cascada con la rifa. |
| `DrawWinner` | `drawId`, `prizeId`, `position`, `status` (`WON` / `VOID`), `ticketId`, `winningNumber`, `winnerIndex`, `digestHex`, `poolSize`, `extractions` (JSONB), `excludedTickets[]` | `UNIQUE (drawId, position)`; `UNIQUE (drawId, ticketId)`; claves foráneas `RESTRICT` a `Draw`, `RafflePrize` y `Ticket`. |

### 7.2 Columnas nuevas o modificadas

| Tabla | Columna | Uso |
|---|---|---|
| `Raffle` | `winnerExclusionMode` (`TICKET_ONLY` por defecto) | Modo de exclusión. |
| `Raffle` | `drawConfigHash` | Hash congelado al cierre (§4.2). |
| `Raffle` | `drawConfigFrozenAt` | Hora del congelamiento. Rellenada para cierres previos con el primer `SALES_CLOSED` de la auditoría. |
| `Draw` | `digestHex`, `winningTicketId`, `winningNumber`, `winnerIndex` | Ahora admiten `null`: reflejan el premio 1, que en v2 puede ser `VOID`. |

### 7.3 Triggers

| Trigger | Tabla | Qué bloquea |
|---|---|---|
| `trg_raffle_draw_config_immutable` | `Raffle` | Cambiar `winnerExclusionMode` fuera de `DRAFT`/`ACTIVE`, en el `UPDATE` que cierra ventas o desde `salesCloseAt`. Escribir `drawConfigHash` o `drawConfigFrozenAt` salvo una vez, en el paso `ACTIVE → CLOSED`. Fija `drawConfigFrozenAt` con el reloj de la base. |
| `trg_raffle_prize_draft_only` | `RafflePrize` | Insertar, editar, mover o borrar premios si la rifa de origen o de destino no está en `DRAFT`. Permite el borrado en cascada de un borrador. |
| `trg_draw_winner_append_only` | `DrawWinner` | Todo `UPDATE` y `DELETE`. |
| `trg_ticket_order_buyer_frozen` | `TicketOrder` | Cambiar `userId` en rifas `CLOSED` o `DRAWN` (el comprador alimenta los grupos del hash). |
| `trg_ticket_transition_order_frozen` | `Ticket` | En rifas `CLOSED` o `DRAWN`: que un boleto gane una orden, cambie de orden o que un boleto `SOLD` pierda la suya. Liberar una reserva no vendida sigue permitido. |

Además, al registrar el sorteo la API comprueba que cada ganador apunte a un `RafflePrize` persistido en su posición; si no, rechaza sin escribir nada (`MissingRaffleDataError`).

---

## 8. Verificación pública y página en vivo

Datos públicos: `GET /api/rifas/:id/verificacion` y `GET /api/rifas/:id/en-vivo` agregan `premios`, `modo_exclusion_ganador`, `hash_configuracion`, `grupos_compradores` (solo en `BUYER`, sin identidades) y `ganadores[]` con `posicion`, `titulo_premio`, `estado`, `numero_ganador`, `indice_ganador`, `digest_hex`, `boletos_en_juego`, `excluidos` y `extracciones`. La verificación agrega `configuracion_verificada`. En la página en vivo, `hash_configuracion` es `null` hasta el cierre.

### 8.1 Página de verificación
Nueva comprobación "Premios y modo de exclusión congelados al cierre":
1. La versión informada debe ser la que corresponde a la cantidad de premios.
2. Con un premio, la comprobación se omite.
3. Con varios: falla si `configuracion_verificada` es falso, o si el SHA-256 calculado en el navegador con modo, intentos, cantidad de premios y grupos no es `hash_configuracion`.

La comparación con el resultado oficial recorre **todos** los premios: estado, número, índice y digest de cada uno, y además `boletos_en_juego` y `excluidos`. También compara la aleatoriedad oficial con la de la ronda verificada. Cualquier diferencia se muestra por premio.

> El navegador no comprueba `drawConfigFrozenAt` contra la hora de la ronda: esa regla la aplica solo la API al sortear.

### 8.2 Página en vivo
- Comprueba el hash de configuración igual que la verificación.
- Calcula todos los ganadores en el navegador y luego anima los premios uno tras otro, cada uno sobre su propio bolillero. Un premio `VOID` se muestra como desierto y se pasa al siguiente.
- Con movimiento reducido (o duración 0) muestra directamente el resultado final.
- El resultado oficial coincide solo si coinciden estado, número, índice y digest de cada premio.

### 8.3 Correos de ganador
Un correo `WINNER` por premio ganado, con clave `<drawId>:prize:<posición>` (un comprador puede ganar varios premios en `TICKET_ONLY`). Asunto: "¡Ganaste el N.º premio de …!".

### 8.4 Sorteo en vivo sincronizado (modalidad `MANUAL`, DT-23)
En la modalidad `MANUAL` el ritmo del espectáculo lo marca el servidor, no el navegador del operador. Decisión completa: [DECISIONES-TECNICAS-RIFAS.md, DT-23](DECISIONES-TECNICAS-RIFAS.md).

**Orden fijo: primero el sorteo, después el espectáculo.**
1. El operador pulsa "▶ Iniciar sorteo" (`POST /api/admin/rifas/:id/en-vivo/iniciar`). La API ejecuta y registra el sorteo oficial con el mismo caso de uso del job (v1 o v2 según la cantidad de premios) y recién entonces crea la sesión en el paso 0. Si el sorteo se rechaza, no hay sesión y el error se muestra al operador.
2. Cada clic siguiente (`POST .../en-vivo/avanzar` con `{ "paso_esperado": n }`) revela un paso más. Un paso repetido o desactualizado responde 409 `LIVE_DRAW_STEP_CONFLICT` y la pantalla se resincroniza.
3. "⏭ Revelar todo y finalizar" (`POST .../en-vivo/finalizar`) muestra lo que falte. "⚡ Reproducir en automático" avanza paso a paso con un temporizador del navegador del operador.

**Pasos.** Se recorren los premios por posición. Un premio ganado aporta un paso por extracción (sus intentos al agua y el ganador); un premio desierto aporta un paso que lo muestra como "Desierto". La pausa entre premios no es un paso: el clic "▶ Sortear Premio K — título" revela el intento 1 del premio K.

| Premios | Intento ganador | Estados | Pasos |
|---|---|---|---|
| 1 | 1 | `WON` | 1 |
| 1 | 3 | `WON` | 3 |
| 2 | 3 | `WON`, `WON` | 6 |
| 3 | 2 | `WON`, `WON`, `VOID` | 5 |

**Lo que ve el público.** La página consulta `GET /api/rifas/:id/en-vivo` cada ~1 s (caché `max-age=1`) y anima hasta `sesion_en_vivo.paso`. Quien llega tarde ve al instante lo ya revelado y continúa en vivo. Mientras la sesión sigue en curso, `resultado.ganadores` solo trae los premios ya revelados por completo; al finalizar trae todos y el navegador compara cada premio (estado, número, índice y digest) con su propio cálculo.

> La semilla y la ronda drand son públicas desde el sorteo, así que un usuario técnico puede calcular todos los ganadores antes de que se revelen. Es inherente al sorteo verificable y no es una filtración: la sesión solo pausa el espectáculo; el resultado ya está grabado y no puede cambiar.

Las rifas `AUTOMATIC` no usan sesión: el job las sortea y cada navegador las anima a su ritmo.

---

## 9. API de administración

| Método y ruta | Campos nuevos | Reglas |
|---|---|---|
| `POST /api/admin/rifas` | `premios[]` (`titulo`, `descripcion`, `imagenes`), `modo_exclusion_ganador` (por defecto `TICKET_ONLY`) | Exige `premio` (heredado) o `premios`. 1 a 20 premios, hasta 10 imágenes cada uno. |
| `PATCH /api/admin/rifas/:id` | `premios[]`, `modo_exclusion_ganador` | Solo `DRAFT`. `premios` reemplaza la lista completa; no se combina con `premio`, `descripcion_premio` ni `imagenes_premio`. |
| `PATCH /api/admin/rifas/:id/modo-exclusion` | `{ "modo_exclusion_ganador": "TICKET_ONLY" \| "BUYER" }` | `DRAFT`, o `ACTIVE` antes de `salesCloseAt`. Fuera de eso: 409 (`SALES_CLOSED` o `INVALID_RAFFLE_TRANSITION`). Auditado con el operador de la sesión. Enviar el mismo modo no escribe nada. |

El panel (`/admin`) incluye un editor de lista de premios y un selector de modo que se bloquea al cerrar ventas.

---

## 10. Eventos de auditoría y rechazos

| Evento / motivo | Cuándo |
|---|---|
| `WINNER_EXCLUSION_MODE_CHANGED` | Cambio de modo vía `modo-exclusion` (`from`, `to`, `status`, `operatorId`). |
| `SALES_CLOSED` | Incluye `drawConfigHash`, `drawConfigFrozenAt`, `winnerExclusionMode`, `prizeCount`. |
| `DRAW_EXECUTED` (v2) | Agrega `algorithmVersion`, `winnerExclusionMode`, `drawConfigHash` y `winners[]`. |
| `DRAW_REFUSED` / `DRAW_CONFIG_MISMATCH` | La configuración no da el hash congelado. |
| `DRAW_REFUSED` / `DRAW_CONFIG_FROZEN_LATE` | Configuración congelada en o después de la publicación de la ronda. |
| `DRAW_REFUSED` / `WINNING_TICKET_WITHOUT_ORDER` | En v2 agrega `prizePosition`. |
| `DRAW_REFUSED` / `DRAW_CONFIG_MISSING` | Rifa v2 que llegó al sorteo sin `drawConfigHash`. |
| `RAFFLE_CANCELLED_REFUSED_DRAW` | Cancelación con reembolso total de una rifa rechazada por configuración (`refusalReason`, `refusedAt`, `operatorId`, `reason`, `paidOrdersCount`, `ordersInReview`). |

Procedimiento de respuesta: [RUNBOOK-RIFAS.md §3.4](RUNBOOK-RIFAS.md).

---

## 11. Limitaciones conocidas y temas abiertos

- **Aviso a compradores (pregunta de producto abierta):** si el modo cambia mientras la rifa está `ACTIVE`, no se notifica a quienes ya pagaron. Solo queda la auditoría y la diferencia entre el correo de pago y la página de verificación.
- **Correo sin hash:** el ancla del correo es el modo vigente al pagar, no `drawConfigHash` (§5.1).
- **Rifa rechazada por configuración (resuelto, DT-21 punto 7):** una rifa v2 rechazada por `DRAW_CONFIG_FROZEN_LATE`, `DRAW_CONFIG_MISMATCH` o `DRAW_CONFIG_MISSING` queda `CLOSED` con `DRAW_BLOCKED` hasta que un operador la cancela con reembolso total (`POST /api/admin/rifas/:id/cancelar-sorteo-rechazado`, botón "Cancelar y reembolsar" del detalle de la rifa). No se reprograma a otra ronda. **Costo aceptado:** con la lista intacta, ningún comprador gana los premios. El detalle de administración expone `sorteo_rechazado: { motivo, fecha }` mientras la rifa sigue `CLOSED`; la página pública muestra la rifa cancelada igual que cualquier otra cancelación, sin el motivo del operador.
- **Pruebas de integración dependientes del orden:** 2 pruebas de `describe('stuck jobs')` en `tiendi-rifas-api/test/jobs.integration-spec.ts` fallan al correr la suite completa. También fallan en el commit anterior (`5c285f3`), así que no las introdujo este cambio.
- **Sorteo en vivo (resuelto, DT-23):** el sorteo manual con varios premios quedaba detenido en la pausa entre premios y nunca pedía el sorteo oficial. Ahora el sorteo se registra al iniciar la sesión en vivo y cada paso lo revela el servidor (§8.4). Migración `20261121000000_live_draw_session`.
- **Migraciones:** `20261117000000_multi_prize_raffles` y `20261118000000_draw_config_integrity_guards`. La segunda redefine funciones de la primera sin modificarla. `20261119000000_cancel_refused_draw` agrega `trg_raffle_closed_exit`: una rifa `CLOSED` solo pasa a `DRAWN` o a `CANCELLED` con motivo.
