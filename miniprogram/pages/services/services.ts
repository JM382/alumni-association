  // pages/services/services.ts
const app = getApp<IAppOption>()

/** 校园导览地图：国防科大长沙校区一号院一带示意坐标，请按本校实测在地图工具中拾取后替换 */
const CAMPUS_MAP_MARKER_ICON = '/images/placeholder.png'

const CAMPUS_MAP = {
  latitude: 28.2285,
  longitude: 112.9989,
  scale: 16,
  markers: [
    {
      id: 1,
      latitude: 28.229,
      longitude: 112.9985,
      width: 32,
      height: 32,
      iconPath: CAMPUS_MAP_MARKER_ICON,
      title: '教学楼',
      callout: {
        content: '教学楼 · 教学区',
        color: '#333333',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 8,
        display: 'BYCLICK',
      },
    },
    {
      id: 2,
      latitude: 28.2281,
      longitude: 112.9994,
      width: 32,
      height: 32,
      iconPath: CAMPUS_MAP_MARKER_ICON,
      title: '食堂',
      callout: {
        content: '食堂',
        color: '#333333',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 8,
        display: 'BYCLICK',
      },
    },
    {
      id: 3,
      latitude: 28.2292,
      longitude: 112.998,
      width: 32,
      height: 32,
      iconPath: CAMPUS_MAP_MARKER_ICON,
      title: '纪念馆',
      callout: {
        content: '纪念馆',
        color: '#333333',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 8,
        display: 'BYCLICK',
      },
    },
    {
      id: 4,
      latitude: 28.2278,
      longitude: 112.9992,
      width: 32,
      height: 32,
      iconPath: CAMPUS_MAP_MARKER_ICON,
      title: '招待所',
      callout: {
        content: '校内招待所',
        color: '#333333',
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 8,
        display: 'BYCLICK',
      },
    },
  ],
}

function formatRaisedFromFen(fen: number): string {
  const yuan = fen / 100
  if (yuan >= 10000) {
    const w = yuan / 10000
    return `${w >= 100 ? w.toFixed(0) : w.toFixed(2)} 万元`
  }
  return `${yuan.toFixed(2)} 元`
}

function formatTargetLabelFromFen(fen: number): string {
  const yuan = fen / 100
  if (yuan >= 10000) {
    return `${(yuan / 10000).toFixed(0)} 万元`
  }
  return `${yuan.toFixed(0)} 元`
}

type DonateProjectRow = {
  id: string
  name: string
  desc: string
  targetLabel: string
  raisedLabel: string
  percentage: number
  targetFen: number
  raisedFen: number
}

function getFallbackDonateProjects(): DonateProjectRow[] {
  const defs = [
    { id: '1', name: '助学基金', desc: '用于资助家庭经济困难学生完成学业，提供奖助学金支持。', targetFen: 100000000 },
    { id: '2', name: '校园建设', desc: '支持校园基础设施改造升级，改善教学与生活环境。', targetFen: 100000000 },
    { id: '3', name: '科研支持', desc: '资助前沿科研项目，培育优秀科研成果。', targetFen: 50000000 },
  ]
  return defs.map((p) => ({
    ...p,
    raisedFen: 0,
    raisedLabel: '0.00 元',
    targetLabel: formatTargetLabelFromFen(p.targetFen),
    percentage: 0,
  }))
}

const INITIAL_DONATE_DISPLAY = getFallbackDonateProjects()

/** 校友福利每项 useUrl 须为 https；对应域名需在小程序后台「业务域名」中配置后方可 web-view 打开 */

