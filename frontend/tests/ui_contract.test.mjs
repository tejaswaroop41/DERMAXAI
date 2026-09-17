import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const register = fs.readFileSync(path.join(root, 'src/pages/Register.jsx'), 'utf8')
const admin = fs.readFileSync(path.join(root, 'src/pages/Admin.jsx'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.jsx'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/lib/api.js'), 'utf8')
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
const profile = fs.readFileSync(path.join(root, 'src/pages/Profile.jsx'), 'utf8')


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


test('dashboard uses database-backed summary metrics', () => {
  assert.match(api, /summary:\s*\(\) => api\.get\('\/diagnose\/summary'\)/)
  assert.match(dashboard, /diagnoseApi\.summary\(\)/)
  assert.match(dashboard, /summary\?\.total_diagnoses/)
  assert.match(dashboard, /summary\?\.class_distribution/)
})


test('auth provider clears stale user state when no token exists', () => {
  assert.match(app, /const token = localStorage\.getItem\('token'\)/)
  assert.match(app, /if \(!token\) \{\s*localStorage\.removeItem\('user'\)\s*setUser\(null\)/s)
  assert.match(app, /setInitializing\(false\)/)
})


test('profile uses explicit PATCH semantics for clearing optional fields', () => {
  assert.match(api, /updateProfile: d => api\.patch\('\/patients\/profile', d\)/)
  assert.match(profile, /const emptyToNull = value => value === '' \|\| value == null \? null : value/)
  assert.match(profile, /value=\{form\.age \?\? ''\}/)
})
