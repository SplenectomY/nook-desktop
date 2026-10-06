const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'app', 'main', 'i18n')
const english = require(path.join(dir, 'Nook_English.json'))

test('every language has every English key', () => {
  for (const file of fs.readdirSync(dir)) {
    const lang = require(path.join(dir, file))
    const missing = Object.keys(english).filter(k => lang[k] === undefined)
    assert.deepEqual(missing, [], `${file} is missing keys`)
  }
})

test('every data-i18n key in the markup is translated', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'main', 'index.html'), 'utf8')
  const keys = [...html.matchAll(/data-i18n(?:-title(?:-alt)?|-alt)?="([^"]+)"/g)].map(m => m[1])
  const missing = [...new Set(keys)].filter(k => english[k] === undefined)
  assert.deepEqual(missing, [])
})
