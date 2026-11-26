(function () {
    try {
        var mode = window.localStorage.getItem("nethack-color-mode");
        if (mode === "light" || mode === "dark") {
            document.documentElement.dataset.theme = mode;
        }
        var locale = window.localStorage.getItem("nethack-locale");
        if (locale) {
            document.documentElement.lang = locale;
        }
    } catch (error) {
        document.documentElement.dataset.theme = "dark";
    }
})();
