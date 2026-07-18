import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { isEmergencyLayoutName, normalizeSlideBackground } from './slide-background.js'

const DEFAULT_DURATION_SECONDS = 10

export function normalizeScreenPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      slides: normalizeSlides(payload),
      rollingText: '',
      bottomIframeURL: '',
    }
  }

  return {
    slides: normalizeSlides(Array.isArray(payload?.slides) ? payload.slides : []),
    rollingText: typeof payload?.rollingText === 'string' ? payload.rollingText.trim() : '',
    bottomIframeURL: sanitizeExternalUrl(payload?.bottomIframeURL),
  }
}

export function normalizeSlides(payload) {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.map(normalizeSlide)
}

export function createEmptyBlock(id) {
  return {
    id,
    type: 'empty',
  }
}

export function sanitizeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  try {
    const url = new URL(value, window.location.origin)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }

    return url.toString()
  } catch {
    return ''
  }
}

function normalizeSlide(slide, index) {
  const blocks = Array.isArray(slide?.content)
    ? slide.content.map((block, blockIndex) => normalizeBlock(block, blockIndex))
    : []
  const layoutName = typeof slide?.layout === 'string' && slide.layout ? slide.layout : 'one-row-1'
  const emergencyLayout = isEmergencyLayoutName(layoutName)
  const safeBlocks = blocks.length > 0 ? blocks : emergencyLayout ? [] : [createEmptyBlock(`slide-${index + 1}`)]

  return {
    id: slide?.id ?? `slide-${index + 1}`,
    layoutName,
    durationSeconds: getDurationSeconds(slide?.duration),
    structure: emergencyLayout ? null : parseLayout(layoutName, safeBlocks.length),
    background: normalizeSlideBackground(layoutName),
    blocks: safeBlocks,
  }
}

function getDurationSeconds(value) {
  const duration = Number(value)

  if (!Number.isFinite(duration) || duration <= 0) {
    return DEFAULT_DURATION_SECONDS
  }

  return duration
}

function parseLayout(layoutName, blockCount) {
  const parts = String(layoutName)
    .toLowerCase()
    .split('-')
    .filter(Boolean)
  const axisIndex = parts.findIndex((part) => ['row', 'rows', 'column', 'columns'].includes(part))
  const axisToken = axisIndex >= 0 ? parts[axisIndex] : 'rows'
  const axis = axisToken.startsWith('column') ? 'columns' : 'rows'
  let tracks = parts
    .slice(axisIndex + 1)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => value > 0)

  if (!tracks.length) {
    tracks = [Math.max(blockCount, 1)]
  }

  const slotCount = tracks.reduce((sum, track) => sum + track, 0)

  if (slotCount < blockCount) {
    tracks.push(blockCount - slotCount)
  }

  return {
    axis,
    tracks,
  }
}

function normalizeBlock(block, index) {
  const blockType = block?.blockType ?? 'screen-empty-content'

  if (blockType === 'screen-rich-text-content') {
    return {
      id: block?.id ?? `rich-text-${index + 1}`,
      type: 'rich-text',
      html: richTextToHtml(block?.richText),
    }
  }

  if (blockType === 'screen-image-content') {
    const image = block?.image ?? {}

    return {
      id: block?.id ?? `image-${index + 1}`,
      type: 'image',
      src: pickImageUrl(image),
      alt: image.alt || image.caption || 'Slide image',
      caption: image.caption || '',
    }
  }

  if (blockType === 'screen-iframe-content') {
    return {
      id: block?.id ?? `iframe-${index + 1}`,
      type: 'iframe',
      url: sanitizeExternalUrl(block?.url),
    }
  }

  if (blockType === 'screen-empty-content') {
    return createEmptyBlock(block?.id ?? `empty-${index + 1}`)
  }

  return createEmptyBlock(block?.id ?? `unsupported-${index + 1}`)
}

function pickImageUrl(image) {
  if (!image || typeof image !== 'object') {
    return ''
  }

  return (
    image?.sizes?.lg?.url ||
    image?.sizes?.md?.url ||
    image?.sizes?.sm?.url ||
    image?.url ||
    ''
  )
}

export function richTextToHtml(richText) {
  if (!richText?.root) {
    return ''
  }

  try {
    return convertLexicalToHTML({
      data: richText,
      disableContainer: true,
    })
  } catch {
    return ''
  }
}