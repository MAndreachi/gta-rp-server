import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'

type Vehicle = {
	model: string
	name: string
	brand: string
	price: number
	category: string
	type?: string
	stock?: 'in_stock' | 'limited' | 'out_of_stock'
	tradeInValue?: number
	seats?: number
	fuelType?: string
	drivetrain?: string
}

type VehicleStats = {
	topSpeed: number // mph
	acceleration: number // acceleration force
	braking: number // brake force
	handling: number // steering lock degrees
	traction: number // traction value
	mass: number // kg
	// Normalized percentages for progress bars
	topSpeedPercent?: number
	accelerationPercent?: number
	brakingPercent?: number
	handlingPercent?: number
	tractionPercent?: number
}

type ShopData = {
	shopName: string
	shopLabel: string
	vehicles: Vehicle[]
	categories: string[]
	makes: string[]
	playerCash: number
	playerBank: number
	displayedVehicle?: string
	ownedVehicles?: Array<{ model: string; plate: string; tradeInValue: number }>
}

type Notification = {
	message: string
	type: 'success' | 'error'
}

// Local storage helpers
const getRecentlyViewed = (): string[] => {
	try {
		return JSON.parse(localStorage.getItem('vehicleshop_recently_viewed') || '[]')
	} catch {
		return []
	}
}

const saveRecentlyViewed = (recent: string[]) => {
	localStorage.setItem('vehicleshop_recently_viewed', JSON.stringify(recent.slice(0, 10)))
}

