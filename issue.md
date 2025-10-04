# 桌面端

# 移动端
SpeakingSidebar拖拽手柄出现消失动画
# 共同问题
wheelselector步长
设置里切换英美读音
单词关系可视化



# 已解决

7. 不再将shuffle的状态存储在localstorage，而是像source一样存储在后端session中\
不要将source和shuffle的获取方式放在index_summary中，而是新建单独的restful api，用get和post方法设置和获取（改掉原来的source）\
将shuffle的逻辑转移至后端，在满足不同模式筛选条件的过滤、排序和limit下：\
mode_new:不随机时按照id升序，随机时全部打乱\
mode_review：不随机时按照id升序，随机时全部打乱\
mode_lapse: 不随机时按照lapse升序，再按照id升序，\随机时按照lapse升序，将lapse相等的分为一组，组内打乱
mode_spell:不随机时按照id升序，随机时全部打乱

1. topbar的回到首页按钮太大

1. WordInsertForm中的在线搜索结果的框，在关闭后不会完全消失

4. TopBar中间的标题展示不全显示省略号

2. HomePage选择WordIndex时无法向下滚动

3. 点击IOSSwitch时，整个组件的边框会显现

5. VocabularyManagementPage的移动端不需要显示WordTooltip，因为无法做到hover。现在点击单词会触发WordTooltip。或者你有更好的解决方案？

6. HomePage中的SwitchTab从一“栏”变成类似macbook的“刘海屏”，两侧空间是可以点击到背后元素的

2. WordReview的按钮栏高度应该固定，为两排按钮的高度，只不过不同阶段展示和隐藏不同的按钮而已

4. WordSpelling.vue应该和WordReview有相同的按钮栏

3. WordDetailsDisplay 当单词可点击时和展示音标时，去掉hover时的下划线

5. SearchAndFilter中第二个SwitchTab选中全部时，背景为黑色，不好看，换个好看的。且颜色不应该在初始位置就变成目标位置的颜色，应该有过渡

9. switchTab的指示器动画在进入和刷新页面时不应该显示，而是在手动操作时才显示。进入/切换页面，其应该已经在正确的位置上。

10. 在VocabularyManagementPage点击单词打开modal后，滚动屏幕滚动的是背后的页面，而非modal

8. VocabularyManagementPage的api加载时间太长，想办法前端无感分批加载

8. SearchAndFilter的switchTab中的数字随着分页加载而变化。将这些数字在第一次请求时返回。

2. Statistics中似乎只有两个LineChart的响应式有bug，在缩小屏幕宽度时，要么只使用卡片的一半空间，要么被截断

6. 桌面端热力图在数量很少时，行间距很宽，占用了很大的空间，没有贴合。每个正方形都应该上下左右贴合、
移动端热力图的方块大小应该有一个最小值，且列距很大，没有贴合。每个正方形都应该上下左右贴合

7. 移动端的SpeakingSidebar应该不再是侧边栏，而是可以从底部伸出屏幕，拉起后占据几乎整个屏幕，即箭头从朝右朝左变为了朝上朝下。需要hover才展示的按钮变为始终展示。

11. 打开WordDetialsModal下方显示不全，无法滚动到最底部，被Safari地址栏挡住

1. WordIndex中的IndexButton应该放在一个响应式网格ButtonGrid中，可以使用不同长度的按钮组合放置，例如“管理单词”和“查看统计”这两个永远只有icon+标题的IndexButton应该是正方形按钮，在桌面端只有其他按钮一半的长度，在移动端共同占据一行

8. WordDetailsDisplay中的单词本身展示时，由只展示单词模式，变化到完整展示模式，其大小位置应该不变，这样最好
9.  现在移动端样式的一个主要问题是背景和竖直方向上的滚动。我在global.css中为app-container设置了统一的渐变
  背景，并不希望其在页面长度剧烈变化时改变，所以设置了background-attachment: fixed\
  现在移动端的背景会在向下滚动时出现截断。并且会出现两个竖直方向的滚动条。\
  我希望在任何时候都只出现一个最外层的滚动条，页面高度被内容自动撑开，使用设置上下间距的方法防止防止导
  航栏或safari地址栏或按钮栏遮挡。并且在页面中没有足够高度的内容时不可以滚动。\
  12. WordSidebar适配

  13. spelling，弹出输入法，适配

  9. 进度恢复

  切换口语题目时恢复初始状态

  7. 前后端web socket报错

ReviewPage背景

8. echart报错，热力图高度不响应