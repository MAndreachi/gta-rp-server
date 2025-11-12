-- Variables
local QBCore = exports['qb-core']:GetCoreObject()
local PlayerData = QBCore.Functions.GetPlayerData()
local testDriveZone = nil
local vehicleMenu = {}
local Initialized = false
local testDriveVeh, inTestDrive = 0, false
local ClosestVehicle = 1
local zones = {}
local insideShop, tempShop = nil, nil

-- Categories that should not be available at dealerships
local excludedCategories = {
    ['boats'] = true,
    ['helicopters'] = true,
    ['planes'] = true,
    ['military'] = true,
    ['emergency'] = true,
    ['trains'] = true,
    ['submarines'] = true,
    ['commercial'] = true,      -- Commercial trucks and vans
    ['industrial'] = true,       -- Construction/industrial vehicles
    ['utility'] = true,          -- Utility/work vehicles
    ['service'] = true,          -- Service vehicles
    ['cycles'] = true,           -- Bicycles
    ['trailer'] = true,          -- Trailers
}

-- Vehicle types that should not be available at dealerships
local excludedTypes = {
    ['submarine'] = true,
    ['train'] = true,
    ['heli'] = true,
    ['plane'] = true,
    ['boat'] = true,
}

-- Handlers
AddEventHandler('QBCore:Client:OnPlayerLoaded', function()
    PlayerData = QBCore.Functions.GetPlayerData()
    local citizenid = PlayerData.citizenid
    TriggerServerEvent('qb-vehicleshop:server:addPlayer', citizenid)
    TriggerServerEvent('qb-vehicleshop:server:checkFinance')
    if not Initialized then Init() end
end)

AddEventHandler('onResourceStart', function(resource)
    if resource ~= GetCurrentResourceName() then
        return
    end
    if next(PlayerData) ~= nil and not Initialized then
        PlayerData = QBCore.Functions.GetPlayerData()
        local citizenid = PlayerData.citizenid
        TriggerServerEvent('qb-vehicleshop:server:addPlayer', citizenid)
        TriggerServerEvent('qb-vehicleshop:server:checkFinance')
        Init()
    end
end)

RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    PlayerData.job = JobInfo
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
    local citizenid = PlayerData.citizenid
    TriggerServerEvent('qb-vehicleshop:server:removePlayer', citizenid)
    PlayerData = {}
end)

local function CheckPlate(vehicle, plateToSet)
    local vehiclePlate = promise.new()
    CreateThread(function()
        while true do
            Wait(500)
            if GetVehicleNumberPlateText(vehicle) == plateToSet then
                vehiclePlate:resolve(true)
                return
            else
                SetVehicleNumberPlateText(vehicle, plateToSet)
            end
        end
    end)
    return vehiclePlate
end

-- Static Headers
local vehHeaderMenu = {
    {
        header = Lang:t('menus.vehHeader_header'),
        txt = Lang:t('menus.vehHeader_txt'),
        icon = 'fa-solid fa-car',
        params = {
            event = 'qb-vehicleshop:client:showVehOptions'
        }
    }
}

local financeMenu = {
    {
        header = Lang:t('menus.financed_header'),
        txt = Lang:t('menus.finance_txt'),
        icon = 'fa-solid fa-user-ninja',
        params = {
            event = 'qb-vehicleshop:client:getVehicles'
        }
    }
}

local returnTestDrive = {
    {
        header = Lang:t('menus.returnTestDrive_header'),
        icon = 'fa-solid fa-flag-checkered',
        params = {
            event = 'qb-vehicleshop:client:TestDriveReturn'
        }
    }
}

-- Functions
local function drawTxt(text, font, x, y, scale, r, g, b, a)
    SetTextFont(font)
    SetTextScale(scale, scale)
    SetTextColour(r, g, b, a)
    SetTextOutline()
    SetTextCentre(1)
    SetTextEntry('STRING')
    AddTextComponentString(text)
    DrawText(x, y)
end

local function tablelength(T)
    local count = 0
    for _ in pairs(T) do
        count = count + 1
    end
    return count
end

local function comma_value(amount)
    local formatted = amount
    local k
    while true do
        formatted, k = string.gsub(formatted, '^(-?%d+)(%d%d%d)', '%1,%2')
        if k == 0 then
            break
        end
    end
    return formatted
end

local function getVehName()
    return QBCore.Shared.Vehicles[Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle]['name']
end

local function getVehPrice()
    return comma_value(QBCore.Shared.Vehicles[Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle]['price'])
end

local function getVehBrand()
    return QBCore.Shared.Vehicles[Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle]['brand']
end

local function setClosestShowroomVehicle()
    local pos = GetEntityCoords(PlayerPedId(), true)
    local current = nil
    local dist = nil
    local closestShop = insideShop
    for id in pairs(Config.Shops[closestShop]['ShowroomVehicles']) do
        local dist2 = #(pos - vector3(Config.Shops[closestShop]['ShowroomVehicles'][id].coords.x, Config.Shops[closestShop]['ShowroomVehicles'][id].coords.y, Config.Shops[closestShop]['ShowroomVehicles'][id].coords.z))
        if current then
            if dist2 < dist then
                current = id
                dist = dist2
            end
        else
            dist = dist2
            current = id
        end
    end
    if current ~= ClosestVehicle then
        ClosestVehicle = current
    end
end

local function createTestDriveReturn()
    testDriveZone = BoxZone:Create(
        Config.Shops[insideShop]['ReturnLocation'],
        3.0,
        5.0,
        {
            name = 'box_zone_testdrive_return_' .. insideShop,
        })

    testDriveZone:onPlayerInOut(function(isPointInside)
        if isPointInside and IsPedInAnyVehicle(PlayerPedId()) then
            SetVehicleForwardSpeed(GetVehiclePedIsIn(PlayerPedId(), false), 0)
            exports['qb-menu']:openMenu(returnTestDrive)
        else
            exports['qb-menu']:closeMenu()
        end
    end)
end

