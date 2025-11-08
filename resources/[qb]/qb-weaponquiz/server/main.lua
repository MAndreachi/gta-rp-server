local QBCore = exports['qb-core']:GetCoreObject()

local playerCooldowns = {}

local function canAttempt(src)
	local now = os.time()
	local last = playerCooldowns[src] or 0
	return (now - last) >= Config.AttemptCooldown
end

local function setCooldown(src)
	playerCooldowns[src] = os.time()
end

QBCore.Functions.CreateCallback('qb-weaponquiz:server:hasWeaponLicense', function(source, cb)
	local Player = QBCore.Functions.GetPlayer(source)
	if not Player then return cb(false) end
	local meta = Player.PlayerData.metadata or {}
	local licences = meta['licences'] or {}
	cb(licences.weapon == true)
end)

RegisterNetEvent('qb-weaponquiz:server:completeQuiz', function(correct, total)
	local src = source
	local Player = QBCore.Functions.GetPlayer(src)
	if not Player then return end

	-- basic attempt cooldown server-side
	if not canAttempt(src) then
		TriggerClientEvent('QBCore:Notify', src, 'Please wait before attempting again.', 'error')
		return
	end

	-- validate numbers
	correct = tonumber(correct) or 0
	total = tonumber(total) or 0
	if total ~= Config.TotalQuestions then
		TriggerClientEvent('QBCore:Notify', src, 'Invalid quiz submission.', 'error')
		return
	end

	-- already licensed?
	local licences = Player.PlayerData.metadata and Player.PlayerData.metadata['licences'] or {}
	if licences and licences.weapon == true then
		TriggerClientEvent('QBCore:Notify', src, 'You already have a weapon license.', 'primary')
		return
	end

	if correct < Config.RequiredCorrect then
		TriggerClientEvent('QBCore:Notify', src, ('Score %d/%d. You did not pass.'):format(correct, total), 'error')
		setCooldown(src)
		return
	end

	-- charge fee
	local charged = false
	if Player.Functions.RemoveMoney('cash', Config.LicenseFee, 'weapon-license-quiz') then
		charged = true
	elseif Player.Functions.RemoveMoney('bank', Config.LicenseFee, 'weapon-license-quiz') then
		charged = true
	end

	if not charged then
		TriggerClientEvent('QBCore:Notify', src, ('You need $%d (cash or bank).'):format(Config.LicenseFee), 'error')
		return
	end

	-- set license
	licences = licences or {}
	licences.weapon = true
	Player.Functions.SetMetaData('licences', licences)

	-- optional: grant physical license item
	if Config.GiveLicenseItem then
		local info = {
			firstname = Player.PlayerData.charinfo.firstname,
			lastname = Player.PlayerData.charinfo.lastname,
			birthdate = Player.PlayerData.charinfo.birthdate,
		}
		exports['qb-inventory']:AddItem(src, 'weaponlicense', 1, false, info, 'qb-weaponquiz:license-granted')
	end

	setCooldown(src)
	TriggerClientEvent('QBCore:Notify', src, 'Congratulations! You passed and received your weapon license.', 'success', 6000)
end)


