// pages/me/points/points.js
Page({
  data: {
    balance: 0,
    logs: [],
  },

  onShow() {
    this.fetchInfo();
  },

  fetchInfo() {
    wx.cloud
      .callFunction({
        name: 'points',
        data: {
          action: 'getInfo',
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({
          balance: result.balance || 0,
          logs: result.logs || [],
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  onGoRedeem() {
    wx.showToast({ title: '积分兑换稍后接入', icon: 'none' });
  },
});

