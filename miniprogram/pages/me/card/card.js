// pages/me/card/card.js
Page({
  data: {
    loading: false,
    card: null,
    status: '',
  },

  onLoad() {
    this.fetchCard();
  },

  fetchCard() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'alumniCard',
        data: {
          action: 'getMyCard',
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          this.setData({ status: result.status || 'error' });
          return;
        }
        this.setData({
          card: result.card || null,
          status: result.status || 'ok',
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
        this.setData({ status: 'error' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
});

