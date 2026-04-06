const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const notificationsCol = db.collection('notifications');

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

function normalizeAvatarUrl(url) {
  const s = (url || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('cloud://')) return s;
  return '';
}

async function handleListInteractions(event) {
  const { userId } = await getCurrentUser();
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const res = await notificationsCol
    .where({
      userId,
      type: _.in(['like', 'comment', 'reply']),
    })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const list = res.data || [];
  const fromUserIds = [...new Set(list.map((n) => n.fromUserId).filter(Boolean))];
  let usersMap = {};
  if (fromUserIds.length) {
    const uRes = await usersCol.where({ user_id: _.in(fromUserIds) }).get();
    (uRes.data || []).forEach((u) => {
      const uid = u.user_id || u._id;
      usersMap[uid] = u;
    });
  }

  return {
    success: true,
    list: list.map((n) => {
      const from = usersMap[n.fromUserId] || {};
      return {
        _id: n._id,
        type: n.type,
        contentSnapshot: n.contentSnapshot || '',
        isRead: !!n.isRead,
        createdAtText: n.createdAt ? formatTime(n.createdAt) : '',
        fromUser: {
          userId: n.fromUserId || '',
          nickname: from.nickname || from.nickName || '校友',
          avatarUrl: normalizeAvatarUrl(from.avatarUrl || ''),
        },
        postId: n.postId || '',
      };
    }),
  };
}

async function handleUnreadCount() {
  const { userId } = await getCurrentUser();
  const res = await notificationsCol
    .where({
      userId,
      type: _.in(['like', 'comment', 'reply']),
      isRead: false,
    })
    .count();
  return { success: true, count: res.total || 0 };
}

async function handleMarkRead(event) {
  const { userId } = await getCurrentUser();
  const notificationId = (event.notificationId || '').trim();
  if (notificationId === 'all' || !notificationId) {
    await notificationsCol
      .where({
        userId,
        type: _.in(['like', 'comment', 'reply']),
        isRead: false,
      })
      .update({
        data: {
          isRead: true,
        },
      });
    return { success: true };
  }

  await notificationsCol.doc(notificationId).update({
    data: { isRead: true },
  });
  return { success: true };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || 'listInteractions';

  try {
    switch (action) {
      case 'listInteractions':
        return await handleListInteractions(event || {});
      case 'unreadCount':
        return await handleUnreadCount();
      case 'markRead':
        return await handleMarkRead(event || {});
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (err) {
    console.error('notifications error', action, err);
    return { success: false, error: err.message || '服务异常' };
  }
};

