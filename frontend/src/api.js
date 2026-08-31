import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (res.status === 409) {
    const body = await res.json()
    // FastAPI wraps our detail object inside { detail: {...} }
    const inner = body.detail ?? body
    const err = new Error(`Duplicate customer: ${inner.fields?.join(', ')}`)
    err.isDuplicate = true
    err.fields = inner.fields ?? []
    throw err
  }

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const getCustomers   = ()         => apiFetch('/customers')
export const createCustomer = (data)     => apiFetch('/customers',        { method: 'POST',   body: JSON.stringify(data) })
export const updateCustomer = (id, data) => apiFetch(`/customers/${id}`,  { method: 'PUT',    body: JSON.stringify(data) })
export const deleteCustomer = (id)       => apiFetch(`/customers/${id}`,  { method: 'DELETE' })

// File upload — send FormData directly so the browser sets the correct
// multipart boundary; do NOT set Content-Type manually.
export async function importPreview(file) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/customers/import-preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Upload failed')
  }
  return res.json()
}

export async function importConfirm(rows, mapping) {
  return apiFetch('/customers/import-confirm', {
    method: 'POST',
    body: JSON.stringify({ rows, mapping }),
  })
}

export const extractCustomers = (raw_text) =>
  apiFetch('/agents/extract-customers', { method: 'POST', body: JSON.stringify({ raw_text }) })

export const normalizeAddresses = (raw_text, addresses) =>
  apiFetch('/agents/normalize-addresses', { method: 'POST', body: JSON.stringify({ raw_text, addresses }) })

// ── Set Routes ──────────────────────────────────────────────────────────────
export const getSetRoutes   = ()         => apiFetch('/set-routes')
export const createSetRoute = (data)     => apiFetch('/set-routes',       { method: 'POST',   body: JSON.stringify(data) })
export const updateSetRoute = (id, data) => apiFetch(`/set-routes/${id}`, { method: 'PUT',    body: JSON.stringify(data) })
export const deleteSetRoute = (id)       => apiFetch(`/set-routes/${id}`, { method: 'DELETE' })

// ── Agents + Solver ─────────────────────────────────────────────────────────
export const personalizeRoute = (data) =>
  apiFetch('/agents/personalize-route', { method: 'POST', body: JSON.stringify(data) })

export const optimizeRoute  = (data) =>
  apiFetch('/solver/optimize', { method: 'POST', body: JSON.stringify(data) })

export const getRouteStats = () => apiFetch('/route-runs/stats')
