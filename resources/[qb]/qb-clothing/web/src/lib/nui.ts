export function getResourceName(): string {
	try {
		// @ts-ignore
		return GetParentResourceName?.() ?? 'qb-clothing'
	} catch {
		return 'qb-clothing'
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
		if (!res.ok) {
			console.error(`NUI callback ${eventName} failed:`, res.status, res.statusText)
			return
		}
		const text = await res.text()
		if (!text) return
		try {
			return JSON.parse(text) as T
		} catch {
			return text as T
		}
	} catch (error) {
		console.error(`NUI callback ${eventName} error:`, error)
		return
	}
}

export type NuiMessage<T = any> = MessageEvent & { data: T & { action?: string } }

