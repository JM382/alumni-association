const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const payOrdersCol = db.collection('wechat_pay_orders');
const membershipOrdersCol = db.collection('membership_orders');
const usersCol = db.collection('users');
const refundsCol = db.collection('wechat_pay_refunds');
const payNotifyLogsCol = db.collection('wechat_pay_notify_logs');
const refundNotifyLogsCol = db.collection('wechat_pay_refund_notify_logs');

const PLAN_DAYS = {
  vip_month: 30,
  vip_year: 365,
  svip_month: 30,
  svip_year: 365,
};

function parseBody(event) {
  if (!event) return {};
  if (typeof event.body === 'string') {
    try {
      return JSON.parse(event.body || '{}');
    } catch (e) {
      return {};
    }
  }
  if (event.body && typeof event.body === 'object') return event.body;
  if (typeof event === 'object' && event.id && event.resource) return event;
  return {};
}

function getHeader(headers, name) {
  if (!headers) return '';
  const lower = name.toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (k.toLowerCase() === lower) return headers[k] || '';
  }
  return '';
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

function loadConfig() {
  return {
    apiV3Key: mustEnv('WECHAT_PAY_API_V3_KEY'),
    platformPublicKey: mustEnv('WECHAT_PAY_PLATFORM_PUBLIC_KEY').replace(/\\n/g, '\n'),
  };
}

function verifyWechatSignature({ headers, bodyText, platformPublicKey }) {
  const timestamp = getHeader(headers, 'Wechatpay-Timestamp');
  const nonce = getHeader(headers, 'Wechatpay-Nonce');
  const signature = getHeader(headers, 'Wechatpay-Signature');
  if (!timestamp || !nonce || !signature) return false;
  const message = `${timestamp}\n${nonce}\n${bodyText}\n`;
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(message);
  verify.end();
  return verify.verify(platformPublicKey, signature, 'base64');
}

