import {
  CatalogRecord,
  CatalogRecordKeys,
  DatasetRecord,
  ModelTranslations,
  RecordKind,
  RecordTranslations,
  ReuseRecord,
  ServiceRecord,
} from '@geonetwork-ui/common/domain/model/record'
import { XmlElement } from '@rgrove/parse-xml'
import { BaseConverter } from '../base.converter'
import { isEqual } from '../convert-utils'
import { isFieldTranslatable } from '../translate-utils'
import {
  createDocument,
  createElement,
  getRootElement,
  parseXmlString,
  xmlToString,
} from '../xml-utils'
import {
  readAbstract,
  readContacts,
  readContactsForResource,
  readDefaultLanguage,
  readIsoTopics,
  readKeywords,
  readKind,
  readLegalConstraints,
  readLicenses,
  readLineage,
  readOnlineResources,
  readOtherConstraints,
  readOtherLanguages,
  readOverviews,
  readOwnerOrganization,
  readRecordUpdated,
  readResourceCreated,
  readResourceIdentifier,
  readResourcePublished,
  readResourceUpdated,
  readReuseType,
  readSecurityConstraints,
  readSpatialExtents,
  readSpatialRepresentation,
  readStatus,
  readTemporalExtents,
  readTitle,
  readUniqueIdentifier,
  readUpdateFrequency,
} from './read-parts'
import {
  writeAbstract,
  writeContacts,
  writeContactsForResource,
  writeDefaultLanguage,
  writeGraphicOverviews,
  writeKeywords,
  writeKind,
  writeLanguages,
  writeLegalConstraints,
  writeLicenses,
  writeLineage,
  writeOnlineResources,
  writeOtherConstraints,
  writeRecordUpdated,
  writeResourceCreated,
  writeResourceIdentifier,
  writeResourcePublished,
  writeResourceUpdated,
  writeReuseType,
  writeSecurityConstraints,
  writeSpatialExtents,
  writeSpatialRepresentation,
  writeStatus,
  writeTemporalExtents,
  writeTitle,
  writeTopics,
  writeUniqueIdentifier,
  writeUpdateFrequency,
} from './write-parts'

export class Iso19139Converter extends BaseConverter<string> {
  protected readers: Record<
    CatalogRecordKeys,
    (rootEl: XmlElement, translations: RecordTranslations) => unknown
  > = {
    uniqueIdentifier: readUniqueIdentifier,
    kind: readKind,
    ownerOrganization: readOwnerOrganization,
    recordUpdated: readRecordUpdated,
    recordCreated: () => undefined, // not supported in ISO19139
    recordPublished: () => undefined, // not supported in ISO19139
    resourceIdentifiers: readResourceIdentifier,
    resourceUpdated: readResourceUpdated,
    resourceCreated: readResourceCreated,
    resourcePublished: readResourcePublished,
    reuseType: readReuseType,
    title: readTitle,
    abstract: readAbstract,
    contacts: readContacts,
    contactsForResource: readContactsForResource,
    keywords: readKeywords,
    topics: readIsoTopics,
    subTopics: () => undefined, // not supported in ISO19139
    licenses: readLicenses,
    legalConstraints: readLegalConstraints,
    securityConstraints: readSecurityConstraints,
    otherConstraints: readOtherConstraints,
    status: readStatus,
    updateFrequency: readUpdateFrequency,
    spatialRepresentation: readSpatialRepresentation,
    overviews: readOverviews,
    lineage: readLineage,
    onlineResources: readOnlineResources,
    temporalExtents: readTemporalExtents,
    spatialExtents: readSpatialExtents,
    otherLanguages: readOtherLanguages,
    defaultLanguage: readDefaultLanguage,
    // TODO
    extras: () => undefined,
    landingPage: () => undefined,
    translations: () => undefined,
  }

