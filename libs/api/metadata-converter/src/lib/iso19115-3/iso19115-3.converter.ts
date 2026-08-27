import { CatalogRecord } from '@geonetwork-ui/common/domain/model/record'
import { XmlElement } from '@rgrove/parse-xml'
import { Iso19139Converter } from '../iso19139'
import {
  parseXmlString,
  getRootElement,
  xmlToString,
} from '../xml-utils'
import {
  writeGraphicOverviews,
  writeTemporalExtents,
} from '../iso19139/write-parts'
import {
  writeLegalConstraints,
  writeLicenses,
  writeOtherConstraints,
  writeSecurityConstraints,
  writeSpatialExtents,
} from './write-parts'
import { renameElements } from '../xml-utils'
import {
  readContacts,
  readContactsForResource,
  readDefaultLanguage,
  readKind,
  readLandingPage,
  readLineage,
  readOnlineResources,
  readOtherLanguages,
  readOwnerOrganization,
  readRecordCreated,
  readRecordPublished,
  readRecordUpdated,
  readResourceCreated,
  readResourcePublished,
  readResourceUpdated,
  readReuseType,
  readSpatialExtents,
  readSubTopics,
  readTopics,
  readUniqueIdentifier,
} from './read-parts'
import {
  writeAbstract,
  writeCitationDates,
  writeContacts,
  writeContactsForResource,
  writeDefaultLanguage,
  writeKeywords,
  writeKind,
  writeLandingPage,
  writeLineage,
  writeMetadataMaintenance,
  writeOnlineResources,
  writeOtherLanguages,
  writeRecordCreated,
  writeRecordPublished,
  writeRecordUpdated,
  writeResourceCreated,
  writeResourceIdentifier,
  writeResourcePublished,
  writeResourceUpdated,
  writeReuseType,
  writeSpatialRepresentation,
  writeStatus,
  writeSubTopicCategories,
  writeTitle,
  writeTopicsISO19115,
  writeUniqueIdentifier,
  writeUpdateFrequency,
} from './write-parts'

export class Iso191153Converter extends Iso19139Converter {
  constructor() {
    super()

    this.readers['uniqueIdentifier'] = readUniqueIdentifier
    this.readers['kind'] = readKind
    this.readers['recordUpdated'] = readRecordUpdated
    this.readers['recordCreated'] = readRecordCreated
    this.readers['recordPublished'] = readRecordPublished
    this.readers['resourceUpdated'] = readResourceUpdated
    this.readers['resourceCreated'] = readResourceCreated
    this.readers['resourcePublished'] = readResourcePublished
    this.readers['contacts'] = readContacts
    this.readers['contactsForResource'] = readContactsForResource
    this.readers['ownerOrganization'] = readOwnerOrganization
    this.readers['landingPage'] = readLandingPage
    this.readers['lineage'] = readLineage
    this.readers['onlineResources'] = readOnlineResources
    this.readers['defaultLanguage'] = readDefaultLanguage
    this.readers['otherLanguages'] = readOtherLanguages
    this.readers['reuseType'] = readReuseType
    this.readers['topics'] = readTopics
    this.readers['subTopics'] = readSubTopics
    this.readers['spatialExtents'] = readSpatialExtents

    this.writers['uniqueIdentifier'] = writeUniqueIdentifier
    this.writers['kind'] = writeKind
    this.writers['title'] = writeTitle
    this.writers['abstract'] = writeAbstract
    this.writers['recordUpdated'] = writeRecordUpdated
    this.writers['recordCreated'] = writeRecordCreated
    this.writers['recordPublished'] = writeRecordPublished
    this.writers['resourceUpdated'] = writeResourceUpdated
    this.writers['resourceCreated'] = writeResourceCreated
    this.writers['resourcePublished'] = writeResourcePublished
    this.writers['citationDates'] = writeCitationDates
    this.writers['resourceIdentifiers'] = writeResourceIdentifier
    this.writers['reuseType'] = writeReuseType
    this.writers['contacts'] = writeContacts
    this.writers['contactsForResource'] = writeContactsForResource
    this.writers['ownerOrganization'] = () => undefined // fixme: find a way to store this value properly
    this.writers['keywords'] = writeKeywords
    this.writers['topics'] = writeTopicsISO19115
    this.writers['subTopics'] = writeSubTopicCategories
    this.writers['licenses'] = writeLicenses
    this.writers['legalConstraints'] = writeLegalConstraints
    this.writers['securityConstraints'] = writeSecurityConstraints
    this.writers['otherConstraints'] = writeOtherConstraints
    this.writers['status'] = writeStatus
    this.writers['updateFrequency'] = writeUpdateFrequency
    this.writers['spatialRepresentation'] = writeSpatialRepresentation
    this.writers['overviews'] = writeGraphicOverviews
    this.writers['lineage'] = writeLineage
    this.writers['onlineResources'] = writeOnlineResources
    this.writers['temporalExtents'] = writeTemporalExtents
    this.writers['spatialExtents'] = writeSpatialExtents
    this.writers['landingPage'] = writeLandingPage
    this.writers['defaultLanguage'] = writeDefaultLanguage
    this.writers['otherLanguages'] = writeOtherLanguages
  }

