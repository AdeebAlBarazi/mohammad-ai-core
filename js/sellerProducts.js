// axiom-marketplace/public/js/pages/sellerProducts.js

import { getSellerProducts, createSellerProduct, updateSellerProduct, deleteSellerProduct } from './sellerAPI.js';
import { renderSellerProductRow, openProductModal, closeProductModal, getProductFormData, bindModalControls } from './sellerUI.js';

// ملاحظات:
// تم تعديل مسارات الاستيراد لتلائم الوضع الحالي (ملفات في الجذر)
// إضافة دعم الفلترة والفرز وإعادة ضبط التمرير اللانهائي بعد تغيير المعايير

let currentPage = 1;
let hasMore = true;
let isLoading = false;
let observer = null;
let filters = {
    category: '',
    status: '',
    priceMin: '',
    priceMax: '',
    sort: 'recent'
};
const CATEGORIES = ['سيراميك', 'رخام', 'أدوات بناء'];

const tableBody = () => document.querySelector('.products-table tbody');
const loaderEl = () => document.getElementById('infinite-scroll-loader');
const sentinelEl = () => document.getElementById('scroll-sentinel');

function resetPagination() {
    currentPage = 1;
    hasMore = true;
    isLoading = false;
    // تفريغ الجدول
    if (tableBody()) tableBody().innerHTML = '';
    // إعادة مراقبة العنصر الحارس
    if (observer && sentinelEl()) {
        observer.unobserve(sentinelEl());
        observer.observe(sentinelEl());
    }
}

function loadProducts() {
    resetPagination();
    return loadMoreProducts();
}

export async function initSellerProductsPage() {
    const addProductBtn = document.getElementById('add-product-btn');
    const productForm = document.getElementById('product-form');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    bindModalControls();

    // تحميل الأقسام داخل الـ modal إن وجدت
    const categorySelect = document.getElementById('product-category');
    if (categorySelect) {
        categorySelect.innerHTML = `<option value="">اختر قسماً</option>` + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // فتح النموذج عند الضغط على "إضافة منتج جديد"
    if (addProductBtn) {
        addProductBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openProductModal(); // فتح النموذج فارغاً
        });
    }

    // معالجة حفظ النموذج
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('product-id').value;
            const productData = getProductFormData();
            // التحقق السريع من الحقول الأساسية
            if (!productData.nameAr || !productData.nameEn) {
                alert('الاسم بالعربي والإنجليزي مطلوبان');
                return;
            }
            let result;

            if (productId) {
                // تحديث منتج موجود
                result = await updateSellerProduct(productId, productData);
            } else {
                // إنشاء منتج جديد
                result = await createSellerProduct(productData);
            }

            if (result.success) {
                closeProductModal();
                await loadProducts(); // إعادة تحميل الجدول باستخدام الدالة الجديدة
            } else {
                alert(`فشل حفظ المنتج: ${result.message}`);
            }
        });
    }

    if (!tableBody()) return;

    async function loadMoreProducts() {
        if (isLoading || !hasMore) return;
        isLoading = true;
        if (loaderEl()) loaderEl().style.display = 'block';

        const result = await getSellerProducts({
            page: currentPage,
            limit: 20,
            category: filters.category,
            status: filters.status,
            priceMin: filters.priceMin,
            priceMax: filters.priceMax,
            sort: filters.sort
        });

        if (result.success) {
            result.data.forEach(product => {
                tableBody().innerHTML += renderSellerProductRow(product);
            });
            if (currentPage >= result.pagination.totalPages) {
                hasMore = false;
                if (sentinelEl()) observer.unobserve(sentinelEl());
            } else {
                currentPage++;
            }
        } else {
            hasMore = false;
            if (sentinelEl()) observer.unobserve(sentinelEl());
        }

        if (loaderEl()) loaderEl().style.display = 'none';
        isLoading = false;
    }

    // إعداد المراقب
    observer = new IntersectionObserver(async (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting) await loadMoreProducts();
    }, { threshold: 0.5 });
    if (sentinelEl()) observer.observe(sentinelEl());

    // تطبيق الفلاتر
    function collectFilters() {
        filters.category = document.getElementById('filter-category').value;
        filters.status = document.getElementById('filter-status').value;
        filters.priceMin = document.getElementById('filter-price-min').value;
        filters.priceMax = document.getElementById('filter-price-max').value;
        filters.sort = document.getElementById('filter-sort').value;
        // التحقق من منطق السعر
        const min = parseFloat(filters.priceMin || '');
        const max = parseFloat(filters.priceMax || '');
        if (!isNaN(min) && !isNaN(max) && min > max) {
            alert('القيمة الدنيا أعلى من القيمة العليا للسعر');
            return false;
        }
        return true;
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!collectFilters()) return;
            loadProducts();
        });
    }

    // تطبيق تلقائي عند تغيير القيم الرئيسية (باستثناء إدخال السعر لتجنب كثرة الطلبات)
    ['filter-category', 'filter-status', 'filter-sort'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { if (collectFilters()) loadProducts(); });
    });

    // تطبيق عند الضغط على Enter داخل حقول السعر
    ['filter-price-min', 'filter-price-max'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (!collectFilters()) return;
                loadProducts();
            }
        });
    });

    // إعادة الفلاتر
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('filter-category').value = '';
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-price-min').value = '';
            document.getElementById('filter-price-max').value = '';
            document.getElementById('filter-sort').value = 'recent';
            filters = { category: '', status: '', priceMin: '', priceMax: '', sort: 'recent' };
            loadProducts();
        });
    }

    // إضافة معالجات الأحداث لأزرار التعديل (مرة واحدة فقط)
    tableBody().addEventListener('click', async (e) => {
        // تعديل
        if (e.target.classList.contains('action-edit')) {
            e.preventDefault();
            const productId = e.target.dataset.id;
            // في غياب API حقيقي سنعيد بناء البيانات من عنصر الصف
            const row = e.target.closest('tr');
            const productData = {
                id: productId,
                nameAr: row.querySelector('.product-name')?.textContent || '',
                sku: row.querySelector('.product-sku')?.textContent || '',
                price: parseFloat((row.querySelector('.product-price')?.dataset.value) || '0'),
                stock: parseInt((row.querySelector('.product-stock')?.textContent) || '0'),
                status: row.querySelector('.status-badge')?.classList.contains('inactive') ? 'inactive' : 'active',
                category: row.dataset.category || ''
            };
            openProductModal(productData);
        }
        // حذف
        if (e.target.classList.contains('action-delete')) {
            e.preventDefault();
            const productId = e.target.dataset.id;
            if (confirm('هل تريد حذف هذا المنتج؟')) {
                const result = await deleteSellerProduct(productId);
                if (result.success) {
                    e.target.closest('tr').remove();
                } else {
                    alert('فشل الحذف');
                }
            }
        }
    });

    // تحميل الصفحة الأولى عند فتح الصفحة
    await loadMoreProducts();
}