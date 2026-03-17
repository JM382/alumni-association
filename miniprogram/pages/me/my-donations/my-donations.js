// pages/me/my-donations/my-donations.js
Page({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    this.fetchDonations();
  },

  fetchDonations() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'donations',
        data: {
          action: 'listMyDonations',
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
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onPreviewCert(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current || '';
    if (!urls.length) return;
    wx.previewImage({
      current: current || urls[0],
      urls,
    });
  },
});

