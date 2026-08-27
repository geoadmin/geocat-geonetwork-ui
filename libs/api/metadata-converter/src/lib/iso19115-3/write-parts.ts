import {
  CatalogRecord,
  DatasetRecord,
  FieldTranslation,
  Individual,
  LanguageCode,
} from '@geonetwork-ui/common/domain/model/record'
import {
  allChildrenElement,
  appendChildren,
  appendChildTree,
  createChild,
  createElement,
  createNestedChild,
  createNestedElement,
  findChildElement,
  findChildOrCreate,
  findChildrenElement,
  findNestedChildOrCreate,
  findNestedElement,
  findNestedElements,
  findParent,
  readAttribute,
  removeChildren,
  removeChildrenByName,
  setTextContent,
  writeAttribute,
  XmlElement,
  parseXmlString,
  getRootElement,
  XmlDocument,
} from '../xml-utils'
import {
  ChainableFunction,
  fallback,
  filterArray,
  getAtIndex,
  map,
  mapArray,
  noop,
  pipe,
  tap,
} from '../function-utils'
import {
  appendKeywords,
  appendOnlineResource,
  appendServiceOnlineResources,
  createConstraint,
  createDistributionInfo,
  createLicense,
  findOrCreateDistribution,
  findOrCreateIdentification as findOrCreateIdentificationISO19139,
  getProgressCode,
  getRoleCode,
  removeEmptyResourceConstraints,
  removeKeywords,
  removeLegalConstraints,
  removeLicenses,
  removeOtherConstraints,
  removeSecurityConstraints,
  writeCharacterString,
  writeDateTime,
  writeLinkage,
  writeLocalizedCharacterString,
  getISODuration,
  writeDecimal,
} from '../iso19139/write-parts'
import { writeGeometry } from '../iso19139/utils/geometry'
import { findIdentification } from '../iso19139/read-parts'
import { findIdentification19115 } from './read-parts'
import { readKind } from './read-parts'
import { namePartsToFull } from '../iso19139/utils/individual-name'
import { toLang3 } from '@geonetwork-ui/util/i18n/language-codes'
import { kindToCodeListValue } from '../common/resource-types'

/**
 * ISO19115-3 version of writeLocalizedCharacterString
 * Generates proper CHE19115-3.2018 multilingual structure with PT_FreeText
 *
 * Structure:
 * <cit:title xsi:type="lan:PT_FreeText_PropertyType">
 *   <gco:CharacterString>DEFAULT_TEXT</gco:CharacterString>
 *   <lan:PT_FreeText>
 *     <lan:textGroup>
 *       <lan:LocalisedCharacterString locale="#LANG">TRANSLATION</lan:LocalisedCharacterString>
 *     </lan:textGroup>
 *   </lan:PT_FreeText>
 * </cit:title>
 *
 * When translations exist: adds xsi:type and creates BOTH gco:CharacterString + lan:PT_FreeText
 * When no translations: writes only gco:CharacterString without xsi:type
 */
function writeLocalizedElement19115(
  parentElement: XmlElement,
  text: string,
  translations: FieldTranslation,
  defaultLanguage: LanguageCode
): XmlElement {
  if (!translations || Object.keys(translations).length === 0) {
    // No translations: write simple CharacterString, remove PT_FreeText if present
    removeChildrenByName('lan:PT_FreeText')(parentElement)
    removeChildrenByName('gco:CharacterString')(parentElement)
    pipe(
      createChild('gco:CharacterString'),
      setTextContent(text)
    )(parentElement)
    return parentElement
  }

  // Has translations: add xsi:type attribute and create both CharacterString + PT_FreeText
  writeAttribute('xsi:type', 'lan:PT_FreeText_PropertyType')(parentElement)

  // Remove old PT_FreeText if present (we'll recreate it)
  removeChildrenByName('lan:PT_FreeText')(parentElement)
  removeChildrenByName('gmd:PT_FreeText')(parentElement)

  // Write default language as gco:CharacterString
  removeChildrenByName('gco:CharacterString')(parentElement)
  pipe(
    createChild('gco:CharacterString'),
    setTextContent(text)
  )(parentElement)

  // Create lan:PT_FreeText with all localized versions
  const ptFreeTextEl = pipe(
    createChild('lan:PT_FreeText')
  )(parentElement)

  // Add textGroup for default language
  pipe(
    createChild('lan:textGroup'),
    (tg: XmlElement) => {
      pipe(
        createChild('lan:LocalisedCharacterString'),
        writeAttribute('locale', `#${defaultLanguage.toUpperCase()}`),
        setTextContent(text)
      )(tg)
      return tg
    }
  )(ptFreeTextEl)

  // Add textGroups for other languages
  for (const [lang, translation] of Object.entries(translations)) {
    pipe(
      createChild('lan:textGroup'),
      (tg: XmlElement) => {
        pipe(
          createChild('lan:LocalisedCharacterString'),
          writeAttribute('locale', `#${lang.toUpperCase()}`),
          setTextContent(translation)
        )(tg)
        return tg
      }
    )(ptFreeTextEl)
  }

  return parentElement
}

export function writeLocalizedCharacterString19115(
  text: string,
  translations: FieldTranslation,
  defaultLanguage: LanguageCode
): ChainableFunction<XmlElement, XmlElement> {
  return (parentElement: XmlElement) => {
    return writeLocalizedElement19115(parentElement, text, translations, defaultLanguage)
  }
}

/**
 * ISO19115-3 version of findOrCreateIdentification that handles:
 * - Standard ISO19115-3: mdb:identificationInfo/mri:MD_DataIdentification
 * - Service identification: mdb:identificationInfo/srv:SV_ServiceIdentification
 * - CHE variant: mdb:identificationInfo/che:CHE_MD_DataIdentification
 *
 * Returns the FIRST (and only) identification element to prevent duplication
 * Removes all duplicate identification elements under mdb:identificationInfo
 */
