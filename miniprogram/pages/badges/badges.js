// pages/badges/badges.js
const app = getApp();

Page({
  data: {
    inviteCount: 0,
    badgeLevel: null,
    invitees: []
  },

  onLoad() {
    this.loadBadgeInfo();
  },

  async loadBadgeInfo() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          success: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
        return;
      }

      // 获取用户信息和邀请统计
      const res = await app.request({
        url: `/users/${userInfo.id}`,
        method: 'GET'
      });

      if (res.success && res.data.invite_stats) {
        const registered = res.data.invite_stats.registered || 0;
        this.setData({ inviteCount: registered });

        // 计算徽章等级
        let badgeLevel = null;
        if (registered >= 27) {
          badgeLevel = '钻石';
        } else if (registered >= 9) {
          badgeLevel = '黄金';
        } else if (registered >= 3) {
          badgeLevel = '白银';
        } else if (registered >= 1) {
          badgeLevel = '青铜';
        }
        this.setData({ badgeLevel });

        // 获取被邀请人列表
        await this.loadInvitees(userInfo.id);
      }
    } catch (error) {
      console.error('加载徽章信息失败', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async loadInvitees(userId) {
    try {
      const res = await app.request({
        url: '/invitations/list',
        method: 'GET',
        data: { inviter_id: userId }
      });

      if (res.success) {
        // 只获取已注册的被邀请人
        const registeredInvitees = res.data.filter(inv => inv.status === 'registered' && inv.invitee_id);
        
        // 获取被邀请人的详细信息
        const inviteeIds = registeredInvitees.map(inv => inv.invitee_id);
        if (inviteeIds.length > 0) {
          const invitees = await Promise.all(
            inviteeIds.map(async (id) => {
              try {
                const userRes = await app.request({
                  url: `/users/${id}`,
                  method: 'GET'
                });
                if (userRes.success) {
                  return {
                    id: userRes.data.id,
                    nickname: userRes.data.nickname,
                    registered_at_formatted: this.formatDateTime(
                      registeredInvitees.find(inv => inv.invitee_id === id)?.registered_at
                    )
                  };
                }
              } catch (e) {
                return null;
              }
            })
          );

          this.setData({
            invitees: invitees.filter(inv => inv !== null)
          });
        }
      }
    } catch (error) {
      console.error('加载被邀请人列表失败', error);
    }
  },

  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
