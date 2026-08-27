import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core'
import {
  DatasetSpatialExtent,
  Keyword,
} from '@geonetwork-ui/common/domain/model/record'
import { AutocompleteComponent, BadgeComponent } from '@geonetwork-ui/ui/inputs'
import { firstValueFrom, map, shareReplay, Observable, tap } from 'rxjs'
import { EditorFacade } from '../../../../+state/editor.facade'
import { TranslatePipe } from '@ngx-translate/core'
import { SPATIAL_SCOPES } from '../../../../fields.config'
import { SpatialExtentComponent } from '@geonetwork-ui/ui/map'
import { GeoNetworkSubtemplateService, SubtemplateExtent } from '@geonetwork-ui/data-access/gn4'

type AutocompleteItem = { title: string; value: SubtemplateExtent }

/**
 * This form field is not like the others, as it will read directly from the state to handle both spatial extents
 * and place keywords.
 * Other types of keywords will not be touched by this field.
 */

@Component({
  selector: 'gn-ui-form-field-spatial-extent',
  templateUrl: './form-field-spatial-extent.component.html',
  styleUrls: ['./form-field-spatial-extent.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    AutocompleteComponent,
    BadgeComponent,
    TranslatePipe,
    SpatialExtentComponent,
  ],
})
export class FormFieldSpatialExtentComponent {
  private editorFacade = inject(EditorFacade)
  private subtemplateService = inject(GeoNetworkSubtemplateService)
  private changeDetector = inject(ChangeDetectorRef)

  spatialExtents$ = this.editorFacade.record$.pipe(
    map((record) => ('spatialExtents' in record ? record?.spatialExtents : []))
  )

  allKeywords$ = this.editorFacade.record$.pipe(
    map((record) => ('keywords' in record ? record?.keywords : []))
  )

  shownKeywords$ = this.allKeywords$.pipe(
    map((keywords) =>
      keywords.filter((k) => (SPATIAL_SCOPES as any).includes(k.type))
    ),
    shareReplay(1)
  )

  /**
   * Search function for autocomplete - searches GeoNetwork for extent subtemplates
   */
  subtemplateSearchAction = (query: string): Observable<AutocompleteItem[]> => {
    console.log('Autocomplete search triggered with query:', query)
    if (!query || query.trim().length < 1) {
      return new Observable((obs) => {
        obs.next([])
        obs.complete()
      })
    }

    return this.subtemplateService.searchExtentSubtemplates(query).pipe(
      tap((extents) => console.log('Autocomplete received extents:', extents)),
      map((extents) => {
        const items = extents.map((extent) => ({
          title: extent.label,
          value: extent,
        }))
        console.log('Autocomplete items:', items)
        return items
      })
    )
  }

  /**
   * Display function for autocomplete items
   */
  displaySubtemplateFn = (item: AutocompleteItem): string => {
    return item.title
  }

  /**
   * Parse JSON extent response and extract bbox, description, geometry
   * The GeoNetwork API returns JSON representation of XML when we request outputFormat=application/xml
   */
  private parseExtentFromJson(jsonData: any): Partial<DatasetSpatialExtent> | null {
    if (typeof jsonData === 'string') {
      try {
        jsonData = JSON.parse(jsonData)
      } catch (e) {
        console.error('Failed to parse JSON:', e)
        return null
      }
    }

    const result: Partial<DatasetSpatialExtent> = {}

    // Extract description from gex:description/gco:CharacterString
    if (jsonData['gex:description']?.['gco:CharacterString']?.['#text']) {
      result.description = jsonData['gex:description']['gco:CharacterString']['#text']
    }

    // Extract bbox from gex:EX_GeographicBoundingBox
    if (jsonData['gex:geographicElement']) {
      const geoElements = Array.isArray(jsonData['gex:geographicElement'])
        ? jsonData['gex:geographicElement']
        : [jsonData['gex:geographicElement']]

      for (const geoElem of geoElements) {
        if (geoElem['gex:EX_GeographicBoundingBox']) {
          const bbox = geoElem['gex:EX_GeographicBoundingBox']
          const west = parseFloat(bbox['gex:westBoundLongitude']?.['gco:Decimal']?.['#text'])
          const east = parseFloat(bbox['gex:eastBoundLongitude']?.['gco:Decimal']?.['#text'])
          const south = parseFloat(bbox['gex:southBoundLatitude']?.['gco:Decimal']?.['#text'])
          const north = parseFloat(bbox['gex:northBoundLatitude']?.['gco:Decimal']?.['#text'])

          if (!isNaN(west) && !isNaN(east) && !isNaN(south) && !isNaN(north)) {
            result.bbox = [west, south, east, north]
            console.log('Extracted bbox from JSON:', result.bbox)
            break  // Use first bbox found
          }
        }

        // TODO: Extract geometry from gex:EX_BoundingPolygon if needed
        // For now, we just use the bbox
      }
    }

    return Object.keys(result).length > 0 ? result : null
  }