export function findOrCreateIdentification() {
  return (rootEl: XmlElement) => {
    const kind = readKind(rootEl)
    const identificationInfoEl = findChildOrCreate('mdb:identificationInfo')(rootEl)

    // Try to find existing identification element - return the first one found
    // This prevents creating duplicate identificationInfo elements
    let identEl = findChildElement('mri:MD_DataIdentification')(identificationInfoEl)
    if (identEl) {
      // Clean up duplicate identifications of different types
      removeDuplicateIdentifications('mri:MD_DataIdentification', identificationInfoEl)
      return identEl
    }

    if (kind === 'service') {
      identEl = findChildElement('srv:SV_ServiceIdentification')(identificationInfoEl)
      if (identEl) {
        removeDuplicateIdentifications('srv:SV_ServiceIdentification', identificationInfoEl)
        return identEl
      }
    }

    // Check for CHE variant (Swiss extension)
    identEl = findChildElement('che:CHE_MD_DataIdentification')(identificationInfoEl)
    if (identEl) {
      removeDuplicateIdentifications('che:CHE_MD_DataIdentification', identificationInfoEl)
      return identEl
    }

    // Create appropriate element based on kind
    let eltName = 'mri:MD_DataIdentification'
    if (kind === 'service') eltName = 'srv:SV_ServiceIdentification'

    // Clean before creating to ensure only one
    removeDuplicateIdentifications(eltName, identificationInfoEl)
    return createChild(eltName)(identificationInfoEl)
  }
}

/**
 * Remove all duplicate identification elements except the first occurrence of keepName
 * Cleans up elements that might be left from reference record merging
 */
function removeDuplicateIdentifications(keepName: string, parent: XmlElement): void {
  const children = allChildrenElement(parent)
  let foundFirst = false
  const toRemoveIndices: number[] = []

  // Find indices of elements to remove
  for (const child of children) {
    const isIdentification =
      child.name === 'mri:MD_DataIdentification' ||
      child.name === 'che:CHE_MD_DataIdentification' ||
      child.name === 'srv:SV_ServiceIdentification'

    if (isIdentification) {
      if (child.name === keepName && !foundFirst) {
        // Keep the first occurrence of the desired type
        foundFirst = true
      } else {
        // Mark for removal
        const idx = parent.children.indexOf(child)
        if (idx > -1) {
          toRemoveIndices.push(idx)
        }
      }
    }
  }

  // Remove in reverse order to preserve indices
  toRemoveIndices.sort((a, b) => b - a)
  for (const idx of toRemoveIndices) {
    parent.children.splice(idx, 1)
  }
}

export function writeUniqueIdentifier(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  pipe(
    findNestedChildOrCreate(
      'mdb:metadataIdentifier',
      'mcc:MD_Identifier',
      'mcc:code'
    ),
    writeCharacterString(record.uniqueIdentifier)
  )(rootEl)
}

export function writeKind(record: CatalogRecord, rootEl: XmlElement) {
  const kind = kindToCodeListValue(record)
  pipe(
    findNestedChildOrCreate(
      'mdb:metadataScope',
      'mdb:MD_MetadataScope',
      'mdb:resourceScope',
      'mcc:MD_ScopeCode'
    ),
    writeAttribute(
      'codeList',
      'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_ScopeCode'
    ),
    writeAttribute('codeListValue', kind),
    setTextContent(kind)
  )(rootEl)
}

/**
 * Remove record date entry by type
 * Correctly traverses: mdb:dateInfo/cit:CI_Date/cit:dateType/cit:CI_DateTypeCode
 */
function removeRecordDate(type: 'revision' | 'creation' | 'publication') {
  return (rootEl: XmlElement) => {
    const dateInfos = allChildrenElement(rootEl).filter(
      (child) => child.name === 'mdb:dateInfo'
    )
    const toRemove: XmlElement[] = []

    for (const dateInfo of dateInfos) {
      const ciDate = findChildElement('cit:CI_Date')(dateInfo)
      if (!ciDate) continue

      const dateType = findChildElement('cit:dateType')(ciDate)
      if (!dateType) continue

      const codeEl = findChildElement('cit:CI_DateTypeCode')(dateType)
      if (!codeEl) continue

      const codeValue = readAttribute('codeListValue')(codeEl)
      if (codeValue === type) {
        toRemove.push(dateInfo)
      }
    }

    // Remove in reverse order to preserve indices
    toRemove.reverse().forEach((el) => {
      const idx = rootEl.children.indexOf(el)
      if (idx > -1) {
        rootEl.children.splice(idx, 1)
      }
    })

    return rootEl
  }
}

function appendRecordDate(
  date: Date,
  type: 'revision' | 'creation' | 'publication'
) {
  return appendChildren(
    pipe(
      createElement('mdb:dateInfo'),
      createChild('cit:CI_Date'),
      appendChildren(
        pipe(createElement('cit:date'), writeDateTime(date)),
        pipe(
          createElement('cit:dateType'),
          createChild('cit:CI_DateTypeCode'),
          writeAttribute(
            'codeList',
            'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_DateTypeCode'
          ),
          writeAttribute('codeListValue', type),
          setTextContent(type)
        )
      )
    )
  )
}

export function writeRecordUpdated(record: CatalogRecord, rootEl: XmlElement) {
  removeRecordDate('revision')(rootEl)
  if (!record.recordUpdated) return
  appendRecordDate(record.recordUpdated, 'revision')(rootEl)
}

