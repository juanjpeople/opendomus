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

## 📝 Estado Actual (Lo que hicimos)

1. **Inicialización del Proyecto:** Se ejecutó `create-next-app` para crear la estructura base con TypeScript y TailwindCSS.
2. **Dependencias Core instaladas:** 
   - `dexie` y `dexie-react-hooks` (para la base de datos offline-first de la Fase 1).
   - `lucide-react` (para los iconos de la interfaz).
3. **Esquema de Base de Datos:** Se creó el archivo `src/lib/db.ts` con la configuración inicial de Dexie para los ítems del inventario y la lista de compras.
4. **Layout y Navegación:** Se creó un componente de navegación lateral/inferior (`src/components/Navigation.tsx`) y se integró en el `layout.tsx` principal.

## 🚀 Próximo Paso

Dado que hubo un error con la carpeta del proyecto, el próximo paso recomendado es:
1. Mover o recrear este proyecto en el directorio correcto.
2. Continuar con la **Fase 1**: Desarrollar la pantalla de "Alacena" y "Taller" (`src/app/alacena/page.tsx`) que consuma la base de datos local que armamos (`db.ts`) para poder agregar productos y ver la lista.
