/**
 * Test topics and subtopics round-trip: write → read cycle
 */
import { Iso191153Converter } from './iso19115-3.converter'
import { GENERIC_DATASET_RECORD } from '../fixtures/generic.records'

describe('Topics and SubTopics Round-trip', () => {
  let converter: Iso191153Converter

  beforeEach(() => {
    converter = new Iso191153Converter()
  })

  it('writes and reads topics correctly', async () => {
    // Create a record with topics and subtopics
    const record = {
      ...GENERIC_DATASET_RECORD,
      topics: ['biota', 'environment'],
      subTopics: ['species', 'habitat'],
    }

    // Write to XML
    const xml = await converter.writeRecord(record)

    // Read back
    const readRecord = await converter.readRecord(xml)

    // Verify topics and subtopics are preserved
    expect(readRecord.topics).toEqual(['biota', 'environment'])
    expect(readRecord.subTopics).toEqual(['species', 'habitat'])
  })

  it('handles empty topics and subtopics', async () => {
    // Create a record without topics and subtopics
    const record = {
      ...GENERIC_DATASET_RECORD,
      topics: [],
      subTopics: [],
    }

    // Write to XML
    const xml = await converter.writeRecord(record)

    // Read back
    const readRecord = await converter.readRecord(xml)

    // Verify empty arrays are preserved or undefined
    expect(readRecord.topics).toEqual([])
    // subTopics can be undefined or empty array if not written
    expect(readRecord.subTopics === undefined || readRecord.subTopics?.length === 0).toBe(true)
  })

  it('handles missing subtopics (undefined)', async () => {
    // Create a record without subtopics (they don't exist in the record at all)
    const record = {
      ...GENERIC_DATASET_RECORD,
      topics: ['agriculture'],
      // subTopics not defined - should be undefined
    }

    // Write to XML
    const xml = await converter.writeRecord(record)

    // Read back
    const readRecord2 = await converter.readRecord(xml)

    // Verify topics are preserved
    expect(readRecord2.topics).toEqual(['agriculture'])
    // subTopics should either be undefined or empty array depending on implementation
    expect(readRecord2.subTopics === undefined || readRecord2.subTopics === []).toBe(true)
  })

  it('xml contains correct topic element structure', async () => {
    const record = {
      ...GENERIC_DATASET_RECORD,
      topics: ['biota'],
      subTopics: ['species'],
    }

    const xml = await converter.writeRecord(record)

    // Verify topic element structure
    expect(xml).toContain('mri:topicCategory')
    expect(xml).toContain('mcc:MD_TopicCategoryCode')
    expect(xml).toContain('biota')

    // Verify subtopic element structure
    expect(xml).toContain('che:subTopicCategory')
    expect(xml).toContain('che:CHE_MD_SubTopicCategoryCode')
    expect(xml).toContain('species')
  })
})