export function writeRecordCreated(record: CatalogRecord, rootEl: XmlElement) {
  removeRecordDate('creation')(rootEl)
  if (!record.recordCreated) return
  appendRecordDate(record.recordCreated, 'creation')(rootEl)
}

export function writeRecordPublished(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  removeRecordDate('publication')(rootEl)
  if (!record.recordPublished) return
  appendRecordDate(record.recordPublished, 'publication')(rootEl)
}

/**
 * Remove resource date entry by type
 * Correctly traverses: cit:date/cit:CI_Date/cit:dateType/cit:CI_DateTypeCode
 */
function removeResourceDate(type: 'revision' | 'creation' | 'publication') {
  return pipe(
    findOrCreateIdentification(),
    // Search for cit:date directly under identification, NOT under citation!
    (identEl: XmlElement) => {
      const dateLists = allChildrenElement(identEl).filter(
        (child) => child.name === 'cit:date'
      )
      const toRemove: XmlElement[] = []

      for (const dateList of dateLists) {
        const ciDate = findChildElement('cit:CI_Date')(dateList)
        if (!ciDate) continue

        const dateType = findChildElement('cit:dateType')(ciDate)
        if (!dateType) continue

        const codeEl = findChildElement('cit:CI_DateTypeCode')(dateType)
        if (!codeEl) continue

        const codeValue = readAttribute('codeListValue')(codeEl)
        if (codeValue === type) {
          toRemove.push(dateList)
        }
      }

      // Remove in reverse order to preserve indices
      toRemove.reverse().forEach((el) => {
        const idx = identEl.children.indexOf(el)
        if (idx > -1) {
          identEl.children.splice(idx, 1)
        }
      })

      return identEl
    }
  )
}

function appendResourceDate(
  date: Date,
  type: 'revision' | 'creation' | 'publication'
) {
  return pipe(
    findIdentification19115(),
    // Add cit:date directly under identification, NOT under citation!
    // ISO19115-3 structure: identification/cit:date (NOT citation/cit:date)
    appendChildren(
      pipe(
        createElement('cit:date'),
        createChild('cit:CI_Date'),
        appendChildren(
          pipe(createElement('cit:date'), writeDateTime(date)),
          pipe(
            createElement('cit:dateType'),
            createChild('cit:CI_DateTypeCode'),
            writeAttribute(
              'codeList',
              'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_DateTypeCode'
            ),
            writeAttribute('codeListValue', type),
            setTextContent(type)
          )
        )
      )
    )
  )
}

export function writeResourceUpdated(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  removeResourceDate('revision')(rootEl)
  if (!record.resourceUpdated) return
  appendResourceDate(record.resourceUpdated, 'revision')(rootEl)
}

export function writeResourceCreated(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  removeResourceDate('creation')(rootEl)
  if (!record.resourceCreated) return
  appendResourceDate(record.resourceCreated, 'creation')(rootEl)
}

export function writeResourcePublished(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  removeResourceDate('publication')(rootEl)
  if (!record.resourcePublished) return
  appendResourceDate(record.resourcePublished, 'publication')(rootEl)
}

export function writeReuseType(record: CatalogRecord, rootEl: XmlElement) {
  writeKind(record, rootEl)
}

export function appendResponsibleParty(
  contact: Individual,
  defaultLanguage: LanguageCode
) {
  const fullName = namePartsToFull(contact.firstName, contact.lastName)

  const createIndividual = pipe(
    createElement('cit:individual'),
    createChild('cit:CI_Individual'),
    fullName
      ? appendChildren(
          pipe(createElement('cit:name'), writeCharacterString(fullName))
        )
      : noop,
    contact.position
      ? appendChildren(
          pipe(
            createElement('cit:positionName'),
            writeCharacterString(contact.position)
          )
        )
      : noop
  )

  const createContactInfo = pipe(
    createElement('cit:contactInfo'),
    createChild('cit:CI_Contact'),
    appendChildren(
      pipe(
        createElement('cit:address'),
        createChild('cit:CI_Address'),
        appendChildren(
          pipe(
            createElement('cit:electronicMailAddress'),
            writeCharacterString(contact.email)
          )
        ),
        contact.address
          ? appendChildren(
              pipe(
                createElement('cit:deliveryPoint'),
                writeCharacterString(contact.address)
              )
            )
          : noop
      )
    ),
    contact.organization?.website
      ? appendChildren(
          pipe(
            createElement('cit:onlineResource'),
            createChild('cit:CI_OnlineResource'),
            createChild('cit:linkage'),
            writeCharacterString(contact.organization.website.toString())
          )
        )
      : noop,
    contact.phone
      ? appendChildren(
          pipe(
            createElement('cit:phone'),
            createChild('cit:CI_Telephone'),
            createChild('cit:number'),
            writeCharacterString(contact.phone)
          )
        )
      : noop
  )

  const createRole = pipe(
    createElement('cit:role'),
    createChild('cit:CI_RoleCode'),
    writeAttribute(
      'codeList',
      'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_RoleCode'
    ),
    writeAttribute('codeListValue', getRoleCode(contact.role)),
    setTextContent(getRoleCode(contact.role))
  )

  const createParty = pipe(
    createElement('cit:party'),
    createChild('cit:CI_Organisation'),
    contact.organization?.name
      ? appendChildren(
          pipe(
            createElement('cit:name'),
            writeLocalizedCharacterString(
              contact.organization?.name,
              contact.organization?.translations?.name,
              defaultLanguage
            )
          )
        )
      : noop,
    appendChildren(createContactInfo, createIndividual)
  )

  return appendChildren(
    pipe(
      createElement('cit:CI_Responsibility'),
      appendChildren(createRole, createParty)
    )
  )
}

