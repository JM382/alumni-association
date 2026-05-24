// pages/circle/interactions/interactions.js
Page({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    this.fetchList();
    // 进入页面即标记全部已读（不影响历史记录）
    wx.cloud.callFunction({
      name: 'notifications',
      data: { action: 'markRead', notificationId: 'all' },
    }).catch(() => {});
  },

  fetchList() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'notifications',
        data: {
          action: 'listInteractions',
          page: 1,
          pageSize: 50,
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
      .finally(() => this.setData({ loading: false }));
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },
});

