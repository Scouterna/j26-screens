import { createBlockShell } from './shared.js'
import { renderEmptyBlock } from './empty.js'

export function renderImageBlock(block, { index }) {
  if (!block.src) {
    return renderEmptyBlock(block, { index })
  }

  const article = createBlockShell('image', index)
  const figure = document.createElement('figure')
  const media = block.isVideo ? createVideoElement(block) : createImageElement(block)

  figure.className = 'media-card'
  figure.append(media)

  if (block.caption) {
    const caption = document.createElement('figcaption')
    caption.textContent = block.caption
    figure.append(caption)
  }

  article.append(figure)
  return article
}

function createImageElement(block) {
  const image = document.createElement('img')

  image.src = block.src
  image.alt = block.alt || 'Slide image'
  image.decoding = 'async'
  return image
}

function createVideoElement(block) {
  const video = document.createElement('video')
  const source = document.createElement('source')

  video.autoplay = true
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.setAttribute('aria-label', block.alt || 'Slide video')

  source.src = block.src

  if (block.mimeType) {
    source.type = block.mimeType
  }

  video.append(source)
  return video
}