  protected writers: Record<
    CatalogRecordKeys,
    (record: CatalogRecord, rootEl: XmlElement) => void
  > = {
    uniqueIdentifier: writeUniqueIdentifier,
    kind: writeKind,
    ownerOrganization: () => undefined, // fixme: find a way to store this value properly
    recordUpdated: writeRecordUpdated,
    recordCreated: () => undefined, // not supported in ISO19139
    recordPublished: () => undefined, // not supported in ISO19139
    resourceIdentifiers: writeResourceIdentifier,
    resourceUpdated: writeResourceUpdated,
    resourceCreated: writeResourceCreated,
    resourcePublished: writeResourcePublished,
    reuseType: writeReuseType,
    title: writeTitle,
    abstract: writeAbstract,
    contacts: writeContacts,
    contactsForResource: writeContactsForResource,
    keywords: writeKeywords,
    topics: writeTopics,
    subTopics: () => undefined, // not supported in ISO19139
    licenses: writeLicenses,
    legalConstraints: writeLegalConstraints,
    securityConstraints: writeSecurityConstraints,
    otherConstraints: writeOtherConstraints,
    status: writeStatus,
    updateFrequency: writeUpdateFrequency,
    spatialRepresentation: writeSpatialRepresentation,
    overviews: writeGraphicOverviews,
    lineage: writeLineage,
    onlineResources: writeOnlineResources,
    temporalExtents: writeTemporalExtents,
    spatialExtents: writeSpatialExtents,
    otherLanguages: writeLanguages,
    defaultLanguage: writeDefaultLanguage,
    // TODO
    extras: () => undefined,
    landingPage: () => undefined,
    translations: () => undefined, // NB. translations are handled in properties
  }

  protected beforeDocumentCreation(rootElement: XmlElement) {
    // to override
  }

  protected afterRecordRead(record: CatalogRecord): CatalogRecord {
    function fixLanguages(target: { translations?: ModelTranslations }) {
      if (!('translations' in target)) return
      for (const fieldName in target.translations) {
        const fieldTranslations = target.translations[fieldName] ?? {}
        // remove redundant translations
        if (record.defaultLanguage in fieldTranslations) {
          delete fieldTranslations[record.defaultLanguage]
        }
        // remove translated values if they have no translations
        if (Object.keys(fieldTranslations).length === 0) {
          delete target.translations[fieldName]
          continue
        }
        // add languages that have translations to the root language list
        for (const lang in fieldTranslations) {
          if (!record.otherLanguages.includes(lang)) {
            record.otherLanguages.push(lang)
          }
        }
      }
    }

    fixLanguages(record)
    record.keywords.map(fixLanguages)
    record.onlineResources.map(fixLanguages)
    record.licenses.map(fixLanguages)
    record.legalConstraints.map(fixLanguages)
    record.securityConstraints.map(fixLanguages)
    record.otherConstraints.map(fixLanguages)
    record.contacts.map((c) => fixLanguages(c.organization))
    record.contactsForResource.map((c) => fixLanguages(c.organization))
    fixLanguages(record.ownerOrganization)
    if (record.kind === 'dataset') {
      record.spatialExtents.map(fixLanguages)
    }

    // remove default language from otherLanguages list
    if (record.otherLanguages.includes(record.defaultLanguage)) {
      record.otherLanguages = record.otherLanguages.filter(
        (lang) => lang !== record.defaultLanguage
      )
    }

    return record
  }

