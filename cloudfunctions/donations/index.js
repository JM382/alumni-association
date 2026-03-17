const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const usersCol = db.collection('users');
const donationsCol = db.collection('donations');

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
    case 'refunded':
      return '已退款';
    default:
      return '未知状态';
  }
}

// 列出当前用户的历史捐赠
async function handleListMyDonations(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));

  const skip = (page - 1) * pageSize;

  const res = await donationsCol
    .where({ userId })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const list = (res.data || []).map((d) => {
    const createdAt = d.createdAt || null;
    let createdAtText = '';
    if (createdAt && createdAt instanceof Date) {
      const y = createdAt.getFullYear();
      const m = String(createdAt.getMonth() + 1).padStart(2, '0');
      const day = String(createdAt.getDate()).padStart(2, '0');
      createdAtText = `${y}-${m}-${day}`;
    }

    const certs = Array.isArray(d.certImages) ? d.certImages : [];

    return {
      _id: d._id,
      projectId: d.projectId || '',
      projectName: d.projectName || d.title || '爱心捐赠',
      amount: d.amount || 0,
      amountText: formatAmountYuan(d.amount || 0),
      status: d.status || 'completed',
      statusText: statusText(d.status || 'completed'),
      createdAt,
      createdAtText,
      certImages: certs,
    };
  });

  return {
    success: true,
    list,
  };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'listMyDonations';

  try {
    switch (action) {
      case 'listMyDonations':
      default:
        return await handleListMyDonations(event || {});
    }
  } catch (err) {
    console.error('donations error', action, err);
    return {
      success: false,
      error: err.message || '服务异常',
    };
  }
};

