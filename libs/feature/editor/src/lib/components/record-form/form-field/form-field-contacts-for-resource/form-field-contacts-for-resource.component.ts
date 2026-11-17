import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  inject,
} from '@angular/core'
import {
  Individual,
  Organization,
  Role,
  RoleLabels,
  RoleValues,
} from '@geonetwork-ui/common/domain/model/record'
import { UserModel } from '@geonetwork-ui/common/domain/model/user'
import { OrganizationsServiceInterface } from '@geonetwork-ui/common/domain/organizations.service.interface'
import { PlatformServiceInterface } from '@geonetwork-ui/common/domain/platform.service.interface'
import { SortableListComponent } from '@geonetwork-ui/ui/layout'
import {
  AutocompleteComponent,
  ButtonComponent,
} from '@geonetwork-ui/ui/inputs'
import { createFuzzyFilter } from '@geonetwork-ui/util/shared'
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core'
import {
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  switchMap,
  Observable,
} from 'rxjs'
import { map } from 'rxjs/operators'
import { ContactCardComponent } from '../../../contact-card/contact-card.component'
import {
  NgIconComponent,
  provideIcons,
  provideNgIconsConfig,
} from '@ng-icons/core'
import { iconoirPlus } from '@ng-icons/iconoir'
import { GeoNetworkSubtemplateService, SubtemplateContact } from '@geonetwork-ui/data-access/gn4'

@Component({
  selector: 'gn-ui-form-field-contacts-for-resource',
  templateUrl: './form-field-contacts-for-resource.component.html',
  styleUrls: ['./form-field-contacts-for-resource.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    AutocompleteComponent,
    ContactCardComponent,
    SortableListComponent,
    NgIconComponent,
    ButtonComponent,
    TranslatePipe,
    TranslateDirective,
  ],
  providers: [
    provideIcons({ iconoirPlus }),
    provideNgIconsConfig({
      size: '1.5rem',
    }),
  ],
})
export class FormFieldContactsForResourceComponent
  implements OnChanges, OnInit
{
  private platformServiceInterface = inject(PlatformServiceInterface)
  private organizationsServiceInterface = inject(OrganizationsServiceInterface)
  private subtemplateService = inject(GeoNetworkSubtemplateService)

  @Input() value: Individual[]
  @Output() valueChange: EventEmitter<Individual[]> = new EventEmitter()

  contactsForRessourceByRole: Map<Role, Individual[]> = new Map()
  roleValues = RoleValues

  rolesToPick: Role[] = this.roleValues.filter(
    (role) => role !== 'other' && role !== 'unspecified'
  )

  roleSectionsToDisplay: Role[] = []

  allOrganizations: Map<string, Organization> = new Map()

  ngOnChanges() {
    this.updateContactsForRessource()
    this.manageRoleSectionsToDisplay(this.value)
    this.filterRolesToPick()
  }

  async ngOnInit(): Promise<void> {
    this.allOrganizations = new Map<string, Organization>(
      (
        await firstValueFrom(this.organizationsServiceInterface.organisations$)
      ).map((organization) => [organization.name, organization])
    )
    this.updateContactsForRessource()
    this.manageRoleSectionsToDisplay(this.value)
    this.filterRolesToPick()
  }

  addRoleToDisplay(roleToAdd: string) {
    this.roleSectionsToDisplay.push(roleToAdd)
    this.filterRolesToPick()
  }

  filterRolesToPick() {
    this.rolesToPick = this.rolesToPick.filter(
      (role) => !this.roleSectionsToDisplay.includes(role)
    )
  }

  updateContactsForRessource() {
    this.contactsForRessourceByRole = this.value.reduce((acc, contact) => {
      const completeOrganization = contact.organization
        ? this.allOrganizations.get(contact.organization.name)
        : null
      const organization = completeOrganization ?? contact.organization

      const updatedContact = {
        ...contact,
        ...(organization && { organization }),
      }

      if (!acc.has(contact.role)) {
        acc.set(contact.role, [])
      }

      acc.get(contact.role).push(updatedContact)

      return acc
    }, new Map<Role, Individual[]>())
  }

  manageRoleSectionsToDisplay(contactsForResource: Individual[]) {
    const roles = contactsForResource.map(
      (contact: Individual) => contact.role
    ) as Role[]

    roles.forEach((role: Role) => {
      if (!this.roleSectionsToDisplay.includes(role)) {
        this.roleSectionsToDisplay.push(role)
      }
    })
  }

  removeContact(index: number) {
    const newContactsforRessource = this.value.filter((_, i) => i !== index)
    this.valueChange.emit(newContactsforRessource)
  }

  handleContactsChanged(items: unknown[], role: Role) {
    const contacts = items as Individual[]

    this.contactsForRessourceByRole.set(role, contacts)

    const newControlValue = Array.from(
      this.contactsForRessourceByRole.values()
    ).flat()

    this.valueChange.emit(newControlValue)
  }

  protected roleToLabel(role: string): string {
    return RoleLabels.get(role)
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
  async handleSubtemplateSelection(item: AutocompleteItem, role: string) {
    console.log('Contact subtemplate selected:', item, 'for role:', role)
    const contactSubtemplate = item.value
    try {
      const xml = await firstValueFrom(
        this.subtemplateService.getSubtemplateXml(contactSubtemplate.uuid)  // Use uuid, not id!
      )
      console.log('Fetched contact subtemplate XML:', xml)

      // Create contact from subtemplate
      const newContact = this.createContactFromSubtemplate(
        contactSubtemplate,
        xml,
        role
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
    elementName: string,
    context?: string
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
    xml: string | null,
    role: string
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
    // Map Angular role format (point_of_contact) to ISO role code (pointOfContact)
    const isoRoleCode = this.roleToIsoCode(role)

    const newContact = {
      firstName: firstName || subtemplate.label,
      lastName: lastName,
      organization: organization,
      email: '',
      role,
      address: '',
      phone: '',
      position: '',
      // Store subtemplate reference for later XML generation with xlink:href
      subtemplateId: subtemplate.uuid,
      // Generate xlink:href with GeoNetwork query parameters for proper subtemplate merging
      subtemplateXlinkHref: this.generateSubtemplateXlinkHref(
        subtemplate.uuid,
        isoRoleCode
      ),
      // IMPORTANT: Store the full XML content to preserve structure when writing
      // This is used by write-parts.ts instead of regenerating via appendResponsibleParty()
      subtemplateXml: xml,
    } as any // Using 'any' to allow extra fields

    return newContact
  }

  /**
   * Map Angular role format to ISO 19115 role code
   * e.g., point_of_contact → pointOfContact
   */
  private roleToIsoCode(role: string): string {
    if (role === 'point_of_contact') {
      return 'pointOfContact'
    }
    if (role === 'resource_provider') {
      return 'resourceProvider'
    }
    // Return as-is for roles already in camelCase (owner, custodian, distributor, etc.)
    return role
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
}

type AutocompleteItem = { title: string; value: SubtemplateContact }
