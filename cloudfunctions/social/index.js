// 云函数 social：关注、私信、通讯录好友
// action: toggleFollow | getFollowStatus | ensureConversation | sendMessage | listMessages | markRead | listConversations | listContacts

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const followsCol = db.collection('follows');
const conversationsCol = db.collection('conversations');
const messagesCol = db.collection('messages');
const privacySettingsCol = db.collection('privacy_settings');
const authCol = db.collection('authApplications');

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

// 关注/取关
async function handleToggleFollow(event) {
  const { userId: fromUserId } = await getCurrentUser();
  const targetUserId = (event.targetUserId || '').trim();
  if (!targetUserId) return { success: false, error: '缺少对方用户' };
  if (fromUserId === targetUserId) return { success: false, error: '不能关注自己' };

  const followRes = await followsCol
    .where({
      fromUserId,
      toUserId: targetUserId,
    })
    .limit(1)
    .get();

  const now = db.serverDate();
  let following = true;

  if (followRes.data && followRes.data.length > 0) {
    const rec = followRes.data[0];
    if (rec.status === 'active') {
      await followsCol.doc(rec._id).update({
        data: { status: 'cancelled', updatedAt: now },
      });
      following = false;
    } else {
      await followsCol.doc(rec._id).update({
        data: { status: 'active', updatedAt: now },
      });
      following = true;
    }
  } else {
    await followsCol.add({
      data: {
        fromUserId,
        toUserId: targetUserId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    });
    following = true;
  }

  const reverseRes = await followsCol
    .where({
      fromUserId: targetUserId,
      toUserId: fromUserId,
      status: 'active',
    })
    .limit(1)
    .get();
  const isMutual = following && reverseRes.data && reverseRes.data.length > 0;

  return { success: true, following, isMutual };
}

// 查询关注状态
async function handleGetFollowStatus(event) {
  const { userId } = await getCurrentUser();
  const targetUserId = (event.targetUserId || '').trim();
  if (!targetUserId) return { success: false, error: '缺少对方用户' };

  const [myToTarget, targetToMe] = await Promise.all([
    followsCol
      .where({ fromUserId: userId, toUserId: targetUserId, status: 'active' })
      .limit(1)
      .get(),
    followsCol
      .where({ fromUserId: targetUserId, toUserId: userId, status: 'active' })
      .limit(1)
      .get(),
  ]);

  const following = myToTarget.data && myToTarget.data.length > 0;
  const followedBy = targetToMe.data && targetToMe.data.length > 0;
  const isMutual = following && followedBy;

  return { success: true, following, followedBy, isMutual };
}

// 获取或创建会话
async function handleEnsureConversation(event) {
  const { userId } = await getCurrentUser();
  const targetUserId = (event.targetUserId || '').trim();
  if (!targetUserId) return { success: false, error: '缺少对方用户' };
  if (userId === targetUserId) return { success: false, error: '不能和自己会话' };

  const sorted = [userId, targetUserId].sort();
  const existRes = await conversationsCol
    .where({
      type: 'private',
      userIds: sorted,
    })
    .limit(1)
    .get();

  if (existRes.data && existRes.data.length > 0) {
    const conv = existRes.data[0];
    const otherId = conv.userIds[0] === userId ? conv.userIds[1] : conv.userIds[0];
    const targetUser = await getUserBrief(otherId);
    return {
      success: true,
      conversationId: conv._id,
      targetUser: targetUser || { userId: otherId },
    };
  }

  const now = db.serverDate();
  const unreadMap = { [sorted[0]]: 0, [sorted[1]]: 0 };
  const addRes = await conversationsCol.add({
    data: {
      type: 'private',
      userIds: sorted,
      lastMessageText: '',
      lastMessageAt: now,
      lastMessageSenderId: '',
      unreadMap,
      createdAt: now,
      updatedAt: now,
    },
  });

  const otherId = sorted[0] === userId ? sorted[1] : sorted[0];
  const targetUser = await getUserBrief(otherId);

  return {
    success: true,
    conversationId: addRes._id,
    targetUser: targetUser || { userId: otherId },
  };
}

async function getUserBrief(userId) {
  const res = await usersCol.where({ user_id: userId }).limit(1).get();
  if (!res.data || res.data.length === 0) return null;
  const u = res.data[0];
  return {
    userId: resolveUserId(u),
    nickname: u.nickname || '用户',
    avatarUrl: u.avatarUrl || '',
    identity: u.identity || 'visitor',
  };
}

function toIdentityText(identity) {
  if (identity === 'alumni') return '校友';
  if (identity === 'company') return '企业用户';
  if (identity === 'expert') return '专家';
  return '游客';
}

function itemTimeMs(item) {
  if (!item || typeof item !== 'object') return 0;
  const t = item.updatedAt || item.createdAt;
  if (!t) return 0;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function buildIdentityTextFromAuth(baseIdentity, rows) {
  const tags = [];
  const pushUnique = (v) => {
    if (!v) return;
    if (!tags.includes(v)) tags.push(v);
  };
  pushUnique(toIdentityText(baseIdentity));
  const latestByCategory = {};
  (rows || []).forEach((row) => {
    if (!row || !row.category) return;
    const prev = latestByCategory[row.category];
    if (!prev || itemTimeMs(row) >= itemTimeMs(prev)) {
      latestByCategory[row.category] = row;
    }
  });
  if (latestByCategory.alumni && latestByCategory.alumni.status === 'approved') pushUnique('校友');
  if (latestByCategory.company && latestByCategory.company.status === 'approved') pushUnique('企业');
  if (latestByCategory.expert && latestByCategory.expert.status === 'approved') pushUnique('专家');
  const filtered = tags.filter((x) => x !== '游客');
  return filtered.length ? filtered.join('·') : '游客';
}

const PRIVACY_DEFAULT = {
  phoneVisible: false,
  emailVisible: true,
  workVisible: true,
};

async function getTargetPrivacyFlags(targetUserId) {
  const privRes = await privacySettingsCol.where({ userId: targetUserId }).limit(1).get();
  if (!privRes.data || !privRes.data.length) {
    return { ...PRIVACY_DEFAULT };
  }
  const row = privRes.data[0];
  return {
    phoneVisible: row.phoneVisible !== undefined ? !!row.phoneVisible : PRIVACY_DEFAULT.phoneVisible,
    emailVisible: row.emailVisible !== undefined ? !!row.emailVisible : PRIVACY_DEFAULT.emailVisible,
    workVisible: row.workVisible !== undefined ? !!row.workVisible : PRIVACY_DEFAULT.workVisible,
  };
}

// 个人主页资料（他人查看时按 privacy_settings 脱敏手机/邮箱；本人查看始终完整）
async function handleGetUserProfile(event) {
  const { userId: currentUserId } = await getCurrentUser();
  const targetUserId = (event.targetUserId || '').trim();
  if (!targetUserId) return { success: false, error: '缺少用户参数' };

  const res = await usersCol.where({ user_id: targetUserId }).limit(1).get();
  if (!res.data || res.data.length === 0) {
    return { success: false, error: '用户不存在' };
  }
  const u = res.data[0];
  const identity = u.identity || 'visitor';
  const isSelf = targetUserId === currentUserId;
  const openid = u.openid || '';

  const authConds = [];
  if (targetUserId) authConds.push({ userId: targetUserId });
  if (openid) authConds.push({ openid });
  let authRows = [];
  if (authConds.length) {
    const authRes = await authCol.where(_.or(authConds)).get();
    authRows = authRes.data || [];
  }

  let mobile = u.mobile || '';
  let email = u.email || '';
  let city = u.city || '';
  let mobileHidden = false;
  let emailHidden = false;
  let cityHidden = false;

  if (!isSelf) {
    const priv = await getTargetPrivacyFlags(targetUserId);
    if (!priv.phoneVisible) {
      if (u.mobile) mobileHidden = true;
      mobile = '';
    }
    if (!priv.emailVisible) {
      if (u.email) emailHidden = true;
      email = '';
    }
    if (!priv.workVisible) {
      if (u.city) cityHidden = true;
      city = '';
    }
  }

  return {
    success: true,
    isSelf,
    user: {
      userId: resolveUserId(u),
      nickname: u.nickname || u.nickName || '校友',
      avatarUrl: u.avatarUrl || '',
      identity,
      identityText: buildIdentityTextFromAuth(identity, authRows),
      schoolName: u.schoolName || '',
      major: u.major || '',
      enterYear: u.enterYear || '',
      graduationYear: u.graduationYear || '',
      membershipLevel: u.membershipLevel || '',
      membershipExpireAt: u.membershipExpireAt || null,
      city: city || '',
      mobile: mobile || '',
      email: email || '',
      mobileHidden,
      emailHidden,
      cityHidden,
    },
  };
}

// 发送私信
async function handleSendMessage(event) {
  const { userId } = await getCurrentUser();
  const conversationId = (event.conversationId || '').trim();
  const toUserId = (event.toUserId || '').trim();
  const contentType = event.contentType || 'text';
  const text = (event.text || '').trim();
  const media = Array.isArray(event.media) ? event.media : [];

  if (!conversationId) return { success: false, error: '缺少会话 id' };
  if (!toUserId) return { success: false, error: '缺少接收人' };
  if (contentType === 'text' && !text) return { success: false, error: '消息内容不能为空' };

  const convRes = await conversationsCol.doc(conversationId).get();
  if (!convRes.data) return { success: false, error: '会话不存在' };
  const conv = convRes.data;
  if (!conv.userIds || !conv.userIds.includes(userId)) return { success: false, error: '无权限' };
  if (!conv.userIds.includes(toUserId)) return { success: false, error: '接收人不在该会话中' };

  const now = db.serverDate();
  const summary = contentType === 'text' ? (text.length > 50 ? text.slice(0, 50) + '…' : text) : '[图片]';

  const unreadMap = conv.unreadMap || {};
  const cur = unreadMap[toUserId] || 0;
  unreadMap[toUserId] = cur + 1;

  const addMsgRes = await messagesCol.add({
    data: {
      conversationId,
      fromUserId: userId,
      toUserId,
      contentType,
      text,
      media,
      extra: event.extra || {},
      createdAt: now,
      status: 'normal',
    },
  });

  await conversationsCol.doc(conversationId).update({
    data: {
      lastMessageText: summary,
      lastMessageAt: now,
      lastMessageSenderId: userId,
      unreadMap,
      updatedAt: now,
    },
  });

  const msgDoc = {
    _id: addMsgRes._id,
    conversationId,
    fromUserId: userId,
    toUserId,
    contentType,
    text,
    media,
    createdAt: now,
    status: 'normal',
  };
  return { success: true, message: msgDoc };
}

// 消息列表（历史）
async function handleListMessages(event) {
  const { userId } = await getCurrentUser();
  const conversationId = (event.conversationId || '').trim();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(event.pageSize) || 20));

  if (!conversationId) return { success: false, error: '缺少会话 id' };

  const convRes = await conversationsCol.doc(conversationId).get();
  if (!convRes.data) return { success: false, error: '会话不存在' };
  if (!convRes.data.userIds || !convRes.data.userIds.includes(userId)) {
    return { success: false, error: '无权限' };
  }

  const skip = (page - 1) * pageSize;
  const res = await messagesCol
    .where({ conversationId, status: 'normal' })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const list = (res.data || []).map((m) => ({
    _id: m._id,
    fromUserId: m.fromUserId,
    toUserId: m.toUserId,
    contentType: m.contentType,
    text: m.text,
    media: m.media || [],
    createdAt: m.createdAt,
  }));

  return { success: true, list };
}

