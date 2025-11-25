# Diagramas de Secuencia - Autenticación - Sistema Tiendi

Este documento contiene los diagramas de secuencia relacionados con la autenticación de usuarios.

---

## 1. Secuencia de Login con Email/Password

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Redis as Redis Cache
    participant Client as Cliente

    User->>Web: Ingresa credenciales
    Web->>Web: Validación frontend
    Web->>Gateway: POST /auth/login<br/>{email, password}
    Gateway->>Auth: Forward request
    Auth->>UserDB: SELECT user WHERE email=?
    UserDB-->>Auth: User data

    alt Usuario no existe
        Auth-->>Gateway: 404 Not Found
        Gateway-->>Web: Error: Usuario no encontrado
        Web-->>User: Mostrar error
    else Usuario existe
        Auth->>Auth: Verificar password hash
        alt Password incorrecto
            Auth-->>Gateway: 401 Unauthorized
            Gateway-->>Web: Error: Contraseña incorrecta
            Web-->>User: Mostrar error
        else Password correcto
            Auth->>Auth: Generar JWT token
            Auth->>Auth: Generar refresh token
            Auth->>Redis: SET session:{userId}<br/>TTL: 24h
            Auth-->>Gateway: 200 OK<br/>{token, refreshToken, user}
            Gateway-->>Web: Success response
            Web->>Web: Guardar token en localStorage
            Web->>Web: Actualizar estado global
            Web-->>User: Redirigir a Home
        end
    end
```

---

## 2. Secuencia de Login con Google OAuth

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Google as Google OAuth
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Redis as Redis Cache

    User->>Web: Click "Iniciar con Google"
    Web->>Google: Redirect a Google OAuth
    User->>Google: Autorizar aplicación
    Google-->>Web: Redirect con auth code
    Web->>Gateway: POST /auth/google<br/>{authCode}
    Gateway->>Auth: Forward request
    Auth->>Google: Exchange code for token
    Google-->>Auth: Access token + user info
    Auth->>Auth: Extraer datos de usuario
    Auth->>UserDB: SELECT user WHERE email=?
    UserDB-->>Auth: Check if exists

    alt Usuario no existe
        Auth->>UserDB: INSERT new user
        UserDB-->>Auth: User created
    end

    Auth->>Auth: Generar JWT token
    Auth->>Redis: SET session:{userId}
    Auth-->>Gateway: 200 OK<br/>{token, user}
    Gateway-->>Web: Success response
    Web->>Web: Guardar token
    Web-->>User: Redirigir a Home
```

---

## 3. Secuencia de Login con Facebook OAuth

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Facebook as Facebook OAuth
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Redis as Redis Cache

    User->>Web: Click "Iniciar con Facebook"
    Web->>Facebook: Redirect a Facebook OAuth
    User->>Facebook: Autorizar aplicación
    Facebook-->>Web: Redirect con auth code
    Web->>Gateway: POST /auth/facebook<br/>{authCode}
    Gateway->>Auth: Forward request
    Auth->>Facebook: Exchange code for token
    Facebook-->>Auth: Access token + user info
    Auth->>Auth: Extraer datos de usuario<br/>(email, nombre, foto)
    Auth->>UserDB: SELECT user WHERE email=?
    UserDB-->>Auth: Check if exists

    alt Usuario no existe
        Auth->>UserDB: INSERT new user<br/>(from Facebook data)
        UserDB-->>Auth: User created
    end

    Auth->>Auth: Generar JWT token
    Auth->>Auth: Generar refresh token
    Auth->>Redis: SET session:{userId}<br/>TTL: 24h
    Auth-->>Gateway: 200 OK<br/>{token, refreshToken, user}
    Gateway-->>Web: Success response
    Web->>Web: Guardar token en localStorage
    Web->>Web: Actualizar estado global
    Web-->>User: Redirigir a Home
