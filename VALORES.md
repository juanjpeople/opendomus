# 🏠 Refugiar: Valores y Lineamientos

> El sistema operativo de tu casa. Que vive en tu casa.

Antes que funciones, principios. Son la vara con la que medimos cada decisión del proyecto, de producto y de código.

Estos textos también se muestran en la landing (`/bienvenida`), que los toma de `src/app/bienvenida/_components/content.ts`. **Si cambiás uno, cambiá el otro.**

---

## 💡 Valores

### 1. Tu casa, tus datos
Todo vive en tu hardware: una NAS, una Raspberry, la compu de siempre. Sin nubes ajenas, sin telemetría, sin nadie mirando lo que pasa adentro.

### 2. Funciona sin internet
Offline-first de verdad. Si se corta la conexión, la casa sigue andando: la lista de compras, el inventario y las cuentas están siempre a mano.

### 3. Cuentas claras
Quién pagó qué, cuánto queda y en qué se fue. La transparencia evita discusiones y construye confianza entre los que comparten la casa.

### 4. Para todos los que viven acá
Del más chico al más grande. Cada perfil ve lo que necesita, con interfaces pensadas para cada edad y permisos que cuidan sin complicar.

### 5. Puertas abiertas
Código abierto y formatos abiertos. Exportás todo cuando quieras y te lo llevás a donde quieras. Si mañana el proyecto desaparece, tu casa sigue funcionando.

### 6. Tecnología tranquila
Una herramienta, no una app que compite por tu atención. Sin notificaciones de relleno, sin rachas, sin trucos: entrás, resolvés y te deja seguir con tu vida.

---

## 🧭 Lineamientos

Los valores bajados a reglas concretas. Si una decisión de producto o de código choca con alguna, gana la regla.

| Lineamiento | Qué significa |
| --- | --- |
| **Exportable, siempre** | Todo dato se puede exportar en formatos abiertos (JSON, CSV). Sin lock-in, sin excepciones. |
| **Nada sale sin permiso** | Cero telemetría por defecto. Cualquier conexión hacia afuera es opcional, explícita y reversible. |
| **Local primero, sync después** | La app escribe en el dispositivo y sincroniza cuando puede. Nunca se bloquea esperando la red. |
| **Módulos opcionales** | Cada casa usa lo que necesita. Activar o apagar un módulo no rompe al resto. |
| **Permisos por acción** | Se pregunta qué puede hacer cada persona, no quién es. Una sola política, en un solo lugar (`src/lib/auth/permissions.ts`). |
| **Para todas las edades** | Buen contraste, botones grandes y lenguaje simple. Si lo entiende un chico, lo entiende cualquiera. |
| **Sin patrones oscuros** | Nada de urgencias falsas ni avisos para retenerte. El sistema avisa solo lo que importa. |
| **Corre en lo que tengas** | Un contenedor en una NAS o una Raspberry. Si es difícil de instalar, es un bug. |

## 🔎 Transparencia verificable

La confianza no se apoya solo en promesas:

- la landing explica el recorrido conceptual de los datos sin publicar secretos operativos;
- el código y el historial de cambios son públicos;
- cada cambio pasa por tipos, tests, API, navegador y análisis automáticos de seguridad;
- las dependencias nuevas se revisan antes de entrar;
- existe un canal privado para reportar vulnerabilidades;
- los datos se pueden exportar y el modo local no depende del servicio.

CodeQL, Dependency Review, Dependabot y OpenSSF Scorecard dejan evidencia continua y
pública. Reducen riesgos, pero no se presentan como una certificación ni reemplazan una
auditoría de seguridad independiente.

---

## ✅ Antes de sumar una funcionalidad, preguntate

- ¿Funciona sin internet?
- ¿Los datos que genera se pueden exportar?
- ¿Manda algo fuera de la casa? Si es así, ¿el usuario lo pidió explícitamente?
- ¿Lo puede usar (o ver de forma segura) un chico?
- ¿Pide atención que no hace falta?

> Una casa no es un producto. Es la gente que vive adentro.
