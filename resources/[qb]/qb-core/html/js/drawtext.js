let direction = null;

const drawText = async (textData) => {
    const text = document.getElementById("text");
    let { position } = textData;
    switch (textData.position) {
        case "left":
            addClass(text, position);
            direction = "left";
            break;
        case "top":
            addClass(text, position);
            direction = "top";
            break;
        case "right":
            addClass(text, position);
            direction = "right";
            break;
        default:
            addClass(text, "left");
            direction = "left";
            break;
    }

    text.innerHTML = formatTextContent(textData.text);
    document.getElementById("drawtext-container").style.display = "block";
    await sleep(100);
    addClass(text, "show");
};

const changeText = async (textData) => {
    const text = document.getElementById("text");
    let { position } = textData;

    removeClass(text, "show");
    addClass(text, "pressed");
    addClass(text, "hide");

    await sleep(500);
    removeClass(text, "left");
    removeClass(text, "right");
    removeClass(text, "top");
    removeClass(text, "bottom");
    removeClass(text, "hide");
    removeClass(text, "pressed");

    switch (textData.position) {
        case "left":
            addClass(text, position);
            direction = "left";
            break;
        case "top":
            addClass(text, position);
            direction = "top";
            break;
        case "right":
            addClass(text, position);
            direction = "right";
            break;
        default:
            addClass(text, "left");
            direction = "left";
            break;
    }
    text.innerHTML = formatTextContent(textData.text);

    await sleep(100);
    text.classList.add("show");
};

const hideText = async () => {
    const text = document.getElementById("text");
    removeClass(text, "show");
    addClass(text, "hide");

    setTimeout(() => {
        removeClass(text, "left");
        removeClass(text, "right");
        removeClass(text, "top");
        removeClass(text, "bottom");
        removeClass(text, "hide");
        removeClass(text, "pressed");
        document.getElementById("drawtext-container").style.display = "none";
    }, 1000);
};

const keyPressed = () => {
    const text = document.getElementById("text");
    addClass(text, "pressed");
};

window.addEventListener("message", (event) => {
    const data = event.data;
    const action = data.action;
    const textData = data.data;
    switch (action) {
        case "DRAW_TEXT":
            return drawText(textData);
        case "CHANGE_TEXT":
            return changeText(textData);
        case "HIDE_TEXT":
            return hideText();
        case "KEY_PRESSED":
            return keyPressed();
        default:
            return;
    }
});

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string") return "";
    return unsafe
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
};

// Converts leading [KEY] into a styled keycap + label, e.g. "[E] Shop" → <span class="keycap">E</span> <span class="label">Shop</span>
const formatTextContent = (raw) => {
    const safe = escapeHtml(String(raw ?? ""));
    // Match a leading [KEY] and capture the rest of the text
    const match = safe.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (match) {
        const key = match[1].trim();
        const rest = match[2] ?? "";
        return `<span class="keycap">${key}</span><span class="label">${rest}</span>`;
    }
    return `<span class="label">${safe}</span>`;
};

const removeClass = (element, name) => {
    if (element.classList.contains(name)) {
        element.classList.remove(name);
    }
};

const addClass = (element, name) => {
    if (!element.classList.contains(name)) {
        element.classList.add(name);
    }
};
