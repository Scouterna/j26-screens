import defaultSlidesUrl from './assets/j26_default.json?url'
import './style.css'
import { normalizeScreenPayload, richTextToHtml } from './lib/screen-content.js'
import { renderSlideLayout } from './layouts/index.js'
import { createTicker } from './ticker/index.js'

const DEFAULT_SLUG = 'j26_default'
const SAME_ORIGIN_API_BASE = '/_services/cms/api/screens'
const REMOTE_API_BASE = 'https://app.dev.j26.se/_services/cms/api/screens'
const GLOBAL_INFO_URL = '/_services/cms/api/globals/important-info'
const DEFAULT_REFRESH_MINUTES = 2
const MIN_REFRESH_INTERVAL_MS = 15000
const IMPORTANT_INFO_POLL_INTERVAL_MS = 30_000

const app = document.querySelector('#app')

boot()

function boot() {
  const params = new URLSearchParams(window.location.search)
  const rawSlug = params.get('slug')?.trim() || DEFAULT_SLUG

  if (isComparisonSlug(rawSlug)) {
    renderComparisonView(rawSlug)
    return
  }

  mountScreen(app, rawSlug)
}

function isComparisonSlug(slug) {
  return slug !== DEFAULT_SLUG && !slug.endsWith('_ser') && !slug.endsWith('_kom')
}

function renderComparisonView(baseSlug) {
  const wrapper = document.createElement('div')
  const serPanel = createComparisonPanel('Servicebild', `${baseSlug}_ser`)
  const komPanel = createComparisonPanel('Innehållsbild', `${baseSlug}_kom`)

  wrapper.className = 'screen-comparison'

  wrapper.append(serPanel.panel, komPanel.panel)
  app.replaceChildren(wrapper)

  mountScreen(serPanel.stageMount, `${baseSlug}_ser`)
  mountScreen(komPanel.stageMount, `${baseSlug}_kom`)
}

function createComparisonPanel(label, slug) {
  const panel = document.createElement('div')
  const heading = document.createElement('p')
  const stageMount = document.createElement('div')

  panel.className = 'screen-comparison__panel'
  heading.className = 'screen-comparison__label'
  heading.textContent = `${label} · ${slug}`
  stageMount.className = 'screen-comparison__stage'

  panel.append(heading, stageMount)

  return { panel, stageMount }
}

