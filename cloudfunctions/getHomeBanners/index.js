// 云函数：首页 Banner（推荐到首页且已可见的资讯）
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

function getTime(v) {
  if (!v) return 0
  if (v.$date) return new Date(v.$date).getTime()
  if (v instanceof Date) return v.getTime()
  return new Date(v).getTime()
}

exports.main = async () => {
  const db = cloud.database()
  const { data } = await db.collection('news_posts').where({ banner: true }).limit(50).get()
  const now = Date.now()
  const visible = (data || []).filter((doc) => {
    if (doc.status === 'published') return true
    if (doc.status === 'scheduled' && doc.publishAt) {
      const t = getTime(doc.publishAt)
      return t > 0 && t <= now
    }
    return false
  })
  visible.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
  return { list: visible.slice(0, 8) }
}
