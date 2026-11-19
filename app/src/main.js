// Bootstrapping for Vice Sunset Cover Lab: start the editor once the page
// is ready, and surface any boot failure on the page itself instead of
// failing silently with a blank screen.

import { startEditor } from './editor.js';

window.addEventListener('error', (event) => {
  const status = document.getElementById('exportStatus');
  if (status) status.textContent = 'Something went wrong: ' + (event.message || 'unknown error');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => startEditor());
} else {
  startEditor();
}
