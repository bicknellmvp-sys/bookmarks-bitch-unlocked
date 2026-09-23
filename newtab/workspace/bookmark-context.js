/**
 * LumiList Bookmark Context Menu
 * Expands bookmark context options with a comprehensive, powerful menu:
 * - Open in New Tab
 * - Copy Link Address
 * - Edit Bookmark
 * - Move to Board...
 * - Duplicate Bookmark
 * - Refresh Favicon & Metadata
 * - Delete Bookmark
 */

(function (window) {
  'use strict';

  let activeMenuEl = null;

  function closeBookmarkContextMenu() {
    if (activeMenuEl) {
      activeMenuEl.remove();
      activeMenuEl = null;
    }
  }

  async function openBookmarkContextMenu(bookmarkId, x, y) {
    closeBookmarkContextMenu();
    if (!bookmarkId || typeof db === 'undefined' || !db.bookmarks) return;

    const bookmark = await db.bookmarks.get(bookmarkId);
    if (!bookmark || bookmark.deletedAt) return;

    // Get boards for the "Move to Board" feature
    const boards = await db.boards.filter((b) => !b.deletedAt).toArray();
    const currentBoard = boards.find((b) => b.id === bookmark.boardId);

    const menu = document.createElement('div');
    menu.className = 'll-bookmark-context-menu';
    menu.setAttribute('role', 'menu');

    menu.innerHTML = `
      <div class="ll-context-header">
        <span class="ll-context-title" title="${escapeAttr(bookmark.title || bookmark.url)}">${escapeHtml(
      bookmark.title || 'Bookmark'
    )}</span>
      </div>
      <div class="ll-context-divider"></div>
      <button class="ll-context-item" data-action="open-new-tab">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        <span>Open in New Tab</span>
      </button>
      <button class="ll-context-item" data-action="copy-url">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Copy Link Address</span>
      </button>
      <button class="ll-context-item" data-action="edit">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        <span>Edit Bookmark</span>
      </button>
      <div class="ll-context-item-has-submenu">
        <button class="ll-context-item" data-action="move-to-board-toggle">
          <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>Move to Board</span>
          <span class="ll-context-arrow">›</span>
        </button>
        <div class="ll-context-submenu" style="display: none;">
          ${boards
            .filter((b) => b.id !== bookmark.boardId)
            .slice(0, 12)
            .map(
              (b) =>
                `<button class="ll-context-item" data-action="move-to-board" data-target-board="${escapeAttr(
                  b.id
                )}">${escapeHtml(b.name || 'Untitled')}</button>`
            )
            .join('')}
        </div>
      </div>
      <button class="ll-context-item" data-action="duplicate">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
        <span>Duplicate</span>
      </button>
      <button class="ll-context-item" data-action="refresh-favicon">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        <span>Refresh Favicon</span>
      </button>
      <div class="ll-context-divider"></div>
      <button class="ll-context-item ll-context-delete" data-action="delete">
        <svg class="ll-context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        <span>Delete Bookmark</span>
      </button>
    `;

    document.body.appendChild(menu);
    activeMenuEl = menu;

    // Viewport bounds handling
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;

    if (left + rect.width > window.innerWidth) {
      left = Math.max(10, window.innerWidth - rect.width - 10);
    }
    if (top + rect.height > window.innerHeight) {
      top = Math.max(10, window.innerHeight - rect.height - 10);
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Submenu handling
    const submenuToggle = menu.querySelector('[data-action="move-to-board-toggle"]');
    const submenu = menu.querySelector('.ll-context-submenu');
    if (submenuToggle && submenu) {
      submenuToggle.addEventListener('mouseenter', () => {
        submenu.style.display = 'block';
      });
      menu.querySelector('.ll-context-item-has-submenu').addEventListener('mouseleave', () => {
        submenu.style.display = 'none';
      });
      submenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
      });
    }

    // Action handlers
    menu.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.action;

      try {
        switch (action) {
          case 'open-new-tab':
            if (bookmark.url) window.open(bookmark.url, '_blank', 'noopener,noreferrer');
            closeBookmarkContextMenu();
            break;

          case 'copy-url':
            if (bookmark.url && navigator.clipboard) {
              await navigator.clipboard.writeText(bookmark.url);
              if (typeof showGlassToast === 'function') {
                showGlassToast('Link copied to clipboard!', 'success');
              }
            }
            closeBookmarkContextMenu();
            break;

          case 'edit':
            closeBookmarkContextMenu();
            if (typeof openEditBookmarkModal === 'function') {
              await openEditBookmarkModal(bookmarkId);
            }
            break;

          case 'move-to-board': {
            const targetBoardId = btn.dataset.targetBoard;
            if (targetBoardId && typeof updateBookmark === 'function') {
              await updateBookmark(bookmarkId, { boardId: targetBoardId });
              if (typeof loadBoardsFromDatabase === 'function') {
                await loadBoardsFromDatabase();
              }
              if (typeof showGlassToast === 'function') {
                showGlassToast('Moved bookmark to new board', 'success');
              }
            }
            closeBookmarkContextMenu();
            break;
          }

          case 'duplicate':
            if (typeof addBookmark === 'function') {
              await addBookmark({
                boardId: bookmark.boardId,
                title: `${bookmark.title || 'Bookmark'} (Copy)`,
                url: bookmark.url,
                description: bookmark.description || null,
                order: (bookmark.order || 0) + 1
              });
              if (typeof loadBoardsFromDatabase === 'function') {
                await loadBoardsFromDatabase();
              }
              if (typeof showGlassToast === 'function') {
                showGlassToast('Bookmark duplicated!', 'success');
              }
            }
            closeBookmarkContextMenu();
            break;

          case 'refresh-favicon': {
            const el = document.querySelector(`li[data-bookmark-id="${bookmarkId}"] .favicon`);
            if (el && bookmark.url) {
              const domain = new URL(bookmark.url).hostname;
              const newImg = new Image();
              newImg.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
              el.innerHTML = '';
              el.appendChild(newImg);
              if (typeof showGlassToast === 'function') {
                showGlassToast('Favicon refreshed', 'info');
              }
            }
            closeBookmarkContextMenu();
            break;
          }

          case 'delete':
            closeBookmarkContextMenu();
            if (typeof showDeleteConfirmation === 'function') {
              await showDeleteConfirmation(bookmark.title, 'bookmark', bookmarkId);
            } else if (typeof deleteBookmark === 'function') {
              await deleteBookmark(bookmarkId);
              if (typeof loadBoardsFromDatabase === 'function') {
                await loadBoardsFromDatabase();
              }
            }
            break;
        }
      } catch (err) {
        console.error('[BookmarkContextMenu] Action failed:', err);
      }
    });
  }

  // Global listeners to attach right-click and dismiss
  document.addEventListener('contextmenu', (e) => {
    const bookmarkItem = e.target.closest('li[data-bookmark-id]');
    if (bookmarkItem) {
      e.preventDefault();
      const bookmarkId = bookmarkItem.dataset.bookmarkId;
      openBookmarkContextMenu(bookmarkId, e.clientX, e.clientY);
    } else {
      closeBookmarkContextMenu();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (activeMenuEl && !activeMenuEl.contains(e.target)) {
      closeBookmarkContextMenu();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBookmarkContextMenu();
  });

  window.addEventListener('scroll', closeBookmarkContextMenu, !0);

  function escapeHtml(str) {
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

  window.LumiListBookmarkContext = {
    openBookmarkContextMenu,
    closeBookmarkContextMenu
  };
})(window);
