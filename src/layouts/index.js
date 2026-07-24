import { renderBlock } from '../blocks/index.js'
import { createEmptyBlock } from '../lib/screen-content.js'
import { isEmergencyLayoutName } from '../lib/slide-background.js'
import { renderConfiguredLayout } from './configured-layout.js'


const INFO_SCREEN_LAYOUT_NAME = 'ser_info'

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
  'kom_vote_gallery': {
    axis: 'rows',
    tracks: [2, 2],
  },
}

export function renderSlideLayout(slide) {
  if (isEmergencyLayoutName(slide.layoutName)) {
    return renderEmergencyLayout(slide)
  }

  if (slide.layoutName === INFO_SCREEN_LAYOUT_NAME) {
    return renderInfoScreenLayout(slide)
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

function renderInfoScreenLayout(slide) {
  if (slide.blocks.length < 2) {
    return renderConfiguredLayout(
      slide,
      { renderBlock, createEmptyBlock },
      { axis: 'rows', tracks: [1] },
    )
  }

  const layout = document.createElement('section')
  const wave = document.createElement('div')

  layout.className = 'screen-layout screen-layout--info'
  wave.className = 'screen-info-wave'

  const block1 = renderBlock(slide.blocks[0], 0)
  const block2 = renderBlock(slide.blocks[1], 1)

  layout.append(block1, wave, block2)
  return layout
}