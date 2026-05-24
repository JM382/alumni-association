// pages/chat/chat.js
Page({
  data: {
    conversationId: '',
    targetUserId: '',
    myUserId: '',
    myAvatarUrl: '',
    targetAvatarUrl: '',
    messages: [],
    page: 1,
    pageSize: 20,
    loading: false,
    sending: false,
    input: '',
  },

  onLoad(options) {
    const conversationId = (options && options.conversationId) || '';
    const targetUserId = (options && options.targetUserId) || '';
    const targetName = (options && options.targetName) || '';
    const targetAvatarUrl = (options && options.targetAvatarUrl) || '';
    if (!conversationId) {
      wx.showToast({ title: '缺少会话参数', icon: 'none' });
      return;
    }
    if (targetName) {
      let title = targetName;
      try {
        title = decodeURIComponent(targetName);
      } catch (e) {}
      wx.setNavigationBarTitle({ title });
    }
    this.setData({
      conversationId,
      targetUserId,
      targetAvatarUrl: this.sanitizeAvatarUrl(targetAvatarUrl),
    });
    this.loadMyUserId();
    this.fetchMessages(true);
    this.markRead();
  },

  sanitizeAvatarUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const s = url.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('cloud://') || s.startsWith('/')) {
      return s;
    }
    return '';
  },

  loadMyUserId() {
    wx.cloud
      .callFunction({ name: 'getUserInfo' })
      .then((res) => {
        const data = (res.result && res.result.data) || {};
        if (data && data.user_id) {
          this.setData({
            myUserId: data.user_id,
            myAvatarUrl: this.sanitizeAvatarUrl(data.avatarUrl || ''),
          });
        }
      })
      .catch(() => {});
  },

  markRead() {
    const { conversationId } = this.data;
    wx.cloud
      .callFunction({
        name: 'social',
        data: { action: 'markRead', conversationId },
      })
      .catch(() => {});
  },

  fetchMessages(reset) {
    const { conversationId, page, pageSize, loading } = this.data;
    if (loading) return;
    const nextPage = reset ? 1 : page;

    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'listMessages',
          conversationId,
          page: nextPage,
          pageSize,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = result.list || [];
        // 云端是 createdAt desc，这里翻转成时间正序显示
        list.reverse();
        const merged = reset ? list : list.concat(this.data.messages);
        this.setData({
          messages: merged,
          page: nextPage + 1,
        });
        // 进入后滚到底部
        setTimeout(() => {
          wx.pageScrollTo({ scrollTop: 999999, duration: 0 });
        }, 50);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  onPullDownRefresh() {
    // 上拉历史（这里用下拉代替）
    this.fetchMessages(false);
    wx.stopPullDownRefresh();
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onSend() {
    if (this.data.sending) return;
    const text = (this.data.input || '').trim();
    if (!text) return;

    const { conversationId, targetUserId } = this.data;
    if (!targetUserId) {
      wx.showToast({ title: '缺少对方用户', icon: 'none' });
      return;
    }

    this.setData({ sending: true });
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'sendMessage',
          conversationId,
          toUserId: targetUserId,
          contentType: 'text',
          text,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发送失败', icon: 'none' });
          return;
        }
        const msg = result.message;
        const next = this.data.messages.concat([msg]);
        this.setData({ messages: next, input: '' });
        setTimeout(() => {
          wx.pageScrollTo({ scrollTop: 999999, duration: 0 });
        }, 50);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发送失败', icon: 'none' });
      })
      .finally(() => this.setData({ sending: false }));
  },
});

