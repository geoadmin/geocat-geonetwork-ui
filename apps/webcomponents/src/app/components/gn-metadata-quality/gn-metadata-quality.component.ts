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
  @Input() propsToValidate?: ValidatorMapperKeys[] | string // Can be JSON string array
  @Input() forceComputeScore = false

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

  get parsedPropsToValidate(): ValidatorMapperKeys[] | undefined {
    if (!this.propsToValidate) return undefined
    if (typeof this.propsToValidate === 'string') {
      try {
        return JSON.parse(this.propsToValidate)
      } catch (e) {
        console.warn('Failed to parse propsToValidate JSON:', e)
        return undefined
      }
    }
    return this.propsToValidate
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
