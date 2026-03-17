// 会员中心页

Page({
  data: {
    title: '会员中心',
    loading: false,
    creating: false,
    info: {
      level: 'none',
      isValid: false,
      expireAt: null,
      identity: 'visitor',
    },
    plans: [
      {
        key: 'vip_month',
        level: 'vip',
        name: 'VIP 月度会员',
        priceText: '￥19.99 / 月',
        desc: '解锁基础会员特权，适合轻度使用',
      },
      {
        key: 'svip_year',
        level: 'svip',
        name: 'SVIP 年度会员',
        priceText: '￥299 / 年',
        desc: '更划算的年度会员，享受全部高级特权',
        highlight: true,
      },
    ],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: this.data.title });
    this.fetchInfo();
  },

  onShow() {
    this.fetchInfo();
  },

  formatExpire(expireAt) {
    if (!expireAt) return '暂无';
    const d = new Date(expireAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  fetchInfo() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'membership',
        data: { action: 'getInfo' },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const info = result.data || {};
        this.setData({ info });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onBuyTap(e) {
    const planKey = e.currentTarget.dataset.key;
    const { identity } = this.data.info;

    if (identity !== 'alumni') {
      wx.showToast({ title: '仅校友可开通会员', icon: 'none' });
      return;
    }

    if (this.data.creating) return;
    this.setData({ creating: true });

    wx.cloud
      .callFunction({
        name: 'membership',
        data: {
          action: 'createOrder',
          planKey,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '开通失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '会员已开通', icon: 'success' });
        this.fetchInfo();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '开通失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ creating: false });
      });
  },
});
