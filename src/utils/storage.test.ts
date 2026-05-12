import { describe, it, expect } from 'vitest'
import { mergeWithDefaults } from './storage'
import type { UserData } from '../types'

// Tests the pure migration function. Avoids localStorage so the default node
// vitest environment is sufficient — runtime callers use readUserData() /
// importUserData() which wrap mergeWithDefaults around localStorage I/O.

describe('mergeWithDefaults — Phase 14 schema additions', () => {
  it('defaults birth_jurisdiction to null and other_jurisdictions to [] when absent on an older profile', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — older blob without Phase 14 fields
      profile: { display_name: null, jurisdiction: { country: 'US', region: null } },
      checklist: {},
      custom_items: [],
      recurring_items: [],
      people: {},
    })
    expect(result.profile.birth_jurisdiction ?? null).toBeNull()
    expect(result.profile.other_jurisdictions ?? []).toEqual([])
  })

  it('preserves stored birth_jurisdiction and other_jurisdictions', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — partial profile for migration test
      profile: {
        display_name: null,
        jurisdiction: { country: 'US', region: 'IL' },
        birth_jurisdiction: { country: 'CA', region: 'ON' },
        other_jurisdictions: [{ country: 'MX', region: null }],
      },
      checklist: {},
      custom_items: [],
      recurring_items: [],
      people: {},
    })
    expect(result.profile.birth_jurisdiction).toEqual({ country: 'CA', region: 'ON' })
    expect(result.profile.other_jurisdictions).toEqual([{ country: 'MX', region: null }])
  })

  it('leaves new ChecklistEntry fields (priority, revisit_at, document_state) undefined for legacy entries', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — partial profile
      profile: { display_name: null, jurisdiction: { country: 'US', region: null } },
      checklist: {
        'ssa-name': {
          status: 'not_started',
          completed_at: null,
          blockers: [],
          notes: '',
          custom_fields: {},
          sub_tasks: [],
        } as unknown as UserData['checklist'][string],
      },
      custom_items: [],
      recurring_items: [],
      people: {},
    })
    const entry = result.checklist['ssa-name']
    expect(entry).toBeDefined()
    expect(entry.priority).toBeUndefined()
    expect(entry.revisit_at).toBeUndefined()
    expect(entry.document_state).toBeUndefined()
    // Intent still back-fills to 'update' per Phase 12 migration.
    expect(entry.intent).toBe('update')
  })

  it('preserves priority, revisit_at, and polymorphic document_state through migration', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — partial profile
      profile: {
        display_name: null,
        jurisdiction: { country: 'US', region: 'IL' },
      },
      checklist: {
        'us-passport-name': {
          status: 'in_progress',
          intent: 'update',
          priority: 'now',
          revisit_at: '2026-08-01',
          completed_at: null,
          blockers: [],
          notes: '',
          custom_fields: {},
          sub_tasks: [],
          document_state: {
            kind: 'name',
            name_status: 'old',
            issued: '2018-03-15',
            expiration_date: '2028-03-14',
          },
        },
        'il-dl': {
          status: 'not_started',
          intent: 'update',
          completed_at: null,
          blockers: [],
          notes: '',
          custom_fields: {},
          sub_tasks: [],
          document_state: {
            kind: 'full',
            name_status: 'new',
            marker_status: 'old',
            issued: '2022-01-01',
            expiration_date: '2030-01-01',
          },
        },
      } as unknown as UserData['checklist'],
      custom_items: [],
      recurring_items: [],
      people: {},
    })
    expect(result.checklist['us-passport-name'].priority).toBe('now')
    expect(result.checklist['us-passport-name'].revisit_at).toBe('2026-08-01')
    const passportDs = result.checklist['us-passport-name'].document_state
    expect(passportDs?.kind).toBe('name')
    if (passportDs?.kind === 'name') {
      expect(passportDs.expiration_date).toBe('2028-03-14')
    }
    const dlDs = result.checklist['il-dl'].document_state
    expect(dlDs?.kind).toBe('full')
    if (dlDs?.kind === 'full') {
      expect(dlDs.marker_status).toBe('old')
      expect(dlDs.name_status).toBe('new')
    }
  })

  it('preserves CustomItem provenance and aspiration_slug fields', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — partial profile
      profile: { display_name: null, jurisdiction: { country: 'MX', region: null } },
      checklist: {},
      custom_items: [
        {
          id: 'custom-abc',
          label: 'Legal name change',
          description: 'Placeholder',
          category: 'legal-name',
          track: 'legal',
          status: 'not_started',
          notes: '',
          provenance: 'aspiration_skeleton',
          aspiration_slug: 'legal-name-change',
        },
      ],
      recurring_items: [],
      people: {},
    })
    expect(result.custom_items[0].provenance).toBe('aspiration_skeleton')
    expect(result.custom_items[0].aspiration_slug).toBe('legal-name-change')
    // The custom item also gets a ChecklistEntry created if absent.
    expect(result.checklist['custom-abc']).toBeDefined()
    expect(result.checklist['custom-abc'].intent).toBe('update')
  })

  it('preserves Phase 13 marker-migration behavior (no regression)', () => {
    const result = mergeWithDefaults({
      version: '1.0',
      created_at: '2026-01-01T00:00:00Z',
      // @ts-expect-error — partial profile
      profile: { display_name: null, jurisdiction: { country: 'US', region: null } },
      checklist: {
        // Pre-Phase-13 slug
        'us-passport': {
          status: 'complete',
          completed_at: '2025-09-01T00:00:00Z',
          blockers: [],
          notes: '',
          custom_fields: {},
          sub_tasks: [],
        },
      } as unknown as UserData['checklist'],
      custom_items: [],
      recurring_items: [],
      people: {},
    })
    expect(result.checklist['us-passport']).toBeUndefined()
    expect(result.checklist['us-passport-name']).toBeDefined()
    expect(result.checklist['us-passport-name'].status).toBe('complete')
    expect(result.checklist['us-passport-marker']).toBeDefined()
    expect(result.checklist['us-passport-marker'].status).toBe('policy_blocked')
  })
})
