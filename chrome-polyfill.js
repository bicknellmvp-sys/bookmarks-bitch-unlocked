/**
 * Chrome Extension API Polyfill for Web/AI Studio Environment
 * Enables offline, browser-native operation of Bookmarks Bitch Unlocked
 */
(function() {
  'use strict';
  window.chrome = window.chrome || {};

  // Storage Polyfill using localStorage
  const STORAGE_KEY = 'lumilist_chrome_storage';
  let storageCache = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) storageCache = JSON.parse(raw);
  } catch (e) {
    storageCache = {};
  }

  // Pre-seed offline authentication, subscriptions, and settings
  const defaultSeeds = {
    lumilist_user: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'offline@lumilist.local',
      created_at: new Date().toISOString()
    },
    subscriptionStatus: 'active',
    subscriptionDaysLeft: 99999,
    subscriptionData: {
      status: 'active',
      plan: 'lifetime',
      lifetime_access: true,
      access_kind: 'lifetime'
    },
    cachedSubscriptionStatus: 'active',
    lumilist_last_delta_sync: {
      timestamp: new Date().toISOString(),
      syncVersion: 1,
      userId: '00000000-0000-0000-0000-000000000000'
    },
    initialized: true,
    lumilist_theme_mode: 'dark',
    themeMode: 'dark',
    lumilist_open_in_new_tab: true,
    truncateTitles: true
  };

  let needsSave = false;
  for (const [k, v] of Object.entries(defaultSeeds)) {
    if (storageCache[k] === undefined || (k === 'lumilist_user' && !storageCache[k]?.id)) {
      storageCache[k] = v;
      needsSave = true;
    }
  }
  if (needsSave) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCache));
    } catch (e) {}
  }

  // Also pre-seed localStorage keys expected by bootstrap
  try {
    localStorage.setItem('lumilist_wallpaper_boot_auth_hint_v1', 'authenticated');
    if (!localStorage.getItem('lumilist_theme_mode')) {
      localStorage.setItem('lumilist_theme_mode', 'dark');
    }
  } catch (e) {}

  const storageChangeListeners = new Set();
  const notifyStorageChanges = (changes) => {
    setTimeout(() => {
      storageChangeListeners.forEach(listener => {
        try { listener(changes, 'local'); } catch (err) { console.error(err); }
      });
    }, 0);
  };

  window.chrome.storage = window.chrome.storage || {};
  window.chrome.storage.local = {
    get: function(keys, callback) {
      const getPromise = new Promise((resolve) => {
        let result = {};
        if (!keys) {
          result = { ...storageCache };
        } else if (typeof keys === 'string') {
          result[keys] = storageCache[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            if (storageCache[k] !== undefined) result[k] = storageCache[k];
          });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(k => {
            result[k] = storageCache[k] !== undefined ? storageCache[k] : keys[k];
          });
        }
        resolve(result);
      });
      if (typeof callback === 'function') {
        getPromise.then(res => callback(res));
      }
      return getPromise;
    },
    set: function(items, callback) {
      const setPromise = new Promise((resolve) => {
        const changes = {};
        if (items && typeof items === 'object') {
          for (const [k, v] of Object.entries(items)) {
            const oldValue = storageCache[k];
            storageCache[k] = v;
            changes[k] = { oldValue, newValue: v };
          }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCache));
          } catch (e) {}
          notifyStorageChanges(changes);
        }
        resolve();
      });
      if (typeof callback === 'function') {
        setPromise.then(() => callback());
      }
      return setPromise;
    },
    remove: function(keys, callback) {
      const removePromise = new Promise((resolve) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const changes = {};
        keyList.forEach(k => {
          if (storageCache[k] !== undefined) {
            changes[k] = { oldValue: storageCache[k], newValue: undefined };
            delete storageCache[k];
          }
        });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCache));
        } catch (e) {}
        notifyStorageChanges(changes);
        resolve();
      });
      if (typeof callback === 'function') {
        removePromise.then(() => callback());
      }
      return removePromise;
    },
    clear: function(callback) {
      const clearPromise = new Promise((resolve) => {
        const changes = {};
        for (const k of Object.keys(storageCache)) {
          changes[k] = { oldValue: storageCache[k], newValue: undefined };
        }
        storageCache = {};
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(storageCache));
        } catch (e) {}
        notifyStorageChanges(changes);
        resolve();
      });
      if (typeof callback === 'function') {
        clearPromise.then(() => callback());
      }
      return clearPromise;
    }
  };

  window.chrome.storage.sync = window.chrome.storage.local;

  window.chrome.storage.onChanged = {
    addListener: (fn) => storageChangeListeners.add(fn),
    removeListener: (fn) => storageChangeListeners.delete(fn),
    hasListener: (fn) => storageChangeListeners.has(fn)
  };

  // Runtime Polyfill
  const runtimeMessageListeners = new Set();
  window.chrome.runtime = window.chrome.runtime || {};
  window.chrome.runtime.id = 'bookmarks-bitch-unlocked';
  window.chrome.runtime.lastError = null;
  window.chrome.runtime.getURL = function(path) {
    if (!path) return '/';
    return path.startsWith('/') ? path : '/' + path;
  };

  window.chrome.runtime.onMessage = {
    addListener: (fn) => runtimeMessageListeners.add(fn),
    removeListener: (fn) => runtimeMessageListeners.delete(fn),
    hasListener: (fn) => runtimeMessageListeners.has(fn)
  };

  window.chrome.runtime.sendMessage = function(message, callback) {
    const p = new Promise(async (resolve) => {
      try {
        if (!message) return resolve({ success: true });

        // Handle title fetch via backend server API
        if (message.action === 'fetchPageTitle') {
          if (message.url) {
            try {
              const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(message.url)}`);
              if (res.ok) {
                const data = await res.json();
                return resolve(data);
              }
            } catch (err) {}
            try {
              const u = new URL(message.url);
              return resolve({ success: true, title: u.hostname.replace(/^www\./, '') });
            } catch (e) {
              return resolve({ success: false, title: '', error: 'Invalid URL' });
            }
          }
          return resolve({ success: false, title: '', error: 'Missing URL' });
        }

        // Mock offline favicon handling
        if (message.action === 'fetchFaviconLinksFromPage') {
          return resolve({ success: true, icons: [] });
        }
        if (message.action === 'fetchFaviconAsBase64') {
          return resolve({ success: false, data: null, error: 'Offline' });
        }

        // Handle queue cleanup / sync stubs
        if (message.action === 'clearSyncQueue' || message.action === 'recoverEntitlementPolicyFailures') {
          return resolve({ success: true });
        }

        // Invoke registered in-page message listeners
        let responded = false;
        const sender = { id: window.chrome.runtime.id };
        for (const listener of runtimeMessageListeners) {
          try {
            const willRespondAsync = listener(message, sender, (res) => {
              if (!responded) {
                responded = true;
                resolve(res);
              }
            });
            if (willRespondAsync === true) return;
          } catch (e) {}
        }
        if (!responded) resolve({ success: true });
      } catch (err) {
        resolve({ success: false, error: err?.message });
      }
    });

    if (typeof callback === 'function') {
      p.then(res => callback(res));
    }
    return p;
  };

  // Tabs Polyfill
  window.chrome.tabs = window.chrome.tabs || {
    query: function(queryInfo, callback) {
      const tabs = [{ id: 1, url: window.location.href, title: document.title, active: true }];
      if (typeof callback === 'function') callback(tabs);
      return Promise.resolve(tabs);
    },
    create: function(createProperties, callback) {
      const tab = { id: Date.now(), ...createProperties };
      if (createProperties?.url) {
        window.open(createProperties.url, '_blank', 'noopener,noreferrer');
      }
      if (typeof callback === 'function') callback(tab);
      return Promise.resolve(tab);
    },
    remove: function(tabIds, callback) {
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onRemoved: { addListener: () => {}, removeListener: () => {} }
  };

  // Commands Polyfill
  window.chrome.commands = window.chrome.commands || {
    onCommand: { addListener: () => {}, removeListener: () => {} }
  };

  // Action Polyfill
  window.chrome.action = window.chrome.action || {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
    setTitle: () => {}
  };

  // i18n Polyfill
  window.chrome.i18n = window.chrome.i18n || {
    getMessage: (key) => key,
    getUILanguage: () => navigator.language || 'en'
  };

  // Alarms Polyfill
  window.chrome.alarms = window.chrome.alarms || {
    create: () => {},
    get: (n, cb) => cb && cb(null),
    getAll: (cb) => cb && cb([]),
    clear: (n, cb) => cb && cb(true),
    clearAll: (cb) => cb && cb(true),
    onAlarm: { addListener: () => {}, removeListener: () => {} }
  };

  // Default stored bookmarks structure for web / standalone runtime
  const DEFAULT_POLYFILL_BOOKMARKS = [
    {
      id: '0',
      title: 'Root',
      children: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          children: [
            {
              id: 'folder_favorites',
              title: 'Favorites',
              children: [
                { id: 'fav_1', title: 'GitHub', url: 'https://github.com' },
                { id: 'fav_2', title: 'Google', url: 'https://google.com' },
                { id: 'fav_3', title: 'YouTube', url: 'https://youtube.com' },
                { id: 'fav_4', title: 'Wikipedia', url: 'https://wikipedia.org' },
                { id: 'fav_5', title: 'Reddit', url: 'https://reddit.com' }
              ]
            },
            {
              id: 'folder_dev',
              title: 'Developer Tools',
              children: [
                { id: 'dev_1', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
                { id: 'dev_2', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
                { id: 'dev_3', title: 'Tailwind CSS', url: 'https://tailwindcss.com' },
                { id: 'dev_4', title: 'Node.js', url: 'https://nodejs.org' }
              ]
            },
            {
              id: 'folder_news',
              title: 'News & Reads',
              children: [
                { id: 'news_1', title: 'Hacker News', url: 'https://news.ycombinator.com' },
                { id: 'news_2', title: 'The Verge', url: 'https://theverge.com' },
                { id: 'news_3', title: 'BBC News', url: 'https://bbc.com' }
              ]
            },
            { id: 'bm_producthunt', title: 'Product Hunt', url: 'https://producthunt.com' }
          ]
        },
        {
          id: '2',
          title: 'Other Bookmarks',
          children: [
            { id: 'other_1', title: 'Dev.to Community', url: 'https://dev.to' },
            { id: 'other_2', title: 'Ars Technica', url: 'https://arstechnica.com' }
          ]
        }
      ]
    }
  ];

  function getPolyfillBookmarkTree() {
    try {
      const stored = localStorage.getItem('lumilist_browser_bookmarks_tree');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_POLYFILL_BOOKMARKS));
  }

  function savePolyfillBookmarkTree(tree) {
    try {
      localStorage.setItem('lumilist_browser_bookmarks_tree', JSON.stringify(tree));
    } catch (_) {}
  }

  // Bookmarks Polyfill
  window.chrome.bookmarks = window.chrome.bookmarks || {
    getTree: (cb) => {
      const tree = getPolyfillBookmarkTree();
      if (cb) cb(tree);
      return Promise.resolve(tree);
    },
    get: (id, cb) => {
      const tree = getPolyfillBookmarkTree();
      const results = [];
      function find(node) {
        if (!node) return;
        if (node.id === String(id)) results.push(node);
        if (node.children) node.children.forEach(find);
      }
      tree.forEach(find);
      if (cb) cb(results);
      return Promise.resolve(results);
    },
    create: (b, cb) => {
      const tree = getPolyfillBookmarkTree();
      const item = { id: 'bm_' + Date.now(), title: b.title || '', url: b.url || '' };
      const rootBar = tree[0]?.children?.[0] || tree[0];
      if (rootBar && rootBar.children) {
        rootBar.children.push(item);
        savePolyfillBookmarkTree(tree);
      }
      if (cb) cb(item);
      return Promise.resolve(item);
    },
    remove: (id, cb) => {
      const tree = getPolyfillBookmarkTree();
      function prune(node) {
        if (!node || !node.children) return;
        node.children = node.children.filter(c => c.id !== String(id));
        node.children.forEach(prune);
      }
      tree.forEach(prune);
      savePolyfillBookmarkTree(tree);
      if (cb) cb();
      return Promise.resolve();
    }
  };

  // ContextMenus Polyfill
  const contextMenuListeners = new Set();
  const registeredContextMenus = new Map();
  window.chrome.contextMenus = window.chrome.contextMenus || {
    create: (props, cb) => {
      if (props && props.id) registeredContextMenus.set(props.id, props);
      if (cb) cb();
    },
    update: (id, props, cb) => {
      if (registeredContextMenus.has(id)) {
        registeredContextMenus.set(id, { ...registeredContextMenus.get(id), ...props });
      }
      if (cb) cb();
    },
    remove: (id, cb) => {
      registeredContextMenus.delete(id);
      if (cb) cb();
    },
    removeAll: (cb) => {
      registeredContextMenus.clear();
      if (cb) cb();
    },
    onClicked: {
      addListener: (fn) => { if (typeof fn === 'function') contextMenuListeners.add(fn); },
      removeListener: (fn) => { contextMenuListeners.delete(fn); }
    },
    simulateClick: (menuItemId, info = {}, tab = null) => {
      const payload = { menuItemId, ...info };
      contextMenuListeners.forEach(listener => {
        try { listener(payload, tab || { id: 1, title: document.title, url: window.location.href }); } catch (err) { console.error('Context menu dispatch error:', err); }
      });
    }
  };

  // Notifications Polyfill
  window.chrome.notifications = window.chrome.notifications || {
    create: (id, opt, cb) => {
      if (cb) cb(id || 'notification');
      return Promise.resolve(id || 'notification');
    },
    clear: (id, cb) => {
      if (cb) cb(true);
      return Promise.resolve(true);
    },
    getAll: (cb) => {
      if (cb) cb({});
      return Promise.resolve({});
    },
    onClicked: { addListener: () => {}, removeListener: () => {} }
  };

  // Windows Polyfill
  window.chrome.windows = window.chrome.windows || {
    getCurrent: (cb) => {
      const win = { id: 1, focused: true };
      if (cb) cb(win);
      return Promise.resolve(win);
    },
    getAll: (cb) => {
      const wins = [{ id: 1, focused: true }];
      if (cb) cb(wins);
      return Promise.resolve(wins);
    },
    create: (opt, cb) => {
      const win = { id: Date.now() };
      if (cb) cb(win);
      return Promise.resolve(win);
    },
    update: (id, opt, cb) => {
      if (cb) cb();
      return Promise.resolve();
    }
  };

  // Scripting Polyfill
  window.chrome.scripting = window.chrome.scripting || {
    executeScript: () => Promise.resolve([])
  };

  // Identity Polyfill
  window.chrome.identity = window.chrome.identity || {
    getAuthToken: (opt, cb) => cb && cb(null),
    removeCachedAuthToken: (opt, cb) => cb && cb(),
    launchWebAuthFlow: (opt, cb) => cb && cb('')
  };
})();
