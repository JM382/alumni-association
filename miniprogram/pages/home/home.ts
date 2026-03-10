// pages/home/home.ts
Page({
  data: {
    bannerList: [
      {
        value: '/images/placeholder.png',
        ariaLabel: '校庆返校日 · 校友专属福利季',
      },
      {
        value: '/images/placeholder.png',
        ariaLabel: '母校最新动态',
      },
      {
        value: '/images/placeholder.png',
        ariaLabel: '合作福利推广',
      },
    ],
    shortcuts: [
      { key: 'card', label: '电子校友卡', icon: 'creditcard' },
      { key: 'book', label: '返校预约', icon: 'calendar' },
      { key: 'benefit', label: '校友福利', icon: 'gift' },
      { key: 'donate', label: '捐赠通道', icon: 'heart' },
      { key: 'enterprise', label: '校友企业', icon: 'shop' },
      { key: 'network', label: '校友联谊', icon: 'usergroup' },
      { key: 'resource', label: '校友资源', icon: 'file' },
      { key: 'expert', label: '专家资源', icon: 'user' },
    ],
    feedList: [
      {
        id: '1',
        category: '校友故事',
        title: '"从校园到世界 500 强" · 计算机学院 2010 级校友访谈',
        time: '2 小时前 · 校友会',
        views: '1,023',
        thumb: '/images/placeholder.png',
      },
      {
        id: '2',
        category: '校友企业招聘',
        title: '校友企业春季招聘 · 互联网 & 金融专场',
        time: '今天 19:00 线上',
        views: '356',
        thumb: '/images/placeholder.png',
      },
      {
        id: '3',
        category: '校友福利',
        title: '南航 · 校友专属机票优惠通道正式开启',
        time: '截止 6 月 30 日',
        views: '892',
        thumb: '/images/placeholder.png',
      },
    ],
  },

  onShortcutTap(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key as string
    const shortcuts = this.data.shortcuts
    const item = shortcuts.find((s) => s.key === key)
    if (key === 'benefit' || key === 'book' || key === 'donate') {
      wx.switchTab({ url: '/pages/services/services' })
    } else if (key === 'card') {
      wx.showToast({ title: '电子校友卡', icon: 'none' })
    } else {
      wx.showToast({ title: item?.label || '功能开发中', icon: 'none' })
    }
  },

  onFeedTap(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/news-detail/news-detail?id=${id}` })
  },
})
