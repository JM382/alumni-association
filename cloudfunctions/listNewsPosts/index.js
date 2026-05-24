// 云函数：获取资讯列表（含定时发布到期、置顶排序）
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

function getTime(v) {
  if (!v) return 0
  if (v.$date) return new Date(v.$date).getTime()
  if (v instanceof Date) return v.getTime()
  return new Date(v).getTime()
}

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || ''
  const db = cloud.database()
  const { data: published } = await db.collection('news_posts').where({ status: 'published' }).limit(100).get()
  const { data: scheduled } = await db.collection('news_posts').where({ status: 'scheduled' }).limit(100).get()

  const now = Date.now()
  const scheduledVisible = (scheduled || []).filter((doc) => {
    const t = getTime(doc.publishAt)
    return t > 0 && t <= now
  })

  const merged = [...(published || []), ...scheduledVisible]
  merged.sort((a, b) => {
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0
    if (pb !== pa) return pb - pa
    return getTime(b.createdAt) - getTime(a.createdAt)
  })

  const list = merged.slice(0, 50).map((doc) => ({
    ...doc,
    isMine: !!openid && doc._openid === openid,
  }))
  return { list }
}
