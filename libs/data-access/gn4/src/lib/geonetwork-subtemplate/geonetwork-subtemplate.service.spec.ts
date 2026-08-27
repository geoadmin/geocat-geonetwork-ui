import { TestBed } from '@angular/core/testing'
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { GeoNetworkSubtemplateService } from './geonetwork-subtemplate.service'

describe('GeoNetworkSubtemplateService', () => {
  let service: GeoNetworkSubtemplateService
  let httpMock: HttpTestingController

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GeoNetworkSubtemplateService],
    })
    service = TestBed.inject(GeoNetworkSubtemplateService)
    httpMock = TestBed.inject(HttpTestingController)
  })

  afterEach(() => {
    httpMock.verify()
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })

  it('should search extent subtemplates with query', () => {
    const mockResponse = {
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: 'extent-1',
              uuid: 'uuid-extent-sion',
              resourceTitleObject: {
                default: 'Sion',
                eng: 'Sion',
                fre: 'Sion',
              },
              resourceTitle: 'Sion',
              root: 'gmd:MD_Metadata',
              type: 'metadata',
              schema: 'iso19115-3.2018.che',
            },
          },
        ],
      },
    }

    service.searchExtentSubtemplates('Sion').subscribe((results) => {
      expect(results.length).toBe(1)
      expect(results[0].label).toBe('Sion')
      expect(results[0].uuid).toBe('uuid-extent-sion')
    })

    const req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/search/records/_search') &&
      request.method === 'POST'
    )
    expect(req.request.body.query.bool.must).toBeDefined()
    expect(req.request.body.query.bool.must.some((m: any) => m.terms)).toBeTruthy() // isTemplate filter
    expect(req.request.body.query.bool.must.some((m: any) => m.wildcard)).toBeTruthy() // uuid filter
    req.flush(mockResponse)
  })

  it('should search extent subtemplates without query', () => {
    const mockResponse = {
      hits: {
        total: { value: 2 },
        hits: [
          {
            _source: {
              id: 'extent-1',
              uuid: 'uuid-extent-sion',
              resourceTitleObject: { default: 'Sion' },
              resourceTitle: 'Sion',
            },
          },
          {
            _source: {
              id: 'extent-2',
              uuid: 'uuid-extent-valais',
              resourceTitleObject: { default: 'Valais' },
              resourceTitle: 'Valais',
            },
          },
        ],
      },
    }

    service.searchExtentSubtemplates().subscribe((results) => {
      expect(results.length).toBe(2)
      expect(results[0].label).toBe('Sion')
      expect(results[1].label).toBe('Valais')
    })

    const req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/search/records/_search') &&
      request.method === 'POST'
    )
    req.flush(mockResponse)
  })

  it('should fetch subtemplate XML from first endpoint', () => {
    const mockXml = '<gex:EX_Extent><gex:description>Sion</gex:description></gex:EX_Extent>'

    service.getSubtemplateXml('extent-1').subscribe((xml) => {
      expect(xml).toContain('gex:EX_Extent')
    })

    const req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1') &&
      request.url.includes('outputFormat=application/xml')
    )
    req.flush(mockXml)
  })

  it('should fetch subtemplate XML from fallback endpoint on first failure', () => {
    const mockXml = '<gex:EX_Extent><gex:description>Sion</gex:description></gex:EX_Extent>'

    service.getSubtemplateXml('extent-1').subscribe((xml) => {
      expect(xml).toContain('gex:EX_Extent')
    })

    // First request fails
    let req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1') &&
      request.url.includes('outputFormat=application/xml')
    )
    req.error(new ErrorEvent('Network error'))

    // Fallback to .xml endpoint
    req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1.xml')
    )
    req.flush(mockXml)
  })

  it('should return null on all XML fetch failures', () => {
    service.getSubtemplateXml('extent-1').subscribe((xml) => {
      expect(xml).toBeNull()
    })

    // First endpoint fails
    let req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1') &&
      request.url.includes('outputFormat=application/xml')
    )
    req.error(new ErrorEvent('Network error'))

    // Second endpoint fails
    req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1.xml')
    )
    req.error(new ErrorEvent('Network error'))

    // Third endpoint fails
    req = httpMock.expectOne((request) =>
      request.url.includes('/geonetwork/srv/api/records/extent-1/formatters/xml')
    )
    req.error(new ErrorEvent('Network error'))
  })

  it('should extract bbox from XML', () => {
    const xml = `
      <gex:EX_GeographicBoundingBox>
        <gex:westBoundLongitude><gco:Decimal>8.5</gco:Decimal></gex:westBoundLongitude>
        <gex:eastBoundLongitude><gco:Decimal>8.7</gco:Decimal></gex:eastBoundLongitude>
        <gex:southBoundLatitude><gco:Decimal>46.5</gco:Decimal></gex:southBoundLatitude>
        <gex:northBoundLatitude><gco:Decimal>46.7</gco:Decimal></gex:northBoundLatitude>
      </gex:EX_GeographicBoundingBox>
    `
    const bbox = service.extractBboxFromXml(xml)
    expect(bbox).toEqual([8.5, 46.5, 8.7, 46.7])
  })

  it('should extract label from resourceTitleObject', () => {
    const result = {
      resourceTitleObject: {
        default: 'Default Title',
        eng: 'English Title',
        fre: 'Titre Français',
      },
      id: 'extent-1',
    }
    const label = service['extractLabel'](result)
    expect(label).toBe('Default Title')
  })

  it('should extract label from resourceTitle fallback', () => {
    const result = {
      resourceTitle: 'Fallback Title',
      id: 'extent-1',
    }
    const label = service['extractLabel'](result)
    expect(label).toBe('Fallback Title')
  })

  it('should return id as fallback label', () => {
    const result = {
      id: 'extent-1',
    }
    const label = service['extractLabel'](result)
    expect(label).toBe('extent-1')
  })
})