function mountScreen(mountElement, slug) {
  const state = {
    slides: [],
    slideIndex: 0,
    rotationTimer: 0,
    refreshTimer: 0,
    importantInfoTimer: 0,
    refreshInFlight: false,
    slidesSignature: '',
    activeApiBase: '',
    etag: '',
    lastModified: '',
    rollingText: '',
    importantInfo: null,
    bottomIframeURL: '',
    isServiceScreen: false,
  }

  let stageContainerElement
  let stageElement
  let slideIndicatorElement
  let tickerElement
  let votingOverlayElement

  bootInstance()

  async function bootInstance() {
    const runtime = getRuntimeConfig()

    state.isServiceScreen = runtime.slug.endsWith('_ser')

    renderShell(runtime)
    renderStageState({
      title: 'Hämtar skärminnehåll',
      body: 'Försöker läsa slide-data från CMS och bygga upp layouts dynamiskt.',
    })

    try {
      const [initialLoad, initialInfo] = await Promise.all([
        loadSlides(runtime),
        fetchImportantInfo(),
      ])

      const slides = initialLoad.slides

      if (!slides.length) {
        throw new Error('API:et returnerade inga slides.')
      }

      state.slides = slides
      state.slidesSignature = createSlidesSignature(slides)
      state.slideIndex = 0
      state.importantInfo = initialInfo
      updateRefreshMetadata(initialLoad)
      applyScreenData(initialLoad)

      renderActiveSlide()
      startRotation()
      startRefreshLoop(runtime)
      startImportantInfoPolling()
    } catch (error) {
      renderError(error, runtime.slug)
    }
  }

  async function loadSlides(runtime, options = {}) {
    if (runtime.slug === DEFAULT_SLUG) {
      const result = await fetchSlides(defaultSlidesUrl, 'standardinnehållet')

      if (result.notModified) {
        return {
          slides: state.slides,
          rollingText: state.rollingText,
          bottomIframeURL: state.bottomIframeURL,
          notModified: true,
        }
      }

      const normalized = normalizeScreenPayload(result.payload)

      return {
        ...normalized,
        notModified: false,
        etag: result.etag,
        lastModified: result.lastModified,
      }
    }

    let lastError = null
    const preferredApiBases = prioritizeApiBases(runtime.apiBases)

    for (const apiBase of preferredApiBases) {
      const endpoint = buildEndpoint(apiBase, runtime.slug)
      const useValidators = Boolean(options.background) && apiBase === state.activeApiBase

      try {
        const result = await fetchSlides(
          endpoint,
          'endpointen',
          useValidators
            ? {
                etag: state.etag,
                lastModified: state.lastModified,
              }
            : undefined,
        )

        if (result.notModified) {
          return {
            slides: state.slides,
            rollingText: state.rollingText,
            bottomIframeURL: state.bottomIframeURL,
            notModified: true,
            apiBase,
            etag: result.etag,
            lastModified: result.lastModified,
          }
        }

        const normalized = normalizeScreenPayload(result.payload)

        return {
          ...normalized,
          notModified: false,
          apiBase,
          etag: result.etag,
          lastModified: result.lastModified,
        }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError ?? new Error('Kunde inte läsa API-data.')
  }

  function getRuntimeConfig() {
    const params = new URLSearchParams(window.location.search)
    const explicitApiBase = sanitizeApiBase(
      params.get('apiBase')?.trim() || import.meta.env.VITE_SCREENS_API_BASE?.trim(),
    )
    const animationsEnabled = params.get('animation')?.trim().toLowerCase() !== 'off'
    const refreshIntervalMs = getRefreshIntervalMs(params, slug)

    if (explicitApiBase) {
      return {
        slug,
        apiBases: [explicitApiBase],
        animationsEnabled,
        refreshIntervalMs,
      }
    }

    return {
      slug,
      apiBases: isLocalHost() ? [SAME_ORIGIN_API_BASE, REMOTE_API_BASE] : [SAME_ORIGIN_API_BASE],
      animationsEnabled,
      refreshIntervalMs,
    }
  }

  function isLocalHost() {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname)
  }

  function sanitizeApiBase(value) {
    if (!value) {
      return ''
    }

    return value.replace(/\/+$/, '')
  }

  function getRefreshIntervalMs(params, currentSlug) {
    const refreshToggle = params.get('refresh')?.trim().toLowerCase()

    if (refreshToggle === 'off') {
      return 0
    }

    const rawMinutes =
      params.get('refreshMinutes')?.trim() || import.meta.env.VITE_SCREENS_REFRESH_MINUTES?.trim()
    const fallbackMinutes = currentSlug === DEFAULT_SLUG ? 0 : DEFAULT_REFRESH_MINUTES
    const refreshMinutes = getNumber(rawMinutes, fallbackMinutes)

    if (refreshMinutes <= 0) {
      return 0
    }

    return Math.max(Math.round(refreshMinutes * 60 * 1000), MIN_REFRESH_INTERVAL_MS)
  }

  function getNumber(value, fallback) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
      return fallback
    }

    return parsed
  }

  function prioritizeApiBases(apiBases) {
    if (!state.activeApiBase || !apiBases.includes(state.activeApiBase)) {
      return apiBases
    }

    return [state.activeApiBase, ...apiBases.filter((apiBase) => apiBase !== state.activeApiBase)]
  }

  function buildEndpoint(apiBase, endpointSlug) {
    return `${sanitizeApiBase(apiBase)}/${encodeURIComponent(endpointSlug)}/content`
  }

  async function fetchSlides(resource, sourceLabel, validators = {}) {
    const headers = {
      accept: 'application/json',
    }

    if (validators.etag) {
      headers['if-none-match'] = validators.etag
    }

    if (validators.lastModified) {
      headers['if-modified-since'] = validators.lastModified
    }

    const response = await fetch(resource, {
      headers,
      cache: 'no-cache',
    })

    const etag = response.headers.get('etag') || validators.etag || ''
    const lastModified = response.headers.get('last-modified') || validators.lastModified || ''

    if (response.status === 304) {
      return {
        notModified: true,
        etag,
        lastModified,
      }
    }

    if (!response.ok) {
      throw new Error(`Kunde inte läsa ${sourceLabel} (${response.status} ${response.statusText}).`)
    }

    return {
      notModified: false,
      payload: await response.json(),
      etag,
      lastModified,
    }
  }

  function createSlidesSignature(slides) {
    return JSON.stringify(slides)
  }

  function updateRefreshMetadata(loadResult) {
    if (!loadResult) {
      return
    }

    if (loadResult.apiBase) {
      state.activeApiBase = loadResult.apiBase
    }

    state.etag = loadResult.etag || ''
    state.lastModified = loadResult.lastModified || ''
  }

  function startRefreshLoop(runtime) {
    window.clearTimeout(state.refreshTimer)

    if (runtime.refreshIntervalMs <= 0) {
      return
    }

    const runLoop = () => {
      state.refreshTimer = window.setTimeout(async () => {
        await refreshSlides(runtime)
        runLoop()
      }, runtime.refreshIntervalMs)
    }

    runLoop()
  }

  async function refreshSlides(runtime) {
    if (state.refreshInFlight) {
      return
    }

    state.refreshInFlight = true

    try {
      const result = await loadSlides(runtime, { background: true })

      updateRefreshMetadata(result)

      if (result.notModified || !result.slides.length) {
        return
      }

      const nextSignature = createSlidesSignature(result.slides)
      const screenDataChanged =
        result.rollingText !== state.rollingText ||
        result.bottomIframeURL !== state.bottomIframeURL

      if (nextSignature === state.slidesSignature && !screenDataChanged) {
        return
      }

      applyScreenData(result)

      const currentSlideId = state.slides[state.slideIndex]?.id

      state.slides = result.slides
      state.slidesSignature = nextSignature

      if (currentSlideId) {
        const matchedIndex = state.slides.findIndex((slide) => slide.id === currentSlideId)

        if (matchedIndex >= 0) {
          state.slideIndex = matchedIndex
        } else if (state.slideIndex >= state.slides.length) {
          state.slideIndex = 0
        }
      } else {
        state.slideIndex = 0
      }

      renderActiveSlide()
      startRotation()
    } catch (error) {
      console.warn('Bakgrundsuppdatering misslyckades.', error)
    } finally {
      state.refreshInFlight = false
    }
  }

  function renderShell(runtime) {
    const shell = document.createElement('div')
    const stage = document.createElement('div')
    const main = document.createElement('main')
    const slideContent = document.createElement('div')
    const slideIndicator = document.createElement('div')
    const votingOverlay = document.createElement('div')
    const ticker = createTicker('')

    shell.className = 'screen-shell'
    shell.dataset.animations = runtime.animationsEnabled ? 'on' : 'off'
    stage.className = 'screen-stage'
    main.className = 'screen-stage__content'
    main.dataset.role = 'stage'
    slideContent.className = 'screen-stage__slide'
    slideIndicator.className = 'screen-stage__indicator'
    slideIndicator.hidden = true
    slideIndicator.setAttribute('aria-live', 'polite')
    votingOverlay.className = 'screen-voting-overlay'
    votingOverlay.hidden = true
    ticker.hidden = true

    main.append(slideContent, votingOverlay)
    stage.append(main, slideIndicator, ticker)
    shell.append(stage)
    mountElement.replaceChildren(shell)

    stageContainerElement = stage
    stageElement = slideContent
    slideIndicatorElement = slideIndicator
    tickerElement = ticker
    votingOverlayElement = votingOverlay
  }

  function renderActiveSlide() {
    const slide = state.slides[state.slideIndex]

    if (!slide) {
      return
    }

    const children = [renderSlideLayout(slide)]

    if (state.isServiceScreen && state.importantInfo) {
      children.push(createImportantInfoBanner(state.importantInfo))
    }

    stageElement.replaceChildren(...children)
    renderSlideIndicator()
  }

  function startRotation() {
    window.clearTimeout(state.rotationTimer)

    const slide = state.slides[state.slideIndex]

    if (!slide) {
      return
    }

    if (state.slides.length < 2) {
      return
    }

    state.rotationTimer = window.setTimeout(() => {
      state.slideIndex = (state.slideIndex + 1) % state.slides.length
      renderActiveSlide()
      startRotation()
    }, slide.durationSeconds * 1000)
  }

  function renderStageState({ title, body }) {
    const section = document.createElement('section')
    const panel = document.createElement('div')
    const eyebrow = document.createElement('p')
    const titleElement = document.createElement('h1')
    const bodyElement = document.createElement('p')

    section.className = 'state-card'
    panel.className = 'state-card__panel'
    eyebrow.className = 'state-card__eyebrow'
    titleElement.className = 'state-card__title'
    bodyElement.className = 'state-card__body'

    eyebrow.textContent = 'Screen renderer'
    titleElement.textContent = title
    bodyElement.textContent = body

    panel.append(eyebrow, titleElement, bodyElement)
    section.append(panel)
    stageElement.replaceChildren(section)
    renderSlideIndicator()
  }

  function renderSlideIndicator() {
    if (!slideIndicatorElement) {
      return
    }

    if (state.slides.length < 2) {
      slideIndicatorElement.hidden = true
      slideIndicatorElement.replaceChildren()
      slideIndicatorElement.removeAttribute('aria-label')
      return
    }

    const fragment = document.createDocumentFragment()

    slideIndicatorElement.hidden = false
    slideIndicatorElement.setAttribute(
      'aria-label',
      `Slide ${state.slideIndex + 1} av ${state.slides.length}`,
    )

    for (let index = 0; index < state.slides.length; index += 1) {
      const dot = document.createElement('span')

      dot.className = 'screen-stage__indicator-dot'
      dot.dataset.active = index === state.slideIndex ? 'true' : 'false'
      dot.setAttribute('aria-hidden', 'true')
      fragment.append(dot)
    }

    slideIndicatorElement.replaceChildren(fragment)
  }

  function applyScreenData(loadResult) {
    const rollingText = loadResult.rollingText || ''
    const bottomIframeURL = loadResult.bottomIframeURL || ''

    if (rollingText !== state.rollingText) {
      state.rollingText = rollingText
      const newTicker = createTicker(rollingText)
      stageContainerElement.replaceChild(newTicker, tickerElement)
      tickerElement = newTicker
    }

    tickerElement.hidden = !!bottomIframeURL

    state.bottomIframeURL = bottomIframeURL

    if (votingOverlayElement) {
      if (bottomIframeURL) {
        const iframe = document.createElement('iframe')
        iframe.src = bottomIframeURL
        iframe.title = 'Omröstning'
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'
        iframe.loading = 'eager'
        votingOverlayElement.replaceChildren(iframe)
        votingOverlayElement.hidden = false
      } else {
        votingOverlayElement.hidden = true
        votingOverlayElement.replaceChildren()
      }
    }

    if (stageContainerElement) {
      stageContainerElement.dataset.voting = bottomIframeURL ? 'true' : 'false'
    }
  }

  async function fetchImportantInfo() {
    try {
      const response = await fetch(GLOBAL_INFO_URL, {
        headers: { accept: 'application/json' },
        cache: 'no-cache',
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      if (!data?.active || !data.content?.root) {
        return null
      }

      const html = richTextToHtml(data.content)
      return html ? { html } : null
    } catch {
      return null
    }
  }

  function startImportantInfoPolling() {
    window.clearTimeout(state.importantInfoTimer)

    const runLoop = () => {
      state.importantInfoTimer = window.setTimeout(async () => {
        await refreshImportantInfo()
        runLoop()
      }, IMPORTANT_INFO_POLL_INTERVAL_MS)
    }

    runLoop()
  }

  async function refreshImportantInfo() {
    const nextInfo = await fetchImportantInfo()
    const changed = JSON.stringify(nextInfo) !== JSON.stringify(state.importantInfo)

    if (!changed) {
      return
    }

    state.importantInfo = nextInfo

    if (state.slides.length > 0) {
      renderActiveSlide()
    }
  }

  function createImportantInfoBanner(info) {
    const banner = document.createElement('div')
    const inner = document.createElement('div')
    const header = document.createElement('div')
    const title = document.createElement('span')
    const body = document.createElement('div')
    const content = document.createElement('div')

    banner.className = 'important-info-banner'
    inner.className = 'important-info-banner__inner'
    header.className = 'important-info-banner__header'
    title.className = 'important-info-banner__title'
    title.textContent = 'Gul varning'
    body.className = 'important-info-banner__body'
    content.className = 'rich-text'
    content.innerHTML = info.html

    header.append(createWarningTriangleSVG(), title)
    body.append(content)
    inner.append(header, body)
    banner.append(inner)
    return banner
  }

  function createWarningTriangleSVG() {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('class', 'important-info-banner__icon')

    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', 'M1 21h22L12 2 1 21z')
    path.setAttribute('fill', '#f5d000')
    path.setAttribute('stroke', '#cc2200')
    path.setAttribute('stroke-width', '1.5')
    path.setAttribute('stroke-linejoin', 'round')

    const exclamation = document.createElementNS(ns, 'text')
    exclamation.setAttribute('x', '12')
    exclamation.setAttribute('y', '18.5')
    exclamation.setAttribute('text-anchor', 'middle')
    exclamation.setAttribute('font-size', '10')
    exclamation.setAttribute('font-weight', '900')
    exclamation.setAttribute('fill', '#1a1a1a')
    exclamation.textContent = '!'

    svg.append(path, exclamation)
    return svg
  }

  function renderError(error, failedSlug) {
    const message = error instanceof Error ? error.message : 'Okänt fel vid hämtning av innehåll.'

    renderStageState({
      title: 'Kunde inte läsa innehåll',
      body: `${message} Kontrollera slug ${failedSlug} eller peka om.`,
    })
  }
}
