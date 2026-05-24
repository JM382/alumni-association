// pages/events/detail/detail.js
Page({
  data: {
    loading: false,
    eventId: '',
    event: null,
    hasSignedUp: false,
    signupId: '',
  },

  onLoad(options) {
    const eventId = (options && options.eventId) || '';
    if (!eventId) {
      wx.showToast({ title: '缺少活动参数', icon: 'none' });
      return;
    }
    this.setData({ eventId });
    this.fetchDetail();
    this.checkMySignup();
  },

  fetchDetail() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'getDetail', eventId: this.data.eventId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ event: result.data || null });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  checkMySignup() {
    const { eventId } = this.data;
    if (!eventId) return;
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'checkMySignup', eventId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) return;
        this.setData({
          hasSignedUp: !!result.hasSignedUp,
          signupId: result.signupId || '',
        });
      })
      .catch(() => {});
  },

  onGoTickets() {
    const { eventId, hasSignedUp, signupId } = this.data;
    if (!eventId) return;
    if (hasSignedUp && signupId) {
      wx.navigateTo({
        url: `/pages/events/my-detail/my-detail?signupId=${signupId}`,
      });
      return;
    }
    wx.navigateTo({ url: `/pages/events/tickets/tickets?eventId=${eventId}` });
  },
});

