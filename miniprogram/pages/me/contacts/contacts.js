// pages/me/contacts/contacts.js
Page({
  data: {
    loading: false,
    list: [],
  },

  onShow() {
    this.fetchContacts();
  },

  fetchContacts() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'listContacts',
          page: 1,
          pageSize: 100,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ list: result.list || [] });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },

  onStartChat(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'ensureConversation',
          targetUserId: userId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发起失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '会话已创建，聊天稍后接入', icon: 'none' });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发起失败', icon: 'none' });
      });
  },
});

