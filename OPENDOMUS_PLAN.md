# 🏠 OpenDomus: Plan de Implementación y Estado Actual

Este documento consolida el plan de trabajo para OpenDomus y el progreso realizado, por si necesitas mover el proyecto a otro directorio o retomarlo más adelante.

---

## 🛠️ Arquitectura Definida (Offline-First & Self-Hosted)

*   **Frontend (Cliente):** Next.js configurado como **PWA (Progressive Web App)**.
*   **Base de Datos Local (Cliente):** **Dexie.js** (Wrapper de IndexedDB) para el manejo offline-first en el MVP.
*   **Backend / DB Servidor:** A definir para futuras fases (Node.js/Go + SQLite/PostgreSQL) para la sincronización.
*   **Despliegue:** Docker para hosting local en NAS o servidor.

---

## 🗺️ Roadmap: Fases de Desarrollo

### 📍 Fase 1: Los Cimientos y el Pañol (MVP)
1.  **Setup Base:** Configuración del proyecto web (PWA) y base de datos local.
2.  **Módulo de Inventarios (Core):** Creación de inventarios (Alacena, Taller) y operaciones (CRUD).
3.  **Motor de Compras (Básico):** Listas automáticas (por bajo stock) y manuales.

### 📍 Fase 2: Cuentas Claras y Economía
1.  Registro de Transacciones, orígenes de fondos.
2.  Panel de Transparencia (quién pagó qué, balances).
3.  Presupuestos y Metas.

### 📍 Fase 3: Proyectos, Préstamos y Roles
1.  Gestión de Usuarios y Roles (Admin vs Niños).
2.  Inventarios Temporales y módulo de préstamos de herramientas.
3.  Lector de Código de Barras/QR integrado en la app web.

### 📍 Fase 4: Hub Familiar y Bóveda
1.  Caja Fuerte Documental (PDFs, fotos, garantías).
2.  Chat Interno con notificaciones automáticas del sistema.

### 📍 Fase 5: Entretenimiento (NAS) y Preparación SaaS
1.  Integración NAS (Jellyfin/Plex).
2.  Modo Party (Streaming Sincronizado).
3.  Estructura Multitenant para SaaS público.

---

## 📝 Estado Actual

**Base del proyecto (Fase 1 – Setup Base):** lista. La referencia viva de convenciones es la página **`/design`** (solo Administrador): principios, tokens, componentes, formularios, tablas y permisos, con código de ejemplo.

- **UI:** Ant Design 6 (sin Tailwind) + íconos `lucide-react`. Colores y tamaños siempre desde tokens (`theme.useToken()`); modo claro/oscuro/sistema y color de marca configurables.
- **Sesión y permisos:** selector de perfiles ("¿Quién está usando?") y política RBAC única en `src/lib/auth/permissions.ts` (`can`, `assertCan`, `usePermission`, `<Can>`, `<RequirePermission>`). Fail-closed: sin sesión válida no se ve la app.
  - ⚠️ Mientras la app sea 100% cliente, los permisos son de experiencia, no de seguridad. La matriz se debe evaluar en el servidor cuando exista.
- **Datos:** Dexie (IndexedDB). Patrón por módulo en `src/features/<modulo>/`: `domain.ts` (tipos, reglas, validación) → `service.ts` (único que escribe + chequea permisos) → `hooks.ts` (lecturas reactivas y acciones para la UI) → `components/`.
- **Inventarios:** Alacena y Taller funcionando (alta con validación, +/- cantidad, baja con confirmación, estado de stock).
- **Layouts:** escritorio (menú lateral), mobile (Drawer) e infantil (más grande, solo lectura).

## 🚀 Próximos Pasos

1. **Lista de compras** (`/compras`): automática por stock bajo (`getStockStatus`) + manual, siguiendo el patrón de `features/inventory`.
2. **PWA:** manifest + service worker para instalar y usar offline.
3. **PIN por perfil** antes de pasar a autenticación real con backend.
4. **Tests:** unitarios de `domain.ts` y `permissions.ts` (lógica pura, fáciles de cubrir).

