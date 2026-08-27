import {
  allChildrenElement,
  findChildElement,
  findChildrenElement,
  findNestedElement,
  findNestedElements,
  findParent,
  readAttribute,
  readText,
  XmlElement,
} from '../xml-utils'
import {
  ChainableFunction,
  combine,
  filterArray,
  flattenArray,
  getAtIndex,
  map,
  mapArray,
  pipe,
} from '../function-utils'
import {
  extractCharacterString,
  extractDatasetOnlineResources,
  extractDateTime,
  extractLocalizedCharacterString,
  extractReuseOnlineResources,
  extractRole,
  extractServiceOnlineResources,
  extractUrl,
  findIdentification,
} from '../iso19139/read-parts'
import {
  DatasetSpatialExtent,
  Individual,
  LanguageCode,
  ModelTranslations,
  OnlineResource,
  Organization,
  OrganizationTranslations,
  RecordKind,
  RecordTranslations,
  ReuseType,
  Role,
} from '@geonetwork-ui/common/domain/model/record'
import { matchMimeType } from '../common/distribution.mapper'
import { fullNameToParts } from '../iso19139/utils/individual-name'
import { toLang2 } from '@geonetwork-ui/util/i18n/language-codes'
import { getResourceType, getReuseType } from '../common/resource-types'
import { Geometry } from 'geojson'
import { readGeometry } from '../iso19139/utils/geometry'
import { extractDecimal } from '../iso19139/read-parts'

export function readKind(rootEl: XmlElement): RecordKind {
  return pipe(
    findNestedElement(
      'mdb:metadataScope',
      'mdb:MD_MetadataScope',
      'mdb:resourceScope',
      'mcc:MD_ScopeCode'
    ),
    readAttribute('codeListValue'),
    map((scopeCode): RecordKind => getResourceType(scopeCode))
  )(rootEl)
}

export function findDistribution() {
  return findNestedElement('mdb:distributionInfo', 'mrd:MD_Distribution')
}

// from cit:CI_Organisation
export function extractOrganization(): ChainableFunction<
  XmlElement,
  Organization
> {
  const getUrl = pipe(
    findNestedElements(
      'cit:contactInfo',
      'cit:CI_Contact',
      'cit:onlineResource',
      'cit:CI_OnlineResource',
      'cit:linkage'
    ),
    getAtIndex(0),
    extractUrl()
  )
  return pipe(
    combine(
      pipe(
        findChildElement('cit:name', false),
        extractLocalizedCharacterString<OrganizationTranslations>('name')
      ),
      getUrl
    ),
    map(([[name, translations], website]) => ({
      name,
      ...(website && { website }),
      translations,
    }))
  )
}

// from cit:CI_Individual or cit:CI_Organisation
export function extractIndividual(
  role: Role,
  organization?: Organization,
  orgContact?: Individual
): ChainableFunction<XmlElement, Individual> {
  const getPosition = pipe(
    findChildElement('cit:positionName'),
    extractCharacterString()
  )
  const getNameParts = pipe(
    findChildElement('cit:name'),
    extractCharacterString(),
    map((fullName) => {
      if (!fullName) return []
      return fullNameToParts(fullName)
    })
  )
  const getContact = findNestedElement('cit:contactInfo', 'cit:CI_Contact')
  const getAddressRoot = pipe(
    getContact,
    findNestedElement('cit:address', 'cit:CI_Address')
  )
  const getAddress = pipe(
    getAddressRoot,
    combine(
      pipe(
        findChildElement('cit:deliveryPoint', false),
        extractCharacterString()
      ),
      pipe(findChildElement('cit:city', false), extractCharacterString()),
      pipe(findChildElement('cit:postalCode', false), extractCharacterString()),
      pipe(findChildElement('cit:country', false), extractCharacterString())
    ),
    map((parts) => parts.filter((p) => !!p).join(', '))
  )
  const getPhone = pipe(
    getContact,
    findNestedElement('cit:phone', 'cit:CI_Telephone', 'cit:number'),
    extractCharacterString()
  )
  const getEmail = pipe(
    getAddressRoot,
    findChildElement('cit:electronicMailAddress', false),
    extractCharacterString()
  )
  const defaultOrg: Organization = {
    name: 'Missing Organization',
    translations: {},
  }

  let defaultIndividual: Partial<Individual> = {}
  if (orgContact) {
    defaultIndividual = {
      email: orgContact.email,
      ...(orgContact.address && { address: orgContact.address }),
      ...(orgContact.phone && { phone: orgContact.phone }),
      ...(orgContact.position && { position: orgContact.position }),
      organization,
    }
  }

  return pipe(
    combine(getPosition, getNameParts, getEmail, getAddress, getPhone),
    map(([position, [firstName, lastName], email, address, phone]) => ({
      ...defaultIndividual,
      email: email || defaultIndividual.email || 'missing@missing.com',
      role,
      organization: organization || defaultOrg,
      ...(position && { position }),
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(address && { address }),
      ...(phone && { phone }),
    }))
  )
}

