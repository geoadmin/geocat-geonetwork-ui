import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { MatButtonModule } from '@angular/material/button'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { RecordTranslations, LanguageCode } from '@geonetwork-ui/common/domain/model/record'
import { FormFieldRichComponent } from '../form-field-rich/form-field-rich.component'
import { DeepLService } from '@geonetwork-ui/api/metadata-converter'

interface LanguageOption {
  code: LanguageCode
  label: string
  flag: string
}

@Component({
  selector: 'gn-ui-form-field-abstract-multilingual',
  templateUrl: './form-field-abstract-multilingual.component.html',
  styleUrls: ['./form-field-abstract-multilingual.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FormFieldRichComponent,
    TranslateModule,
  ],
})
export class FormFieldAbstractMultilingualComponent {
  @Input() value = ''
  @Input() translations: RecordTranslations = {}
  @Input() defaultLanguage = 'fr' as LanguageCode
  @Input() otherLanguages: LanguageCode[] = []
  @Input() label = ''
  @Input() hint = ''

  @Output() valueChange = new EventEmitter<string>()
  @Output() translationsChange = new EventEmitter<RecordTranslations>()

  private deepLService = inject(DeepLService)
  private cdr = inject(ChangeDetectorRef)
  private translateService = inject(TranslateService)

  showTranslations = false
  isTranslating = false
  translatedByDeepL: { [lang: string]: boolean } = {}

  availableLanguages: LanguageOption[] = [
    { code: 'de', label: 'Deutsch (Allemand)', flag: 'de' },
    { code: 'fr', label: 'Français (Français)', flag: 'fr' },
    { code: 'it', label: 'Italiano (Italien)', flag: 'it' },
    { code: 'rm', label: 'Rumantsch (Romanche)', flag: 'ch' },
    { code: 'en', label: 'English (Anglais)', flag: 'gb' },
  ]

  get otherLanguagesList(): LanguageOption[] {
    return this.availableLanguages.filter(
      (lang) =>
        this.otherLanguages.includes(lang.code) && lang.code !== this.defaultLanguage
    )
  }

  toggleTranslations(): void {
    this.showTranslations = !this.showTranslations
  }

  getTranslation(lang: LanguageCode): string {
    return this.translations?.abstract?.[lang] ?? ''
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
      'rm': ' (translatà da DeepL)',
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
      ' (translatà da DeepL)',
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
      abstract: {
        ...(this.translations?.abstract ?? {}),
        [lang]: text,
      },
    }
    this.translationsChange.emit(updated)
  }

  onAbstractChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement
    this.valueChange.emit(target.value)
  }

  onTranslationChange(lang: LanguageCode, event: Event): void {
    const target = event.target as HTMLTextAreaElement
    this.updateTranslation(lang, target.value)
  }

  /**
   * Translate abstract to all other languages using DeepL API
   * Always re-translates all languages to sync with the main value
   */
  translateWithDeepL(): void {
    if (!this.value || this.value.trim().length === 0) {
      return
    }

    // Translate to ALL other languages (re-translate even if they already have values)
    const allLanguages = this.otherLanguagesList.map(lang => lang.code)

    if (allLanguages.length === 0) {
      return
    }

    this.isTranslating = true
    this.cdr.markForCheck()

    // Separate Romansh translations (use German as source) from others (use default language)
    const romanshLangs = allLanguages.filter(lang => lang === 'rm')
    const otherLangs = allLanguages.filter(lang => lang !== 'rm')
    const observables: any[] = []

    // Translate to other languages using default language as source
    if (otherLangs.length > 0) {
      observables.push(
        this.deepLService.translateText(this.value, this.defaultLanguage, otherLangs)
      )
    }

    // Translate to Romansh using German as source (if present)
    if (romanshLangs.length > 0) {
      observables.push(
        this.deepLService.translateText(this.value, 'de' as LanguageCode, romanshLangs)
      )
    }

    // Combine all translations
    if (observables.length === 0) {
      this.isTranslating = false
      return
    }

    this.deepLService.translateText(this.value, this.defaultLanguage, otherLangs.length > 0 ? otherLangs : allLanguages).subscribe({
      next: (translations) => {
        let allTranslations = { ...translations }

        // If we have Romansh, also translate from German
        if (romanshLangs.length > 0) {
          this.deepLService.translateText(this.value, 'de' as LanguageCode, romanshLangs).subscribe({
            next: (romanshTranslations) => {
              allTranslations = { ...allTranslations, ...romanshTranslations }
              this.applyTranslationsWithWarning(allLanguages, allTranslations)
            },
          })
        } else {
          this.applyTranslationsWithWarning(allLanguages, allTranslations)
        }
      },
      error: (error) => {
        this.isTranslating = false
        this.cdr.markForCheck()
      },
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
      abstract: {
        ...(this.translations?.abstract ?? {}),
        ...translationsWithWarning,
      },
    }

    this.translationsChange.emit(updated)
    this.isTranslating = false
    this.cdr.markForCheck()
  }
}
