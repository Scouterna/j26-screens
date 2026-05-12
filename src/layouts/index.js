import { renderBlock } from '../blocks/index.js'
import { createEmptyBlock } from '../lib/screen-content.js'
import { isEmergencyLayoutName } from '../lib/slide-background.js'
import { renderConfiguredLayout } from './configured-layout.js'

const LAYOUT_CONFIGS = {
  'one-row-1': {
    axis: 'rows',
    tracks: [1],
  },
  'two-rows-1-1': {
    axis: 'rows',
    tracks: [1, 1],
  },
  'three-rows-2-1-3': {
    axis: 'rows',
    tracks: [2, 1, 3],
  },
}

export function renderSlideLayout(slide) {
  if (isEmergencyLayoutName(slide.layoutName)) {
    return renderEmergencyLayout(slide)
  }

  const layoutConfig = LAYOUT_CONFIGS[slide.layoutName] ?? slide.structure

  return renderConfiguredLayout(
    slide,
    {
      renderBlock,
      createEmptyBlock,
    },
    layoutConfig,
  )
}

function renderEmergencyLayout(slide) {
  const layout = document.createElement('section')

  layout.className = 'screen-layout screen-layout--emergency'
  layout.style.setProperty(
    '--screen-layout-background-color',
    slide.background?.color || 'var(--color-white)',
  )

  return layout
}