// from cit:CI_Organisation
export function extractOrganizationIndividuals(
  role: Role
): ChainableFunction<XmlElement, Array<Individual>> {
  return pipe(
    combine(
      extractOrganization(),
      extractIndividual(role),
      findNestedElements('cit:individual', 'cit:CI_Individual')
    ),
    map(([org, orgContact, els]) =>
      els.length
        ? els.map((el) => extractIndividual(role, org, orgContact)(el))
        : [
            {
              email: orgContact.email,
              ...(orgContact.address && { address: orgContact.address }),
              ...(orgContact.phone && { phone: orgContact.phone }),
              ...(orgContact.position && { position: orgContact.position }),
              organization: org,
              role,
            },
          ]
    )
  )
}

// from cit:CI_Responsibility
export function extractIndividuals(): ChainableFunction<
  XmlElement,
  Array<Individual>
> {
  const getRole = pipe(findChildElement('cit:role'), extractRole())
  const getIndividuals = pipe(
    combine(getRole, findNestedElements('cit:party', 'cit:CI_Individual')),
    ([role, els]) => els.map(extractIndividual(role))
  )
  const getOrgIndividuals = pipe(
    combine(getRole, findNestedElements('cit:party', 'cit:CI_Organisation')),
    map(([role, els]) => els.map(extractOrganizationIndividuals(role))),
    flattenArray()
  )

  return pipe(combine(getIndividuals, getOrgIndividuals), flattenArray())
}

export function readUniqueIdentifier(rootEl: XmlElement): string {
  return pipe(
    findNestedElement(
      'mdb:metadataIdentifier',
      'mcc:MD_Identifier',
      'mcc:code'
    ),
    extractCharacterString()
  )(rootEl)
}

export function readOwnerOrganization(rootEl: XmlElement): Organization {
  const contacts = readContacts(rootEl)
  const contactsForResource = readContactsForResource(rootEl)
  const pointOfContact = contacts.filter(
    (c) => c.role === 'point_of_contact'
  )[0]
  return (pointOfContact || contacts[0] || contactsForResource[0]).organization
}

export function readContacts(rootEl: XmlElement): Individual[] {
  return pipe(
    findNestedElements('mdb:contact', 'cit:CI_Responsibility'),
    mapArray(extractIndividuals()),
    flattenArray()
  )(rootEl)
}

export function readContactsForResource(rootEl: XmlElement): Individual[] {
  return pipe(
    combine(
      pipe(
        findIdentification(),
        findNestedElements(
          'mri:citation',
          'cit:CI_Citation',
          'cit:citedResponsibleParty'
        )
      ),
      pipe(
        findIdentification(),
        findChildrenElement('mri:pointOfContact', false)
      ),
      pipe(findDistribution(), findChildrenElement('mrd:distributorContact'))
    ),
    flattenArray(),
    mapArray(findChildElement('cit:CI_Responsibility', false)),
    mapArray(extractIndividuals()),
    flattenArray()
  )(rootEl)
}

export function readLandingPage(rootEl: XmlElement): URL {
  return pipe(
    findNestedElement(
      'mdb:metadataLinkage',
      'cit:CI_OnlineResource',
      'cit:linkage'
    ),
    extractUrl()
  )(rootEl)
}

export function readLineage(
  rootEl: XmlElement,
  translations: RecordTranslations
): string {
  return pipe(
    findNestedElement('mdb:resourceLineage', 'mrl:LI_Lineage', 'mrl:statement'),
    extractLocalizedCharacterString('lineage', translations),
    map(([lineage]) => lineage)
  )(rootEl)
}

function extractDateInfo(
  type: 'creation' | 'revision' | 'publication'
): ChainableFunction<XmlElement, Date> {
  return (rootEl: XmlElement) => {
    // Find all mdb:dateInfo elements
    const dateInfos = allChildrenElement(rootEl).filter(
      (child) => child.name === 'mdb:dateInfo'
    )

    for (const dateInfo of dateInfos) {
      // Navigate to cit:CI_Date
      const ciDate = findChildElement('cit:CI_Date')(dateInfo)
      if (!ciDate) continue

      // Check if dateType/CI_DateTypeCode matches the type we're looking for
      const dateTypeEl = findChildElement('cit:dateType')(ciDate)
      if (!dateTypeEl) continue

      const codeEl = findChildElement('cit:CI_DateTypeCode')(dateTypeEl)
      if (!codeEl) continue

      const codeValue = readAttribute('codeListValue')(codeEl)
      if (codeValue !== type) continue

      // Found the right date type, now extract the actual date
      const dateEl = findChildElement('cit:date')(ciDate)
      if (dateEl) {
        const result = extractDateTime()(dateEl)
        if (result) return result
      }
    }

    return null
  }
}

