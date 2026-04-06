// 云函数 authApplications：认证与申请（校友 / 企业 / 专家）
// action:
// - submit: 用户提交/更新申请
// - myStatus: 查询当前用户三类认证状态
// - myHistory: 查询当前用户历史申请
// - adminList: 管理端列表
// - adminDetail: 管理端单条详情
// - adminReview: 管理端审核操作（参数 reviewAction: approve | reject，勿用字段名 action 表示通过/打回）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const adminsCol = db.collection('admins');
const authCol = db.collection('authApplications');

const CATEGORIES = ['alumni', 'company', 'expert'];
const STATUSES = ['pending', 'approved', 'rejected', 'canceled'];
const CATEGORY_SCOPE_MAP = {
  alumni: 'alumni_audit',
  company: 'company_audit',
  expert: 'expert_audit',
};

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

function normalizeAdminProfile(adminDoc) {
  if (!adminDoc || typeof adminDoc !== 'object') return null;
  const level = adminDoc.level === 'super_admin' ? 'super_admin' : 'domain_admin';
  let scopes = [];
  if (Array.isArray(adminDoc.scopes)) {
    scopes = adminDoc.scopes.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  } else {
    // 兼容旧数据：未配置 scopes 时默认可审核三类申请
    scopes = ['alumni_audit', 'company_audit', 'expert_audit'];
  }
  return {
    ...adminDoc,
    level,
    scopes,
  };
}

function hasScope(admin, requiredScope) {
  if (!requiredScope) return true;
  if (!admin) return false;
  if (admin.level === 'super_admin') return true;
  return Array.isArray(admin.scopes) && admin.scopes.includes(requiredScope);
}

async function assertAdmin(requiredScope) {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error('未获取到用户身份');
  }
  const adminRes = await adminsCol
    .where({ openid: OPENID, disabled: _.neq(true), status: _.neq('disabled') })
    .limit(1)
    .get();
  if (!adminRes.data || adminRes.data.length === 0) {
    throw new Error('无管理员权限');
  }
  const admin = normalizeAdminProfile(adminRes.data[0]);
  if (!hasScope(admin, requiredScope)) {
    throw new Error('无该模块管理权限');
  }
  return admin;
}

async function handleMyAdminProfile() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: true, isAdmin: false };
  }
  const adminRes = await adminsCol
    .where({ openid: OPENID, disabled: _.neq(true), status: _.neq('disabled') })
    .limit(1)
    .get();
  if (!adminRes.data || adminRes.data.length === 0) {
    return { success: true, isAdmin: false };
  }
  const admin = normalizeAdminProfile(adminRes.data[0]);
  return {
    success: true,
    isAdmin: true,
    admin: {
      _id: admin._id,
      name: admin.name || '',
      level: admin.level,
      scopes: admin.scopes || [],
    },
  };
}

function validateCategory(category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error('不支持的认证类型');
  }
}

