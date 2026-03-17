// 云函数 authApplications：认证与申请（校友 / 企业 / 专家）
// action:
// - submit: 用户提交/更新申请
// - myStatus: 查询当前用户三类认证状态
// - myHistory: 查询当前用户历史申请
// - adminList: 管理端列表
// - adminDetail: 管理端单条详情
// - adminReview: 管理端审核操作

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const adminsCol = db.collection('admins');
const authCol = db.collection('authApplications');

const CATEGORIES = ['alumni', 'company', 'expert'];
const STATUSES = ['pending', 'approved', 'rejected', 'canceled'];
const ALUMNI_SCHOOLS = [
  '国防科技大学',
  '哈尔滨工程大学',
  '南京理工大学',
  '西北工业大学',
  '陆军工程大学',
  '陆军兵种大学',
  '陆军防化学院',
  '海军工程大学',
  '空军工程大学',
  '中航工业空气动力研究院',
];

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error('未获取到用户身份');
  }
  const userRes = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!userRes.data || userRes.data.length === 0) {
    throw new Error('用户不存在');
  }
  const user = userRes.data[0];
  return {
    openid: OPENID,
    user,
    userId: resolveUserId(user),
  };
}

async function assertAdmin() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error('未获取到用户身份');
  }
  const adminRes = await adminsCol.where({ openid: OPENID, disabled: _.neq(true) }).limit(1).get();
  if (!adminRes.data || adminRes.data.length === 0) {
    throw new Error('无管理员权限');
  }
  return adminRes.data[0];
}

function validateCategory(category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error('不支持的认证类型');
  }
}

function buildPayloadByCategory(category, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('缺少认证信息');
  }
  if (category === 'alumni') {
    const required = ['realName', 'studentId', 'college', 'major', 'enterYear', 'contactMobile', 'contactEmail'];
    required.forEach((k) => {
      if (!payload[k]) {
        throw new Error(`请填写完整校友信息：缺少 ${k}`);
      }
    });
    return { alumniInfo: payload };
  }
  if (category === 'company') {
    const required = ['companyName', 'uscc', 'licenseImage', 'contactName', 'contactMobile'];
    required.forEach((k) => {
      if (!payload[k]) {
        throw new Error(`请填写完整企业信息：缺少 ${k}`);
      }
    });
    return { companyInfo: payload };
  }
  if (category === 'expert') {
    const required = ['realName', 'organization', 'title', 'contactMobile', 'contactEmail'];
    required.forEach((k) => {
      if (!payload[k]) {
        throw new Error(`请填写完整专家信息：缺少 ${k}`);
      }
    });
    return { expertInfo: payload };
  }
  throw new Error('不支持的认证类型');
}

async function handleSubmit(event) {
  const { category, payload } = event;
  validateCategory(category);
  const { userId, openid } = await getCurrentUser();

  const infoPatch = buildPayloadByCategory(category, payload);

  await authCol.where({ userId, category, latest: true }).update({
    data: {
      latest: false,
    },
  });

  const now = db.serverDate();
  const doc = {
    userId,
    openid,
    category,
    status: 'pending',
    latest: true,
    createdAt: now,
    updatedAt: now,
    reviewerId: '',
    reviewTime: null,
    rejectReason: '',
    remarks: '',
    ...infoPatch,
  };

  const addRes = await authCol.add({ data: doc });
  return {
    success: true,
    applicationId: addRes._id,
  };
}

async function handleMyStatus() {
  const { userId } = await getCurrentUser();
  const res = await authCol
    .where({
      userId,
      latest: true,
    })
    .get();

  const empty = { status: 'none' };
  const data = {
    alumni: { ...empty },
    company: { ...empty },
    expert: { ...empty },
  };

  (res.data || []).forEach((item) => {
    if (!CATEGORIES.includes(item.category)) return;
    data[item.category] = {
      _id: item._id,
      category: item.category,
      status: item.status,
      rejectReason: item.rejectReason || '',
      reviewTime: item.reviewTime || null,
      createdAt: item.createdAt,
    };
  });

  return {
    success: true,
    data,
  };
}

