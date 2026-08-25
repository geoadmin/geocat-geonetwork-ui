import { CatalogRecord } from '@geonetwork-ui/common/domain/model/record'
import { XmlElement } from '@rgrove/parse-xml'
import { Iso19139Converter } from '../iso19139'
import { renameElements } from '../xml-utils'
import {
  readAbstract,
  readContacts,
  readContactsForResource,
  readDefaultLanguage,
  readIsoTopics,
  readKeywords,
  readKind,
  readLineage,
  readOnlineResources,
  readOtherLanguages,
  readOverviews,
  readOwnerOrganization,
  readRecordUpdated,
  readResourceCreated,
  readResourceUpdated,
  readResourcePublished,
  readResourceIdentifier,
  readReuseType,
  readTitle,
  readUniqueIdentifier,
  readUpdateFrequency,
} from '../iso19139/read-parts'
import {
  writeContacts,
  writeContactsForResource,
  writeDefaultLanguage,
  writeKind,
  writeLineage,
  writeOnlineResources,
  writeLanguages,
  writeRecordUpdated,
  writeResourceCreated,
  writeResourcePublished,
  writeResourceUpdated,
  writeReuseType,
  writeSpatialRepresentation,
  writeStatus,
  writeUniqueIdentifier,
  writeTitle,
  writeAbstract,
  writeUpdateFrequency,
  writeSpatialExtents,
  writeTopics,
  writeLegalConstraints,
  writeSecurityConstraints,
  writeOtherConstraints,
  writeGraphicOverviews,
  writeKeywords,
  writeLicenses,
  writeTemporalExtents,
  writeResourceIdentifier,
} from '../iso19139/write-parts'

export class Iso191153Converter extends Iso19139Converter {
  constructor() {
    super()

    this.readers['uniqueIdentifier'] = readUniqueIdentifier
    this.readers['kind'] = readKind
    this.readers['recordUpdated'] = readRecordUpdated
    this.readers['resourceUpdated'] = readResourceUpdated
    this.readers['resourceCreated'] = readResourceCreated
    this.readers['resourcePublished'] = readResourcePublished
    this.readers['contacts'] = readContacts
    this.readers['contactsForResource'] = readContactsForResource
    this.readers['ownerOrganization'] = readOwnerOrganization
    this.readers['title'] = readTitle
    this.readers['abstract'] = readAbstract
    this.readers['keywords'] = readKeywords
    this.readers['topics'] = readIsoTopics
    this.readers['overviews'] = readOverviews
    this.readers['resourceIdentifiers'] = readResourceIdentifier
    this.readers['lineage'] = readLineage
    this.readers['onlineResources'] = readOnlineResources
    this.readers['defaultLanguage'] = readDefaultLanguage
    this.readers['otherLanguages'] = readOtherLanguages
    this.readers['reuseType'] = readReuseType
    this.readers['updateFrequency'] = readUpdateFrequency

    this.writers['uniqueIdentifier'] = writeUniqueIdentifier
    this.writers['kind'] = writeKind
    this.writers['recordUpdated'] = writeRecordUpdated
    this.writers['resourceUpdated'] = writeResourceUpdated
    this.writers['resourceCreated'] = writeResourceCreated
    this.writers['resourcePublished'] = writeResourcePublished
    this.writers['reuseType'] = writeReuseType
    this.writers['contacts'] = writeContacts
    this.writers['contactsForResource'] = writeContactsForResource
    this.writers['ownerOrganization'] = () => undefined // fixme: find a way to store this value properly
    this.writers['lineage'] = writeLineage
    this.writers['onlineResources'] = writeOnlineResources
    this.writers['status'] = writeStatus
    this.writers['spatialRepresentation'] = writeSpatialRepresentation
    this.writers['defaultLanguage'] = writeDefaultLanguage
    this.writers['otherLanguages'] = writeLanguages
    this.writers['title'] = writeTitle
    this.writers['abstract'] = writeAbstract
    this.writers['updateFrequency'] = writeUpdateFrequency
    this.writers['keywords'] = writeKeywords
    this.writers['topics'] = writeTopics
    this.writers['legalConstraints'] = writeLegalConstraints
    this.writers['securityConstraints'] = writeSecurityConstraints
    this.writers['otherConstraints'] = writeOtherConstraints
    this.writers['overviews'] = writeGraphicOverviews
    this.writers['licenses'] = writeLicenses
    this.writers['spatialExtents'] = writeSpatialExtents
    this.writers['temporalExtents'] = writeTemporalExtents
    this.writers['resourceIdentifiers'] = writeResourceIdentifier
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

    // Convert root element to CHE variant (avoid duplicate isoType)
    result = result.replace(
      /<mdb:MD_Metadata([^>]*?)>/,
      (match, attrs) => {
        // Remove any existing gco:isoType attribute
        const cleanAttrs = attrs.replace(/\s*gco:isoType="[^"]*"/g, '')
        return `<che:CHE_MD_Metadata${cleanAttrs} gco:isoType="mdb:MD_Metadata">`
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

    // Add CHE namespace if not present
    if (!result.includes('xmlns:che=')) {
      result = result.replace(
        'xmlns:mdb=',
        'xmlns:che="http://geocat.ch/che" xmlns:mdb='
      )
    }

    // Add CHE schema location if not present
    if (!result.includes('http://geocat.ch/che')) {
      const schemaLocation = 'xsi:schemaLocation="http://geocat.ch/che http://share-ech.ch/xmlns/eCH-0271/1.0.0/standards.iso.org/iso/19115/-3/eCH-0271-1-0-0.xsd http://standards.iso.org/iso/19115/-3/mdb/2.0 http://schemas.isotc211.org/19115/-3/mdb/2.0/mdb.xsd"'
      result = result.replace(
        /xsi:schemaLocation="[^"]*"/,
        schemaLocation
      )
    }

    return result
  }
}
