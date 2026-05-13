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

- **PC**: solo icono + nombre de vista. Sin `SidebarTrigger`, sin breadcrumbs, sin separadores
- **Móvil**: icono con gradiente + nombre de vista + subtítulo "Uparsistem · Control de Acceso" a la izquierda, avatar con DropdownMenu (logout) a la derecha
- Determinación del título/icono por `usePathname()` y un `viewConfig`

---

## Bottom Nav Móvil (`mobile-bottom-nav.tsx`)

- Barra fija inferior con `backdrop-blur-xl`, solo visible en `< md`
- **4 tabs principales** + botón **"Más"** con `ChevronDown`
- Al tocar "Más" se expande una **segunda fila** con el resto de opciones (Usuarios, Datos, etc.)
- Sin popovers ni overlays
- Navega con `router.push()` a URLs reales

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

- `AppSidebar` y `MobileBottomNav` ya no reciben props (`currentView`, `onViewChange`)
- `SPADashboard` simplificado: solo renderiza `DashboardStats` para `/dashboard`
- `DashboardLayout` unificado: usado por todas las páginas hijas

---

## Validación de Documentos

### Scanners (`barcode-scanner.tsx`, `operativo-scanner.tsx`, `bufete-scanner.tsx`)
- **Longitud**: 3 a 10 caracteres
- **Aplica a**: escaneo QR directo + ingreso manual
- **NO aplica a**: URLs de Q10 (scraping)
- Feedback inmediato en inputs manuales sin abrir modal
- Validación duplicada en `processScanResult` y en handlers de Enter/click

### API Scraping Q10 (`app/api/scrape-page/route.ts`)
- Regex cambiado: `\d{8,11}` → `\d{3,11}`
- Validación cambiada: `>= 8 && <= 11` → `>= 3 && <= 11`

---

## Fixes

- **Build fix**: creado `scripts/create-admin.ts` (luego eliminado junto con `app/setup/page.tsx`)
- **Inventario sin sidebar**: agregado `DashboardLayout` a `app/dashboard/inventario/page.tsx`
- **Next.js actualizado**: `15.2.4` → `15.5.18` (parche de seguridad)
- **Conflictos de merge resueltos**: combinados cambios remotos (Inventario de Platos, Estado de Mesas, `table_meal_inventory`) con rediseño local
- **Archivos en conflicto**: `app-sidebar.tsx`, `spa-dashboard.tsx`, `mobile-bottom-nav.tsx`

---

## Próximos pasos potenciales

- [ ] Validar que `estado-mesas` tenga ruta propia (`/dashboard/estado-mesas`) en vez de compartir `/dashboard/bufetes`
- [ ] Mover los `useEffect` de Firestore (oyentes de bufetes, inventario) desde `spa-dashboard.tsx` a las páginas correspondientes
- [ ] Agregar `@types/qrcode` si da error de tipos
- [ ] Revisar `firestore.rules` (están expiradas desde julio 2025)
