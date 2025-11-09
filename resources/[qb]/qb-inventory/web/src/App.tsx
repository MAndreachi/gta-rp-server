import * as React from 'react'
import { cn } from './lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { nuiSend, type NuiMessage } from './lib/nui'

type InventoryItem = {
	slot: number
	name: string
	label?: string
	amount: number
	weight?: number
	description?: string
	info?: Record<string, any>
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

export default function App() {
	const [visible, setVisible] = React.useState(false)
	const [showHotbar, setShowHotbar] = React.useState(false)

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

	// Drag state (supports both HTML5 DnD and mouse-based fallback)
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

	// Attachments dialog
	const [attachOpen, setAttachOpen] = React.useState(false)
	const [attachItem, setAttachItem] = React.useState<InventoryItem | null>(null)
	const [attachData, setAttachData] = React.useState<any>(null)

	// Item notification queue state
	const [notificationQueue, setNotificationQueue] = React.useState<Array<{ item: InventoryItem; type: 'add' | 'remove' | 'use'; amount: number; id: number; visible: boolean }>>([])
	const notificationIdRef = React.useRef(0)

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
				case 'toggleHotbar': {
					setShowHotbar(Boolean(msg.data.open))
					break
				}
				case 'close': {
					setVisible(false)
					break
				}
				case 'itemBox': {
					if (msg.data.item) {
						const itemData = msg.data.item
						const notificationType = msg.data.type || 'add'
						const amount = msg.data.amount || 1
						const id = ++notificationIdRef.current
						
						const notification = {
							item: {
								slot: 0,
								name: itemData.name || '',
								label: itemData.label || itemData.name || '',
								amount: amount,
								image: itemData.image || itemData.name
							},
							type: notificationType as 'add' | 'remove' | 'use',
							amount: amount,
							id: id,
							visible: false
						}
						
						// Add to queue (initially hidden)
						setNotificationQueue(prev => {
							const currentCount = prev.length
							const delay = currentCount * 150
							// Stagger the appearance: 150ms delay per notification
							setTimeout(() => {
								setNotificationQueue(current => 
									current.map(n => n.id === id ? { ...n, visible: true } : n)
								)
							}, delay)
							
							// Auto-remove from queue after 3 seconds (plus delay)
							setTimeout(() => {
								setNotificationQueue(prev => prev.filter(n => n.id !== id))
							}, 3000 + delay)
							
							return [...prev, notification]
						})
					}
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

	async function openAttachments(item?: InventoryItem | null) {
		if (!item) return
		setAttachItem(item)
		setAttachOpen(true)
		const data = await nuiSend<any>('GetWeaponData', { weapon: item.name, ItemData: item })
		setAttachData(data ?? null)
	}

	async function removeAttachment(dataObj: any, att: any) {
		if (!dataObj || !att) return
		const res = await nuiSend<any>('RemoveAttachment', {
			WeaponData: dataObj.WeaponData,
			AttachmentData: { attachment: att.attachment }
		})
		// Expect updated attachments list back
		if (res) setAttachData(res)
	}

	function getSlotsArray(total: number): number[] {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	function onItemDoubleClick(type: 'player' | 'other', slot: number) {
		const item = (type === 'player' ? playerInv : otherInv)[slot]
		if (!item) return
		// Prefer using from player inventory only
		if (type === 'player') nuiSend('UseItem', { item })
	}

	function handleDragStart(type: 'player' | 'other', slot: number, e: React.DragEvent) {
		try {
			e.dataTransfer.setData('text/plain', `${type}:${slot}`)
			e.dataTransfer.effectAllowed = 'move'
		} catch {}
		setDragFrom(type)
		setDragSlot(slot)
	}

	function handleDragEnd() {
		setDragFrom(null)
		setDragSlot(null)
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
			const currentMapRef = fromMap // same as toMap
			const newMap = { ...currentMapRef.map }
			if (canMerge) {
				const mergedAmount = Number(toItem!.amount || 0) + moveAmount
				newMap[toSlot] = { ...toItem!, amount: mergedAmount, slot: toSlot }
				newMap[fromSlot] = null
				fromAmountSend = 0
				toAmountSend = moveAmount
			} else if (toItem) {
				// swap within same inventory
				newMap[fromSlot] = { ...toItem, slot: fromSlot }
				newMap[toSlot] = { ...fromItem, slot: toSlot }
				fromAmountSend = Number(fromItem.amount) || 0
				toAmountSend = Number(toItem.amount) || 0
			} else {
				// move to empty within same inventory
				newMap[fromSlot] = null
				newMap[toSlot] = { ...fromItem, slot: toSlot }
				fromAmountSend = 0
				toAmountSend = moveAmount
			}
			currentMapRef.set(newMap as InventoryMap)
		} else {
			// Cross-inventory move
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
					// swap
					fromAmountSend = Number(fromItem.amount) || 0
					toAmountSend = Number(toItem.amount) || 0
				} else {
					// move full stack to empty
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

	function handleDrop(toType: 'player' | 'other', toSlot: number, e?: React.DragEvent) {
		if (e) {
			e.preventDefault()
			try { e.dataTransfer.dropEffect = 'move' } catch {}
		}
		if (!dragFrom || dragSlot == null) return
		const fromType = dragFrom
		const fromSlot = dragSlot
		performDrop(fromType, fromSlot, toType, toSlot, Boolean(e?.shiftKey))
		handleDragEnd()
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
		if (!splitFrom || !splitTo) return
		const fromMap = splitFrom.type === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const toMap = splitTo.type === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const fromItem = fromMap.map[splitFrom.slot] || null
		const toItem = toMap.map[splitTo.slot] || null
		const amount = Math.min(Math.max(1, splitAmount), splitMax)

		if (fromItem && amount > 0) {
			const sameInventory = splitFrom.type === splitTo.type
			const remaining = Math.max(0, Number(fromItem.amount || 0) - amount)

			if (sameInventory) {
				const currentMapRef = fromMap
				const newMap = { ...currentMapRef.map }
				// Merge if same item and not unique
				const canMerge = toItem && toItem.name === fromItem.name && !toItem.unique && !fromItem.unique
				if (canMerge) {
					const mergedAmount = Number(toItem!.amount || 0) + amount
					newMap[splitTo.slot] = { ...toItem!, amount: mergedAmount, slot: splitTo.slot }
					newMap[splitFrom.slot] = remaining > 0 ? { ...fromItem, amount: remaining, slot: splitFrom.slot } : null
				} else {
					// Only allow split into empty slot
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
				const canMerge = toItem && toItem.name === fromItem.name && !toItem.unique && !fromItem.unique
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
		}

		const fromInventoryName = splitFrom.type === 'other' ? otherName : 'player'
		const toInventoryName = splitTo.type === 'other' ? otherName : 'player'

		nuiSend('SetInventoryData', {
			fromInventory: fromInventoryName,
			toInventory: toInventoryName,
			fromSlot: splitFrom.slot,
			toSlot: splitTo.slot,
			fromAmount: (fromItem ? Math.max(0, Number(fromItem.amount || 0) - amount) : 0),
			toAmount: amount,
		})

		setSplitOpen(false)
		setSplitFrom(null)
		setSplitTo(null)
	}

	function getItemIconUrl(item?: InventoryItem | null) {
		if (!item) return undefined
		// Use legacy images shipped with the resource
		return `nui://qb-inventory/html/images/${item.name}.png`
	}

	function onIconError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
		const img = e.currentTarget
		if (!img.dataset.fallback) {
			img.dataset.fallback = '1'
			img.src = `nui://qb-inventory/html/images/placeholder.png`
		}
	}

	return (
		<>
			{/* Item Notifications - Always visible */}
			{notificationQueue.length > 0 && (
				<div className="fixed top-4 right-4 z-[100] pointer-events-none flex flex-col gap-1.5">
					{notificationQueue.map((notification, index) => (
						<ItemNotification
							key={notification.id}
							notification={notification}
							getItemIconUrl={getItemIconUrl}
							onIconError={onIconError}
							visible={notification.visible}
						/>
					))}
				</div>
			)}

			{/* Inventory Window - Only visible when open */}
			{visible && (
				<div className="fixed inset-0 pointer-events-none text-foreground flex items-center justify-center">
					<div className="pointer-events-auto z-50 w-[46vw] max-w-3xl">
						<Tooltip.Provider>
							<div className="rounded-lg border-2 border-[#2a2a2a] bg-[#1a1a1a] p-4 shadow-2xl">
								<div className="mb-3 flex items-center justify-between border-b border-[#2a2a2a] pb-2">
									<h1 className="text-lg font-bold text-white">INVENTORY</h1>
									<div className="flex items-center gap-2">
										<div className="text-xs text-[#888]">{showHotbar ? 'Hotbar: On' : 'Hotbar: Off'}</div>
										<button
											onClick={closeInventory}
											className="rounded-md bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a3a3a] transition-colors"
										>
											Close
										</button>
									</div>
								</div>

								<div className={cn('grid gap-4 max-h-[60vh] overflow-y-auto', otherName ? 'lg:grid-cols-2' : 'grid-cols-1')}>
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
											onAttachments={openAttachments}
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
												contextMenuOpen={contextMenuOpen}
												onContextMenuAction={handleContextMenuAction}
												setContextMenuOpen={setContextMenuOpen}
												onAttachments={openAttachments}
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

								{/* Attachments dialog */}
								<Dialog.Root open={attachOpen} onOpenChange={setAttachOpen}>
									<Dialog.Portal>
										<Dialog.Overlay className="fixed inset-0 bg-black/60" />
										<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-[#2a2a2a] bg-[#1a1a1a] p-5 shadow-xl focus:outline-none">
											<Dialog.Title className="text-base font-semibold text-white">Attachments</Dialog.Title>
											<div className="mt-3">
												{!attachData ? (
													<div className="text-sm text-[#888]">No data</div>
												) : (
													<div className="space-y-2">
														{Array.isArray(attachData.Attachments) && attachData.Attachments.length > 0 ? (
															attachData.Attachments.map((att: any, idx: number) => (
																<div key={idx} className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-2">
																	<div className="text-sm text-white">{att.label ?? att.attachment}</div>
																	<button
																		className="rounded-md border-2 border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors"
																		onClick={() => removeAttachment(attachData, att)}
																	>
																		Remove
																	</button>
																</div>
															))
														) : (
															<div className="text-sm text-[#888]">No attachments</div>
														)}
													</div>
												)}
											</div>
											<div className="mt-4 flex justify-end">
												<button
													className="rounded-md bg-[#2a2a2a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a3a3a] transition-colors"
													onClick={() => setAttachOpen(false)}
												>
													Close
												</button>
											</div>
										</Dialog.Content>
									</Dialog.Portal>
								</Dialog.Root>
						</Tooltip.Provider>
					</div>
				</div>
			)}
		</>
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
	setContextMenuOpen,
	onAttachments
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
	onAttachments: (item?: InventoryItem | null) => void
}) {
	function getSlotsArray(total: number): number[] {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	return (
		<section className="rounded-lg border border-[#2a2a2a] bg-[#151515]/80 p-3">
			<div className="mb-2 flex items-center justify-between">
				<h2 className="text-xs font-semibold text-white">{title}</h2>
				<div className="text-xs text-[#888]">Slots: {slots}</div>
			</div>
			<div className="grid grid-cols-5 gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
				{getSlotsArray(slots).map((slot) => {
					const item = inventory[slot]
					const isContextMenuOpen = contextMenuOpen?.type === type && contextMenuOpen?.slot === slot
					const hasAttachments = !!(item && (item.type === 'weapon' || (item.info && item.info.attachments)))
					return (
						<ContextMenu.Root key={`${type}-${slot}`} open={isContextMenuOpen} onOpenChange={(open: boolean) => setContextMenuOpen(open ? { type, slot } : null)}>
							<ContextMenu.Trigger asChild>
								<Tooltip.Provider>
									<Tooltip.Root delayDuration={300}>
										<Tooltip.Trigger asChild>
											<div
												className={cn(
													'relative aspect-square rounded border border-[#2a2a2a] bg-[#0f0f0f] transition-all cursor-pointer',
													item ? 'border-[#3a3a3a] hover:border-[#4a4a4a] hover:shadow-md hover:shadow-[#1a1a1a]/50' : 'opacity-50 hover:opacity-70',
													isContextMenuOpen && 'border-[#5a5a5a]'
												)}
												onMouseDown={(e) => onSlotMouseDown(type, slot, e)}
												onMouseUp={(e) => onSlotMouseUp(type, slot, e)}
												onDoubleClick={() => onItemDoubleClick(type, slot)}
												onContextMenu={(e) => onContextMenu(type, slot, e)}
											>
												{/* Hotkey indicator for first 5 slots */}
												{slot <= 5 && (
													<div className="absolute top-0.5 left-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-[#2a2a2a]/80 text-[10px] font-bold text-white">
														{slot}
													</div>
												)}

												{/* Item image */}
												{item && (
													<div className="flex h-full w-full items-center justify-center p-1.5">
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
													<div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-[#000]/80 px-1 py-0.5 text-[10px] font-bold text-white">
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
										{hasAttachments && (
											<ContextMenu.Item
												className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onAttachments(item)}
											>
												Attachments
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
	if (item.info) {
		Object.entries(item.info).forEach(([k, v]) => {
			if (k === 'description' || k === 'display') return
			let val: any = v
			if (k === 'attachments') val = Object.keys(v as any).length > 0 ? 'true' : 'false'
			lines.push(<div key={`i-${k}`} className="text-[#aaa]">{formatKey(k)}: {String(val)}</div>)
		})
	}
	return <div className="space-y-1">{lines}</div>
}

function formatKey(key: string) {
	return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

async function openAttachments(item?: InventoryItem | null) {
	// no-op placeholder, real handler replaced at runtime
}

function ItemNotification({
	notification,
	getItemIconUrl,
	onIconError,
	visible
}: {
	notification: { item: InventoryItem; type: 'add' | 'remove' | 'use'; amount: number; id: number; visible: boolean }
	getItemIconUrl: (item?: InventoryItem | null) => string | undefined
	onIconError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
	visible: boolean
}) {
	const typeLabels = {
		add: 'RECEIVED',
		remove: 'REMOVED',
		use: 'USED'
	}

	const typeColors = {
		add: 'text-green-400',
		remove: 'text-red-400',
		use: 'text-blue-400'
	}

	return (
		<div className={cn(
			"transition-all duration-300 ease-out",
			visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
		)}>
			<div className="rounded-lg border-2 border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-2xl min-w-[200px]">
				<div className="flex items-center gap-3">
					{/* Item image */}
					<div className="flex-shrink-0 w-12 h-12 rounded border border-[#2a2a2a] bg-[#0f0f0f] flex items-center justify-center p-2">
						<img
							src={getItemIconUrl(notification.item) || ''}
							onError={onIconError}
							alt=""
							className="max-h-full max-w-full object-contain"
						/>
					</div>

					{/* Item info */}
					<div className="flex-1 min-w-0">
						<div className={cn('text-xs font-bold uppercase', typeColors[notification.type])}>
							{typeLabels[notification.type]}
						</div>
						<div className="text-sm font-semibold text-white truncate">
							{notification.item.label || notification.item.name}
						</div>
						{notification.amount > 1 && (
							<div className="text-xs text-[#888]">x{notification.amount}</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}


