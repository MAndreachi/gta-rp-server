local QBCore = exports['qb-core']:GetCoreObject()
local Routes = {}

-- XP and Level Functions
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

local function SetGarbageStats(Player, stats)
    if not Player then 
        print("^1[qb-garbagejob] SetGarbageStats: Player is nil^0")
        return 
    end
    Player.PlayerData.metadata['garbage'] = stats
    Player.Functions.SetMetaData('garbage', stats)
    print("^2[qb-garbagejob] SetGarbageStats: Saved XP=" .. (stats.xp or 0) .. ", Level=" .. (stats.level or 1) .. "^0")
end

local function GetGarbageStats(Player)
    if not Player then 
        return {xp = 0, level = 1}
    end
    local stats = Player.PlayerData.metadata['garbage'] or {}
    local xp = stats.xp or 0
    -- Calculate level from XP if level is not set or if XP has changed
    local level, levelData = CalculateLevel(xp)
    if not stats.level or stats.level ~= level then
        -- Update level if it's missing or incorrect
        stats.level = level
        stats.xp = xp
        -- Use pcall to safely set stats
        pcall(function()
            SetGarbageStats(Player, stats)
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
    local stats = GetGarbageStats(Player)
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
        SetGarbageStats(Player, stats)
    end)
    
    if not success then
        print("^1[qb-garbagejob] Error saving garbage stats^0")
    end
    
    -- Check for level up
    local leveledUp = newLevel > oldLevel
    
    return newXP, newLevel, leveledUp, levelData
end

local function CanPay(Player)
    return Player.PlayerData.money['bank'] >= Config.TruckPrice
end

