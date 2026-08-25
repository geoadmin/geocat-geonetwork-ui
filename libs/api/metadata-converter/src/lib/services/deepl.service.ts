import { Injectable, Inject, InjectionToken, Optional } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, from, throwError } from 'rxjs'
import { map, catchError } from 'rxjs/operators'

// Import LanguageCode from common/domain
import type { LanguageCode } from '@geonetwork-ui/common/domain/model/record'

export const DEEPL_API_KEY = new InjectionToken<string>('deepl.api.key')

/**
 * DeepL API language code to ISO 639-1 code mapping
 * DeepL uses different codes than ISO (e.g., EN for English instead of en)
 */
const DEEPL_LANGUAGE_MAP: Record<LanguageCode, string> = {
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  en: 'EN-US',
  rm: 'EN-US', // Romansh not supported by DeepL, fallback to English
}

const REVERSE_DEEPL_MAP: Record<string, LanguageCode> = {
  DE: 'de',
  FR: 'fr',
  IT: 'it',
  'EN-US': 'en',
  'EN-GB': 'en',
}

export interface DeepLTranslationResult {
  translations: Array<{
    text: string
    detected_source_language: string
  }>
}

/**
 * Service for translating text using DeepL API
 * Supports instant translation of title and abstract fields
 */
@Injectable({
  providedIn: 'root',
})
export class DeepLService {
  private readonly apiUrl = 'https://api.deepl.com/v2/translate'
  private readonly devProxyUrl = '/dev-proxy?https://api.deepl.com/v2/translate' // Dev proxy to avoid CORS
  private readonly apiKey: string

  constructor(
    private http: HttpClient,
    @Optional() @Inject(DEEPL_API_KEY) apiKey?: string
  ) {
    // Use injected key, default to empty string if not provided
    this.apiKey = apiKey || ''
    console.log('[DeepLService] Initialized. API Key present:', !!this.apiKey)
  }

  /**
   * Check if DeepL API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey
  }

  /**
   * Translate text from source language to multiple target languages
   * @param text Text to translate
   * @param sourceLanguage Source language code (ISO 639-1)
   * @param targetLanguages Array of target language codes (ISO 639-1)
   * @returns Map of language code to translated text
   */
  translateText(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguages: LanguageCode[]
  ): Observable<Record<LanguageCode, string>> {
    if (!this.apiKey) {
      console.error('[DeepLService] API key not configured')
      return throwError(() => new Error('DeepL API key not configured'))
    }

    if (!text || text.trim().length === 0) {
      console.warn('[DeepLService] Text to translate is empty')
      return throwError(() => new Error('Text to translate is empty'))
    }

    // Filter out unsupported languages and duplicates
    const supportedTargets = Array.from(new Set(
      targetLanguages.filter(lang => DEEPL_LANGUAGE_MAP[lang])
    ))

    if (supportedTargets.length === 0) {
      console.warn('[DeepLService] No supported target languages', targetLanguages)
      return throwError(() => new Error('No supported target languages'))
    }

    console.log('[DeepLService] Translating text from', sourceLanguage, 'to', supportedTargets)

    // Make multiple requests (one per target language) to get translations
    const translationRequests = supportedTargets.map(targetLang =>
      this.translateToLanguage(text, sourceLanguage, targetLang)
        .pipe(
          map(result => ({ [targetLang]: result })),
          catchError(err => {
            console.error(`[DeepLService] Failed to translate to ${targetLang}:`, err)
            return throwError(() => err)
          })
        )
    )

    // Combine all translation results
    return from(translationRequests).pipe(
      map(result => result),
      // Collect all results into a single object
      (obs: Observable<any>) => new Observable(subscriber => {
        const results: Record<LanguageCode, string> = {}
        let completed = 0

        translationRequests.forEach(req =>
          req.subscribe({
            next: (translation) => {
              Object.assign(results, translation)
              completed++
              if (completed === translationRequests.length) {
                subscriber.next(results)
                subscriber.complete()
              }
            },
            error: (err) => subscriber.error(err),
          })
        )
      })
    )
  }

  /**
   * Translate text to a single target language
   */
  private translateToLanguage(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode
  ): Observable<string> {
    const deepLSource = DEEPL_LANGUAGE_MAP[sourceLanguage]
    const deepLTarget = DEEPL_LANGUAGE_MAP[targetLanguage]

    if (!deepLSource || !deepLTarget) {
      return throwError(() => new Error(`Unsupported language: ${sourceLanguage} or ${targetLanguage}`))
    }

    const headers = new HttpHeaders({
      Authorization: `DeepL-Auth-Key ${this.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    })

    // Build form data
    const params = new URLSearchParams()
    params.append('text', text)
    params.append('source_lang', deepLSource)
    params.append('target_lang', deepLTarget)

    console.log(`[DeepLService] Calling API for ${sourceLanguage}→${targetLanguage}`)

    return this.http.post<DeepLTranslationResult>(
      this.devProxyUrl,
      params.toString(),
      { headers }
    ).pipe(
      map(response => {
        if (!response.translations || response.translations.length === 0) {
          throw new Error('No translation returned from DeepL')
        }
        const translated = response.translations[0].text
        console.log(`[DeepLService] Translated to ${targetLanguage}: "${translated.substring(0, 100)}..."`)
        return translated
      }),
      catchError(error => {
        console.error(`[DeepLService] API error:`, error)
        return throwError(() => new Error(`DeepL API error: ${error.error?.message || error.message}`))
      })
    )
  }
}
