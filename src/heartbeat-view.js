const SAME_ORIGIN_API_BASE = '/_services/interactive-screens/api/heartbeat'
const REMOTE_API_BASE = 'https://app.dev.j26.se/_services/interactive-screens/api/heartbeat'
const POLL_INTERVAL_MS = 5000
const STALE_AFTER_S = 45
const OFFLINE_AFTER_S = 90

export function renderHeartbeatView(mountElement) {
  const apiBase = isLocalHost() ? REMOTE_API_BASE : SAME_ORIGIN_API_BASE

  const shell = document.createElement('div')
  const heading = document.createElement('h1')
  const updated = document.createElement('p')
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const tbody = document.createElement('tbody')

  shell.className = 'heartbeat-view'
  heading.textContent = 'Heartbeat — skärmöversikt'
  updated.className = 'heartbeat-view__updated'
  thead.innerHTML = `
    <tr>
      <th>Skärm</th>
      <th>Online</th>
      <th>HDMI</th>
      <th>Läsare</th>
      <th>Senast sedd</th>
      <th>Ålder</th>
    </tr>
  `

  table.append(thead, tbody)
  shell.append(heading, updated, table)
  mountElement.replaceChildren(shell)

  refresh()
  setInterval(refresh, POLL_INTERVAL_MS)

  async function refresh() {
    try {
      const response = await fetch(apiBase, {
        headers: { accept: 'application/json' },
        cache: 'no-cache',
      })

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
      }

      const payload = await response.json()
      const screens = Array.isArray(payload) ? payload : Object.values(payload ?? {})

      renderRows(screens)
      updated.textContent = `Uppdaterad ${new Date().toLocaleTimeString('sv-SE')}`
    } catch (error) {
      updated.textContent = `Kunde inte hämta heartbeat-data: ${error.message}`
    }
  }

  function renderRows(screens) {
    const now = Date.now()
    const sorted = [...screens].sort((a, b) => (a.screenId ?? '').localeCompare(b.screenId ?? ''))

    tbody.replaceChildren(
      ...sorted.map((screen) => {
        const lastSeen = screen.lastSeenAt ?? screen.receivedAt ?? ''
        const ageSeconds = lastSeen ? Math.round((now - new Date(lastSeen).getTime()) / 1000) : null
        const row = document.createElement('tr')

        row.innerHTML = `
          <td>${screen.screenId ?? '–'}</td>
          <td data-state="${screen.online ? 'ok' : 'bad'}">${screen.online ? 'Ja' : 'Nej'}</td>
          <td data-state="${screen.hdmiActive ? 'ok' : 'bad'}">${screen.hdmiActive ? 'Ja' : 'Nej'}</td>
          <td>${screen.readerCount ?? '–'}</td>
          <td>${lastSeen || '–'}</td>
          <td data-state="${ageState(ageSeconds)}">${ageSeconds === null ? '–' : `${ageSeconds}s`}</td>
        `
        return row
      }),
    )
  }

  function ageState(ageSeconds) {
    if (ageSeconds === null || ageSeconds > OFFLINE_AFTER_S) return 'bad'
    if (ageSeconds > STALE_AFTER_S) return 'stale'
    return 'ok'
  }

  function isLocalHost() {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname)
  }
}
