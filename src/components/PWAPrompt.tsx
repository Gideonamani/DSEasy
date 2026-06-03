import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Download, X } from 'lucide-react';

export default function PWAPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('PWA Service Worker Registered: ', r);
    },
    onRegisterError(error) {
      console.error('PWA Service Worker Registration error: ', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="pwa-toast-container animate-toast">
      <div className="pwa-toast-content">
        <div className="pwa-toast-header">
          <div className="pwa-toast-info">
            {needRefresh ? (
              <div className="pwa-toast-icon pwa-toast-icon--update">
                <RefreshCw size={18} className="spin-slow" />
              </div>
            ) : (
              <div className="pwa-toast-icon pwa-toast-icon--offline">
                <Download size={18} />
              </div>
            )}
            <div className="pwa-toast-text">
              <h4 className="pwa-toast-title">
                {needRefresh ? 'Update Available' : 'App Ready Offline'}
              </h4>
              <p className="pwa-toast-desc">
                {needRefresh
                  ? 'A premium new version of DSEasy is available. Quick-reload to apply the update!'
                  : 'DSEasy is successfully cached and fully ready to work offline!'}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close notification"
            className="pwa-toast-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {needRefresh && (
          <div className="pwa-toast-actions">
            <button
              onClick={close}
              className="pwa-toast-btn pwa-toast-btn--later"
            >
              Later
            </button>
            <button
              onClick={() => updateServiceWorker(true)}
              className="pwa-toast-btn pwa-toast-btn--update"
            >
              <RefreshCw size={12} className="spin-icon" />
              Reload & Update
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
