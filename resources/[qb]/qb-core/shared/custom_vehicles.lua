-- Custom Import Vehicles
-- Add your custom vehicle mods here
-- This file is automatically loaded by qb-core/shared/vehicles.lua

local CustomVehicles = {
    -- ============================================
    -- ADD YOUR CUSTOM VEHICLES BELOW THIS LINE
    -- ============================================
    
    -- Example Template (remove this when adding real vehicles):
    -- {
    --     model = 'spawncode',        -- Spawn code from vehicle mod (MUST match exactly)
    --     name = 'Display Name',      -- Name shown to players
    --     brand = 'Brand',            -- Manufacturer/brand name
    --     price = 100000,             -- Price in dollars
    --     category = 'sports',        -- Category: compacts, sedans, suvs, coupes, muscle, sports, super, motorcycles, offroad, vans
    --     type = 'automobile',        -- Type: automobile, bike, boat, etc.
    --     shop = 'pdm',               -- Shop: 'pdm', 'luxury', 'imports', or array like {'pdm', 'luxury'}, use 'none' to hide
    -- },
    
    -- ============================================
    -- EXAMPLE CUSTOM VEHICLES (Remove these examples)
    -- ============================================
    
    -- Example 1: Sports Car
    -- {
    --     model = 'r34',
    --     name = 'Skyline R34 GT-R',
    --     brand = 'Nissan',
    --     price = 175000,
    --     category = 'sports',
    --     type = 'automobile',
    --     shop = 'pdm',
    -- },
    
    -- Example 2: Supercar
    -- {
    --     model = 'supra2020',
    --     name = 'Supra MK5',
    --     brand = 'Toyota',
    --     price = 85000,
    --     category = 'sports',
    --     type = 'automobile',
    --     shop = 'pdm',
    -- },
    
    -- Example 3: Multiple Shops
    -- {
    --     model = 'gtrnismo',
    --     name = 'GT-R Nismo',
    --     brand = 'Nissan',
    --     price = 250000,
    --     category = 'super',
    --     type = 'automobile',
    --     shop = {'pdm', 'luxury'},  -- Available at both shops
    -- },
    
    -- ============================================
    -- ADD YOUR VEHICLES ABOVE THIS LINE
    -- ============================================
}

-- Register custom vehicles with QBCore
-- This runs after vehicles.lua has initialized QBShared.Vehicles
if QBShared and QBShared.Vehicles then
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
        if not QBShared.VehicleHashes then
            QBShared.VehicleHashes = {}
        end
        QBShared.VehicleHashes[hash] = QBShared.Vehicles[vehicle.model]
    end
    print(string.format('[QB-Core] Loaded %d custom vehicles', #CustomVehicles))
end

