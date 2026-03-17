const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const ordersCol = db.collection('orders');

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

function formatAmountYuan(amount) {
  if (typeof amount !== 'number') return '';
  return amount.toFixed(2);
}

function statusText(status) {
  switch (status) {
    case 'pending':
      return '待支付';
    case 'paid':
      return '已支付';
    case 'completed':
      return '已完成';
    case 'canceled':
      return '已取消';
    case 'refunded':
      return '已退款';
    default:
      return '未知状态';
  }
}

function typeText(type) {
  switch (type) {
    case 'hotel':
      return '酒店';
    case 'flight':
      return '机票';
    case 'car':
      return '租车';
    case 'express':
      return '快递';
    default:
      return '其他';
  }
}

// 列出当前用户的订单
async function handleListMyOrders(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const businessType = (event.businessType || '').trim();

  const where = { userId };
  if (businessType) {
    where.businessType = businessType;
  }

  const skip = (page - 1) * pageSize;

  const res = await ordersCol
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const list = (res.data || []).map((o) => {
    const createdAt = o.createdAt || null;
    let createdAtText = '';
    if (createdAt && createdAt instanceof Date) {
      const y = createdAt.getFullYear();
      const m = String(createdAt.getMonth() + 1).padStart(2, '0');
      const d = String(createdAt.getDate()).padStart(2, '0');
      const hh = String(createdAt.getHours()).padStart(2, '0');
      const mm = String(createdAt.getMinutes()).padStart(2, '0');
      createdAtText = `${y}-${m}-${d} ${hh}:${mm}`;
    }

    return {
      _id: o._id,
      businessType: o.businessType || 'other',
      businessTypeText: typeText(o.businessType || 'other'),
      title: o.title || '',
      partnerName: o.partnerName || '',
      status: o.status || 'pending',
      statusText: statusText(o.status || 'pending'),
      totalAmount: o.totalAmount || 0,
      totalAmountText: formatAmountYuan(o.totalAmount || 0),
      createdAt: createdAt,
      createdAtText,
      partnerAppId: o.partnerAppId || '',
      partnerPath: o.partnerPath || '',
    };
  });

  return {
    success: true,
    list,
  };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'listMyOrders';

  try {
    switch (action) {
      case 'listMyOrders':
      default:
        return await handleListMyOrders(event || {});
    }
  } catch (err) {
    console.error('orders error', action, err);
    return {
      success: false,
      error: err.message || '服务异常',
    };
  }
};

