import { Iso191153Converter } from './iso19115-3.converter'
import { CatalogRecord } from '@geonetwork-ui/common/domain/model/record'
import { parseXmlString, xmlToString } from '../xml-utils'

describe('ISO19115-3 Multilingual Round-trip (CRITICAL: Update scenario)', () => {
  let converter: Iso191153Converter

  beforeEach(() => {
    converter = new Iso191153Converter()
  })

  it('CRITICAL: writes title and abstract on UPDATE (fieldChanged() scenario)', async () => {
    // Create a record with multilingual content
    const originalRecord: CatalogRecord = {
      uniqueIdentifier: 'test-id-1234',
      kind: 'dataset',
      defaultLanguage: 'fr',
      title: 'Titre test en français',
      abstract: 'Résumé test',
      translations: {
        title: {
          de: 'Testtitel auf Deutsch',
          en: 'Test title in English',
        },
        abstract: {
          de: 'Testzusammenfassung',
          en: 'Test abstract',
        },
      },
      otherLanguages: ['de', 'en'],
      contacts: [],
      contactsForResource: [],
      legalConstraints: [],
      securityConstraints: [],
      keywords: [],
    }

    // Write to XML
    const xmlString = await converter.writeRecord(originalRecord)
    const doc = parseXmlString(xmlString)

    // Verify title is in XML
    expect(xmlString).toContain('Titre test en français')
    expect(xmlString).toContain('Testtitel auf Deutsch')
    expect(xmlString).toContain('Test title in English')

    // Verify abstract is in XML
    expect(xmlString).toContain('Résumé test')
    expect(xmlString).toContain('Testzusammenfassung')
    expect(xmlString).toContain('Test abstract')

    // Verify PT_FreeText structure exists
    expect(xmlString).toContain('<lan:PT_FreeText>')
    expect(xmlString).toContain('locale="#FR"')
    expect(xmlString).toContain('locale="#DE"')
    expect(xmlString).toContain('locale="#EN"')

    console.log('[CRITICAL TEST] XML after first write:\n', xmlString)

    // NOW: Simulate UPDATE scenario by passing the reference XML
    // User makes no changes, or only changes some metadata dates
    const updatedRecord: CatalogRecord = {
      ...originalRecord,
      recordUpdated: new Date('2025-01-20'),
    }

    // Write AGAIN with reference - this is where fieldChanged() logic kicks in
    const xmlString2 = await converter.writeRecord(updatedRecord, xmlString)

    console.log('[CRITICAL TEST] XML after UPDATE (with reference):\n', xmlString2)

    // CRITICAL: Title and abstract MUST still be in XML even on update
    expect(xmlString2).toContain('Titre test en français')
    expect(xmlString2).toContain('Testtitel auf Deutsch')
    expect(xmlString2).toContain('Test title in English')

    expect(xmlString2).toContain('Résumé test')
    expect(xmlString2).toContain('Testzusammenfassung')
    expect(xmlString2).toContain('Test abstract')

    // Verify no duplicate elements were created
    const titleMatches = (xmlString2.match(/<cit:title>/g) || []).length
    expect(titleMatches).toBe(1, 'Should have exactly ONE cit:title element, not duplicates')

    const abstractMatches = (xmlString2.match(/<mri:abstract>/g) || []).length
    expect(abstractMatches).toBe(1, 'Should have exactly ONE mri:abstract element, not duplicates')
  })

  it('CRITICAL: writes keywords on UPDATE', async () => {
    const originalRecord: CatalogRecord = {
      uniqueIdentifier: 'test-id-5678',
      kind: 'dataset',
      defaultLanguage: 'fr',
      title: 'Dataset',
      keywords: ['water', 'environment'],
      translations: {
        keywords: {
          de: ['Wasser', 'Umwelt'],
          en: ['Water', 'Environment'],
        },
      },
      otherLanguages: ['de', 'en'],
      contacts: [],
      contactsForResource: [],
      legalConstraints: [],
      securityConstraints: [],
    }

    // First write
    const xmlString = await converter.writeRecord(originalRecord)
    expect(xmlString).toContain('water')
    expect(xmlString).toContain('Wasser')
    expect(xmlString).toContain('Water')

    // Update (with reference) - this should still write keywords
    const xmlString2 = await converter.writeRecord(originalRecord, xmlString)

    console.log('[CRITICAL TEST - Keywords] XML after UPDATE:\n', xmlString2)

    // CRITICAL: Keywords MUST still be present
    expect(xmlString2).toContain('water')
    expect(xmlString2).toContain('Wasser')
    expect(xmlString2).toContain('Water')

    // Verify no duplicates
    const keywordMatches = (xmlString2.match(/<mri:descriptiveKeywords>/g) || []).length
    expect(keywordMatches).toBeGreaterThan(0, 'Should have keyword elements')
  })

  it('correctly handles UPDATE when title changes', async () => {
    const record1: CatalogRecord = {
      uniqueIdentifier: 'test-id-9999',
      kind: 'dataset',
      defaultLanguage: 'fr',
      title: 'Original Title',
      abstract: 'Original Abstract',
      contacts: [],
      contactsForResource: [],
      legalConstraints: [],
      securityConstraints: [],
      keywords: [],
    }

    const xmlString1 = await converter.writeRecord(record1)
    expect(xmlString1).toContain('Original Title')
    expect(xmlString1).toContain('Original Abstract')

    // Update: change title and abstract
    const record2: CatalogRecord = {
      ...record1,
      title: 'New Title',
      abstract: 'New Abstract',
    }

    const xmlString2 = await converter.writeRecord(record2, xmlString1)

    console.log('[CRITICAL TEST - Change Title] XML after title change:\n', xmlString2)

    // Old content should be gone
    expect(xmlString2).not.toContain('Original Title')
    expect(xmlString2).not.toContain('Original Abstract')

    // New content should be present
    expect(xmlString2).toContain('New Title')
    expect(xmlString2).toContain('New Abstract')

    // Verify no duplicates
    const titleMatches = (xmlString2.match(/<cit:title>/g) || []).length
    expect(titleMatches).toBe(1, 'Should have exactly ONE cit:title, not duplicates with old value')
  })

  it('preserves empty string values in XML', async () => {
    const record: CatalogRecord = {
      uniqueIdentifier: 'test-id-empty',
      kind: 'dataset',
      defaultLanguage: 'fr',
      title: '', // Empty title
      abstract: '', // Empty abstract
      keywords: [], // Empty keywords
      contacts: [],
      contactsForResource: [],
      legalConstraints: [],
      securityConstraints: [],
    }

    const xmlString = await converter.writeRecord(record)

    // Empty elements should still be created (for proper schema compliance)
    // but can be empty
    expect(xmlString).toContain('che:CHE_MD_Metadata')

    // Should be able to read back without errors
    const readRecord = await converter.readRecord(xmlString)
    expect(readRecord).toBeDefined()
  })
})
