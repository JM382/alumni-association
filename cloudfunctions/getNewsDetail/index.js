// 云函数：获取资讯详情
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

function getTime(v) {
  if (!v) return 0
  if (v.$date) return new Date(v.$date).getTime()
  if (v instanceof Date) return v.getTime()
  return new Date(v).getTime()
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { id = '' } = event || {}
  if (!id) return { success: false, errMsg: '缺少资讯 id' }

  const db = cloud.database()
  try {
    const res = await db.collection('news_posts').doc(id).get()
    const data = res.data || null
    if (!data) return { success: false, errMsg: '资讯不存在' }

    if (data.status === 'scheduled') {
      const pub = getTime(data.publishAt)
      if (!pub || pub > Date.now()) {
        return { success: false, errMsg: '内容未到发布时间' }
      }
    } else if (data.status && data.status !== 'published') {
      return { success: false, errMsg: '资讯不可见' }
    }

    const isMine = !!openid && data._openid === openid
    return { success: true, detail: data, isMine }
  } catch (e) {
    return { success: false, errMsg: '资讯不存在' }
  }
}