Page({
  data: {
    campusMap: CAMPUS_MAP,
    activeTab: 'benefit',
    returnForm: {
      name: '',
      alumniCardNo: '',
      visitDate: '',
      companionCount: 0,
    },
    companionCountOptions: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    returnSubmitting: false,
    today: (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })(),
    benefitList: [
      { id: '1', shortName: '酒店', name: '校友专属 · 合作酒店特权', tag: '长期有效', desc: '入住享受最高 8 折 · 延迟退房 · 免费早餐等尊享权益。', meta: '合作方：锦江 / 华住 / 万豪', useUrl: 'https://www.jinjiang.com' },
      { id: '2', shortName: '顺丰', name: '顺丰快递 · 校友专属寄件折扣', tag: '本月热度高', desc: '校友认证后线上下单自动享受寄件折扣，支持全国范围。', meta: '已使用 3,205 次', useUrl: 'https://www.sf-express.com' },
      { id: '3', shortName: '瑞幸', name: '瑞幸咖啡 · 校园周边门店专享', tag: '限时', desc: '校友专属优惠券包，部分门店 2 杯 9.9 元起。', meta: '领券后 24 小时内有效', useUrl: 'https://www.lkcoffee.com' },
      { id: '4', shortName: '超星', name: '超星图书馆 · 电子资源免费读', desc: '校友可免费访问海量电子书、期刊、论文数据库。', meta: '长期有效', useUrl: 'https://www.chaoxing.com' },
      { id: '5', shortName: '一嗨', name: '一嗨租车 · 校友租车专属通道', desc: '指定车型额外 9 折，节假日同享。', meta: '查看详情', useUrl: 'https://www.1hai.cn' },
      { id: '6', shortName: '南航', name: '南航 · 校友专属航班优惠', desc: '多条热门航线机票折扣，支持积分累计。', meta: '打开优惠通道', useUrl: 'https://www.csair.com' },
    ],
    donateProjects: INITIAL_DONATE_DISPLAY,
    donateRefreshing: false,
  },

  onLoad() {
    this.applyInitialTab()
    this.loadReturnProfile()
    this.loadDonationStats()
  },

  onShow() {
    this.applyInitialTab()
    this.loadReturnProfile()
    if (this.data.activeTab === 'donate') {
      this.loadDonationStats()
    }
  },

  applyInitialTab() {
    const tab = app.globalData.servicesInitialTab
    const allowedTabs = ['benefit', 'return', 'donate', 'other']
    if (tab && allowedTabs.indexOf(tab) >= 0 && this.data.activeTab !== tab) {
      this.setData({ activeTab: tab })
    }
    app.globalData.servicesInitialTab = undefined
  },

  async loadReturnProfile() {
    const nick = wx.getStorageSync('userNickName') || ''
    const cardNo = wx.getStorageSync('alumniCardNo') || ''
    if (nick || cardNo) {
      this.setData({
        'returnForm.name': nick,
        'returnForm.alumniCardNo': cardNo,
      })
      return
    }
    if (!wx.cloud) return
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyProfile' })
      const result = res.result as { hasProfile?: boolean; profile?: { nickName?: string; alumniCardNo?: string } }
      if (result?.hasProfile && result.profile) {
        this.setData({
          'returnForm.name': result.profile.nickName || '',
          'returnForm.alumniCardNo': result.profile.alumniCardNo || '',
        })
      }
    } catch (e) {
      console.error('loadReturnProfile', e)
    }
  },

  onTabChange(e: WechatMiniprogram.CustomEvent) {
    const v = e.detail.value as string
    this.setData({ activeTab: v })
    if (v === 'donate') {
      this.loadDonationStats()
    }
  },

  onBenefitUseTap(e: WechatMiniprogram.TouchEvent) {
    const id = String((e.currentTarget.dataset as { id?: string }).id || '')
    const list = this.data.benefitList as Array<{ id: string; name: string; useUrl?: string }>
    const item = list.find((b) => b.id === id)
    const url = (item?.useUrl || '').trim()
    const name = item?.name || '校友福利'
    if (!url) {
      wx.showToast({ title: '暂未配置链接', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/benefit-web/benefit-web?title=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`,
      fail: (err) => {
        console.error('benefit-web navigate', err)
        wx.showToast({ title: '页面打开失败', icon: 'none' })
      },
    })
  },

  /** 阻断 touchmove 冒泡，避免拖地图时带动外层 scroll-view 或 t-tabs 手势 */
  onCampusMapCatchTouchMove() {},

  async loadDonationStats() {
    if (!wx.cloud) {
      this.setData({ donateProjects: getFallbackDonateProjects() })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getDonationProjects' })
      const result = res.result as {
        list?: Array<{
          id: string
          name: string
          desc: string
          targetFen: number
          raisedFen: number
          percentage: number
        }>
      }
      const raw = result?.list || []
      const donateProjects: DonateProjectRow[] = raw.map((p) => ({
        id: p.id,
        name: p.name,
        desc: p.desc,
        targetFen: p.targetFen,
        raisedFen: p.raisedFen,
        targetLabel: formatTargetLabelFromFen(p.targetFen),
        raisedLabel: formatRaisedFromFen(p.raisedFen),
        percentage: p.percentage,
      }))
      this.setData({ donateProjects })
    } catch (e) {
      console.error('loadDonationStats', e)
      this.setData({ donateProjects: getFallbackDonateProjects() })
    }
  },

  async onDonateRefresh() {
    this.setData({ donateRefreshing: true })
    await this.loadDonationStats()
    this.setData({ donateRefreshing: false })
  },

  onReturnNameInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'returnForm.name': e.detail.value })
  },

  onReturnCardNoInput(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'returnForm.alumniCardNo': e.detail.value })
  },

  onDateChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ 'returnForm.visitDate': e.detail.value })
  },

  onCountChange(e: WechatMiniprogram.CustomEvent) {
    const idx = Number((e.detail as { value?: number }).value ?? e.detail.value ?? 0)
    const opts = this.data.companionCountOptions
    const num = opts ? Number(opts[idx]) : 0
    this.setData({ 'returnForm.companionCount': num })
  },

  async submitReturnVisit() {
    const { name, alumniCardNo, visitDate, companionCount } = this.data.returnForm
    if (!name?.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (!visitDate) {
      wx.showToast({ title: '请选择到访日期', icon: 'none' })
      return
    }
    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持', icon: 'none' })
      return
    }
    this.setData({ returnSubmitting: true })
    try {
      await wx.cloud.callFunction({
        name: 'createServiceOrder',
        data: {
          type: 'return_visit',
          data: {
            name: name.trim(),
            alumniCardNo: (alumniCardNo || '').trim(),
            visitDate,
            companionCount: Number(companionCount) || 0,
          },
        },
      })
      wx.showToast({ title: '预约已提交', icon: 'success' })
      this.setData({
        'returnForm.visitDate': '',
        'returnForm.companionCount': 0,
        returnSubmitting: false,
      })
    } catch (e) {
      console.error('submitReturnVisit', e)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      this.setData({ returnSubmitting: false })
    }
  },

  onMyOrdersTap() {
    wx.navigateTo({ url: '/pages/service-orders/service-orders' })
  },

  onDonateInitiateTap() {
    wx.navigateTo({ url: '/pages/donate-initiate/donate-initiate' })
  },

  onDonatePayTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    wx.navigateTo({
      url: `/pages/donate-pay/donate-pay?id=${encodeURIComponent(String(id))}`,
    })
  },

  onCampusMarkerTap(e: WechatMiniprogram.MapMarkerTap) {
    const markerId = e.detail.markerId
    const markers = this.data.campusMap.markers as Array<{ id: number; title?: string }>
    const m = markers.find((x) => x.id === markerId)
    if (m?.title) {
      wx.showToast({ title: m.title, icon: 'none' })
    }
  },

  onPickDate() {},
  onPickCount() {},
})
