import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core'
import { BaseComponent, DefaultProviders } from '../base.component'
import { CatalogRecord } from '@geonetwork-ui/common/domain/model/record'
import { ValidatorMapperKeys } from '@geonetwork-ui/util/shared'

@Component({
  selector: 'wc-gn-metadata-quality',
  templateUrl: './gn-metadata-quality.component.html',
  styleUrls: ['./gn-metadata-quality.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  providers: [DefaultProviders],
  standalone: false,
})
export class GnMetadataQualityComponent extends BaseComponent {
  @Input() metadata: CatalogRecord | string // Accept both object and JSON string
  @Input() smaller = false
  @Input() metadataQualityDisplay = true
  @Input() popoverDisplay = true
  @Input() forceComputeScore = false

  private _propsToValidate?: ValidatorMapperKeys[] | string
  public parsedPropsToValidate?: ValidatorMapperKeys[]

  @Input()
  set propsToValidate(value: ValidatorMapperKeys[] | string | undefined) {
    this._propsToValidate = value
    if (!value) {
      this.parsedPropsToValidate = undefined
      return
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        this.parsedPropsToValidate = Array.isArray(parsed) ? parsed : undefined
      } catch (e) {
        console.warn('Failed to parse propsToValidate JSON:', e)
        this.parsedPropsToValidate = undefined
      }
    } else if (Array.isArray(value)) {
      this.parsedPropsToValidate = value
    } else {
      this.parsedPropsToValidate = undefined
    }
  }
  get propsToValidate() {
    return this._propsToValidate
  }

  get parsedMetadata(): CatalogRecord | null {
    if (!this.metadata) return null
    if (typeof this.metadata === 'string') {
      try {
        return JSON.parse(this.metadata)
      } catch (e) {
        console.error('Failed to parse metadata JSON:', e)
        return null
      }
    }
    return this.metadata
  }

  get parsedForceComputeScore(): boolean {
    if (typeof this.forceComputeScore === 'boolean') return this.forceComputeScore
    return this.forceComputeScore === 'true' || this.forceComputeScore === true
  }

  get parsedSmaller(): boolean {
    if (typeof this.smaller === 'boolean') return this.smaller
    return this.smaller === 'true' || this.smaller === true
  }

  get parsedMetadataQualityDisplay(): boolean {
    if (typeof this.metadataQualityDisplay === 'boolean')
      return this.metadataQualityDisplay
    return (
      this.metadataQualityDisplay === 'true' || this.metadataQualityDisplay === true
    )
  }

  get parsedPopoverDisplay(): boolean {
    if (typeof this.popoverDisplay === 'boolean') return this.popoverDisplay
    return this.popoverDisplay === 'true' || this.popoverDisplay === true
  }
}
