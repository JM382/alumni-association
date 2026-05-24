// 发起捐赠（配置）：新增筹款项目，不涉及支付
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const MAX_TARGET_FEN = 10000000000

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, errMsg: '未获取到用户身份' }

  const adminList = (process.env.DONATION_ADMIN_OPENIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (adminList.length > 0 && !adminList.includes(openid)) {
    return { success: false, errMsg: '无权限：仅管理员可发起捐赠项目（配置 DONATION_ADMIN_OPENIDS）' }
  }

  const { name = '', desc = '', targetYuan } = event || {}
  const title = String(name).trim()
  if (!title || title.length > 40) return { success: false, errMsg: '项目名称需 1～40 字' }

  let yuan = Number(targetYuan)
  if (!Number.isFinite(yuan) || yuan < 1) return { success: false, errMsg: '筹款目标资金至少为 1 元' }
  let targetFen = Math.round(yuan * 100)
  if (targetFen < 100) targetFen = 100
  if (targetFen > MAX_TARGET_FEN) return { success: false, errMsg: '筹款目标金额过大' }

  const db = cloud.database()
  const addRes = await db.collection('donation_projects').add({
    data: {
      name: title,
      desc: String(desc).trim().slice(0, 500),
      targetFen,
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      _openid: openid,
    },
  })

  return { success: true, projectId: addRes._id }
}