local function startTestDriveTimer(testDriveTime, prevCoords)
    local gameTimer = GetGameTimer()
    CreateThread(function()
        Wait(2000) -- Avoids the condition to run before entering vehicle
        while inTestDrive do
            if GetGameTimer() < gameTimer + tonumber(1000 * testDriveTime) then
                local secondsLeft = GetGameTimer() - gameTimer
                if secondsLeft >= tonumber(1000 * testDriveTime) - 20 or GetPedInVehicleSeat(NetToVeh(testDriveVeh), -1) ~= PlayerPedId() then
                    TriggerServerEvent('qb-vehicleshop:server:deleteVehicle', testDriveVeh)
                    testDriveVeh = 0
                    inTestDrive = false
                    SetEntityCoords(PlayerPedId(), prevCoords)
                    QBCore.Functions.Notify(Lang:t('general.testdrive_complete'))
                end
                drawTxt(Lang:t('general.testdrive_timer') .. math.ceil(testDriveTime - secondsLeft / 1000), 4, 0.5, 0.93, 0.50, 255, 255, 255, 180)
            end
            Wait(0)
        end
    end)
end

local vehicleZones = {}
local isInVehicleZone = false
local currentVehicleZone = nil
local zoneThreads = {}

local function createVehZone(shopName, vehicleIndex)
    -- Create a zone for a specific vehicle
    local zoneKey = shopName .. '_' .. vehicleIndex
    if vehicleZones[zoneKey] then return end -- Already created
    
    local vehCoords = Config.Shops[shopName]['ShowroomVehicles'][vehicleIndex]['coords']
    -- Use a slightly larger zone size for better detection
    local zoneSize = Config.Shops[shopName]['Zone']['size'] or 2.75
    local zone = BoxZone:Create(
        vector3(vehCoords.x, vehCoords.y, vehCoords.z),
        zoneSize,
        zoneSize,
        {
            name = 'box_zone_' .. shopName .. '_' .. vehicleIndex,
            minZ = Config.Shops[shopName]['Zone']['minZ'],
            maxZ = Config.Shops[shopName]['Zone']['maxZ'],
            debugPoly = false,
        })
    
    zone:onPlayerInOut(function(isPointInside)
        if isPointInside then
            -- Check if player data is loaded and job requirement is met
            local playerJob = PlayerData and PlayerData.job and PlayerData.job.name or nil
            local shopJob = Config.Shops[shopName]['Job']
            local canAccess = (shopJob == 'none' or playerJob == shopJob)
            
            if canAccess then
                isInVehicleZone = true
                currentVehicleZone = { shop = shopName, index = vehicleIndex }
                exports['qb-core']:DrawText('[E] Browse Vehicles', 'left')
                
                -- Kill any existing thread for this zone
                if zoneThreads[zoneKey] then
                    zoneThreads[zoneKey] = nil
                end
                
                -- Create new thread for E key detection
                zoneThreads[zoneKey] = CreateThread(function()
                    while isInVehicleZone and currentVehicleZone and currentVehicleZone.shop == shopName and currentVehicleZone.index == vehicleIndex do
                        Wait(0)
                        if IsControlJustReleased(0, 38) then -- E key
                            exports['qb-core']:HideText()
                            -- Get the currently displayed vehicle for this slot
                            local displayedVehicle = Config.Shops[shopName]['ShowroomVehicles'][vehicleIndex].chosenVehicle
                            TriggerEvent('qb-vehicleshop:client:openShop', shopName, displayedVehicle)
                            break
                        end
                    end
                end)
            end
        else
            if currentVehicleZone and currentVehicleZone.shop == shopName and currentVehicleZone.index == vehicleIndex then
                isInVehicleZone = false
                currentVehicleZone = nil
                exports['qb-core']:HideText()
                if zoneThreads[zoneKey] then
                    zoneThreads[zoneKey] = nil
                end
            end
        end
    end)
    
    vehicleZones[zoneKey] = zone
end

-- Zones
local function createFreeUseShop(shopShape, name)
    local zone = PolyZone:Create(shopShape, {
        name = name,
        minZ = shopShape.minZ,
        maxZ = shopShape.maxZ,
    })

    zone:onPlayerInOut(function(isPointInside)
        if isPointInside then
            insideShop = name
            CreateThread(function()
                while insideShop do
                    setClosestShowroomVehicle()
                    vehicleMenu = {
                        {
                            isMenuHeader = true,
                            icon = 'fa-solid fa-circle-info',
                            header = getVehBrand():upper() .. ' ' .. getVehName():upper() .. ' - $' .. getVehPrice(),
                        },
                        {
                            header = Lang:t('menus.test_header'),
                            txt = Lang:t('menus.freeuse_test_txt'),
                            icon = 'fa-solid fa-car-on',
                            params = {
                                event = 'qb-vehicleshop:client:TestDrive',
                            }
                        },
                        {
                            header = Lang:t('menus.freeuse_buy_header'),
                            txt = Lang:t('menus.freeuse_buy_txt'),
                            icon = 'fa-solid fa-hand-holding-dollar',
                            params = {
                                isServer = true,
                                event = 'qb-vehicleshop:server:buyShowroomVehicle',
                                args = {
                                    buyVehicle = Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle
                                }
                            }
                        },
                        {
                            header = Lang:t('menus.finance_header'),
                            txt = Lang:t('menus.freeuse_finance_txt'),
                            icon = 'fa-solid fa-coins',
                            params = {
                                event = 'qb-vehicleshop:client:openFinance',
                                args = {
                                    price = getVehPrice(),
                                    buyVehicle = Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle
                                }
                            }
                        },
                        {
                            header = Lang:t('menus.swap_header'),
                            txt = Lang:t('menus.swap_txt'),
                            icon = 'fa-solid fa-arrow-rotate-left',
                            params = {
                                event = Config.FilterByMake and 'qb-vehicleshop:client:vehMakes' or 'qb-vehicleshop:client:vehCategories',
                            }
                        },
                    }
                    Wait(1000)
                end
            end)
        else
            insideShop = nil
            ClosestVehicle = 1
        end
    end)
end

