// 云函数 cloudfunctions/register/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-7g1x07md7360212c',
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const {
    nickName = '',
    avatarUrl = '',
    alumniCardNo = '',
    enrollYear = '',
    department = '',
    phone = '',
    email = '',
  } = event

  const db = cloud.database()
  const col = db.collection('alumni_users')
  const { data: existing } = await col.where({ _openid: wxContext.OPENID }).limit(1).get()

  const openid = wxContext.OPENID
  const record = {
    _openid: openid,
    nickName,
    avatarUrl,
    alumniCardNo,
    enrollYear,
    department,
    phone,
    email,
    updatedAt: db.serverDate(),
  }

  if (existing && existing.length > 0) {
    await col.doc(existing[0]._id).update({ data: record })
  } else if (alumniCardNo) {
    const { data: byCard } = await col.where({ alumniCardNo }).limit(1).get()
    if (byCard && byCard.length > 0) {
      await col.doc(byCard[0]._id).update({ data: record })
    } else {
      await col.add({ data: { ...record, createdAt: db.serverDate() } })
    }
  } else {
    await col.add({ data: { ...record, createdAt: db.serverDate() } })
  }

  return { success: true }
}
