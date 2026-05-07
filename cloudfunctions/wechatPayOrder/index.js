const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const usersCol = db.collection('users');
const payOrdersCol = db.collection('wechat_pay_orders');
const membershipOrdersCol = db.collection('membership_orders');
const signupsCol = db.collection('event_signups');
const refundsCol = db.collection('wechat_pay_refunds');

const REFUND_LIMIT_MINUTES = 30;

const PLAN_DAYS = {
  vip_month: 30,
  vip_year: 365,
  svip_month: 30,
  svip_year: 365,
};

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

function nowMs() {
  return Date.now();
}

function genRefundNo() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RFD${Date.now()}${rand}`;
}

function parseDate(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getTime();
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

/** 去掉首尾空白、BOM、外层引号，避免 paySign / Authorization 与商户平台不一致 */
function trimEnvValue(raw) {
  let s = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** 云函数环境变量里 PEM 常为单行 + \n 转义，或带 \r；须规范后再交给 crypto */
function normalizePrivateKeyPem(raw) {
  let s = trimEnvValue(raw);
  s = s.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  return s;
}

/** 证书序列号仅填 40 位十六进制；勿把 openssl 打印的 serial=0x... 整段粘进去 */
function normalizeMchSerialNo(raw) {
  let v = trimEnvValue(raw).replace(/\s+/g, '');
  const m = v.match(/^serial[=:]/i);
  if (m) v = v.slice(m[0].length);
  if (v.startsWith('0x') || v.startsWith('0X')) v = v.slice(2);
  return v;
}

function loadPayConfig() {
  const privateKey = normalizePrivateKeyPem(mustEnv('WECHAT_PAY_MCH_PRIVATE_KEY'));
  return {
    mchid: trimEnvValue(mustEnv('WECHAT_PAY_MCH_ID')),
    appid: trimEnvValue(mustEnv('WECHAT_PAY_APP_ID')),
    serialNo: normalizeMchSerialNo(mustEnv('WECHAT_PAY_MCH_SERIAL_NO')),
    privateKey,
    notifyUrl: trimEnvValue(mustEnv('WECHAT_PAY_NOTIFY_URL')),
    refundNotifyUrl: trimEnvValue(mustEnv('WECHAT_PAY_REFUND_NOTIFY_URL')),
    apiV3Key: trimEnvValue(mustEnv('WECHAT_PAY_API_V3_KEY')),
  };
}

async function getCurrentUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('未登录');
  const res = await usersCol.where({ openid: OPENID }).limit(1).get();
  if (!res.data || !res.data.length) throw new Error('用户不存在');
  const user = res.data[0];
  return {
    openid: OPENID,
    user,
    userId: resolveUserId(user),
  };
}

function sha256withRsaSign(privateKey, message) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

function httpRequest({ method, path, body, config }) {
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(nowMs() / 1000).toString();
  const bodyText = body ? JSON.stringify(body) : '';
  const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${bodyText}\n`;
  const signature = sha256withRsaSign(config.privateKey, message);
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;

  const options = {
    hostname: 'api.mch.weixin.qq.com',
    port: 443,
    path,
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authorization,
      'User-Agent': 'alumni-association/1.0',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const statusCode = Number(res.statusCode) || 0;
        let json = {};
        if (data) {
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = { raw: data };
          }
        }
        if (statusCode >= 200 && statusCode < 300) {
          resolve({ statusCode, data: json });
          return;
        }
        reject(new Error(json.message || json.code || `微信接口调用失败(${statusCode})`));
      });
    });
    req.on('error', (err) => reject(err));
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

