import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core'
import { AutocompleteComponent } from '@geonetwork-ui/ui/inputs'
import {
  Individual,
  Organization,
} from '@geonetwork-ui/common/domain/model/record'
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core'
import {
  firstValueFrom,
  Observable,
  Subscription,
} from 'rxjs'
import { PlatformServiceInterface } from '@geonetwork-ui/common/domain/platform.service.interface'
import { OrganizationsServiceInterface } from '@geonetwork-ui/common/domain/organizations.service.interface'
import { ContactCardComponent } from '../../../contact-card/contact-card.component'
import { map } from 'rxjs/operators'
import { SortableListComponent } from '@geonetwork-ui/ui/layout'
import { GeoNetworkSubtemplateService, SubtemplateContact } from '@geonetwork-ui/data-access/gn4'

@Component({
  selector: 'gn-ui-form-field-contacts',
  templateUrl: './form-field-contacts.component.html',
  styleUrls: ['./form-field-contacts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    AutocompleteComponent,
    TranslateDirective,
    TranslatePipe,
    ContactCardComponent,
    SortableListComponent,
  ],
})
export class FormFieldContactsComponent implements OnDestroy, OnChanges {
  private platformServiceInterface = inject(PlatformServiceInterface)
  private organizationsServiceInterface = inject(OrganizationsServiceInterface)
  private subtemplateService = inject(GeoNetworkSubtemplateService)
  private changeDetectorRef = inject(ChangeDetectorRef)

  @Input() value: Individual[]
  @Output() valueChange: EventEmitter<Individual[]> = new EventEmitter()

  contacts: Individual[] = []

  subscription: Subscription = new Subscription()

  allOrganizations: Map<string, Organization> = new Map()

  constructor() {
    // Contacts are now fetched from GeoNetwork subtemplates via searchContactSubtemplates()
    // See subtemplateSearchAction for the dynamic search logic
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    const contactsChanges = changes['value']

    if (contactsChanges.firstChange) {
      this.allOrganizations = new Map<string, Organization>(
        (
          await firstValueFrom(
            this.organizationsServiceInterface.organisations$
          )
        ).map((organization) => [organization.name, organization])
      )
    }

    if (contactsChanges.currentValue !== contactsChanges.previousValue) {
      this.updateContacts()

      this.changeDetectorRef.markForCheck()
    }
  }

  updateContacts() {
    this.contacts = this.value.reduce((acc, contact) => {
      const completeOrganization = this.allOrganizations.get(
        contact.organization.name
      )

      const updatedContact = {
        ...contact,
        organization:
          completeOrganization ??
          ({ name: contact.organization.name } as Organization),
      }

      acc.push(updatedContact)

      return acc
    }, [] as Individual[])
  }

  handleContactsChanged(items: unknown[]) {
    const contacts = items as Individual[]

    this.contacts = contacts

    this.valueChange.emit(contacts)
  }

  /**
   * Search function for autocomplete - searches GeoNetwork for contact subtemplates
   */
  subtemplateSearchAction = (query: string): Observable<AutocompleteItem[]> => {
    console.log('Contact autocomplete search triggered with query:', query)
    if (!query || query.trim().length < 1) {
      return new Observable((obs) => {
        obs.next([])
        obs.complete()
      })
    }

    return this.subtemplateService.searchContactSubtemplates(query).pipe(
      map((contacts) => {
        const items = contacts.map((contact) => ({
          title: contact.label,
          value: contact,
        }))
        console.log('Contact autocomplete items:', items)
        return items
      })
    )
  }

  /**
   * Display function for autocomplete items
   */
  displaySubtemplateFn = (item: AutocompleteItem): string => {
    return item.title
  }

  /**
   * Handle selection of a contact subtemplate from autocomplete
   */
  async handleSubtemplateSelection(item: AutocompleteItem) {
    console.log('Contact subtemplate selected:', item)
    const contactSubtemplate = item.value
    try {
      const xml = await firstValueFrom(
        this.subtemplateService.getSubtemplateXml(contactSubtemplate.uuid)  // Use uuid, not id!
      )
      console.log('Fetched contact subtemplate XML:', xml)

      // Create contact from subtemplate WITH full XML preserved
      const newContact = this.createContactFromSubtemplate(
        contactSubtemplate,
        xml
      )
      this.valueChange.emit([...this.value, newContact])
    } catch (error) {
      console.error('Failed to fetch contact subtemplate:', error)
    }
  }

