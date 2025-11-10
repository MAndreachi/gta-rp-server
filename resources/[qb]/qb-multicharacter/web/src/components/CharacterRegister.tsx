import * as React from 'react'
import { cn } from '../lib/utils'

interface CharacterRegisterProps {
	registerData: {
		date: string
		firstname: string
		lastname: string
		nationality: string
		gender: string
	}
	setRegisterData: React.Dispatch<React.SetStateAction<{
		date: string
		firstname: string
		lastname: string
		nationality: string
		gender: string
	}>>
	customNationality: boolean
	nationalities: string[]
	datePickerOpen: boolean
	setDatePickerOpen: (open: boolean) => void
	onCancel: () => void
	onCreate: () => void
	translate: (key: string) => string
}

export default function CharacterRegister({
	registerData,
	setRegisterData,
	customNationality,
	nationalities,
	datePickerOpen,
	setDatePickerOpen,
	onCancel,
	onCreate,
	translate,
}: CharacterRegisterProps) {
	return (
		<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-[200]">
			<div className="absolute inset-0 bg-black/60" onClick={onCancel} />
			<div className="relative w-[400px] p-6 bg-background border border-border rounded-lg shadow-xl z-[201]">
				<div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
					<p className="text-sm font-semibold text-foreground uppercase tracking-wide">
						{translate('chardel_header')}
					</p>
					<button
						onClick={onCancel}
						className="w-7 h-7 flex items-center justify-center rounded border border-border bg-secondary hover:bg-muted hover:border-[#3a3a3a] transition-all text-[#888] hover:text-foreground"
					>
						<span className="material-symbols-outlined text-lg">close</span>
					</button>
				</div>

				<div className="flex flex-col gap-3 mb-5">
					<input
						type="text"
						placeholder={translate('firstname')}
						value={registerData.firstname}
						onChange={(e) => setRegisterData(prev => ({ ...prev, firstname: e.target.value }))}
						className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground placeholder:text-[#888] focus:outline-none focus:border-[#4a4a4a] text-sm"
					/>
					<input
						type="text"
						placeholder={translate('lastname')}
						value={registerData.lastname}
						onChange={(e) => setRegisterData(prev => ({ ...prev, lastname: e.target.value }))}
						className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground placeholder:text-[#888] focus:outline-none focus:border-[#4a4a4a] text-sm"
					/>
					{customNationality ? (
						<input
							type="text"
							placeholder={translate('nationality')}
							value={registerData.nationality}
							onChange={(e) => setRegisterData(prev => ({ ...prev, nationality: e.target.value }))}
							className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground placeholder:text-[#888] focus:outline-none focus:border-[#4a4a4a] text-sm"
						/>
					) : (
						<select
							value={registerData.nationality}
							onChange={(e) => setRegisterData(prev => ({ ...prev, nationality: e.target.value }))}
							className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground focus:outline-none focus:border-[#4a4a4a] text-sm"
						>
							<option value="">{translate('nationality')}</option>
							{nationalities.map((nat) => (
								<option key={nat} value={nat}>{nat}</option>
							))}
						</select>
					)}
					<select
						value={registerData.gender}
						onChange={(e) => setRegisterData(prev => ({ ...prev, gender: e.target.value }))}
						className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground focus:outline-none focus:border-[#4a4a4a] text-sm"
					>
						<option value="">{translate('gender')}</option>
						<option value={translate('male')}>{translate('male')}</option>
						<option value={translate('female')}>{translate('female')}</option>
					</select>
					<input
						type="date"
						value={registerData.date}
						onChange={(e) => setRegisterData(prev => ({ ...prev, date: e.target.value }))}
						min="1900-01-01"
						max="2100-12-31"
						className="w-full px-3 py-2 rounded border border-border bg-secondary text-foreground focus:outline-none focus:border-[#4a4a4a] text-sm"
					/>
				</div>

				<button
					onClick={onCreate}
					className={cn(
						'w-full py-3 text-xs font-medium text-foreground rounded border transition-all',
						'uppercase tracking-wide',
						'bg-success/20 border-success/50',
						'hover:bg-success/30 hover:border-success shadow-lg'
					)}
				>
					{translate('create_button')}
				</button>
			</div>
		</div>
	)
}

