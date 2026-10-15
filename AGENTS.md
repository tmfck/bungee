# Bungee CLI

Terminal TUI utility for ISP technical support. Built with Bun + OpenTUI + Solid.js.

## Commands

```bash
bun install          # Install dependencies
bun dev              # Run with watch mode
bun run src/index.tsx    # Run once
```

## Architecture

- **Entry**: `src/index.tsx` — creates renderer, mounts Solid.js app
- **App**: `src/tui/App.tsx` — screen routing, global keybindings
- **Store**: `src/tui/store.ts` — Solid.js signals for all state
- **Screens**: `src/tui/screens/*.tsx` — SearchScreen, AbonentScreen, SwitchScreen, OLTScreen
- **API**: `src/tui/userside.ts` — UserSide HTTP client (cookie auth, HTML parsing)

## Key Details

- **Docs skill**: OpenTUI documentation skill installed at `.agents/skills/opentui` (registered via `.kilo/kilo.json` `skills.paths`). Use it for any OpenTUI questions — read the relevant `.mdx` files from `.agents/skills/opentui/docs/` instead of guessing APIs. Docs match project version 0.6.4. Update with `bunx skills update`.
- **JSX**: Uses `.tsx` extension; imports use `.jsx` (e.g., `import App from "./App.jsx"`)
- **Preload**: `bunfig.toml` preloads `@opentui/solid/preload` — required for JSX transform
- **JSX config**: `tsconfig.json` sets `"jsxImportSource": "@opentui/solid"`
- **No React**: Uses Solid.js with OpenTUI primitives (`<box>`, `<text>`, `useKeyboard`)

## Global Hotkeys

- `F1` — Help modal
- `F3` — Navigate to search
- `F10` — Exit
- `F12` — Toggle console
- `Esc` — Back/close modal

## Environment

- `.env` required for UserSide API (URL, cookie)
- TypeScript strict mode enabled
- No build step — Bun runs TypeScript directly
