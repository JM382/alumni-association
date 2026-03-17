// pages/me/my-orders/my-orders.js
Page({
  data: {
    tabs: [
      { key: '', label: '全部' },
      { key: 'hotel', label: '酒店' },
      { key: 'flight', label: '机票' },
      { key: 'car', label: '租车' },
      { key: 'express', label: '快递' },
      { key: 'other', label: '其他' },
    ],
    currentTab: 0,
    list: [],
    loading: false,
  },

  onShow() {
    this.fetchOrders();
  },

  onChangeTab(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ currentTab: index }, () => {
      this.fetchOrders();
    });
  },

  fetchOrders() {
    const { tabs, currentTab } = this.data;
    const tab = tabs[currentTab] || tabs[0];
    const businessType = tab.key || '';

    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'orders',
        data: {
          action: 'listMyOrders',
          businessType,
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

  onTapOrder(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showToast({ title: '订单详情稍后接入', icon: 'none' });
  },

  onGoPartner(e) {
    const appId = e.currentTarget.dataset.appid;
    const path = e.currentTarget.dataset.path;
    if (!appId) {
      wx.showToast({ title: '暂不支持跳转', icon: 'none' });
      return;
    }
    wx.navigateToMiniProgram({
      appId,
      path: path || '',
      fail() {
        wx.showToast({ title: '跳转失败', icon: 'none' });
      },
    });
  },
});