  /**
   * Handle selection of a subtemplate from autocomplete
   */
  async handleSubtemplateSelection(item: AutocompleteItem) {
    console.log('Subtemplate selected:', item)
    const extent = item.value
    try {
      const response = await firstValueFrom(
        this.subtemplateService.getSubtemplateXml(extent.id)
      )
      console.log('Fetched subtemplate response:', response)

      const spatialExtents = await firstValueFrom(this.spatialExtents$)

      // Determine what we have and create extent accordingly
      let newExtent: DatasetSpatialExtent = {
        description: extent.label,
        subtemplateUuid: extent.uuid,
      }

      // Case 1: We got valid XML
      if (response && typeof response === 'string' && response.trim().startsWith('<')) {
        console.log('Using XML response')
        newExtent.subtemplateXml = response
      }
      // Case 2: We got JSON (API returned JSON instead of XML)
      else if (response && typeof response === 'string' && response.trim().startsWith('{')) {
        console.log('Received JSON, parsing for bbox and geometry')
        const parsedData = this.parseExtentFromJson(response)
        if (parsedData) {
          // Merge parsed data with base extent
          newExtent = { ...newExtent, ...parsedData }
          console.log('Successfully extracted data from JSON:', newExtent)
        }
      }
      // Case 3: No response
      else {
        console.warn('No valid response received, using only description and subtemplate UUID')
      }

      const newExtents = [...spatialExtents, newExtent]

      console.log('Updating record with new extents:', newExtents)
      this.editorFacade.updateRecordField('spatialExtents', newExtents)

      // Force change detection to update map immediately
      this.changeDetector.markForCheck()

      // NOTE: Do NOT auto-save here - let user manually save via publish button
      // this.editorFacade.saveRecord()
    } catch (error) {
      console.error('Failed to fetch subtemplate data:', error)
    }
  }

  /**
   * Remove a spatial extent
   */
  async removeExtent(extent: DatasetSpatialExtent) {
    try {
      const allExtents = await firstValueFrom(this.spatialExtents$)
      const newExtents = allExtents.filter(
        (e) => e.description !== extent.description
      )

      console.log('Removing extent:', extent.description)
      this.editorFacade.updateRecordField('spatialExtents', newExtents)

      // Force change detection to update map immediately
      this.changeDetector.markForCheck()

      this.editorFacade.saveRecord()
    } catch (error) {
      console.error('Failed to remove extent:', error)
    }
  }

  /**
   * Handle keyword deletion from thesaurus search
   */
  async handleKeywordDelete(keyword: Keyword) {
    const allKeywords = await firstValueFrom(this.allKeywords$)
    const newKeywords = allKeywords.filter((k) => k.label !== keyword.label)
    this.emitChanges(newKeywords)
  }

  /**
   * Handle keyword addition from thesaurus search
   */
  async handleKeywordAdd(keyword: Keyword) {
    const allKeywords = await firstValueFrom(this.allKeywords$)
    const newKeywords = [...allKeywords, keyword]
    this.emitChanges(newKeywords)
  }

  /**
   * Emit changes and save record
   */
  emitChanges(keywords: Keyword[]) {
    this.editorFacade.updateRecordField('keywords', keywords)
    this.editorFacade.saveRecord()
  }
}
