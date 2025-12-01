const winston = require('winston');
const path = require('path');
const crypto = require('crypto');

// أضف حقل msg متوافق مع أدوات المراقبة (pino-like)
const addMsgField = winston.format((info) => {
    if (info.message && !info.msg) info.msg = info.message;
    return info;
});

// إخفاء PII: لا نسجّل email/phone/names/tokens/passwords
const REDACT_KEYS = new Set([
    'email','phone','fullName','name','token','accessToken','refreshToken','password','authorization','cookie','set-cookie','auth','x-api-key'
]);

function redactValue(value) {
    if (value == null) return value;
    if (typeof value === 'string') return value; // لا نطبّق regex هنا لتجنب false positives
    if (Array.isArray(value)) return value.map(redactValue);
    if (typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) {
            if (REDACT_KEYS.has(k.toLowerCase())) {
                out[k] = '[REDACTED]';
            } else {
                out[k] = redactValue(value[k]);
            }
        }
        return out;
    }
    return value;
}

const redactFormat = winston.format((info) => {
    const clone = Object.assign({}, info);
    for (const k of Object.keys(clone)) {
        if (REDACT_KEYS.has(k.toLowerCase())) clone[k] = '[REDACTED]';
        else if (typeof clone[k] === 'object') clone[k] = redactValue(clone[k]);
    }
    return clone;
});

// تنسيق مخصص للسجلات (JSON منظّم)
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    redactFormat(),
    addMsgField(),
    winston.format.json()
);

// إنشاء مجلد السجلات إذا لم يكن موجوداً
const logsDir = path.join(__dirname, '../logs');
if (!require('fs').existsSync(logsDir)) {
    require('fs').mkdirSync(logsDir);
}

// إعداد Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // سجل كل المستويات في ملف مجمع
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // سجل الأخطاء في ملف منفصل
        new winston.transports.File({
            filename: path.join(logsDir, 'errors.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // عرض في الكونسول في بيئة التطوير
        new winston.transports.Console({ format: customFormat }),
    ],
    // التعامل مع الأخطاء غير المتوقعة في Winston نفسه
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    // عدم إيقاف التطبيق عند حدوث خطأ غير متوقع
    exitOnError: false,
});

// دوال مساعدة للتسجيل
const logRequest = (req, message) => {
    logger.info(message, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.user ? (req.user.id || req.user.userId) : 'anonymous',
        correlationId: req.correlationId || req.headers['x-request-id']
    });
};

const logError = (err, req = null) => {
    const errorInfo = {
        message: err.message,
        stack: err.stack,
        ...(req && {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId: req.user ? (req.user.id || req.user.userId) : 'anonymous',
            correlationId: req.correlationId || req && req.headers && req.headers['x-request-id']
        })
    };
    logger.error('Error occurred:', errorInfo);
};

// Middleware للتسجيل التلقائي لكل الطلبات
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // تسجيل عند إكمال الطلب
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            durationMs: duration,
            ip: req.ip,
            userId: req.user ? (req.user.id || req.user.userId) : 'anonymous',
            correlationId: req.correlationId || req.headers['x-request-id']
        });
    });

    next();
};

// Middleware لإدارة Correlation ID
const correlationIdMiddleware = (req, res, next) => {
    const hdr = (req.headers['x-request-id'] || '').toString().trim();
    const id = hdr || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
    req.correlationId = id;
    res.setHeader('X-Request-Id', id);
    next();
};

// معالج الأخطاء المركزي
const errorHandler = (err, req, res, next) => {
    logError(err, req);

    // تجنب إرسال تفاصيل الخطأ الحساسة في الإنتاج
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.setHeader('X-Request-Id', (req && req.correlationId) || (req && req.headers && req.headers['x-request-id']) || '');
    res.status(err.status || 500).json({
        error: {
            message: isProduction ? 'حدث خطأ في الخادم' : err.message,
            ...((!isProduction && err.stack) && { stack: err.stack })
        },
        correlationId: (req && req.correlationId) || (req && req.headers && req.headers['x-request-id'])
    });
};

module.exports = {
    logger,
    logRequest,
    logError,
    requestLogger,
    correlationIdMiddleware,
    errorHandler,
    audit: (event, data={}, req=null) => {
        if(String(process.env.MARKET_AUDIT_ENABLED||'1')!=='1') return;
        try {
            const payload = Object.assign({}, data);
            if(req){
                payload.userId = req.user && (req.user.id||req.user.userId) || payload.userId || 'anonymous';
                payload.ip = req.ip || payload.ip;
                payload.correlationId = req.correlationId || req.headers && req.headers['x-request-id'] || payload.correlationId;
            }
            logger.info('audit', { auditEvent: event, audit: true, event, ...payload });
        } catch(_) {}
    }
};