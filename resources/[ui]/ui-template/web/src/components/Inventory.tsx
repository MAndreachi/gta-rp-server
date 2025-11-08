import * as React from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../lib/utils'
import { nuiSend, type NuiMessage } from '../lib/nui'

type InventoryItem = {
	slot: number
	name: string
	label?: string
	amount: number
	weight?: number
	description?: string
	info?: Record<string, any>
	image?: string
	type?: string
	unique?: boolean
	[key: string]: any
}

type InventoryMap = Record<number, InventoryItem | null>

function arrayToSlotMap(items: InventoryItem[] | Record<string, InventoryItem> | null | undefined): InventoryMap {
	const map: InventoryMap = {}
	if (!items) return map
	if (Array.isArray(items)) {
		for (const it of items) {
			if (it && typeof it.slot === 'number') map[it.slot] = it
		}
	} else {
		for (const key of Object.keys(items)) {
			const it = (items as any)[key]
			if (it && typeof it.slot === 'number') map[it.slot] = it
		}
	}
	return map
}

export default function Inventory() {
	const [visible, setVisible] = React.useState(false)

	// Player inventory
	const [playerSlots, setPlayerSlots] = React.useState(0)
	const [playerMaxWeight, setPlayerMaxWeight] = React.useState(0)
	const [playerInv, setPlayerInv] = React.useState<InventoryMap>({})

	// Other container (stash, trunk, glovebox, drop, shop ...)
	const [otherName, setOtherName] = React.useState<string | null>(null)
	const [otherLabel, setOtherLabel] = React.useState<string | null>(null)
	const [otherSlots, setOtherSlots] = React.useState<number>(0)
	const [otherMaxWeight, setOtherMaxWeight] = React.useState<number>(0)
	const [otherInv, setOtherInv] = React.useState<InventoryMap>({})

	// Drag state
	const [dragFrom, setDragFrom] = React.useState<'player' | 'other' | null>(null)
	const [dragSlot, setDragSlot] = React.useState<number | null>(null)
	const [mouseDragFrom, setMouseDragFrom] = React.useState<{ type: 'player' | 'other'; slot: number; shift: boolean } | null>(null)

	// Context menu state - track which slot's menu is open
	const [contextMenuOpen, setContextMenuOpen] = React.useState<{ type: 'player' | 'other'; slot: number } | null>(null)

	// Split move dialog state
	const [splitOpen, setSplitOpen] = React.useState(false)
	const [splitFrom, setSplitFrom] = React.useState<{ type: 'player' | 'other'; slot: number } | null>(null)
	const [splitTo, setSplitTo] = React.useState<{ type: 'player' | 'other'; slot: number } | null>(null)
	const [splitMax, setSplitMax] = React.useState(1)
	const [splitAmount, setSplitAmount] = React.useState(1)

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			switch (msg.data?.action) {
				case 'open': {
					setVisible(true)
					setPlayerMaxWeight(Number(msg.data.maxweight) || 0)
					setPlayerSlots(Number(msg.data.slots) || 0)
					setPlayerInv(arrayToSlotMap(msg.data.inventory))

					if (msg.data.other) {
						setOtherName(msg.data.other.name ?? null)
						setOtherLabel(msg.data.other.label ?? null)
						setOtherMaxWeight(Number(msg.data.other.maxweight) || 0)
						setOtherSlots(Number(msg.data.other.slots) || 0)
						setOtherInv(arrayToSlotMap(msg.data.other.inventory))
					} else {
						setOtherName(null)
						setOtherLabel(null)
						setOtherMaxWeight(0)
						setOtherSlots(0)
						setOtherInv({})
					}
					break
				}
				case 'update': {
					setPlayerInv(arrayToSlotMap(msg.data.inventory))
					break
				}
				case 'close': {
					setVisible(false)
					break
				}
				default:
					break
			}
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', visible)
	}, [visible])

	React.useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!visible) return
			if (e.key === 'Escape' || e.key === 'Tab') {
				closeInventory()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [visible, otherName])

	async function closeInventory() {
		await nuiSend('CloseInventory', { name: otherName ?? undefined })
		setVisible(false)
	}

	function getSlotsArray(total: number): number[] {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	function onItemDoubleClick(type: 'player' | 'other', slot: number) {
		const item = (type === 'player' ? playerInv : otherInv)[slot]
		if (!item) return
		if (type === 'player') nuiSend('UseItem', { item })
	}

	function onSlotMouseDown(type: 'player' | 'other', slot: number, e: React.MouseEvent) {
		if (e.button !== 0) return
		const map = type === 'player' ? playerInv : otherInv
		if (!map[slot]) return
		e.preventDefault()
		setMouseDragFrom({ type, slot, shift: e.shiftKey })
	}

	function onSlotMouseUp(type: 'player' | 'other', slot: number, e: React.MouseEvent) {
		if (!mouseDragFrom) return
		e.preventDefault()
		performDrop(mouseDragFrom.type, mouseDragFrom.slot, type, slot, mouseDragFrom.shift || e.shiftKey)
		setMouseDragFrom(null)
	}

	function performDrop(fromType: 'player' | 'other', fromSlot: number, toType: 'player' | 'other', toSlot: number, shiftKey: boolean) {
		if (fromType === toType && fromSlot === toSlot) return

		const fromMap = fromType === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const toMap = toType === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const fromItem = fromMap.map[fromSlot] || null
		const toItem = toMap.map[toSlot] || null
		if (!fromItem) return

		// Splitting: if not holding Shift and stack > 1, prompt amount
		if (!shiftKey && Number(fromItem.amount) > 1) {
			setSplitFrom({ type: fromType, slot: fromSlot })
			setSplitTo({ type: toType, slot: toSlot })
			setSplitMax(Number(fromItem.amount))
			setSplitAmount(1)
			setSplitOpen(true)
			return
		}

		const moveAmount = Number(fromItem.amount) || 0
		let fromAmountSend = 0
		let toAmountSend = moveAmount
		const sameInventory = fromType === toType
		const canMerge = toItem && toItem.name === fromItem.name && !toItem.unique && !fromItem.unique

		if (sameInventory) {
			const currentMapRef = fromMap
			const newMap = { ...currentMapRef.map }
			if (canMerge) {
				const mergedAmount = Number(toItem!.amount || 0) + moveAmount
				newMap[toSlot] = { ...toItem!, amount: mergedAmount, slot: toSlot }
				newMap[fromSlot] = null
				fromAmountSend = 0
				toAmountSend = moveAmount
			} else if (toItem) {
				newMap[fromSlot] = { ...toItem, slot: fromSlot }
				newMap[toSlot] = { ...fromItem, slot: toSlot }
				fromAmountSend = Number(fromItem.amount) || 0
				toAmountSend = Number(toItem.amount) || 0
			} else {
				newMap[fromSlot] = null
				newMap[toSlot] = { ...fromItem, slot: toSlot }
				fromAmountSend = 0
				toAmountSend = moveAmount
			}
			currentMapRef.set(newMap as InventoryMap)
		} else {
			const newFrom = { ...fromMap.map }
			const newTo = { ...toMap.map }
			if (canMerge) {
				const mergedAmount = Number(toItem!.amount || 0) + moveAmount
				newTo[toSlot] = { ...toItem!, amount: mergedAmount, slot: toSlot }
				newFrom[fromSlot] = null
				fromAmountSend = 0
				toAmountSend = moveAmount
			} else {
				newFrom[fromSlot] = toItem ? { ...toItem, slot: fromSlot } : null
				newTo[toSlot] = { ...fromItem, slot: toSlot }
				if (toItem) {
					fromAmountSend = Number(fromItem.amount) || 0
					toAmountSend = Number(toItem.amount) || 0
				} else {
					fromAmountSend = 0
					toAmountSend = moveAmount
				}
			}
			fromMap.set(newFrom as InventoryMap)
			toMap.set(newTo as InventoryMap)
		}

		const fromInventoryName = fromType === 'other' ? otherName : 'player'
		const toInventoryName = toType === 'other' ? otherName : 'player'
		nuiSend('SetInventoryData', {
			fromInventory: fromInventoryName,
			toInventory: toInventoryName,
			fromSlot,
			toSlot,
			fromAmount: fromAmountSend,
			toAmount: toAmountSend,
		})
	}

	function handleContextMenu(type: 'player' | 'other', slot: number, e: React.MouseEvent) {
		e.preventDefault()
		setContextMenuOpen({ type, slot })
	}

	function handleContextMenuAction(action: string) {
		if (!contextMenuOpen) return
		const item = (contextMenuOpen.type === 'player' ? playerInv : otherInv)[contextMenuOpen.slot]
		if (!item) return

		switch (action) {
			case 'use':
				if (contextMenuOpen.type === 'player') {
					nuiSend('UseItem', { item })
				}
				break
			case 'give':
				nuiSend('GiveItem', { item, slot: contextMenuOpen.slot })
				break
			case 'drop':
				nuiSend('DropItem', { item, slot: contextMenuOpen.slot })
				break
			case 'split':
				if (item.amount > 1) {
					// Find first empty slot for split target
					const targetMap = contextMenuOpen.type === 'player' ? playerInv : otherInv
					const totalSlots = contextMenuOpen.type === 'player' ? playerSlots : otherSlots
					const emptySlot = getSlotsArray(totalSlots).find(s => !targetMap[s])
					if (emptySlot) {
						setSplitFrom({ type: contextMenuOpen.type, slot: contextMenuOpen.slot })
						setSplitTo({ type: contextMenuOpen.type, slot: emptySlot })
						setSplitMax(Number(item.amount))
						setSplitAmount(1)
						setSplitOpen(true)
					}
				}
				break
		}
		setContextMenuOpen(null)
	}

	function submitSplit() {
		if (!splitFrom) return
		const fromMap = splitFrom.type === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const fromItem = fromMap.map[splitFrom.slot] || null
		const amount = Math.min(Math.max(1, splitAmount), splitMax)

		// If no target slot, just split in place (create new slot)
		if (!splitTo) {
			// Find first empty slot
			const targetMap = splitFrom.type === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
			const emptySlot = getSlotsArray(splitFrom.type === 'player' ? playerSlots : otherSlots).find(s => !targetMap.map[s])
			if (emptySlot) {
				setSplitTo({ type: splitFrom.type, slot: emptySlot })
				// Will be handled in next render
				return
			}
		}

		if (fromItem && amount > 0 && splitTo) {
			const toMap = splitTo.type === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
			const toItem = toMap.map[splitTo.slot] || null
			const remaining = Math.max(0, Number(fromItem.amount || 0) - amount)

			const sameInventory = splitFrom.type === splitTo.type
			const canMerge = toItem && toItem.name === fromItem.name && !toItem.unique && !fromItem.unique

			if (sameInventory) {
				const currentMapRef = fromMap
				const newMap = { ...currentMapRef.map }
				if (canMerge) {
					const mergedAmount = Number(toItem!.amount || 0) + amount
					newMap[splitTo.slot] = { ...toItem!, amount: mergedAmount, slot: splitTo.slot }
					newMap[splitFrom.slot] = remaining > 0 ? { ...fromItem, amount: remaining, slot: splitFrom.slot } : null
				} else {
					if (toItem) {
						setSplitOpen(false)
						setSplitFrom(null)
						setSplitTo(null)
						return
					}
					newMap[splitTo.slot] = { ...fromItem, amount, slot: splitTo.slot }
					newMap[splitFrom.slot] = remaining > 0 ? { ...fromItem, amount: remaining, slot: splitFrom.slot } : null
				}
				currentMapRef.set(newMap as InventoryMap)
			} else {
				const newFrom = { ...fromMap.map }
				const newTo = { ...toMap.map }
				if (canMerge) {
					const mergedAmount = Number(toItem!.amount || 0) + amount
					newTo[splitTo.slot] = { ...toItem!, amount: mergedAmount, slot: splitTo.slot }
				} else {
					if (toItem) {
						setSplitOpen(false)
						setSplitFrom(null)
						setSplitTo(null)
						return
					}
					newTo[splitTo.slot] = { ...fromItem, amount, slot: splitTo.slot }
				}
				newFrom[splitFrom.slot] = remaining > 0 ? { ...fromItem, amount: remaining, slot: splitFrom.slot } : null
				fromMap.set(newFrom as InventoryMap)
				toMap.set(newTo as InventoryMap)
			}

			const fromInventoryName = splitFrom.type === 'other' ? otherName : 'player'
			const toInventoryName = splitTo.type === 'other' ? otherName : 'player'
			nuiSend('SetInventoryData', {
				fromInventory: fromInventoryName,
				toInventory: toInventoryName,
				fromSlot: splitFrom.slot,
				toSlot: splitTo.slot,
				fromAmount: remaining,
				toAmount: amount,
			})
		}

		setSplitOpen(false)
		setSplitFrom(null)
		setSplitTo(null)
	}

	function getItemIconUrl(item?: InventoryItem | null) {
		if (!item) return undefined
		if (item.image) return item.image
		return `nui://qb-inventory/html/images/${item.name}.png`
	}

	function onIconError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
		const img = e.currentTarget
		if (!img.dataset.fallback) {
			img.dataset.fallback = '1'
			img.src = `nui://qb-inventory/html/images/placeholder.png`
		}
	}

	if (!visible) return null

	return (
		<div className="fixed inset-0 pointer-events-none text-foreground">
			<div className="pointer-events-auto z-50 mx-auto mt-8 w-[92vw] max-w-6xl">
				<Tooltip.Provider>
					<ContextMenu.Provider>
						<div className="rounded-lg border-2 border-[#2a2a2a] bg-[#1a1a1a]/95 backdrop-blur-sm p-6 shadow-2xl">
							<div className="mb-4 flex items-center justify-between border-b border-[#2a2a2a] pb-3">
								<h1 className="text-xl font-bold text-white">INVENTORY</h1>
								<button
									onClick={closeInventory}
									className="rounded-md bg-[#2a2a2a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a3a3a] transition-colors"
								>
									Close
								</button>
							</div>

							<div className={cn('grid gap-6', otherName ? 'lg:grid-cols-2' : 'grid-cols-1')}>
								<InventorySection
									title="PLAYER"
									slots={playerSlots}
									inventory={playerInv}
									type="player"
									onSlotMouseDown={onSlotMouseDown}
									onSlotMouseUp={onSlotMouseUp}
									onItemDoubleClick={onItemDoubleClick}
									onContextMenu={handleContextMenu}
									getItemIconUrl={getItemIconUrl}
									onIconError={onIconError}
									contextMenuOpen={contextMenuOpen}
									onContextMenuAction={handleContextMenuAction}
									setContextMenuOpen={setContextMenuOpen}
								/>

								{otherName && (
									<InventorySection
										title={otherLabel?.toUpperCase() ?? 'CONTAINER'}
										slots={otherSlots}
										inventory={otherInv}
										type="other"
										onSlotMouseDown={onSlotMouseDown}
										onSlotMouseUp={onSlotMouseUp}
										onItemDoubleClick={onItemDoubleClick}
										onContextMenu={handleContextMenu}
										getItemIconUrl={getItemIconUrl}
										onIconError={onIconError}
										contextMenuItem={contextMenuItem}
										onContextMenuAction={handleContextMenuAction}
										contextMenuOpen={contextMenuOpen}
										setContextMenuOpen={setContextMenuOpen}
									/>
								)}
							</div>
						</div>

						{/* Split amount dialog */}
						<Dialog.Root open={splitOpen} onOpenChange={setSplitOpen}>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 bg-black/60" />
								<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-[#2a2a2a] bg-[#1a1a1a] p-5 shadow-xl focus:outline-none">
									<Dialog.Title className="text-base font-semibold text-white">Split Stack</Dialog.Title>
									<div className="mt-4 space-y-3">
										<input
											type="number"
											min={1}
											max={splitMax}
											value={splitAmount}
											onChange={(e) => setSplitAmount(Number(e.target.value))}
											className="w-full rounded-md border-2 border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
										/>
										<input
											type="range"
											min={1}
											max={splitMax}
											value={splitAmount}
											onChange={(e) => setSplitAmount(Number(e.target.value))}
											className="w-full accent-[#4a4a4a]"
										/>
										<div className="text-xs text-[#888]">Amount: {splitAmount} / {splitMax}</div>
									</div>
									<div className="mt-5 flex justify-end gap-2">
										<button
											className="rounded-md border-2 border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
											onClick={() => setSplitOpen(false)}
										>
											Cancel
										</button>
										<button
											className="rounded-md bg-[#2a2a2a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a3a3a] transition-colors"
											onClick={submitSplit}
										>
											Split
										</button>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</ContextMenu.Provider>
				</Tooltip.Provider>
			</div>
		</div>
	)
}