export function readRecordUpdated(rootEl: XmlElement): Date {
  return extractDateInfo('revision')(rootEl)
}

export function readRecordCreated(rootEl: XmlElement): Date {
  return extractDateInfo('creation')(rootEl)
}

export function readRecordPublished(rootEl: XmlElement): Date {
  return extractDateInfo('publication')(rootEl)
}

/**
 * Extract resource date (from citation)
 * Structure: mri:citation/cit:CI_Citation/cit:date/cit:CI_Date/cit:dateType/cit:CI_DateTypeCode[@codeListValue=type]
 * Works with both ISO19115-3 and CHE variants
 */
function extractResourceDateInfo(
  type: 'creation' | 'revision' | 'publication'
): ChainableFunction<XmlElement, Date> {
  return (rootEl: XmlElement) => {
    // Find identification using CHE-compatible function
    const identification = findIdentification19115()(rootEl)
    if (!identification) return null

    // ISO19115-3: cit:date is directly under identification, NOT under citation!
    // Find all cit:date elements at identification level
    const dateLists = allChildrenElement(identification).filter(
      (child) => child.name === 'cit:date'
    )

    for (const dateList of dateLists) {
      // Navigate to cit:CI_Date
      const ciDate = findChildElement('cit:CI_Date')(dateList)
      if (!ciDate) continue

      // Check if dateType/CI_DateTypeCode matches the type we're looking for
      const dateTypeEl = findChildElement('cit:dateType')(ciDate)
      if (!dateTypeEl) continue

      const codeEl = findChildElement('cit:CI_DateTypeCode')(dateTypeEl)
      if (!codeEl) continue

      const codeValue = readAttribute('codeListValue')(codeEl)
      if (codeValue !== type) continue

      // Found the right date type, now extract the actual date
      const dateEl = findChildElement('cit:date')(ciDate)
      if (dateEl) {
        const result = extractDateTime()(dateEl)
        if (result) return result
      }
    }

    return null
  }
}

export function readResourceUpdated(rootEl: XmlElement): Date {
  return extractResourceDateInfo('revision')(rootEl)
}

export function readResourceCreated(rootEl: XmlElement): Date {
  return extractResourceDateInfo('creation')(rootEl)
}

export function readResourcePublished(rootEl: XmlElement): Date {
  return extractResourceDateInfo('publication')(rootEl)
}

export function readReuseType(rootEl: XmlElement): ReuseType {
  return pipe(
    findNestedElement(
      'mdb:metadataScope',
      'mdb:MD_MetadataScope',
      'mdb:resourceScope',
      'mcc:MD_ScopeCode'
    ),
    readAttribute('codeListValue'),
    map((scopeCode): ReuseType => getReuseType(scopeCode))
  )(rootEl)
}

/**
 * Read INSPIRE topic categories from mri:topicCategory elements
 */
export function readTopics(rootEl: XmlElement): string[] {
  const identification = findIdentification()(rootEl)
  if (!identification) return []

  // Find all mri:topicCategory elements, extract their MD_TopicCategoryCode text
  const topicElements = allChildrenElement(identification).filter(
    (child) => child.name === 'mri:topicCategory'
  )

  return topicElements
    .map((el) => {
      const codeEl = findChildElement('mri:MD_TopicCategoryCode')(el)
      // The text content is directly in the mri:MD_TopicCategoryCode element, not in gco:CharacterString
      return codeEl ? readText()(codeEl) : null
    })
    .filter((v) => v) as string[]
}

export function readSubTopics(rootEl: XmlElement): string[] {
  const identification = findIdentification()(rootEl)
  if (!identification) return []

  // Find all che:subTopicCategory elements
  const subTopicEls = allChildrenElement(identification).filter(
    (child) => child.name === 'che:subTopicCategory'
  )

  return subTopicEls
    .map((el) => {
      const codeEl = findChildElement('che:CHE_MD_SubTopicCategoryCode')(el)
      // Read the codeListValue attribute (CHE_MD_SubTopicCategoryCode is self-closing)
      return codeEl ? readAttribute('codeListValue')(codeEl) : null
    })
    .filter((v) => v) as string[]
}

const getMimeType = pipe(
  findParent('mrd:MD_Distribution'),
  findNestedElement(
    'mrd:distributionFormat',
    'mrd:MD_Format',
    'mrd:formatSpecificationCitation',
    'cit:CI_Citation',
    'cit:title'
  ),
  extractCharacterString(),
  map(matchMimeType)
)

