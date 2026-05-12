export function createBlockShell(type, index) {
  const article = document.createElement('article')
  article.className = `screen-block screen-block--${type}`
  article.style.setProperty('--block-index', index)
  return article
}

export function createMessageCard(title, body) {
  const wrapper = document.createElement('div')
  wrapper.className = 'empty-card'

  const bodyWrap = document.createElement('div')
  const label = document.createElement('div')
  label.className = 'empty-card__label'
  label.textContent = title

  const copy = document.createElement('p')
  copy.className = 'empty-card__copy'
  copy.textContent = body

  bodyWrap.append(label, copy)
  wrapper.append(bodyWrap)

  return wrapper
}