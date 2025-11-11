# Towing Job Web Interface

This is the React/TypeScript/Tailwind CSS web interface for the towing job menu.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build for production:
```bash
npm run build
```

This will create a `dist` folder with the compiled files that will be used by the FiveM resource.

## Development

To run in development mode:
```bash
npm run dev
```

This will start a development server on port 5176.

## Structure

- `src/App.tsx` - Main React component with the modal
- `src/index.css` - Tailwind CSS styles
- `src/lib/nui.ts` - NUI communication utilities
- `src/lib/utils.ts` - Utility functions (cn for className merging)
- `src/main.tsx` - React entry point

## Styling

The interface uses Tailwind CSS with a dark theme matching qb-banking's style guide:
- Dark background (#1a1a1a)
- Border colors (#2a2a2a)
- Green accent colors for success states
- Red accent colors for error states

