// 云函数：创建服务单（返校预约等）
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const { type = 'return_visit', data } = event
  if (!data || typeof data !== 'object') {
    return { success: false, errMsg: '缺少 data' }
  }
  const db = cloud.database()
  await db.collection('service_orders').add({
    data: {
      _openid: wxContext.OPENID,
      type,
      data: { ...data },
      createdAt: db.serverDate(),
    },
  })
  return { success: true }
}
