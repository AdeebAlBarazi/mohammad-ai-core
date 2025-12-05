// Payment Gateway Configuration
// تكوين بوابات الدفع

// ============================================
// PayPal Configuration
// ============================================
const PAYPAL_CONFIG = {
    // احصل على Client ID من: https://developer.paypal.com/dashboard/applications
    clientId: 'AaK-XCswt2h7iEHQ8nJ9qs2p623vRdmSbMVIYQVJnqeQemTLRwS8nQ2jsU-w_jjGjIJz5JotpWweOLja',
    
    // العملة
    currency: 'USD',
    
    // نوع المعاملة
    intent: 'CAPTURE', // أو 'AUTHORIZE' للحجز المؤقت
    
    // البيئة: 'sandbox' للتجربة أو 'production' للإنتاج
    environment: 'production',
    
    // رابط webhook للإشعارات (اختياري)
    webhookUrl: 'https://your-domain.com/api/paypal/webhook'
};

// ============================================
// Stripe Configuration
// ============================================
const STRIPE_CONFIG = {
    // احصل على Publishable Key من: https://dashboard.stripe.com/apikeys
    publishableKey: 'pk_live_YOUR_PUBLISHABLE_KEY_HERE',
    
    // العملة
    currency: 'usd',
    
    // اللغة
    locale: 'ar', // ar للعربية، en للإنجليزية
    
    // وسائل الدفع المفعّلة
    paymentMethodTypes: ['card'], // يمكن إضافة 'apple_pay', 'google_pay'
    
    // رابط النجاح والإلغاء
    successUrl: window.location.origin + '/payment-success.html',
    cancelUrl: window.location.origin + '/payment.html'
};

// ============================================
// EmailJS Configuration (للإشعارات)
// ============================================
const EMAILJS_CONFIG = {
    // احصل على المفاتيح من: https://www.emailjs.com
    serviceId: 'service_XXXXXXX',
    templateIdCustomer: 'template_customer_confirmation',
    templateIdAdmin: 'template_admin_notification',
    publicKey: 'YOUR_EMAILJS_PUBLIC_KEY'
};

// ============================================
// Application Settings
// ============================================
const APP_CONFIG = {
    // معلومات البائع
    businessName: 'Dr. Mohammad Consulting Services',
    businessEmail: 'adeeb@myprofcv.com',
    
    // الأسعار (بالدولار)
    pricing: {
        consultations: 150, // الاستشارات
        webDesign: 29      // تصميم المواقع
    },
    
    // وضع التطوير: true للاختبار، false للإنتاج
    developmentMode: true,
    
    // تفعيل السجلات (logs)
    enableLogging: true
};

// ============================================
// Consultation Types Mapping
// ============================================
const CONSULTATION_TYPES = {
    'web-design-portfolio': { 
        name: 'تصميم موقع بروفايل', 
        price: APP_CONFIG.pricing.webDesign,
        category: 'web-design'
    },
    'web-design-ecommerce': { 
        name: 'تصميم متجر إلكتروني', 
        price: APP_CONFIG.pricing.webDesign,
        category: 'web-design'
    },
    'web-design-custom': { 
        name: 'تصميم موقع مخصص', 
        price: APP_CONFIG.pricing.webDesign,
        category: 'web-design'
    },
    'systems-analysis': { 
        name: 'تحليل النظم', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'risk-management': { 
        name: 'إدارة المخاطر', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'strategic-planning': { 
        name: 'التخطيط الاستراتيجي', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'project-management': { 
        name: 'إدارة المشاريع', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'ai-consulting': { 
        name: 'استشارات الذكاء الاصطناعي', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'data-analysis': { 
        name: 'تحليل البيانات', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    },
    'other': { 
        name: 'أخرى', 
        price: APP_CONFIG.pricing.consultations,
        category: 'consultation'
    }
};

// ============================================
// Export Configuration
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PAYPAL_CONFIG,
        STRIPE_CONFIG,
        EMAILJS_CONFIG,
        APP_CONFIG,
        CONSULTATION_TYPES
    };
}