  beforeDocumentCreation(rootEl: XmlElement) {
    renameElements(rootEl, {
      gmd: 'mdb',
      'gmd:characterEncoding': 'lan:characterEncoding',
      'gmd:MD_CharacterSetCode': 'lan:MD_CharacterSetCode',
      'gmd:MD_DataIdentification': 'mri:MD_DataIdentification',
      'gmd:citation': 'mri:citation',
      'gmd:abstract': 'mri:abstract',
      'gmd:title': 'cit:title',
      'gmd:CI_Citation': 'cit:CI_Citation',
      'gmx:Anchor': 'gcx:Anchor',

      // languages
      'gmd:PT_Locale': 'lan:PT_Locale',
      'gmd:PT_FreeText': 'lan:PT_FreeText',
      'gmd:LanguageCode': 'lan:LanguageCode',

      // status
      'gmd:status': 'mri:status',
      'gmd:MD_ProgressCode': 'mri:MD_ProgressCode',

      // dates
      'gmd:date': 'cit:date',
      'gmd:CI_Date': 'cit:CI_Date',
      'gmd:dateType': 'cit:dateType',
      'gmd:CI_DateTypeCode': 'cit:CI_DateTypeCode',

      // contacts
      'gmd:CI_Responsibility': 'cit:CI_Responsibility',
      'gmd:role': 'cit:role',
      'gmd:CI_RoleCode': 'cit:CI_RoleCode',

      // keywords
      'gmd:descriptiveKeywords': 'mri:descriptiveKeywords',
      'gmd:MD_Keywords': 'mri:MD_Keywords',
      'gmd:type': 'mri:type',
      'gmd:MD_KeywordTypeCode': 'mri:MD_KeywordTypeCode',
      'gmd:thesaurusName': 'mri:thesaurusName',
      'gmd:keyword': 'mri:keyword',
      'gmd:identifier': 'cit:identifier',
      'gmd:MD_Identifier': 'mcc:MD_Identifier',
      'gmd:code': 'mcc:code',

      // distributions
      'gmd:MD_Distribution': 'mrd:MD_Distribution',
      'gmd:transferOptions': 'mrd:transferOptions',
      'gmd:MD_DigitalTransferOptions': 'mrd:MD_DigitalTransferOptions',
      'gmd:onLine': 'mrd:onLine',
      'gmd:distributionFormat': 'mrd:distributionFormat',
      'gmd:MD_Format': 'mrd:MD_Format',
      'gmd:CI_OnlineResource': 'cit:CI_OnlineResource',
      'gmd:linkage': 'cit:linkage',
      'gmd:name': 'cit:name',
      'gmd:description': 'cit:description',
      'gmd:CI_OnLineFunctionCode': 'cit:CI_OnLineFunctionCode',
      'gmd:function': 'cit:function',
      'gmd:protocol': 'cit:protocol',

      // topic
      'gmd:topicCategory': 'mri:topicCategory',
      'gmd:MD_TopicCategoryCode': 'mri:MD_TopicCategoryCode',

      // update frequency
      'gmd:resourceMaintenance': 'mri:resourceMaintenance',
      'gmd:MD_MaintenanceInformation': 'mmi:MD_MaintenanceInformation',
      'gmd:userDefinedMaintenanceFrequency':
        'mmi:userDefinedMaintenanceFrequency',
      'gts:TM_PeriodDuration': 'gco:TM_PeriodDuration',

      // constraints
      'gmd:resourceConstraints': 'mri:resourceConstraints',
      'gmd:MD_Constraints': 'mco:MD_Constraints',
      'gmd:MD_LegalConstraints': 'mco:MD_LegalConstraints',
      'gmd:MD_SecurityConstraints': 'mco:MD_SecurityConstraints',
      'gmd:useLimitation': 'mco:useLimitation',
      'gmd:useConstraints': 'mco:useConstraints',
      'gmd:accessConstraints': 'mco:accessConstraints',
      'gmd:otherConstraints': 'mco:otherConstraints',
      'gmd:MD_RestrictionCode': 'mco:MD_RestrictionCode',
      'gmd:classification': 'mco:classification',
      'gmd:MD_ClassificationCode': 'mco:MD_ClassificationCode',

      // overviews
      'gmd:graphicOverview': 'mri:graphicOverview',
      'gmd:MD_BrowseGraphic': 'mcc:MD_BrowseGraphic',
      'gmd:fileName': 'mcc:fileName',
      'gmd:fileDescription': 'mcc:fileDescription',

      // no more URL elements
      'gmd:URL': 'gco:CharacterString',

      // CHE variant normalization: convert CHE elements to standard ISO19115-3
      'che:CHE_MD_Metadata': 'mdb:MD_Metadata',
      'che:CHE_MD_DataIdentification': 'mri:MD_DataIdentification',
      'che:CHE_MD_LegalConstraints': 'mco:MD_LegalConstraints',
      'che:CHE_CI_Organisation': 'cit:CI_Organisation',
      'che:organisationAcronym': 'gco:CharacterString', // Map CHE acronym to standard CharacterString
      'che:CHE_MD_MaintenanceInformation': 'mmi:MD_MaintenanceInformation', // Map CHE maintenance wrapper to standard
    })
  }

