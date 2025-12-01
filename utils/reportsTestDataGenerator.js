// ملف لإنشاء بيانات تجريبية للتقارير والتحليلات
const mongoose = require('mongoose');
const { Report, Dashboard, Analytics, KPI } = require('../models/ReportsAnalytics');
const { ChecklistTemplate, Inspection } = require('../models/InspectionSystem');
const Company = require('../models/Company');
const User = require('../models/server_user');

class ReportsTestDataGenerator {
    
    // إنشاء بيانات تجريبية كاملة
    static async generateAllTestData(companyId, userId) {
        try {
            console.log('🚀 بدء إنشاء البيانات التجريبية للتقارير والتحليلات...');
            
            // إنشاء التقارير التجريبية
            const reports = await this.generateTestReports(companyId, userId);
            console.log(`✅ تم إنشاء ${reports.length} تقرير تجريبي`);
            
            // إنشاء لوحات المعلومات التجريبية
            const dashboards = await this.generateTestDashboards(companyId, userId);
            console.log(`✅ تم إنشاء ${dashboards.length} لوحة معلومات تجريبية`);
            
            // إنشاء أحداث التحليلات التجريبية
            const analytics = await this.generateTestAnalytics(companyId, userId);
            console.log(`✅ تم إنشاء ${analytics.length} حدث تحليلي تجريبي`);
            
            // إنشاء مؤشرات الأداء التجريبية
            const kpis = await this.generateTestKPIs(companyId, userId);
            console.log(`✅ تم إنشاء ${kpis.length} مؤشر أداء تجريبي`);
            
            console.log('🎉 تم إنشاء جميع البيانات التجريبية بنجاح!');
            
            return {
                reports,
                dashboards,
                analytics,
                kpis,
                summary: {
                    totalReports: reports.length,
                    totalDashboards: dashboards.length,
                    totalAnalyticsEvents: analytics.length,
                    totalKPIs: kpis.length
                }
            };
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء البيانات التجريبية:', error);
            throw error;
        }
    }
    
    // إنشاء تقارير تجريبية
    static async generateTestReports(companyId, userId) {
        const reports = [];
        
        // تقارير التفتيش
        const inspectionReports = [
            {
                title: 'Monthly Inspection Summary Report',
                arabicTitle: 'تقرير ملخص التفتيش الشهري',
                description: 'تقرير شامل لجميع عمليات التفتيش المنجزة خلال الشهر الحالي',
                type: 'inspection',
                category: 'quality',
                dateRange: {
                    startDate: new Date(2024, 0, 1),
                    endDate: new Date(2024, 0, 31)
                },
                status: 'completed',
                data: {
                    summary: {
                        totalRecords: 45,
                        successCount: 38,
                        failureCount: 7,
                        pendingCount: 0,
                        averageScore: 87.5,
                        completionRate: 95.6
                    },
                    charts: [
                        {
                            chartId: 'completion-trend',
                            type: 'line',
                            title: 'اتجاه إكمال التفتيش',
                            data: {
                                labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'],
                                datasets: [{
                                    label: 'عمليات التفتيش المكتملة',
                                    data: [12, 15, 8, 10],
                                    borderColor: '#3B82F6'
                                }]
                            }
                        }
                    ]
                },
                companyId,
                createdBy: userId,
                generationTime: {
                    startTime: new Date(Date.now() - 5000),
                    endTime: new Date(),
                    duration: 5
                }
            },
            {
                title: 'Quality Control Report Q1 2024',
                arabicTitle: 'تقرير مراقبة الجودة - الربع الأول 2024',
                description: 'تقرير تحليلي لمؤشرات الجودة والامتثال للمعايير',
                type: 'inspection',
                category: 'quality',
                dateRange: {
                    startDate: new Date(2024, 0, 1),
                    endDate: new Date(2024, 2, 31)
                },
                status: 'completed',
                data: {
                    summary: {
                        totalRecords: 127,
                        successCount: 105,
                        failureCount: 22,
                        pendingCount: 0,
                        averageScore: 82.7,
                        completionRate: 91.3
                    }
                },
                companyId,
                createdBy: userId
            }
        ];
        
        // تقارير الهوية البصرية
        const brandingReports = [
            {
                title: 'Branding Assets Usage Report',
                arabicTitle: 'تقرير استخدام عناصر الهوية البصرية',
                description: 'إحصائيات استخدام الشعارات والقوالب والألوان',
                type: 'branding',
                category: 'operational',
                dateRange: {
                    startDate: new Date(2024, 0, 1),
                    endDate: new Date(2024, 0, 31)
                },
                status: 'completed',
                data: {
                    summary: {
                        totalRecords: 28,
                        successCount: 25,
                        failureCount: 3,
                        pendingCount: 0,
                        averageScore: 89.3,
                        completionRate: 96.4
                    }
                },
                companyId,
                createdBy: userId
            }
        ];
        
        // تقارير نشاط المستخدمين
        const userActivityReports = [
            {
                title: 'User Activity Analytics Report',
                arabicTitle: 'تقرير تحليلات نشاط المستخدمين',
                description: 'تحليل شامل لأنشطة المستخدمين وأنماط الاستخدام',
                type: 'user_activity',
                category: 'performance',
                dateRange: {
                    startDate: new Date(2024, 0, 1),
                    endDate: new Date(2024, 0, 31)
                },
                status: 'completed',
                data: {
                    summary: {
                        totalRecords: 1245,
                        successCount: 1198,
                        failureCount: 47,
                        pendingCount: 0,
                        averageScore: 0,
                        completionRate: 0
                    }
                },
                companyId,
                createdBy: userId
            }
        ];
        
        // تجميع جميع التقارير
        const allReports = [...inspectionReports, ...brandingReports, ...userActivityReports];
        
        // إضافة تقارير معلقة وفي حالة التوليد
        allReports.push({
            title: 'Comprehensive Performance Report',
            arabicTitle: 'التقرير الشامل للأداء',
            description: 'تقرير شامل لجميع مؤشرات الأداء والإنجازات',
            type: 'company_overview',
            category: 'performance',
            dateRange: {
                startDate: new Date(2024, 0, 1),
                endDate: new Date(2024, 1, 29)
            },
            status: 'generating',
            companyId,
            createdBy: userId,
            generationTime: {
                startTime: new Date(Date.now() - 30000)
            }
        });
        
        // حفظ التقارير في قاعدة البيانات
        for (const reportData of allReports) {
            const report = new Report(reportData);
            await report.save();
            reports.push(report);
        }
        
        return reports;
    }
    
