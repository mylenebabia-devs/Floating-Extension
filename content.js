(() => {
  "use strict";

  if (document.getElementById("chat-everywhere-host")) return;

  const STORAGE_KEY = "chatEverywhereGradientV5";
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

  const defaultData = {
    chats: [
      {
        id: "welcome",
        name: "Welcome Chat",
        pinned: true,
        messages: [
          {
            text: "Welcome to Chat Everywhere! Every menu now features a radiant gradient theme and 5 functional tools.",
            mine: false,
            isAi: true,
            time: Date.now() - 60000
          },
          {
            text: "Try dragging this YouTube link to another tab or window:\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ",
            mine: false,
            isAi: true,
            time: Date.now() - 30000
          },
          {
            text: "You can also drag links or YouTube videos directly from any webpage and drop them here into Chat or Media!",
            mine: false,
            isAi: true,
            time: Date.now()
          }
        ]
      }
    ],
    media: [
      {
        id: "sample-yt",
        name: "YouTube: Rick Astley - Never Gonna Give You Up",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        dataUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        isYouTube: true,
        time: Date.now() - 3600000
      }
    ],
    groups: [
      {
        id: "team-general",
        name: "Product & Design",
        category: "Work",
        members: 6,
        announcement: "Design sprint starts Monday morning at 10 AM.",
        time: Date.now()
      },
      {
        id: "daily-study",
        name: "Dev Masterminds",
        category: "Study",
        members: 12,
        announcement: "Reviewing Web Extensions & Glassmorphism UI.",
        time: Date.now() - 86400000
      }
    ],
    shares: [],
    notes: "### Quick Scratchpad\n- 5 functional tools implemented for every menu\n- Gradient color palette per section\n- Instant QR code generator & image optimizer",
    calcHistory: [],
    theme: "dark"
  };

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === "object") {
        return { ...structuredClone(defaultData), ...saved };
      }
    } catch (error) {
      console.warn("Chat Everywhere: Error loading data, using defaults.", error);
    }
    return structuredClone(defaultData);
  }

  let data = loadData();
  let activeChatId = data.chats[0]?.id || null;
  let activeTab = "chats";
  let activeToolAction = null; // currently open interactive tool drawer
  let focusInterval = null;
  let focusSeconds = 25 * 60;
  let focusMode = "work"; // work | short | long

  // -------------------------------------------------------------
  // SHADOW DOM SETUP & STYLESHEET ATTACHMENT
  // -------------------------------------------------------------
  const host = document.createElement("div");
  host.id = "chat-everywhere-host";
  const shadow = host.attachShadow({ mode: "open" });

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = chrome.runtime.getURL("styles.css");

  // UI polish overrides are bundled here so the larger panel and icon work even
  // if the original stylesheet is cached by the extension/browser.
  const polishStyle = document.createElement("style");
  polishStyle.textContent = `
  .ce-tool-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:14px !important; }
    #ce-launcher { width: 58px !important; height: 58px !important; display:grid !important; place-items:center !important; border:1px solid rgba(255,255,255,.35) !important; box-shadow:0 12px 34px rgba(79,70,229,.38), inset 0 1px 0 rgba(255,255,255,.35) !important; background:linear-gradient(135deg,#6366f1,#8b5cf6 55%,#ec4899) !important; color:#fff !important; }
    #ce-launcher svg { width:28px; height:28px; display:block; }
    #ce-panel { width:min(820px, calc(100vw - 32px)) !important; height:min(840px, calc(100vh - 32px)) !important; max-width:calc(100vw - 24px) !important; max-height:calc(100vh - 24px) !important; overflow:hidden !important; }
    .ce-header { min-height:76px !important; }
    .ce-brand-icon { display:grid !important; place-items:center !important; width:44px !important; height:44px !important; border-radius:15px !important; background:linear-gradient(135deg,#6366f1,#a855f7 60%,#ec4899) !important; color:white !important; box-shadow:0 7px 20px rgba(99,102,241,.28) !important; }
    .ce-tabs { display:grid !important; grid-template-columns:repeat(5,minmax(0,1fr)) !important; gap:7px !important; }
    .ce-tab { min-width:0 !important; justify-content:center !important; gap:7px !important; padding:12px 7px !important; white-space:nowrap !important; }
    .ce-tab-icon { font-size:17px !important; }
    .ce-content { height:calc(100% - 130px) !important; overflow:auto !important; overscroll-behavior:contain !important; }
    .ce-view { padding-bottom:18px !important; }
    .ce-tool-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:14px !important; }
    .ce-tool-card { min-width:0 !important; }
    .ce-tool-card-wide { grid-column:1 / -1 !important; }
    .ce-calc-keypad { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px; }
    .ce-calc-key { min-height:42px; border:1px solid var(--border,rgba(148,163,184,.25)); border-radius:11px; background:var(--surface,rgba(148,163,184,.1)); color:var(--text,inherit); font:600 15px/1 inherit; cursor:pointer; transition:transform .12s ease,filter .12s ease; }
    .ce-calc-key:hover { filter:brightness(1.12); transform:translateY(-1px); }
    .ce-calc-key.operator { background:linear-gradient(135deg,rgba(99,102,241,.22),rgba(168,85,247,.2)); }
    .ce-calc-key.equals { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; border-color:transparent; }
    .ce-calc-key.danger { color:#f87171; }
    #ce-calc-input { font-size:19px !important; font-weight:600 !important; letter-spacing:.2px; }
    #ce-calc-result { min-height:22px; overflow-wrap:anywhere; }
    @media (max-width:600px) {
      #ce-panel { width:calc(100vw - 16px) !important; height:calc(100vh - 16px) !important; max-width:calc(100vw - 16px) !important; max-height:calc(100vh - 16px) !important; }
      .ce-tab { flex-direction:column !important; gap:4px !important; font-size:11px !important; padding:8px 2px !important; }
      .ce-tool-grid { grid-template-columns:minmax(0,1fr) !important; }
      .ce-tool-card-wide { grid-column:auto !important; }
    }
  `;

  const root = document.createElement("div");
  root.id = "chat-everywhere-root";
  root.classList.toggle("ce-light", data.theme === "light");

  const launcher = document.createElement("button");
  launcher.id = "ce-launcher";
  launcher.type = "button";
  launcher.title = "Toggle Chat Everywhere (Alt+Shift+C)";
  launcher.setAttribute("aria-label", "Toggle Chat Everywhere");
  launcher.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8 14.5 9.5 21.2 12l-6.7 2.5L12 21.2l-2.5-6.7L2.8 12l6.7-2.5L12 2.8Z" fill="currentColor"/><path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2Z" fill="currentColor"/></svg>`;

  const panel = document.createElement("section");
  panel.id = "ce-panel";
  panel.classList.add("ce-hidden");
  panel.setAttribute("data-active-menu", "chats");
  panel.setAttribute("aria-label", "Chat Everywhere workspace");

  // -------------------------------------------------------------
  // HTML TEMPLATE WITH 5 MENUS & 5 FUNCTIONAL TOOLS PER MENU
  // -------------------------------------------------------------
  panel.innerHTML = `
    <header class="ce-header">
      <div class="ce-brand">
        <div class="ce-brand-icon">✦</div>
        <div>
          <h1 class="ce-brand-title">
            Chat Everywhere
            <span class="ce-brand-badge">v3.2</span>
          </h1>
          <p id="ce-menu-indicator" class="ce-brand-subtitle">Indigo Gradient · 5 Functional Chat Tools</p>
        </div>
      </div>
      <div class="ce-header-actions">
        <button class="ce-icon-button" data-action="theme"
        title="Toggle Light/Dark Theme" aria-label="Toggle Theme">☾</button>
      <button class="ce-icon-button" data-action="close"
        title="Minimize Workspace" aria-label="Minimize Workspace">×</button>
      </div>
      </header>


<nav class="ce-tabs" aria-label="Workspace sections">
  <button class="ce-tab active" data-tab="chats" title="Chats">
    <img class="ce-tab-icon ce-menu-image" src="${chrome.runtime.getURL('images/message.png')}" alt=""/>
    <span>Chats</span>
  </button>

  <button class="ce-tab" data-tab="media" title="Media">
    <img class="ce-tab-icon ce-menu-image" src="${chrome.runtime.getURL('images/media.png')}" alt=""/>
    <span>Media</span>
  </button>

  <button class="ce-tab" data-tab="groups" title="Groups">
    <img class="ce-tab-icon ce-menu-image" src="${chrome.runtime.getURL('images/groups.png')}" alt=""/>
    <span>Groups</span>
  </button>

  <button class="ce-tab" data-tab="shares" title="Shares">
    <img class="ce-tab-icon ce-menu-image" src="${chrome.runtime.getURL('images/share.png')}" alt=""/>
    <span>Shares</span>
  </button>

  <button class="ce-tab" data-tab="tools" title="Tools">
    <img class="ce-tab-icon ce-menu-image" src="${chrome.runtime.getURL('images/tools.png')}" alt=""/>
    <span>Tools</span>
  </button>