  async writeRecord(
    record: CatalogRecord,
    reference?: string
  ): Promise<string> {
    let result = await super.writeRecord(record, reference)

    // Parse the result to add ISO19115-3 specific elements
    const doc = parseXmlString(result)
    const rootEl = getRootElement(doc)

    if (rootEl && record.kind === 'dataset') {
      // Add citation date for Schematron CHE requirement
      // Uses recordCreated (metadata creation date) to satisfy "date de citation" requirement
      writeCitationDates(record, rootEl)

      // Add metadata maintenance information in mdb:metadataMaintenance
      // This is required by ISO19115-3.2018.che for proper schema validation
      if (record.updateFrequency) {
        writeMetadataMaintenance(record as any, rootEl)
      }
    }

    // Convert back to string after adding new elements
    result = xmlToString(doc)

    // Fix gco namespace definition (changes between iso19139 and iso19115-3)
    result = result.replace(
      '"http://www.isotc211.org/2005/gco"',
      '"http://standards.iso.org/iso/19115/-3/gco/1.0"'
    )

    // CRITICAL: Convert back to CHE19115-3.2018.che format for backend
    // The backend expects che:CHE_MD_Metadata with gco:isoType attributes
    result = this.convertToCheFinal(result)

    return result
  }

  /**
   * Convert ISO19115-3 standard format back to CHE19115-3.2018.che format
   * This is needed because we normalize to ISO19115-3 for processing,
   * but the backend expects CHE format with gco:isoType attributes
   */
  private convertToCheFinal(xml: string): string {
    let result = xml

    // Fix namespace prefix errors (mdb → lan for text groups and PT_FreeText)
    result = result.replace(/<mdb:textGroup>/g, '<lan:textGroup>')
    result = result.replace(/<\/mdb:textGroup>/g, '</lan:textGroup>')
    result = result.replace(/<mdb:LocalisedCharacterString/g, '<lan:LocalisedCharacterString')
    result = result.replace(/<\/mdb:LocalisedCharacterString>/g, '</lan:LocalisedCharacterString>')
    result = result.replace(/<mdb:PT_FreeText>/g, '<lan:PT_FreeText>')
    result = result.replace(/<\/mdb:PT_FreeText>/g, '</lan:PT_FreeText>')

    // Fix namespace for maintenanceAndUpdateFrequency: mdb → mmi
    result = result.replace(/<mdb:maintenanceAndUpdateFrequency>/g, '<mmi:maintenanceAndUpdateFrequency>')
    result = result.replace(/<\/mdb:maintenanceAndUpdateFrequency>/g, '</mmi:maintenanceAndUpdateFrequency>')
    result = result.replace(/<mdb:MD_MaintenanceFrequencyCode/g, '<mmi:MD_MaintenanceFrequencyCode')
    result = result.replace(/<\/mdb:MD_MaintenanceFrequencyCode>/g, '</mmi:MD_MaintenanceFrequencyCode>')

    // Convert root element to CHE variant and rebuild with ALL CHE namespaces
    result = result.replace(
      /<mdb:MD_Metadata([^>]*)>/,
      (match, attrs) => {
        // Extract existing namespace declarations and other attributes
        const nsRegex = /xmlns:[a-zA-Z0-9]+="[^"]*"/g
        const existingNs = (attrs.match(nsRegex) || [])
        const otherAttrs = attrs.replace(nsRegex, '').replace(/\s*gco:isoType="[^"]*"/g, '').trim()

        // CHE19115-3.2018 requires these namespaces in specific order
        const cheNamespaces = [
          'xmlns:mrd="http://standards.iso.org/iso/19115/-3/mrd/1.0"',
          'xmlns:mas="http://standards.iso.org/iso/19115/-3/mas/1.0"',
          'xmlns:mco="http://standards.iso.org/iso/19115/-3/mco/1.0"',
          'xmlns:mrc="http://standards.iso.org/iso/19115/-3/mrc/2.0"',
          'xmlns:md1="http://standards.iso.org/iso/19115/-3/md1/2.0"',
          'xmlns:msr="http://standards.iso.org/iso/19115/-3/msr/2.0"',
          'xmlns:mds="http://standards.iso.org/iso/19115/-3/mds/2.0"',
          'xmlns:gml="http://www.opengis.net/gml/3.2"',
          'xmlns:md2="http://standards.iso.org/iso/19115/-3/md2/2.0"',
          'xmlns:lan="http://standards.iso.org/iso/19115/-3/lan/1.0"',
          'xmlns:che="http://geocat.ch/che"',
          'xmlns:gcx="http://standards.iso.org/iso/19115/-3/gcx/1.0"',
          'xmlns:mdt="http://standards.iso.org/iso/19115/-3/mdt/2.0"',
          'xmlns:xlink="http://www.w3.org/1999/xlink"',
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
          'xmlns:gex="http://standards.iso.org/iso/19115/-3/gex/1.0"',
          'xmlns:mpc="http://standards.iso.org/iso/19115/-3/mpc/1.0"',
          'xmlns:srv="http://standards.iso.org/iso/19115/-3/srv/2.0"',
          'xmlns:dqm="http://standards.iso.org/iso/19157/-2/dqm/1.0"',
          'xmlns:mac="http://standards.iso.org/iso/19115/-3/mac/2.0"',
          'xmlns:mdb="http://standards.iso.org/iso/19115/-3/mdb/2.0"',
          'xmlns:cit="http://standards.iso.org/iso/19115/-3/cit/2.0"',
          'xmlns:mcc="http://standards.iso.org/iso/19115/-3/mcc/1.0"',
          'xmlns:gfc="http://standards.iso.org/iso/19110/gfc/1.1"',
          'xmlns:mdq="http://standards.iso.org/iso/19157/-2/mdq/1.0"',
          'xmlns:mri="http://standards.iso.org/iso/19115/-3/mri/1.0"',
          'xmlns:mex="http://standards.iso.org/iso/19115/-3/mex/1.0"',
          'xmlns:mda="http://standards.iso.org/iso/19115/-3/mda/2.0"',
          'xmlns:mrl="http://standards.iso.org/iso/19115/-3/mrl/2.0"',
          'xmlns:mrs="http://standards.iso.org/iso/19115/-3/mrs/1.0"',
          'xmlns:cat="http://standards.iso.org/iso/19115/-3/cat/1.0"',
          'xmlns:mmi="http://standards.iso.org/iso/19115/-3/mmi/1.0"',
          'xmlns:gco="http://standards.iso.org/iso/19115/-3/gco/1.0"',
        ]

        // Build complete root element with all namespaces and gco:isoType
        const allAttrs = cheNamespaces.join(' ') + ' gco:isoType="mdb:MD_Metadata"' + (otherAttrs ? ' ' + otherAttrs : '')
        return `<che:CHE_MD_Metadata ${allAttrs}>`
      }
    )
    result = result.replace(
      /<\/mdb:MD_Metadata>/,
      '</che:CHE_MD_Metadata>'
    )

    // Convert DataIdentification to CHE variant (avoid duplicate isoType)
    result = result.replace(
      /<mri:MD_DataIdentification([^>]*?)>/g,
      (match, attrs) => {
        // Remove any existing gco:isoType attribute
        const cleanAttrs = attrs.replace(/\s*gco:isoType="[^"]*"/g, '')
        return `<che:CHE_MD_DataIdentification${cleanAttrs} gco:isoType="mri:MD_DataIdentification">`
      }
    )
    result = result.replace(
      /<\/mri:MD_DataIdentification>/g,
      '</che:CHE_MD_DataIdentification>'
    )

    return result
  }
}
