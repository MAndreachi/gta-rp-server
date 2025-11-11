local QBCore = exports['qb-core']:GetCoreObject()
local PlayerJob = {}
local JobsDone = 0
local NpcOn = false
local CurrentLocation = {}
local CurrentBlip = nil
local LastVehicle = 0
local VehicleSpawned = false
local selectedVeh = nil
local showMarker = false
local CurrentBlip2 = nil
local CurrentTow = nil
local drawDropOff = false
local pedsSpawned = false
local ControlListen = false
local towVehicle = nil
local isMenuOpen = false
local contractStartTime = nil
local vehicleConditionOnHook = nil

-- Functions

local function getRandomVehicleLocation()
    local randomVehicle = math.random(1, #Config.Locations["towspots"])
    while (randomVehicle == LastVehicle) do
        Wait(10)
        randomVehicle = math.random(1, #Config.Locations["towspots"])
    end
    return randomVehicle
end

local function drawDropOffMarker()
    CreateThread(function()
        while drawDropOff do
            DrawMarker(2, Config.Locations["dropoff"].coords.x, Config.Locations["dropoff"].coords.y, Config.Locations["dropoff"].coords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.2, 0.15, 200, 0, 0, 222, false, false, false, true, false, false, false)
            Wait(0)
        end
    end)
end

local function getVehicleInDirection(coordFrom, coordTo)
	local rayHandle = CastRayPointToPoint(coordFrom.x, coordFrom.y, coordFrom.z, coordTo.x, coordTo.y, coordTo.z, 10, PlayerPedId(), 0)
	local _, _, _, _, vehicle = GetRaycastResult(rayHandle)
	return vehicle
end

local function isTowVehicle(vehicle)
    for k in pairs(Config.Vehicles) do
        if GetEntityModel(vehicle) == joaat(k) then
            return true
        end
    end
    return false
end

-- Old Menu Code (being removed)

local function MenuGarage()
    local towMenu = {
        {
            header = Lang:t("menu.header"),
            isMenuHeader = true
        }
    }
    for k in pairs(Config.Vehicles) do
        towMenu[#towMenu+1] = {
            header = Config.Vehicles[k],
            params = {
                event = "qb-tow:client:TakeOutVehicle",
                args = {
                    vehicle = k
                }
            }
        }
    end

    towMenu[#towMenu+1] = {
        header = Lang:t("menu.close_menu"),
        txt = "",
        params = {
            event = "qb-menu:client:closeMenu"
        }

    }
    exports['qb-menu']:openMenu(towMenu)
end

local function CloseMenuFull()
    exports['qb-menu']:closeMenu()
end

local function CreateZone(type, number)
    local coords
    local heading
    local boxName
    local event
    local label
    local size

    if type == "main" then
        event = "qb-tow:client:PaySlip"
        label = Lang:t("label.payslip")
        coords = vector3(Config.Locations[type].coords.x, Config.Locations[type].coords.y, Config.Locations[type].coords.z)
        heading = Config.Locations[type].coords.h
        boxName = Config.Locations[type].label
        size = 3
    elseif type == "vehicle" then
        event = "qb-tow:client:Vehicle"
        label = Lang:t("label.vehicle")
        coords = vector3(Config.Locations[type].coords.x, Config.Locations[type].coords.y, Config.Locations[type].coords.z)
        heading = Config.Locations[type].coords.h
        boxName = Config.Locations[type].label
        size = 5
    elseif type == "towspots" then
        event = "qb-tow:client:SpawnNPCVehicle"
        label = Lang:t("label.npcz")
        coords = vector3(Config.Locations[type][number].coords.x, Config.Locations[type][number].coords.y, Config.Locations[type][number].coords.z)
        heading = Config.Locations[type][number].coords.h
        boxName = Config.Locations[type][number].name
        size = 50
    end

    if Config.UseTarget and type == "main" then
        exports['qb-target']:AddBoxZone(boxName, coords, size, size, {
            minZ = coords.z - 5.0,
            maxZ = coords.z + 5.0,
            name = boxName,
            heading = heading,
            debugPoly = false,
        }, {
            options = {
                {
                    type = "client",
                    event = event,
                    label = label,
                },
            },
            distance = 2
        })
    else
        local zone = BoxZone:Create(
            coords, size, size, {
                minZ = coords.z - 5.0,
                maxZ = coords.z + 5.0,
                name = boxName,
                debugPoly = false,
                heading = heading,
            })

        local zoneCombo = ComboZone:Create({zone}, {name = boxName, debugPoly = false})
        zoneCombo:onPlayerInOut(function(isPointInside)
            if isPointInside then
                if type == "main" then
                    TriggerEvent('qb-tow:client:PaySlip')
                elseif type == "vehicle" then
                    TriggerEvent('qb-tow:client:Vehicle')
                elseif type == "towspots" then
                    TriggerEvent('qb-tow:client:SpawnNPCVehicle')
                end
            end
        end)
        if type == "vehicle" then
            local zoneMark = BoxZone:Create(
                coords, 20, 20, {
                    minZ = coords.z - 5.0,
                    maxZ = coords.z + 5.0,
                    name = boxName,
                    debugPoly = false,
                    heading = heading,
                })

            local zoneComboV = ComboZone:Create({zoneMark}, {name = boxName, debugPoly = false})
            zoneComboV:onPlayerInOut(function(isPointInside)
                if isPointInside then
                    TriggerEvent('qb-tow:client:ShowMarker', true)
                else
                    TriggerEvent('qb-tow:client:ShowMarker', false)
                end
            end)
        elseif type == "towspots" then
            CurrentLocation.zoneCombo = zoneCombo
        end
    end
end

local function deliverVehicle(vehicle)
    -- Calculate vehicle condition (damage percentage)
    local condition = 0.0
    if vehicle and DoesEntityExist(vehicle) then
        local bodyHealth = GetVehicleBodyHealth(vehicle)
        local engineHealth = GetVehicleEngineHealth(vehicle)
        local maxHealth = 1000.0
        local totalDamage = (maxHealth - bodyHealth) + (maxHealth - engineHealth)
        condition = totalDamage / (maxHealth * 2) -- 0.0 = perfect, 1.0 = destroyed
    end
    
    -- Calculate delivery time
    local deliveryTime = nil
    if contractStartTime then
        deliveryTime = GetGameTimer() - contractStartTime
    end
    
    -- Send XP event to server
    print("^2[qb-towjob] Client: Sending XP event to server (condition=" .. (condition or "nil") .. ", time=" .. (deliveryTime or "nil") .. ")^0")
    TriggerServerEvent('qb-tow:server:AddXP', condition, deliveryTime)
    
    DeleteVehicle(vehicle)
    RemoveBlip(CurrentBlip2)
    JobsDone = JobsDone + 1
    VehicleSpawned = false
    CurrentTow = nil
    drawDropOff = false
    contractStartTime = nil
    vehicleConditionOnHook = nil
    
    -- Automatically assign new contract
    if NpcOn and towVehicle and DoesEntityExist(towVehicle) then
        Wait(1000)
        local randomLocation = getRandomVehicleLocation()
        CurrentLocation.x = Config.Locations["towspots"][randomLocation].coords.x
        CurrentLocation.y = Config.Locations["towspots"][randomLocation].coords.y
        CurrentLocation.z = Config.Locations["towspots"][randomLocation].coords.z
        CurrentLocation.model = Config.Locations["towspots"][randomLocation].model
        CurrentLocation.id = randomLocation
        CreateZone("towspots", randomLocation)

        if CurrentBlip then
            RemoveBlip(CurrentBlip)
        end
        CurrentBlip = AddBlipForCoord(CurrentLocation.x, CurrentLocation.y, CurrentLocation.z)
        SetBlipColour(CurrentBlip, 3)
        SetBlipRoute(CurrentBlip, true)
        SetBlipRouteColour(CurrentBlip, 3)
        QBCore.Functions.Notify(Lang:t("mission.get_new_vehicle"), "primary", 4000)
    end
end

local function Listen4Control()
    ControlListen = true
    CreateThread(function()
        while ControlListen do
            if IsControlJustReleased(0, 38) then
                TriggerEvent("qb-tow:client:MainMenu")
            end
            Wait(1)
        end
    end)
end

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
                options = {{type = "client", event = "qb-tow:client:MainMenu", label = Lang:t("target.talk"), icon = 'fa-solid fa-truck', job = "tow",}},
                distance = 2.0
            })
        else
            local options = current.zoneOptions
            if options then
                local zone = BoxZone:Create(current.coords.xyz, options.length, options.width, {
                    name = "zone_tow_" .. ped,
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
    pedsSpawned = false
end

local function CreateElements()
    local TowBlip = AddBlipForCoord(Config.Locations["main"].coords.x, Config.Locations["main"].coords.y, Config.Locations["main"].coords.z)
    SetBlipSprite(TowBlip, 477)
    SetBlipDisplay(TowBlip, 4)
    SetBlipScale(TowBlip, 0.6)
    SetBlipAsShortRange(TowBlip, true)
    SetBlipColour(TowBlip, 15)
    BeginTextCommandSetBlipName("STRING")
    AddTextComponentSubstringPlayerName(Config.Locations["main"].label)
    EndTextCommandSetBlipName(TowBlip)

    spawnPeds()
end
-- Events

RegisterNetEvent('qb-tow:client:SpawnVehicle', function()
    local vehicleInfo = selectedVeh
    local coords = Config.Locations["vehicle"].coords
    QBCore.Functions.TriggerCallback('QBCore:Server:SpawnVehicle', function(netId)
        local veh = NetToVeh(netId)
        towVehicle = veh
        SetVehicleNumberPlateText(veh, "TOWR"..tostring(math.random(1000, 9999)))
        SetEntityHeading(veh, coords.w)
        exports['LegacyFuel']:SetFuel(veh, 100.0)
        SetEntityAsMissionEntity(veh, true, true)
        CloseMenuFull()
        TaskWarpPedIntoVehicle(PlayerPedId(), veh, -1)
        TriggerEvent("vehiclekeys:client:SetOwner", QBCore.Functions.GetPlate(veh))
        SetVehicleEngineOn(veh, true, true)
        for i = 1, 9, 1 do
            SetVehicleExtra(veh, i, 0)
        end
        -- Automatically start the job after getting the truck
        Wait(1000)
        if selectedVeh then
            NpcOn = true
            local randomLocation = getRandomVehicleLocation()
            CurrentLocation.x = Config.Locations["towspots"][randomLocation].coords.x
            CurrentLocation.y = Config.Locations["towspots"][randomLocation].coords.y
            CurrentLocation.z = Config.Locations["towspots"][randomLocation].coords.z
            CurrentLocation.model = Config.Locations["towspots"][randomLocation].model
            CurrentLocation.id = randomLocation
            CreateZone("towspots", randomLocation)

            CurrentBlip = AddBlipForCoord(CurrentLocation.x, CurrentLocation.y, CurrentLocation.z)
            SetBlipColour(CurrentBlip, 3)
            SetBlipRoute(CurrentBlip, true)
            SetBlipRouteColour(CurrentBlip, 3)
            -- New contract notification removed - blip on map is sufficient
        end
    end, vehicleInfo, coords, false)
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    PlayerJob = QBCore.Functions.GetPlayerData().job

    if PlayerJob.name == "tow" then
        CreateElements()
    end
end)

RegisterNetEvent('QBCore:Client:OnJobUpdate', function(JobInfo)
    PlayerJob = JobInfo

    if PlayerJob.name == "tow" then
        CreateElements()
    else
        deletePeds()
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if GetCurrentResourceName() == resource then
        deletePeds()
    end
end)

AddEventHandler('onResourceStart', function(resource)
    if GetCurrentResourceName() == resource then
        PlayerJob = QBCore.Functions.GetPlayerData().job
        if PlayerJob.name == "tow" then
            CreateElements()
        end
    end
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
    print("^2[qb-towjob] Client: NUI selectOption callback, event=" .. tostring(data.event) .. "^0")
    if data.event then
        print("^2[qb-towjob] Client: Triggering event: " .. data.event .. "^0")
        TriggerEvent(data.event)
    else
        print("^1[qb-towjob] Client: No event in selectOption data^0")
    end
    isMenuOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNetEvent('jobs:client:ToggleNpc', function()
    if QBCore.Functions.GetPlayerData().job.name == "tow" then
        if CurrentTow ~= nil then
            QBCore.Functions.Notify(Lang:t("error.finish_work"), "error")
            return
        end
        NpcOn = not NpcOn
        if NpcOn then
            local randomLocation = getRandomVehicleLocation()
            CurrentLocation.x = Config.Locations["towspots"][randomLocation].coords.x
            CurrentLocation.y = Config.Locations["towspots"][randomLocation].coords.y
            CurrentLocation.z = Config.Locations["towspots"][randomLocation].coords.z
            CurrentLocation.model = Config.Locations["towspots"][randomLocation].model
            CurrentLocation.id = randomLocation
            CreateZone("towspots", randomLocation)

            CurrentBlip = AddBlipForCoord(CurrentLocation.x, CurrentLocation.y, CurrentLocation.z)
            SetBlipColour(CurrentBlip, 3)
            SetBlipRoute(CurrentBlip, true)
            SetBlipRouteColour(CurrentBlip, 3)
        else
            if DoesBlipExist(CurrentBlip) then
                RemoveBlip(CurrentBlip)
                CurrentLocation = {}
                CurrentBlip = nil
            end
            VehicleSpawned = false
        end
    end
end)

RegisterNetEvent('qb-tow:client:TowVehicle', function()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), true)
    if isTowVehicle(vehicle) then
        if CurrentTow == nil then
            local playerped = PlayerPedId()
            local coordA = GetEntityCoords(playerped, 1)
            local coordB = GetOffsetFromEntityInWorldCoords(playerped, 0.0, 5.0, 0.0)
            local targetVehicle = getVehicleInDirection(coordA, coordB)

            if NpcOn and CurrentLocation then
                if GetEntityModel(targetVehicle) ~= joaat(CurrentLocation.model) then
                    QBCore.Functions.Notify(Lang:t("error.vehicle_not_correct"), "error")
                    return
                end
            end
            if not IsPedInAnyVehicle(PlayerPedId()) then
                if vehicle ~= targetVehicle then
                    local towPos = GetEntityCoords(vehicle)
                    local targetPos = GetEntityCoords(targetVehicle)
                    if #(towPos - targetPos) < 11.0 then
                        QBCore.Functions.Progressbar("towing_vehicle", Lang:t("mission.towing_vehicle"), 5000, false, true, {
                            disableMovement = true,
                            disableCarMovement = true,
                            disableMouse = false,
                            disableCombat = true,
                        }, {
                            animDict = "mini@repair",
                            anim = "fixing_a_ped",
                            flags = 16,
                        }, {}, {}, function() -- Done
                            StopAnimTask(PlayerPedId(), "mini@repair", "fixing_a_ped", 1.0)
                            AttachEntityToEntity(targetVehicle, vehicle, GetEntityBoneIndexByName(vehicle, 'bodyshell'), 0.0, -1.5 + -0.85, 0.0 + 1.15, 0, 0, 0, 1, 1, 0, 1, 0, 1)
                            FreezeEntityPosition(targetVehicle, true)
                            CurrentTow = targetVehicle
                            
                            -- Track contract start time and vehicle condition
                            contractStartTime = GetGameTimer()
                            if targetVehicle and DoesEntityExist(targetVehicle) then
                                local bodyHealth = GetVehicleBodyHealth(targetVehicle)
                                local engineHealth = GetVehicleEngineHealth(targetVehicle)
                                local maxHealth = 1000.0
                                local totalDamage = (maxHealth - bodyHealth) + (maxHealth - engineHealth)
                                vehicleConditionOnHook = totalDamage / (maxHealth * 2)
                            end
                            
                            if NpcOn then
                                RemoveBlip(CurrentBlip)
                                QBCore.Functions.Notify(Lang:t("mission.goto_depot"), "primary", 5000)
                                CurrentBlip2 = AddBlipForCoord(Config.Locations["dropoff"].coords.x, Config.Locations["dropoff"].coords.y, Config.Locations["dropoff"].coords.z)
                                SetBlipColour(CurrentBlip2, 3)
                                SetBlipRoute(CurrentBlip2, true)
                                SetBlipRouteColour(CurrentBlip2, 3)
                                drawDropOff = true
                                drawDropOffMarker()
                                local vehNetID = NetworkGetNetworkIdFromEntity(targetVehicle)
                                TriggerServerEvent('qb-tow:server:nano', vehNetID)
                                --remove zone
                                CurrentLocation.zoneCombo:destroy()
                            end
                            QBCore.Functions.Notify(Lang:t("mission.vehicle_towed"), "success")
                        end, function() -- Cancel
                            StopAnimTask(PlayerPedId(), "mini@repair", "fixing_a_ped", 1.0)
                            QBCore.Functions.Notify(Lang:t("error.failed"), "error")
                        end)
                    end
                end
            end
        else
            QBCore.Functions.Progressbar("untowing_vehicle", Lang:t("mission.untowing_vehicle"), 5000, false, true, {
                disableMovement = true,
                disableCarMovement = true,
                disableMouse = false,
                disableCombat = true,
            }, {
                animDict = "mini@repair",
                anim = "fixing_a_ped",
                flags = 16,
            }, {}, {}, function() -- Done
                StopAnimTask(PlayerPedId(), "mini@repair", "fixing_a_ped", 1.0)
                FreezeEntityPosition(CurrentTow, false)
                Wait(250)
                AttachEntityToEntity(CurrentTow, vehicle, 20, -0.0, -15.0, 1.0, 0.0, 0.0, 0.0, false, false, false, false, 20, true)
                DetachEntity(CurrentTow, true, true)
                if NpcOn then
                    local targetPos = GetEntityCoords(CurrentTow)
                    if #(targetPos - vector3(Config.Locations["dropoff"].coords.x, Config.Locations["dropoff"].coords.y, Config.Locations["dropoff"].coords.z)) < 25.0 then
                        deliverVehicle(CurrentTow)
                    end
                end
                RemoveBlip(CurrentBlip2)
                CurrentTow = nil
                drawDropOff = false
            end, function() -- Cancel
                StopAnimTask(PlayerPedId(), "mini@repair", "fixing_a_ped", 1.0)
                QBCore.Functions.Notify(Lang:t("error.failed"), "error")
            end)
        end
    else
        QBCore.Functions.Notify(Lang:t("error.not_towing_vehicle"), "error")
    end
end)

RegisterNetEvent('qb-tow:client:TakeOutVehicle', function(data)
    local coords = Config.Locations["vehicle"].coords
    coords = vector3(coords.x, coords.y, coords.z)
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    if #(pos - coords) <= 5 then
        local vehicleInfo = data.vehicle
        TriggerServerEvent('qb-tow:server:DoBail', true, vehicleInfo)
        selectedVeh = vehicleInfo
    else
        QBCore.Functions.Notify(Lang:t("error.too_far_away"), 'error')
    end
end)

RegisterNetEvent('qb-tow:client:Vehicle', function()
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if not CurrentTow then
        if vehicle and isTowVehicle(vehicle) then
            DeleteVehicle(GetVehiclePedIsIn(PlayerPedId()))
            TriggerServerEvent('qb-tow:server:DoBail', false)
        else
            MenuGarage()
        end
    else
        QBCore.Functions.Notify(Lang:t("error.finish_work"), "error")
    end
end)

RegisterNetEvent('qb-tow:client:PaySlip', function()
    print("^2[qb-towjob] Client: PaySlip event triggered, JobsDone=" .. JobsDone .. "^0")
    if JobsDone > 0 then
        if CurrentBlip then
            RemoveBlip(CurrentBlip)
        end
        print("^2[qb-towjob] Client: Triggering server event with " .. JobsDone .. " drops^0")
        
        -- Try using callback instead of event
        QBCore.Functions.TriggerCallback('qb-tow:server:CollectPaycheck', function(success, message)
            if success then
                print("^2[qb-towjob] Client: Paycheck collected successfully^0")
                -- Payment notification is handled server-side
            else
                print("^1[qb-towjob] Client: Paycheck collection failed: " .. (message or "unknown") .. "^0")
                QBCore.Functions.Notify(message or "Failed to collect payment", "error")
            end
        end, JobsDone)
        
        -- Also try the old event method as backup
        TriggerServerEvent("qb-tow:server:11101110", JobsDone)
        JobsDone = 0
        NpcOn = false
        print("^2[qb-towjob] Client: Reset JobsDone to 0^0")
    else
        print("^1[qb-towjob] Client: No work done, cannot collect payslip^0")
        QBCore.Functions.Notify(Lang:t("error.no_work_done"), "error")
    end
end)

RegisterNetEvent('qb-tow:client:ReturnTruck', function()
    if CurrentTow ~= nil then
        QBCore.Functions.Notify(Lang:t("error.finish_work"), "error")
        return
    end
    
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if vehicle and isTowVehicle(vehicle) then
        DeleteVehicle(vehicle)
        towVehicle = nil
        TriggerServerEvent('qb-tow:server:DoBail', false)
        QBCore.Functions.Notify(Lang:t("success.truck_returned"), "success")
        -- Clean up job state
        if CurrentBlip then
            RemoveBlip(CurrentBlip)
            CurrentBlip = nil
        end
        NpcOn = false
        VehicleSpawned = false
        CurrentLocation = {}
    elseif towVehicle and DoesEntityExist(towVehicle) then
        DeleteVehicle(towVehicle)
        towVehicle = nil
        TriggerServerEvent('qb-tow:server:DoBail', false)
        QBCore.Functions.Notify(Lang:t("success.truck_returned"), "success")
        -- Clean up job state
        if CurrentBlip then
            RemoveBlip(CurrentBlip)
            CurrentBlip = nil
        end
        NpcOn = false
        VehicleSpawned = false
        CurrentLocation = {}
    else
        QBCore.Functions.Notify(Lang:t("error.no_truck"), "error")
    end
end)

-- Update stats event
RegisterNetEvent('qb-tow:client:UpdateStats', function(stats)
    -- Send updated stats to NUI if menu is open
    if isMenuOpen then
        SendNUIMessage({
            action = 'updateStats',
            stats = stats
        })
    end
end)

RegisterNetEvent('qb-tow:client:MainMenu', function()
    -- Get current job data
    local PlayerData = QBCore.Functions.GetPlayerData()
    if not PlayerData or not PlayerData.job or PlayerData.job.name ~= "tow" then
        QBCore.Functions.Notify(Lang:t("error.job"), "error")
        return
    end
    
    -- Fetch player stats with timeout fallback
    local statsLoaded = false
    local defaultStats = {xp = 0, level = 1, levelLabel = "Rookie", multiplier = 1.0, xpForCurrent = 0, xpForNext = 500, currentLevelMax = 500}
    
    QBCore.Functions.TriggerCallback('qb-tow:server:GetStats', function(stats)
        statsLoaded = true
        if not stats then
            stats = defaultStats
        end
        
        local MainMenu = {}
        MainMenu[#MainMenu+1] = {isMenuHeader = true, header = Lang:t("menu.header")}
        MainMenu[#MainMenu+1] = { 
            header = Lang:t("menu.collect"), 
            txt = Lang:t("menu.return_collect"), 
            event = 'qb-tow:client:PaySlip'
        }
        -- Only show start job if player doesn't have a truck
        local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
        local hasTruck = (towVehicle and DoesEntityExist(towVehicle)) or (vehicle and isTowVehicle(vehicle))
        if not hasTruck and (not VehicleSpawned or not NpcOn) then
            MainMenu[#MainMenu+1] = { 
                header = Lang:t("menu.start_job"), 
                txt = Lang:t("menu.start_job_desc"), 
                event = 'qb-tow:client:StartJob'
            }
        end
        -- Add return truck option if player has a truck
        if hasTruck then
            if not CurrentTow then
                MainMenu[#MainMenu+1] = { 
                    header = Lang:t("menu.return_truck"), 
                    txt = Lang:t("menu.return_truck_desc"), 
                    event = 'qb-tow:client:ReturnTruck'
                }
            end
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
                event = 'qb-tow:client:PaySlip'
            }
            local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
            local hasTruck = (towVehicle and DoesEntityExist(towVehicle)) or (vehicle and isTowVehicle(vehicle))
            if not hasTruck and (not VehicleSpawned or not NpcOn) then
                MainMenu[#MainMenu+1] = { 
                    header = Lang:t("menu.start_job"), 
                    txt = Lang:t("menu.start_job_desc"), 
                    event = 'qb-tow:client:StartJob'
                }
            end
            if hasTruck and not CurrentTow then
                MainMenu[#MainMenu+1] = { 
                    header = Lang:t("menu.return_truck"), 
                    txt = Lang:t("menu.return_truck_desc"), 
                    event = 'qb-tow:client:ReturnTruck'
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

RegisterNetEvent('qb-tow:client:StartJob', function()
    if CurrentTow ~= nil then
        QBCore.Functions.Notify(Lang:t("error.finish_work"), "error")
        return
    end
    
    -- Check if player already has a truck
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if (towVehicle and DoesEntityExist(towVehicle)) or (vehicle and isTowVehicle(vehicle)) then
        QBCore.Functions.Notify(Lang:t("error.already_have_truck"), "error")
        return
    end
    
    -- Need to get a truck first
    local vehicleInfo = "flatbed"
    TriggerServerEvent('qb-tow:server:DoBail', true, vehicleInfo)
    selectedVeh = vehicleInfo
end)

RegisterNetEvent('qb-tow:client:SpawnNPCVehicle', function()
    if not VehicleSpawned then
        QBCore.Functions.TriggerCallback('QBCore:Server:SpawnVehicle', function(netId)
            local veh = NetToVeh(netId)
            exports['LegacyFuel']:SetFuel(veh, 0.0)
            VehicleSpawned = true
        end, CurrentLocation.model, CurrentLocation, false)
    end
end)

RegisterNetEvent('qb-tow:client:ShowMarker', function(active)
    if PlayerJob.name == "tow" then
        showMarker = active
    end
end)

-- Threads
CreateThread(function()
    while true do
        if showMarker then
            DrawMarker(2, Config.Locations["vehicle"].coords.x, Config.Locations["vehicle"].coords.y, Config.Locations["vehicle"].coords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.2, 0.15, 200, 0, 0, 222, false, false, false, true, false, false, false)
            --DrawMarker(2, Config.Locations["vehicle"].coords.x, Config.Locations["vehicle"].coords.y, Config.Locations["vehicle"].coords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.2, 0.15, 200, 200, 200, 222, false, false, false, true, false, false, false)
            Wait(0)
        else
            Wait(1000)
        end
    end
end)
