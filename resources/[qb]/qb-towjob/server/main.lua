print("^2[qb-towjob] Server: Script loaded^0")
local QBCore = exports['qb-core']:GetCoreObject()
local PaymentTax = 15
local Bail = {}

print("^2[qb-towjob] Server: QBCore loaded, registering events^0")

-- XP and Level Functions (define in correct order)
local function CalculateLevel(xp)
    -- Find the highest level the player qualifies for
    local highestLevel = 1
    local levelData = Config.Levels[1]
    for i = 1, #Config.Levels do
        local data = Config.Levels[i]
        if xp >= data.minXP then
            highestLevel = i
            levelData = data
        end
    end
    return highestLevel, levelData
end

local function SetTowingStats(Player, stats)
    if not Player then 
        print("^1[qb-towjob] SetTowingStats: Player is nil^0")
        return 
    end
    Player.PlayerData.metadata['towing'] = stats
    Player.Functions.SetMetaData('towing', stats)
    print("^2[qb-towjob] SetTowingStats: Saved XP=" .. (stats.xp or 0) .. ", Level=" .. (stats.level or 1) .. "^0")
end

local function GetTowingStats(Player)
    if not Player then 
        return {xp = 0, level = 1}
    end
    local stats = Player.PlayerData.metadata['towing'] or {}
    local xp = stats.xp or 0
    -- Calculate level from XP if level is not set or if XP has changed
    local level, levelData = CalculateLevel(xp)
    if not stats.level or stats.level ~= level then
        -- Update level if it's missing or incorrect
        stats.level = level
        stats.xp = xp
        -- Use pcall to safely set stats
        pcall(function()
            SetTowingStats(Player, stats)
        end)
    end
    return {
        xp = xp,
        level = level,
    }
end

local function GetPaymentMultiplier(level)
    if level and Config.Levels[level] then
        return Config.Levels[level].multiplier
    end
    return 1.0
end

local function AddXP(Player, xpGained)
    if not Player then return 0, 1, false, Config.Levels[1] end
    local stats = GetTowingStats(Player)
    if not stats then
        stats = {xp = 0, level = 1}
    end
    local oldXP = stats.xp
    local oldLevel = stats.level
    local newXP = oldXP + xpGained
    local newLevel, levelData = CalculateLevel(newXP)
    
    stats.xp = newXP
    stats.level = newLevel
    
    -- Use pcall to safely set stats
    local success = pcall(function()
        SetTowingStats(Player, stats)
    end)
    
    if not success then
        print("^1[qb-towjob] Error saving towing stats^0")
    end
    
    -- Check for level up
    local leveledUp = newLevel > oldLevel
    
    return newXP, newLevel, leveledUp, levelData
end

RegisterNetEvent('qb-tow:server:DoBail', function(bool, vehInfo)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if bool then
        if Player.PlayerData.money.cash >= Config.BailPrice then
            Bail[Player.PlayerData.citizenid] = Config.BailPrice
            Player.Functions.RemoveMoney('cash', Config.BailPrice, 'tow-paid-bail')
            TriggerClientEvent('QBCore:Notify', src, Lang:t('success.paid_with_cash', { value = Config.BailPrice }), 'success')
            TriggerClientEvent('qb-tow:client:SpawnVehicle', src, vehInfo)
        elseif Player.PlayerData.money.bank >= Config.BailPrice then
            Bail[Player.PlayerData.citizenid] = Config.BailPrice
            Player.Functions.RemoveMoney('bank', Config.BailPrice, 'tow-paid-bail')
            TriggerClientEvent('QBCore:Notify', src, Lang:t('success.paid_with_bank', { value = Config.BailPrice }), 'success')
            TriggerClientEvent('qb-tow:client:SpawnVehicle', src, vehInfo)
        else
            TriggerClientEvent('QBCore:Notify', src, Lang:t('error.no_deposit', { value = Config.BailPrice }), 'error')
        end
    else
        if Bail[Player.PlayerData.citizenid] ~= nil then
            -- Use AddMoneyToPlayerBank to create transaction history
            exports['qb-banking']:AddMoneyToPlayerBank(src, Bail[Player.PlayerData.citizenid], 'Tow Bail Refund', 'checking')
            Bail[Player.PlayerData.citizenid] = nil
            TriggerClientEvent('QBCore:Notify', src, Lang:t('success.refund_to_cash', { value = Config.BailPrice }), 'success')
        end
    end
end)

