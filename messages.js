// ECHOES - Messagerie privée (DM) temps réel
(function(){
  let supabase;
  let currentUser;
  let conversations = [];
  let activeConversationId = null;
  let realtimeChannel = null;

  async function getClient() {
    if (!window.getSupabase) throw new Error('Supabase non initialisé');
    return await window.getSupabase();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  function byNewestMessageDesc(a, b) {
    const ta = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
    const tb = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
    return tb - ta;
  }

  async function ensureConversationWith(userIdB) {
    // Find existing conversation with exactly two participants: currentUser and userIdB
    // Step 1: get all conversation_ids where current user participates
    const { data: myRows, error: e1 } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUser.id);
    if (e1) throw e1;
    const convIds = (myRows || []).map(r => r.conversation_id);
    if (convIds.length > 0) {
      const { data: candidates, error: e2 } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds);
      if (e2) throw e2;
      const grouped = new Map();
      for (const row of candidates || []) {
        const arr = grouped.get(row.conversation_id) || [];
        arr.push(row.user_id);
        grouped.set(row.conversation_id, arr);
      }
      for (const [cid, users] of grouped.entries()) {
        const set = new Set(users);
        if (set.size === 2 && set.has(currentUser.id) && set.has(userIdB)) {
          return cid;
        }
      }
    }
    // Create new conversation and add participants
    const { data: conv, error: e3 } = await supabase
      .from('conversations')
      .insert({ is_group: false })
      .select('id')
      .single();
    if (e3) throw e3;
    const cid = conv.id;
    const { error: e4 } = await supabase.from('conversation_participants').insert([
      { conversation_id: cid, user_id: currentUser.id },
      { conversation_id: cid, user_id: userIdB }
    ]);
    if (e4) throw e4;
    return cid;
  }

  async function fetchConversations() {
    // Get my participations
    const { data: parts, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', currentUser.id);
    if (error) throw error;
    const ids = (parts || []).map(p => p.conversation_id);
    if (ids.length === 0) return [];

    // For each conversation, get other participants profiles
    const { data: otherParts, error: e2 } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user:profiles(id, username, full_name, avatar_url)')
      .in('conversation_id', ids)
      .neq('user_id', currentUser.id);
    if (e2) throw e2;

    // Build map convId -> target user (first)
    const byConv = new Map();
    for (const row of otherParts || []) {
      const arr = byConv.get(row.conversation_id) || [];
      arr.push(row.user);
      byConv.set(row.conversation_id, arr);
    }

    // Fetch last message per conversation (N+1)
    const results = [];
    for (const cid of ids) {
      const { data: lm } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const participants = byConv.get(cid) || [];
      const myPart = (parts || []).find(p => p.conversation_id === cid);
      results.push({
        id: cid,
        participants,
        last_message: lm || null,
        last_read_at: myPart?.last_read_at || null
      });
    }
    results.sort(byNewestMessageDesc);
    return results;
  }

  function renderConversationRow(conv) {
    const user = (conv.participants && conv.participants[0]) || {};
    const fullName = user.full_name || user.username || 'Utilisateur';
    const avatar = user.avatar_url || 'images/default-profil.jpg';
    const preview = conv.last_message?.content || '';
    const time = conv.last_message?.created_at ? formatTime(new Date(conv.last_message.created_at)) : '';
    const unread = conv.last_read_at && conv.last_message?.created_at ? (new Date(conv.last_message.created_at) > new Date(conv.last_read_at)) : false;
    const unreadClass = unread ? 'font-semibold' : '';
    return `
      <a href="#" class="conversation-item" data-conv-id="${conv.id}">
        <img src="${avatar}" alt="${escapeHtml(fullName)}" class="w-12 h-12 rounded-full">
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center">
            <h3 class="font-medium truncate ${unreadClass}">${escapeHtml(fullName)}</h3>
            <span class="text-xs opacity-75 ml-2">${escapeHtml(time)}</span>
          </div>
          <p class="text-sm opacity-75 truncate ${unreadClass}">${escapeHtml(preview)}</p>
        </div>
      </a>
    `;
  }

  function formatTime(date) {
    // hh:mm if today, else dd/MM
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  }

  function renderConversationsList() {
    const listEl = document.getElementById('conversations');
    const emptyEl = document.getElementById('conversations-empty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!conversations.length) {
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    const frag = document.createDocumentFragment();
    for (const conv of conversations) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderConversationRow(conv);
      frag.appendChild(wrapper.firstElementChild);
    }
    listEl.appendChild(frag);
    if (window.feather) feather.replace();
  }

  function applySearch() {
    const listEl = document.getElementById('conversations');
    const input = document.getElementById('messages-search');
    if (!listEl || !input) return;
    const q = (input.value || '').toLowerCase().trim();
    const items = Array.from(listEl.querySelectorAll('.conversation-item'));
    let visible = 0;
    for (const item of items) {
      const name = item.querySelector('h3')?.textContent?.toLowerCase() || '';
      const show = !q || name.includes(q);
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    const emptyEl = document.getElementById('conversations-empty');
    if (emptyEl) emptyEl.style.display = visible === 0 ? '' : 'none';
  }

  function bindListHandlers() {
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.conversation-item[data-conv-id]');
      if (!item) return;
      e.preventDefault();
      const cid = item.getAttribute('data-conv-id');
      openConversation(cid);
    });

    const input = document.getElementById('messages-search');
    if (input) input.addEventListener('input', applySearch);

    const newBtn = document.getElementById('new-message-btn');
    if (newBtn) newBtn.addEventListener('click', startNewMessageFlow);
  }

  async function openConversation(conversationId) {
    activeConversationId = conversationId;
    await updateLastRead(conversationId);
    await loadThread(conversationId);
    // Update header
    const conv = conversations.find(c => c.id === conversationId);
    const user = conv?.participants?.[0] || {};
    const avatar = user.avatar_url || 'images/default-profil.jpg';
    const name = user.full_name || user.username || 'Conversation';
    const headerName = document.getElementById('chat-header-name');
    const headerAvatar = document.getElementById('chat-header-avatar');
    const headerSub = document.getElementById('chat-header-sub');
    if (headerName) headerName.textContent = name;
    if (headerAvatar) headerAvatar.src = avatar;
    if (headerSub) headerSub.textContent = '';
  }

  async function updateLastRead(conversationId) {
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUser.id);
  }

  async function loadThread(conversationId) {
    const messagesEl = document.getElementById('chat-messages');
    const emptyEl = document.getElementById('chat-empty');
    if (!messagesEl) return;
    if (emptyEl) emptyEl.style.display = 'none';
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Erreur chargement thread:', error);
      return;
    }
    // Batch fetch sender profiles
    const ids = Array.from(new Set((data || []).map(m => m.sender_id)));
    let profilesMap = new Map();
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ids);
      for (const p of profs || []) profilesMap.set(p.id, p);
    }
    messagesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const msg of data || []) {
      const wrapper = document.createElement('div');
      const sender = profilesMap.get(msg.sender_id);
      const hydrated = { ...msg, senderProfile: sender };
      wrapper.innerHTML = renderMessageBubble(hydrated);
      frag.appendChild(wrapper.firstElementChild);
    }
    messagesEl.appendChild(frag);
    scrollMessagesToBottom();
  }

  function renderMessageBubble(msg) {
    const mine = msg.sender_id === currentUser.id;
    const name = msg.senderProfile?.full_name || msg.senderProfile?.username || (mine ? 'Moi' : 'Utilisateur');
    const avatar = msg.senderProfile?.avatar_url || 'images/default-profil.jpg';
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[80%] flex ${mine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2">
          <img src="${avatar}" alt="${escapeHtml(name)}" class="w-7 h-7 rounded-full">
          <div class="${mine ? 'bg-blue-600' : 'bg-dark-secondary bg-opacity-30'} rounded-2xl px-3 py-2">
            <p class="text-sm">${escapeHtml(msg.content)}</p>
            <p class="text-[10px] opacity-60 mt-1">${escapeHtml(time)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function scrollMessagesToBottom() {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function bindComposer() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (!input || !sendBtn) return;
    sendBtn.addEventListener('click', () => sendCurrentMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  async function sendCurrentMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !activeConversationId) return;
    const content = (input.value || '').trim();
    if (!content) return;
    input.value = '';
    const { error } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConversationId, sender_id: currentUser.id, content });
    if (error) {
      console.error('Erreur envoi message:', error);
    } else {
      await updateLastRead(activeConversationId);
    }
  }

  function subscribeRealtime() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    realtimeChannel = supabase
      .channel('dm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        // If the message is in my conversations, refresh list and possibly thread
        if (conversations.some(c => c.id === msg.conversation_id)) {
          // update thread
          if (activeConversationId === msg.conversation_id) {
            const messagesEl = document.getElementById('chat-messages');
            if (messagesEl) {
              const wrapper = document.createElement('div');
              // fetch sender profile for rendering
              const { data: sender } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url')
                .eq('id', msg.sender_id)
                .single();
              const hydrated = { ...msg, sender };
              wrapper.innerHTML = renderMessageBubble(hydrated);
              messagesEl.appendChild(wrapper.firstElementChild);
              scrollMessagesToBottom();
            }
            await updateLastRead(activeConversationId);
          }
          // refresh list meta (last_message)
          await refreshConversations();
        }
      })
      .subscribe();
  }

  async function refreshConversations() {
    conversations = await fetchConversations();
    renderConversationsList();
    applySearch();
  }

  async function startNewMessageFlow() {
    const username = prompt('Nom d\'utilisateur du destinataire (username) :');
    if (!username) return;
    const { data: target, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .ilike('username', username)
      .single();
    if (error || !target) {
      alert('Utilisateur introuvable');
      return;
    }
    if (target.id === currentUser.id) {
      alert('Vous ne pouvez pas démarrer une conversation avec vous-même.');
      return;
    }
    const cid = await ensureConversationWith(target.id);
    await refreshConversations();
    await openConversation(cid);
  }

  async function init(){
    supabase = await getClient();
    const res = await supabase.auth.getUser();
    currentUser = res?.data?.user;
    if (!currentUser) return;
    // Set header profile avatar
    try {
      const { data: me } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', currentUser.id)
        .single();
      const el = document.getElementById('header-profile-avatar');
      if (el && me?.avatar_url) el.src = me.avatar_url;
    } catch(_) {}
    await refreshConversations();
    bindListHandlers();
    bindComposer();
    subscribeRealtime();

    // Handle deep-linking: ?cid=<conversation_id> or ?to=<user_id>
    try {
      const url = new URL(window.location.href);
      const cidParam = url.searchParams.get('cid');
      const toParam = url.searchParams.get('to');
      if (cidParam) {
        // If conversation exists in list, open it; else attempt to load thread anyway
        const exists = conversations.some(c => c.id === cidParam);
        if (!exists) {
          // silently try: set active and load thread
          activeConversationId = cidParam;
          await loadThread(cidParam);
        } else {
          await openConversation(cidParam);
        }
      } else if (toParam) {
        const cid = await ensureConversationWith(toParam);
        await refreshConversations();
        await openConversation(cid);
      }
    } catch(_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
