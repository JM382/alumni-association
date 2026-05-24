// 云函数：发布资讯（支持分类、置顶、首页 Banner、定时发布）
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const ALLOWED_CATEGORIES = ['校友故事', '母校新闻', '校友会通知', '行业动态', '政策资讯']

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const {
    title = '',
    content = '',
    category = '校友故事',
    cover = '/images/placeholder.png',
    pinned = false,
    banner = false,
    scheduleEnabled = false,
    publishAtMs = null,
  } = event || {}

  const t = String(title).trim()
  const c = String(content).trim()
  if (!t || t.length < 5) return { success: false, errMsg: '标题至少 5 个字' }
  if (!c || c.length < 10) return { success: false, errMsg: '正文至少 10 个字' }

  const cat = ALLOWED_CATEGORIES.includes(category) ? category : '校友故事'

  let status = 'published'
  let publishAt = null

  if (scheduleEnabled && publishAtMs != null) {
    const when = new Date(Number(publishAtMs))
    if (isNaN(when.getTime())) {
      return { success: false, errMsg: '发布时间无效' }
    }
    if (when.getTime() <= Date.now()) {
      return { success: false, errMsg: '定时发布请选择未来时间' }
    }
    status = 'scheduled'
    publishAt = when
  }

  const db = cloud.database()
  const record = {
    _openid: wxContext.OPENID,
    category: cat,
    title: t,
    content: c,
    summary: c.slice(0, 60),
    cover,
    views: 0,
    comments: 0,
    pinned: !!pinned,
    banner: !!banner,
    status,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  }
  if (publishAt) {
    record.publishAt = publishAt
  }

  const res = await db.collection('news_posts').add({ data: record })
  return { success: true, id: res._id }
}
