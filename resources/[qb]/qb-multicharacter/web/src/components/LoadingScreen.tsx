import * as React from 'react'

interface LoadingScreenProps {
	loadingText: string
}

export default function LoadingScreen({ loadingText }: LoadingScreenProps) {
	return (
		<div className="fixed inset-0 pointer-events-auto flex items-center justify-center bg-black/20">
			<div className="flex flex-col items-center">
				<div className="relative inline-block w-20 h-20">
					<div className="absolute top-0 left-0 w-16 h-16 border-4 border-border rounded-full border-t-success animate-spin box-border" style={{ animationDelay: '-0.45s' }} />
					<div className="absolute top-0 left-0 w-16 h-16 border-4 border-border rounded-full border-t-transparent animate-spin box-border" style={{ animationDelay: '-0.3s' }} />
					<div className="absolute top-0 left-0 w-16 h-16 border-4 border-border rounded-full border-t-transparent animate-spin box-border" style={{ animationDelay: '-0.15s' }} />
					<div className="absolute top-0 left-0 w-16 h-16 border-4 border-border rounded-full border-t-transparent animate-spin box-border" />
				</div>
				<p className="mt-5 text-sm font-medium text-foreground text-center tracking-wide">
					{loadingText}
				</p>
			</div>
		</div>
	)
}

