import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'
import { translationManager } from './lib/translations'
import { validateCharacter } from './lib/validation'
import CharacterSelection from './components/CharacterSelection'
import CharacterRegister from './components/CharacterRegister'
import DeleteConfirmation from './components/DeleteConfirmation'
import LoadingScreen from './components/LoadingScreen'

interface Character {
	citizenid: string
	charinfo: {
		firstname: string
		lastname: string
		nationality?: string
		birthdate?: string
		gender?: number
	}
	job: {
		label: string
	}
	money: {
		cash: number
		bank: number
	}
	cid: number
}

type CharacterMap = Record<number, Character | undefined>

export default function App() {
	const [visible, setVisible] = React.useState(false)
	const [characters, setCharacters] = React.useState<CharacterMap>({})
	const [show, setShow] = React.useState({
		loading: false,
		characters: false,
		register: false,
		delete: false,
	})
	const [registerData, setRegisterData] = React.useState({
		date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().substr(0, 10),
		firstname: '',
		lastname: '',
		nationality: '',
		gender: '',
	})
	const [allowDelete, setAllowDelete] = React.useState(false)
	const [characterAmount, setCharacterAmount] = React.useState(0)
	const [loadingText, setLoadingText] = React.useState('')
	const [selectedCharacter, setSelectedCharacter] = React.useState(-1)
	const [customNationality, setCustomNationality] = React.useState(false)
	const [nationalities, setNationalities] = React.useState<string[]>([])
	const [datePickerOpen, setDatePickerOpen] = React.useState(false)

	const dollar = React.useMemo(() => new Intl.NumberFormat('en-US'), [])

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			const data = msg.data

			switch (data?.action) {
				case 'ui': {
					setVisible(true)
					setCustomNationality(data.customNationality || false)
					translationManager.setTranslations(data.translations || {})
					setNationalities(data.countries || [])
					setCharacterAmount(data.nChar || 0)
					setSelectedCharacter(-1)
					setShow({ loading: false, characters: false, register: false, delete: false })
					setAllowDelete(data.enableDeleteButton || false)

					if (data.toggle) {
						setShow(prev => ({ ...prev, loading: true }))
						setLoadingText(translationManager.translate('retrieving_playerdata'))

						let loadingProgress = 0
						let loadingDots = 0

						const dotsInterval = setInterval(() => {
							loadingDots++
							loadingProgress++
							if (loadingProgress === 3) {
								setLoadingText(translationManager.translate('validating_playerdata'))
							}
							if (loadingProgress === 4) {
								setLoadingText(translationManager.translate('retrieving_characters'))
							}
							if (loadingProgress === 6) {
								setLoadingText(translationManager.translate('validating_characters'))
							}
							if (loadingDots === 4) {
								loadingDots = 0
							}
						}, 500)

						setTimeout(() => {
							nuiSend('setupCharacters')
							setTimeout(() => {
								clearInterval(dotsInterval)
								setLoadingText(translationManager.translate('retrieving_playerdata'))
								setShow({ loading: false, characters: true, register: false, delete: false })
								nuiSend('removeBlur')
							}, 2000)
						}, 2000)
					}
					break
				}
				case 'setupCharacters': {
					const newChars: CharacterMap = {}
					if (data.characters && Array.isArray(data.characters)) {
						for (const char of data.characters) {
							if (char && typeof char.cid === 'number') {
								newChars[char.cid] = char
							}
						}
					}
					setCharacters(newChars)
					break
				}
				case 'setupCharInfo': {
					// Handle character info setup if needed
					break
				}
			}
		}

		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', visible)
	}, [visible])

	const translate = React.useCallback((key: string, params?: Record<string, string>) => {
		return translationManager.translate(key, params)
	}, [])

	const clickCharacter = React.useCallback((idx: number, type: 'existing' | 'empty') => {
		setSelectedCharacter(idx)
		const char = characters[idx]

		if (char) {
			nuiSend('cDataPed', { cData: char })
		} else {
			nuiSend('cDataPed', {})
			if (type === 'empty') {
				resetRegisterData()
				setShow({ loading: false, characters: false, register: true, delete: false })
			}
		}
	}, [characters])

	const prepareDelete = React.useCallback(() => {
		setShow({ loading: false, characters: false, register: false, delete: true })
	}, [])

	const cancelDelete = React.useCallback(() => {
		setShow({ loading: false, characters: true, register: false, delete: false })
	}, [])

	const deleteCharacter = React.useCallback(() => {
		const char = characters[selectedCharacter]
		if (char && show.delete) {
			setShow({ loading: false, characters: false, register: false, delete: false })
			nuiSend('removeCharacter', { citizenid: char.citizenid })
			setTimeout(() => {
				setShow({ loading: false, characters: true, register: false, delete: false })
			}, 500)
		}
	}, [characters, selectedCharacter, show.delete])

	const playCharacter = React.useCallback(() => {
		if (selectedCharacter !== -1) {
			const char = characters[selectedCharacter]
			if (char) {
				nuiSend('selectCharacter', { cData: char })
				setTimeout(() => {
					setShow({ loading: false, characters: false, register: false, delete: false })
				}, 500)
			} else {
				resetRegisterData()
				setShow({ loading: false, characters: false, register: true, delete: false })
			}
		}
	}, [characters, selectedCharacter])

	const resetRegisterData = React.useCallback(() => {
		setShow({ loading: false, characters: false, register: true, delete: false })
		setRegisterData({
			date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().substr(0, 10),
			firstname: '',
			lastname: '',
			nationality: '',
			gender: '',
		})
	}, [])

	const cancelCreate = React.useCallback(() => {
		setShow({ loading: false, characters: true, register: false, delete: false })
	}, [])

	const createCharacter = React.useCallback(() => {
		const validationResult = validateCharacter(registerData, translate)

		if (validationResult.isValid) {
			setShow({ loading: false, characters: false, register: false, delete: false })
			nuiSend('createNewCharacter', {
				firstname: registerData.firstname,
				lastname: registerData.lastname,
				nationality: registerData.nationality,
				birthdate: registerData.date,
				gender: registerData.gender,
				cid: selectedCharacter,
			})
			setTimeout(() => {
				setShow({ loading: false, characters: false, register: false, delete: false })
			}, 500)
		} else {
			// Show error - we'll use a simple alert for now, can be replaced with a toast
			const fieldName = validationResult.field ? translate(validationResult.field) : translate('field')
			const message = validationResult.message || translate('ran_into_issue')
			alert(`${translate('ran_into_issue')}\n${message}`)
		}
	}, [registerData, selectedCharacter, translate])

	if (!visible && !show.loading && !show.characters && !show.register && !show.delete) {
		return null
	}

	return (
		<div className="fixed inset-0 pointer-events-none z-[100]">
			{show.loading && (
				<LoadingScreen loadingText={loadingText} />
			)}

			{show.characters && (
				<CharacterSelection
					characters={characters}
					characterAmount={characterAmount}
					selectedCharacter={selectedCharacter}
					allowDelete={allowDelete}
					dollar={dollar}
					onCharacterClick={clickCharacter}
					onPlayCharacter={playCharacter}
					onPrepareDelete={prepareDelete}
					translate={translate}
				/>
			)}

			{show.register && (
				<CharacterRegister
					registerData={registerData}
					setRegisterData={setRegisterData}
					customNationality={customNationality}
					nationalities={nationalities}
					datePickerOpen={datePickerOpen}
					setDatePickerOpen={setDatePickerOpen}
					onCancel={cancelCreate}
					onCreate={createCharacter}
					translate={translate}
				/>
			)}

			{show.delete && (
				<DeleteConfirmation
					onConfirm={deleteCharacter}
					onCancel={cancelDelete}
					translate={translate}
				/>
			)}
		</div>
	)
}

