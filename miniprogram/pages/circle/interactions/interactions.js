// pages/circle/interactions/interactions.js
const LOCAL_NOTIFICATION_KEY = 'notification_settings';

Page({
  data: {
    list: [],
    loading: false,
    notifyPrefs: {
      interactOn: true,
      vibrateOn: true,
    },
  },

  onShow() {
    this.loadNotifyPrefs();
    this.fetchList();
    // 进入页面即标记全部已读（不影响历史记录）
    wx.cloud.callFunction({
      name: 'notifications',
      data: { action: 'markRead', notificationId: 'all' },
    }).catch(() => {});
  },

  fetchList() {
    const prevUnread = (this.data.list || []).filter((item) => !item.isRead).length;
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
        const nextList = result.list || [];
        const nextUnread = nextList.filter((item) => !item.isRead).length;
        this.setData({ list: nextList });
        this.tryVibrateOnNewInteractions(prevUnread, nextUnread);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  loadNotifyPrefs() {
    let fromLocal = {};
    try {
      const raw = wx.getStorageSync(LOCAL_NOTIFICATION_KEY);
      if (raw && typeof raw === 'object') fromLocal = raw;
    } catch (e) {}
    this.setData({
      notifyPrefs: {
        interactOn: fromLocal.interactOn !== undefined ? !!fromLocal.interactOn : true,
        vibrateOn: fromLocal.vibrateOn !== undefined ? !!fromLocal.vibrateOn : true,
      },
    });
  },

  tryVibrateOnNewInteractions(prevUnread, nextUnread) {
    const prefs = this.data.notifyPrefs || {};
    if (!prefs.interactOn || !prefs.vibrateOn) return;
    if (nextUnread > prevUnread) {
      wx.vibrateShort({
        fail: () => {},
      });
    }
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },
});

