import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { TextFieldModule } from '@angular/cdk/text-field'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatButtonModule } from '@angular/material/button'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { RecordTranslations } from '@geonetwork-ui/common/domain/model/record'
import { LanguageCode } from '@geonetwork-ui/common/domain/model/record'
import { DeepLService } from '@geonetwork-ui/api/metadata-converter'

interface LanguageOption {
  code: LanguageCode
  label: string
  flag: string
}

@Component({
  selector: 'gn-ui-form-field-title-multilingual',
  templateUrl: './form-field-title-multilingual.component.html',
  styleUrls: ['./form-field-title-multilingual.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    TextFieldModule,
    MatTooltipModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
})
export class FormFieldTitleMultilingualComponent {
  @Input() value = ''
  @Input() translations: RecordTranslations = {}
  @Input() defaultLanguage = 'fr' as LanguageCode
  @Input() otherLanguages: LanguageCode[] = []
  @Input() placeholder = ''

  @Output() valueChange = new EventEmitter<string>()
  @Output() translationsChange = new EventEmitter<RecordTranslations>()

  @ViewChild('titleInput') titleInput!: ElementRef

  private deepLService = inject(DeepLService)
  private cdr = inject(ChangeDetectorRef)
  private translateService = inject(TranslateService)

  showTranslations = false
  isTranslating = false
  translatedByDeepL: { [lang: string]: boolean } = {}

  private availableLanguagesKeys: LanguageOption[] = [
    { code: 'de', label: 'language.de', flag: 'de' },
    { code: 'fr', label: 'language.fr', flag: 'fr' },
    { code: 'it', label: 'language.it', flag: 'it' },
    { code: 'rm', label: 'language.rm', flag: 'ch' },
    { code: 'en', label: 'language.en', flag: 'gb' },
  ]

  get availableLanguages(): LanguageOption[] {
    return this.availableLanguagesKeys.map(lang => ({
      ...lang,
      label: this.translateService.instant(lang.label)
    }))
  }

  get otherLanguagesList(): LanguageOption[] {
    const filtered = this.availableLanguages.filter(
      (lang) =>
        this.otherLanguages.includes(lang.code) && lang.code !== this.defaultLanguage
    )
    return filtered
  }

  toggleTranslations(): void {
    this.showTranslations = !this.showTranslations
  }

  getTranslation(lang: LanguageCode): string {
    const translation = this.translations?.title?.[lang] ?? ''
    return translation
  }

  isTranslatedByDeepL(lang: LanguageCode): boolean {
    return this.translatedByDeepL[lang] ?? false
  }

  /**
   * Get placeholder text with translation label and value
   */
  getPlaceholder(): string {
    const translatedLabel = this.translateService.instant('editor.record.form.abstract.translate')
    return `${translatedLabel}: '${this.value}'`
  }

  /**
   * Get the DeepL warning message for a specific language
   */
  private getDeepLWarningMessage(lang: LanguageCode): string {
    const messages: { [key in LanguageCode]?: string } = {
      'fr': ' (traduit par DeepL)',
      'en': ' (translated by DeepL)',
      'de': ' (von DeepL übersetzt)',
      'it': ' (tradotto da DeepL)',
      'rm': ' (Rumantsch betg disponibel, per defect tudestg)',
    }
    return messages[lang] ?? ' (translated by DeepL)'
  }

  /**
   * Remove any existing DeepL warning message from text
   */
  private removeDeepLWarning(text: string): string {
    // Remove any of the possible DeepL messages at the end
    const warnings = [
      ' (traduit par DeepL)',
      ' (translated by DeepL)',
      ' (von DeepL übersetzt)',
      ' (tradotto da DeepL)',
      ' (Rumantsch betg disponibel, per defect tudestg)',
    ]
    let result = text
    for (const warning of warnings) {
      if (result.endsWith(warning)) {
        result = result.slice(0, -warning.length)
      }
    }
    return result
  }

  updateTranslation(lang: LanguageCode, text: string): void {
    const updated = {
      ...this.translations,
      title: {
        ...(this.translations?.title ?? {}),
        [lang]: text,
      },
    }
    this.translationsChange.emit(updated)
  }

  focusTitleInput(): void {
    if (this.titleInput) {
      this.titleInput.nativeElement.focus()
    }
  }

  onTitleChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement
    this.valueChange.emit(target.value)
  }

  onTranslationChange(lang: LanguageCode, event: Event): void {
    const target = event.target as HTMLTextAreaElement
    this.updateTranslation(lang, target.value)
  }

  /**
   * Translate title to all other languages using DeepL API
   * Always re-translates all languages to sync with the main value
   */
  translateWithDeepL(): void {
    if (!this.value || this.value.trim().length === 0) {
      return
    }

    const allLanguages = this.otherLanguagesList.map(lang => lang.code)

    if (allLanguages.length === 0) {
      return
    }

    this.isTranslating = true
    this.cdr.markForCheck()

    // Check if Romansh is requested
    const hasRomansh = allLanguages.includes('rm')

    // Build list of languages to translate to
    // If Romansh is requested, we must also translate to German since we'll reuse it for Romansh
    const languagesToTranslate = hasRomansh
      ? allLanguages.map(lang => lang === 'rm' ? 'de' : lang) // Replace 'rm' with 'de'
      : allLanguages

    this.deepLService.translateText(this.value, this.defaultLanguage, languagesToTranslate).subscribe({
      next: (results) => {
        // If Romansh was requested, copy the German translation to Romansh
        if (hasRomansh && 'de' in results) {
          results['rm'] = results['de']
          // Remove the intermediate 'de' if it wasn't originally requested
          if (!allLanguages.includes('de')) {
            delete results['de']
          }
        }

        this.applyTranslationsWithWarning(allLanguages, results)
      },
      error: (err) => {
        console.error('[FormFieldTitleMultilingual] Translation error:', err)
        this.isTranslating = false
        this.cdr.markForCheck()
      }
    })
  }

  /**
   * Apply translations with DeepL warning appended
   */
  private applyTranslationsWithWarning(allLanguages: LanguageCode[], translations: { [lang: string]: string }): void {
    // Add DeepL warning message to end of each translation
    const translationsWithWarning: { [lang: string]: string } = {}
    for (const [lang, text] of Object.entries(translations)) {
      const cleanText = this.removeDeepLWarning(text as string)
      const warning = this.getDeepLWarningMessage(lang as LanguageCode)
      translationsWithWarning[lang] = cleanText + warning
      this.translatedByDeepL[lang] = true
    }

    // Merge new translations with existing ones (replace all with new translations)
    const updated = {
      ...this.translations,
      title: {
        ...(this.translations?.title ?? {}),
        ...translationsWithWarning,
      },
    }

    this.translationsChange.emit(updated)
    this.isTranslating = false
    this.cdr.markForCheck()
  }
}
