// 课程评价问卷模板
module.exports = {
  questions: [
    {
      id: 'q1',
      type: 'single',
      text: '相比于您参加过的与本主题类似的其他培训，您认为本次培训的价值',
      required: true,
      options: [
        { value: 'A', label: '更高' },
        { value: 'B', label: '差不多' },
        { value: 'C', label: '偏低' },
        { value: 'D', label: '没参加过类似本主题的培训，但认为本次培训对您的价值比较高。' },
        { value: 'E', label: '没参加过类似本主题的培训，但认为本次培训对您没有很大价值。' }
      ]
    },
    {
      id: 'q2',
      type: 'single',
      text: '您认为本次授课的资深大牛CFO的水平是否达到了您来之前的预期?',
      required: true,
      options: [
        { value: 'A', label: '大为超出预期' },
        { value: 'B', label: '基本符合预期' },
        { value: 'C', label: '明显低于预期' }
      ]
    },
    {
      id: 'q3',
      type: 'single',
      text: '认知突破，新的框架和方法论:',
      required: true,
      options: [
        { value: 'A', label: '很有启发' },
        { value: 'B', label: '有一些启发' },
        { value: 'C', label: '几乎没有启发' }
      ]
    },
    {
      id: 'q4',
      type: 'single',
      text: '理解如何将认知突破和框架方法论应用于解决实际问题:',
      required: true,
      options: [
        { value: 'A', label: '很有帮助' },
        { value: 'B', label: '有一些帮助' },
        { value: 'C', label: '几乎没有帮助' }
      ]
    },
    {
      id: 'q5',
      type: 'single',
      text: '不论本次做的如何，您建议未来希望我们继续坚持教练启发式授课吗:',
      required: true,
      options: [
        { value: 'A', label: '继续坚持，>50%时间用于互动式学习' },
        { value: 'B', label: '很难做好，不必强求，可适当削减互动时间' },
        { value: 'C', label: '不必继续，因为讲座式培训更适合中国文化' }
      ]
    },
    {
      id: 'q6',
      type: 'rating',
      text: '您认为授课中所用案例是否有效帮助了课程的学习？（1最无效，5最有效）',
      required: true,
      ratingItems: [
        { id: 'case1', label: '案例1' },
        { id: 'case2', label: '案例2' },
        { id: 'case3', label: '案例3' },
        { id: 'case4', label: '案例4' },
        { id: 'case5', label: '案例5' },
        { id: 'case6', label: '案例6' }
      ],
      min: 1,
      max: 5
    },
    {
      id: 'q7',
      type: 'text',
      text: '您对本次课程还有哪些反馈和建议？对课程内容，对课程设计（私教讲授 vs. 学员讨论 vs. 点评复盘），对私教等等。',
      required: true,
      placeholder: '请输入您的反馈和建议'
    },
    {
      id: 'q8',
      type: 'matrix',
      text: '如果未来有本次大牛私教的其他课程（包括本主题下的延伸课或其他主题下的课程），或者本主题下的其他大牛私教的课程，您也希望参加吗？我们可以帮您预报名。',
      required: true,
      matrixRows: [
        { id: 'row1', label: '本次私教在本主题下的延伸课程' },
        { id: 'row2', label: '本次私教在其他主题下的课程' },
        { id: 'row3', label: '本主题下，其他私教的课程' }
      ],
      matrixCols: [
        { value: 'A', label: '请马上帮我预报名' },
        { value: 'B', label: '愿意考虑' },
        { value: 'C', label: '不考虑' }
      ]
    },
    {
      id: 'q9',
      type: 'single',
      text: '您是否愿意推荐本课程和推荐本培训项目给您认识的财务同行好友?',
      required: true,
      options: [
        { value: 'A', label: '很愿意，希望立即行动（课程助理会给您使用推荐链接/二维码的方法）' },
        { value: 'B', label: '不太愿意或还要再想一想' }
      ]
    },
    {
      id: 'q10',
      type: 'text',
      text: '您的姓名',
      required: true,
      placeholder: '请输入您的姓名'
    },
    {
      id: 'q11',
      type: 'text',
      text: '请输入您的手机号码',
      required: true,
      placeholder: '请输入您的手机号码'
    }
  ]
};

