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
	type?: string
	useable?: boolean
	combinable?: boolean
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
		// Handle both object with string keys and object with numeric keys (slot-indexed)
		for (const key of Object.keys(items)) {
			const it = (items as any)[key]
			if (it) {
				// If item has a slot property, use it; otherwise use the key as slot
				const slot = typeof it.slot === 'number' ? it.slot : (typeof key === 'string' && !isNaN(Number(key)) ? Number(key) : null)
				if (slot !== null) {
					map[slot] = { ...it, slot }
				}
			}
		}
	}
	return map
}

export default function App() {
	const [visible, setVisible] = React.useState(false)

	// Player inventory
	const [playerSlots, setPlayerSlots] = React.useState(0)
	const [playerMaxWeight, setPlayerMaxWeight] = React.useState(0)
	const [playerInv, setPlayerInv] = React.useState<InventoryMap>({})
	const [playerName, setPlayerName] = React.useState<string>('PLAYER')

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
	
	// Drag preview state
	const [dragPreview, setDragPreview] = React.useState<{ item: InventoryItem; x: number; y: number } | null>(null)

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

	// Checkout state (for shops)
	const [checkoutItems, setCheckoutItems] = React.useState<Array<{ item: InventoryItem; amount: number }>>([])
	const isShop = otherName?.startsWith('shop-') ?? false

	// Track pending operations to prevent flickering
	const pendingOperationsRef = React.useRef<Set<string>>(new Set())

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			switch (msg.data?.action) {
				case 'open': {
					setVisible(true)
					setPlayerMaxWeight(Number(msg.data.maxweight) || 0)
					setPlayerSlots(Number(msg.data.slots) || 0)
					setPlayerInv(arrayToSlotMap(msg.data.inventory))
					setPlayerName(msg.data.playerName || 'PLAYER')

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
					if (msg.data.inventory) {
						// If there are pending operations, wait a bit before applying the update
						// This prevents flickering from server updates overwriting optimistic updates
						if (pendingOperationsRef.current.size > 0) {
							setTimeout(() => {
								// Only update if there are no more pending operations
								if (pendingOperationsRef.current.size === 0) {
									const updatedInventory = arrayToSlotMap(msg.data.inventory)
									const newInventory: InventoryMap = {}
									for (const slot in updatedInventory) {
										const slotNum = Number(slot)
										if (!isNaN(slotNum)) {
											const item = updatedInventory[slotNum]
											if (item) {
												newInventory[slotNum] = { ...item }
											}
										}
									}
									setPlayerInv(newInventory)
								}
							}, 100)
						} else {
							// Convert inventory to slot map format
							const updatedInventory = arrayToSlotMap(msg.data.inventory)
							// Create a completely new object to force React to detect the change
							const newInventory: InventoryMap = {}
							for (const slot in updatedInventory) {
								const slotNum = Number(slot)
								if (!isNaN(slotNum)) {
									const item = updatedInventory[slotNum]
									if (item) {
										newInventory[slotNum] = { ...item }
									}
								}
							}
							setPlayerInv(newInventory)
						}
					} else {
						// If no inventory data provided, request fresh data
						// This shouldn't happen, but handle it gracefully
						console.warn('Update message received without inventory data')
					}
					break
				}
				case 'close': {
					setVisible(false)
					setCheckoutItems([]) // Clear checkout when closing
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

	// Track mouse movement for drag preview
	React.useEffect(() => {
		if (!dragPreview && !mouseDragFrom) return

		function onMouseMove(e: MouseEvent) {
			if (dragPreview) {
				setDragPreview(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
			} else if (mouseDragFrom) {
				// Update drag preview position for mouse drag
				const map = mouseDragFrom.type === 'player' ? playerInv : otherInv
				const item = map[mouseDragFrom.slot]
				if (item) {
					setDragPreview({ item, x: e.clientX, y: e.clientY })
				}
			}
		}

		function onMouseUp(e: MouseEvent) {
			// If mouse is released outside the inventory, clear drag state
			if (mouseDragFrom) {
				setMouseDragFrom(null)
				setDragPreview(null)
			}
		}

		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseup', onMouseUp)
		return () => {
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseup', onMouseUp)
		}
	}, [dragPreview, mouseDragFrom, playerInv, otherInv])

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

	function addToCheckout(item: InventoryItem, amount: number) {
		setCheckoutItems(prev => {
			const existing = prev.findIndex(ci => ci.item.name === item.name && ci.item.slot === item.slot)
			if (existing >= 0) {
				// Update existing item amount
				const updated = [...prev]
				const existingItem = updated[existing]
				if (existingItem) {
					updated[existing] = { ...existingItem, amount: existingItem.amount + amount }
				}
				return updated
			} else {
				// Add new item to checkout
				return [...prev, { item, amount }]
			}
		})
	}

	function removeFromCheckout(index: number) {
		setCheckoutItems(prev => prev.filter((_, i) => i !== index))
	}

	function updateCheckoutQuantity(index: number, newAmount: number) {
		if (newAmount <= 0) {
			removeFromCheckout(index)
			return
		}
		setCheckoutItems(prev => {
			const updated = [...prev]
			const item = updated[index]
			if (item) {
				// Don't allow more than what's available in the shop
				const maxAmount = Number(item.item.amount) || 1
				updated[index] = { ...item, amount: Math.min(newAmount, maxAmount) }
			}
			return updated
		})
	}

	function calculateTotalPrice(): number {
		return checkoutItems.reduce((total, checkoutItem) => {
			const price = (checkoutItem.item as any).price || 0
			return total + (price * checkoutItem.amount)
		}, 0)
	}

	async function handleCheckout() {
		if (checkoutItems.length === 0 || !otherName) return
		
		// Process each item in checkout sequentially to handle failures properly
		const successfulPurchases: number[] = []
		for (let i = 0; i < checkoutItems.length; i++) {
			const checkoutItem = checkoutItems[i]
			if (!checkoutItem) continue
			try {
				const success = await nuiSend<boolean>('AttemptPurchase', {
					item: checkoutItem.item,
					amount: checkoutItem.amount,
					shop: otherName
				})
				if (success === true) {
					successfulPurchases.push(i)
				}
			} catch (error) {
				console.error('Purchase failed:', error)
			}
		}

		// Remove successful purchases from checkout
		if (successfulPurchases.length > 0) {
			setCheckoutItems(prev => prev.filter((_, index) => !successfulPurchases.includes(index)))
		}
		
		// Note: Inventory updates are handled by the server via 'update' messages
	}

	function handleQuickStack() {
		// Organize player inventory: stack similar items, sort by name, fill empty slots
		const items: InventoryItem[] = []
		for (let slot = 1; slot <= playerSlots; slot++) {
			const item = playerInv[slot]
			if (item) {
				items.push({ ...item, slot })
			}
		}

		// Group items by name (for stacking)
		const itemGroups: Record<string, InventoryItem[]> = {}
		for (const item of items) {
			if (!item.name) continue
			if (!item.unique) {
				// Non-unique items can be stacked
				if (!itemGroups[item.name]) {
					itemGroups[item.name] = []
				}
				const group = itemGroups[item.name]
				if (group) {
					group.push(item)
				}
			} else {
				// Unique items stay separate
				itemGroups[`${item.name}_${item.slot}`] = [item]
			}
		}

		// Create organized inventory
		const organized: InventoryMap = {}
		let currentSlot = 1

		// Sort item names alphabetically
		const sortedNames = Object.keys(itemGroups).sort()

		for (const key of sortedNames) {
			const group = itemGroups[key]
			if (!group || group.length === 0) continue
			
			if (group.length === 1) {
				// Single item, just move it
				const item = group[0]
				if (item && item.name) {
					organized[currentSlot] = { ...item, slot: currentSlot }
					currentSlot++
				}
			} else {
				// Stack items together
				let totalAmount = 0
				const firstItem = group[0]
				if (!firstItem || !firstItem.name) continue
				
				for (const item of group) {
					if (item) {
						totalAmount += Number(item.amount || 0)
					}
				}
				organized[currentSlot] = { ...firstItem, amount: totalAmount, slot: currentSlot }
				currentSlot++
			}
		}

		// Update UI optimistically
		setPlayerInv(organized)

		// Send reorganization to server - convert organized map to array format
		const organizedArray: InventoryItem[] = []
		for (let slot = 1; slot <= playerSlots; slot++) {
			const item = organized[slot]
			if (item) {
				organizedArray.push(item)
			}
		}
		
		// Send organized inventory to server
		nuiSend('OrganizeInventory', { inventory: 'player', items: organizedArray })
	}

	function handleDragStart(type: 'player' | 'other', slot: number, e: React.DragEvent) {
		try {
			e.dataTransfer.setData('text/plain', `${type}:${slot}`)
			e.dataTransfer.effectAllowed = 'move'
		} catch {}
		const map = type === 'player' ? playerInv : otherInv
		const item = map[slot]
		if (item) {
			setDragPreview({ item, x: e.clientX, y: e.clientY })
		}
		setDragFrom(type)
		setDragSlot(slot)
	}

	function handleDragEnd() {
		setDragFrom(null)
		setDragSlot(null)
		setDragPreview(null)
	}

	function performDrop(fromType: 'player' | 'other', fromSlot: number, toType: 'player' | 'other', toSlot: number, shiftKey: boolean) {
		if (fromType === toType && fromSlot === toSlot) return

		const fromMap = fromType === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const toMap = toType === 'player' ? { map: playerInv, set: setPlayerInv } : { map: otherInv, set: setOtherInv }
		const fromItem = fromMap.map[fromSlot] || null
		const toItem = toMap.map[toSlot] || null
		if (!fromItem) return

		const fromInventoryName = fromType === 'other' ? otherName : 'player'
		const toInventoryName = toType === 'other' ? otherName : 'player'
		
		// Handle shop purchases - direct purchase when dragging to player inventory
		if (fromInventoryName && fromInventoryName.startsWith('shop-')) {
			// Moving from shop to player inventory - this is a direct purchase
			if (toInventoryName === 'player') {
				const shopItem = fromType === 'other' ? otherInv[fromSlot] : null
				if (shopItem) {
					// Splitting: if holding Shift and stack > 1, prompt amount
					if (shiftKey && Number(shopItem.amount) > 1) {
						setSplitFrom({ type: fromType, slot: fromSlot })
						setSplitTo({ type: toType, slot: toSlot })
						setSplitMax(Number(shopItem.amount))
						setSplitAmount(1)
						setSplitOpen(true)
						return
					}
					const moveAmount = Number(shopItem.amount) || 1
					nuiSend('AttemptPurchase', {
						item: shopItem,
						amount: moveAmount,
						shop: fromInventoryName
					})
					return
				}
			}
		}
		
		// Don't allow moving items to shops
		if (toInventoryName && toInventoryName.startsWith('shop-')) {
			return
		}

		// Splitting: if holding Shift and stack > 1, prompt amount
		if (shiftKey && Number(fromItem.amount) > 1) {
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

		// Create operation ID to track this operation
		const operationId = `${fromInventoryName}-${fromSlot}-${toInventoryName}-${toSlot}-${Date.now()}`
		pendingOperationsRef.current.add(operationId)

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
		
		// Send the operation to server
		nuiSend('SetInventoryData', {
			fromInventory: fromInventoryName,
			toInventory: toInventoryName,
			fromSlot,
			toSlot,
			fromAmount: fromAmountSend,
			toAmount: toAmountSend,
		}).then(() => {
			// Remove operation from pending set after server confirms
			setTimeout(() => {
				pendingOperationsRef.current.delete(operationId)
			}, 300)
		}).catch(() => {
			// On error, still remove after delay to prevent stuck state
			setTimeout(() => {
				pendingOperationsRef.current.delete(operationId)
			}, 300)
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
		const item = map[slot]
		if (!item) return
		e.preventDefault()
		setMouseDragFrom({ type, slot, shift: e.shiftKey })
		setDragPreview({ item, x: e.clientX, y: e.clientY })
	}

	function onSlotMouseUp(type: 'player' | 'other', slot: number, e: React.MouseEvent) {
		if (!mouseDragFrom) return
		e.preventDefault()
		performDrop(mouseDragFrom.type, mouseDragFrom.slot, type, slot, mouseDragFrom.shift || e.shiftKey)
		setMouseDragFrom(null)
		setDragPreview(null)
	}

	function onCheckoutMouseUp(e: React.MouseEvent) {
		if (!mouseDragFrom || !isShop) return
		const fromInventoryName = mouseDragFrom.type === 'other' ? otherName : 'player'
		
		// Only allow dropping shop items into checkout
		if (fromInventoryName && fromInventoryName.startsWith('shop-')) {
			const shopItem = mouseDragFrom.type === 'other' ? otherInv[mouseDragFrom.slot] : null
			if (shopItem) {
				if (mouseDragFrom.shift || e.shiftKey) {
					// Splitting: if holding Shift and stack > 1, prompt amount
					if (Number(shopItem.amount) > 1) {
						setSplitFrom({ type: mouseDragFrom.type, slot: mouseDragFrom.slot })
						setSplitTo({ type: 'player', slot: -1 }) // Use player type but slot -1 to indicate checkout
						setSplitMax(Number(shopItem.amount))
						setSplitAmount(1)
						setSplitOpen(true)
					} else {
						addToCheckout(shopItem, 1)
					}
				} else {
					// Add full amount to checkout
					const moveAmount = Number(shopItem.amount) || 1
					addToCheckout(shopItem, moveAmount)
				}
			}
		}
		setMouseDragFrom(null)
		setDragPreview(null)
	}

	function onCheckoutDragOver(e: React.DragEvent) {
		if (!isShop) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
	}

	function onCheckoutDrop(e: React.DragEvent) {
		if (!isShop) return
		e.preventDefault()
		const data = e.dataTransfer.getData('text/plain')
		if (!data) return
		const [fromType, fromSlotStr] = data.split(':')
		const fromSlot = Number(fromSlotStr)
		if (!fromType || isNaN(fromSlot)) return
		
		const fromInventoryName = fromType === 'other' ? otherName : 'player'
		
		// Only allow dropping shop items into checkout
		if (fromInventoryName && fromInventoryName.startsWith('shop-')) {
			const shopItem = fromType === 'other' ? otherInv[fromSlot] : null
			if (shopItem) {
				const moveAmount = Number(shopItem.amount) || 1
				addToCheckout(shopItem, moveAmount)
			}
		}
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
				if (contextMenuOpen.type === 'player') {
					nuiSend('GiveItem', { item, slot: contextMenuOpen.slot })
				}
				break
			case 'drop':
				if (contextMenuOpen.type === 'player') {
					// Send item with fromSlot property as expected by server
					nuiSend('DropItem', { ...item, fromSlot: contextMenuOpen.slot })
				}
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
			case 'combine':
				if (contextMenuOpen.type === 'player' && item.combinable) {
					nuiSend('CombineItem', { item, slot: contextMenuOpen.slot })
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

		// Handle shop items - add to checkout
		if (fromInventoryName && fromInventoryName.startsWith('shop-')) {
			const shopItem = splitFrom.type === 'other' ? otherInv[splitFrom.slot] : null
			if (shopItem) {
				// Check if adding to checkout (slot -1 indicates checkout)
				if (splitTo && splitTo.slot === -1) {
					addToCheckout(shopItem, amount)
					setSplitOpen(false)
					setSplitFrom(null)
					setSplitTo(null)
					return
				}
				// Otherwise, add full amount to checkout
				addToCheckout(shopItem, amount)
				setSplitOpen(false)
				setSplitFrom(null)
				setSplitTo(null)
				return
			}
		}
		
		// Don't allow moving items to shops
		if (toInventoryName && toInventoryName.startsWith('shop-')) {
			setSplitOpen(false)
			setSplitFrom(null)
			setSplitTo(null)
			return
		}

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

	// Calculate current weight from inventory
	function calculateWeight(inventory: InventoryMap): number {
		return Object.values(inventory).reduce((total, item) => {
			if (item && item.weight != null && item.amount != null) {
				return total + (Number(item.weight) * Number(item.amount))
			}
			return total
		}, 0)
	}

	const playerCurrentWeight = calculateWeight(playerInv)
	const otherCurrentWeight = otherMaxWeight > 0 ? calculateWeight(otherInv) : 0

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
					<div className={cn("pointer-events-auto z-50", isShop ? "w-[65vw] max-w-5xl" : "w-[42vw] max-w-2xl")}>
						<Tooltip.Provider>
							<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-2xl">
								<div className="mb-2.5 flex items-center justify-between border-b border-[#2a2a2a]/50 pb-2">
									<h1 className="text-sm font-semibold text-white tracking-wide">INVENTORY</h1>
									<div className="flex items-center gap-2">
										<button
											onClick={handleQuickStack}
											className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[#2a2a2a] transition-colors"
											title="Quick Stack - Organize inventory"
										>
											Quick Stack
										</button>
										<button
											onClick={closeInventory}
											className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-2.5 py-1 text-[10px] font-medium text-white hover:bg-[#2a2a2a] transition-colors"
										>
											Close
										</button>
									</div>
								</div>

								{/* Weight Bar */}
								{playerMaxWeight > 0 && (
									<div className="mb-2.5 rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] p-1.5">
										<div className="mb-1 flex items-center justify-between text-[10px]">
											<span className="text-[#888]">Carry Capacity</span>
											<span className="font-semibold text-white">
												{(playerCurrentWeight / 1000).toFixed(1)} / {(playerMaxWeight / 1000).toFixed(1)} kg
											</span>
										</div>
										<div className="h-1.5 w-full rounded-full bg-[#0a0a0a] overflow-hidden">
											<div
												className={cn(
													"h-full transition-all duration-300",
													(playerCurrentWeight / playerMaxWeight) * 100 < 50 ? "bg-green-500" :
													(playerCurrentWeight / playerMaxWeight) * 100 < 75 ? "bg-yellow-500" :
													"bg-red-500"
												)}
												style={{ width: `${Math.min((playerCurrentWeight / playerMaxWeight) * 100, 100)}%` }}
											/>
										</div>
									</div>
								)}

								<div className={cn('grid gap-3 max-h-[55vh] overflow-y-auto', isShop ? 'lg:grid-cols-3' : otherName ? 'lg:grid-cols-2' : 'grid-cols-1')}>
								<InventorySection
									title={playerName.toUpperCase()}
									slots={playerSlots}
									inventory={playerInv}
									type="player"
									sideBySide={!!otherName}
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
									isDragging={!!(dragPreview || mouseDragFrom)}
								/>

									{/* Checkout Area (for shops) - between inventories */}
									{isShop && (
										<div 
											className="mb-2.5 rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] p-2.5 transition-colors"
											onDragOver={onCheckoutDragOver}
											onDrop={onCheckoutDrop}
											onMouseUp={onCheckoutMouseUp}
											style={{
												borderColor: mouseDragFrom && mouseDragFrom.type === 'other' && otherName?.startsWith('shop-') 
													? '#4a4a4a' 
													: undefined
											}}
										>
										<div className="mb-2 flex items-center justify-between border-b border-[#2a2a2a]/50 pb-2">
											<h3 className="text-[10px] font-semibold text-white tracking-wide">CHECKOUT</h3>
											{checkoutItems.length > 0 && (
												<button
													onClick={() => setCheckoutItems([])}
													className="text-[9px] text-[#888] hover:text-white transition-colors"
												>
													Clear
												</button>
											)}
										</div>
										<div className="mb-2 max-h-[20vh] overflow-y-auto pr-0.5">
											{checkoutItems.length === 0 ? (
												<div className="py-4 text-center text-[10px] text-[#888]">
													Drag items here to add to checkout
												</div>
											) : (
												<div className="space-y-1.5">
													{checkoutItems.map((checkoutItem, index) => {
														const price = (checkoutItem.item as any).price || 0
														const totalPrice = price * checkoutItem.amount
														const maxAmount = Number(checkoutItem.item.amount) || 1
														return (
															<div
																key={`${checkoutItem.item.name}-${checkoutItem.item.slot}-${index}`}
																className="flex items-center gap-2 rounded border border-[#2a2a2a]/50 bg-[#0a0a0a] p-1.5"
															>
																<img
																	src={getItemIconUrl(checkoutItem.item)}
																	alt={checkoutItem.item.label || checkoutItem.item.name}
																	className="h-8 w-8 rounded object-contain"
																	onError={onIconError}
																/>
																<div className="flex-1 min-w-0">
																	<div className="text-[10px] font-medium text-white truncate">
																		{checkoutItem.item.label || checkoutItem.item.name}
																	</div>
																	<div className="text-[9px] text-[#888]">
																		{checkoutItem.amount}x @ ${price.toFixed(2)} = ${totalPrice.toFixed(2)}
																	</div>
																</div>
																<div className="flex items-center gap-1">
																	<button
																		onClick={() => updateCheckoutQuantity(index, checkoutItem.amount - 1)}
																		className="rounded border border-[#2a2a2a] bg-[#0f0f0f] h-6 w-6 flex items-center justify-center text-[10px] text-white hover:bg-[#2a2a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
																		disabled={checkoutItem.amount <= 1}
																	>
																		−
																	</button>
																	<input
																		type="number"
																		min={1}
																		max={maxAmount}
																		value={checkoutItem.amount}
																		onChange={(e) => {
																			const newAmount = Math.max(1, Math.min(maxAmount, Number(e.target.value) || 1))
																			updateCheckoutQuantity(index, newAmount)
																		}}
																		className="w-12 rounded border border-[#2a2a2a] bg-[#0f0f0f] px-1.5 py-0.5 text-[10px] text-white text-center focus:border-[#4a4a4a] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
																		style={{ MozAppearance: 'textfield' }}
																	/>
																	<button
																		onClick={() => updateCheckoutQuantity(index, checkoutItem.amount + 1)}
																		className="rounded border border-[#2a2a2a] bg-[#0f0f0f] h-6 w-6 flex items-center justify-center text-[10px] text-white hover:bg-[#2a2a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
																		disabled={checkoutItem.amount >= maxAmount}
																	>
																		+
																	</button>
																	<button
																		onClick={() => removeFromCheckout(index)}
																		className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-1.5 py-0.5 text-[9px] text-white hover:bg-[#2a2a2a] transition-colors"
																	>
																		Remove
																	</button>
																</div>
															</div>
														)
													})}
												</div>
											)}
										</div>
										{checkoutItems.length > 0 && (
											<div className="flex items-center justify-between border-t border-[#2a2a2a]/50 pt-2">
												<div className="text-[10px] font-semibold text-white">
													Total: ${calculateTotalPrice().toFixed(2)}
												</div>
												<button
													onClick={handleCheckout}
													className="rounded border border-green-600 bg-green-600/20 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-green-600/30 transition-colors"
												>
													Purchase
												</button>
											</div>
										)}
										</div>
									)}

									{otherName && (
									<InventorySection
										title={otherLabel?.toUpperCase() ?? 'CONTAINER'}
										slots={otherSlots}
										inventory={otherInv}
										type="other"
										sideBySide={true}
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
										isDragging={!!(dragPreview || mouseDragFrom)}
										/>
									)}
								</div>
							</div>

							{/* Split amount dialog */}
								<Dialog.Root open={splitOpen} onOpenChange={setSplitOpen}>
									<Dialog.Portal>
										<Dialog.Overlay className="fixed inset-0 bg-black/60" />
										<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded border border-[#2a2a2a]/50 bg-[#1a1a1a] p-4 shadow-xl focus:outline-none">
											<Dialog.Title className="text-sm font-semibold text-white tracking-wide">Split Stack</Dialog.Title>
											<div className="mt-3 space-y-2.5">
												<input
													type="number"
													min={1}
													max={splitMax}
													value={splitAmount}
													onChange={(e) => setSplitAmount(Number(e.target.value))}
													className="w-full rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] px-2.5 py-1.5 text-xs text-white focus:border-[#4a4a4a] focus:outline-none"
												/>
												<input
													type="range"
													min={1}
													max={splitMax}
													value={splitAmount}
													onChange={(e) => setSplitAmount(Number(e.target.value))}
													className="w-full accent-[#4a4a4a]"
												/>
												<div className="text-[10px] text-[#888]">Amount: {splitAmount} / {splitMax}</div>
											</div>
											<div className="mt-4 flex justify-end gap-2">
												<button
													className="rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a2a2a] transition-colors"
													onClick={() => setSplitOpen(false)}
												>
													Cancel
												</button>
												<button
													className="rounded border border-[#2a2a2a]/50 bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a3a3a] transition-colors"
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
										<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded border border-[#2a2a2a]/50 bg-[#1a1a1a] p-4 shadow-xl focus:outline-none">
											<Dialog.Title className="text-sm font-semibold text-white tracking-wide">Attachments</Dialog.Title>
											<div className="mt-3">
												{!attachData ? (
													<div className="text-xs text-[#888]">No data</div>
												) : (
													<div className="space-y-1.5">
														{Array.isArray(attachData.Attachments) && attachData.Attachments.length > 0 ? (
															attachData.Attachments.map((att: any, idx: number) => (
																<div key={idx} className="flex items-center justify-between rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] p-2">
																	<div className="text-xs text-white">{att.label ?? att.attachment}</div>
																	<button
																		className="rounded border border-[#2a2a2a]/50 bg-[#0f0f0f] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2a2a2a] transition-colors"
																		onClick={() => removeAttachment(attachData, att)}
																	>
																		Remove
																	</button>
																</div>
															))
														) : (
															<div className="text-xs text-[#888]">No attachments</div>
														)}
													</div>
												)}
											</div>
											<div className="mt-4 flex justify-end">
												<button
													className="rounded border border-[#2a2a2a]/50 bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a3a3a] transition-colors"
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

			{/* Drag preview that follows cursor */}
			{dragPreview && (
				<div
					className="fixed pointer-events-none z-[9999] w-16 h-16 rounded border-2 border-[#4a4a4a] bg-[#1a1a1a] shadow-2xl opacity-90"
					style={{
						left: `${dragPreview.x - 32}px`,
						top: `${dragPreview.y - 32}px`,
						transform: 'translate(0, 0)',
					}}
				>
					<img
						src={getItemIconUrl(dragPreview.item)}
						alt={dragPreview.item.label || dragPreview.item.name}
						className="w-full h-full object-contain p-1"
						onError={onIconError}
					/>
					{dragPreview.item.amount > 1 && (
						<div className="absolute bottom-0 right-0 bg-[#1a1a1a]/90 text-white text-xs font-semibold px-1 rounded-tl">
							{dragPreview.item.amount}
						</div>
					)}
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
	sideBySide,
	onSlotMouseDown,
	onSlotMouseUp,
	onItemDoubleClick,
	onContextMenu,
	getItemIconUrl,
	onIconError,
	contextMenuOpen,
	onContextMenuAction,
	setContextMenuOpen,
	onAttachments,
	isDragging
}: {
	title: string
	slots: number
	inventory: InventoryMap
	type: 'player' | 'other'
	sideBySide?: boolean
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
	isDragging: boolean
}) {
	function getSlotsArray(total: number): number[] {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	return (
		<section className={cn("rounded border border-[#2a2a2a]/50 bg-[#151515]/60", sideBySide ? "p-2" : "p-1.5")}>
			<div className={cn("flex items-center justify-between", sideBySide ? "mb-2" : "mb-1.5")}>
				<h2 className={cn("font-semibold text-white tracking-wide", sideBySide ? "text-xs" : "text-[10px]")}>{title}</h2>
				<div className={cn("text-[#888]", sideBySide ? "text-xs" : "text-[10px]")}>Slots: {slots}</div>
			</div>
			<Tooltip.Provider>
				<div className={cn("grid max-h-[50vh] overflow-y-auto pr-0.5", sideBySide ? "grid-cols-5 gap-1" : "grid-cols-5 gap-0.5")}>
					{getSlotsArray(slots).map((slot) => {
						const item = inventory[slot]
						const isContextMenuOpen = contextMenuOpen?.type === type && contextMenuOpen?.slot === slot
						const hasAttachments = !!(item && (item.type === 'weapon' || (item.info && item.info.attachments)))
						// Only show "Use" for items that are explicitly useable (useable === true) or weapons
						const isUseable = !!(item && (item.useable === true || item.type === 'weapon'))
						const isCombinable = !!(item && item.combinable)
						const canUse = isUseable && type === 'player'
						return (
							<ContextMenu.Root key={`${type}-${slot}`} open={isContextMenuOpen && !!item} onOpenChange={(open: boolean) => {
							if (open && item) {
								setContextMenuOpen({ type, slot })
							} else {
								setContextMenuOpen(null)
							}
						}}>
							{item ? (
								!isDragging ? (
									<Tooltip.Root delayDuration={300}>
										<ContextMenu.Trigger asChild>
											<Tooltip.Trigger asChild>
												<div
													className={cn(
														'relative aspect-square rounded border transition-colors cursor-pointer',
														'bg-[#0f0f0f] border-[#2a2a2a] border-[#3a3a3a] hover:border-[#5a5a5a] hover:bg-[#151515]',
														isContextMenuOpen && 'border-[#5a5a5a]',
														// Make hotkey slots more apparent with a distinct border
														slot <= 5 && 'border-[#5a5a5a] border-2'
													)}
													onMouseDown={(e) => {
														// Only handle left click for dragging
														if (e.button === 0) {
															onSlotMouseDown(type, slot, e)
														}
													}}
													onMouseUp={(e) => {
														// Only handle left click for dragging
														if (e.button === 0) {
															onSlotMouseUp(type, slot, e)
														}
													}}
													onDoubleClick={() => onItemDoubleClick(type, slot)}
												>
													{/* Hotkey indicator for first 5 slots */}
													{slot <= 5 && (
														<div className={cn(
															"absolute top-0.5 left-0.5 z-10 flex items-center justify-center rounded-full border-2 border-[#6a6a6a] bg-gradient-to-br from-[#3a3a3a] to-[#2a2a2a] font-bold text-white shadow-md",
															sideBySide ? "h-4 w-4 text-[11px]" : "h-3.5 w-3.5 text-[10px]"
														)}>
															{slot}
														</div>
													)}

													{/* Item image */}
													<div className={cn("flex h-full w-full items-center justify-center", sideBySide ? "p-1.5" : "p-1")}>
														<img
															src={getItemIconUrl(item) || ''}
															onError={onIconError}
															alt=""
															className="max-h-full max-w-full object-contain"
														/>
													</div>

													{/* Stack count indicator */}
													{item.amount > 1 && (
														<div className={cn(
															"absolute bottom-0.5 right-0.5 z-10 rounded-sm border border-[#4a4a4a]/50 bg-[#000]/95 backdrop-blur-sm font-semibold text-white leading-tight px-1",
															sideBySide ? "py-0.5 text-[10px]" : "py-0 text-[9px]"
														)}>
															{item.amount}
														</div>
													)}

													{/* Quality/Durability bar */}
													{item.info && item.info.quality != null && (
														<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#000]/60 rounded-b overflow-hidden">
															<div
																className={cn(
																	"h-full transition-all",
																	Number(item.info.quality) > 75 ? "bg-green-500" :
																	Number(item.info.quality) > 25 ? "bg-yellow-500" :
																	"bg-red-500"
																)}
																style={{ width: `${Math.min(Math.max(Number(item.info.quality) || 0, 0), 100)}%` }}
															/>
														</div>
													)}
												</div>
											</Tooltip.Trigger>
										</ContextMenu.Trigger>
										<Tooltip.Portal>
											<Tooltip.Content
												side="top"
												className="z-50 max-w-xs rounded border border-[#2a2a2a]/50 bg-[#1a1a1a] p-2 text-[10px] text-white shadow-xl"
											>
												{renderTooltip(item)}
											</Tooltip.Content>
										</Tooltip.Portal>
									</Tooltip.Root>
								) : (
									<ContextMenu.Trigger asChild>
										<div
											className={cn(
												'relative aspect-square rounded border transition-colors cursor-pointer',
												'bg-[#0f0f0f] border-[#2a2a2a] border-[#3a3a3a] hover:border-[#5a5a5a] hover:bg-[#151515]',
												isContextMenuOpen && 'border-[#5a5a5a]',
												// Make hotkey slots more apparent with a distinct border
												slot <= 5 && 'border-[#5a5a5a] border-2'
											)}
											onMouseDown={(e) => {
												// Only handle left click for dragging
												if (e.button === 0) {
													onSlotMouseDown(type, slot, e)
												}
											}}
											onMouseUp={(e) => {
												// Only handle left click for dragging
												if (e.button === 0) {
													onSlotMouseUp(type, slot, e)
												}
											}}
											onDoubleClick={() => onItemDoubleClick(type, slot)}
										>
											{/* Hotkey indicator for first 5 slots */}
											{slot <= 5 && (
												<div className={cn(
													"absolute top-0.5 left-0.5 z-10 flex items-center justify-center rounded-full border-2 border-[#6a6a6a] bg-gradient-to-br from-[#3a3a3a] to-[#2a2a2a] font-bold text-white shadow-md",
													sideBySide ? "h-4 w-4 text-[11px]" : "h-3.5 w-3.5 text-[10px]"
												)}>
													{slot}
												</div>
											)}

											{/* Item image */}
											<div className={cn("flex h-full w-full items-center justify-center", sideBySide ? "p-1.5" : "p-1")}>
												<img
													src={getItemIconUrl(item) || ''}
													onError={onIconError}
													alt=""
													className="max-h-full max-w-full object-contain"
												/>
											</div>

											{/* Stack count indicator */}
											{item.amount > 1 && (
												<div className={cn(
													"absolute bottom-0.5 right-0.5 z-10 rounded-sm border border-[#4a4a4a]/50 bg-[#000]/95 backdrop-blur-sm font-semibold text-white leading-tight px-1",
													sideBySide ? "py-0.5 text-[10px]" : "py-0 text-[9px]"
												)}>
													{item.amount}
												</div>
											)}

											{/* Quality/Durability bar */}
											{item.info && item.info.quality != null && (
												<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#000]/60 rounded-b overflow-hidden">
													<div
														className={cn(
															"h-full transition-all",
															Number(item.info.quality) > 75 ? "bg-green-500" :
															Number(item.info.quality) > 25 ? "bg-yellow-500" :
															"bg-red-500"
														)}
														style={{ width: `${Math.min(Math.max(Number(item.info.quality) || 0, 0), 100)}%` }}
													/>
												</div>
											)}
										</div>
									</ContextMenu.Trigger>
								)
							) : (
								<ContextMenu.Trigger asChild>
									<div
										className={cn(
											'relative aspect-square rounded border transition-colors cursor-pointer',
											'bg-[#0a0a0a] border-[#2a2a2a] opacity-40 hover:opacity-60 hover:border-[#3a3a3a]',
											isContextMenuOpen && 'border-[#5a5a5a]',
											// Make hotkey slots more apparent with a distinct border
											slot <= 5 && 'border-[#5a5a5a] border-2'
										)}
										style={{
											backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(42,42,42,0.08) 25%, rgba(42,42,42,0.08) 50%, transparent 50%, transparent 75%, rgba(42,42,42,0.08) 75%, rgba(42,42,42,0.08))',
											backgroundSize: '8px 8px'
										}}
										onMouseDown={(e) => {
											// Only handle left click for dragging
											if (e.button === 0) {
												onSlotMouseDown(type, slot, e)
											}
										}}
										onMouseUp={(e) => {
											// Only handle left click for dragging
											if (e.button === 0) {
												onSlotMouseUp(type, slot, e)
											}
										}}
										onDoubleClick={() => onItemDoubleClick(type, slot)}
									>
										{/* Hotkey indicator for first 5 slots */}
										{slot <= 5 && (
											<div className={cn(
												"absolute top-0.5 left-0.5 z-10 flex items-center justify-center rounded-full border-2 border-[#6a6a6a] bg-gradient-to-br from-[#3a3a3a] to-[#2a2a2a] font-bold text-white shadow-md",
												sideBySide ? "h-4 w-4 text-[11px]" : "h-3.5 w-3.5 text-[10px]"
											)}>
												{slot}
											</div>
										)}
									</div>
								</ContextMenu.Trigger>
							)}
							{item && (
								<ContextMenu.Portal>
									<ContextMenu.Content className="z-[100] min-w-[160px] rounded border border-[#2a2a2a]/50 bg-[#1a1a1a] p-0.5 shadow-xl">
										{canUse && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('use')}
											>
												Use
											</ContextMenu.Item>
										)}
										{type === 'player' && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('give')}
											>
												Give
											</ContextMenu.Item>
										)}
										{type === 'player' && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('drop')}
											>
												Drop
											</ContextMenu.Item>
										)}
										{item.amount > 1 && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('split')}
											>
												Split
											</ContextMenu.Item>
										)}
										{hasAttachments && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onAttachments(item)}
											>
												Attachments
											</ContextMenu.Item>
										)}
										{isCombinable && type === 'player' && (
											<ContextMenu.Item
												className="cursor-pointer rounded px-2.5 py-1.5 text-[11px] text-white outline-none hover:bg-[#2a2a2a] focus:bg-[#2a2a2a]"
												onSelect={() => onContextMenuAction('combine')}
											>
												Combine
											</ContextMenu.Item>
										)}
									</ContextMenu.Content>
								</ContextMenu.Portal>
							)}
							</ContextMenu.Root>
						)
					})}
				</div>
			</Tooltip.Provider>
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


