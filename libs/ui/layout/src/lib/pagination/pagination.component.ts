import { Component, Input, Output, EventEmitter } from '@angular/core'
import { ButtonComponent } from '@geonetwork-ui/ui/inputs'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { FormsModule } from '@angular/forms'
import {
  matChevronLeft,
  matChevronRight,
} from '@ng-icons/material-icons/baseline'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { Paginable } from '../paginable.interface'

@Component({
  selector: 'gn-ui-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    NgIcon,
    FormsModule,
    TranslateModule,
  ],
  viewProviders: [
    provideIcons({
      matChevronLeft,
      matChevronRight,
    }),
  ],
})
export class PaginationComponent {
  @Input() listComponent: Paginable
  @Input() currentPage: number = 1;
  @Input() pagesCount: number = 1;
  @Input() hideButton: boolean = false;
  @Output() pageChange = new EventEmitter<number>();

  get isFirstPage(): boolean {
    return this.currentPage <= 1;
  }

  get isLastPage(): boolean {
    return this.currentPage >= this.pagesCount;
  }

  private applyPageBounds(page: number): number {
    return Math.max(1, Math.min(this.pagesCount, page || 1));
  }

  setPage(newPage: number) {
    if (!Number.isInteger(newPage)) return;
    this.pageChange.emit(this.applyPageBounds(newPage));
  }

  goToNextPage() {
    if (this.currentPage < this.pagesCount) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  goToPrevPage() {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }
}
