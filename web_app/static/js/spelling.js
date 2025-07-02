function playWordAudio(word) {
    if (!word) return;
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${word}&type=2`);
    audio.play().catch(err => console.warn("音频播放失败：", err));
}

document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".spelling-container");
    if (!container) return;

    const word = container.dataset.word;
    const index = parseInt(container.dataset.index || 0);

    const playBtn = container.querySelector(".play-btn");
    const input = container.querySelector(".spelling-input");
    const nextBtn = container.querySelector(".next-btn");

    playBtn.addEventListener('click', () => {
        input.focus();
    });

    // 自动播放一次
    playWordAudio(word);

    input.focus();

    // 播放按钮
    playBtn.addEventListener("click", () => playWordAudio(word));

    const validate = () => {
        if (input.value.trim().toLowerCase() === word.toLowerCase()) {
            input.classList.add("correct");
            input.classList.remove("incorrect");
            nextBtn.classList.add("show"); // 显示下一个按钮
        } else {
            input.classList.remove("correct");
            input.classList.add("incorrect");
            nextBtn.classList.remove("show"); // 隐藏下一个按钮
        }
    };

    input.addEventListener("input", validate);

    // 下一个按钮
    nextBtn.addEventListener("click", () => {
        window.location.href = `/spelling?index=${index + 1}`;
    });

    // enter 快捷键
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && nextBtn.classList.contains("show")) {
            nextBtn.click();
        }
        if (e.key === "ArrowUp") {
            playBtn.click();
        }
    });
});
