// 播放单词音频
function playWordAudio(word) {
    if (!word) return;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${word}&type=2`);
    audio.play().catch(err => console.warn("音频播放失败：", err));
}

document.addEventListener("DOMContentLoaded", () => {
    const wordElement = document.querySelector(".word");
    const definitionElement = document.getElementById("definition");
    const choiceButtons = document.getElementById("choice-buttons");
    const stopButton = document.getElementById("stop-button");
    const stopButtonContainer = document.getElementById("stop-button-container");
    const revealedButtons = document.getElementById("revealed-buttons");
    const correctedButton = document.getElementById("corrected-button");
    const nextButton = document.getElementById("next-button");

    if (!wordElement) return;

    const word = wordElement.dataset.word;
    const wordId = wordElement.dataset.wordId;
    const index = parseInt(wordElement.dataset.index || 0);
    let pendingChoice = null;
    const startTime = Date.now();

    // 播放音频
    playWordAudio(word);
    wordElement.style.cursor = "pointer";
    wordElement.addEventListener("click", () => playWordAudio(word));

    // 处理初始选择
    const handleChoiceClick = (choice) => {
        pendingChoice = choice;

        // 隐藏初始按钮
        if (choiceButtons) choiceButtons.style.display = 'none';
        if (stopButtonContainer) stopButtonContainer.style.display = 'none';

        // 显示释义和 revealed 按钮
        if (definitionElement) definitionElement.style.display = 'block';
        if (revealedButtons) revealedButtons.style.display = 'flex';

        playWordAudio(word);
    };

    // 初始选择按钮绑定
    choiceButtons?.querySelectorAll("button[data-choice]").forEach(btn => {
        btn.addEventListener("click", () => handleChoiceClick(btn.dataset.choice));
    });

    stopButton?.addEventListener("click", () => handleChoiceClick("stop"));

    // 提交结果函数
    const submitResult = (choice) => {
        if (!choice) return;
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        const remembered = choice === 'yes' ? 'yes' : 'no';

        fetch(`/update/${wordId}?index=${index}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `remembered=${remembered}&elapsed_time=${elapsedTime}`
        }).then(() => {
            window.location.href = `/review?index=${index+1}`;
        });
    };

    // 下一个按钮逻辑
    nextButton?.addEventListener("click", () => {
        if (pendingChoice === "stop") {
            fetch(`/stop_review/${wordId}?index=${index}`, { method: 'POST' })
                .then(() => window.location.href = `/review?index=${index+1}`);
        } else {
            submitResult(pendingChoice);
        }
    });

    // 记错了按钮逻辑
    correctedButton?.addEventListener("click", () => submitResult("no"));

    // 快捷键逻辑
    document.addEventListener("keydown", (event) => {
        const isChoiceVisible = choiceButtons && choiceButtons.style.display !== 'none';
        const isRevealedVisible = revealedButtons && revealedButtons.style.display !== 'none';

        if (isChoiceVisible) {
            // 初始选择状态：记住/没记住/不再复习
            switch (event.key) {
                case "ArrowLeft":
                    choiceButtons.querySelector("button[data-choice='yes']")?.click();
                    break;
                case "ArrowRight":
                    choiceButtons.querySelector("button[data-choice='no']")?.click();
                    break;
                case "ArrowDown":
                    stopButton?.click();
                    break;
            }
        } else if (isRevealedVisible) {
            // 已显示释义状态：记错了/下一个
            switch (event.key) {
                case "ArrowLeft":
                    correctedButton?.click();
                    break;
                case "ArrowRight":
                    nextButton?.click();
                    break;
            }
        }
    });
});
