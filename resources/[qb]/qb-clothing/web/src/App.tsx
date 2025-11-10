import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'
import {
	Camera, User, Shirt, Footprints, RotateCcw, RotateCw, Minus, Plus,
	Baby, GitMerge, Eye, Heart, Square, Circle, Scissors, Palette, Calendar,
	Hand, Shield, Image, Star, ShoppingBag,
	Clock
} from 'lucide-react'

type SkinData = {
	[key: string]: {
		item: number
		texture: number
		defaultItem?: number
		defaultTexture?: number
		skinMix?: number
		shapeMix?: number
		defaultSkinMix?: number
		defaultShapeMix?: number
	}
}

type Menu = {
	menu: string
	label: string
	selected: boolean
}

type MaxValues = {
	[key: string]: {
		type: string
		item: number
		texture: number
		shapeMix?: number
		skinMix?: number
	}
}

type Outfit = {
	outfitname: string
	outfitId?: number
	skin?: string
}

export default function App() {
	const [isOpen, setIsOpen] = React.useState(false)
	const [activeMenu, setActiveMenu] = React.useState<string>('character')
	const [skinData, setSkinData] = React.useState<SkinData>({})
	const [maxValues, setMaxValues] = React.useState<MaxValues>({})
	const [menus, setMenus] = React.useState<Menu[]>([])
	const [translations, setTranslations] = React.useState<Record<string, string>>({})
	const [hasTracker, setHasTracker] = React.useState(false)
	const [myOutfits, setMyOutfits] = React.useState<Outfit[]>([])
	const [showSaveOutfit, setShowSaveOutfit] = React.useState(false)
	const [outfitName, setOutfitName] = React.useState('')
	const [selectedCamera, setSelectedCamera] = React.useState<number | null>(null)

	const translate = React.useCallback((key: string): string => {
		return translations[key] || key
	}, [translations])

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			const data = msg.data

			switch (data?.action) {
				case 'open': {
					setIsOpen(true)
					setSkinData(data.currentClothing || {})
					setMaxValues(data.maxValues || {})
					setMenus(data.menus || [])
					setTranslations(data.translations || {})
					setHasTracker(data.hasTracker || false)
					if (data.menus && data.menus.length > 0) {
						const selected = data.menus.find((m: Menu) => m.selected)
						if (selected) setActiveMenu(selected.menu)
					}
					break
				}
				case 'close': {
					setIsOpen(false)
					break
				}
				case 'updateMax': {
					setMaxValues(data.maxValues || {})
					break
				}
				case 'reloadMyOutfits': {
					setMyOutfits(data.outfits || [])
					break
				}
				case 'ResetValues': {
					// Reset to default values
					const defaults: SkinData = {}
					Object.keys(skinData).forEach(key => {
						defaults[key] = {
							...skinData[key],
							item: skinData[key].defaultItem ?? skinData[key].item,
							texture: skinData[key].defaultTexture ?? skinData[key].texture,
							skinMix: skinData[key].defaultSkinMix ?? skinData[key].skinMix,
							shapeMix: skinData[key].defaultShapeMix ?? skinData[key].shapeMix,
						}
					})
					setSkinData(defaults)
					break
				}
				default:
					break
			}
		}

		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [skinData])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', isOpen)
	}, [isOpen])

	React.useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!isOpen) return
			if (e.key === 'Escape' || e.key === 'Tab') {
				closeMenu()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isOpen])

	const updateSkin = React.useCallback(async (clothingType: string, articleNumber: number, type: 'item' | 'texture' | 'skinMix' | 'shapeMix') => {
		if (hasTracker && clothingType === 'accessory' && articleNumber === 13) {
			await nuiSend('TrackerError')
			return
		}

		try {
			const payload = {
				clothingType,
				articleNumber,
				type
			}
			console.log('Sending updateSkin:', payload)
			await nuiSend('updateSkin', payload)

			setSkinData(prev => {
				const updated = { ...prev }
				if (updated[clothingType]) {
					if (type === 'item') {
						updated[clothingType] = { ...updated[clothingType], item: articleNumber }
					} else if (type === 'texture') {
						updated[clothingType] = { ...updated[clothingType], texture: articleNumber }
					} else if (type === 'skinMix') {
						updated[clothingType] = { ...updated[clothingType], skinMix: articleNumber }
					} else if (type === 'shapeMix') {
						updated[clothingType] = { ...updated[clothingType], shapeMix: articleNumber }
					}
				} else {
					// Initialize if doesn't exist
					updated[clothingType] = {
						item: type === 'item' ? articleNumber : 0,
						texture: type === 'texture' ? articleNumber : 0,
						skinMix: type === 'skinMix' ? articleNumber : 0,
						shapeMix: type === 'shapeMix' ? articleNumber : 0,
					}
				}
				return updated
			})
		} catch (error) {
			console.error('Error updating skin:', error)
		}
	}, [hasTracker])

	const updateSkinOnInput = React.useCallback(async (clothingType: string, articleNumber: number, type: 'item' | 'texture' | 'skinMix' | 'shapeMix') => {
		if (hasTracker && clothingType === 'accessory' && articleNumber === 13) {
			await nuiSend('TrackerError')
			return
		}

		if (clothingType === 'accessory' && articleNumber === 13) {
			return
		}

		try {
			const payload = {
				clothingType,
				articleNumber,
				type
			}
			console.log('Sending updateSkinOnInput:', payload)
			await nuiSend('updateSkinOnInput', payload)

			setSkinData(prev => {
				const updated = { ...prev }
				if (updated[clothingType]) {
					if (type === 'item') {
						updated[clothingType] = { ...updated[clothingType], item: articleNumber }
					} else if (type === 'texture') {
						updated[clothingType] = { ...updated[clothingType], texture: articleNumber }
					} else if (type === 'skinMix') {
						updated[clothingType] = { ...updated[clothingType], skinMix: articleNumber }
					} else if (type === 'shapeMix') {
						updated[clothingType] = { ...updated[clothingType], shapeMix: articleNumber }
					}
				} else {
					// Initialize if doesn't exist
					updated[clothingType] = {
						item: type === 'item' ? articleNumber : 0,
						texture: type === 'texture' ? articleNumber : 0,
						skinMix: type === 'skinMix' ? articleNumber : 0,
						shapeMix: type === 'shapeMix' ? articleNumber : 0,
					}
				}
				return updated
			})
		} catch (error) {
			console.error('Error updating skin on input:', error)
		}
	}, [hasTracker])

	const closeMenu = React.useCallback(async () => {
		setIsOpen(false)
		await nuiSend('close')
	}, [])

	const saveClothing = React.useCallback(async () => {
		await nuiSend('saveClothing')
		closeMenu()
	}, [closeMenu])

	const resetOutfit = React.useCallback(async () => {
		await nuiSend('resetOutfit')
		closeMenu()
	}, [closeMenu])

	const setupCam = React.useCallback(async (value: number) => {
		await nuiSend('setupCam', { value })
		setSelectedCamera(prev => prev === value ? null : value)
	}, [])

	const rotateRight = React.useCallback(async () => {
		await nuiSend('rotateRight')
	}, [])

	const rotateLeft = React.useCallback(async () => {
		await nuiSend('rotateLeft')
	}, [])

	const saveOutfit = React.useCallback(async () => {
		if (!outfitName.trim()) return
		await nuiSend('saveOutfit', { outfitName: outfitName.trim() })
		setOutfitName('')
		setShowSaveOutfit(false)
	}, [outfitName])

	const selectOutfit = React.useCallback(async (outfit: Outfit) => {
		await nuiSend('selectOutfit', {
			outfitData: outfit.skin || outfit,
			outfitName: outfit.outfitname,
			outfitId: outfit.outfitId
		})
	}, [])

	const removeOutfit = React.useCallback(async (outfit: Outfit) => {
		await nuiSend('removeOutfit', {
			outfitData: outfit.skin || outfit,
			outfitName: outfit.outfitname,
			outfitId: outfit.outfitId
		})
	}, [])

	const renderSlider = (
		category: string,
		label: string,
		type: 'item' | 'texture' | 'skinMix' | 'shapeMix',
		min: number = 0,
		max: number = 100,
		icon?: React.ReactNode
	) => {
		const currentValue = type === 'skinMix' || type === 'shapeMix'
			? Math.round((skinData[category]?.[type] ?? 0) * 100)
			: type === 'item'
				? skinData[category]?.item ?? 0
				: skinData[category]?.texture ?? 0

		const maxVal = type === 'skinMix' || type === 'shapeMix'
			? max
			: type === 'item'
				? maxValues[category]?.item ?? max
				: maxValues[category]?.texture ?? max

		return (
			<div className="space-y-2">
				<label className="flex items-center gap-2 text-xs font-medium text-[#888]">
					{icon && <span className="text-[#666]">{icon}</span>}
					{translate(label)}
				</label>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault()
							const newValue = Math.max(min, currentValue - 1)
							if (type === 'skinMix' || type === 'shapeMix') {
								updateSkin(category, newValue / 100, type)
							} else {
								updateSkin(category, newValue, type)
							}
						}}
						className="w-8 h-8 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-center cursor-pointer"
					>
						<Minus className="w-3.5 h-3.5" />
					</button>
					<input
						type="number"
						value={currentValue}
						onChange={(e) => {
							const val = Number(e.target.value)
							if (!isNaN(val)) {
								if (type === 'skinMix' || type === 'shapeMix') {
									updateSkinOnInput(category, val / 100, type)
								} else {
									updateSkinOnInput(category, val, type)
								}
							}
						}}
						min={min}
						max={maxVal}
						className="flex-1 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-xs text-white focus:border-[#4a4a4a] focus:outline-none"
					/>
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault()
							const newValue = Math.min(maxVal, currentValue + 1)
							if (type === 'skinMix' || type === 'shapeMix') {
								updateSkin(category, newValue / 100, type)
							} else {
								updateSkin(category, newValue, type)
							}
						}}
						className="w-8 h-8 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-center cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>
		)
	}

	const renderRangeSlider = (
		category: string,
		label: string,
		type: 'skinMix' | 'shapeMix',
		min: number = 0,
		max: number = 0.99,
		icon?: React.ReactNode
	) => {
		const currentValue = skinData[category]?.[type] ?? 0.5

		return (
			<div className="space-y-2">
				<label className="flex items-center gap-2 text-xs font-medium text-[#888]">
					{icon && <span className="text-[#666]">{icon}</span>}
					{translate(label)}
				</label>
				<input
					type="range"
					min={min}
					max={max}
					step={0.01}
					value={currentValue}
					onChange={(e) => {
						const val = Number(e.target.value)
						if (!isNaN(val)) {
							updateSkin(category, val, type)
						}
					}}
					className="w-full h-2 bg-[#0f0f0f] rounded-lg appearance-none cursor-pointer accent-green-600"
				/>
				<div className="flex justify-between text-xs text-[#888]">
					<span>{translate('mother')}</span>
					<span>{translate('father')}</span>
				</div>
			</div>
		)
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 pointer-events-auto z-50">
			<div className="absolute right-0 top-0 bottom-0 w-[30vw] min-w-[400px] max-w-[600px] rounded-l-md border-l border-t border-b border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl flex flex-col">
				{/* Header */}
				<div className="flex flex-col gap-3 border-b border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<div className="flex flex-wrap gap-2">
						{menus.map(menu => (
							<button
								key={menu.menu}
								type="button"
								onClick={(e) => {
									e.preventDefault()
									setActiveMenu(menu.menu)
								}}
								className={cn(
									"rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
									activeMenu === menu.menu
										? "border-green-600 bg-green-600/20 text-green-400"
										: "border-[#2a2a2a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
								)}
							>
								{translate(menu.label)}
							</button>
						))}
					</div>
					<div className="flex items-center gap-2">
						{/* Camera Controls */}
						{[0, 1, 2, 3].map(cam => (
							<button
								key={cam}
								type="button"
								onClick={(e) => {
									e.preventDefault()
									setupCam(cam)
								}}
								className={cn(
									"w-9 h-9 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-center cursor-pointer",
									selectedCamera === cam && "border-green-600 bg-green-600/20"
								)}
								title={cam === 0 ? 'Face' : cam === 1 ? 'Head' : cam === 2 ? 'Body' : 'Feet'}
							>
								{cam === 0 && <Camera className="w-4 h-4" />}
								{cam === 1 && <User className="w-4 h-4" />}
								{cam === 2 && <Shirt className="w-4 h-4" />}
								{cam === 3 && <Footprints className="w-4 h-4" />}
							</button>
						))}
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault()
								rotateLeft()
							}}
							className="w-9 h-9 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-center cursor-pointer"
							title="Rotate Left"
						>
							<RotateCcw className="w-4 h-4" />
						</button>
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault()
								rotateRight()
							}}
							className="w-9 h-9 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-center cursor-pointer"
							title="Rotate Right"
						>
							<RotateCw className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-y-auto p-4 space-y-3">
					{activeMenu === 'character' && (
						<>
							{/* Parent Face Selection */}
							<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
								<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
									<User className="w-4 h-4 text-[#666]" />
									{translate('parent_face') || 'Parent Face Selection'}
								</h4>
								<p className="text-xs text-[#666] mb-3">
									{translate('parent_face_desc') || 'Select two parent faces to blend together. Adjust the sliders below to mix their features.'}
								</p>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-3">
										<label className="block text-xs font-medium text-[#888]">{translate('parent_face_1') || 'Parent Face 1'}</label>
										{renderSlider('face', 'type', 'item', 0, 45, <User className="w-3.5 h-3.5" />)}
										{renderSlider('face', 'skin_color', 'texture', 0, 15, <Palette className="w-3.5 h-3.5" />)}
									</div>
									<div className="space-y-3">
										<label className="block text-xs font-medium text-[#888]">{translate('parent_face_2') || 'Parent Face 2'}</label>
										{renderSlider('face2', 'type', 'item', 0, 45, <User className="w-3.5 h-3.5" />)}
										{renderSlider('face2', 'skin_color', 'texture', 0, 15, <Palette className="w-3.5 h-3.5" />)}
									</div>
								</div>
							</div>

							{/* Parent Face Blend */}
							<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
								<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
									<GitMerge className="w-4 h-4 text-[#666]" />
									{translate('parent_face_blend') || 'Face Blend'}
								</h4>
								<p className="text-xs text-[#666] mb-3">
									{translate('parent_face_blend_desc') || 'Adjust how much each parent face contributes to the final appearance.'}
								</p>
								<div className="space-y-4">
									{renderRangeSlider('facemix', 'shape_mix', 'shapeMix', 0, 0.99, <Square className="w-3.5 h-3.5" />)}
									{renderRangeSlider('facemix', 'skin_mix', 'skinMix', 0, 0.99, <Palette className="w-3.5 h-3.5" />)}
								</div>
							</div>

							{/* Facial Features */}
							{/* Nose Features */}
							{['nose_0', 'nose_1', 'nose_2', 'nose_3', 'nose_4', 'nose_5'].map(nose => (
								<div key={nose} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<User className="w-4 h-4 text-[#666]" />
										{translate(nose === 'nose_0' ? 'nose_width' : nose === 'nose_1' ? 'nose_peak_height' : nose === 'nose_2' ? 'nose_peak_length' : nose === 'nose_3' ? 'nose_bone_height' : nose === 'nose_4' ? 'nose_peak_lowering' : 'nose_bone_twist')}
									</h4>
									{renderSlider(nose, nose === 'nose_0' ? 'width' : nose === 'nose_1' ? 'height' : nose === 'nose_2' ? 'length' : nose === 'nose_3' ? 'height' : nose === 'nose_4' ? 'lowering' : 'twist', 'item', -10, 10, <Square className="w-3.5 h-3.5" />)}
								</div>
							))}

							{/* Eyebrow Features */}
							{['eyebrown_high', 'eyebrown_forward'].map(eyebrow => (
								<div key={eyebrow} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<Eye className="w-4 h-4 text-[#666]" />
										{translate(eyebrow === 'eyebrown_high' ? 'eyebrow_height' : 'eyebrow_depth')}
									</h4>
									{renderSlider(eyebrow, eyebrow === 'eyebrown_high' ? 'height' : 'depth', 'item', -10, 10, <Square className="w-3.5 h-3.5" />)}
								</div>
							))}

							{/* Cheek Features */}
							{['cheek_1', 'cheek_2', 'cheek_3'].map(cheek => (
								<div key={cheek} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<User className="w-4 h-4 text-[#666]" />
										{translate(cheek === 'cheek_1' ? 'cheeks_height' : cheek === 'cheek_2' ? 'cheeks_width' : 'cheeks_depth')}
									</h4>
									{renderSlider(cheek, cheek === 'cheek_1' ? 'height' : cheek === 'cheek_2' ? 'width' : 'depth', 'item', -10, 10, <Square className="w-3.5 h-3.5" />)}
								</div>
							))}

							{/* Other Features */}
							{[
								{ key: 'eye_opening', label: 'eyes_opening', subLabel: 'opening', icon: <Eye className="w-4 h-4" /> },
								{ key: 'lips_thickness', label: 'lips_thickness', subLabel: 'thickness', icon: <Heart className="w-4 h-4" /> },
								{ key: 'jaw_bone_width', label: 'jaw_bone_width', subLabel: 'width', icon: <Square className="w-4 h-4" /> },
								{ key: 'jaw_bone_back_lenght', label: 'jaw_bone_length', subLabel: 'length', icon: <Square className="w-4 h-4" /> },
								{ key: 'chimp_bone_lowering', label: 'chin_height', subLabel: 'height', icon: <Circle className="w-4 h-4" /> },
								{ key: 'chimp_bone_lenght', label: 'chin_bone Length', subLabel: 'length', icon: <Circle className="w-4 h-4" /> },
								{ key: 'chimp_bone_width', label: 'chin_bone_width', subLabel: 'width', icon: <Circle className="w-4 h-4" /> },
								{ key: 'chimp_hole', label: 'butt_chin', subLabel: 'size', icon: <Circle className="w-4 h-4" /> },
								{ key: 'neck_thikness', label: 'neck_thickness', subLabel: 'thickness', icon: <User className="w-4 h-4" /> },
							].map(feature => (
								<div key={feature.key} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<span className="text-[#666]">{feature.icon}</span>
										{translate(feature.label)}
									</h4>
									{renderSlider(feature.key, feature.subLabel, 'item', -10, 10, <Square className="w-3.5 h-3.5" />)}
								</div>
							))}
						</>
					)}

					{activeMenu === 'hair' && (
						<>
							{[
								{ key: 'eye_color', label: 'eye_color', subLabel: 'color', icon: <Eye className="w-4 h-4" /> },
								{ key: 'moles', label: 'moles', subLabel: 'type', hasOpacity: true, icon: <Circle className="w-4 h-4" /> },
								{ key: 'ageing', label: 'ageing', subLabel: 'type', icon: <Calendar className="w-4 h-4" /> },
								{ key: 'hair', label: 'hair', subLabel: 'type', hasColor: true, icon: <Scissors className="w-4 h-4" /> },
								{ key: 'eyebrows', label: 'eyebrow', subLabel: 'type', hasColor: true, icon: <Eye className="w-4 h-4" /> },
								{ key: 'beard', label: 'facial_hair', subLabel: 'type', hasColor: true, icon: <Scissors className="w-4 h-4" /> },
								{ key: 'lipstick', label: 'lipstick', subLabel: 'type', hasColor: true, icon: <Heart className="w-4 h-4" /> },
								{ key: 'blush', label: 'blush', subLabel: 'type', hasColor: true, icon: <Circle className="w-4 h-4" /> },
								{ key: 'makeup', label: 'makeup', subLabel: 'type', hasColor: true, icon: <Star className="w-4 h-4" /> },
							].map(item => (
								<div key={item.key} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<span className="text-[#666]">{item.icon}</span>
										{translate(item.label)}
									</h4>
									<div className="space-y-3">
										{renderSlider(item.key, item.subLabel, 'item', 0, 100, <Square className="w-3.5 h-3.5" />)}
										{(item.hasColor || item.hasOpacity) && renderSlider(item.key, item.hasOpacity ? 'opacity' : 'color', 'texture', 0, 100, <Palette className="w-3.5 h-3.5" />)}
									</div>
								</div>
							))}
						</>
					)}

					{activeMenu === 'clothing' && (
						<>
							{[
								{ key: 'arms', label: 'arms', icon: <Hand className="w-4 h-4" /> },
								{ key: 't-shirt', label: 'undershirt', icon: <Shirt className="w-4 h-4" /> },
								{ key: 'torso2', label: 'jacket', icon: <Shirt className="w-4 h-4" /> },
								{ key: 'vest', label: 'vests', icon: <Shield className="w-4 h-4" /> },
								{ key: 'decals', label: 'decals', icon: <Image className="w-4 h-4" /> },
								{ key: 'accessory', label: 'acessory', icon: <Star className="w-4 h-4" /> },
								{ key: 'bag', label: 'bags', icon: <ShoppingBag className="w-4 h-4" /> },
								{ key: 'pants', label: 'pants', icon: <Square className="w-4 h-4" /> },
								{ key: 'shoes', label: 'shoes', icon: <Footprints className="w-4 h-4" /> },
							].map(item => (
								<div key={item.key} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<span className="text-[#666]">{item.icon}</span>
										{translate(item.label)}
									</h4>
									<div className="space-y-3">
										{renderSlider(item.key, 'item', 'item', 0, 100, <Square className="w-3.5 h-3.5" />)}
										{renderSlider(item.key, 'texture', 'texture', 0, 100, <Palette className="w-3.5 h-3.5" />)}
									</div>
								</div>
							))}
						</>
					)}

					{activeMenu === 'accessoires' && (
						<>
							{[
								{ key: 'mask', label: 'mask', icon: <Shield className="w-4 h-4" /> },
								{ key: 'hat', label: 'hat', icon: <Circle className="w-4 h-4" /> },
								{ key: 'glass', label: 'glasses', icon: <Eye className="w-4 h-4" /> },
								{ key: 'ear', label: 'ear_accessories', icon: <Circle className="w-4 h-4" /> },
								{ key: 'watch', label: 'watch', icon: <Clock className="w-4 h-4" /> },
								{ key: 'bracelet', label: 'bracelet', icon: <Circle className="w-4 h-4" /> },
							].map(item => (
								<div key={item.key} className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
									<h4 className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
										<span className="text-[#666]">{item.icon}</span>
										{translate(item.label)}
									</h4>
									<div className="space-y-3">
										{renderSlider(item.key, 'type', 'item', 0, 100, <Square className="w-3.5 h-3.5" />)}
										{renderSlider(item.key, 'texture', 'texture', 0, 100, <Palette className="w-3.5 h-3.5" />)}
									</div>
								</div>
							))}
						</>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault()
							setShowSaveOutfit(true)
						}}
						className="rounded-md border border-green-600 bg-green-600/20 px-3 py-2 text-xs font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
					>
						{translate('btn_saveOutfit')}
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault()
								resetOutfit()
							}}
							className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
						>
							{translate('btn_cancel')}
						</button>
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault()
								saveClothing()
							}}
							className="rounded-md border border-green-600 bg-green-600/20 px-3 py-2 text-xs font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
						>
							{translate('btn_confirm')}
						</button>
					</div>
				</div>
			</div>

			{/* Save Outfit Modal */}
			{showSaveOutfit && (
				<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-60 bg-black/60">
					<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-6 w-[400px]">
						<h3 className="text-base font-semibold text-white mb-4">{translate('outfit_name')}</h3>
						<input
							type="text"
							value={outfitName}
							onChange={(e) => setOutfitName(e.target.value)}
							placeholder={translate('outfit_name')}
							className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2.5 text-sm text-white focus:border-[#4a4a4a] focus:outline-none mb-4"
						/>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault()
									setShowSaveOutfit(false)
									setOutfitName('')
								}}
								className="flex-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
							>
								{translate('btn_cancel')}
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault()
									saveOutfit()
								}}
								className="flex-1 rounded-md border border-green-600 bg-green-600/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
							>
								{translate('btn_confirm')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

