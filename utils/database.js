/**
 * ملف إدارة قاعدة البيانات
 * يحتوي على دوال مساعدة للتعامل مع قاعدة البيانات MongoDB
 * @file database.js
 * @description مجموعة شاملة من دوال إدارة قاعدة البيانات
 * @version 1.0.0
 * @author فريق آكسيوم هب التقني
 */

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * الاتصال بقاعدة البيانات
 * @param {string} connectionString - نص الاتصال
 * @param {object} options - خيارات الاتصال
 * @returns {Promise<boolean>} - نتيجة الاتصال
 */
const connectDatabase = async (connectionString = process.env.MONGODB_URI, options = {}) => {
    try {
        const defaultOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10, // عدد الاتصالات المتزامنة
            serverSelectionTimeoutMS: 5000, // مهلة اختيار الخادم
            socketTimeoutMS: 45000, // مهلة المقبس
            bufferMaxEntries: 0, // تعطيل تخزين العمليات
            retryWrites: true,
            w: 'majority'
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        logger.info('جاري الاتصال بقاعدة البيانات...', { 
            host: connectionString.includes('@') ? 
                connectionString.split('@')[1].split('/')[0] : 'localhost'
        });
        
        await mongoose.connect(connectionString, finalOptions);
        
        logger.info('تم الاتصال بقاعدة البيانات بنجاح', {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port
        });
        
        // مراقبة أحداث قاعدة البيانات
        setupDatabaseEventListeners();
        
        return true;
    } catch (error) {
        logger.error('خطأ في الاتصال بقاعدة البيانات', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
};

/**
 * إعداد مراقبة أحداث قاعدة البيانات
 */
const setupDatabaseEventListeners = () => {
    const db = mongoose.connection;
    
    db.on('error', (error) => {
        logger.error('خطأ في قاعدة البيانات', { error: error.message });
    });
    
    db.on('disconnected', () => {
        logger.warn('تم قطع الاتصال مع قاعدة البيانات');
    });
    
    db.on('reconnected', () => {
        logger.info('تم إعادة الاتصال بقاعدة البيانات');
    });
    
    db.on('close', () => {
        logger.info('تم إغلاق الاتصال مع قاعدة البيانات');
    });
};

/**
 * قطع الاتصال مع قاعدة البيانات
 * @returns {Promise<boolean>} - نتيجة قطع الاتصال
 */
const disconnectDatabase = async () => {
    try {
        await mongoose.disconnect();
        logger.info('تم قطع الاتصال مع قاعدة البيانات بنجاح');
        return true;
    } catch (error) {
        logger.error('خطأ في قطع الاتصال مع قاعدة البيانات', { error: error.message });
        return false;
    }
};

/**
 * التحقق من حالة الاتصال
 * @returns {object} - معلومات حالة الاتصال
 */
const getDatabaseStatus = () => {
    const states = {
        0: 'منقطع',
        1: 'متصل',
        2: 'جاري الاتصال',
        3: 'جاري قطع الاتصال'
    };
    
    return {
        state: states[mongoose.connection.readyState] || 'غير معروف',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        collections: mongoose.connection.collections ? 
            Object.keys(mongoose.connection.collections) : []
    };
};

/**
 * إنشاء نسخة احتياطية من المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @param {string} backupPath - مسار النسخة الاحتياطية
 * @returns {Promise<boolean>} - نتيجة العملية
 */
const backupCollection = async (collectionName, backupPath = null) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        // الحصول على جميع الوثائق
        const documents = await collection.find({}).toArray();
        
        // إنشاء اسم الملف
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = backupPath || `backup_${collectionName}_${timestamp}.json`;
        
        // كتابة النسخة الاحتياطية
        const fs = require('fs').promises;
        await fs.writeFile(filename, JSON.stringify(documents, null, 2));
        
        logger.info('تم إنشاء نسخة احتياطية للمجموعة', {
            collection: collectionName,
            documentsCount: documents.length,
            filename: filename
        });
        
        return true;
    } catch (error) {
        logger.error('خطأ في إنشاء النسخة الاحتياطية', {
            collection: collectionName,
            error: error.message
        });
        return false;
    }
};

