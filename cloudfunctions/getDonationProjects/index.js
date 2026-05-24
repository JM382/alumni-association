// 筹款项目列表（donation_projects）+ 成功捐赠汇总；无数据时回退内置三项
const cloud = require('wx-server-sdk')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const LEGACY = [
  { id: '1', name: '助学基金', desc: '用于资助家庭经济困难学生完成学业，提供奖助学金支持。', targetFen: 100000000 },
  { id: '2', name: '校园建设', desc: '支持校园基础设施改造升级，改善教学与生活环境。', targetFen: 100000000 },
  { id: '3', name: '科研支持', desc: '资助前沿科研项目，培育优秀科研成果。', targetFen: 50000000 },
]

function getTime(v) {
  if (!v) return 0
  if (v.$date) return new Date(v.$date).getTime()
  if (v instanceof Date) return v.getTime()
  return new Date(v).getTime()
}

exports.main = async () => {
  const db = cloud.database()
  const raisedByProject = Object.create(null)
  try {
    const { data } = await db.collection('donation_orders').where({ status: 'success' }).limit(2000).get()
    for (const row of data || []) {
      const pid = String(row.projectId || '')
      if (!pid) continue
      raisedByProject[pid] = (raisedByProject[pid] || 0) + (Number(row.amountFen) || 0)
    }
  } catch (e) {
    console.error('getDonationProjects aggregate', e)
  }

  let rows = []
  try {
    const res = await db.collection('donation_projects').where({ status: 'active' }).limit(50).get()
    rows = res.data || []
    rows.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
  } catch (e) {
    console.error('getDonationProjects query', e)
  }

  const base =
    rows.length > 0
      ? rows.map((doc) => ({
          id: String(doc._id),
          name: doc.name || '未命名项目',
          desc: doc.desc || '',
          targetFen: Number(doc.targetFen) || 0,
        }))
      : LEGACY

  const list = base.map((p) => {
    const raisedFen = raisedByProject[p.id] || 0
    const tf = p.targetFen > 0 ? p.targetFen : 1
    const percentage = Math.min(100, Math.round((raisedFen / tf) * 100))
    return { id: p.id, name: p.name, desc: p.desc, targetFen: p.targetFen, raisedFen, percentage }
  })

  return { list }
}