function decryptResource(resource, apiV3Key) {
  const { associated_data: associatedData, nonce, ciphertext } = resource || {};
  if (!nonce || !ciphertext) throw new Error('resource 缺少解密字段');
  const key = Buffer.from(apiV3Key, 'utf8');
  const data = Buffer.from(ciphertext, 'base64');
  const authTag = data.subarray(data.length - 16);
  const cipherText = data.subarray(0, data.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

function toMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getTime();
}

function calcExpire(baseExpireAt, days) {
  const now = Date.now();
  const baseMs = toMs(baseExpireAt) > now ? toMs(baseExpireAt) : now;
  return new Date(baseMs + days * 24 * 60 * 60 * 1000);
}

async function findUserByUserId(userId) {
  if (!userId) return null;
  const byUserId = await usersCol.where({ user_id: userId }).limit(1).get();
  if (byUserId.data && byUserId.data.length) return byUserId.data[0];
  try {
    const byDocId = await usersCol.doc(userId).get();
    return byDocId.data || null;
  } catch (e) {
    return null;
  }
}

async function logPayNotify(data) {
  await payNotifyLogsCol.add({
    data: {
      orderNo: data.orderNo || '',
      wxTransactionId: data.wxTransactionId || '',
      verifyPassed: !!data.verifyPassed,
      processResult: data.processResult || '',
      summary: data.summary || '',
      createdAt: db.serverDate(),
    },
  });
}

async function logRefundNotify(data) {
  await refundNotifyLogsCol.add({
    data: {
      refundNo: data.refundNo || '',
      orderNo: data.orderNo || '',
      wxRefundId: data.wxRefundId || '',
      verifyPassed: !!data.verifyPassed,
      processResult: data.processResult || '',
      summary: data.summary || '',
      createdAt: db.serverDate(),
    },
  });
}

async function handlePaymentSuccess(resourceData) {
  const orderNo = resourceData.out_trade_no || '';
  const transactionId = resourceData.transaction_id || '';
  const paidAmount = Number(resourceData.amount && resourceData.amount.total) || 0;

  const payOrderRes = await payOrdersCol.where({ orderNo }).limit(1).get();
  const payOrder = (payOrderRes.data && payOrderRes.data[0]) || null;
  if (!payOrder) {
    await logPayNotify({
      orderNo,
      wxTransactionId: transactionId,
      verifyPassed: true,
      processResult: 'FAIL_ORDER_NOT_FOUND',
      summary: '支付订单不存在',
    });
    return;
  }
  if (payOrder.status === 'PAID') {
    const { completePaidEventSignupIfNeeded } = require('./completeEventSignup');
    await completePaidEventSignupIfNeeded(payOrder);
    await logPayNotify({
      orderNo,
      wxTransactionId: transactionId || payOrder.wxTransactionId || '',
      verifyPassed: true,
      processResult: 'SUCCESS_DUPLICATE',
      summary: '重复通知',
    });
    return;
  }
  if (paidAmount !== Number(payOrder.amountFen || 0)) {
    await logPayNotify({
      orderNo,
      wxTransactionId: transactionId,
      verifyPassed: true,
      processResult: 'FAIL_AMOUNT_MISMATCH',
      summary: `金额不匹配，expect=${payOrder.amountFen}, actual=${paidAmount}`,
    });
    return;
  }

  const now = db.serverDate();
  await payOrdersCol.doc(payOrder._id).update({
    data: {
      status: 'PAID',
      wxTransactionId: transactionId,
      notifyAt: now,
      updatedAt: now,
    },
  });

  if (payOrder.bizType === 'membership' && payOrder.bizId) {
    const mRes = await membershipOrdersCol.doc(payOrder.bizId).get();
    const mOrder = mRes.data || null;
    if (mOrder) {
      await membershipOrdersCol.doc(mOrder._id).update({
        data: {
          status: 'paid',
          paidAt: now,
          updatedAt: now,
        },
      });
      const userDoc = await findUserByUserId(mOrder.userId);
      if (userDoc) {
        const days = PLAN_DAYS[mOrder.planKey] || 30;
        const beforeLevel = userDoc.membershipLevel || 'none';
        const beforeExpireAt = userDoc.membershipExpireAt || null;
        const nextExpireAt = calcExpire(userDoc.membershipExpireAt, days);
        await usersCol.doc(userDoc._id).update({
          data: {
            membershipLevel: mOrder.level,
            membershipExpireAt: nextExpireAt,
            membershipUpdatedAt: now,
          },
        });
        await membershipOrdersCol.doc(mOrder._id).update({
          data: {
            membershipBeforeLevel: beforeLevel,
            membershipBeforeExpireAt: beforeExpireAt,
            membershipAfterLevel: mOrder.level,
            membershipAfterExpireAt: nextExpireAt,
            updatedAt: now,
          },
        });
      }
    }
  }

  if (payOrder.bizType === 'event_signup' && payOrder.bizId) {
    const { completePaidEventSignupIfNeeded } = require('./completeEventSignup');
    await completePaidEventSignupIfNeeded({
      ...payOrder,
      status: 'PAID',
      wxTransactionId: transactionId,
    });
  }

  await logPayNotify({
    orderNo,
    wxTransactionId: transactionId,
    verifyPassed: true,
    processResult: 'SUCCESS_UPDATED',
    summary: '支付回调处理成功',
  });
}

async function handleRefundSuccess(resourceData) {
  const refundNo = resourceData.out_refund_no || '';
  const orderNo = resourceData.out_trade_no || '';
  const wxRefundId = resourceData.refund_id || '';
  const refundAmount = Number(resourceData.amount && resourceData.amount.refund) || 0;

  const refundRes = await refundsCol.where({ refundNo }).limit(1).get();
  const refundRow = (refundRes.data && refundRes.data[0]) || null;
  if (!refundRow) {
    await logRefundNotify({
      refundNo,
      orderNo,
      wxRefundId,
      verifyPassed: true,
      processResult: 'FAIL_REFUND_NOT_FOUND',
      summary: '退款单不存在',
    });
    return;
  }
  if (refundRow.status === 'SUCCESS') {
    await logRefundNotify({
      refundNo,
      orderNo,
      wxRefundId: wxRefundId || refundRow.wxRefundId || '',
      verifyPassed: true,
      processResult: 'SUCCESS_DUPLICATE',
      summary: '重复退款通知',
    });
    return;
  }
  if (refundAmount !== Number(refundRow.amountFen || 0)) {
    await logRefundNotify({
      refundNo,
      orderNo,
      wxRefundId,
      verifyPassed: true,
      processResult: 'FAIL_AMOUNT_MISMATCH',
      summary: `退款金额不匹配，expect=${refundRow.amountFen}, actual=${refundAmount}`,
    });
    return;
  }

  const now = db.serverDate();
  await refundsCol.doc(refundRow._id).update({
    data: {
      status: 'SUCCESS',
      wxRefundId,
      notifyAt: now,
      updatedAt: now,
    },
  });

  const payOrderRes = await payOrdersCol.where({ orderNo }).limit(1).get();
  const payOrder = (payOrderRes.data && payOrderRes.data[0]) || null;
  if (payOrder) {
    await payOrdersCol.doc(payOrder._id).update({
      data: {
        status: 'REFUNDED',
        updatedAt: now,
      },
    });
    if (payOrder.bizType === 'membership' && payOrder.bizId) {
      const mRes = await membershipOrdersCol.doc(payOrder.bizId).get();
      const mOrder = mRes.data || null;
      if (mOrder) {
        await membershipOrdersCol.doc(mOrder._id).update({
          data: {
            status: 'refunded',
            refundedAt: now,
            updatedAt: now,
          },
        });
        const userDoc = await findUserByUserId(mOrder.userId);
        if (userDoc) {
          const beforeLevel = mOrder.membershipBeforeLevel || 'none';
          const beforeExpire = mOrder.membershipBeforeExpireAt || null;
          await usersCol.doc(userDoc._id).update({
            data: {
              membershipLevel: beforeLevel,
              membershipExpireAt: beforeExpire,
              membershipUpdatedAt: now,
            },
          });
        }
      }
    }
  }

  await logRefundNotify({
    refundNo,
    orderNo,
    wxRefundId,
    verifyPassed: true,
    processResult: 'SUCCESS_UPDATED',
    summary: '退款回调处理成功',
  });
}

function okResponse() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'SUCCESS',
      message: '成功',
    }),
  };
}