function buildMiniProgramPaySignParams(config, prepayId) {
  const appid = String(config.appid || '').trim();
  if (!appid) throw new Error('WECHAT_PAY_APP_ID 无效');
  const prepay = String(prepayId || '').trim();
  if (!prepay) throw new Error('prepay_id 无效');
  const timeStamp = Math.floor(nowMs() / 1000).toString();
  // 文档：随机串不长于 32 位；16 字节 hex 为 32 字符，部分端上偶发问题，改为 15 字节更稳妥
  const nonceStr = crypto.randomBytes(15).toString('hex');
  const pkg = `prepay_id=${prepay}`;
  const message = `${appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = sha256withRsaSign(config.privateKey, message);
  return {
    appId: appid,
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign,
  };
}

async function getPayOrderByOrderNo(orderNo) {
  const res = await payOrdersCol.where({ orderNo }).limit(1).get();
  if (!res.data || !res.data.length) return null;
  return res.data[0];
}

async function syncOrderByWechatQuery(order, config) {
  if (!order || !order.orderNo) return order;
  const queryPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(order.orderNo)}?mchid=${encodeURIComponent(config.mchid)}`;
  try {
    const wxRes = await httpRequest({
      method: 'GET',
      path: queryPath,
      body: null,
      config,
    });
    const tradeState = wxRes.data && wxRes.data.trade_state;
    const transactionId = (wxRes.data && wxRes.data.transaction_id) || '';
    if (tradeState === 'SUCCESS' && order.status !== 'PAID') {
      await payOrdersCol.doc(order._id).update({
        data: {
          status: 'PAID',
          wxTransactionId: transactionId,
          updatedAt: db.serverDate(),
        },
      });
      const merged = { ...order, status: 'PAID', wxTransactionId: transactionId };
      if (merged.bizType === 'event_signup') {
        const { completePaidEventSignupIfNeeded } = require('./completeEventSignup');
        await completePaidEventSignupIfNeeded(merged);
      }
      return merged;
    }
  } catch (e) {
    // 查询失败不阻断前端展示
  }
  return order;
}

async function handleCreateMembershipPrepay(event) {
  const { userId, openid } = await getCurrentUser();
  const { orderNo } = event;
  if (!orderNo) throw new Error('缺少 orderNo');

  const config = loadPayConfig();
  const payOrder = await getPayOrderByOrderNo(orderNo);
  if (!payOrder) return { success: false, error: '支付订单不存在' };
  if (payOrder.userId !== userId) return { success: false, error: '无权限' };
  if (payOrder.bizType !== 'membership') return { success: false, error: '仅支持会员订单支付' };
  if (payOrder.status === 'PAID') return { success: false, error: '订单已支付' };
  if (payOrder.status === 'REFUNDED') return { success: false, error: '订单已退款' };

  const reqBody = {
    appid: config.appid,
    mchid: config.mchid,
    description: '校友会会员开通',
    out_trade_no: payOrder.orderNo,
    notify_url: config.notifyUrl,
    amount: {
      total: Number(payOrder.amountFen) || 0,
      currency: 'CNY',
    },
    payer: {
      openid,
    },
  };
  const wxRes = await httpRequest({
    method: 'POST',
    path: '/v3/pay/transactions/jsapi',
    body: reqBody,
    config,
  });
  const prepayId = wxRes.data && wxRes.data.prepay_id;
  if (!prepayId) throw new Error('微信下单失败，未返回 prepay_id');

  await payOrdersCol.doc(payOrder._id).update({
    data: {
      status: 'PAYING',
      wxPrepayId: prepayId,
      updatedAt: db.serverDate(),
    },
  });

  const payParams = buildMiniProgramPaySignParams(config, prepayId);
  return {
    success: true,
    orderNo: payOrder.orderNo,
    payParams,
  };
}