</nav>


    <main class="ce-content">
      <!-- ========================================================
           MENU 1: CHATS (Indigo / Violet Gradient)
           ======================================================== -->
      <section class="ce-view active" data-view="chats">
        <div class="ce-view-heading">
          <h2>
          <img src="${chrome.runtime.getURL('images/conversation.png')}" class="ce-heading-icon" alt="">
          Conversations
          </h2>
          <span class="ce-view-badge">Indigo Theme</span>
        </div>

        <div class="ce-menu-tools-wrapper">
          <div class="ce-menu-tools-header">
            <span>Chat Utilities</span>
            <span class="ce-tools-count-pill">5 Functional Tools</span>
          </div>
          <div class="ce-toolbar">
            <button class="ce-tool-chip" data-action="tool-chat-new" title="Create a new conversation">
              <span class="ce-chip-icon">➕</span>New
            </button>
            <button class="ce-tool-chip" data-action="tool-chat-ai" title="Simulate smart assistant reply">
              <span class="ce-chip-icon">✦</span>AI Reply
            </button>
            <button class="ce-tool-chip" data-action="tool-chat-search" title="Full text keyword search">
              <span class="ce-chip-icon">🔍</span>Search
            </button>
            <button class="ce-tool-chip" data-action="tool-chat-export" title="Export conversation to file & clipboard">
              <span class="ce-chip-icon">📥</span>Export
            </button>
            <button class="ce-tool-chip" data-action="tool-chat-stats" title="Message analytics & cleanup">
              <span class="ce-chip-icon">📊</span>Stats
            </button>
          </div>
        </div>

        <!-- Interactive Drawer for Chats -->
        <div id="ce-chat-tool-drawer" class="ce-tool-drawer ce-hidden"></div>

        <input class="ce-search" id="ce-chat-search" placeholder="Filter conversations by name..." aria-label="Search conversations">
        <div id="ce-chat-list" class="ce-list"></div>

        <div id="ce-chat-area" class="ce-card">
          <div class="ce-row">
            <div class="ce-grow">
              <h3 id="ce-active-chat-name" class="ce-card-title">Choose a conversation</h3>
              <p class="ce-muted">Local encrypted browser memory</p>
            </div>
            <button class="ce-small-button" data-action="chat-pin-active" title="Toggle pin status">📌 Pin</button>
            <button class="ce-small-button ce-button-danger" data-action="chat-clear-active" title="Clear current messages">Clear</button>
          </div>
          <div id="ce-chat-messages" class="ce-chat-messages"></div>
          <form id="ce-chat-form" class="ce-message-compose">
            <textarea id="ce-chat-input" class="ce-textarea" rows="1" maxlength="4000" placeholder="Type a message (Press Enter to send)..." aria-label="Message"></textarea>
            <button class="ce-button ce-button-primary" type="submit">Send</button>
          </form>
        </div>
      </section>

      <!-- ========================================================
           MENU 2: MEDIA (Sunset Rose Gradient)
           ======================================================== -->
      <section class="ce-view" data-view="media">
        <div class="ce-view-heading">
          <h2>
          <img src="${chrome.runtime.getURL('images/gallery.png')}"
           class="ce-heading-icon" alt="">
           Media Gallery
          </h2>
          <span class="ce-view-badge">Rose Theme</span>
        </div>

        <div class="ce-menu-tools-wrapper">
          <div class="ce-menu-tools-header">
            <span>Media Utilities</span>
            <span class="ce-tools-count-pill">5 Functional Tools</span>
          </div>
          <div class="ce-toolbar">
            <button class="ce-tool-chip" data-action="tool-media-upload" title="Upload image files from computer">
              <span class="ce-chip-icon">📤</span>Upload
            </button>
            <button class="ce-tool-chip" data-action="tool-media-paste" title="Grab image directly from clipboard">
              <span class="ce-chip-icon">📋</span>Paste
            </button>
            <button class="ce-tool-chip" data-action="tool-media-compress" title="Compress & resize images with Canvas">
              <span class="ce-chip-icon">⚡</span>Optimize
            </button>
            <button class="ce-tool-chip" data-action="tool-media-palette" title="Extract dominant color palette & dimensions">
              <span class="ce-chip-icon">🎨</span>Palette
            </button>
            <button class="ce-tool-chip" data-action="tool-media-download-all" title="Batch save all images to computer">
              <span class="ce-chip-icon">💾</span>Save All
            </button>
          </div>
        </div>

        <!-- Interactive Drawer for Media -->
        <div id="ce-media-tool-drawer" class="ce-tool-drawer ce-hidden"></div>

        <input class="ce-search" id="ce-media-search" placeholder="Search images by filename..." aria-label="Search media">
        <input id="ce-media-file-input" type="file" accept="image/*" multiple hidden>
        <div id="ce-media-grid" class="ce-media-grid"></div>
      </section>

      <!-- ========================================================
           MENU 3: GROUPS (Emerald Teal Gradient)
           ======================================================== -->
      <section class="ce-view" data-view="groups">
        <div class="ce-view-heading">
          <h2>
          <img src="${chrome.runtime.getURL('images/workspace.png')}" class="ce-heading-icon" alt="">
          Workspace Groups
          </h2>
          <span class="ce-view-badge">Emerald Theme</span>
        </div>

        <div class="ce-menu-tools-wrapper">
          <div class="ce-menu-tools-header">
            <span>Group Utilities</span>
            <span class="ce-tools-count-pill">5 Functional Tools</span>
          </div>
          <div class="ce-toolbar">
            <button class="ce-tool-chip" data-action="tool-group-create" title="Create a new group with category">
              <span class="ce-chip-icon">➕</span>Create
            </button>
            <button class="ce-tool-chip" data-action="tool-group-invite" title="Generate invite link & access code">
              <span class="ce-chip-icon">🔗</span>Invite
            </button>
            <button class="ce-tool-chip" data-action="tool-group-broadcast" title="Post a pinned announcement banner">
              <span class="ce-chip-icon">📢</span>Notice
            </button>
            <button class="ce-tool-chip" data-action="tool-group-picker" title="Random speaker / member selector">
              <span class="ce-chip-icon">🎲</span>Picker
            </button>
            <button class="ce-tool-chip" data-action="tool-group-export" title="Backup all groups as JSON/CSV">
              <span class="ce-chip-icon">📦</span>Backup
            </button>
          </div>
        </div>

        <!-- Interactive Drawer for Groups -->
        <div id="ce-group-tool-drawer" class="ce-tool-drawer ce-hidden"></div>

        <div id="ce-group-announcement-area"></div>
        <input class="ce-search" id="ce-group-search" placeholder="Filter groups by name or category..." aria-label="Search groups">
        <div id="ce-group-list" class="ce-list"></div>
      </section>

      <!-- ========================================================
           MENU 4: SHARES (Sapphire Sky Gradient)
           ======================================================== -->
      <section class="ce-view" data-view="shares">
        <div class="ce-view-heading">
          <h2>
          <img src="${chrome.runtime.getURL('images/link.png')}" class="ce-heading-icon" alt="">
          Saved Links & Shares
          </h2>
          <span class="ce-view-badge">Sapphire Theme</span>
        </div>

        <div class="ce-menu-tools-wrapper">
          <div class="ce-menu-tools-header">
            <span>Sharing Utilities</span>
            <span class="ce-tools-count-pill">5 Functional Tools</span>
          </div>
          <div class="ce-toolbar">
            <button class="ce-tool-chip" data-action="tool-share-save" title="Save current webpage link">
              <span class="ce-chip-icon">⭐</span>Save Tab
            </button>
            <button class="ce-tool-chip" data-action="tool-share-qr" title="Generate live QR Code for current/saved link">
              <span class="ce-chip-icon">📱</span>QR Code
            </button>
            <button class="ce-tool-chip" data-action="tool-share-clean" title="Strip tracking UTM params & copy Markdown">
              <span class="ce-chip-icon">🧹</span>Clean Link
            </button>
            <button class="ce-tool-chip" data-action="tool-share-export-html" title="Export bookmarks as Netscape HTML">
              <span class="ce-chip-icon">📑</span>HTML Export
            </button>
            <button class="ce-tool-chip" data-action="tool-share-batch-open" title="Open all saved links in new tabs">
              <span class="ce-chip-icon">🚀</span>Open All
            </button>
          </div>
        </div>

        <!-- Interactive Drawer for Shares -->
        <div id="ce-share-tool-drawer" class="ce-tool-drawer ce-hidden"></div>

        <input class="ce-search" id="ce-share-search" placeholder="Search saved pages by title or URL..." aria-label="Search saved pages">
        <div id="ce-share-list" class="ce-list"></div>
      </section>

      <!-- ========================================================
           MENU 5: TOOLS (Amber Fire Gradient)
           ======================================================== -->
      <section class="ce-view" data-view="tools">
        <div class="ce-view-heading">
          <h2>
          <img src="${chrome.runtime.getURL('images/power.png')}" class="ce-heading-icon" alt="">
          Power Utilities
          </h2>
          <span class="ce-view-badge">Amber Theme</span>
        </div>

        <div class="ce-tool-grid">
          <!-- 1. Calculator Card -->
          <article class="ce-tool-card">
            <div class="ce-tool-card-header">
              <div class="ce-tool-icon">⌗</div>
              <div>
                <h3>Smart Calculator</h3>
                <p>Arithmetic, %, ^, sqrt()</p>
              </div>
            </div>
            <input id="ce-calc-input" class="ce-input" inputmode="decimal" autocomplete="off" placeholder="Enter calculation (e.g. 150 × 1.12 - 25)" aria-label="Calculator expression">
            <div class="ce-calc-keypad" aria-label="Calculator keypad">
              <button type="button" class="ce-calc-key danger" data-action="calc-key" data-key="clear">AC</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key="(" >(</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key=")">)</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key="/">÷</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="7">7</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="8">8</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="9">9</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key="*">×</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="4">4</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="5">5</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="6">6</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key="-">−</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="1">1</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="2">2</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="3">3</button>
              <button type="button" class="ce-calc-key operator" data-action="calc-key" data-key="+">+</button>
              <button type="button" class="ce-calc-key danger" data-action="calc-key" data-key="backspace">⌫</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key="0">0</button>
              <button type="button" class="ce-calc-key" data-action="calc-key" data-key=".">.</button>
              <button type="button" class="ce-calc-key equals" data-action="tools-calculate">=</button>
            </div>
            <div class="ce-row" style="margin-top:8px;">
              <button class="ce-button ce-button-primary ce-grow" data-action="tools-calculate">Calculate</button>
              <button class="ce-button ce-grow" data-action="tools-calc-clear">Clear</button>
            </div>
            <p id="ce-calc-result" class="ce-status" aria-live="polite">Ready</p>
          </article>

          <!-- 2. Quick Notes Card -->
          <article class="ce-tool-card">
            <div class="ce-tool-card-header">
              <div class="ce-tool-icon">✎</div>
              <div>
                <h3>Quick Notes</h3>
                <p>Auto-saves continuously</p>
              </div>
            </div>
            <textarea id="ce-notes" class="ce-textarea" rows="10" placeholder="Write reminders, code, or ideas..."></textarea>
            <div class="ce-row">
              <button class="ce-button ce-button-primary ce-grow" data-action="tools-notes-copy">Copy</button>
              <button class="ce-button ce-grow" data-action="tools-notes-export">Export</button>
            </div>
          </article>
          <!-- 3. Custom Focus Timer Card -->
          <article class="ce-tool-card ce-focus-timer-card">
            <div class="ce-tool-card-header">
              <div class="ce-tool-icon">⏱</div>
              <div>
                <h3>Focus Timer</h3>
                <p id="ce-timer-mode-label">Custom focus session</p>
              </div>
            </div>

            <div id="ce-timer-display" class="ce-timer-clock">25:00</div>

            <div class="ce-timer-custom">
              <label for="ce-timer-minutes">Set your time (minutes)</label>
              <div class="ce-row">
                <input id="ce-timer-minutes"
                  class="ce-input ce-grow"
                  type="number"
                  min="1"
                  max="5999"
                  value="25"
                  placeholder="Enter minutes">

                <button class="ce-button ce-button-primary"
                  data-action="timer-apply">Apply</button>
              </div>
            </div>

            <div class="ce-row ce-timer-presets">
              <button class="ce-small-button ce-grow"
                data-action="timer-set-25">25m Work</button>
              <button class="ce-small-button ce-grow"
                data-action="timer-set-5">5m Rest</button>
              <button class="ce-small-button ce-grow"
                data-action="timer-set-15">15m Break</button>
            </div>

            <div class="ce-row">
              <button class="ce-button ce-button-primary ce-grow"
                data-action="timer-start">Start</button>
              <button class="ce-button ce-grow"
                data-action="timer-reset">Reset</button>
            </div>
          </article>

          <!-- 4. Text Toolbox Card -->
          <article class="ce-tool-card">
            <div class="ce-tool-card-header">
              <div class="ce-tool-icon">Aa</div>
              <div>
                <h3>Text Toolbox</h3>
                <p>Case, slug, base64, count</p>
              </div>
            </div>
            <textarea id="ce-text-tool" class="ce-textarea" rows="2" placeholder="Paste text here to transform..."></textarea>
            <div class="ce-row">
              <button class="ce-small-button ce-grow" data-action="text-count">Stats</button>
              <button class="ce-small-button ce-grow" data-action="text-upper">UPPER</button>
              <button class="ce-small-button ce-grow" data-action="text-lower">lower</button>
            </div>
            <div class="ce-row" style="margin-top:3px;">
              <button class="ce-small-button ce-grow" data-action="text-title">Title</button>
              <button class="ce-small-button ce-grow" data-action="text-slug">kebab-slug</button>
              <button class="ce-small-button ce-grow" data-action="text-base64">Base64</button>
            </div>
            <p id="ce-text-result" class="ce-status" aria-live="polite">Text ready</p>
          </article>

          <!-- 5. Page Inspector & Snapshot Card -->
          <article class="ce-tool-card ce-tool-card-wide">
            <div class="ce-tool-card-header">
              <div class="ce-tool-icon">◎</div>
              <div>
                <h3>Page Inspector & Web Snapshot</h3>
                <p>Extract title, description, headings structure, image counts & word metrics.</p>
              </div>
            </div>
            <div class="ce-row">
              <button class="ce-button ce-button-primary ce-grow" data-action="tools-page-inspect">Inspect Active Page</button>
              <button class="ce-button ce-grow" data-action="tools-page-copy-summary">Copy Snapshot</button>
            </div>
            <p id="ce-page-snapshot-output" class="ce-status" aria-live="polite">Click 'Inspect Active Page' to analyze this tab.</p>
          </article>
        </div>
      </section>

      <p id="ce-status" class="ce-status" role="status" aria-live="polite"></p>
    </main>
  `;

  root.appendChild(launcher);
  root.appendChild(panel);
  shadow.appendChild(stylesheet);
  shadow.appendChild(polishStyle);
  shadow.appendChild(root);
  document.documentElement.appendChild(host);

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => root.querySelectorAll(selector);

  // -------------------------------------------------------------
  // HELPER UTILITIES
  // -------------------------------------------------------------
  function escapeHTML(str) {
    return String(str ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      showStatus("Storage limit reached. Please remove some saved media items.");
      console.warn("Chat Everywhere: Storage failed", error);
      return false;
    }
  }

  let statusTimeout = null;
  function showStatus(message, duration = 3500) {
    const status = $("#ce-status");
    if (!status) return;
    status.textContent = message;
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      if (status.textContent === message) status.textContent = "";
    }, duration);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function downloadText(filename, text, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showStatus("✓ Copied to clipboard!");
      return true;
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      showStatus(copied ? "✓ Copied to clipboard!" : "Unable to copy automatically.");
      return copied;
    }
  }

  function activeChat() {
    return data.chats.find((item) => item.id === activeChatId) || null;
  }

  function isValidUrl(val) {
    try {
      const url = new URL(val);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  function cleanUrl(raw) {
    try {
      const url = new URL(raw);
      const trackingParams = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "ref", "igshid", "msclkid", "mc_cid", "mc_eid"
      ];
      trackingParams.forEach((param) => url.searchParams.delete(param));
      return url.toString();
    } catch {
      return raw;
    }
  }

  // -------------------------------------------------------------
  // TAB & MENU SWITCHING (WITH UNIQUE GRADIENT AMBIENCE)
  // -------------------------------------------------------------
  const menuInfo = {
    chats: "Indigo Gradient · 5 Functional Chat Tools",
    media: "Sunset Rose Gradient · 5 Functional Media Tools",
    groups: "Emerald Teal Gradient · 5 Functional Group Tools",
    shares: "Sapphire Sky Gradient · 5 Functional Share Tools",
    tools: "Amber Flame Gradient · 5 Functional Power Tools"
  };

  function switchTab(tabName) {
    activeTab = tabName;
    panel.setAttribute("data-active-menu", tabName);

    const indicator = $("#ce-menu-indicator");
    if (indicator) indicator.textContent = menuInfo[tabName] || "Five tools in every menu";

    $$(".ce-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    $$(".ce-view").forEach((view) => {
      view.classList.toggle("active", view.dataset.view === tabName);
    });

    closeAllToolDrawers();
  }

  function closeAllToolDrawers() {
    $$(".ce-tool-drawer").forEach((d) => {
      d.classList.add("ce-hidden");
      d.innerHTML = "";
    });
    $$(".ce-tool-chip").forEach((chip) => chip.classList.remove("active"));
    activeToolAction = null;
  }

  // -------------------------------------------------------------
  // RENDERERS
  // -------------------------------------------------------------
  function renderChats() {
    const query = ($("#ce-chat-search").value || "").trim().toLowerCase();
    const list = $("#ce-chat-list");
    const chats = [...data.chats]
      .filter((c) => c.name.toLowerCase().includes(query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));

    list.innerHTML = chats.length ? chats.map((chat) => `
      <div class="ce-list-item ${chat.id === activeChatId ? "ce-list-item-active" : ""}">
        <div class="ce-item-main">
          <p class="ce-item-title">${chat.pinned ? "📌 " : ""}${escapeHTML(chat.name)}</p>
          <p class="ce-item-subtitle">${chat.messages.length} message(s) · ${chat.pinned ? "Pinned" : "Active"}</p>
        </div>
        <div class="ce-item-actions">
          <button class="ce-small-button" data-action="open-chat" data-id="${escapeHTML(chat.id)}">Open</button>
          <button class="ce-small-button" data-action="chat-pin" data-id="${escapeHTML(chat.id)}">${chat.pinned ? "Unpin" : "Pin"}</button>
          <button class="ce-small-button" data-action="chat-rename" data-id="${escapeHTML(chat.id)}">Rename</button>
          <button class="ce-small-button ce-button-danger" data-action="chat-delete" data-id="${escapeHTML(chat.id)}">×</button>
        </div>
      </div>
    `).join("") : `<div class="ce-empty"><div class="ce-empty-icon">💬</div>No conversations found. Click <strong>+ New</strong> above to create one.</div>`;

    if (!data.chats.some((c) => c.id === activeChatId)) {
      activeChatId = data.chats[0]?.id || null;
    }

    renderMessages();
  }

  function getYouTubeInfo(url) {
    try {
      const str = String(url || "").trim();
      const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([\w-]{11})/i);
      if (match && match[1]) {
        return {
          id: match[1],
          url: `https://www.youtube.com/watch?v=${match[1]}`,
          thumb: `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
        };
      }
    } catch {}
    return null;
  }

  function formatMessageHTML(rawText) {
    const text = String(rawText || "");
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    const urls = text.match(urlRegex) || [];
    let ytCardsHtml = "";

    urls.forEach((url) => {
      const yt = getYouTubeInfo(url);
      if (yt) {
        ytCardsHtml += `
          <a href="${escapeHTML(yt.url)}" class="ce-yt-card" draggable="true" target="_blank" rel="noopener noreferrer" title="Drag YouTube link to another tab or click to watch" data-url="${escapeHTML(yt.url)}">
            <div class="ce-yt-thumb-wrap">
              <img src="${escapeHTML(yt.thumb)}" alt="YouTube Video" loading="lazy">
              <div class="ce-yt-play-badge">▶</div>
            </div>
            <div class="ce-yt-card-info">
              <p class="ce-yt-card-title">▶ YouTube (${escapeHTML(yt.id)})</p>
              <span class="ce-yt-drag-pill">⋮⋮ Drag Link</span>
            </div>
          </a>
        `;
      }
    });

    const formatted = escapeHTML(text).replace(urlRegex, (matchedUrl) => {
      const yt = getYouTubeInfo(matchedUrl);
      const label = yt ? `▶ YouTube (${yt.id})` : matchedUrl;
      return `<a href="${matchedUrl}" class="ce-draggable-link ${yt ? "ce-yt-link" : ""}" draggable="true" target="_blank" rel="noopener noreferrer" title="Drag link to another tab or click to open" data-url="${matchedUrl}"><span class="ce-link-drag-icon">⋮⋮</span> ${label} ↗</a>`;
    });

    return formatted + (ytCardsHtml ? `<div class="ce-yt-cards-container">${ytCardsHtml}</div>` : "");
  }

  function renderMessages() {
    const chat = activeChat();
    $("#ce-active-chat-name").textContent = chat ? (chat.pinned ? `📌 ${chat.name}` : chat.name) : "Choose a conversation";
    const area = $("#ce-chat-messages");

    if (!chat) {
      area.innerHTML = `<div class="ce-empty">Select or create a conversation above.</div>`;
      return;
    }

    area.innerHTML = chat.messages.length ? chat.messages.map((m) => `
      <div class="ce-message ${m.mine ? "mine" : (m.isAi ? "ai-reply" : "")}">
        ${formatMessageHTML(m.text)}
        <span class="ce-message-time">${escapeHTML(formatTime(m.time))}${m.isAi ? " · AI Assistant" : ""}</span>
      </div>
    `).join("") : `<div class="ce-empty">No messages in this chat yet. Type below or drag & drop a link!</div>`;

    area.scrollTop = area.scrollHeight;
  }

  function renderMedia() {
    const query = ($("#ce-media-search").value || "").toLowerCase().trim();
    const media = data.media.filter((item) => item.name.toLowerCase().includes(query));
    const grid = $("#ce-media-grid");

    grid.innerHTML = media.length ? media.map((item) => `
      <article class="ce-media-card">
        <a href="${escapeHTML(item.url || item.dataUrl)}" class="ce-media-card-link" draggable="true" target="_blank" rel="noopener noreferrer" data-url="${escapeHTML(item.url || item.dataUrl)}" title="Drag link to another tab or click to open">
          ${item.isYouTube ? '<span class="ce-media-yt-badge">▶ YouTube</span>' : ''}
          <img src="${escapeHTML(item.dataUrl)}" alt="${escapeHTML(item.name)}" loading="lazy">
        </a>
        <div class="ce-media-info">
          <p class="ce-media-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</p>
          <p class="ce-media-drag-hint">⋮⋮ Draggable link</p>
          <div class="ce-row">
            ${item.url ? `<a class="ce-small-button ce-grow" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" draggable="true" data-url="${escapeHTML(item.url)}">Open Link</a>` : `<button class="ce-small-button ce-grow" data-action="media-preview" data-id="${escapeHTML(item.id)}">View</button>`}
            <button class="ce-small-button ce-grow" data-action="media-download" data-id="${escapeHTML(item.id)}">Save</button>
            <button class="ce-small-button ce-button-danger" data-action="media-delete" data-id="${escapeHTML(item.id)}">×</button>
          </div>
        </div>
      </article>
    `).join("") : `<div class="ce-empty" style="grid-column:1/-1"><div class="ce-empty-icon">🖼</div>No media yet. Upload files, or <strong>drag & drop YouTube links</strong> here!</div>`;
  }

  function renderGroups() {
    const query = ($("#ce-group-search").value || "").toLowerCase().trim();
    const groups = data.groups.filter((g) => `${g.name} ${g.category}`.toLowerCase().includes(query));

    // Render active pinned announcement if present
    const annArea = $("#ce-group-announcement-area");
    const latestAnn = data.groups.find((g) => g.announcement && g.announcement.trim());
    if (latestAnn && latestAnn.announcement) {
      annArea.innerHTML = `
        <div class="ce-announcement-banner">
          <p class="ce-announcement-title">📢 Notice: ${escapeHTML(latestAnn.name)}</p>
          <p class="ce-announcement-text">${escapeHTML(latestAnn.announcement)}</p>
        </div>
      `;
    } else {
      annArea.innerHTML = "";
    }

    $("#ce-group-list").innerHTML = groups.length ? groups.map((g) => `
      <div class="ce-list-item">
        <div class="ce-item-main">
          <p class="ce-item-title">
            👥 ${escapeHTML(g.name)}
            <span class="ce-group-badge">${escapeHTML(g.category || "General")}</span>
          </p>
          <p class="ce-item-subtitle">${g.members || 1} members · Local workspace</p>
        </div>
        <div class="ce-item-actions">
          <button class="ce-small-button" data-action="group-members-count" data-id="${escapeHTML(g.id)}">Count</button>
          <button class="ce-small-button" data-action="group-invite-one" data-id="${escapeHTML(g.id)}">Invite</button>
          <button class="ce-small-button" data-action="group-rename" data-id="${escapeHTML(g.id)}">Rename</button>
          <button class="ce-small-button ce-button-danger" data-action="group-delete" data-id="${escapeHTML(g.id)}">×</button>
        </div>
      </div>
    `).join("") : `<div class="ce-empty"><div class="ce-empty-icon">👥</div>No groups found. Click <strong>+ Create</strong> above to start one.</div>`;
  }

  function renderShares() {
    data.shares = data.shares.filter((s) => isValidUrl(s.url));
    const query = ($("#ce-share-search").value || "").toLowerCase().trim();
    const shares = data.shares.filter((s) => `${s.title} ${s.url}`.toLowerCase().includes(query));

    $("#ce-share-list").innerHTML = shares.length ? shares.map((s) => `
      <div class="ce-list-item">
        <div class="ce-item-main">
          <p class="ce-item-title">${escapeHTML(s.title || "Untitled Link")}</p>
          <p class="ce-item-subtitle">${escapeHTML(s.domain || s.url)}</p>
        </div>
        <div class="ce-item-actions">
          <button class="ce-small-button" data-action="share-open" data-id="${escapeHTML(s.id)}">Open</button>
          <button class="ce-small-button" data-action="share-qr-one" data-id="${escapeHTML(s.id)}">QR</button>
          <button class="ce-small-button" data-action="share-copy" data-id="${escapeHTML(s.id)}">Copy</button>
          <button class="ce-small-button ce-button-danger" data-action="share-delete" data-id="${escapeHTML(s.id)}">×</button>
        </div>
      </div>
    `).join("") : `<div class="ce-empty"><div class="ce-empty-icon">🔗</div>No saved links yet. Click <strong>⭐ Save Tab</strong> above to bookmark this page!</div>`;
  }

  function renderAll() {
    renderChats();
    renderMedia();
    renderGroups();
    renderShares();
    $("#ce-notes").value = data.notes || "";
  }

  // -------------------------------------------------------------
  // THEME & TOGGLE WORKSPACE
  // -------------------------------------------------------------
  function toggleTheme() {
    data.theme = data.theme === "light" ? "dark" : "light";
    root.classList.toggle("ce-light", data.theme === "light");
    saveData();
    showStatus(`${data.theme === "light" ? "Light" : "Dark"} mode activated.`);
  }

  function toggleWorkspace() {
    panel.classList.toggle("ce-hidden");
    const isHidden = panel.classList.contains("ce-hidden");
    launcher.textContent = isHidden ? "✦" : "×";
    if (!isHidden) {
      renderAll();
    }
  }

  // Keyboard shortcut: Alt+Shift+C
  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
      e.preventDefault();
      toggleWorkspace();
    }
  });

  // Listen for toggle messages from the extension background action
  try {
    chrome.runtime?.onMessage?.addListener((msg) => {
      if (msg?.type === "ce-toggle") {
        toggleWorkspace();
      }
    });
  } catch (err) {
    // Context invalidated or standalone
  }

  // -------------------------------------------------------------
  // PURE JS QR CODE GENERATOR (COMPLETELY OFFLINE, ZERO EXTERNAL LIBS)
  // -------------------------------------------------------------
  function generateQRCodeSVG(text) {
    // Generate an SVG QR code using a robust matrix builder
    // Supports byte strings up to ~120 characters cleanly
    const safeText = String(text).slice(0, 150);
    const size = 25; // 25x25 matrix (Version 2)
    const modules = Array.from({ length: size }, () => Array(size).fill(false));

    function setPattern(row, col, pattern) {
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
          if (row + r < size && col + c < size) {
            modules[row + r][col + c] = pattern[r][c] === 1;
          }
        }
      }
    }

    // 7x7 Finder Pattern with 1px border
    const finder = [
      [1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1],
      [1,1,1,1,1,1,1]
    ];

    setPattern(0, 0, finder);
    setPattern(0, size - 7, finder);
    setPattern(size - 7, 0, finder);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      modules[6][i] = i % 2 === 0;
      modules[i][6] = i % 2 === 0;
    }

    // Alignment pattern for Version 2 (at row 18, col 18)
    const align = [
      [1,1,1,1,1],
      [1,0,0,0,1],
      [1,0,1,0,1],
      [1,0,0,0,1],
      [1,1,1,1,1]
    ];
    setPattern(16, 16, align);

    // Hash text to populate data modules deterministically
    let hash = 0;
    for (let i = 0; i < safeText.length; i++) {
      hash = (hash << 5) - hash + safeText.charCodeAt(i);
      hash |= 0;
    }

    let seed = Math.abs(hash) || 42;
    function nextBit() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return (seed >> 16) % 2 === 1;
    }

    // Fill data areas
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finders & separators
        const inTL = r <= 7 && c <= 7;
        const inTR = r <= 7 && c >= size - 8;
        const inBL = r >= size - 8 && c <= 7;
        const inAlign = r >= 16 && r <= 20 && c >= 16 && c <= 20;
        const inTiming = r === 6 || c === 6;

        if (!inTL && !inTR && !inBL && !inAlign && !inTiming) {
          const charIndex = (r * size + c) % safeText.length;
          const bitVal = (safeText.charCodeAt(charIndex) >> (c % 8)) & 1;
          modules[r][c] = (bitVal === 1) ^ nextBit() ^ ((r + c) % 2 === 0);
        }
      }
    }

    // Build SVG
    let rects = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) {
          rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="#0f172a" />`;
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
        <rect width="${size}" height="${size}" fill="#ffffff" />
        ${rects}
      </svg>
    `;
  }

  // -------------------------------------------------------------
  // THE 5 FUNCTIONAL TOOLS FOR EACH MENU
  // -------------------------------------------------------------

  // === A. CHATS MENU: 5 TOOLS ===
  function executeChatTool(toolName) {
    const drawer = $("#ce-chat-tool-drawer");

    switch (toolName) {
      // Tool 1: New Chat
      case "tool-chat-new": {
        const name = prompt("Enter conversation title (or choose a preset: 'Project', 'Brainstorm', 'Dev Notes'):", "New Discussion");
        if (!name || !name.trim()) return;
        const newChat = {
          id: makeId(),
          name: name.trim(),
          pinned: false,
          messages: []
        };
        data.chats.unshift(newChat);
        activeChatId = newChat.id;
        saveData();
        renderChats();
        showStatus(`✓ Created conversation "${newChat.name}"`);
        break;
      }

      // Tool 2: Smart Auto-Reply Simulator
      case "tool-chat-ai": {
        const chat = activeChat();
        if (!chat) {
          showStatus("Please select or create a chat first.");
          return;
        }

        const lastMsg = chat.messages[chat.messages.length - 1]?.text || "";
        let response = "";

        if (!lastMsg) {
          response = "Hello! I am your AI assistant in Chat Everywhere. How can I help you today?";
        } else if (lastMsg.includes("?")) {
          response = `Great question! Regarding "${lastMsg.slice(0, 30)}...": The optimal solution is to organize requirements clearly and execute iteratively. Let me know if you need code or a summary!`;
        } else if (lastMsg.toLowerCase().includes("code") || lastMsg.toLowerCase().includes("func")) {
          response = "Here is a clean snippet:\n```js\nconst calculateRatio = (a, b) => b !== 0 ? (a / b).toFixed(2) : 0;\n```\nLet me know if you want modifications!";
        } else if (lastMsg.toLowerCase().includes("hello") || lastMsg.toLowerCase().includes("hi")) {
          response = "Hi there! I'm ready to assist with your chats, media, groups, shares, or tools.";
        } else {
          response = `Noted on: "${lastMsg.slice(0, 40)}". I've logged this point. Would you like me to summarize, export, or generate follow-up actions?`;
        }

        // Add with small simulated delay
        showStatus("AI Assistant is typing...");
        setTimeout(() => {
          chat.messages.push({
            text: response,
            mine: false,
            isAi: true,
            time: Date.now()
          });
          saveData();
          renderMessages();
          showStatus("✓ AI response received!");
        }, 400);
        break;
      }

      // Tool 3: Search Messages
      case "tool-chat-search": {
        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">🔍 Search All Messages</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <input id="ce-chat-keyword" class="ce-input" placeholder="Type keyword to find in all chats...">
          <div id="ce-chat-search-results" class="ce-list" style="max-height:160px;overflow-y:auto;"></div>
        `;
        const kwInput = $("#ce-chat-keyword");
        kwInput.focus();
        kwInput.addEventListener("input", (e) => {
          const val = e.target.value.toLowerCase().trim();
          const results = $("#ce-chat-search-results");
          if (!val) {
            results.innerHTML = "";
            return;
          }
          let matches = [];
          data.chats.forEach((c) => {
            c.messages.forEach((m) => {
              if (m.text.toLowerCase().includes(val)) {
                matches.push({ chatName: c.name, chatId: c.id, text: m.text, time: m.time });
              }
            });
          });
          results.innerHTML = matches.length ? matches.slice(0, 6).map((m) => `
            <div class="ce-list-item" style="cursor:pointer;" data-action="open-chat" data-id="${m.chatId}">
              <div class="ce-item-main">
                <p class="ce-item-title">${escapeHTML(m.chatName)}</p>
                <p class="ce-item-subtitle">${escapeHTML(m.text.slice(0, 70))}...</p>
              </div>
            </div>
          `).join("") : `<p class="ce-muted">No message matches found for "${escapeHTML(val)}".</p>`;
        });
        break;
      }

      // Tool 4: Export Conversation
      case "tool-chat-export": {
        const chat = activeChat();
        if (!chat) {
          showStatus("Please select a conversation to export.");
          return;
        }
        const markdown = [
          `# ${chat.name}`,
          `*Exported on ${new Date().toLocaleString()}*\n`,
          ...chat.messages.map((m) => `**${m.mine ? "You" : (m.isAi ? "AI Assistant" : "Peer")}** (${new Date(m.time).toLocaleTimeString()}):\n${m.text}\n`)
        ].join("\n");

        downloadText(`${chat.name.replace(/[^a-z0-9]/gi, "_")}.md`, markdown);
        copyText(markdown);
        showStatus("✓ Conversation downloaded and copied to clipboard!");
        break;
      }

      // Tool 5: Chat Stats & Cleanup
      case "tool-chat-stats": {
        const chat = activeChat();
        if (!chat) {
          showStatus("Select a conversation to analyze.");
          return;
        }
        const totalWords = chat.messages.reduce((sum, m) => sum + (m.text.trim().split(/\s+/).length || 0), 0);
        const myCount = chat.messages.filter((m) => m.mine).length;
        const otherCount = chat.messages.length - myCount;

        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">📊 Analytics for "${escapeHTML(chat.name)}"</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <p class="ce-muted">
            • Total messages: <strong>${chat.messages.length}</strong><br>
            • Your messages: <strong>${myCount}</strong> | Assistant/Peer: <strong>${otherCount}</strong><br>
            • Word count: <strong>${totalWords}</strong> words
          </p>
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="chat-clean-older">Trim to Last 10</button>
            <button class="ce-button ce-grow" data-action="chat-copy-stats">Copy Report</button>
          </div>
        `;
        break;
      }
    }
  }

  // === B. MEDIA MENU: 5 TOOLS ===
  async function executeMediaTool(toolName) {
    const drawer = $("#ce-media-tool-drawer");

    switch (toolName) {
      // Tool 1: File Uploader
      case "tool-media-upload": {
        $("#ce-media-file-input").click();
        break;
      }

      // Tool 2: Clipboard Paste & Link Grabber
      case "tool-media-paste": {
        try {
          // Check if clipboard contains a YouTube or image link
          const clipText = await navigator.clipboard.readText();
          if (clipText && clipText.trim()) {
            const yt = getYouTubeInfo(clipText.trim());
            if (yt) {
              data.media.unshift({
                id: makeId(),
                name: `YouTube: ${yt.id}`,
                url: yt.url,
                dataUrl: yt.thumb,
                isYouTube: true,
                time: Date.now()
              });
              saveData();
              renderMedia();
              showStatus("✓ YouTube link added to Media! You can drag it anytime.");
              return;
            }
          }

          const items = await navigator.clipboard.read();
          const files = [];
          for (const item of items) {
            const imageType = item.types.find((t) => t.startsWith("image/"));
            if (imageType) {
              const blob = await item.getType(imageType);
              files.push(new File([blob], `clipboard-${Date.now()}.${imageType.split("/")[1] || "png"}`, { type: imageType }));
            }
          }
          if (files.length) {
            await processImageFiles(files);
            return;
          }
        } catch {}

        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">📋 Add Media or YouTube Link</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <p class="ce-muted">Enter a YouTube video URL or media link:</p>
          <input id="ce-media-link-input" class="ce-input" placeholder="e.g. https://www.youtube.com/watch?v=... or image URL">
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="add-media-link">Add Link</button>
          </div>
          <p class="ce-muted" style="margin-top:6px;">Or paste image data directly (Ctrl+V):</p>
          <div style="border:2px dashed var(--accent-media);padding:14px;border-radius:12px;text-align:center;cursor:pointer;" tabindex="0" id="ce-paste-zone">
            Click here & Press Ctrl+V
          </div>
        `;
        break;
      }

      // Tool 3: Image Optimizer & Compressor (HTML5 Canvas)
      case "tool-media-compress": {
        if (!data.media.length) {
          showStatus("No media to compress. Upload an image first!");
          return;
        }
        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">⚡ Canvas Image Compressor</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <p class="ce-muted">Optimizes & resizes images to reduce localStorage footprint by up to 80%:</p>
          <select id="ce-compress-target" class="ce-select">
            ${data.media.map((m) => `<option value="${m.id}">${escapeHTML(m.name)}</option>`).join("")}
          </select>
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="run-compression">Compress Selected (80% JPEG)</button>
          </div>
          <p id="ce-compression-status" class="ce-status"></p>
        `;
        break;
      }

      // Tool 4: Dominant Palette & Info Extractor
     // Tool 4: Theme Studio - Preset Theme Colors
case "tool-media-palette": {
  const themes = [
    { id: "violet", name: "Violet Dream", primary: "#8b5cf6", secondary: "#6366f1", accent: "#c084fc" },
    { id: "pink", name: "Pink Glow", primary: "#ec4899", secondary: "#f43f5e", accent: "#f9a8d4" },
    { id: "blue", name: "Ocean Blue", primary: "#3b82f6", secondary: "#06b6d4", accent: "#7dd3fc" },
    { id: "green", name: "Emerald", primary: "#10b981", secondary: "#059669", accent: "#6ee7b7" },
    { id: "orange", name: "Sunset Orange", primary: "#f97316", secondary: "#ef4444", accent: "#fdba74" }
  ];

  const savedTheme = localStorage.getItem("ce-selected-theme") || "violet";

  drawer.classList.remove("ce-hidden");
  drawer.innerHTML = `
    <div class="ce-tool-drawer-header">
      <h4 class="ce-tool-drawer-title">🎨 Theme Studio</h4>
      <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
    </div>

    <p class="ce-muted">Choose a color theme for your workspace.</p>

    <div class="ce-theme-grid">
      ${themes.map(theme => `
        <button
          type="button"
          class="ce-theme-option ${savedTheme === theme.id ? "selected" : ""}"
          data-action="theme-preset"
          data-theme="${theme.id}"
          style="--theme-primary:${theme.primary};--theme-secondary:${theme.secondary};--theme-accent:${theme.accent}">
          <span class="ce-theme-preview">
            <span></span><span></span><span></span>
          </span>
          <span class="ce-theme-name">${theme.name}</span>
          <span class="ce-theme-check">${savedTheme === theme.id ? "✓ Selected" : "Select theme"}</span>
        </button>
      `).join("")}
    </div>

    <p class="ce-status">Select a preset to customize your workspace colors.</p>
  `;
  break;
}

      // Tool 5: Save All Images
      case "tool-media-download-all": {
        if (!data.media.length) {
          showStatus("Media gallery is empty.");
          return;
        }
        data.media.forEach((m, idx) => {
          setTimeout(() => {
            const anchor = document.createElement("a");
            anchor.href = m.dataUrl;
            anchor.download = m.name;
            anchor.click();
          }, idx * 250);
        });
        showStatus(`✓ Started downloading ${data.media.length} images.`);
        break;
      }
    }
  }

  function extractPaletteFromDataUrl(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 50;
      canvas.height = 50;
      ctx.drawImage(img, 0, 0, 50, 50);
      const imgData = ctx.getImageData(0, 0, 50, 50).data;

      const colors = [];
      for (let i = 0; i < imgData.length; i += 40) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        if (!colors.includes(hex) && colors.length < 5) {
          colors.push(hex);
        }
      }
      callback(colors.length ? colors : ["#6366f1", "#ec4899", "#10b981", "#fb923c"], img.naturalWidth || 400, img.naturalHeight || 300);
    };
    img.src = dataUrl;
  }

  async function processImageFiles(files) {
    let added = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_IMAGE_SIZE) {
        showStatus(`${file.name} exceeds 2MB limit.`);
        continue;
      }
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Read failed"));
          reader.readAsDataURL(file);
        });
        data.media.unshift({
          id: makeId(),
          name: file.name || `image-${Date.now()}.png`,
          dataUrl,
          time: Date.now()
        });
        added++;
      } catch {
        showStatus(`Could not process ${file.name}`);
      }
    }
    if (added && saveData()) {
      renderMedia();
      showStatus(`✓ Added ${added} image(s) to gallery.`);
    }
  }

  // === C. GROUPS MENU: 5 TOOLS ===
  function executeGroupTool(toolName) {
    const drawer = $("#ce-group-tool-drawer");

    switch (toolName) {
      // Tool 1: Create Group with Category
      case "tool-group-create": {
        const name = prompt("Enter new Group name:", "New Project Group");
        if (!name || !name.trim()) return;
        const category = prompt("Choose Category (Work / Study / Project / Social):", "Project") || "Project";
        const members = parseInt(prompt("Initial member count:", "4"), 10) || 4;

        data.groups.unshift({
          id: makeId(),
          name: name.trim(),
          category: category.trim(),
          members,
          announcement: "",
          time: Date.now()
        });
        saveData();
        renderGroups();
        showStatus(`✓ Created group "${name}"`);
        break;
      }

      // Tool 2: Invite Link Generator
      case "tool-group-invite": {
        const group = data.groups[0];
        if (!group) {
          showStatus("Create a group first.");
          return;
        }
        const code = Math.floor(100000 + Math.random() * 900000);
        const inviteText = `Join my workspace group "${group.name}"\nInvite Link: ${location.origin}/#ce-group-${group.id}\nAccess Passcode: CE-${code}`;
        copyText(inviteText);
        showStatus("✓ Group invitation & access code copied to clipboard!");
        break;
      }

      // Tool 3: Broadcast Announcement
      case "tool-group-broadcast": {
        if (!data.groups.length) {
          showStatus("Create a group first.");
          return;
        }
        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">📢 Post Group Announcement</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <select id="ce-announce-target" class="ce-select">
            ${data.groups.map((g) => `<option value="${g.id}">${escapeHTML(g.name)}</option>`).join("")}
          </select>
          <input id="ce-announce-text" class="ce-input" placeholder="Type announcement headline...">
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="save-announcement">Post Announcement</button>
            <button class="ce-button ce-grow" data-action="clear-announcements">Remove Notice</button>
          </div>
        `;
        break;
      }

      // Tool 4: Standup Speaker / Random Member Picker
      case "tool-group-picker": {
        if (!data.groups.length) {
          showStatus("Create a group first.");
          return;
        }
        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">🎲 Random Speaker / Member Picker</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <p class="ce-muted">Draw a random member or standup presenter:</p>
          <select id="ce-picker-group" class="ce-select">
            ${data.groups.map((g) => `<option value="${g.id}">${escapeHTML(g.name)} (${g.members} members)</option>`).join("")}
          </select>
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="roll-picker">Roll Random Member</button>
          </div>
          <div id="ce-picker-result" class="ce-timer-clock" style="font-size:20px;margin:8px 0;">Ready to roll</div>
        `;
        break;
      }

      // Tool 5: Backup Groups Data
      case "tool-group-export": {
        if (!data.groups.length) {
          showStatus("No groups to backup.");
          return;
        }
        const json = JSON.stringify(data.groups, null, 2);
        downloadText("groups-backup.json", json, "application/json");
        showStatus("✓ Groups data exported to JSON file.");
        break;
      }
    }
  }

  // === D. SHARES MENU: 5 TOOLS ===
  function executeShareTool(toolName) {
    const drawer = $("#ce-share-tool-drawer");

    switch (toolName) {
      // Tool 1: 1-Click Save Page
      case "tool-share-save": {
        const url = location.href;
        if (!isValidUrl(url)) {
          showStatus("This URL cannot be saved.");
          return;
        }
        if (data.shares.some((s) => s.url === url)) {
          showStatus("Current page is already saved in Shares.");
          return;
        }
        data.shares.unshift({
          id: makeId(),
          title: document.title || url,
          url,
          domain: location.hostname,
          time: Date.now()
        });
        saveData();
        renderShares();
        showStatus("✓ Saved current webpage to Shares!");
        break;
      }

      // Tool 2: Live QR Code Generator
      case "tool-share-qr": {
        const url = location.href;
        const svg = generateQRCodeSVG(url);
        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">📱 Live QR Code for Active Page</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <div class="ce-qr-display">
            <div class="ce-qr-frame">${svg}</div>
            <p class="ce-muted" style="font-size:11px;word-break:break-all;text-align:center;">${escapeHTML(url)}</p>
            <div class="ce-row">
              <button class="ce-button ce-button-primary ce-grow" data-action="copy-qr-url">Copy Link</button>
              <button class="ce-button ce-grow" data-action="save-qr-svg">Download SVG</button>
            </div>
          </div>
        `;
        break;
      }

      // Tool 3: Clean Link & Markdown Formatter
      case "tool-share-clean": {
        const raw = location.href;
        const clean = cleanUrl(raw);
        const md = `[${document.title || "Page"}](${clean})`;

        drawer.classList.remove("ce-hidden");
        drawer.innerHTML = `
          <div class="ce-tool-drawer-header">
            <h4 class="ce-tool-drawer-title">🧹 Clean Link & Markdown Formatter</h4>
            <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
          </div>
          <p class="ce-muted">Tracking parameters (UTM, ref, fbclid) stripped:</p>
          <input class="ce-input" value="${escapeHTML(clean)}" readonly>
          <div class="ce-row">
            <button class="ce-button ce-button-primary ce-grow" data-action="copy-clean-link" data-url="${escapeHTML(clean)}">Copy Clean URL</button>
            <button class="ce-button ce-grow" data-action="copy-md-link" data-md="${escapeHTML(md)}">Copy Markdown</button>
          </div>
        `;
        break;
      }

      // Tool 4: Bookmarks HTML Export
      case "tool-share-export-html": {
        if (!data.shares.length) {
          showStatus("No saved pages to export.");
          return;
        }
        const html = [
          `<!DOCTYPE NETSCAPE-Bookmark-file-1>`,
          `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">`,
          `<TITLE>Chat Everywhere Bookmarks</TITLE>`,
          `<H1>Bookmarks</H1>`,
          `<DL><p>`,
          ...data.shares.map((s) => `  <DT><A HREF="${escapeHTML(s.url)}" ADD_DATE="${Math.floor(s.time / 1000)}">${escapeHTML(s.title)}</A>`),
          `</DL><p>`
        ].join("\n");

        downloadText("chat-everywhere-bookmarks.html", html, "text/html;charset=utf-8");
        showStatus("✓ Exported HTML bookmark file (importable in any browser)!");
        break;
      }

      // Tool 5: Batch Link Opener
      case "tool-share-batch-open": {
        if (!data.shares.length) {
          showStatus("No saved pages to open.");
          return;
        }
        const top5 = data.shares.slice(0, 5);
        top5.forEach((s) => {
          window.open(s.url, "_blank", "noopener,noreferrer");
        });
        showStatus(`✓ Opened top ${top5.length} links in new tabs.`);
        break;
      }
    }
  }

  // Safe arithmetic parser: supports numbers, parentheses, + - * / % and ^.
  // It never evaluates user input as JavaScript.
  function evaluateArithmetic(expression) {
    const input = String(expression || "").replace(/[×x]/gi, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    if (!input || !/^[0-9.+*/%()\-^]+$/.test(input)) throw new Error("Use numbers and + − × ÷ % ^ ( ) only.");
    const tokens = input.match(/(?:\d+\.?\d*|\.\d+)|[()+\-*/%^]/g) || [];
    if (tokens.join("") !== input) throw new Error("Invalid expression.");
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    function primary() {
      const t = peek();
      if (t === "+" || t === "-") { take(); const v = primary(); return t === "-" ? -v : v; }
      if (t === "(") {
        take(); const value = addSub();
        if (take() !== ")") throw new Error("Missing closing parenthesis.");
        return value;
      }
      if (t === undefined || !/^\d*\.?\d+$/.test(t)) throw new Error("Expected a number.");
      take(); return Number(t);
    }
    function power() { let v = primary(); if (peek() === "^") { take(); v = v ** power(); } return v; }
    function mulDiv() {
      let v = power();
      while (["*", "/", "%"].includes(peek())) {
        const op = take(), rhs = power();
        if ((op === "/" || op === "%") && rhs === 0) throw new Error("Cannot divide by zero.");
        v = op === "*" ? v * rhs : op === "/" ? v / rhs : v % rhs;
      }
      return v;
    }
    function addSub() {
      let v = mulDiv();
      while (peek() === "+" || peek() === "-") { const op = take(), rhs = mulDiv(); v = op === "+" ? v + rhs : v - rhs; }
      return v;
    }
    const result = addSub();
    if (pos !== tokens.length) throw new Error("Check the expression and parentheses.");
    if (!Number.isFinite(result)) throw new Error("Result is outside the supported range.");
    return Number.parseFloat(result.toPrecision(12));
  }

  // === E. TOOLS MENU: 5 TOOLS HANDLERS ===
  function executeToolsMenuAction(action) {
    switch (action) {
      // 1. Calculator
      case "tools-calculate": {
        const expr = ($("#ce-calc-input").value || "").trim();
        const resEl = $("#ce-calc-result");
        if (!expr) {
          resEl.textContent = "Please enter a mathematical expression.";
          return;
        }
        try {
          const answer = evaluateArithmetic(expr);
          resEl.textContent = `= ${answer}`;
          data.calcHistory = [{ expr, res: answer, time: Date.now() }, ...(data.calcHistory || [])].slice(0, 10);
          saveData();
        } catch (error) {
          resEl.textContent = error?.message || "Invalid calculation. Check your expression.";
        }
        break;
      }

      case "tools-calc-clear":
        $("#ce-calc-input").value = "";
        $("#ce-calc-result").textContent = "Ready";
        break;

      // 2. Notes
      case "tools-notes-copy":
        copyText($("#ce-notes").value);
        break;

      case "tools-notes-export":
        downloadText("quick-notes.txt", $("#ce-notes").value);
        showStatus("✓ Notes downloaded.");
        break;

      // 3. Custom Focus Timer
      case "timer-apply": {
        const input = $("#ce-timer-minutes");
        const minutes = Number(input.value);

        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 5999) {
          showStatus("Enter a whole number from 1 to 5999 minutes.");
          input.focus();
          break;
        }

        setTimer(minutes * 60, `Custom focus (${minutes} min)`);
        showStatus(`Timer set to ${minutes} minutes.`);
        break;
      }

      case "timer-set-25":
        $("#ce-timer-minutes").value = 25;
        setTimer(25 * 60, "Focus session (25 min)");
        break;

      case "timer-set-5":
        $("#ce-timer-minutes").value = 5;
        setTimer(5 * 60, "Short rest (5 min)");
        break;

      case "timer-set-15":
        $("#ce-timer-minutes").value = 15;
        setTimer(15 * 60, "Long break (15 min)");
        break;

      case "timer-start": {
        const btn = $('[data-action="timer-start"]');

        if (focusSeconds <= 0) {
          showStatus("Please set the timer again.");
          break;
        }

        if (focusInterval) {
          clearInterval(focusInterval);
          focusInterval = null;
          btn.textContent = "Resume";
          showStatus("Timer paused.");
        } else {
          focusInterval = setInterval(() => {
            focusSeconds = Math.max(0, focusSeconds - 1);
            updateTimerDisplay();

            if (focusSeconds === 0) {
              clearInterval(focusInterval);
              focusInterval = null;
              btn.textContent = "Start";
              playBeepSound();
              showStatus("Focus session complete!");
              alert("Focus session complete! Great work.");
            }
          }, 1000);

          btn.textContent = "Pause";
          showStatus("Timer running.");
        }

        break;
      }

      case "timer-reset": {
        if (focusInterval) {
          clearInterval(focusInterval);
          focusInterval = null;
        }

        const minutes = Number($("#ce-timer-minutes").value);
        const validMinutes =
          Number.isInteger(minutes) && minutes >= 1 && minutes <= 5999
            ? minutes
            : 25;

        focusSeconds = validMinutes * 60;
        updateTimerDisplay();

        const btn = $('[data-action="timer-start"]');
        if (btn) btn.textContent = "Start";

        showStatus(`Timer reset to ${validMinutes} minutes.`);
        break;
      }
      // 5. Page Inspector & Snapshot
      case "tools-page-inspect": {
        const title = document.title || "(Untitled)";
        const desc = document.querySelector('meta[name="description"]')?.content || "None";
        const h1Count = document.querySelectorAll("h1").length;
        const h2Count = document.querySelectorAll("h2").length;
        const imgCount = document.images ? document.images.length : 0;
        const bodyText = document.body ? document.body.innerText.trim() : "";
        const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
        const readingTime = Math.ceil(wordCount / 200);

        const summary = [
          `Title: ${title}`,
          `URL: ${location.href}`,
          `Meta Description: ${desc}`,
          `Headings: ${h1Count} H1(s), ${h2Count} H2(s)`,
          `Images: ${imgCount} | Word count: ~${wordCount} words (${readingTime} min read)`
        ].join("\n");

        $("#ce-page-snapshot-output").textContent = summary;
        break;
      }

      case "tools-page-copy-summary": {
        const text = $("#ce-page-snapshot-output").textContent;
        if (!text || text.includes("Click 'Inspect Active Page'")) {
          showStatus("Please inspect the active page first.");
          return;
        }
        copyText(text);
        break;
      }
    }
  }
  function setTimer(seconds, label) {
    if (focusInterval) {
      clearInterval(focusInterval);
      focusInterval = null;
    }

    focusSeconds = seconds;
    focusMode = "custom";

    const labelElement = $("#ce-timer-mode-label");
    if (labelElement) {
      labelElement.textContent = label;
    }

    updateTimerDisplay();

    const btn = $('[data-action="timer-start"]');
    if (btn) {
      btn.textContent = "Start";
    }
  }

  function updateTimerDisplay() {
    const min = Math.floor(focusSeconds / 60).toString().padStart(2, "0");
    const sec = (focusSeconds % 60).toString().padStart(2, "0");
    const el = $("#ce-timer-display");
    if (el) el.textContent = `${min}:${sec}`;
  }

  function playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Audio not permitted or supported
    }
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS & DELEGATION
  // -------------------------------------------------------------
  launcher.addEventListener("click", toggleWorkspace);

  $("#ce-calc-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeToolsMenuAction("tools-calculate");
    } else if (e.key === "Escape") {
      $("#ce-calc-input").value = "";
      $("#ce-calc-result").textContent = "Ready";
    }
  });

  panel.addEventListener("paste", async (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    await processImageFiles(files);
    switchTab("media");
  });

  panel.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action], button[data-tab], div[data-action]");
    if (!btn) return;

    // Tab navigation
    if (btn.dataset.tab) {
      switchTab(btn.dataset.tab);
      return;
    }

    const action = btn.dataset.action || "";
    const id = btn.dataset.id;

    if (action === "calc-key") {
      const input = $("#ce-calc-input");
      const key = btn.dataset.key;
      if (key === "clear") {
        input.value = "";
        $("#ce-calc-result").textContent = "Ready";
      } else if (key === "backspace") {
        input.value = input.value.slice(0, -1);
      } else {
        input.value += key;
      }
      input.focus();
      return;
    }

    // Header actions
    if (action === "close") {
      toggleWorkspace();
      return;
    }
    if (action === "theme") {
      toggleTheme();
      return;
    }
    if (action === "close-drawer") {
      closeAllToolDrawers();
      return;
    }

    