local function createManagedShop(shopShape, name)
    local zone = PolyZone:Create(shopShape, {
        name = name,
        minZ = shopShape.minZ,
        maxZ = shopShape.maxZ,
    })

    zone:onPlayerInOut(function(isPointInside)
        if isPointInside then
            insideShop = name
            CreateThread(function()
                while insideShop and PlayerData.job and PlayerData.job.name == Config.Shops[name]['Job'] do
                    setClosestShowroomVehicle()
                    vehicleMenu = {
                        {
                            isMenuHeader = true,
                            icon = 'fa-solid fa-circle-info',
                            header = getVehBrand():upper() .. ' ' .. getVehName():upper() .. ' - $' .. getVehPrice(),
                        },
                        {
                            header = Lang:t('menus.test_header'),
                            txt = Lang:t('menus.managed_test_txt'),
                            icon = 'fa-solid fa-user-plus',
                            params = {
                                event = 'qb-vehicleshop:client:openIdMenu',
                                args = {
                                    vehicle = Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle,
                                    type = 'testDrive'
                                }
                            }
                        },
                        {
                            header = Lang:t('menus.managed_sell_header'),
                            txt = Lang:t('menus.managed_sell_txt'),
                            icon = 'fa-solid fa-cash-register',
                            params = {
                                event = 'qb-vehicleshop:client:openIdMenu',
                                args = {
                                    vehicle = Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle,
                                    type = 'sellVehicle'
                                }
                            }
                        },
                        {
                            header = Lang:t('menus.finance_header'),
                            txt = Lang:t('menus.managed_finance_txt'),
                            icon = 'fa-solid fa-coins',
                            params = {
                                event = 'qb-vehicleshop:client:openCustomFinance',
                                args = {
                                    price = getVehPrice(),
                                    vehicle = Config.Shops[insideShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle
                                }
                            }
                        },
                        {
                            header = Lang:t('menus.swap_header'),
                            txt = Lang:t('menus.swap_txt'),
                            icon = 'fa-solid fa-arrow-rotate-left',
                            params = {
                                event = Config.FilterByMake and 'qb-vehicleshop:client:vehMakes' or 'qb-vehicleshop:client:vehCategories',
                            }
                        },
                    }
                    Wait(1000)
                end
            end)
        else
            insideShop = nil
            ClosestVehicle = 1
        end
    end)
end

local function createFinanceZone(coords, name)
    local financeZone = BoxZone:Create(coords, 2.0, 2.0, {
        name = 'vehicleshop_financeZone_' .. name,
        offset = { 0.0, 0.0, 0.0 },
        scale = { 1.0, 1.0, 1.0 },
        minZ = coords.z - 1,
        maxZ = coords.z + 1,
        debugPoly = false,
    })

    financeZone:onPlayerInOut(function(isPointInside)
        if isPointInside then
            exports['qb-menu']:showHeader(financeMenu)
        else
            exports['qb-menu']:closeMenu()
        end
    end)
end

function Init()
    Initialized = true
    CreateThread(function()
        -- Wait for player data to be loaded
        while not PlayerData or not PlayerData.citizenid do
            Wait(100)
        end
        
        -- Create finance zones (still needed for financed vehicle payments)
        for name, shop in pairs(Config.Shops) do
            if shop['FinanceZone'] then createFinanceZone(shop['FinanceZone'], name) end
        end
    end)
    CreateThread(function()
        -- Wait for player data to be loaded
        while not PlayerData or not PlayerData.citizenid do
            Wait(100)
        end
        
        -- Spawn display vehicles and create individual zones for each
        for k in pairs(Config.Shops) do
            for i = 1, #Config.Shops[k]['ShowroomVehicles'] do
                local model = GetHashKey(Config.Shops[k]['ShowroomVehicles'][i].defaultVehicle)
                RequestModel(model)
                while not HasModelLoaded(model) do
                    Wait(0)
                end
                local veh = CreateVehicle(model, Config.Shops[k]['ShowroomVehicles'][i].coords.x, Config.Shops[k]['ShowroomVehicles'][i].coords.y, Config.Shops[k]['ShowroomVehicles'][i].coords.z, false, false)
                SetModelAsNoLongerNeeded(model)
                SetVehicleOnGroundProperly(veh)
                SetEntityInvincible(veh, true)
                SetVehicleDirtLevel(veh, 0.0)
                SetVehicleDoorsLocked(veh, 3)
                SetEntityHeading(veh, Config.Shops[k]['ShowroomVehicles'][i].coords.w)
                FreezeEntityPosition(veh, true)
                SetVehicleNumberPlateText(veh, 'BUY ME')
                -- Create individual zone for this specific vehicle
                createVehZone(k, i)
            end
        end
    end)
end

-- Cache for vehicle stat ranges (calculated once)
local vehicleStatRanges = nil

-- Function to calculate min/max ranges from all vehicles
local function CalculateVehicleStatRanges()
    if vehicleStatRanges then
        return vehicleStatRanges -- Return cached ranges
    end
    
    local ranges = {
        topSpeed = { min = math.huge, max = 0 },
        acceleration = { min = math.huge, max = 0 },
        braking = { min = math.huge, max = 0 },
        handling = { min = math.huge, max = 0 },
        traction = { min = math.huge, max = 0 },
        mass = { min = math.huge, max = 0 }
    }
    
    local vehiclesScanned = 0
    local maxScan = 50 -- Limit scanning to prevent lag, sample vehicles
    
    -- Sample vehicles to find ranges
    for k, v in pairs(QBCore.Shared.Vehicles) do
        if vehiclesScanned >= maxScan then break end
        
        local vehicleShop = v.shop
        local vehicleCategory = v.category or 'compacts'
        local vehicleType = v.type or 'automobile'
        
        -- Only scan vehicles that would be in dealerships
        if vehicleShop ~= 'none' 
            and not excludedCategories[vehicleCategory] 
            and not excludedTypes[vehicleType] then
            
            local modelHash = GetHashKey(v.model or k)
            if IsModelInCdimage(modelHash) then
                RequestModel(modelHash)
                local timeout = 0
                while not HasModelLoaded(modelHash) and timeout < 50 do
                    Wait(1)
                    timeout = timeout + 1
                end
                
                if HasModelLoaded(modelHash) then
                    local tempVeh = CreateVehicle(modelHash, 0.0, 0.0, 0.0, 0.0, false, false)
                    if DoesEntityExist(tempVeh) then
                        local topSpeed = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fInitialDriveMaxFlatVel')
                        local acceleration = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fInitialDriveForce')
                        local braking = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fBrakeForce')
                        local traction = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fTractionCurveMax')
                        local handling = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fSteeringLock')
                        local mass = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fMass')
                        
                        -- Update ranges
                        ranges.topSpeed.min = math.min(ranges.topSpeed.min, topSpeed)
                        ranges.topSpeed.max = math.max(ranges.topSpeed.max, topSpeed)
                        ranges.acceleration.min = math.min(ranges.acceleration.min, acceleration)
                        ranges.acceleration.max = math.max(ranges.acceleration.max, acceleration)
                        ranges.braking.min = math.min(ranges.braking.min, braking)
                        ranges.braking.max = math.max(ranges.braking.max, braking)
                        ranges.handling.min = math.min(ranges.handling.min, handling)
                        ranges.handling.max = math.max(ranges.handling.max, handling)
                        ranges.traction.min = math.min(ranges.traction.min, traction)
                        ranges.traction.max = math.max(ranges.traction.max, traction)
                        ranges.mass.min = math.min(ranges.mass.min, mass)
                        ranges.mass.max = math.max(ranges.mass.max, mass)
                        
                        DeleteEntity(tempVeh)
                        vehiclesScanned = vehiclesScanned + 1
                    end
                    SetModelAsNoLongerNeeded(modelHash)
                end
            end
        end
    end
    
    -- Fallback to reasonable defaults if no vehicles were scanned
    if vehiclesScanned == 0 then
        ranges.topSpeed = { min = 50, max = 200 }
        ranges.acceleration = { min = 0.1, max = 0.5 }
        ranges.braking = { min = 0.3, max = 1.5 }
        ranges.handling = { min = 20, max = 50 }
        ranges.traction = { min = 1.0, max = 3.0 }
        ranges.mass = { min = 500, max = 5000 }
    end
    
    vehicleStatRanges = ranges
    return ranges
end

-- Function to calculate vehicle statistics
local function GetVehicleStats(vehicleModel)
    local modelHash = GetHashKey(vehicleModel)
    if not IsModelInCdimage(modelHash) then
        return nil
    end
    
    -- Get stat ranges (will calculate on first call, then cache)
    local ranges = CalculateVehicleStatRanges()
    
    -- Request model
    RequestModel(modelHash)
    local timeout = 0
    while not HasModelLoaded(modelHash) and timeout < 100 do
        Wait(10)
        timeout = timeout + 1
    end
    
    if not HasModelLoaded(modelHash) then
        return nil
    end
    
    -- Create temporary vehicle to get stats
    local tempVeh = CreateVehicle(modelHash, 0.0, 0.0, 0.0, 0.0, false, false)
    if not DoesEntityExist(tempVeh) then
        SetModelAsNoLongerNeeded(modelHash)
        return nil
    end
    
    -- Get handling data
    local topSpeed = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fInitialDriveMaxFlatVel')
    local acceleration = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fInitialDriveForce')
    local braking = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fBrakeForce')
    local traction = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fTractionCurveMax')
    local handling = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fSteeringLock')
    local mass = GetVehicleHandlingFloat(tempVeh, 'CHandlingData', 'fMass')
    
    -- Clean up
    DeleteEntity(tempVeh)
    SetModelAsNoLongerNeeded(modelHash)
    
    -- Convert to user-friendly units and return actual values
    -- Top speed: fInitialDriveMaxFlatVel is theoretical max velocity in m/s
    -- Actual achievable top speed in-game is much lower due to drag, gear ratios, etc.
    -- Based on in-game testing: theoretical values are ~2.9-3.1x higher than actual speed
    -- Converting m/s to mph: m/s * 2.237 = mph (theoretical)
    -- Then scaling down by ~0.32-0.34 to match actual in-game performance
    -- Formula: m/s * 2.237 * 0.33 ≈ m/s * 0.738 for realistic mph
    -- Calibrated based on test: fastest car (xeno) shows ~364 theoretical, achieves ~120 actual
    local topSpeedMph = math.floor(topSpeed * 0.738)
    
    -- Acceleration: force value (keep as is, will display as relative)
    local accelerationValue = math.floor(acceleration * 100) / 100
    
    -- Braking: force value (keep as is)
    local brakingValue = math.floor(braking * 100) / 100
    
    -- Handling: steering lock angle in degrees
    local handlingDegrees = math.floor(handling)
    
    -- Traction: traction curve max (keep as is)
    local tractionValue = math.floor(traction * 100) / 100
    
    -- Mass: convert to kg
    local massKg = math.floor(mass)
    
    -- Calculate normalized values for progress bars (0-100)
    local function normalize(value, min, max)
        if max == min then return 50 end -- Avoid division by zero
        local normalized = ((value - min) / (max - min)) * 100
        return math.max(0, math.min(100, math.floor(normalized)))
    end
    
    local stats = {
        topSpeed = topSpeedMph, -- Actual mph value
        acceleration = accelerationValue, -- Actual acceleration force
        braking = brakingValue, -- Actual brake force
        handling = handlingDegrees, -- Actual steering lock degrees
        traction = tractionValue, -- Actual traction value
        mass = massKg, -- Actual mass in kg
        -- Normalized values for progress bars
        topSpeedPercent = normalize(topSpeed, ranges.topSpeed.min, ranges.topSpeed.max),
        accelerationPercent = normalize(acceleration, ranges.acceleration.min, ranges.acceleration.max),
        brakingPercent = normalize(braking, ranges.braking.min, ranges.braking.max),
        handlingPercent = normalize(handling, ranges.handling.min, ranges.handling.max),
        tractionPercent = normalize(traction, ranges.traction.min, ranges.traction.max)
    }
    
    return stats
end

-- Open shop menu
RegisterNetEvent('qb-vehicleshop:client:openShop', function(shopName, displayedVehicleModel)
    if not shopName then shopName = insideShop end
    if not shopName then return end
    
    insideShop = shopName
    
    -- Get all available vehicles
    local vehicles = {}
    local categories = {}
    local makes = {}
    
    for k, v in pairs(QBCore.Shared.Vehicles) do
        local vehicleShop = QBCore.Shared.Vehicles[k]['shop']
        local vehicleCategory = v.category or 'compacts'
        local vehicleType = v.type or 'automobile'
        
        -- Skip vehicles that shouldn't be at dealerships
        if vehicleShop ~= 'none' 
            and not excludedCategories[vehicleCategory] 
            and not excludedTypes[vehicleType] then
            local vehicle = {
                model = v.model or k,
                name = v.name,
                brand = v.brand,
                price = v.price,
                category = vehicleCategory,
                type = vehicleType
            }
            vehicles[#vehicles + 1] = vehicle
            categories[vehicleCategory] = true
            makes[v.brand] = true
        end
    end
    
    local playerData = QBCore.Functions.GetPlayerData()
    local shopData = {
        shopName = shopName,
        shopLabel = Config.Shops[shopName]['ShopLabel'],
        vehicles = vehicles,
        categories = {},
        makes = {},
        playerCash = playerData.money.cash or 0,
        playerBank = playerData.money.bank or 0,
        displayedVehicle = displayedVehicleModel -- Pass the currently displayed vehicle model
    }
    
    -- Convert sets to arrays
    for cat, _ in pairs(categories) do
        shopData.categories[#shopData.categories + 1] = cat
    end
    for make, _ in pairs(makes) do
        shopData.makes[#shopData.makes + 1] = make
    end
    
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openShop',
        shopData = shopData
    })
end)

-- Get vehicle statistics callback
RegisterNUICallback('getVehicleStats', function(data, cb)
    local stats = GetVehicleStats(data.vehicle)
    cb({ success = stats ~= nil, stats = stats })
end)

-- NUI Callbacks
RegisterNUICallback('closeShop', function(_, cb)
    SetNuiFocus(false, false)
    insideShop = nil
    cb('ok')
end)

RegisterNUICallback('buyVehicle', function(data, cb)
    TriggerServerEvent('qb-vehicleshop:server:buyShowroomVehicle', { 
        buyVehicle = data.vehicle, 
        shopName = insideShop,
        primaryColor = data.primaryColor or 0,
        secondaryColor = data.secondaryColor or 0
    })
    cb({ success = true, message = 'Vehicle purchased successfully!' })
end)

RegisterNUICallback('financeVehicle', function(data, cb)
    TriggerServerEvent('qb-vehicleshop:server:financeVehicle', 
        data.downPayment, 
        data.payments, 
        data.vehicle,
        data.primaryColor or 0,
        data.secondaryColor or 0
    )
    cb({ success = true, message = 'Vehicle financed successfully!' })
end)

RegisterNUICallback('previewVehicle', function(data, cb)
    local shopName = insideShop
    if not shopName then
        cb({ success = false, message = 'No shop selected' })
        return
    end
    
    -- Find the closest showroom slot
    local playerCoords = GetEntityCoords(PlayerPedId())
    local closestSlot = 1
    local closestDistance = math.huge
    
    for i = 1, #Config.Shops[shopName]['ShowroomVehicles'] do
        local slotCoords = Config.Shops[shopName]['ShowroomVehicles'][i].coords
        local distance = #(playerCoords - vector3(slotCoords.x, slotCoords.y, slotCoords.z))
        if distance < closestDistance then
            closestDistance = distance
            closestSlot = i
        end
    end
    
    -- Swap the vehicle in the showroom with colors
    -- Ensure colors are numbers - check if they exist first
    local primaryColor = 0
    local secondaryColor = 0
    
    if data.primaryColor ~= nil then
        primaryColor = tonumber(data.primaryColor) or 0
    end
    if data.secondaryColor ~= nil then
        secondaryColor = tonumber(data.secondaryColor) or 0
    end
    
    TriggerServerEvent('qb-vehicleshop:server:swapVehicle', {
        toVehicle = data.vehicle,
        ClosestVehicle = closestSlot,
        ClosestShop = shopName,
        primaryColor = primaryColor,
        secondaryColor = secondaryColor
    })
    
    cb({ success = true, message = 'Vehicle previewed in showroom!' })
end)

RegisterNUICallback('testDrive', function(data, cb)
    if not inTestDrive then
        inTestDrive = true
        local prevCoords = GetEntityCoords(PlayerPedId())
        local shopName = insideShop
        tempShop = shopName
        
        QBCore.Functions.TriggerCallback('qb-vehicleshop:server:spawnvehicle', function(netId, properties, vehPlate)
            local timeout = 5000
            local startTime = GetGameTimer()
            while not NetworkDoesNetworkIdExist(netId) do
                Wait(10)
                if GetGameTimer() - startTime > timeout then
                    inTestDrive = false
                    cb({ success = false, message = 'Failed to spawn test vehicle' })
                    return
                end
            end
            local veh = NetworkGetEntityFromNetworkId(netId)
            NetworkRequestControlOfEntity(veh)
            SetEntityAsMissionEntity(veh, true, true)
            Citizen.InvokeNative(0xAD738C3085FE7E11, veh, true, true)
            SetVehicleNumberPlateText(veh, vehPlate)
            SetVehicleDirtLevel(veh, 0.0)
            exports['LegacyFuel']:SetFuel(veh, 100)
            TriggerEvent('vehiclekeys:client:SetOwner', vehPlate)
            TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
            SetVehicleEngineOn(veh, true, true, false)
            testDriveVeh = netId
            createTestDriveReturn()
            startTestDriveTimer(Config.Shops[tempShop]['TestDriveTimeLimit'] * 60, prevCoords)
            cb({ success = true, message = 'Test drive started!' })
        end, 'TESTDRIVE', data.vehicle, Config.Shops[shopName]['TestDriveSpawn'], true)
    else
        cb({ success = false, message = 'You are already in a test drive!' })
    end
end)

-- Events (keeping for compatibility)
RegisterNetEvent('qb-vehicleshop:client:homeMenu', function()
    -- Deprecated - using NUI now
end)

RegisterNetEvent('qb-vehicleshop:client:showVehOptions', function()
    -- Deprecated - using NUI now
    if insideShop then
        TriggerEvent('qb-vehicleshop:client:openShop', insideShop)
    end
end)

RegisterNetEvent('qb-vehicleshop:client:TestDrive', function()
    if not inTestDrive and ClosestVehicle ~= 0 then
        inTestDrive = true
        local prevCoords = GetEntityCoords(PlayerPedId())
        tempShop = insideShop -- temp hacky way of setting the shop because it changes after the callback has returned since you are outside the zone
        QBCore.Functions.TriggerCallback('qb-vehicleshop:server:spawnvehicle', function(netId, properties, vehPlate)
            local timeout = 5000
            local startTime = GetGameTimer()
            while not NetworkDoesNetworkIdExist(netId) do
                Wait(10)
                if GetGameTimer() - startTime > timeout then
                    return
                end
            end
            local veh = NetworkGetEntityFromNetworkId(netId)
            NetworkRequestControlOfEntity(veh)
            SetEntityAsMissionEntity(veh, true, true)
            Citizen.InvokeNative(0xAD738C3085FE7E11, veh, true, true)
            SetVehicleNumberPlateText(veh, vehPlate)
            SetVehicleDirtLevel(veh, 0.0)
            exports['LegacyFuel']:SetFuel(veh, 100)
            TriggerEvent('vehiclekeys:client:SetOwner', vehPlate)
            TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
            SetVehicleEngineOn(veh, true, true, false)
            testDriveVeh = netId
            QBCore.Functions.Notify(Lang:t('general.testdrive_timenoti', { testdrivetime = Config.Shops[tempShop]['TestDriveTimeLimit'] }), "success")
        end, 'TESTDRIVE', Config.Shops[tempShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle, Config.Shops[tempShop]['TestDriveSpawn'], true) 

        createTestDriveReturn()
        startTestDriveTimer(Config.Shops[tempShop]['TestDriveTimeLimit'] * 60, prevCoords)
    else
        QBCore.Functions.Notify(Lang:t('error.testdrive_alreadyin'), 'error')
    end
end)

RegisterNetEvent('qb-vehicleshop:client:customTestDrive', function(data)
    if not inTestDrive then
        inTestDrive = true
        local vehicle = data
        local prevCoords = GetEntityCoords(PlayerPedId())
        tempShop = insideShop -- temp hacky way of setting the shop because it changes after the callback has returned since you are outside the zone
        QBCore.Functions.TriggerCallback('qb-vehicleshop:server:spawnvehicle', function(netId, properties, vehPlate)
            local timeout = 5000
            local startTime = GetGameTimer()
            while not NetworkDoesNetworkIdExist(netId) do
                Wait(10)
                if GetGameTimer() - startTime > timeout then
                    return
                end
            end
            local veh = NetworkGetEntityFromNetworkId(netId)
            NetworkRequestControlOfEntity(veh)
            SetEntityAsMissionEntity(veh, true, true)
            Citizen.InvokeNative(0xAD738C3085FE7E11, veh, true, true)
            SetVehicleNumberPlateText(veh, vehPlate)
            SetVehicleDirtLevel(veh, 0.0)
            exports['LegacyFuel']:SetFuel(veh, 100)
            TriggerEvent('vehiclekeys:client:SetOwner', vehPlate)
            TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
            SetVehicleEngineOn(veh, true, true, false)
            testDriveVeh = netId
            QBCore.Functions.Notify(Lang:t('general.testdrive_timenoti', { testdrivetime = Config.Shops[tempShop]['TestDriveTimeLimit'] }))
        end, 'TESTDRIVE', Config.Shops[tempShop]['ShowroomVehicles'][ClosestVehicle].chosenVehicle, Config.Shops[tempShop]['TestDriveSpawn'], true) 
        createTestDriveReturn()
        startTestDriveTimer(Config.Shops[tempShop]['TestDriveTimeLimit'] * 60, prevCoords)
    else
        QBCore.Functions.Notify(Lang:t('error.testdrive_alreadyin'), 'error')
    end
end)

RegisterNetEvent('qb-vehicleshop:client:TestDriveReturn', function()
    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped)
    local entity = NetworkGetEntityFromNetworkId(testDriveVeh)
    if veh == entity then
        testDriveVeh = 0
        inTestDrive = false
        DeleteEntity(veh)
        exports['qb-menu']:closeMenu()
        testDriveZone:destroy()
    else
        QBCore.Functions.Notify(Lang:t('error.testdrive_return'), 'error')
    end
end)

RegisterNetEvent('qb-vehicleshop:client:vehCategories', function(data)
    local catmenu = {}
    local firstvalue = nil
    local categoryMenu = {
        {
            header = Lang:t('menus.goback_header'),
            icon = 'fa-solid fa-angle-left',
            params = {
                event = Config.FilterByMake and 'qb-vehicleshop:client:vehMakes' or 'qb-vehicleshop:client:homeMenu'
            }
        }
    }
    for k, v in pairs(QBCore.Shared.Vehicles) do
        -- Show all vehicles except those with shop = 'none' and excluded categories
        local vehicleShop = QBCore.Shared.Vehicles[k]['shop']
        local vehicleCategory = v.category or 'compacts'
        local vehicleType = v.type or 'automobile'
        
        if vehicleShop ~= 'none' 
            and not excludedCategories[vehicleCategory] 
            and not excludedTypes[vehicleType]
            and (not Config.FilterByMake or QBCore.Shared.Vehicles[k]['brand'] == data.make) then
            catmenu[vehicleCategory] = vehicleCategory
            if firstvalue == nil then
                firstvalue = vehicleCategory
            end
        end
    end
    if Config.HideCategorySelectForOne and tablelength(catmenu) == 1 then
        TriggerEvent('qb-vehicleshop:client:openVehCats', { catName = firstvalue, make = Config.FilterByMake and data.make, onecat = true })
        return
    end
    for k, v in pairs(catmenu) do
        categoryMenu[#categoryMenu + 1] = {
            header = v,
            icon = 'fa-solid fa-circle',
            params = {
                event = 'qb-vehicleshop:client:openVehCats',
                args = {
                    catName = k,
                }
            }
        }
    end
    exports['qb-menu']:openMenu(categoryMenu, Config.SortAlphabetically, true)
end)

RegisterNetEvent('qb-vehicleshop:client:openVehCats', function(data)
    local vehMenu = {
        {
            header = Lang:t('menus.goback_header'),
            icon = 'fa-solid fa-angle-left',
            params = {
                event = 'qb-vehicleshop:client:vehCategories',
                args = {
                    make = data.make
                }
            }
        }
    }
    if data.onecat == true then
        vehMenu[1].params = {
            event = 'qb-vehicleshop:client:vehMakes'
        }
    end
    for k, v in pairs(QBCore.Shared.Vehicles) do
        local vehicleCategory = QBCore.Shared.Vehicles[k]['category'] or 'compacts'
        local vehicleType = QBCore.Shared.Vehicles[k]['type'] or 'automobile'
        
        if vehicleCategory == data.catName then
            -- Show all vehicles except those with shop = 'none' and excluded categories
            local vehicleShop = QBCore.Shared.Vehicles[k]['shop']
            if vehicleShop ~= 'none' 
                and not excludedCategories[vehicleCategory] 
                and not excludedTypes[vehicleType] then
                vehMenu[#vehMenu + 1] = {
                    header = v.name,
                    txt = Lang:t('menus.veh_price') .. v.price,
                    icon = 'fa-solid fa-car-side',
                    params = {
                        isServer = true,
                        event = 'qb-vehicleshop:server:swapVehicle',
                        args = {
                            toVehicle = v.model,
                            ClosestVehicle = ClosestVehicle,
                            ClosestShop = insideShop
                        }
                    }
                }
            end
        end
    end
    exports['qb-menu']:openMenu(vehMenu, Config.SortAlphabetically, true)
end)

RegisterNetEvent('qb-vehicleshop:client:vehMakes', function()
    local makmenu = {}
    local makeMenu = {
        {
            header = Lang:t('menus.goback_header'),
            icon = 'fa-solid fa-angle-left',
            params = {
                event = 'qb-vehicleshop:client:homeMenu'
            }
        }
    }
    for k, v in pairs(QBCore.Shared.Vehicles) do
        -- Show all vehicles except those with shop = 'none' and excluded categories
        local vehicleShop = QBCore.Shared.Vehicles[k]['shop']
        local vehicleCategory = v.category or 'compacts'
        local vehicleType = v.type or 'automobile'
        
        if vehicleShop ~= 'none' 
            and not excludedCategories[vehicleCategory] 
            and not excludedTypes[vehicleType] then
            makmenu[v.brand] = v.brand
        end
    end
    for _, v in pairs(makmenu) do
        makeMenu[#makeMenu + 1] = {
            header = v,
            icon = 'fa-solid fa-circle',
            params = {
                event = 'qb-vehicleshop:client:vehCategories',
                args = {
                    make = v
                }
            }
        }
    end
    exports['qb-menu']:openMenu(makeMenu, Config.SortAlphabetically, true)
end)

RegisterNetEvent('qb-vehicleshop:client:openFinance', function(data)
    local dialog = exports['qb-input']:ShowInput({
        header = getVehBrand():upper() .. ' ' .. data.buyVehicle:upper() .. ' - $' .. data.price,
        submitText = Lang:t('menus.submit_text'),
        inputs = {
            {
                type = 'number',
                isRequired = true,
                name = 'downPayment',
                text = Lang:t('menus.financesubmit_downpayment') .. Config.MinimumDown .. '%'
            },
            {
                type = 'number',
                isRequired = true,
                name = 'paymentAmount',
                text = Lang:t('menus.financesubmit_totalpayment') .. Config.MaximumPayments
            }
        }
    })
    if dialog then
        if not dialog.downPayment or not dialog.paymentAmount then return end
        TriggerServerEvent('qb-vehicleshop:server:financeVehicle', dialog.downPayment, dialog.paymentAmount, data.buyVehicle)
    end
end)

RegisterNetEvent('qb-vehicleshop:client:openCustomFinance', function(data)
    local dialog = exports['qb-input']:ShowInput({
        header = getVehBrand():upper() .. ' ' .. data.vehicle:upper() .. ' - $' .. data.price,
        submitText = Lang:t('menus.submit_text'),
        inputs = {
            {
                type = 'number',
                isRequired = true,
                name = 'downPayment',
                text = Lang:t('menus.financesubmit_downpayment') .. Config.MinimumDown .. '%'
            },
            {
                type = 'number',
                isRequired = true,
                name = 'paymentAmount',
                text = Lang:t('menus.financesubmit_totalpayment') .. Config.MaximumPayments
            },
            {
                text = Lang:t('menus.submit_ID'),
                name = 'playerid',
                type = 'number',
                isRequired = true
            }
        }
    })
    if dialog then
        if not dialog.downPayment or not dialog.paymentAmount or not dialog.playerid then return end
        TriggerServerEvent('qb-vehicleshop:server:sellfinanceVehicle', dialog.downPayment, dialog.paymentAmount, data.vehicle, dialog.playerid)
    end
end)

RegisterNetEvent('qb-vehicleshop:client:swapVehicle', function(data)
    local shopName = data.ClosestShop
    
    local primaryColor = tonumber(data.primaryColor) or 0
    local secondaryColor = tonumber(data.secondaryColor) or 0
    
    if Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].chosenVehicle ~= data.toVehicle then
        local closestVehicle, closestDistance = QBCore.Functions.GetClosestVehicle(vector3(Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.x, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.y, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.z))
        if closestVehicle == 0 then return end
        if closestDistance < 5 then DeleteEntity(closestVehicle) end
        while DoesEntityExist(closestVehicle) do
            Wait(50)
        end
        Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].chosenVehicle = data.toVehicle
        local model = GetHashKey(data.toVehicle)
        RequestModel(model)
        while not HasModelLoaded(model) do
            Wait(50)
        end
        local veh = CreateVehicle(model, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.x, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.y, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.z, false, false)
        while not DoesEntityExist(veh) do
            Wait(50)
        end
        SetModelAsNoLongerNeeded(model)
        SetVehicleOnGroundProperly(veh)
        SetEntityInvincible(veh, true)
        SetEntityHeading(veh, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.w)
        SetVehicleDoorsLocked(veh, 3)
        FreezeEntityPosition(veh, true)
        SetVehicleNumberPlateText(veh, 'BUY ME')
        SetVehicleDirtLevel(veh, 0.0)
        
        -- Wait a frame to ensure vehicle is fully initialized
        Wait(200)
        
        -- Apply colors using QBCore's SetVehicleProperties which handles colors correctly
        local vehProps = {
            color1 = primaryColor,
            color2 = secondaryColor
        }
        QBCore.Functions.SetVehicleProperties(veh, vehProps)
        
        if Config.UsingTarget then createVehZones(shopName, veh) end
    else
        -- Vehicle is already displayed, but update colors if they changed
        local closestVehicle, closestDistance = QBCore.Functions.GetClosestVehicle(vector3(Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.x, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.y, Config.Shops[shopName]['ShowroomVehicles'][data.ClosestVehicle].coords.z))
        if closestVehicle ~= 0 and closestDistance < 5 then
            Wait(100)
            
            -- Apply colors using QBCore's SetVehicleProperties which handles colors correctly
            local vehProps = {
                color1 = primaryColor,
                color2 = secondaryColor
            }
            QBCore.Functions.SetVehicleProperties(closestVehicle, vehProps)
        end
    end
end)