  readBaseRecord(rootEl: XmlElement, tr: RecordTranslations): CatalogRecord {
    console.log('[readBaseRecord] START - Input translations:', tr)

    const uniqueIdentifier = this.readers['uniqueIdentifier'](rootEl, tr)
    const kind = this.readers['kind'](rootEl, tr)
    const ownerOrganization = this.readers['ownerOrganization'](rootEl, tr)

    console.log('[readBaseRecord] About to read title...')
    const title = this.readers['title'](rootEl, tr)
    console.log('[readBaseRecord] After reading title, tr:', tr)

    console.log('[readBaseRecord] About to read abstract...')
    const abstract = this.readers['abstract'](rootEl, tr)
    console.log('[readBaseRecord] After reading abstract, tr:', tr)

    const contacts = this.readers['contacts'](rootEl, tr)
    const contactsForResource = this.readers['contactsForResource'](rootEl, tr)
    const recordUpdated = this.readers['recordUpdated'](rootEl, tr)
    const recordCreated = this.readers['recordCreated'](rootEl, tr)
    const recordPublished = this.readers['recordPublished'](rootEl, tr)
    const resourceCreated = this.readers['resourceCreated'](rootEl, tr)
    const resourceUpdated = this.readers['resourceUpdated'](rootEl, tr)
    const resourcePublished = this.readers['resourcePublished'](rootEl, tr)
    const keywords = this.readers['keywords'](rootEl, tr)
    const topics = this.readers['topics'](rootEl, tr)
    const subTopics = this.readers['subTopics'](rootEl, tr) as string[] | undefined
    const legalConstraints = this.readers['legalConstraints'](rootEl, tr)
    const otherConstraints = this.readers['otherConstraints'](rootEl, tr)
    const securityConstraints = this.readers['securityConstraints'](rootEl, tr)
    const licenses = this.readers['licenses'](rootEl, tr)
    const overviews = this.readers['overviews'](rootEl, tr)
    const landingPage = this.readers['landingPage'](rootEl, tr)
    const onlineResources = this.readers['onlineResources'](rootEl, tr)
    const otherLanguages = this.readers['otherLanguages'](rootEl, tr)
    const defaultLanguage = this.readers['defaultLanguage'](rootEl, tr)
    const resourceIdentifiers = this.readers['resourceIdentifiers'](
      rootEl,
      tr
    ) as Array<{
      code: string
      codeSpace?: string
      url?: string
    }>
    const spatialExtents = this.readers['spatialExtents'](rootEl, tr)

    console.log('[readBaseRecord] Final translations before returning:', tr)

    return {
      uniqueIdentifier,
      ...(resourceIdentifiers?.length > 0 && { resourceIdentifiers }),
      kind,
      otherLanguages,
      defaultLanguage,
      ...(recordCreated && { recordCreated }),
      ...(recordPublished && { recordPublished }),
      recordUpdated,
      ...(resourceCreated && { resourceCreated }),
      ...(resourceUpdated && { resourceUpdated }),
      ...(resourcePublished && { resourcePublished }),
      title,
      abstract,
      ownerOrganization,
      contacts,
      contactsForResource,
      keywords,
      topics,
      ...(subTopics && subTopics.length > 0 && { subTopics }),
      licenses,
      legalConstraints,
      securityConstraints,
      otherConstraints,
      overviews,
      spatialExtents,
      onlineResources,
      translations: tr,
      ...(landingPage && { landingPage }),
    } as CatalogRecord
  }

  async readRecord(document: string): Promise<CatalogRecord> {
    const doc = parseXmlString(document)
    const rootEl = getRootElement(doc)

    // DEBUG: Log the root element name
    console.log('[readRecord] Root element name:', rootEl?.name)
    console.log('[readRecord] Converter class:', this.constructor.name)

    // Transform elements BEFORE reading (e.g., CHE -> ISO19115-3)
    this.beforeDocumentCreation(rootEl)

    const tr: RecordTranslations = {}
    console.log('[readRecord] Created empty translations object')

    const kind = this.readers['kind'](rootEl, tr) as RecordKind

    if (kind === 'dataset') {
      console.log('[readRecord] Reading dataset fields...')
      const status = this.readers['status'](rootEl, tr)
      const spatialRepresentation = this.readers['spatialRepresentation'](
        rootEl,
        tr
      )
      const temporalExtents = this.readers['temporalExtents'](rootEl, tr)
      const lineage = this.readers['lineage'](rootEl, tr)
      const updateFrequency = this.readers['updateFrequency'](rootEl, tr)

      console.log('[readRecord] Translations object after reading all fields:', tr)

      return this.afterRecordRead({
        ...this.readBaseRecord(rootEl, tr),
        kind,
        status,
        lineage,
        ...(spatialRepresentation && { spatialRepresentation }),
        temporalExtents,
        updateFrequency,
        translations: tr,
      } as DatasetRecord)
    } else if (kind === 'reuse') {
      console.log('[readRecord] Reading reuse fields...')
      const lineage = this.readers['lineage'](rootEl, tr)
      const temporalExtents = this.readers['temporalExtents'](rootEl, tr)
      const reuseType = this.readers['reuseType'](rootEl, tr)

      console.log('[readRecord] Translations object after reading all fields:', tr)

      return this.afterRecordRead({
        ...this.readBaseRecord(rootEl, tr),
        kind,
        lineage,
        temporalExtents,
        reuseType,
      } as ReuseRecord)
    } else {
      return this.afterRecordRead({
        ...this.readBaseRecord(rootEl, tr),
        kind,
      } as ServiceRecord)
    }
  }