async function handleCreateEventSignupPrepay(event) {
  const { userId, openid } = await getCurrentUser();
  const { orderNo } = event;
  if (!orderNo) throw new Error('缺少 orderNo');

  const config = loadPayConfig();
  const payOrder = await getPayOrderByOrderNo(orderNo);
  if (!payOrder) return { success: false, error: '支付订单不存在' };
  if (payOrder.userId !== userId) return { success: false, error: '无权限' };
  if (payOrder.bizType !== 'event_signup') return { success: false, error: '仅支持活动报名订单支付' };
  if (payOrder.status === 'CLOSED') return { success: false, error: '订单已关闭' };
  if (payOrder.status === 'PAID') return { success: false, error: '订单已支付' };
  if (payOrder.status === 'REFUNDED') return { success: false, error: '订单已退款' };

  if (payOrder.bizId) {
    try {
      const sRes = await signupsCol.doc(payOrder.bizId).get();
      const su = sRes.data;
      if (!su || su.status !== 'pending_payment') {
        return { success: false, error: '报名状态不可支付' };
      }
    } catch (e) {
      return { success: false, error: '报名记录异常' };
    }
  }

  const reqBody = {
    appid: config.appid,
    mchid: config.mchid,
    description: '校友会活动报名',
    out_trade_no: payOrder.orderNo,
    notify_url: config.notifyUrl,
    amount: {
      total: Number(payOrder.amountFen) || 0,
      currency: 'CNY',
    },
    payer: {
      openid,
    },
  };
  const wxRes = await httpRequest({
    method: 'POST',
    path: '/v3/pay/transactions/jsapi',
    body: reqBody,
    config,
  });
  const prepayId = wxRes.data && wxRes.data.prepay_id;
  if (!prepayId) throw new Error('微信下单失败，未返回 prepay_id');

  await payOrdersCol.doc(payOrder._id).update({
    data: {
      status: 'PAYING',
      wxPrepayId: prepayId,
      updatedAt: db.serverDate(),
    },
  });

  const payParams = buildMiniProgramPaySignParams(config, prepayId);
  return {
    success: true,
    orderNo: payOrder.orderNo,
    payParams,
  };
}

async function handleQueryEventSignupOrder(event) {
  const { userId } = await getCurrentUser();
  const { orderNo } = event;
  if (!orderNo) throw new Error('缺少 orderNo');

  const config = loadPayConfig();
  let payOrder = await getPayOrderByOrderNo(orderNo);
  if (!payOrder) return { success: false, error: '订单不存在' };
  if (payOrder.userId !== userId) return { success: false, error: '无权限' };
  if (payOrder.bizType !== 'event_signup') return { success: false, error: '订单类型不符' };

  if (payOrder.status !== 'PAID' && payOrder.status !== 'REFUNDED') {
    payOrder = await syncOrderByWechatQuery(payOrder, config);
  }

  return {
    success: true,
    orderNo: payOrder.orderNo,
    status: payOrder.status,
    amountFen: payOrder.amountFen || 0,
    wxTransactionId: payOrder.wxTransactionId || '',
    notifyAt: payOrder.notifyAt || null,
  };
}

async function handleQueryMembershipOrder(event) {
  const { userId } = await getCurrentUser();
  const { orderNo } = event;
  if (!orderNo) throw new Error('缺少 orderNo');

  const config = loadPayConfig();
  let payOrder = await getPayOrderByOrderNo(orderNo);
  if (!payOrder) return { success: false, error: '订单不存在' };
  if (payOrder.userId !== userId) return { success: false, error: '无权限' };

  if (payOrder.status !== 'PAID' && payOrder.status !== 'REFUNDED') {
    payOrder = await syncOrderByWechatQuery(payOrder, config);
  }

  return {
    success: true,
    orderNo: payOrder.orderNo,
    status: payOrder.status,
    amountFen: payOrder.amountFen || 0,
    wxTransactionId: payOrder.wxTransactionId || '',
    notifyAt: payOrder.notifyAt || null,
  };
}

async function hasProcessingOrSuccessRefund(orderNo) {
  const res = await refundsCol
    .where({
      orderNo,
      status: _.in(['PROCESSING', 'SUCCESS']),
    })
    .limit(1)
    .get();
  return !!(res.data && res.data.length);
}

