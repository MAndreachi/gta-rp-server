import * as React from 'react'
import { nuiSend, type NuiMessage } from './lib/nui'

type Job = {
	label: string
	isManaged?: boolean
	fullData?: {
		label: string
		defaultDuty: boolean
		offDutyPay: boolean
		grades: Record<string, {
			name: string
			payment: number
			isboss?: boolean
		}>
		type?: string
	}
}

type JobsData = Record<string, Job>

type License = {
	label: string
	cost: number
	metadata?: string
}

type LicensesData = Record<string, License>

type View = 'main' | 'jobs' | 'identity' | null

export default function App() {
	const [visible, setVisible] = React.useState(false)
	const [currentView, setCurrentView] = React.useState<View>(null)
	const [jobs, setJobs] = React.useState<JobsData>({})
	const [licenses, setLicenses] = React.useState<LicensesData>({})
	const [selectedJob, setSelectedJob] = React.useState<{ jobName: string; job: Job } | null>(null)

	React.useEffect(() => {
		function onMessage(e: MessageEvent) {
			const msg = e as NuiMessage<any>
			switch (msg.data?.action) {
				case 'openMainMenu':
					setCurrentView('main')
					setVisible(true)
					break
				case 'openJobMenu':
					setJobs(msg.data.jobs || {})
					setCurrentView('jobs')
					setVisible(true)
					break
				case 'openIdentityMenu':
					setLicenses(msg.data.licenses || {})
					setCurrentView('identity')
					setVisible(true)
					break
				case 'close':
					setVisible(false)
					setCurrentView(null)
					setJobs({})
					setLicenses({})
					setSelectedJob(null)
					break
			}
		}

		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	const handleApplyJob = async (jobName: string) => {
		setVisible(false)
		setCurrentView(null)
		await nuiSend('applyJob', { job: jobName })
		await nuiSend('close')
	}

	const handleClose = async () => {
		await nuiSend('close')
		setVisible(false)
		setCurrentView(null)
		setSelectedJob(null)
	}

	const handleRequestId = async (licenseType: string, cost: number) => {
		await nuiSend('requestId', { type: licenseType, cost })
		handleClose()
	}

	const handleOpenJobMenu = async () => {
		await nuiSend('openJobMenu')
	}

	const handleOpenIdentityMenu = async () => {
		await nuiSend('openIdentityMenu')
	}

	// Handle ESC key
	React.useEffect(() => {
		if (!visible) return

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				handleClose()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [visible])

	if (!visible) return null

	// Show detailed job view if one is selected
	if (selectedJob) {
		return (
			<JobDetailView
				jobName={selectedJob.jobName}
				job={selectedJob.job}
				onBack={() => setSelectedJob(null)}
				onApply={() => handleApplyJob(selectedJob.jobName)}
			/>
		)
	}

	// Show main menu
	if (currentView === 'main') {
		return (
			<MainMenuView
				onOpenJobs={handleOpenJobMenu}
				onOpenIdentity={handleOpenIdentityMenu}
				onClose={handleClose}
			/>
		)
	}

	// Show identity menu
	if (currentView === 'identity') {
		return (
			<IdentityMenuView
				licenses={licenses}
				onRequestId={handleRequestId}
				onBack={handleClose}
			/>
		)
	}

	// Show job list
	const jobEntries = Object.entries(jobs)
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
			<div className="relative w-full max-w-4xl mx-4 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg pointer-events-auto">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#0f0f0f]">
					<h2 className="text-lg font-semibold text-white">Job Center</h2>
					<button
						onClick={handleClose}
						className="text-[#666] hover:text-white transition-colors cursor-pointer"
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4">
					{jobEntries.length === 0 ? (
						<div className="text-center py-12 text-[#666]">
							<p className="text-sm">No jobs available at this time.</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{jobEntries.map(([jobName, jobData]) => (
								<JobCard
									key={jobName}
									jobName={jobName}
									job={jobData}
									onApply={() => handleApplyJob(jobName)}
									onMoreInfo={() => setSelectedJob({ jobName, job: jobData })}
								/>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<button
						onClick={handleClose}
						className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	)
}

type JobCardProps = {
	jobName: string
	job: Job
	onApply: () => void
	onMoreInfo: () => void
}

function JobCard({ jobName, job, onApply, onMoreInfo }: JobCardProps) {
	const getJobThumbnail = (jobName: string) => {
		// Placeholder thumbnail colors for each job type
		const jobColors: Record<string, string> = {
			bus: '#3b82f6',      // Blue
			taxi: '#fbbf24',      // Yellow
			tow: '#6b7280',       // Gray
			reporter: '#ef4444',  // Red
			garbage: '#10b981',   // Green
			hotdog: '#f97316',    // Orange
			trucker: '#8b5cf6',   // Purple
			vineyard: '#84cc16',  // Lime
			recycle: '#06b6d4',   // Cyan
		}

		const color = jobColors[jobName.toLowerCase()] || '#6b7280'
		
		return (
			<div 
				className="w-16 h-16 rounded-md border border-[#2a2a2a] flex items-center justify-center"
				style={{ backgroundColor: color }}
			>
				<span className="text-xs font-semibold text-white uppercase">
					{jobName.substring(0, 3)}
				</span>
			</div>
		)
	}

	return (
		<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4 hover:border-[#4a4a4a] transition-all duration-200 group">
			<div className="flex flex-col items-start gap-3">
				<div className="flex items-center gap-3 w-full">
					{getJobThumbnail(jobName)}
					<div className="flex-1">
						<h3 className="text-sm font-semibold text-white">{job.label}</h3>
						{job.isManaged && (
							<span className="text-xs text-[#666]">Managed Position</span>
						)}
					</div>
				</div>
				<div className="flex gap-2 w-full mt-2">
					<button
						className="flex-1 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
						onClick={(e) => {
							e.stopPropagation()
							onMoreInfo()
						}}
					>
						More Info
					</button>
					<button
						className="flex-1 rounded-md border border-green-600 bg-green-600/20 px-3 py-2 text-xs font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
						onClick={(e) => {
							e.stopPropagation()
							onApply()
						}}
					>
						Apply Now
					</button>
				</div>
			</div>
		</div>
	)
}

type JobDetailViewProps = {
	jobName: string
	job: Job
	onBack: () => void
	onApply: () => void
}

function JobDetailView({ jobName, job, onBack, onApply }: JobDetailViewProps) {
	const getJobThumbnail = (jobName: string) => {
		const jobColors: Record<string, string> = {
			bus: '#3b82f6',
			taxi: '#fbbf24',
			tow: '#6b7280',
			reporter: '#ef4444',
			garbage: '#10b981',
			hotdog: '#f97316',
			trucker: '#8b5cf6',
			vineyard: '#84cc16',
			recycle: '#06b6d4',
		}
		const color = jobColors[jobName.toLowerCase()] || '#6b7280'
		return (
			<div 
				className="w-24 h-24 rounded-md border border-[#2a2a2a] flex items-center justify-center"
				style={{ backgroundColor: color }}
			>
				<span className="text-sm font-semibold text-white uppercase">
					{jobName.substring(0, 3)}
				</span>
			</div>
		)
	}

	const getJobDescription = (jobName: string): string => {
		const descriptions: Record<string, string> = {
			bus: 'Drive passengers around the city on scheduled bus routes. Pick up NPCs at designated stops and transport them to their destinations. Earn money for each completed route.',
			taxi: 'Provide taxi services to citizens around Los Santos. Pick up passengers and drive them to their requested locations. Use the taxi meter to calculate fares.',
			tow: 'Help citizens by towing their vehicles to the impound lot or repair shop. Respond to calls for vehicle recovery and earn money for each tow completed.',
			reporter: 'Work as a news journalist covering events around the city. Use camera equipment to document stories and report on breaking news.',
			garbage: 'Collect garbage from designated locations around the city. Drive the garbage truck and empty bins to keep the city clean. Earn money for each route completed.',
			hotdog: 'Sell hot dogs from a food stand at various locations around the city. Serve customers and earn money from sales.',
			trucker: 'Transport goods and cargo across the city using large trucks. Complete delivery routes and earn money for each successful delivery.',
			vineyard: 'Work at the vineyard picking grapes and maintaining the fields. Help with the harvest and earn money for your work.',
			recycle: 'Work at the recycling plant processing materials. Sort and process recyclable items to earn money.',
		}
		return descriptions[jobName.toLowerCase()] || 'Work as a dedicated employee in this position. Complete your assigned tasks to earn money.'
	}

	const fullData = job.fullData
	const entryGrade = fullData?.grades ? Object.values(fullData.grades)[0] : null
	const payment = entryGrade?.payment || 50

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
			<div className="relative w-full max-w-2xl mx-4 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg pointer-events-auto">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#0f0f0f]">
					<div className="flex items-center gap-3">
						<button
							onClick={onBack}
							className="text-[#666] hover:text-white transition-colors cursor-pointer"
							aria-label="Back"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<h2 className="text-lg font-semibold text-white">{job.label}</h2>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6">
					<div className="flex flex-col gap-6">
						{/* Thumbnail and Basic Info */}
						<div className="flex items-start gap-4">
							{getJobThumbnail(jobName)}
							<div className="flex-1">
								<h3 className="text-xl font-semibold text-white mb-2">{job.label}</h3>
								{job.isManaged && (
									<span className="text-xs text-[#666] bg-[#1a1a1a] px-2 py-1 rounded border border-[#2a2a2a] inline-block mb-2">
										Managed Position
									</span>
								)}
								{fullData?.type && (
									<span className="text-xs text-[#666] bg-[#1a1a1a] px-2 py-1 rounded border border-[#2a2a2a] inline-block ml-2">
										{fullData.type.toUpperCase()}
									</span>
								)}
							</div>
						</div>

						{/* Description */}
						<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
							<h4 className="text-sm font-semibold text-white mb-2">Job Description</h4>
							<p className="text-sm text-[#888] leading-relaxed">
								{getJobDescription(jobName)}
							</p>
						</div>

						{/* Payment Info */}
						<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
							<h4 className="text-sm font-semibold text-white mb-3">Payment Information</h4>
							<div className="space-y-2">
								{entryGrade && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-[#888]">Starting Position:</span>
										<span className="text-sm font-medium text-white">{entryGrade.name}</span>
									</div>
								)}
								<div className="flex items-center justify-between">
									<span className="text-sm text-[#888]">Starting Pay:</span>
									<span className="text-sm font-medium text-green-400">${payment}/hour</span>
								</div>
								{fullData?.grades && Object.keys(fullData.grades).length > 1 && (
									<div className="mt-3 pt-3 border-t border-[#2a2a2a]">
										<p className="text-xs text-[#666] mb-2">Career Progression Available</p>
										<div className="space-y-1">
											{Object.entries(fullData.grades).map(([grade, gradeData]) => (
												<div key={grade} className="flex items-center justify-between text-xs">
													<span className="text-[#888]">{gradeData.name}:</span>
													<span className="text-green-400">${gradeData.payment}/hour</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Requirements */}
						<div className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4">
							<h4 className="text-sm font-semibold text-white mb-2">Requirements</h4>
							<ul className="text-sm text-[#888] space-y-1 list-disc list-inside">
								<li>Valid ID Card</li>
								<li>No criminal record (for some positions)</li>
								<li>Ability to follow instructions</li>
							</ul>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<button
						onClick={onBack}
						className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
					>
						Back
					</button>
					<button
						onClick={onApply}
						className="rounded-md border border-green-600 bg-green-600/20 px-4 py-2 text-sm font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
					>
						Apply Now
					</button>
				</div>
			</div>
		</div>
	)
}

type MainMenuViewProps = {
	onOpenJobs: () => void
	onOpenIdentity: () => void
	onClose: () => void
}

function MainMenuView({ onOpenJobs, onOpenIdentity, onClose }: MainMenuViewProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
			<div className="relative w-full max-w-md mx-4 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg pointer-events-auto">
				<div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#0f0f0f]">
					<h2 className="text-lg font-semibold text-white">City Services</h2>
					<button
						onClick={onClose}
						className="text-[#666] hover:text-white transition-colors cursor-pointer"
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div className="p-6">
					<div className="space-y-3">
						<button
							onClick={onOpenJobs}
							className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4 hover:border-[#4a4a4a] transition-all duration-200 cursor-pointer group"
						>
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
									<span className="text-xl">💼</span>
								</div>
								<div className="flex-1 text-left">
									<h3 className="text-sm font-semibold text-white">Job Center</h3>
									<p className="text-xs text-[#666] mt-1">Browse and apply for available jobs</p>
								</div>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 text-[#666] group-hover:text-white transition-colors"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</div>
						</button>

						<button
							onClick={onOpenIdentity}
							className="w-full rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4 hover:border-[#4a4a4a] transition-all duration-200 cursor-pointer group"
						>
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
									<span className="text-xl">🪪</span>
								</div>
								<div className="flex-1 text-left">
									<h3 className="text-sm font-semibold text-white">ID & Licenses</h3>
									<p className="text-xs text-[#666] mt-1">Get your ID card and driver's license</p>
								</div>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-5 w-5 text-[#666] group-hover:text-white transition-colors"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
								</svg>
							</div>
						</button>
					</div>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<button
						onClick={onClose}
						className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	)
}

type IdentityMenuViewProps = {
	licenses: LicensesData
	onRequestId: (licenseType: string, cost: number) => void
	onBack: () => void
}

function IdentityMenuView({ licenses, onRequestId, onBack }: IdentityMenuViewProps) {
	const licenseEntries = Object.entries(licenses)

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
			<div className="relative w-full max-w-2xl mx-4 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg pointer-events-auto">
				<div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#0f0f0f]">
					<div className="flex items-center gap-3">
						<button
							onClick={onBack}
							className="text-[#666] hover:text-white transition-colors cursor-pointer"
							aria-label="Back"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<h2 className="text-lg font-semibold text-white">ID & Licenses</h2>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-6">
					{licenseEntries.length === 0 ? (
						<div className="text-center py-12 text-[#666]">
							<p className="text-sm">No licenses available at this time.</p>
						</div>
					) : (
						<div className="space-y-3">
							{licenseEntries.map(([licenseType, licenseData]) => (
								<div
									key={licenseType}
									className="rounded-md border border-[#2a2a2a] bg-[#0f0f0f] p-4 hover:border-[#4a4a4a] transition-all duration-200"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
												{licenseType === 'id_card' ? (
													<span className="text-xl">🪪</span>
												) : licenseType === 'driver_license' ? (
													<span className="text-xl">🚗</span>
												) : (
													<span className="text-xl">📄</span>
												)}
											</div>
											<div>
												<h3 className="text-sm font-semibold text-white">{licenseData.label}</h3>
												<p className="text-xs text-[#666] mt-1">Cost: ${licenseData.cost}</p>
											</div>
										</div>
										<button
											onClick={() => onRequestId(licenseType, licenseData.cost)}
											className="rounded-md border border-green-600 bg-green-600/20 px-4 py-2 text-xs font-medium text-white hover:bg-green-600/30 transition-colors cursor-pointer"
										>
											Purchase
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">
					<button
						onClick={onBack}
						className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
					>
						Back
					</button>
				</div>
			</div>
		</div>
	)
}
