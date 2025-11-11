# Garbage Job Web Interface

## Building the Web Files

You **MUST** build the web files before the UI will work in-game.

### Steps:

1. Open a terminal/command prompt
2. Navigate to this directory:
   ```bash
   cd resources/[qb]/qb-garbagejob/web
   ```

3. Install dependencies (first time only):
   ```bash
   npm install
   ```

4. Build the production files:
   ```bash
   npm run build
   ```

5. Restart the resource in your server:
   ```
   restart qb-garbagejob
   ```

The build process creates the `dist/` folder with the compiled files that FiveM uses.

## Development

To run in development mode (with hot reload):
```bash
npm run dev
```

Note: Development mode won't work in FiveM - you must build for production.

