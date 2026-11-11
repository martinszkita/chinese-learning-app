(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).repository = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function create({ baseUrl = '/api', fetch: fetcher = globalThis.fetch } = {}) {
    async function request(path, method = 'GET', data) {
      const response = await fetcher(`${baseUrl}${path}`, { method, credentials: 'same-origin', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
      if (!response.ok) {
        const error = new Error(`Material request failed (${response.status})`);
        try { error.message = (await response.json()).error || error.message; } catch {}
        error.status = response.status; throw error;
      }
      return response.json();
    }
    return {
      load: () => request('/materials'),
      createCollection: data => request('/collections', 'POST', data),
      addItem: (sectionId, data) => request(`/sections/${encodeURIComponent(sectionId)}/items`, 'POST', data),
      updateItem: (id, data) => request(`/items/${encodeURIComponent(id)}`, 'PATCH', data),
      attachAudio: (placementId, data) => request(`/placements/${encodeURIComponent(placementId)}/audio`, 'POST', data)
    };
  }
  return { create };
});
