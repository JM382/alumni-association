// 云函数 cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-7g1x07md7360212c',
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  let needRegister = true
  try {
    const db = cloud.database()
    const { total } = await db.collection('alumni_users').where({ _openid: openid }).count()
    needRegister = total === 0
  } catch (e) {
    // 集合被删除或查询失败时，视为需要重新注册
    console.error('login query alumni_users fail', e)
  }
  return {
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    needRegister,
  }
}