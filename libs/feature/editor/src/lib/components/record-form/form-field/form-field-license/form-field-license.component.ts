import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core'
import { marker } from '@biesbjerg/ngx-translate-extract-marker'
import { Constraint } from '@geonetwork-ui/common/domain/model/record'
import { DropdownSelectorComponent } from '@geonetwork-ui/ui/inputs'
import {
  AVAILABLE_LICENSES,
  LICENSE_CODE_TO_I18N_KEY,
  LICENSE_CODE_TO_TEXT_EN,
} from '../../../../fields.config'

type Licence = {
  label: string
  value: string
}

@Component({
  selector: 'gn-ui-form-field-license',
  templateUrl: './form-field-license.component.html',
  styleUrls: ['./form-field-license.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DropdownSelectorComponent],
})
export class FormFieldLicenseComponent implements OnInit {
  @Input() label: string
  @Input() recordLicences: Constraint[] = []
  @Output() recordLicencesChange: EventEmitter<Constraint[]> =
    new EventEmitter()

  choices: Licence[] = AVAILABLE_LICENSES.map((license) => ({
    label: marker(`editor.record.form.license.${license}`),
    value: license,
  }))

  selectedLicence: string

  ngOnInit(): void {
    if (this.recordLicences.length === 0) {
      this.selectedLicence = 'unknown'
      return
    }

    // Try to match license code directly from constraint text
    const constraintText = this.recordLicences[0].text

    // First, try to find a direct match with the license code
    const directMatch = this.choices.find((licence) => {
      return licence.value === constraintText
    })

    if (directMatch) {
      this.selectedLicence = constraintText
      return
    }

    // Second, try to match using the license English text descriptions
    // This allows matching "Opendata BY: Open use..." to "terms_by"
    const textBasedMatch = Object.entries(LICENSE_CODE_TO_TEXT_EN).find(
      ([_, text]) => text === constraintText || constraintText?.includes(text)
    )

    if (textBasedMatch) {
      this.selectedLicence = textBasedMatch[0]
      return
    }

    // If no match found, add the constraint text as a custom license option
    this.choices = [
      {
        value: constraintText,
        label: constraintText,
      },
      ...this.choices,
    ]
    this.selectedLicence = constraintText
  }

  handleLicenceSelection(licenceValue: string) {
    this.selectedLicence = licenceValue
    if (licenceValue === 'unknown') {
      this.recordLicencesChange.emit([])
      return
    } else {
      // Use the English text description for storage, not the code
      const licenseText =
        LICENSE_CODE_TO_TEXT_EN[licenceValue] || licenceValue
      this.recordLicencesChange.emit([{ text: licenseText }])
    }
  }
}
