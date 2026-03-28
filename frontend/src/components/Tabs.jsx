// components/Tabs.jsx — Barra de tabs reutilizável

/**
 * tabs      — array de { id, label, icon }
 * activeTab — id da tab ativa
 * onChange  — fn(tabId)
 */
export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="xt-tabs">
      <div className="xt-tabs-inner">
        {tabs.map(({ id, label, icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`xt-tab${active ? ' active' : ''}`}
            >
              {icon && <span className="xt-tab-icon">{icon}</span>}
              {label}
              {active && <span className="xt-tab-indicator" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
