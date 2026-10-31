# Explivio web app

The Explivio dashboard frontend: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 and Lucide icons. This milestone is the foundation: design tokens, reusable UI components, the app shell, and placeholder routes. Screens are built one by one in later milestones.

## Run it

```powershell
cd web
npm install
npm run dev        # http://localhost:3000
```

Checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Structure

```text
src/
  app/                    Routing only: root layout, global CSS, not-found
    (dashboard)/          Pages that share the sidebar shell
      page.tsx            /            Home
      create/             /create      Prompt entry
      configure/          /configure   Video settings
      generating/         /generating  Generation progress
      videos/             /videos      My Videos
      videos/[id]/        /videos/:id  Video details and preview
      settings/           /settings    Preferences
  components/
    ui/                   Primitives: Button, IconButton, Card, Badge, TextInput, Textarea, Select,
                          Checkbox, Switch, Divider, LoadingSpinner, Skeleton, Dialog
    layout/               AppShell, Sidebar, SidebarNav, MobileNav, Brand, UserSummary, PageContainer
    shared/               PageHeader, EmptyState, MilestonePlaceholder
  features/               Feature-specific pieces (e.g. video-library/VideoStatusBadge)
  services/               Data access. Pages import from "@/services"; today it re-exports mock/,
                          later it switches to real API calls without page changes
  config/                 appConfig (name, tagline, video defaults) and navigation
  types/                  Shared types (VideoProject, VideoStatus, UserProfile)
  lib/                    Small helpers (cn)
```

## Design system

All colours are CSS variables in `src/app/globals.css`, exposed to Tailwind through `@theme inline`. Use the semantic names, never raw hex:

| Tailwind name | Token | Use |
|---|---|---|
| `bg-background` | `#10121A` | App canvas |
| `bg-surface` | `#171A25` | Sidebar, drawers |
| `bg-card` | `#1D2130` | Cards, panels |
| `bg-surface-raised` | `#252A3A` | Hover, selected, nested |
| `bg-primary` / `text-primary-foreground` | `#8B7CFF` / `#10121A` | Primary actions, active nav |
| `text-secondary` | `#4DD6C8` | Secondary highlights, progress |
| `text-foreground` / `text-muted` | `#F4F5FA` / `#A6ADBF` | Headings / descriptions |
| `border-border` | `#303649` | Borders, dividers |
| `success` / `warning` / `error` | `#48C78E` / `#F5B95C` / `#FF6B78` | Status only |

Type scale: `text-page` (30px), `text-section` (20px), `text-card` (15px), `text-body` (15px), `text-meta` (13px). Radii: `rounded-card` (14px), `rounded-control` (10px). Focus rings and reduced-motion handling are global.

Conventions:

- Server Components by default; `"use client"` only for `SidebarNav` (reads the URL), `MobileNav` and `Dialog`.
- Use `buttonStyles()` to style a `next/link` as a button.
- Form controls take an explicit `id`; label, description and error are wired with `aria-describedby`.
- Status badges always pair colour with an icon and text. Only use these statuses: Draft, Generating, Ready to download, Failed, Expired.
- Business constants (durations, aspect ratio, defaults) live in `src/config/app.ts`.

## Responsive behaviour

- Desktop (≥1024px): full sidebar.
- Tablet (768–1023px): compact icon sidebar with screen-reader labels and tooltips.
- Mobile (<768px): top bar with a menu button that opens the navigation in a drawer (native `<dialog>`).

## Notes

- `cacheComponents` is on. The sidebar's active-link highlight sits in a `Suspense` boundary because `usePathname` suspends on dynamic routes it can't prerender.
- `/videos/[id]` prerenders the mock IDs. An unknown ID renders the not-found page with a `noindex` tag, but the HTTP status is 200 because the page is streamed.
- `turbopack.root` is pinned to this folder because the repository root has its own lockfile (the video pipeline).
