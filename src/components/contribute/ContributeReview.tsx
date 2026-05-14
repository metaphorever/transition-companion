import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store'

const GITHUB_REPO = 'https://github.com/metaphorever/transition-companion'

function buildKnowledgeIssueUrl({
  itemSlug,
  itemLabel,
  processNotes,
  links,
  timeEstimate,
  costEstimate,
  isCustom,
}: {
  itemSlug: string
  itemLabel: string | null
  processNotes: string
  links: string
  timeEstimate: string
  costEstimate: string
  isCustom: boolean
}) {
  const prefix = isCustom ? '[KB New Item]' : '[KB Knowledge]'
  const title = itemLabel
    ? `${prefix} ${itemLabel}`
    : `${prefix} ${itemSlug}`

  const lines: string[] = []

  if (isCustom) {
    lines.push(`## Suggested item`, `- Label: ${itemLabel ?? itemSlug}`, '')
  } else {
    lines.push(`## Item`, `- Slug: ${itemSlug}`, itemLabel ? `- Label: ${itemLabel}` : '', '')
  }

  if (processNotes.trim()) {
    lines.push(`## Process notes`, processNotes.trim(), '')
  }

  if (links.trim()) {
    lines.push(`## Useful links`, links.trim(), '')
  }

  if (timeEstimate.trim()) {
    lines.push(`## Estimated time`, timeEstimate.trim(), '')
  }

  if (costEstimate.trim()) {
    lines.push(`## Estimated cost`, costEstimate.trim(), '')
  }

  if (!processNotes.trim() && !links.trim() && !timeEstimate.trim() && !costEstimate.trim()) {
    lines.push(
      `## Note`,
      isCustom
        ? 'Contributor is suggesting this item be added to the guide.'
        : 'Contributor completed this item and wants to flag it for review.',
      ''
    )
  }

  lines.push(`---`, `*Submitted via Transition Companion. Private notes not included.*`)

  const body = lines.filter((l) => l !== undefined).join('\n')
  const label = isCustom ? 'kb-new-item' : 'kb-knowledge'

  return (
    `${GITHUB_REPO}/issues/new` +
    `?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=${label}`
  )
}

function buildKnowledgeJson({
  itemSlug,
  itemLabel,
  processNotes,
  links,
  timeEstimate,
  costEstimate,
  isCustom,
}: {
  itemSlug: string
  itemLabel: string | null
  processNotes: string
  links: string
  timeEstimate: string
  costEstimate: string
  isCustom: boolean
}) {
  return JSON.stringify(
    {
      type: isCustom ? 'new_item' : 'knowledge',
      slug: itemSlug,
      ...(itemLabel ? { label: itemLabel } : {}),
      ...(processNotes.trim() ? { process_notes: processNotes.trim() } : {}),
      ...(links.trim() ? { useful_links: links.trim() } : {}),
      ...(timeEstimate.trim() ? { time_estimate: timeEstimate.trim() } : {}),
      ...(costEstimate.trim() ? { cost_estimate: costEstimate.trim() } : {}),
    },
    null,
    2
  )
}