RegisterNetEvent('qb-vehicleshop:client:buyShowroomVehicle', function(vehicle, plate, spawnLocation, primaryColor, secondaryColor)
    local shopName = insideShop or tempShop
    local spawnCoords = spawnLocation or (shopName and Config.Shops[shopName] and Config.Shops[shopName]['VehicleSpawn']) or vector4(0, 0, 0, 0)
    
    if spawnCoords == vector4(0, 0, 0, 0) then
        QBCore.Functions.Notify('Error: No spawn location found', 'error')
        return
    end
    
    QBCore.Functions.TriggerCallback('qb-vehicleshop:server:spawnvehicle', function(netId, properties, vehPlate)
        while not NetworkDoesNetworkIdExist(netId) do Wait(10) end
        local veh = NetworkGetEntityFromNetworkId(netId)
        Citizen.Await(CheckPlate(veh, vehPlate))
        
        -- Apply colors if provided (always apply, 0 is valid for black)
        local currentProps = QBCore.Functions.GetVehicleProperties(veh)
        if primaryColor ~= nil then
            currentProps.color1 = primaryColor
        end
        if secondaryColor ~= nil then
            currentProps.color2 = secondaryColor
        end
        -- Merge with any other properties from the database
        if properties then
            for k, v in pairs(properties) do
                if k ~= 'color1' and k ~= 'color2' then
                    currentProps[k] = v
                end
            end
        end
        QBCore.Functions.SetVehicleProperties(veh, currentProps)
        SetVehicleDirtLevel(veh, 0.0)
        
        exports['LegacyFuel']:SetFuel(veh, 100)
        TriggerEvent('vehiclekeys:client:SetOwner', vehPlate)
        TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
        SetVehicleEngineOn(veh, true, true, false)
    end, plate, vehicle, spawnCoords, true)
end)

