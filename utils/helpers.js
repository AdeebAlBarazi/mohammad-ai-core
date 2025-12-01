/**
 * ملف الدوال المساعدة العامة
 * يحتوي على دوال مساعدة متنوعة للاستخدام في جميع أنحاء التطبيق
 * @file helpers.js
 * @description مجموعة شاملة من الدوال المساعدة
 * @version 1.0.0
 * @author فريق آكسيوم هب التقني
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * إنشاء معرف فريد (UUID)
 * @returns {string} - معرف فريد
 */
const generateUUID = () => {
    return crypto.randomUUID();
};

/**
 * إنشاء رمز عشوائي
 * @param {number} length - طول الرمز
 * @param {object} options - خيارات الإنشاء
 * @returns {string} - الرمز العشوائي
 */
const generateRandomCode = (length = 6, options = {}) => {
    const {
        includeNumbers = true,
        includeLetters = true,
        includeUpperCase = true,
        includeLowerCase = true,
        includeSpecialChars = false
    } = options;
    
    let chars = '';
    
    if (includeNumbers) chars += '0123456789';
    if (includeLetters && includeUpperCase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLetters && includeLowerCase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeSpecialChars) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (!chars) chars = '0123456789'; // افتراضي
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
};

/**
 * تشفير النص
 * @param {string} text - النص للتشفير
 * @param {string} key - مفتاح التشفير
 * @returns {string} - النص المشفر
 */
const encryptText = (text, key = process.env.ENCRYPTION_KEY || 'axiomhub-default-key') => {
    try {
        const algorithm = 'aes-256-cbc';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        throw new Error('خطأ في تشفير النص: ' + error.message);
    }
};

/**
 * فك تشفير النص
 * @param {string} encryptedText - النص المشفر
 * @param {string} key - مفتاح التشفير
 * @returns {string} - النص الأصلي
 */
const decryptText = (encryptedText, key = process.env.ENCRYPTION_KEY || 'axiomhub-default-key') => {
    try {
        const algorithm = 'aes-256-cbc';
        const textParts = encryptedText.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encrypted = textParts.join(':');
        
        const decipher = crypto.createDecipher(algorithm, key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error('خطأ في فك تشفير النص: ' + error.message);
    }
};

/**
 * تحويل التاريخ إلى تنسيق عربي
 * @param {Date|string} date - التاريخ
 * @param {object} options - خيارات التنسيق
 * @returns {string} - التاريخ بالتنسيق العربي
 */
const formatArabicDate = (date, options = {}) => {
    const {
        includeTime = false,
        includeSeconds = false,
        timezone = 'Asia/Riyadh'
    } = options;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
        return 'تاريخ غير صحيح';
    }
    
    const formatter = new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: includeTime ? 'numeric' : undefined,
        minute: includeTime ? 'numeric' : undefined,
        second: includeTime && includeSeconds ? 'numeric' : undefined,
        timeZone: timezone,
        hour12: true
    });
    
    return formatter.format(dateObj);
};

/**
 * حساب الفرق بين تاريخين بالعربية
 * @param {Date|string} startDate - تاريخ البداية
 * @param {Date|string} endDate - تاريخ النهاية
 * @returns {string} - الفرق بالعربية
 */
const getDateDifferenceInArabic = (startDate, endDate = new Date()) => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    
    const diffMs = Math.abs(end - start);
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffYears > 0) {
        return diffYears === 1 ? 'سنة واحدة' : `${diffYears} سنوات`;
    } else if (diffMonths > 0) {
        return diffMonths === 1 ? 'شهر واحد' : `${diffMonths} شهور`;
    } else if (diffWeeks > 0) {
        return diffWeeks === 1 ? 'أسبوع واحد' : `${diffWeeks} أسابيع`;
    } else if (diffDays > 0) {
        return diffDays === 1 ? 'يوم واحد' : `${diffDays} أيام`;
    } else if (diffHours > 0) {
        return diffHours === 1 ? 'ساعة واحدة' : `${diffHours} ساعات`;
    } else if (diffMinutes > 0) {
        return diffMinutes === 1 ? 'دقيقة واحدة' : `${diffMinutes} دقائق`;
    } else {
        return 'أقل من دقيقة';
    }
};

/**
 * تحويل الأرقام الإنجليزية إلى عربية
 * @param {string|number} input - المدخل
 * @returns {string} - النص بالأرقام العربية
 */
const convertToArabicNumbers = (input) => {
    const englishNumbers = '0123456789';
    const arabicNumbers = '٠١٢٣٤٥٦٧٨٩';
    
    return String(input).replace(/[0-9]/g, (match) => {
        return arabicNumbers[englishNumbers.indexOf(match)];
    });
};

/**
 * تحويل الأرقام العربية إلى إنجليزية
 * @param {string} input - المدخل
 * @returns {string} - النص بالأرقام الإنجليزية
 */
const convertToEnglishNumbers = (input) => {
    const arabicNumbers = '٠١٢٣٤٥٦٧٨٩';
    const englishNumbers = '0123456789';
    
    return String(input).replace(/[٠-٩]/g, (match) => {
        return englishNumbers[arabicNumbers.indexOf(match)];
    });
};

/**
 * تنسيق الأرقام بالفواصل العربية
 * @param {number} number - الرقم
 * @param {object} options - خيارات التنسيق
 * @returns {string} - الرقم المنسق
 */