export function writeContacts(record: CatalogRecord, rootEl: XmlElement) {
  pipe(
    removeChildrenByName('mdb:contact'),
    appendChildren(
      ...(record.contacts || []).map((contact) =>
        pipe(
          createElement('gmd:contact'),
          appendResponsibleParty(contact, record.defaultLanguage)
        )
      )
    )
  )(rootEl)
}

export function writeContactsForResource(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  const contactsForResource = record.contactsForResource || []
  const withoutDistributors = contactsForResource.filter(
    (c) => c.role !== 'distributor'
  )
  const distributors = contactsForResource.filter(
    (c) => c.role === 'distributor'
  )
  pipe(
    findOrCreateIdentification(),
    removeChildrenByName('mri:pointOfContact'),
    appendChildren(
      ...withoutDistributors.map((contact) =>
        pipe(
          createElement('mri:pointOfContact'),
          appendResponsibleParty(contact, record.defaultLanguage)
        )
      )
    )
  )(rootEl)
  if (!distributors.length) return
  pipe(
    findOrCreateDistribution(),
    removeChildrenByName('mrd:distributor'),
    createChild('mrd:distributor'),
    createChild('mrd:MD_Distributor'),
    appendChildren(
      ...distributors.map((contact) =>
        pipe(
          createElement('mrd:distributorContact'),
          appendResponsibleParty(contact, record.defaultLanguage)
        )
      )
    )
  )(rootEl)
}

export function writeKeywords(record: CatalogRecord, rootEl: XmlElement) {
  pipe(
    findOrCreateIdentification(),
    removeKeywords(),
    appendKeywords(record.keywords, record.defaultLanguage)
  )(rootEl)
}

export function writeLandingPage(record: DatasetRecord, rootEl: XmlElement) {
  pipe(
    findNestedChildOrCreate(
      'mdb:metadataLinkage',
      'cit:CI_OnlineResource',
      'cit:linkage'
    ),
    writeLinkage(record.landingPage)
  )(rootEl)
}

export function writeLineage(record: DatasetRecord, rootEl: XmlElement) {
  // Only write lineage if it exists and is not empty
  if (!record.lineage || record.lineage.trim() === '') {
    // Remove lineage element if it exists
    pipe(
      (el: XmlElement) => {
        removeChildrenByName('mdb:resourceLineage')(el)
        return el
      }
    )(rootEl)
    return
  }

  pipe(
    findNestedChildOrCreate(
      'mdb:resourceLineage',
      'mrl:LI_Lineage',
      'mrl:statement'
    ),
    writeLocalizedCharacterString(
      record.lineage,
      record.translations?.lineage,
      record.defaultLanguage
    )
  )(rootEl)
}

export function writeStatus(record: DatasetRecord, rootEl: XmlElement) {
  const progressCode = getProgressCode(record.status)
  pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:status', 'mcc:MD_ProgressCode'),
    writeAttribute(
      'codeList',
      'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_ProgressCode'
    ),
    writeAttribute('codeListValue', progressCode),
    setTextContent(progressCode)
  )(rootEl)
}

export function writeSpatialRepresentation(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  if (!record.spatialRepresentation) {
    pipe(
      findOrCreateIdentification(),
      removeChildrenByName('mri:spatialRepresentationType')
    )(rootEl)
    return
  }
  pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate(
      'mri:spatialRepresentationType',
      'mcc:MD_SpatialRepresentationTypeCode'
    ),
    writeAttribute(
      'codeList',
      'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_SpatialRepresentationTypeCode'
    ),
    writeAttribute('codeListValue', record.spatialRepresentation),
    setTextContent(record.spatialRepresentation)
  )(rootEl)
}

// this will remove all transfer options and formats from distribution info
// and remove empty distribution info
function removeTransferOptions(rootEl: XmlElement) {
  // remove transfer options & formats
  pipe(
    findNestedElements('mdb:distributionInfo', 'mrd:MD_Distribution'),
    mapArray(
      pipe(
        removeChildren(findChildrenElement('mrd:distributionFormat', false)),
        removeChildren(findChildrenElement('mrd:transferOptions', false))
      )
    )
  )(rootEl)
  // remove empty distributions
  removeChildren(
    pipe(
      findChildrenElement('mdb:distributionInfo', false),
      filterArray(
        pipe(
          findChildElement('mrd:MD_Distribution'),
          allChildrenElement,
          map((children) => children.length === 0)
        )
      )
    )
  )(rootEl)
}

function appendOnlineResourceFormat(mimeType: string) {
  return appendChildren(
    pipe(
      createElement('mrd:distributionFormat'),
      createChild('mrd:MD_Format'),
      createChild('mrd:formatSpecificationCitation'),
      createChild('cit:CI_Citation'),
      createChild('cit:title'),
      writeCharacterString(mimeType)
    )
  )
}

function writeLocaleElement(language: LanguageCode) {
  const lang3 = toLang3(language.toLowerCase()) ?? language
  return pipe(
    findChildOrCreate('lan:PT_Locale'),
    writeAttribute('id', language.toUpperCase()),
    findNestedChildOrCreate('lan:language', 'lan:LanguageCode'),
    writeAttribute('codeList', 'http://www.loc.gov/standards/iso639-2/'),
    writeAttribute('codeListValue', lang3),
    // CHE schema requires either country or characterEncoding in PT_Locale
    (el: XmlElement) => {
      const ptLocaleEl = findParent('lan:PT_Locale')(el)
      if (ptLocaleEl) {
        // Add characterEncoding if not present
        if (!findChildElement('lan:characterEncoding')(ptLocaleEl)) {
          appendChildren(
            pipe(
              createElement('lan:characterEncoding'),
              createChild('lan:MD_CharacterSetCode'),
              writeAttribute(
                'codeList',
                'http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_CharacterSetCode'
              ),
              writeAttribute('codeListValue', 'utf8')
            )
          )(ptLocaleEl)
        }
      }
      return el
    }
  )
}

