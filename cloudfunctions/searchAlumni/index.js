const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    const {
      schoolName = '',
      major = '',
      enterYear = '',
      page = 1,
      pageSize = 20,
    } = event || {};

    const where = {
      identity: 'alumni',
    };

    if (schoolName) {
      where.schoolName = schoolName;
    }
    if (major) {
      where.major = major;
    }
    if (enterYear) {
      where.enterYear = enterYear;
    }

    const limit = Math.max(1, Math.min(100, pageSize));
    const skip = Math.max(0, (page - 1) * limit);

    const res = await db
      .collection('users')
      .where(where)
      .orderBy('enterYear', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    const list = (res.data || []).map((u) => ({
      userId: u.user_id || '',
      nickname: u.nickname || '校友',
      avatarUrl: u.avatarUrl || '',
      schoolName: u.schoolName || '',
      major: u.major || '',
      enterYear: u.enterYear || '',
      graduationYear: u.graduationYear || '',
      city: u.city || '',
    }));

    return {
      success: true,
      list,
    };
  } catch (err) {
    console.error('searchAlumni error', err);
    return {
      success: false,
      error: err.message || '查询失败',
    };
  }
};

