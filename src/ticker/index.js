import './style.css'

const DEFAULT_TICKER_TEXT =
  'Välkommen till Stormöte 6 • All info finns på Navet'

export function createTicker(text = DEFAULT_TICKER_TEXT) {
  const ticker = document.createElement('aside')
  const marquee = document.createElement('div')

  ticker.className = 'screen-ticker'
  ticker.setAttribute('aria-label', 'Rullande meddelande')
  marquee.className = 'screen-ticker__marquee'
  marquee.append(createTickerGroup(text), createTickerGroup(text, true))
  ticker.append(marquee)

  return ticker
}

function createTickerGroup(text, hidden = false) {
  const group = document.createElement('div')

  group.className = 'screen-ticker__group'

  if (hidden) {
    group.setAttribute('aria-hidden', 'true')
  }

  for (let index = 0; index < 3; index += 1) {
    const textElement = document.createElement('span')
    const divider = document.createElement('span')

    textElement.className = 'screen-ticker__text'
    textElement.textContent = text
    divider.className = 'screen-ticker__divider'
    divider.setAttribute('aria-hidden', 'true')
    divider.textContent = '•'

    group.append(textElement, divider)
  }

  return group
}