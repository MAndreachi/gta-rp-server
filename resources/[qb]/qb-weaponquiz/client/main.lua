local QBCore = exports['qb-core']:GetCoreObject()

local quizActive = false
local currentIndex = 0
local correctCount = 0
local lastAttempt = - (Config.AttemptCooldown * 1000)

local function notify(msg, msgType, time)
	TriggerEvent('QBCore:Notify', msg, msgType or 'primary', time or 3000)
end

local function canAttempt()
	local now = GetGameTimer()
	return (now - lastAttempt) >= (Config.AttemptCooldown * 1000)
end

local function closeMenu()
	TriggerEvent('qb-menu:client:closeMenu')
end

local function openQuestion(idx)
	local q = Config.Questions[idx]
	if not q then return end

	local entries = {
		{ header = ('Firearm Safety Quiz (%d/%d)'):format(idx, #Config.Questions), isMenuHeader = true },
		{ header = q.question, isMenuHeader = true },
	}

	for i = 1, #q.answers do
		entries[#entries + 1] = {
			header = q.answers[i],
			icon = 'fa-solid fa-list-ol',
			params = {
				event = 'qb-weaponquiz:client:selectAnswer',
				args = { selected = i }
			}
		}
	end

	exports['qb-menu']:openMenu(entries)
end

RegisterNetEvent('qb-weaponquiz:client:start', function()
	if quizActive then return end
	if not canAttempt() then
		local remaining = (Config.AttemptCooldown * 1000 - (GetGameTimer() - lastAttempt)) / 1000
		notify(('Please wait %.0fs before trying again.'):format(remaining), 'error')
		return
	end

	-- early check: already licensed?
	QBCore.Functions.TriggerCallback('qb-weaponquiz:server:hasWeaponLicense', function(has)
		if has then
			notify('You already have a weapon license.', 'primary')
			return
		end

		quizActive = true
		currentIndex = 1
		correctCount = 0
		openQuestion(currentIndex)
	end)
end)

RegisterNetEvent('qb-weaponquiz:client:selectAnswer', function(data)
	if not quizActive then return end
	local q = Config.Questions[currentIndex]
	if not q then return end

	if data and data.selected and tonumber(data.selected) == q.correct then
		correctCount = correctCount + 1
	end

	currentIndex = currentIndex + 1

	if currentIndex > #Config.Questions then
		closeMenu()
		quizActive = false
		lastAttempt = GetGameTimer()

		local passed = (correctCount >= Config.RequiredCorrect)
		if not passed then
			notify(('You scored %d/%d. You did not pass.'):format(correctCount, #Config.Questions), 'error', 5000)
			return
		end

		-- Passed: ask server to process payment and issue license
		TriggerServerEvent('qb-weaponquiz:server:completeQuiz', correctCount, #Config.Questions)
	else
		openQuestion(currentIndex)
	end
end)

-- Target on Ammu-Nation ped model across all gun stores
CreateThread(function()
	exports['qb-target']:AddTargetModel(GetHashKey(Config.PedModel), {
		options = {
			{
				icon = 'fa-solid fa-clipboard-check',
				label = ('Take Firearm Safety Quiz ($%d)'):format(Config.LicenseFee),
				action = function(entity)
					TriggerEvent('qb-weaponquiz:client:start')
				end
			}
		},
		distance = 2.0
	})
end)


