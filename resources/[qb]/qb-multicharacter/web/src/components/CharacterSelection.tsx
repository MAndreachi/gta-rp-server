import * as React from 'react'
import { cn } from '../lib/utils'

interface Character {
	citizenid: string
	charinfo: {
		firstname: string
		lastname: string
	}
	job: {
		label: string
	}
	money: {
		cash: number
		bank: number
	}
	cid: number
}

type CharacterMap = Record<number, Character | undefined>

interface CharacterSelectionProps {
	characters: CharacterMap
	characterAmount: number
	selectedCharacter: number
	allowDelete: boolean
	dollar: Intl.NumberFormat
	onCharacterClick: (idx: number, type: 'existing' | 'empty') => void
	onPlayCharacter: () => void
	onPrepareDelete: () => void
	translate: (key: string) => string
}

export default function CharacterSelection({
	characters,
	characterAmount,
	selectedCharacter,
	allowDelete,
	dollar,
	onCharacterClick,
	onPlayCharacter,
	onPrepareDelete,
	translate,
}: CharacterSelectionProps) {
	const getSlotsArray = (total: number): number[] => {
		return Array.from({ length: total }, (_, i) => i + 1)
	}

	return (
		<div className="fixed bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto flex gap-1.5 z-[100]">
			{getSlotsArray(characterAmount).map((index) => {
				const character = characters[index]
				const isSelected = selectedCharacter === index

				return (
					<div
						key={index}
						className={cn(
							'relative w-[18vw] max-w-[200px] min-w-[150px] aspect-square',
							'bg-background border rounded-lg cursor-pointer transition-all',
							'flex flex-col overflow-hidden shadow-lg',
							isSelected
								? 'bg-muted border-[#4a4a4a] border-2 -translate-y-0.5 shadow-xl'
								: 'border-border hover:-translate-y-0.5 hover:border-[#3a3a3a] hover:shadow-xl'
						)}
						onClick={() => onCharacterClick(index, character ? 'existing' : 'empty')}
					>
						{character ? (
							<>
								{/* Action buttons - only show when selected */}
								{isSelected && (
									<div className="flex justify-between p-2 pt-2 h-fit opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation()
												onPlayCharacter()
											}}
											className="w-8 h-8 flex items-center justify-center rounded border border-success/30 bg-success/10 hover:bg-success/20 hover:border-success/50 transition-all"
											title="Play Character"
										>
											<span className="material-symbols-outlined text-success text-lg">play_circle</span>
										</button>
										{allowDelete && (
											<button
												onClick={(e) => {
													e.stopPropagation()
													onPrepareDelete()
												}}
												className="w-8 h-8 flex items-center justify-center rounded border border-error/30 bg-error/10 hover:bg-error/20 hover:border-error/50 transition-all"
												title="Delete Character"
											>
												<span className="material-symbols-outlined text-error text-lg">delete</span>
											</button>
										)}
									</div>
								)}

								{/* Character stats */}
								<div className="flex-1 flex flex-col justify-center items-center gap-2 p-2">
									<div className="flex items-center gap-2 w-[85%] px-2 py-1 rounded bg-secondary border border-border">
										<span className="material-symbols-outlined text-[#888] text-base w-5 text-center">badge</span>
										<span className="text-xs font-medium text-foreground truncate flex-1">{character.job.label}</span>
									</div>
									<div className="flex items-center gap-2 w-[85%] px-2 py-1 rounded bg-secondary border border-border">
										<span className="material-symbols-outlined text-[#888] text-base w-5 text-center">payments</span>
										<span className="text-xs font-medium text-foreground truncate flex-1">${dollar.format(character.money.cash)}</span>
									</div>
									<div className="flex items-center gap-2 w-[85%] px-2 py-1 rounded bg-secondary border border-border">
										<span className="material-symbols-outlined text-[#888] text-base w-5 text-center">wallet</span>
										<span className="text-xs font-medium text-foreground truncate flex-1">${dollar.format(character.money.bank)}</span>
									</div>
								</div>

								{/* Character name */}
								<div className="h-10 w-full flex justify-center items-center p-2 border-t border-border bg-secondary">
									<div className="text-xs font-semibold text-foreground text-center uppercase tracking-wide break-words">
										{character.charinfo.firstname} {character.charinfo.lastname}
									</div>
								</div>
							</>
						) : (
							<div
								className="text-4xl text-[#888] flex justify-center items-center h-full opacity-40 hover:opacity-60 transition-opacity"
								style={{
									backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(42, 42, 42, 0.08) 25%, rgba(42, 42, 42, 0.08) 50%, transparent 50%, transparent 75%, rgba(42, 42, 42, 0.08) 75%, rgba(42, 42, 42, 0.08))',
									backgroundSize: '8px 8px'
								}}
							>
								+
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}

