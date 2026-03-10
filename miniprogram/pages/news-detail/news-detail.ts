// pages/news-detail/news-detail.ts
Page({
  data: {
    liked: false,
    collected: false,
    detail: {
      title: '母校发布新一轮发展规划：聚焦"双一流"建设与校友协同发展',
      source: '母校新闻 · 校党委宣传部',
      date: '2026-03-01 10:20',
      cover: '/images/placeholder.png',
      content: '为全面贯彻落实国家"双一流"建设要求，学校正式发布新一轮事业发展规划，提出以"学科引领、人才强校、科研创新、开放办学、校友协同"为核心的发展路径，加快推进高水平大学建设。\n\n规划明确提出，将进一步优化学科布局，重点支持基础学科、新兴交叉学科和优势特色学科建设，着力打造若干在国内外具有重要影响力的一流学科集群。同时，学校将持续加强高层次人才引进与培养，完善人才评价与激励机制，为创新发展提供坚实的人才支撑。\n\n在科研方面，学校将围绕国家重大战略需求和区域经济社会发展，布局一批前沿交叉研究平台，鼓励师生聚焦关键核心技术攻关，推动更多原创性成果产出与转化。与此同时，学校将进一步拓展国际合作渠道，深化与世界一流高校和科研机构的交流合作。\n\n值得一提的是，本轮规划专门设置了"校友协同发展"章节，提出要构建更加紧密的校友合作网络，通过完善校友服务体系、搭建校友发展平台、开展多层次校友活动等方式，形成"学校发展—校友成长—社会进步"的良性互动。',
      likes: 320,
      collects: 210,
      comments: [
        { id: '1', user: '2010 级 · 计算机学院', time: '刚刚', content: '期待母校在新一轮"双一流"建设中取得更大突破，也希望有更多机会参与到学校与校友协同发展的实践中。' },
        { id: '2', user: '2005 级 · 经济学院', time: '1 小时前', content: '"校友协同发展"这一部分特别好，希望能看到更多校友参与学校重大项目。' },
      ],
    },
  },

  onLoad(options: { id?: string }) {
    // 可根据 options.id 请求详情
  },

  onLike() {
    this.setData({ liked: !this.data.liked })
  },

  onCollect() {
    this.setData({ collected: !this.data.collected })
  },

  onShareAppMessage() {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1] as WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>
    const id = (cur.options && cur.options.id) || ''
    return {
      title: this.data.detail.title,
      path: `/pages/news-detail/news-detail?id=${id}`,
    }
  },
})
