// 云函数 login：微信一键登录，用户写入 users 集合，并为每个用户生成唯一 user_id
// 返回格式：{ success: true, user: { user_id, ... } } 或 { success: false, error: string }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const usersCollection = db.collection('users');

// 生成唯一 user_id，供本用户及后续 orders、contacts 等集合归属使用
function generateUserId() {
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// 从 user 文档中取出对外暴露的 user_id（优先 user_id 字段，兼容旧数据用 _id）
function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

// 将 user 文档转成返回给前端的对象（含 user_id）
function toUserPayload(user) {
  if (!user) return null;
  const userId = resolveUserId(user);
  return {
    _id: user._id,
    user_id: userId,
    openid: user.openid,
    nickname: user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    schoolId: user.schoolId || '',
    schoolName: user.schoolName || '',
    major: user.major || '',
    graduationYear: user.graduationYear || '',
    bio: user.bio || '',
    createTime: user.createTime,
    lastLoginTime: user.lastLoginTime,
  };
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取用户标识' };
    }

    const nickname = event.nickname || '';
    const avatarUrl = event.avatarUrl || '';

    const queryRes = await usersCollection.where({ openid }).limit(1).get();

    if (queryRes.data.length > 0) {
      const userDoc = queryRes.data[0];
      const docId = userDoc._id;
      const updateData = { lastLoginTime: db.serverDate() };

      // 老用户若没有 user_id，在本次登录时补上，后续所有集合按 user_id 归属
      if (!userDoc.user_id) {
        updateData.user_id = userDoc._id; // 用 _id 作为 user_id，保证唯一
      }
      if (!userDoc.nickname && nickname) {
        updateData.nickname = nickname;
      }
      if (!userDoc.avatarUrl && avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      await usersCollection.doc(docId).update({ data: updateData });
      const updated = await usersCollection.doc(docId).get();
      const user = updated.data;
      return {
        success: true,
        user: toUserPayload(user),
      };
    }

    // 新用户：创建时即写入唯一 user_id，并写入微信头像、昵称（有则填）
    const user_id = generateUserId();
    await usersCollection.add({
      data: {
        openid,
        user_id,
        nickname: nickname || '微信用户',
        avatarUrl: avatarUrl || '',
        schoolId: '',
        schoolName: '',
        major: '',
        graduationYear: '',
        bio: '',
        createTime: db.serverDate(),
        lastLoginTime: db.serverDate(),
      },
    });

    // 用 openid 再查一次拿到刚创建的文档（避免依赖 add 返回的 _id 结构）
    const afterAdd = await usersCollection.where({ openid }).limit(1).get();
    if (!afterAdd.data || afterAdd.data.length === 0) {
      return { success: false, error: '创建用户后查询失败' };
    }
    const newUser = afterAdd.data[0];
    return {
      success: true,
      user: toUserPayload(newUser),
    };
  } catch (err) {
    console.error('login 云函数异常：', err);
    return {
      success: false,
      error: err.message || '登录失败',
    };
  }
};
