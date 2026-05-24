// pages/news/news.ts
const TAB_TO_CATEGORY: Record<string, string> = {
  school: '母校新闻',
  notice: '校友会通知',
  industry: '行业动态',
  story: '校友故事',
  policy: '政策资讯',
}

Page({
  data: {
    activeCategory: 'all',
    newsList: [] as Array<Record<string, unknown>>,
    allNews: [] as Array<Record<string, unknown>>,
  },

  onLoad() {
    this.loadNews()
  },

  onShow() {
    this.loadNews()
  },

  async loadNews() {
    if (!wx.cloud) {
      this.setData({ allNews: [] }, () => this.applyFilter())
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'listNewsPosts' })
      const result = res.result as { list?: Array<Record<string, any>> }
      const cloudNews = (result?.list || []).map((item) => {
        const d = item.createdAt && item.createdAt.$date ? new Date(item.createdAt.$date) : new Date()
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return {
          id: item._id,
          category: item.category || '校友故事',
          title: item.title || '未命名资讯',
          summary: item.summary || '',
          date,
          views: String(item.views || 0),
          comments: String(item.comments || 0),
          thumb: item.cover || '/images/placeholder.png',
          isMine: !!item.isMine,
        }
      })
      this.setData({ allNews: cloudNews }, () => this.applyFilter())
    } catch (e) {
      console.error('listNewsPosts', e)
      this.setData({ allNews: [] }, () => this.applyFilter())
    }
  },

  onCategoryChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeCategory: e.detail.value }, () => this.applyFilter())
  },

  applyFilter() {
    const active = this.data.activeCategory
    const all = this.data.allNews as Array<Record<string, any>>
    if (active === 'all') {
      this.setData({ newsList: all })
      return
    }
    const category = TAB_TO_CATEGORY[active]
    this.setData({
      newsList: all.filter((item) => item.category === category),
    })
  },

  onNewsTap(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id
    const q = id != null && id !== '' ? `?id=${encodeURIComponent(String(id))}` : ''
    wx.navigateTo({ url: `/pages/news-detail/news-detail${q}` })
  },

  onPublish() {
    wx.navigateTo({ url: '/pages/news-publish/news-publish' })
  },

  async onDeleteNews(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持', icon: 'none' })
      return
    }
    const modal = await wx.showModal({ title: '删除资讯', content: '删除后不可恢复，确定删除？' })
    if (!modal.confirm) return
    try {
      const res = await wx.cloud.callFunction({ name: 'deleteNewsPost', data: { id } })
      const result = res.result as { success?: boolean; errMsg?: string }
      if (!result?.success) {
        wx.showToast({ title: result?.errMsg || '删除失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadNews()
    } catch (err) {
      console.error('deleteNewsPost', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },
})
