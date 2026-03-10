// pages/news-publish/news-publish.ts
Page({
  data: {
    files: [] as { url: string }[],
    gridConfig: { column: 4 },
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
    wx.showToast({ title: '已保存草稿', icon: 'success' })
  },

  onSubmit() {
    wx.showToast({ title: '提交成功，等待审核', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  },
})
