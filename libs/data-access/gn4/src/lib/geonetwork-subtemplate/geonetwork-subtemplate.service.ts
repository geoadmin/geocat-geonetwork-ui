import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, of } from 'rxjs'
import { map, catchError, tap } from 'rxjs/operators'
import { TranslateService } from '@ngx-translate/core'

export interface SubtemplateSearchResult {
  id: string
  uuid: string
  resourceTitle?: string | { default?: string }
  createdDate?: string
  groupOwner?: string
  valid?: boolean
  isTemplate?: string
}

export interface SubtemplateExtent {
  id: string
  uuid: string
  label: string // Display name (resourceTitle)
  xml?: string  // Full XML content (loaded on demand)
}

export interface SubtemplateContact {
  id: string
  uuid: string
  label: string // Display name (resourceTitle)
  xml?: string  // Full XML content (loaded on demand)
  owner?: string  // Owner of the template (for pointOfContact pre-selection)
}

@Injectable({
  providedIn: 'root',
})
export class GeoNetworkSubtemplateService {
  private http = inject(HttpClient)
  private translateService = inject(TranslateService)
  private geonetworkApiUrl = '/geonetwork/srv/api'

  /**
   * Search for extent subtemplates in GeoNetwork
   * Filters by isTemplate="s" and naming convention: *geocatch-subtpl-extent-*
   */
  searchExtentSubtemplates(
    query?: string,
    limit: number = 20
  ): Observable<SubtemplateExtent[]> {
    console.log('Searching for extents with query:', query)
    return this.searchAllTemplates(query, limit)
  }

