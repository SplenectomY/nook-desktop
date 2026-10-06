/**
 * Hand-drawn SVG weather icons so the forecast renders offline and matches
 * Nook's palette. Each returns an SVG string for a 64x64 viewBox.
 */
const SUN = '#ffd166'
const MOON = '#fff0c7'
const CLOUD = '#e8e4f5'
const DARK_CLOUD = '#b8b1cf'
const RAIN = '#7cc6ff'
const SNOW = '#ffffff'

const sun = (cx, cy, r) => {
  const rays = []
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    rays.push(`<line x1="${(cx + Math.cos(a) * (r + 4)).toFixed(1)}" y1="${(cy + Math.sin(a) * (r + 4)).toFixed(1)}" x2="${(cx + Math.cos(a) * (r + 9)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r + 9)).toFixed(1)}" stroke="${SUN}" stroke-width="3" stroke-linecap="round" />`)
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SUN}" />${rays.join('')}`
}

const moon = (cx, cy, r) =>
  `<path d="M${cx + r * 0.3} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.7} a${r * 0.78} ${r * 0.78} 0 1 1 -${r * 0.7} -${r * 1.7} z" fill="${MOON}" />`

const cloud = (color = CLOUD, dx = 0, dy = 0, scale = 1) =>
  `<g transform="translate(${dx} ${dy}) scale(${scale})"><path d="M18 46 h28 a9 9 0 0 0 1 -18 a12 12 0 0 0 -23 -3 a8 8 0 0 0 -6 21 z" fill="${color}" /></g>`

const drops = (n, dy = 50) => {
  const xs = n === 2 ? [26, 38] : [22, 32, 42]
  return xs.map(x => `<line x1="${x}" y1="${dy}" x2="${x - 3}" y2="${dy + 8}" stroke="${RAIN}" stroke-width="3" stroke-linecap="round" />`).join('')
}

const flakes = n => {
  const xs = n === 2 ? [26, 38] : [22, 32, 42]
  return xs.map(x => `<g stroke="${SNOW}" stroke-width="2" stroke-linecap="round"><line x1="${x}" y1="50" x2="${x}" y2="58" /><line x1="${x - 4}" y1="52" x2="${x + 4}" y2="56" /><line x1="${x + 4}" y1="52" x2="${x - 4}" y2="56" /></g>`).join('')
}

const bolt = () => `<polygon points="34,44 26,58 33,56 30,66 40,50 33,52 36,44" fill="${SUN}" />`

const fogLines = () => [44, 50, 56].map(y => `<line x1="16" y1="${y}" x2="48" y2="${y}" stroke="${CLOUD}" stroke-width="3" stroke-linecap="round" />`).join('')

const ICONS = {
  sunny: () => sun(32, 32, 12),
  'clear-night': () => `${moon(32, 32, 13)}<circle cx="50" cy="16" r="2" fill="${MOON}" /><circle cx="14" cy="22" r="1.5" fill="${MOON}" />`,
  'partly-cloudy-day': () => `${sun(24, 24, 9)}${cloud(CLOUD, 4, 6)}`,
  'partly-cloudy-night': () => `${moon(24, 22, 9)}${cloud(CLOUD, 4, 6)}`,
  cloudy: () => `${cloud(DARK_CLOUD, 10, -6, 0.8)}${cloud(CLOUD, 0, 4)}`,
  overcast: () => `${cloud(DARK_CLOUD, 8, -4, 0.85)}${cloud(DARK_CLOUD, -2, 6)}`,
  fog: () => `${cloud(DARK_CLOUD, 0, -8)}${fogLines()}`,
  drizzle: () => `${cloud(CLOUD, 0, -4)}${drops(2)}`,
  rain: () => `${cloud(DARK_CLOUD, 0, -4)}${drops(3)}`,
  thunder: () => `${cloud(DARK_CLOUD, 0, -6)}${bolt()}`,
  snow: () => `${cloud(CLOUD, 0, -4)}${flakes(2)}`,
  'heavy-snow': () => `${cloud(DARK_CLOUD, 0, -4)}${flakes(3)}`
}

const icon = name => {
  const draw = ICONS[name] || ICONS.cloudy
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${draw()}</svg>`
}

module.exports = { icon }
