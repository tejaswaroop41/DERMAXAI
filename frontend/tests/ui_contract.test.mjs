import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const register = fs.readFileSync(path.join(root, 'src/pages/Register.jsx'), 'utf8')
const admin = fs.readFileSync(path.join(root, 'src/pages/Admin.jsx'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.jsx'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8')


test('registration UI is patient-only', () => {
  assert.doesNotMatch(register, /\{\s*\['patient','doctor'\]\s*\.map/)
  assert.match(register, /Doctor accounts must be provisioned by an administrator/)
  assert.match(register, /minLength=\{8\}/)
  assert.match(register, /maxLength=\{128\}/)
})


test('admin UI exposes doctor provisioning', () => {
  assert.match(api, /promote:\s*\(id\) => api\.post\(`\/admin\/users\/\$\{id\}\/promote-doctor`\)/)
  assert.match(admin, /Promote to doctor/)
  assert.match(admin, /adminApi\.promote\(user\.id\)/)
})


test('dashboard report downloads use authenticated API helper', () => {
  assert.match(dashboard, /import \{ diagnoseApi, doctorApi, reportApi \} from '..\/lib\/api'/)
  assert.match(dashboard, /reportApi\.download\(d\.report_url, `DERMAXAI_Report_\$\{d\.id\}\.pdf`\)/)
  assert.doesNotMatch(dashboard, /<a href=\{d\.report_url\}/)
})
