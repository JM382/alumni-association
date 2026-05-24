const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const MCH_ID = String(process.env.WXPAY_MCH_ID || '').trim()
const API_V3_KEY = process.env.WXPAY_API_V3_KEY || ''
const MCH_SERIAL_NO = process.env.WXPAY_MCH_SERIAL_NO || ''
const APPID = process.env.WX_APPID || ''
const NOTIFY_URL = process.env.WXPAY_NOTIFY_URL || ''

/** 云开发环境变量里私钥常被压成一行且用字面量 \n；若从网页复制，base64 里会夹空格，必须去掉，否则 PEM 解析失败 */
function normalizeMerchantPrivateKeyPem(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/\r\n/g, '\n')
  s = s.replace(/\\n/g, '\n')
  if (!/\n/.test(s) && /-----BEGIN/.test(s)) {
    s = s.replace(/(-----BEGIN [A-Z ]+-----)\s+/, '$1\n')
    s = s.replace(/\s+(-----END [A-Z ]+-----)/, '\n$1')
  }
  const beginRe = /-----BEGIN [A-Z ]+-----/
  const endRe = /-----END [A-Z ]+-----/
  const bm = beginRe.exec(s)
  const em = endRe.exec(s)
  if (bm && em && em.index > bm.index) {
    const head = bm[0]
    const foot = em[0]
    const inner = s.slice(bm.index + head.length, em.index).replace(/\s+/g, '')
    if (inner) s = `${head}\n${inner}\n${foot}`
  }
  return s.trim()
}

const MCH_PRIVATE_KEY = normalizeMerchantPrivateKeyPem(process.env.WXPAY_MCH_PRIVATE_KEY || '')

function randomStr(len = 32) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function signMessage(message) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  return signer.sign(MCH_PRIVATE_KEY, 'base64')
}

function authHeader(method, urlPath, body) {
  const nonceStr = randomStr(24)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signText = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`
  const signature = signMessage(signText)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${MCH_SERIAL_NO}"`
}

