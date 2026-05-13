# Bitácora de Cambios — QR App

> Fecha: 12-05-2026

---

## Sidebar (`app-sidebar.tsx`)

- **Rediseño completo**: header compacto con gradiente por rol (rosa admin, azul operativo, esmeralda bufete), badge de rol inline
- **Colapsable**: botón de colapso en la **parte superior** del sidebar (esquina derecha), no en el medio
- **Estado colapsado**: solo iconos visibles, textos ocultos con `group-data-[collapsible=icon]:hidden`
- **Items limpios**: sin bordes, sin sombras, sin badges redundantes
- **Active state**: barra lateral izquierda de 3px + icono resaltado
- **Footer simplificado**: nombre, ID, label del rol. Hover rojo para logout
- **Logout**: `AlertDialog` de shadcn en vez de modal custom
- **Navegación**: usa `usePathname()` y `router.push()` (ya no recibe props)
- **Iconos con color**: cada item del sidebar tiene su propio color (`iconColor`) — Inicio verde, Escanear azul, Control Acceso ámbar, Inventario naranja, Bufetes esmeralda, Mesas cian, Control platos violeta, Usuarios rosa, Base de Datos índigo

### Iconos nuevos en sidebar
| Item | Icono |
|---|---|
| Control de Acceso | `DoorOpen` |
| Control Mesas | `Table` |
| Inventario de Platos | `Package` |
| Estado de Mesas | `Eye` |

### Items agregados (desde merge remoto)
- "Inventario de Platos" (`/dashboard/inventario`)
- "Estado de Mesas" (`/dashboard/bufetes`, solo operativo)

---

## Topbar (`spa-dashboard.tsx` + `dashboard-layout.tsx`)

- **PC**: logo `logo.webp` + nombre de vista + avatar con dropdown para cambiar rol y cerrar sesión
- **Móvil**: logo + nombre de vista + subtítulo "Uparsistem · Control de Acceso" + badge de rol + avatar con dropdown
- **Cambio de roles**: desde cualquier vista, el popover incluye opción de cambiar rol (si el usuario tiene varios) y redirige automáticamente a la página correspondiente (admin → `/dashboard`, operativo/bufete → `/dashboard/escanear`)
- Determinación del título/icono por `usePathname()` y un `viewConfig`

---

## Bottom Nav Móvil (`mobile-bottom-nav.tsx`)

- Barra fija inferior con fondo verde suave (`bg-uparsistem-50/90`), solo visible en `< md`
- **4 tabs principales** + botón **"Más"** con `ChevronDown`
- Iconos con colores (mismos que sidebar)
- Al tocar "Más" se expande una **segunda fila** con el resto de opciones

---

## SPA → Navegación Real

**Problema**: el botón "atrás" del navegador iba al login porque era SPA con vistas internas.

**Solución**: cada vista es ahora una URL real.

| Vista | URL |
|---|---|
| Inicio | `/dashboard` |
| Escanear | `/dashboard/escanear` |
| Control Acceso | `/dashboard/control-acceso` |
| Inventario | `/dashboard/inventario` |
| Bufetes | `/dashboard/bufetes` |
| Control Mesas | `/dashboard/control-bufetes` |
| Usuarios | `/dashboard/usuarios` |
| Base Datos | `/dashboard/base-datos` |

- `AppSidebar` y `MobileBottomNav` ya no reciben props
- `DashboardLayout` unificado: usado por todas las páginas hijas

---

## Validación de Documentos

### Scanners
- **Longitud**: 3 a 10 caracteres (manual), 7-10 solo numérico (escaneo directo)
- **Aplica a**: escaneo QR directo + ingreso manual
- **NO aplica a**: URLs de Q10 (scraping)
- Validación duplicada en `processScanResult` y en handlers de Enter/click

### API Scraping Q10 (`app/api/scrape-page/route.ts`)
- Regex cambiado: `\d{8,11}` → `\d{3,11}`
- Validación cambiada: `>= 8 && <= 11` → `>= 3 && <= 11`

---

## Pantalla de Inicio (`/dashboard`)

### Banner de bienvenida (`dashboard-stats.tsx`)
- Banner con gradiente verde suave (`from-uparsistem-50/80`), avatar con inicial, saludo "Hola, {nombre}" resaltado, badge "Tiempo real"
- El `userName` se pasa desde `spa-dashboard.tsx` usando `fullName` del hook `useAuth()`

### KPIs principales (6 cards)
- Rediseñados como tarjetas con gradiente suave profesional
- Cada KPI tiene su color: Graduandos (azul), Accesos (verde Uparsistem), Denegados (rojo), Espera (ámbar), Mesas (cian), Comidas (violeta)
- Layout compacto responsive `grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`

### Usuario Más Activo
- Muestra el #1 usuario con nombre, rol, accedidos/denegados, badge verde
- Diseño compacto con barra lateral accentada

### Historial por Usuario
- Admin/Operativo en azul, Bufete en violeta
- Items compactos con icono, nombre, rol, accedidos/denegados

### Acceso por roles
- Solo administradores pueden ver `/dashboard`
- Redirección automática a `/dashboard/escanear` si no eres admin
- Al cambiar de rol, redirige según el nuevo rol

---

## Escáner (`/dashboard/escanear`)

