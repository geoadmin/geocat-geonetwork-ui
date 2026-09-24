import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { EditorFacade } from '../../+state/editor.facade'
import { EditorFieldValue } from '../../models'
import { FormFieldComponent } from './form-field'
import { TranslateDirective } from '@ngx-translate/core'
import {
  EditorFieldWithValue,
  EditorSectionWithValues,
} from '../../+state/editor.models'
import { map, Observable } from 'rxjs'
import { CatalogRecordKeys, RecordTranslations, LanguageCode } from '@geonetwork-ui/common/domain/model/record'

@Component({
  selector: 'gn-ui-record-form',
  templateUrl: './record-form.component.html',
  styleUrls: ['./record-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormFieldComponent, TranslateDirective],
})
export class RecordFormComponent {
  facade = inject(EditorFacade)

  recordUniqueIdentifier$ = this.facade.record$.pipe(
    map((record) => record.uniqueIdentifier)
  )

  recordTranslations$: Observable<RecordTranslations> = this.facade.record$.pipe(
    map((record) => record.translations || {})
  )

  recordDefaultLanguage$: Observable<LanguageCode> = this.facade.record$.pipe(
    map((record) => record.defaultLanguage || 'fr')
  )

  recordLanguages$: Observable<LanguageCode[]> = this.facade.record$.pipe(
    map((record) => record.otherLanguages || [])
  )

  handleFieldValueChange(model: CatalogRecordKeys, newValue: EditorFieldValue) {
    if (!model) {
      return
    }
    this.facade.updateRecordField(model, newValue)
  }

  handleTranslationsChange(translations: RecordTranslations) {
    // Update translations in the record
    this.facade.updateRecordField('translations', translations)
  }

  fieldTracker(index: number, field: EditorFieldWithValue) {
    return field.config.model
  }

  sectionTracker(index: number, section: EditorSectionWithValues) {
    return section.labelKey
  }
}