    // إنشاء لوحات معلومات تجريبية
    static async generateTestDashboards(companyId, userId) {
        const dashboards = [];
        
        const dashboardsData = [
            {
                name: 'Executive Dashboard',
                arabicName: 'لوحة المعلومات التنفيذية',
                description: 'لوحة معلومات شاملة للإدارة العليا',
                type: 'executive',
                layout: {
                    grid: {
                        cols: 12,
                        rows: 8
                    },
                    responsive: true
                },
                widgets: [
                    {
                        widgetId: 'kpi-overview',
                        type: 'kpi',
                        title: 'نظرة عامة على مؤشرات الأداء',
                        position: { x: 0, y: 0, w: 6, h: 2 },
                        dataSource: {
                            type: 'database',
                            query: { collection: 'kpis', filter: { status: 'active' } }
                        },
                        settings: {
                            refreshInterval: 300,
                            showTrends: true
                        }
                    },
                    {
                        widgetId: 'inspection-stats',
                        type: 'chart',
                        title: 'إحصائيات التفتيش',
                        position: { x: 6, y: 0, w: 6, h: 4 },
                        dataSource: {
                            type: 'database',
                            query: { collection: 'inspections' }
                        },
                        chartConfig: {
                            type: 'bar',
                            options: {
                                responsive: true
                            }
                        }
                    }
                ],
                permissions: {
                    viewRoles: ['admin', 'manager', 'executive'],
                    editRoles: ['admin', 'manager'],
                    shareRoles: ['admin']
                },
                companyId,
                createdBy: userId
            },
            {
                name: 'Quality Control Dashboard',
                arabicName: 'لوحة مراقبة الجودة',
                description: 'متابعة مؤشرات الجودة والامتثال',
                type: 'operational',
                layout: {
                    grid: { cols: 12, rows: 6 },
                    responsive: true
                },
                widgets: [
                    {
                        widgetId: 'quality-metrics',
                        type: 'metric',
                        title: 'مؤشرات الجودة',
                        position: { x: 0, y: 0, w: 4, h: 2 }
                    },
                    {
                        widgetId: 'defect-rate',
                        type: 'gauge',
                        title: 'معدل العيوب',
                        position: { x: 4, y: 0, w: 4, h: 2 }
                    }
                ],
                permissions: {
                    viewRoles: ['admin', 'manager', 'quality_inspector'],
                    editRoles: ['admin', 'manager'],
                    shareRoles: ['admin', 'manager']
                },
                companyId,
                createdBy: userId
            }
        ];
        
        for (const dashboardData of dashboardsData) {
            const dashboard = new Dashboard(dashboardData);
            await dashboard.save();
            dashboards.push(dashboard);
        }
        
        return dashboards;
    }
    
