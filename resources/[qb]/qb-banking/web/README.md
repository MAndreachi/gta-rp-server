# QB Banking - React/Tailwind UI

This is the React/TypeScript/Tailwind redesign of the qb-banking system.

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

## Building for Production

1. Build the project:
```bash
npm run build
```

This will create the `dist` folder with the production build that FiveM will use.

## Project Structure

- `src/App.tsx` - Main React component with all banking functionality
- `src/lib/nui.ts` - NUI communication utilities
- `src/lib/utils.ts` - Utility functions (cn for className merging)
- `src/index.css` - Global styles with Tailwind
- `src/main.tsx` - React entry point

## Features

- Bank view with Home, Money, Transfer, and Account Options
- ATM view with PIN prompt
- All original functionality preserved:
  - Deposit/Withdraw
  - Internal/External transfers
  - Account management (create, rename, delete)
  - User management for shared accounts
  - Debit card ordering
  - Transaction history

