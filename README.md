# BuenPlan

Catálogo para clientes de descuentos y beneficios. Incluye interfaz responsive, API REST y persistencia SQLite, sin dependencias npm externas.

## Requisitos

- Node.js 22.5 o superior con `node:sqlite` (Node.js 26 recomendado).

## Ejecutar

```powershell
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Para desarrollo con reinicio automático:

```powershell
npm run dev
```

El catálogo inicial se inserta automáticamente y la base de datos se crea en `data/buenplan.db`. El puerto puede cambiarse con la variable de entorno `PORT`.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Estado del servidor y la base de datos |
| `GET` | `/api/offers` | Lista beneficios; acepta `category` y `search` |
| `GET` | `/api/offers/categories` | Categorías disponibles y cantidad de ofertas |
| `GET` | `/api/users/current` | Perfil local activo (`mocab`) |
| `GET` | `/api/redemptions` | Canjes asociados al usuario activo |
| `POST` | `/api/redemptions` | Genera y persiste un código asociado al usuario activo |
| `GET` | `/api/stats` | Cantidad de ofertas y canjes registrados |

Ejemplo de canje:

```json
{
  "offerId": "laurel-cafe"
}
```

La interfaz conserva los códigos de canje en el navegador para consultarlos después en “Mis canjes”. El perfil local `mocab` es una identidad de desarrollo; no tiene contraseña ni autentica sesiones.

## Preparar Supabase

La app todavía no está conectada a un proyecto Supabase. `supabase/schema.sql` crea una tabla `profiles` ligada a `auth.users` y activa políticas RLS para que cada usuario solo lea y actualice su perfil. Primero crea el usuario en Supabase Auth y luego registra su UUID:

```sql
insert into public.profiles (id, username, display_name)
values ('UUID-DE-AUTH-USERS', 'mocab', 'Mocab');
```

Después configura las credenciales del proyecto y reemplaza el perfil local por la sesión autenticada; no coloques una clave `service_role` en el frontend.