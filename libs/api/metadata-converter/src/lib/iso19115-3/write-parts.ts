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
  createNestedElement,
  findChildElement,
  findChildOrCreate,
  findChildrenElement,
  findNestedChildOrCreate,
  findNestedElement,
  findNestedElements,
  readAttribute,
  removeChildren,
  removeChildrenByName,
  setTextContent,
  writeAttribute,
  XmlElement,
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
  createDistributionInfo,
  findOrCreateDistribution,
  findOrCreateIdentification as findOrCreateIdentificationISO19139,
  getProgressCode,
  getRoleCode,
  removeKeywords,
  writeCharacterString,
  writeDateTime,
  writeLinkage,
  writeLocalizedCharacterString,
  getISODuration,
  writeDecimal,
} from '../iso19139/write-parts'
import { writeGeometry } from '../iso19139/utils/geometry'
import { findIdentification } from '../iso19139/read-parts'
import { readKind } from './read-parts'
import { namePartsToFull } from '../iso19139/utils/individual-name'
import { toLang3 } from '@geonetwork-ui/util/i18n/language-codes'
import { kindToCodeListValue } from '../common/resource-types'

/**
 * ISO19115-3 version of writeLocalizedCharacterString
 * Handles multilingual content with proper ISO19115-3 namespaces (lan:)
 * When translations exist: uses ONLY lan:PT_FreeText (no gco:CharacterString)
 * When no translations: uses only gco:CharacterString
 */
function writeLocalizedElement19115(
  writeFn: ChainableFunction<XmlElement, XmlElement>,
  text: string,
  translations: FieldTranslation,
  defaultLanguage: LanguageCode
): ChainableFunction<XmlElement, XmlElement> {
  if (!translations) {
    // No translations: just write CharacterString, remove any PT_FreeText
    return pipe(writeFn, removeChildrenByName('lan:PT_FreeText'))
  }

  // Has translations: create ONLY lan:PT_FreeText, remove CharacterString
  function createLocalized(lang: LanguageCode, translation: string) {
    return pipe(
      createNestedElement('lan:textGroup', 'lan:LocalisedCharacterString'),
      writeAttribute('locale', `#${lang.toUpperCase()}`),
      setTextContent(translation)
    )
  }

  return pipe(
    // Remove both old gmd: and new lan: versions, plus CharacterString
    removeChildrenByName('lan:PT_FreeText'),
    removeChildrenByName('gmd:PT_FreeText'),
    removeChildrenByName('gco:CharacterString'),
    createChild('lan:PT_FreeText'),
    appendChildren(
      createLocalized(defaultLanguage, text),
      ...Object.entries(translations).map(([lang, translation]) =>
        createLocalized(lang, translation)
      )
    )
  )
}

export function writeLocalizedCharacterString19115(
  text: string,
  translations: FieldTranslation,
  defaultLanguage: LanguageCode
): ChainableFunction<XmlElement, XmlElement> {
  return writeLocalizedElement19115(
    writeCharacterString(text),
    text,
    translations,
    defaultLanguage
  )
}

/**
 * ISO19115-3 version of findOrCreateIdentification that handles:
 * - Standard ISO19115-3: mdb:identificationInfo/mri:MD_DataIdentification
 * - Service identification: mdb:identificationInfo/srv:SV_ServiceIdentification
 * - CHE variant: mdb:identificationInfo/che:CHE_MD_DataIdentification
 */
