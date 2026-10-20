# BuenPlan — Informe de entrega

Catálogo fullstack de descuentos y beneficios: interfaz web responsive, API REST y persistencia en SQLite.
Construido con **Node.js puro (sin dependencias npm)** y **frontend HTML/CSS/JS vanilla**.

---

## 1. Cómo ejecutar

```powershell
npm start          # producción
npm run dev        # desarrollo con reinicio automático (node --watch)
```

Abrir **http://localhost:3000**. Requisito: Node.js 22.5+ (`node:sqlite`); se probó con Node 26.
La base de datos se crea sola en `data/buenplan.db` y el catálogo inicial se siembra automáticamente.

---

## 2. Arquitectura

```
desarrolo-fullstack/
├── server.js            # Backend: HTTP server + API REST + SQLite (node:sqlite)
├── public/              # Frontend (estáticos servidos por el backend)
│   ├── buenplan.html    # Estructura: hero, catálogo, pasos, diálogo de canje
│   ├── buenplan.css     # Diseño responsive, tipografías DM Sans / DM Serif
│   └── buenplan.js      # Lógica: fetch a la API, filtros, vistas, canjes
├── data/buenplan.db     # SQLite (se genera automáticamente)
├── supabase/schema.sql  # Esquema listo para conectar Supabase (pendiente)
├── package.json         # Scripts start/dev, engines node >= 22.5
├── README.md            # Instrucciones y referencia de API
└── INFORME.md           # Este documento
```

**Patrón:** el navegador consume la API en `/api/*` mediante `fetch`; el servidor sirve los estáticos y responde JSON, con la base de datos SQLite como única capa de persistencia.

---

## 3. Base de datos (SQLite)

| Tabla | Campos clave | Función |
| --- | --- | --- |
| `offers` | `id`, `brand`, `title`, `category`, `discount_label`, `terms`, `image_url`, `expires_at`, `featured`, `active` | Catálogo de beneficios (10 semillas) |
| `users` | `id`, `username`, `display_name` | Perfil activo (`mocab`) |
| `redemptions` | `id`, `offer_id` → offers, `user_id` → users, `code` único, `created_at` | Canjes generados (FK activas) |
| `tasks` | `title`, `priority`, `due_date`, `completed`… | API auxiliar de tareas (CRUD completo) |

Configuración: `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, inserción idempotente (`INSERT OR IGNORE`) y migración de columnas si la tabla existe de una versión anterior.

---

## 4. API REST

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Estado del servidor y la BD | ✅ |
| `GET` | `/api/offers` | Beneficios; acepta `category` y `search` (sin distinción de acentos ni mayúsculas) | ✅ |
| `GET` | `/api/offers/categories` | Categorías con su cantidad de ofertas | ✅ |
| `GET` | `/api/users/current` | Perfil activo | ✅ |
| `GET` | `/api/redemptions` | Canjes del usuario activo (con datos de la oferta) | ✅ |
| `POST` | `/api/redemptions` | Genera código `BP-XXXXXX` y lo persiste | ✅ |
| `GET` | `/api/stats` | Ofertas y canjes registrados | ✅ |
| `GET/POST/PATCH/DELETE` | `/api/tasks[/:id]` | CRUD auxiliar de tareas con validaciones (prioridad, fecha, longitud) | ✅ |

**Errores:** 400 (JSON inválido / validaciones), 404 (ruta, recurso o beneficio inactivo), 413 (cuerpo > 1 MB), 405, 500. Siempre JSON con `{ "error": "…" }`.

**Seguridad:** sin dependencias externas, escapes de SQL por consulta preparada (`@param`), escape de comodines `LIKE` (`%`, `_`), validación de rutas estáticas contra *path traversal* (`403` fuera de `public/`) y HTML escapado en el frontend (`escapeHtml`).

Ejemplo de canje:

```http
POST /api/redemptions
{ "offerId": "laurel-cafe" }

201 { "id": 6, "offerId": "laurel-cafe", "userId": "mocab", "code": "BP-9F2C11", ... }
```

---

## 5. Frontend

- **Vista Descubrir:** hero con imagen, datos rápidos (10 beneficios / 5 categorías), grid de tarjetas con badge de descuento y sello FAVORITO.
- **Filtros:** chips por categoría con contador + buscador con debounce (180 ms) y atajo de teclado `/`.
- **Detalle de beneficio:** diálogo modal (`<dialog>`) con imagen, condiciones, vigencia y botón para obtener el código.
- **Código de canje:** se muestra con opción *Copiar* (clipboard) y se guarda en el dispositivo.
- **Mis canjes:** vista con los códigos activados y contador en el menú.
- **Cómo funciona:** sección de 3 pasos (Encuentra / Activa / Disfruta).
- **Responsive:** menú hamburguesa para móvil, grid adaptable y tipografías DM Sans / DM Serif Display.
- **Accesibilidad:** `aria-live` en resultados, `aria-busy` durante la carga, `aria-expanded` en el menú, foco visible y navegación por teclado.
- **Sin errores de consola:** el DOM renderizado confirma 10 tarjetas, 6 chips y estadísticas cargadas.

---

## 6. Pruebas realizadas ( QA )

| Prueba | Resultado |
| --- | --- |
| Todas las rutas GET de la API | ✅ 200 |
| `POST /api/redemptions` (canje real) | ✅ 201 con código |
| Filtro por categoría (`?category=Gastronomía`) | ✅ 3 ofertas |
| Búsqueda sin acento: `search=cafe` | ✅ encuentra *Café Laurel* |
| Búsqueda en mayúsculas: `search=CAFÉ` | ✅ funciona |
| Comodín `search=%` (inyección LIKE) | ✅ escapado, 0 resultados |
| Búsqueda sin resultados | ✅ estado vacío |
| Estáticos `/`, `/buenplan.css`, `/buenplan.js` | ✅ MIME correctos |
| Ruta inexistente y API desconocida | ✅ 404 |
| Render del frontend (DOM headless) | ✅ 10 tarjetas, 6 chips |
| CSS con llaves balanceadas | ✅ 251 / 251 |

---

## 7. Pendiente / evolución

- **Supabase:** `supabase/schema.sql` crea la tabla `profiles` ligada a `auth.users` con RLS. Falta crear el usuario en Supabase Auth, registrar su UUID y reemplazar el perfil local `mocab` por la sesión autenticada (no exponer la clave `service_role` en el frontend).
- El perfil `mocab` es una identidad de desarrollo: no tiene contraseña ni autentica sesiones.
