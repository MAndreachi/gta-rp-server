Config = {}

-- Ped model used in Ammu-Nation shops (qb-shops already uses this)
Config.PedModel = 's_m_y_ammucity_01'

-- License fee charged upon passing the quiz
Config.LicenseFee = 5000

-- Cooldown in seconds between quiz attempts per player
Config.AttemptCooldown = 300

-- Passing threshold
Config.TotalQuestions = 5
Config.RequiredCorrect = 4

-- Optional: also give a physical 'weaponlicense' item upon passing
Config.GiveLicenseItem = true

-- Quiz questions
-- Each entry: question (string), answers (array), correct (index 1..n)
Config.Questions = {
	{
		question = 'What is the primary rule of firearm safety?',
		answers = {
			'Always treat every gun as if it is loaded',
			'Only point at what you plan to shoot when safety is off',
			'Keep finger on the trigger for faster reaction',
		},
		correct = 1,
	},
	{
		question = 'When should you place your finger on the trigger?',
		answers = {
			'While aiming down sights',
			'Only when your sights are on target and you are ready to fire',
			'At all times for safety',
		},
		correct = 2,
	},
	{
		question = 'What should you be sure of before firing?',
		answers = {
			'That your weapon is clean',
			'Your stance',
			'Your target and what is beyond it',
		},
		correct = 3,
	},
	{
		question = 'The safest direction to point a firearm is:',
		answers = {
			'At the ground or a safe backstop',
			'At the ceiling',
			'Towards a friend as long as safety is on',
		},
		correct = 1,
	},
	{
		question = 'Transporting a firearm, you should:',
		answers = {
			'Keep it loaded for emergencies',
			'Keep it unloaded and secured',
			'Point it out the window',
		},
		correct = 2,
	},
}