- **Rediseño profesional**: header con avatar, título según rol, selector de modo QR/Manual en móvil
- **Escáner**: viewfinder con esquineros verdes Uparsistem, línea de scan con glow, barra de estado inferior
- **Modo manual**: panel lateral en desktop, pantalla completa en móvil
- **Modal de resultados**: diseño con header de color (verde éxito, ámbar ya registrado, rojo error)
- Info del estudiante en grid compacto

---

## Control de Acceso (`/dashboard/control-acceso`)

- **Tabs de sección**: estilo pill con verde Uparsistem activo
- **KPIs**: 3 barras horizontales compactas (Concedidos, Denegados, Espera) con colores y hover
- **Search bar**: integrada con icono, siempre visible
- **Lista de personas**: items con barra accentada izquierda (verde/rojo/ámbar), nombre completo, programa en badge verde, ID en negrita negro, puesto en esquina superior derecha destacado, badges de estado apilados verticalmente
- **Checkbox "Seleccionar todos"** en la cabecera para autorización masiva
- **Paginación compacta** con botones ghost

---

## Inventario (`/dashboard/inventario`)

### Página (`inventario/page.tsx`)
- Header profesional con icono Package con gradiente verde

### Componente (`meal-inventory-management.tsx`)
- **KPIs globales**: 3 barras horizontales con gradiente suave (azul, rojo, verde/naranja), sin iconos
- **Barra de disponibilidad**: barra segmentada con niveles de 25%, colores verde/amarillo/rojo según stock
- **Inventario por mesa**: KPIs compactos (azul, rojo, esmeralda), cards de mesa con línea accentada superior
- **Cards de mesa**: verde si activa, gris si inactiva, naranja si stock bajo. Sin badge de activo/inactivo (el color lo indica)
- **Progreso por mesa**: barras segmentadas con 3 colores según disponibilidad
- **Botón "+ Nueva Mesa"**: estilo outline verde con hover sólido
- **Modal de confirmación**: AlertDialog para eliminar mesa con detalle de comidas
- **Todos los modales**: borde superior verde, inputs con borde verde, botón principal verde
- **Botón "Agregar"** en cada mesa: mismo estilo outline verde

---

## Base de Datos (`/dashboard/base-datos`)

### Página (`base-datos/page.tsx`)
- Header profesional con icono Database con gradiente verde

### Componente (`database-management.tsx`)
- **Tabs Estudiantes/Invitados**: estilo pill verde Uparsistem
- **KPIs Estudiantes**: 4 cards con gradiente (azul, violeta, ámbar, esmeralda) — compactos `p-2 md:p-3`
- **KPIs Invitados**: 3 cards con gradiente (azul, ámbar, violeta)
- **Acciones**: botones compactos `h-8 md:h-9` con colores por tipo (verde importar, ámbar cupos, rojo eliminar, teal bufetes)
- **Filtros**: selects apilados verticalmente en móvil (`flex-col md:flex-row`), programa con `break-words` para textos largos
- **Lista estudiantes**: items compactos con avatar, nombre, ID en negrita grande, puesto destacado arriba a la derecha, programa completo abajo, badges de cupos a la derecha
- **Lista invitados**: mismo estilo compacto, badges "Invitado", "1 cupo", consumidos
- **Paginación compacta** con botones ghost tamaño `size-7 md:size-8`
- **Overflow controlado**: `w-full min-w-0 overflow-hidden` en el contenedor principal

---

## Usuarios (`/dashboard/usuarios`)

### Página (`usuarios/page.tsx`)
- Header profesional con icono Users con gradiente verde

### Componente (`user-management.tsx`)
- Lista compacta con avatar, nombre, ID, roles como badges, botones editar/eliminar
- Mismo estilo de item que database-management

---

## Control de Mesas (`/dashboard/control-bufetes`)

### Página
- Header profesional con icono Table con gradiente verde

---

## Colores Uparsistem

### Tailwind Config / globals.css
- Paleta `uparsistem` agregada al `@theme inline` en globals.css (Tailwind v4)
- Colores: 50→900, DEFAULT: `#286b04`
- Sidebar con tonos verdes vía OKLCH

---

## Diseño Responsive General

- **Mobile first**: padding `p-2 md:p-6`, gap `gap-1 md:gap-4`, texto `text-[10px] md:text-base`
- **Cards compactas**: `p-1.5 md:p-3`, sin sombras en móvil (`shadow-sm md:shadow-sm`)
- **Selects**: `w-full` en móvil, `w-auto` en desktop, con `overflow-x-auto` cuando es necesario
- **Overflow**: `w-full min-w-0 overflow-hidden` en contenedores principales
- **Paginación**: botones `ghost` tamaño `size-7 md:size-8`

---

## Fixes

- **Build fix**: creado `scripts/create-admin.ts` (luego eliminado junto con `app/setup/page.tsx`)
- **Inventario sin sidebar**: agregado `DashboardLayout` a `app/dashboard/inventario/page.tsx`
- **Next.js actualizado**: `15.2.4` → `15.5.18` (parche de seguridad)
- **Conflictos de merge resueltos**: combinados cambios remotos con rediseño local
- **Error `promedioCupos`**: variable no definida, se agregó cálculo y se reemplazó por "Bufetes Disponibles"
- **Código duplicado**: limpieza de fragmentos antiguos en `database-management.tsx` y `user-management.tsx`

---

## Pendientes

- [ ] Validar que `estado-mesas` tenga ruta propia
- [ ] Revisar `firestore.rules` (están expiradas desde julio 2025)