async function handleMyHistory(event) {
  const { userId } = await getCurrentUser();
  const { category } = event;
  const where = { userId };
  if (category) {
    validateCategory(category);
    where.category = category;
  }
  const res = await authCol
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return {
    success: true,
    list: res.data || [],
  };
}

async function handleAdminList(event) {
  const admin = await assertAdmin();
  const { category, status, page = 1, pageSize = 20, latestOnly = true } = event;

  const where = {};
  if (category) {
    validateCategory(category);
    where.category = category;
  }
  if (status) {
    if (!STATUSES.includes(status)) {
      throw new Error('不支持的状态');
    }
    where.status = status;
  }
  if (latestOnly) {
    where.latest = true;
  }

  const skip = (page - 1) * pageSize;

  const [listRes, countRes] = await Promise.all([
    authCol
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get(),
    authCol.where(where).count(),
  ]);

  return {
    success: true,
    adminId: admin._id,
    list: listRes.data || [],
    total: countRes.total || 0,
  };
}

async function handleAdminDetail(event) {
  await assertAdmin();
  const { applicationId } = event;
  if (!applicationId) {
    throw new Error('缺少 applicationId');
  }
  const res = await authCol.doc(applicationId).get();
  if (!res.data) {
    throw new Error('申请不存在');
  }
  return {
    success: true,
    data: res.data,
  };
}

async function handleAdminReview(event) {
  const admin = await assertAdmin();
  const { applicationId, action, rejectReason = '', remarks = '' } = event;
  if (!applicationId) {
    throw new Error('缺少 applicationId');
  }
  if (!['approve', 'reject'].includes(action)) {
    throw new Error('不支持的审核操作');
  }

  const record = await authCol.doc(applicationId).get();
  if (!record.data) {
    throw new Error('申请不存在');
  }
  if (record.data.status !== 'pending') {
    throw new Error('仅待审核状态可操作');
  }

  const now = db.serverDate();
  const updateData = {
    updatedAt: now,
    reviewTime: now,
    reviewerId: admin._id,
    remarks: remarks || '',
  };
  if (action === 'approve') {
    updateData.status = 'approved';
    updateData.rejectReason = '';
  } else {
    updateData.status = 'rejected';
    updateData.rejectReason = rejectReason || '资料不符合要求';
  }

  await authCol.doc(applicationId).update({
    data: updateData,
  });

  // 若是校友认证且审核通过，且学校在哈军工九校一院名单中，则把用户身份从游客升级为校友
  if (action === 'approve' && record.data.category === 'alumni') {
    const info = record.data.alumniInfo || {};
    const school = info.school || '';
    if (school && ALUMNI_SCHOOLS.includes(school)) {
      const userId = record.data.userId;
      if (userId) {
        await usersCol
          .where({
            user_id: userId,
          })
          .update({
            data: {
              identity: 'alumni',
              schoolName: school,     // 所属学校
            },
          });
      }
    }
  }

  return {
    success: true,
  };
}

exports.main = async (event, context) => {
  try {
    const { action } = event;
    if (!action) {
      throw new Error('缺少 action');
    }
    switch (action) {
      case 'submit':
        return await handleSubmit(event);
      case 'myStatus':
        return await handleMyStatus();
      case 'myHistory':
        return await handleMyHistory(event);
      case 'adminList':
        return await handleAdminList(event);
      case 'adminDetail':
        return await handleAdminDetail(event);
      case 'adminReview':
        return await handleAdminReview(event);
      default:
        throw new Error('不支持的 action');
    }
  } catch (e) {
    console.error('authApplications 异常', e);
    return {
      success: false,
      error: e.message || '请求失败',
    };
  }
};