```

---

## 4. Secuencia de Registro de Usuario

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Email as Email Service
    participant Redis as Redis Cache

    User->>Web: Rellenar formulario de registro
    Web->>Web: Validación frontend
    Web->>Gateway: POST /auth/register<br/>{userData}
    Gateway->>Auth: Forward request

    Auth->>Auth: Validar datos
    Auth->>UserDB: SELECT WHERE email=?
    UserDB-->>Auth: Check email exists

    alt Email ya existe
        Auth-->>Gateway: 409 Conflict
        Gateway-->>Web: Error: Email ya registrado
        Web-->>User: Mostrar error
    else Email disponible
        Auth->>Auth: Hash password (bcrypt)
        Auth->>UserDB: INSERT new user
        UserDB-->>Auth: User created

        par Generación de sesión
            Auth->>Auth: Generar JWT token
            Auth->>Redis: SET session:{userId}
        and Envío de email
            Auth->>Email: Send welcome email
            Email-->>User: Email de bienvenida
        end

        Auth-->>Gateway: 201 Created<br/>{token, user}
        Gateway-->>Web: Success response
        Web->>Web: Guardar token
        Web->>Web: Actualizar estado global
        Web-->>User: Redirigir a Home
    end
```

---

## 5. Secuencia de Refresh Token

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Redis as Redis Cache

    User->>Web: Realizar acción (token expirado)
    Web->>Gateway: GET /api/products<br/>Authorization: Bearer {expiredToken}
    Gateway->>Gateway: Verificar token
    Gateway-->>Web: 401 Unauthorized<br/>Token expired

    Web->>Web: Detectar token expirado
    Web->>Gateway: POST /auth/refresh<br/>{refreshToken}
    Gateway->>Auth: Refresh token request

    Auth->>Redis: GET refresh:{refreshToken}
    Redis-->>Auth: User ID or null

    alt Refresh token inválido/expirado
        Auth-->>Gateway: 401 Unauthorized
        Gateway-->>Web: Refresh failed
        Web->>Web: Limpiar sesión local
        Web-->>User: Redirigir a Login
    else Refresh token válido
        Auth->>Auth: Generar nuevo JWT token
        Auth->>Auth: Generar nuevo refresh token
        Auth->>Redis: DEL refresh:{oldToken}
        Auth->>Redis: SET refresh:{newToken}<br/>TTL: 30 days
        Auth->>Redis: SET session:{userId}<br/>TTL: 24h
        Auth-->>Gateway: 200 OK<br/>{token, refreshToken}
        Gateway-->>Web: New tokens
        Web->>Web: Actualizar tokens en storage
        Web->>Gateway: Retry original request<br/>Authorization: Bearer {newToken}
        Gateway-->>Web: Success response
        Web-->>User: Continuar navegación
    end
```

---

## 6. Secuencia de Logout

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant Redis as Redis Cache

    User->>Web: Click en "Cerrar sesión"
    Web->>Gateway: POST /auth/logout<br/>Authorization: Bearer {token}
    Gateway->>Auth: Logout request

    Auth->>Auth: Extraer userId del token
    Auth->>Redis: DEL session:{userId}
    Auth->>Redis: DEL refresh:{refreshToken}

    alt Blacklist token (opcional)
        Auth->>Redis: SET blacklist:{token}<br/>TTL: token.exp - now
    end

    Auth-->>Gateway: 200 OK
    Gateway-->>Web: Logout successful

    Web->>Web: Limpiar localStorage
    Web->>Web: Limpiar Redux store
    Web->>Web: Limpiar cookies
    Web-->>User: Redirigir a Home (no autenticado)
```

---

