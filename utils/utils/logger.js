const winston = require('winston');
const path = require('path');

// تنسيق مخصص للسجلات
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
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
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
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
        user: req.user ? req.user.id : 'anonymous'
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
            user: req.user ? req.user.id : 'anonymous'
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
            duration: `${duration}ms`,
            ip: req.ip,
            user: req.user ? req.user.id : 'anonymous'
        });
    });

    next();
};

// معالج الأخطاء المركزي
const errorHandler = (err, req, res, next) => {
    logError(err, req);

    // تجنب إرسال تفاصيل الخطأ الحساسة في الإنتاج
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(err.status || 500).json({
        error: {
            message: isProduction ? 'حدث خطأ في الخادم' : err.message,
            ...((!isProduction && err.stack) && { stack: err.stack })
        }
    });
};

module.exports = {
    logger,
    logRequest,
    logError,
    requestLogger,
    errorHandler
};