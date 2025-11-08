import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Laptop, Moon, Sun } from 'lucide-react'
import { cn } from './lib/utils'
import { nuiSend, type NuiMessage } from './lib/nui'

export default function App() {
	const [open, setOpen] = React.useState(false)
	const [visible, setVisible] = React.useState(false)
	const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('dark')

	React.useEffect(() => {
		const handler = (e: MessageEvent) => {
			const msg = e as NuiMessage<{ action?: string }>;
			if (msg.data?.action === 'open') {
				setVisible(true)
				setOpen(true)
			}
			if (msg.data?.action === 'hide') {
				setOpen(false)
				setVisible(false)
			}
		}
		window.addEventListener('message', handler)
		return () => window.removeEventListener('message', handler)
	}, [])

	React.useEffect(() => {
		if (theme === 'dark') document.documentElement.classList.add('dark')
		else document.documentElement.classList.remove('dark')
	}, [theme])

	React.useEffect(() => {
		document.documentElement.classList.toggle('nui-visible', visible)
	}, [visible])

	async function closeUI() {
		setOpen(false)
		await nuiSend('close', {})
		setVisible(false)
	}

	if (!visible) return null

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
							<Laptop className="h-5 w-5" />
						</div>
						<div>
							<h1 className="text-lg font-semibold leading-tight">UI Template</h1>
							<p className="text-xs text-muted-foreground">React + Tailwind + Radix</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button className={cn('btn btn-outline btn-sm')} onClick={() => setTheme('light')}>
							<Sun className="h-4 w-4 mr-1" /> Light
						</button>
						<button className={cn('btn btn-outline btn-sm')} onClick={() => setTheme('dark')}>
							<Moon className="h-4 w-4 mr-1" /> Dark
						</button>
						<button className={cn('btn btn-outline btn-sm')} onClick={() => setTheme('system')}>
							<Laptop className="h-4 w-4 mr-1" /> System
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 py-10">
				<div className="grid gap-6 sm:grid-cols-2">
					<section className="rounded-lg border border-border bg-card p-6">
						<h2 className="text-base font-semibold mb-2">Quick demo</h2>
						<p className="text-sm text-muted-foreground mb-4">
							Use the command <code>/open_ui</code> in-game or click the button below.
						</p>
						<div className="flex gap-3">
							<button className="btn btn-primary btn-md" onClick={() => setOpen(true)}>
								Open modal
							</button>
							<button className="btn btn-secondary btn-md" onClick={closeUI}>
								Close UI (send NUI callback)
							</button>
						</div>
					</section>
					<section className="rounded-lg border border-border bg-card p-6">
						<h2 className="text-base font-semibold mb-2">How to use</h2>
						<ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
							<li>Style with Tailwind classes and tokens (see <code>src/index.css</code>).</li>
							<li>Listen for messages with <code>window.addEventListener('message')</code>.</li>
							<li>Call back to client Lua with <code>nuiSend('event')</code>.</li>
						</ul>
					</section>
				</div>
			</main>

			<Dialog.Root open={open} onOpenChange={setOpen}>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 bg-black/60" />
					<Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl focus:outline-none">
						<div className="flex items-start justify-between gap-4">
							<div>
								<Dialog.Title className="text-base font-semibold">Hello from the Template</Dialog.Title>
								<Dialog.Description className="text-sm text-muted-foreground mt-1">
									This is a Radix Dialog styled with Tailwind.
								</Dialog.Description>
							</div>
							<button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close">
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="mt-6 space-y-4">
							<p className="text-sm">
								You can open this UI with <code>/open_ui</code> and close it by clicking the button below or pressing escape.
							</p>
						</div>
						<div className="mt-6 flex justify-end gap-2">
							<button className="btn btn-outline btn-md" onClick={() => setOpen(false)}>Cancel</button>
							<button className="btn btn-primary btn-md" onClick={closeUI}>Close and send callback</button>
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	)
}