export default function ContributeReview() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const kb = useAppStore((s) => s.kb)
  const userData = useAppStore((s) => s.userData)

  const kbItem = slug && kb ? (kb.items[slug] ?? null) : null
  const customItem = slug ? (userData.custom_items.find((c) => c.id === slug) ?? null) : null
  const isCustom = customItem !== null && kbItem === null
  const itemLabel = kbItem?.label ?? customItem?.label ?? null
  const personalNotes =
    slug ? (userData.checklist[slug]?.notes ?? '') : ''

  const backTo = searchParams.get('from') ?? (slug ? `/item/${slug}` : '/dashboard')
  const backLabel = searchParams.get('from')
    ? t('contribute_review.back_dashboard')
    : t('contribute_review.back_item')

  const [processNotes, setProcessNotes] = useState('')
  const [links, setLinks] = useState('')
  const [timeEstimate, setTimeEstimate] = useState('')
  const [costEstimate, setCostEstimate] = useState('')
  const [jsonCopied, setJsonCopied] = useState(false)

  if (!slug) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8">
        <p className="text-sm text-neutral-500">{t('contribute_review.no_item')}</p>
      </main>
    )
  }

  const handleIssueOpen = () => {
    const url = buildKnowledgeIssueUrl({
      itemSlug: slug,
      itemLabel,
      processNotes,
      links,
      timeEstimate,
      costEstimate,
      isCustom,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCopyJson = async () => {
    const json = buildKnowledgeJson({
      itemSlug: slug,
      itemLabel,
      processNotes,
      links,
      timeEstimate,
      costEstimate,
      isCustom,
    })
    await navigator.clipboard.writeText(json)
    setJsonCopied(true)
    setTimeout(() => setJsonCopied(false), 3000)
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-20">
      <div className="mb-6">
        <Link to={backTo} className="text-sm text-neutral-500 hover:text-neutral-700">
          &larr; {backLabel}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">{t('contribute_review.title')}</h1>
      <p className="text-sm text-neutral-600 mb-8 leading-relaxed">
        {isCustom
          ? t('contribute_review.intro_custom')
          : t('contribute_review.intro')}
      </p>

      <div className="space-y-6">
        {/* Item context */}
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
            {t('contribute_review.item_label')}
          </p>
          <p className="text-sm text-neutral-800">
            {itemLabel ?? slug}
          </p>
          {isCustom && (
            <p className="text-xs text-neutral-500 mt-1">
              {t('contribute_review.custom_note')}
            </p>
          )}
        </div>

        {/* What would be shared */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-4">
            {t('contribute_review.shared_heading')}
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="cr-process"
                className="block text-sm font-medium text-neutral-800 mb-1"
              >
                {t('contribute_review.field_process')}
              </label>
              <textarea
                id="cr-process"
                value={processNotes}
                onChange={(e) => setProcessNotes(e.target.value)}
                placeholder={t('contribute_review.field_process_placeholder')}
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="cr-links"
                className="block text-sm font-medium text-neutral-800 mb-1"
              >
                {t('contribute_review.field_links')}
              </label>
              <textarea
                id="cr-links"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder={t('contribute_review.field_links_placeholder')}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label
                  htmlFor="cr-time"
                  className="block text-sm font-medium text-neutral-800 mb-1"
                >
                  {t('contribute_review.field_time')}
                </label>
                <input
                  id="cr-time"
                  type="text"
                  value={timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value)}
                  placeholder={t('contribute_review.field_time_placeholder')}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="cr-cost"
                  className="block text-sm font-medium text-neutral-800 mb-1"
                >
                  {t('contribute_review.field_cost')}
                </label>
                <input
                  id="cr-cost"
                  type="text"
                  value={costEstimate}
                  onChange={(e) => setCostEstimate(e.target.value)}
                  placeholder={t('contribute_review.field_cost_placeholder')}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Private zone — personal notes */}
        {personalNotes && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('contribute_review.private_heading')}
              </p>
              <p className="text-xs text-neutral-400">
                {t('contribute_review.private_label')}
              </p>
            </div>
            <div className="px-3 py-3">
              <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap select-none">
                {personalNotes}
              </p>
            </div>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-neutral-500 leading-relaxed">
          {t('contribute_review.privacy_note')}
        </p>

        {/* Zero-fill note */}
        <p className="text-xs text-neutral-400 leading-relaxed">
          {t('contribute_review.zero_fill_note')}
        </p>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleIssueOpen}
            className="w-full py-3 px-4 bg-neutral-900 text-white rounded-lg text-sm font-medium text-left flex items-center justify-between"
          >
            <span>{t('contribute_review.issue_label')}</span>
            <span className="text-xs text-neutral-400">{t('contribute_review.issue_sublabel')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyJson}
            className="w-full py-3 px-4 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium text-left flex items-center justify-between hover:bg-neutral-50"
          >
            <span>
              {jsonCopied
                ? t('contribute_review.json_copied')
                : t('contribute_review.pr_label')}
            </span>
            <span className="text-xs text-neutral-500">{t('contribute_review.pr_sublabel')}</span>
          </button>
        </div>
      </div>
    </main>
  )
}
