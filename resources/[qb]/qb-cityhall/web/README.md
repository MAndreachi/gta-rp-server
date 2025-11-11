# qb-cityhall Web UI

This is the React/Tailwind UI for the job selection interface in qb-cityhall.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build for production:
```bash
npm run build
```

3. For development (with hot reload):
```bash
npm run dev
```

## Structure

- `src/App.tsx` - Main React component for job selection UI
- `src/lib/nui.ts` - NUI communication utilities
- `src/lib/utils.ts` - Utility functions (cn for className merging)
- `src/index.css` - Tailwind CSS styles
- `src/main.tsx` - React entry point

## Building

After making changes, run `npm run build` to compile the React app. The built files will be in the `dist/` directory, which is referenced by the fxmanifest.lua.

