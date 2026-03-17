// 云函数 circle：校友圈动态相关接口
// action:
// - createPost: 发表动态（仅校友）
// - listPosts: 动态列表（含发帖人信息、当前用户是否点赞）
// - toggleLike: 点赞 / 取消点赞

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const postsCol = db.collection('circle_posts');
const likesCol = db.collection('circle_likes');
const notificationsCol = db.collection('notifications');

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

// 发表动态（仅校友）
async function handleCreatePost(event) {
  const { user, userId, openid } = await getCurrentUser();
  const identity = user.identity || 'visitor';
  if (identity !== 'alumni') {
    return { success: false, error: '仅校友可发布动态' };
  }

  const content = (event.content || '').trim();
  const images = Array.isArray(event.images) ? event.images.slice(0, 9) : [];
  const video = event.video || '';

  if (!content && images.length === 0 && !video) {
    return { success: false, error: '内容不能为空' };
  }

  const now = db.serverDate();
  const doc = {
    userId,
    openid,
    content,
    images,
    video,
    createdAt: now,
    updatedAt: now,
    visible: true,
    likeCount: 0,
    commentCount: 0,
    location: event.location || '',
    onlyAlumni: false,
    extra: {},
  };

  const addRes = await postsCol.add({ data: doc });
  return {
    success: true,
    postId: addRes._id,
  };
}

// 获取动态列表（含发帖人基本信息和当前用户是否点赞）
async function handleListPosts(event) {
  const { userId } = await getCurrentUser();
  const page = Number(event.page) > 0 ? Number(event.page) : 1;
  const pageSize = Number(event.pageSize) > 0 ? Number(event.pageSize) : 10;
  const skip = (page - 1) * pageSize;

  const postsRes = await postsCol
    .where({ visible: true })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const posts = postsRes.data || [];
  if (posts.length === 0) {
    return { success: true, list: [], total: 0 };
  }

  const userIds = [...new Set(posts.map((p) => p.userId).filter(Boolean))];
  const postIds = posts.map((p) => p._id);

  // 查询发帖人信息
  let usersMap = {};
  if (userIds.length) {
    const usersRes = await usersCol.where({ user_id: _.in(userIds) }).get();
    (usersRes.data || []).forEach((u) => {
      const uid = u.user_id || u._id;
      usersMap[uid] = u;
    });
  }

  // 查询当前用户对这些动态的点赞情况
  const likesRes = await likesCol
    .where({
      userId,
      postId: _.in(postIds),
    })
    .get();
  const likedSet = new Set((likesRes.data || []).map((l) => l.postId));

  const list = posts.map((p) => {
    const author = usersMap[p.userId] || {};
    return {
      _id: p._id,
      content: p.content,
      images: p.images || [],
      createdAt: p.createdAt,
      likeCount: p.likeCount || 0,
      commentCount: p.commentCount || 0,
      hasLiked: likedSet.has(p._id),
      user: {
        nickname: author.nickname || author.nickName || '校友',
        avatarUrl: author.avatarUrl || '',
        enterYear: author.enterYear || '',
        major: author.major || '',
      },
    };
  });

  return {
    success: true,
    list,
  };
}

// 点赞 / 取消点赞
async function handleToggleLike(event) {
  const { userId, user } = await getCurrentUser();
  const { postId } = event;
  if (!postId) throw new Error('缺少 postId');

  const likeRes = await likesCol
    .where({
      postId,
      userId,
    })
    .limit(1)
    .get();

  let liked = false;

  if (!likeRes.data || likeRes.data.length === 0) {
    // 新增点赞
    const now = db.serverDate();
    await likesCol.add({
      data: {
        postId,
        userId,
        openid: user.openid,
        createdAt: now,
      },
    });
    await postsCol.doc(postId).update({
      data: {
        likeCount: _.inc(1),
      },
    });
    liked = true;

    // 生成点赞通知
    const postDoc = await postsCol.doc(postId).get();
    if (postDoc.data) {
      const targetUserId = postDoc.data.userId;
      if (targetUserId && targetUserId !== userId) {
        await notificationsCol.add({
          data: {
            userId: targetUserId,
            type: 'like',
            fromUserId: userId,
            postId,
            commentId: null,
            contentSnapshot: `${user.nickname || '一位校友'} 赞了你的动态`,
            isRead: false,
            createdAt: now,
            extra: {},
          },
        });
      }
    }
  } else {
    // 取消点赞
    const likeId = likeRes.data[0]._id;
    await likesCol.doc(likeId).remove();
    await postsCol.doc(postId).update({
      data: {
        likeCount: _.inc(-1),
      },
    });
    liked = false;
  }

  return {
    success: true,
    liked,
  };
}

exports.main = async (event, context) => {
  try {
    const { action } = event;
    if (!action) throw new Error('缺少 action');

    switch (action) {
      case 'createPost':
        return await handleCreatePost(event);
      case 'listPosts':
        return await handleListPosts(event);
      case 'toggleLike':
        return await handleToggleLike(event);
      default:
        throw new Error('不支持的 action');
    }
  } catch (e) {
    console.error('circle 异常', e);
    return {
      success: false,
      error: e.message || '请求失败',
    };
  }
};

