export function createTrackLayout({
  axis,
  tracks,
  background,
  blocks,
  renderBlock,
  createEmptyBlock,
}) {
  const layout = document.createElement('section')

  layout.className = `screen-layout screen-layout--${axis}`
  layout.style.setProperty('--track-count', tracks.length)
  applyLayoutBackground(layout, background)

  let blockIndex = 0

  tracks.forEach((slotCount) => {
    const track = document.createElement('div')

    track.className = 'screen-track'

    if (axis === 'rows') {
      track.style.gridTemplateColumns = `repeat(${slotCount}, minmax(0, 1fr))`
    } else {
      track.style.gridTemplateRows = `repeat(${slotCount}, minmax(0, 1fr))`
    }

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const block = blocks[blockIndex] ?? createEmptyBlock(`placeholder-${blockIndex + 1}`)
      track.append(renderBlock(block, blockIndex))
      blockIndex += 1
    }

    layout.append(track)
  })

  return layout
}

function applyLayoutBackground(layout, background) {
  const color = background?.color || 'var(--color-white)'

  layout.style.setProperty('--screen-layout-background-color', color)
}