export function getResourceName(): string {
	try {
		// @ts-ignore - provided by FiveM NUI runtime
		return GetParentResourceName?.() ?? 'ui-template'
	} catch {
		return 'ui-template'
	}
}

export async function nuiSend<T = unknown>(eventName: string, data?: unknown): Promise<T | void> {
	const resource = getResourceName()
	const endpoint = `https://${resource}/${eventName}`
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(data ?? {})
		})
		if (!res.ok) return
		return (await res.json()) as T
	} catch {
		// likely running in browser preview
		return
	}
}

export type NuiMessage<T = any> = MessageEvent & { data: T & { action?: string } }


