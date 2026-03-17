const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const usersCol = db.collection('users');
const logsCol = db.collection('points_logs');

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('未登录');

  const res = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!res.data || res.data.length === 0) throw new Error('用户不存在');

  const user = res.data[0];
  return {
    openid: OPENID,
    user,
    userId: resolveUserId(user),
  };
}

function formatTime(date) {
  if (!(date instanceof Date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function sourceTitleAndDesc(log) {
  const src = log.source || '';
  const extra = log.extra || {};

  if (log.title) {
    return { title: log.title, desc: log.desc || '' };
  }

  switch (src) {
    case 'donation':
      return {
        title: '捐赠积分',
        desc: extra.projectName ? `捐赠 ${extra.projectName}` : '捐赠获得积分',
      };
    case 'order':
      return {
        title: '消费积分',
        desc: extra.title || '订单消费获得积分',
      };
    case 'checkin':
      return {
        title: '签到积分',
        desc: '每日签到',
      };
    case 'redeem':
      return {
        title: '积分兑换',
        desc: extra.itemName || '兑换礼品',
      };
    default:
      return {
        title: '积分变动',
        desc: '',
      };
  }
}

// 获取积分概览 + 最近流水
async function handleGetInfo(event) {
  const { user, userId } = await getCurrentUser();
  let balance = typeof user.pointsBalance === 'number' ? user.pointsBalance : 0;

  const res = await logsCol
    .where({ userId })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  const rawLogs = res.data || [];
  const logs = rawLogs.map((log) => {
    const createdAt = log.createdAt || null;
    const { title, desc } = sourceTitleAndDesc(log);
    return {
      _id: log._id,
      change: log.change || 0,
      type: log.type || 'earn',
      source: log.source || '',
      title,
      desc,
      createdAtText: createdAt ? formatTime(createdAt) : '',
    };
  });

  // 如果用户还没有 pointsBalance 字段，但已有流水，临时用流水求和作为展示
  if (typeof user.pointsBalance !== 'number' && rawLogs.length > 0) {
    balance = rawLogs.reduce((sum, log) => sum + (log.change || 0), 0);
  }

  return {
    success: true,
    balance,
    logs,
  };
}

// 积分明细列表
async function handleListLogs(event) {
  const { userId } = await getCurrentUser();
  const type = (event.type || 'all').trim();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(event.pageSize) || 20));

  const where = { userId };
  if (type === 'earn') where.type = 'earn';
  if (type === 'spend') where.type = 'spend';

  const skip = (page - 1) * pageSize;

  const res = await logsCol
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const logs = (res.data || []).map((log) => {
    const createdAt = log.createdAt || null;
    const { title, desc } = sourceTitleAndDesc(log);
    return {
      _id: log._id,
      change: log.change || 0,
      type: log.type || 'earn',
      source: log.source || '',
      title,
      desc,
      createdAtText: createdAt ? formatTime(createdAt) : '',
    };
  });

  return {
    success: true,
    logs,
  };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'getInfo';

  try {
    switch (action) {
      case 'getInfo':
        return await handleGetInfo(event || {});
      case 'listLogs':
        return await handleListLogs(event || {});
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (err) {
    console.error('points error', action, err);
    return {
      success: false,
      error: err.message || '服务异常',
    };
  }
};

