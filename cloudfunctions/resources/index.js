const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const authCol = db.collection('authApplications');
const postsCol = db.collection('resource_posts');
const commentsCol = db.collection('resource_comments');
const likesCol = db.collection('resource_likes');

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

function authItemTimeMs(item) {
  if (!item || typeof item !== 'object') return 0;
  const t = item.updatedAt || item.createdAt;
  if (!t) return 0;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function normalizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const s = url.trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('cloud://')) return s;
  return '';
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('未登录');

  const res = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!res.data || res.data.length === 0) throw new Error('用户不存在');

  const user = res.data[0];
  return { openid: OPENID, user, userId: resolveUserId(user) };
}

/**
 * 与 authApplications.handleMyStatus 一致：校友类取「非 canceled」里时间最新的一条，
 * 仅其为 approved 才允许发布（避免多条申请时仍命中历史 approved）
 */
async function hasAlumniPostPrivilege(user, openid) {
  const userId = resolveUserId(user);
  const orConds = [];
  if (userId) orConds.push({ userId });
  if (openid) orConds.push({ openid });
  if (!orConds.length) return false;
  const whereUser = orConds.length === 1 ? orConds[0] : _.or(orConds);

  const res = await authCol.where(whereUser).limit(100).get();
  const byId = new Map();
  (res.data || []).forEach((row) => {
    if (row && row._id) byId.set(row._id, row);
  });
  const mergedRows = Array.from(byId.values());
  const rows = mergedRows.filter((item) => item && item.category === 'alumni');
  if (!rows.length) return false;
  const active = rows.filter((item) => item.status !== 'canceled');
  const pool = active.length ? active : rows;
  let best = pool[0];
  pool.forEach((item) => {
    if (authItemTimeMs(item) >= authItemTimeMs(best)) best = item;
  });
  return !!(best && best.status === 'approved');
}

async function getUserBrief(userId) {
  const res = await usersCol.where({ user_id: userId }).limit(1).get();
  if (!res.data || res.data.length === 0) return null;
  const u = res.data[0];
  return {
    userId: resolveUserId(u),
    nickname: u.nickname || '校友',
    avatarUrl: normalizeAvatarUrl(u.avatarUrl || ''),
    identity: u.identity || 'visitor',
    enterYear: u.enterYear || '',
    major: u.major || '',
    schoolName: u.schoolName || '',
    city: u.city || '',
  };
}

function safeCategory(cat) {
  const c = (cat || '').trim();
  if (c === 'help' || c === 'publish') return c;
  return '';
}

async function handleCreatePost(event) {
  const { user, userId, openid } = await getCurrentUser();
  const canPost = await hasAlumniPostPrivilege(user, openid);
  if (!canPost) return { success: false, error: '请等待校友认证审核通过后再发布' };

  const category = safeCategory(event.category);
  const title = (event.title || '').trim();
  const content = (event.content || '').trim();
  const tag = (event.tag || '').trim();
  const contact = (event.contact || '').trim();
  const images = Array.isArray(event.images) ? event.images.filter(Boolean) : [];
  const video = event.video && typeof event.video === 'object' ? event.video : null;

  if (!category) return { success: false, error: '缺少分类' };
  if (!title) return { success: false, error: '请填写标题' };
  if (!content && images.length === 0 && !video) return { success: false, error: '请填写内容或选择图片/视频' };
  if (!contact) return { success: false, error: '请填写联系方式' };

  if (images.length > 9) return { success: false, error: '最多上传9张图片' };
  if (video && images.length > 0) return { success: false, error: '图片与视频不可同时发布' };

  const now = db.serverDate();
  const addRes = await postsCol.add({
    data: {
      category,
      userId,
      title,
      content,
      tag,
      contact,
      images,
      video: video || null,
      likeCount: 0,
      commentCount: 0,
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    },
  });
  return { success: true, postId: addRes._id };
}

