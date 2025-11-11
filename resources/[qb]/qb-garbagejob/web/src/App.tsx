import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'

type MenuOption = {
	header: string
	txt?: string
	event?: string
	disabled?: boolean
	isMenuHeader?: boolean
}

type MenuData = {
	options: MenuOption[]
	stats?: {
		xp: number
		level: number
		levelLabel: string
		multiplier: number
		xpForCurrent: number
		xpForNext: number
		currentLevelMax: number
	}
}

export default function App() {
	const [isMenuOpen, setIsMenuOpen] = React.useState(false)
	const [menuOptions, setMenuOptions] = React.useState<MenuOption[]>([])
	const [stats, setStats] = React.useState<MenuData['stats']>(null)
	const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null)

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const data = e.data as NuiMessage<MenuData>
			if (data.action === 'openMenu') {
				setMenuOptions(data.options || [])
				setStats(data.stats || null)
				setIsMenuOpen(true)
			} else if (data.action === 'closeMenu') {
				setIsMenuOpen(false)
				setMenuOptions([])
				setStats(null)
			} else if (data.action === 'updateStats') {
				setStats(data.stats || null)
			}
		}

		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	React.useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && isMenuOpen) {
				closeMenu()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isMenuOpen])

	const closeMenu = async () => {
		setIsMenuOpen(false)
		setMenuOptions([])
		await nuiSend('closeMenu', {})
	}

	const handleOptionClick = async (option: MenuOption) => {
		if (option.disabled || !option.event) return
		
		await nuiSend('selectOption', { event: option.event })
		closeMenu()
	}

	return (
		<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
			{isMenuOpen && (
				<div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50" style={{ pointerEvents: 'auto' }}>
					{/* Modal */}
					<div 
						className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] pointer-events-auto flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex items-center justify-between border-b border-[#2a2a2a] bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] px-6 py-4 rounded-t-lg">
							<div className="flex-1">
								<h2 className="text-2xl font-bold text-white">Garbage Collection Job Management</h2>
								{stats && (
									<div className="mt-1.5 flex items-center gap-4 text-xs">
										<span className="text-[#888]">Rank:</span>
										<span className="text-white font-semibold">{stats.levelLabel}</span>
										<span className="text-[#888]">•</span>
										<span className="text-[#888]">Level:</span>
										<span className="text-green-400 font-semibold">{stats.level}</span>
										<span className="text-[#888]">•</span>
										<span className="text-[#888]">Pay Bonus:</span>
										<span className="text-green-400 font-semibold">+{((stats.multiplier - 1) * 100).toFixed(0)}%</span>
									</div>
								)}
							</div>
							<button
								onClick={closeMenu}
								className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
							>
								✕
							</button>
						</div>

						{/* Main Content - Two Column Layout */}
						<div className="flex flex-1 min-h-0 overflow-hidden">
							{/* Left Column - Stats & Info */}
							<div className="w-80 flex-shrink-0 border-r border-[#2a2a2a] bg-[#0f0f0f] flex flex-col overflow-hidden">
								{/* XP Progress Section */}
								{stats && (
									<div className="p-5 border-b border-[#2a2a2a]">
										<div className="mb-3">
											<div className="flex items-center justify-between mb-2">
												<span className="text-xs font-semibold text-[#888] uppercase tracking-wide">Experience</span>
												<span className="text-xs font-bold text-white">
													{stats.currentLevelMax >= 999999 
														? 'MAX' 
														: `${stats.xpForCurrent.toLocaleString()}/${stats.xpForNext.toLocaleString()}`}
												</span>
											</div>
											<div className="w-full bg-[#1a1a1a] rounded-full h-3 overflow-hidden border border-[#2a2a2a]">
												<div
													className="h-full bg-gradient-to-r from-green-600 via-green-500 to-green-400 transition-all duration-500 shadow-lg shadow-green-500/20"
													style={{
														width: `${stats.currentLevelMax >= 999999 ? 100 : Math.min(100, Math.max(0, (stats.xpForCurrent / stats.xpForNext) * 100))}%`
													}}
												/>
											</div>
											<div className="mt-2 text-xs text-[#888]">
												{stats.xp.toLocaleString()} total XP
											</div>
										</div>

										{/* Level Stats Cards */}
										<div className="grid grid-cols-2 gap-2 mt-4">
											<div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
												<div className="text-[10px] text-[#888] uppercase mb-1">Level</div>
												<div className="text-lg font-bold text-white">{stats.level}</div>
											</div>
											<div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
												<div className="text-[10px] text-[#888] uppercase mb-1">Multiplier</div>
												<div className="text-lg font-bold text-green-400">{stats.multiplier.toFixed(2)}x</div>
											</div>
										</div>
									</div>
								)}

								{/* Information Section */}
								<div className="flex-1 overflow-y-auto p-5 space-y-5">
									{/* How It Works */}
									<div>
										<h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">How It Works</h3>
										<div className="space-y-2.5 text-xs text-[#aaa] leading-relaxed">
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">1.</span>
												<span>Start a route to rent a garbage truck ($250 deposit)</span>
											</div>
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">2.</span>
												<span>Drive to marked trash can locations</span>
											</div>
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">3.</span>
												<span>Collect garbage bags (2-5 bags per stop)</span>
											</div>
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">4.</span>
												<span>Throw bags into the truck</span>
											</div>
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">5.</span>
												<span>Complete all stops to get deposit back</span>
											</div>
											<div className="flex gap-2">
												<span className="text-green-400 font-bold flex-shrink-0">6.</span>
												<span>Return to depot and collect payslip</span>
											</div>
										</div>
									</div>

									{/* Progression */}
									<div className="border-t border-[#2a2a2a] pt-5">
										<h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">Progression</h3>
										<div className="space-y-2.5 text-xs text-[#aaa]">
											<div>
												<span className="text-white font-semibold">Base XP:</span> 8 per stop
											</div>
											<div>
												<span className="text-white font-semibold">Bag Bonus:</span> +2 XP per bag collected
											</div>
											<div>
												<span className="text-white font-semibold">Route Completion:</span> +5 XP (all stops)
											</div>
											<div>
												<span className="text-white font-semibold">Quick Route:</span> +3 XP (&lt;30 min)
											</div>
										</div>
										<div className="mt-4 space-y-2">
											<div className="text-[10px] text-[#888] uppercase tracking-wide mb-2">Level Tiers</div>
											{[
												{ range: '1-5', label: 'Rookie', mult: '1.0x' },
												{ range: '6-10', label: 'Apprentice', mult: '1.1x' },
												{ range: '11-15', label: 'Professional', mult: '1.25x' },
												{ range: '16-20', label: 'Expert', mult: '1.5x' },
												{ range: '21+', label: 'Master', mult: '1.75x' },
											].map((tier, idx) => (
												<div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded border border-[#2a2a2a] bg-[#1a1a1a]">
													<div>
														<span className="text-[10px] text-[#888]">Lv {tier.range}</span>
														<span className="text-xs text-white ml-2">{tier.label}</span>
													</div>
													<span className="text-xs font-semibold text-green-400">{tier.mult}</span>
												</div>
											))}
										</div>
									</div>

									{/* Payment Info */}
									<div className="border-t border-[#2a2a2a] pt-5">
										<h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wide">Payment</h3>
										<div className="space-y-2 text-xs text-[#aaa]">
											<div className="flex justify-between">
												<span className="text-[#888]">Per Bag:</span>
												<span className="text-white font-semibold">$50-$100</span>
											</div>
											<div className="flex justify-between">
												<span className="text-[#888]">Deposit:</span>
												<span className="text-white font-semibold">$250 (refunded if route completed)</span>
											</div>
											<div className="flex justify-between pt-2 border-t border-[#2a2a2a]">
												<span className="text-white font-semibold">Level Multiplier:</span>
												<span className="text-green-400 font-bold">Applied to total</span>
											</div>
										</div>
									</div>

								</div>
							</div>

							{/* Right Column - Actions */}
							<div className="flex-1 flex flex-col overflow-hidden">
								{/* Notification */}
								{notification && (
									<div className={cn(
										"mx-6 mt-4 rounded border px-4 py-2.5 text-sm font-medium flex-shrink-0",
										notification.type === 'success' 
											? "border-green-600 bg-green-600/20 text-green-400"
											: "border-red-600 bg-red-600/20 text-red-400"
									)}>
										{notification.message}
									</div>
								)}

								{/* Actions Section */}
								<div className="flex-1 p-6 overflow-y-auto min-h-0">
									<div className="mb-4">
										<h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wide">Actions</h3>
									</div>
									<div className="space-y-3">
										{menuOptions.map((option, index) => {
											// Skip menu header
											if (option.isMenuHeader || !option.event) {
												return null
											}

											return (
												<button
													key={index}
													onClick={() => handleOptionClick(option)}
													disabled={option.disabled}
													className={cn(
														"w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-5 py-4 text-left transition-all duration-200",
														"hover:bg-[#1a1a1a] hover:border-[#3a3a3a] hover:shadow-lg",
														"disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0f0f0f]",
														"focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
													)}
												>
													<div className="flex items-center justify-between">
														<div className="flex-1">
															<div className="text-base font-semibold text-white mb-1">
																{option.header}
															</div>
															{option.txt && (
																<div className="text-xs text-[#888] leading-relaxed">
																	{option.txt}
																</div>
															)}
														</div>
														<div className="ml-4 text-xl text-[#888]">
															→
														</div>
													</div>
												</button>
											)
										})}
									</div>
								</div>

								{/* Footer */}
								<div className="border-t border-[#2a2a2a] bg-[#0f0f0f] px-6 py-3 rounded-b-lg flex-shrink-0">
									<div className="text-xs text-[#888] text-center">
										Press ESC to close
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