export function findOrCreateIdentification() {
  return (rootEl: XmlElement) => {
    const kind = readKind(rootEl)
    const identificationInfoEl = findChildOrCreate('mdb:identificationInfo')(rootEl)

    // Try to find existing identification element
    let identEl = findChildElement('mri:MD_DataIdentification')(identificationInfoEl)
    if (identEl) return identEl

    if (kind === 'service') {
      identEl = findChildElement('srv:SV_ServiceIdentification')(identificationInfoEl)
      if (identEl) return identEl
    }

    // Check for CHE variant (Swiss extension)
    identEl = findChildElement('che:CHE_MD_DataIdentification')(identificationInfoEl)
    if (identEl) return identEl

    // Create appropriate element based on kind
    let eltName = 'mri:MD_DataIdentification'
    if (kind === 'service') eltName = 'srv:SV_ServiceIdentification'

    return createChild(eltName)(identificationInfoEl)
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

function removeRecordDate(type: 'revision' | 'creation' | 'publication') {
  return removeChildren(
    pipe(
      findChildrenElement('mdb:dateInfo', false),
      filterArray(
        pipe(
          findChildElement('cit:CI_DateTypeCode'),
          readAttribute('codeListValue'),
          map((value) => value === type)
        )
      )
    )
  )
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

function removeResourceDate(type: 'revision' | 'creation' | 'publication') {
  return pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:citation', 'cit:CI_Citation'),
    removeChildren(
      pipe(
        findChildrenElement('cit:date', false),
        filterArray(
          pipe(
            findChildElement('cit:CI_DateTypeCode'),
            readAttribute('codeListValue'),
            map((value) => value === type)
          )
        )
      )
    )
  )
}

function appendResourceDate(
  date: Date,
  type: 'revision' | 'creation' | 'publication'
) {
  return pipe(
    findIdentification(),
    findNestedElement('mri:citation', 'cit:CI_Citation'),
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
      ...record.contacts.map((contact) =>
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
  const withoutDistributors = record.contactsForResource.filter(
    (c) => c.role !== 'distributor'
  )
  const distributors = record.contactsForResource.filter(
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

export function writeOnlineResources(
  record: CatalogRecord,
  rootEl: XmlElement
) {
  removeTransferOptions(rootEl)

  if (record.kind === 'service') {
    appendServiceOnlineResources(record, rootEl)
    return
  }

  // for each online resource, either find an existing distribution info or create a new one
  record.onlineResources.forEach((onlineResource, index) => {
    pipe(
      fallback(
        pipe(
          findNestedElements('gmd:distributionInfo', 'gmd:MD_Distribution'),
          getAtIndex(index)
        ),
        appendChildTree(createDistributionInfo())
      ),
      appendOnlineResource(
        onlineResource,
        appendOnlineResourceFormat,
        record.translations,
        record.defaultLanguage
      )
    )(rootEl)
  })
}

function writeLocaleElement(language: LanguageCode) {
  const lang3 = toLang3(language.toLowerCase()) ?? language
  return pipe(
    findChildOrCreate('lan:PT_Locale'),
    writeAttribute('id', language.toUpperCase()),
    findNestedChildOrCreate('lan:language', 'gmd:LanguageCode'),
    writeAttribute('codeList', 'http://www.loc.gov/standards/iso639-2/'),
    writeAttribute('codeListValue', lang3)
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
 * ISO19115-3 override of writeTitle
 * Uses proper ISO19115-3 namespaces and prevents duplicate CharacterString
 */
export function writeTitle(record: CatalogRecord, rootEl: XmlElement) {
  pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:citation', 'cit:CI_Citation', 'cit:title'),
    writeLocalizedCharacterString19115(
      record.title,
      record.translations?.title,
      record.defaultLanguage
    )
  )(rootEl)
}

/**
 * ISO19115-3 override of writeAbstract
 * Uses proper ISO19115-3 namespaces and prevents duplicate CharacterString
 */
export function writeAbstract(record: CatalogRecord, rootEl: XmlElement) {
  pipe(
    findOrCreateIdentification(),
    findChildOrCreate('mri:abstract'),
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
 * Write spatial extents for ISO19115-3 format with multilingual descriptions
 */
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

  pipe(
    findOrCreateIdentification(),
    findNestedChildOrCreate('mri:extent', 'gex:EX_Extent'),
    removeChildrenByName('gex:geographicElement'),
    appendChildren(
      ...record.spatialExtents.map((extent) =>
        pipe(
          createElement('gex:geographicElement'),
          appendChildren(
            appendBoundingPolygon(extent.geometry),
            appendGeographicBoundingBox(extent.bbox),
            appendDescription(
              extent.description,
              extent.translations?.description
            )
          )
        )
      )
    )
  )(rootEl)
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

  // Add new ones if present in record
  if (record.topics && record.topics.length > 0) {
    appendChildren(
      ...record.topics.map((topic) =>
        pipe(
          createElement('che:subTopicCategory'),
          appendChildren(
            pipe(
              createElement('che:CHE_MD_SubTopicCategoryCode'),
              writeAttribute(
                'codeList',
                'http://standards.iso.org/iso/19115/resources/Codelists/cat/codelists.xml#CHE_MD_SubTopicCategoryCode'
              ),
              writeAttribute('codeListValue', topic),
              setTextContent(topic)
            )
          )
        )
      )
    )(identification)
  }
}