// 标记已读
async function handleMarkRead(event) {
  const { userId } = await getCurrentUser();
  const conversationId = (event.conversationId || '').trim();
  if (!conversationId) return { success: false, error: '缺少会话 id' };

  const convRes = await conversationsCol.doc(conversationId).get();
  if (!convRes.data) return { success: false, error: '会话不存在' };
  if (!convRes.data.userIds || !convRes.data.userIds.includes(userId)) {
    return { success: false, error: '无权限' };
  }

  const unreadMap = convRes.data.unreadMap || {};
  unreadMap[userId] = 0;

  await conversationsCol.doc(conversationId).update({
    data: {
      unreadMap,
      updatedAt: db.serverDate(),
    },
  });

  return { success: true };
}

// 会话列表
async function handleListConversations(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const res = await conversationsCol
    .where({
      type: 'private',
      userIds: userId,
    })
    .orderBy('lastMessageAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const rows = res.data || [];
  const list = [];
  for (const c of rows) {
    const otherId = c.userIds[0] === userId ? c.userIds[1] : c.userIds[0];
    const targetUser = await getUserBrief(otherId);
    list.push({
      conversationId: c._id,
      targetUser: targetUser || { userId: otherId },
      lastMessageText: c.lastMessageText || '',
      lastMessageAt: c.lastMessageAt,
      unread: (c.unreadMap && c.unreadMap[userId]) || 0,
    });
  }

  return { success: true, list };
}

// 通讯录：互相关注好友
async function handleListContacts(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(event.pageSize) || 50));
  const skip = (page - 1) * pageSize;

  const iFollowRes = await followsCol
    .where({ fromUserId: userId, status: 'active' })
    .get();
  const iFollowIds = (iFollowRes.data || []).map((r) => r.toUserId);
  if (iFollowIds.length === 0) {
    return { success: true, list: [] };
  }

  const followMeRes = await followsCol
    .where({
      toUserId: userId,
      fromUserId: _.in(iFollowIds),
      status: 'active',
    })
    .get();
  const mutualIds = (followMeRes.data || []).map((r) => r.fromUserId);
  mutualIds.sort();

  if (mutualIds.length === 0) {
    return { success: true, list: [] };
  }

  const pageIds = mutualIds.slice(skip, skip + pageSize);
  const usersRes = await usersCol
    .where({ user_id: _.in(pageIds) })
    .get();

  const list = (usersRes.data || []).map((u) => ({
    userId: resolveUserId(u),
    nickname: u.nickname || '校友',
    avatarUrl: u.avatarUrl || '',
    schoolName: u.schoolName || '',
    major: u.major || '',
    enterYear: u.enterYear || '',
    graduationYear: u.graduationYear || '',
    city: u.city || '',
  }));

  return { success: true, list };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || '';

  try {
    switch (action) {
      case 'getUserProfile':
        return await handleGetUserProfile(event);
      case 'toggleFollow':
        return await handleToggleFollow(event);
      case 'getFollowStatus':
        return await handleGetFollowStatus(event);
      case 'ensureConversation':
        return await handleEnsureConversation(event);
      case 'sendMessage':
        return await handleSendMessage(event);
      case 'listMessages':
        return await handleListMessages(event);
      case 'markRead':
        return await handleMarkRead(event);
      case 'listConversations':
        return await handleListConversations(event);
      case 'listContacts':
        return await handleListContacts(event);
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (err) {
    console.error('social error', action, err);
    return {
      success: false,
      error: err.message || '服务异常',
    };
  }
};