RegisterNetEvent('qb-vehicleshop:client:getVehicles', function()
    QBCore.Functions.TriggerCallback('qb-vehicleshop:server:getVehicles', function(vehicles)
        local ownedVehicles = {}
        for _, v in pairs(vehicles) do
            local vehData = QBCore.Shared.Vehicles[v.vehicle]
            -- Show all financed vehicles regardless of shop
            if v.balance ~= 0 and vehData then
                local plate = v.plate:upper()
                ownedVehicles[#ownedVehicles + 1] = {
                    header = vehData.name,
                    txt = Lang:t('menus.veh_platetxt') .. plate,
                    icon = 'fa-solid fa-car-side',
                    params = {
                        event = 'qb-vehicleshop:client:getVehicleFinance',
                        args = {
                            vehiclePlate = plate,
                            balance = v.balance,
                            paymentsLeft = v.paymentsleft,
                            paymentAmount = v.paymentamount
                        }
                    }
                }
            end
        end
        if #ownedVehicles > 0 then
            exports['qb-menu']:openMenu(ownedVehicles)
        else
            QBCore.Functions.Notify(Lang:t('error.nofinanced'), 'error', 7500)
        end
    end)
end)

RegisterNetEvent('qb-vehicleshop:client:getVehicleFinance', function(data)
    local vehFinance = {
        {
            header = Lang:t('menus.goback_header'),
            params = {
                event = 'qb-vehicleshop:client:getVehicles'
            }
        },
        {
            isMenuHeader = true,
            icon = 'fa-solid fa-sack-dollar',
            header = Lang:t('menus.veh_finance_balance'),
            txt = Lang:t('menus.veh_finance_currency') .. comma_value(data.balance)
        },
        {
            isMenuHeader = true,
            icon = 'fa-solid fa-hashtag',
            header = Lang:t('menus.veh_finance_total'),
            txt = data.paymentsLeft
        },
        {
            isMenuHeader = true,
            icon = 'fa-solid fa-sack-dollar',
            header = Lang:t('menus.veh_finance_reccuring'),
            txt = Lang:t('menus.veh_finance_currency') .. comma_value(data.paymentAmount)
        },
        {
            header = Lang:t('menus.veh_finance_pay'),
            icon = 'fa-solid fa-hand-holding-dollar',
            params = {
                event = 'qb-vehicleshop:client:financePayment',
                args = {
                    vehData = data,
                    paymentsLeft = data.paymentsleft,
                    paymentAmount = data.paymentamount
                }
            }
        },
        {
            header = Lang:t('menus.veh_finance_payoff'),
            icon = 'fa-solid fa-hand-holding-dollar',
            params = {
                isServer = true,
                event = 'qb-vehicleshop:server:financePaymentFull',
                args = {
                    vehBalance = data.balance,
                    vehPlate = data.vehiclePlate
                }
            }
        },
    }
    exports['qb-menu']:openMenu(vehFinance)
end)

