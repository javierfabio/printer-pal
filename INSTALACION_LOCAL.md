# Instalación Local / Migración de PrintControl

Esta guía explica cómo restaurar un **backup SQL portable** generado desde
Configuraciones → Migración / Backup de Datos → "Backup SQL portable", ya sea
en un proyecto Supabase nuevo o en una instalación local con PostgreSQL +
Supabase CLI.

## Requisitos

- Node.js 18+
- Supabase CLI (recomendado): `npm install -g supabase`
- PostgreSQL 15+ (incluido si usás Supabase local)

## Opción A — Restaurar en un proyecto Supabase nuevo (cloud)

1. Crear el proyecto en https://supabase.com/dashboard.
2. Clonar este repo y aplicar todas las migraciones:
   ```bash
   supabase link --project-ref <NUEVO_REF>
   supabase db push
   ```
3. En **Authentication → Users**, crear manualmente cada usuario con el
   mismo email que figura en el bloque `MAPA DE USUARIOS` del archivo
   `printcontrol_backup_*.sql`. Anotá el nuevo UUID que asigna Supabase.
4. En el archivo SQL, hacer **Find & Replace** del UUID viejo por el nuevo
   en todas las columnas que referencian usuarios:
   - `profiles.user_id`
   - `user_roles.user_id`
   - `user_permissions.user_id`
   - `lecturas_contadores.registrado_por`
   - `piezas_impresora.instalado_por`
   - `historial_piezas.*_por`
   - `historial_cambios.usuario_id`
   - `movimientos_stock.registrado_por`
5. Ejecutar el SQL:
   ```bash
   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" < printcontrol_backup_2026-06-01.sql
   ```
6. Configurar `.env` con la URL y anon key del nuevo proyecto y levantar
   la app: `npm install && npm run dev`.

## Opción B — Supabase local (desarrollo)

1. Inicializar y levantar Supabase local:
   ```bash
   supabase init
   supabase start
   ```
2. Aplicar las migraciones del repo:
   ```bash
   supabase db reset
   ```
3. Crear los usuarios desde el dashboard local (`http://localhost:54323`).
4. Reemplazar UUIDs en el `.sql` como en la Opción A, paso 4.
5. Restaurar:
   ```bash
   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
     < printcontrol_backup_2026-06-01.sql
   ```
6. Configurar `.env.local`:
   ```
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key_de_supabase_status>
   ```
7. `npm install && npm run dev`.

## Notas

- El backup SQL **no incluye** filas de `auth.users` (las gestiona Supabase
  Auth). Por eso hay que recrear los usuarios manualmente y reasignar UUIDs.
- El archivo se ejecuta dentro de un `BEGIN; ... COMMIT;`, así que si algo
  falla la base queda como estaba.
- El backup `TRUNCATE` todas las tablas del sistema antes de insertar.
  **No lo corras contra una base con datos que quieras conservar.**
- Si agregaste tablas nuevas, actualizá la constante `SQL_BACKUP_TABLES`
  en `src/pages/Configuraciones.tsx`.