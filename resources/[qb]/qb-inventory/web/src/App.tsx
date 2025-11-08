import * as React from 'react'
import { cn } from './lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
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

	if (!visible) return null

	return (
		<div className="fixed inset-0 pointer-events-none text-foreground">
			<div className="pointer-events-auto z-50 mx-auto mt-8 w-[92vw] max-w-6xl rounded-lg border border-border bg-card/95 p-4 shadow-xl">
				<Tooltip.Provider>
				<div className="mb-3 flex items-center justify-between">
					<h1 className="text-lg font-semibold">Inventory</h1>
					<div className="text-xs text-muted-foreground">{showHotbar ? 'Hotbar: On' : 'Hotbar: Off'}</div>
				</div>

				<div className={cn('grid gap-4', otherName ? 'lg:grid-cols-2' : 'grid-cols-1')}>
					<section className="rounded-lg border border-border bg-card p-4">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-medium">Player</h2>
							<div className="text-xs text-muted-foreground">Slots: {playerSlots}</div>
						</div>
						<div className="grid grid-cols-6 gap-2">
							{getSlotsArray(playerSlots).map((slot) => {
								const item = playerInv[slot]
								return (
									<div
										key={`p-${slot}`}
										className={cn(
											'select-none rounded-md border border-border bg-background/60 p-2 text-xs',
											item ? 'shadow-sm' : 'opacity-70'
										)}
										draggable={false}
										onMouseDown={(e) => onSlotMouseDown('player', slot, e)}
										onMouseUp={(e) => onSlotMouseUp('player', slot, e)}
										onDoubleClick={() => onItemDoubleClick('player', slot)}
									>
										<ItemCell item={item} onIconError={onIconError} getIconUrl={getItemIconUrl} onAttachments={() => openAttachments(item)} />
									</div>
								)
							})}
						</div>
					</section>

					{otherName && (
						<section className="rounded-lg border border-border bg-card p-4">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-medium">{otherLabel ?? 'Container'}</h2>
								<div className="text-xs text-muted-foreground">Slots: {otherSlots}</div>
							</div>
							<div className="grid grid-cols-6 gap-2">
								{getSlotsArray(otherSlots).map((slot) => {
									const item = otherInv[slot]
									return (
										<div
											key={`o-${slot}`}
											className={cn(
												'select-none rounded-md border border-border bg-background/60 p-2 text-xs',
												item ? 'shadow-sm' : 'opacity-70'
											)}
											draggable={false}
											onMouseDown={(e) => onSlotMouseDown('other', slot, e)}
											onMouseUp={(e) => onSlotMouseUp('other', slot, e)}
										>
											<ItemCell item={item} onIconError={onIconError} getIconUrl={getItemIconUrl} onAttachments={() => openAttachments(item)} />
										</div>
									)
								})}
							</div>
						</section>
					)}
				</div>

				<div className="mt-4 flex gap-3 justify-end">
					<button className="btn btn-primary btn-md" onClick={closeInventory}>Close Inventory</button>
				</div>

				{/* Split amount dialog */}
				<Dialog.Root open={splitOpen} onOpenChange={setSplitOpen}>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 bg-transparent" />
						<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl focus:outline-none">
							<Dialog.Title className="text-base font-semibold">Move amount</Dialog.Title>
							<div className="mt-4 space-y-3">
								<input
									type="number"
									min={1}
									max={splitMax}
									value={splitAmount}
									onChange={(e) => setSplitAmount(Number(e.target.value))}
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								/>
								<input
									type="range"
									min={1}
									max={splitMax}
									value={splitAmount}
									onChange={(e) => setSplitAmount(Number(e.target.value))}
									className="w-full"
								/>
							</div>
							<div className="mt-5 flex justify-end gap-2">
								<button className="btn btn-outline btn-sm" onClick={() => setSplitOpen(false)}>Cancel</button>
								<button className="btn btn-primary btn-sm" onClick={submitSplit}>Move</button>
							</div>
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>

				{/* Attachments dialog */}
				<Dialog.Root open={attachOpen} onOpenChange={setAttachOpen}>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 bg-transparent" />
						<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl focus:outline-none">
							<Dialog.Title className="text-base font-semibold">Attachments</Dialog.Title>
							<div className="mt-3">
								{!attachData ? (
									<div className="text-sm text-muted-foreground">No data</div>
								) : (
									<div className="space-y-2">
										{Array.isArray(attachData.Attachments) && attachData.Attachments.length > 0 ? (
											attachData.Attachments.map((att: any, idx: number) => (
												<div key={idx} className="flex items-center justify-between rounded-md border border-border p-2">
													<div className="text-sm">{att.label ?? att.attachment}</div>
													<button className="btn btn-outline btn-sm" onClick={() => removeAttachment(attachData, att)}>Remove</button>
												</div>
											))
										) : (
											<div className="text-sm text-muted-foreground">No attachments</div>
										)}
									</div>
								)}
							</div>
							<div className="mt-4 flex justify-end">
								<button className="btn btn-primary btn-sm" onClick={() => setAttachOpen(false)}>Close</button>
							</div>
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
			</Tooltip.Provider>
			</div>
		</div>
	)
}

function ItemCell({
	item,
	onIconError,
	getIconUrl,
	onAttachments
}: {
	item?: InventoryItem | null
	onIconError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
	getIconUrl: (item?: InventoryItem | null) => string | undefined
	onAttachments: () => void
}) {
	const icon = getIconUrl(item ?? null)
	const content = (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2 min-w-0">
				{icon ? <img src={icon} onError={onIconError} alt="" className="h-6 w-6 rounded-sm bg-muted flex-shrink-0" /> : null}
				<div className="truncate">{item?.label ?? item?.name ?? ''}</div>
			</div>
			<div className="ml-2 text-muted-foreground">{item?.amount ? `x${item.amount}` : ''}</div>
		</div>
	)

	const hasAttachments = !!(item && (item.type === 'weapon' || (item.info && item.info.attachments)))

	return (
		<Tooltip.Root delayDuration={100}>
			<Tooltip.Trigger asChild>
				<div className="w-full">
					{content}
					{hasAttachments ? (
						<div className="mt-2 text-right">
							<button className="btn btn-ghost btn-sm" onClick={onAttachments}>Attachments</button>
						</div>
					) : null}
				</div>
			</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content side="top" className="z-50 max-w-xs rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md">
					{renderTooltip(item)}
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	)
}

function renderTooltip(item?: InventoryItem | null) {
	if (!item) return null
	const lines: React.ReactNode[] = []
	lines.push(<div key="label" className="font-medium">{item.label ?? item.name}</div>)
	const description = (item.info && item.info.description) || item.description
	if (description) {
		lines.push(<div key="desc" className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(description)}</div>)
	}
	if (item.weight != null) {
		const kg = (Number(item.weight) / 1000).toFixed(1)
		lines.push(<div key="w" className="mt-1 text-muted-foreground">Weight: {kg}kg</div>)
	}
	if (item.info) {
		Object.entries(item.info).forEach(([k, v]) => {
			if (k === 'description' || k === 'display') return
			let val: any = v
			if (k === 'attachments') val = Object.keys(v as any).length > 0 ? 'true' : 'false'
			lines.push(<div key={`i-${k}`} className="text-muted-foreground">{formatKey(k)}: {String(val)}</div>)
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