export function readOnlineResources(rootEl: XmlElement): OnlineResource[] {
  let getOnlineResources: ChainableFunction<XmlElement, OnlineResource[]>
  if (readKind(rootEl) === 'dataset') {
    getOnlineResources = extractDatasetOnlineResources(getMimeType)
  } else if (readKind(rootEl) === 'service') {
    getOnlineResources = extractServiceOnlineResources()
  } else {
    getOnlineResources = extractReuseOnlineResources()
  }
  return pipe(
    findNestedElements('mrd:distributionInfo', 'mrd:MD_Distribution'),
    mapArray(getOnlineResources),
    flattenArray()
  )(rootEl)
}

export function readLocaleElement(): ChainableFunction<
  XmlElement,
  LanguageCode
> {
  return pipe(
    findChildElement('lan:LanguageCode'),
    readAttribute('codeListValue'),
    map((lang) => toLang2(lang?.toLowerCase()) ?? lang)
  )
}

export function readDefaultLanguage(rootEl: XmlElement): LanguageCode {
  return pipe(
    findChildElement('mdb:defaultLocale', false),
    readLocaleElement()
  )(rootEl)
}

export function readOtherLanguages(rootEl: XmlElement): LanguageCode[] {
  return pipe(
    findChildrenElement('mdb:otherLocale', false),
    mapArray(readLocaleElement()),
    map((languages) =>
      languages.filter((lang): lang is LanguageCode => lang !== null)
    )
  )(rootEl)
}

/**
 * Find the identification element in ISO19115-3 CHE format
 * Uses mdb:identificationInfo (not gmd:identificationInfo as in ISO19139)
 * and finds mri:MD_DataIdentification or che:CHE_MD_DataIdentification children
 */
export function findIdentification19115() {
  return pipe(
    findChildElement('mdb:identificationInfo', false),
    combine(
      findChildElement('mri:MD_DataIdentification', false),
      findChildElement('che:CHE_MD_DataIdentification', false)
    ),
    filterArray((el) => el !== null),
    getAtIndex(0)
  )
}

/**
 * Read spatial extents from ISO19115-3 format (gex namespace)
 * Handles both direct geometry/bbox and subtemplate references via xlink:href
 */
export function readSpatialExtents(rootEl: XmlElement): DatasetSpatialExtent[] {
  const extractGeometry = (rootEl: XmlElement): Geometry => {
    if (!rootEl) return null
    return pipe(
      findChildElement('gex:polygon', false),
      map((el) => (el ? readGeometry(el) : null))
    )(rootEl)
  }

  const extractBBox = (
    rootEl: XmlElement
  ): [number, number, number, number] => {
    if (!rootEl) return null
    return pipe(
      combine(
        pipe(findChildElement('gex:westBoundLongitude'), extractDecimal()),
        pipe(findChildElement('gex:southBoundLatitude'), extractDecimal()),
        pipe(findChildElement('gex:eastBoundLongitude'), extractDecimal()),
        pipe(findChildElement('gex:northBoundLatitude'), extractDecimal())
      )
    )(rootEl)
  }

  const extractDescription = (
    rootEl: XmlElement
  ): [string, ModelTranslations] => {
    if (!rootEl) return [null, {}]
    return pipe(
      findChildElement('gex:description', false),
      extractLocalizedCharacterString('description')
    )(rootEl)
  }

  const extractSubtemplateHref = (rootEl: XmlElement): string => {
    if (!rootEl) return null
    return readAttribute('xlink:href')(rootEl)
  }

  // Find all mri:extent elements
  return pipe(
    findIdentification19115(),
    findChildrenElement('mri:extent', false),
    mapArray((extentEl) => {
      // Get the gex:EX_Extent child
      const exExtentEl = findChildElement('gex:EX_Extent', false)(extentEl)

      if (!exExtentEl) return null

      // Extract all components
      const subtemplateHref = extractSubtemplateHref(extentEl)
      const [description, translations] = extractDescription(exExtentEl)

      const boundingBoxEl = findChildElement(
        'gex:EX_BoundingBox',
        false
      )(exExtentEl)
      const boundingPolygonEl = findChildElement(
        'gex:EX_BoundingPolygon',
        false
      )(exExtentEl)

      const geometry = extractGeometry(boundingPolygonEl)
      const bbox = extractBBox(boundingBoxEl)

      // Skip if no content
      if (!geometry && !bbox && !description && !subtemplateHref) {
        return null
      }

      const extent: DatasetSpatialExtent = {}

      if (description) {
        extent.description = description
        if (Object.keys(translations).length > 0) {
          extent.translations = {
            description: translations as Record<string, string>
          }
        }
      }

      if (geometry) {
        extent.geometry = geometry
      }

      if (bbox) {
        extent.bbox = bbox
      }

      // If this is a subtemplate reference, store the href
      if (subtemplateHref) {
        extent.subtemplateUuid = subtemplateHref
      }
      return extent
    }),
    filterArray((el) => el !== null)
  )(rootEl)
}
