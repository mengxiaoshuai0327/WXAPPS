// pages/ticket-purchase/ticket-purchase.js
const app = getApp();

Page({
  data: {
    quantity: 1, // 购买数量，用户可以输入
    unitPrice: 1500.00,
    unitPriceText: '1500.00',
    selectedCoupons: [], // 改为数组，支持多选优惠券
    availableCoupons: [],
    discountAmount: 0.00,
    discountAmountText: '0.00',
    totalAmount: 1500.00,
    totalAmountText: '1500.00',
    showCouponPicker: false,
    loading: false
  },

  onLoad() {
    console.log('[购买课券] 页面加载');
    try {
      this.loadAvailableCoupons();
      // 初始化格式化后的文本值
      this.calculateTotal();
    } catch (error) {
      console.error('[购买课券] 页面加载错误:', error);
      wx.showToast({
        title: '页面加载失败',
        icon: 'none'
      });
    }
  },

  // 数量输入相关方法
  decreaseQuantity() {
    if (this.data.quantity > 1) {
      const newQuantity = this.data.quantity - 1;
      const { selectedCoupons } = this.data;
      // 如果数量减少，移除多余的优惠券选择
      if (selectedCoupons.length > newQuantity) {
        selectedCoupons.splice(newQuantity);
      }
      this.setData({ 
        quantity: newQuantity,
        selectedCoupons: selectedCoupons
      });
      // 更新可用优惠券的 isSelected 状态
      this.updateCouponSelectedState();
      this.calculateTotal();
    }
  },

  increaseQuantity() {
    if (this.data.quantity < 99) {
      this.setData({ quantity: this.data.quantity + 1 });
      this.calculateTotal();
    } else {
      wx.showToast({
        title: '最多购买99张',
        icon: 'none',
        duration: 1500
      });
    }
  },

  onQuantityInput(e) {
    const value = e.detail.value;
    // 只允许输入数字
    if (!/^\d*$/.test(value)) {
      // 如果不是纯数字，恢复到当前值
      this.setData({ quantity: this.data.quantity });
      return;
    }
    
    let quantity = parseInt(value) || 1;
    if (quantity < 1) {
      quantity = 1;
    } else if (quantity > 99) {
      quantity = 99;
      wx.showToast({
        title: '最多购买99张',
        icon: 'none',
        duration: 1500
      });
    }
    
    // 如果值发生了变化，更新数据
    if (quantity !== this.data.quantity) {
      // 如果数量减少，需要移除多余的优惠券选择
      const { selectedCoupons } = this.data;
      if (selectedCoupons.length > quantity) {
        selectedCoupons.splice(quantity);
      }
      
      this.setData({ 
        quantity,
        selectedCoupons: selectedCoupons
      });
      // 更新可用优惠券的 isSelected 状态
      this.updateCouponSelectedState();
      this.calculateTotal();
    }
  },

  async loadAvailableCoupons() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.error('[购买课券] 用户未登录');
        // 不阻止页面显示，允许用户看到页面结构
        this.setData({ availableCoupons: [] });
        return;
      }

      console.log('开始加载折扣券，用户ID:', userInfo.id);
      const res = await app.request({
        url: '/discounts/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: 'unused'
        }
      });
      
      console.log('API响应:', res);

      if (res.success) {
        console.log('=== 折扣券加载开始 ===');
        console.log('获取到的折扣券原始数据:', JSON.stringify(res.data, null, 2));
        console.log('折扣券数量:', res.data ? res.data.length : 0);
        
        // 获取今天的日期对象（用于比较）
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStr = this.formatDate(todayDate);
        console.log('今天的日期:', todayStr, '时间戳:', todayDate.getTime());

        if (!res.data || res.data.length === 0) {
          console.log('没有折扣券数据');
          this.setData({ availableCoupons: [] });
          return;
        }

        const processedCoupons = res.data.map(coupon => {
          // 格式化日期
          const start_date_formatted = coupon.start_date
            ? this.formatDate(coupon.start_date)
            : null;
          const expiry_date_formatted = coupon.expiry_date
            ? this.formatDate(coupon.expiry_date)
            : null;
          
          // 检查是否可用（状态为unused，且在有效期内）
          let isAvailable = true;
          let reason = '';
          
          // 首先检查状态，必须是 unused
          if (coupon.status !== 'unused') {
            isAvailable = false;
            reason = '已使用或已过期';
            console.log(`折扣券${coupon.id} - 状态不是unused:`, coupon.status);
          }
          
          // 检查开始日期（只有在状态正确的情况下才检查）
          if (coupon.start_date && isAvailable) {
            const startDate = new Date(coupon.start_date);
            startDate.setHours(0, 0, 0, 0);
            console.log(`折扣券${coupon.id} - 开始日期:`, start_date_formatted, '时间戳:', startDate.getTime(), '今天时间戳:', todayDate.getTime());
            // 如果开始日期在未来，还未生效
            if (startDate.getTime() > todayDate.getTime()) {
              isAvailable = false;
              reason = '未生效（开始日期：' + start_date_formatted + '）';
              console.log(`折扣券${coupon.id} - 未生效`);
            }
          }
          
          // 检查结束日期（只有在未失效的情况下才检查）
          // 注意：结束日期当天仍然可用
          if (coupon.expiry_date && isAvailable) {
            const expiryDate = new Date(coupon.expiry_date);
            expiryDate.setHours(23, 59, 59, 999); // 设置为当天的最后一刻
            const now = new Date();
            console.log(`折扣券${coupon.id} - 结束日期:`, expiry_date_formatted, '时间戳:', expiryDate.getTime(), '当前时间戳:', now.getTime());
            // 如果结束日期已过，已过期（注意：结束日期当天仍然可用）
            if (expiryDate.getTime() < now.getTime()) {
              isAvailable = false;
              reason = '已过期（结束日期：' + expiry_date_formatted + '）';
              console.log(`折扣券${coupon.id} - 已过期`);
            } else {
              console.log(`折扣券${coupon.id} - 结束日期有效`);
            }
          }
          
          if (isAvailable) {
            console.log(`折扣券${coupon.id} - 可用，金额:`, coupon.amount);
          } else {
            console.log(`折扣券${coupon.id} - 不可用，原因:`, reason);
          }
          
          // 使用 Object.assign 替代扩展运算符
          const result = Object.assign({}, coupon, {
            start_date_formatted,
            expiry_date_formatted,
            isAvailable,
            reason: reason || '可用'
          });
          
          return result;
        });

        const availableCoupons = processedCoupons.filter(coupon => coupon.isAvailable);
        
        // 为每个可用优惠券添加 isSelected 属性，用于 WXML 中判断是否选中
        const selectedCouponIds = (this.data.selectedCoupons || []).map(c => c.id);
        availableCoupons.forEach(coupon => {
          coupon.isSelected = selectedCouponIds.includes(coupon.id);
        });
        
        console.log('=== 折扣券处理结果 ===');
        console.log('处理后的折扣券总数:', processedCoupons.length);
        console.log('可用折扣券数量:', availableCoupons.length);
        console.log('可用折扣券列表:', JSON.stringify(availableCoupons, null, 2));
        
        // 如果没有任何折扣券，也输出所有折扣券的信息以便调试
        if (availableCoupons.length === 0 && processedCoupons.length > 0) {
          console.warn('⚠️ 所有折扣券都被过滤掉了，详情：');
          processedCoupons.forEach(c => {
            console.warn(`  折扣券${c.id}: ${c.amount}元, ${c.reason}`);
          });
        }
        
        console.log('设置到页面的折扣券数量:', availableCoupons.length);
        console.log('设置到页面的折扣券数据:', JSON.stringify(availableCoupons, null, 2));
        this.setData({ 
          availableCoupons: availableCoupons 
        }, () => {
          console.log('setData回调执行，当前页面数据长度:', this.data.availableCoupons.length);
          console.log('当前页面数据:', this.data.availableCoupons);
        });
        console.log('=== 折扣券加载完成 ===');
      } else {
        console.error('获取折扣券失败:', res);
        this.setData({ availableCoupons: [] });
      }
    } catch (error) {
      console.error('加载折扣券失败', error);
    }
  },


  showCouponPicker() {
    this.setData({ showCouponPicker: true });
  },

  hideCouponPicker() {
    this.setData({ showCouponPicker: false });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  selectNoCoupon() {
    this.setData({
      selectedCoupons: []
    });
    // 更新可用优惠券的 isSelected 状态
    this.updateCouponSelectedState();
    this.calculateTotal();
    this.hideCouponPicker();
  },

  selectCoupon(e) {
    const couponId = e.currentTarget.dataset.id;
    const coupon = this.data.availableCoupons.find(c => c.id === couponId);
    if (!coupon) return;
    
    const { selectedCoupons, quantity } = this.data;
    const maxSelectable = quantity; // 最多可以选择的数量等于购买的课券数量
    
    // 检查是否已经选中
    const index = selectedCoupons.findIndex(c => c.id === couponId);
    
    if (index >= 0) {
      // 如果已选中，取消选中
      selectedCoupons.splice(index, 1);
    } else {
      // 如果未选中，检查是否还可以选择
      if (selectedCoupons.length < maxSelectable) {
        selectedCoupons.push(coupon);
      } else {
        wx.showToast({
          title: `最多只能选择${maxSelectable}张优惠券（与购买数量相同）`,
          icon: 'none',
          duration: 2000
        });
        return;
      }
    }
    
    this.setData({
      selectedCoupons: selectedCoupons
    });
    // 更新可用优惠券的 isSelected 状态
    this.updateCouponSelectedState();
    this.calculateTotal();
  },

  clearCoupon() {
    this.setData({
      selectedCoupons: []
    });
    // 更新可用优惠券的 isSelected 状态
    this.updateCouponSelectedState();
    this.calculateTotal();
  },

  // 更新可用优惠券的选中状态
  updateCouponSelectedState() {
    const selectedCouponIds = (this.data.selectedCoupons || []).map(c => c.id);
    const availableCoupons = (this.data.availableCoupons || []).map(coupon => {
      return {
        ...coupon,
        isSelected: selectedCouponIds.includes(coupon.id)
      };
    });
    this.setData({
      availableCoupons: availableCoupons
    });
  },

  calculateTotal() {
    const { unitPrice, selectedCoupons, quantity } = this.data;
    // 使用实际的数量
    const qty = quantity || 1;
    let totalAmount = unitPrice * qty;
    let discountAmount = 0;

    // 计算总折扣金额：每张课券最多使用一张优惠券
    // 优惠券按顺序应用到对应的课券上
    if (selectedCoupons && selectedCoupons.length > 0) {
      const maxCouponsToUse = Math.min(selectedCoupons.length, qty); // 最多使用的优惠券数量不超过购买数量
      for (let i = 0; i < maxCouponsToUse; i++) {
        // 每张优惠券最多只能抵扣一张课券的价格
        const couponDiscount = Math.min(selectedCoupons[i].amount, unitPrice);
        discountAmount += couponDiscount;
      }
      totalAmount -= discountAmount;
    }

    this.setData({
      discountAmount,
      discountAmountText: discountAmount.toFixed(2),
      totalAmount,
      totalAmountText: totalAmount.toFixed(2),
      unitPriceText: unitPrice.toFixed(2)
    });
  },

  async handlePay() {
    const userInfo = app.globalData.userInfo;
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }

    wx.showModal({
      title: '确认支付',
      content: `确定要支付 ¥${this.data.totalAmount.toFixed(2)} 购买课券吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.processPurchase();
        }
      }
    });
  },

  async processPurchase() {
    this.setData({ loading: true });

    try {
      const userInfo = app.globalData.userInfo;
      const quantity = this.data.quantity || 1; // 用户输入的数量
      // 将选中的优惠券ID数组发送给后端
      const discountCouponIds = this.data.selectedCoupons.map(c => c.id);
      
      const result = await app.request({
        url: '/tickets/purchase',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          quantity: quantity,
          discount_coupon_ids: discountCouponIds.length > 0 ? discountCouponIds : null
        }
      });

      if (result.success) {
        wx.showToast({
          title: '购买成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/ticket-list/ticket-list'
          });
        }, 2000);
      }
    } catch (error) {
      console.error('购买课券失败', error);
      wx.showToast({
        title: error.error || error.message || '购买失败',
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});

