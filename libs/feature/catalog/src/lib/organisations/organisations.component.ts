import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  Optional,
  Output,
} from '@angular/core'
import { Organization } from '@geonetwork-ui/common/domain/model/record'
import { BehaviorSubject, combineLatest, Observable } from 'rxjs'
import { map, startWith, tap } from 'rxjs/operators'
import { OrganizationsServiceInterface } from '@geonetwork-ui/common/domain/organizations.service.interface'
import { SortByField } from '@geonetwork-ui/common/domain/model/search'
import { createFuzzyFilter } from '@geonetwork-ui/util/shared'
import { ORGANIZATION_PAGE_URL_TOKEN } from '../organization-url.token'
import { ContentGhostComponent } from '@geonetwork-ui/ui/elements'
import { CommonModule } from '@angular/common'
import {
  OrganisationPreviewComponent,
  OrganisationsFilterComponent,
  OrganisationsResultComponent,
} from '@geonetwork-ui/ui/catalog'
import { Paginable, PaginationComponent, ExpandablePanelComponent } from '@geonetwork-ui/ui/layout'

@Component({
  selector: 'gn-ui-organisations',
  templateUrl: './organisations.component.html',
  styleUrls: ['./organisations.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ContentGhostComponent,
    OrganisationsFilterComponent,
    OrganisationsResultComponent,
    OrganisationPreviewComponent,
    PaginationComponent,
    ExpandablePanelComponent],
})
export class OrganisationsComponent implements Paginable {
  @Input() itemsOnPage = 12
  @Input() groupedOrganizations?: Record<string, Organization[]>
  @Output() orgSelect = new EventEmitter<Organization>()

  constructor(
    private organisationsService: OrganizationsServiceInterface,
    @Optional()
    @Inject(ORGANIZATION_PAGE_URL_TOKEN)
    private urlTemplate: string,
  ) { }

  totalPages: number
  currentPage$ = new BehaviorSubject(1)
  categoryCurrentPage$ = new BehaviorSubject<Record<string, number>>({});
  collapsedState: Record<string, boolean> = {};
  sortBy$: BehaviorSubject<SortByField> = new BehaviorSubject(['asc', 'name'])
  filterBy$: BehaviorSubject<string> = new BehaviorSubject('')
  organisationsTotal$ = this.organisationsService.organisationsCount$
  organisationsFilteredAndSorted$: Observable<Organization[]> = combineLatest([
    this.organisationsService.organisations$.pipe(
      startWith(Array(this.itemsOnPage).fill({}))
    ),
    this.sortBy$,
    this.filterBy$,
  ]).pipe(
    map(([organisations, sortBy, filterBy]) => {
      const filteredOrganisations = this.filterOrganisations(
        organisations,
        filterBy
      )
      return this.sortOrganisations(filteredOrganisations, sortBy)
    })
  )

  groupedOrganizations$: Observable<Record<string, Organization[]>> =
    this.organisationsFilteredAndSorted$.pipe(
      map((organisations) => {
        const grouped = organisations.reduce((acc, org) => {
          const category = org.defaultCategory || 'Other';
          if (!acc[category]) acc[category] = []
          acc[category].push(org)
          return acc;
        }, {} as Record<string, Organization[]>)

        return grouped;
      })
    );

  categoryCounts$: Observable<Record<string, number>> = this.groupedOrganizations$.pipe(
    map(grouped => {
      return Object.keys(grouped).reduce((acc, category) => {
        acc[category] = grouped[category].length;
        return acc;
      }, {} as Record<string, number>);
    })
  );

  groupedOrganizationsPaged$: Observable<Record<string, Organization[]>> = combineLatest([
    this.groupedOrganizations$,
    this.categoryCurrentPage$
  ]).pipe(
    map(([grouped, pageState]) => {
      const paginatedGroups: Record<string, Organization[]> = {};

      Object.keys(grouped).forEach(category => {
        const page = pageState[category] || 1;
        const start = (page - 1) * this.itemsOnPage;
        const end = start + this.itemsOnPage;
        paginatedGroups[category] = grouped[category].slice(start, end);
      });

      return paginatedGroups;
    })
  );

  organisationResults$: Observable<number> = this.groupedOrganizationsPaged$.pipe(
    map(grouped => Object.values(grouped)
      .reduce((acc, orgArray) => acc.concat(orgArray), []) // Équivalent à .flat()
      .length
    )
  );

  // organisations$: Observable<Organization[]> = combineLatest([
  //   this.organisationsFilteredAndSorted$,
  //   this.currentPage$,
  // ]).pipe(
  //   tap(([organisations]) => {
  //     this.organisationResults$ = organisations.length
  //     this.totalPages = Math.ceil(organisations.length / this.itemsOnPage)
  //   }),
  //   map(([organisations, page]) =>
  //     organisations.slice(
  //       (page - 1) * this.itemsOnPage,
  //       page * this.itemsOnPage
  //     )
  //   )
  // )

  protected setFilterBy(value: string): void {
    this.currentPage$.next(1)
    this.filterBy$.next(value)
  }

  protected setSortBy(value: SortByField): void {
    this.sortBy$.next(value)
  }

  toggleCategory(category: string) {
    this.collapsedState[category] = !this.collapsedState[category];
  }

  isCategoryCollapsed(category: string): boolean {
    return this.collapsedState[category] ?? true;
  }

  private filterOrganisations(organisations: Organization[], filterBy: string) {
    if (!filterBy) return organisations
    const filter = createFuzzyFilter(filterBy)
    return organisations.filter((org) => filter(org.name))
  }

  private sortOrganisations(
    organisations: Organization[],
    sortBy: SortByField
  ): Organization[] {
    let order: 'asc' | 'desc'
    let attribute: string
    if (Array.isArray(sortBy[0])) {
      order = sortBy[0][0]
      attribute = sortBy[0][1]
    } else {
      order = sortBy[0]
      attribute = sortBy[1] as string
    }
    const direction = order === 'asc' ? 1 : -1
    return [...organisations].sort((a, b) => {
      const valueA = a[attribute]
      const valueB = b[attribute]
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction * valueA.localeCompare(valueB)
      }
      return direction * Math.sign(valueA - valueB)
    })
  }

  trackByIndex(index: number) {
    return index
  }

  getOrganisationUrl(organisation: Organization): string {
    if (!this.urlTemplate) return null
    return this.urlTemplate.replace('${name}', organisation.name)
  }

  // Paginable API
  get isFirstPage() {
    return this.currentPage === 1
  }
  get isLastPage() {
    return this.currentPage === this.totalPages
  }
  get pagesCount() {
    return this.totalPages
  }
  get currentPage() {
    return this.currentPage$.value
  }
  goToPage(index: number) {
    this.currentPage$.next(index)
  }
  goToNextPage() {
    this.goToPage(this.currentPage + 1)
  }
  goToPrevPage() {
    this.goToPage(this.currentPage - 1)
  }
  getCategoryPages(category: string, counts: Record<string, number> | null): number {
    if (!counts || !counts[category] || counts[category] === 0) {
      return 1;
    }
    return Math.ceil(counts[category] / this.itemsOnPage);
  }
  setCategoryPage(category: string, page: number) {
    this.categoryCurrentPage$.next({
      ...this.categoryCurrentPage$.value,
      [category]: page
    });
  }
}