RegisterNetEvent('qb-tow:server:nano', function(vehNetID)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    local targetVehicle = NetworkGetEntityFromNetworkId(vehNetID)
    if not Player then return end
    local playerPed = GetPlayerPed(src)
    local playerVehicle = GetVehiclePedIsIn(playerPed, true)
    local playerVehicleCoords = GetEntityCoords(playerVehicle)
    local targetVehicleCoords = GetEntityCoords(targetVehicle)
    local dist = #(playerVehicleCoords - targetVehicleCoords)
    if Player.PlayerData.job.name ~= 'tow' or dist > 11.0 then
        return DropPlayer(src, Lang:t('info.skick'))
    end
    local chance = math.random(1, 100)
    if chance < 26 then
        exports['qb-inventory']:AddItem(src, 'cryptostick', 1, false, false, 'qb-tow:server:nano')
        TriggerClientEvent('qb-inventory:client:ItemBox', src, QBCore.Shared.Items['cryptostick'], 'add')
    end
end)

print("^2[qb-towjob] Server: Registering payment event^0")

-- Test event to verify server is receiving events
RegisterNetEvent('qb-tow:server:test', function()
    print("^2[qb-towjob] Server: TEST EVENT RECEIVED - Server is working!^0")
end)

-- Callback version of payment collection
QBCore.Functions.CreateCallback('qb-tow:server:CollectPaycheck', function(source, cb, drops)
    print("^2[qb-towjob] Server: CollectPaycheck callback received from source " .. source .. " with drops=" .. tostring(drops) .. "^0")
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then 
        print("^1[qb-towjob] CollectPaycheck: Player not found^0")
        cb(false, "Player not found")
        return 
    end
    
    -- Check job only, distance check removed since player uses NPC menu
    if Player.PlayerData.job.name ~= 'tow' then
        print("^1[qb-towjob] CollectPaycheck: Job check failed^0")
        cb(false, "You must be a tow truck driver")
        return
    end
    
    drops = tonumber(drops) or 0
    if drops <= 0 then
        cb(false, "No work done")
        return
    end
    
    print("^2[qb-towjob] CollectPaycheck: Processing " .. drops .. " drops^0")
    local bonus = 0
    local DropPrice = math.random(150, 170)
    if drops > 5 then
        bonus = math.ceil((DropPrice / 10) * 5)
    elseif drops > 10 then
        bonus = math.ceil((DropPrice / 10) * 7)
    elseif drops > 15 then
        bonus = math.ceil((DropPrice / 10) * 10)
    elseif drops > 20 then
        bonus = math.ceil((DropPrice / 10) * 12)
    end
    local price = (DropPrice * drops) + bonus
    
    -- Apply level-based payment multiplier
    local stats = GetTowingStats(Player)
    local multiplier = 1.0
    if stats and stats.level then
        multiplier = GetPaymentMultiplier(stats.level)
        print("^2[qb-towjob] CollectPaycheck: Level " .. stats.level .. ", Multiplier " .. multiplier .. "x^0")
    end
    price = math.ceil(price * multiplier)
    
    local taxAmount = math.ceil((price / 100) * PaymentTax)
    local payment = price - taxAmount
    print("^2[qb-towjob] CollectPaycheck: Paying $" .. payment .. "^0")
    
    -- Check if qb-banking exists, otherwise use QBCore money function
    if GetResourceState('qb-banking') == 'started' and exports['qb-banking'] and exports['qb-banking'].AddMoneyToPlayerBank then
        exports['qb-banking']:AddMoneyToPlayerBank(source, payment, 'Tow Job Payment', 'checking')
    else
        Player.Functions.AddMoney('bank', payment, 'tow-job-payment')
    end
    
    -- Notify player of payment
    TriggerClientEvent('QBCore:Notify', source, Lang:t('success.you_earned', { value = payment }), 'success')
    
    cb(true, "You earned $" .. payment)
end)

