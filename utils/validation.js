/**
 * ملف التحقق من صحة البيانات
 * يحتوي على دوال التحقق من صحة البيانات والتنسيقات المختلفة
 * @file validation.js
 * @description مجموعة شاملة من دوال التحقق والتصحيح
 * @version 1.0.0
 * @author فريق آكسيوم هب التقني
 */

const validator = require('validator');

/**
 * التحقق من صحة عنوان البريد الإلكتروني
 * @param {string} email - عنوان البريد الإلكتروني
 * @returns {boolean} - نتيجة التحقق
 */
const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    // تنظيف البريد الإلكتروني
    const cleanEmail = email.trim().toLowerCase();
    
    // التحقق من التنسيق الأساسي
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return false;
    }
    
    // التحقق المتقدم
    return validator.isEmail(cleanEmail);
};

/**
 * التحقق من صحة رقم الهاتف (تنسيق عربي/دولي)
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} - نتيجة التحقق
 */
const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return false;
    }
    
    // إزالة المسافات والرموز الخاصة
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // التحقق من الأرقام العربية/الخليجية
    const arabicPhoneRegex = /^(\+?966|0)?[5][0-9]{8}$/; // السعودية
    const internationalRegex = /^(\+?[1-9]\d{1,14})$/; // دولي
    
    return arabicPhoneRegex.test(cleanPhone) || internationalRegex.test(cleanPhone);
};

/**
 * التحقق من قوة كلمة المرور
 * @param {string} password - كلمة المرور
 * @returns {object} - نتيجة التحقق مع التفاصيل
 */
const validatePassword = (password) => {
    const result = {
        isValid: false,
        score: 0,
        errors: [],
        suggestions: []
    };
    
    if (!password || typeof password !== 'string') {
        result.errors.push('كلمة المرور مطلوبة');
        return result;
    }
    
    // طول كلمة المرور
    if (password.length < 8) {
        result.errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    } else {
        result.score += 1;
    }
    
    // وجود أحرف كبيرة
    if (!/[A-Z]/.test(password)) {
        result.errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل');
        result.suggestions.push('أضف حرفاً كبيراً');
    } else {
        result.score += 1;
    }
    
    // وجود أحرف صغيرة
    if (!/[a-z]/.test(password)) {
        result.errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل');
        result.suggestions.push('أضف حرفاً صغيراً');
    } else {
        result.score += 1;
    }
    
    // وجود أرقام
    if (!/[0-9]/.test(password)) {
        result.errors.push('يجب أن تحتوي على رقم واحد على الأقل');
        result.suggestions.push('أضف رقماً');
    } else {
        result.score += 1;
    }
    
    // وجود رموز خاصة
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        result.errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل');
        result.suggestions.push('أضف رمزاً خاصاً (!@#$%^&*)');
    } else {
        result.score += 1;
    }
    
    // التحقق من كلمات المرور الشائعة
    const commonPasswords = [
        'password', '123456', '123456789', 'qwerty', 'abc123',
        'password123', 'admin', 'letmein', 'welcome', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
        result.errors.push('كلمة المرور شائعة جداً');
        result.suggestions.push('استخدم كلمة مرور أكثر تعقيداً');
        result.score = Math.max(0, result.score - 2);
    }
    
    result.isValid = result.score >= 4 && result.errors.length === 0;
    return result;
};

/**
 * التحقق من صحة اسم المستخدم
 * @param {string} username - اسم المستخدم
 * @returns {object} - نتيجة التحقق
 */