  async writeRecord(
    record: CatalogRecord,
    reference?: string
  ): Promise<string> {
    let rootEl: XmlElement
    let fieldChanged: (name: string) => boolean
    if (reference) {
      // eslint-disable-next-line prefer-const
      let languagesChanged: boolean
      const originalDoc = parseXmlString(reference)
      const originalRecord = await this.readRecord(reference)
      rootEl = getRootElement(originalDoc)

      fieldChanged = (name: string) => {
        return originalRecord !== null
          ? !isEqual(record[name], originalRecord[name]) ||
              (languagesChanged && isFieldTranslatable(name))
          : true
      }
      languagesChanged = fieldChanged('otherLanguages')
    } else {
      rootEl = createElement('gmd:MD_Metadata')()
      fieldChanged = () => true
    }

    fieldChanged('uniqueIdentifier') &&
      this.writers['uniqueIdentifier'](record, rootEl)
    fieldChanged('reuseType') && this.writers['reuseType'](record, rootEl)
    fieldChanged('kind') && this.writers['kind'](record, rootEl)
    fieldChanged('defaultLanguage') &&
      this.writers['defaultLanguage'](record, rootEl)

    fieldChanged('contacts') && this.writers['contacts'](record, rootEl)
    fieldChanged('ownerOrganization') &&
      this.writers['ownerOrganization'](record, rootEl)

    fieldChanged('recordUpdated') &&
      this.writers['recordUpdated'](record, rootEl)
    fieldChanged('recordCreated') &&
      this.writers['recordCreated'](record, rootEl)
    fieldChanged('recordPublished') &&
      this.writers['recordPublished'](record, rootEl)

    // CRITICAL: ALWAYS write title and abstract for multilingual support
    // MUST be FIRST in identification to maintain ISO19115-3 element ordering
    // ISO19115-3 requires: citation, abstract, keywords, topicCategory, etc BEFORE resourceConstraints
    this.writers['title'](record, rootEl)
    this.writers['abstract'](record, rootEl)

    fieldChanged('resourceCreated') &&
      this.writers['resourceCreated'](record, rootEl)
    fieldChanged('resourcePublished') &&
      this.writers['resourcePublished'](record, rootEl)
    fieldChanged('resourceUpdated') &&
      this.writers['resourceUpdated'](record, rootEl)

    fieldChanged('contactsForResource') &&
      this.writers['contactsForResource'](record, rootEl)

    // CRITICAL: ALWAYS write keywords, topics, subTopics for proper categorization
    // Must come BEFORE constraints
    this.writers['keywords'](record, rootEl)
    this.writers['topics'](record, rootEl)
    this.writers['subTopics'](record, rootEl)

    // Write extents BEFORE constraints (ISO19115-3 ordering requirement)
    if (record.kind === 'dataset') {
      fieldChanged('spatialExtents') &&
        this.writers['spatialExtents'](record, rootEl)
      fieldChanged('temporalExtents') &&
        this.writers['temporalExtents'](record, rootEl)
    }

    // resourceConstraints must come AFTER citation, abstract, keywords, topicCategory, extent
    fieldChanged('legalConstraints') &&
      this.writers['legalConstraints'](record, rootEl)
    fieldChanged('securityConstraints') &&
      this.writers['securityConstraints'](record, rootEl)
    fieldChanged('licenses') && this.writers['licenses'](record, rootEl)
    fieldChanged('otherConstraints') &&
      this.writers['otherConstraints'](record, rootEl)

    fieldChanged('onlineResources') &&
      this.writers['onlineResources'](record, rootEl)
    fieldChanged('resourceIdentifiers') &&
      this.writers['resourceIdentifiers'](record, rootEl)

    if (record.kind === 'dataset') {
      fieldChanged('status') && this.writers['status'](record, rootEl)
      fieldChanged('updateFrequency') &&
        this.writers['updateFrequency'](record, rootEl)
      fieldChanged('spatialRepresentation') &&
        this.writers['spatialRepresentation'](record, rootEl)
      fieldChanged('overviews') && this.writers['overviews'](record, rootEl)
      ;(fieldChanged('lineage') || fieldChanged('translations')) &&
        this.writers['lineage'](record, rootEl)
    }
    fieldChanged('otherLanguages') &&
      this.writers['otherLanguages'](record, rootEl)

    this.beforeDocumentCreation(rootEl)

    const newDocument = createDocument(rootEl)
    return xmlToString(newDocument)
  }
}
