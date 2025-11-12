# Custom Vehicle Mods Guide

This guide explains how to add custom vehicle mods (import cars) to your FiveM server and integrate them with the vehicle shop system.

## Table of Contents
1. [Understanding the Structure](#understanding-the-structure)
2. [Step-by-Step Guide](#step-by-step-guide)
3. [Best Practices](#best-practices)
4. [Troubleshooting](#troubleshooting)

---

## Understanding the Structure

### How Vehicles Work in QBCore

Vehicles are defined in `qb-core/shared/vehicles.lua`. Each vehicle needs:
- **model**: The spawn code (must match the vehicle mod's spawn name)
- **name**: Display name shown to players
- **brand**: Manufacturer/brand name
- **price**: Purchase price
- **category**: Vehicle class (compacts, sedans, suvs, sports, etc.)
- **type**: Vehicle type (automobile, bike, boat, etc.)
- **shop**: Which shop(s) sell it ('pdm', 'luxury', 'none', or array like {'pdm', 'luxury'})

### How the Vehicle Shop Works

The vehicle shop automatically:
- ✅ Shows all vehicles with `shop ~= 'none'`
- ✅ Filters out military, boats, planes, helicopters, etc.
- ✅ Calculates stats dynamically
- ✅ Works with any vehicle added to QBCore.Shared.Vehicles

---

## Step-by-Step Guide

### Step 1: Install the Vehicle Mod

1. Download a vehicle mod from a trusted source (e.g., FiveM forums, Tebex)
2. Place the mod folder in your `resources` directory
3. Add it to your `server.cfg`:
   ```
   ensure your-vehicle-mod-name
   ```
4. Make sure the mod loads BEFORE `qb-core`:
   ```
   ensure your-vehicle-mod-name
   ensure qb-core
   ```

### Step 2: Find the Vehicle Spawn Code

1. Check the mod's documentation/readme
2. Or use `/car [partial-name]` in-game to test
3. Common formats: `r34`, `supra2020`, `gtrnismo`, etc.

### Step 3: Add Vehicle to QBCore

**Option A: Add to Main File** (Simple, but gets messy with many vehicles)
- Edit `resources/[qb]/qb-core/shared/vehicles.lua`
- Add your vehicle entry in the appropriate category section

**Option B: Create Separate File** (Recommended for custom vehicles)
- Create `resources/[qb]/qb-core/shared/custom_vehicles.lua`
- Add your vehicles there
- Import it in `vehicles.lua`

### Step 4: Determine Vehicle Properties

You need to figure out:
- **Category**: Use `/testdrive` or check vehicle class
  - Common categories: `compacts`, `sedans`, `suvs`, `coupes`, `muscle`, `sports`, `super`, `motorcycles`, `offroad`, `vans`
- **Type**: Usually `automobile` for cars, `bike` for motorcycles
- **Price**: Set based on vehicle rarity/performance

---

## Best Practices

### 1. Organize Custom Vehicles Separately

Create a dedicated file for custom vehicles to keep things organized:

**File: `resources/[qb]/qb-core/shared/custom_vehicles.lua`**
```lua
-- Custom Import Vehicles
-- Add your custom vehicles here

local CustomVehicles = {
    -- Example: Nissan R34 Skyline
    {
        model = 'r34',              -- Spawn code from mod
        name = 'Skyline R34',        -- Display name
        brand = 'Nissan',            -- Brand/manufacturer
        price = 150000,              -- Price in dollars
        category = 'sports',         -- Vehicle category
        type = 'automobile',         -- Vehicle type
        shop = 'pdm',                -- Shop(s) that sell it
    },
    -- Add more vehicles below...
}

-- Add to QBCore.Shared.Vehicles
for _, vehicle in ipairs(CustomVehicles) do
    local hash = joaat(vehicle.model)
    QBShared.Vehicles[vehicle.model] = {
        spawncode = vehicle.model,
        name = vehicle.name,
        brand = vehicle.brand,
        model = vehicle.model,
        price = vehicle.price,
        category = vehicle.category,
        hash = hash,
        type = vehicle.type,
        shop = vehicle.shop
    }
    QBShared.VehicleHashes[hash] = QBShared.Vehicles[vehicle.model]
end
```

Then in `vehicles.lua`, add at the end:
```lua
-- Load custom vehicles
if GetResourceState('qb-core') == 'started' then
    -- Custom vehicles are loaded automatically via the custom_vehicles.lua file
end
```

### 2. Create an Import Shop (Optional)

You can create a separate "Import" shop for custom vehicles:

**In `qb-vehicleshop/config.lua`:**
```lua
['imports'] = {
    ['Type'] = 'free-use',
    ['Zone'] = {
        ['Shape'] = {
            -- Define zone coordinates
        },
        ['minZ'] = 25.0,
        ['maxZ'] = 28.0,
        ['size'] = 2.75
    },
    ['Job'] = 'none',
    ['ShopLabel'] = 'Import Car Dealership',
    -- ... rest of config
}
```

Then set `shop = 'imports'` for your custom vehicles.

### 3. Vehicle Categories Reference

Use these categories based on vehicle class:
- `compacts` - Small cars (Class 0)
- `sedans` - Sedans (Class 1)
- `suvs` - SUVs (Class 2)
- `coupes` - Coupes (Class 3)
- `muscle` - Muscle cars (Class 4)
- `sportsclassics` - Classic sports (Class 5)
- `sports` - Sports cars (Class 6)
- `super` - Supercars (Class 7)
- `motorcycles` - Motorcycles (Class 8)
- `offroad` - Off-road vehicles (Class 9)
- `industrial` - Industrial (Class 10)
- `utility` - Utility vehicles (Class 11)
- `vans` - Vans (Class 12)
- `cycles` - Bicycles (Class 13)

---

## Example: Adding a Custom Vehicle

Let's say you downloaded a "Nissan Skyline R34" mod:

### 1. Vehicle Mod Info:
- **Mod Name**: `nissan-r34-skyline`
- **Spawn Code**: `r34`
- **Type**: Sports car

### 2. Add to `custom_vehicles.lua`:
```lua
{
    model = 'r34',
    name = 'Skyline R34 GT-R',
    brand = 'Nissan',
    price = 175000,
    category = 'sports',
    type = 'automobile',
    shop = 'pdm',  -- or 'imports' if you have an import shop
}
```

### 3. Test:
- Restart `qb-core` resource
- Go to vehicle shop
- Search for "Skyline" or "R34"
- Vehicle should appear with stats!

---

## Troubleshooting

### Vehicle Not Showing in Shop

1. **Check spawn code**: Make sure `model` matches the mod's spawn code exactly
2. **Check shop setting**: Ensure `shop ~= 'none'`
3. **Check category**: Make sure it's not excluded (not military, boat, plane, etc.)
4. **Restart qb-core**: After adding vehicles, restart `qb-core` resource

### Vehicle Stats Not Loading

- Stats are calculated dynamically from handling data
- If stats don't load, the vehicle model might not be loading properly
- Check server console for errors

### Vehicle Won't Spawn

1. **Check mod is loaded**: Ensure mod is in `server.cfg` and loads before `qb-core`
2. **Check spawn code**: Verify the exact spawn code matches
3. **Check mod compatibility**: Some mods may have issues

---

## Quick Reference Template

```lua
{
    model = 'SPAWN_CODE',        -- Must match mod's spawn code exactly
    name = 'Display Name',       -- What players see
    brand = 'Brand Name',        -- Manufacturer
    price = 100000,              -- Price in dollars
    category = 'sports',          -- See categories above
    type = 'automobile',         -- Usually 'automobile' or 'bike'
    shop = 'pdm',                -- Shop name or 'none' to hide
}
```

---

## Tips

1. **Start Small**: Add 1-2 vehicles first to test the process
2. **Document**: Keep a list of your custom vehicles and their spawn codes
3. **Price Realistically**: Match prices to vehicle performance/rarity
4. **Test Thoroughly**: Test spawn, purchase, and stats before adding many vehicles
5. **Backup**: Always backup `vehicles.lua` before making changes

---

## Need Help?

- Check vehicle mod documentation for spawn codes
- Use `/car [spawncode]` in-game to test if vehicle spawns
- Check server console for errors when loading vehicles
- Verify mod compatibility with your FiveM version