RegisterNetEvent('qb-tow:server:11101110', function(drops)
    local src = source
    print("^2[qb-towjob] Server: Payment event received from source " .. src .. " with drops=" .. tostring(drops) .. "^0")
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then 
        print("^1[qb-towjob] Payment: Player not found for source " .. src .. "^0")
        return 
    end
    print("^2[qb-towjob] Server: Player found: " .. Player.PlayerData.name .. ", Job: " .. Player.PlayerData.job.name .. "^0")
    -- Check job only, distance check removed since player uses NPC menu
    if Player.PlayerData.job.name ~= 'tow' then
        print("^1[qb-towjob] Payment: Job check failed^0")
        return DropPlayer(src, Lang:t('info.skick'))
    end
    drops = tonumber(drops)
    print("^2[qb-towjob] Payment: Processing " .. drops .. " drops^0")
    local bonus = 0
    local DropPrice = math.random(150, 170)
    if drops > 5 then
        bonus = math.ceil((DropPrice / 10) * 5)
    elseif drops > 10 then
        bonus = math.ceil((DropPrice / 10) * 7)
    elseif drops > 15 then
        bonus = math.ceil((DropPrice / 10) * 10)
    elseif drops > 20 then
        bonus = math.ceil((DropPrice / 10) * 12)
    end
    local price = (DropPrice * drops) + bonus
    
    -- Apply level-based payment multiplier (with error handling)
    local stats = GetTowingStats(Player)
    local multiplier = 1.0
    if stats and stats.level then
        multiplier = GetPaymentMultiplier(stats.level)
        print("^2[qb-towjob] Payment: Level " .. stats.level .. ", Multiplier " .. multiplier .. "x^0")
    else
        print("^3[qb-towjob] Payment: No stats found, using 1.0x multiplier^0")
    end
    price = math.ceil(price * multiplier)
    
    local taxAmount = math.ceil((price / 100) * PaymentTax)
    local payment = price - taxAmount
    print("^2[qb-towjob] Payment: Paying $" .. payment .. " (before tax: $" .. price .. ", tax: $" .. taxAmount .. ")^0")
    
    -- Check if qb-banking exists, otherwise use QBCore money function
    if GetResourceState('qb-banking') == 'started' and exports['qb-banking'] and exports['qb-banking'].AddMoneyToPlayerBank then
        exports['qb-banking']:AddMoneyToPlayerBank(src, payment, 'Tow Job Payment', 'checking')
    else
        Player.Functions.AddMoney('bank', payment, 'tow-job-payment')
    end
    TriggerClientEvent('QBCore:Notify', src, Lang:t('success.you_earned', { value = payment }), 'success')
end)