function failResponse(message) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'FAIL',
      message: message || '失败',
    }),
  };
}

exports.main = async (event) => {
  try {
    const config = loadConfig();
    const bodyObj = parseBody(event);
    const bodyText = typeof event.body === 'string' ? event.body : JSON.stringify(bodyObj || {});
    const headers = event && event.headers ? event.headers : {};
    const verified = verifyWechatSignature({
      headers,
      bodyText,
      platformPublicKey: config.platformPublicKey,
    });
    if (!verified) {
      await logPayNotify({
        verifyPassed: false,
        processResult: 'FAIL_VERIFY',
        summary: '签名校验失败',
      });
      return failResponse('签名校验失败');
    }

    const resourceData = decryptResource(bodyObj.resource || {}, config.apiV3Key);
    const eventType = (bodyObj.event_type || '').toUpperCase();
    const resourceType = (bodyObj.resource_type || '').toLowerCase();

    if (resourceType.includes('refund') || eventType.includes('REFUND')) {
      const status = (resourceData.refund_status || resourceData.status || '').toUpperCase();
      if (status === 'SUCCESS') {
        await handleRefundSuccess(resourceData);
      }
      return okResponse();
    }

    const tradeState = (resourceData.trade_state || '').toUpperCase();
    if (tradeState === 'SUCCESS') {
      await handlePaymentSuccess(resourceData);
    }
    return okResponse();
  } catch (e) {
    console.error('wechatPayNotify error', e);
    return failResponse(e.message || '回调处理失败');
  }
};
