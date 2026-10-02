// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

// Keep the chat DOM separate from board renders so typing and scroll position survive SSE updates.
export function createRoomChat(send) {
  const panel = document.querySelector('#room-chat');
  const list = document.querySelector('#chat-messages');
  const input = document.querySelector('#chat-input');
  const form = document.querySelector('#chat-form');
  const toggle = document.querySelector('#chat-toggle');
  const body = document.querySelector('#chat-body');
  const error = document.querySelector('#chat-error');
  let roomKey = null,
    lastId = 0,
    unread = 0,
    busy = false;
  function updateToggle() {
    toggle.textContent = body.hidden
      ? `展开聊天${unread ? ` · ${unread}条新消息` : ''}`
      : '收起聊天';
    toggle.setAttribute('aria-expanded', String(!body.hidden));
  }
  toggle.onclick = () => {
    body.hidden = !body.hidden;
    if (!body.hidden) {
      unread = 0;
      list.scrollTop = list.scrollHeight;
      input.focus();
    }
    updateToggle();
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy || !roomKey) return;
    const key = roomKey;
    busy = true;
    form.querySelector('button').disabled = true;
    error.textContent = '';
    try {
      await send(text);
      if (key === roomKey && input.value.trim() === text) input.value = '';
    } catch (e) {
      if (key === roomKey) error.textContent = e.message;
    } finally {
      if (key === roomKey) {
        busy = false;
        form.querySelector('button').disabled = false;
        input.focus();
      }
    }
  };
  return {
    beforeRender(app) {
      const focus =
        document.activeElement === input
          ? { start: input.selectionStart, end: input.selectionEnd }
          : null;
      // Preserve the actual input node while the board's parent markup is replaced.
      app.after(panel);
      return focus;
    },
    mount(app, focus) {
      const sidebar = app.querySelector('.side-panel');
      if (sidebar) sidebar.insertBefore(panel, sidebar.querySelector('.log-title'));
      if (focus && !panel.hidden && !body.hidden) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(focus.start, focus.end);
      }
    },
    setState(state, key) {
      panel.hidden = !state || !!state.roomClosed;
      if (key !== roomKey) {
        roomKey = key;
        list.replaceChildren();
        input.value = '';
        error.textContent = '';
        busy = false;
        form.querySelector('button').disabled = false;
        lastId = unread = 0;
        body.hidden = true;
      }
      if (!state) return;
      document.querySelector('#chat-members').textContent =
        `观战 ${state.spectatorCount || 0} 人 · ${state.role === 'spectator' ? '你是观众' : '你是玩家'}`;
      const messages = state.chat || [];
      const bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 32;
      for (const message of messages.filter((item) => item.id > lastId)) {
        const row = document.createElement('li');
        row.dataset.messageId = message.id;
        const name = document.createElement('strong');
        name.textContent = `${message.name} · ${message.role === 'spectator' ? '观众' : `玩家${message.player + 1}`}`;
        const content = document.createElement('p');
        content.textContent = message.text;
        row.append(name, content);
        list.append(row);
        unread++;
        lastId = message.id;
      }
      while (list.children.length > messages.length) list.firstElementChild.remove();
      if (!body.hidden && bottom) {
        list.scrollTop = list.scrollHeight;
        unread = 0;
      }
      updateToggle();
      form.hidden = !!state.roomClosed;
    },
  };
}
