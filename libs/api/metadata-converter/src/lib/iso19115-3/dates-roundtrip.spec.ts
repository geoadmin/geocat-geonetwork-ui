/**
 * Test dates round-trip: write → read cycle
 */
import { Iso191153Converter } from './iso19115-3.converter'
import { GENERIC_DATASET_RECORD } from '../fixtures/generic.records'

describe('Dates Round-trip', () => {
  let converter: Iso191153Converter

  beforeEach(() => {
    converter = new Iso191153Converter()
  })

  it('writes and reads record dates correctly', async () => {
    // Create a record with record dates
    const record = {
      ...GENERIC_DATASET_RECORD,
      recordCreated: new Date('2021-11-15T09:00:00'),
      recordPublished: new Date('2022-01-01T10:00:00'),
      recordUpdated: new Date('2022-02-01T15:12:00'),
    }

    // Write to XML
    const xml = await converter.writeRecord(record)

    console.log('Written XML (record dates):', xml)

    // Check if dates are in XML
    expect(xml).toContain('2021-11-15T09:00:00')
    expect(xml).toContain('2022-01-01T10:00:00')
    expect(xml).toContain('2022-02-01T15:12:00')

    // Read back
    const readRecord = await converter.readRecord(xml)

    // Verify dates are preserved
    expect(readRecord.recordCreated).toEqual(new Date('2021-11-15T09:00:00'))
    expect(readRecord.recordPublished).toEqual(new Date('2022-01-01T10:00:00'))
    expect(readRecord.recordUpdated).toEqual(new Date('2022-02-01T15:12:00'))
  })

  it('writes and reads resource dates correctly', async () => {
    // Create a record with resource dates
    const record = {
      ...GENERIC_DATASET_RECORD,
      resourceCreated: new Date('2022-09-01T14:18:19'),
      resourceUpdated: new Date('2022-12-04T15:12:00'),
    }

    // Write to XML
    const xml = await converter.writeRecord(record)

    console.log('Written XML (resource dates):', xml)

    // Check if dates are in XML
    expect(xml).toContain('2022-09-01T14:18:19')
    expect(xml).toContain('2022-12-04T15:12:00')

    // Read back
    const readRecord = await converter.readRecord(xml)

    // Verify dates are preserved
    expect(readRecord.resourceCreated).toEqual(new Date('2022-09-01T14:18:19'))
    expect(readRecord.resourceUpdated).toEqual(new Date('2022-12-04T15:12:00'))
  })
})