    // إنشاء أحداث تحليلية تجريبية
    static async generateTestAnalytics(companyId, userId) {
        const analytics = [];
        
        // أحداث متنوعة للشهر الماضي
        const eventTypes = ['page_view', 'button_click', 'form_submit', 'file_upload', 'report_generate'];
        const pages = [
            '/dashboard', '/reports', '/inspections', '/branding', 
            '/users', '/settings', '/analytics'
        ];
        
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // منذ 30 يوم
        
        for (let i = 0; i < 500; i++) {
            const randomDate = new Date(
                startDate.getTime() + Math.random() * (Date.now() - startDate.getTime())
            );
            
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const page = pages[Math.floor(Math.random() * pages.length)];
            
            let eventData = {};
            let eventCategory = 'general';
            
            switch (eventType) {
                case 'page_view':
                    eventData = {
                        page: page,
                        loadTime: Math.floor(Math.random() * 3000) + 500,
                        referrer: Math.random() > 0.5 ? '/dashboard' : 'direct'
                    };
                    eventCategory = 'navigation';
                    break;
                    
                case 'button_click':
                    eventData = {
                        buttonId: `btn-${Math.floor(Math.random() * 100)}`,
                        buttonText: 'إجراء',
                        page: page
                    };
                    eventCategory = 'interaction';
                    break;
                    
                case 'form_submit':
                    eventData = {
                        formType: Math.random() > 0.5 ? 'inspection' : 'report',
                        success: Math.random() > 0.2,
                        validationErrors: Math.floor(Math.random() * 3)
                    };
                    eventCategory = 'form';
                    break;
                    
                case 'file_upload':
                    eventData = {
                        fileSize: Math.floor(Math.random() * 5000000),
                        fileType: Math.random() > 0.5 ? 'image' : 'document',
                        success: Math.random() > 0.1
                    };
                    eventCategory = 'file';
                    break;
                    
                case 'report_generate':
                    eventData = {
                        reportType: Math.random() > 0.5 ? 'inspection' : 'branding',
                        processingTime: Math.floor(Math.random() * 30000) + 5000,
                        success: Math.random() > 0.15
                    };
                    eventCategory = 'report';
                    break;
            }
            
            const analytic = new Analytics({
                eventType,
                eventCategory,
                eventData,
                user: {
                    userId: userId,
                    sessionId: `session_${Math.floor(Math.random() * 1000)}`,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`
                },
                device: {
                    type: Math.random() > 0.8 ? 'mobile' : 'desktop',
                    os: Math.random() > 0.5 ? 'Windows' : 'macOS',
                    browser: Math.random() > 0.5 ? 'Chrome' : 'Firefox'
                },
                context: {
                    page: page,
                    referrer: Math.random() > 0.5 ? '/dashboard' : 'direct'
                },
                companyId,
                timestamp: randomDate
            });
            
            await analytic.save();
            analytics.push(analytic);
        }
        
        return analytics;
    }
    
    // إنشاء مؤشرات أداء تجريبية
    static async generateTestKPIs(companyId, userId) {
        const kpis = [];
        
        const kpisData = [
            {
                name: 'Inspection Success Rate',
                arabicName: 'معدل نجاح التفتيش',
                description: 'نسبة عمليات التفتيش التي تم اجتيازها بنجاح',
                category: 'quality',
                unit: 'percentage',
                formula: 'inspection_success_rate',
                target: {
                    value: 90,
                    comparison: 'gte'
                },
                thresholds: [
                    { min: 90, max: 100, status: 'good', color: '#10B981' },
                    { min: 70, max: 89, status: 'warning', color: '#F59E0B' },
                    { min: 0, max: 69, status: 'critical', color: '#EF4444' }
                ],
                currentValue: {
                    value: 87.5,
                    previousValue: 85.2,
                    changePercent: 2.7,
                    trend: 'up',
                    lastCalculated: new Date(),
                    status: 'warning'
                },
                historicalData: this.generateHistoricalData(85, 95, 30),
                companyId,
                createdBy: userId,
                status: 'active',
                priority: 1,
                sortOrder: 1
            },
            {
                name: 'Average Inspection Score',
                arabicName: 'متوسط نقاط التفتيش',
                description: 'المتوسط العام لنقاط التقييم في عمليات التفتيش',
                category: 'quality',
                unit: 'score',
                formula: 'avg_inspection_score',
                target: {
                    value: 85,
                    comparison: 'gte'
                },
                thresholds: [
                    { min: 85, max: 100, status: 'good', color: '#10B981' },
                    { min: 70, max: 84, status: 'warning', color: '#F59E0B' },
                    { min: 0, max: 69, status: 'critical', color: '#EF4444' }
                ],
                currentValue: {
                    value: 88.3,
                    previousValue: 86.7,
                    changePercent: 1.8,
                    trend: 'up',
                    lastCalculated: new Date(),
                    status: 'good'
                },
                historicalData: this.generateHistoricalData(80, 90, 30),
                companyId,
                createdBy: userId,
                status: 'active',
                priority: 2,
                sortOrder: 2
            },
            {
                name: 'Monthly Reports Generated',
                arabicName: 'التقارير المولدة شهرياً',
                description: 'عدد التقارير التي تم إنتاجها في الشهر الحالي',
                category: 'productivity',
                unit: 'count',
                formula: 'monthly_reports_count',
                target: {
                    value: 50,
                    comparison: 'gte'
                },
                thresholds: [
                    { min: 50, max: 1000, status: 'good', color: '#10B981' },
                    { min: 30, max: 49, status: 'warning', color: '#F59E0B' },
                    { min: 0, max: 29, status: 'critical', color: '#EF4444' }
                ],
                currentValue: {
                    value: 42,
                    previousValue: 38,
                    changePercent: 10.5,
                    trend: 'up',
                    lastCalculated: new Date(),
                    status: 'warning'
                },
                historicalData: this.generateHistoricalData(35, 55, 30),
                companyId,
                createdBy: userId,
                status: 'active',
                priority: 3,
                sortOrder: 3
            },
            {
                name: 'User Engagement Rate',
                arabicName: 'معدل تفاعل المستخدمين',
                description: 'نسبة المستخدمين النشطين من إجمالي المستخدمين',
                category: 'engagement',
                unit: 'percentage',
                formula: 'user_engagement_rate',
                target: {
                    value: 75,
                    comparison: 'gte'
                },
                thresholds: [
                    { min: 75, max: 100, status: 'good', color: '#10B981' },
                    { min: 50, max: 74, status: 'warning', color: '#F59E0B' },
                    { min: 0, max: 49, status: 'critical', color: '#EF4444' }
                ],
                currentValue: {
                    value: 78.9,
                    previousValue: 76.5,
                    changePercent: 3.1,
                    trend: 'up',
                    lastCalculated: new Date(),
                    status: 'good'
                },
                historicalData: this.generateHistoricalData(70, 85, 30),
                companyId,
                createdBy: userId,
                status: 'active',
                priority: 4,
                sortOrder: 4
            }
        ];
        
        for (const kpiData of kpisData) {
            const kpi = new KPI(kpiData);
            await kpi.save();
            kpis.push(kpi);
        }
        
        return kpis;
    }
    
    // توليد بيانات تاريخية
    static generateHistoricalData(min, max, days) {
        const historicalData = [];
        const now = new Date();
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const value = Math.floor(Math.random() * (max - min + 1)) + min;
            
            historicalData.push({
                period: date.toISOString().split('T')[0],
                value: value,
                calculatedAt: date
            });
        }
        
        return historicalData;
    }
    
    // حذف جميع البيانات التجريبية
    static async clearAllTestData(companyId) {
        try {
            console.log('🗑️ بدء حذف البيانات التجريبية...');
            
            const deleteResults = await Promise.all([
                Report.deleteMany({ companyId }),
                Dashboard.deleteMany({ companyId }),
                Analytics.deleteMany({ companyId }),
                KPI.deleteMany({ companyId })
            ]);
            
            console.log('✅ تم حذف جميع البيانات التجريبية:');
            console.log(`   - التقارير: ${deleteResults[0].deletedCount}`);
            console.log(`   - لوحات المعلومات: ${deleteResults[1].deletedCount}`);
            console.log(`   - أحداث التحليلات: ${deleteResults[2].deletedCount}`);
            console.log(`   - مؤشرات الأداء: ${deleteResults[3].deletedCount}`);
            
            return deleteResults;
            
        } catch (error) {
            console.error('❌ خطأ في حذف البيانات التجريبية:', error);
            throw error;
        }
    }
}

module.exports = ReportsTestDataGenerator;