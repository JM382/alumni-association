const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const eventsCol = db.collection('events');
const signupsCol = db.collection('event_signups');
const pointsLogsCol = db.collection('points_logs');
const SIGNUP_REWARD_POINTS = 10;

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

function formatTime(d) {
  if (!(d instanceof Date)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

async function findUserDocByUserId(userId) {
  if (!userId) return null;
  const byUserId = await usersCol.where({ user_id: userId }).limit(1).get();
  if (byUserId.data && byUserId.data.length > 0) return byUserId.data[0];
  // 兼容老数据：userId 可能就是 users._id
  try {
    const byDocId = await usersCol.doc(userId).get();
    return byDocId.data || null;
  } catch (e) {
    return null;
  }
}

async function applyPointsChange(userId, change, title, desc, source, extra) {
  const userDoc = await findUserDocByUserId(userId);
  if (!userDoc) return;

  const docId = userDoc._id;
  const oldBalance = typeof userDoc.pointsBalance === 'number' ? userDoc.pointsBalance : 0;
  const nextBalance = Math.max(0, oldBalance + change);
  const realChange = nextBalance - oldBalance;
  if (realChange === 0) return;

  await usersCol.doc(docId).update({
    data: {
      pointsBalance: nextBalance,
      pointsUpdatedAt: db.serverDate(),
    },
  });

  await pointsLogsCol.add({
    data: {
      userId,
      change: realChange,
      type: realChange > 0 ? 'earn' : 'spend',
      source,
      title,
      desc,
      extra: extra || {},
      createdAt: db.serverDate(),
    },
  });
}

async function handleListPublished(event) {
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const res = await eventsCol
    .where({ status: 'published' })
    .orderBy('startTime', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const list = (res.data || []).map((e) => ({
    _id: e._id,
    title: e.title || '',
    coverImage: e.coverImage || '',
    brief: e.brief || '',
    startTime: e.startTime || null,
    startTimeText: e.startTime ? formatTime(e.startTime) : '',
    location: e.location || '',
    participantCount: e.participantCount || 0,
    maxParticipants: e.maxParticipants || null,
  }));

  return { success: true, list };
}

async function handleGetDetail(event) {
  const eventId = (event.eventId || '').trim();
  if (!eventId) return { success: false, error: '缺少活动ID' };

  const res = await eventsCol.doc(eventId).get();
  if (!res.data) return { success: false, error: '活动不存在' };

  const d = res.data;
  return {
    success: true,
    data: {
      ...d,
      startTimeText: d.startTime ? formatTime(d.startTime) : '',
      endTimeText: d.endTime ? formatTime(d.endTime) : '',
    },
  };
}

async function handleCreateSignup(event) {
  const { userId } = await getCurrentUser();
  const eventId = (event.eventId || '').trim();
  const ticketId = (event.ticketId || '').trim();
  const realName = (event.realName || '').trim();
  const mobile = (event.mobile || '').trim();
  const peopleCount = Math.max(1, Number(event.peopleCount) || 1);
  const remark = (event.remark || '').trim();

  if (!eventId || !ticketId) return { success: false, error: '缺少活动或票种' };
  if (!realName || !mobile) return { success: false, error: '请填写姓名和手机号' };

  // 防重复报名：同一用户同一活动只允许一条有效报名
  const existRes = await signupsCol
    .where({
      eventId,
      userId,
      status: _.neq('canceled'),
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (existRes.data && existRes.data.length > 0) {
    return {
      success: false,
      error: '你已报名过该活动',
      signupId: existRes.data[0]._id,
    };
  }

  const evRes = await eventsCol.doc(eventId).get();
  const ev = evRes.data;
  if (!ev) return { success: false, error: '活动不存在' };
  if (ev.status !== 'published') return { success: false, error: '活动未开放报名' };

  const options = Array.isArray(ev.ticketOptions) ? ev.ticketOptions : [];
  const tk = options.find((t) => t.ticketId === ticketId);
  if (!tk) return { success: false, error: '票种不存在' };

  const amount = Number(tk.price) || 0;
  const now = db.serverDate();

  const addRes = await signupsCol.add({
    data: {
      eventId,
      userId,
      ticketId,
      ticketName: tk.name || '',
      amount,
      status: 'completed', // 暂不接支付，先视为已确认；接支付后在回调里改为 paid/completed
      realName,
      mobile,
      peopleCount,
      remark,
      signInStatus: 'not_signed',
      signInTime: null,
      // 扫码签到：先用 signupId 作为二维码内容（简单可靠）
      signInCode: '',
      createdAt: now,
      updatedAt: now,
      pointsAwarded: SIGNUP_REWARD_POINTS,
      pointsReverted: false,
      extra: {},
    },
  });

  // 写回 signInCode（使用 signupId）
  await signupsCol.doc(addRes._id).update({
    data: {
      signInCode: addRes._id,
      updatedAt: now,
    },
  });

  await eventsCol.doc(eventId).update({
    data: {
      participantCount: _.inc(peopleCount),
      updatedAt: now,
    },
  });

  await applyPointsChange(
    userId,
    SIGNUP_REWARD_POINTS,
    '活动报名',
    `报名活动《${ev.title || '活动'}》奖励${SIGNUP_REWARD_POINTS}积分`,
    'event_signup',
    { eventId, signupId: addRes._id }
  );

  return {
    success: true,
    signupId: addRes._id,
  };
}

async function handleCheckMySignup(event) {
  const { userId } = await getCurrentUser();
  const eventId = (event.eventId || '').trim();
  if (!eventId) return { success: false, error: '缺少活动ID' };

  const res = await signupsCol
    .where({
      eventId,
      userId,
      status: _.neq('canceled'),
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (res.data && res.data.length > 0) {
    const s = res.data[0];
    return {
      success: true,
      hasSignedUp: true,
      signupId: s._id,
      signInStatus: s.signInStatus || 'not_signed',
      status: s.status || 'completed',
    };
  }
  return { success: true, hasSignedUp: false };
}

async function handleGetMySignupDetail(event) {
  const { userId } = await getCurrentUser();
  const signupId = (event.signupId || '').trim();
  if (!signupId) return { success: false, error: '缺少报名ID' };

  const sRes = await signupsCol.doc(signupId).get();
  const s = sRes.data;
  if (!s) return { success: false, error: '报名记录不存在' };
  if (s.userId !== userId) return { success: false, error: '无权限' };

  const eRes = await eventsCol.doc(s.eventId).get();
  const ev = eRes.data || {};

  return {
    success: true,
    data: {
      signupId: s._id,
      eventId: s.eventId,
      title: ev.title || '',
      coverImage: ev.coverImage || '',
      startTimeText: ev.startTime ? formatTime(ev.startTime) : '',
      location: ev.location || '',
      ticketName: s.ticketName || '',
      amount: s.amount || 0,
      status: s.status || 'completed',
      realName: s.realName || '',
      mobile: s.mobile || '',
      peopleCount: s.peopleCount || 1,
      remark: s.remark || '',
      signInStatus: s.signInStatus || 'not_signed',
      signInTimeText: s.signInTime ? formatTime(s.signInTime) : '',
      signInCode: s.signInCode || '',
      protocolText: ev.protocolText || '',
    },
  };
}

async function handleListMyActivities(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const suRes = await signupsCol
    .where({ userId })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const signups = suRes.data || [];
  if (!signups.length) return { success: true, list: [] };

  const eventIds = [...new Set(signups.map((s) => s.eventId).filter(Boolean))];
  const evRes = await eventsCol.where({ _id: _.in(eventIds) }).get();
  const evMap = {};
  (evRes.data || []).forEach((e) => {
    evMap[e._id] = e;
  });

  const list = signups.map((s) => {
    const ev = evMap[s.eventId] || {};
    const createdAt = s.createdAt || null;
    return {
      signupId: s._id,
      eventId: s.eventId,
      title: ev.title || '',
      coverImage: ev.coverImage || '',
      startTimeText: ev.startTime ? formatTime(ev.startTime) : '',
      location: ev.location || '',
      ticketName: s.ticketName || '',
      status: s.status || 'completed',
      signInStatus: s.signInStatus || 'not_signed',
      signupTimeText: createdAt ? formatTime(createdAt) : '',
    };
  });

  return { success: true, list };
}

async function handleSignIn(event) {
  const { userId } = await getCurrentUser();
  const signupId = (event.signupId || '').trim();
  if (!signupId) return { success: false, error: '缺少报名ID' };

  const res = await signupsCol.doc(signupId).get();
  const s = res.data;
  if (!s) return { success: false, error: '报名记录不存在' };
  if (s.userId !== userId) return { success: false, error: '无权签到' };
  if (s.signInStatus === 'signed') return { success: false, error: '已签到' };

  await signupsCol.doc(signupId).update({
    data: {
      signInStatus: 'signed',
      signInTime: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });

  return { success: true };
}

async function handleCancelSignup(event) {
  const { userId } = await getCurrentUser();
  const signupId = (event.signupId || '').trim();
  if (!signupId) return { success: false, error: '缺少报名ID' };

  const sRes = await signupsCol.doc(signupId).get();
  const s = sRes.data;
  if (!s) return { success: false, error: '报名记录不存在' };
  if (s.userId !== userId) return { success: false, error: '无权限' };
  if (s.status === 'canceled') return { success: false, error: '该报名已取消' };
  if (s.signInStatus === 'signed') return { success: false, error: '已签到记录不可取消' };

  const now = db.serverDate();
  await signupsCol.doc(signupId).update({
    data: {
      status: 'canceled',
      updatedAt: now,
      canceledAt: now,
    },
  });

  const peopleCount = Math.max(1, Number(s.peopleCount) || 1);
  if (s.eventId) {
    await eventsCol.doc(s.eventId).update({
      data: {
        participantCount: _.inc(-peopleCount),
        updatedAt: now,
      },
    });
  }

  if (s.pointsAwarded && !s.pointsReverted) {
    await applyPointsChange(
      userId,
      -Math.abs(Number(s.pointsAwarded) || 0),
      '取消报名',
      '取消活动报名，回扣积分',
      'event_cancel',
      { eventId: s.eventId || '', signupId: s._id }
    );
    await signupsCol.doc(signupId).update({
      data: {
        pointsReverted: true,
        updatedAt: db.serverDate(),
      },
    });
  }

  return { success: true };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'listPublished';

  try {
    switch (action) {
      case 'listPublished':
        return await handleListPublished(event || {});
      case 'getDetail':
        return await handleGetDetail(event || {});
      case 'createSignup':
        return await handleCreateSignup(event || {});
      case 'checkMySignup':
        return await handleCheckMySignup(event || {});
      case 'listMyActivities':
        return await handleListMyActivities(event || {});
      case 'getMySignupDetail':
        return await handleGetMySignupDetail(event || {});
      case 'signIn':
        return await handleSignIn(event || {});
      case 'cancelSignup':
        return await handleCancelSignup(event || {});
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (err) {
    console.error('events error', action, err);
    return { success: false, error: err.message || '服务异常' };
  }
};

