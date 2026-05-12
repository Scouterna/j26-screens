import { createTrackLayout } from './shared.js'

export function renderConfiguredLayout(slide, helpers, config = {}) {
  const axis = config.axis ?? slide.structure?.axis ?? 'rows'
  const tracks = config.tracks ?? slide.structure?.tracks ?? [Math.max(slide.blocks?.length ?? 0, 1)]

  return createTrackLayout({
    axis,
    tracks,
    background: slide.background,
    blocks: slide.blocks,
    ...helpers,
  })
}