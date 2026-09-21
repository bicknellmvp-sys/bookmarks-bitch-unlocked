/* [UNLOCKED] supabase.js — remote auth stripped. Offline-only stub. */
/* Original Supabase client + auth refresh logic removed.
   The extension no longer contacts supabase.co for auth, subscription,
   or sync. All auth-dependent code paths are short-circuited to "active"
   by patches in newtab.js / sync.js / popup.js / background*.js. */
const SUPABASE_URL="https://offline.local",
      SUPABASE_ANON_KEY="offline-stub",
      SUPABASE_AUTH_TOKEN_KEY_PATTERN=/^sb-.*-auth-token$/,
      storageShadowValues=new Map,
      LUMILIST_REFRESH_BACKOFF_KEY="lumilist_auth_refresh_backoff_v1",
      LUMILIST_AUTH_STORAGE_KEY="sb-xbccmcszhnybxzlirjgk-auth-token",
      LUMILIST_REFRESH_BACKOFF_MS=6e4,
      LUMILIST_REFRESH_MAX_BACKOFF_MS=3e5,
      transientRefreshFailures=new Map,
      pendingSessionRecovery=new Map;
let failedRefreshRemovalFence=null;
function parseLumiListSession(){return null}
function readLumiListAuthStorage(){return Promise.resolve({})}
function isLumiListRefreshBackoffActive(){return false}
async function fingerprintLumiListRefreshToken(){return "offline"}
function isLumiListLogoutActive(){return false}
async function preserveLumiListTransientSession(){return false}
async function readLumiListRefreshResponse(){throw new Error("offline")}
async function lumiListAuthFetch(u,o){return fetch(u,o)}
function getLumiListAccessTokenClaims(){return null}
function normalizeLumiListSessionOwner(){return null}
function isLumiListSessionUsable(){return false}
function lumiListSessionDeferredError(){const e=new Error("Offline mode: cloud sync disabled");return e.isSessionDeferred=!0,e}
async function getLumiListReadSession(){throw lumiListSessionDeferredError()}
function sanitizeLumiListHeaderValue(e){return String(e||"").trim().replace(/[^\x20-\x7E]/g,"").slice(0,160)}
function getLumiListRuntimeManifest(){try{return chrome?.runtime?.getManifest?.()||null}catch(e){return null}}
function getLumiListRuntimeUrl(){try{return chrome?.runtime?.getURL?.("")||""}catch(e){return ""}}
function detectLumiListBrowser(){const e=getLumiListRuntimeUrl();return e.startsWith("moz-extension://")?"firefox":e.startsWith("chrome-extension://")?"chrome":"unknown"}
function buildLumiListClientInfo(){return "lumilist-extension offline"}
function getLumiListDiagnosticHeaders(){return {}}
const chromeStorageAdapter={
  getItem:async e=>{try{return await new Promise((r,t)=>{chrome.storage.local.get([e],s=>{if(chrome.runtime.lastError)return t(new Error(chrome.runtime.lastError.message));r(s[e]??null)})})}catch(e){return null}},
  setItem:async(e,r)=>{try{await new Promise((t,s)=>{chrome.storage.local.set({[e]:r},()=>{if(chrome.runtime.lastError)return s(new Error(chrome.runtime.lastError.message));t()})})}catch(e){}},
  removeItem:async e=>{try{await new Promise(r=>{chrome.storage.local.remove([e],()=>r())})}catch(e){}}
};
let supabaseClient=null;
function initSupabase(){return null}  /* [UNLOCKED] cloud client disabled */
"undefined"!=typeof window&&(window.initSupabase=initSupabase,window.SUPABASE_URL=SUPABASE_URL,window.SUPABASE_ANON_KEY=SUPABASE_ANON_KEY,window.chromeStorageAdapter=chromeStorageAdapter,window.getLumiListDiagnosticHeaders=getLumiListDiagnosticHeaders,window.getLumiListReadSession=getLumiListReadSession);
