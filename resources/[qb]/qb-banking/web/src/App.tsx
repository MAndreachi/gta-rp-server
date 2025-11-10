import * as React from 'react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer
} from 'recharts'

type Account = {
	name: string
	type: string
	balance: number
	users?: string
	id?: number
}

type Statement = {
	id?: number
	date: number
	user: string
	reason: string
	amount: number
	type: string
}

type PlayerData = {
	charinfo: {
		firstname: string
		lastname: string
	}
	citizenid: string
	money: {
		cash: number
		bank: number
	}
}

type Notification = {
	message: string
	type: 'success' | 'error'
}

export default function App() {
	const [isBankOpen, setIsBankOpen] = React.useState(false)
	const [isATMOpen, setIsATMOpen] = React.useState(false)
	const [showPinPrompt, setShowPinPrompt] = React.useState(false)
	const [notification, setNotification] = React.useState<Notification | null>(null)
	const [activeView, setActiveView] = React.useState<'overview' | 'transact' | 'accounts' | 'services' | 'analytics'>('overview')
	const [analyticsTimeRange, setAnalyticsTimeRange] = React.useState<'7d' | '30d' | '90d' | 'all'>('30d')
	const [transactType, setTransactType] = React.useState<'deposit' | 'withdraw' | 'internal' | 'external'>('deposit')
	const [accounts, setAccounts] = React.useState<Account[]>([])
	const [statements, setStatements] = React.useState<Record<string, Statement[]>>({})
	const [selectedAccountStatement, setSelectedAccountStatement] = React.useState('checking')
	const [playerName, setPlayerName] = React.useState('')
	const [accountNumber, setAccountNumber] = React.useState('')
	const [playerCash, setPlayerCash] = React.useState(0)
	
	// Money management state
	const [selectedMoneyAccount, setSelectedMoneyAccount] = React.useState<Account | null>(null)
	const [selectedMoneyAmount, setSelectedMoneyAmount] = React.useState(0)
	const [moneyReason, setMoneyReason] = React.useState('')
	
	// Transfer state
	const [internalFromAccount, setInternalFromAccount] = React.useState<Account | null>(null)
	const [internalToAccount, setInternalToAccount] = React.useState<Account | null>(null)
	const [internalTransferAmount, setInternalTransferAmount] = React.useState(0)
	const [externalAccountNumber, setExternalAccountNumber] = React.useState('')
	const [externalFromAccount, setExternalFromAccount] = React.useState<Account | null>(null)
	const [externalTransferAmount, setExternalTransferAmount] = React.useState(0)
	const [transferReason, setTransferReason] = React.useState('')
	
	// Account options state
	const [debitPin, setDebitPin] = React.useState('')
	const [enteredPin, setEnteredPin] = React.useState('')
	const [acceptablePins, setAcceptablePins] = React.useState<number[]>([])
	const [tempBankData, setTempBankData] = React.useState<any>(null)
	const [createAccountName, setCreateAccountName] = React.useState('')
	const [createAccountAmount, setCreateAccountAmount] = React.useState(0)
	const [editAccount, setEditAccount] = React.useState<Account | null>(null)
	const [editAccountName, setEditAccountName] = React.useState('')
	const [manageAccountName, setManageAccountName] = React.useState<Account | null>(null)
	const [manageUserName, setManageUserName] = React.useState('')
	const [filteredUsers, setFilteredUsers] = React.useState<string[]>([])
	const [showUsersDropdown, setShowUsersDropdown] = React.useState(false)

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			switch (msg.data?.action) {
				case 'openBank': {
					const playerData = msg.data.playerData as PlayerData
					setPlayerName(playerData.charinfo.firstname)
					setAccountNumber(playerData.citizenid)
					setPlayerCash(playerData.money.cash)
					
					const accountsList: Account[] = msg.data.accounts.map((acc: any) => ({
						name: acc.account_name,
						type: acc.account_type,
						balance: acc.account_balance,
						users: acc.users,
						id: acc.id
					}))
					setAccounts(accountsList)
					
					const statementsMap: Record<string, Statement[]> = {}
					Object.keys(msg.data.statements || {}).forEach((accountKey) => {
						statementsMap[accountKey] = msg.data.statements[accountKey].map((stmt: any) => ({
							id: stmt.id,
							date: stmt.date,
							reason: stmt.reason,
							amount: stmt.amount,
							type: stmt.statement_type,
							user: stmt.citizenid
						}))
					})
					setStatements(statementsMap)
					setIsBankOpen(true)
					break
				}
				case 'openATM': {
					setTempBankData(msg.data)
					setAcceptablePins(Array.from(msg.data.pinNumbers || []))
					setShowPinPrompt(true)
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
		document.documentElement.classList.toggle('nui-visible', isBankOpen || isATMOpen)
	}, [isBankOpen, isATMOpen])

	React.useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!isBankOpen && !isATMOpen && !showPinPrompt) return
			if (e.key === 'Escape' || e.key === 'Tab') {
				closeApplication()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isBankOpen, isATMOpen, showPinPrompt])

	// Filter users for account management
	React.useEffect(() => {
		if (!manageAccountName || typeof manageAccountName.users !== 'string') {
			setFilteredUsers([])
			return
		}
		try {
			const usersArray = JSON.parse(manageAccountName.users)
			if (manageUserName === '') {
				setFilteredUsers(usersArray)
			} else {
				setFilteredUsers(usersArray.filter((user: string) => 
					user.toLowerCase().includes(manageUserName.toLowerCase())
				))
			}
		} catch {
			setFilteredUsers([])
		}
	}, [manageAccountName, manageUserName])

	const openATM = (bankData: any) => {
		const playerData = bankData.playerData as PlayerData
		setPlayerName(playerData.charinfo.firstname)
		setAccountNumber(playerData.citizenid)
		setPlayerCash(playerData.money.cash)
		
		const accountsList: Account[] = bankData.accounts.map((acc: any) => ({
			name: acc.account_name,
			type: acc.account_type,
			balance: acc.account_balance,
			users: acc.users,
			id: acc.id
		}))
		setAccounts(accountsList)
		setIsATMOpen(true)
	}

	const handlePinSubmit = () => {
		if (acceptablePins.includes(parseInt(enteredPin))) {
			setShowPinPrompt(false)
			openATM(tempBankData)
			setEnteredPin('')
			setAcceptablePins([])
			setTempBankData(null)
		} else {
			addNotification('Invalid PIN', 'error')
			setEnteredPin('')
		}
	}

	const addNotification = (message: string, type: 'success' | 'error') => {
		setNotification({ message, type })
		setTimeout(() => setNotification(null), 3000)
	}

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat().format(amount)
	}

	const formatDate = (timestamp: number) => {
		const date = new Date(parseInt(timestamp.toString()))
		const month = (date.getMonth() + 1).toString().padStart(2, '0')
		const day = date.getDate().toString().padStart(2, '0')
		const year = date.getFullYear()
		return `${month}/${day}/${year}`
	}

	const addStatement = (accountNumber: string, accountName: string, reason: string, amount: number, type: string) => {
		const newStatement: Statement = {
			date: Date.now(),
			user: accountNumber,
			reason,
			amount,
			type
		}
		setStatements(prev => ({
			...prev,
			[accountName]: [...(prev[accountName] || []), newStatement]
		}))
	}

	const closeApplication = async () => {
		if (isBankOpen) {
			setIsBankOpen(false)
		} else if (isATMOpen) {
			setIsATMOpen(false)
		} else if (showPinPrompt) {
			setShowPinPrompt(false)
			setEnteredPin('')
			setAcceptablePins([])
			setTempBankData(null)
		}
		await nuiSend('closeApp', {})
	}

	// Money operations
	const withdrawMoney = async () => {
		if (!selectedMoneyAccount || selectedMoneyAmount <= 0) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('withdraw', {
			accountName: selectedMoneyAccount.name,
			amount: selectedMoneyAmount,
			reason: moneyReason
		})
		
		if (response?.success) {
			setAccounts(prev => prev.map(acc => 
				acc.name === selectedMoneyAccount.name 
					? { ...acc, balance: acc.balance - selectedMoneyAmount }
					: acc
			))
			setPlayerCash(prev => prev + selectedMoneyAmount)
			addStatement(accountNumber, selectedMoneyAccount.name, moneyReason, selectedMoneyAmount, 'withdraw')
			setSelectedMoneyAmount(0)
			setMoneyReason('')
			setSelectedMoneyAccount(null)
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Withdrawal failed', 'error')
		}
	}

	const depositMoney = async () => {
		if (!selectedMoneyAccount || selectedMoneyAmount <= 0) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('deposit', {
			accountName: selectedMoneyAccount.name,
			amount: selectedMoneyAmount,
			reason: moneyReason
		})
		
		if (response?.success) {
			setAccounts(prev => prev.map(acc => 
				acc.name === selectedMoneyAccount.name 
					? { ...acc, balance: acc.balance + selectedMoneyAmount }
					: acc
			))
			setPlayerCash(prev => prev - selectedMoneyAmount)
			addStatement(accountNumber, selectedMoneyAccount.name, moneyReason, selectedMoneyAmount, 'deposit')
			setSelectedMoneyAmount(0)
			setMoneyReason('')
			setSelectedMoneyAccount(null)
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Deposit failed', 'error')
		}
	}

	// Transfer operations
	const internalTransfer = async () => {
		if (!internalFromAccount || !internalToAccount || internalTransferAmount <= 0) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('internalTransfer', {
			fromAccountName: internalFromAccount.name,
			toAccountName: internalToAccount.name,
			amount: internalTransferAmount,
			reason: transferReason
		})
		
		if (response?.success) {
			setAccounts(prev => prev.map(acc => {
				if (acc.name === internalFromAccount.name) {
					return { ...acc, balance: acc.balance - internalTransferAmount }
				}
				if (acc.name === internalToAccount.name) {
					return { ...acc, balance: acc.balance + internalTransferAmount }
				}
				return acc
			}))
			addStatement(accountNumber, internalFromAccount.name, transferReason, internalTransferAmount, 'withdraw')
			addStatement(accountNumber, internalToAccount.name, transferReason, internalTransferAmount, 'deposit')
			setInternalTransferAmount(0)
			setTransferReason('')
			setInternalFromAccount(null)
			setInternalToAccount(null)
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Transfer failed', 'error')
		}
	}

	const externalTransfer = async () => {
		if (!externalFromAccount || !externalAccountNumber || externalTransferAmount <= 0) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('externalTransfer', {
			fromAccountName: externalFromAccount.name,
			toAccountNumber: externalAccountNumber,
			amount: externalTransferAmount,
			reason: transferReason
		})
		
		if (response?.success) {
			setAccounts(prev => prev.map(acc => 
				acc.name === externalFromAccount.name 
					? { ...acc, balance: acc.balance - externalTransferAmount }
					: acc
			))
			addStatement(accountNumber, externalFromAccount.name, transferReason, externalTransferAmount, 'withdraw')
			setExternalTransferAmount(0)
			setTransferReason('')
			setExternalFromAccount(null)
			setExternalAccountNumber('')
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Transfer failed', 'error')
		}
	}

	// Account operations
	const orderDebitCard = async () => {
		if (!debitPin) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('orderCard', {
			pin: debitPin
		})
		
		if (response?.success) {
			setDebitPin('')
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Failed to order card', 'error')
		}
	}

	const openAccount = async () => {
		if (!createAccountName || createAccountAmount < 0) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('openAccount', {
			accountName: createAccountName,
			amount: createAccountAmount
		})
		
		if (response?.success) {
			const checkingAccount = accounts.find(acc => acc.name === 'checking')
			if (checkingAccount) {
				setAccounts(prev => prev.map(acc => 
					acc.name === 'checking' 
						? { ...acc, balance: acc.balance - createAccountAmount }
						: acc
				))
			}
			setAccounts(prev => [...prev, {
				name: createAccountName,
				type: 'shared',
				balance: createAccountAmount,
				users: JSON.stringify([playerName])
			}])
			addStatement(accountNumber, 'checking', `Initial deposit for ${createAccountName}`, createAccountAmount, 'withdraw')
			addStatement(accountNumber, createAccountName, 'Initial deposit', createAccountAmount, 'deposit')
			setCreateAccountName('')
			setCreateAccountAmount(0)
			addNotification(response.message, 'success')
		} else {
			setCreateAccountName('')
			setCreateAccountAmount(0)
			addNotification(response?.message || 'Failed to open account', 'error')
		}
	}

	const renameAccount = async () => {
		if (!editAccount || !editAccountName) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('renameAccount', {
			oldName: editAccount.name,
			newName: editAccountName
		})
		
		if (response?.success) {
			setAccounts(prev => prev.map(acc => 
				acc.name === editAccount.name 
					? { ...acc, name: editAccountName }
					: acc
			))
			setEditAccount(null)
			setEditAccountName('')
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Failed to rename account', 'error')
		}
	}

	const deleteAccount = async () => {
		if (!editAccount) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('deleteAccount', {
			accountName: editAccount.name
		})
		
		if (response?.success) {
			setAccounts(prev => prev.filter(acc => acc.name !== editAccount.name))
			setEditAccount(null)
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Failed to delete account', 'error')
		}
	}

	const addUserToAccount = async () => {
		if (!manageAccountName || !manageUserName) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('addUser', {
			accountName: manageAccountName.name,
			userName: manageUserName
		})
		
		if (response?.success) {
			const usersArray = JSON.parse(manageAccountName.users || '[]')
			usersArray.push(manageUserName)
			setAccounts(prev => prev.map(acc => 
				acc.name === manageAccountName.name 
					? { ...acc, users: JSON.stringify(usersArray) }
					: acc
			))
			setManageUserName('')
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Failed to add user', 'error')
		}
	}

	const removeUserFromAccount = async () => {
		if (!manageAccountName || !manageUserName) return
		
		const response = await nuiSend<{ success: boolean; message: string }>('removeUser', {
			accountName: manageAccountName.name,
			userName: manageUserName
		})
		
		if (response?.success) {
			const usersArray = JSON.parse(manageAccountName.users || '[]')
			const filtered = usersArray.filter((user: string) => user !== manageUserName)
			setAccounts(prev => prev.map(acc => 
				acc.name === manageAccountName.name 
					? { ...acc, users: JSON.stringify(filtered) }
					: acc
			))
			setManageUserName('')
			addNotification(response.message, 'success')
		} else {
			addNotification(response?.message || 'Failed to remove user', 'error')
		}
	}

	const appendNumber = (number: number) => {
		setEnteredPin(prev => prev + number.toString())
	}

	const selectUser = (user: string) => {
		setManageUserName(user)
		setShowUsersDropdown(false)
	}

	// Analytics processing functions
	const getFilteredStatements = () => {
		const allStatements: Statement[] = []
		Object.values(statements).forEach(accountStatements => {
			allStatements.push(...accountStatements)
		})

		const now = Date.now()
		const timeRanges: Record<string, number> = {
			'7d': 7 * 24 * 60 * 60 * 1000,
			'30d': 30 * 24 * 60 * 60 * 1000,
			'90d': 90 * 24 * 60 * 60 * 1000,
			'all': Infinity
		}

		const cutoff = now - (timeRanges[analyticsTimeRange] || Infinity)
		return allStatements.filter(stmt => stmt.date >= cutoff)
	}

	const getSpendingOverTime = () => {
		const filtered = getFilteredStatements()
		const dailyData: Record<string, { date: string; deposits: number; withdrawals: number; net: number }> = {}

		filtered.forEach(stmt => {
			const date = new Date(stmt.date)
			const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
			
			if (!dailyData[dateKey]) {
				dailyData[dateKey] = { date: dateKey, deposits: 0, withdrawals: 0, net: 0 }
			}

			if (stmt.type === 'deposit') {
				dailyData[dateKey].deposits += stmt.amount
				dailyData[dateKey].net += stmt.amount
			} else {
				dailyData[dateKey].withdrawals += stmt.amount
				dailyData[dateKey].net -= stmt.amount
			}
		})

		return Object.values(dailyData).sort((a, b) => {
			return new Date(a.date).getTime() - new Date(b.date).getTime()
		})
	}

	const getIncomeVsExpenses = () => {
		const filtered = getFilteredStatements()
		let totalIncome = 0
		let totalExpenses = 0

		filtered.forEach(stmt => {
			if (stmt.type === 'deposit') {
				totalIncome += stmt.amount
			} else {
				totalExpenses += stmt.amount
			}
		})

		return [
			{ name: 'Income', value: totalIncome, color: '#22c55e' },
			{ name: 'Expenses', value: totalExpenses, color: '#ef4444' }
		]
	}

	const getTransactionBreakdown = () => {
		const filtered = getFilteredStatements()
		const breakdown: Record<string, number> = {}

		filtered.forEach(stmt => {
			const reason = stmt.reason || 'Other'
			const category = reason.split(' ')[0] // Simple categorization by first word
			breakdown[category] = (breakdown[category] || 0) + Math.abs(stmt.amount)
		})

		const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
		
		return Object.entries(breakdown)
			.map(([name, value], idx) => ({
				name,
				value,
				color: colors[idx % colors.length]
			}))
			.sort((a, b) => b.value - a.value)
			.slice(0, 8) // Top 8 categories
	}

	const getMonthlySummary = () => {
		const filtered = getFilteredStatements()
		const monthlyData: Record<string, { month: string; income: number; expenses: number }> = {}

		filtered.forEach(stmt => {
			const date = new Date(stmt.date)
			const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
			
			if (!monthlyData[monthKey]) {
				monthlyData[monthKey] = { month: monthKey, income: 0, expenses: 0 }
			}

			if (stmt.type === 'deposit') {
				monthlyData[monthKey].income += stmt.amount
			} else {
				monthlyData[monthKey].expenses += stmt.amount
			}
		})

		return Object.values(monthlyData).sort((a, b) => {
			return new Date(a.month).getTime() - new Date(b.month).getTime()
		})
	}

	const getTopTransactions = () => {
		const filtered = getFilteredStatements()
		return filtered
			.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
			.slice(0, 10)
	}

	const getFinancialSummary = () => {
		const filtered = getFilteredStatements()
		let totalIncome = 0
		let totalExpenses = 0
		let transactionCount = filtered.length

		filtered.forEach(stmt => {
			if (stmt.type === 'deposit') {
				totalIncome += stmt.amount
			} else {
				totalExpenses += stmt.amount
			}
		})

		const net = totalIncome - totalExpenses
		const avgTransaction = transactionCount > 0 ? (totalIncome + totalExpenses) / transactionCount : 0

		return {
			totalIncome,
			totalExpenses,
			net,
			transactionCount,
			avgTransaction
		}
	}


	return (
		<>
			{/* PIN Prompt */}
			{showPinPrompt && (
				<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-50">
					<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-2xl w-[20vw] min-w-[300px]">
						<div className="mb-4 text-center">
							<h2 className="text-lg font-semibold text-white mb-2">Enter PIN</h2>
							<input
								type="password"
								value={enteredPin}
								readOnly
								placeholder="Enter PIN"
								className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 text-center text-white focus:border-[#4a4a4a] focus:outline-none"
							/>
						</div>
						<div className="grid grid-cols-3 gap-2 mb-4">
							{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
								<button
									key={num}
									onClick={() => appendNumber(num)}
									className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-white hover:bg-[#2a2a2a] transition-colors font-semibold"
								>
									{num}
								</button>
							))}
							<button
								onClick={() => setEnteredPin('')}
								className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-white hover:bg-[#2a2a2a] transition-colors font-semibold"
							>
								Clear
							</button>
							<button
								onClick={() => appendNumber(0)}
								className="rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-3 text-white hover:bg-[#2a2a2a] transition-colors font-semibold"
							>
								0
							</button>
							<button
								onClick={handlePinSubmit}
								className="rounded border border-green-600 bg-green-600/20 px-4 py-3 text-white hover:bg-green-600/30 transition-colors font-semibold"
							>
								Submit
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Bank View */}
			{isBankOpen && (
				<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-40">
					<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[60vw] h-[70vh] max-w-6xl flex">
						{/* Sidebar */}
						<div className="w-64 flex-shrink-0 flex flex-col justify-between bg-[#0f0f0f] border-r border-[#2a2a2a] rounded-l-md">
							<div className="p-4">
								<div className="mb-4 rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
									<div className="text-sm font-semibold text-white mb-1">{playerName}</div>
									<div className="text-xs text-[#888]">
										Cash: <span className="text-green-400">${formatCurrency(playerCash)}</span>
									</div>
								</div>
								<div className="flex-1 overflow-y-auto">
									<ul className="space-y-2">
										{accounts.map(account => (
											<li
												key={account.name}
												onClick={() => setSelectedAccountStatement(account.name)}
												className={cn(
													"rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3 cursor-pointer transition-colors",
													selectedAccountStatement === account.name && "border-green-500 bg-[#1a2a1a]"
												)}
											>
												<div className="text-xs font-medium text-white">{account.name}</div>
												<div className="text-xs text-green-400">${formatCurrency(account.balance)}</div>
											</li>
										))}
									</ul>
								</div>
							</div>
							<div className="p-4 space-y-2">
								<button
									onClick={closeApplication}
									className="w-full rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
								>
									Logout
								</button>
								<div className="text-xs text-[#888] text-center">
									Account Number: {accountNumber}
								</div>
							</div>
						</div>

						{/* Main Content */}
						<div className="flex-1 flex flex-col">
							{/* Navigation */}
							<div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1a1a1a] p-2">
								<div className="flex gap-2">
									{[
										{ id: 'overview', label: 'Overview' },
										{ id: 'transact', label: 'Transact' },
										{ id: 'accounts', label: 'Accounts' },
										{ id: 'analytics', label: 'Analytics' },
										{ id: 'services', label: 'Services' }
									].map(view => (
										<button
											key={view.id}
											onClick={() => setActiveView(view.id as any)}
											className={cn(
												"rounded border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#2a2a2a] transition-colors",
												activeView === view.id && "bg-green-600/20 border-green-600"
											)}
										>
											{view.label}
										</button>
									))}
								</div>
								{notification && (
									<div className={cn(
										"rounded border px-4 py-2 text-xs font-medium",
										notification.type === 'success' 
											? "border-green-600 bg-green-600/20 text-green-400"
											: "border-red-600 bg-red-600/20 text-red-400"
									)}>
										{notification.message}
									</div>
								)}
							</div>

							{/* Content Area */}
							<div className="flex-1 overflow-y-auto p-4">
								{/* Overview View - Account Summary & Recent Transactions */}
								{activeView === 'overview' && (
									<div className="space-y-4">
										{/* Account Summary Cards */}
										<div className="grid grid-cols-2 gap-4 mb-6">
											{accounts.map(account => (
												<div
													key={account.name}
													onClick={() => setSelectedAccountStatement(account.name)}
													className={cn(
														"rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4 cursor-pointer transition-colors",
														selectedAccountStatement === account.name && "border-green-500 bg-[#1a2a1a]"
													)}
												>
													<div className="text-xs text-[#888] mb-1 uppercase">{account.type}</div>
													<div className="text-lg font-semibold text-white mb-1">{account.name}</div>
													<div className="text-xl font-bold text-green-400">${formatCurrency(account.balance)}</div>
												</div>
											))}
										</div>

										{/* Recent Transactions */}
										<div>
											<h3 className="text-sm font-semibold text-white mb-3">Recent Transactions</h3>
											<div className="space-y-2">
												{(statements[selectedAccountStatement] || []).slice(0, 10).map((statement, idx) => (
													<div
														key={idx}
														className="flex justify-between items-center rounded border border-[#2a2a2a] bg-[#0f0f0f] p-3"
													>
														<div className="flex-1">
															<div className="text-xs text-[#888]">{formatDate(statement.date)}</div>
															<div className="text-sm text-white">{statement.reason}</div>
															<div className="text-xs text-[#888]">{statement.user}</div>
														</div>
														<div className={cn(
															"text-sm font-semibold",
															statement.type === 'deposit' ? "text-green-400" : "text-red-400"
														)}>
															{statement.type === 'deposit' ? '+' : '-'}${formatCurrency(statement.amount)}
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								)}

								{/* Transact View - All Money Operations */}
								{activeView === 'transact' && (
									<div className="max-w-2xl mx-auto">
										{/* Transaction Type Selector */}
										<div className="flex items-center justify-center gap-2 mb-6">
											{[
												{ id: 'deposit', label: 'Deposit' },
												{ id: 'withdraw', label: 'Withdraw' },
												{ id: 'internal', label: 'Internal Transfer' },
												{ id: 'external', label: 'External Transfer' }
											].map(type => (
												<button
													key={type.id}
													onClick={() => setTransactType(type.id as any)}
													className={cn(
														"rounded border px-4 py-2 text-xs font-medium transition-colors",
														transactType === type.id
															? "border-green-600 bg-green-600/20 text-green-400"
															: "border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a]"
													)}
												>
													{type.label}
												</button>
											))}
										</div>

										{/* Deposit */}
										{transactType === 'deposit' && (
											<div className="space-y-4">
												<h3 className="text-lg font-semibold text-white mb-4">Deposit Money</h3>
												<div>
													<label className="block text-xs text-[#888] mb-1">To Account:</label>
													<select
														value={selectedMoneyAccount?.name || ''}
														onChange={(e) => setSelectedMoneyAccount(accounts.find(a => a.name === e.target.value) || null)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													>
														<option value="">Select Account</option>
														{accounts.map(acc => (
															<option key={acc.name} value={acc.name}>{acc.name}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Amount:</label>
													<input
														type="number"
														value={selectedMoneyAmount || ''}
														onChange={(e) => setSelectedMoneyAmount(Number(e.target.value))}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Reason:</label>
													<input
														type="text"
														value={moneyReason}
														onChange={(e) => setMoneyReason(e.target.value)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<button
													onClick={depositMoney}
													className="w-full rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
												>
													Deposit
												</button>
											</div>
										)}

										{/* Withdraw */}
										{transactType === 'withdraw' && (
											<div className="space-y-4">
												<h3 className="text-lg font-semibold text-white mb-4">Withdraw Money</h3>
												<div>
													<label className="block text-xs text-[#888] mb-1">From Account:</label>
													<select
														value={selectedMoneyAccount?.name || ''}
														onChange={(e) => setSelectedMoneyAccount(accounts.find(a => a.name === e.target.value) || null)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													>
														<option value="">Select Account</option>
														{accounts.map(acc => (
															<option key={acc.name} value={acc.name}>{acc.name}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Amount:</label>
													<input
														type="number"
														value={selectedMoneyAmount || ''}
														onChange={(e) => setSelectedMoneyAmount(Number(e.target.value))}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Reason:</label>
													<input
														type="text"
														value={moneyReason}
														onChange={(e) => setMoneyReason(e.target.value)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<button
													onClick={withdrawMoney}
													className="w-full rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
												>
													Withdraw
												</button>
											</div>
										)}

										{/* Internal Transfer */}
										{transactType === 'internal' && (
											<div className="space-y-4">
												<h3 className="text-lg font-semibold text-white mb-4">Internal Transfer</h3>
												<div>
													<label className="block text-xs text-[#888] mb-1">From Account:</label>
													<select
														value={internalFromAccount?.name || ''}
														onChange={(e) => setInternalFromAccount(accounts.find(a => a.name === e.target.value) || null)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													>
														<option value="">Select Account</option>
														{accounts.map(acc => (
															<option key={acc.name} value={acc.name}>{acc.name}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">To Account:</label>
													<select
														value={internalToAccount?.name || ''}
														onChange={(e) => setInternalToAccount(accounts.find(a => a.name === e.target.value) || null)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													>
														<option value="">Select Account</option>
														{accounts.map(acc => (
															<option key={acc.name} value={acc.name}>{acc.name}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Amount:</label>
													<input
														type="number"
														value={internalTransferAmount || ''}
														onChange={(e) => setInternalTransferAmount(Number(e.target.value))}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Reason:</label>
													<input
														type="text"
														value={transferReason}
														onChange={(e) => setTransferReason(e.target.value)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<button
													onClick={internalTransfer}
													className="w-full rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
												>
													Transfer
												</button>
											</div>
										)}

										{/* External Transfer */}
										{transactType === 'external' && (
											<div className="space-y-4">
												<h3 className="text-lg font-semibold text-white mb-4">External Transfer</h3>
												<div>
													<label className="block text-xs text-[#888] mb-1">Recipient Account Number:</label>
													<input
														type="text"
														value={externalAccountNumber}
														onChange={(e) => setExternalAccountNumber(e.target.value)}
														placeholder="Enter Citizen ID"
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">From Account:</label>
													<select
														value={externalFromAccount?.name || ''}
														onChange={(e) => setExternalFromAccount(accounts.find(a => a.name === e.target.value) || null)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													>
														<option value="">Select Account</option>
														{accounts.map(acc => (
															<option key={acc.name} value={acc.name}>{acc.name}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Amount:</label>
													<input
														type="number"
														value={externalTransferAmount || ''}
														onChange={(e) => setExternalTransferAmount(Number(e.target.value))}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Reason:</label>
													<input
														type="text"
														value={transferReason}
														onChange={(e) => setTransferReason(e.target.value)}
														className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<button
													onClick={externalTransfer}
													className="w-full rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
												>
													Transfer
												</button>
											</div>
										)}
									</div>
								)}

								{/* Accounts View - Account Management */}
								{activeView === 'accounts' && (
									<div className="space-y-4">
										{/* Create New Account Section */}
										<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
											<h4 className="text-sm font-semibold text-white mb-4">Create New Shared Account</h4>
											<div className="grid grid-cols-3 gap-4">
												<div>
													<label className="block text-xs text-[#888] mb-1">Account Name:</label>
													<input
														type="text"
														value={createAccountName}
														onChange={(e) => setCreateAccountName(e.target.value)}
														placeholder="Enter account name"
														className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs text-[#888] mb-1">Initial Deposit:</label>
													<input
														type="number"
														value={createAccountAmount || ''}
														onChange={(e) => setCreateAccountAmount(Number(e.target.value))}
														placeholder="0"
														className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<div className="flex items-end">
													<button
														onClick={openAccount}
														className="w-full rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
													>
														Create Account
													</button>
												</div>
											</div>
										</div>

										{/* Existing Accounts List */}
										<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
											<h4 className="text-sm font-semibold text-white mb-4">Manage Shared Accounts</h4>
											
											{/* Account Selector */}
											<div className="mb-4">
												<label className="block text-xs text-[#888] mb-2">Select Account to Manage:</label>
												<select
													value={editAccount?.name || ''}
													onChange={(e) => {
														const acc = accounts.find(a => a.name === e.target.value)
														setEditAccount(acc || null)
														setEditAccountName(acc?.name || '')
														setManageAccountName(acc || null)
													}}
													className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
												>
													<option value="">Select an account...</option>
													{accounts.filter(a => a.type === 'shared').map(acc => (
														<option key={acc.name} value={acc.name}>
															{acc.name} - ${formatCurrency(acc.balance)}
														</option>
													))}
												</select>
											</div>

											{/* Account Management Options - Only show when account is selected */}
											{editAccount && (
												<div className="space-y-4 border-t border-[#2a2a2a] pt-4">
													{/* Account Info */}
													<div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
														<div className="flex items-center justify-between mb-2">
															<span className="text-xs text-[#888]">Account Name:</span>
															<span className="text-sm font-semibold text-white">{editAccount.name}</span>
														</div>
														<div className="flex items-center justify-between">
															<span className="text-xs text-[#888]">Balance:</span>
															<span className="text-sm font-semibold text-green-400">${formatCurrency(editAccount.balance)}</span>
														</div>
													</div>

													{/* Rename Account */}
													<div className="space-y-2">
														<label className="block text-xs font-semibold text-white">Rename Account</label>
														<div className="flex gap-2">
															<input
																type="text"
																value={editAccountName}
																onChange={(e) => setEditAccountName(e.target.value)}
																placeholder="Enter new name"
																className="flex-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
															/>
															<button
																onClick={renameAccount}
																className="rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
															>
																Rename
															</button>
														</div>
													</div>

													{/* Manage Users */}
													<div className="space-y-2">
														<label className="block text-xs font-semibold text-white">Manage Users</label>
														<div className="space-y-2">
															{/* Current Users List */}
															{editAccount.users && (() => {
																try {
																	const usersList = JSON.parse(editAccount.users)
																	return usersList.length > 0 ? (
																		<div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-2">
																			<div className="text-xs text-[#888] mb-1">Current Users:</div>
																			<div className="flex flex-wrap gap-1">
																				{usersList.map((user: string, idx: number) => (
																					<span key={idx} className="text-xs px-2 py-1 rounded bg-[#0f0f0f] text-white border border-[#2a2a2a]">
																						{user}
																					</span>
																				))}
																			</div>
																		</div>
																	) : null
																} catch {
																	return null
																}
															})()}
															
															{/* Add/Remove User */}
															<div className="relative">
																<input
																	type="text"
																	value={manageUserName}
																	onChange={(e) => setManageUserName(e.target.value)}
																	onFocus={() => setShowUsersDropdown(true)}
																	onBlur={() => setTimeout(() => setShowUsersDropdown(false), 200)}
																	placeholder="Enter Citizen ID to add/remove"
																	className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
																/>
																{showUsersDropdown && filteredUsers.length > 0 && (
																	<div className="absolute z-10 w-full mt-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] max-h-40 overflow-y-auto">
																		<ul>
																			{filteredUsers.map((user, idx) => (
																				<li
																					key={idx}
																					onClick={() => selectUser(user)}
																					className="px-3 py-2 text-sm text-white hover:bg-[#2a2a2a] cursor-pointer"
																				>
																					{user}
																				</li>
																			))}
																		</ul>
																	</div>
																)}
															</div>
															<div className="flex gap-2">
																<button
																	onClick={addUserToAccount}
																	className="flex-1 rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
																>
																	Add User
																</button>
																<button
																	onClick={removeUserFromAccount}
																	className="flex-1 rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
																>
																	Remove User
																</button>
															</div>
														</div>
													</div>

													{/* Delete Account */}
													<div className="space-y-2 border-t border-[#2a2a2a] pt-4">
														<label className="block text-xs font-semibold text-red-400">Danger Zone</label>
														<button
															onClick={deleteAccount}
															className="w-full rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
														>
															Delete Account
														</button>
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Analytics View */}
								{activeView === 'analytics' && (
									<div className="space-y-4">
										{/* Time Range Selector */}
										<div className="flex items-center justify-between mb-4">
											<h3 className="text-lg font-semibold text-white">Financial Analytics</h3>
											<div className="flex gap-2">
												{[
													{ id: '7d', label: '7 Days' },
													{ id: '30d', label: '30 Days' },
													{ id: '90d', label: '90 Days' },
													{ id: 'all', label: 'All Time' }
												].map(range => (
													<button
														key={range.id}
														onClick={() => setAnalyticsTimeRange(range.id as any)}
														className={cn(
															"rounded border px-3 py-1.5 text-xs font-medium transition-colors",
															analyticsTimeRange === range.id
																? "border-green-600 bg-green-600/20 text-green-400"
																: "border-[#2a2a2a] bg-[#0f0f0f] text-white hover:bg-[#2a2a2a]"
														)}
													>
														{range.label}
													</button>
												))}
											</div>
										</div>

										{/* Financial Summary Cards */}
										{(() => {
											const summary = getFinancialSummary()
											return (
												<div className="grid grid-cols-4 gap-4 mb-4">
													<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-3">
														<div className="text-xs text-[#888] mb-1">Total Income</div>
														<div className="text-lg font-bold text-green-400">${formatCurrency(summary.totalIncome)}</div>
													</div>
													<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-3">
														<div className="text-xs text-[#888] mb-1">Total Expenses</div>
														<div className="text-lg font-bold text-red-400">${formatCurrency(summary.totalExpenses)}</div>
													</div>
													<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-3">
														<div className="text-xs text-[#888] mb-1">Net Balance</div>
														<div className={cn(
															"text-lg font-bold",
															summary.net >= 0 ? "text-green-400" : "text-red-400"
														)}>
															${formatCurrency(summary.net)}
														</div>
													</div>
													<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-3">
														<div className="text-xs text-[#888] mb-1">Transactions</div>
														<div className="text-lg font-bold text-white">{summary.transactionCount}</div>
													</div>
												</div>
											)
										})()}

										{/* Charts Grid */}
										<div className="grid grid-cols-2 gap-4">
											{/* Spending Over Time - Line Chart */}
											<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
												<h4 className="text-sm font-semibold text-white mb-4">Spending Over Time</h4>
												<ResponsiveContainer width="100%" height={250}>
													<LineChart data={getSpendingOverTime()}>
														<CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
														<XAxis dataKey="date" stroke="#888" style={{ fontSize: '10px' }} />
														<YAxis stroke="#888" style={{ fontSize: '10px' }} />
														<Tooltip
															contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px' }}
															labelStyle={{ color: '#fff' }}
															itemStyle={{ color: '#fff' }}
														/>
														<Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
														<Line type="monotone" dataKey="deposits" stroke="#22c55e" strokeWidth={2} name="Deposits" />
														<Line type="monotone" dataKey="withdrawals" stroke="#ef4444" strokeWidth={2} name="Withdrawals" />
														<Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="Net" />
													</LineChart>
												</ResponsiveContainer>
											</div>

											{/* Income vs Expenses - Bar Chart */}
											<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
												<h4 className="text-sm font-semibold text-white mb-4">Income vs Expenses</h4>
												<ResponsiveContainer width="100%" height={250}>
													<BarChart data={getIncomeVsExpenses()}>
														<CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
														<XAxis dataKey="name" stroke="#888" style={{ fontSize: '10px' }} />
														<YAxis stroke="#888" style={{ fontSize: '10px' }} />
														<Tooltip
															contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px' }}
															labelStyle={{ color: '#fff' }}
															itemStyle={{ color: '#fff' }}
															formatter={(value: any) => `$${formatCurrency(value)}`}
														/>
														<Bar dataKey="value" fill="#888">
															{getIncomeVsExpenses().map((entry, index) => (
																<Cell key={`cell-${index}`} fill={entry.color} />
															))}
														</Bar>
													</BarChart>
												</ResponsiveContainer>
											</div>

											{/* Transaction Breakdown - Pie Chart */}
											<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
												<h4 className="text-sm font-semibold text-white mb-4">Transaction Breakdown</h4>
												<ResponsiveContainer width="100%" height={250}>
													<PieChart>
														<Pie
															data={getTransactionBreakdown()}
															cx="50%"
															cy="50%"
															labelLine={false}
															label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
															outerRadius={80}
															fill="#888"
															dataKey="value"
														>
															{getTransactionBreakdown().map((entry, index) => (
																<Cell key={`cell-${index}`} fill={entry.color} />
															))}
														</Pie>
														<Tooltip
															contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px' }}
															labelStyle={{ color: '#fff' }}
															itemStyle={{ color: '#fff' }}
															formatter={(value: any) => `$${formatCurrency(value)}`}
														/>
													</PieChart>
												</ResponsiveContainer>
											</div>

											{/* Monthly Summary - Area Chart */}
											<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
												<h4 className="text-sm font-semibold text-white mb-4">Monthly Summary</h4>
												<ResponsiveContainer width="100%" height={250}>
													<AreaChart data={getMonthlySummary()}>
														<CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
														<XAxis dataKey="month" stroke="#888" style={{ fontSize: '10px' }} />
														<YAxis stroke="#888" style={{ fontSize: '10px' }} />
														<Tooltip
															contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px' }}
															labelStyle={{ color: '#fff' }}
															itemStyle={{ color: '#fff' }}
															formatter={(value: any) => `$${formatCurrency(value)}`}
														/>
														<Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
														<Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Income" />
														<Area type="monotone" dataKey="expenses" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Expenses" />
													</AreaChart>
												</ResponsiveContainer>
											</div>
										</div>

										{/* Top Transactions Table */}
										<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
											<h4 className="text-sm font-semibold text-white mb-4">Top Transactions</h4>
											<div className="space-y-2">
												{getTopTransactions().map((stmt, idx) => (
													<div
														key={idx}
														className="flex items-center justify-between rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3"
													>
														<div className="flex-1">
															<div className="text-xs text-[#888]">{formatDate(stmt.date)}</div>
															<div className="text-sm text-white">{stmt.reason}</div>
															<div className="text-xs text-[#888]">{stmt.user}</div>
														</div>
														<div className={cn(
															"text-sm font-semibold",
															stmt.type === 'deposit' ? "text-green-400" : "text-red-400"
														)}>
															{stmt.type === 'deposit' ? '+' : '-'}${formatCurrency(stmt.amount)}
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								)}

								{/* Services View */}
								{activeView === 'services' && (
									<div className="max-w-md mx-auto">
										<div className="rounded border border-[#2a2a2a] bg-[#0f0f0f] p-4">
											<h4 className="text-sm font-semibold text-white mb-3">Order Debit Card</h4>
											<div className="space-y-3">
												<div>
													<label className="block text-xs text-[#888] mb-1">PIN Number:</label>
													<input
														type="number"
														value={debitPin}
														onChange={(e) => setDebitPin(e.target.value)}
														placeholder="Enter 4-digit PIN"
														maxLength={4}
														className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
													/>
												</div>
												<button
													onClick={orderDebitCard}
													className="w-full rounded border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors"
												>
													Order Card
												</button>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ATM View */}
			{isATMOpen && (
				<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-40">
					<div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl w-[50vw] h-[60vh] max-w-2xl flex">
						{/* Sidebar */}
						<div className="w-64 flex-shrink-0 flex flex-col justify-between bg-[#0f0f0f] border-r border-[#2a2a2a] rounded-l-md">
							<div className="p-4">
								<div className="mb-4 rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
									<div className="text-sm font-semibold text-white mb-1">{playerName}</div>
									<div className="text-xs text-[#888]">
										Cash: <span className="text-green-400">${formatCurrency(playerCash)}</span>
									</div>
								</div>
								<div className="flex-1 overflow-y-auto">
									<ul className="space-y-2">
										{accounts.map(account => (
											<li
												key={account.name}
												className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3"
											>
												<div className="text-xs font-medium text-white">{account.name}</div>
												<div className="text-xs text-green-400">${formatCurrency(account.balance)}</div>
											</li>
										))}
									</ul>
								</div>
							</div>
							<div className="p-4 space-y-2">
								<button
									onClick={closeApplication}
									className="w-full rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
								>
									Logout
								</button>
								<div className="text-xs text-[#888] text-center">
									Account Number: {accountNumber}
								</div>
							</div>
						</div>

						{/* Main Content */}
						<div className="flex-1 flex flex-col p-4">
							<h3 className="text-lg font-semibold text-white mb-4">Withdraw</h3>
							<div className="space-y-4">
								<div>
									<label className="block text-xs text-[#888] mb-1">Account:</label>
									<select
										value={selectedMoneyAccount?.name || ''}
										onChange={(e) => setSelectedMoneyAccount(accounts.find(a => a.name === e.target.value) || null)}
										className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
									>
										<option value="">Select Account</option>
										{accounts.map(acc => (
											<option key={acc.name} value={acc.name}>{acc.name}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-[#888] mb-1">Amount:</label>
									<input
										type="number"
										value={selectedMoneyAmount || ''}
										onChange={(e) => setSelectedMoneyAmount(Number(e.target.value))}
										className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
									/>
								</div>
								<div>
									<label className="block text-xs text-[#888] mb-1">Reason:</label>
									<input
										type="text"
										value={moneyReason}
										onChange={(e) => setMoneyReason(e.target.value)}
										className="w-full rounded border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-[#4a4a4a] focus:outline-none"
									/>
								</div>
								<button
									onClick={withdrawMoney}
									className="w-full rounded border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-red-600/30 transition-colors"
								>
									Withdraw
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

