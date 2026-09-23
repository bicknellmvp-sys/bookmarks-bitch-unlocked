/**
 * LumiList Bookmark Import Helper
 * Standardizes the 3-option import rule everywhere:
 * - Import 1 Bookmark
 * - Import 1 Folder
 * - Import All Stored Bookmarks
 */

(function (window) {
  'use strict';

  // Fallback preset bookmarks if browser/DB has no stored bookmarks yet
  const FALLBACK_STORED_BOOKMARKS = [
    {
      id: 'folder_favorites',
      title: 'Favorites',
      bookmarks: [
        { title: 'Google', url: 'https://google.com' },
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'YouTube', url: 'https://youtube.com' },
        { title: 'Wikipedia', url: 'https://wikipedia.org' },
        { title: 'Reddit', url: 'https://reddit.com' }
      ]
    },
    {
      id: 'folder_dev',
      title: 'Developer Tools',
      bookmarks: [
        { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
        { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
        { title: 'Tailwind CSS', url: 'https://tailwindcss.com' },
        { title: 'Node.js', url: 'https://nodejs.org' }
      ]
    },
    {
      id: 'folder_news',
      title: 'News & Reads',
      bookmarks: [
        { title: 'Hacker News', url: 'https://news.ycombinator.com' },
        { title: 'The Verge', url: 'https://theverge.com' },
        { title: 'BBC News', url: 'https://bbc.com' }
      ]
    }
  ];

  async function getStoredBookmarkHierarchy() {
    const folders = [];
    const singleBookmarks = [];
    let totalBookmarks = 0;

    // 1. Try Chrome bookmarks API
    if (typeof chrome !== 'undefined' && chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function') {
      try {
        const tree = await new Promise((resolve) => {
          try {
            chrome.bookmarks.getTree((res) => resolve(res || []));
          } catch (e) {
            resolve([]);
          }
        });

        if (Array.isArray(tree) && tree.length > 0) {
          function traverse(node, currentFolder = 'Bookmarks') {
            if (!node) return;
            if (node.url) {
              const bm = {
                id: node.id || 'bm_' + Math.random().toString(36).substring(2, 9),
                title: (node.title || node.url).trim(),
                url: node.url,
                description: '',
                folderTitle: currentFolder
              };
              singleBookmarks.push(bm);
              totalBookmarks++;
              return bm;
            }

            const folderTitle = (node.title || currentFolder).trim();
            const childBms = [];

            if (Array.isArray(node.children)) {
              for (const child of node.children) {
                const res = traverse(child, folderTitle);
                if (res) childBms.push(res);
              }
            }

            if (childBms.length > 0) {
              folders.push({
                id: node.id || 'f_' + Math.random().toString(36).substring(2, 9),
                title: folderTitle || 'Folder',
                bookmarkCount: childBms.length,
                bookmarks: childBms
              });
            }
          }

          for (const rootNode of tree) {
            traverse(rootNode, 'Bookmarks Bar');
          }
        }
      } catch (err) {
        console.warn('[ImportHelper] Failed to read from chrome.bookmarks:', err);
      }
    }

    // 2. If nothing from Chrome bookmarks, query existing database bookmarks
    if (singleBookmarks.length === 0 && typeof db !== 'undefined' && db.boards && db.bookmarks) {
      try {
        const boards = await db.boards.filter((b) => !b.deletedAt).toArray();
        const allDbBookmarks = await db.bookmarks.filter((b) => !b.deletedAt).toArray();

        if (allDbBookmarks.length > 0) {
          const boardMap = new Map(boards.map((b) => [b.id, b.name || 'Untitled Board']));

          for (const b of boards) {
            const bms = allDbBookmarks
              .filter((item) => item.boardId === b.id)
              .map((item) => ({
                id: item.id,
                title: item.title || item.url,
                url: item.url,
                description: item.description || '',
                folderTitle: b.name || 'Board'
              }));

            if (bms.length > 0) {
              folders.push({
                id: b.id,
                title: b.name || 'Board',
                bookmarkCount: bms.length,
                bookmarks: bms
              });
            }
          }

          for (const bm of allDbBookmarks) {
            singleBookmarks.push({
              id: bm.id,
              title: bm.title || bm.url,
              url: bm.url,
              description: bm.description || '',
              folderTitle: boardMap.get(bm.boardId) || 'Board'
            });
            totalBookmarks++;
          }
        }
      } catch (err) {
        console.warn('[ImportHelper] Failed to read from db:', err);
      }
    }

    // 3. If still empty, use fallback presets
    if (singleBookmarks.length === 0) {
      for (const f of FALLBACK_STORED_BOOKMARKS) {
        const bms = f.bookmarks.map((bm, idx) => ({
          id: `${f.id}_${idx}`,
          title: bm.title,
          url: bm.url,
          description: '',
          folderTitle: f.title
        }));

        folders.push({
          id: f.id,
          title: f.title,
          bookmarkCount: bms.length,
          bookmarks: bms
        });

        for (const bm of bms) {
          singleBookmarks.push(bm);
          totalBookmarks++;
        }
      }
    }

    return {
      folders,
      singleBookmarks,
      totalBookmarks
    };
  }

  /**
   * Renders the interactive Import widget (checkbox + dynamic dropdown rule)
   */
  async function attachImportWidgetToContainer(container, options = {}) {
    if (!container) return null;
    const hierarchy = await getStoredBookmarkHierarchy();
    const prefix = options.idPrefix || 'import_' + Math.random().toString(36).substring(2, 7);

    container.innerHTML = `
      <div class="ll-import-rule-box">
        <label class="ll-import-checkbox-label">
          <input type="checkbox" id="${prefix}_checkbox" class="ll-import-toggle-input">
          <span class="ll-import-checkbox-text">Wish to add links right then and there?</span>
        </label>
        
        <div id="${prefix}_menu_wrapper" class="ll-import-dropdown-wrap" style="display: none; margin-top: 10px;">
          <label class="ll-import-label" for="${prefix}_rule_select">Select what to import:</label>
          <select id="${prefix}_rule_select" class="ll-import-select">
            <option value="" disabled selected>-- Choose import option --</option>
            <option value="one">Import 1 Bookmark</option>
            <option value="folder">Import 1 Folder</option>
            <option value="all">Import All Stored Bookmarks (${hierarchy.totalBookmarks})</option>
          </select>
          
          <div id="${prefix}_sub_one" class="ll-import-sub-picker" style="display: none; margin-top: 8px;">
            <label class="ll-import-sublabel" for="${prefix}_select_one">Choose Bookmark:</label>
            <select id="${prefix}_select_one" class="ll-import-select">
              ${hierarchy.singleBookmarks
                .map(
                  (bm) =>
                    `<option value="${escapeAttr(bm.id)}" data-url="${escapeAttr(bm.url)}" data-title="${escapeAttr(
                      bm.title
                    )}">${escapeText(bm.title)} (${escapeText(bm.folderTitle)})</option>`
                )
                .join('')}
            </select>
          </div>
          
          <div id="${prefix}_sub_folder" class="ll-import-sub-picker" style="display: none; margin-top: 8px;">
            <label class="ll-import-sublabel" for="${prefix}_select_folder">Choose Folder:</label>
            <select id="${prefix}_select_folder" class="ll-import-select">
              ${hierarchy.folders
                .map(
                  (f) =>
                    `<option value="${escapeAttr(f.id)}">${escapeText(f.title)} (${f.bookmarkCount} bookmark${
                      f.bookmarkCount === 1 ? '' : 's'
                    })</option>`
                )
                .join('')}
            </select>
          </div>
          
          <div id="${prefix}_sub_all" class="ll-import-sub-picker ll-import-summary-badge" style="display: none; margin-top: 8px;">
            <span>Ready to import all <strong>${hierarchy.totalBookmarks}</strong> bookmarks across all folders.</span>
          </div>
        </div>
      </div>
    `;

    const checkbox = container.querySelector(`#${prefix}_checkbox`);
    const menuWrapper = container.querySelector(`#${prefix}_menu_wrapper`);
    const ruleSelect = container.querySelector(`#${prefix}_rule_select`);
    const subOne = container.querySelector(`#${prefix}_sub_one`);
    const subFolder = container.querySelector(`#${prefix}_sub_folder`);
    const subAll = container.querySelector(`#${prefix}_sub_all`);
    const selectOne = container.querySelector(`#${prefix}_select_one`);
    const selectFolder = container.querySelector(`#${prefix}_select_folder`);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        menuWrapper.style.display = 'block';
        if (!ruleSelect.value) {
          ruleSelect.value = 'one';
          updateRuleViews('one');
        }
      } else {
        menuWrapper.style.display = 'none';
      }
      if (typeof options.onChange === 'function') options.onChange();
    });

    function updateRuleViews(rule) {
      subOne.style.display = rule === 'one' ? 'block' : 'none';
      subFolder.style.display = rule === 'folder' ? 'block' : 'none';
      subAll.style.display = rule === 'all' ? 'block' : 'none';
    }

    ruleSelect.addEventListener('change', () => {
      updateRuleViews(ruleSelect.value);
      if (typeof options.onChange === 'function') options.onChange();
    });

    return {
      hierarchy,
      checkbox,
      ruleSelect,
      getSelectedItems: () => {
        if (!checkbox.checked) return [];
        const rule = ruleSelect.value;
        if (rule === 'one') {
          const selectedOption = selectOne.options[selectOne.selectedIndex];
          if (!selectedOption) return [];
          return [
            {
              title: selectedOption.dataset.title || selectedOption.textContent.split(' (')[0],
              url: selectedOption.dataset.url || 'https://google.com',
              description: ''
            }
          ];
        }
        if (rule === 'folder') {
          const folderId = selectFolder.value;
          const folder = hierarchy.folders.find((f) => f.id === folderId);
          if (!folder) return [];
          return folder.bookmarks.map((bm) => ({
            title: bm.title,
            url: bm.url,
            description: bm.description || ''
          }));
        }
        if (rule === 'all') {
          return hierarchy.singleBookmarks.map((bm) => ({
            title: bm.title,
            url: bm.url,
            description: bm.description || ''
          }));
        }
        return [];
      }
    };
  }

  /**
   * Import array of bookmarks into a specific board in database
   */
  async function importBookmarksIntoBoard(boardId, items, options = {}) {
    if (!boardId || !Array.isArray(items) || items.length === 0) return { success: false, count: 0 };
    if (typeof addBookmark !== 'function') {
      console.error('[ImportHelper] addBookmark function not available');
      return { success: false, count: 0 };
    }

    let importedCount = 0;
    const addedRecords = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.url) continue;
      try {
        const newBmId = await addBookmark(
          {
            boardId,
            title: item.title || 'Untitled',
            url: item.url,
            description: item.description || null,
            order: i
          },
          { skipHistory: options.skipHistory !== false }
        );

        if (newBmId) {
          importedCount++;
          if (typeof db !== 'undefined' && db.bookmarks) {
            const rec = await db.bookmarks.get(newBmId);
            if (rec) addedRecords.push({ table: 'bookmarks', id: newBmId, before: null, after: rec });
          }
        }
      } catch (err) {
        console.warn('[ImportHelper] Failed to add bookmark:', item.title, err);
      }
    }

    // Record history entry for undo
    if (!options.skipHistory && typeof recordUndoRedoHistoryEntry === 'function' && addedRecords.length > 0) {
      try {
        await recordUndoRedoHistoryEntry({
          kind: 'import_bookmarks',
          label: `Imported ${importedCount} bookmark(s)`,
          ops: addedRecords
        });
      } catch (_) {}
    }

    return { success: true, count: importedCount };
  }

  function escapeText(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Export to global scope
  window.LumiListImportHelper = {
    getStoredBookmarkHierarchy,
    attachImportWidgetToContainer,
    importBookmarksIntoBoard,
    FALLBACK_STORED_BOOKMARKS
  };
})(window);