const validateUsername = (username) => {
    const result = {
        isValid: false,
        errors: []
    };
    
    if (!username || typeof username !== 'string') {
        result.errors.push('اسم المستخدم مطلوب');
        return result;
    }
    
    const cleanUsername = username.trim();
    
    // طول اسم المستخدم
    if (cleanUsername.length < 3) {
        result.errors.push('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
    }
    
    if (cleanUsername.length > 20) {
        result.errors.push('اسم المستخدم يجب أن يكون 20 حرف كحد أقصى');
    }
    
    // الأحرف المسموحة
    const usernameRegex = /^[a-zA-Z0-9_\u0600-\u06FF]+$/;
    if (!usernameRegex.test(cleanUsername)) {
        result.errors.push('يمكن أن يحتوي اسم المستخدم على أحرف وأرقام وخط سفلي فقط');
    }
    
    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * التحقق من صحة النص العربي
 * @param {string} text - النص للتحقق منه
 * @param {object} options - خيارات التحقق
 * @returns {object} - نتيجة التحقق
 */
const validateArabicText = (text, options = {}) => {
    const {
        minLength = 1,
        maxLength = 1000,
        allowNumbers = true,
        allowPunctuation = true
    } = options;
    
    const result = {
        isValid: false,
        errors: []
    };
    
    if (!text || typeof text !== 'string') {
        result.errors.push('النص مطلوب');
        return result;
    }
    
    const cleanText = text.trim();
    
    // طول النص
    if (cleanText.length < minLength) {
        result.errors.push(`النص يجب أن يكون ${minLength} أحرف على الأقل`);
    }
    
    if (cleanText.length > maxLength) {
        result.errors.push(`النص يجب أن يكون ${maxLength} حرف كحد أقصى`);
    }
    
    // التحقق من وجود أحرف عربية
    const arabicRegex = /[\u0600-\u06FF]/;
    if (!arabicRegex.test(cleanText)) {
        result.errors.push('يجب أن يحتوي النص على أحرف عربية');
    }
    
    // بناء تعبير منتظم حسب الخيارات
    let allowedCharsRegex = '\\u0600-\\u06FF\\s'; // أحرف عربية ومسافات
    
    if (allowNumbers) {
        allowedCharsRegex += '0-9\\u06F0-\\u06F9'; // أرقام إنجليزية وعربية
    }
    
    if (allowPunctuation) {
        allowedCharsRegex += '\\u060C\\u061B\\u061F\\u0640\\.,!?;:()\\[\\]{}"\'-'; // علامات ترقيم
    }
    
    const validationRegex = new RegExp(`^[${allowedCharsRegex}]+$`);
    if (!validationRegex.test(cleanText)) {
        result.errors.push('النص يحتوي على أحرف غير مسموحة');
    }
    
    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * التحقق من صحة البيانات العددية
 * @param {any} value - القيمة للتحقق منها
 * @param {object} options - خيارات التحقق
 * @returns {object} - نتيجة التحقق
 */
const validateNumber = (value, options = {}) => {
    const {
        min = Number.MIN_SAFE_INTEGER,
        max = Number.MAX_SAFE_INTEGER,
        isInteger = false,
        isPositive = false
    } = options;
    
    const result = {
        isValid: false,
        errors: [],
        value: null
    };
    
    // محاولة تحويل القيمة إلى رقم
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
        result.errors.push('القيمة يجب أن تكون رقماً صحيحاً');
        return result;
    }
    
    // التحقق من كونه عدد صحيح
    if (isInteger && !Number.isInteger(numValue)) {
        result.errors.push('القيمة يجب أن تكون عدداً صحيحاً');
    }
    
    // التحقق من كونه موجباً
    if (isPositive && numValue <= 0) {
        result.errors.push('القيمة يجب أن تكون موجبة');
    }
    
    // التحقق من النطاق
    if (numValue < min) {
        result.errors.push(`القيمة يجب أن تكون ${min} أو أكثر`);
    }
    
    if (numValue > max) {
        result.errors.push(`القيمة يجب أن تكون ${max} أو أقل`);
    }
    
    result.value = numValue;
    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * التحقق من صحة التاريخ
 * @param {any} date - التاريخ للتحقق منه
 * @param {object} options - خيارات التحقق
 * @returns {object} - نتيجة التحقق
 */
const validateDate = (date, options = {}) => {
    const {
        minDate = null,
        maxDate = null,
        futureOnly = false,
        pastOnly = false
    } = options;
    
    const result = {
        isValid: false,
        errors: [],
        date: null
    };
    
    let dateObj;
    
    // محاولة تحويل إلى تاريخ
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else {
        result.errors.push('التاريخ يجب أن يكون بتنسيق صحيح');
        return result;
    }
    
    // التحقق من صحة التاريخ
    if (isNaN(dateObj.getTime())) {
        result.errors.push('تاريخ غير صحيح');
        return result;
    }
    
    const now = new Date();
    
    // التحقق من كونه في المستقبل فقط
    if (futureOnly && dateObj <= now) {
        result.errors.push('التاريخ يجب أن يكون في المستقبل');
    }
    
    // التحقق من كونه في الماضي فقط
    if (pastOnly && dateObj >= now) {
        result.errors.push('التاريخ يجب أن يكون في الماضي');
    }
    
    // التحقق من النطاق الزمني
    if (minDate && dateObj < new Date(minDate)) {
        result.errors.push(`التاريخ يجب أن يكون بعد ${new Date(minDate).toLocaleDateString('ar-SA')}`);
    }
    
    if (maxDate && dateObj > new Date(maxDate)) {
        result.errors.push(`التاريخ يجب أن يكون قبل ${new Date(maxDate).toLocaleDateString('ar-SA')}`);
    }
    
    result.date = dateObj;
    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * التحقق من صحة الملف المرفوع
 * @param {object} file - الملف للتحقق منه
 * @param {object} options - خيارات التحقق
 * @returns {object} - نتيجة التحقق
 */
const validateFile = (file, options = {}) => {
    const {
        maxSize = 5 * 1024 * 1024, // 5MB افتراضي
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
    } = options;
    
    const result = {
        isValid: false,
        errors: []
    };
    
    if (!file) {
        result.errors.push('ملف مطلوب');
        return result;
    }
    
    // التحقق من حجم الملف
    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        result.errors.push(`حجم الملف يجب أن يكون ${maxSizeMB} ميجابايت كحد أقصى`);
    }
    
    // التحقق من نوع الملف
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        result.errors.push(`نوع الملف غير مسموح. الأنواع المسموحة: ${allowedTypes.join(', ')}`);
    }
    
    // التحقق من امتداد الملف
    if (allowedExtensions.length > 0) {
        const fileExtension = file.originalname ? 
            file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.')) : '';
        
        if (!allowedExtensions.includes(fileExtension)) {
            result.errors.push(`امتداد الملف غير مسموح. الامتدادات المسموحة: ${allowedExtensions.join(', ')}`);
        }
    }
    
    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * تنظيف وتطهير النص من المحتوى الضار
 * @param {string} text - النص للتنظيف
 * @returns {string} - النص المنظف
 */
const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // إزالة الأكواد الضارة
    let cleanText = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // إزالة JavaScript
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // إزالة iframe
        .replace(/javascript:/gi, '') // إزالة javascript URLs
        .replace(/on\w+\s*=/gi, ''); // إزالة event handlers
    
    // تنظيف HTML الأساسي
    cleanText = validator.escape(cleanText);
    
    // تنظيف المسافات الزائدة
    cleanText = cleanText.trim().replace(/\s+/g, ' ');
    
    return cleanText;
};

module.exports = {
    validateEmail,
    validatePhone,
    validatePassword,
    validateUsername,
    validateArabicText,
    validateNumber,
    validateDate,
    validateFile,
    sanitizeText
};