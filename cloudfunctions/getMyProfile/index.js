// 云函数 getMyProfile：获取当前用户的校友资料（用于电子校友卡等）
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-7g1x07md7360212c',
})

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const { data } = await db
    .collection('alumni_users')
    .where({ _openid: wxContext.OPENID })
    .limit(1)
    .field({
      nickName: true,
      avatarUrl: true,
      alumniCardNo: true,
      department: true,
      enrollYear: true,
      phone: true,
      email: true,
    })
    .get()

  if (!data || data.length === 0) {
    return { hasProfile: false, profile: null }
  }
  return { hasProfile: true, profile: data[0] }
}
