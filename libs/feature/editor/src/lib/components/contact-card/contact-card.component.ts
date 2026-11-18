import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { Individual } from '@geonetwork-ui/common/domain/model/record'
import { ThumbnailComponent } from '@geonetwork-ui/ui/elements'

@Component({
  selector: 'gn-ui-contact-card',
  templateUrl: './contact-card.component.html',
  styleUrls: ['./contact-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ThumbnailComponent],
})
export class ContactCardComponent {
  @Input() contact: Individual

  get contactDisplayLabel(): string {
    const firstName = this.contact?.firstName?.trim() || ''
    const lastName = this.contact?.lastName?.trim() || ''
    const fullName = `${firstName} ${lastName}`.trim()
    if (fullName) return fullName

    const organizationName = this.contact?.organization?.name?.trim() || ''
    if (organizationName && organizationName !== 'Missing Organization') {
      return organizationName
    }

    const email = this.contact?.email?.trim() || ''
    if (email) return email

    return organizationName
  }
}