async function handleRequestMembershipRefund(event) {
  const { userId } = await getCurrentUser();
  const { orderNo, reason = '用户退款' } = event;
  if (!orderNo) throw new Error('缺少 orderNo');
  const config = loadPayConfig();

  const payOrder = await getPayOrderByOrderNo(orderNo);
  if (!payOrder) return { success: false, error: '订单不存在' };
  if (payOrder.userId !== userId) return { success: false, error: '无权限' };
  if (payOrder.status !== 'PAID') return { success: false, error: '仅已支付订单可退款' };
  if (!payOrder.wxTransactionId) return { success: false, error: '缺少微信交易号，暂不可退款' };
  if (await hasProcessingOrSuccessRefund(orderNo)) {
    return { success: false, error: '退款处理中或已完成，请勿重复申请' };
  }

  const paidMs = parseDate(payOrder.notifyAt) || parseDate(payOrder.updatedAt);
  const passedMs = nowMs() - paidMs;
  const limitMs = REFUND_LIMIT_MINUTES * 60 * 1000;
  if (!paidMs || passedMs > limitMs) {
    return { success: false, error: `仅支持支付后${REFUND_LIMIT_MINUTES}分钟内全额退款` };
  }

  const refundNo = genRefundNo();
  const amountFen = Number(payOrder.amountFen) || 0;
  const refundReq = {
    out_trade_no: payOrder.orderNo,
    out_refund_no: refundNo,
    reason: (reason || '').slice(0, 80) || '用户退款',
    notify_url: config.refundNotifyUrl,
    amount: {
      refund: amountFen,
      total: amountFen,
      currency: 'CNY',
    },
  };
  const wxRes = await httpRequest({
    method: 'POST',
    path: '/v3/refund/domestic/refunds',
    body: refundReq,
    config,
  });

  const now = db.serverDate();
  const wxRefundId = (wxRes.data && wxRes.data.refund_id) || '';
  const status = ((wxRes.data && wxRes.data.status) || 'PROCESSING').toUpperCase();
  const addRes = await refundsCol.add({
    data: {
      refundNo,
      orderNo: payOrder.orderNo,
      bizType: payOrder.bizType,
      bizId: payOrder.bizId || '',
      userId,
      amountFen,
      reason: (reason || '').slice(0, 80) || '用户退款',
      status: status === 'SUCCESS' ? 'SUCCESS' : 'PROCESSING',
      wxRefundId,
      createdAt: now,
      updatedAt: now,
      notifyAt: null,
    },
  });

  return {
    success: true,
    refundId: addRes._id,
    refundNo,
    status: status === 'SUCCESS' ? 'SUCCESS' : 'PROCESSING',
  };
}

async function handleQueryMembershipRefund(event) {
  const { userId } = await getCurrentUser();
  const { refundNo } = event;
  if (!refundNo) throw new Error('缺少 refundNo');
  const res = await refundsCol.where({ refundNo, userId }).limit(1).get();
  const row = (res.data && res.data[0]) || null;
  if (!row) return { success: false, error: '退款单不存在' };
  return {
    success: true,
    refundNo: row.refundNo,
    orderNo: row.orderNo,
    status: row.status,
    amountFen: row.amountFen || 0,
    notifyAt: row.notifyAt || null,
  };
}

exports.main = async (event) => {
  try {
    const action = (event && event.action) || '';
    if (!action) throw new Error('缺少 action');
    switch (action) {
      case 'createMembershipPrepay':
        return await handleCreateMembershipPrepay(event);
      case 'queryMembershipOrder':
        return await handleQueryMembershipOrder(event);
      case 'createEventSignupPrepay':
        return await handleCreateEventSignupPrepay(event);
      case 'queryEventSignupOrder':
        return await handleQueryEventSignupOrder(event);
      case 'requestMembershipRefund':
        return await handleRequestMembershipRefund(event);
      case 'queryMembershipRefund':
        return await handleQueryMembershipRefund(event);
      default:
        throw new Error(`不支持的 action: ${action}`);
    }
  } catch (e) {
    console.error('wechatPayOrder error', e);
    return {
      success: false,
      error: e.message || '请求失败',
    };
  }
};