export function writeDefaultLanguage(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  pipe(
    findChildOrCreate('mdb:defaultLocale'),
    writeLocaleElement(record.defaultLanguage)
  )(rootEl)
}

export function writeOtherLanguages(record: DatasetRecord, rootEl: XmlElement) {
  // clear existing
  removeChildrenByName('mdb:otherLocale')(rootEl)

  // do not write down languages if there is nothing else than the default one
  if (!record.otherLanguages?.length) {
    return
  }

  appendChildren(
    ...record.otherLanguages.map((lang: LanguageCode) =>
      pipe(createElement('mdb:otherLocale'), writeLocaleElement(lang))
    )
  )(rootEl)
}

/**
 * Write citation dates for ISO19115-3 format
 * Structure: mri:citation/cit:CI_Citation/cit:date/cit:CI_Date/[cit:date, cit:dateType]
 * Writes both creation date and revision date if available
 */
/**
 * Write citation dates for ISO19115-3 format
 * Structure: mri:citation/cit:CI_Citation/cit:date/cit:CI_Date/[cit:date, cit:dateType]
 * Writes both creation date and revision date if available
 */
export function writeCitationDates(record: CatalogRecord, rootEl: XmlElement) {
  const citCitationEl = pipe(
    findOrCreateIdentification(),
    (identEl: XmlElement) => {
      const citationEl = findChildOrCreate('mri:citation')(identEl)
      return findChildOrCreate('cit:CI_Citation')(citationEl)
    }
  )(rootEl)

  if (!citCitationEl || !record.recordCreated) return

  // Remove existing date elements to avoid duplicates
  removeChildrenByName('cit:date')(citCitationEl)

  const dateStr = record.recordCreated.toISOString().split('T')[0]

  // Find identifier position to insert date before it
  const childElements = allChildrenElement(citCitationEl)
  const actualIndex = citCitationEl.children?.findIndex(
    (child) =>
      child instanceof XmlElement &&
      childElements.includes(child as XmlElement) &&
      child.name?.includes('identifier')
  ) ?? -1

  // Build structure: <cit:date><cit:CI_Date><cit:date><gco:Date>dateStr</gco:Date></cit:date><cit:dateType>...</cit:dateType></cit:CI_Date></cit:date>
  // Create the complete structure using direct element creation
  const dateWrapper = createElement('cit:date')()
  if (!dateWrapper) return

  // Create cit:CI_Date
  const ciDate = createElement('cit:CI_Date')()
  ciDate.parent = dateWrapper
  dateWrapper.children = [ciDate]

  // Create cit:date property (for date value)
  const dateProperty = createElement('cit:date')()

  // Create gco:Date and set its text content
  const dateValue = createElement('gco:Date')()
  pipe(setTextContent(dateStr))(dateValue)

  dateValue.parent = dateProperty
  dateProperty.children = [dateValue]
  dateProperty.parent = ciDate

  // Create cit:dateType property
  const dateType = createElement('cit:dateType')()

  // Create cit:CI_DateTypeCode with attributes
  const dateTypeCode = createElement('cit:CI_DateTypeCode')()
  dateTypeCode.attributes = {
    codeList: 'http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_DateTypeCode',
    codeListValue: 'creation'
  }
  pipe(setTextContent('creation'))(dateTypeCode)

  dateTypeCode.parent = dateType
  dateType.children = [dateTypeCode]
  dateType.parent = ciDate

  // Add both property children to ciDate
  ciDate.children = [dateProperty, dateType]

  // Insert into citation
  if (!citCitationEl.children) citCitationEl.children = []

  if (actualIndex >= 0) {
    citCitationEl.children.splice(actualIndex, 0, dateWrapper as any)
  } else {
    citCitationEl.children.push(dateWrapper as any)
  }
  dateWrapper.parent = citCitationEl
}

/**
 * ISO19115-3 override of writeTitle
 * Uses proper ISO19115-3 namespaces and prevents duplicate CharacterString
 * CRITICAL: Inserts title at the BEGINNING of cit:CI_Citation to maintain XML element order
 */
export function writeTitle(record: CatalogRecord, rootEl: XmlElement) {
  // CRITICAL: Always update title, even if fieldChanged() returns false
  // This ensures multilingual titles are preserved through save cycles
  if (!record.title && (!record.translations?.title || Object.keys(record.translations.title).length === 0)) {
    // Only skip if there's truly no title data at all
    return
  }

  const citCitationEl = pipe(
    findOrCreateIdentification(),
    (identEl: XmlElement) => {
      const citationEl = findChildOrCreate('mri:citation')(identEl)
      return findChildOrCreate('cit:CI_Citation')(citationEl)
    }
  )(rootEl)

  if (!citCitationEl) return

  // REMOVE existing title element to avoid duplicates
  removeChildrenByName('cit:title')(citCitationEl)

  // Create title element
  const titleEl = createElement('cit:title')()

  // Insert at BEGINNING of children array to maintain XML schema order
  // (title must come before date, identifier, etc.)
  citCitationEl.children = citCitationEl.children || []
  citCitationEl.children.unshift(titleEl)
  titleEl.parent = citCitationEl

  // Now write the title content
  pipe(
    writeLocalizedCharacterString19115(
      record.title,
      record.translations?.title,
      record.defaultLanguage
    )
  )(titleEl)
}