## 7. Secuencia de Recuperación de Contraseña

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Email as Email Service
    participant Redis as Redis Cache

    User->>Web: Click "Olvidé mi contraseña"
    Web-->>User: Formulario email
    User->>Web: Ingresar email
    Web->>Gateway: POST /auth/forgot-password<br/>{email}
    Gateway->>Auth: Forward request

    Auth->>UserDB: SELECT user WHERE email=?
    UserDB-->>Auth: User data or null

    alt Usuario no existe
        Note over Auth: Por seguridad, responder igual
        Auth-->>Gateway: 200 OK
        Gateway-->>Web: Email enviado (fake)
        Web-->>User: "Revisa tu email"
    else Usuario existe
        Auth->>Auth: Generar reset token (UUID)
        Auth->>Redis: SET reset:{token}<br/>{userId, email}<br/>TTL: 1 hour
        Auth->>Email: Send reset email<br/>Link: /reset-password?token={token}
        Email-->>User: Email con link
        Auth-->>Gateway: 200 OK
        Gateway-->>Web: Email enviado
        Web-->>User: "Revisa tu email"
    end

    User->>Email: Click en link de reset
    Email->>Web: Redirect a /reset-password?token={token}
    Web-->>User: Formulario nueva contraseña

    User->>Web: Ingresar nueva contraseña
    Web->>Gateway: POST /auth/reset-password<br/>{token, newPassword}
    Gateway->>Auth: Reset password request

    Auth->>Redis: GET reset:{token}
    Redis-->>Auth: {userId, email} or null

    alt Token inválido/expirado
        Auth-->>Gateway: 400 Bad Request
        Gateway-->>Web: Token inválido
        Web-->>User: Mostrar error
    else Token válido
        Auth->>Auth: Hash nueva password
        Auth->>UserDB: UPDATE users<br/>SET password_hash=?<br/>WHERE id=?
        UserDB-->>Auth: Updated
        Auth->>Redis: DEL reset:{token}
        Auth->>Redis: DEL ALL sessions:{userId}
        Auth->>Email: Send confirmation email
        Auth-->>Gateway: 200 OK
        Gateway-->>Web: Password changed
        Web-->>User: Redirigir a Login
    end
```

---

## 8. Secuencia de Verificación de Email (Opcional)

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Auth as Auth Service
    participant UserDB as User DB
    participant Email as Email Service
    participant Redis as Redis Cache

    Note over User,Redis: Después del registro

    Auth->>Auth: Generar verification token
    Auth->>Redis: SET verify:{token}<br/>{userId, email}<br/>TTL: 24h
    Auth->>Email: Send verification email<br/>Link: /verify-email?token={token}
    Email-->>User: Email de verificación

    User->>Email: Click en link de verificación
    Email->>Web: Redirect a /verify-email?token={token}
    Web->>Gateway: POST /auth/verify-email<br/>{token}
    Gateway->>Auth: Verify email request

    Auth->>Redis: GET verify:{token}
    Redis-->>Auth: {userId, email} or null

    alt Token inválido/expirado
        Auth-->>Gateway: 400 Bad Request
        Gateway-->>Web: Token inválido
        Web-->>User: Mostrar error<br/>"Solicitar nuevo email"
    else Token válido
        Auth->>UserDB: UPDATE users<br/>SET email_verified=true<br/>WHERE id=?
        UserDB-->>Auth: Updated
        Auth->>Redis: DEL verify:{token}
        Auth-->>Gateway: 200 OK
        Gateway-->>Web: Email verified
        Web-->>User: Mostrar confirmación<br/>"Email verificado exitosamente"
    end
```

---

## Consideraciones de Seguridad

### Tokens JWT
```javascript
// Estructura del JWT payload
{
  "sub": "user-uuid-123",           // User ID
  "email": "user@example.com",
  "role": "customer",
  "iat": 1700000000,                // Issued at
  "exp": 1700086400                 // Expires (24h después)
}
```

### Password Hashing
```javascript
// Usar bcrypt con salt rounds adecuado
const bcrypt = require('bcrypt');
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### Rate Limiting
```javascript
// Limitar intentos de login
// 5 intentos por IP cada 15 minutos
{
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de login'
}
```

### Validaciones

1. **Email**: Formato válido, dominio existente
2. **Password**:
   - Mínimo 8 caracteres
   - Al menos 1 mayúscula
   - Al menos 1 minúscula
   - Al menos 1 número
   - Al menos 1 carácter especial
3. **Nombres**: Sin caracteres especiales maliciosos
4. **Documento**: Formato válido según tipo

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