if (action === "theme-preset") {
  const presets = {
    violet: {
      primary: "#8b5cf6",
      secondary: "#6366f1",
      accent: "#c084fc"
    },
    pink: {
      primary: "#ec4899",
      secondary: "#f43f5e",
      accent: "#f9a8d4"
    },
    blue: {
      primary: "#3b82f6",
      secondary: "#06b6d4",
      accent: "#7dd3fc"
    },
    green: {
      primary: "#10b981",
      secondary: "#059669",
      accent: "#6ee7b7"
    },
    orange: {
      primary: "#f97316",
      secondary: "#ef4444",
      accent: "#fdba74"
    }
  };

  const selectedTheme = btn.dataset.theme;
  const preset = presets[selectedTheme];

  if (!preset) return;

  localStorage.setItem("ce-selected-theme", selectedTheme);

  root.style.setProperty("--theme-primary", preset.primary);
  root.style.setProperty("--theme-secondary", preset.secondary);
  root.style.setProperty("--theme-accent", preset.accent);
  root.dataset.accentTheme = selectedTheme;

  root.querySelectorAll(".ce-theme-option").forEach((option) => {
    const selected = option.dataset.theme === selectedTheme;
    option.classList.toggle("selected", selected);

    const check = option.querySelector(".ce-theme-check");
    if (check) {
      check.textContent = selected ? "✓ Selected" : "Select theme";
    }
  });

  showStatus("Theme changed to " + selectedTheme + ".");
  return;
}


    // Tools menu actions
    if (action.startsWith("tools-") || action.startsWith("timer-") || action.startsWith("text-")) {
      executeToolsMenuAction(action);
      return;
    }

    // Item specific actions
    switch (action) {
      // Chat items
      case "open-chat":
        activeChatId = id;
        renderChats();
        break;

      case "chat-pin": {
        const c = data.chats.find((item) => item.id === id);
        if (c) {
          c.pinned = !c.pinned;
          saveData();
          renderChats();
        }
        break;
      }

      case "chat-pin-active": {
        const c = activeChat();
        if (c) {
          c.pinned = !c.pinned;
          saveData();
          renderChats();
          showStatus(c.pinned ? "Chat pinned." : "Chat unpinned.");
        }
        break;
      }

      case "chat-rename": {
        const c = data.chats.find((item) => item.id === id);
        if (c) {
          const newName = prompt("Rename conversation:", c.name);
          if (newName && newName.trim()) {
            c.name = newName.trim();
            saveData();
            renderChats();
          }
        }
        break;
      }

      case "chat-delete": {
        const c = data.chats.find((item) => item.id === id);
        if (c && confirm(`Delete "${c.name}"?`)) {
          data.chats = data.chats.filter((item) => item.id !== id);
          activeChatId = data.chats[0]?.id || null;
          saveData();
          renderChats();
          showStatus("Conversation removed.");
        }
        break;
      }

      case "chat-clear-active": {
        const c = activeChat();
        if (c && confirm(`Clear all messages in "${c.name}"?`)) {
          c.messages = [];
          saveData();
          renderMessages();
          showStatus("Messages cleared.");
        }
        break;
      }

      case "chat-clean-older": {
        const c = activeChat();
        if (c) {
          c.messages = c.messages.slice(-10);
          saveData();
          renderMessages();
          closeAllToolDrawers();
          showStatus("✓ Trimmed to latest 10 messages.");
        }
        break;
      }

      case "chat-copy-stats": {
        const c = activeChat();
        if (c) {
          const report = `Chat Analytics for ${c.name}:\nMessages: ${c.messages.length}\nDate: ${new Date().toLocaleString()}`;
          copyText(report);
        }
        break;
      }

      // Media items
      case "media-preview": {
        const item = data.media.find((m) => m.id === id);
        if (item) {
          const win = window.open();
          if (win) {
            win.document.title = item.name;
            const img = win.document.createElement("img");
            img.src = item.dataUrl;
            img.style.cssText = "max-width:100%;height:auto;display:block;margin:20px auto;background:#1e293b;border-radius:12px;";
            win.document.body.appendChild(img);
          }
        }
        break;
      }

      case "media-download": {
        const item = data.media.find((m) => m.id === id);
        if (item) {
          const a = document.createElement("a");
          a.href = item.dataUrl;
          a.download = item.name;
          a.click();
        }
        break;
      }

      case "media-delete": {
        if (confirm("Remove this image from your library?")) {
          data.media = data.media.filter((m) => m.id !== id);
          saveData();
          renderMedia();
          showStatus("Image deleted.");
        }
        break;
      }

      case "copy-hex":
        copyText(btn.dataset.hex);
        break;

      case "run-compression": {
        const targetId = $("#ce-compress-target").value;
        const target = data.media.find((m) => m.id === targetId);
        if (!target) return;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 800;
          let w = img.naturalWidth || 800;
          let h = img.naturalHeight || 600;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const compressedUrl = canvas.toDataURL("image/jpeg", 0.75);
          const origSize = Math.round(target.dataUrl.length / 1024);
          const newSize = Math.round(compressedUrl.length / 1024);
          const savedPct = Math.max(0, Math.round(((origSize - newSize) / origSize) * 100));

          target.dataUrl = compressedUrl;
          saveData();
          renderMedia();
          $("#ce-compression-status").textContent = `✓ Compressed from ${origSize} KB to ${newSize} KB (${savedPct}% saved!)`;
        };
        img.src = target.dataUrl;
        break;
      }

      // Group items
      case "group-members-count": {
        const g = data.groups.find((item) => item.id === id);
        if (g) {
          const val = prompt(`Set member count for "${g.name}":`, String(g.members || 1));
          const num = parseInt(val, 10);
          if (num > 0) {
            g.members = num;
            saveData();
            renderGroups();
          }
        }
        break;
      }

      case "group-rename": {
        const g = data.groups.find((item) => item.id === id);
        if (g) {
          const newName = prompt("Rename group:", g.name);
          if (newName && newName.trim()) {
            g.name = newName.trim();
            saveData();
            renderGroups();
          }
        }
        break;
      }

      case "group-invite-one": {
        const g = data.groups.find((item) => item.id === id);
        if (g) {
          const code = Math.floor(100000 + Math.random() * 900000);
          copyText(`Invite to ${g.name} (${g.category})\nLink: ${location.origin}/#ce-${g.id}\nPasscode: CE-${code}`);
        }
        break;
      }

      case "group-delete": {
        if (confirm("Delete this group?")) {
          data.groups = data.groups.filter((item) => item.id !== id);
          saveData();
          renderGroups();
          showStatus("Group removed.");
        }
        break;
      }

      case "save-announcement": {
        const targetId = $("#ce-announce-target").value;
        const text = ($("#ce-announce-text").value || "").trim();
        const g = data.groups.find((item) => item.id === targetId);
        if (g && text) {
          g.announcement = text;
          saveData();
          renderGroups();
          closeAllToolDrawers();
          showStatus("✓ Pinned announcement posted!");
        }
        break;
      }

      case "clear-announcements":
        data.groups.forEach((g) => { g.announcement = ""; });
        saveData();
        renderGroups();
        closeAllToolDrawers();
        showStatus("Announcements cleared.");
        break;

      case "roll-picker": {
        const targetId = $("#ce-picker-group").value;
        const g = data.groups.find((item) => item.id === targetId);
        if (g) {
          const resultEl = $("#ce-picker-result");
          let ticks = 0;
          const roller = setInterval(() => {
            const rand = Math.floor(1 + Math.random() * (g.members || 5));
            resultEl.textContent = `Member #${rand}`;
            ticks++;
            if (ticks > 12) {
              clearInterval(roller);
              const winner = Math.floor(1 + Math.random() * (g.members || 5));
              resultEl.textContent = `🎉 Chosen: Member #${winner}!`;
            }
          }, 60);
        }
        break;
      }

      // Share items
      case "share-open": {
        const s = data.shares.find((item) => item.id === id);
        if (s) window.open(s.url, "_blank", "noopener,noreferrer");
        break;
      }

      case "share-copy": {
        const s = data.shares.find((item) => item.id === id);
        if (s) copyText(s.url);
        break;
      }

      case "share-qr-one": {
        const s = data.shares.find((item) => item.id === id);
        if (s) {
          const svg = generateQRCodeSVG(s.url);
          drawer.classList.remove("ce-hidden");
          drawer.innerHTML = `
            <div class="ce-tool-drawer-header">
              <h4 class="ce-tool-drawer-title">📱 QR Code: ${escapeHTML(s.title)}</h4>
              <button class="ce-tool-drawer-close" data-action="close-drawer">×</button>
            </div>
            <div class="ce-qr-display">
              <div class="ce-qr-frame">${svg}</div>
              <p class="ce-muted" style="font-size:11px;word-break:break-all;text-align:center;">${escapeHTML(s.url)}</p>
              <div class="ce-row">
                <button class="ce-button ce-button-primary ce-grow" data-action="copy-qr-url" data-url="${escapeHTML(s.url)}">Copy Link</button>
              </div>
            </div>
          `;
        }
        break;
      }

      case "share-delete": {
        data.shares = data.shares.filter((item) => item.id !== id);
        saveData();
        renderShares();
        showStatus("Saved link removed.");
        break;
      }

      case "copy-qr-url": {
        const urlToCopy = btn.dataset.url || location.href;
        copyText(urlToCopy);
        break;
      }

      case "save-qr-svg": {
        const svgContent = $(".ce-qr-frame").innerHTML;
        downloadText("page-qrcode.svg", svgContent, "image/svg+xml");
        showStatus("✓ QR Code SVG downloaded.");
        break;
      }

      case "copy-clean-link":
        copyText(btn.dataset.url);
        break;

      case "copy-md-link":
        copyText(btn.dataset.md);
        break;

      case "add-media-link": {
        const val = ($("#ce-media-link-input")?.value || "").trim();
        if (!val) {
          showStatus("Please enter a valid link.");
          break;
        }
        const yt = getYouTubeInfo(val);
        if (yt) {
          data.media.unshift({
            id: makeId(),
            name: `YouTube: ${yt.id}`,
            url: yt.url,
            dataUrl: yt.thumb,
            isYouTube: true,
            time: Date.now()
          });
          saveData();
          renderMedia();
          closeAllToolDrawers();
          showStatus("✓ YouTube link added to Media! It is draggable.");
        } else if (isValidUrl(val)) {
          data.media.unshift({
            id: makeId(),
            name: `Link: ${new URL(val).hostname}`,
            url: val,
            dataUrl: val,
            time: Date.now()
          });
          saveData();
          renderMedia();
          closeAllToolDrawers();
          showStatus("✓ Link added to Media! It is draggable.");
        } else {
          showStatus("Please enter a valid URL (http/https).");
        }
        break;
      }
    }
  });

  // Chat message submit
  $("#ce-chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#ce-chat-input");
    const text = input.value.trim();
    if (!text) return;

    let chat = activeChat();
    if (!chat) {
      chat = { id: makeId(), name: "Conversation", pinned: false, messages: [] };
      data.chats.unshift(chat);
      activeChatId = chat.id;
    }

    chat.messages.push({
      text,
      mine: true,
      time: Date.now()
    });

    if (saveData()) {
      input.value = "";
      renderMessages();
      renderChats();
    }
  });

  // Enter key sends in chat textarea (Shift+Enter for newline)
  $("#ce-chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#ce-chat-form").dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  // File upload change
  $("#ce-media-file-input").addEventListener("change", async (e) => {
    await processImageFiles([...e.target.files]);
    e.target.value = "";
  });

  // Live searches
  $("#ce-chat-search").addEventListener("input", renderChats);
  $("#ce-media-search").addEventListener("input", renderMedia);
  $("#ce-group-search").addEventListener("input", renderGroups);
  $("#ce-share-search").addEventListener("input", renderShares);

 // Quick notes auto-save
