import { CommonModule } from '@angular/common'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core'
import { MatTooltipModule } from '@angular/material/tooltip'
import {
  CatalogRecordKeys,
  Constraint,
  DatasetTemporalExtent,
  GraphicOverview,
  Individual,
  Keyword,
  OnlineResource,
  UpdateFrequency,
  RecordTranslations,
  LanguageCode,
} from '@geonetwork-ui/common/domain/model/record'
import { FormFieldWrapperComponent } from '@geonetwork-ui/ui/layout'
import { TranslatePipe } from '@ngx-translate/core'
import {
  FormFieldDateComponent,
  FormFieldLicenseComponent,
  FormFieldTemporalExtentsComponent,
} from '.'
import {
  FieldModelSpecifier,
  FormFieldComponentName,
  FormFieldConfig,
} from '../../../models'
import { FormFieldContactsForResourceComponent } from './form-field-contacts-for-resource/form-field-contacts-for-resource.component'
import { FormFieldContactsComponent } from './form-field-contacts/form-field-contacts.component'
import { FormFieldKeywordsComponent } from './form-field-keywords/form-field-keywords.component'
import { FormFieldOnlineLinkResourcesComponent } from './form-field-online-link-resources/form-field-online-link-resources.component'
import { FormFieldOnlineResourcesComponent } from './form-field-online-resources/form-field-online-resources.component'
import { FormFieldOverviewsComponent } from './form-field-overviews/form-field-overviews.component'
import { FormFieldSimpleComponent } from './form-field-simple/form-field-simple.component'
import { FormFieldSpatialExtentComponent } from './form-field-spatial-extent/form-field-spatial-extent.component'
import { FormFieldUpdateFrequencyComponent } from './form-field-update-frequency/form-field-update-frequency.component'
import { FormFieldConstraintsShortcutsComponent } from './form-field-constraints-shortcuts/form-field-constraints-shortcuts.component'
import { FormFieldConstraintsComponent } from './form-field-constraints/form-field-constraints.component'
import { TextFieldModule } from '@angular/cdk/text-field'
import { FormFieldSpatialToggleComponent } from './form-field-spatial-toggle/form-field-spatial-toggle.component'
import { FormFieldTopicsComponent } from './form-field-topics/form-field-topics.component'
import { FormFieldSubTopicsComponent } from './form-field-sub-topics/form-field-sub-topics.component'
import { FormFieldTitleMultilingualComponent } from './form-field-title-multilingual/form-field-title-multilingual.component'
import { FormFieldAbstractMultilingualComponent } from './form-field-abstract-multilingual/form-field-abstract-multilingual.component'

@Component({
  selector: 'gn-ui-form-field',
  templateUrl: './form-field.component.html',
  styleUrls: ['./form-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    MatTooltipModule,
    FormFieldWrapperComponent,
    FormFieldLicenseComponent,
    FormFieldDateComponent,
    FormFieldUpdateFrequencyComponent,
    FormFieldTemporalExtentsComponent,
    FormFieldSimpleComponent,
    FormFieldSpatialExtentComponent,
    FormFieldKeywordsComponent,
    FormFieldOverviewsComponent,
    FormFieldContactsForResourceComponent,
    FormFieldOnlineResourcesComponent,
    FormFieldOnlineLinkResourcesComponent,
    FormFieldContactsComponent,
    FormFieldConstraintsComponent,
    FormFieldConstraintsShortcutsComponent,
    FormFieldSpatialToggleComponent,
    FormFieldTopicsComponent,
    FormFieldSubTopicsComponent,
    FormFieldTitleMultilingualComponent,
    FormFieldAbstractMultilingualComponent,
    TextFieldModule,
  ],
})
export class FormFieldComponent {
  @Input() uniqueIdentifier: string
  @Input() model: CatalogRecordKeys
  @Input() modelSpecifier: FieldModelSpecifier
  @Input() componentName: FormFieldComponentName

  @Input() config: FormFieldConfig
  @Input() value: unknown

  // Multilingual support
  @Input() translations: RecordTranslations = {}
  @Input() defaultLanguage: LanguageCode = 'fr'
  @Input() otherLanguages: LanguageCode[] = []

  @Output() valueChange: EventEmitter<unknown> = new EventEmitter()
  @Output() translationsChange: EventEmitter<RecordTranslations> = new EventEmitter()

  @ViewChild('titleInput') titleInput: ElementRef
  isOpenData = false

  toggleIsOpenData(event: boolean) {
    this.isOpenData = event
  }

  focusTitleInput() {
    this.titleInput.nativeElement.focus()
  }

  get withoutWrapper() {
    return (
      this.model === 'title' ||
      this.model === 'abstract' ||
      this.model === 'legalConstraints' ||
      this.model === 'securityConstraints' ||
      this.model === 'otherConstraints' ||
      this.componentName === 'form-field-constraints-shortcuts'
    )
  }

  get valueAsString() {
    return this.value as string
  }
  get valueAsDate() {
    return this.value as Date
  }

  get valueAsOverviews() {
    return this.value as Array<GraphicOverview>
  }
  get valueAsUpdateFrequency() {
    return this.value as UpdateFrequency
  }
  get valueAsTemporalExtents() {
    return this.value as Array<DatasetTemporalExtent>
  }
  get valueAsKeywords() {
    return this.value as Array<Keyword>
  }
  get valueAsTopics() {
    return this.value as Array<string>
  }
  get valueAsSubTopics() {
    return this.value as Array<string>
  }
  get valueAsConstraints() {
    return this.value as Array<Constraint>
  }
  get valueAsIndividuals() {
    return this.value as Array<Individual>
  }
  get valueAsOnlineResources() {
    return this.value as Array<OnlineResource>
  }
  get valueAsResourceIdentifierCode() {
    const identifiers = this.value as Array<{
      code: string
      codeSpace?: string
      url?: string
    }>
    return identifiers?.[0]?.code || ''
  }

  handleResourceIdentifierChange(code: string) {
    const identifiers = this.value as Array<{
      code: string
      codeSpace?: string
      url?: string
    }>

    if (!code) {
      this.valueChange.emit(identifiers?.slice(1) || [])
      return
    }

    if (identifiers?.[0]) {
      this.valueChange.emit([
        { ...identifiers[0], code },
        ...identifiers.slice(1),
      ])
    } else {
      this.valueChange.emit([{ code }])
    }
  }

  onResourceIdentifierChange(event: unknown): void {
    this.handleResourceIdentifierChange(String(event))
  }
}
