// pages/donate-initiate/donate-initiate.ts
Page({
  data: {
    form: {
      name: '',
      desc: '',
      targetYuan: '1000000',
    },
    submitting: false,
  },

  onNameChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.name': (e.detail as { value?: string }).value ?? '' })
  },

  onDescChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.desc': (e.detail as { value?: string }).value ?? '' })
  },

  onTargetYuanChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'form.targetYuan': (e.detail as { value?: string }).value ?? '' })
  },

  async onSaveProject() {
    const { name, desc, targetYuan } = this.data.form
    if (!String(name).trim()) {
      wx.showToast({ title: '请填写项目名称', icon: 'none' })
      return
    }
    const yuan = parseFloat(String(targetYuan).trim())
    if (!Number.isFinite(yuan) || yuan < 1) {
      wx.showToast({ title: '筹款目标至少 1 元', icon: 'none' })
      return
    }
    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持云开发', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'createDonationProject',
        data: {
          name: String(name).trim(),
          desc: String(desc).trim(),
          targetYuan: yuan,
        },
      })
      const result = res.result as { success?: boolean; errMsg?: string }
      if (!result?.success) {
        wx.showToast({ title: result?.errMsg || '保存失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ form: { name: '', desc: '', targetYuan: '1000000' } })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      console.error('onSaveProject', e)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
