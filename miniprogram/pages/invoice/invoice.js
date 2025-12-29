// pages/invoice/invoice.js
const app = getApp();

Page({
  data: {
    tickets: [],
    currentTab: 'unissued',
    selectedTickets: [],
    showForm: false,
    invoiceForm: {
      header: '',
      tax_number: '',
      email: ''
    },
    loading: false
  },

  onLoad() {
    console.log('[开发票] 页面加载');
    // 初始化数据，确保页面能显示
    this.setData({
      tickets: [],
      currentTab: 'unissued',
      selectedTickets: [],
      showForm: false,
      loading: false
    });
    try {
      this.loadTickets();
    } catch (error) {
      console.error('[开发票] 页面加载错误:', error);
      // 即使出错也显示页面
      this.setData({ 
        loading: false,
        tickets: []
      });
    }
  },

  onShow() {
    console.log('[开发票] 页面显示');
    try {
      this.loadTickets();
    } catch (error) {
      console.error('[开发票] 页面显示错误:', error);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      currentTab: tab,
      selectedTickets: [],
      showForm: false
    });
    this.loadTickets();
  },

  async loadTickets() {
    console.log('[开发票] 开始加载课券数据');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[开发票] 用户未登录，显示空列表');
        // 不阻止页面显示，允许用户看到页面结构
        this.setData({ 
          tickets: [],
          loading: false 
        });
        return;
      }

      console.log('[开发票] 用户已登录，user_id:', userInfo.id);

      // 获取已使用的课券（包括用户自己使用的和用户赠予出去且已被使用的）
      const res = await app.request({
        url: '/tickets/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: 'used' // 明确指定状态为已使用
        }
      });

      console.log('[开发票] API响应:', res);
      if (res.success) {
        const allTickets = res.data || [];
        console.log('[开发票] 获取到的所有课券数量:', allTickets.length);
        // 筛选可开发票的课券（已使用，且can_invoice不为false）
        // 注意：受赠人收到的赠予课券（source = 'gift'）被使用后，只有赠予人可以开票，受赠人不能开票
        // 后端已经正确设置了can_invoice字段，前端只需根据can_invoice判断即可
        const invoiceableTickets = allTickets.filter(ticket => {
          // 必须是已使用状态
          if (ticket.status !== 'used') {
            return false;
          }
          // 检查can_invoice标记：如果为false，说明不能开票
          // 后端会根据课券来源和当前用户身份正确设置can_invoice：
          // - 对于赠予课券：如果当前用户是赠予人（source_user_id = user_id），can_invoice = true；如果是受赠人，can_invoice = false
          // - 对于普通课券：can_invoice = true
          if (ticket.can_invoice === false) {
            return false;
          }
          // 默认允许开票（如果can_invoice为undefined或true）
          return true;
        });
        console.log('[开发票] 可开发票的课券数量:', invoiceableTickets.length);

        // 根据当前标签页筛选（使用 invoice_status 判断）
        const filteredTickets = invoiceableTickets.filter(ticket => {
          if (this.data.currentTab === 'unissued') {
            // 未开：invoice_status 为 'unissued' 或 null/undefined
            return !ticket.invoice_status || ticket.invoice_status === 'unissued';
          } else {
            // 已开：invoice_status 为 'issued'
            return ticket.invoice_status === 'issued';
          }
        });

        // 清理无效的选中项（不在当前列表中的ID）
        const currentTicketIds = filteredTickets.map(t => String(t.id));
        const validSelectedTickets = this.data.selectedTickets
          .map(id => String(id))
          .filter(id => currentTicketIds.includes(id));

        // 为每个 ticket 添加 isSelected 属性，方便模板使用
        const processedTickets = filteredTickets.map(ticket => {
          const ticketIdStr = String(ticket.id);
          const isSelected = validSelectedTickets.indexOf(ticketIdStr) !== -1;
          // 使用 Object.assign 替代扩展运算符
          return Object.assign({}, ticket, {
            used_at_formatted: this.formatDateTime(ticket.used_at),
            actual_amount_formatted: parseFloat(ticket.actual_amount || 0).toFixed(2),
            isSelected: isSelected === true // 确保是明确的布尔值
          });
        });

        console.log('加载课券后清理选中项:', {
          before: this.data.selectedTickets,
          after: validSelectedTickets,
          currentTicketIds: currentTicketIds,
          processedTickets: processedTickets.map(t => ({ id: t.id, isSelected: t.isSelected }))
        });

        console.log('[开发票] 处理后的课券数量:', processedTickets.length);
        this.setData({
          tickets: processedTickets,
          selectedTickets: validSelectedTickets,
          loading: false
        });
        console.log('[开发票] 数据设置完成');
      } else {
        console.error('[开发票] API返回失败:', res);
        this.setData({ 
          tickets: [],
          loading: false 
        });
      }
    } catch (error) {
      console.error('[开发票] 加载课券失败:', error);
      // 即使出错也显示页面，只是没有数据
      this.setData({ 
        loading: false,
        tickets: []
      });
      // 不显示错误提示，让页面正常显示
      console.log('[开发票] 错误已处理，页面可以正常显示');
    }
  },

  // 判断课券是否被选中
  isTicketSelected(ticketId) {
    const ticketIdStr = String(ticketId);
    const selectedTickets = this.data.selectedTickets.map(id => String(id));
    return selectedTickets.indexOf(ticketIdStr) !== -1;
  },

  toggleTicket(e) {
    const ticketId = e.currentTarget.dataset.id;
    // 统一转换为字符串进行比较，避免类型不匹配
    const ticketIdStr = String(ticketId);
    // 使用 slice() 替代扩展运算符进行数组复制
    let selectedTickets = this.data.selectedTickets.slice();
    
    // 确保所有ID都是字符串类型
    selectedTickets = selectedTickets.map(id => String(id));
    
    const index = selectedTickets.indexOf(ticketIdStr);
    const isCurrentlySelected = index > -1;
    
    if (isCurrentlySelected) {
      // 取消选中
      selectedTickets.splice(index, 1);
    } else {
      // 选中
      selectedTickets.push(ticketIdStr);
    }

    // 更新所有 tickets 的 isSelected 状态，确保与 selectedTickets 数组完全同步
    const tickets = this.data.tickets.map(ticket => {
      const ticketIdStr2 = String(ticket.id);
      const isSelected = selectedTickets.indexOf(ticketIdStr2) !== -1;
      // 使用 Object.assign 替代扩展运算符
      return Object.assign({}, ticket, {
        isSelected: isSelected
      });
    });

    console.log('选中状态更新:', {
      ticketId: ticketIdStr,
      selectedTickets: selectedTickets,
      action: isCurrentlySelected ? '取消选中' : '选中',
      ticketsUpdated: tickets.map(t => ({ id: t.id, isSelected: t.isSelected }))
    });

    this.setData({ 
      selectedTickets,
      tickets
    });
  },

  showInvoiceForm() {
    if (this.data.selectedTickets.length === 0) {
      wx.showToast({
        title: '请选择要开发票的课券',
        icon: 'none'
      });
      return;
    }

    // 计算总金额（使用实际支付金额）
    // 统一转换为字符串进行比较
    const selectedTicketsStr = this.data.selectedTickets.map(id => String(id));
    const selectedTicketsData = this.data.tickets.filter(t => 
      selectedTicketsStr.includes(String(t.id))
    );
    const totalAmount = selectedTicketsData.reduce((sum, t) => {
      return sum + parseFloat(t.actual_amount || 0);
    }, 0);

    // 检查单张发票金额上限（假设为10000元）
    if (totalAmount > 10000) {
      wx.showModal({
        title: '提示',
        content: `总金额超过单张发票上限（10000元），当前金额：¥${totalAmount.toFixed(2)}，请分批开票`,
        showCancel: false
      });
      return;
    }

    this.setData({ 
      showForm: true,
      totalAmount: totalAmount.toFixed(2)
    });
  },

  onHeaderInput(e) {
    this.setData({
      'invoiceForm.header': e.detail.value
    });
  },

  onTaxNumberInput(e) {
    this.setData({
      'invoiceForm.tax_number': e.detail.value
    });
  },

  onEmailInput(e) {
    this.setData({
      'invoiceForm.email': e.detail.value
    });
  },

  cancelForm() {
    this.setData({
      showForm: false,
      invoiceForm: {
        header: '',
        tax_number: '',
        email: ''
      }
    });
  },

  stopPropagation() {
    // 阻止事件冒泡，防止点击表单内容时关闭弹窗
  },

  async submitInvoice() {
    const { invoiceForm, selectedTickets } = this.data;

    // 获取用户信息
    const userInfo = app.globalData.userInfo;
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    if (!invoiceForm.header) {
      wx.showToast({
        title: '请填写发票抬头',
        icon: 'none'
      });
      return;
    }

    if (!invoiceForm.email) {
      wx.showToast({
        title: '请填写收发票邮箱',
        icon: 'none'
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invoiceForm.email)) {
      wx.showToast({
        title: '请输入正确的邮箱地址',
        icon: 'none'
      });
      return;
    }

    try {
      // 确保发送的 ticket_ids 是数字类型（如果后端需要）
      const ticketIds = selectedTickets.map(id => {
        const numId = parseInt(id);
        return isNaN(numId) ? id : numId;
      });

      const res = await app.request({
        url: '/tickets/invoice',
        method: 'POST',
        data: {
          user_id: userInfo.id, // 传递用户ID用于权限验证
          ticket_ids: ticketIds,
          invoice_header: invoiceForm.header,
          tax_number: invoiceForm.tax_number || null,
          email: invoiceForm.email
        }
      });

      if (res.success) {
        wx.showModal({
          title: '提交成功',
          content: '您的发票申请已提交成功，稍后会将电子发票发送至您预留的邮箱，请耐心等待。',
          showCancel: false,
          success: () => {
            // 清空选中状态和表单
            this.setData({
              selectedTickets: [],
              showForm: false,
              invoiceForm: {
                header: '',
                tax_number: '',
                email: ''
              }
            });
            
            // 重新加载数据，已开票的课券会自动从"未开"标签页消失
            // 如果当前在"未开"标签页，提交后的课券会消失（因为 invoice_status 已变为 'issued'）
            // 用户可以切换到"已开"标签页查看已提交的课券
            this.loadTickets();
          }
        });
      }
    } catch (error) {
      console.error('开发票失败', error);
      wx.showToast({
        title: error.error || error.message || '开票失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});

