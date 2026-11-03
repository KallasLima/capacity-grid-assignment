import { CapacityGrid } from './CapacityGrid'

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="Capacity home">
          <span className="brand-mark" aria-hidden="true">
            c
          </span>
          <span>capacity</span>
        </a>
        <span className="header-divider" />
        <span className="workspace-name">Team workspace</span>
        <span className="header-label">CAPACITY PLANNING</span>
      </header>
      <main>
        <CapacityGrid from="2025-12-29" to="2026-01-16" />
      </main>
    </div>
  )
}
