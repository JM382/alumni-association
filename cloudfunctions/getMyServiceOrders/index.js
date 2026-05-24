// 云函数：获取当前用户的服务单列表
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { data } = await db
    .collection('service_orders')
    .where({ _openid: wxContext.OPENID })
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  return { list: data || [] }
}
