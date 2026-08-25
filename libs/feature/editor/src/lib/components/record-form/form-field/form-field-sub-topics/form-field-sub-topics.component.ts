import { Component, EventEmitter, Input, Output, inject } from '@angular/core'

import {
  BadgeComponent,
  DropdownMultiselectComponent,
} from '@geonetwork-ui/ui/inputs'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import { CHE_SUB_TOPICS } from '../../../../fields.config'

@Component({
  selector: 'gn-ui-form-field-sub-topics',
  standalone: true,
  imports: [BadgeComponent, TranslatePipe, DropdownMultiselectComponent],
  templateUrl: './form-field-sub-topics.component.html',
  styleUrl: './form-field-sub-topics.component.css',
})
export class FormFieldSubTopicsComponent {
  private translateService = inject(TranslateService)

  subTopics: string[] = []
  @Input() set value(subTopics: string[] | null | undefined) {
    this.subTopics = subTopics || []
  }
  @Output() valueChange: EventEmitter<string[]> = new EventEmitter()
  availableSubTopics = CHE_SUB_TOPICS.map((topic) => {
    return {
      label: this.translateService.instant(topic.label),
      value: topic.value,
    }
  })

  handleItemSelection(selectedItems: string[]) {
    this.subTopics = selectedItems
    this.valueChange.emit(this.subTopics)
  }

  removeSubTopic(subTopic: string) {
    this.subTopics = this.subTopics.filter((t) => t !== subTopic)
    this.valueChange.emit(this.subTopics)
  }

  getTranslatedSubTopic(subTopic: string) {
    const topicKey = this.availableSubTopics.find(
      (avail) => avail.value === subTopic
    )?.label
    return topicKey ? this.translateService.instant(topicKey) : ''
  }
}