function itemTimeMs(item) {
  if (!item || typeof item !== 'object') return 0;
  const t = item.updatedAt || item.createdAt;
  if (!t) return 0;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** 同一 openid（或 userId）+ category 下仅保留更新时间最新的一条待审，用于管理端列表 */
function dedupePendingLatest(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const uid = item.openid || item.userId || '';
    const key = `${uid}__${item.category || ''}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      return;
    }
    if (itemTimeMs(item) > itemTimeMs(prev)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values()).sort((a, b) => itemTimeMs(b) - itemTimeMs(a));
}

/**
 * 提交前合并同一用户同一类的多条记录：只更新「最新」一条为待审，其余 pending 标记为 canceled
 */
async function collapseDuplicatePendingOnSubmit({ userId, openid, category, keepId, now }) {
  const dupRes = await authCol
    .where(
      _.or([
        { userId, category },
        { openid, category },
      ])
    )
    .get();
  const byId = new Map();
  (dupRes.data || []).forEach((r) => {
    if (r && r._id) byId.set(r._id, r);
  });
  const rows = Array.from(byId.values()).sort((a, b) => itemTimeMs(b) - itemTimeMs(a));

  const cancelRemark = '已被新申请覆盖';
  const tasks = [];
  rows.forEach((r) => {
    if (!r || r._id === keepId) return;
    if (r.status !== 'pending') return;
    tasks.push(
      authCol.doc(r._id).update({
        data: {
          status: 'canceled',
          remarks: cancelRemark,
          updatedAt: now,
        },
      })
    );
  });
  if (tasks.length) {
    await Promise.all(tasks);
  }
}

/**
 * 管理员完成审核后，自动作废同一用户同一类型下其余 pending，
 * 防止“通过后待审核仍出现同用户同类型另一条记录”。
 */
async function collapseDuplicatePendingAfterReview({ record, keepId, adminId, now, reviewAction }) {
  if (!record || !record.category) return;
  const conds = [];
  if (record.userId) conds.push({ userId: record.userId, category: record.category, status: 'pending' });
  if (record.openid) conds.push({ openid: record.openid, category: record.category, status: 'pending' });
  if (!conds.length) return;

  const res = await authCol.where(_.or(conds)).get();
  const map = new Map();
  (res.data || []).forEach((row) => {
    if (row && row._id) map.set(row._id, row);
  });
  const rows = Array.from(map.values());
  const remark =
    reviewAction === 'approve'
      ? '同类申请已审核通过，重复待审已自动作废'
      : '同类申请已审核打回，重复待审已自动作废';
  const tasks = rows
    .filter((row) => row && row._id !== keepId && row.status === 'pending')
    .map((row) =>
      authCol.doc(row._id).update({
        data: {
          status: 'canceled',
          reviewerId: adminId || '',
          reviewTime: now,
          updatedAt: now,
          remarks: remark,
          rejectReason: '',
        },
      })
    );
  if (tasks.length) {
    await Promise.all(tasks);
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

  const now = db.serverDate();
  // 规则：每个用户每个认证类型只保留 1 条「当前有效」记录；按更新时间取最新一条更新，其余 pending 置为 canceled
  const existRes = await authCol
    .where(
      _.or([
        { userId, category },
        { openid, category },
      ])
    )
    .get();
  const byId = new Map();
  (existRes.data || []).forEach((r) => {
    if (r && r._id) byId.set(r._id, r);
  });
  const rows = Array.from(byId.values()).sort((a, b) => itemTimeMs(b) - itemTimeMs(a));

  if (rows.length > 0) {
    const rec = rows[0];
    // 先作废其余 pending，再更新本条，避免 canceled 与 pending 时间戳相同时 myStatus 误选
    await collapseDuplicatePendingOnSubmit({ userId, openid, category, keepId: rec._id, now });
    await authCol.doc(rec._id).update({
      data: {
        openid,
        userId,
        status: 'pending',
        updatedAt: now,
        reviewerId: '',
        reviewTime: null,
        rejectReason: '',
        remarks: '',
        ...infoPatch,
      },
    });
    return { success: true, applicationId: rec._id, updated: true };
  }

  const doc = {
    userId,
    openid,
    category,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    reviewerId: '',
    reviewTime: null,
    rejectReason: '',
    remarks: '',
    ...infoPatch,
  };
  const addRes = await authCol.add({ data: doc });
  await collapseDuplicatePendingOnSubmit({ userId, openid, category, keepId: addRes._id, now });
  return { success: true, applicationId: addRes._id, created: true };
}

async function handleMyStatus() {
  const { userId, openid } = await getCurrentUser();
  const res = await authCol
    .where(
      _.or([
        { userId },
        { openid },
      ])
    )
    .get();
  const byId = new Map();
  (res.data || []).forEach((row) => {
    if (row && row._id) byId.set(row._id, row);
  });
  const mergedRows = Array.from(byId.values());

  const empty = { status: 'none' };
  const data = {
    alumni: { ...empty },
    company: { ...empty },
    expert: { ...empty },
  };

  // 同一类：优先展示「非 canceled」记录里更新时间最新的一条；若仅剩 canceled 再展示
  const picked = {};
  CATEGORIES.forEach((cat) => {
    const rows = mergedRows.filter((item) => item && item.category === cat);
    if (!rows.length) return;
    const active = rows.filter((item) => item.status !== 'canceled');
    const pool = active.length ? active : rows;
    let best = pool[0];
    pool.forEach((item) => {
      if (itemTimeMs(item) >= itemTimeMs(best)) best = item;
    });
    picked[cat] = best;
  });

  Object.keys(picked).forEach((k) => {
    const item = picked[k];
    data[item.category] = {
      _id: item._id,
      category: item.category,
      status: item.status,
      rejectReason: item.rejectReason || '',
      reviewTime: item.reviewTime || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  return {
    success: true,
    data,
  };
}

async function handleMyHistory(event) {
  const { userId, openid } = await getCurrentUser();
  const { category } = event;
  const userCond = _.or([{ userId }, { openid }]);
  if (category) {
    validateCategory(category);
  }
  // 规则：每类只会有 1 条；兼容旧数据时也只返回最新一条，便于回填
  const query = category
    ? authCol.where(_.and([userCond, { category }]))
    : authCol.where(userCond);
  const res = await query.orderBy('updatedAt', 'desc').limit(1).get();

  // 兼容旧数据：若历史记录未按 alumniInfo/companyInfo/expertInfo 存储，则补齐对应字段
  const list = (res.data || []).map((r) => {
    if (!r || typeof r !== 'object') return r;
    if (r.category === 'alumni' && (!r.alumniInfo || typeof r.alumniInfo !== 'object')) {
      const keys = [
        'realName',
        'studentId',
        'school',
        'college',
        'major',
        'degree',
        'enterYear',
        'gradYear',
        'campus',
        'contactMobile',
        'contactEmail',
        'certImages',
        'extra',
      ];
      const alumniInfo = {};
      keys.forEach((k) => {
        if (r[k] !== undefined) alumniInfo[k] = r[k];
      });
      return { ...r, alumniInfo };
    }
    if (r.category === 'company' && (!r.companyInfo || typeof r.companyInfo !== 'object')) {
      const keys = [
        'companyName',
        'uscc',
        'licenseImage',
        'industry',
        'scale',
        'city',
        'address',
        'contactName',
        'contactMobile',
        'contactEmail',
        'position',
        'website',
        'extra',
      ];
      const companyInfo = {};
      keys.forEach((k) => {
        if (r[k] !== undefined) companyInfo[k] = r[k];
      });
      return { ...r, companyInfo };
    }
    if (r.category === 'expert' && (!r.expertInfo || typeof r.expertInfo !== 'object')) {
      const keys = [
        'realName',
        'organization',
        'title',
        'fieldTags',
        'city',
        'resume',
        'experienceYears',
        'contactMobile',
        'contactEmail',
        'certImages',
        'extra',
      ];
      const expertInfo = {};
      keys.forEach((k) => {
        if (r[k] !== undefined) expertInfo[k] = r[k];
      });
      return { ...r, expertInfo };
    }
    return r;
  });

  return {
    success: true,
    list,
  };
}

async function handleAdminList(event) {
  const admin = await assertAdmin();
  const { category, status, page = 1, pageSize = 20 } = event;

  const where = {};
  if (category) {
    validateCategory(category);
    const requiredScope = CATEGORY_SCOPE_MAP[category];
    if (!hasScope(admin, requiredScope)) {
      throw new Error('无该类型审核权限');
    }
    where.category = category;
  }
  if (status) {
    if (!STATUSES.includes(status)) {
      throw new Error('不支持的状态');
    }
    where.status = status;
  }

  const skip = (page - 1) * pageSize;

  // 待审核：同一 openid + 分类仅展示一条（更新时间最新）；数据库未维护 latest 字段，勿用 latestOnly 过滤
  if (status === 'pending') {
    const listRes = await authCol
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    let list = dedupePendingLatest(listRes.data || []);
    const total = list.length;
    list = list.slice(skip, skip + pageSize);
    return {
      success: true,
      adminId: admin._id,
      list,
      total,
    };
  }

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
  const admin = await assertAdmin();
  const { applicationId } = event;
  if (!applicationId) {
    throw new Error('缺少 applicationId');
  }
  const res = await authCol.doc(applicationId).get();
  if (!res.data) {
    throw new Error('申请不存在');
  }
  const requiredScope = CATEGORY_SCOPE_MAP[res.data.category];
  if (!hasScope(admin, requiredScope)) {
    throw new Error('无该类型审核权限');
  }
  return {
    success: true,
    data: res.data,
  };
}

async function handleAdminReview(event) {
  const admin = await assertAdmin();
  const { applicationId, rejectReason = '', remarks = '' } = event;
  // 使用 reviewAction，勿与云函数路由字段 action（值为 adminReview）同名，否则会被覆盖
  const reviewAction = event.reviewAction;
  if (!applicationId) {
    throw new Error('缺少 applicationId');
  }
  if (!['approve', 'reject'].includes(reviewAction)) {
    throw new Error('不支持的审核操作');
  }

  const record = await authCol.doc(applicationId).get();
  if (!record.data) {
    throw new Error('申请不存在');
  }
  if (record.data.status !== 'pending') {
    throw new Error('仅待审核状态可操作');
  }
  const requiredScope = CATEGORY_SCOPE_MAP[record.data.category];
  if (!hasScope(admin, requiredScope)) {
    throw new Error('无该类型审核权限');
  }

  const now = db.serverDate();
  const updateData = {
    updatedAt: now,
    reviewTime: now,
    reviewerId: admin._id,
    remarks: remarks || '',
  };
  if (reviewAction === 'approve') {
    updateData.status = 'approved';
    updateData.rejectReason = '';
  } else {
    updateData.status = 'rejected';
    updateData.rejectReason = rejectReason || '资料不符合要求';
  }

  await authCol.doc(applicationId).update({
    data: updateData,
  });

  // 审核后清理同一用户同一类型的其他 pending，避免再次在待审核中出现
  await collapseDuplicatePendingAfterReview({
    record: record.data,
    keepId: applicationId,
    adminId: admin._id,
    now,
    reviewAction,
  });

  // 审核通过后同步 users 身份字段，保证前台“我的”等展示实时变化
  if (reviewAction === 'approve') {
    const userId = record.data.userId;
    const openid = record.data.openid || '';
    const userWhere = userId ? { user_id: userId } : openid ? { openid } : null;
    if (userWhere) {
      if (record.data.category === 'alumni') {
        const info = record.data.alumniInfo || {};
        const school = info.school || '';
        await usersCol
          .where(userWhere)
          .update({
            data: {
              identity: 'alumni',
              schoolName: school,
              major: info.major || '',
              enterYear: info.enterYear || '',
              realName: info.realName || '',
              graduationYear: info.gradYear || '',
            },
          });
      } else if (record.data.category === 'company') {
        await usersCol
          .where(userWhere)
          .update({
            data: {
              identity: 'company',
            },
          });
      } else if (record.data.category === 'expert') {
        await usersCol
          .where(userWhere)
          .update({
            data: {
              identity: 'expert',
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
      case 'myAdminProfile':
        return await handleMyAdminProfile();
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

