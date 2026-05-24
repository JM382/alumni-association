// pages/news-publish/news-publish.ts

const NEWS_PUBLISH_DRAFT_STORAGE_KEY = 'news_publish_draft_v1'

type NewsPublishDraft = {
  version: 1
  savedAt: number
  form: { title: string; content: string }
  files: { url: string }[]
  categoryIndex: number
  pinned: boolean
  banner: boolean
  scheduleEnabled: boolean
  publishDate: string
  publishTime: string
}

function formatDraftTime(ms: number): string {
  const d = new Date(ms)
  const M = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${M}月${day}日 ${h}:${m}`
}

function readDraftFromStorage(): NewsPublishDraft | null {
  try {
    const raw = wx.getStorageSync(NEWS_PUBLISH_DRAFT_STORAGE_KEY) as string
    if (!raw || typeof raw !== 'string') return null
    const o = JSON.parse(raw) as Partial<NewsPublishDraft>
    if (o.version !== 1 || !o.form || typeof o.form !== 'object') return null
    return {
      version: 1,
      savedAt: typeof o.savedAt === 'number' ? o.savedAt : Date.now(),
      form: {
        title: typeof o.form.title === 'string' ? o.form.title : '',
        content: typeof o.form.content === 'string' ? o.form.content : '',
      },
      files: Array.isArray(o.files) ? o.files.filter((f): f is { url: string } => f && typeof (f as { url?: string }).url === 'string') : [],
      categoryIndex: typeof o.categoryIndex === 'number' && o.categoryIndex >= 0 ? o.categoryIndex : 0,
      pinned: !!o.pinned,
      banner: !!o.banner,
      scheduleEnabled: !!o.scheduleEnabled,
      publishDate: typeof o.publishDate === 'string' ? o.publishDate : '',
      publishTime: typeof o.publishTime === 'string' ? o.publishTime : '12:00',
    }
  } catch {
    return null
  }
}

function readSwitchValue(e: WechatMiniprogram.CustomEvent): boolean {
  const d = e.detail as unknown
  if (typeof d === 'boolean') return d
  if (d && typeof d === 'object' && 'value' in (d as object)) {
    return !!(d as { value: boolean }).value
  }
  return false
}

Page({
  data: {
    files: [] as { url: string }[],
    gridConfig: { column: 4 },
    form: {
      title: '',
      content: '',
    },
    submitting: false,
    categoryOptions: ['校友故事', '母校新闻', '校友会通知', '行业动态', '政策资讯'],
    categoryIndex: 0,
    pinned: false,
    banner: false,
    scheduleEnabled: false,
    publishDate: '',
    publishTime: '12:00',
    today: '',
  },

  onLoad() {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    this.setData({ today })
    this.tryRestoreDraft()
  },

  tryRestoreDraft() {
    const draft = readDraftFromStorage()
    if (!draft) return
    const hasBody =
      draft.form.title.trim().length > 0 ||
      draft.form.content.trim().length > 0 ||
      (draft.files && draft.files.length > 0)
    if (!hasBody) return

    const categoryOptions = this.data.categoryOptions
    let categoryIndex = draft.categoryIndex
    if (categoryIndex >= categoryOptions.length) categoryIndex = 0

    wx.showModal({
      title: '发现草稿',
      content: `上次保存于 ${formatDraftTime(draft.savedAt)}，是否恢复编辑内容？`,
      confirmText: '恢复',
      cancelText: '丢弃',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            form: { ...draft.form },
            files: draft.files.length > 0 ? [...draft.files] : [],
            categoryIndex,
            pinned: draft.pinned,
            banner: draft.banner,
            scheduleEnabled: draft.scheduleEnabled,
            publishDate: draft.publishDate,
            publishTime: draft.publishTime || '12:00',
          })
        } else {
          wx.removeStorageSync(NEWS_PUBLISH_DRAFT_STORAGE_KEY)
        }
      },
    })
  },

  onUploadSuccess(e: WechatMiniprogram.CustomEvent) {
    const { files } = e.detail
    this.setData({ files: files || [] })
  },

  onUploadRemove(e: WechatMiniprogram.CustomEvent) {
    const { index } = e.detail
    const files = [...this.data.files]
    files.splice(index, 1)
    this.setData({ files })
  },

  onSaveDraft() {
    const { form, files, categoryIndex, pinned, banner, scheduleEnabled, publishDate, publishTime } = this.data
    const empty =
      !form.title.trim() &&
      !form.content.trim() &&
      (!files || files.length === 0)
    if (empty) {
      wx.showToast({ title: '请先填写标题或正文再保存', icon: 'none' })
      return
    }

    const draft: NewsPublishDraft = {
      version: 1,
      savedAt: Date.now(),
      form: { title: form.title, content: form.content },
      files: (files || []).map((f) => ({ url: f.url })),
      categoryIndex,
      pinned,
      banner,
      scheduleEnabled,
      publishDate: publishDate || '',
      publishTime: publishTime || '12:00',
    }

    try {
      wx.setStorageSync(NEWS_PUBLISH_DRAFT_STORAGE_KEY, JSON.stringify(draft))
      wx.showToast({ title: '草稿已保存', icon: 'success' })
    } catch (e) {
      console.error('save draft', e)
      wx.showToast({ title: '保存失败，存储空间不足？', icon: 'none' })
    }
  },

  onTitleChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.title': e.detail.value || '' })
  },

  onContentChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.content': e.detail.value || '' })
  },

  onCategoryChange(e: WechatMiniprogram.CustomEvent) {
    const idx = Number((e.detail as { value?: string }).value ?? 0)
    this.setData({ categoryIndex: idx })
  },

  onPinnedChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ pinned: readSwitchValue(e) })
  },

  onBannerChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ banner: readSwitchValue(e) })
  },

  onScheduleEnabledChange(e: WechatMiniprogram.CustomEvent) {
    const v = readSwitchValue(e)
    this.setData({ scheduleEnabled: v })
    if (v && !this.data.publishDate) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const publishDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      this.setData({ publishDate })
    }
  },

  onPublishDateChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ publishDate: e.detail.value || '' })
  },

  onPublishTimeChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ publishTime: e.detail.value || '12:00' })
  },

  async onSubmit() {
    const title = this.data.form.title.trim()
    const content = this.data.form.content.trim()
    if (!title || title.length < 5) {
      wx.showToast({ title: '标题至少 5 个字', icon: 'none' })
      return
    }
    if (!content || content.length < 10) {
      wx.showToast({ title: '正文至少 10 个字', icon: 'none' })
      return
    }

    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持云开发', icon: 'none' })
      return
    }

    const category = this.data.categoryOptions[this.data.categoryIndex]
    let publishAtMs: number | null = null

    if (this.data.scheduleEnabled) {
      const dateStr = this.data.publishDate
      const timeStr = this.data.publishTime || '12:00'
      if (!dateStr) {
        wx.showToast({ title: '请选择发布日期', icon: 'none' })
        return
      }
      const [y, mo, da] = dateStr.split('-').map((n) => parseInt(n, 10))
      const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10))
      const when = new Date(y, mo - 1, da, hh || 0, mm || 0, 0, 0)
      publishAtMs = when.getTime()
      if (publishAtMs <= Date.now()) {
        wx.showToast({ title: '定时发布请选择未来时间', icon: 'none' })
        return
      }
    }

    this.setData({ submitting: true })
    try {
      const first = this.data.files[0] as { url?: string }
      const res = await wx.cloud.callFunction({
        name: 'createNewsPost',
        data: {
          category,
          title,
          content,
          cover: first?.url || '/images/placeholder.png',
          pinned: this.data.pinned,
          banner: this.data.banner,
          scheduleEnabled: this.data.scheduleEnabled,
          publishAtMs: publishAtMs != null ? publishAtMs : undefined,
        },
      })
      const result = res.result as { success?: boolean; errMsg?: string }
      if (!result?.success) {
        wx.showToast({ title: result?.errMsg || '提交失败', icon: 'none' })
        return
      }
      try {
        wx.removeStorageSync(NEWS_PUBLISH_DRAFT_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      wx.showToast({
        title: this.data.scheduleEnabled ? '已设置定时发布' : '发布成功',
        icon: 'success',
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 900)
    } catch (e) {
      console.error('createNewsPost', e)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