export default function App() {
	const [isOpen, setIsOpen] = React.useState(false)
	const [shopData, setShopData] = React.useState<ShopData | null>(null)
	const [notification, setNotification] = React.useState<Notification | null>(null)
	const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
	const [selectedMake, setSelectedMake] = React.useState<string | null>(null)
	const [selectedVehicle, setSelectedVehicle] = React.useState<Vehicle | null>(null)
	const [filteredVehicles, setFilteredVehicles] = React.useState<Vehicle[]>([])
	const [searchQuery, setSearchQuery] = React.useState('')
	const [sortBy, setSortBy] = React.useState<'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'speed-desc' | 'accel-desc' | 'handling-desc'>('name-asc')
	const [isPreviewing, setIsPreviewing] = React.useState(false)
	const [vehicleStats, setVehicleStats] = React.useState<VehicleStats | null>(null)
	const [loadingStats, setLoadingStats] = React.useState(false)
	const [selectedPrimaryColor, setSelectedPrimaryColor] = React.useState<number>(0)
	const [selectedSecondaryColor, setSelectedSecondaryColor] = React.useState<number>(0)
	const [showFinanceModal, setShowFinanceModal] = React.useState(false)
	const [downPayment, setDownPayment] = React.useState<number>(0)
	const [numberOfPayments, setNumberOfPayments] = React.useState<number>(12)
	
	// New feature states
	const [recentlyViewed, setRecentlyViewed] = React.useState<string[]>(getRecentlyViewed())
	const [comparisonVehicles, setComparisonVehicles] = React.useState<Vehicle[]>([])
	const [showComparison, setShowComparison] = React.useState(false)
	const [vehicleStatsMap, setVehicleStatsMap] = React.useState<Record<string, VehicleStats>>({})
	const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
	const currentFetchRef = React.useRef<string | null>(null)
	const preloadTimeoutRef = React.useRef<Record<string, number>>({})
	const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

	const addToRecentlyViewed = React.useCallback((model: string) => {
		const recent = getRecentlyViewed()
		const updated = [model, ...recent.filter(m => m !== model)]
		saveRecentlyViewed(updated)
		setRecentlyViewed(updated)
	}, [])

	const addNotification = React.useCallback((message: string, type: 'success' | 'error') => {
		setNotification({ message, type })
		setTimeout(() => setNotification(null), 3000)
	}, [])

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			switch (msg.data?.action) {
				case 'openShop': {
					const shopData = msg.data.shopData
					setShopData(shopData)
					setIsOpen(true)
					setSelectedCategory(null)
					setSelectedMake(null)
					setFilteredVehicles(shopData.vehicles)
					setSearchQuery('')
					setSelectedPrimaryColor(0)
					setSelectedSecondaryColor(0)
					setRecentlyViewed(getRecentlyViewed())
					setFocusedIndex(-1)
					savedBrowseStateRef.current = null
					isRestoringRef.current = false
					setShowFinanceModal(false)
					setDownPayment(10)
					setNumberOfPayments(12)
					
					if (shopData.displayedVehicle) {
						const displayedVeh = shopData.vehicles.find((v: Vehicle) => v.model === shopData.displayedVehicle)
						if (displayedVeh) {
							setSelectedVehicle(displayedVeh)
							addToRecentlyViewed(displayedVeh.model)
						} else {
							setSelectedVehicle(null)
						}
					} else {
						setSelectedVehicle(null)
					}
					break
				}
				case 'closeShop': {
					setIsOpen(false)
					setShopData(null)
					break
				}
				default:
					break
			}
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [addToRecentlyViewed])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', isOpen)
	}, [isOpen])

	// Use ref to access latest stats without triggering re-sorts
	const vehicleStatsMapRef = React.useRef(vehicleStatsMap)
	React.useEffect(() => {
		vehicleStatsMapRef.current = vehicleStatsMap
	}, [vehicleStatsMap])
	
	// Handler to select vehicle and save browse state
	const handleSelectVehicle = React.useCallback((vehicle: Vehicle) => {
		// Save current browse state BEFORE switching to detail view
		const currentScroll = scrollContainerRef.current?.scrollTop || 0
		const currentFocused = focusedIndex
		
		// Save to ref (ref persists across renders)
		const stateToSave = {
			scrollPosition: currentScroll,
			focusedIndex: currentFocused
		}
		
		savedBrowseStateRef.current = stateToSave
		
		// Reset scroll position for detail view
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop = 0
		}
		
		setSelectedVehicle(vehicle)
		setFocusedIndex(-1)
	}, [focusedIndex])

	// Handler to return to browse and restore browse state
	const handleBackToBrowse = React.useCallback(() => {
		setSelectedVehicle(null)
		// Browse state restoration will happen in useEffect
	}, [])

	// Keyboard shortcuts
	React.useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!isOpen) return
			
			if (e.key === 'Escape' || e.key === 'Tab') {
				if (showComparison) {
					setShowComparison(false)
				} else if (selectedVehicle) {
					// If viewing detail, go back to browse
					handleBackToBrowse()
				} else {
					closeShop()
				}
				return
			}
			
			// Arrow key navigation - only in browse view
			if (!selectedVehicle && filteredVehicles.length > 0) {
				if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
					e.preventDefault()
					const direction = e.key === 'ArrowDown' ? 1 : -1
					const newIndex = Math.max(0, Math.min(filteredVehicles.length - 1, focusedIndex + direction))
					setFocusedIndex(newIndex)
					// Scroll into view
					setTimeout(() => {
						const element = document.querySelector(`[data-vehicle-index="${newIndex}"]`)
						element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
					}, 0)
				} else if (e.key === 'Enter' && focusedIndex >= 0) {
					e.preventDefault()
					handleSelectVehicle(filteredVehicles[focusedIndex])
				}
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isOpen, selectedVehicle, filteredVehicles, focusedIndex, showComparison, handleSelectVehicle, handleBackToBrowse])


	const addToComparison = (vehicle: Vehicle) => {
		if (comparisonVehicles.length >= 3) {
			addNotification('Maximum 3 vehicles can be compared', 'error')
			return
		}
		if (comparisonVehicles.find(v => v.model === vehicle.model)) {
			addNotification('Vehicle already in comparison', 'error')
			return
		}
		setComparisonVehicles([...comparisonVehicles, vehicle])
		addNotification('Added to comparison', 'success')
	}

	const removeFromComparison = (model: string) => {
		setComparisonVehicles(comparisonVehicles.filter(v => v.model !== model))
	}
	
	// Track when we're restoring browse state (to prevent filter effects from interfering)
	const isRestoringRef = React.useRef(false)
	const savedBrowseStateRef = React.useRef<{ scrollPosition: number; focusedIndex: number } | null>(null)
	
	// Restore browse state when returning from detail view
	const prevSelectedVehicleRef = React.useRef<Vehicle | null>(null)
	React.useEffect(() => {
		// Detect transition from detail view (had vehicle) to browse view (no vehicle)
		const wasViewingDetail = prevSelectedVehicleRef.current !== null
		const isNowBrowsing = selectedVehicle === null
		
		if (wasViewingDetail && isNowBrowsing && savedBrowseStateRef.current) {
			// We just switched from detail to browse, restore state
			const savedState = savedBrowseStateRef.current
			isRestoringRef.current = true
			
			const restoreBrowseState = () => {
				if (scrollContainerRef.current && !selectedVehicle && savedState) {
					const container = scrollContainerRef.current
					// Check if container is actually rendered (has scrollHeight > 0)
					if (container.scrollHeight === 0) {
						return false // Container not rendered yet or has no content
					}
					
					container.scrollTop = savedState.scrollPosition
					setFocusedIndex(savedState.focusedIndex)
					
					// Check if scroll was set (within 1px tolerance for browser rounding)
					const actualScroll = container.scrollTop
					return Math.abs(actualScroll - savedState.scrollPosition) < 1
				}
				return false
			}
			
			// Try multiple times with increasing delays to ensure DOM is ready
			const attemptRestore = (attempt: number) => {
				if (restoreBrowseState()) {
					// Success! Clear restoration flag after a short delay
					setTimeout(() => {
						isRestoringRef.current = false
						savedBrowseStateRef.current = null
					}, 100)
				} else if (attempt < 5) {
					// Try again with increasing delays
					setTimeout(() => attemptRestore(attempt + 1), 50 * attempt)
				} else {
					// Give up after 5 attempts
					isRestoringRef.current = false
					savedBrowseStateRef.current = null
				}
			}
			
			// Start restoration attempts
			requestAnimationFrame(() => {
				attemptRestore(0)
			})
		}
		
		// Update ref for next render
		prevSelectedVehicleRef.current = selectedVehicle
	}, [selectedVehicle])
	
	// Reset browse state when filters change (expected behavior - scroll to top)
	React.useEffect(() => {
		// Only reset if we're in browse view AND not currently restoring
		if (!selectedVehicle && !isRestoringRef.current) {
			if (scrollContainerRef.current) {
				scrollContainerRef.current.scrollTop = 0
			}
			setFocusedIndex(-1)
		}
	}, [selectedCategory, selectedMake, searchQuery, sortBy, selectedVehicle])
	
	React.useEffect(() => {
		if (!shopData) return
		
		let filtered = shopData.vehicles
		
		if (selectedCategory) {
			filtered = filtered.filter(v => v.category === selectedCategory)
		}
		
		if (selectedMake) {
			filtered = filtered.filter(v => v.brand === selectedMake)
		}
		
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(v => 
				v.name.toLowerCase().includes(query) || 
				v.brand.toLowerCase().includes(query) ||
				v.category.toLowerCase().includes(query)
			)
		}
		
		// Sort - use ref to get latest stats without causing dependency issues
		filtered = [...filtered].sort((a, b) => {
			const statsMap = vehicleStatsMapRef.current
			switch (sortBy) {
				case 'price-asc':
					return a.price - b.price
				case 'price-desc':
					return b.price - a.price
				case 'name-asc':
					return a.name.localeCompare(b.name)
				case 'name-desc':
					return b.name.localeCompare(a.name)
				case 'speed-desc':
					const aSpeed = statsMap[a.model]?.topSpeedPercent || 0
					const bSpeed = statsMap[b.model]?.topSpeedPercent || 0
					return bSpeed - aSpeed
				case 'accel-desc':
					const aAccel = statsMap[a.model]?.accelerationPercent || 0
					const bAccel = statsMap[b.model]?.accelerationPercent || 0
					return bAccel - aAccel
				case 'handling-desc':
					const aHandling = statsMap[a.model]?.handlingPercent || 0
					const bHandling = statsMap[b.model]?.handlingPercent || 0
					return bHandling - aHandling
				default:
					return 0
			}
		})
		
		setFilteredVehicles(filtered)
	}, [shopData, selectedCategory, selectedMake, searchQuery, sortBy])
	
	// Re-sort when stats load, but only if sorting by stats and not viewing a vehicle
	React.useEffect(() => {
		if (!shopData || selectedVehicle) return
		const isStatSort = sortBy === 'speed-desc' || sortBy === 'accel-desc' || sortBy === 'handling-desc'
		if (!isStatSort) return
		
		// Save current scroll position
		const currentScroll = scrollContainerRef.current?.scrollTop || 0
		
		// Re-sort with updated stats
		const filtered = [...filteredVehicles].sort((a, b) => {
			switch (sortBy) {
				case 'speed-desc':
					const aSpeed = vehicleStatsMap[a.model]?.topSpeedPercent || 0
					const bSpeed = vehicleStatsMap[b.model]?.topSpeedPercent || 0
					return bSpeed - aSpeed
				case 'accel-desc':
					const aAccel = vehicleStatsMap[a.model]?.accelerationPercent || 0
					const bAccel = vehicleStatsMap[b.model]?.accelerationPercent || 0
					return bAccel - aAccel
				case 'handling-desc':
					const aHandling = vehicleStatsMap[a.model]?.handlingPercent || 0
					const bHandling = vehicleStatsMap[b.model]?.handlingPercent || 0
					return bHandling - aHandling
				default:
					return 0
			}
		})
		
		// Only update if order actually changed
		const orderChanged = filtered.some((v, i) => filteredVehicles[i]?.model !== v.model)
		if (orderChanged) {
			setFilteredVehicles(filtered)
			// Restore scroll after re-sort
			if (scrollContainerRef.current && currentScroll > 0) {
				requestAnimationFrame(() => {
					if (scrollContainerRef.current) {
						scrollContainerRef.current.scrollTop = currentScroll
					}
				})
			}
		}
	}, [vehicleStatsMap, sortBy, shopData, filteredVehicles, selectedVehicle, focusedIndex])

	const closeShop = async () => {
		// Cancel any pending requests
		currentFetchRef.current = null
		
		// Clear all preload timeouts
		Object.values(preloadTimeoutRef.current).forEach(timeout => clearTimeout(timeout))
		preloadTimeoutRef.current = {}
		
		setIsOpen(false)
		setShopData(null)
		setSelectedVehicle(null)
		setShowComparison(false)
		setComparisonVehicles([])
		await nuiSend('closeShop', {})
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat().format(amount)
	}

	const fetchVehicleStats = React.useCallback(async (vehicleModel: string, isPreload = false) => {
		// Check cache using functional state update to get latest value
		let isCached = false
		setVehicleStatsMap(prev => {
			if (prev[vehicleModel]) {
				isCached = true
				if (!isPreload) {
					setVehicleStats(prev[vehicleModel])
				}
			}
			return prev
		})
		
		if (isCached) {
			return
		}
		
		// Track current fetch to prevent stale updates
		if (!isPreload) {
			currentFetchRef.current = vehicleModel
			setLoadingStats(true)
			setVehicleStats(null)
		}
		
		try {
			const response = await nuiSend<{ success: boolean; stats: VehicleStats }>('getVehicleStats', {
				vehicle: vehicleModel
			})
			
			// Check if this is still the current fetch (user might have switched vehicles)
			if (!isPreload && currentFetchRef.current !== vehicleModel) {
				return // Stale response, ignore
			}
			
			if (response?.success && response.stats) {
				setVehicleStatsMap(prev => ({ ...prev, [vehicleModel]: response.stats }))
				if (!isPreload) {
					setVehicleStats(response.stats)
				}
			}
		} catch (error) {
			console.error('Failed to fetch vehicle stats:', error)
		} finally {
			if (!isPreload) {
				setLoadingStats(false)
				if (currentFetchRef.current === vehicleModel) {
					currentFetchRef.current = null
				}
			}
		}
	}, [vehicleStatsMap])

	const preloadVehicleStats = React.useCallback((vehicleModel: string) => {
		// Skip if already cached
		if (vehicleStatsMap[vehicleModel]) {
			return
		}
		
		// Clear any existing timeout for this vehicle
		if (preloadTimeoutRef.current[vehicleModel]) {
			clearTimeout(preloadTimeoutRef.current[vehicleModel])
		}
		
		// Debounce preload by 300ms to avoid excessive requests
		preloadTimeoutRef.current[vehicleModel] = window.setTimeout(() => {
			fetchVehicleStats(vehicleModel, true)
			delete preloadTimeoutRef.current[vehicleModel]
		}, 300)
	}, [vehicleStatsMap, fetchVehicleStats])

	// Reset scroll position when entering detail view
	React.useEffect(() => {
		if (selectedVehicle) {
			// Reset scroll to top when viewing vehicle details
			// Use requestAnimationFrame to ensure DOM is updated
			requestAnimationFrame(() => {
				if (scrollContainerRef.current) {
					scrollContainerRef.current.scrollTop = 0
				}
			})
		}
	}, [selectedVehicle])

	React.useEffect(() => {
		if (selectedVehicle) {
			// If stats are already cached, show them immediately
			if (vehicleStatsMap[selectedVehicle.model]) {
				setVehicleStats(vehicleStatsMap[selectedVehicle.model])
			} else {
				fetchVehicleStats(selectedVehicle.model)
			}
			addToRecentlyViewed(selectedVehicle.model)
		} else {
			setVehicleStats(null)
		}
	}, [selectedVehicle, vehicleStatsMap, fetchVehicleStats, addToRecentlyViewed])

	// Fetch stats for comparison vehicles (preload in background)
	React.useEffect(() => {
		comparisonVehicles.forEach(vehicle => {
			if (!vehicleStatsMap[vehicle.model]) {
				fetchVehicleStats(vehicle.model, true)
			}
		})
	}, [comparisonVehicles, vehicleStatsMap, fetchVehicleStats])

	// Preload stats for first few visible vehicles when shop opens
	React.useEffect(() => {
		if (!shopData || !isOpen) return
		
		// Preload stats for first 6 visible vehicles
		const vehiclesToPreload = filteredVehicles.slice(0, 6)
		vehiclesToPreload.forEach(vehicle => {
			if (!vehicleStatsMap[vehicle.model]) {
				// Stagger preloads to avoid overwhelming the server
				setTimeout(() => {
					fetchVehicleStats(vehicle.model, true)
				}, Math.random() * 500)
			}
		})
	}, [shopData, isOpen, filteredVehicles, vehicleStatsMap, fetchVehicleStats])

	const handlePreviewVehicle = async () => {
		if (!selectedVehicle) return
		setIsPreviewing(true)
		
		const primaryColor = typeof selectedPrimaryColor === 'number' ? selectedPrimaryColor : 0
		const secondaryColor = typeof selectedSecondaryColor === 'number' ? selectedSecondaryColor : 0
		
		const response = await nuiSend<{ success: boolean; message: string }>('previewVehicle', {
			vehicle: selectedVehicle.model,
			primaryColor: primaryColor,
			secondaryColor: secondaryColor
		})
		setIsPreviewing(false)
		if (response?.success) {
			addNotification('Vehicle previewed in showroom!', 'success')
		} else {
			addNotification(response?.message || 'Failed to preview vehicle', 'error')
		}
	}

	const handleBuyVehicle = async () => {
		if (!selectedVehicle) return
		const primaryColor = typeof selectedPrimaryColor === 'number' ? selectedPrimaryColor : 0
		const secondaryColor = typeof selectedSecondaryColor === 'number' ? selectedSecondaryColor : 0
		const response = await nuiSend<{ success: boolean; message: string }>('buyVehicle', {
			vehicle: selectedVehicle.model,
			primaryColor: primaryColor,
			secondaryColor: secondaryColor
		})
		if (response?.success) {
			addNotification(response.message || 'Vehicle purchased successfully!', 'success')
			setTimeout(() => {
				closeShop()
			}, 1500)
		} else {
			addNotification(response?.message || 'Failed to purchase vehicle', 'error')
		}
	}

	const handleTestDrive = async () => {
		if (!selectedVehicle) return
		const response = await nuiSend<{ success: boolean; message: string }>('testDrive', {
			vehicle: selectedVehicle.model
		})
		if (response?.success) {
			addNotification('Test drive started!', 'success')
			closeShop()
		} else {
			addNotification(response?.message || 'Failed to start test drive', 'error')
		}
	}

	// Finance calculations
	const calculateFinance = React.useCallback((price: number, downPaymentPercent: number, payments: number) => {
		const minDownPercent = 10 // Config.MinimumDown
		const maxPayments = 24 // Config.MaximumPayments
		const downPayment = Math.max(price * (minDownPercent / 100), price * (downPaymentPercent / 100))
		const balance = price - downPayment
		const monthlyPayment = balance / Math.min(payments, maxPayments)
		return {
			downPayment: Math.round(downPayment),
			balance: Math.round(balance),
			monthlyPayment: Math.round(monthlyPayment),
			totalPayments: Math.min(payments, maxPayments)
		}
	}, [])

	const handleFinanceVehicle = async () => {
		if (!selectedVehicle) return
		const primaryColor = typeof selectedPrimaryColor === 'number' ? selectedPrimaryColor : 0
		const secondaryColor = typeof selectedSecondaryColor === 'number' ? selectedSecondaryColor : 0
		
		const finance = calculateFinance(selectedVehicle.price, downPayment, numberOfPayments)
		
		const response = await nuiSend<{ success: boolean; message: string }>('financeVehicle', {
			vehicle: selectedVehicle.model,
			primaryColor: primaryColor,
			secondaryColor: secondaryColor,
			downPayment: finance.downPayment,
			payments: finance.totalPayments
		})
		
		if (response?.success) {
			addNotification(response.message || 'Vehicle financed successfully!', 'success')
			setShowFinanceModal(false)
			setTimeout(() => {
				closeShop()
			}, 1500)
		} else {
			addNotification(response?.message || 'Failed to finance vehicle', 'error')
		}
	}

	// Initialize finance defaults when vehicle is selected
	React.useEffect(() => {
		if (selectedVehicle) {
			const minDownPercent = 10
			setDownPayment(minDownPercent)
			setNumberOfPayments(12)
		}
	}, [selectedVehicle])

	const categories = shopData ? [...new Set(shopData.vehicles.map(v => v.category))].sort() : []
	const makes = shopData ? [...new Set(shopData.vehicles.map(v => v.brand))].sort() : []

	const hexToRgb = (hex: string): [number, number, number] => {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
		return result
			? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
			: [0, 0, 0]
	}

	const vehicleColors = [
		{ id: 0, name: 'Metallic Black', hex: '0d1116', rgb: hexToRgb('0d1116') },
		{ id: 1, name: 'Metallic Graphite Black', hex: '1c1d21', rgb: hexToRgb('1c1d21') },
		{ id: 2, name: 'Metallic Black Steel', hex: '32383d', rgb: hexToRgb('32383d') },
		{ id: 3, name: 'Metallic Dark Silver', hex: '454b4f', rgb: hexToRgb('454b4f') },
		{ id: 4, name: 'Metallic Silver', hex: '999da0', rgb: hexToRgb('999da0') },
		{ id: 5, name: 'Metallic Blue Silver', hex: 'c2c4c6', rgb: hexToRgb('c2c4c6') },
		{ id: 27, name: 'Metallic Red', hex: 'c00e1a', rgb: hexToRgb('c00e1a') },
		{ id: 28, name: 'Metallic Torino Red', hex: 'da1918', rgb: hexToRgb('da1918') },
		{ id: 29, name: 'Metallic Formula Red', hex: 'b6111b', rgb: hexToRgb('b6111b') },
		{ id: 30, name: 'Metallic Blaze Red', hex: 'a51e23', rgb: hexToRgb('a51e23') },
		{ id: 38, name: 'Metallic Orange', hex: 'f78616', rgb: hexToRgb('f78616') },
		{ id: 53, name: 'Metallic Green', hex: '155c2d', rgb: hexToRgb('155c2d') },
		{ id: 54, name: 'Metallic Gasoline Blue Green', hex: '1b6770', rgb: hexToRgb('1b6770') },
		{ id: 64, name: 'Metallic Blue', hex: '47578f', rgb: hexToRgb('47578f') },
		{ id: 70, name: 'Metallic Bright Blue', hex: '0b9cf1', rgb: hexToRgb('0b9cf1') },
		{ id: 73, name: 'Metallic Ultra Blue', hex: '2354a1', rgb: hexToRgb('2354a1') },
		{ id: 88, name: 'Metallic Taxi Yellow', hex: 'ffcf20', rgb: hexToRgb('ffcf20') },
		{ id: 89, name: 'Metallic Race Yellow', hex: 'fbe212', rgb: hexToRgb('fbe212') },
		{ id: 111, name: 'Metallic White', hex: 'fffff6', rgb: hexToRgb('fffff6') },
		{ id: 112, name: 'Metallic Frost White', hex: 'eaeaea', rgb: hexToRgb('eaeaea') },
	]

	if (!isOpen || !shopData) return null

	return (
		<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-50">
			<div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[90vw] h-[85vh] max-w-7xl flex flex-col overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#2a2a2a] bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] px-6 py-4">
					<div className="flex items-center gap-4">
						<h1 className="text-2xl font-bold text-white">{shopData.shopLabel}</h1>
						{comparisonVehicles.length > 0 && (
							<button
								onClick={() => setShowComparison(true)}
								className="px-3 py-1.5 rounded border border-green-600 bg-green-600/20 text-green-400 text-sm font-medium hover:bg-green-600/30 transition-colors"
							>
								Compare ({comparisonVehicles.length})
							</button>
						)}
					</div>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-3 px-4 py-2 rounded border border-[#2a2a2a] bg-[#0f0f0f]">
							<div className="text-right">
								<div className="text-xs text-[#888]">Cash</div>
								<div className="text-sm font-semibold text-green-400">${formatCurrency(shopData.playerCash)}</div>
							</div>
							<div className="w-px h-6 bg-[#2a2a2a]"></div>
							<div className="text-right">
								<div className="text-xs text-[#888]">Bank</div>
								<div className="text-sm font-semibold text-green-400">${formatCurrency(shopData.playerBank)}</div>
							</div>
						</div>
						<button
							onClick={closeShop}
							className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
						>
							Close
						</button>
					</div>
				</div>

				{/* Comparison Modal */}
				{showComparison && comparisonVehicles.length > 0 && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
						<div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-2xl font-bold text-white">Compare Vehicles</h2>
								<button
									onClick={() => setShowComparison(false)}
									className="text-[#888] hover:text-white text-2xl leading-none"
								>
									✕
								</button>
							</div>
							
							{/* Vehicle Cards */}
							<div className={`grid gap-4 mb-6 ${comparisonVehicles.length === 1 ? 'grid-cols-1' : comparisonVehicles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
								{comparisonVehicles.map(vehicle => (
									<div key={vehicle.model} className="border border-[#2a2a2a] rounded-lg p-4 bg-[#0f0f0f]">
										<div className="flex items-start justify-between mb-3">
											<div className="flex-1">
												<div className="text-xs text-[#888] mb-1">{vehicle.brand}</div>
												<h3 className="text-base font-semibold text-white mb-1">{vehicle.name}</h3>
												<div className="text-lg font-bold text-green-400">${formatCurrency(vehicle.price)}</div>
											</div>
											<button
												onClick={() => removeFromComparison(vehicle.model)}
												className="text-[#888] hover:text-red-400 ml-2"
											>
												✕
											</button>
										</div>
										
										{/* Basic Info */}
										<div className="mb-4 space-y-1 text-xs">
											<div className="flex items-center justify-between">
												<span className="text-[#888]">Category:</span>
												<span className="text-white capitalize">{vehicle.category}</span>
											</div>
											{vehicle.seats && (
												<div className="flex items-center justify-between">
													<span className="text-[#888]">Seats:</span>
													<span className="text-white">{vehicle.seats}</span>
												</div>
											)}
											{vehicle.fuelType && (
												<div className="flex items-center justify-between">
													<span className="text-[#888]">Fuel:</span>
													<span className="text-white">{vehicle.fuelType}</span>
												</div>
											)}
											{vehicle.drivetrain && (
												<div className="flex items-center justify-between">
													<span className="text-[#888]">Drivetrain:</span>
													<span className="text-white">{vehicle.drivetrain}</span>
												</div>
											)}
										</div>
										
										{/* Statistics */}
										{vehicleStatsMap[vehicle.model] ? (
											<div className="space-y-2.5">
												{[
													{ 
														label: 'Top Speed', 
														percent: vehicleStatsMap[vehicle.model].topSpeedPercent || 50,
														color: 'from-green-600 via-green-500 to-green-400' 
													},
													{ 
														label: 'Acceleration', 
														percent: vehicleStatsMap[vehicle.model].accelerationPercent || 50,
														color: 'from-blue-600 via-blue-500 to-blue-400' 
													},
													{ 
														label: 'Braking', 
														percent: vehicleStatsMap[vehicle.model].brakingPercent || 50,
														color: 'from-red-600 via-red-500 to-red-400' 
													},
													{ 
														label: 'Handling', 
														percent: vehicleStatsMap[vehicle.model].handlingPercent || 50,
														color: 'from-purple-600 via-purple-500 to-purple-400' 
													},
													{ 
														label: 'Traction', 
														percent: vehicleStatsMap[vehicle.model].tractionPercent || 50,
														color: 'from-yellow-600 via-yellow-500 to-yellow-400' 
													},
												].map((stat) => (
													<div key={stat.label}>
														<div className="flex items-center justify-between mb-1">
															<span className="text-xs text-[#888]">{stat.label}</span>
															<span className="text-xs text-white font-semibold">{stat.percent}%</span>
														</div>
														<div className="w-full bg-[#0f0f0f] rounded-full h-2 overflow-hidden border border-[#2a2a2a]">
															<div
																className={cn("h-full bg-gradient-to-r transition-all duration-500", stat.color)}
																style={{ width: `${stat.percent}%` }}
															/>
														</div>
													</div>
												))}
												
												{/* Additional Stats */}
												<div className="pt-2 mt-2 border-t border-[#2a2a2a] space-y-1 text-xs">
													<div className="flex items-center justify-between">
														<span className="text-[#888]">Weight:</span>
														<span className="text-white">{vehicleStatsMap[vehicle.model].mass?.toLocaleString() || 'N/A'} kg</span>
													</div>
												</div>
											</div>
										) : (
											<div className="text-xs text-[#888] italic">Loading statistics...</div>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Finance Modal */}
				{showFinanceModal && selectedVehicle && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
						<div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 max-w-2xl w-[90vw]">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-2xl font-bold text-white">Finance Vehicle</h2>
								<button
									onClick={() => setShowFinanceModal(false)}
									className="text-[#888] hover:text-white text-2xl leading-none"
								>
									✕
								</button>
							</div>

							{/* Vehicle Info */}
							<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#0f0f0f]">
								<div className="text-sm text-[#888] mb-1">{selectedVehicle.brand}</div>
								<h3 className="text-lg font-semibold text-white mb-2">{selectedVehicle.name}</h3>
								<div className="text-xl font-bold text-green-400">${formatCurrency(selectedVehicle.price)}</div>
							</div>

							{/* Finance Options */}
							<div className="space-y-4 mb-6">
								{/* Down Payment */}
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Down Payment ({downPayment}%)
									</label>
									<input
										type="range"
										min="10"
										max="100"
										value={downPayment}
										onChange={(e) => setDownPayment(Number(e.target.value))}
										className="w-full h-2 bg-[#0f0f0f] rounded-lg appearance-none cursor-pointer accent-purple-600"
									/>
									<div className="flex items-center justify-between mt-1 text-xs text-[#888]">
										<span>Min: 10%</span>
										<span className="text-white font-semibold">
											${formatCurrency(Math.round(selectedVehicle.price * (downPayment / 100)))}
										</span>
									</div>
								</div>

								{/* Number of Payments */}
								<div>
									<label className="block text-sm font-medium text-white mb-2">
										Number of Payments
									</label>
									<input
										type="range"
										min="1"
										max="24"
										value={numberOfPayments}
										onChange={(e) => setNumberOfPayments(Number(e.target.value))}
										className="w-full h-2 bg-[#0f0f0f] rounded-lg appearance-none cursor-pointer accent-purple-600"
									/>
									<div className="flex items-center justify-between mt-1 text-xs text-[#888]">
										<span>1 - 24 payments</span>
										<span className="text-white font-semibold">{numberOfPayments} payments</span>
									</div>
								</div>
							</div>

							{/* Finance Summary */}
							{(() => {
								const finance = calculateFinance(selectedVehicle.price, downPayment, numberOfPayments)
								return (
									<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#0f0f0f]">
										<h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Finance Summary</h4>
										<div className="space-y-2 text-sm">
											<div className="flex items-center justify-between">
												<span className="text-[#888]">Vehicle Price:</span>
												<span className="text-white">${formatCurrency(selectedVehicle.price)}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-[#888]">Down Payment:</span>
												<span className="text-white">${formatCurrency(finance.downPayment)}</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-[#888]">Finance Amount:</span>
												<span className="text-white">${formatCurrency(finance.balance)}</span>
											</div>
											<div className="pt-2 mt-2 border-t border-[#2a2a2a]">
												<div className="flex items-center justify-between">
													<span className="text-[#888]">Monthly Payment:</span>
													<span className="text-lg font-bold text-purple-400">${formatCurrency(finance.monthlyPayment)}</span>
												</div>
												<div className="text-xs text-[#666] mt-1">
													{finance.totalPayments} payments of ${formatCurrency(finance.monthlyPayment)}
												</div>
											</div>
										</div>
									</div>
								)
							})()}

							{/* Action Buttons */}
							<div className="flex gap-3">
								<button
									onClick={() => setShowFinanceModal(false)}
									className="flex-1 px-4 py-3 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white font-medium hover:bg-[#2a2a2a] transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleFinanceVehicle}
									className="flex-1 px-4 py-3 rounded border border-purple-600 bg-purple-600/20 hover:bg-purple-600/30 text-white font-semibold transition-colors"
								>
									Confirm Finance
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Main Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Sidebar */}
					<div className="w-64 flex-shrink-0 flex flex-col border-r border-[#2a2a2a] bg-[#0f0f0f]">
						{/* Search */}
						<div className="p-4 border-b border-[#2a2a2a]">
							<input
								type="text"
								placeholder="Search vehicles..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full px-4 py-2 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm placeholder-[#888] focus:border-[#4a4a4a] focus:outline-none"
							/>
						</div>

						{/* Recently Viewed */}
						{recentlyViewed.length > 0 && (
							<div className="p-4 border-b border-[#2a2a2a]">
								<h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Recently Viewed</h3>
								<div className="space-y-1">
									{recentlyViewed.slice(0, 5).map(model => {
										const vehicle = shopData.vehicles.find(v => v.model === model)
										if (!vehicle) return null
										return (
											<button
												key={model}
												onClick={() => handleSelectVehicle(vehicle)}
												className="w-full text-left px-2 py-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs hover:bg-[#2a2a2a] transition-colors truncate"
											>
												{vehicle.name}
											</button>
										)
									})}
								</div>
							</div>
						)}

						{/* Filters */}
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							{/* Categories */}
							<div>
								<h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3">Categories</h3>
								<div className="space-y-1.5">
									<button
										onClick={() => {
											setSelectedCategory(null)
											setSelectedVehicle(null)
										}}
										className={cn(
											"w-full text-left px-3 py-2 rounded border text-sm font-medium transition-colors",
											!selectedCategory
												? "border-green-600 bg-green-600/20 text-green-400"
												: "border-[#2a2a2a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
										)}
									>
										All Categories
									</button>
									{categories.map(category => (
										<button
											key={category}
											onClick={() => {
												setSelectedCategory(category)
												setSelectedVehicle(null)
											}}
											className={cn(
												"w-full text-left px-3 py-2 rounded border text-sm font-medium transition-colors capitalize",
												selectedCategory === category
													? "border-green-600 bg-green-600/20 text-green-400"
													: "border-[#2a2a2a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
											)}
										>
											{category}
										</button>
									))}
								</div>
							</div>

							{/* Makes */}
							<div>
								<h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3">Brands</h3>
								<div className="space-y-1.5">
									<button
										onClick={() => {
											setSelectedMake(null)
											setSelectedVehicle(null)
										}}
										className={cn(
											"w-full text-left px-3 py-2 rounded border text-sm font-medium transition-colors",
											!selectedMake
												? "border-green-600 bg-green-600/20 text-green-400"
												: "border-[#2a2a2a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
										)}
									>
										All Brands
									</button>
									{makes.map(make => (
										<button
											key={make}
											onClick={() => {
												setSelectedMake(make)
												setSelectedVehicle(null)
											}}
											className={cn(
												"w-full text-left px-3 py-2 rounded border text-sm font-medium transition-colors",
												selectedMake === make
													? "border-green-600 bg-green-600/20 text-green-400"
													: "border-[#2a2a2a] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a]"
											)}
										>
											{make}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Content Area */}
					<div className="flex-1 flex flex-col overflow-hidden">
						{/* Toolbar */}
						<div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1a1a1a] px-6 py-3">
							<div className="flex items-center gap-2">
								<span className="text-sm text-[#888]">
									{filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'} found
								</span>
							</div>
							<div className="flex items-center gap-2">
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as any)}
									className="px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#0f0f0f] text-white text-sm focus:outline-none focus:border-[#4a4a4a] transition-colors"
								>
									<option value="name-asc">Name (A-Z)</option>
									<option value="name-desc">Name (Z-A)</option>
									<option value="price-asc">Price (Low-High)</option>
									<option value="price-desc">Price (High-Low)</option>
									<option value="speed-desc">Top Speed</option>
									<option value="accel-desc">Acceleration</option>
									<option value="handling-desc">Handling</option>
								</select>
							</div>
						</div>

						{/* Vehicle Grid */}
						<div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
							{selectedVehicle ? (
								<div className="max-w-4xl mx-auto space-y-6">
									<div className="flex items-center justify-between mb-4">
										<button
											onClick={handleBackToBrowse}
											className="flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors"
										>
											← Back to Browse
										</button>
										<div className="flex items-center gap-2">
											<button
												onClick={handlePreviewVehicle}
												disabled={isPreviewing}
												className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
												</svg>
												Preview
											</button>
											<button
												onClick={handleTestDrive}
												className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
												</svg>
												Test Drive
											</button>
											{comparisonVehicles.length < 3 && !comparisonVehicles.find(v => v.model === selectedVehicle.model) && (
												<button
													onClick={() => addToComparison(selectedVehicle)}
													className="px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors"
												>
													+ Compare
												</button>
											)}
										</div>
									</div>

									<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-6">
										<div className="flex items-start justify-between mb-6">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<div className="text-sm text-[#888]">{selectedVehicle.brand}</div>
													{selectedVehicle.stock && (
														<span className={cn(
															"px-2 py-0.5 rounded text-xs font-medium",
															selectedVehicle.stock === 'in_stock' && "bg-green-600/20 text-green-400 border border-green-600",
															selectedVehicle.stock === 'limited' && "bg-yellow-600/20 text-yellow-400 border border-yellow-600",
															selectedVehicle.stock === 'out_of_stock' && "bg-red-600/20 text-red-400 border border-red-600"
														)}>
															{selectedVehicle.stock === 'in_stock' ? 'In Stock' : selectedVehicle.stock === 'limited' ? 'Limited Stock' : 'Out of Stock'}
														</span>
													)}
												</div>
												<h2 className="text-3xl font-bold text-white mb-2">{selectedVehicle.name}</h2>
												<div className="flex items-baseline gap-3">
													<div className="text-2xl font-bold text-green-400">
														${formatCurrency(selectedVehicle.price)}
													</div>
													{selectedVehicle.tradeInValue && (
														<div className="text-sm text-[#888]">
															Trade-in: ${formatCurrency(selectedVehicle.tradeInValue)}
														</div>
													)}
												</div>
											</div>
											<div className="flex flex-col gap-2">
												<div className="px-4 py-2 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
													<span className="text-xs text-[#888] uppercase tracking-wider">{selectedVehicle.category}</span>
												</div>
												{selectedVehicle.type && (
													<div className="px-4 py-2 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
														<span className="text-xs text-[#888] uppercase tracking-wider">{selectedVehicle.type}</span>
													</div>
												)}
											</div>
										</div>

										{/* Vehicle Specifications */}
										{(selectedVehicle.seats || selectedVehicle.fuelType || selectedVehicle.drivetrain) && (
											<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
												<h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Specifications</h3>
												<div className="grid grid-cols-3 gap-4 text-xs">
													{selectedVehicle.seats && (
														<div>
															<span className="text-[#888]">Seats:</span>
															<span className="text-white ml-2 font-semibold">{selectedVehicle.seats}</span>
														</div>
													)}
													{selectedVehicle.fuelType && (
														<div>
															<span className="text-[#888]">Fuel:</span>
															<span className="text-white ml-2 font-semibold">{selectedVehicle.fuelType}</span>
														</div>
													)}
													{selectedVehicle.drivetrain && (
														<div>
															<span className="text-[#888]">Drivetrain:</span>
															<span className="text-white ml-2 font-semibold">{selectedVehicle.drivetrain}</span>
														</div>
													)}
												</div>
											</div>
										)}

										{/* Vehicle Statistics */}
										{loadingStats ? (
											<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
												<div className="text-sm text-[#888]">Loading statistics...</div>
											</div>
										) : vehicleStats ? (
											<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
												<h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Performance Statistics</h3>
												<div className="mb-2">
													<p className="text-xs text-[#666] italic">Performance ratings are relative comparisons to other vehicles in dealerships</p>
												</div>
												<div className="space-y-3">
													{[
														{ 
															label: 'Top Speed', 
															percent: vehicleStats.topSpeedPercent || 50,
															color: 'from-green-600 via-green-500 to-green-400' 
														},
														{ 
															label: 'Acceleration', 
															percent: vehicleStats.accelerationPercent || 50,
															color: 'from-blue-600 via-blue-500 to-blue-400' 
														},
														{ 
															label: 'Braking', 
															percent: vehicleStats.brakingPercent || 50,
															color: 'from-red-600 via-red-500 to-red-400' 
														},
														{ 
															label: 'Handling', 
															percent: vehicleStats.handlingPercent || 50,
															color: 'from-purple-600 via-purple-500 to-purple-400' 
														},
														{ 
															label: 'Traction', 
															percent: vehicleStats.tractionPercent || 50,
															color: 'from-yellow-600 via-yellow-500 to-yellow-400' 
														},
													].map((stat) => (
														<div key={stat.label}>
															<div className="flex items-center justify-between mb-1">
																<span className="text-xs text-[#888]">{stat.label}</span>
																<span className="text-xs text-white font-semibold">{stat.percent}%</span>
															</div>
															<div className="w-full bg-[#0f0f0f] rounded-full h-2 overflow-hidden border border-[#2a2a2a]">
																<div
																	className={cn("h-full bg-gradient-to-r transition-all duration-500", stat.color)}
																	style={{ width: `${stat.percent}%` }}
																/>
															</div>
														</div>
													))}
												</div>
												<div className="mt-4 pt-4 border-t border-[#2a2a2a]">
													<div className="grid grid-cols-2 gap-4 text-xs">
														<div>
															<span className="text-[#888]">Weight:</span>
															<span className="text-white ml-2 font-semibold">{vehicleStats.mass.toLocaleString()} kg</span>
														</div>
														<div>
															<span className="text-[#888]">Model:</span>
															<span className="text-white ml-2 font-semibold">{selectedVehicle.model}</span>
														</div>
													</div>
												</div>
											</div>
										) : null}

										{/* Color Selection */}
										<div className="mt-6 pt-6 border-t border-[#2a2a2a]">
											<h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Color Selection</h3>
											<div className="grid grid-cols-2 gap-4">
												{/* Primary Color */}
												<div>
													<label className="block text-xs text-[#888] mb-2">Primary Color</label>
													<div className="grid grid-cols-5 gap-2">
														{vehicleColors.map(color => (
															<button
																key={`primary-${color.id}`}
																onClick={() => setSelectedPrimaryColor(color.id)}
																className={cn(
																	"w-full aspect-square rounded border-2 transition-all relative",
																	selectedPrimaryColor === color.id
																		? "border-green-500 scale-110 shadow-lg shadow-green-500/30"
																		: "border-[#2a2a2a] hover:border-[#4a4a4a]"
																)}
																style={{
																	backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`
																}}
																title={color.name}
															>
																{selectedPrimaryColor === color.id && (
																	<div className="absolute inset-0 flex items-center justify-center">
																		<svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
																			<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
																		</svg>
																	</div>
																)}
															</button>
														))}
													</div>
												</div>
												{/* Secondary Color */}
												<div>
													<label className="block text-xs text-[#888] mb-2">Secondary Color</label>
													<div className="grid grid-cols-5 gap-2">
														{vehicleColors.map(color => (
															<button
																key={`secondary-${color.id}`}
																onClick={() => setSelectedSecondaryColor(color.id)}
																className={cn(
																	"w-full aspect-square rounded border-2 transition-all relative",
																	selectedSecondaryColor === color.id
																		? "border-green-500 scale-110 shadow-lg shadow-green-500/30"
																		: "border-[#2a2a2a] hover:border-[#4a4a4a]"
																)}
																style={{
																	backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`
																}}
																title={color.name}
															>
																{selectedSecondaryColor === color.id && (
																	<div className="absolute inset-0 flex items-center justify-center">
																		<svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
																			<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
																		</svg>
																	</div>
																)}
															</button>
														))}
													</div>
												</div>
											</div>
										</div>

										{/* Payment Options */}
										<div className="mt-8 pt-6 border-t border-[#2a2a2a]">
											<h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Purchase Options</h3>
											
											{/* Price Summary */}
											<div className="mb-6 p-4 rounded border border-[#2a2a2a] bg-[#0f0f0f]">
												<div className="flex items-center justify-between mb-2">
													<span className="text-sm text-[#888]">Vehicle Price</span>
													<span className="text-lg font-bold text-white">${formatCurrency(selectedVehicle.price)}</span>
												</div>
												{shopData && (
													<div className="flex items-center justify-between text-xs text-[#666] mt-1">
														<span>Available Funds: ${formatCurrency(shopData.playerCash + shopData.playerBank)}</span>
														{selectedVehicle.price > (shopData.playerCash + shopData.playerBank) && (
															<span className="text-yellow-400">Insufficient funds</span>
														)}
													</div>
												)}
											</div>

											{/* Purchase Buttons */}
											<div className="grid grid-cols-2 gap-3">
												<button
													onClick={() => setShowFinanceModal(true)}
													className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-purple-600 bg-purple-600/20 hover:bg-purple-600/30 text-white font-semibold transition-colors"
												>
													<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
													</svg>
													<span className="text-sm">Finance</span>
												</button>
												<button
													onClick={handleBuyVehicle}
													className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-green-600 bg-green-600/20 hover:bg-green-600/30 text-white font-semibold transition-colors"
												>
													<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
													</svg>
													<span className="text-sm">Buy Now</span>
												</button>
											</div>
										</div>

									</div>
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{filteredVehicles.length === 0 ? (
										<div className="col-span-full flex flex-col items-center justify-center py-16">
											<svg className="w-16 h-16 text-[#888]/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<p className="text-lg text-[#888] font-semibold mb-1">No vehicles found</p>
											<p className="text-sm text-[#666] mb-4">Try adjusting your filters or search query</p>
											<div className="flex gap-2">
												<button
													onClick={() => {
														setSearchQuery('')
														setSelectedCategory(null)
														setSelectedMake(null)
													}}
													className="px-4 py-2 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm hover:bg-[#2a2a2a] transition-colors"
												>
													Clear All Filters
												</button>
											</div>
										</div>
									) : (
										filteredVehicles.map((vehicle, index) => (
											<div
												key={vehicle.model}
												data-vehicle-index={index}
												onClick={() => handleSelectVehicle(vehicle)}
												onMouseEnter={() => preloadVehicleStats(vehicle.model)}
												className={cn(
													"relative rounded border bg-[#0f0f0f] p-4 cursor-pointer transition-colors",
													focusedIndex === index
														? "border-green-600 bg-[#1a1a1a] ring-2 ring-green-600/20"
														: "border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#3a3a3a]"
												)}
											>
												{vehicle.stock && (
													<div className="absolute top-4 right-4">
														<span className={cn(
															"px-2 py-0.5 rounded text-[10px] font-medium",
															vehicle.stock === 'in_stock' && "bg-green-600/20 text-green-400 border border-green-600",
															vehicle.stock === 'limited' && "bg-yellow-600/20 text-yellow-400 border border-yellow-600",
															vehicle.stock === 'out_of_stock' && "bg-red-600/20 text-red-400 border border-red-600"
														)}>
															{vehicle.stock === 'in_stock' ? 'In Stock' : vehicle.stock === 'limited' ? 'Limited' : 'Out'}
														</span>
													</div>
												)}
												<div className="mb-4">
													<div className="text-xs text-[#888] mb-1">{vehicle.brand}</div>
													<h3 className="text-lg font-semibold text-white mb-2">{vehicle.name}</h3>
													<div className="flex items-baseline gap-2">
														<div className="text-xl font-bold text-green-400">
															${formatCurrency(vehicle.price)}
														</div>
														{vehicle.tradeInValue && (
															<div className="text-xs text-[#888]">
																Trade: ${formatCurrency(vehicle.tradeInValue)}
															</div>
														)}
													</div>
												</div>
												<div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
													<div className="px-2 py-1 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
														<span className="text-xs text-[#888] uppercase tracking-wider">{vehicle.category}</span>
													</div>
													<button
														onClick={(e) => {
															e.stopPropagation()
															if (comparisonVehicles.length < 3 && !comparisonVehicles.find(v => v.model === vehicle.model)) {
																addToComparison(vehicle)
															}
														}}
														disabled={comparisonVehicles.length >= 3 || comparisonVehicles.find(v => v.model === vehicle.model) !== undefined}
														className="px-2 py-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
													>
														+ Compare
													</button>
												</div>
											</div>
										))
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Notification */}
				{notification && (
					<div className={cn(
						"fixed bottom-6 right-6 px-4 py-2 rounded border text-sm font-medium",
						notification.type === 'success'
							? "border-green-600 bg-green-600/20 text-green-400"
							: "border-red-600 bg-red-600/20 text-red-400"
					)}>
						{notification.message}
					</div>
				)}
			</div>
		</div>
	)
}
