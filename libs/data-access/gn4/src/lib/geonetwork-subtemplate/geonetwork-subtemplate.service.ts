import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable, of } from 'rxjs'
import { map, catchError, tap } from 'rxjs/operators'

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

@Injectable({
  providedIn: 'root',
})
export class GeoNetworkSubtemplateService {
  private http = inject(HttpClient)
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
   * Extract display label from search result
   */
  private extractLabel(result: any): string {
    // Try resourceTitleObject first (multilingual field)
    if (result.resourceTitleObject) {
      if (typeof result.resourceTitleObject === 'object') {
        // It's an object with language keys
        return (
          result.resourceTitleObject.default ||
          result.resourceTitleObject.eng ||
          result.resourceTitleObject.fre ||
          result.resourceTitleObject.ger ||
          Object.values(result.resourceTitleObject)[0] ||
          result.id ||
          'Unknown'
        )
      }
      // It's already a string
      return result.resourceTitleObject
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