/**
 * استعادة النسخة الاحتياطية للمجموعة
 * @param {string} collectionName - اسم المجموعة
 * @param {string} backupPath - مسار النسخة الاحتياطية
 * @param {boolean} replaceExisting - استبدال البيانات الموجودة
 * @returns {Promise<boolean>} - نتيجة العملية
 */
const restoreCollection = async (collectionName, backupPath, replaceExisting = false) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        // قراءة النسخة الاحتياطية
        const fs = require('fs').promises;
        const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        
        if (!Array.isArray(backupData)) {
            throw new Error('تنسيق النسخة الاحتياطية غير صحيح');
        }
        
        // مسح البيانات الموجودة إذا طُلب ذلك
        if (replaceExisting) {
            await collection.deleteMany({});
            logger.info('تم مسح البيانات الموجودة في المجموعة', { collection: collectionName });
        }
        
        // إدراج البيانات المستعادة
        if (backupData.length > 0) {
            await collection.insertMany(backupData);
        }
        
        logger.info('تم استعادة النسخة الاحتياطية للمجموعة', {
            collection: collectionName,
            documentsRestored: backupData.length,
            backupPath: backupPath
        });
        
        return true;
    } catch (error) {
        logger.error('خطأ في استعادة النسخة الاحتياطية', {
            collection: collectionName,
            backupPath: backupPath,
            error: error.message
        });
        return false;
    }
};

/**
 * الحصول على إحصائيات المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @returns {Promise<object>} - إحصائيات المجموعة
 */
const getCollectionStats = async (collectionName) => {
    try {
        const db = mongoose.connection.db;
        const stats = await db.collection(collectionName).stats();
        
        return {
            collection: collectionName,
            documentsCount: stats.count || 0,
            averageDocumentSize: stats.avgObjSize || 0,
            dataSize: stats.size || 0,
            storageSize: stats.storageSize || 0,
            indexesCount: stats.nindexes || 0,
            indexesSize: stats.totalIndexSize || 0,
            lastModified: stats.wiredTiger?.metadata?.formatVersion || null
        };
    } catch (error) {
        logger.error('خطأ في الحصول على إحصائيات المجموعة', {
            collection: collectionName,
            error: error.message
        });
        return null;
    }
};

/**
 * الحصول على إحصائيات قاعدة البيانات العامة
 * @returns {Promise<object>} - إحصائيات قاعدة البيانات
 */
const getDatabaseStats = async () => {
    try {
        const db = mongoose.connection.db;
        const stats = await db.stats();
        
        // الحصول على قائمة المجموعات
        const collections = await db.listCollections().toArray();
        
        return {
            database: db.databaseName,
            collections: collections.length,
            documents: stats.objects || 0,
            dataSize: stats.dataSize || 0,
            storageSize: stats.storageSize || 0,
            indexesCount: stats.indexes || 0,
            indexesSize: stats.indexSize || 0,
            averageDocumentSize: stats.avgObjSize || 0,
            fileSize: stats.fileSize || 0,
            collectionsDetails: collections.map(col => ({
                name: col.name,
                type: col.type
            }))
        };
    } catch (error) {
        logger.error('خطأ في الحصول على إحصائيات قاعدة البيانات', { error: error.message });
        return null;
    }
};

/**
 * تنظيف المجموعة من الوثائق القديمة
 * @param {string} collectionName - اسم المجموعة
 * @param {object} criteria - معايير الحذف
 * @returns {Promise<number>} - عدد الوثائق المحذوفة
 */
const cleanOldDocuments = async (collectionName, criteria = {}) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        // إعداد معايير الحذف الافتراضية (أقدم من 30 يوماً)
        const defaultCriteria = {
            createdAt: {
                $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        };
        
        const finalCriteria = Object.keys(criteria).length > 0 ? criteria : defaultCriteria;
        
        const result = await collection.deleteMany(finalCriteria);
        
        logger.info('تم تنظيف الوثائق القديمة', {
            collection: collectionName,
            deletedCount: result.deletedCount,
            criteria: finalCriteria
        });
        
        return result.deletedCount;
    } catch (error) {
        logger.error('خطأ في تنظيف الوثائق القديمة', {
            collection: collectionName,
            error: error.message
        });
        return 0;
    }
};

/**
 * فهرسة المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @param {object} indexSpec - مواصفات الفهرس
 * @param {object} options - خيارات الفهرسة
 * @returns {Promise<boolean>} - نتيجة العملية
 */
