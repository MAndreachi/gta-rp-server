local QBCore = exports['qb-core']:GetCoreObject()
local garbageVehicle = nil
local hasBag = false
local currentStop = 0
local deliveryBlip = nil
local amountOfBags = 0
local garbageObject = nil
local endBlip = nil
local garbageBlip = nil
local canTakeBag = true
local currentStopNum = 0
local PZone = nil
local listen = false
local finished = false
local continueworking = false
local playerJob = {}
local isMenuOpen = false
local allStops = {} -- All stops in current route
local stopBlips = {} -- Blips for all stops {stopId = blip}
local stopBlipHandles = {} -- List of blip handles for cleanup
local stopZones = {} -- PolyZones for all stops {stopId = zone}
local completedStops = {} -- Track which stops are completed {stopId = true/false}
local currentActiveStop = nil -- Currently active stop being worked on
-- Handlers

-- Functions

local function setupClient()
    garbageVehicle = nil
    hasBag = false
    currentStop = 0
    deliveryBlip = nil
    amountOfBags = 0
    garbageObject = nil
    endBlip = nil
    currentStopNum = 0
    allStops = {}
    completedStops = {}
    currentActiveStop = nil
    -- Clear all stop blips
    for stopId, blip in pairs(stopBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    stopBlips = {}
    -- Clear all stop zones
    for stopId, zone in pairs(stopZones) do
        if zone and zone.destroy then
            zone:destroy()
        end
    end
    stopZones = {}
    
    if playerJob.name == Config.Jobname then
        garbageBlip = AddBlipForCoord(Config.Locations["main"].coords.x, Config.Locations["main"].coords.y, Config.Locations["main"].coords.z)
        SetBlipSprite(garbageBlip, 318)
        SetBlipDisplay(garbageBlip, 4)
        SetBlipScale(garbageBlip, 1.0)
        SetBlipAsShortRange(garbageBlip, true)
        SetBlipColour(garbageBlip, 39)
        BeginTextCommandSetBlipName("STRING")
        AddTextComponentSubstringPlayerName(Config.Locations["main"].label)
        EndTextCommandSetBlipName(garbageBlip)
    end
end



local function LoadAnimation(dict)
    RequestAnimDict(dict)
    while not HasAnimDictLoaded(dict) do Wait(10) end
end

local function BringBackCar()
    DeleteVehicle(garbageVehicle)
    if endBlip then
        RemoveBlip(endBlip)
    end
    if deliveryBlip then
        RemoveBlip(deliveryBlip)
    end
    -- Clear all stop blips
    for stopId, blip in pairs(stopBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    stopBlips = {}
    -- Clear all stop zones
    for stopId, zone in pairs(stopZones) do
        if zone and zone.destroy then
            zone:destroy()
        end
    end
    stopZones = {}
    -- Clear old PZone if it exists
    if PZone then
        DeleteZone()
    end
    garbageVehicle = nil
    hasBag = false
    currentStop = 0
    deliveryBlip = nil
    amountOfBags = 0
    garbageObject = nil
    endBlip = nil
    currentStopNum = 0
    allStops = {}
    completedStops = {}
    currentActiveStop = nil
end

local function DeleteZone()
    listen = false
    if PZone and PZone.destroy then
        PZone:destroy()
        PZone = nil
    end
end

local function SetRouteBack()
    local depot = Config.Locations["main"].coords
    endBlip = AddBlipForCoord(depot.x, depot.y, depot.z)
    SetBlipSprite(endBlip, 1)
    SetBlipDisplay(endBlip, 2)
    SetBlipScale(endBlip, 1.0)
    SetBlipAsShortRange(endBlip, false)
    SetBlipColour(endBlip, 3)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentSubstringPlayerName(Config.Locations["vehicle"].label)
    EndTextCommandSetBlipName(endBlip)
    SetBlipRoute(endBlip, true)
    DeleteZone()
    finished = true
end

local function AnimCheck()
    CreateThread(function()
        local ped = PlayerPedId()
        while hasBag and not IsEntityPlayingAnim(ped, 'missfbi4prepp1', '_bag_throw_garbage_man',3) do
            if not IsEntityPlayingAnim(ped, 'missfbi4prepp1', '_bag_walk_garbage_man', 3) then
                ClearPedTasksImmediately(ped)
                LoadAnimation('missfbi4prepp1')
                TaskPlayAnim(ped, 'missfbi4prepp1', '_bag_walk_garbage_man', 6.0, -6.0, -1, 49, 0, 0, 0, 0)
            end
            Wait(1000)
        end
    end)
end

local function DeliverAnim()
    local ped = PlayerPedId()
    LoadAnimation('missfbi4prepp1')
    TaskPlayAnim(ped, 'missfbi4prepp1', '_bag_throw_garbage_man', 8.0, 8.0, 1100, 48, 0.0, 0, 0, 0)
    FreezeEntityPosition(ped, true)
    SetEntityHeading(ped, GetEntityHeading(garbageVehicle))
    canTakeBag = false
    SetTimeout(1250, function()
        DetachEntity(garbageObject, 1, false)
        DeleteObject(garbageObject)
        TaskPlayAnim(ped, 'missfbi4prepp1', 'exit', 8.0, 8.0, 1100, 48, 0.0, 0, 0, 0)
        FreezeEntityPosition(ped, false)
        garbageObject = nil
        canTakeBag = true
    end)
    if Config.UseTarget and hasBag then
        hasBag = false
        local pos = GetEntityCoords(ped)
        exports['qb-target']:RemoveTargetEntity(garbageVehicle)
        if currentActiveStop then
            if (amountOfBags - 1) <= 0 then
                -- Mark this stop as complete
                local completedStopId = currentActiveStop
                
                -- Remove blip immediately (don't wait for server)
                completedStops[completedStopId] = true
                RemoveStopBlip(completedStopId)
                
                QBCore.Functions.TriggerCallback('qb-garbagejob:server:CompleteStop', function(success, allCompleted, stopsCompleted, totalStops)
                    if success then
                        -- Already marked as completed and blip removed above
                        
                        -- Clear current active stop
                        currentActiveStop = nil
                        amountOfBags = 0
                        
                        if allCompleted then
                            -- All stops done!
                            QBCore.Functions.Notify(Lang:t("info.done_working"), "success")
                            SetVehicleDoorShut(garbageVehicle, 5, false)
                            SetRouteBack()
                        else
                            QBCore.Functions.Notify(Lang:t("info.all_bags") .. " (" .. stopsCompleted .. "/" .. totalStops .. " stops)", "success")
                            SetVehicleDoorShut(garbageVehicle, 5, false)
                            -- Player can now visit any remaining stop
                        end
                    end
                end, currentActiveStop, pos)
            else
                -- You haven't delivered all bags here
                amountOfBags = amountOfBags - 1
                if amountOfBags > 1 then
                    QBCore.Functions.Notify(Lang:t("info.bags_left", { value = amountOfBags }))
                else
                    QBCore.Functions.Notify(Lang:t("info.bags_still", { value = amountOfBags }))
                end
                -- Target zones are already created, no need to re-add
            end
        end
    end
end

function TakeAnim()
    local ped = PlayerPedId()
    QBCore.Functions.Progressbar("bag_pickup", Lang:t("info.picking_bag"), math.random(3000, 5000), false, true, {
        disableMovement = true,
        disableCarMovement = true,
        disableMouse = false,
        disableCombat = true,
    }, {
        animDict = "anim@amb@clubhouse@tutorial@bkr_tut_ig3@",
        anim = "machinic_loop_mechandplayer",
        flags = 16,
    }, {}, {}, function()
        LoadAnimation('missfbi4prepp1')
        TaskPlayAnim(ped, 'missfbi4prepp1', '_bag_walk_garbage_man', 6.0, -6.0, -1, 49, 0, 0, 0, 0)
        garbageObject = CreateObject(`prop_cs_rub_binbag_01`, 0, 0, 0, true, true, true)
        AttachEntityToEntity(garbageObject, ped, GetPedBoneIndex(ped, 57005), 0.12, 0.0, -0.05, 220.0, 120.0, 0.0, true, true, false, true, 1, true)
        StopAnimTask(PlayerPedId(), "anim@amb@clubhouse@tutorial@bkr_tut_ig3@", "machinic_loop_mechandplayer", 1.0)
        AnimCheck()
        if Config.UseTarget and not hasBag then
            hasBag = true
            -- Target zones stay active, we just add the vehicle target
            exports['qb-target']:AddTargetEntity(garbageVehicle, {
            options = {
                {label = Lang:t("target.dispose_garbage"),icon = 'fa-solid fa-truck',action = function() DeliverAnim() end,canInteract = function() if hasBag then return true end return false end, }
            },
            distance = 2.0
            })
        end
    end, function()
        StopAnimTask(PlayerPedId(), "anim@amb@clubhouse@tutorial@bkr_tut_ig3@", "machinic_loop_mechandplayer", 1.0)
        QBCore.Functions.Notify(Lang:t("error.cancled"), "error")
    end)
end

-- Clean up all route data (blips, zones, etc.) - used when starting new route or canceling
local function CleanupRoute()
    print("^2[qb-garbagejob] Cleaning up route data^0")

    -- Remove any existing blips
    local blipsRemoved = 0
    for _, blip in ipairs(stopBlipHandles) do
        if blip and DoesBlipExist(blip) then
            RemoveBlip(blip)
            blipsRemoved = blipsRemoved + 1
        end
    end
    stopBlipHandles = {}
    stopBlips = {}
    print("^2[qb-garbagejob] Removed " .. blipsRemoved .. " blips^0")

    -- Remove target zones if using qb-target
    if Config.UseTarget then
        local cleanedStops = {}
        for i = 1, #allStops do
            local stopEntry = allStops[i]
            if stopEntry and stopEntry.stop and not cleanedStops[stopEntry.stop] then
                exports['qb-target']:RemoveZone('garbagebin_' .. stopEntry.stop)
                cleanedStops[stopEntry.stop] = true
            end
        end
    end

    -- Remove PolyZones
    for stopId, zone in pairs(stopZones) do
        if zone and zone.destroy then
            zone:destroy()
        end
    end
    stopZones = {}

    -- Remove active blips/routes
    if deliveryBlip and DoesBlipExist(deliveryBlip) then
        RemoveBlip(deliveryBlip)
    end
    deliveryBlip = nil

    if endBlip and DoesBlipExist(endBlip) then
        RemoveBlip(endBlip)
    end
    endBlip = nil

    -- Remove any active zone
    if PZone then
        DeleteZone()
    end

    -- Reset state
    listen = false
    hasBag = false
    finished = false
    currentActiveStop = nil
    currentStop = 0
    currentStopNum = 0
    amountOfBags = 0
    canTakeBag = true

    -- Clear any carried garbage object
    if garbageObject and DoesEntityExist(garbageObject) then
        DeleteObject(garbageObject)
    end
    garbageObject = nil

    allStops = {}
    completedStops = {}

    print("^2[qb-garbagejob] Route cleanup complete^0")
end

-- Remove blip, target zone, and PolyZone for a specific stop
local function RemoveStopBlip(stopId)
    if not stopId then
        print("^1[qb-garbagejob] ERROR: RemoveStopBlip called with nil stopId^0")
        return
    end

    print("^2[qb-garbagejob] Removing blip for stop " .. stopId .. "^0")

    local blipHandle = stopBlips[stopId]

    -- Remove blip
    if blipHandle and DoesBlipExist(blipHandle) then
        RemoveBlip(blipHandle)
        print("^2[qb-garbagejob] Blip removed for stop " .. stopId .. "^0")
    else
        if blipHandle then
            print("^3[qb-garbagejob] Blip handle for stop " .. stopId .. " no longer exists^0")
        else
            print("^3[qb-garbagejob] No blip found for stop " .. stopId .. "^0")
        end
    end
    stopBlips[stopId] = nil

    -- Remove handle from cleanup list
    if blipHandle then
        for idx = #stopBlipHandles, 1, -1 do
            if stopBlipHandles[idx] == blipHandle then
                table.remove(stopBlipHandles, idx)
                break
            end
        end
    end

    -- Remove target zone if using target system
    if Config.UseTarget then
        exports['qb-target']:RemoveZone('garbagebin_' .. stopId)
        print("^2[qb-garbagejob] Target zone removed for stop " .. stopId .. "^0")
    end

    -- Remove PolyZone if using non-target system
    if not Config.UseTarget then
        if stopZones[stopId] and stopZones[stopId].destroy then
            stopZones[stopId]:destroy()
            stopZones[stopId] = nil
        end
        print("^2[qb-garbagejob] PolyZone removed for stop " .. stopId .. "^0")
    end
end

-- Check which stop player is near
local function GetNearestStop()
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    local nearestStop = nil
    local nearestDist = 999999.0
    
    for i = 1, #allStops do
        local stopData = allStops[i]
        local stopId = stopData.stop
        if not completedStops[stopId] then
            local CL = Config.Locations["trashcan"][stopId]
            if CL then
                local dist = #(pos - vector3(CL.coords.x, CL.coords.y, CL.coords.z))
                if dist < nearestDist and dist < 15.0 then
                    nearestDist = dist
                    nearestStop = stopId
                end
            end
        end
    end
    
    return nearestStop, nearestDist
end

local function RunWorkLoop()
    CreateThread(function()
        local GarbText = false
        while listen do
            local ped = PlayerPedId()
            local pos = GetEntityCoords(ped)
            local nearestStop, Distance = GetNearestStop()
            
            -- If player is near a stop, activate it (only if not already completed)
            if nearestStop and not currentActiveStop and not completedStops[nearestStop] then
                SetGarbageRouteForStop(nearestStop)
            end
            
            -- Use current active stop for distance checks
            if currentActiveStop then
                local DeliveryData = Config.Locations["trashcan"][currentActiveStop]
                Distance = #(pos - vector3(DeliveryData.coords.x, DeliveryData.coords.y, DeliveryData.coords.z))
            end
            
            if (currentActiveStop and Distance < 15) or hasBag then

                if not hasBag and canTakeBag then
                    if Distance < 1.5 then
                        if not GarbText then
                            GarbText = true
                            exports['qb-core']:DrawText(Lang:t("info.grab_garbage"), 'left')
                        end
                        if IsControlJustPressed(0, 51) then
                            hasBag = true
                            exports['qb-core']:HideText()
                            TakeAnim()
                        end
                    elseif Distance < 10 then
                        if GarbText then
                            GarbText = false
                            exports['qb-core']:HideText()
                        end
                    end
                else
                    if DoesEntityExist(garbageVehicle) then
                        local Coords = GetOffsetFromEntityInWorldCoords(garbageVehicle, 0.0, -4.5, 0.0)
                        local TruckDist = #(pos - Coords)
                        local TrucText = false

                        if TruckDist < 2 then
                            if not TrucText then
                                TrucText = true
                                exports['qb-core']:DrawText(Lang:t("info.dispose_garbage"), 'left')
                            end
                            if IsControlJustPressed(0, 51) and hasBag then
                                StopAnimTask(PlayerPedId(), 'missfbi4prepp1', '_bag_walk_garbage_man', 1.0)
                                DeliverAnim()
                                QBCore.Functions.Progressbar("deliverbag", Lang:t("info.progressbar"), 2000, false, true, {
                                        disableMovement = true,
                                        disableCarMovement = true,
                                        disableMouse = false,
                                        disableCombat = true,
                                    }, {}, {}, {}, function() -- Done
                                        hasBag = false
                                        canTakeBag = false
                                        DetachEntity(garbageObject, 1, false)
                                        DeleteObject(garbageObject)
                                        FreezeEntityPosition(ped, false)
                                        garbageObject = nil
                                        canTakeBag = true
                                        -- Check if all bags for this stop are delivered
                                        if (amountOfBags - 1) <= 0 then
                                            -- Mark this stop as complete
                                            if currentActiveStop then
                                                local completedStopId = currentActiveStop
                                                
                                                -- Remove blip immediately (don't wait for server)
                                                completedStops[completedStopId] = true
                                                RemoveStopBlip(completedStopId)
                                                
                                                QBCore.Functions.TriggerCallback('qb-garbagejob:server:CompleteStop', function(success, allCompleted, stopsCompleted, totalStops)
                                                    if success then
                                                        -- Already marked as completed and blip removed above
                                                        
                                                        -- Clear current active stop
                                                        currentActiveStop = nil
                                                        amountOfBags = 0
                                                        
                                                        if allCompleted then
                                                            -- All stops done!
                                                            QBCore.Functions.Notify(Lang:t("info.done_working"), "success")
                                                            SetVehicleDoorShut(garbageVehicle, 5, false)
                                                            SetRouteBack()
                                                            listen = false
                                                        else
                                                            QBCore.Functions.Notify(Lang:t("info.all_bags") .. " (" .. stopsCompleted .. "/" .. totalStops .. " stops)", "success")
                                                            SetVehicleDoorShut(garbageVehicle, 5, false)
                                                            listen = false
                                                            -- Player can now visit any remaining stop
                                                        end
                                                    end
                                                end, currentActiveStop, pos)
                                            end
                                            hasBag = false
                                        else
                                            -- You haven't delivered all bags here
                                            amountOfBags = amountOfBags - 1
                                            if amountOfBags > 1 then
                                                QBCore.Functions.Notify(Lang:t("info.bags_left", { value = amountOfBags }))
                                            else
                                                QBCore.Functions.Notify(Lang:t("info.bags_still", { value = amountOfBags }))
                                            end
                                            hasBag = false
                                        end

                                        Wait(1500)
                                        if TrucText then
                                            exports['qb-core']:HideText()
                                            TrucText = false
                                        end
                                    end, function() -- Cancel
                                    QBCore.Functions.Notify(Lang:t("error.cancled"), "error")
                                end)

                            end
                        end
                    else
                        QBCore.Functions.Notify(Lang:t("error.no_truck"), "error")
                        hasBag = false
                    end
                end
            end
            Wait(1)
        end
    end)
end

-- Create PolyZone for a specific stop
local function CreateStopZone(stopId, x, y, z)
    if stopZones[stopId] then
        -- Zone already exists, don't recreate
        return
    end
    
    CreateThread(function()
        local zone = CircleZone:Create(vector3(x, y, z), 15.0, {
            name = "GarbageStopZone_" .. stopId,
            debugPoly = false,
        })

        zone:onPlayerInOut(function(isPointInside)
            if isPointInside then
                -- Check if this stop is completed
                if completedStops[stopId] == true then
                    return
                end
                
                -- Activate this stop
                if not currentActiveStop or currentActiveStop ~= stopId then
                    SetGarbageRouteForStop(stopId)
                end
                
                if not Config.UseTarget then
                    listen = true
                    RunWorkLoop()
                end
                if garbageVehicle and DoesEntityExist(garbageVehicle) then
                    SetVehicleDoorOpen(garbageVehicle,5,false,false)
                end
            else
                if not Config.UseTarget then
                    exports['qb-core']:HideText()
                    listen = false
                end
                if garbageVehicle and DoesEntityExist(garbageVehicle) then
                    SetVehicleDoorShut(garbageVehicle, 5, false)
                end
                -- Clear active stop when leaving zone (allows visiting different stops)
                if not hasBag and currentActiveStop == stopId then
                    currentActiveStop = nil
                end
            end
        end)
        
        stopZones[stopId] = zone
    end)
end

-- Create PolyZones for all stops (non-target mode)
local function CreateAllStopZones()
    if Config.UseTarget then return end -- Only needed for non-target mode
    
    print("^2[qb-garbagejob] Creating PolyZones for " .. #allStops .. " stops^0")
    
    -- Clear existing zones first
    for stopId, zone in pairs(stopZones) do
        if zone and zone.destroy then
            zone:destroy()
        end
    end
    stopZones = {}
    
    -- Create zone for each stop
    for i = 1, #allStops do
        local stopData = allStops[i]
        local stopId = stopData.stop
        local CL = Config.Locations["trashcan"][stopId]
        
        if CL and not completedStops[stopId] then
            CreateStopZone(stopId, CL.coords.x, CL.coords.y, CL.coords.z)
            print("^2[qb-garbagejob] Created PolyZone for stop " .. stopId .. " at " .. CL.name .. "^0")
        end
    end
end

-- Remove PolyZone for a specific stop
local function RemoveStopZone(stopId)
    if stopZones[stopId] then
        if stopZones[stopId].destroy then
            stopZones[stopId]:destroy()
        end
        stopZones[stopId] = nil
    end
end

-- Create target zones for all stops (if using target system)
local function CreateAllTargetZones()
    if not Config.UseTarget then 
        print("^3[qb-garbagejob] Target system not enabled, skipping target zone creation^0")
        return 
    end
    
    if not allStops or #allStops == 0 then
        print("^1[qb-garbagejob] ERROR: allStops is empty when trying to create target zones^0")
        return
    end
    
    print("^2[qb-garbagejob] Creating target zones for " .. #allStops .. " stops^0")
    
    -- Remove any existing target zones first
    for i = 1, #allStops do
        local stopId = allStops[i].stop
        exports['qb-target']:RemoveZone('garbagebin_' .. stopId)
    end
    
    -- Create target zone for each stop
    for i = 1, #allStops do
        local stopData = allStops[i]
        local stopId = stopData.stop
        local CL = Config.Locations["trashcan"][stopId]
        
        if not CL then
            print("^1[qb-garbagejob] ERROR: No location data for stop ID " .. stopId .. "^0")
        else
            -- Check if stop is completed (safe check - nil or false means not completed)
            local isCompleted = completedStops[stopId] == true
            
            if isCompleted then
                print("^3[qb-garbagejob] Skipping stop " .. stopId .. " (already completed)^0")
            else
                print("^2[qb-garbagejob] Creating target zone for stop " .. stopId .. " at " .. CL.name .. "^0")
                exports['qb-target']:AddCircleZone('garbagebin_' .. stopId, vector3(CL.coords.x, CL.coords.y, CL.coords.z), 2.0,{
                    name = 'garbagebin_' .. stopId, debugPoly = false, useZ=true }, {
                    options = {{label = Lang:t("target.grab_garbage"), icon = 'fa-solid fa-trash', action = function() 
                        print("^2[qb-garbagejob] Target zone clicked for stop " .. stopId .. "^0")
                        -- Check if this stop is completed
                        if completedStops[stopId] == true then
                            QBCore.Functions.Notify("This stop is already completed", "error")
                            return
                        end
                        -- Activate this stop if not already active
                        if not currentActiveStop or currentActiveStop ~= stopId then
                            print("^2[qb-garbagejob] Activating stop " .. stopId .. "^0")
                            SetGarbageRouteForStop(stopId)
                        end
                        TakeAnim() 
                    end }},
                    distance = 2.0
                })
            end
        end
    end
    print("^2[qb-garbagejob] Finished creating target zones^0")
end

-- Create blips for all stops
local function CreateAllStopBlips()
    print("^2[qb-garbagejob] Creating blips for " .. #allStops .. " stops^0")

    -- Clear existing blips first
    for _, blip in ipairs(stopBlipHandles) do
        if blip and DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    stopBlipHandles = {}
    stopBlips = {}

    -- Create blip for each stop
    for i = 1, #allStops do
        local stopData = allStops[i]
        local stopId = stopData.stop
        local CL = Config.Locations["trashcan"][stopId]

        if CL then
            -- Check if stop is already completed
            if completedStops[stopId] == true then
                print("^3[qb-garbagejob] Skipping blip for stop " .. stopId .. " (already completed)^0")
            else
                local blip = AddBlipForCoord(CL.coords.x, CL.coords.y, CL.coords.z)
                SetBlipSprite(blip, 1)
                SetBlipDisplay(blip, 2)
                SetBlipScale(blip, 0.8)
                SetBlipAsShortRange(blip, false)
                SetBlipColour(blip, 27) -- Yellow/orange for garbage
                BeginTextCommandSetBlipName("STRING")
                AddTextComponentSubstringPlayerName(CL.name .. " (" .. stopData.bags .. " bags)")
                EndTextCommandSetBlipName(blip)
                SetBlipRoute(blip, false) -- Don't set route, player chooses
                stopBlips[stopId] = blip
                stopBlipHandles[#stopBlipHandles + 1] = blip
                print("^2[qb-garbagejob] Created blip for stop " .. stopId .. " at " .. CL.name .. " (" .. stopData.bags .. " bags)^0")
            end
        else
            print("^1[qb-garbagejob] ERROR: No location data for stop ID " .. stopId .. "^0")
        end
    end
    print("^2[qb-garbagejob] Finished creating blips^0")
end

-- Set up zone for a specific stop
function SetGarbageRouteForStop(stopId)
    if not stopId or completedStops[stopId] == true then
        print("^3[qb-garbagejob] Cannot activate stop " .. tostring(stopId) .. " (completed or invalid)^0")
        return
    end
    
    local CL = Config.Locations["trashcan"][stopId]
    if not CL then 
        print("^1[qb-garbagejob] ERROR: No location data for stop " .. stopId .. "^0")
        return 
    end
    
    currentActiveStop = stopId
    -- Find bag amount for this stop in current route
    amountOfBags = 0
    for i = 1, #allStops do
        if allStops[i].stop == stopId then
            amountOfBags = allStops[i].bags
            break
        end
    end
    
    if amountOfBags == 0 then
        print("^1[qb-garbagejob] WARNING: Stop " .. stopId .. " not found in current route! This might be from an old route.^0")
        -- Don't activate if it's not in current route
        currentActiveStop = nil
        return
    end
    
    finished = false
    -- Zones are already created for all stops, we just need to activate this one
    print("^2[qb-garbagejob] Activated stop " .. stopId .. " with " .. amountOfBags .. " bags^0")
end

local ControlListen = false
local function Listen4Control()
    ControlListen = true
    CreateThread(function()
        while ControlListen do
            if IsControlJustReleased(0, 38) then
                TriggerEvent("qb-garbagejob:client:MainMenu")
            end
            Wait(1)
        end
    end)
end

local pedsSpawned = false
local function spawnPeds()
    if not Config.Peds or not next(Config.Peds) or pedsSpawned then return end
    for i = 1, #Config.Peds do
        local current = Config.Peds[i]
        current.model = type(current.model) == 'string' and GetHashKey(current.model) or current.model
        RequestModel(current.model)
        while not HasModelLoaded(current.model) do
            Wait(0)
        end
        local ped = CreatePed(0, current.model, current.coords, false, false)
        FreezeEntityPosition(ped, true)
        SetEntityInvincible(ped, true)
        SetBlockingOfNonTemporaryEvents(ped, true)
        current.pedHandle = ped

        if Config.UseTarget then
            exports['qb-target']:AddTargetEntity(ped, {
                options = {{type = "client", event = "qb-garbagejob:client:MainMenu", label = Lang:t("target.talk"), icon = 'fa-solid fa-recycle', job = "garbage",}},
                distance = 2.0
            })
        else
            local options = current.zoneOptions
            if options then
                local zone = BoxZone:Create(current.coords.xyz, options.length, options.width, {
                    name = "zone_cityhall_" .. ped,
                    heading = current.coords.w,
                    debugPoly = false
                })
                zone:onPlayerInOut(function(inside)
                    if LocalPlayer.state.isLoggedIn then
                        if inside then
                            exports['qb-core']:DrawText(Lang:t("info.talk"), 'left')
                            Listen4Control()
                        else
                            ControlListen = false
                            exports['qb-core']:HideText()
                        end
                    end
                end)
            end
        end
    end
    pedsSpawned = true
end

local function deletePeds()
    if not Config.Peds or not next(Config.Peds) or not pedsSpawned then return end
    for i = 1, #Config.Peds do
        local current = Config.Peds[i]
        if current.pedHandle then
            DeletePed(current.pedHandle)
        end
    end
end

-- Events

RegisterNetEvent('qb-garbagejob:client:SetWaypointHome', function()
    SetNewWaypoint(Config.Locations["main"].coords.x, Config.Locations["main"].coords.y)
end)

RegisterNetEvent('qb-garbagejob:client:RequestRoute', function()
    if garbageVehicle then continueworking = true TriggerServerEvent('qb-garbagejob:server:PayShift', continueworking) end
    
    -- Debug: Check if target is enabled
    print("^2[qb-garbagejob] RequestRoute called - UseTarget=" .. tostring(Config.UseTarget) .. "^0")
    
    -- Clean up any existing route data before starting new route
    CleanupRoute()
    
    QBCore.Functions.TriggerCallback('qb-garbagejob:server:NewShift', function(shouldContinue, stopsData, totalStops)
        print("^2[qb-garbagejob] NewShift callback received: shouldContinue=" .. tostring(shouldContinue) .. ", stopsData=" .. tostring(stopsData ~= nil) .. ", totalStops=" .. tostring(totalStops) .. "^0")
        
        if shouldContinue and stopsData and #stopsData > 0 then
            -- Store all stops
            allStops = stopsData
            completedStops = {}
            currentActiveStop = nil
            
            print("^2[qb-garbagejob] Initializing " .. #allStops .. " stops^0")
            
            -- Initialize completed stops tracking
            for i = 1, #allStops do
                completedStops[allStops[i].stop] = false
                print("^2[qb-garbagejob] Initialized stop " .. allStops[i].stop .. " as not completed^0")
            end
            
            if not garbageVehicle then
                local occupied = false
                for _,v in pairs(Config.Locations["vehicle"].coords) do
                    if not IsAnyVehicleNearPoint(vector3(v.x,v.y,v.z), 2.5) then
                        QBCore.Functions.TriggerCallback('QBCore:Server:SpawnVehicle', function(netId)
                            local veh = NetToVeh(netId)
                            SetVehicleEngineOn(veh, false, true)
                            garbageVehicle = veh
                            SetVehicleNumberPlateText(veh, "QB-" .. tostring(math.random(1000, 9999)))
                            SetEntityHeading(veh, v.w)
                            exports['LegacyFuel']:SetFuel(veh, 100.0)
                            SetVehicleFixed(veh)
                            SetEntityAsMissionEntity(veh, true, true)
                            SetVehicleDoorsLocked(veh, 1)
                            TriggerEvent("vehiclekeys:client:SetOwner", QBCore.Functions.GetPlate(veh))
                            QBCore.Functions.Notify(Lang:t("info.deposit_paid", { value = Config.TruckPrice }))
                            QBCore.Functions.Notify(Lang:t("info.started") .. " - " .. totalStops .. " stops assigned. Visit them in any order!", "success", 5000)
                            TriggerServerEvent("qb-garbagejob:server:payDeposit")
                            
                            -- Create blips, target zones, and PolyZones for all stops
                            Wait(500) -- Small delay to ensure vehicle is fully spawned
                            CreateAllStopBlips()
                            Wait(100) -- Small delay between operations
                            CreateAllTargetZones()
                            Wait(100) -- Small delay between operations
                            CreateAllStopZones()
                        end, Config.Vehicle, v, false)
                        return
                    else
                        occupied = true
                    end
                end
                if occupied then
                    QBCore.Functions.Notify(Lang:t("error.all_occupied"))
                end
            else
                -- Vehicle already exists, just create blips, target zones, and PolyZones
                Wait(100) -- Small delay
                CreateAllStopBlips()
                Wait(100) -- Small delay between operations
                CreateAllTargetZones()
                Wait(100) -- Small delay between operations
                CreateAllStopZones()
                QBCore.Functions.Notify(Lang:t("info.started") .. " - " .. totalStops .. " stops assigned. Visit them in any order!", "success", 5000)
            end
        else
            QBCore.Functions.Notify(Lang:t("info.not_enough", { value = Config.TruckPrice }))
        end
    end, continueworking)
end)

RegisterNetEvent('qb-garbagejob:client:RequestPaycheck', function()
    if garbageVehicle then
        BringBackCar()
        QBCore.Functions.Notify(Lang:t("info.truck_returned"))
    end
    -- Clean up route data when collecting payslip (cancels current route)
    CleanupRoute()
    TriggerServerEvent('qb-garbagejob:server:PayShift')
end)

-- Disable combat controls when menu is open
CreateThread(function()
    while true do
        Wait(0)
        if isMenuOpen then
            -- Disable combat/attack controls
            DisableControlAction(0, 24, true)  -- Attack
            DisableControlAction(0, 25, true)  -- Aim
            DisableControlAction(0, 257, true) -- Attack 2
            DisableControlAction(0, 263, true) -- Melee Attack 1
            DisableControlAction(0, 264, true) -- Melee Attack 2
            DisableControlAction(0, 45, true)  -- Reload
            DisableControlAction(0, 140, true) -- Melee Attack Alternate
            DisableControlAction(0, 141, true) -- Melee Attack Heavy
            DisableControlAction(0, 142, true) -- Melee Attack Light
            DisableControlAction(0, 143, true) -- Melee Block
            DisablePlayerFiring(PlayerId(), true) -- Disable weapon firing
        else
            Wait(500)
        end
    end
end)

-- NUI Callbacks
RegisterNUICallback('closeMenu', function(_, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('selectOption', function(data, cb)
    print("^2[qb-garbagejob] Client: NUI selectOption callback, event=" .. tostring(data.event) .. "^0")
    if data.event then
        print("^2[qb-garbagejob] Client: Triggering event: " .. data.event .. "^0")
        TriggerEvent(data.event)
    else
        print("^1[qb-garbagejob] Client: No event in selectOption data^0")
    end
    isMenuOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

-- Update stats event
RegisterNetEvent('qb-garbagejob:client:UpdateStats', function(stats)
    -- Send updated stats to NUI if menu is open
    if isMenuOpen then
        SendNUIMessage({
            action = 'updateStats',
            stats = stats
        })
    end
end)

RegisterNetEvent('qb-garbagejob:client:MainMenu', function()
    -- Get current job data
    local PlayerData = QBCore.Functions.GetPlayerData()
    if not PlayerData or not PlayerData.job or PlayerData.job.name ~= Config.Jobname then
        QBCore.Functions.Notify(Lang:t("error.job"), "error")
        return
    end
    
    -- Fetch player stats with timeout fallback
    local statsLoaded = false
    local defaultStats = {xp = 0, level = 1, levelLabel = "Rookie", multiplier = 1.0, xpForCurrent = 0, xpForNext = 500, currentLevelMax = 500}
    
    QBCore.Functions.TriggerCallback('qb-garbagejob:server:GetStats', function(stats)
        statsLoaded = true
        if not stats then
            stats = defaultStats
        end
        
        local MainMenu = {}
        MainMenu[#MainMenu+1] = {isMenuHeader = true, header = Lang:t("menu.header")}
        MainMenu[#MainMenu+1] = { 
            header = Lang:t("menu.collect"), 
            txt = Lang:t("menu.return_collect"), 
            event = 'qb-garbagejob:client:RequestPaycheck'
        }
        if not garbageVehicle or finished then
            MainMenu[#MainMenu+1] = { 
                header = Lang:t("menu.route"), 
                txt = Lang:t("menu.request_route"), 
                event = 'qb-garbagejob:client:RequestRoute'
            }
        end
        
        -- Open NUI Menu with stats
        isMenuOpen = true
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'openMenu',
            options = MainMenu,
            stats = stats
        })
    end)
    
    -- Fallback timeout in case callback fails
    CreateThread(function()
        Wait(2000) -- Wait 2 seconds
        if not statsLoaded and not isMenuOpen then
            -- Open menu with default stats if callback didn't respond
            local MainMenu = {}
            MainMenu[#MainMenu+1] = {isMenuHeader = true, header = Lang:t("menu.header")}
            MainMenu[#MainMenu+1] = { 
                header = Lang:t("menu.collect"), 
                txt = Lang:t("menu.return_collect"), 
                event = 'qb-garbagejob:client:RequestPaycheck'
            }
            if not garbageVehicle or finished then
                MainMenu[#MainMenu+1] = { 
                    header = Lang:t("menu.route"), 
                    txt = Lang:t("menu.request_route"), 
                    event = 'qb-garbagejob:client:RequestRoute'
                }
            end
            
            isMenuOpen = true
            SetNuiFocus(true, true)
            SendNUIMessage({
                action = 'openMenu',
                options = MainMenu,
                stats = defaultStats
            })
        end
    end)
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    playerJob = QBCore.Functions.GetPlayerData().job
    setupClient()
    spawnPeds()
end)

RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    playerJob = JobInfo
    if garbageBlip then
        RemoveBlip(garbageBlip)
    end
    if endBlip then
        RemoveBlip(endBlip)
    end
    if deliveryBlip then
        RemoveBlip(deliveryBlip)
    end
    endBlip = nil
    deliveryBlip = nil
    setupClient()
    spawnPeds()
end)

AddEventHandler('onResourceStop', function(resource)
    if GetCurrentResourceName() == resource then
        if garbageObject then
            DeleteEntity(garbageObject)
            garbageObject = nil
        end
        deletePeds()
    end
end)

AddEventHandler('onResourceStart', function(resource)
    if GetCurrentResourceName() == resource then
        playerJob = QBCore.Functions.GetPlayerData().job
        setupClient()
        spawnPeds()
    end
end)
