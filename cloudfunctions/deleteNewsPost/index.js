// 云函数：删除本人发布的资讯
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { id = '' } = event || {}
  if (!id) return { success: false, errMsg: '缺少资讯 id' }

  const db = cloud.database()
  try {
    const res = await db.collection('news_posts').doc(id).get()
    const data = res.data
    if (!data) return { success: false, errMsg: '资讯不存在' }
    if (data._openid !== openid) return { success: false, errMsg: '只能删除自己发布的资讯' }

    await db.collection('news_posts').doc(id).remove()
    return { success: true }
  } catch (e) {
    console.error('deleteNewsPost', e)
    return { success: false, errMsg: '删除失败' }
  }
}