-- XP Gain Event (called when vehicle is delivered)
RegisterNetEvent('qb-tow:server:AddXP', function(condition, deliveryTime)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then 
        print("^1[qb-towjob] AddXP: Player not found^0")
        return 
    end
    if Player.PlayerData.job.name ~= 'tow' then 
        print("^1[qb-towjob] AddXP: Player not in tow job^0")
        return 
    end
    
    print("^2[qb-towjob] AddXP: Processing XP (condition=" .. (condition or "nil") .. ", time=" .. (deliveryTime or "nil") .. ")^0")
    
    local xpGained = Config.XP.BaseXP
    local bonuses = {}
    
    -- Condition bonus (0% damage = perfect)
    if condition and condition <= 0.01 then
        xpGained = xpGained + Config.XP.ConditionBonus
        bonuses[#bonuses + 1] = Lang:t('xp.condition_bonus', { value = Config.XP.ConditionBonus })
        print("^2[qb-towjob] AddXP: Condition bonus added^0")
    end
    
    -- Time bonus (quick delivery)
    if deliveryTime and deliveryTime <= Config.XP.TimeThreshold then
        xpGained = xpGained + Config.XP.TimeBonus
        bonuses[#bonuses + 1] = Lang:t('xp.time_bonus', { value = Config.XP.TimeBonus })
        print("^2[qb-towjob] AddXP: Time bonus added^0")
    end
    
    print("^2[qb-towjob] AddXP: Total XP to add: " .. xpGained .. "^0")
    local newXP, newLevel, leveledUp, levelData = AddXP(Player, xpGained)
    print("^2[qb-towjob] AddXP: New XP=" .. newXP .. ", New Level=" .. newLevel .. "^0")
    
    -- Consolidated XP notification (only show if leveled up or if there are bonuses)
    if leveledUp then
        -- Level up takes priority
        TriggerClientEvent('QBCore:Notify', src, Lang:t('xp.level_up', { level = newLevel, label = levelData.label }), 'success', 5000)
    elseif #bonuses > 0 then
        -- Show bonus notification if there are bonuses
        local bonusText = ""
        for i, bonus in ipairs(bonuses) do
            if i > 1 then bonusText = bonusText .. " " end
            bonusText = bonusText .. bonus
        end
        TriggerClientEvent('QBCore:Notify', src, Lang:t('xp.gained', { xp = xpGained, total = newXP }) .. " - " .. bonusText, 'success')
    else
        -- Only show base XP notification (can be removed if too frequent)
        -- TriggerClientEvent('QBCore:Notify', src, Lang:t('xp.gained', { xp = xpGained, total = newXP }), 'success')
    end
    
    -- Calculate XP progress for updated stats
    local xpForCurrent = newXP - levelData.minXP
    local xpForNext = levelData.maxXP - levelData.minXP
    
    -- Handle max level case
    if levelData.maxXP >= 999999 then
        xpForNext = 1 -- Avoid division by zero
        if xpForCurrent > 0 then
            xpForCurrent = 1
        end
    end
    
    -- Send updated stats to client
    TriggerClientEvent('qb-tow:client:UpdateStats', src, {
        xp = newXP,
        level = newLevel,
        levelLabel = levelData.label,
        multiplier = levelData.multiplier,
        xpForCurrent = xpForCurrent,
        xpForNext = xpForNext,
        currentLevelMax = levelData.maxXP
    })
end)

-- Get player towing stats callback
QBCore.Functions.CreateCallback('qb-tow:server:GetStats', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then
        cb({xp = 0, level = 1, levelLabel = "Rookie", multiplier = 1.0, xpForCurrent = 0, xpForNext = 500, currentLevelMax = 500})
        return
    end
    
    local success, stats = pcall(function()
        return GetTowingStats(Player)
    end)
    
    if not success or not stats then
        -- Return default stats if there's an error
        cb({xp = 0, level = 1, levelLabel = "Rookie", multiplier = 1.0, xpForCurrent = 0, xpForNext = 500, currentLevelMax = 500})
        return
    end
    
    local level, levelData = CalculateLevel(stats.xp)
    
    -- Calculate XP progress
    local xpForCurrent = stats.xp - levelData.minXP
    local xpForNext = levelData.maxXP - levelData.minXP
    local currentLevelMax = levelData.maxXP
    
    -- Handle max level case
    if levelData.maxXP >= 999999 then
        xpForNext = 1 -- Avoid division by zero
        if xpForCurrent > 0 then
            xpForCurrent = 1
        end
    end
    
    cb({
        xp = stats.xp,
        level = level,
        levelLabel = levelData.label,
        multiplier = levelData.multiplier,
        xpForCurrent = xpForCurrent,
        xpForNext = xpForNext,
        currentLevelMax = currentLevelMax
    })
end)

QBCore.Commands.Add('npc', Lang:t('info.toggle_npc'), {}, false, function(source)
    TriggerClientEvent('jobs:client:ToggleNpc', source)
end)

QBCore.Commands.Add('tow', Lang:t('info.tow'), {}, false, function(source)
    local Player = QBCore.Functions.GetPlayer(source)
    if Player.PlayerData.job.name == 'tow' or Player.PlayerData.job.name == 'mechanic' then
        TriggerClientEvent('qb-tow:client:TowVehicle', source)
    end
end)