/**
 * ISO19115-3 override of writeAbstract
 * Uses proper ISO19115-3 namespaces and prevents duplicate CharacterString
 */
export function writeAbstract(record: CatalogRecord, rootEl: XmlElement) {
  // CRITICAL: Always update abstract, even if fieldChanged() returns false
  if (!record.abstract && (!record.translations?.abstract || Object.keys(record.translations.abstract).length === 0)) {
    return
  }

  pipe(
    findOrCreateIdentification(),
    (identEl: XmlElement) => {
      // REMOVE existing abstract to avoid duplicates
      removeChildrenByName('mri:abstract')(identEl)
      return identEl
    },
    createChild('mri:abstract'),
    writeLocalizedCharacterString19115(
      record.abstract,
      record.translations?.abstract,
      record.defaultLanguage
    )
  )(rootEl)
}

/**
 * Write update frequency for ISO19115-3 format (mmi namespace)
 */
export function writeUpdateFrequency(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  const maintenanceEl = pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:resourceMaintenance', 'mmi:MD_MaintenanceInformation')
  )(rootEl)

  if (!maintenanceEl) return

  // Remove existing frequency elements
  removeChildrenByName('mmi:maintenanceAndUpdateFrequency')(maintenanceEl)
  removeChildrenByName('mmi:userDefinedMaintenanceFrequency')(maintenanceEl)

  if (typeof record.updateFrequency === 'object') {
    // User-defined maintenance frequency with ISO 8601 duration
    appendChildren(
      pipe(
        createElement('mmi:userDefinedMaintenanceFrequency'),
        createChild('gco:TM_PeriodDuration'),
        setTextContent(getISODuration(record.updateFrequency))
      )
    )(maintenanceEl)
  } else {
    // Standard maintenance frequency code
    const freqStr = typeof record.updateFrequency === 'string' ? record.updateFrequency : 'unknown'
    appendChildren(
      pipe(
        createElement('mmi:maintenanceAndUpdateFrequency'),
        createChild('mmi:MD_MaintenanceFrequencyCode'),
        writeAttribute(
          'codeList',
          'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_MaintenanceFrequencyCode'
        ),
        writeAttribute('codeListValue', freqStr),
        setTextContent(freqStr)
      )
    )(maintenanceEl)
  }
}

/**
 * Write metadata maintenance frequency (not resource maintenance)
 * Structure: mdb:metadataMaintenance/che:CHE_MD_MaintenanceInformation/mmi:maintenanceAndUpdateFrequency
 * This is required by ISO19115-3.2018.che for dataset, series, and service records
 */
export function writeMetadataMaintenance(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  // Skip if no update frequency defined
  if (!record.updateFrequency) {
    return
  }

  const metadataMaintenanceEl = findChildOrCreate('mdb:metadataMaintenance')(rootEl)
  if (!metadataMaintenanceEl) return

  // CRITICAL: Remove ALL existing maintenance information elements to avoid duplicates
  // The parent converter may have created mmi:MD_MaintenanceInformation elements
  // We replace them all with a single CHE variant
  removeChildrenByName('mmi:MD_MaintenanceInformation')(metadataMaintenanceEl)
  removeChildrenByName('che:CHE_MD_MaintenanceInformation')(metadataMaintenanceEl)

  // Create ONLY the CHE variant with gco:isoType attribute
  const cheMaintenanceEl = pipe(
    createElement('che:CHE_MD_MaintenanceInformation'),
    (el: XmlElement) => {
      writeAttribute('gco:isoType', 'mmi:MD_MaintenanceInformation')(el)
      return el
    }
  )()

  // Remove existing frequency elements from the CHE element
  removeChildrenByName('mmi:maintenanceAndUpdateFrequency')(cheMaintenanceEl)
  removeChildrenByName('mmi:userDefinedMaintenanceFrequency')(cheMaintenanceEl)

  if (typeof record.updateFrequency === 'object') {
    // User-defined maintenance frequency with ISO 8601 duration
    appendChildren(
      pipe(
        createElement('mmi:userDefinedMaintenanceFrequency'),
        createChild('gco:TM_PeriodDuration'),
        setTextContent(getISODuration(record.updateFrequency))
      )
    )(cheMaintenanceEl)
  } else {
    // Standard maintenance frequency code
    const freqStr = typeof record.updateFrequency === 'string' ? record.updateFrequency : 'unknown'
    appendChildren(
      pipe(
        createElement('mmi:maintenanceAndUpdateFrequency'),
        createChild('mmi:MD_MaintenanceFrequencyCode'),
        writeAttribute(
          'codeList',
          'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#MD_MaintenanceFrequencyCode'
        ),
        writeAttribute('codeListValue', freqStr),
        setTextContent(freqStr)
      )
    )(cheMaintenanceEl)
  }

  // Add the CHE element to mdb:metadataMaintenance
  if (!metadataMaintenanceEl.children) metadataMaintenanceEl.children = []
  metadataMaintenanceEl.children.push(cheMaintenanceEl)
  cheMaintenanceEl.parent = metadataMaintenanceEl
}


/**
 * ISO19115-3 override: Write resource identifier (first one) to citation
 * Structure: mdb:identificationInfo/che:CHE_MD_DataIdentification/mri:citation/cit:CI_Citation/cit:identifier/mcc:MD_Identifier/mcc:code
 */
export function writeResourceIdentifier(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  const firstIdentifier = record.resourceIdentifiers?.[0]?.code

  pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:citation', 'cit:CI_Citation'),
    removeChildrenByName('cit:identifier'),
    firstIdentifier
      ? pipe(
          createNestedChild('cit:identifier', 'mcc:MD_Identifier', 'mcc:code'),
          writeCharacterString(firstIdentifier)
        )
      : noop
  )(rootEl)
}

