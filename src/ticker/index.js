import './style.css'

const DEFAULT_TICKER_TEXT =
  'Välkommen till Stormöte 6 • All info finns på Navet'
const DEFAULT_TICKER_SEPARATOR_PATTERN = /\s*[•·●◦▪▫]\s*/u
const MAX_TICKER_REPEAT_COUNT = 12

export function createTicker(text = DEFAULT_TICKER_TEXT) {
  const ticker = document.createElement('aside')
  const viewport = document.createElement('div')
  const track = document.createElement('div')
  const primarySequence = document.createElement('div')
  const duplicateSequence = document.createElement('div')
  const items = normalizeTickerItems(text)

  ticker.className = 'screen-ticker'
  ticker.setAttribute('aria-label', 'Rullande meddelande')
  ticker.dataset.ready = 'false'
  viewport.className = 'screen-ticker__viewport'
  track.className = 'screen-ticker__track'
  primarySequence.className = 'screen-ticker__sequence'
  duplicateSequence.className = 'screen-ticker__sequence'
  duplicateSequence.setAttribute('aria-hidden', 'true')

  track.append(primarySequence, duplicateSequence)
  viewport.append(track)
  ticker.append(viewport)

  setupTickerLoop({
    ticker,
    primarySequence,
    duplicateSequence,
    items,
  })

  return ticker
}

function setupTickerLoop({ ticker, primarySequence, duplicateSequence, items }) {
  const syncTickerWidth = () => {
    const viewportWidth = ticker.clientWidth

    if (!viewportWidth) {
      return
    }

    let repeatCount = 1

    renderTickerSequence(primarySequence, items, repeatCount)

    while (
      primarySequence.scrollWidth < viewportWidth &&
      repeatCount < MAX_TICKER_REPEAT_COUNT
    ) {
      repeatCount += 1
      renderTickerSequence(primarySequence, items, repeatCount)
    }

    renderTickerSequence(duplicateSequence, items, repeatCount)
    ticker.style.setProperty('--screen-ticker-cycle-width', `${primarySequence.scrollWidth}px`)
    ticker.dataset.ready = 'true'
  }

  const resizeObserver = new ResizeObserver(syncTickerWidth)

  resizeObserver.observe(ticker)

  const fontsReady = document.fonts?.ready ?? Promise.resolve()

  fontsReady.then(syncTickerWidth)
}

function renderTickerSequence(sequence, items, repeatCount) {
  const fragment = document.createDocumentFragment()

  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    for (const item of items) {
      const textElement = document.createElement('span')
      const divider = document.createElement('span')

      textElement.className = 'screen-ticker__text'
      textElement.textContent = item
      divider.className = 'screen-ticker__divider'
      divider.setAttribute('aria-hidden', 'true')
      divider.textContent = '•'

      fragment.append(textElement, divider)
    }
  }

  sequence.replaceChildren(fragment)
}

function normalizeTickerItems(text) {
  return String(text)
    .split(DEFAULT_TICKER_SEPARATOR_PATTERN)
    .map((item) => item.trim())
    .filter(Boolean)
}
