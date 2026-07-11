// Animated hamburger -> X toggle (adapted from a styled-components snippet to plain CSS).
// `open` reflects the nav drawer state; `onClick` flips it.
export default function MenuToggle({ open, onClick }) {
  return (
    <div className="menu-toggle-wrap">
      <input id="nav-checkbox" type="checkbox" checked={open} onChange={onClick} />
      <label className={`toggle ${open ? 'open' : ''}`} htmlFor="nav-checkbox" role="button" aria-label="Toggle navigation">
        <div id="bar1" className="bars" />
        <div id="bar2" className="bars" />
        <div id="bar3" className="bars" />
      </label>
    </div>
  )
}
