const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const logsCol = db.collection('points_logs');
const donationsCol = db.collection('donations');
const DONATION_POINT_REWARD = 50;

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

function isRewardableDonationStatus(status) {
  // paid / completed / 空状态都按有效捐赠处理
  return !status || status === 'paid' || status === 'completed';
}

/**
 * 同步捐赠积分：
 * - donations 每条有效捐赠固定 +50
 * - 通过 points_logs(source=donation, extra.donationId) 去重，避免重复加分
 */
async function syncDonationPoints(userId, openid) {
  if (!userId) return { addedPoints: 0, addedCount: 0 };

  const donationsRes = await donationsCol.where({ userId }).limit(1000).get();
  const donations = (donationsRes.data || []).filter((d) => isRewardableDonationStatus(d.status));
  if (!donations.length) return { addedPoints: 0, addedCount: 0 };

  const donationIds = donations.map((d) => d._id).filter(Boolean);
  if (!donationIds.length) return { addedPoints: 0, addedCount: 0 };

  const existLogsRes = await logsCol
    .where({
      userId,
      source: 'donation',
      'extra.donationId': _.in(donationIds),
    })
    .limit(1000)
    .get();
  const rewardedSet = new Set((existLogsRes.data || []).map((l) => l.extra && l.extra.donationId).filter(Boolean));

  const needReward = donations.filter((d) => d && d._id && !rewardedSet.has(d._id));
  if (!needReward.length) return { addedPoints: 0, addedCount: 0 };

  const now = db.serverDate();
  for (let i = 0; i < needReward.length; i += 1) {
    const d = needReward[i];
    await logsCol.add({
      data: {
        userId,
        change: DONATION_POINT_REWARD,
        type: 'earn',
        source: 'donation',
        title: '捐赠积分',
        desc: d.projectName ? `捐赠 ${d.projectName}` : '捐赠获得积分',
        createdAt: now,
        extra: {
          donationId: d._id,
          projectId: d.projectId || '',
          projectName: d.projectName || d.title || '',
        },
      },
    });
  }

  const addedPoints = needReward.length * DONATION_POINT_REWARD;
  const userWhere = userId ? { user_id: userId } : openid ? { openid } : null;
  if (userWhere) {
    await usersCol
      .where(userWhere)
      .update({
        data: {
          pointsBalance: _.inc(addedPoints),
        },
      });
  }

  return {
    addedPoints,
    addedCount: needReward.length,
  };
}

// 获取积分概览 + 最近流水
async function handleGetInfo(event) {
  const { user, userId, openid } = await getCurrentUser();
  const syncRes = await syncDonationPoints(userId, openid);
  let balance = typeof user.pointsBalance === 'number' ? user.pointsBalance + (syncRes.addedPoints || 0) : 0;

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
  const { userId, openid } = await getCurrentUser();
  await syncDonationPoints(userId, openid);
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