/**
 * Write spatial extents for ISO19115-3 format with multilingual descriptions
 */
/**
 * Deep clone an XML element and all its children
 * Used to copy elements from parsed subtemplates into new documents
 */
function cloneElement(source: XmlElement): XmlElement {
  const cloned = new XmlElement(source.name, { ...source.attributes }, [])

  // Recursively clone all children
  if (source.children && Array.isArray(source.children)) {
    source.children.forEach((child) => {
      if (child instanceof XmlElement) {
        cloned.children.push(cloneElement(child))
      } else {
        // Keep text nodes, comments, etc. as-is
        cloned.children.push(child)
      }
    })
  }

  return cloned
}

/**
 * Create a ChainableFunction that injects subtemplate XML children into gex:EX_Extent
 */
function createExtentFromSubtemplate(
  extent: any,
  appendDescription: any
): ChainableFunction<void, XmlElement> {
  return () => {
    const extentEl = createElement('mri:extent')()

    // Add xlink:href if subtemplate
    if (extent.subtemplateUuid) {
      writeAttribute(
        'xlink:href',
        `local://srv/api/registries/entries/${extent.subtemplateUuid}?lang=fre,ger,ita,eng,roh&schema=iso19115-3.2018.che`
      )(extentEl)
    }

    // Create and populate gex:EX_Extent
    const exExtentEl = createChild('gex:EX_Extent')(extentEl)

    // Add description element if available
    if (extent.description) {
      const descEl = appendDescription(
        extent.description,
        extent.translations?.description
      )
      if (descEl) {
        descEl(exExtentEl)
      }
    }

    if (extent.subtemplateXml && typeof extent.subtemplateXml === 'string' && extent.subtemplateXml.trim()) {
      try {
        console.log('Parsing subtemplate XML:', extent.subtemplateXml.substring(0, 100))
        const doc = parseXmlString(extent.subtemplateXml)
        const subtemplateRoot = getRootElement(doc)
        if (!subtemplateRoot) {
          console.warn('No root element found in subtemplate XML')
          return extentEl
        }
        const children = allChildrenElement(subtemplateRoot)

        // Deep clone each child element and add it
        children.forEach((child) => {
          const clonedChild = cloneElement(child)
          exExtentEl.children.push(clonedChild)
        })
        console.log(
          `Injected ${children.length} children from subtemplate XML to gex:EX_Extent`
        )
      } catch (error) {
        console.error('Failed to inject subtemplate XML:', error)
        console.error('Problematic XML was:', extent.subtemplateXml?.substring(0, 200))
      }
    } else {
      console.warn('Subtemplate XML is missing, empty, or not a string')
    }

    return extentEl
  }
}

/**
 * Create a ChainableFunction that builds an extent element from geometry/bbox/description
 */
function createExtentFromGeometry(
  extent: any,
  appendBoundingPolygon: any,
  appendGeographicBoundingBox: any,
  appendDescription: any
): ChainableFunction<void, XmlElement> {
  return pipe(
    createElement('mri:extent'),
    appendChildren(
      pipe(
        createElement('gex:EX_Extent'),
        appendChildren(
          appendDescription(
            extent.description,
            extent.translations?.description
          ),
          pipe(
            createElement('gex:geographicElement'),
            appendChildren(appendBoundingPolygon(extent.geometry))
          ),
          pipe(
            createElement('gex:geographicElement'),
            appendChildren(appendGeographicBoundingBox(extent.bbox))
          )
        )
      )
    )
  )
}

export function writeSpatialExtents(record: DatasetRecord, rootEl: XmlElement) {
  const appendBoundingPolygon = (geometry?: any) => {
    if (!geometry) return null
    return pipe(
      createElement('gex:EX_BoundingPolygon'),
      appendChildren(
        pipe(
          createElement('gex:polygon'),
          appendChildren(() => writeGeometry(geometry))
        )
      )
    )
  }

  const appendGeographicBoundingBox = (
    bbox?: [number, number, number, number]
  ) => {
    if (!bbox) return null
    return pipe(
      createElement('gex:EX_GeographicBoundingBox'),
      appendChildren(
        pipe(createElement('gex:westBoundLongitude'), writeDecimal(bbox[0])),
        pipe(createElement('gex:eastBoundLongitude'), writeDecimal(bbox[2])),
        pipe(createElement('gex:southBoundLatitude'), writeDecimal(bbox[1])),
        pipe(createElement('gex:northBoundLatitude'), writeDecimal(bbox[3]))
      )
    )
  }

  const appendDescription = (
    description?: string,
    translations?: FieldTranslation
  ) => {
    if (!description) return null
    return pipe(
      createElement('gex:description'),
      writeLocalizedCharacterString19115(
        description,
        translations,
        record.defaultLanguage
      )
    )
  }

  // Get identification element
  const identification = findOrCreateIdentification()(rootEl)
  if (!identification) return

  // Clear existing extents
  removeChildrenByName('mri:extent')(identification)

  // Build extent functions - use subtemplate if available, otherwise generate from geometry
  const extentFunctions = record.spatialExtents.map((extent) => {
    if (extent.subtemplateXml) {
      return createExtentFromSubtemplate(extent, appendDescription)
    } else {
      return createExtentFromGeometry(
        extent,
        appendBoundingPolygon,
        appendGeographicBoundingBox,
        appendDescription
      )
    }
  })

  // Append all extent elements
  appendChildren(...extentFunctions)(identification)
}

/**
 * Write sub-topic categories for CHE variant
 */