QBCore.Functions.CreateCallback('qb-garbagejob:server:NewShift', function(source, cb, continue)
    local Player = QBCore.Functions.GetPlayer(source)
    local CitizenId = Player.PlayerData.citizenid
    local shouldContinue = false
    local allStops = {}
    local totalNumberOfStops = 0

    if CanPay(Player) or continue then
        local totalStopsAvailable = #Config.Locations['trashcan']
        if totalStopsAvailable == 0 then
            print('^1[qb-garbagejob] ERROR: No trashcan locations configured^0')
            cb(false, {}, 0)
            return
        end

        local minStops = math.min(Config.MinStops or 1, totalStopsAvailable)
        local maxStops = totalStopsAvailable
        local stopCount = math.random(minStops, maxStops)

        -- Build a table of available stop indices
        local availableStops = {}
        for i = 1, totalStopsAvailable do
            availableStops[i] = i
        end

        -- Shuffle available stops (Fisher-Yates)
        for i = totalStopsAvailable, 2, -1 do
            local j = math.random(i)
            availableStops[i], availableStops[j] = availableStops[j], availableStops[i]
        end

        -- Select the first stopCount unique stops
        for i = 1, stopCount do
            local stopIndex = availableStops[i]
            local newBagAmount = math.random(Config.MinBagsPerStop, Config.MaxBagsPerStop)
            allStops[#allStops + 1] = { stop = stopIndex, bags = newBagAmount }
        end

        -- Track completed stops by stop ID
        local completedStops = {}
        for i = 1, #allStops do
            completedStops[allStops[i].stop] = false
        end

        Routes[CitizenId] = {
            stops = allStops,
            completedStops = completedStops, -- Track which stops are done
            started = true,
            currentDistance = 0,
            depositPay = Config.TruckPrice,
            actualPay = 0,
            stopsCompleted = 0,
            totalNumberOfStops = #allStops,
            routeStartTime = os.time(), -- Track route start time for time bonus
            totalBagsCollected = 0 -- Track total bags for XP calculation
        }

        shouldContinue = true
        totalNumberOfStops = #allStops
    else
        TriggerClientEvent('QBCore:Notify', source, Lang:t('error.not_enough', { value = Config.TruckPrice }), 'error')
    end
    -- Return all stops data instead of just first one
    cb(shouldContinue, allStops, totalNumberOfStops)
end)

RegisterNetEvent('qb-garbagejob:server:payDeposit', function()
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player.Functions.RemoveMoney('bank', Config.TruckPrice, 'garbage-deposit') then
        TriggerClientEvent('QBCore:Notify', source, Lang:t('error.not_enough', { value = Config.TruckPrice }), 'error')
    end
end)

-- New callback: Mark a stop as complete (can be called in any order)
QBCore.Functions.CreateCallback('qb-garbagejob:server:CompleteStop', function(source, cb, stopId, currLocation)
    local Player = QBCore.Functions.GetPlayer(source)
    local CitizenId = Player.PlayerData.citizenid
    
    if not Routes[CitizenId] then
        cb(false, "No active route")
        return
    end
    
    local currStopCoords = Config.Locations['trashcan'][stopId].coords
    currStopCoords = vector3(currStopCoords.x, currStopCoords.y, currStopCoords.z)
    local distance = #(currLocation - currStopCoords)
    
    if distance > 20 then
        TriggerClientEvent('QBCore:Notify', source, Lang:t('error.too_far'), 'error')
        cb(false, "Too far from stop")
        return
    end
    
    -- Check if stop is already completed
    if Routes[CitizenId].completedStops[stopId] == true then
        cb(false, "Stop already completed")
        return
    end
    
    -- Find the stop data
    local stopData = nil
    for i = 1, #Routes[CitizenId].stops do
        if Routes[CitizenId].stops[i].stop == stopId then
            stopData = Routes[CitizenId].stops[i]
            break
        end
    end
    
    if not stopData then
        cb(false, "Invalid stop")
        return
    end
    
    -- Mark stop as completed
    Routes[CitizenId].completedStops[stopId] = true
    Routes[CitizenId].stopsCompleted = tonumber(Routes[CitizenId].stopsCompleted) + 1
    Routes[CitizenId].totalBagsCollected = (Routes[CitizenId].totalBagsCollected or 0) + stopData.bags
    
    -- Calculate payment for this stop
    local totalNewPay = 0
    for _ = 1, stopData.bags do
        totalNewPay = totalNewPay + math.random(Config.BagLowerWorth, Config.BagUpperWorth)
    end
    Routes[CitizenId].actualPay = math.ceil(Routes[CitizenId].actualPay + totalNewPay)
    
    -- Crypto stick chance
    if (math.random(100) >= Config.CryptoStickChance) and Config.GiveCryptoStick then
        exports['qb-inventory']:AddItem(source, 'cryptostick', 1, false, false, 'qb-garbagejob:server:CompleteStop')
        TriggerClientEvent('qb-inventory:client:ItemBox', source, QBCore.Shared.Items['cryptostick'], 'add')
        TriggerClientEvent('QBCore:Notify', source, Lang:t('info.found_crypto'))
    end
    
    -- Check if all stops are completed
    local allCompleted = true
    for stopId, completed in pairs(Routes[CitizenId].completedStops) do
        if not completed then
            allCompleted = false
            break
        end
    end
    
    cb(true, allCompleted, Routes[CitizenId].stopsCompleted, Routes[CitizenId].totalNumberOfStops)
end)

QBCore.Functions.CreateCallback('qb-garbagejob:server:EndShift', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    local CitizenId = Player.PlayerData.citizenid
    local status = false
    if Routes[CitizenId] ~= nil then status = true end
    cb(status)
end)

RegisterNetEvent('qb-garbagejob:server:PayShift', function(continue)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    local CitizenId = Player.PlayerData.citizenid
    if Routes[CitizenId] ~= nil then
        local depositPay = Routes[CitizenId].depositPay
        -- Check if all stops were completed
        local allCompleted = true
        if Routes[CitizenId].completedStops then
            for stopId, completed in pairs(Routes[CitizenId].completedStops) do
                if not completed then
                    allCompleted = false
                    break
                end
            end
        end
        
        if not allCompleted or tonumber(Routes[CitizenId].stopsCompleted) < tonumber(Routes[CitizenId].totalNumberOfStops) then
            depositPay = 0
            TriggerClientEvent('QBCore:Notify', src, Lang:t('error.early_finish', { completed = Routes[CitizenId].stopsCompleted, total = Routes[CitizenId].totalNumberOfStops }), 'error')
        end
        if continue then
            depositPay = 0
        end
        
        -- Calculate XP for completed route
        local routeCompleted = tonumber(Routes[CitizenId].stopsCompleted) >= tonumber(Routes[CitizenId].totalNumberOfStops)
        if routeCompleted then
            local routeTime = os.time() - (Routes[CitizenId].routeStartTime or os.time())
            local totalBags = Routes[CitizenId].totalBagsCollected or 0
            -- Trigger XP event directly (we're already on server)
            TriggerEvent('qb-garbagejob:server:AddXP', src, Routes[CitizenId].stopsCompleted, totalBags, routeTime)
        end
        
        -- Apply level-based payment multiplier
        local stats = GetGarbageStats(Player)
        local multiplier = 1.0
        if stats and stats.level then
            multiplier = GetPaymentMultiplier(stats.level)
            print("^2[qb-garbagejob] PayShift: Level " .. stats.level .. ", Multiplier " .. multiplier .. "x^0")
        end
        
        local totalToPay = math.ceil((depositPay + Routes[CitizenId].actualPay) * multiplier)
        local payoutDeposit = Lang:t('info.payout_deposit', { value = depositPay })
        if depositPay == 0 then
            payoutDeposit = ''
        end

        -- Use AddMoneyToPlayerBank to create transaction history
        exports['qb-banking']:AddMoneyToPlayerBank(src, totalToPay, 'Garbage Job Payment', 'checking')
        TriggerClientEvent('QBCore:Notify', src, Lang:t('success.pay_slip', { total = totalToPay, deposit = payoutDeposit }), 'success')
        Routes[CitizenId] = nil
    else
        TriggerClientEvent('QBCore:Notify', source, Lang:t('error.never_clocked_on'), 'error')
    end
end)

-- XP Gain Event (called when route is completed)
RegisterNetEvent('qb-garbagejob:server:AddXP', function(src, stopsCompleted, totalBags, routeTime)
    -- src is passed as first parameter when called from server event
    if not src then
        src = source -- Fallback to source if called from client
    end
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then 
        print("^1[qb-garbagejob] AddXP: Player not found^0")
        return 
    end
    if Player.PlayerData.job.name ~= 'garbage' then 
        print("^1[qb-garbagejob] AddXP: Player not in garbage job^0")
        return 
    end
    
    print("^2[qb-garbagejob] AddXP: Processing XP (stops=" .. (stopsCompleted or 0) .. ", bags=" .. (totalBags or 0) .. ", time=" .. (routeTime or 0) .. ")^0")
    
    local xpGained = 0
    local bonuses = {}
    
    -- Base XP per stop
    xpGained = Config.XP.BaseXP * (stopsCompleted or 0)
    
    -- Bag bonus (2 XP per bag)
    if totalBags and totalBags > 0 then
        local bagBonus = Config.XP.BagBonus * totalBags
        xpGained = xpGained + bagBonus
        bonuses[#bonuses + 1] = Lang:t('xp.bag_bonus', { value = bagBonus })
        print("^2[qb-garbagejob] AddXP: Bag bonus added: " .. bagBonus .. "^0")
    end
    
    -- Route completion bonus (all stops completed)
    if stopsCompleted and stopsCompleted > 0 then
        xpGained = xpGained + Config.XP.RouteBonus
        bonuses[#bonuses + 1] = Lang:t('xp.route_bonus', { value = Config.XP.RouteBonus })
        print("^2[qb-garbagejob] AddXP: Route bonus added^0")
    end
    
    -- Time bonus (quick route completion)
    if routeTime and routeTime <= Config.XP.TimeThreshold then
        xpGained = xpGained + Config.XP.TimeBonus
        bonuses[#bonuses + 1] = Lang:t('xp.time_bonus', { value = Config.XP.TimeBonus })
        print("^2[qb-garbagejob] AddXP: Time bonus added^0")
    end
    
    print("^2[qb-garbagejob] AddXP: Total XP to add: " .. xpGained .. "^0")
    local newXP, newLevel, leveledUp, levelData = AddXP(Player, xpGained)
    print("^2[qb-garbagejob] AddXP: New XP=" .. newXP .. ", New Level=" .. newLevel .. "^0")
    
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
        -- Only show base XP notification
        TriggerClientEvent('QBCore:Notify', src, Lang:t('xp.gained', { xp = xpGained, total = newXP }), 'success')
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
    TriggerClientEvent('qb-garbagejob:client:UpdateStats', src, {
        xp = newXP,
        level = newLevel,
        levelLabel = levelData.label,
        multiplier = levelData.multiplier,
        xpForCurrent = xpForCurrent,
        xpForNext = xpForNext,
        currentLevelMax = levelData.maxXP
    })
end)

-- Get player garbage stats callback
QBCore.Functions.CreateCallback('qb-garbagejob:server:GetStats', function(source, cb)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then
        cb({xp = 0, level = 1, levelLabel = "Rookie", multiplier = 1.0, xpForCurrent = 0, xpForNext = 500, currentLevelMax = 500})
        return
    end
    
    local success, stats = pcall(function()
        return GetGarbageStats(Player)
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

QBCore.Commands.Add('cleargarbroutes', 'Removes garbo routes for user (admin only)', { { name = 'id', help = 'Player ID (may be empty)' } }, false, function(source, args)
    local Player = QBCore.Functions.GetPlayer(tonumber(args[1]))
    local CitizenId = Player.PlayerData.citizenid
    local count = 0
    for k, _ in pairs(Routes) do
        if k == CitizenId then
            count = count + 1
        end
    end

    TriggerClientEvent('QBCore:Notify', source, Lang:t('success.clear_routes', { value = count }), 'success')
    Routes[CitizenId] = nil
end, 'admin')
