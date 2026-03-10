// pages/services/services.ts
Page({
  data: {
    activeTab: 'benefit',
    benefitList: [
      { id: '1', shortName: '酒店', name: '校友专属 · 合作酒店特权', tag: '长期有效', desc: '入住享受最高 8 折 · 延迟退房 · 免费早餐等尊享权益。', meta: '合作方：锦江 / 华住 / 万豪' },
      { id: '2', shortName: '顺丰', name: '顺丰快递 · 校友专属寄件折扣', tag: '本月热度高', desc: '校友认证后线上下单自动享受寄件折扣，支持全国范围。', meta: '已使用 3,205 次' },
      { id: '3', shortName: '瑞幸', name: '瑞幸咖啡 · 校园周边门店专享', tag: '限时', desc: '校友专属优惠券包，部分门店 2 杯 9.9 元起。', meta: '领券后 24 小时内有效' },
      { id: '4', shortName: '超星', name: '超星图书馆 · 电子资源免费读', desc: '校友可免费访问海量电子书、期刊、论文数据库。', meta: '长期有效' },
      { id: '5', shortName: '一嗨', name: '一嗨租车 · 校友租车专属通道', desc: '指定车型额外 9 折，节假日同享。', meta: '查看详情' },
      { id: '6', shortName: '南航', name: '南航 · 校友专属航班优惠', desc: '多条热门航线机票折扣，支持积分累计。', meta: '打开优惠通道' },
    ],
    donateProjects: [
      { id: '1', name: '助学基金', target: '100 万元', desc: '用于资助家庭经济困难学生完成学业，提供奖助学金支持。', raised: '62 万元', percentage: 62, amounts: ['50 元', '100 元', '200 元'] },
      { id: '2', name: '校园建设', target: '100 万元', desc: '支持校园基础设施改造升级，改善教学与生活环境。', raised: '38 万元', percentage: 38, amounts: ['50 元', '100 元', '200 元'] },
      { id: '3', name: '科研支持', target: '50 万元', desc: '资助前沿科研项目，培育优秀科研成果。', raised: '25 万元', percentage: 50, amounts: ['50 元', '100 元', '200 元'] },
    ],
  },

  onTabChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeTab: e.detail.value })
  },

  onPickDate() {
    wx.showToast({ title: '选择日期', icon: 'none' })
  },

  onPickCount() {
    wx.showToast({ title: '选择人数', icon: 'none' })
  },
})
