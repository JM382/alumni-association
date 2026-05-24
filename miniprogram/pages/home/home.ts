// pages/home/home.ts
const DEFAULT_BANNERS = [
  { value: '/images/placeholder.png', ariaLabel: '校庆返校日 · 校友专属福利季', newsId: '' },
  { value: '/images/placeholder.png', ariaLabel: '母校最新动态', newsId: '' },
  { value: '/images/placeholder.png', ariaLabel: '合作福利推广', newsId: '' },
]

const HOME_FEED_LIMIT = 8

function parseNewsDate(createdAt: unknown): Date {
  if (!createdAt) return new Date()
  const o = createdAt as { $date?: string }
  if (o && typeof o === 'object' && o.$date) return new Date(o.$date)
  if (createdAt instanceof Date) return createdAt
  return new Date(createdAt as string | number)
}

function formatFeedViews(n: number): string {
  const v = Math.max(0, Math.floor(n))
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

Page({
  data: {
    userNickName: '',
    bannerList: DEFAULT_BANNERS,
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
    feedList: [] as Array<{
      id: string
      category: string
      title: string
      time: string
      views: string
      thumb: string
    }>,
  },

  onLoad() {
    this.loadHomeBanners()
    this.loadHomeFeed()
  },

  async loadHomeBanners() {
    if (!wx.cloud) return
    try {
      const res = await wx.cloud.callFunction({ name: 'getHomeBanners' })
      const result = res.result as { list?: Array<{ _id?: string; cover?: string; title?: string }> }
      const raw = result?.list || []
      if (raw.length === 0) {
        this.setData({ bannerList: DEFAULT_BANNERS })
        return
      }
      const bannerList = raw.map((item) => ({
        value: item.cover || '/images/placeholder.png',
        ariaLabel: item.title || '资讯推荐',
        newsId: item._id != null ? String(item._id) : '',
      }))
      this.setData({ bannerList })
    } catch (e) {
      console.error('getHomeBanners', e)
      this.setData({ bannerList: DEFAULT_BANNERS })
    }
  },

  async loadHomeFeed() {
    if (!wx.cloud) {
      this.setData({ feedList: [] })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'listNewsPosts' })
      const result = res.result as { list?: Array<Record<string, unknown>> }
      const raw = result?.list || []
      const feedList = raw.slice(0, HOME_FEED_LIMIT).map((item) => {
        const d = parseNewsDate(item.createdAt)
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const category = (item.category as string) || '校友故事'
        return {
          id: String(item._id),
          category,
          title: (item.title as string) || '未命名资讯',
          time: `${date} · ${category}`,
          views: formatFeedViews(Number(item.views ?? 0)),
          thumb: (item.cover as string) || '/images/placeholder.png',
        }
      })
      this.setData({ feedList })
    } catch (e) {
      console.error('listNewsPosts home', e)
      this.setData({ feedList: [] })
    }
  },

  onShortcutTap(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key as string
    const shortcuts = this.data.shortcuts
    const item = shortcuts.find((s) => s.key === key)
    if (key === 'benefit') {
      const app = getApp<IAppOption>()
      app.globalData.servicesInitialTab = 'benefit'
      wx.switchTab({ url: '/pages/services/services' })
    } else if (key === 'donate') {
      const app = getApp<IAppOption>()
      app.globalData.servicesInitialTab = 'donate'
      wx.switchTab({ url: '/pages/services/services' })
    } else if (key === 'book') {
      const app = getApp<IAppOption>()
      app.globalData.servicesInitialTab = 'return'
      wx.switchTab({ url: '/pages/services/services' })
    } else if (key === 'card') {
      wx.navigateTo({ url: '/pages/alumnicard/alumnicard' })
    } else {
      wx.showToast({ title: item?.label || '功能开发中', icon: 'none' })
    }
  },

  onBannerItemTap(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index
    const index = typeof idx === 'number' ? idx : Number(idx)
    const list = this.data.bannerList as Array<{ newsId?: string }>
    const item = !Number.isNaN(index) && list[index] ? list[index] : undefined
    const id = item?.newsId
    if (id) {
      wx.navigateTo({
        url: `/pages/news-detail/news-detail?id=${encodeURIComponent(String(id))}`,
      })
      return
    }
    wx.switchTab({ url: '/pages/news/news' })
  },

  onNewsMoreTap() {
    wx.switchTab({ url: '/pages/news/news' })
  },

  onFeedTap(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id
    const q = id != null && id !== '' ? `?id=${encodeURIComponent(String(id))}` : ''
    wx.navigateTo({ url: `/pages/news-detail/news-detail${q}` })
  },

  onUserNameTap() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onShow() {
    this.loadHomeBanners()
    this.loadHomeFeed()
    const app = getApp<IAppOption>()
    const nick = app.globalData.userNickName || wx.getStorageSync('userNickName') || ''
    if (this.data.userNickName !== nick) this.setData({ userNickName: nick })
  },
})