  /**
   * Search for contact subtemplates in GeoNetwork
   * Filters by isTemplate="s" and root="cit:CI_Responsibility"
   * This retrieves "Organizations & contacts (ISO19115-3)" type templates
   */
  searchContactSubtemplates(
    query?: string,
    limit: number = 20
  ): Observable<SubtemplateContact[]> {
    console.log('Searching for contact subtemplates with query:', query)

    const mustClauses: any[] = [
      { term: { isTemplate: 's' } },  // Subtemplates only
      { term: { root: 'cit:CI_Responsibility' } },  // Contact/Organization type
    ]

    // Add text search if query provided
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query,
          type: 'bool_prefix',
          fields: [
            'resourceTitleObject.*^4',
            'resourceAbstractObject.*^3',
            'tag^2',
          ],
        },
      })
    }

    const searchQuery: any = {
      query: {
        bool: {
          must: mustClauses,
        },
      },
      _source: [
        'id',
        'uuid',
        'resourceTitleObject',
        'resourceTitle',
        'root',
        'owner',
        'ownerGroup',
        'type',
        'schema',
      ],
      from: 0,
      size: limit,
    }

    return this.http
      .post<any>(
        `${this.geonetworkApiUrl}/search/records/_search`,
        searchQuery
      )
      .pipe(
        map((response) => {
          if (!response.hits || !response.hits.hits) {
            return []
          }

          const results = response.hits.hits.map((hit: any) => {
            const source = hit._source || {}
            const contact: SubtemplateContact = {
              id: source.id || '',
              uuid: source.uuid || '',
              label: this.extractLabel(source),
              owner: source.owner || source.ownerGroup,
            }
            return contact
          })

          return results
        }),
        catchError((error) => {
          console.error('Contact subtemplate search failed:', error)
          return of([])
        })
      )
  }

  /**
   * Search for ALL templates (diagnostic)
   */
  private searchAllTemplates(
    query?: string,
    limit: number = 20
  ): Observable<SubtemplateExtent[]> {
    // Build the must clause with filters
    const mustClauses: any[] = [
      { terms: { isTemplate: ['s'] } },  // Look for templates
      {
        wildcard: {
          uuid: '*geocatch-subtpl-extent-*',  // Filter by naming convention for extent subtemplates
        },
      },
    ]

    // Add text search if query provided - using the working pattern
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query,
          type: 'bool_prefix',  // Use bool_prefix like the working query
          fields: [
            'resourceTitleObject.*^4',  // Correct field name
            'resourceAbstractObject.*^3',  // Correct field name
            'tag^2',
            'root',  // Also search in root field for extent-related
          ],
        },
      })
    }

    const searchQuery: any = {
      query: {
        bool: {
          must: mustClauses,
        },
      },
      _source: [
        'id',
        'uuid',
        'resourceTitleObject',
        'resourceTitle',  // Fallback
        'root',
        'type',
        'schema',
      ],
      from: 0,
      size: limit,
    }

    console.log('Diagnostic search query:', searchQuery)

    return this.http
      .post<any>(
        `${this.geonetworkApiUrl}/search/records/_search`,
        searchQuery
      )
      .pipe(
        tap((response) => {
          console.log('Diagnostic search response - Total hits:', response.hits?.total?.value)
          if (response.hits?.hits?.length > 0) {
            console.log('Sample hits:', response.hits.hits.slice(0, 3))
          }
        }),
        map((response) => {
          if (!response.hits || !response.hits.hits) {
            return []
          }

          const results = response.hits.hits.map((hit: any) => {
            const source = hit._source || {}
            const extent: any = {
              id: source.id || '',
              uuid: source.uuid || '',
              label: this.extractLabel(source),
            }
            // Store metadata for filtering
            extent._metadata = {
              root: source.root,
              schema: source.schema,
              type: source.type,
            }
            return extent as SubtemplateExtent
          })
          return results
        }),
        catchError((error) => {
          console.error('Template search failed:', error)
          return of([])
        })
      )
  }

  /**
   * Get available subtemplate types with counts
   * Returns aggregation of root element types: { 'cit:CI_Responsibility': 42, 'gex:EX_Extent': 10, ... }
   */
  getAvailableTemplateTypes(): Observable<Record<string, number>> {
    const query = {
      query: {
        bool: {
          must: [
            { term: { isTemplate: 's' } },  // Subtemplates only
          ],
        },
      },
      aggs: {
        types: {
          terms: {
            field: 'root',
            size: 100,
          },
        },
      },
      size: 0,  // We only want aggregations, not actual records
    }

    return this.http
      .post<any>(
        `${this.geonetworkApiUrl}/search/records/_search`,
        query
      )
      .pipe(
        map((response) => {
          const result: Record<string, number> = {}
          if (
            response.aggregations?.types?.buckets &&
            Array.isArray(response.aggregations.types.buckets)
          ) {
            response.aggregations.types.buckets.forEach((bucket: any) => {
              result[bucket.key] = bucket.doc_count
            })
          }
          return result
        }),
        catchError((error) => {
          console.error('Failed to fetch template types:', error)
          return of({})
        })
      )
  }

  /**
   * Extract bounding box from subtemplate XML string
   * Returns [west, south, east, north] or null if not found
   */
  extractBboxFromXml(xml: string): [number, number, number, number] | null {
    try {
      // Simple regex approach to extract coordinates from gex:EX_GeographicBoundingBox
      const westMatch = xml.match(/<gex:westBoundLongitude[^>]*>[\s\S]*?<gco:Decimal[^>]*>([\d.-]+)<\/gco:Decimal>/i)
      const eastMatch = xml.match(/<gex:eastBoundLongitude[^>]*>[\s\S]*?<gco:Decimal[^>]*>([\d.-]+)<\/gco:Decimal>/i)
      const southMatch = xml.match(/<gex:southBoundLatitude[^>]*>[\s\S]*?<gco:Decimal[^>]*>([\d.-]+)<\/gco:Decimal>/i)
      const northMatch = xml.match(/<gex:northBoundLatitude[^>]*>[\s\S]*?<gco:Decimal[^>]*>([\d.-]+)<\/gco:Decimal>/i)

      if (westMatch && eastMatch && southMatch && northMatch) {
        const bbox: [number, number, number, number] = [
          parseFloat(westMatch[1]),
          parseFloat(southMatch[1]),
          parseFloat(eastMatch[1]),
          parseFloat(northMatch[1]),
        ]
        console.log('Extracted bbox from subtemplate:', bbox)
        return bbox
      }
    } catch (error) {
      console.error('Failed to extract bbox from subtemplate XML:', error)
    }
    return null
  }

  /**
   * Get the full XML content of a subtemplate
   * Tries multiple endpoints to retrieve the XML
   */
  getSubtemplateXml(
    id: string,
    languages: string[] = ['eng', 'fre', 'ger', 'ita', 'roh']
  ): Observable<string> {
    console.log('Fetching subtemplate XML for id:', id)

    // Try endpoint 1: Direct XML access with language parameters
    const url1 = `${this.geonetworkApiUrl}/records/${id}?outputFormat=application/xml&lang=${languages.join(',')}`

    return this.http.get(url1, { responseType: 'text' }).pipe(
      tap((xml) => {
        if (!xml || !xml.trim()) {
          console.warn('Fetched XML is empty from endpoint 1')
        } else if (xml.trim().startsWith('{')) {
          console.warn('Received JSON instead of XML from endpoint 1')
        } else {
          console.log('Successfully fetched XML from endpoint 1, length:', xml.length, 'First 100 chars:', xml.substring(0, 100))
        }
      }),
      catchError((error) => {
        console.warn('Failed to fetch from endpoint 1, trying alternative:', error)

        // Try endpoint 2: Alternative format parameter
        const url2 = `${this.geonetworkApiUrl}/records/${id}.xml`
        return this.http.get(url2, { responseType: 'text' }).pipe(
          tap((xml) => {
            if (!xml || !xml.trim()) {
              console.warn('Fetched XML is empty from endpoint 2')
            } else if (xml.trim().startsWith('{')) {
              console.warn('Received JSON instead of XML from endpoint 2')
            } else {
              console.log('Successfully fetched XML from endpoint 2, length:', xml.length)
            }
          }),
          catchError((error2) => {
            console.warn('Failed to fetch from endpoint 2, trying endpoint 3:', error2)

            // Try endpoint 3: Records/{id}/formatters/xml endpoint
            const url3 = `${this.geonetworkApiUrl}/records/${id}/formatters/xml`
            return this.http.get(url3, { responseType: 'text' }).pipe(
              tap((xml) => {
                if (!xml || !xml.trim()) {
                  console.warn('Fetched XML is empty from endpoint 3')
                } else if (xml.trim().startsWith('{')) {
                  console.warn('Received JSON instead of XML from endpoint 3')
                } else {
                  console.log('Successfully fetched XML from endpoint 3, length:', xml.length)
                }
              }),
              catchError((error3) => {
                console.error('All XML fetch attempts failed:', error, error2, error3)
                console.error('Falling back to null XML string (extent will be created without XML injection)')
                return of(null)  // Return null instead of fallback XML
              })
            )
          })
        )
      })
    )
  }

  /**
   * Extract display label from search result using current language
   * Maps language codes to GeoNetwork keys: 'en' -> 'langeng', 'fr' -> 'langfre', etc.
   */
  private extractLabel(result: any): string {
    // Try resourceTitleObject first (multilingual field)
    if (result.resourceTitleObject && typeof result.resourceTitleObject === 'object') {
      // Get current language from TranslateService
      const currentLang = this.translateService.currentLang || this.translateService.defaultLang || 'en'

      // Map language codes to GeoNetwork format: en -> langeng, fr -> langfre, de -> langger, it -> langita, rm -> langroh
      const langMap: Record<string, string> = {
        'en': 'langeng',
        'eng': 'langeng',
        'fr': 'langfre',
        'fre': 'langfre',
        'de': 'langger',
        'ger': 'langger',
        'it': 'langita',
        'ita': 'langita',
        'rm': 'langroh',
        'roh': 'langroh',
      }

      const langKey = langMap[currentLang] || 'langeng'

      // Try current language, then other languages, then default
      return (
        result.resourceTitleObject[langKey] ||
        result.resourceTitleObject.langeng ||
        result.resourceTitleObject.langfre ||
        result.resourceTitleObject.langger ||
        result.resourceTitleObject.langita ||
        result.resourceTitleObject.langroh ||
        result.resourceTitleObject.default ||
        Object.values(result.resourceTitleObject)[0] ||
        result.id ||
        'Unknown'
      )
    }
    // Fallback to resourceTitle
    if (typeof result.resourceTitle === 'string') {
      return result.resourceTitle
    }
    if (typeof result.resourceTitle === 'object' && result.resourceTitle?.default) {
      return result.resourceTitle.default
    }
    return result.id || 'Unknown'
  }
}
