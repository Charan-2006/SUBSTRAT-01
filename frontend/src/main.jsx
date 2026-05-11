import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- DIAGNOSTIC LAYER ---
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:#64748b; font-family:system-ui;">Booting SUBSTRAT engine...</div>';
}

// --- EMERGENCY GLOBAL ERROR RECOVERY ---
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global crash caught:", message, error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: system-ui; background: #fff; color: #1a1a1a; max-width: 600px; margin: 100px auto; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #eee; position: relative; z-index: 9999;">
        <h1 style="font-size: 24px; margin-bottom: 16px; color: #ef4444;">Application Initialization Failed</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin-bottom: 24px;">
          The SUBSTRAT orchestration engine failed to mount. This is likely due to a critical dependency mismatch or a circular reference in the workflow logic.
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #ef4444; margin-bottom: 24px; border: 1px solid #e2e8f0; overflow: auto; max-height: 200px;">
          <strong>Error:</strong> ${message}<br/>
          <strong>Source:</strong> ${source}:${lineno}
        </div>
        <button onclick="window.location.reload()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          Retry Initialization
        </button>
      </div>
    `;
  }
};

window.onunhandledrejection = function(event) {
    console.error("Unhandled promise rejection:", event.reason);
};

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (renderError) {
  window.onerror(renderError.message, "main.jsx", 0, 0, renderError);
}