const createIndex = async (collectionName, indexSpec, options = {}) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const defaultOptions = {
            background: true,
            sparse: false
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        await collection.createIndex(indexSpec, finalOptions);
        
        logger.info('تم إنشاء فهرس للمجموعة', {
            collection: collectionName,
            index: indexSpec,
            options: finalOptions
        });
        
        return true;
    } catch (error) {
        logger.error('خطأ في إنشاء الفهرس', {
            collection: collectionName,
            index: indexSpec,
            error: error.message
        });
        return false;
    }
};

/**
 * الحصول على فهارس المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @returns {Promise<Array>} - قائمة الفهارس
 */
const getCollectionIndexes = async (collectionName) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const indexes = await collection.indexes();
        
        return indexes.map(index => ({
            name: index.name,
            keys: index.key,
            unique: index.unique || false,
            sparse: index.sparse || false,
            background: index.background || false,
            size: index.size || 0
        }));
    } catch (error) {
        logger.error('خطأ في الحصول على فهارس المجموعة', {
            collection: collectionName,
            error: error.message
        });
        return [];
    }
};

/**
 * تنفيذ عملية تجميع (Aggregation)
 * @param {string} collectionName - اسم المجموعة
 * @param {Array} pipeline - مراحل التجميع
 * @param {object} options - خيارات التجميع
 * @returns {Promise<Array>} - نتائج التجميع
 */
const aggregate = async (collectionName, pipeline, options = {}) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const defaultOptions = {
            allowDiskUse: true,
            maxTimeMS: 30000
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        const result = await collection.aggregate(pipeline, finalOptions).toArray();
        
        logger.info('تم تنفيذ عملية التجميع', {
            collection: collectionName,
            pipelineStages: pipeline.length,
            resultsCount: result.length
        });
        
        return result;
    } catch (error) {
        logger.error('خطأ في تنفيذ عملية التجميع', {
            collection: collectionName,
            pipeline: pipeline,
            error: error.message
        });
        return [];
    }
};

/**
 * البحث النصي في المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @param {string} searchText - النص المراد البحث عنه
 * @param {object} options - خيارات البحث
 * @returns {Promise<Array>} - نتائج البحث
 */
const textSearch = async (collectionName, searchText, options = {}) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const {
            limit = 20,
            skip = 0,
            projection = {},
            language = 'arabic'
        } = options;
        
        const query = {
            $text: {
                $search: searchText,
                $language: language
            }
        };
        
        const results = await collection
            .find(query, { projection })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        logger.info('تم تنفيذ البحث النصي', {
            collection: collectionName,
            searchText: searchText,
            resultsCount: results.length
        });
        
        return results;
    } catch (error) {
        logger.error('خطأ في البحث النصي', {
            collection: collectionName,
            searchText: searchText,
            error: error.message
        });
        return [];
    }
};

/**
 * مراقبة التغييرات في المجموعة
 * @param {string} collectionName - اسم المجموعة
 * @param {Function} callback - دالة معالجة التغييرات
 * @param {object} options - خيارات المراقبة
 * @returns {object} - كائن المراقبة
 */
const watchChanges = (collectionName, callback, options = {}) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection(collectionName);
        
        const defaultOptions = {
            fullDocument: 'updateLookup'
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        const changeStream = collection.watch([], finalOptions);
        
        changeStream.on('change', (change) => {
            logger.info('تم رصد تغيير في المجموعة', {
                collection: collectionName,
                operationType: change.operationType,
                documentId: change.documentKey?._id
            });
            
            if (typeof callback === 'function') {
                callback(change);
            }
        });
        
        changeStream.on('error', (error) => {
            logger.error('خطأ في مراقبة التغييرات', {
                collection: collectionName,
                error: error.message
            });
        });
        
        logger.info('تم بدء مراقبة التغييرات', { collection: collectionName });
        
        return changeStream;
    } catch (error) {
        logger.error('خطأ في إعداد مراقبة التغييرات', {
            collection: collectionName,
            error: error.message
        });
        return null;
    }
};

module.exports = {
    connectDatabase,
    disconnectDatabase,
    getDatabaseStatus,
    backupCollection,
    restoreCollection,
    getCollectionStats,
    getDatabaseStats,
    cleanOldDocuments,
    createIndex,
    getCollectionIndexes,
    aggregate,
    textSearch,
    watchChanges
};