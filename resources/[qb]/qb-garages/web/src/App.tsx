import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'

type Vehicle = {
	vehicle: string
	vehicleLabel: string
	plate: string
	state: number
	fuel: number
	engine: number
	body: number
	distance: number
	garage: any
	type: string
	index: string
	depotPrice: number
	balance: number
	currentGarage?: string
}

type Garage = {
	index: string
	label: string
	type: string
}

export default function App() {
	const [isOpen, setIsOpen] = React.useState(false)
	const [garageLabel, setGarageLabel] = React.useState('')
	const [currentGarageIndex, setCurrentGarageIndex] = React.useState('')
	const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
	const [availableGarages, setAvailableGarages] = React.useState<Garage[]>([])
	const [transferVehicle, setTransferVehicle] = React.useState<Vehicle | null>(null)
	const [selectedTransferGarage, setSelectedTransferGarage] = React.useState('')

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			if (msg.data?.action === 'VehicleList') {
				setGarageLabel(msg.data.garageLabel || '')
				setCurrentGarageIndex(msg.data.currentGarageIndex || '')
				setVehicles(msg.data.vehicles || [])
				setAvailableGarages(msg.data.availableGarages || [])
				setIsOpen(true)
			}
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', isOpen)
	}, [isOpen])

	React.useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!isOpen) return
			if (e.key === 'Escape' || e.key === 'Tab') {
				closeGarageMenu()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isOpen])

	const closeGarageMenu = async () => {
		setIsOpen(false)
		await nuiSend('closeGarage', {})
	}

	const getVehicleStatus = (vehicle: Vehicle) => {
		let status: string
		let isDepotPrice = false
		let disabled = false

		if (vehicle.state === 0) {
			if (vehicle.depotPrice && vehicle.depotPrice > 0) {
				isDepotPrice = true
				if (vehicle.type === 'public') {
					status = 'Depot'
					disabled = true
				} else if (vehicle.type === 'depot') {
					status = `$${vehicle.depotPrice.toFixed(0)}`
				} else {
					status = 'Out'
					disabled = true
				}
			} else {
				status = 'Out'
				disabled = true
			}
		} else if (vehicle.state === 1) {
			if (vehicle.depotPrice && vehicle.depotPrice > 0) {
				isDepotPrice = true
				if (vehicle.type === 'depot') {
					status = `$${vehicle.depotPrice.toFixed(0)}`
				} else if (vehicle.type === 'public') {
					status = 'Depot'
					disabled = true
				} else {
					status = 'Drive'
				}
			} else {
				status = 'Drive'
			}
		} else if (vehicle.state === 2) {
			status = 'Impound'
			disabled = true
		} else {
			status = 'Drive'
		}

		return { status, isDepotPrice, disabled }
	}

	const handleVehicleAction = async (vehicle: Vehicle) => {
		const { status, isDepotPrice, disabled } = getVehicleStatus(vehicle)
		
		if (disabled) return

		const vehicleStats = {
			fuel: vehicle.fuel,
			engine: vehicle.engine,
			body: vehicle.body,
		}

		const vehicleData = {
			vehicle: vehicle.vehicle,
			garage: vehicle.garage,
			index: vehicle.index,
			plate: vehicle.plate,
			type: vehicle.type,
			depotPrice: vehicle.depotPrice,
			stats: vehicleStats,
		}

		if (status === 'Out') {
			await nuiSend('trackVehicle', vehicle.plate)
			closeGarageMenu()
		} else if (isDepotPrice) {
			await nuiSend('takeOutDepo', vehicleData)
			closeGarageMenu()
		} else {
			await nuiSend('takeOutVehicle', vehicleData)
			closeGarageMenu()
		}
	}

	const handleTransfer = async () => {
		if (!transferVehicle || !selectedTransferGarage) return
		
		await nuiSend('transferVehicle', {
			plate: transferVehicle.plate,
			targetGarage: selectedTransferGarage
		})
		
		setTransferVehicle(null)
		setSelectedTransferGarage('')
		closeGarageMenu()
	}

	const canTransfer = (vehicle: Vehicle) => {
		// Can only transfer vehicles that are in garage (state = 1) and in a different garage
		return vehicle.state === 1 && 
		       vehicle.currentGarage && 
		       vehicle.currentGarage !== currentGarageIndex &&
		       availableGarages.length > 0
	}

	const getProgressColor = (percentage: number) => {
		if (percentage >= 75) return 'bg-green-500'
		if (percentage >= 50) return 'bg-yellow-500'
		return 'bg-red-500'
	}

	const getProgressTextColor = (percentage: number) => {
		if (percentage >= 75) return 'text-green-400'
		if (percentage >= 50) return 'text-yellow-400'
		return 'text-red-400'
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-40">
			<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[50vw] h-[75vh] max-w-4xl flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0f0f0f] p-4 rounded-t-md">
					<h2 className="text-lg font-semibold text-white">{garageLabel}</h2>
					<button
						onClick={closeGarageMenu}
						className="rounded border border-red-600 bg-red-600/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
					>
						Close
					</button>
				</div>

				{/* Vehicle List */}
				<div className="flex-1 overflow-y-auto p-4 space-y-3">
					{vehicles.length === 0 ? (
						<div className="text-center text-[#888] py-8">No vehicles available</div>
					) : (
						vehicles.map((vehicle, index) => {
							const { status, disabled } = getVehicleStatus(vehicle)
							const fuelPercentage = (vehicle.fuel / 100) * 100
							const enginePercentage = (vehicle.engine / 1000) * 100
							const bodyPercentage = (vehicle.body / 1000) * 100

							return (
								<div
									key={index}
									className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4 space-y-3"
								>
									{/* Vehicle Info Header */}
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="text-sm font-semibold text-white mb-1">
												{vehicle.vehicleLabel}
											</div>
											<div className="flex items-center gap-4 text-xs text-[#888]">
												<span>Plate: {vehicle.plate}</span>
												<span>Mileage: {vehicle.distance}mi</span>
												{vehicle.currentGarage && vehicle.currentGarage !== currentGarageIndex && (
													<span className="text-yellow-400">
														Stored: {availableGarages.find(g => g.index === vehicle.currentGarage)?.label || vehicle.currentGarage}
													</span>
												)}
											</div>
										</div>
									</div>

									{/* Finance Info and Action Buttons */}
									<div className="flex items-center justify-between gap-4">
										<div className="flex-1">
											{vehicle.balance && vehicle.balance > 0 ? (
												<div className="rounded border border-green-600/50 bg-green-600/10 px-3 py-1.5 text-xs text-green-400">
													Balance: ${vehicle.balance.toFixed(0)}
												</div>
											) : (
												<div className="rounded border border-green-600/50 bg-green-600/10 px-3 py-1.5 text-xs text-green-400">
													Paid Off
												</div>
											)}
										</div>
										<div className="flex gap-2">
											{canTransfer(vehicle) && (
												<button
													onClick={() => setTransferVehicle(vehicle)}
													className="rounded border border-blue-600 bg-blue-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600/30 transition-colors"
												>
													Transfer ($100)
												</button>
											)}
											<button
												onClick={() => handleVehicleAction(vehicle)}
												disabled={disabled}
												className={cn(
													"rounded border px-4 py-2 text-sm font-medium transition-colors",
													disabled
														? "border-[#2a2a2a] bg-[#1a1a1a] text-[#888] cursor-not-allowed"
														: "border-green-600 bg-green-600/20 text-white hover:bg-green-600/30"
												)}
											>
												{status}
											</button>
										</div>
									</div>

									{/* Stats Progress Bars */}
									<div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#2a2a2a]">
										{/* Fuel */}
										<div className="space-y-1">
											<div className="text-xs text-[#888]">Fuel</div>
											<div className="relative h-5 rounded bg-[#1a1a1a] overflow-hidden">
												<div
													className={cn(
														"absolute inset-0 flex items-center justify-center text-xs font-medium z-10",
														getProgressTextColor(fuelPercentage)
													)}
												>
													{Math.round(fuelPercentage)}%
												</div>
												<div
													className={cn(
														"absolute inset-0 h-full transition-all",
														getProgressColor(fuelPercentage)
													)}
													style={{ width: `${fuelPercentage}%` }}
												/>
											</div>
										</div>

										{/* Engine */}
										<div className="space-y-1">
											<div className="text-xs text-[#888]">Engine</div>
											<div className="relative h-5 rounded bg-[#1a1a1a] overflow-hidden">
												<div
													className={cn(
														"absolute inset-0 flex items-center justify-center text-xs font-medium z-10",
														getProgressTextColor(enginePercentage)
													)}
												>
													{Math.round(enginePercentage)}%
												</div>
												<div
													className={cn(
														"absolute inset-0 h-full transition-all",
														getProgressColor(enginePercentage)
													)}
													style={{ width: `${enginePercentage}%` }}
												/>
											</div>
										</div>

										{/* Body */}
										<div className="space-y-1">
											<div className="text-xs text-[#888]">Body</div>
											<div className="relative h-5 rounded bg-[#1a1a1a] overflow-hidden">
												<div
													className={cn(
														"absolute inset-0 flex items-center justify-center text-xs font-medium z-10",
														getProgressTextColor(bodyPercentage)
													)}
												>
													{Math.round(bodyPercentage)}%
												</div>
												<div
													className={cn(
														"absolute inset-0 h-full transition-all",
														getProgressColor(bodyPercentage)
													)}
													style={{ width: `${bodyPercentage}%` }}
												/>
											</div>
										</div>
									</div>
								</div>
							)
						})
					)}
				</div>
			</div>

			{/* Transfer Modal */}
			{transferVehicle && (
				<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-50 bg-black/50">
					<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[30vw] min-w-[400px] p-6">
						<h3 className="text-lg font-semibold text-white mb-4">Transfer Vehicle</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-xs text-[#888] mb-2">Vehicle</label>
								<div className="text-sm text-white">{transferVehicle.vehicleLabel}</div>
								<div className="text-xs text-[#888]">Plate: {transferVehicle.plate}</div>
							</div>
							<div>
								<label className="block text-xs text-[#888] mb-2">Select Destination Garage</label>
								<select
									value={selectedTransferGarage}
									onChange={(e) => setSelectedTransferGarage(e.target.value)}
									className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
								>
									<option value="">Select a garage...</option>
									{(() => {
										// Get current garage info
										const currentGarage = availableGarages.find(g => g.index === currentGarageIndex)
										// Get other garages (excluding vehicle's current garage)
										const otherGarages = availableGarages.filter(
											garage => garage.index !== transferVehicle.currentGarage && garage.index !== currentGarageIndex
										)
										
										return (
											<>
												{/* Current garage first */}
												{currentGarage && (
													<option value={currentGarage.index}>
														{currentGarage.label} {transferVehicle.currentGarage === currentGarageIndex ? '(Current Location)' : ''}
													</option>
												)}
												{/* Other garages */}
												{otherGarages.map(garage => (
													<option key={garage.index} value={garage.index}>
														{garage.label}
													</option>
												))}
											</>
										)
									})()}
								</select>
							</div>
							<div className="rounded border border-yellow-600/50 bg-yellow-600/10 px-3 py-2 text-xs text-yellow-400">
								Transfer Cost: $100
							</div>
							<div className="flex gap-2 pt-2">
								<button
									onClick={() => {
										setTransferVehicle(null)
										setSelectedTransferGarage('')
									}}
									className="flex-1 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleTransfer}
									disabled={!selectedTransferGarage}
									className={cn(
										"flex-1 rounded border px-4 py-2 text-sm font-medium transition-colors",
										selectedTransferGarage
											? "border-blue-600 bg-blue-600/20 text-white hover:bg-blue-600/30"
											: "border-[#2a2a2a] bg-[#1a1a1a] text-[#888] cursor-not-allowed"
									)}
								>
									Transfer
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

