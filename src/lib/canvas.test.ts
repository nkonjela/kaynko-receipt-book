import { migrateSchema, SCHEMA_VERSION } from './canvas'

describe('migrateSchema', () => {
  it('adds schemaVersion=1 when data property is absent', () => {
    const input = { version: '6.0.0', objects: [] }
    const result = migrateSchema(input)
    expect((result['data'] as Record<string, unknown>)['schemaVersion']).toBe(1)
  })

  it('adds schemaVersion=1 when data.schemaVersion is 0', () => {
    const input = { objects: [], data: { schemaVersion: 0 } }
    const result = migrateSchema(input)
    expect((result['data'] as Record<string, unknown>)['schemaVersion']).toBe(1)
  })

  it('does not modify a schema already at version 1', () => {
    const input = { objects: [], data: { schemaVersion: 1, paperSize: 'A4' } }
    const result = migrateSchema(input)
    expect(result['data']).toEqual({ schemaVersion: 1, paperSize: 'A4' })
  })

  it('preserves existing data fields when migrating', () => {
    const input = { objects: [], data: { someOldField: true } }
    const result = migrateSchema(input)
    const data = result['data'] as Record<string, unknown>
    expect(data['someOldField']).toBe(true)
    expect(data['schemaVersion']).toBe(1)
  })

  it('does not mutate the original object', () => {
    const input = { objects: [], data: { schemaVersion: 0 } }
    migrateSchema(input)
    expect((input.data as Record<string, unknown>)['schemaVersion']).toBe(0)
  })

  it('preserves objects array and other root properties', () => {
    const input = { version: '6.0.0', objects: [{ type: 'Rect' }], background: '#fff', data: { schemaVersion: 0 } }
    const result = migrateSchema(input)
    expect(result['version']).toBe('6.0.0')
    expect(result['objects']).toEqual([{ type: 'Rect' }])
    expect(result['background']).toBe('#fff')
  })

  it('SCHEMA_VERSION export equals 1', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })
})