  /**
   * Extract text from ISO19115-3 XML element that may contain PT_FreeText
   * Handles both simple CharacterString and multilingual PT_FreeText structures
   */
  private extractTextFromXmlElement(
    xml: string,
    elementName: string
  ): string {
    // First try to find simple CharacterString (fastest path)
    const simpleMatch = xml.match(
      new RegExp(
        `<${elementName}[^>]*>[\\s\\S]*?<gco:CharacterString[^>]*>([^<]+)<\\/gco:CharacterString>`,
        'i'
      )
    )
    if (simpleMatch && simpleMatch[1] && simpleMatch[1].trim()) {
      return simpleMatch[1].trim()
    }

    // Try PT_FreeText structure: look for LocalisedCharacterString with locale="#EN"
    const ptMatch = xml.match(
      new RegExp(
        `<${elementName}[^>]*>[\\s\\S]*?<lan:LocalisedCharacterString[^>]*locale="#EN"[^>]*>([^<]+)<\\/lan:LocalisedCharacterString>`,
        'i'
      )
    )
    if (ptMatch && ptMatch[1] && ptMatch[1].trim()) {
      return ptMatch[1].trim()
    }

    // Try any LocalisedCharacterString without specific locale
    const anyLocaleMatch = xml.match(
      new RegExp(
        `<${elementName}[^>]*>[\\s\\S]*?<lan:LocalisedCharacterString[^>]*>([^<]+)<\\/lan:LocalisedCharacterString>`,
        'i'
      )
    )
    if (anyLocaleMatch && anyLocaleMatch[1] && anyLocaleMatch[1].trim()) {
      return anyLocaleMatch[1].trim()
    }

    return ''
  }

  /**
   * Create an Individual contact from a subtemplate with xlink:href
   * This enables embedding the full contact details via xlink reference
   */
  private createContactFromSubtemplate(
    subtemplate: SubtemplateContact,
    xml: string | null
  ): Individual {
    // Extract basic info from subtemplate for display
    let firstName = ''
    let lastName = ''
    let organization = { name: subtemplate.owner || 'Unknown' } as Organization

    // Try to extract more details from XML if available
    if (xml) {
      // Look for cit:party which contains the organization (works for cit:CI_Organisation or che:CHE_CI_Organisation)
      const partyMatch = xml.match(
        /<cit:party[^>]*>([\s\S]*?)<\/cit:party>/i
      )
      if (partyMatch) {
        const partyContent = partyMatch[1]
        // Extract organization name from party (first cit:name is usually the org name)
        const orgName = this.extractTextFromXmlElement(
          partyContent,
          'cit:name'
        )
        if (orgName) {
          organization = { name: orgName } as Organization
        }
      }

      // Look for CI_Individual/name (the person) - search after party to get individual name
      const individualMatch = xml.match(
        /<cit:individual[^>]*>([\s\S]*?)<\/cit:individual>/i
      )
      if (individualMatch) {
        const individualName = this.extractTextFromXmlElement(
          individualMatch[1],
          'cit:name'
        )
        if (individualName) {
          const parts = individualName.split(' ')
          firstName = parts[0] || ''
          lastName = parts.slice(1).join(' ') || ''
        }
      }
    }

    // Create Individual contact with subtemplate reference
    const newContact = {
      firstName: firstName || subtemplate.label,
      lastName: lastName,
      organization: organization,
      email: '',
      role: 'point_of_contact',
      address: '',
      phone: '',
      position: '',
      // Store subtemplate reference for later XML generation with xlink:href
      subtemplateId: subtemplate.uuid,
      // Generate xlink:href with GeoNetwork query parameters for proper subtemplate merging
      subtemplateXlinkHref: this.generateSubtemplateXlinkHref(
        subtemplate.uuid,
        'pointOfContact'
      ),
      // IMPORTANT: Store the full XML content to preserve structure when writing
      // This is used by write-parts.ts instead of regenerating via appendResponsibleParty()
      subtemplateXml: xml,
    } as any // Using 'any' to allow extra fields

    return newContact
  }

  /**
   * Generate xlink:href with GeoNetwork query parameters for subtemplate merging
   * Includes: languages, process (XPath with role code), and schema
   */
  private generateSubtemplateXlinkHref(
    uuid: string,
    roleCode: string
  ): string {
    const languages = 'eng,fre,ger,ita,roh'
    const process = `cit:role/cit:CI_RoleCode/@codeListValue~${roleCode}`
    const schema = 'iso19115-3.2018.che'
    return `local://srv/api/registries/entries/${uuid}?lang=${languages}&process=${process}&schema=${schema}`
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe()
  }
}

type AutocompleteItem = { title: string; value: SubtemplateContact }
