# Quick Start: Adding Custom Vehicles

## The Easy Way (Recommended)

### Step 1: Install Vehicle Mod
1. Download vehicle mod
2. Place in `resources/` folder
3. Add to `server.cfg`: `ensure your-vehicle-mod-name`

### Step 2: Add Vehicle Entry
Edit `resources/[qb]/qb-core/shared/custom_vehicles.lua` and add:

```lua
{
    model = 'SPAWN_CODE',      -- From mod documentation
    name = 'Display Name',      -- What players see
    brand = 'Brand Name',       -- Manufacturer
    price = 100000,             -- Price
    category = 'sports',        -- See guide for categories
    type = 'automobile',       -- Usually 'automobile'
    shop = 'pdm',              -- Shop name
},
```

### Step 3: Restart
```
restart qb-core
```

### Step 4: Test
- Go to vehicle shop
- Search for your vehicle
- It should appear automatically!

## Finding the Spawn Code

1. Check mod's README/documentation
2. Try `/car [partial-name]` in-game
3. Check mod's `fxmanifest.lua` or `__resource.lua`
4. Common formats: `r34`, `supra2020`, `gtrnismo`

## Vehicle Categories

- `compacts` - Small cars
- `sedans` - Sedans
- `suvs` - SUVs
- `coupes` - Coupes
- `muscle` - Muscle cars
- `sports` - Sports cars
- `super` - Supercars
- `motorcycles` - Bikes
- `offroad` - Off-road vehicles
- `vans` - Vans

## Example

```lua
{
    model = 'r34',
    name = 'Skyline R34 GT-R',
    brand = 'Nissan',
    price = 175000,
    category = 'sports',
    type = 'automobile',
    shop = 'pdm',
}
```

That's it! The vehicle will automatically:
- ✅ Appear in the vehicle shop
- ✅ Show stats
- ✅ Be purchasable
- ✅ Work with preview/test drive

