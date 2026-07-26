import { renderBlock } from '../blocks/index.js'
import { createEmptyBlock } from '../lib/screen-content.js'
import { isEmergencyLayoutName } from '../lib/slide-background.js'
import { renderConfiguredLayout } from './configured-layout.js'

const INFO_SCREEN_LAYOUT_NAME = 'ser_info'
const GALLERY_LAYOUTS = {
  kom_gallery: [2, 1, 3],
  kom_vote_gallery: [1, 3],
  kom_two_rows: [1, 1],
}

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
  'kom_single': {
    axis: 'rows',
    tracks: [1],
  },
  'kom_vote_single': {
    axis: 'rows',
    tracks: [1],
  },
}

export function renderSlideLayout(slide) {
  if (isEmergencyLayoutName(slide.layoutName)) {
    return renderEmergencyLayout(slide)
  }

  if (slide.layoutName === INFO_SCREEN_LAYOUT_NAME) {
    return renderInfoScreenLayout(slide)
  }

  if (slide.layoutName in GALLERY_LAYOUTS) {
    return renderGalleryLayout(slide, GALLERY_LAYOUTS[slide.layoutName])
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

function renderGalleryLayout(slide, tracks) {
  const layout = document.createElement('section')

  layout.className = 'screen-layout screen-layout--gallery'

  let blockIndex = 0

  tracks.forEach((slotCount, trackIndex) => {
    if (trackIndex > 0) {
      const wave = document.createElement('div')
      wave.className = 'screen-info-wave'
      layout.append(wave)
    }

    const row = document.createElement('div')

    row.className = 'screen-gallery-row'
    row.dataset.aspect = slotCount >= 3 ? 'tall' : 'wide'
    row.style.gridTemplateColumns = `repeat(${slotCount}, minmax(0, 1fr))`

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const block = slide.blocks[blockIndex] ?? createEmptyBlock(`gallery-${blockIndex + 1}`)
      row.append(renderBlock(block, blockIndex))
      blockIndex += 1
    }

    layout.append(row)
  })

  return layout
}