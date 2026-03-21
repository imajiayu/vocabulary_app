/* courses/shared/nav.js — 课程页面顶部导航栏（自动注入） */
(function() {
  var path = location.pathname;
  // 生产环境: /uk/*, /legal/*
  // 本地预览: .../ukrainian/lessons/*, .../legal-english/lessons/*
  var isUk = path.indexOf('/uk/') === 0 || path.indexOf('/ukrainian/lessons/') !== -1;
  var isLegal = path.indexOf('/legal/') === 0 || path.indexOf('/legal-english/lessons/') !== -1;
  if (!isUk && !isLegal) return;

  var courseName = isUk ? '乌克兰语课程' : '法律英语课程';
  var isIndex = path.endsWith('/') || path.endsWith('/index.html');

  var nav = document.createElement('nav');
  nav.className = 'course-nav';

  var left = document.createElement('div');
  left.className = 'course-nav-left';

  if (isIndex) {
    var homeLink = document.createElement('a');
    homeLink.href = '/';
    homeLink.className = 'course-nav-link';
    homeLink.textContent = '← IELTS Study 主页';
    left.appendChild(homeLink);
  } else {
    // 课时页：返回课程首页（相对路径，本地和生产都能用）
    var backLink = document.createElement('a');
    backLink.href = './';
    backLink.className = 'course-nav-link';
    backLink.textContent = '← ' + courseName;
    left.appendChild(backLink);
  }

  nav.appendChild(left);

  if (!isIndex) {
    var right = document.createElement('div');
    right.className = 'course-nav-right';
    var homeLink2 = document.createElement('a');
    homeLink2.href = '/';
    homeLink2.className = 'course-nav-link course-nav-home';
    homeLink2.textContent = 'IELTS Study 主页';
    right.appendChild(homeLink2);
    nav.appendChild(right);
  }

  document.body.insertBefore(nav, document.body.firstChild);
})();