export function writeSubTopicCategories(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  const identification = findOrCreateIdentification()(rootEl)
  if (!identification) return

  // Remove existing sub-topic categories
  removeChildrenByName('che:subTopicCategory')(identification)

  // Add new ones if present in record - use subTopics, NOT topics
  if (record.subTopics && record.subTopics.length > 0) {
    appendChildren(
      ...record.subTopics.map((subTopic) =>
        pipe(
          createElement('che:subTopicCategory'),
          appendChildren(
            pipe(
              createElement('che:CHE_MD_SubTopicCategoryCode'),
              writeAttribute(
                'codeList',
                'http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CHE_MD_SubTopicCategoryCode'
              ),
              writeAttribute('codeListValue', subTopic)
            )
          )
        )
      )
    )(identification)
  }
}

/**
 * Write ISO19115-3 topic categories as mri:topicCategory elements
 * (not to be confused with ISO19139 which uses a different structure)
 */
export function writeTopicsISO19115(
  record: DatasetRecord,
  rootEl: XmlElement
) {
  const identification = findOrCreateIdentification()(rootEl)
  if (!identification) return

  // Remove existing topic categories
  removeChildrenByName('mri:topicCategory')(identification)

  // Add new ones if present in record
  if (record.topics && record.topics.length > 0) {
    appendChildren(
      ...record.topics.map((topic) =>
        pipe(
          createElement('mri:topicCategory'),
          appendChildren(
            pipe(
              createElement('mri:MD_TopicCategoryCode'),
              setTextContent(topic)
            )
          )
        )
      )
    )(identification)
  }
}

/**
 * ISO19115-3 override for writeOnlineResources
 * Generates cit:CI_OnlineResource without cit:protocol (ISO19115-3 CHE compliant)
 * Structure: gmd:distributionInfo/gmd:MD_Distribution/gmd:transferOptions/gmd:MD_DigitalTransferOptions/gmd:onLine/cit:CI_OnlineResource
 */
export function writeOnlineResources(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  // Remove all existing distribution info
  removeChildrenByName('gmd:distributionInfo')(rootEl)

  if (!record.onlineResources?.length) {
    return
  }

  // Create distribution info for each online resource
  appendChildren(
    ...record.onlineResources.map((onlineResource) =>
      pipe(
        createDistributionInfo(),
        findNestedChildOrCreate('gmd:transferOptions', 'gmd:MD_DigitalTransferOptions'),
        appendChildren(
          pipe(
            createElement('gmd:onLine'),
            createChild('cit:CI_OnlineResource'),
            writeLinkage(onlineResource.url),
            // cit:description (optional)
            'description' in onlineResource && onlineResource.description
              ? appendChildren(
                  pipe(
                    createElement('cit:description'),
                    writeLocalizedCharacterString(
                      onlineResource.description,
                      onlineResource.translations?.description,
                      record.defaultLanguage
                    )
                  )
                )
              : noop,
            // cit:function (optional)
            appendChildren(
              pipe(
                createElement('cit:function'),
                createChild('cit:CI_OnLineFunctionCode'),
                writeAttribute(
                  'codeList',
                  'https://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CI_OnLineFunctionCode'
                ),
                writeAttribute(
                  'codeListValue',
                  onlineResource.type === 'download' ? 'download' : 'information'
                )
              )
            )
            // NOTE: NO cit:protocol element in ISO19115-3!
            // NOTE: NO gmd:name element in ISO19115-3 CI_OnlineResource!
          )
        )
      )
    )
  )(rootEl)
}

/**
 * ISO19115-3 override for writeLicenses
 * Uses ISO19115-3 version of findOrCreateIdentification() to avoid duplicate identification elements
 * Wraps the ISO19139 constraint creation helper functions
 */
export function writeLicenses(record: CatalogRecord, rootEl: XmlElement) {
  pipe(
    findOrCreateIdentification(), // Use ISO19115-3 version
    removeLicenses(),
    appendChildren(
      ...record.licenses.map((license) =>
        createLicense(license, record.defaultLanguage)
      )
    )
  )(rootEl)
}

/**
 * ISO19115-3 override for writeLegalConstraints
 * Uses ISO19115-3 version of findOrCreateIdentification() to avoid duplicate identification elements
 * Wraps the ISO19139 constraint creation helper functions
 */
export function writeLegalConstraints(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  pipe(
    findOrCreateIdentification(), // Use ISO19115-3 version
    removeLegalConstraints(),
    removeEmptyResourceConstraints(),
    appendChildren(
      ...record.legalConstraints.map((c) =>
        createConstraint(c, 'legal', record.defaultLanguage)
      )
    )
  )(rootEl)
}

/**
 * ISO19115-3 override for writeSecurityConstraints
 * Uses ISO19115-3 version of findOrCreateIdentification() to avoid duplicate identification elements
 * Wraps the ISO19139 constraint creation helper functions
 */
export function writeSecurityConstraints(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  pipe(
    findOrCreateIdentification(), // Use ISO19115-3 version
    removeSecurityConstraints(),
    removeEmptyResourceConstraints(),
    appendChildren(
      ...record.securityConstraints.map((c) =>
        createConstraint(c, 'security', record.defaultLanguage)
      )
    )
  )(rootEl)
}

/**
 * ISO19115-3 override for writeOtherConstraints
 * Uses ISO19115-3 version of findOrCreateIdentification() to avoid duplicate identification elements
 * Wraps the ISO19139 constraint creation helper functions
 */
export function writeOtherConstraints(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  pipe(
    findOrCreateIdentification(), // Use ISO19115-3 version
    removeOtherConstraints(),
    removeEmptyResourceConstraints(),
    appendChildren(
      ...record.otherConstraints.map((c) =>
        createConstraint(c, 'other', record.defaultLanguage)
      )
    )
  )(rootEl)
}
