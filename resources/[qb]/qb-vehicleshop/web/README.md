# qb-vehicleshop Web UI

This is the React/TypeScript web interface for the vehicle shop system.

## Setup

1. Navigate to the `web` directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

3. Build for production:
```bash
npm run build
```

The built files will be in `web/dist/` and will be automatically served by the resource.

## Development

To run in development mode (with hot reload):
```bash
npm run dev
```

The dev server will run on port 5176.

## Structure

- `src/App.tsx` - Main React component
- `src/lib/nui.ts` - NUI communication utilities
- `src/lib/utils.ts` - Utility functions (cn for className merging)
- `src/index.css` - Tailwind CSS styles
- `tailwind.config.js` - Tailwind configuration matching qb-banking

## Styling

The UI uses Tailwind CSS with a dark theme matching the qb-banking resource. Colors and styling are consistent across both resources.

