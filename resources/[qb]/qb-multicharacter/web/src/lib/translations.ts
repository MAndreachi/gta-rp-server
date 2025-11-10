export interface Translations {
	[key: string]: string
}

const fallbacks: Translations = {
	deletechar_description: "Are you sure you want to delete this character?",
	confirm: "Confirm",
	cancel: "Cancel",
	chardel_header: "Character Registration",
	firstname: "First Name",
	lastname: "Last Name",
	nationality: "Nationality",
	birthdate: "Date of Birth",
	gender: "Gender",
	male: "Male",
	female: "Female",
	create_button: "Create Character",
	retrieving_playerdata: "Retrieving player data...",
	validating_playerdata: "Validating player data...",
	retrieving_characters: "Retrieving characters...",
	validating_characters: "Validating characters...",
	ran_into_issue: "We ran into an issue!",
	profanity: "Your inputs contain profanity. Please try again.",
	forgotten_field: "You forgot to fill in a field!",
	connection_error: "Connection error. Please try again.",
	delete_failed: "Failed to delete character. Please try again.",
	selection_failed: "Failed to select character. Please try again.",
	creation_failed: "Failed to create character. Please try again.",
	setup_failed: "Failed to set up characters. Please try again.",
	firstname_too_short: "First name must be at least 2 characters long.",
	firstname_too_long: "First name cannot exceed 16 characters.",
	lastname_too_short: "Last name must be at least 2 characters long.",
	lastname_too_long: "Last name cannot exceed 16 characters.",
	invalid_date: "Please enter a valid date of birth.",
	date: "Date of Birth",
	field: "Field",
}

export class TranslationManager {
	private translations: Translations = {}

	setTranslations(translations: Translations) {
		this.translations = translations || {}
	}

	translate(key: string, params?: Record<string, string>): string {
		// First check in server-provided translations
		if (this.translations[key]) {
			let text = this.translations[key]
			if (params) {
				Object.keys(params).forEach((param) => {
					text = text.replace(`{${param}}`, params[param] || '')
				})
			}
			return text
		}

		// Then check in fallbacks
		if (fallbacks[key]) {
			let text = fallbacks[key]
			if (params) {
				Object.keys(params).forEach((param) => {
					text = text.replace(`{${param}}`, params[param] || '')
				})
			}
			return text
		}

		// Return the key itself if no translation found
		return key
	}
}

export const translationManager = new TranslationManager()

