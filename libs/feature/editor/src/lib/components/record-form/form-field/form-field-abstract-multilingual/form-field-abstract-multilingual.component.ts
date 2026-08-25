import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { MatButtonModule } from '@angular/material/button'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { TranslateModule } from '@ngx-translate/core'
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

  showTranslations = false
  isTranslating = false

  constructor(
    private deepLService: DeepLService,
    private cdr: ChangeDetectorRef
  ) {}

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

    // Use defaultLanguage as source, translate to all other languages
    this.deepLService.translateText(this.value, this.defaultLanguage, allLanguages).subscribe({
      next: (translations) => {

        // Merge new translations with existing ones (replace all with new translations)
        const updated = {
          ...this.translations,
          abstract: {
            ...(this.translations?.abstract ?? {}),
            ...translations,
          },
        }

        this.translationsChange.emit(updated)
        this.isTranslating = false
        this.cdr.markForCheck()
      },
      error: (error) => {
        this.isTranslating = false
        this.cdr.markForCheck()
        // Could show a toast notification here
      },
    })
  }
}
