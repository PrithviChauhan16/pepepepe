import { supabase } from './supabaseClient.js';

/* PEPE KUN - Dynamic Storefront, Multi-Category Collections & Auth Script */

(function () {
  'use strict';

  // State Management
  let cart = JSON.parse(localStorage.getItem('pepe_cart') || '[]');
  let products = [];
  let primaryCategories = [];
  let collectionCategories = [];
  let currentUser = null;
  let selectedColor = null;
  let selectedSize = null;
  let selectedSizePrice = null;

  // Helper Function for Generating Dynamic Price HTML with Discount Badges
  function getPriceDisplayHTML(prod) {
    let sellingPrice = parseFloat(prod.price || 0);
    let originalPrice = parseFloat(prod.original_price || 0);
    let discountPercent = parseFloat(prod.discount || prod.discount_percentage || 0);

    if (discountPercent > 0) {
      if (originalPrice <= sellingPrice) {
        originalPrice = sellingPrice / (1 - (discountPercent / 100));
      }
      return `
        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
            <p class="text-pink-500 font-bold text-base md:text-lg">₹${sellingPrice.toFixed(2)}</p>
            <p class="text-gray-400 text-xs line-through">₹${originalPrice.toFixed(2)}</p>
            <span class="bg-green-100 text-green-700 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">${discountPercent}% OFF</span>
        </div>
      `;
    } else if (originalPrice > sellingPrice && originalPrice > 0) {
      let calculatedDiscount = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
      
      if (calculatedDiscount > 0) {
          return `
            <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                <p class="text-pink-500 font-bold text-base md:text-lg">₹${sellingPrice.toFixed(2)}</p>
                <p class="text-gray-400 text-xs line-through">₹${originalPrice.toFixed(2)}</p>
                <span class="bg-green-100 text-green-700 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">${calculatedDiscount}% OFF</span>
            </div>
          `;
      }
    }

    return `<p class="text-pink-500 font-bold text-base md:text-lg">₹${sellingPrice.toFixed(2)}</p>`;
  }

  // 1. Auth Session Check & Sync Cart
  async function checkUserSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const displayName = profile?.full_name || user.email?.split('@')[0] || 'Account';

        const loginBtn = document.getElementById('auth-login-btn');
        if (loginBtn) {
          loginBtn.textContent = displayName;
          loginBtn.href = 'account.html';
        }

        const mobileLoginBtn = document.getElementById('mobile-auth-btn');
        if (mobileLoginBtn) {
          mobileLoginBtn.textContent = displayName;
          mobileLoginBtn.href = 'account.html';
        }

        await fetchUserCartFromSupabase();
      } else {
        updateCartUI();
      }
    } catch (err) {
      console.error('Error checking user session:', err);
      updateCartUI();
    }
  }

  async function fetchUserCartFromSupabase() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('cart')
        .select('*, products(*)')
        .eq('user_id', currentUser.id);

      if (error) throw error;

      if (data) {
        cart = data.map(item => {
          let finalPrice = item.products.price;
          
          let sizes = [];
          try {
            sizes = Array.isArray(item.products.sizes) ? item.products.sizes : JSON.parse(item.products.sizes || '[]');
          } catch (e) {
            if (typeof item.products.sizes === 'string') {
              sizes = item.products.sizes.split(',').map(s => s.trim()).filter(Boolean);
            }
          }

          if (item.selected_size) {
            const matchedSize = sizes.find(s => s.includes(':') && s.split(':')[0].trim() === item.selected_size);
            if (matchedSize) {
              finalPrice = parseFloat(matchedSize.split(':')[1].trim());
            }
          }

          return {
            ...item.products,
            price: finalPrice,
            quantity: item.quantity,
            cart_id: item.id,
            selected_color: item.selected_color || null,
            selected_size: item.selected_size || null
          };
        });
        updateCartUI();
      }
    } catch (err) {
      console.error('Error fetching Supabase cart:', err);
    }
  }

  // 2. Cart Functions
  function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    ['cart-count', 'cart-count-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });
    localStorage.setItem('pepe_cart', JSON.stringify(cart));
  }

  function selectColor(color, btnElement) {
    selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.remove('border-pink-500', 'bg-pink-50', 'text-pink-600', 'ring-2', 'ring-pink-400');
      btn.classList.add('border-gray-300', 'text-gray-700');
    });
    if (btnElement) {
      btnElement.classList.remove('border-gray-300', 'text-gray-700');
      btnElement.classList.add('border-pink-500', 'bg-pink-50', 'text-pink-600', 'ring-2', 'ring-pink-400');
    }
  }

  function selectSize(sizeName, sizePrice, btnElement) {
    selectedSize = sizeName;
    selectedSizePrice = sizePrice;
    
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.remove('border-pink-500', 'bg-pink-50', 'text-pink-600', 'ring-2', 'ring-pink-400');
      btn.classList.add('border-gray-300', 'text-gray-700');
    });
    
    if (btnElement) {
      btnElement.classList.remove('border-gray-300', 'text-gray-700');
      btnElement.classList.add('border-pink-500', 'bg-pink-50', 'text-pink-600', 'ring-2', 'ring-pink-400');
    }

    const priceContainer = document.getElementById('modal-price');
    if (priceContainer && sizePrice > 0) {
        priceContainer.innerHTML = `<span class="text-pink-500 font-bold text-2xl">₹${sizePrice.toFixed(2)}</span>`;
    }
  }

  async function addToCart(productId, sourceBtnId = null, chosenColor = null, chosenSize = null) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product && !currentUser) return false;

    if (product && product.sold_out) {
      alert('Sorry, this item is sold out.');
      return false;
    }

    let availableColors = [];
    try {
      availableColors = Array.isArray(product?.colors) ? product.colors : JSON.parse(product?.colors || '[]');
    } catch (e) {
      if (typeof product?.colors === 'string') {
        availableColors = product.colors.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    let availableSizes = [];
    try {
      availableSizes = Array.isArray(product?.sizes) ? product.sizes : JSON.parse(product?.sizes || '[]');
    } catch (e) {
      if (typeof product?.sizes === 'string') {
        availableSizes = product.sizes.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (availableColors.length > 1 && !chosenColor) {
      openProductModal(productId);
      alert('Please select a color option before adding to cart.');
      return false;
    }

    if (availableSizes.length > 1 && !chosenSize) {
      openProductModal(productId);
      alert('Please select a size option before adding to cart.');
      return false;
    }

    const targetBtnId = sourceBtnId || `btn-${productId}`;
    const btn = document.getElementById(targetBtnId);
    let originalText = '';
    if (btn) {
      originalText = btn.textContent;
      btn.textContent = 'Adding...';
      btn.disabled = true;
    }

    try {
      let finalPrice = product.price;
      if (selectedSizePrice !== null && chosenSize === selectedSize) {
        finalPrice = selectedSizePrice;
      } else if (chosenSize) {
        const matchedSize = availableSizes.find(s => s.includes(':') && s.split(':')[0].trim() === chosenSize);
        if (matchedSize) {
          finalPrice = parseFloat(matchedSize.split(':')[1].trim());
        }
      }

      const existingIndex = cart.findIndex(p =>
        String(p.id) === String(productId) && 
        p.selected_color === (chosenColor || null) &&
        p.selected_size === (chosenSize || null)
      );
      
      if (existingIndex > -1) {
        cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 1) + 1;
        cart[existingIndex].price = finalPrice;
      } else if (product) {
        cart.push({ 
          ...product, 
          price: finalPrice,
          quantity: 1, 
          selected_color: chosenColor || null, 
          selected_size: chosenSize || null 
        });
      }
      updateCartUI();

      if (currentUser) {
        let query = supabase
          .from('cart')
          .select('id, quantity')
          .eq('user_id', currentUser.id)
          .eq('product_id', productId);

        if (chosenColor) {
          query = query.eq('selected_color', chosenColor);
        } else {
          query = query.is('selected_color', null);
        }

        if (chosenSize) {
          query = query.eq('selected_size', chosenSize);
        } else {
          query = query.is('selected_size', null);
        }

        const { data: existingItem, error: fetchErr } = await query.maybeSingle();
        if (fetchErr) throw fetchErr;

        if (existingItem) {
          const newQty = (Number(existingItem.quantity) || 1) + 1;
          await supabase
            .from('cart')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', existingItem.id);
        } else {
          await supabase
            .from('cart')
            .insert([{
              user_id: currentUser.id,
              product_id: productId,
              quantity: 1,
              selected_color: chosenColor || null,
              selected_size: chosenSize || null
            }]);
        }
      }

      if (btn) {
        btn.textContent = 'Added ✓';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1200);
      }
      return true;
    } catch (err) {
      console.error('Error adding item to cart:', err);
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
      return false;
    }
  }

  async function buyNow(productId, sourceBtnId = null, chosenColor = null, chosenSize = null) {
    const success = await addToCart(productId, sourceBtnId, chosenColor, chosenSize);
    if (success !== false) {
      window.location.href = 'checkout.html';
    }
  }

  // 3. Category Fetching with Skeletons
  async function loadCategoriesAndCollections() {
    const catGrid = document.getElementById('category-grid');
    const colGrid = document.getElementById('collection-grid');

    const skeletonHTML = Array(5).fill(`
      <div class="flex-none w-40 md:w-52 snap-start bg-white rounded-3xl p-4 shadow-sm border border-gray-100 animate-pulse text-center">
        <div class="w-full aspect-square rounded-2xl bg-gray-200 mb-3 border border-gray-100"></div>
        <div class="h-4 bg-gray-200 rounded w-3/4 mx-auto mt-2"></div>
      </div>
    `).join('');

    if (catGrid) catGrid.innerHTML = skeletonHTML;
    if (colGrid) colGrid.innerHTML = skeletonHTML;

    try {
      const { data: categoriesData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (catError) throw catError;

      const allCats = categoriesData || [];
      collectionCategories = allCats.filter(c => c.section === 'sub' || c.type === 'collection');
      primaryCategories = allCats.filter(c => !collectionCategories.includes(c));

      renderCategoryRow('category-grid', primaryCategories, 'No categories found.');
      renderCategoryRow('collection-grid', collectionCategories, 'New collections coming soon.');
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  function renderCategoryRow(containerId, list, emptyMessage) {
    const row = document.getElementById(containerId);
    if (!row) return;

    if (list.length === 0) {
      row.innerHTML = `<p class="text-gray-500 w-full text-center py-6">${emptyMessage}</p>`;
      updateRowArrows(row);
      return;
    }

    row.innerHTML = list.map(cat => {
      const safeName = String(cat.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const img = cat.image_url
        ? `<img src="${cat.image_url}" alt="${cat.name}" draggable="false" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
        : `<div class="w-full h-full flex items-center justify-center text-5xl">🧸</div>`;

      return `
        <div onclick="showCategoryProducts('${cat.id}', '${safeName}')"
             class="flex-none w-40 md:w-52 snap-start group cursor-pointer bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center select-none overflow-hidden flex flex-col">
            
            <div class="w-full aspect-square bg-gray-50 overflow-hidden relative border-b border-gray-100">
                ${img}
            </div>
            
            <div class="p-4 pt-3 mt-auto">
                <h3 class="text-base md:text-lg font-semibold text-gray-900 group-hover:text-pink-500 transition-colors truncate">${cat.name}</h3>
            </div>
        </div>`;
    }).join('');

    row.scrollLeft = 0;
    if (!row.dataset.bound) {
      row.dataset.bound = '1';
      row.addEventListener('scroll', () => updateRowArrows(row), { passive: true });
      window.addEventListener('resize', () => updateRowArrows(row));
    }
    updateRowArrows(row);
  }

  function updateRowArrows(row) {
    const wrap = row.parentElement;
    if (!wrap) return;
    const left = wrap.querySelector('[data-arrow="left"]');
    const right = wrap.querySelector('[data-arrow="right"]');
    const max = row.scrollWidth - row.clientWidth - 2;

    if (left) {
      left.classList.toggle('hidden', row.scrollLeft <= 2);
      left.classList.toggle('flex', row.scrollLeft > 2);
    }

    if (right) {
      right.classList.toggle('hidden', row.scrollLeft >= max);
      right.classList.toggle('flex', row.scrollLeft < max);
    }
  }

  function scrollCategoryRow(containerId, direction) {
    const row = document.getElementById(containerId);
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(row.clientWidth * 0.8, 220), behavior: 'smooth' });
  }

  // 4. Primary & Collection Category Drilldown View
  async function showCategoryProducts(categoryId, categoryName) {
    const categoriesSection = document.getElementById('categories');
    const collectionsSection = document.getElementById('collections-section');
    const productSection = document.getElementById('product-display');
    const productGrid = document.getElementById('product-grid');
    const categoryTitle = document.getElementById('current-category-title');

    if (categoryTitle) categoryTitle.textContent = categoryName;

    if (productGrid) {
      productGrid.innerHTML = Array(6).fill(`
        <div class="w-64 md:w-72 flex-shrink-0 snap-center bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 flex flex-col relative overflow-hidden animate-pulse">
            <div class="w-full aspect-square bg-gray-100 rounded-t-[1.5rem] md:rounded-t-[2rem]"></div>
            <div class="p-4 md:p-5 flex flex-col flex-grow border-t border-gray-50 bg-white">
                <div class="flex justify-between items-start mb-1 gap-2">
                    <div class="h-5 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div class="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div class="h-3 bg-gray-200 rounded w-1/4 mb-5 mt-2"></div>
                <div class="mt-auto w-full h-10 md:h-12 bg-gray-200 rounded-xl"></div>
            </div>
        </div>
      `).join('');
    }

    if (categoriesSection && productSection) {
      categoriesSection.classList.add('hidden');
      if (collectionsSection) collectionsSection.classList.add('hidden');
      productSection.classList.remove('hidden');
      setTimeout(() => {
        productSection.classList.remove('opacity-0');
        productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 10);
    }

    let categoryProds = [];
    try {
      const { data: junctionData } = await supabase
        .from('product_categories')
        .select('products(*)')
        .eq('category_id', categoryId);

      if (junctionData && junctionData.length > 0) {
        categoryProds = junctionData.map(j => j.products).filter(Boolean);
      } else {
        const { data } = await supabase
          .from('products')
          .select('*')
          .or(`category_id.eq.${categoryId},category_ids.cs.{"${categoryId}"}`);
        categoryProds = data || [];
      }
    } catch (e) {
      console.error('Error fetching category products:', e);
    }

    categoryProds.forEach(p => {
      if (!products.some(existing => existing.id === p.id)) {
        products.push(p);
      }
    });

    if (productGrid) {
      if (categoryProds.length === 0) {
        productGrid.innerHTML = `<p class="col-span-full w-full text-center text-gray-500 py-8">No products found in this category.</p>`;
      } else {
        productGrid.innerHTML = categoryProds.map(prod => {
          let imagesArr = [];
          try {
            imagesArr = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]');
          } catch (e) {
            imagesArr = [prod.images || 'https://via.placeholder.com/300'];
          }

          let priceDisplayHTML = getPriceDisplayHTML(prod);

          return `
            <div onclick="openProductModal('${prod.id}')" class="product-card min-w-0 w-64 md:w-72 flex-shrink-0 snap-center bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col relative group overflow-hidden cursor-pointer">
                
                <div class="relative w-full aspect-square bg-[#FDFBF7] overflow-hidden group/slider rounded-t-[1.5rem] md:rounded-t-[2rem]">
                ${prod.sold_out ? `<div class="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"><span class="bg-white/95 text-gray-900 text-xs md:text-sm font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">Sold Out</span></div>` : ''}
                    <div id="slider-${prod.id}" class="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full w-full no-scrollbar relative z-10 touch-pan-x" onscroll="updateSliderDots(event, '${prod.id}')">
                        ${imagesArr.map((img) => `
                            <div class="min-w-full h-full flex-none snap-center flex items-center justify-center p-3 md:p-6">
                                <img src="${img}" alt="${prod.title}" class="max-w-full max-h-full object-contain transition-transform duration-500 group-hover/slider:scale-105">
                            </div>
                        `).join('')}
                    </div>
                    
                    ${imagesArr.length > 1 ? `
                        <button onclick="event.stopPropagation(); scrollProductSlider(event, '${prod.id}', -1)" class="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 backdrop-blur hover:bg-gray-50 text-gray-900 w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-all shadow-md z-30 pb-1 text-xl leading-none">‹</button>
                        <button onclick="event.stopPropagation(); scrollProductSlider(event, '${prod.id}', 1)" class="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 backdrop-blur hover:bg-gray-50 text-gray-900 w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-all shadow-md z-30 pb-1 text-xl leading-none">›</button>
                        
                        <div class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/10 to-transparent pointer-events-none rounded-b-[1.5rem] md:rounded-b-[2rem] z-20"></div>
                        <div class="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-30" id="dots-${prod.id}">
                            ${imagesArr.map((_, i) => `<span class="w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-white scale-125' : 'bg-white/60'} shadow-sm border border-gray-300/30"></span>`).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="p-4 md:p-5 flex flex-col flex-grow border-t border-gray-50 relative z-20 bg-white">
                    <h3 class="font-semibold text-gray-900 group-hover:text-pink-500 transition-colors text-sm md:text-lg line-clamp-2 leading-tight z-10 mb-1 break-words">
                        ${prod.title}
                    </h3>
                    
                    <div class="mb-2">
                        ${priceDisplayHTML}
                    </div>
                    
                    <p class="text-gray-400 text-[10px] md:text-sm mb-4 mt-auto line-clamp-1">${prod.category || 'Premium Plushie'}</p>
                    
                    <div class="grid grid-cols-2 gap-2 mt-auto z-10">
                        <button id="btn-cart-${prod.id}" ${prod.sold_out ? 'disabled style="opacity:.45;cursor:not-allowed;pointer-events:none"' : ''} onclick="event.stopPropagation(); addToCart('${prod.id}', 'btn-cart-${prod.id}')" class="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 active:scale-95 transition-all flex justify-center items-center gap-1">
                            ${prod.sold_out ? 'Sold Out' : 'Add to Cart'}
                        </button>
                        <button id="btn-buy-${prod.id}" ${prod.sold_out ? 'disabled style="opacity:.45;cursor:not-allowed;pointer-events:none"' : ''} onclick="event.stopPropagation(); buyNow('${prod.id}', 'btn-buy-${prod.id}')" class="w-full bg-brand-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-pink-500 active:scale-95 transition-all shadow-md flex justify-center items-center gap-1">
                            ${prod.sold_out ? 'Sold Out' : 'Buy Now'}
                        </button>
                    </div>
                </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function hideProducts() {
    const section = document.getElementById('product-display');
    const collectionsSection = document.getElementById('collections-section');
    if (!section) return;

    section.classList.add('opacity-0');

    setTimeout(() => {
      section.classList.add('hidden');
      document.getElementById('categories')?.classList.remove('hidden');
      if (collectionsSection) collectionsSection.classList.remove('hidden');
      document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }

  // 5. Quick-View Modal Functions
  function openProductModal(productId) {
    const prod = products.find(p => String(p.id) === String(productId));
    if (!prod) return;

    selectedColor = null;
    selectedSize = null; 
    selectedSizePrice = null;

    const modal = document.getElementById('product-modal');
    const title = document.getElementById('modal-title');
    const price = document.getElementById('modal-price');
    const desc = document.getElementById('tab-desc');
    const specsList = document.getElementById('modal-specs-list');
    const thumbsContainer = document.getElementById('modal-thumbnails');
    const addCartBtn = document.getElementById('modal-add-cart-btn');
    const buyNowModalBtn = document.getElementById('modal-buy-now-btn');
    const colorsContainer = document.getElementById('modal-colors-container');
    const colorsOptions = document.getElementById('modal-color-options');
    const sizesContainer = document.getElementById('modal-sizes-container');
    const sizesOptions = document.getElementById('modal-size-options');

    let images = [];
    try {
      images = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]');
    } catch (e) {
      images = [prod.images || 'https://via.placeholder.com/300'];
    }

    const specs = Array.isArray(prod.specifications) ? prod.specifications : JSON.parse(prod.specifications || '[]');

    let colors = [];
    try {
      colors = Array.isArray(prod.colors) ? prod.colors : JSON.parse(prod.colors || '[]');
    } catch (e) {
      if (typeof prod.colors === 'string') {
        colors = prod.colors.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    if (colors.length === 1) {
      selectedColor = colors[0];
    }

    if (colorsContainer && colorsOptions) {
      if (colors.length > 0) {
        colorsContainer.classList.remove('hidden');
        colorsOptions.innerHTML = colors.map(color => `
          <button type="button" 
              onclick="selectColor('${color}', this)"
              class="color-btn border ${colors.length === 1 ? 'border-pink-500 bg-pink-50 text-pink-600 ring-2 ring-pink-400' : 'border-gray-300 text-gray-700'} rounded-full px-4 py-1.5 text-xs font-medium hover:border-pink-500 transition-all">
            ${color}
          </button>
        `).join('');
      } else {
        colorsContainer.classList.add('hidden');
        colorsOptions.innerHTML = '';
      }
    }

    let sizes = [];
    try {
      sizes = Array.isArray(prod.sizes) ? prod.sizes : JSON.parse(prod.sizes || '[]');
    } catch (e) {
      if (typeof prod.sizes === 'string') {
        sizes = prod.sizes.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (sizes.length === 1) {
      let singleSizeStr = sizes[0];
      if (singleSizeStr.includes(':')) {
        const parts = singleSizeStr.split(':');
        selectedSize = parts[0].trim();
        selectedSizePrice = Math.max(0, parseFloat(parts[1].trim() || prod.price || 0));
      } else {
        selectedSize = singleSizeStr.trim();
        selectedSizePrice = Math.max(0, parseFloat(prod.price || 0));
      }
    }

    if (sizesContainer && sizesOptions) {
      if (sizes.length > 0) {
        sizesContainer.classList.remove('hidden');
        sizesOptions.innerHTML = sizes.map(sizeString => {
            let sizeName = sizeString;
            let sizePrice = Math.max(0, parseFloat(prod.price || 0));

            if (sizeString.includes(':')) {
                const parts = sizeString.split(':');
                sizeName = parts[0].trim();
                sizePrice = Math.max(0, parseFloat(parts[1].trim() || 0));
            }

            return `
              <button type="button" 
                      onclick="selectSize('${sizeName}', ${sizePrice}, this)"
                      class="size-btn border ${sizes.length === 1 ? 'border-pink-500 bg-pink-50 text-pink-600 ring-2 ring-pink-400' : 'border-gray-300 text-gray-700'} rounded-full px-4 py-1.5 text-xs font-medium hover:border-pink-500 transition-all">
                ${sizeName}
              </button>
            `;
        }).join('');
      } else {
        sizesContainer.classList.add('hidden');
        sizesOptions.innerHTML = '';
      }
    }

    const modalSwipeTrack = document.getElementById('modal-swipe-track');
    if (modalSwipeTrack) {
      const escapedImages = JSON.stringify(images).replace(/"/g, '&quot;');
      modalSwipeTrack.innerHTML = images.map((img, index) => `
          <div class="w-full h-full flex-none snap-center flex items-center justify-center p-4">
              <img src="${img}" onclick="openFullscreenGallery(${escapedImages}, ${index})" class="w-full h-full object-contain cursor-zoom-in" title="Tap to expand fullscreen">
          </div>
      `).join('');
      modalSwipeTrack.scrollLeft = 0;
    }

    if (title) title.textContent = prod.title;
    if (desc) desc.textContent = prod.description || 'No description available.';

    if (price) {
      let initialDisplayPrice = selectedSizePrice !== null ? selectedSizePrice : parseFloat(prod.price || 0);
      let originalPrice = parseFloat(prod.original_price || 0);
      let discountPercent = parseFloat(prod.discount || prod.discount_percentage || 0);

      if (discountPercent > 0) {
        if (originalPrice <= initialDisplayPrice) {
          originalPrice = initialDisplayPrice / (1 - (discountPercent / 100));
        }
        price.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-pink-500 font-bold text-2xl">₹${initialDisplayPrice.toFixed(2)}</span>
                <span class="text-gray-400 text-lg line-through">₹${originalPrice.toFixed(2)}</span>
                <span class="text-sm font-bold text-green-600 bg-green-100 px-2.5 py-0.5 rounded-full">${discountPercent}% OFF</span>
            </div>
        `;
      } else {
        price.innerHTML = `<span class="text-pink-500 font-bold text-2xl">₹${initialDisplayPrice.toFixed(2)}</span>`;
      }
    }

    if (specsList) {
      specsList.innerHTML = specs.length > 0
        ? specs.map(s => `<li>${s}</li>`).join('')
        : '<li>No specifications listed.</li>';
    }

    if (thumbsContainer) {
      thumbsContainer.innerHTML = images.map((img, index) => `
        <div onclick="changeModalImage(${index})" class="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-pink-500 cursor-pointer bg-white transition-all p-1">
            <img src="${img}" class="w-full h-full object-contain">
        </div>
      `).join('');
    }

    if (addCartBtn) {
      addCartBtn.onclick = () => addToCart(prod.id, 'modal-add-cart-btn', selectedColor, selectedSize);
    }

    if (buyNowModalBtn) {
      buyNowModalBtn.onclick = () => buyNow(prod.id, 'modal-buy-now-btn', selectedColor, selectedSize);
    }

    [addCartBtn, buyNowModalBtn].forEach(btn => {
      if (!btn) return;
      if (btn.dataset.origHtml === undefined) btn.dataset.origHtml = btn.innerHTML;
      const soldOut = Boolean(prod.sold_out);
      btn.disabled = soldOut;
      btn.style.opacity = soldOut ? '0.45' : '';
      btn.style.cursor = soldOut ? 'not-allowed' : '';
      btn.innerHTML = soldOut ? 'Sold Out' : btn.dataset.origHtml;
    });

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => modal.classList.remove('opacity-0'), 10);
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    const modal = document.getElementById('product-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = 'auto';
    }, 300);
  }

  // 6. Contact Form Inquiry Submission
  async function handleContactSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
      alert('You must be logged in to send an inquiry. Please log in first.');
      window.location.href = 'login.html';
      return;
    }

    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const messageInput = document.getElementById('contact-message');
    const submitBtn = document.getElementById('contact-submit-btn');

    if (!nameInput || !emailInput || !messageInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message) {
      alert('Please fill in all fields.');
      return;
    }

    const originalBtnText = submitBtn ? submitBtn.textContent : 'Send Message';
    if (submitBtn) {
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
    }

    try {
      const { error } = await supabase
        .from('inquiries')
        .insert([{
          name,
          email,
          message,
          user_id: currentUser.id
        }]);

      if (error) throw error;

      alert('Thank you! Your message has been sent successfully.');
      document.getElementById('contact-form')?.reset();
    } catch (err) {
      console.error('Error submitting inquiry:', err);
      alert('Failed to send message. Please try again later.');
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    }
  }

  // 7. Fullscreen Gallery Zoom Logic
  function openFullscreenGallery(images, startIndex) {
    const gallery = document.getElementById('fullscreen-gallery');
    const track = document.getElementById('gallery-swipe-track');
    if (!gallery || !track) return;

    track.innerHTML = images.map((img) => `
        <div class="w-full h-full flex-none snap-center flex items-center justify-center p-4 md:p-12">
            <img src="${img}" class="max-w-full max-h-full object-contain select-none">
        </div>
    `).join('');

    gallery.classList.remove('hidden');
    gallery.classList.add('flex');

    setTimeout(() => {
      gallery.classList.remove('opacity-0');
      const width = track.clientWidth;
      track.scrollTo({ left: startIndex * width, behavior: 'instant' });
      updateGalleryCounter(startIndex, images.length);
    }, 10);

    track.onscroll = () => {
      const activeIndex = Math.round(track.scrollLeft / track.clientWidth);
      updateGalleryCounter(activeIndex, images.length);
    };
  }

  function updateGalleryCounter(index, total) {
    const counter = document.getElementById('gallery-counter');
    if (counter) counter.innerText = `${index + 1} / ${total}`;
  }

  function closeFullscreenGallery() {
    const gallery = document.getElementById('fullscreen-gallery');
    if (!gallery) return;
    gallery.classList.add('opacity-0');
    setTimeout(() => {
      gallery.classList.add('hidden');
      gallery.classList.remove('flex');
    }, 300);
  }

  function scrollGallerySlider(direction) {
    const track = document.getElementById('gallery-swipe-track');
    if (track) {
      const width = track.clientWidth;
      track.scrollBy({ left: direction * width, behavior: 'smooth' });
    }
  }

  // 8. Swiping UI Helpers
  function updateSliderDots(event, productId) {
    const container = event.target;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    const activeIndex = Math.round(scrollLeft / width);

    const dotsContainer = document.getElementById(`dots-${productId}`);
    if (!dotsContainer) return;

    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      if (i === activeIndex) {
        dots[i].className = "w-1.5 h-1.5 rounded-full transition-all duration-300 bg-white scale-125 shadow-sm border border-gray-300/30";
      } else {
        dots[i].className = "w-1.5 h-1.5 rounded-full transition-all duration-300 bg-white/60 shadow-sm border border-gray-300/30";
      }
    }
  }

  function scrollProductSlider(event, productId, direction) {
    event.stopPropagation();
    const slider = document.getElementById(`slider-${productId}`);
    if (slider) {
      const scrollAmount = slider.clientWidth;
      slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  }

  function scrollModalSlider(direction) {
    const track = document.getElementById('modal-swipe-track');
    if (track) {
      const width = track.clientWidth;
      track.scrollBy({ left: direction * width, behavior: 'smooth' });
    }
  }

  function changeModalImage(index) {
    const track = document.getElementById('modal-swipe-track');
    if (track) {
      const width = track.clientWidth;
      track.scrollTo({ left: index * width, behavior: 'smooth' });
    }
  }

  // 9. Best Sellers Marquee Showcase (Auto-Slide + Manual Swipe)
  async function loadCutestPepesShowcase() {
    const track = document.getElementById('cutest-pepes-track');
    if (!track) return;

    try {
      let { data: promoProducts, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('is_bestseller', true);

      if (prodErr || !promoProducts || promoProducts.length === 0) {
        const { data: fallbackProds } = await supabase
          .from('products')
          .select('*')
          .limit(6);
        promoProducts = fallbackProds || [];
      }

      if (promoProducts.length === 0) return;

      promoProducts.forEach(p => {
        if (!products.some(existing => existing.id === p.id)) {
          products.push(p);
        }
      });

      const cardsHTML = promoProducts.map(prod => {
        let imagesArr = [];
        try {
          imagesArr = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]');
        } catch (e) {
          imagesArr = [prod.images || '1.png'];
        }

        let priceDisplayHTML = getPriceDisplayHTML(prod);

        return `
          <div onclick="openProductModal('${prod.id}')" class="product-card min-w-0 w-64 md:w-72 flex-shrink-0 bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col relative group overflow-hidden cursor-pointer">
              
              <div class="relative w-full aspect-square bg-[#FDFBF7] overflow-hidden group/slider rounded-t-[1.5rem] md:rounded-t-[2rem]">
                ${prod.sold_out ? `<div class="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"><span class="bg-white/95 text-gray-900 text-xs md:text-sm font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">Sold Out</span></div>` : ''}
                  <div id="slider-promo-${prod.id}" class="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full w-full no-scrollbar relative z-10 touch-pan-x" onscroll="updateSliderDots(event, 'promo-${prod.id}')">
                      ${imagesArr.map((img) => `
                          <div class="min-w-full h-full flex-none snap-center flex items-center justify-center p-3 md:p-6">
                              <img src="${img}" alt="${prod.title}" class="max-w-full max-h-full object-contain transition-transform duration-500 group-hover/slider:scale-105">
                          </div>
                      `).join('')}
                  </div>
                  
                  ${imagesArr.length > 1 ? `
                      <button onclick="event.stopPropagation(); scrollProductSlider(event, 'promo-${prod.id}', -1)" class="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 backdrop-blur hover:bg-gray-50 text-gray-900 w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-all shadow-md z-30 pb-1 text-xl leading-none">‹</button>
                      <button onclick="event.stopPropagation(); scrollProductSlider(event, 'promo-${prod.id}', 1)" class="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 backdrop-blur hover:bg-gray-50 text-gray-900 w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-all shadow-md z-30 pb-1 text-xl leading-none">›</button>
                      
                      <div class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/10 to-transparent pointer-events-none rounded-b-[1.5rem] md:rounded-b-[2rem] z-20"></div>
                      <div class="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-30" id="dots-promo-${prod.id}">
                          ${imagesArr.map((_, i) => `<span class="w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-white scale-125' : 'bg-white/60'} shadow-sm border border-gray-300/30"></span>`).join('')}
                      </div>
                  ` : ''}
              </div>

              <div class="p-4 md:p-5 flex flex-col flex-grow border-t border-gray-50 relative z-20 bg-white">
                  <h3 class="font-semibold text-gray-900 group-hover:text-pink-500 transition-colors text-sm md:text-lg line-clamp-2 leading-tight z-10 mb-1 break-words">${prod.title}</h3>
                  <div class="mb-2">${priceDisplayHTML}</div>
                  <p class="text-gray-400 text-[10px] md:text-sm mb-4 mt-auto line-clamp-1">${prod.category || 'Best Seller'}</p>
                  
                  <div class="grid grid-cols-2 gap-2 mt-auto z-10">
                      <button id="btn-promo-cart-${prod.id}" ${prod.sold_out ? 'disabled style="opacity:.45;cursor:not-allowed;pointer-events:none"' : ''} onclick="event.stopPropagation(); addToCart('${prod.id}', 'btn-promo-cart-${prod.id}')" class="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 active:scale-95 transition-all flex justify-center items-center gap-1">
                          ${prod.sold_out ? 'Sold Out' : 'Add to Cart'}
                      </button>
                      <button id="btn-promo-buy-${prod.id}" ${prod.sold_out ? 'disabled style="opacity:.45;cursor:not-allowed;pointer-events:none"' : ''} onclick="event.stopPropagation(); buyNow('${prod.id}', 'btn-promo-buy-${prod.id}')" class="w-full bg-brand-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-pink-500 active:scale-95 transition-all shadow-md flex justify-center items-center gap-1">
                          ${prod.sold_out ? 'Sold Out' : 'Buy Now'}
                      </button>
                  </div>
              </div>
          </div>
        `;
      }).join('');

      track.innerHTML = cardsHTML + cardsHTML + cardsHTML;

      let isInteracting = false;
      let scrollSpeed = 1; 
      
      const pauseScroll = () => isInteracting = true;
      const resumeScroll = () => isInteracting = false;

      track.addEventListener('mouseenter', pauseScroll);
      track.addEventListener('mouseleave', resumeScroll);
      track.addEventListener('touchstart', pauseScroll, { passive: true });
      track.addEventListener('touchend', resumeScroll);

      setInterval(() => {
        if (!isInteracting) {
          track.scrollLeft += scrollSpeed;
          if (track.scrollLeft >= track.scrollWidth / 3) {
            track.scrollLeft = 0;
          }
        }
      }, 20);

    } catch (err) {
      console.error('Error loading Best Sellers showcase:', err);
    }
  }

  // 10. Expose global handlers needed for inline onclick attributes in HTML
  window.showCategoryProducts = showCategoryProducts;
  window.hideProducts = hideProducts;
  window.scrollCategoryRow = scrollCategoryRow;
  window.openProductModal = openProductModal;
  window.closeModal = closeModal;
  window.addToCart = addToCart;
  window.buyNow = buyNow;
  window.selectColor = selectColor;
  window.selectSize = selectSize;
  window.updateSliderDots = updateSliderDots;
  window.scrollProductSlider = scrollProductSlider;
  window.scrollModalSlider = scrollModalSlider;
  window.changeModalImage = changeModalImage;
  window.openFullscreenGallery = openFullscreenGallery;
  window.closeFullscreenGallery = closeFullscreenGallery;
  window.scrollGallerySlider = scrollGallerySlider;
  window.loadCutestPepesShowcase = loadCutestPepesShowcase;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    loadCategoriesAndCollections();
    loadCutestPepesShowcase();

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', handleContactSubmit);
    }
  });
})();
