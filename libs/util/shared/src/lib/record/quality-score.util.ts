import {
  CatalogRecord,
  RecordKind,
} from '@geonetwork-ui/common/domain/model/record'

type TValidatorMapper = {
  [key: string]: (metadata: Partial<CatalogRecord>) => boolean
}

const ValidatorMapper: TValidatorMapper = {
  title: (record) => !!record?.title,
  titleMultilingual: (record) => {
    const titleObject = record?.extras?.resourceTitleObject as Record<
      string,
      unknown
    > | undefined
    return !!(
      titleObject?.['langfre'] &&
      titleObject?.['langger']
    )
  },
  altTitleMultilingual: (record) => {
    const altTitleArray = record?.extras?.resourceAltTitleObject as Array<
      Record<string, unknown>
    > | undefined
    return !!(
      altTitleArray?.length &&
      altTitleArray.some((item) => {
        const langfre = item?.['langfre'] as string | undefined
        const langger = item?.['langger'] as string | undefined
        return (
          langfre &&
          langger &&
          langfre.trim().length <= 35 &&
          langger.trim().length <= 35
        )
      })
    )
  },
  abstract: (record) => !!record?.abstract,
  abstractMultilingual: (record) => {
    const abstractObject = record?.extras?.resourceAbstractObject as Record<
      string,
      unknown
    > | undefined
    return !!(
      abstractObject?.['langfre'] &&
      abstractObject?.['langger']
    )
  },
  keywords: (record) => (record?.keywords?.length ?? 0) > 1,
  legalConstraints: (record) =>
    !!(
      record?.legalConstraints?.length &&
      record.legalConstraints.some((c) => c?.text?.trim().length > 0)
    ),
  legalConstraintsOtherConstraints: (record) => {
    const otherConstraints = record?.extras
      ?.MD_LegalConstraintsOtherConstraintsObject as Array<Record<
      string,
      unknown
    >> | undefined
    return !!(
      otherConstraints?.length &&
      otherConstraints.some((c) =>
        Object.values(c).some(
          (val) => typeof val === 'string' && val.trim().length > 0
        )
      )
    )
  },
  contacts: (record) =>
    !!record?.contacts?.[0]?.email &&
    record.contacts[0].email !== 'missing@missing.com',
  contactsPointOfContactEmail: (record) => {
    const isValidEmail = (email: string) => {
      if (!email || typeof email !== 'string') return false
      email = email.trim()
      if (email.length < 5 || email.length > 254) return false

      const dummyPatterns =
        /^(test|example|demo|placeholder|dummy|fake|unknown|noemail|contact@contact)$/i
      if (dummyPatterns.test(email)) return false

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }
    return !!(
      record?.contactsForResource?.length &&
      record.contactsForResource.some(
        (c) =>
          c?.role === 'point_of_contact' &&
          c?.email &&
          isValidEmail(c.email as string)
      )
    )
  },
  contactsForResourceWithOwner: (record) =>
    !!(
      record?.contactsForResource?.length &&
      record.contactsForResource.some((c) => c?.role === 'owner')
    ),
  updateFrequency: (record) =>
    !!record?.updateFrequency && record.updateFrequency !== 'unknown',
  topics: (record) => (record?.topics?.length ?? 0) > 0,
  subtopics: (record) => (record?.subtopics?.length ?? 0) > 0,
  organisation: (record) => !!record?.contacts?.[0]?.organization?.name,
  source: (record) => !!record?.extras?.sourcesIdentifiers,
  status: (record) => {
    const statusObject = record?.extras?.cl_statusObject as Record<
      string,
      unknown
    > | undefined
    return !!statusObject
  },
} as const

export type ValidatorMapperKeys = keyof typeof ValidatorMapper & string

export function getAllKeysValidator() {
  return Object.keys(ValidatorMapper)
}

function getMappersFromKind(kind: RecordKind) {
  let kindKeys = <ValidatorMapperKeys[]>[]
  const commonsKeys = <ValidatorMapperKeys[]>[
    //Less precise as titleMultilingual
    //'title',
    'titleMultilingual',
    'altTitleMultilingual',
    'abstractMultilingual',
    //Less precise as abstractMultilingual
    //'abstract',
    'keywords',
    //Less precise as legalConstraintsOtherConstraints
    //'legalConstraints',
    'legalConstraintsOtherConstraints',
    //Less precise as contactsForResourceWithOwner
    //'contacts',
    'contactsPointOfContactEmail',
    'contactsForResourceWithOwner',
    'status',
  ]

  switch (kind) {
    case 'reuse':
      kindKeys = [
        //'topics',
        'subtopics',
        'organisation',
        'source'
      ]
      break
    case 'service':
      kindKeys = []
      break
    case 'dataset':
    default:
      kindKeys = [
        //Mandatory in eCH-0271 (maintenanceAndUpdateFrequency AND CI_DateTypeCode="creation")
        //'updateFrequency',
        //Mandatory in eCH-0271 (TopicCategory)
        //'topics',
        'subtopics',
        'organisation'
      ]
  }

  return [...commonsKeys, ...kindKeys]
}

export function getQualityValidators(
  record: Partial<CatalogRecord>,
  propsToValidate: ValidatorMapperKeys[]
) {
  const filteredProps = propsToValidate.filter((prop) =>
    getMappersFromKind(record.kind).includes(prop)
  )

  return filteredProps.map((name) => ({
    name,
    validator: () => ValidatorMapper[name](record),
  }))
}
