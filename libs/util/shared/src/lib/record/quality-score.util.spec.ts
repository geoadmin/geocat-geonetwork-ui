import { CatalogRecord, DatasetDownloadDistribution, DatasetServiceDistribution, Individual, Keyword } from '@geonetwork-ui/common/domain/model/record'

import {
  ValidatorMapperKeys,
  getAllKeysValidator,
  getQualityValidators,
} from './quality-score.util'

describe('Metadata Validators', () => {
  const mockRecord: Partial<CatalogRecord> = {
    kind: 'dataset',
    title: 'Test title',
    abstract: 'Test abstract',
    keywords: [{ label: 'keyword1', type: 'other' }, { label: 'keyword2', type: 'other' }] as Keyword[],
    legalConstraints: [{ text: 'MIT' }],
    contacts: [
      {
        email: 'test@example.com',
        organization: { name: 'Test Org' },
        role: 'point_of_contact',
        firstName: '',
        lastName: '',
      },
    ] as Individual[],
    contactsForResource: [
      {
        role: 'point_of_contact',
        email: 'contact@example.com',
        organization: { name: 'Test Org' },
        firstName: '',
        lastName: '',
      },
      {
        role: 'owner',
        email: 'owner@example.com',
        organization: { name: 'Test Org' },
        firstName: '',
        lastName: '',
      },
    ] as Individual[],
    updateFrequency: 'daily',
    topics: ['environment'],
    subtopics: ['subtopic1'],
    onlineResources: [
      {
        type: 'download',
        url: new URL('http://example.com/data.zip'),
      } as DatasetDownloadDistribution,
      {
        type: 'service',
        url: new URL('http://example.com/wms'),
        accessServiceProtocol: 'wms',
      } as DatasetServiceDistribution,
    ],
    extras: {
      sourcesIdentifiers: '12345',
      resourceTitleObject: { langfre: 'Titre français', langger: 'Deutscher Titel' },
      resourceAltTitleObject: [{ langfre: 'Alt titre FR', langger: 'Alt Titel DE' }],
      resourceAbstractObject: {
        langfre: 'Résumé français',
        langger: 'Deutsche Zusammenfassung',
      },
      MD_LegalConstraintsOtherConstraintsObject: [{ default: 'CC-BY' }],
      cl_statusObject: { key: 'completed' },
      linkProtocol: ['MAP:Preview', 'OGC:WMS'],
      featureTypes: [
        {
          typeName: 'Feature',
          attributeTable: [{ name: 'ID', type: 'string' }],
        },
      ],
      format: ['ESRI Shapefile (SHP)'],
    },
  }

  const mockRecordInvalid: Partial<CatalogRecord> = {
    kind: 'dataset',
    title: '',
    abstract: '',
    keywords: [],
    legalConstraints: [],
    contacts: [],
    contactsForResource: [],
    updateFrequency: undefined,
    topics: [],
    subtopics: [],
    onlineResources: [],
    extras: {},
  }

  describe('getAllKeysValidator', () => {
    it('should return all validator keys', () => {
      const result = getAllKeysValidator()
      expect(result).toEqual([
        'title',
        'titleMultilingual',
        'altTitleMultilingual',
        'abstract',
        'abstractMultilingual',
        'keywords',
        'legalConstraints',
        'legalConstraintsOtherConstraints',
        'contacts',
        'contactsPointOfContactEmail',
        'contactsForResourceWithOwner',
        'updateFrequency',
        'topics',
        'subtopics',
        'organisation',
        'source',
        'status',
        'linkDownload',
        'linkService',
        'linkMapPreview',
        'featureCatalog',
        'resourceFormat',
      ])
      expect(result.every((key) => typeof key === 'string')).toBe(true)
    })
  })

  describe('getQualityValidators', () => {
    describe('for kind "dataset"', () => {
      const propsToValidate: ValidatorMapperKeys[] = [
        'titleMultilingual',
        'altTitleMultilingual',
        'abstractMultilingual',
        'keywords',
        'legalConstraintsOtherConstraints',
        'contactsPointOfContactEmail',
        'contactsForResourceWithOwner',
        'status',
        'linkDownload',
        'linkService',
        'linkMapPreview',
        'subtopics',
        'organisation',
        'featureCatalog',
        'resourceFormat',
      ]

      it('should return all applicable validators passing with valid record', () => {
        const result = getQualityValidators(
          { ...mockRecord, kind: 'dataset' },
          propsToValidate
        )
        expect(result.length).toBe(15)
        expect(result.map((v) => v.name)).toEqual(propsToValidate)
        result.forEach((v) => expect(v.validator()).toBe(true))
      })

      it('should return all applicable validators failing with invalid record', () => {
        const result = getQualityValidators(
          { ...mockRecordInvalid, kind: 'dataset' },
          propsToValidate
        )
        expect(result.length).toBe(15)
        result.forEach((v) => expect(v.validator()).toBe(false))
      })
    })

    describe('for kind "reuse"', () => {
      const propsToValidate: ValidatorMapperKeys[] = [
        'titleMultilingual',
        'altTitleMultilingual',
        'abstractMultilingual',
        'keywords',
        'legalConstraintsOtherConstraints',
        'contactsPointOfContactEmail',
        'contactsForResourceWithOwner',
        'status',
        'linkDownload',
        'linkService',
        'linkMapPreview',
        'subtopics',
        'organisation',
        'source',
      ]

      it('should return all applicable validators passing with valid record', () => {
        const result = getQualityValidators(
          { ...mockRecord, kind: 'reuse' },
          propsToValidate
        )
        expect(result.length).toBe(14)
        expect(result.map((v) => v.name)).toEqual(propsToValidate)
        result.forEach((v) => expect(v.validator()).toBe(true))
      })

      it('should return all applicable validators failing with invalid record', () => {
        const result = getQualityValidators(
          { ...mockRecordInvalid, kind: 'reuse' },
          propsToValidate
        )
        expect(result.length).toBe(14)
        result.forEach((v) => expect(v.validator()).toBe(false))
      })
    })

    describe('for kind "service"', () => {
      const propsToValidate: ValidatorMapperKeys[] = [
        'titleMultilingual',
        'altTitleMultilingual',
        'abstractMultilingual',
        'keywords',
        'legalConstraintsOtherConstraints',
        'contactsPointOfContactEmail',
        'contactsForResourceWithOwner',
        'status',
        'linkDownload',
        'linkService',
        'linkMapPreview',
      ]

      it('should return all applicable validators passing with valid record', () => {
        const result = getQualityValidators(
          { ...mockRecord, kind: 'service' } as Partial<CatalogRecord>,
          propsToValidate
        )
        expect(result.length).toBe(11)
        expect(result.map((v) => v.name)).toEqual(propsToValidate)
        result.forEach((v) => expect(v.validator()).toBe(true))
      })

      it('should return all applicable validators failing with invalid record', () => {
        const result = getQualityValidators(
          { ...mockRecordInvalid, kind: 'service' } as Partial<CatalogRecord>,
          propsToValidate
        )
        expect(result.length).toBe(11)
        result.forEach((v) => expect(v.validator()).toBe(false))
      })
    })

    it('should exclude validators not applicable to the record kind', () => {
      const result = getQualityValidators(
        { ...mockRecord, kind: 'service' } as Partial<CatalogRecord>,
        ['featureCatalog', 'resourceFormat', 'subtopics', 'source']
      )
      expect(result.length).toBe(0)
    })
  })
})
