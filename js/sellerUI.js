// sellerUI.js
// دوال مساعدة لعرض وتحرير منتجات البائع

export function renderSellerProductRow(p) {
	return `<tr data-id="${p.id}" data-category="${p.category}">
		<td class="product-image-cell"><img src="https://via.placeholder.com/80x80/ddd/666?text=${encodeURIComponent(p.category[0] || 'P')}" alt="${p.nameAr}"></td>
		<td class="product-name">${escapeHtml(p.nameAr)}</td>
		<td class="product-sku">${escapeHtml(p.sku)}</td>
		<td class="product-price" data-value="${p.price}">${p.price.toFixed(2)} ريال</td>
		<td class="product-stock">${p.stock}</td>
		<td><span class="status-badge ${p.status === 'active' ? 'active' : 'inactive'}">${p.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
		<td>
			<a href="#" class="action-edit" data-id="${p.id}">تعديل</a> |
			<a href="#" class="action-delete" data-id="${p.id}">حذف</a>
		</td>
	</tr>`;
}

export function openProductModal(product) {
	const modal = document.getElementById('product-modal');
	const title = document.getElementById('modal-title');
	if (!modal) return;
	if (product) {
		title.textContent = 'تعديل منتج';
		document.getElementById('product-id').value = product.id;
		document.getElementById('product-name-ar').value = product.nameAr || '';
		document.getElementById('product-name-en').value = product.nameEn || '';
		document.getElementById('product-price').value = product.price || 0;
		document.getElementById('product-quantity').value = product.stock || product.quantity || 0;
		document.getElementById('product-category').value = product.category || '';
		document.getElementById('product-description-ar').value = product.descriptionAr || '';
	} else {
		title.textContent = 'إضافة منتج جديد';
		document.getElementById('product-form').reset();
		document.getElementById('product-id').value = '';
	}
	modal.style.display = 'flex';
}

export function closeProductModal() {
	const modal = document.getElementById('product-modal');
	if (modal) modal.style.display = 'none';
}

export function getProductFormData() {
	return {
		nameAr: document.getElementById('product-name-ar').value.trim(),
		nameEn: document.getElementById('product-name-en').value.trim(),
		price: parseFloat(document.getElementById('product-price').value || '0'),
		quantity: parseInt(document.getElementById('product-quantity').value || '0'),
		category: document.getElementById('product-category').value,
		descriptionAr: document.getElementById('product-description-ar').value.trim()
	};
}

export function bindModalControls() {
	const closeBtn = document.getElementById('close-modal-btn');
	const cancelBtn = document.getElementById('cancel-btn');
	if (closeBtn) closeBtn.addEventListener('click', () => closeProductModal());
	if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeProductModal(); });
}

function escapeHtml(str = '') {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