/** 微信 v3 错误体一般为 { code, message } */
function summarizeWxPayError(resJson, httpStatus) {
  if (resJson && typeof resJson === 'object') {
    const code = resJson.code
    const message = resJson.message
    if (code && message) return `${code}：${message}`
    if (message) return String(message)
    if (code) return String(code)
  }
  if (httpStatus && httpStatus !== 200) return `HTTP ${httpStatus}`
  return ''
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 商品描述 ≤127；去掉控制字符，避免触发微信侧异常 */
function buildWxJsapiDescription(projectName, yuanStr) {
  let name = (projectName && String(projectName)) || '爱心捐赠'
  name = name.replace(/[\u0000-\u001F\\]/g, '').trim()
  if (name.length > 80) name = name.slice(0, 80)
  const suffix = ` · ¥${yuanStr}`
  const maxTotal = 120
  if (name.length + suffix.length > maxTotal) {
    name = name.slice(0, Math.max(4, maxTotal - suffix.length))
  }
  return `${name}${suffix}`
}

/** attach ≤128 */
function buildWxAttach(projectId, projectName, amountFen) {
  const o = {
    type: 'donate',
    projectId: String(projectId || '').slice(0, 64),
    projectName: String(projectName || '').slice(0, 48),
    amountFen,
  }
  let s = JSON.stringify(o)
  if (s.length > 127) {
    s = JSON.stringify({ type: 'donate', projectId: o.projectId.slice(0, 32), amountFen })
  }
  return s
}

/** 云函数 Node16 无全局 fetch，用 https */
function httpsRequest(urlStr, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: `${u.pathname}${u.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          const requestId = String(res.headers['wechatpay-request-id'] || res.headers['x-request-id'] || '')
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text,
            requestId,
          })
        })
      }
    )
    req.on('error', reject)
    if (body != null && body !== '') req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  if (!MCH_ID || !API_V3_KEY || !MCH_SERIAL_NO || !MCH_PRIVATE_KEY || !NOTIFY_URL) {
    return {
      success: false,
      errMsg:
        '支付参数未配置完整：需 WXPAY_MCH_ID、WXPAY_API_V3_KEY、证书序列号与私钥、WXPAY_NOTIFY_URL；建议再配置 WX_APPID 与小程序一致',
    }
  }
  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(MCH_PRIVATE_KEY)) {
    return {
      success: false,
      errMsg: 'WXPAY_MCH_PRIVATE_KEY 格式错误：请粘贴 apiclient_key.pem 全文；若一行填写请用 \\n 表示换行（需含 -----BEGIN … KEY-----）',
    }
  }

  const notifyUrlTrimmed = String(NOTIFY_URL || '').trim()
  if (!/^https:\/\//i.test(notifyUrlTrimmed)) {
    return { success: false, errMsg: 'WXPAY_NOTIFY_URL 须为 https:// 公网地址（微信 JSAPI 下单必填）' }
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, errMsg: '获取用户身份失败' }

  const runtimeAppId = String(wxContext.APPID || wxContext.FROM_APPID || '').trim()
  const envAppId = String(APPID || '').trim()
  if (runtimeAppId && envAppId && runtimeAppId !== envAppId) {
    return {
      success: false,
      errMsg: `WX_APPID 与当前小程序不一致：环境变量为「${envAppId}」，云函数实际为「${runtimeAppId}」。请把云函数环境变量 WX_APPID 改为「${runtimeAppId}」（否则 openid 与 appid 不匹配，微信常返回 SYSTEM_ERROR）。`,
    }
  }

  /** 下单必须用与 openid 对应的小程序 AppID；优先用云函数上下文，避免仅环境变量配错 */
  const appidForPay = runtimeAppId || envAppId
  if (!appidForPay) {
    return {
      success: false,
      errMsg: '未得到小程序 AppID：请在云函数环境变量填写 WX_APPID，或仅在微信内打开本小程序后发起支付',
    }
  }

  const { projectId = '', projectName = '爱心捐赠', amountFen: rawFen } = event || {}
  let amountFen = Number(rawFen)
  if (!Number.isFinite(amountFen)) amountFen = 10
  amountFen = Math.floor(amountFen)
  const MIN_FEN = 10
  const MAX_FEN = 5000000
  if (amountFen < MIN_FEN || amountFen > MAX_FEN) {
    return { success: false, errMsg: `捐赠金额需在 ¥${(MIN_FEN / 100).toFixed(2)}～¥${(MAX_FEN / 100).toFixed(2)} 之间` }
  }

  const yuanStr = (amountFen / 100).toFixed(2)
  const description = buildWxJsapiDescription(projectName, yuanStr)
  const attach = buildWxAttach(projectId, projectName, amountFen)
  const path = '/v3/pay/transactions/jsapi'

  let prepayId = ''
  let outTradeNo = ''
  let lastWxRes = { ok: false, status: 0, text: '', requestId: '' }
  let lastResJson = {}

  let notifyHost = ''
  try {
    notifyHost = new URL(notifyUrlTrimmed).hostname
  } catch (e) {
    notifyHost = '(无效URL)'
  }
  console.log('createDonateOrder 下单', JSON.stringify({ appidForPay, mchid: MCH_ID, notifyHost, amountFen }))

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const tryOutNo = `donate_${Date.now()}_${Math.floor(Math.random() * 100000)}`
    const bodyObj = {
      appid: appidForPay,
      mchid: String(MCH_ID).trim(),
      description,
      out_trade_no: tryOutNo,
      notify_url: notifyUrlTrimmed,
      amount: { total: amountFen, currency: 'CNY' },
      payer: { openid },
      attach,
    }
    const body = JSON.stringify(bodyObj)
    const header = authHeader('POST', path, body)

    const wxRes = await httpsRequest(`https://api.mch.weixin.qq.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: header,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'miniprogram-alumni/1.0',
      },
      body,
    })
    const resText = wxRes.text
    lastWxRes = wxRes
    let resJson = {}
    try {
      resJson = JSON.parse(resText || '{}')
    } catch (e) {
      lastResJson = {}
      return { success: false, errMsg: '微信下单响应解析失败', raw: resText }
    }
    lastResJson = resJson

    if (wxRes.ok && resJson.prepay_id) {
      prepayId = resJson.prepay_id
      outTradeNo = tryOutNo
      break
    }

    const code = resJson.code
    const canRetry =
      attempt < 3 &&
      (code === 'SYSTEM_ERROR' || code === 'FREQUENCY_LIMITED' || (wxRes.status >= 500 && wxRes.status < 600))
    console.error(
      'createDonateOrder wx attempt',
      attempt,
      wxRes.status,
      code,
      resJson?.message,
      tryOutNo,
      wxRes.requestId || ''
    )
    if (canRetry) {
      await sleep(400 * attempt)
      continue
    }
    break
  }

  if (!prepayId) {
    const fromWx = summarizeWxPayError(lastResJson, lastWxRes.status)
    let errMsg = fromWx
      ? `微信下单失败：${fromWx}`
      : '微信下单失败（响应无 prepay_id，请核对 WX_APPID、商户号与小程序绑定、回调 URL 等）'
    if (lastResJson && lastResJson.code === 'SYSTEM_ERROR') {
      errMsg +=
        '。排查：①本单已用 appid=' +
        appidForPay +
        ' 与当前 openid 配对 ②WXPAY_MCH_ID/证书/序列为同一商户 ③商户平台关联该 AppID 的 JSAPI ④若为服务商/子商户不可调用普通商户 JSAPI 下单。'
    }
    const wxRid = lastWxRes.requestId || ''
    if (wxRid) {
      errMsg += ` 微信支付请求单号：${wxRid}（联系客服时请提供）。`
    }
    console.error('createDonateOrder wx err final', wxRid, lastWxRes.status, lastWxRes.text?.slice(0, 800))
    return { success: false, errMsg, detail: { ...lastResJson, wechatpayRequestId: wxRid } }
  }

  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomStr(24)
  const pkg = `prepay_id=${prepayId}`
  const paySignText = `${appidForPay}\n${timeStamp}\n${nonceStr}\n${pkg}\n`
  const paySign = signMessage(paySignText)

  const db = cloud.database()
  await db.collection('donation_orders').add({
    data: {
      _openid: openid,
      outTradeNo,
      projectId,
      projectName,
      amountFen,
      status: 'pending',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  return {
    success: true,
    outTradeNo,
    payParams: {
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA',
      paySign,
    },
  }
}