const formatArabicNumber = (number, options = {}) => {
    const {
        currency = false,
        currencySymbol = 'ر.س',
        decimalPlaces = 2,
        useArabicNumerals = false
    } = options;
    
    const formatter = new Intl.NumberFormat('ar-SA', {
        style: currency ? 'currency' : 'decimal',
        currency: currency ? 'SAR' : undefined,
        minimumFractionDigits: currency ? 2 : 0,
        maximumFractionDigits: decimalPlaces
    });
    
    let formatted = formatter.format(number);
    
    if (currency && currencySymbol !== 'ر.س') {
        formatted = formatted.replace('ر.س', currencySymbol);
    }
    
    if (useArabicNumerals) {
        formatted = convertToArabicNumbers(formatted);
    }
    
    return formatted;
};

/**
 * تقصير النص مع إضافة نقاط
 * @param {string} text - النص
 * @param {number} maxLength - الطول الأقصى
 * @param {string} suffix - اللاحقة
 * @returns {string} - النص المقصر
 */
const truncateText = (text, maxLength = 100, suffix = '...') => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength - suffix.length).trim() + suffix;
};

/**
 * تحويل النص إلى عنوان URL مناسب
 * @param {string} text - النص
 * @returns {string} - عنوان URL
 */
const slugify = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    return text
        .toLowerCase()
        .replace(/[\u0600-\u06FF]/g, (match) => {
            // تحويل الأحرف العربية إلى نسخة لاتينية
            const arabicToLatin = {
                'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
                'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r',
                'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
                'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
                'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
                'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'h', 'ى': 'a'
            };
            return arabicToLatin[match] || match;
        })
        .replace(/[^\w\s-]/g, '') // إزالة الأحرف الخاصة
        .replace(/[\s_-]+/g, '-') // تحويل المسافات إلى شرطات
        .replace(/^-+|-+$/g, ''); // إزالة الشرطات من البداية والنهاية
};

/**
 * إنشاء ملخص للنص
 * @param {string} text - النص الكامل
 * @param {number} sentences - عدد الجمل في الملخص
 * @returns {string} - الملخص
 */
const generateSummary = (text, sentences = 2) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // تقسيم النص إلى جمل
    const sentenceArray = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentenceArray.length <= sentences) {
        return text;
    }
    
    // أخذ أول عدد من الجمل
    return sentenceArray.slice(0, sentences).join('. ').trim() + '.';
};

/**
 * تحويل حجم الملف إلى نص قابل للقراءة
 * @param {number} bytes - حجم الملف بالبايت
 * @param {boolean} useArabic - استخدام الوحدات العربية
 * @returns {string} - حجم الملف المنسق
 */
const formatFileSize = (bytes, useArabic = true) => {
    if (bytes === 0) return useArabic ? '٠ بايت' : '0 Bytes';
    
    const k = 1024;
    const sizes = useArabic ? 
        ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت'] :
        ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    
    return useArabic ? 
        convertToArabicNumbers(size) + ' ' + sizes[i] :
        size + ' ' + sizes[i];
};

/**
 * التحقق من وجود الملف
 * @param {string} filePath - مسار الملف
 * @returns {boolean} - نتيجة التحقق
 */
const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * إنشاء مجلد إذا لم يكن موجوداً
 * @param {string} dirPath - مسار المجلد
 * @returns {boolean} - نتيجة العملية
 */
const ensureDirectory = async (dirPath) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (error) {
        console.error('خطأ في إنشاء المجلد:', error);
        return false;
    }
};

/**
 * الحصول على امتداد الملف
 * @param {string} filename - اسم الملف
 * @returns {string} - امتداد الملف
 */
const getFileExtension = (filename) => {
    if (!filename || typeof filename !== 'string') {
        return '';
    }
    
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot + 1).toLowerCase();
};

/**
 * تحويل المصفوفة إلى نص منسق بالعربية
 * @param {Array} array - المصفوفة
 * @param {string} separator - الفاصل
 * @param {string} lastSeparator - الفاصل الأخير
 * @returns {string} - النص المنسق
 */
const arrayToArabicText = (array, separator = '، ', lastSeparator = ' و ') => {
    if (!Array.isArray(array) || array.length === 0) {
        return '';
    }
    
    if (array.length === 1) {
        return String(array[0]);
    }
    
    if (array.length === 2) {
        return array[0] + lastSeparator + array[1];
    }
    
    const lastItem = array.pop();
    return array.join(separator) + lastSeparator + lastItem;
};

/**
 * تنظيف البيانات من القيم الفارغة
 * @param {object} obj - الكائن للتنظيف
 * @returns {object} - الكائن المنظف
 */
const cleanObject = (obj) => {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'object' && !Array.isArray(value)) {
                const nestedCleaned = cleanObject(value);
                if (Object.keys(nestedCleaned).length > 0) {
                    cleaned[key] = nestedCleaned;
                }
            } else {
                cleaned[key] = value;
            }
        }
    }
    
    return cleaned;
};

/**
 * إنشاء رابط آمن
 * @param {string} url - الرابط
 * @returns {string} - الرابط الآمن
 */
const safeUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return '#';
    }
    
    // التحقق من البروتوكول الآمن
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
        const urlObj = new URL(url);
        if (safeProtocols.includes(urlObj.protocol)) {
            return url;
        }
    } catch {
        // إذا لم يكن URL صحيحاً، التحقق من كونه مسار نسبي
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
            return url;
        }
    }
    
    return '#';
};

module.exports = {
    generateUUID,
    generateRandomCode,
    encryptText,
    decryptText,
    formatArabicDate,
    getDateDifferenceInArabic,
    convertToArabicNumbers,
    convertToEnglishNumbers,
    formatArabicNumber,
    truncateText,
    slugify,
    generateSummary,
    formatFileSize,
    fileExists,
    ensureDirectory,
    getFileExtension,
    arrayToArabicText,
    cleanObject,
    safeUrl
};