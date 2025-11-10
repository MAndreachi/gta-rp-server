# QB Clothing - React/Tailwind UI

This is the new React/Tailwind implementation of the QB Clothing UI, matching the design pattern used in qb-banking and qb-inventory.

## Setup

1. Install dependencies:
```bash
cd resources/[qb]/qb-clothing/web
npm install
```

2. Build the project:
```bash
npm run build
```

This will create the `dist` folder with the compiled assets that FiveM will use.

## Development

To run the development server (for testing outside of FiveM):

```bash
npm run dev
```

The dev server will run on port 5176.

## Project Structure

```
web/
├── src/
│   ├── App.tsx          # Main React component
│   ├── main.tsx         # React entry point
│   ├── index.css        # Tailwind CSS styles
│   ├── lib/
│   │   ├── nui.ts       # NUI communication utilities
│   │   └── utils.ts     # Utility functions (cn helper)
│   └── types/
│       └── global.d.ts   # TypeScript global type definitions
├── dist/                # Built files (generated)
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Features

The new UI includes:

- **Character Features**: Mother/Father selection, parent mixer, facial features (nose, cheeks, eyebrows, etc.)
- **Hair Customization**: Hair, eyebrows, facial hair, makeup, lipstick, blush, etc.
- **Clothing**: All clothing items (arms, shirts, jackets, pants, shoes, etc.)
- **Accessories**: Masks, hats, glasses, ear accessories, watches, bracelets
- **Camera Controls**: Multiple camera angles for viewing the character
- **Outfit Management**: Save and load custom outfits

## Building for Production

Always run `npm run build` after making changes to ensure the latest code is compiled and available to FiveM.

The built files in `dist/` are what FiveM will load when the resource starts.

