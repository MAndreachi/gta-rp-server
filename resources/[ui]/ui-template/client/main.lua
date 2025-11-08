local uiOpen = false

RegisterCommand('open_ui', function()
	if uiOpen then return end
	uiOpen = true
	SetNuiFocus(true, true)
	SendNUIMessage({ action = 'open' })
end, false)

RegisterKeyMapping('open_ui', 'Open UI Template', 'keyboard', 'F10')

RegisterNUICallback('close', function(_, cb)
	uiOpen = false
	SetNuiFocus(false, false)
	SendNUIMessage({ action = 'hide' })
	cb({})
end)


