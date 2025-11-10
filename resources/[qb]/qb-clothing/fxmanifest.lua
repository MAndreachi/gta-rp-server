fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author 'Kakarot'
description 'A menu providing players the ability to change their clothing and accessories'
version '2.0.0'

ui_page 'web/dist/index.html'

shared_scripts {
    '@qb-core/shared/locale.lua',
    'locales/en.lua',
    'locales/*.lua',
    'config.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}

client_scripts {
    '@PolyZone/client.lua',
    '@PolyZone/BoxZone.lua',
    '@PolyZone/ComboZone.lua',
    'client/main.lua'
}

files {
    'web/dist/index.html',
    'web/dist/assets/**',
}
