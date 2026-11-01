# Explivio web app

The Explivio dashboard frontend: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 and Lucide icons. Built so far: F1 (design tokens, UI components, app shell, routes) and F2 (Home dashboard and the Create → Settings → Generate flow). The remaining screens are placeholders, built in later milestones.

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
                          Checkbox, Switch, RadioCard, SegmentedControl, Divider, LoadingSpinner,
                          Skeleton, Dialog
    layout/               AppShell, Sidebar, SidebarNav, MobileNav, Brand, UserSummary, PageContainer
    shared/               PageHeader, Breadcrumbs, EmptyState, MilestonePlaceholder
  features/
    dashboard/            RecentVideos
    video-creation/       HomeComposer, CreatePromptForm, ConfigureForm, idea cards,
                          generateVideo server action
    video-library/        VideoCard, VideoThumbnail, VideoStatusBadge
  services/               Data access. Pages import from "@/services"; today it re-exports mock/,
                          later it switches to real API calls without page changes
  config/                 appConfig (video options and defaults), ideas, navigation
  types/                  Shared types (VideoProject, VideoStatus, UserProfile)
  lib/                    cn, formatDate, video-request (prompt validation, URL helpers)
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

Type scale: `text-page` (30px), `text-section` (20px), `text-title` (15px, card headings), `text-body` (15px), `text-meta` (13px). Radii: `rounded-card` (14px), `rounded-control` (10px). Focus rings and reduced-motion handling are global.

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

## Creation flow (F2)

- **Home (`/`):** prompt composer with duration (30/60/90s) and fixed 9:16 format. "Create video" goes straight to Settings. Idea cards fill the prompt. Recent videos shows the three newest projects.
- **Create (`/create`):** step 1, the prompt with ideas. Prefills from `?prompt=` when the user comes back from Settings with "Edit prompt".
- **Settings (`/configure`):** step 2, duration, voice (female/male), captions (on), music (off). Format and visual style are fixed. A summary panel sits alongside. Without a valid prompt it points back to step 1.
- **Data between steps:** the prompt and duration travel in the URL (`?prompt=&duration=`), so a refresh or a shared link keeps them. No client state library is needed.
- **Generate:** calls the `generateVideo` server action. It re-validates on the server (it can be called by any POST), records the request through `@/services`, and sends the user to `/generating?video=<id>`. The button shows a loading state and blocks double submits.
- **Validation:** shared by client and server (`lib/video-request.ts`). The prompt is required, 10–600 characters. Errors are tied to the field with `aria-describedby`, and focus moves to the field.

## Generation and results (F3)

- **`/generating?video=<id>`:** polls `GET /api/videos/<id>` every 2s. It shows the four pipeline stages and an indeterminate bar, because the pipeline reports stages, not percentages. On failure it shows saved settings with Try again (same id) and Edit settings. When the video is ready it opens `/videos/<id>`.
- **`/videos/<id>`:** a ready video gets a native 9:16 player and Download MP4. An expired video gets saved settings and Regenerate. Generating and failed videos redirect to the progress screen.
- **`GET /api/videos/<id>/file`:** streams the MP4 with HTTP Range support, so the player can seek. `?download=1` makes the browser save it.
- **Mock service:** keeps its store on `globalThis`, so route handlers, server actions and pages share it, and steps new jobs through the stages on a timer. Server-side status reads use `connection()` so they run per request, not at build time.

## Authentication screens (demo only)

- **Routes:** `(auth)` route group with its own layout (brand bar, centred content, no dashboard sidebar): `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/reset-password`. The layout isn't a security boundary.
- **Components:** `components/auth/` holds AuthLayout, AuthCard (plus AuthSplit and AuthCentered), AuthHeader, AuthFooter / AuthBackLink, AuthMessage (also used for form errors) and AuthBrandPanel. `components/ui/password-input.tsx` adds a show/hide toggle; `TextInput` gained `leadingIcon`, `labelAside` and `trailingAction`, so there's no separate AuthInput.
- **Feature code:** `features/authentication/` holds the types, validation (email, required fields, password rules: 8+ characters and a number or symbol, confirmation, terms), server actions, and the form components (including PasswordChecklist and PasswordStrengthIndicator).
- **Data flow:** forms validate on the client, then call server actions that re-validate and call `@/services`, which today re-exports `services/mock/auth.ts`. The mock checks nothing, stores nothing and sends no email, and every success message says it's a demo. To add real auth, replace those re-exports and add sessions and route protection.
- **Navigation:** sign-up goes to `/verify-email?to=<masked email>`; the full address never goes in the URL. Reset goes to `/login?reset=1`.

## Real video pipeline (F4)

- **How it works:** by default (`VIDEO_SERVICE=pipeline`) each video is a run of the repo-root CLI. `services/pipeline/videos.ts` writes `runs/<id>/request.json` and `prompt.txt`, then starts `src/cli.ts` in its own process, with `--prompt-file`, `--run-id`, `--duration`, `--voice` and optionally `--no-captions` / `--music`. The prompt never goes through a shell. Status, stages and errors are read from `runs/<id>/manifest.json`; the file route streams `runs/<id>/video.mp4`.
- **Needs:** `npm install` and API keys in the repo-root `.env` (Gemini and ElevenLabs). Generation takes a few minutes, one video at a time.
- **Logs:** `runs/<id>/pipeline.log` holds the CLI output for debugging.
- **UI work without keys:** set `VIDEO_SERVICE=mock` in `web/.env.local` (see `.env.example`).

## Notes

- `cacheComponents` is on. The sidebar's active-link highlight sits in a `Suspense` boundary because `usePathname` suspends on dynamic routes it can't prerender.
- `/videos/[id]` prerenders the mock IDs. An unknown ID renders the not-found page with a `noindex` tag, but the HTTP status is 200 because the page is streamed.
- `turbopack.root` is pinned to this folder because the repository root has its own lockfile (the video pipeline).
