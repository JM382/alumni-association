const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const cardsCol = db.collection('alumni_cards');
const authCol = db.collection('authApplications');

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('未登录');

  const res = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!res.data || res.data.length === 0) {
    return { openid: OPENID, user: null, userId: '' };
  }

  const user = res.data[0];
  return {
    openid: OPENID,
    user,
    userId: resolveUserId(user),
  };
}

async function hasApprovedAlumniAuth(userId, openid) {
  const conds = [];
  if (userId) conds.push({ userId, category: 'alumni', status: 'approved' });
  if (openid) conds.push({ openid, category: 'alumni', status: 'approved' });
  if (!conds.length) return false;
  const res = await authCol.where(_.or(conds)).limit(1).get();
  return !!(res.data && res.data.length);
}

// 生成一个简单的卡号：NO + 年份 + userId 后 4 位
function buildCardNo(user, userId, seq) {
  const year = user.enterYear || new Date().getFullYear();
  const tail = (userId || '').slice(-4) || String(seq).padStart(4, '0');
  return `NO${year}${tail}`;
}

// 确保 alumni 用户有一张卡，必要时在 alumni_cards 中创建
async function handleEnsureCard() {
  const { user, userId, openid } = await getCurrentUser();
  if (!user) {
    return { success: false, status: 'notRegistered', error: '用户不存在' };
  }
  const identity = user.identity || 'visitor';
  const approvedAlumni = await hasApprovedAlumniAuth(userId, openid);
  if (identity !== 'alumni' && !approvedAlumni) {
    return { success: false, status: 'notAlumni', error: '仅校友可生成校友卡' };
  }

  const exist = await cardsCol.where({ userId }).limit(1).get();
  if (exist.data && exist.data.length > 0) {
    return {
      success: true,
      status: 'ok',
      card: exist.data[0],
    };
  }

  // 简单的序号：当前总数+1（并发很低的场景足够用）
  const countRes = await cardsCol.count();
  const seq = (countRes.total || 0) + 1;
  const cardNo = buildCardNo(user, userId, seq);
  const now = db.serverDate();

  const addRes = await cardsCol.add({
    data: {
      userId,
      cardNo,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      extra: {},
    },
  });

  return {
    success: true,
    status: 'ok',
    card: {
      _id: addRes._id,
      userId,
      cardNo,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      extra: {},
    },
  };
}

// 返回前端展示用的“电子校友卡”信息
async function handleGetMyCard() {
  const ensureRes = await handleEnsureCard();
  if (!ensureRes.success) {
    return ensureRes;
  }

  const { user, userId, openid } = await getCurrentUser();
  if (!user) {
    return { success: false, status: 'notRegistered', error: '用户不存在' };
  }

  const identity = user.identity || 'visitor';
  const approvedAlumni = await hasApprovedAlumniAuth(userId, openid);
  if (identity !== 'alumni' && !approvedAlumni) {
    return { success: false, status: 'notAlumni', error: '仅校友可查看校友卡' };
  }

  const card = ensureRes.card;

  const realName = user.realName || user.nickname || '校友';
  const schoolName = user.schoolName || '';
  const major = user.major || '';
  const enterYear = user.enterYear || '';
  const graduationYear = user.graduationYear || '';
  const avatarUrl = user.avatarUrl || '';

  return {
    success: true,
    status: 'ok',
    card: {
      userId,
      name: realName,
      schoolName,
      major,
      enterYear,
      graduationYear,
      cardNo: card.cardNo,
      avatarUrl,
      identity: 'alumni',
    },
  };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'getMyCard';

  try {
    switch (action) {
      case 'ensureCard':
        return await handleEnsureCard();
      case 'getMyCard':
      default:
        return await handleGetMyCard();
    }
  } catch (err) {
    console.error('alumniCard error', action, err);
    return {
      success: false,
      error: err.message || '服务异常',
    };
  }
};

