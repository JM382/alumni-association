// pages/news-detail/news-detail.ts

function parseCreatedAt(createdAt: unknown): Date {
  if (!createdAt) return new Date()
  if (createdAt instanceof Date) return createdAt
  const o = createdAt as { $date?: string }
  if (o && typeof o === 'object' && o.$date) return new Date(o.$date)
  if (typeof createdAt === 'string' || typeof createdAt === 'number') return new Date(createdAt)
  return new Date()
}

Page({
  data: {
    newsId: '',
    canDelete: false,
    deleting: false,
    loading: true,
    loadError: '',
    liked: false,
    collected: false,
    detail: {
      title: '',
      source: '',
      date: '',
      cover: '/images/placeholder.png',
      content: '',
      likes: 0,
      collects: 0,
      comments: [] as Array<{ id: string; user: string; time: string; content: string }>,
    },
  },

  async onLoad(options: { id?: string }) {
    const raw = options?.id || ''
    const id = raw ? decodeURIComponent(raw) : ''
    if (!id) {
      this.setData({ loading: false, loadError: '缺少资讯参数' })
      return
    }
    this.setData({ newsId: id, canDelete: false })

    if (!wx.cloud) {
      this.setData({ loading: false, loadError: '当前环境不支持云开发' })
      return
    }

    this.setData({ loading: true, loadError: '' })

    const applyDoc = (item: Record<string, unknown>, opts?: { canDelete?: boolean }) => {
      const d = parseCreatedAt(item.createdAt)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const views = Number(item.views ?? 0)
      const commentCount = Number(item.comments ?? 0)
      this.setData({
        loading: false,
        loadError: '',
        canDelete: opts?.canDelete ?? false,
        detail: {
          title: (item.title as string) || '未命名资讯',
          source: `${(item.category as string) || '校友故事'} · 校友投稿`,
          date,
          cover: (item.cover as string) || '/images/placeholder.png',
          content: (item.content as string) || '',
          likes: views,
          collects: commentCount,
          comments: [],
        },
      })
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getNewsDetail',
        data: { id },
      })
      const result = res.result as {
        success?: boolean
        detail?: Record<string, unknown>
        isMine?: boolean
      }
      if (result?.success && result.detail) {
        applyDoc(result.detail, { canDelete: !!result.isMine })
        return
      }
    } catch (e) {
      console.error('getNewsDetail', e)
    }

    try {
      const db = wx.cloud.database()
      const doc = await db.collection('news_posts').doc(id).get()
      const data = doc.data as Record<string, unknown> | undefined
      if (!data) {
        // fall through to error
      } else if (data.status === 'scheduled' && data.publishAt) {
        const pt = parseCreatedAt(data.publishAt).getTime()
        if (pt > Date.now()) {
          this.setData({ loading: false, loadError: '内容未到发布时间' })
          return
        }
        let canDelete = false
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'login' })
          const myOpenid = (loginRes.result as { openid?: string })?.openid
          canDelete = !!(myOpenid && data._openid === myOpenid)
        } catch (e) {
          console.error('login', e)
        }
        applyDoc(data, { canDelete })
        return
      } else if (!data.status || data.status === 'published') {
        let canDelete = false
        try {
          const loginRes = await wx.cloud.callFunction({ name: 'login' })
          const myOpenid = (loginRes.result as { openid?: string })?.openid
          canDelete = !!(myOpenid && data._openid === myOpenid)
        } catch (e) {
          console.error('login', e)
        }
        applyDoc(data, { canDelete })
        return
      }
    } catch (e) {
      console.error('news_posts doc get', e)
    }

    this.setData({
      loading: false,
      loadError: '资讯加载失败，请检查云函数是否已部署或数据库权限',
    })
  },

  onLike() {
    this.setData({ liked: !this.data.liked })
  },

  onCollect() {
    this.setData({ collected: !this.data.collected })
  },

  async onDeleteNews() {
    if (this.data.deleting) return
    const id = this.data.newsId
    if (!id) {
      return
    }
    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持', icon: 'none' })
      return
    }
    const modal = await wx.showModal({ title: '删除资讯', content: '删除后不可恢复，确定删除？' })
    if (!modal.confirm) return
    this.setData({ deleting: true })
    try {
      const res = await wx.cloud.callFunction({ name: 'deleteNewsPost', data: { id } })
      const result = res.result as { success?: boolean; errMsg?: string }
      if (!result?.success) {
        wx.showToast({ title: result?.errMsg || '删除失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      console.error('deleteNewsPost', e)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      this.setData({ deleting: false })
    }
  },

  onShareAppMessage() {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1] as WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>
    const id = (cur.options && cur.options.id) || ''
    const q = id ? `?id=${encodeURIComponent(String(id))}` : ''
    return {
      title: this.data.detail.title || '新闻资讯',
      path: `/pages/news-detail/news-detail${q}`,
    }
  },
})
