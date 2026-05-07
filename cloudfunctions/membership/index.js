// 云函数 membership：会员中心相关接口
// action:
// - getInfo: 获取当前用户会员状态
// - createOrder: 创建待支付会员业务单
// - getLatestOrder: 获取最近一笔会员订单（用于前端展示退款入口）
// - getRefundEligibility: 校验最近订单是否满足退款条件

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const membershipOrdersCol = db.collection('membership_orders');
const payOrdersCol = db.collection('wechat_pay_orders');
const authCol = db.collection('authApplications');

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

/** 与 authApplications「myStatus」校友类选条规则一致，避免仅看 users.identity 与认证页不一致 */
function itemTimeMs(item) {
  if (!item || typeof item !== 'object') return 0;
  const t = item.updatedAt || item.createdAt;
  if (!t) return 0;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

async function getPickedAlumniApplication(userId, openid) {
  const conditions = [];
  if (userId) conditions.push({ userId });
  if (openid) conditions.push({ openid });
  if (!conditions.length) return null;

  const res = await authCol
    .where(
      _.and([_.or(conditions), { category: 'alumni' }])
    )
    .get();
  const byId = new Map();
  (res.data || []).forEach((row) => {
    if (row && row._id) byId.set(row._id, row);
  });
  const rows = Array.from(byId.values()).filter((item) => item && item.category === 'alumni');
  if (!rows.length) return null;
  const active = rows.filter((item) => item.status !== 'canceled');
  const pool = active.length ? active : rows;
  let best = pool[0];
  pool.forEach((item) => {
    if (itemTimeMs(item) >= itemTimeMs(best)) best = item;
  });
  return best;
}

/** 会员权益以「users 已标校友」或「校友认证审核通过」为准，与个人中心逻辑对齐 */
async function resolveIdentityForMembership(user) {
  const docIdentity = user.identity || 'visitor';
  if (docIdentity === 'alumni') return 'alumni';
  const uid = resolveUserId(user);
  const picked = await getPickedAlumniApplication(uid, user.openid || '');
  if (picked && picked.status === 'approved') return 'alumni';
  return docIdentity;
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

  const identity = await resolveIdentityForMembership(user);

  return {
    success: true,
    data: {
      level,
      expireAt,
      isValid,
      identity,
    },
  };
}

function genOrderNo(prefix) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${Date.now()}${rand}`;
}

function parseServerDate(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime();
}

async function findUnpaidPayOrder(userId, planKey) {
  const res = await payOrdersCol
    .where({
      userId,
      bizType: 'membership',
      planKey,
      status: _.in(['CREATED', 'PAYING']),
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (!res.data || !res.data.length) return null;
  return res.data[0];
}

// 创建会员订单（只建待支付业务单，不直接开通）
async function handleCreateOrder(event) {
  const { userId, user, openid } = await getCurrentUser();
  const { planKey } = event; // 例如 'vip_month' 或 'svip_year'

  if (!planKey || !PLANS[planKey]) {
    throw new Error('不支持的会员套餐');
  }

  // 只有校友才能开通会员（users.identity 或校友认证已通过）
  const identity = await resolveIdentityForMembership(user);
  if (identity !== 'alumni') {
    return { success: false, error: '仅校友可开通会员' };
  }

  const plan = PLANS[planKey];
  const existingPayOrder = await findUnpaidPayOrder(userId, planKey);
  if (existingPayOrder) {
    return {
      success: true,
      orderNo: existingPayOrder.orderNo,
      membershipOrderId: existingPayOrder.bizId || '',
      payOrderId: existingPayOrder._id,
      amountFen: existingPayOrder.amountFen || plan.price,
      level: plan.level,
      planType: plan.planType,
      planKey,
    };
  }

  const orderNo = genOrderNo('MPM');
  const now = db.serverDate();
  const membershipOrderDoc = {
    userId,
    openid,
    level: plan.level,
    planType: plan.planType,
    planKey,
    price: plan.price,
    status: 'pending',
    orderNo,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
  const membershipRes = await membershipOrdersCol.add({ data: membershipOrderDoc });
  const payOrderDoc = {
    orderNo,
    bizType: 'membership',
    bizId: membershipRes._id,
    planKey,
    userId,
    openid,
    amountFen: plan.price,
    status: 'CREATED',
    wxPrepayId: '',
    wxTransactionId: '',
    notifyAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const payOrderRes = await payOrdersCol.add({ data: payOrderDoc });

  return {
    success: true,
    orderNo,
    membershipOrderId: membershipRes._id,
    payOrderId: payOrderRes._id,
    amountFen: plan.price,
    level: plan.level,
    planType: plan.planType,
    planKey,
  };
}

async function handleGetLatestOrder() {
  const { userId } = await getCurrentUser();
  const res = await membershipOrdersCol
    .where({ userId })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const latest = (res.data && res.data[0]) || null;
  if (!latest) return { success: true, data: null };
  return { success: true, data: latest };
}

async function handleGetRefundEligibility(event) {
  const { userId } = await getCurrentUser();
  const limitMinutes = Math.max(1, Number(event.limitMinutes) || 30);

  const res = await payOrdersCol
    .where({
      userId,
      bizType: 'membership',
      status: 'PAID',
    })
    .orderBy('notifyAt', 'desc')
    .limit(1)
    .get();
  const order = (res.data && res.data[0]) || null;
  if (!order) {
    return {
      success: true,
      eligible: false,
      reason: '暂无可退款订单',
      limitMinutes,
      data: null,
    };
  }

  const paidMs = parseServerDate(order.notifyAt) || parseServerDate(order.updatedAt);
  const elapsedMs = Math.max(0, Date.now() - paidMs);
  const remainMs = limitMinutes * 60 * 1000 - elapsedMs;
  const eligible = !!paidMs && remainMs > 0;
  return {
    success: true,
    eligible,
    reason: eligible ? '' : `仅支持支付后${limitMinutes}分钟内退款`,
    limitMinutes,
    remainSeconds: Math.max(0, Math.floor(remainMs / 1000)),
    data: {
      orderNo: order.orderNo,
      amountFen: order.amountFen,
      wxTransactionId: order.wxTransactionId || '',
      notifyAt: order.notifyAt || null,
    },
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
      case 'getLatestOrder':
        return await handleGetLatestOrder();
      case 'getRefundEligibility':
        return await handleGetRefundEligibility(event);
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

