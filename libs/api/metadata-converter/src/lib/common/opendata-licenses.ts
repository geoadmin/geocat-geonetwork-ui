/**
 * OpenData.swiss license configurations with multilingual text and URLs
 * Used for CHE profile metadata generation
 */

export interface OpenDataLicenseConfig {
  url: string
  iconUrl: string
  translations: {
    en: string
    de: string
    fr: string
    it: string
    rm?: string
  }
}

export const OPENDATA_LICENSES: Record<string, OpenDataLicenseConfig> = {
  'terms_open': {
    url: 'https://opendata.swiss/en/terms-of-use/#terms_open',
    iconUrl: 'https://wp.opendata.swiss/wp-content/uploads/2021/02/terms_open.png',
    translations: {
      en: 'Opendata OPEN: Open use.',
      de: 'Opendata OPEN: Freie Nutzung.',
      fr: 'Opendata OPEN : Libre utilisation.',
      it: 'Opendata OPEN: Uso libero.',
      rm: 'Opendata OPEN: Utilisatiun liura.',
    },
  },
  'terms_by': {
    url: 'https://opendata.swiss/en/terms-of-use/#terms_by',
    iconUrl: 'https://wp.opendata.swiss/wp-content/uploads/2021/02/terms_by.png',
    translations: {
      en: 'Opendata BY: Open use. Must provide the source.',
      de: 'Opendata BY: Freie Nutzung. Quellenangabe ist Pflicht.',
      fr: 'Opendata BY: Utilisation libre. Obligation d\'indiquer la source.',
      it: 'Opendata BY: Libero utilizzo. Indicazione della fonte obbligatoria.',
      rm: 'Opendata BY: Utilisatiun liura. Obligation da citar la source.',
    },
  },
  'terms_ask': {
    url: 'https://opendata.swiss/en/terms-of-use/#terms_ask',
    iconUrl: 'https://wp.opendata.swiss/wp-content/uploads/2021/02/terms_ask.png',
    translations: {
      en: 'Opendata ASK: Open use. Use for commercial purposes requires permission of the data owner.',
      de: 'Opendata ASK: Freie Nutzung. Kommerzielle Nutzung erfordert Zustimmung des Datenbesitzers.',
      fr: 'Opendata ASK: Libre utilisation. L\'utilisation commerciale nécessite la permission du propriétaire des données.',
      it: 'Opendata ASK: Uso libero. L\'utilizzo commerciale richiede il permesso del proprietario dei dati.',
      rm: 'Opendata ASK: Utilisatiun liura. L\'utilisatiun commerzial na dovra la permissiun dal proprietari da datas.',
    },
  },
  'terms_by_ask': {
    url: 'https://opendata.swiss/en/terms-of-use/#terms_by_ask',
    iconUrl: 'https://wp.opendata.swiss/wp-content/uploads/2021/02/terms_by-ask.png',
    translations: {
      en: 'Opendata BY ASK: Open use. Must provide the source. Use for commercial purposes requires permission of the data owner.',
      de: 'Opendata BY ASK: Freie Nutzung. Quellenangabe ist Pflicht. Kommerzielle Nutzung erfordert Zustimmung des Datenbesitzers.',
      fr: 'Opendata BY ASK: Utilisation libre. Obligation d\'indiquer la source. L\'utilisation commerciale nécessite la permission du propriétaire des données.',
      it: 'Opendata BY ASK: Libero utilizzo. Indicazione della fonte obbligatoria. L\'utilizzo commerciale richiede il permesso del proprietario dei dati.',
      rm: 'Opendata BY ASK: Utilisatiun liura. Obligation da citar la source. L\'utilisatiun commerzial na dovra la permissiun dal proprietari da datas.',
    },
  },
}

/**
 * Check if a license code is an OpenData.swiss license
 */
export function isOpenDataLicense(licenseCode: string): boolean {
  return licenseCode in OPENDATA_LICENSES
}

/**
 * Get OpenData license configuration by code
 */
export function getOpenDataLicense(licenseCode: string): OpenDataLicenseConfig | null {
  return OPENDATA_LICENSES[licenseCode] || null
}

/**
 * Try to find the license code from the license text
 * Returns the license code (e.g., 'terms_by') or null if not found
 */
export function findLicenseCodeByText(text: string): string | null {
  for (const [code, config] of Object.entries(OPENDATA_LICENSES)) {
    if (config.translations.en === text) {
      return code
    }
  }
  return null
}
