fx_version 'cerulean'
game 'gta5'

lua54 'yes'

author 'Server Team'
description 'Ammu-Nation Firearm Safety Quiz to obtain weapon license'
version '1.0.0'

shared_script 'config.lua'

client_scripts {
	'client/main.lua'
}

server_scripts {
	'@oxmysql/lib/MySQL.lua',
	'server/main.lua'
}

dependencies {
	'qb-core',
	'qb-target',
	'qb-menu',
	'qb-input',
	'qb-inventory'
}