RegisterNetEvent('qb-vehicleshop:client:financePayment', function(data)
    local dialog = exports['qb-input']:ShowInput({
        header = Lang:t('menus.veh_finance'),
        submitText = Lang:t('menus.veh_finance_pay'),
        inputs = {
            {
                type = 'number',
                isRequired = true,
                name = 'paymentAmount',
                text = Lang:t('menus.veh_finance_payment')
            }
        }
    })
    if dialog then
        if not dialog.paymentAmount then return end
        TriggerServerEvent('qb-vehicleshop:server:financePayment', dialog.paymentAmount, data.vehData)
    end
end)

RegisterNetEvent('qb-vehicleshop:client:openIdMenu', function(data)
    local dialog = exports['qb-input']:ShowInput({
        header = QBCore.Shared.Vehicles[data.vehicle]['name'],
        submitText = Lang:t('menus.submit_text'),
        inputs = {
            {
                text = Lang:t('menus.submit_ID'),
                name = 'playerid',
                type = 'number',
                isRequired = true
            }
        }
    })
    if dialog then
        if not dialog.playerid then return end
        if data.type == 'testDrive' then
            TriggerServerEvent('qb-vehicleshop:server:customTestDrive', data.vehicle, dialog.playerid)
        elseif data.type == 'sellVehicle' then
            TriggerServerEvent('qb-vehicleshop:server:sellShowroomVehicle', data.vehicle, dialog.playerid)
        end
    end
end)

-- Threads
CreateThread(function()
    for k, v in pairs(Config.Shops) do
        if v.showBlip then
            local Dealer = AddBlipForCoord(Config.Shops[k]['Location'])
            SetBlipSprite(Dealer, Config.Shops[k]['blipSprite'])
            SetBlipDisplay(Dealer, 4)
            SetBlipScale(Dealer, 0.70)
            SetBlipAsShortRange(Dealer, true)
            SetBlipColour(Dealer, Config.Shops[k]['blipColor'])
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(Config.Shops[k]['ShopLabel'])
            EndTextCommandSetBlipName(Dealer)
        end
    end
end)
