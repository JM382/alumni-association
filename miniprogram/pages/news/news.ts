// pages/news/news.ts
Page({
  data: {
    activeCategory: 'all',
    newsList: [
      {
        id: '1',
        category: '母校新闻',
        title: '母校入选"双一流"建设高校，全新发展规划发布',
        summary: '学校发布新一轮事业发展规划，聚焦学科建设、人才培养、科研创新和国际合作多维度。',
        date: '2026-03-01',
        views: '3,245',
        comments: '48',
        thumb: '/images/placeholder.png',
      },
      {
        id: '2',
        category: '校友故事',
        title: '"从实验室到创业板" · 物理学院 2008 级校友专访',
        summary: '他用十年时间将实验室科研成果转化为上市公司，分享创新与坚持的故事。',
        date: '2026-02-25',
        views: '1,023',
        comments: '320',
        thumb: '/images/placeholder.png',
      },
      {
        id: '3',
        category: '校友会通知',
        title: '校友会 2026 年年会通知 · 全国理事会议程发布',
        summary: '年会议程包括工作报告、分论坛交流、校友企业展示等内容，欢迎各地校友参加。',
        date: '2026-02-20',
        views: '568',
        comments: '120',
        thumb: '/images/placeholder.png',
      },
      {
        id: '4',
        category: '行业动态',
        title: '科技产业发展趋势 · 多位校友受邀参与行业报告编写',
        summary: '聚焦人工智能、新能源、生命科学等热门领域，呈现最新产业发展图景。',
        date: '2026-02-18',
        views: '2,108',
        comments: '210',
        thumb: '/images/placeholder.png',
      },
    ],
  },

  onCategoryChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ activeCategory: e.detail.value })
  },

  onNewsTap(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/news-detail/news-detail?id=${id}` })
  },

  onPublish() {
    wx.navigateTo({ url: '/pages/news-publish/news-publish' })
  },
})