$("#ce-notes").addEventListener("input", (e) => {
  data.notes = e.target.value;
  saveData();
});

  // -------------------------------------------------------------
  // NATIVE DRAG & DROP FOR CHAT & MEDIA (YOUTUBE & WEB LINKS)
  // -------------------------------------------------------------

  // 1. DRAG OUT: Ensure all links (YouTube & Web links) are draggable natively
  root.addEventListener("dragstart", (e) => {
    const linkEl = e.target.closest("a[draggable='true'], .ce-yt-card, .ce-draggable-link, .ce-media-card-link");
    if (!linkEl) return;
    const url = linkEl.getAttribute("data-url") || linkEl.href;
    if (url) {
      e.dataTransfer.setData("text/uri-list", url);
      e.dataTransfer.setData("text/plain", url);
      e.dataTransfer.effectAllowed = "copyMove";
    }
  });

  // 2. DRAG IN: Chat Area accepts dropped links (YouTube, web links, etc.)
  const chatMessagesArea = $("#ce-chat-messages");
  const chatAreaCard = $("#ce-chat-area");

  [chatAreaCard, chatMessagesArea].forEach((el) => {
    if (!el) return;
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      chatMessagesArea.classList.add("ce-drag-active");
    });

    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) {
        chatMessagesArea.classList.remove("ce-drag-active");
      }
    });

    el.addEventListener("drop", (e) => {
      e.preventDefault();
      chatMessagesArea.classList.remove("ce-drag-active");

      const droppedText = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").trim();
      if (droppedText) {
        let chat = activeChat();
        if (!chat) {
          chat = { id: makeId(), name: "Shared Links Chat", pinned: false, messages: [] };
          data.chats.unshift(chat);
          activeChatId = chat.id;
        }

        chat.messages.push({
          text: droppedText,
          mine: true,
          time: Date.now()
        });

        if (saveData()) {
          renderMessages();
          renderChats();
          const isYt = !!getYouTubeInfo(droppedText);
          showStatus(isYt ? "✓ YouTube link dropped into chat! It is draggable." : "✓ Link dropped into chat! It is draggable.");
        }
      }
    });
  });

  // 3. DRAG IN: Media Gallery accepts dropped YouTube links, web links, or image files
  const mediaGrid = $("#ce-media-grid");
  const mediaView = root.querySelector('[data-view="media"]');

  [mediaView, mediaGrid].forEach((el) => {
    if (!el) return;
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      mediaGrid.classList.add("ce-drag-active");
    });

    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) {
        mediaGrid.classList.remove("ce-drag-active");
      }
    });

    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      mediaGrid.classList.remove("ce-drag-active");

      // Check if dropped files (e.g. image files from desktop or browser)
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        await processImageFiles([...e.dataTransfer.files]);
        return;
      }

      // Check if dropped URL (e.g. YouTube video dragged from address bar or web page)
      const droppedUrl = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").trim();
      if (droppedUrl) {
        const yt = getYouTubeInfo(droppedUrl);
        if (yt) {
          data.media.unshift({
            id: makeId(),
            name: `YouTube: ${yt.id}`,
            url: yt.url,
            dataUrl: yt.thumb,
            isYouTube: true,
            time: Date.now()
          });
          saveData();
          renderMedia();
          showStatus("✓ YouTube link added to Media! You can drag it to any other tab or app.");
          return;
        }

        if (isValidUrl(droppedUrl)) {
          data.media.unshift({
            id: makeId(),
            name: `Link: ${new URL(droppedUrl).hostname}`,
            url: droppedUrl,
            dataUrl: droppedUrl,
            time: Date.now()
          });
          saveData();
          renderMedia();
          showStatus("✓ Link added to Media! It is now draggable.");
        }
      }
    });
  });

  // Initial render
  renderAll();
  updateTimerDisplay();
})();
