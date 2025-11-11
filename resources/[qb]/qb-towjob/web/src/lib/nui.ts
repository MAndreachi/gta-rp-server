export function getResourceName(): string {
	try {
		// @ts-ignore
		return GetParentResourceName?.() ?? 'qb-towjob'
	} catch {
		return 'qb-towjob'
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
		return
	}
}

export type NuiMessage<T = any> = MessageEvent & { data: T & { action?: string } }

