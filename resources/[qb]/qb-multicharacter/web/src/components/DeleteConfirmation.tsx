import * as React from 'react'
import { cn } from '../lib/utils'

interface DeleteConfirmationProps {
	onConfirm: () => void
	onCancel: () => void
	translate: (key: string) => string
}

export default function DeleteConfirmation({ onConfirm, onCancel, translate }: DeleteConfirmationProps) {
	return (
		<div className="fixed inset-0 pointer-events-auto flex items-center justify-center z-[200]">
			<div className="absolute inset-0 bg-black/60" onClick={onCancel} />
			<div className="relative w-[300px] p-5 bg-background border border-border rounded-lg shadow-xl z-[201]">
				<p className="text-sm text-foreground text-center mb-5 leading-relaxed">
					{translate('deletechar_description')}
				</p>
				<div className="flex justify-around gap-2.5">
					<button
						onClick={onConfirm}
						className={cn(
							'px-5 py-2.5 text-xs font-medium cursor-pointer rounded border transition-all',
							'uppercase tracking-wide',
							'bg-success/20 border-success/50 text-success',
							'hover:bg-success/30 hover:border-success shadow-lg'
						)}
					>
						{translate('confirm')}
					</button>
					<button
						onClick={onCancel}
						className={cn(
							'px-5 py-2.5 text-xs font-medium cursor-pointer rounded border transition-all',
							'uppercase tracking-wide',
							'bg-error/20 border-error/50 text-error',
							'hover:bg-error/30 hover:border-error shadow-lg'
						)}
					>
						{translate('cancel')}
					</button>
				</div>
			</div>
		</div>
	)
}

