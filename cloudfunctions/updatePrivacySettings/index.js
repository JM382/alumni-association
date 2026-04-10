// 云函数 updatePrivacySettings：读写 privacy_settings（每用户一条）
// action:
// - get：读取当前用户隐私开关（无记录则返回与前端一致的默认值，不落库）
// - 默认/省略 action：按 event 中的字段增量更新；无记录则 add
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const usersCol = db.collection('users');
const settingsCol = db.collection('privacy_settings');

const SETTING_KEYS = [
  'phoneVisible',
  'emailVisible',
  'workVisible',
  'searchable',
  'dmFromNonFriend',
  'circleFriendsOnly',
];

function defaultSettings() {
  return {
    phoneVisible: false,
    emailVisible: true,
    workVisible: true,
    searchable: true,
    dmFromNonFriend: true,
    circleFriendsOnly: false,
  };
}

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

async function handleGet(user_id) {
  const existRes = await settingsCol.where({ userId: user_id }).limit(1).get();
  if (existRes.data && existRes.data.length > 0) {
    const row = existRes.data[0];
    const out = { ...defaultSettings() };
    SETTING_KEYS.forEach((k) => {
      if (row[k] !== undefined) out[k] = !!row[k];
    });
    return { success: true, settings: out };
  }
  return { success: true, settings: defaultSettings() };
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { success: false, error: '未获取到用户身份' };
    }

    const userRes = await usersCol.where({ openid: OPENID }).limit(1).get();
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, error: '用户不存在' };
    }
    const user_id = resolveUserId(userRes.data[0]);

    if (event && event.action === 'get') {
      return await handleGet(user_id);
    }

    const dataToSet = {};
    SETTING_KEYS.forEach((key) => {
      if (event[key] !== undefined) {
        dataToSet[key] = !!event[key];
      }
    });
    dataToSet.updateTime = db.serverDate();

    const existRes = await settingsCol.where({ userId: user_id }).limit(1).get();
    if (existRes.data && existRes.data.length > 0) {
      const docId = existRes.data[0]._id;
      if (Object.keys(dataToSet).length > 1) {
        await settingsCol.doc(docId).update({ data: dataToSet });
      }
      const updated = await settingsCol.doc(docId).get();
      const row = updated.data;
      const out = { ...defaultSettings() };
      SETTING_KEYS.forEach((k) => {
        if (row[k] !== undefined) out[k] = !!row[k];
      });
      return { success: true, settings: out };
    }

    const base = defaultSettings();
    SETTING_KEYS.forEach((k) => {
      if (event[k] !== undefined) base[k] = !!event[k];
    });
    const newDoc = {
      userId: user_id,
      ...base,
      updateTime: db.serverDate(),
    };

    await settingsCol.add({ data: newDoc });
    return { success: true, settings: base };
  } catch (e) {
    console.error('updatePrivacySettings 异常', e);
    return { success: false, error: e.message || '更新失败' };
  }
};
