// 云函数 membership：会员中心相关接口
// action:
// - getInfo: 获取当前用户会员状态
// - createOrder: 创建会员订单（当前先模拟支付成功，直接开通/续期）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const usersCol = db.collection('users');
const ordersCol = db.collection('membership_orders');

// 会员产品配置（可以按需修改价格和天数）
const PLANS = {
  vip_month: { level: 'vip', planType: 'month', days: 30, price: 1999 },
  vip_year: { level: 'vip', planType: 'year', days: 365, price: 19900 },
  svip_month: { level: 'svip', planType: 'month', days: 30, price: 2999 },
  svip_year: { level: 'svip', planType: 'year', days: 365, price: 29900 },
};

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('未获取到用户身份');

  const res = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!res.data || res.data.length === 0) throw new Error('用户不存在');

  const user = res.data[0];
  return {
    openid: OPENID,
    user,
    userId: resolveUserId(user),
  };
}

// 获取当前会员状态
async function handleGetInfo() {
  const { user } = await getCurrentUser();
  const now = Date.now();

  const level = user.membershipLevel || 'none';
  const expireAt = user.membershipExpireAt || null;
  let isValid = false;

  if (expireAt && expireAt.getTime && expireAt.getTime() > now) {
    isValid = true;
  }

  return {
    success: true,
    data: {
      level,
      expireAt,
      isValid,
      identity: user.identity || 'visitor',
    },
  };
}

// 根据当前到期时间 + 计划天数，计算新的到期时间
function calcNewExpireAt(currentExpireAt, days) {
  const now = Date.now();
  const base =
    currentExpireAt && currentExpireAt.getTime && currentExpireAt.getTime() > now
      ? currentExpireAt.getTime()
      : now;
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(base + ms);
}

// 创建会员订单（当前简化为直接开通/续期）
async function handleCreateOrder(event) {
  const { userId, user, openid } = await getCurrentUser();
  const { planKey } = event; // 例如 'vip_month' 或 'svip_year'

  if (!planKey || !PLANS[planKey]) {
    throw new Error('不支持的会员套餐');
  }

  // 只有校友才能开通会员
  const identity = user.identity || 'visitor';
  if (identity !== 'alumni') {
    return { success: false, error: '仅校友可开通会员' };
  }

  const plan = PLANS[planKey];

  const now = db.serverDate();
  const orderDoc = {
    userId,
    openid,
    level: plan.level,
    planType: plan.planType,
    planKey,
    price: plan.price,
    status: 'paid', // 暂时直接视为已支付，后续接入微信支付时可改为 pending
    createdAt: now,
    updatedAt: now,
    paidAt: now,
  };

  const addRes = await ordersCol.add({ data: orderDoc });

  // 更新用户会员信息（开通或续期）
  const newExpireAt = calcNewExpireAt(user.membershipExpireAt, plan.days);

  await usersCol
    .where({ user_id: userId })
    .update({
      data: {
        membershipLevel: plan.level,
        membershipExpireAt: newExpireAt,
        membershipUpdatedAt: db.serverDate(),
      },
    });

  return {
    success: true,
    orderId: addRes._id,
    newLevel: plan.level,
    newExpireAt,
  };
}

exports.main = async (event, context) => {
  try {
    const { action } = event;
    if (!action) throw new Error('缺少 action');

    switch (action) {
      case 'getInfo':
        return await handleGetInfo();
      case 'createOrder':
        return await handleCreateOrder(event);
      default:
        throw new Error('不支持的 action');
    }
  } catch (e) {
    console.error('membership 异常', e);
    return {
      success: false,
      error: e.message || '请求失败',
    };
  }
};