async function handleListPosts(event) {
  const { userId } = await getCurrentUser(); // 至少登录才能看
  const category = safeCategory(event.category);
  const page = Math.max(1, Number(event.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = { status: 'normal' };
  if (category) where.category = category;

  const res = await postsCol.where(where).orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get();
  const rows = res.data || [];
  if (!rows.length) return { success: true, list: [] };

  const authorIds = [...new Set(rows.map((p) => p.userId).filter(Boolean))];
  const [usersRes, likesRes] = await Promise.all([
    usersCol.where({ user_id: _.in(authorIds) }).get(),
    likesCol.where({ userId, postId: _.in(rows.map((p) => p._id)) }).get(),
  ]);

  const userMap = {};
  (usersRes.data || []).forEach((u) => {
    userMap[resolveUserId(u)] = {
      userId: resolveUserId(u),
      nickname: u.nickname || '校友',
      avatarUrl: normalizeAvatarUrl(u.avatarUrl || ''),
      enterYear: u.enterYear || '',
      major: u.major || '',
    };
  });

  const likedSet = new Set((likesRes.data || []).map((l) => l.postId));

  const list = rows.map((p) => ({
    _id: p._id,
    category: p.category,
    userId: p.userId,
    user: userMap[p.userId] || { userId: p.userId, nickname: '校友', avatarUrl: '' },
    title: p.title || '',
    content: p.content || '',
    tag: p.tag || '',
    contact: p.contact || '',
    images: p.images || [],
    video: p.video || null,
    likeCount: p.likeCount || 0,
    commentCount: p.commentCount || 0,
    createdAt: p.createdAt || null,
    hasLiked: likedSet.has(p._id),
  }));

  return { success: true, list };
}

async function handleToggleLike(event) {
  const { userId } = await getCurrentUser();
  const postId = (event.postId || '').trim();
  if (!postId) return { success: false, error: '缺少资源ID' };

  const postRes = await postsCol.doc(postId).get();
  if (!postRes.data || postRes.data.status !== 'normal') return { success: false, error: '资源不存在' };

  const existRes = await likesCol.where({ postId, userId }).limit(1).get();
  const now = db.serverDate();

  if (existRes.data && existRes.data.length > 0) {
    await likesCol.doc(existRes.data[0]._id).remove();
    await postsCol.doc(postId).update({ data: { likeCount: _.inc(-1), updatedAt: now } });
    return { success: true, liked: false };
  }

  await likesCol.add({ data: { postId, userId, createdAt: now } });
  await postsCol.doc(postId).update({ data: { likeCount: _.inc(1), updatedAt: now } });
  return { success: true, liked: true };
}

async function handleGetPostDetail(event) {
  const { userId } = await getCurrentUser();
  const postId = (event.postId || '').trim();
  if (!postId) return { success: false, error: '缺少资源ID' };

  const postRes = await postsCol.doc(postId).get();
  const p = postRes.data;
  if (!p || p.status !== 'normal') return { success: false, error: '资源不存在' };

  const [author, likedRes, commentRes] = await Promise.all([
    getUserBrief(p.userId),
    likesCol.where({ postId, userId }).limit(1).get(),
    commentsCol.where({ postId, status: 'normal' }).orderBy('createdAt', 'asc').limit(200).get(),
  ]);

  const allComments = commentRes.data || [];
  const commenterIds = [...new Set(allComments.map((c) => c.userId).filter(Boolean))];
  const usersRes = commenterIds.length ? await usersCol.where({ user_id: _.in(commenterIds) }).get() : { data: [] };
  const userMap = {};
  (usersRes.data || []).forEach((u) => {
    userMap[resolveUserId(u)] = {
      userId: resolveUserId(u),
      nickname: u.nickname || '校友',
      avatarUrl: normalizeAvatarUrl(u.avatarUrl || ''),
    };
  });

  const roots = [];
  const childrenMap = {};
  for (const c of allComments) {
    const item = {
      _id: c._id,
      postId: c.postId,
      userId: c.userId,
      user: userMap[c.userId] || { userId: c.userId, nickname: '校友', avatarUrl: '' },
      content: c.content || '',
      parentId: c.parentId || '',
      replyToUserId: c.replyToUserId || '',
      createdAt: c.createdAt || null,
    };
    if (!item.parentId) roots.push(item);
    else {
      if (!childrenMap[item.parentId]) childrenMap[item.parentId] = [];
      childrenMap[item.parentId].push(item);
    }
  }
  roots.forEach((r) => {
    r.replies = childrenMap[r._id] || [];
  });

  return {
    success: true,
    post: {
      _id: p._id,
      category: p.category,
      userId: p.userId,
      user: author || { userId: p.userId, nickname: '校友', avatarUrl: '' },
      title: p.title || '',
      content: p.content || '',
      tag: p.tag || '',
      contact: p.contact || '',
      images: p.images || [],
      video: p.video || null,
      likeCount: p.likeCount || 0,
      commentCount: p.commentCount || 0,
      createdAt: p.createdAt || null,
      hasLiked: !!(likedRes.data && likedRes.data.length),
    },
    comments: roots,
  };
}

async function handleAddComment(event) {
  const { userId } = await getCurrentUser();
  const postId = (event.postId || '').trim();
  const content = (event.content || '').trim();
  const parentId = (event.parentId || '').trim();
  const replyToUserId = (event.replyToUserId || '').trim();
  if (!postId) return { success: false, error: '缺少资源ID' };
  if (!content) return { success: false, error: '评论内容不能为空' };

  const postRes = await postsCol.doc(postId).get();
  if (!postRes.data || postRes.data.status !== 'normal') return { success: false, error: '资源不存在' };

  const now = db.serverDate();
  await commentsCol.add({
    data: {
      postId,
      userId,
      content,
      parentId: parentId || '',
      replyToUserId: parentId ? replyToUserId : '',
      status: 'normal',
      createdAt: now,
    },
  });

  await postsCol.doc(postId).update({ data: { commentCount: _.inc(1), updatedAt: now } });
  return { success: true };
}

exports.main = async (event, context) => {
  const action = (event && event.action) || '';
  try {
    switch (action) {
      case 'createPost':
        return await handleCreatePost(event || {});
      case 'listPosts':
        return await handleListPosts(event || {});
      case 'toggleLike':
        return await handleToggleLike(event || {});
      case 'getPostDetail':
        return await handleGetPostDetail(event || {});
      case 'addComment':
        return await handleAddComment(event || {});
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (err) {
    console.error('resources error', action, err);
    return { success: false, error: err.message || '服务异常' };
  }
};

