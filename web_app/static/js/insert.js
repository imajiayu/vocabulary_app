window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('word');
    const search = document.getElementById('search');
    const btnUnremembered = document.getElementById('filter-unremembered');
    const btnRemembered = document.getElementById('filter-remembered');
    const form = document.getElementById('insert-form');
    const flashes = document.querySelectorAll('.flash');

        flashes.forEach(flash => {
            setTimeout(() => {
                flash.style.transition = "opacity 0.5s";
                flash.style.opacity = 0;
                setTimeout(() => flash.remove(), 500); // fade out 后移除
            }, 1000); // 1 秒
        });

    // 获取所有复选框，每次调用动态获取
    const getWordItems = () => document.querySelectorAll('.word-item input[type="checkbox"]');

    // 页面加载时聚焦输入框
    input.focus();

    // 更新数量
    function updateCounts() {
        const wordItems = getWordItems();
        let remembered = 0;
        let unremembered = 0;
        wordItems.forEach(cb => {
            if (cb.checked) remembered++;
            else unremembered++;
        });
        btnUnremembered.textContent = `未记住 ${unremembered}`;
        btnRemembered.textContent = `已记住 ${remembered}`;
    }

    function applyFilter() {
        const wordItems = getWordItems();
        const query = search.value.toLowerCase();

        const showRemembered = btnRemembered.classList.contains('active');
        const showUnremembered = btnUnremembered.classList.contains('active');

        wordItems.forEach(cb => {
            const wordLabel = cb.closest('.word-item');
            const word = cb.nextElementSibling.textContent.toLowerCase();

            let matchSearch = word.startsWith(query);
            let matchFilter = true; // 默认显示全部

            // 如果有按钮选中，则根据状态筛选
            if (showRemembered) matchFilter = cb.checked;
            else if (showUnremembered) matchFilter = !cb.checked;

            wordLabel.style.display = (matchSearch && matchFilter) ? 'flex' : 'none';
        });
    }


    // 搜索输入事件
    search.addEventListener('input', applyFilter);

    btnUnremembered.addEventListener('click', () => {
        const wasActive = btnUnremembered.classList.contains('active');

        btnUnremembered.classList.remove('active');
        btnRemembered.classList.remove('active');

        if (!wasActive) btnUnremembered.classList.add('active');

        applyFilter();
    });

    btnRemembered.addEventListener('click', () => {
        const wasActive = btnRemembered.classList.contains('active');

        btnUnremembered.classList.remove('active');
        btnRemembered.classList.remove('active');

        if (!wasActive) btnRemembered.classList.add('active');

        applyFilter();
    });

    // 复选框变化事件
    const bindCheckboxes = () => {
        const wordItems = getWordItems();
        wordItems.forEach(cb => {
            cb.addEventListener('change', () => {
                updateCounts();
                applyFilter();

                // 同步数据库
                fetch("/update_stop_review", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: cb.dataset.id,
                        stop_review: cb.checked ? 1 : 0
                    })
                });
            });
        });
    };

    bindCheckboxes();

    // 表单提交后保持焦点
    form.addEventListener('submit', () => {
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    });

    // 初始统计和筛选
    updateCounts();
    applyFilter();
});

function efToColor(ef) {
    if (ef <= 1.3) return '#ff0000'; // 红
    if (ef >= 3.5) return '#007bff'; // 蓝

    // 1.3 -> 红 (#ff0000) 到 2.5 -> 白 (#ffffff)
    if (ef < 2.5) {
        let t = (ef - 1.3) / (2.5 - 1.3); // 0~1
        // 红到白插值
        let r = Math.round(255 + (255 - 255) * t); // 红色分量固定255
        let g = Math.round(0 + (255 - 0) * t);
        let b = Math.round(0 + (255 - 0) * t);
        return `rgb(${r},${g},${b})`;
    }

    // 2.5 -> 白 (#ffffff) 到 3.5 -> 蓝 (#007bff)
    let t = (ef - 2.5) / (3.5 - 2.5); // 0~1
    let r = Math.round(255 + (0 - 255) * t);
    let g = Math.round(255 + (123 - 255) * t);
    let b = Math.round(255 + (255 - 255) * t);
    return `rgb(${r},${g},${b})`;
}

// 假设你有 word 对象列表
document.querySelectorAll('.word-item').forEach((el) => {
    let ef = parseFloat(el.dataset.ef); // 假设每个label上有 data-ef 属性
    if (!isNaN(ef)) {
        el.style.backgroundColor = efToColor(ef);
    }
});
