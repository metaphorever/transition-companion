import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useAppStore } from '../../store'

const WHICH_OPTIONS = [
  'process_steps',
  'cost',
  'links',
  'time',
  'gender_marker',
  'access',
  'other',
] as const

type WhichOption = (typeof WHICH_OPTIONS)[number]

const GITHUB_REPO = 'https://github.com/metaphorever/transition-companion'

function buildIssueUrl({
  itemSlug,
  itemLabel,
  which,
  wrong,
  correct,
  source,
}: {
  itemSlug: string | null
  itemLabel: string | null
  which: WhichOption
  wrong: string
  correct: string
  source: string
}) {
  const title = itemLabel
    ? `[KB Update] ${itemLabel} — ${which.replace(/_/g, ' ')}`
    : `[KB Update] ${which.replace(/_/g, ' ')}`

  const lines: string[] = []

  if (itemSlug) {
    lines.push(`## Item`, `- Slug: ${itemSlug}`, itemLabel ? `- Label: ${itemLabel}` : '', '')
  }

  lines.push(`## What needs updating`, wrong, '')

  if (correct.trim()) {
    lines.push(`## Suggested correction`, correct, '')
  }

  if (source.trim()) {
    lines.push(`## Source`, source, '')
  }

  lines.push(`---`, `*Submitted via Transition Companion. Personal data not included.*`)

  const body = lines.filter((l) => l !== undefined).join('\n')

  return (
    `${GITHUB_REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=kb-update`
  )
}

function buildCorrectionJson({
  itemSlug,
  which,
  wrong,
  correct,
  source,
}: {
  itemSlug: string | null
  which: WhichOption
  wrong: string
  correct: string
  source: string
}) {
  return JSON.stringify(
    {
      slug: itemSlug ?? null,
      field: which,
      description_of_issue: wrong,
      ...(correct.trim() ? { suggested_correction: correct } : {}),
      ...(source.trim() ? { source_url: source } : {}),
    },
    null,
    2
  )
}

export default function Contribute() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug?: string }>()
  const kb = useAppStore((s) => s.kb)

  const item = slug && kb ? kb.items[slug] ?? null : null

  const [which, setWhich] = useState<WhichOption>('process_steps')
  const [wrong, setWrong] = useState('')
  const [correct, setCorrect] = useState('')
  const [source, setSource] = useState('')
  const [wrongError, setWrongError] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)

  const validate = (): boolean => {
    if (!wrong.trim()) {
      setWrongError(true)
      return false
    }
    setWrongError(false)
    return true
  }

  const handleIssueOpen = () => {
    if (!validate()) return
    const url = buildIssueUrl({
      itemSlug: slug ?? null,
      itemLabel: item?.label ?? null,
      which,
      wrong,
      correct,
      source,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCopyJson = async () => {
    if (!validate()) return
    const json = buildCorrectionJson({
      itemSlug: slug ?? null,
      which,
      wrong,
      correct,
      source,
    })
    await navigator.clipboard.writeText(json)
    setJsonCopied(true)
    setTimeout(() => setJsonCopied(false), 3000)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-20">
      <div className="mb-6">
        {slug ? (
          <Link
            to={`/item/${slug}`}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            &larr; {t('contribute.back')}
          </Link>
        ) : (
          <Link to="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-700">
            &larr; {t('contribute.back_default')}
          </Link>
        )}
      </div>

      <h1 className="text-2xl font-semibold mb-2">{t('contribute.title')}</h1>
      <p className="text-sm text-neutral-600 mb-8 leading-relaxed">{t('contribute.intro')}</p>

      <div className="space-y-6">
        {/* Item context */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Item</p>
          <p className="text-sm text-neutral-800">
            {item ? item.label : t('contribute.no_item')}
          </p>
        </div>

        {/* Which field */}
        <div>
          <label
            htmlFor="contribute-which"
            className="block text-sm font-medium text-neutral-800 mb-2"
          >
            {t('contribute.field_which')}
          </label>
          <select
            id="contribute-which"
            value={which}
            onChange={(e) => setWhich(e.target.value as WhichOption)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white"
          >
            {WHICH_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`contribute.which_options.${opt}`)}
              </option>
            ))}
          </select>
        </div>

        {/* What is wrong */}
        <div>
          <label
            htmlFor="contribute-wrong"
            className="block text-sm font-medium text-neutral-800 mb-2"
          >
            {t('contribute.field_wrong')}
          </label>
          <textarea
            id="contribute-wrong"
            value={wrong}
            onChange={(e) => {
              setWrong(e.target.value)
              if (e.target.value.trim()) setWrongError(false)
            }}
            placeholder={t('contribute.field_wrong_placeholder')}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md text-sm resize-none ${
              wrongError ? 'border-red-400' : 'border-neutral-300'
            }`}
          />
          {wrongError && (
            <p className="mt-1 text-xs text-red-600">{t('contribute.field_wrong_required')}</p>
          )}
        </div>

        {/* What should it say */}
        <div>
          <label
            htmlFor="contribute-correct"
            className="block text-sm font-medium text-neutral-800 mb-2"
          >
            {t('contribute.field_correct')}
          </label>
          <textarea
            id="contribute-correct"
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            placeholder={t('contribute.field_correct_placeholder')}
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
          />
        </div>

        {/* Source */}
        <div>
          <label
            htmlFor="contribute-source"
            className="block text-sm font-medium text-neutral-800 mb-2"
          >
            {t('contribute.field_source')}
          </label>
          <input
            id="contribute-source"
            type="url"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t('contribute.field_source_placeholder')}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        </div>

        {/* Privacy note */}
        <p className="text-xs text-neutral-500 leading-relaxed">
          {t('contribute.privacy_note')}
        </p>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <div>
            <button
              type="button"
              onClick={handleIssueOpen}
              className="w-full py-3 px-4 bg-neutral-900 text-white rounded-lg text-sm font-medium text-left flex items-center justify-between"
            >
              <span>{t('contribute.issue_label')}</span>
              <span className="text-xs text-neutral-400">{t('contribute.issue_sublabel')}</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={handleCopyJson}
              className="w-full py-3 px-4 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium text-left flex items-center justify-between hover:bg-neutral-50"
            >
              <span>{jsonCopied ? t('contribute.json_copied') : t('contribute.pr_label')}</span>
              <span className="text-xs text-neutral-500">{t('contribute.pr_sublabel')}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