function InventorySection({
	title,
	slots,
	inventory,
	type,
	onSlotMouseDown,
	onSlotMouseUp,
	onItemDoubleClick,
	onContextMenu,
	getItemIconUrl,
	onIconError,
	contextMenuOpen,
	onContextMenuAction,
	setContextMenuOpen
}: {
	title: string
	slots: number
	inventory: InventoryMap
	type: 'player' | 'other'
	onSlotMouseDown: (type: 'player' | 'other', slot: number, e: React.MouseEvent) => void
	onSlotMouseUp: (type: 'player' | 'other', slot: number, e: React.MouseEvent) => void
	onItemDoubleClick: (type: 'player' | 'other', slot: number) => void
	onContextMenu: (type: 'player' | 'other', slot: number, e: React.MouseEvent) => void
	getItemIconUrl: (item?: InventoryItem | null) => string | undefined
	onIconError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
	contextMenuOpen: { type: 'player' | 'other'; slot: number } | null
	onContextMenuAction: (action: string) => void
	setContextMenuOpen: (open: { type: 'player' | 'other'; slot: number } | null) => void
}) {
	function getSlotsArray(total: number): number[] {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	return (
		<section className="rounded-lg border border-[#2a2a2a] bg-[#151515]/80 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-white">{title}</h2>
				<div className="text-xs text-[#888]">Slots: {slots}</div>
			</div>
			<div className="grid grid-cols-5 gap-2">
				{getSlotsArray(slots).map((slot) => {
					const item = inventory[slot]
					const isContextMenuOpen = contextMenuOpen?.type === type && contextMenuOpen?.slot === slot
					return (
						<ContextMenu.Root key={`${type}-${slot}`} open={isContextMenuOpen} onOpenChange={(open) => setContextMenuOpen(open ? { type, slot } : null)}>
							<ContextMenu.Trigger asChild>
								<Tooltip.Provider>
									<Tooltip.Root delayDuration={300}>
										<Tooltip.Trigger asChild>
											<div
												className={cn(
													'relative aspect-square rounded-md border-2 border-[#2a2a2a] bg-[#0f0f0f] transition-all cursor-pointer',
													item ? 'border-[#3a3a3a] hover:border-[#4a4a4a] hover:shadow-lg hover:shadow-[#1a1a1a]/50' : 'opacity-50 hover:opacity-70',
													isContextMenuOpen && 'border-[#5a5a5a]'
												)}
												onMouseDown={(e) => onSlotMouseDown(type, slot, e)}
												onMouseUp={(e) => onSlotMouseUp(type, slot, e)}
												onDoubleClick={() => onItemDoubleClick(type, slot)}
												onContextMenu={(e) => onContextMenu(type, slot, e)}
											>
												{/* Hotkey indicator for first 5 slots */}
												{slot <= 5 && (
													<div className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-[#2a2a2a]/80 text-xs font-bold text-white">
														{slot}
													</div>
												)}

												{/* Item image */}
												{item && (
													<div className="flex h-full w-full items-center justify-center p-2">
														<img
															src={getItemIconUrl(item) || ''}
															onError={onIconError}
															alt=""
															className="max-h-full max-w-full object-contain"
														/>
													</div>
												)}

												{/* Stack count indicator */}
												{item && item.amount > 1 && (
													<div className="absolute bottom-1 right-1 z-10 rounded bg-[#000]/80 px-1.5 py-0.5 text-xs font-bold text-white">
														x{item.amount}
													</div>
												)}
											</div>
										</Tooltip.Trigger>
										{item && (
											<Tooltip.Portal>
												<Tooltip.Content
													side="top"
													className="z-50 max-w-xs rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-2 text-xs text-white shadow-xl"
												>
													{renderTooltip(item)}
												</Tooltip.Content>
											</Tooltip.Portal>
										)}
									</Tooltip.Root>
								</Tooltip.Provider>
							</ContextMenu.Trigger>
							{item && (
								<ContextMenu.Portal>
									<ContextMenu.Content className="z-50 min-w-[180px] rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-1 shadow-xl">
										{type === 'player' && (
											<ContextMenu.Item
												className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('use')}
											>
												Use
											</ContextMenu.Item>
										)}
										<ContextMenu.Item
											className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
											onSelect={() => onContextMenuAction('give')}
										>
											Give
										</ContextMenu.Item>
										<ContextMenu.Item
											className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
											onSelect={() => onContextMenuAction('drop')}
										>
											Drop
										</ContextMenu.Item>
										{item.amount > 1 && (
											<ContextMenu.Item
												className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('split')}
											>
												Split
											</ContextMenu.Item>
										)}
									</ContextMenu.Content>
								</ContextMenu.Portal>
							)}
						</ContextMenu.Root>
					)
				})}
			</div>
		</section>
	)
}

function renderTooltip(item: InventoryItem) {
	const lines: React.ReactNode[] = []
	lines.push(<div key="label" className="font-bold text-white">{item.label ?? item.name}</div>)
	const description = (item.info && item.info.description) || item.description
	if (description) {
		lines.push(<div key="desc" className="mt-1 whitespace-pre-wrap text-[#aaa]">{String(description)}</div>)
	}
	if (item.weight != null) {
		const kg = (Number(item.weight) / 1000).toFixed(1)
		lines.push(<div key="w" className="mt-1 text-[#aaa]">Weight: {kg}kg</div>)
	}
	return <div className="space-y-1">{lines}</div>
}

